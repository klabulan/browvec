/**
 * LocalRetrieve SDK - Main Export
 * 
 * Provides sql.js compatible Database interface with LocalRetrieve
 * hybrid search capabilities built on SQLite WASM + sqlite-vec.
 */

// Core Database exports
export { Database } from './database/Database.js';
export { Statement } from './database/Statement.js';

// Import classes for internal use (with different names to avoid conflicts)
import { Database as DatabaseClass } from './database/Database.js';
import { Statement as StatementClass } from './database/Statement.js';

// Type exports for external usage
export type {
  DatabaseAPI,
  StatementAPI,
  DatabaseConfig,
  SQLValue,
  SQLParams,
  StatementResult,
  ExecOptions,
  BindOptions
} from './types/database.js';

// Import types for internal use
import type { DatabaseAPI, StatementAPI, DatabaseConfig } from './types/database.js';

export type {
  SearchRequest,
  SearchResponse,
  SearchQuery,
  SearchResult,
  CollectionInfo,
  WorkerConfig,
  CreateCollectionParams,
  InsertDocumentWithEmbeddingParams,
  SemanticSearchParams,
  CollectionEmbeddingStatusResult
} from './types/worker.js';

// Utility exports
export {
  DatabaseError,
  StatementError,
  DEFAULT_DATABASE_CONFIG,
  resolveWorkerUrl,
  validateSQL,
  validateSQLParams,
  isStatementResult,
  isSQLValue
} from './types/database.js';

export {
  WorkerError,
  DatabaseError as WorkerDatabaseError,
  VectorError,
  OPFSError
} from './types/worker.js';

// Worker utilities (for advanced usage)
export { WorkerRPC, createWorkerRPC } from './utils/rpc.js';

// Embedding system exports
export {
  // Provider implementations
  OpenAIProvider,
  createOpenAIProvider,
  isValidModelDimensionCombo,
  getRecommendedConfig,
  TransformersProvider,
  createTransformersProvider,

  // Factory and utilities
  createEmbeddingProvider,
  validateEmbeddingConfig,
  getRecommendedEmbeddingConfig,
  checkConfigCompatibility,

  // Provider Factory (new)
  EmbeddingProviderFactoryImpl,
  providerFactory,
  createProvider,
  validateProviderConfig,
  checkProviderSupport,
  getProviderRecommendations,
  getAvailableProviders,
  getAvailableModels,

  // Base classes and interfaces
  BaseEmbeddingProvider,
  ExternalProvider,
  ProviderUtils,

  // Constants
  EMBEDDING_DEFAULTS,
  SUPPORTED_PROVIDERS,

  // Errors
  EmbeddingError,
  ProviderError,
  AuthenticationError,
  ConfigurationError,
  ValidationError,
  QuotaExceededError,
  TimeoutError,

  // Utilities
  TextProcessor,
  MemoryCache,
  EmbeddingUtils,
  CollectionUtils,
  EmbeddingConstants
} from './embedding/index.js';

// Embedding type exports
export type {
  EmbeddingProvider,
  CollectionEmbeddingConfig,
  EmbeddingConfig,
  EmbeddingProviderType,
  EmbeddingResult,
  BatchEmbeddingResult,
  SemanticSearchOptions,
  HybridSearchOptions,
  SearchResultWithEmbedding,

  // Provider Factory types
  ProviderSupportInfo,
  ProviderConfigInfo,
  ProviderRecommendation,
  ModelInfo
} from './embedding/index.js';

// Version information
export const VERSION = '1.0.0-mvp';
export const FEATURES = [
  'sql.js-compatibility',
  'opfs-persistence',
  'hybrid-search',
  'sqlite-vec',
  'fts5',
  'worker-based',
  'embedding-generation',
  'collection-based-embeddings',
  'automatic-embedding-generation',
  'semantic-search'
] as const;

/**
 * Initialize LocalRetrieve with a database file
 * 
 * @param filename Database filename (use 'opfs:/path/to/file.db' for OPFS persistence)
 * @param config Optional configuration
 * @returns Promise<Database> Ready-to-use database instance
 * 
 * @example
 * ```typescript
 * import { initLocalRetrieve } from 'localretrieve';
 *
 * // Initialize with OPFS persistence
 * const db = await initLocalRetrieve('opfs:/myapp/search.db');
 *
 * // Initialize schema for hybrid search
 * await db.initializeSchema();
 *
 * // Create a collection with embedding configuration
 * await db.createCollection({
 *   name: 'documents',
 *   embeddingConfig: {
 *     provider: 'transformers',
 *     model: 'all-MiniLM-L6-v2',
 *     dimensions: 384
 *   }
 * });
 *
 * // Insert document with automatic embedding generation
 * await db.insertDocumentWithEmbedding({
 *   collection: 'documents',
 *   document: {
 *     title: 'Sample Document',
 *     content: 'This is a sample document content.'
 *   }
 * });
 *
 * // Perform semantic search
 * const results = await db.searchSemantic({
 *   collection: 'documents',
 *   query: 'sample content',
 *   options: { limit: 10 }
 * });
 *
 * // Or use traditional sql.js compatible API
 * db.run('INSERT INTO docs_default (id, content) VALUES (?, ?)', ['doc1', 'hello world']);
 *
 * // Or use hybrid search with manual vectors
 * const hybridResults = await db.search({
 *   query: { text: 'hello', vector: myVector },
 *   limit: 10
 * });
 * ```
 */
export async function initLocalRetrieve(
  filename: string = 'opfs:/localretrieve/default.db',
  config?: Partial<DatabaseConfig>
): Promise<DatabaseClass> {
  const finalConfig: DatabaseConfig = {
    ...config,
    filename
  };

  const db = await DatabaseClass.create(undefined, filename);
  
  // Initialize schema only if needed (the schema check handles existence)
  try {
    await db.initializeSchema();
  } catch (error) {
    // Schema initialization failed - this might indicate a more serious issue
    console.error('Schema initialization failed:', error);
    throw error;
  }

  return db;
}

/**
 * Create a new Database instance (sql.js compatibility)
 * 
 * @param buffer Optional buffer to import
 * @param filename Optional filename for persistence
 * @returns Promise<Database> Database instance
 */
export async function createDatabase(
  buffer?: Uint8Array,
  filename: string = ':memory:'
): Promise<DatabaseClass> {
  return DatabaseClass.create(buffer, filename);
}

// Re-export main Database class as default for convenience
export { DatabaseClass as default };

// SQL.js compatibility namespace
export namespace SQL {
  export const Database = DatabaseClass;
  export type Database = DatabaseAPI;
  export const Statement = StatementClass;
  export type Statement = StatementAPI;
}