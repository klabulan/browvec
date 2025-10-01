/**
 * Простая система кэширования эмбеддингов в памяти для LocalRetrieve
 *
 * Данный модуль реализует LRU (Least Recently Used) кэш для хранения
 * сгенерированных эмбеддингов в памяти. Кэш помогает избежать повторной
 * генерации одинаковых эмбеддингов для текста с одинаковой конфигурацией.
 */

import type { CollectionEmbeddingConfig, EmbeddingConfig } from '../types.js';
import { EmbeddingUtils, type CacheKeyConfig, type HashResult } from '../utils.js';
import { EmbeddingError } from '../errors.js';

/**
 * Элемент кэша эмбеддингов
 */
export interface CacheEntry {
  /** Вектор эмбеддинга */
  embedding: Float32Array;

  /** Хеш ключа кэша */
  keyHash: string;

  /** Исходный текст (для отладки) */
  text: string;

  /** Размерность вектора */
  dimensions: number;

  /** Время создания записи */
  createdAt: Date;

  /** Время последнего доступа */
  lastAccessedAt: Date;

  /** Количество обращений к записи */
  accessCount: number;

  /** Размер в байтах (приблизительный) */
  sizeBytes: number;

  /** Метаданные провайдера */
  providerMetadata?: Record<string, any>;
}

/**
 * Метрики производительности кэша
 */
export interface CacheMetrics {
  /** Общее количество попыток доступа */
  totalAccesses: number;

  /** Количество попаданий в кэш */
  hits: number;

  /** Количество промахов кэша */
  misses: number;

  /** Количество вытесненных записей */
  evictions: number;

  /** Текущий размер кэша (количество записей) */
  currentSize: number;

  /** Максимальный размер кэша */
  maxSize: number;

  /** Общий размер в байтах */
  totalSizeBytes: number;

  /** Максимальный размер в байтах */
  maxSizeBytes: number;

  /** Коэффициент попаданий (0-1) */
  hitRate: number;

  /** Коэффициент промахов (0-1) */
  missRate: number;

  /** Время последнего сброса метрик */
  lastResetAt: Date;

  /** Время создания кэша */
  createdAt: Date;
}

/**
 * Конфигурация кэша эмбеддингов
 */
export interface MemoryCacheConfig {
  /** Максимальное количество записей в кэше */
  maxEntries?: number;

  /** Максимальный размер кэша в байтах */
  maxSizeBytes?: number;

  /** Включить ли детальное логирование */
  enableLogging?: boolean;

  /** Интервал автоматической очистки в миллисекундах */
  cleanupIntervalMs?: number;

  /** Максимальное время жизни записи в миллисекундах */
  maxEntryAge?: number;

  /** Включить ли сбор расширенных метрик */
  enableDetailedMetrics?: boolean;
}

/**
 * Узел двусвязного списка для LRU алгоритма
 */
class LRUNode {
  constructor(
    public key: string,
    public entry: CacheEntry,
    public prev: LRUNode | null = null,
    public next: LRUNode | null = null
  ) {}
}

/**
 * Простая реализация LRU кэша для эмбеддингов в памяти
 *
 * Данный класс реализует кэш с алгоритмом вытеснения LRU (Least Recently Used).
 * Кэш автоматически удаляет наименее используемые записи при превышении
 * лимитов по количеству записей или размеру в байтах.
 */
export class MemoryCache {
  /** Конфигурация кэша */
  private readonly config: Required<MemoryCacheConfig>;

  /** Основное хранилище записей кэша */
  private readonly cache = new Map<string, LRUNode>();

  /** Голова двусвязного списка (наиболее часто используемые) */
  private head: LRUNode | null = null;

  /** Хвост двусвязного списка (наименее часто используемые) */
  private tail: LRUNode | null = null;

  /** Метрики производительности кэша */
  private metrics: CacheMetrics;

  /** Таймер для автоматической очистки */
  private cleanupTimer: NodeJS.Timeout | number | null = null;

  /** Флаг состояния кэша */
  private disposed = false;

  /**
   * Создание нового экземпляра кэша эмбеддингов
   *
   * @param config - Конфигурация кэша
   */
  constructor(config: MemoryCacheConfig = {}) {
    // Заполняем конфигурацию значениями по умолчанию
    this.config = {
      maxEntries: config.maxEntries ?? 1000,
      maxSizeBytes: config.maxSizeBytes ?? 50 * 1024 * 1024, // 50MB
      enableLogging: config.enableLogging ?? false,
      cleanupIntervalMs: config.cleanupIntervalMs ?? 5 * 60 * 1000, // 5 минут
      maxEntryAge: config.maxEntryAge ?? 60 * 60 * 1000, // 1 час
      enableDetailedMetrics: config.enableDetailedMetrics ?? true
    };

    // Инициализируем метрики
    this.metrics = this.createInitialMetrics();

    // Запускаем автоматическую очистку если настроена
    if (this.config.cleanupIntervalMs > 0) {
      this.startCleanupTimer();
    }

    if (this.config.enableLogging) {
      console.log('[MemoryCache] Инициализирован с конфигурацией:', this.config);
    }
  }

  /**
   * Получение эмбеддинга из кэша
   *
   * @param text - Текст для поиска в кэше
   * @param collectionConfig - Конфигурация коллекции
   * @param globalConfig - Глобальная конфигурация
   * @returns Эмбеддинг из кэша или null если не найден
   */
  public async get(
    text: string,
    collectionConfig?: CollectionEmbeddingConfig,
    globalConfig?: EmbeddingConfig
  ): Promise<Float32Array | null> {
    this.ensureNotDisposed();

    try {
      // Генерируем ключ кэша
      const cacheKeyConfig: CacheKeyConfig = {
        text,
        collectionConfig,
        globalConfig
      };

      const hashResult = await EmbeddingUtils.generateCacheKey(cacheKeyConfig);
      const cacheKey = hashResult.hash;

      this.metrics.totalAccesses++;

      // Ищем запись в кэше
      const node = this.cache.get(cacheKey);
      if (!node) {
        this.metrics.misses++;
        this.updateHitRate();

        if (this.config.enableLogging) {
          console.log(`[MemoryCache] Промах кэша для ключа: ${cacheKey.substring(0, 16)}...`);
        }

        return null;
      }

      // Обновляем статистику доступа
      node.entry.lastAccessedAt = new Date();
      node.entry.accessCount++;
      this.metrics.hits++;
      this.updateHitRate();

      // Перемещаем узел в начало списка (делаем наиболее используемым)
      this.moveToHead(node);

      if (this.config.enableLogging) {
        console.log(`[MemoryCache] Попадание в кэш для ключа: ${cacheKey.substring(0, 16)}...`);
      }

      return node.entry.embedding;
    } catch (error) {
      if (this.config.enableLogging) {
        console.error('[MemoryCache] Ошибка при получении из кэша:', error);
      }
      return null;
    }
  }

  /**
   * Сохранение эмбеддинга в кэш
   *
   * @param text - Исходный текст
   * @param embedding - Вектор эмбеддинга
   * @param collectionConfig - Конфигурация коллекции
   * @param globalConfig - Глобальная конфигурация
   * @param providerMetadata - Метаданные провайдера
   */
  public async set(
    text: string,
    embedding: Float32Array,
    collectionConfig?: CollectionEmbeddingConfig,
    globalConfig?: EmbeddingConfig,
    providerMetadata?: Record<string, any>
  ): Promise<void> {
    this.ensureNotDisposed();

    try {
      // Генерируем ключ кэша
      const cacheKeyConfig: CacheKeyConfig = {
        text,
        collectionConfig,
        globalConfig
      };

      const hashResult = await EmbeddingUtils.generateCacheKey(cacheKeyConfig);
      const cacheKey = hashResult.hash;

      // Вычисляем размер записи в байтах
      const sizeBytes = this.calculateEntrySize(text, embedding, providerMetadata);

      // Проверяем, не превышает ли одна запись максимальный размер
      if (sizeBytes > this.config.maxSizeBytes) {
        if (this.config.enableLogging) {
          console.warn('[MemoryCache] Запись слишком большая для кэширования:', sizeBytes);
        }
        return;
      }

      // Создаем новую запись
      const entry: CacheEntry = {
        embedding: new Float32Array(embedding), // Создаем копию
        keyHash: cacheKey,
        text,
        dimensions: embedding.length,
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        accessCount: 1,
        sizeBytes,
        providerMetadata: providerMetadata ? { ...providerMetadata } : undefined
      };

      // Проверяем, существует ли уже запись с таким ключом
      const existingNode = this.cache.get(cacheKey);
      if (existingNode) {
        // Обновляем существующую запись
        this.metrics.totalSizeBytes -= existingNode.entry.sizeBytes;
        existingNode.entry = entry;
        this.metrics.totalSizeBytes += sizeBytes;
        this.moveToHead(existingNode);

        if (this.config.enableLogging) {
          console.log(`[MemoryCache] Обновлена запись для ключа: ${cacheKey.substring(0, 16)}...`);
        }
        return;
      }

      // Освобождаем место в кэше если необходимо
      this.evictIfNeeded(sizeBytes);

      // Создаем новый узел и добавляем в кэш
      const newNode = new LRUNode(cacheKey, entry);
      this.cache.set(cacheKey, newNode);
      this.addToHead(newNode);

      // Обновляем метрики
      this.metrics.currentSize = this.cache.size;
      this.metrics.totalSizeBytes += sizeBytes;

      if (this.config.enableLogging) {
        console.log(`[MemoryCache] Добавлена новая запись для ключа: ${cacheKey.substring(0, 16)}...`);
      }
    } catch (error) {
      if (this.config.enableLogging) {
        console.error('[MemoryCache] Ошибка при сохранении в кэш:', error);
      }
      throw new EmbeddingError(
        'Failed to save embedding to cache',
        'CACHE_SAVE_ERROR',
        'cache',
        { originalError: error }
      );
    }
  }

  /**
   * Проверка наличия записи в кэше
   *
   * @param text - Текст для проверки
   * @param collectionConfig - Конфигурация коллекции
   * @param globalConfig - Глобальная конфигурация
   * @returns true если запись найдена в кэше
   */
  public async has(
    text: string,
    collectionConfig?: CollectionEmbeddingConfig,
    globalConfig?: EmbeddingConfig
  ): Promise<boolean> {
    this.ensureNotDisposed();

    try {
      const cacheKeyConfig: CacheKeyConfig = {
        text,
        collectionConfig,
        globalConfig
      };

      const hashResult = await EmbeddingUtils.generateCacheKey(cacheKeyConfig);
      return this.cache.has(hashResult.hash);
    } catch (error) {
      if (this.config.enableLogging) {
        console.error('[MemoryCache] Ошибка при проверке наличия в кэше:', error);
      }
      return false;
    }
  }

  /**
   * Получение метрик производительности кэша
   *
   * @returns Текущие метрики кэша
   */
  public getMetrics(): CacheMetrics {
    this.ensureNotDisposed();
    return { ...this.metrics };
  }

  /**
   * Сброс метрик производительности
   */
  public resetMetrics(): void {
    this.ensureNotDisposed();

    const currentSize = this.cache.size;
    const currentSizeBytes = this.metrics.totalSizeBytes;

    this.metrics = {
      ...this.createInitialMetrics(),
      currentSize,
      totalSizeBytes: currentSizeBytes
    };

    if (this.config.enableLogging) {
      console.log('[MemoryCache] Метрики сброшены');
    }
  }

  /**
   * Очистка всех записей из кэша
   */
  public clear(): void {
    this.ensureNotDisposed();

    this.cache.clear();
    this.head = null;
    this.tail = null;
    this.metrics.currentSize = 0;
    this.metrics.totalSizeBytes = 0;

    if (this.config.enableLogging) {
      console.log('[MemoryCache] Кэш очищен');
    }
  }

  /**
   * Ручная очистка устаревших записей
   *
   * @returns Количество удаленных записей
   */
  public cleanup(): number {
    this.ensureNotDisposed();

    const now = Date.now();
    const maxAge = this.config.maxEntryAge;
    let removedCount = 0;

    // Проходим по всем записям и удаляем устаревшие
    for (const [key, node] of this.cache.entries()) {
      const age = now - node.entry.createdAt.getTime();
      if (age > maxAge) {
        this.removeNode(node);
        this.cache.delete(key);
        removedCount++;
      }
    }

    // Обновляем метрики
    this.metrics.currentSize = this.cache.size;
    this.metrics.evictions += removedCount;

    if (this.config.enableLogging && removedCount > 0) {
      console.log(`[MemoryCache] Удалено ${removedCount} устаревших записей`);
    }

    return removedCount;
  }

  /**
   * Получение информации о размере кэша
   *
   * @returns Информация о размере
   */
  public getSizeInfo(): {
    entries: number;
    maxEntries: number;
    sizeBytes: number;
    maxSizeBytes: number;
    utilizationPercent: number;
  } {
    this.ensureNotDisposed();

    const utilization = Math.max(
      this.metrics.currentSize / this.config.maxEntries,
      this.metrics.totalSizeBytes / this.config.maxSizeBytes
    ) * 100;

    return {
      entries: this.metrics.currentSize,
      maxEntries: this.config.maxEntries,
      sizeBytes: this.metrics.totalSizeBytes,
      maxSizeBytes: this.config.maxSizeBytes,
      utilizationPercent: Math.round(utilization * 100) / 100
    };
  }

  /**
   * Освобождение ресурсов кэша
   */
  public dispose(): void {
    if (this.disposed) {
      return;
    }

    // Останавливаем таймер очистки
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    // Очищаем кэш
    this.clear();

    // Помечаем как освобожденный
    this.disposed = true;

    if (this.config.enableLogging) {
      console.log('[MemoryCache] Ресурсы освобождены');
    }
  }

  // === Приватные методы ===

  /**
   * Создание начальных метрик
   */
  private createInitialMetrics(): CacheMetrics {
    const now = new Date();
    return {
      totalAccesses: 0,
      hits: 0,
      misses: 0,
      evictions: 0,
      currentSize: 0,
      maxSize: this.config.maxEntries,
      totalSizeBytes: 0,
      maxSizeBytes: this.config.maxSizeBytes,
      hitRate: 0,
      missRate: 0,
      lastResetAt: now,
      createdAt: now
    };
  }

  /**
   * Обновление коэффициентов попаданий и промахов
   */
  private updateHitRate(): void {
    if (this.metrics.totalAccesses > 0) {
      this.metrics.hitRate = this.metrics.hits / this.metrics.totalAccesses;
      this.metrics.missRate = this.metrics.misses / this.metrics.totalAccesses;
    } else {
      this.metrics.hitRate = 0;
      this.metrics.missRate = 0;
    }
  }

  /**
   * Вычисление размера записи в байтах
   */
  private calculateEntrySize(
    text: string,
    embedding: Float32Array,
    metadata?: Record<string, any>
  ): number {
    // Размер текста (UTF-16, 2 байта на символ)
    const textSize = text.length * 2;

    // Размер эмбеддинга (Float32 = 4 байта на элемент)
    const embeddingSize = embedding.length * 4;

    // Размер метаданных (приблизительная оценка)
    const metadataSize = metadata ? JSON.stringify(metadata).length * 2 : 0;

    // Служебные данные (даты, счетчики, etc.)
    const overheadSize = 200;

    return textSize + embeddingSize + metadataSize + overheadSize;
  }

  /**
   * Вытеснение записей при необходимости
   */
  private evictIfNeeded(newEntrySize: number): void {
    // Проверяем превышение по количеству записей
    while (this.cache.size >= this.config.maxEntries && this.tail) {
      this.evictLRU();
    }

    // Проверяем превышение по размеру в байтах
    while (
      this.metrics.totalSizeBytes + newEntrySize > this.config.maxSizeBytes &&
      this.tail
    ) {
      this.evictLRU();
    }
  }

  /**
   * Вытеснение наименее используемой записи
   */
  private evictLRU(): void {
    if (!this.tail) {
      return;
    }

    const evictedNode = this.tail;
    this.removeNode(evictedNode);
    this.cache.delete(evictedNode.key);

    // Обновляем метрики
    this.metrics.evictions++;
    this.metrics.currentSize = this.cache.size;
    this.metrics.totalSizeBytes -= evictedNode.entry.sizeBytes;

    if (this.config.enableLogging) {
      console.log(`[MemoryCache] Вытеснена запись: ${evictedNode.key.substring(0, 16)}...`);
    }
  }

  /**
   * Добавление узла в начало списка
   */
  private addToHead(node: LRUNode): void {
    node.prev = null;
    node.next = this.head;

    if (this.head) {
      this.head.prev = node;
    }

    this.head = node;

    if (!this.tail) {
      this.tail = node;
    }
  }

  /**
   * Удаление узла из списка
   */
  private removeNode(node: LRUNode): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
  }

  /**
   * Перемещение узла в начало списка
   */
  private moveToHead(node: LRUNode): void {
    this.removeNode(node);
    this.addToHead(node);
  }

  /**
   * Запуск таймера автоматической очистки
   */
  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      try {
        this.cleanup();
      } catch (error) {
        if (this.config.enableLogging) {
          console.error('[MemoryCache] Ошибка при автоматической очистке:', error);
        }
      }
    }, this.config.cleanupIntervalMs);
  }

  /**
   * Проверка, что кэш не был освобожден
   */
  private ensureNotDisposed(): void {
    if (this.disposed) {
      throw new EmbeddingError(
        'Cache has been disposed',
        'CACHE_DISPOSED'
      );
    }
  }
}

/**
 * Фабрика для создания экземпляров кэша с предустановленными конфигурациями
 */
export class MemoryCacheFactory {
  /**
   * Создание малого кэша для разработки и тестирования
   *
   * @returns Настроенный экземпляр кэша
   */
  public static createSmall(): MemoryCache {
    return new MemoryCache({
      maxEntries: 100,
      maxSizeBytes: 5 * 1024 * 1024, // 5MB
      enableLogging: true,
      cleanupIntervalMs: 2 * 60 * 1000, // 2 минуты
      maxEntryAge: 30 * 60 * 1000, // 30 минут
      enableDetailedMetrics: true
    });
  }

  /**
   * Создание среднего кэша для типичного использования
   *
   * @returns Настроенный экземпляр кэша
   */
  public static createMedium(): MemoryCache {
    return new MemoryCache({
      maxEntries: 1000,
      maxSizeBytes: 50 * 1024 * 1024, // 50MB
      enableLogging: false,
      cleanupIntervalMs: 5 * 60 * 1000, // 5 минут
      maxEntryAge: 60 * 60 * 1000, // 1 час
      enableDetailedMetrics: true
    });
  }

  /**
   * Создание большого кэша для интенсивного использования
   *
   * @returns Настроенный экземпляр кэша
   */
  public static createLarge(): MemoryCache {
    return new MemoryCache({
      maxEntries: 5000,
      maxSizeBytes: 200 * 1024 * 1024, // 200MB
      enableLogging: false,
      cleanupIntervalMs: 10 * 60 * 1000, // 10 минут
      maxEntryAge: 2 * 60 * 60 * 1000, // 2 часа
      enableDetailedMetrics: true
    });
  }

  /**
   * Создание кэша без автоматической очистки
   *
   * @returns Настроенный экземпляр кэша
   */
  public static createPersistent(): MemoryCache {
    return new MemoryCache({
      maxEntries: 2000,
      maxSizeBytes: 100 * 1024 * 1024, // 100MB
      enableLogging: false,
      cleanupIntervalMs: 0, // Отключаем автоочистку
      maxEntryAge: 24 * 60 * 60 * 1000, // 24 часа
      enableDetailedMetrics: true
    });
  }
}