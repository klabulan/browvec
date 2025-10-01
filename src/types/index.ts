/**
 * Type Exports for LocalRetrieve
 */

// Worker types (selective export to avoid conflicts)
export type {
  SQLValue,
  SQLParams,
  DBWorkerAPI,
  OpenDatabaseParams,
  ExecParams,
  SelectParams,
  BulkInsertParams,
  SearchRequest,
  SearchResult,
  SearchResponse,
  CollectionInfo,
  QueryResult,
  CreateCollectionParams,
  InsertDocumentWithEmbeddingParams,
  SemanticSearchParams,
  ExportParams,
  ImportParams,
  GenerateEmbeddingRequest,
  GenerateEmbeddingResult,
  BatchEmbeddingRequest,
  BatchEmbeddingResult,
  EnqueueEmbeddingParams,
  ProcessEmbeddingQueueParams,
  ProcessEmbeddingQueueResult,
  QueueStatusResult,
  ClearEmbeddingQueueParams,
  CollectionEmbeddingStatusResult,
  WorkerError,
  DatabaseError,
  VectorError,
  OPFSError,
  TextSearchParams,
  AdvancedSearchParams,
  GlobalSearchParams,
  EnhancedSearchResponse,
  GlobalSearchResponse
} from './worker.js';

// Embedding system types (exclude conflicting exports)
export {
  EmbeddingConfig,
  CollectionEmbeddingConfig,
  EmbeddingProviderType as EmbeddingProvider,
  EmbeddingResult,
  EmbeddingRequestOptions
} from '../embedding/types.js';

// Embedding system errors (exclude WorkerError to avoid conflict)
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
  // WorkerError, -- Excluded to avoid conflict with worker.ts WorkerError
  ErrorUtils
} from '../embedding/errors.js';

// Text processing and utilities
export { TextProcessor } from '../embedding/TextProcessor.js';
export {
  EmbeddingUtils,
  EmbeddingConstants,
  CollectionUtils
} from '../embedding/utils.js';

// Embedding provider interfaces and implementations
export * from '../embedding/providers/BaseProvider.js';
export {
  TransformersProvider,
  createTransformersProvider,
  isTransformersSupported,
  getModelInfo
} from '../embedding/providers/TransformersProvider.js';

// Embedding cache implementation
export { MemoryCache } from '../embedding/cache/MemoryCache.js';

// Search system types and interfaces (selective export to avoid conflicts with worker.js)
export {
  SearchMode,
  SearchStrategy,
  QueryType,
  FusionMethod,
  ScoreNormalization,
  QueryAnalysisError,
  StrategySelectionError,
  normalizeScore,
  DEFAULT_STRATEGY_ENGINE_CONFIG
} from "./search.js";

export type {
  QueryFeatures,
  QueryAnalysis,
  SearchExecutionPlan,
  SearchContext,
  TextSearchOptions,
  SearchWeights,
  ResultProcessingOptions,
  SnippetOptions,
  RerankingContext,
  StrategyEngineConfig,
  RawSearchResult,
  ResultWithSnippets,
  RankedResult
} from "./search.js";
