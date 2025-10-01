/**
 * Pipeline exports for LocalRetrieve
 *
 * Экспорты системы внутренней генерации эмбеддингов с кэшированием,
 * управлением жизненным циклом моделей и оптимизацией производительности.
 */

// Main pipeline interface and implementation
export {
  type InternalPipeline,
  InternalPipelineImpl,
  createInternalPipeline,
  type EmbeddingOptions,
  type BatchOptions,
  type PipelineEmbeddingResult,
  type PipelineBatchEmbeddingResult,
  type PipelineEmbeddingRequest,
  type PipelinePerformanceStats
} from './InternalPipeline.js';

// Model management
export {
  type ModelManager,
  ModelManagerImpl,
  createModelManager,
  type LoadedModel,
  type ModelStatus,
  type MemoryOptimizationOptions,
  type EmbeddingModel,
  type LoadingStrategy
} from './ModelManager.js';

// Cache management exports
export {
  CacheManagerImpl,
  createCacheManager
} from '../cache/CacheManager.js';

export type {
  CacheManager,
  CacheLevel,
  CacheOptions,
  CacheStatistics,
  CacheResult
} from '../cache/CacheManager.js';

// Query cache exports
export { QueryCache } from '../cache/QueryCache.js';

export type {
  QueryCacheOptions,
  QueryCacheEntry,
  QueryCacheConfig,
  QueryCacheStats
} from '../cache/QueryCache.js';

// Model cache exports
export { ModelCache } from '../cache/ModelCache.js';

export type {
  CachedModelInfo,
  ModelCacheConfig,
  ModelCacheStats,
  ModelCacheEntry
} from '../cache/ModelCache.js';

/**
 * Фабричная функция для создания полного pipeline стека
 */
export async function createFullPipeline(options: {
  // CacheManager options
  memorySize?: number;
  indexedDBName?: string;
  dbVersion?: number;

  // ModelManager options
  memoryLimit?: number;
  maxModels?: number;
  idleTimeout?: number;
  cleanupInterval?: number;
} = {}) {
  // Динамический импорт для избежания циркулярных зависимостей
  const { createCacheManager } = await import('../cache/CacheManager.js');
  const { createModelManager } = await import('./ModelManager.js');
  const { createInternalPipeline } = await import('./InternalPipeline.js');

  // Создаем компоненты
  const cacheManager = createCacheManager({
    memorySize: options.memorySize,
    indexedDBName: options.indexedDBName,
    dbVersion: options.dbVersion
  });

  const modelManager = createModelManager({
    memoryLimit: options.memoryLimit,
    maxModels: options.maxModels,
    idleTimeout: options.idleTimeout,
    cleanupInterval: options.cleanupInterval
  });

  const pipeline = await createInternalPipeline(cacheManager, modelManager);

  return {
    pipeline,
    cacheManager,
    modelManager
  };
}