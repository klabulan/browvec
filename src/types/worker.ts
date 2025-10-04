/**
 * Worker Types for LocalRetrieve Database Worker
 * 
 * This file defines the message types and interfaces for communication
 * between the main thread and the database worker via RPC.
 */

// Base SQL value types compatible with sql.js
export type SQLValue = number | string | Uint8Array | null;

// Extended SQL value types for internal worker use (includes Float32Array for vectors)
export type ExtendedSQLValue = SQLValue | Float32Array;

// SQL parameter types
export type SQLParams = Record<string, SQLValue> | SQLValue[];

// Extended SQL parameter types for internal worker use
export type ExtendedSQLParams = Record<string, ExtendedSQLValue> | ExtendedSQLValue[];

// Database operation result types
export interface QueryResult {
  rows: Record<string, any>[];
  columns?: string[];
  rowsAffected?: number;
  lastInsertRowid?: number;
}

// Search-specific types
export interface SearchQuery {
  text?: string;
  vector?: Float32Array;
  filters?: Record<string, any>;
}

export interface SearchRequest {
  query: SearchQuery;
  collection?: string;
  limit?: number;
  fusionMethod?: 'rrf' | 'weighted';
  fusionWeights?: { fts: number; vec: number };
}

export interface SearchResult {
  id: string;
  title?: string;
  content?: string;
  metadata?: Record<string, any>;
  score: number;
  ftsScore?: number;
  vecScore?: number;
}

export interface SearchResponse {
  results: SearchResult[];
  totalResults: number;
  searchTime: number;
}

// Collection management types
export interface CollectionInfo {
  name: string;
  createdAt: number;
  schemaVersion: number;
  vectorDimensions: number;
  documentCount: number;
}

// Collection creation with embedding support
export interface CreateCollectionParams {
  name: string;
  dimensions?: number;
  config?: Record<string, any>;
  embeddingConfig?: import('../embedding/types.js').CollectionEmbeddingConfig;
  description?: string;
  metadata?: Record<string, any>;
}

// Document insertion with automatic embedding generation
export interface InsertDocumentWithEmbeddingParams {
  collection: string;
  document: {
    id?: string;
    title?: string;
    content: string;
    metadata?: Record<string, any>;
  };
  options?: {
    generateEmbedding?: boolean;
    embeddingOptions?: import('../embedding/types.js').EmbeddingRequestOptions;
  };
}

// Semantic search with optional embedding inclusion
export interface SemanticSearchParams {
  collection: string;
  query: string;
  options?: {
    limit?: number;
    similarityThreshold?: number;
    includeEmbeddings?: boolean;
    filters?: Record<string, any>;
    generateQueryEmbedding?: boolean;
  };
}

// Collection embedding status
export interface CollectionEmbeddingStatusResult {
  collection: string;
  collectionId: string;
  provider?: string;
  model?: string;
  dimensions?: number;
  documentsWithEmbeddings: number;
  totalDocuments: number;
  isReady: boolean;
  generationProgress: number;
  lastUpdated?: Date;
  configErrors: string[];
}

// Batch embedding operations
export interface BatchEmbeddingRequest {
  collection: string;
  documents: Array<{
    id: string;
    content: string;
    metadata?: Record<string, any>;
  }>;
  options?: {
    batchSize?: number;
    timeout?: number;
    onProgress?: (progress: EmbeddingProgress) => void;
  };
}

export interface BatchEmbeddingResult {
  success: number;
  failed: number;
  errors: Array<{
    documentId: string;
    error: string;
  }>;
  processingTime: number;
}

// Progress reporting for embedding operations
export interface EmbeddingProgress {
  phase: 'initializing' | 'generating' | 'storing' | 'complete' | 'error';
  processedCount: number;
  totalCount: number;
  currentItem?: string;
  timeElapsed: number;
  estimatedTimeRemaining?: number;
  errorCount?: number;
}

// Embedding generation request
export interface GenerateEmbeddingRequest {
  collection: string;
  text: string;
  options?: {
    includeInVector?: boolean;
    cacheKey?: string;
    timeout?: number;
  };
}

export interface GenerateEmbeddingResult {
  embedding: Float32Array;
  dimensions: number;
  generationTime: number;
  cached: boolean;
  provider: string;
}

// Worker RPC message types
export interface WorkerMessage<T = any> {
  id: string;
  method: string;
  params?: T;
}

export interface WorkerResponse<T = any> {
  id: string;
  result?: T;
  error?: {
    message: string;
    code?: string;
    stack?: string;
  };
}

// Specific message types for each database operation
export interface OpenDatabaseParams {
  filename: string;
  path?: string;
  vfs?: 'opfs' | 'opfs-sahpool';
  pragmas?: Record<string, string>;
}

export interface ExecParams {
  sql: string;
  params?: SQLParams;
}

export interface SelectParams {
  sql: string;
  params?: SQLParams;
}

export interface BulkInsertParams {
  table: string;
  tableName: string;
  data: any[][];
  rows: Record<string, any>[];
  batchSize?: number;
}

// Progress callback interface for export/import operations
export interface ExportImportProgress {
  phase: 'validating' | 'preparing' | 'exporting' | 'importing' | 'finalizing' | 'complete';
  bytesProcessed: number;
  totalBytes: number;
  timeElapsed: number;
}

export interface ExportParams {
  format?: 'sqlite' | 'json';
  includeSchema?: boolean;
  onProgress?: (progress: ExportImportProgress) => void;
}

export interface ImportParams {
  data: Uint8Array;
  format?: 'sqlite' | 'json';
  overwrite?: boolean;
  onProgress?: (progress: ExportImportProgress) => void;
}

// Queue management types
export interface EnqueueEmbeddingParams {
  collection: string;
  documentId: string;
  textContent: string;
  priority?: number;
}

export interface ProcessEmbeddingQueueParams {
  collection?: string;
  batchSize?: number;
  maxProcessingTime?: number;
}

export interface ProcessEmbeddingQueueResult {
  processed: number;
  failed: number;
  remainingInQueue: number;
  errors: Array<{
    documentId: string;
    error: string;
  }>;
}

export interface QueueStatusResult {
  totalCount: number;
  pendingCount: number;
  processingCount: number;
  completedCount: number;
  failedCount: number;
  oldestPending?: Date;
  newestCompleted?: Date;
}

export interface ClearEmbeddingQueueParams {
  collection?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  olderThan?: Date;
}

// =============================================================================
// LLM Integration Types (SCRUM-17)
// =============================================================================

/**
 * Enhanced Query Parameters
 */
export interface EnhanceQueryParams {
  query: string;
  options?: {
    provider?: string;
    model?: string;
    apiKey?: string;
    maxSuggestions?: number;
    includeIntent?: boolean;
    temperature?: number;
    timeout?: number;
  };
}

/**
 * Enhanced Query Result
 */
export interface EnhancedQueryResult {
  originalQuery: string;
  enhancedQuery: string;
  suggestions: string[];
  intent?: string;
  confidence: number;
  provider: string;
  model: string;
  processingTime: number;
}

/**
 * Summarize Results Parameters
 */
export interface SummarizeResultsParams {
  results: SearchResult[];
  options?: {
    provider?: string;
    model?: string;
    apiKey?: string;
    maxLength?: number;
    includeKeyPoints?: boolean;
    temperature?: number;
    timeout?: number;
  };
}

/**
 * Result Summary Result
 */
export interface ResultSummaryResult {
  summary: string;
  keyPoints: string[];
  themes: string[];
  confidence: number;
  provider: string;
  model: string;
  processingTime: number;
}

/**
 * Search with LLM Parameters
 */
export interface SearchWithLLMParams {
  query: string;
  options?: {
    enhanceQuery?: boolean;
    summarizeResults?: boolean;
    searchOptions?: import('./search.js').TextSearchOptions;
    llmOptions?: {
      provider?: string;
      model?: string;
      apiKey?: string;
      temperature?: number;
    };
  };
}

/**
 * LLM Search Response Result
 */
export interface LLMSearchResponseResult {
  results: SearchResult[];
  enhancedQuery?: EnhancedQueryResult;
  summary?: ResultSummaryResult;
  searchTime: number;
  llmTime: number;
  totalTime: number;
}

/**
 * Generic LLM Call Parameters (SCRUM-17 - Pure LLM API)
 */
export interface CallLLMParams {
  prompt: string;
  options?: {
    provider?: string;
    model?: string;
    apiKey?: string;
    temperature?: number;
    maxTokens?: number;
    timeout?: number;
    systemPrompt?: string;
  };
}

/**
 * Generic LLM Call Result (SCRUM-17 - Pure LLM API)
 */
export interface CallLLMResult {
  text: string;
  finishReason: 'stop' | 'length' | 'error' | 'timeout';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  provider: string;
  processingTime: number;
}

// Database Worker API Interface
export interface DBWorkerAPI {
  // Core database operations
  open(params: OpenDatabaseParams): Promise<void>;
  close(): Promise<void>;
  exec(params: ExecParams): Promise<void>;
  select(params: SelectParams): Promise<QueryResult>;
  bulkInsert(params: BulkInsertParams): Promise<void>;

  // WASM-specific operations
  initVecExtension(): Promise<void>;

  // Schema management
  initializeSchema(): Promise<void>;
  getCollectionInfo(name: string): Promise<CollectionInfo>;

  // Collection management with embedding support
  createCollection(params: CreateCollectionParams): Promise<void>;
  getCollectionEmbeddingStatus(collection: string): Promise<CollectionEmbeddingStatusResult>;

  // Document operations with embedding support
  insertDocumentWithEmbedding(params: InsertDocumentWithEmbeddingParams): Promise<{ id: string; embeddingGenerated: boolean }>;

  // Embedding generation operations
  generateEmbedding(params: GenerateEmbeddingRequest): Promise<GenerateEmbeddingResult>;
  batchGenerateEmbeddings(params: BatchEmbeddingRequest): Promise<BatchEmbeddingResult>;
  regenerateCollectionEmbeddings(collection: string, options?: { batchSize?: number; onProgress?: (progress: EmbeddingProgress) => void }): Promise<BatchEmbeddingResult>;

  // Search operations
  search(params: SearchRequest): Promise<SearchResponse>;
  searchSemantic(params: SemanticSearchParams): Promise<SearchResponse>;

  // Enhanced search API (Task 6.1)
  searchText(params: TextSearchParams): Promise<EnhancedSearchResponse>;
  searchAdvanced(params: AdvancedSearchParams): Promise<EnhancedSearchResponse>;
  searchGlobal(params: GlobalSearchParams): Promise<GlobalSearchResponse>;

  // LLM operations (SCRUM-17)
  enhanceQuery(params: EnhanceQueryParams): Promise<EnhancedQueryResult>;
  summarizeResults(params: SummarizeResultsParams): Promise<ResultSummaryResult>;
  searchWithLLM(params: SearchWithLLMParams): Promise<LLMSearchResponseResult>;
  callLLM(params: CallLLMParams): Promise<CallLLMResult>;

  // Data export/import
  export(params?: ExportParams): Promise<Uint8Array>;
  import(params: ImportParams): Promise<void>;
  clear(): Promise<void>;

  // Embedding queue management
  enqueueEmbedding(params: EnqueueEmbeddingParams): Promise<number>;
  processEmbeddingQueue(params?: ProcessEmbeddingQueueParams): Promise<ProcessEmbeddingQueueResult>;
  getQueueStatus(collection?: string): Promise<QueueStatusResult>;
  clearEmbeddingQueue(params?: ClearEmbeddingQueueParams): Promise<number>;

  // Task 6.2: Internal Embedding Pipeline Operations
  generateQueryEmbedding(params: GenerateQueryEmbeddingParams): Promise<QueryEmbeddingResult>;
  batchGenerateQueryEmbeddings(params: BatchGenerateQueryEmbeddingsParams): Promise<BatchQueryEmbeddingResult[]>;
  warmEmbeddingCache(params: WarmEmbeddingCacheParams): Promise<void>;
  clearEmbeddingCache(params?: ClearEmbeddingCacheParams): Promise<void>;
  getPipelineStats(): Promise<PipelinePerformanceStats>;
  getModelStatus(): Promise<ModelStatusResult>;
  preloadModels(params: PreloadModelsParams): Promise<void>;
  optimizeModelMemory(params?: OptimizeModelMemoryParams): Promise<void>;

  // Utility operations
  getVersion(): Promise<{ sqlite: string; vec: string; sdk: string }>;
  getStats(): Promise<{ memory: number; dbSize: number; operations: number }>;
}

// Worker method names (for type safety in RPC calls)
export type WorkerMethodName = keyof DBWorkerAPI;

// Worker events for notifications
export interface WorkerEvent<T = any> {
  type: string;
  data: T;
}

export interface EmbeddingProgressEvent extends WorkerEvent<EmbeddingProgress> {
  type: 'embedding_progress';
}

export interface EmbeddingCompletedEvent extends WorkerEvent<{ collection: string; documentsProcessed: number; errors: number }> {
  type: 'embedding_completed';
}

export interface DatabaseEvent extends WorkerEvent {
  type: 'database' | 'search' | 'error' | 'performance';
}

// Error types
export class WorkerError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'WorkerError';
  }
}

export class DatabaseError extends WorkerError {
  constructor(message: string, public sqliteCode?: number) {
    super(message, 'DATABASE_ERROR');
    this.name = 'DatabaseError';
  }
}

export class VectorError extends WorkerError {
  constructor(message: string) {
    super(message, 'VECTOR_ERROR');
    this.name = 'VectorError';
  }
}

export class OPFSError extends WorkerError {
  constructor(message: string) {
    super(message, 'OPFS_ERROR');
    this.name = 'OPFSError';
  }
}

// Configuration types
export interface WorkerConfig {
  maxConcurrentOperations?: number;
  operationTimeout?: number;
  enablePerformanceMonitoring?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

// Performance monitoring types
export interface PerformanceMetrics {
  operationCount: number;
  averageLatency: number;
  memoryUsage: number;
  cacheHitRate: number;
  lastOperationTime: number;
}

// Embedding queue management types
export interface EmbeddingQueueItem {
  id: number;
  collection_name: string;
  document_id: string;
  text_content: string;
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: number;
  processed_at?: number;
  error_message?: string;
}

export interface EnqueueEmbeddingParams {
  collection: string;
  documentId: string;
  textContent: string;
  priority?: number;
}

export interface QueueStatusResult {
  collection: string;
  pendingCount: number;
  processingCount: number;
  completedCount: number;
  failedCount: number;
  totalCount: number;
  oldestPendingDate?: number;
  averageProcessingTime?: number;
}

export interface ProcessEmbeddingQueueParams {
  collection?: string;
  batchSize?: number;
  maxRetries?: number;
}



// Enhanced Search API types (Task 6.1)
export interface TextSearchParams {
  query: string;
  options?: import("./search.js").TextSearchOptions;
}

export interface AdvancedSearchParams {
  query: string;
  collections?: string[];
  searchPlan?: Partial<import("./search.js").SearchExecutionPlan>;
  boosts?: import("./search.js").FieldBoosts;
  filters?: import("./search.js").AdvancedFilters;
  aggregations?: import("./search.js").AggregationRequest[];
  facets?: import("./search.js").FacetRequest[];
  explain?: boolean;
}

export interface GlobalSearchParams {
  query: string;
  options?: import("./search.js").GlobalSearchOptions;
}

// Task 6.2: Internal Embedding Pipeline RPC Parameters

export interface GenerateQueryEmbeddingParams {
  query: string;
  collection: string;
  options?: {
    forceRefresh?: boolean;
    timeout?: number;
    priority?: number;
    context?: {
      userId?: string;
      sessionId?: string;
      source?: string;
    };
  };
}

export interface BatchGenerateQueryEmbeddingsParams {
  requests: Array<{
    id: string;
    query: string;
    collection: string;
    options?: GenerateQueryEmbeddingParams['options'];
  }>;
  batchOptions?: {
    batchSize?: number;
    concurrency?: number;
    timeout?: number;
    onProgress?: (completed: number, total: number, current?: string) => void;
  };
}

export interface WarmEmbeddingCacheParams {
  collection: string;
  commonQueries: string[];
}

export interface ClearEmbeddingCacheParams {
  collection?: string;
  pattern?: string;
}

export interface PreloadModelsParams {
  providers: string[];
  strategy?: 'eager' | 'lazy' | 'predictive';
}

export interface OptimizeModelMemoryParams {
  maxMemoryUsage?: number;
  maxModels?: number;
  idleTimeout?: number;
  aggressive?: boolean;
}

// Task 6.2: Pipeline Response Types

export interface QueryEmbeddingResult {
  embedding: Float32Array;
  dimensions: number;
  source: 'cache_memory' | 'cache_indexeddb' | 'cache_database' | 'provider_fresh';
  processingTime: number;
  metadata?: {
    cacheHit?: boolean;
    modelUsed?: string;
    provider?: string;
    confidence?: number;
  };
}

export interface BatchQueryEmbeddingResult extends QueryEmbeddingResult {
  requestId: string;
  status: 'completed' | 'failed' | 'skipped';
  error?: string;
}

export interface PipelinePerformanceStats {
  totalRequests: number;
  cacheHitRate: number;
  averageGenerationTime: number;
  activeModels: number;
  memoryUsage: number;
  cacheStats: {
    memory: { hits: number; misses: number };
    indexedDB: { hits: number; misses: number };
    database: { hits: number; misses: number };
  };
}

export interface ModelStatusResult {
  loadedModels: Array<{
    modelId: string;
    provider: string;
    modelName: string;
    dimensions: number;
    memoryUsage: number;
    lastUsed: number;
    usageCount: number;
    status: 'loading' | 'ready' | 'error' | 'unloading';
  }>;
  totalMemoryUsage: number;
  activeCount: number;
  providerStats: Record<string, {
    count: number;
    memoryUsage: number;
    avgLoadTime: number;
  }>;
}

// Enhanced search response types
export interface EnhancedSearchResponse extends SearchResponse {
  strategy?: import("./search.js").SearchStrategy;
  fusion?: import("./search.js").FusionMethod;
  aggregations?: Record<string, any>;
  facets?: Record<string, any>;
  suggestions?: string[];
  debugInfo?: import("./search.js").SearchDebugInfo;
}

export interface GlobalSearchResponse extends EnhancedSearchResponse {
  collectionResults: Array<{
    collection: string;
    results: SearchResult[];
    totalInCollection: number;
  }>;
  collectionsSearched: string[];
}
