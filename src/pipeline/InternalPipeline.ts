/**
 * InternalPipeline - основная система генерации эмбеддингов по запросу
 *
 * Реализует интеллектуальную генерацию эмбеддингов с многоуровневым кэшированием,
 * интеграцией с системой очередей Phase 5 и оптимизацией производительности.
 *
 * Архитектурные принципы:
 * - Кэш-ориентированная генерация (memory → IndexedDB → database)
 * - Интеграция с существующей системой очередей Phase 5
 * - Batch обработка с отслеживанием прогресса
 * - Переиспользование загруженных моделей
 * - Graceful fallback при ошибках
 */

import type {
  EmbeddingProviderType,
  EmbeddingResult as EmbeddingResultType,
  EmbeddingRequest as EmbeddingRequestType,
  EmbeddingRequestOptions,
  BatchEmbeddingResult as BatchEmbeddingResultType,
  CollectionEmbeddingConfig
} from '../embedding/types.js';
import type { CacheManager } from '../cache/CacheManager.js';
import type { ModelManager } from './ModelManager.js';
import { EmbeddingError, ConfigurationError, TimeoutError } from '../embedding/errors.js';
import { EmbeddingUtils } from '../embedding/utils.js';
import { providerFactory } from '../embedding/ProviderFactory.js';

/**
 * Параметры генерации эмбеддингов по запросу
 */
export interface EmbeddingOptions {
  /** Принудительное обновление кэша */
  forceRefresh?: boolean;
  /** Таймаут операции в миллисекундах */
  timeout?: number;
  /** Приоритет для очереди */
  priority?: number;
  /** Контекст для оптимизации кэша */
  context?: {
    userId?: string;
    sessionId?: string;
    source?: string;
  };
}

/**
 * Параметры batch обработки
 */
export interface BatchOptions {
  /** Размер batch для обработки */
  batchSize?: number;
  /** Максимальное количество параллельных batch */
  concurrency?: number;
  /** Таймаут для всей batch операции */
  timeout?: number;
  /** Callback для отслеживания прогресса */
  onProgress?: (completed: number, total: number, current?: string) => void;
}

/**
 * Результат генерации эмбеддинга
 */
export interface PipelineEmbeddingResult {
  /** Вектор эмбеддинга */
  embedding: Float32Array;
  /** Размерность вектора */
  dimensions: number;
  /** Источник результата */
  source: 'cache_memory' | 'cache_indexeddb' | 'cache_database' | 'provider_fresh';
  /** Время генерации в миллисекундах */
  processingTime: number;
  /** Метаданные */
  metadata?: {
    cacheHit?: boolean;
    modelUsed?: string;
    provider?: string;
    confidence?: number;
  };
}

/**
 * Batch результат с детальной информацией
 */
export interface PipelineBatchEmbeddingResult extends PipelineEmbeddingResult {
  /** ID запроса в batch */
  requestId: string;
  /** Статус обработки */
  status: 'completed' | 'failed' | 'skipped';
  /** Сообщение об ошибке при неудаче */
  error?: string;
}

/**
 * Запрос на генерацию эмбеддинга
 */
export interface PipelineEmbeddingRequest {
  /** Уникальный ID запроса */
  id: string;
  /** Текст для обработки */
  query: string;
  /** Имя коллекции */
  collection: string;
  /** Дополнительные опции */
  options?: EmbeddingOptions;
}

/**
 * Интерфейс основного класса InternalPipeline
 */
export interface InternalPipeline {
  /**
   * Генерация эмбеддинга для поискового запроса с кэшированием
   */
  generateQueryEmbedding(query: string, collection: string, options?: EmbeddingOptions): Promise<PipelineEmbeddingResult>;

  /**
   * Batch генерация эмбеддингов с управлением прогрессом
   */
  batchGenerateEmbeddings(requests: PipelineEmbeddingRequest[], options?: BatchOptions): Promise<PipelineBatchEmbeddingResult[]>;

  /**
   * Получение кэшированного эмбеддинга
   */
  getCachedEmbedding(query: string, collection: string): Promise<PipelineEmbeddingResult | null>;

  /**
   * Предварительный прогрев кэша для популярных запросов
   */
  warmCache(commonQueries: string[], collection: string): Promise<void>;

  /**
   * Очистка кэшей и освобождение ресурсов
   */
  clearCache(collection?: string): Promise<void>;

  /**
   * Получение статистики производительности
   */
  getPerformanceStats(): PipelinePerformanceStats;
}

/**
 * Статистика производительности пайплайна
 */
export interface PipelinePerformanceStats {
  /** Общее количество запросов */
  totalRequests: number;
  /** Процент попаданий в кэш */
  cacheHitRate: number;
  /** Среднее время генерации */
  averageGenerationTime: number;
  /** Количество активных моделей в памяти */
  activeModels: number;
  /** Использование памяти в MB */
  memoryUsage: number;
  /** Статистика по уровням кэша */
  cacheStats: {
    memory: { hits: number; misses: number };
    indexedDB: { hits: number; misses: number };
    database: { hits: number; misses: number };
  };
}

/**
 * Основная реализация InternalPipeline
 */
export class InternalPipelineImpl implements InternalPipeline {
  private cacheManager: CacheManager;
  private modelManager: ModelManager;

  // Статистика производительности
  private stats: {
    totalRequests: number;
    cacheHits: number;
    cacheMisses: number;
    totalGenerationTime: number;
    cacheHitsByLevel: Map<string, number>;
  };

  // Провайдеры по коллекциям
  private providers: Map<string, any>;

  // Конфигурации коллекций
  private collectionConfigs: Map<string, CollectionEmbeddingConfig>;

  constructor(cacheManager: CacheManager, modelManager: ModelManager) {
    this.cacheManager = cacheManager;
    this.modelManager = modelManager;

    this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalGenerationTime: 0,
      cacheHitsByLevel: new Map()
    };

    this.providers = new Map();
    this.collectionConfigs = new Map();
  }

  /**
   * Генерация эмбеддинга для поискового запроса с многоуровневым кэшированием
   */
  async generateQueryEmbedding(query: string, collection: string, options?: EmbeddingOptions): Promise<PipelineEmbeddingResult> {
    const startTime = Date.now();
    this.stats.totalRequests++;

    try {
      // Валидация входных параметров
      this.validateInputs(query, collection);

      // Попытка получить из кэша
      if (!options?.forceRefresh) {
        const cached = await this.getCachedEmbedding(query, collection);
        if (cached) {
          this.stats.cacheHits++;
          this.updateCacheHitStats(cached.source);
          return cached;
        }
      }

      this.stats.cacheMisses++;

      // Получение провайдера для коллекции
      const provider = await this.getProviderForCollection(collection);

      // Настройка таймаута
      const timeout = options?.timeout || 5000; // 5 секунд по умолчанию
      const embeddingPromise = this.generateFreshEmbedding(query, provider);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new TimeoutError(`Embedding generation timeout after ${timeout}ms`, timeout, 'generateQueryEmbedding')), timeout)
      );

      // Генерация эмбеддинга с таймаутом
      const embedding = await Promise.race([embeddingPromise, timeoutPromise]);

      const processingTime = Date.now() - startTime;
      this.stats.totalGenerationTime += processingTime;

      const result: PipelineEmbeddingResult = {
        embedding,
        dimensions: embedding.length,
        source: 'provider_fresh',
        processingTime,
        metadata: {
          cacheHit: false,
          modelUsed: provider.getModelInfo?.()?.name,
          provider: this.getProviderType(provider),
          confidence: 1.0
        }
      };

      // Сохранение в кэш асинхронно
      this.saveToCacheAsync(query, collection, result).catch(error =>
        console.warn('Failed to cache embedding result:', error)
      );

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      this.stats.totalGenerationTime += processingTime;

      if (error instanceof EmbeddingError) {
        throw error;
      }

      throw new EmbeddingError(
        `Failed to generate query embedding: ${error instanceof Error ? error.message : String(error)}`,
        'GENERATION_FAILED',
        'provider',
        { query: query.substring(0, 100), collection }
      );
    }
  }

  /**
   * Batch генерация эмбеддингов с управлением прогрессом
   */
  async batchGenerateEmbeddings(requests: PipelineEmbeddingRequest[], options?: BatchOptions): Promise<PipelineBatchEmbeddingResult[]> {
    if (requests.length === 0) {
      return [];
    }

    const batchSize = options?.batchSize || 32;
    const concurrency = options?.concurrency || 3;
    const results: PipelineBatchEmbeddingResult[] = [];

    // Разбиваем запросы на batch'и
    const batches: PipelineEmbeddingRequest[][] = [];
    for (let i = 0; i < requests.length; i += batchSize) {
      batches.push(requests.slice(i, i + batchSize));
    }

    let completedCount = 0;
    const total = requests.length;

    // Обработка batch'ей с ограниченным параллелизмом
    const processBatch = async (batch: PipelineEmbeddingRequest[]): Promise<PipelineBatchEmbeddingResult[]> => {
      const batchResults: PipelineBatchEmbeddingResult[] = [];

      for (const request of batch) {
        try {
          options?.onProgress?.(completedCount, total, request.query.substring(0, 50) + '...');

          const embeddingResult = await this.generateQueryEmbedding(
            request.query,
            request.collection,
            request.options
          );

          batchResults.push({
            requestId: request.id,
            ...embeddingResult,
            status: 'completed'
          });

          completedCount++;

        } catch (error) {
          batchResults.push({
            requestId: request.id,
            embedding: new Float32Array(0),
            dimensions: 0,
            source: 'provider_fresh',
            processingTime: 0,
            status: 'failed',
            error: error instanceof Error ? error.message : String(error)
          });

          completedCount++;
        }
      }

      return batchResults;
    };

    // Параллельная обработка с ограничением concurrency
    for (let i = 0; i < batches.length; i += concurrency) {
      const batchSlice = batches.slice(i, i + concurrency);
      const batchPromises = batchSlice.map(processBatch);
      const batchResults = await Promise.all(batchPromises);

      results.push(...batchResults.flat());
    }

    options?.onProgress?.(completedCount, total, 'Completed');
    return results;
  }

  /**
   * Получение кэшированного эмбеддинга с проверкой всех уровней
   */
  async getCachedEmbedding(query: string, collection: string): Promise<PipelineEmbeddingResult | null> {
    const cacheKey = this.generateCacheKey(query, collection);

    try {
      // Уровень 1: Memory cache
      const memoryResult = await this.cacheManager.get(cacheKey, 'memory');
      if (memoryResult) {
        return {
          ...memoryResult,
          source: 'cache_memory',
          metadata: { ...memoryResult.metadata, cacheHit: true }
        };
      }

      // Уровень 2: IndexedDB cache
      const indexedDBResult = await this.cacheManager.get(cacheKey, 'indexeddb');
      if (indexedDBResult) {
        // Сохраняем обратно в memory для быстрого доступа
        await this.cacheManager.set(cacheKey, indexedDBResult, { level: 'memory', ttl: 300000 }); // 5 мин

        return {
          ...indexedDBResult,
          source: 'cache_indexeddb',
          metadata: { ...indexedDBResult.metadata, cacheHit: true }
        };
      }

      // Уровень 3: Database cache (через CacheManager)
      const databaseResult = await this.cacheManager.get(cacheKey, 'database');
      if (databaseResult) {
        // Сохраняем в вышестоящие кэши
        await Promise.all([
          this.cacheManager.set(cacheKey, databaseResult, { level: 'memory', ttl: 300000 }),
          this.cacheManager.set(cacheKey, databaseResult, { level: 'indexeddb', ttl: 86400000 }) // 24 часа
        ]);

        return {
          ...databaseResult,
          source: 'cache_database',
          metadata: { ...databaseResult.metadata, cacheHit: true }
        };
      }

      return null;

    } catch (error) {
      console.warn(`Cache lookup failed for query "${query.substring(0, 50)}":`, error);
      return null;
    }
  }

  /**
   * Предварительный прогрев кэша для популярных запросов
   */
  async warmCache(commonQueries: string[], collection: string): Promise<void> {
    const batchSize = 10;
    const requests: PipelineEmbeddingRequest[] = commonQueries.map((query, index) => ({
      id: `warmup-${index}`,
      query,
      collection,
      options: { priority: 0 } // Низкий приоритет для прогрева
    }));

    // Генерируем эмбеддинги batch'ами
    await this.batchGenerateEmbeddings(requests, {
      batchSize,
      concurrency: 2,
      onProgress: (completed, total) => {
        console.log(`Cache warming progress: ${completed}/${total}`);
      }
    });
  }

  /**
   * Очистка кэшей и освобождение ресурсов
   */
  async clearCache(collection?: string): Promise<void> {
    if (collection) {
      // Очистка кэша конкретной коллекции
      const pattern = `*:${collection}:*`;
      await this.cacheManager.invalidate(pattern);
    } else {
      // Полная очистка
      await this.cacheManager.invalidate('*');
    }

    // Сброс статистики
    this.stats.cacheHitsByLevel.clear();
  }

  /**
   * Получение статистики производительности
   */
  getPerformanceStats(): PipelinePerformanceStats {
    const cacheHitRate = this.stats.totalRequests > 0
      ? (this.stats.cacheHits / this.stats.totalRequests) * 100
      : 0;

    const averageGenerationTime = this.stats.totalRequests > 0
      ? this.stats.totalGenerationTime / this.stats.totalRequests
      : 0;

    return {
      totalRequests: this.stats.totalRequests,
      cacheHitRate,
      averageGenerationTime,
      activeModels: this.modelManager.getModelStatus().loadedModels.length,
      memoryUsage: this.estimateMemoryUsage(),
      cacheStats: {
        memory: {
          hits: this.stats.cacheHitsByLevel.get('cache_memory') || 0,
          misses: this.stats.cacheMisses
        },
        indexedDB: {
          hits: this.stats.cacheHitsByLevel.get('cache_indexeddb') || 0,
          misses: 0 // Будет реализовано в CacheManager
        },
        database: {
          hits: this.stats.cacheHitsByLevel.get('cache_database') || 0,
          misses: 0 // Будет реализовано в CacheManager
        }
      }
    };
  }

  // === Приватные методы ===

  /**
   * Валидация входных параметров
   */
  private validateInputs(query: string, collection: string): void {
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new ConfigurationError('Query must be a non-empty string', 'query', 'non-empty string', query);
    }

    if (query.length > 8192) { // Лимит из embedding constants
      throw new ConfigurationError('Query is too long (max 8192 characters)', 'query', 'string with length <= 8192', query.length);
    }

    if (!collection || typeof collection !== 'string') {
      throw new ConfigurationError('Collection must be specified', 'collection', 'non-empty string', collection);
    }
  }

  /**
   * Получение провайдера для коллекции
   */
  private async getProviderForCollection(collection: string): Promise<any> {
    // Проверяем кэш провайдеров
    if (this.providers.has(collection)) {
      const provider = this.providers.get(collection)!;
      return provider;
    }

    // Получаем конфигурацию коллекции (заглушка - в реальной реализации это будет из базы данных)
    const config = await this.getCollectionConfig(collection);

    // Создаем провайдера
    const provider = await providerFactory.createProvider(config);

    // Кэшируем провайдера
    this.providers.set(collection, provider);
    this.collectionConfigs.set(collection, config);

    return provider;
  }

  /**
   * Генерация свежего эмбеддинга через провайдера
   */
  private async generateFreshEmbedding(query: string, provider: any): Promise<Float32Array> {
    const result = await provider.generateEmbedding(query);

    if (!result.success || !result.embedding) {
      throw new EmbeddingError(
        'Provider failed to generate embedding',
        'PROVIDER_ERROR',
        'provider',
        { error: result.error }
      );
    }

    return result.embedding;
  }

  /**
   * Асинхронное сохранение в кэш
   */
  private async saveToCacheAsync(query: string, collection: string, result: PipelineEmbeddingResult): Promise<void> {
    const cacheKey = this.generateCacheKey(query, collection);

    try {
      // Сохраняем на всех уровнях с разными TTL
      await Promise.all([
        this.cacheManager.set(cacheKey, result, { level: 'memory', ttl: 300000 }), // 5 мин
        this.cacheManager.set(cacheKey, result, { level: 'indexeddb', ttl: 86400000 }), // 24 часа
        this.cacheManager.set(cacheKey, result, { level: 'database', ttl: 604800000 }) // 7 дней
      ]);
    } catch (error) {
      // Логируем, но не прерываем работу
      console.warn('Failed to save to cache:', error);
    }
  }

  /**
   * Генерация ключа кэша
   */
  private generateCacheKey(query: string, collection: string): string {
    const config = this.collectionConfigs.get(collection);
    const configHash = config ? EmbeddingUtils.hashText(JSON.stringify(config), { algorithm: 'simple' }).hash : 'default';
    const queryHash = EmbeddingUtils.hashText(query.trim().toLowerCase(), { algorithm: 'simple' }).hash;

    return `embedding:${collection}:${configHash}:${queryHash}`;
  }

  /**
   * Получение конфигурации коллекции (заглушка)
   */
  private async getCollectionConfig(collection: string): Promise<CollectionEmbeddingConfig> {
    // Заглушка - в реальной реализации это будет запрос к базе данных
    // Возвращаем конфигурацию по умолчанию
    return {
      provider: 'transformers',
      model: 'all-MiniLM-L6-v2',
      dimensions: 384,
      batchSize: 32,
      cacheEnabled: true,
      autoGenerate: true,
      timeout: 30000
    };
  }

  /**
   * Получение типа провайдера
   */
  private getProviderType(provider: any): string {
    // Проверяем по классу или свойствам провайдера
    const modelInfo = provider.getModelInfo?.();
    return modelInfo?.provider || 'unknown';
  }

  /**
   * Обновление статистики попаданий в кэш
   */
  private updateCacheHitStats(source: PipelineEmbeddingResult['source']): void {
    const current = this.stats.cacheHitsByLevel.get(source) || 0;
    this.stats.cacheHitsByLevel.set(source, current + 1);
  }

  /**
   * Оценка использования памяти
   */
  private estimateMemoryUsage(): number {
    // Приблизительная оценка (в MB)
    let memoryUsage = 0;

    // Кэш провайдеров
    memoryUsage += this.providers.size * 10; // ~10MB на провайдера

    // Модели в памяти
    memoryUsage += this.modelManager.getModelStatus().loadedModels.length * 50; // ~50MB на модель

    // Кэш результатов (будет точнее реализовано в CacheManager)
    memoryUsage += 20; // ~20MB для кэша результатов

    return memoryUsage;
  }
}

/**
 * Фабричная функция для создания InternalPipeline
 */
export async function createInternalPipeline(
  cacheManager: CacheManager,
  modelManager: ModelManager
): Promise<InternalPipeline> {
  return new InternalPipelineImpl(cacheManager, modelManager);
}