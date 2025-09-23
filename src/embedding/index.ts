/**
 * LocalRetrieve Embedding System - Main Export
 *
 * Данный модуль предоставляет полную систему эмбеддингов для LocalRetrieve,
 * включая локальные и внешние провайдеры, утилиты обработки текста и кэширование.
 */

// Core provider interfaces and base classes
export {
  type EmbeddingProvider,
  type ProviderHealthStatus,
  type ProviderMetrics,
  type EmbeddingProviderFactory,
  type ModelInfo,
  BaseEmbeddingProvider,
  ProviderUtils
} from './providers/BaseProvider.js';

// External provider base class
export {
  ExternalProvider,
  type ExternalProviderConfig
} from './providers/ExternalProvider.js';

// Specific provider implementations
export {
  OpenAIProvider,
  createOpenAIProvider,
  isValidModelDimensionCombo,
  getRecommendedConfig
} from './providers/OpenAIProvider.js';

export {
  TransformersProvider,
  createTransformersProvider,
  isTransformersSupported,
  getModelInfo as getTransformersModelInfo,
  type TransformersProviderConfig
} from './providers/TransformersProvider.js';

// Type definitions
export type {
  CollectionEmbeddingConfig,
  EmbeddingConfig,
  EmbeddingProviderType,
  CacheStrategy,
  TextPreprocessingConfig,
  EmbeddingWorkerConfig,
  EmbeddingResult,
  EmbeddingMetadata,
  EmbeddingRequest,
  EmbeddingRequestOptions,
  EmbeddingPriority,
  BatchEmbeddingResult,
  BatchMetadata,
  EmbeddingOperationStatus,
  EmbeddingOperationState,
  Collection,
  CollectionMetadata,
  IndexingSettings,
  CollectionStatistics,
  CollectionEmbeddingStatus,
  SemanticSearchOptions,
  HybridSearchOptions,
  RerankingOptions,
  SearchResultWithEmbedding,
  EmbeddingExportConfig,
  EmbeddingImportConfig,
  EmbeddingChangeEvent,
  EmbeddingMonitoringConfig
} from './types.js';

// Error classes
export {
  EmbeddingError,
  ProviderError,
  ProviderInitializationError,
  ModelLoadError,
  NetworkError,
  AuthenticationError,
  ConfigurationError,
  ValidationError,
  QuotaExceededError,
  TimeoutError,
  CacheError,
  WorkerError,
  ErrorUtils,
  type ErrorCategory,
  type NetworkErrorType,
  type AuthErrorType,
  type QuotaType,
  type CacheOperation,
  type ErrorRecoveryInfo,
  type ErrorJSON
} from './errors.js';

// Text processing utilities
export {
  TextProcessor,
  type TextProcessorConfig,
  type ProcessingOptions,
  type ProcessingResult,
  type CleaningOptions,
  type NormalizationOptions,
  type TokenizationOptions,
  type TruncationOptions,
  type PreprocessingStats
} from './TextProcessor.js';

// Utility classes and interfaces
export {
  EmbeddingUtils,
  CollectionUtils,
  EmbeddingConstants,
  type HashResult,
  type HashOptions,
  type CacheKeyConfig,
  type DimensionValidationResult,
  type PerformanceMetrics,
  type SupportedDimensions,
  type ProviderType,
  type HashAlgorithm
} from './utils.js';

// Cache implementations
export {
  MemoryCache,
  type MemoryCacheConfig,
  type CacheEntry,
  type CacheStats
} from './cache/MemoryCache.js';

// Provider Factory
export {
  EmbeddingProviderFactoryImpl,
  providerFactory,
  createEmbeddingProvider as createProvider,
  validateProviderConfig,
  checkProviderSupport,
  getProviderRecommendations,
  getAvailableProviders,
  getAvailableModels,
  type ProviderSupportInfo,
  type ProviderConfigInfo,
  type ProviderRecommendation
} from './ProviderFactory.js';

// Constants and defaults
export const EMBEDDING_DEFAULTS = {
  DIMENSIONS: {
    SMALL: 384,
    MEDIUM: 768,
    LARGE: 1536
  },
  BATCH_SIZE: {
    LOCAL: 32,
    EXTERNAL: 100
  },
  TIMEOUT: {
    DEFAULT: 30000,
    LOCAL: 60000,
    EXTERNAL: 30000
  },
  CACHE: {
    MAX_SIZE: 10000,
    TTL: 24 * 60 * 60 * 1000 // 24 hours
  },
  TEXT_LIMITS: {
    MAX_LENGTH: 8192,
    ESTIMATED_TOKENS_PER_CHAR: 0.25
  }
} as const;

export const SUPPORTED_PROVIDERS: Record<EmbeddingProviderType, {
  name: string;
  type: 'local' | 'external';
  description: string;
  requiresApiKey: boolean;
  supportedDimensions: number[];
}> = {
  transformers: {
    name: 'Transformers.js',
    type: 'local',
    description: 'Local embedding generation using Transformers.js',
    requiresApiKey: false,
    supportedDimensions: [384]
  },
  openai: {
    name: 'OpenAI Embeddings',
    type: 'external',
    description: 'OpenAI text-embedding-3-small and text-embedding-3-large models',
    requiresApiKey: true,
    supportedDimensions: [384, 768, 1536, 256, 512, 1024, 3072]
  },
  cohere: {
    name: 'Cohere Embeddings',
    type: 'external',
    description: 'Cohere embedding models (coming soon)',
    requiresApiKey: true,
    supportedDimensions: [384, 768, 1024]
  },
  huggingface: {
    name: 'Hugging Face',
    type: 'external',
    description: 'Hugging Face Inference API (coming soon)',
    requiresApiKey: true,
    supportedDimensions: [384, 768, 1024]
  },
  custom: {
    name: 'Custom Provider',
    type: 'external',
    description: 'Custom embedding provider implementation',
    requiresApiKey: false,
    supportedDimensions: []
  }
} as const;

/**
 * Фабричная функция для создания провайдеров эмбеддингов
 *
 * @deprecated Use the new ProviderFactory instead: `import { createProvider } from './ProviderFactory.js'`
 * @param config - Конфигурация коллекции эмбеддингов
 * @returns Экземпляр провайдера эмбеддингов
 */
export async function createEmbeddingProvider(
  config: CollectionEmbeddingConfig
): Promise<EmbeddingProvider> {
  // Delegate to the new provider factory for better error handling and validation
  return providerFactory.createProvider(config);
}

/**
 * Валидация конфигурации эмбеддингов
 *
 * @deprecated Use the new ProviderFactory validation instead: `import { validateProviderConfig } from './ProviderFactory.js'`
 * @param config - Конфигурация для валидации
 * @returns Результат валидации
 */
export function validateEmbeddingConfig(config: CollectionEmbeddingConfig): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
} {
  // Delegate to the new provider factory for comprehensive validation
  return providerFactory.validateConfiguration(config);
}

/**
 * Получение рекомендуемой конфигурации для заданных требований
 *
 * @param requirements - Требования к конфигурации
 * @returns Рекомендуемая конфигурация
 */
export function getRecommendedEmbeddingConfig(requirements: {
  dimensions?: number;
  offline?: boolean;
  budget?: 'low' | 'medium' | 'high';
  performance?: 'fast' | 'balanced' | 'accurate';
  apiKey?: string;
}): CollectionEmbeddingConfig {
  const {
    dimensions = EMBEDDING_DEFAULTS.DIMENSIONS.SMALL,
    offline = false,
    budget = 'medium',
    performance = 'balanced',
    apiKey
  } = requirements;

  // Если требуется offline режим, используем Transformers.js
  if (offline || !apiKey) {
    return {
      provider: 'transformers',
      model: 'all-MiniLM-L6-v2',
      dimensions: EMBEDDING_DEFAULTS.DIMENSIONS.SMALL, // Transformers.js поддерживает только 384
      batchSize: EMBEDDING_DEFAULTS.BATCH_SIZE.LOCAL,
      cacheEnabled: true,
      autoGenerate: true,
      timeout: EMBEDDING_DEFAULTS.TIMEOUT.LOCAL
    };
  }

  // Для online режима выбираем OpenAI на основе требований
  const openaiConfig = getRecommendedConfig({ dimensions, budget, performance });

  return {
    provider: 'openai',
    model: openaiConfig.model,
    dimensions: openaiConfig.dimensions,
    apiKey,
    batchSize: EMBEDDING_DEFAULTS.BATCH_SIZE.EXTERNAL,
    cacheEnabled: true,
    autoGenerate: true,
    timeout: EMBEDDING_DEFAULTS.TIMEOUT.EXTERNAL
  };
}

/**
 * Проверка совместимости конфигураций для миграции
 *
 * @param oldConfig - Старая конфигурация
 * @param newConfig - Новая конфигурация
 * @returns Информация о совместимости
 */
export function checkConfigCompatibility(
  oldConfig: CollectionEmbeddingConfig,
  newConfig: CollectionEmbeddingConfig
): {
  compatible: boolean;
  requiresRegeneration: boolean;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];
  let requiresRegeneration = false;

  // Проверка размерности
  if (oldConfig.dimensions !== newConfig.dimensions) {
    issues.push('Dimension mismatch');
    requiresRegeneration = true;
    recommendations.push('All embeddings will need to be regenerated');
  }

  // Проверка провайдера
  if (oldConfig.provider !== newConfig.provider) {
    issues.push('Provider change');
    requiresRegeneration = true;
    recommendations.push('Embeddings from different providers may not be compatible');
  }

  // Проверка модели
  if (oldConfig.model !== newConfig.model) {
    issues.push('Model change');
    requiresRegeneration = true;
    recommendations.push('Different models produce different embeddings');
  }

  const compatible = issues.length === 0;

  return {
    compatible,
    requiresRegeneration,
    issues,
    recommendations
  };
}