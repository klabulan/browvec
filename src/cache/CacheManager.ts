/**
 * CacheManager - координатор многоуровневого кэширования
 *
 * Реализует трехуровневую архитектуру кэширования:
 * 1. Memory Cache - быстрый доступ, ограниченный размер
 * 2. IndexedDB - персистентное хранилище в браузере
 * 3. SQLite Database - долгосрочное хранение через worker
 *
 * Стратегия кэширования:
 * - Чтение: Memory → IndexedDB → SQLite → null
 * - Запись: во все уровни с разными TTL
 * - Invalidation: каскадная очистка по паттернам
 */

import { QueryCache } from './QueryCache.js';
import { ModelCache } from './ModelCache.js';
import { EmbeddingError, CacheError } from '../embedding/errors.js';

/**
 * Уровни кэширования
 */
export type CacheLevel = 'memory' | 'indexeddb' | 'database';

/**
 * Опции кэширования
 */
export interface CacheOptions {
  /** Уровень кэша для записи */
  level?: CacheLevel;
  /** Время жизни в миллисекундах */
  ttl?: number;
  /** Теги для группировки данных */
  tags?: string[];
  /** Приоритет элемента кэша */
  priority?: 'low' | 'normal' | 'high';
  /** Сжатие данных */
  compression?: boolean;
}

/**
 * Статистика кэширования
 */
export interface CacheStatistics {
  /** Общее количество запросов */
  totalRequests: number;
  /** Попадания в кэш */
  hits: {
    memory: number;
    indexeddb: number;
    database: number;
    total: number;
  };
  /** Промахи кэша */
  misses: number;
  /** Процент попаданий */
  hitRate: number;
  /** Использование памяти по уровням (MB) */
  memoryUsage: {
    memory: number;
    indexeddb: number;
    database: number;
  };
  /** Средние времена доступа (мс) */
  avgAccessTime: {
    memory: number;
    indexeddb: number;
    database: number;
  };
}

/**
 * Результат операции кэширования
 */
export interface CacheResult<T = any> {
  /** Данные из кэша */
  data: T | null;
  /** Источник данных */
  source: CacheLevel | 'miss';
  /** Время доступа в мс */
  accessTime: number;
  /** Попадание в кэш */
  hit: boolean;
}

/**
 * Интерфейс CacheManager
 */
export interface CacheManager {
  /**
   * Получение данных из кэша (проверка всех уровней)
   */
  get<T = any>(key: string, level?: CacheLevel): Promise<T | null>;

  /**
   * Сохранение данных в кэш
   */
  set<T = any>(key: string, value: T, options?: CacheOptions): Promise<void>;

  /**
   * Удаление данных по паттерну или конкретному ключу
   */
  invalidate(pattern: string): Promise<void>;

  /**
   * Предварительный прогрев кэша
   */
  warmCache(collection: string, queries: string[]): Promise<void>;

  /**
   * Предзагрузка моделей в кэш
   */
  preloadModels(providers: string[]): Promise<void>;

  /**
   * Получение статистики кэширования
   */
  getStats(): CacheStatistics;

  /**
   * Очистка всех уровней кэша
   */
  clear(): Promise<void>;

  /**
   * Оптимизация кэша (удаление устаревших данных)
   */
  optimize(): Promise<void>;
}

/**
 * Основная реализация CacheManager
 */
export class CacheManagerImpl implements CacheManager {
  private queryCache: QueryCache;
  private modelCache: ModelCache;

  // Статистика производительности
  private stats: {
    totalRequests: number;
    memoryHits: number;
    indexedDBHits: number;
    databaseHits: number;
    misses: number;
    totalAccessTime: number;
    levelAccessTimes: Map<CacheLevel, { total: number; count: number }>;
  };

  // IndexedDB для второго уровня кэширования
  private indexedDB: IDBDatabase | null;
  private dbReady: Promise<void>;

  constructor(options: {
    memorySize?: number;
    indexedDBName?: string;
    dbVersion?: number;
  } = {}) {
    this.queryCache = new QueryCache({
      maxSize: options.memorySize || 1000,
      ttl: 5 * 60 * 1000, // 5 минут для memory cache
    });

    this.modelCache = new ModelCache({
      maxSize: 50, // Максимум 50 моделей в кэше
      ttl: 30 * 60 * 1000, // 30 минут для моделей
    });

    this.stats = {
      totalRequests: 0,
      memoryHits: 0,
      indexedDBHits: 0,
      databaseHits: 0,
      misses: 0,
      totalAccessTime: 0,
      levelAccessTimes: new Map([
        ['memory', { total: 0, count: 0 }],
        ['indexeddb', { total: 0, count: 0 }],
        ['database', { total: 0, count: 0 }]
      ])
    };

    this.indexedDB = null;
    this.dbReady = this.initIndexedDB(options.indexedDBName || 'LocalRetrieveCache', options.dbVersion || 1);
  }

  /**
   * Получение данных с каскадным поиском по уровням кэша
   */
  async get<T = any>(key: string, level?: CacheLevel): Promise<T | null> {
    const startTime = Date.now();
    this.stats.totalRequests++;

    try {
      // Если указан конкретный уровень, ищем только в нем
      if (level) {
        const result = await this.getFromLevel<T>(key, level);
        this.updateAccessTimeStats(level, Date.now() - startTime);
        return result;
      }

      // Поиск по всем уровням в порядке приоритета

      // Уровень 1: Memory Cache
      const memoryResult = await this.getFromLevel<T>(key, 'memory');
      if (memoryResult !== null) {
        this.stats.memoryHits++;
        this.updateAccessTimeStats('memory', Date.now() - startTime);
        return memoryResult;
      }

      // Уровень 2: IndexedDB
      const indexedDBResult = await this.getFromLevel<T>(key, 'indexeddb');
      if (indexedDBResult !== null) {
        this.stats.indexedDBHits++;
        this.updateAccessTimeStats('indexeddb', Date.now() - startTime);

        // Восстанавливаем в memory cache для быстрого доступа
        await this.queryCache.set(key, indexedDBResult);

        return indexedDBResult;
      }

      // Уровень 3: Database (через SQLite)
      const databaseResult = await this.getFromLevel<T>(key, 'database');
      if (databaseResult !== null) {
        this.stats.databaseHits++;
        this.updateAccessTimeStats('database', Date.now() - startTime);

        // Восстанавливаем в вышестоящие кэши
        await Promise.all([
          this.queryCache.set(key, databaseResult),
          this.setInIndexedDB(key, databaseResult, { ttl: 24 * 60 * 60 * 1000 }) // 24 часа
        ]);

        return databaseResult;
      }

      // Ничего не найдено
      this.stats.misses++;
      return null;

    } catch (error) {
      console.warn(`Cache get operation failed for key "${key}":`, error);
      this.stats.misses++;
      return null;
    } finally {
      this.stats.totalAccessTime += Date.now() - startTime;
    }
  }

  /**
   * Сохранение данных во всех уровнях кэша
   */
  async set<T = any>(key: string, value: T, options?: CacheOptions): Promise<void> {
    const {
      level,
      ttl,
      tags = [],
      priority = 'normal',
      compression = false
    } = options || {};

    try {
      const promises: Promise<void>[] = [];

      if (!level || level === 'memory') {
        // Сохранение в memory cache
        promises.push(this.queryCache.set(key, value, {
          ttl: ttl || 5 * 60 * 1000, // 5 минут по умолчанию
          priority,
          tags
        }));
      }

      if (!level || level === 'indexeddb') {
        // Сохранение в IndexedDB
        promises.push(this.setInIndexedDB(key, value, {
          ttl: ttl || 24 * 60 * 60 * 1000, // 24 часа по умолчанию
          tags,
          compression
        }));
      }

      if (!level || level === 'database') {
        // Сохранение в SQLite database (заглушка - будет реализовано в worker integration)
        promises.push(this.setInDatabase(key, value, {
          ttl: ttl || 7 * 24 * 60 * 60 * 1000, // 7 дней по умолчанию
          tags
        }));
      }

      await Promise.all(promises);

    } catch (error) {
      throw new CacheError(
        `Failed to set cache value for key "${key}": ${error instanceof Error ? error.message : String(error)}`,
        'SET_FAILED',
        { key, level, options }
      );
    }
  }

  /**
   * Каскадное удаление данных по паттерну
   */
  async invalidate(pattern: string): Promise<void> {
    const promises: Promise<void>[] = [];

    try {
      // Очистка во всех кэшах
      promises.push(this.queryCache.invalidate(pattern));
      promises.push(this.modelCache.invalidate(pattern));
      promises.push(this.invalidateIndexedDB(pattern));
      promises.push(this.invalidateDatabase(pattern));

      await Promise.all(promises);

    } catch (error) {
      throw new CacheError(
        `Failed to invalidate cache pattern "${pattern}": ${error instanceof Error ? error.message : String(error)}`,
        'INVALIDATION_FAILED',
        { pattern }
      );
    }
  }

  /**
   * Предварительный прогрев кэша для популярных запросов
   */
  async warmCache(collection: string, queries: string[]): Promise<void> {
    // Заглушка - в реальной реализации здесь будет взаимодействие с InternalPipeline
    console.log(`Warming cache for collection "${collection}" with ${queries.length} queries`);

    // Пока что просто сохраняем пустые плейсхолдеры
    const warmupPromises = queries.map(async (query, index) => {
      const cacheKey = `warmup:${collection}:${this.hashString(query)}`;
      const placeholder = {
        warmedAt: Date.now(),
        collection,
        query,
        status: 'placeholder'
      };

      await this.set(cacheKey, placeholder, {
        level: 'memory',
        ttl: 10 * 60 * 1000, // 10 минут для прогрева
        tags: ['warmup', collection]
      });
    });

    await Promise.all(warmupPromises);
  }

  /**
   * Предзагрузка моделей в кэш
   */
  async preloadModels(providers: string[]): Promise<void> {
    // Используем ModelCache для предзагрузки
    const preloadPromises = providers.map(async (provider) => {
      const modelInfo = {
        provider,
        preloadedAt: Date.now(),
        status: 'preloaded'
      };

      await this.modelCache.set(`model:${provider}`, modelInfo);
    });

    await Promise.all(preloadPromises);
    console.log(`Preloaded ${providers.length} models into cache`);
  }

  /**
   * Получение статистики кэширования
   */
  getStats(): CacheStatistics {
    const totalHits = this.stats.memoryHits + this.stats.indexedDBHits + this.stats.databaseHits;
    const hitRate = this.stats.totalRequests > 0
      ? (totalHits / this.stats.totalRequests) * 100
      : 0;

    // Вычисляем средние времена доступа
    const avgAccessTime: CacheStatistics['avgAccessTime'] = {
      memory: 0,
      indexeddb: 0,
      database: 0
    };

    for (const [level, stats] of this.stats.levelAccessTimes.entries()) {
      avgAccessTime[level] = stats.count > 0 ? stats.total / stats.count : 0;
    }

    return {
      totalRequests: this.stats.totalRequests,
      hits: {
        memory: this.stats.memoryHits,
        indexeddb: this.stats.indexedDBHits,
        database: this.stats.databaseHits,
        total: totalHits
      },
      misses: this.stats.misses,
      hitRate,
      memoryUsage: {
        memory: this.queryCache.getMemoryUsage(),
        indexeddb: this.estimateIndexedDBUsage(),
        database: this.estimateDatabaseUsage()
      },
      avgAccessTime
    };
  }

  /**
   * Очистка всех уровней кэша
   */
  async clear(): Promise<void> {
    const promises: Promise<void>[] = [
      this.queryCache.clear(),
      this.modelCache.clear(),
      this.clearIndexedDB(),
      this.clearDatabase()
    ];

    await Promise.all(promises);

    // Сбрасываем статистику
    this.stats = {
      totalRequests: 0,
      memoryHits: 0,
      indexedDBHits: 0,
      databaseHits: 0,
      misses: 0,
      totalAccessTime: 0,
      levelAccessTimes: new Map([
        ['memory', { total: 0, count: 0 }],
        ['indexeddb', { total: 0, count: 0 }],
        ['database', { total: 0, count: 0 }]
      ])
    };
  }

  /**
   * Оптимизация кэша
   */
  async optimize(): Promise<void> {
    const promises: Promise<void>[] = [
      this.queryCache.optimize(),
      this.modelCache.optimize(),
      this.optimizeIndexedDB(),
      this.optimizeDatabase()
    ];

    await Promise.all(promises);
    console.log('Cache optimization completed');
  }

  // === Приватные методы ===

  /**
   * Получение данных с конкретного уровня
   */
  private async getFromLevel<T>(key: string, level: CacheLevel): Promise<T | null> {
    switch (level) {
      case 'memory':
        return this.queryCache.get(key);

      case 'indexeddb':
        return this.getFromIndexedDB<T>(key);

      case 'database':
        return this.getFromDatabase<T>(key);

      default:
        throw new CacheError(`Unknown cache level: ${level}`);
    }
  }

  /**
   * Инициализация IndexedDB
   */
  private async initIndexedDB(dbName: string, version: number): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        console.warn('IndexedDB not available, skipping initialization');
        resolve();
        return;
      }

      const request = indexedDB.open(dbName, version);

      request.onerror = () => {
        console.warn('Failed to open IndexedDB:', request.error);
        resolve(); // Продолжаем работу без IndexedDB
      };

      request.onsuccess = () => {
        this.indexedDB = request.result;
        resolve();
      };

      request.onupgradeneeded = () => {
        const db = request.result;

        // Создаем object store для кэша
        if (!db.objectStoreNames.contains('cache')) {
          const store = db.createObjectStore('cache', { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp');
          store.createIndex('tags', 'tags', { multiEntry: true });
        }
      };
    });
  }

  /**
   * Получение данных из IndexedDB
   */
  private async getFromIndexedDB<T>(key: string): Promise<T | null> {
    await this.dbReady;

    if (!this.indexedDB) return null;

    return new Promise((resolve) => {
      const transaction = this.indexedDB!.transaction(['cache'], 'readonly');
      const store = transaction.objectStore('cache');
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;

        if (!result) {
          resolve(null);
          return;
        }

        // Проверяем TTL
        if (result.expiresAt && Date.now() > result.expiresAt) {
          // Асинхронно удаляем устаревшую запись
          this.deleteFromIndexedDB(key).catch(console.warn);
          resolve(null);
          return;
        }

        resolve(result.value);
      };

      request.onerror = () => {
        console.warn(`IndexedDB get failed for key "${key}":`, request.error);
        resolve(null);
      };
    });
  }

  /**
   * Сохранение данных в IndexedDB
   */
  private async setInIndexedDB<T>(key: string, value: T, options: { ttl?: number; tags?: string[]; compression?: boolean } = {}): Promise<void> {
    await this.dbReady;

    if (!this.indexedDB) return;

    const { ttl, tags = [], compression = false } = options;

    const cacheEntry = {
      key,
      value: compression ? this.compress(value) : value,
      timestamp: Date.now(),
      expiresAt: ttl ? Date.now() + ttl : null,
      tags,
      compressed: compression
    };

    return new Promise((resolve, reject) => {
      const transaction = this.indexedDB!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.put(cacheEntry);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.warn(`IndexedDB set failed for key "${key}":`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Удаление данных из IndexedDB
   */
  private async deleteFromIndexedDB(key: string): Promise<void> {
    if (!this.indexedDB) return;

    return new Promise((resolve) => {
      const transaction = this.indexedDB!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.warn(`IndexedDB delete failed for key "${key}":`, request.error);
        resolve(); // Не прерываем работу при ошибке удаления
      };
    });
  }

  /**
   * Очистка данных в IndexedDB по паттерну
   */
  private async invalidateIndexedDB(pattern: string): Promise<void> {
    if (!this.indexedDB) return;

    // Упрощенная реализация - очищаем все если pattern === '*'
    if (pattern === '*') {
      await this.clearIndexedDB();
      return;
    }

    // Для более сложных паттернов нужна полная реализация
    console.warn('IndexedDB pattern invalidation not fully implemented');
  }

  /**
   * Полная очистка IndexedDB
   */
  private async clearIndexedDB(): Promise<void> {
    if (!this.indexedDB) return;

    return new Promise((resolve) => {
      const transaction = this.indexedDB!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.warn('IndexedDB clear failed:', request.error);
        resolve();
      };
    });
  }

  /**
   * Оптимизация IndexedDB (удаление устаревших записей)
   */
  private async optimizeIndexedDB(): Promise<void> {
    if (!this.indexedDB) return;

    const now = Date.now();

    return new Promise((resolve) => {
      const transaction = this.indexedDB!.transaction(['cache'], 'readwrite');
      const store = transaction.objectStore('cache');
      const request = store.openCursor();

      request.onsuccess = () => {
        const cursor = request.result;

        if (cursor) {
          const record = cursor.value;

          // Удаляем устаревшие записи
          if (record.expiresAt && now > record.expiresAt) {
            cursor.delete();
          }

          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => {
        console.warn('IndexedDB optimization failed:', request.error);
        resolve();
      };
    });
  }

  /**
   * Заглушки для database operations (будут реализованы при интеграции с worker)
   */
  private async getFromDatabase<T>(key: string): Promise<T | null> {
    // Заглушка - будет реализовано при интеграции с worker
    console.debug(`Database get for key "${key}" - not implemented yet`);
    return null;
  }

  private async setInDatabase<T>(key: string, value: T, options: { ttl?: number; tags?: string[] }): Promise<void> {
    // Заглушка - будет реализовано при интеграции с worker
    console.debug(`Database set for key "${key}" - not implemented yet`);
  }

  private async invalidateDatabase(pattern: string): Promise<void> {
    // Заглушка - будет реализовано при интеграции с worker
    console.debug(`Database invalidation for pattern "${pattern}" - not implemented yet`);
  }

  private async clearDatabase(): Promise<void> {
    // Заглушка - будет реализовано при интеграции с worker
    console.debug('Database clear - not implemented yet');
  }

  private async optimizeDatabase(): Promise<void> {
    // Заглушка - будет реализовано при интеграции с worker
    console.debug('Database optimization - not implemented yet');
  }

  /**
   * Вспомогательные методы
   */
  private updateAccessTimeStats(level: CacheLevel, time: number): void {
    const stats = this.stats.levelAccessTimes.get(level)!;
    stats.total += time;
    stats.count++;
  }

  private estimateIndexedDBUsage(): number {
    // Приблизительная оценка использования IndexedDB в MB
    return 10; // Заглушка
  }

  private estimateDatabaseUsage(): number {
    // Приблизительная оценка использования SQLite database в MB
    return 50; // Заглушка
  }

  private hashString(str: string): string {
    // Простая hash функция
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  private compress<T>(data: T): string {
    // Простая реализация сжатия через JSON
    return JSON.stringify(data);
  }

  private decompress<T>(compressed: string): T {
    return JSON.parse(compressed);
  }
}

/**
 * Фабричная функция для создания CacheManager
 */
export function createCacheManager(options: {
  memorySize?: number;
  indexedDBName?: string;
  dbVersion?: number;
} = {}): CacheManager {
  return new CacheManagerImpl(options);
}