/**
 * QueryCache - специализированный кэш для query embeddings
 *
 * Реализует LRU (Least Recently Used) кэширование с оптимизацией
 * для поисковых запросов. Включает интеллектуальную политику выселения,
 * приоритизацию по частоте использования и статистику производительности.
 */

import { CacheError } from '../embedding/errors.js';

/**
 * Опции для записи в кэш
 */
export interface QueryCacheOptions {
  /** Время жизни в миллисекундах */
  ttl?: number;
  /** Приоритет элемента */
  priority?: 'low' | 'normal' | 'high';
  /** Теги для группировки */
  tags?: string[];
}

/**
 * Элемент кэша с метаданными
 */
export interface QueryCacheEntry<T = any> {
  /** Ключ кэша */
  key: string;
  /** Значение */
  value: T;
  /** Время создания */
  timestamp: number;
  /** Время истечения */
  expiresAt?: number;
  /** Время последнего доступа */
  lastAccessed: number;
  /** Количество обращений */
  accessCount: number;
  /** Приоритет */
  priority: 'low' | 'normal' | 'high';
  /** Теги */
  tags: string[];
  /** Размер в байтах (приблизительно) */
  size: number;
}

/**
 * Конфигурация QueryCache
 */
export interface QueryCacheConfig {
  /** Максимальный размер кэша (количество элементов) */
  maxSize?: number;
  /** Максимальное использование памяти в байтах */
  maxMemory?: number;
  /** TTL по умолчанию в миллисекундах */
  ttl?: number;
  /** Интервал очистки устаревших элементов */
  cleanupInterval?: number;
  /** Стратегия выселения */
  evictionStrategy?: 'lru' | 'lfu' | 'priority' | 'hybrid';
}

/**
 * Статистика QueryCache
 */
export interface QueryCacheStats {
  /** Общее количество элементов */
  size: number;
  /** Максимальный размер */
  maxSize: number;
  /** Использование памяти в байтах */
  memoryUsage: number;
  /** Максимальное использование памяти */
  maxMemory: number;
  /** Количество попаданий */
  hits: number;
  /** Количество промахов */
  misses: number;
  /** Процент попаданий */
  hitRate: number;
  /** Количество выселений */
  evictions: number;
  /** Средний размер элемента */
  averageEntrySize: number;
  /** Количество истекших элементов */
  expiredEntries: number;
}

/**
 * Основная реализация QueryCache
 */
export class QueryCache<T = any> {
  private cache: Map<string, QueryCacheEntry<T>>;
  private accessOrder: string[]; // Для LRU tracking
  private config: Required<QueryCacheConfig>;
  private cleanupTimer: NodeJS.Timeout | null;

  // Статистика
  private stats: {
    hits: number;
    misses: number;
    evictions: number;
    expiredEntries: number;
    totalAccessTime: number;
    totalAccessCount: number;
  };

  constructor(config: QueryCacheConfig = {}) {
    this.cache = new Map();
    this.accessOrder = [];

    this.config = {
      maxSize: config.maxSize || 1000,
      maxMemory: config.maxMemory || 100 * 1024 * 1024, // 100MB
      ttl: config.ttl || 5 * 60 * 1000, // 5 минут
      cleanupInterval: config.cleanupInterval || 60 * 1000, // 1 минута
      evictionStrategy: config.evictionStrategy || 'lru'
    };

    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      expiredEntries: 0,
      totalAccessTime: 0,
      totalAccessCount: 0
    };

    this.cleanupTimer = null;
    this.startCleanupTimer();
  }

  /**
   * Получение значения из кэша
   */
  async get(key: string): Promise<T | null> {
    const startTime = Date.now();

    try {
      const entry = this.cache.get(key);

      if (!entry) {
        this.stats.misses++;
        return null;
      }

      // Проверяем истечение TTL
      if (entry.expiresAt && Date.now() > entry.expiresAt) {
        this.cache.delete(key);
        this.removeFromAccessOrder(key);
        this.stats.expiredEntries++;
        this.stats.misses++;
        return null;
      }

      // Обновляем статистику доступа
      entry.lastAccessed = Date.now();
      entry.accessCount++;
      this.moveToFront(key);

      this.stats.hits++;
      return entry.value;

    } finally {
      this.stats.totalAccessTime += Date.now() - startTime;
      this.stats.totalAccessCount++;
    }
  }

  /**
   * Сохранение значения в кэше
   */
  async set(key: string, value: T, options: QueryCacheOptions = {}): Promise<void> {
    const {
      ttl = this.config.ttl,
      priority = 'normal',
      tags = []
    } = options;

    const now = Date.now();
    const size = this.estimateSize(value);

    // Создаем элемент кэша
    const entry: QueryCacheEntry<T> = {
      key,
      value,
      timestamp: now,
      expiresAt: ttl ? now + ttl : undefined,
      lastAccessed: now,
      accessCount: 1,
      priority,
      tags,
      size
    };

    // Проверяем, нужно ли освободить место
    await this.ensureSpace(size);

    // Сохраняем элемент
    if (this.cache.has(key)) {
      // Обновляем существующий элемент
      this.removeFromAccessOrder(key);
    }

    this.cache.set(key, entry);
    this.accessOrder.unshift(key);

    // Проверяем превышение лимитов после добавления
    await this.enforceConstraints();
  }

  /**
   * Удаление элемента из кэша
   */
  async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.removeFromAccessOrder(key);
    }
    return deleted;
  }

  /**
   * Проверка наличия ключа в кэше
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    // Проверяем истечение TTL
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.stats.expiredEntries++;
      return false;
    }

    return true;
  }

  /**
   * Получение размера кэша
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Очистка кэша
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.accessOrder = [];

    // Сброс статистики (кроме общих метрик)
    const totalHits = this.stats.hits;
    const totalMisses = this.stats.misses;

    this.stats = {
      hits: totalHits,
      misses: totalMisses,
      evictions: 0,
      expiredEntries: 0,
      totalAccessTime: this.stats.totalAccessTime,
      totalAccessCount: this.stats.totalAccessCount
    };
  }

  /**
   * Удаление элементов по паттерну или тегам
   */
  async invalidate(pattern: string): Promise<void> {
    const keysToDelete: string[] = [];

    if (pattern === '*') {
      // Удаляем все элементы
      keysToDelete.push(...this.cache.keys());
    } else if (pattern.startsWith('tag:')) {
      // Удаляем по тегу
      const tag = pattern.substring(4);
      for (const [key, entry] of this.cache.entries()) {
        if (entry.tags.includes(tag)) {
          keysToDelete.push(key);
        }
      }
    } else if (pattern.includes('*')) {
      // Удаляем по wildcard паттерну
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      for (const key of this.cache.keys()) {
        if (regex.test(key)) {
          keysToDelete.push(key);
        }
      }
    } else {
      // Точное совпадение
      if (this.cache.has(pattern)) {
        keysToDelete.push(pattern);
      }
    }

    // Удаляем найденные ключи
    for (const key of keysToDelete) {
      await this.delete(key);
    }
  }

  /**
   * Получение статистики кэша
   */
  getStats(): QueryCacheStats {
    const memoryUsage = this.getMemoryUsage();
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;

    const averageEntrySize = this.cache.size > 0
      ? Array.from(this.cache.values()).reduce((sum, entry) => sum + entry.size, 0) / this.cache.size
      : 0;

    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      memoryUsage,
      maxMemory: this.config.maxMemory,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate,
      evictions: this.stats.evictions,
      averageEntrySize,
      expiredEntries: this.stats.expiredEntries
    };
  }

  /**
   * Оптимизация кэша
   */
  async optimize(): Promise<void> {
    // Удаляем истекшие элементы
    await this.cleanupExpired();

    // Применяем стратегию выселения если нужно
    await this.enforceConstraints();

    // Дефрагментируем accessOrder
    this.defragmentAccessOrder();
  }

  /**
   * Получение текущего использования памяти
   */
  getMemoryUsage(): number {
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += entry.size;
    }
    return totalSize;
  }

  // === Приватные методы ===

  /**
   * Обеспечение доступного места в кэше
   */
  private async ensureSpace(requiredSize: number): Promise<void> {
    const currentMemory = this.getMemoryUsage();

    if (currentMemory + requiredSize > this.config.maxMemory ||
        this.cache.size >= this.config.maxSize) {
      await this.evictEntries(requiredSize);
    }
  }

  /**
   * Применение ограничений кэша
   */
  private async enforceConstraints(): Promise<void> {
    // Удаляем истекшие элементы
    await this.cleanupExpired();

    // Проверяем размерные ограничения
    const currentMemory = this.getMemoryUsage();

    if (currentMemory > this.config.maxMemory || this.cache.size > this.config.maxSize) {
      await this.evictEntries(0);
    }
  }

  /**
   * Выселение элементов согласно стратегии
   */
  private async evictEntries(requiredSpace: number): Promise<void> {
    const targetMemory = this.config.maxMemory * 0.8; // Освобождаем до 80% лимита
    const targetSize = Math.floor(this.config.maxSize * 0.8);

    let freedMemory = 0;
    const keysToEvict: string[] = [];

    // Сортируем элементы по приоритету выселения
    const entries = Array.from(this.cache.entries());
    const sortedEntries = this.sortForEviction(entries);

    for (const [key, entry] of sortedEntries) {
      keysToEvict.push(key);
      freedMemory += entry.size;

      const remainingMemory = this.getMemoryUsage() - freedMemory;
      const remainingCount = this.cache.size - keysToEvict.length;

      // Проверяем, достигли ли целевых показателей
      if (remainingMemory <= targetMemory &&
          remainingMemory <= this.config.maxMemory - requiredSpace &&
          remainingCount <= targetSize) {
        break;
      }
    }

    // Выселяем элементы
    for (const key of keysToEvict) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.stats.evictions++;
    }

    console.log(`Evicted ${keysToEvict.length} entries, freed ${freedMemory} bytes`);
  }

  /**
   * Сортировка элементов для выселения
   */
  private sortForEviction(entries: [string, QueryCacheEntry<T>][]): [string, QueryCacheEntry<T>][] {
    switch (this.config.evictionStrategy) {
      case 'lru':
        return entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

      case 'lfu':
        return entries.sort((a, b) => a[1].accessCount - b[1].accessCount);

      case 'priority':
        const priorityOrder = { 'low': 0, 'normal': 1, 'high': 2 };
        return entries.sort((a, b) => {
          const priorityDiff = priorityOrder[a[1].priority] - priorityOrder[b[1].priority];
          if (priorityDiff !== 0) return priorityDiff;
          return a[1].lastAccessed - b[1].lastAccessed; // LRU как tiebreaker
        });

      case 'hybrid':
      default:
        // Гибридная стратегия: учитываем приоритет, частоту и время
        return entries.sort((a, b) => {
          const priorityOrder = { 'low': 0, 'normal': 1, 'high': 2 };
          const priorityScore = (entry: QueryCacheEntry<T>) => priorityOrder[entry.priority] * 1000;
          const frequencyScore = (entry: QueryCacheEntry<T>) => entry.accessCount * 100;
          const recencyScore = (entry: QueryCacheEntry<T>) => (Date.now() - entry.lastAccessed) / 1000;

          const scoreA = priorityScore(a[1]) + frequencyScore(a[1]) - recencyScore(a[1]);
          const scoreB = priorityScore(b[1]) + frequencyScore(b[1]) - recencyScore(b[1]);

          return scoreA - scoreB; // Меньший score = выселяется первым
        });
    }
  }

  /**
   * Очистка истекших элементов
   */
  private async cleanupExpired(): Promise<void> {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.stats.expiredEntries++;
    }

    if (keysToDelete.length > 0) {
      console.log(`Cleaned up ${keysToDelete.length} expired entries`);
    }
  }

  /**
   * Перемещение элемента в начало списка доступа (LRU)
   */
  private moveToFront(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.unshift(key);
  }

  /**
   * Удаление элемента из списка доступа
   */
  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Дефрагментация списка доступа
   */
  private defragmentAccessOrder(): void {
    this.accessOrder = this.accessOrder.filter(key => this.cache.has(key));
  }

  /**
   * Оценка размера значения в байтах
   */
  private estimateSize(value: T): number {
    try {
      const jsonString = JSON.stringify(value);
      return jsonString.length * 2; // UTF-16 uses 2 bytes per character
    } catch {
      // Fallback для объектов, которые не сериализуются
      return 1000; // 1KB по умолчанию
    }
  }

  /**
   * Запуск таймера очистки
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired().catch(error => {
        console.warn('Cleanup timer error:', error);
      });
    }, this.config.cleanupInterval);
  }

  /**
   * Остановка таймера и освобождение ресурсов
   */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    this.clear();
  }
}