/**
 * Type Exports for LocalRetrieve
 */

// Worker types (includes WorkerError, DatabaseError, VectorError, OPFSError)
export * from './worker.js';

// Embedding system types
export * from '../embedding/types.js';

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

// Embedding provider interfaces
export * from '../embedding/providers/BaseProvider.js';