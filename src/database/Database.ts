/**
 * Database Class - Complete sql.js Compatible Database Wrapper
 * 
 * Provides a complete sql.js compatible Database interface that uses the
 * LocalRetrieve Worker infrastructure for all database operations.
 * 
 * Supports both synchronous sql.js API (with limitations) and enhanced async API.
 */

import { WorkerRPC, createWorkerRPC } from '../utils/rpc.js';
import { Statement } from './Statement.js';
import type {
  DatabaseAPI,
  StatementAPI,
  DatabaseConfig,
  DatabaseState,
  StatementResult,
  ExecOptions,
  SQLParams,
  SQLValue
} from '../types/database.js';
import type {
  SearchRequest,
  SearchResponse,
  TextSearchParams,
  AdvancedSearchParams,
  GlobalSearchParams,
  EnhancedSearchResponse,
  GlobalSearchResponse,
  // Task 6.2: Internal Embedding Pipeline types
  GenerateQueryEmbeddingParams,
  BatchGenerateQueryEmbeddingsParams,
  WarmEmbeddingCacheParams,
  ClearEmbeddingCacheParams,
  PreloadModelsParams,
  OptimizeModelMemoryParams,
  QueryEmbeddingResult,
  BatchQueryEmbeddingResult,
  PipelinePerformanceStats,
  ModelStatusResult
} from '../types/worker.js';
import type {
  TextSearchOptions
} from '../types/search.js';
import { 
  DatabaseError, 
  DEFAULT_DATABASE_CONFIG, 
  resolveWorkerUrl,
  validateSQL,
  validateSQLParams 
} from '../types/database.js';
import {
  SQLDatabase,
  SQLStatement,
  QueryExecResult,
  SQLDatabaseConfig,
  CompatibilityMode,
  SQLCompatConfig,
  DEFAULT_SQL_COMPAT_CONFIG,
  transformToSQLResult,
  SQLError,
  SQLDatabaseError,
  isSQLParams,
  validateSQL as validateSQLQuery
} from '../types/sql.js';

export class Database implements SQLDatabase {
  private state: DatabaseState;
  private workerRPC: WorkerRPC | null = null;
  private isInitialized = false;
  private compatConfig: SQLCompatConfig;
  private rowsModified = 0;
  private activeStatements = new Set<Statement>();

  constructor(config: DatabaseConfig = {}) {
    const finalConfig = { ...DEFAULT_DATABASE_CONFIG, ...config };
    
    this.state = {
      isOpen: false,
      filename: config.filename || ':memory:',
      worker: null,
      workerRPC: null
    };

    this.compatConfig = { ...DEFAULT_SQL_COMPAT_CONFIG };

    // Initialize worker if not in static creation mode
    if (config.filename !== undefined) {
      this._initializeWorker(finalConfig);
    }
  }

  /**
   * Static factory method for sql.js compatibility
   */
  static async create(buffer?: Uint8Array, filename?: string): Promise<Database> {
    const config: DatabaseConfig = {
      filename: filename || ':memory:'
    };

    const db = new Database(config);
    await db._initialize();

    // If buffer provided, import it
    if (buffer) {
      await db._importBuffer(buffer);
    }

    return db;
  }

  /**
   * Execute SQL statement(s) and return results (sql.js compatible)
   */
  exec(sql: string): QueryExecResult[] {
    if (!this.state.isOpen) {
      throw new SQLDatabaseError('Database is not open');
    }

    if (!validateSQLQuery(sql)) {
      throw new SQLDatabaseError('Invalid SQL statement');
    }

    try {
      // For sql.js compatibility, use synchronous execution with limitations
      return this._execSyncCompat(sql);
    } catch (error) {
      if (error instanceof SQLError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new SQLDatabaseError(`SQL execution failed: ${message}`);
    }
  }

  /**
   * Execute SQL statement(s) asynchronously (enhanced API)
   */
  async execAsync(sql: string): Promise<QueryExecResult[]> {
    if (!this.state.isOpen) {
      throw new SQLDatabaseError('Database is not open');
    }

    if (!validateSQLQuery(sql)) {
      throw new SQLDatabaseError('Invalid SQL statement');
    }

    if (!this.workerRPC) {
      throw new SQLDatabaseError('Worker not available');
    }

    try {
      const result = await this.workerRPC.select({ sql });
      return [transformToSQLResult(result.rows || [])];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new SQLDatabaseError(`SQL execution failed: ${message}`);
    }
  }

  /**
   * Run SQL statement with parameters (sql.js compatible)
   */
  run(sql: string, params?: SQLParams): Database {
    if (!this.state.isOpen) {
      throw new SQLDatabaseError('Database is not open');
    }

    if (!validateSQLQuery(sql)) {
      throw new SQLDatabaseError('Invalid SQL statement');
    }

    if (params !== undefined && !isSQLParams(params)) {
      throw new SQLDatabaseError('Invalid SQL parameters');
    }

    try {
      this._runSyncCompat(sql, params);
      return this;
    } catch (error) {
      if (error instanceof SQLError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new SQLDatabaseError(`SQL execution failed: ${message}`);
    }
  }

  /**
   * Run SQL statement with parameters asynchronously (enhanced API)
   */
  async runAsync(sql: string, params?: SQLParams): Promise<Database> {
    if (!this.state.isOpen) {
      throw new SQLDatabaseError('Database is not open');
    }

    if (!validateSQLQuery(sql)) {
      throw new SQLDatabaseError('Invalid SQL statement');
    }

    if (params !== undefined && !isSQLParams(params)) {
      throw new SQLDatabaseError('Invalid SQL parameters');
    }

    if (!this.workerRPC) {
      throw new SQLDatabaseError('Worker not available');
    }

    try {
      await this.workerRPC.exec({ sql, params });
      this.rowsModified++; // Track modifications
      return this;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new SQLDatabaseError(`SQL execution failed: ${message}`);
    }
  }

  /**
   * Prepare SQL statement (sql.js compatible)
   */
  prepare(sql: string): Statement {
    if (!this.state.isOpen) {
      throw new SQLDatabaseError('Database is not open');
    }

    if (!validateSQLQuery(sql)) {
      throw new SQLDatabaseError('Invalid SQL statement');
    }

    const statement = new Statement(this as any, sql);
    this.activeStatements.add(statement);
    return statement;
  }

  /**
   * Prepare SQL statement asynchronously (enhanced API)
   */
  async prepareAsync(sql: string): Promise<Statement> {
    return this.prepare(sql); // Preparation is synchronous, execution is async
  }

  /**
   * Export database as binary data (sql.js compatible)
   */
  export(): Uint8Array {
    if (!this.state.isOpen) {
      throw new SQLDatabaseError('Database is not open');
    }

    try {
      return this._exportSyncCompat();
    } catch (error) {
      if (error instanceof SQLError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : String(error);
      throw new SQLDatabaseError(`Database export failed: ${message}`);
    }
  }

  /**
   * Export database as binary data asynchronously (enhanced API)
   */
  async exportAsync(): Promise<Uint8Array> {
    if (!this.state.isOpen) {
      throw new SQLDatabaseError('Database is not open');
    }

    if (!this.workerRPC) {
      throw new SQLDatabaseError('Worker not available');
    }

    try {
      return await this.workerRPC.export();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new SQLDatabaseError(`Database export failed: ${message}`);
    }
  }

  /**
   * Close database connection (sql.js compatible)
   */
  close(): void {
    // Finalize all active statements
    for (const statement of this.activeStatements) {
      try {
        statement.free();
      } catch (error) {
        console.warn('Error finalizing statement:', error);
      }
    }
    this.activeStatements.clear();

    if (this.workerRPC) {
      try {
        this._closeSyncCompat();
      } catch (error) {
        // Log error but don't throw on close
        console.warn('Error during database close:', error);
      }
    }

    this.state.isOpen = false;
    this.isInitialized = false;
    
    if (this.state.worker) {
      this.state.worker.terminate();
      this.state.worker = null;
    }
    
    this.workerRPC = null;
    this.state.workerRPC = null;
  }

  /**
   * Close database connection asynchronously (enhanced API)
   */
  async closeAsync(): Promise<void> {
    // Finalize all active statements
    for (const statement of this.activeStatements) {
      try {
        statement.free();
      } catch (error) {
        console.warn('Error finalizing statement:', error);
      }
    }
    this.activeStatements.clear();

    if (this.workerRPC) {
      try {
        await this.workerRPC.close();
      } catch (error) {
        console.warn('Error during database close:', error);
      }
    }

    this.state.isOpen = false;
    this.isInitialized = false;
    
    if (this.state.worker) {
      this.state.worker.terminate();
      this.state.worker = null;
    }
    
    this.workerRPC = null;
    this.state.workerRPC = null;
  }

  /**
   * Get number of rows modified by the last statement (sql.js compatible)
   */
  getRowsModified(): number {
    return this.rowsModified;
  }

  /**
   * Create a savepoint (sql.js compatible)
   */
  savepoint(name?: string): void {
    const savepointName = name || `sp_${Date.now()}`;
    try {
      this._runSyncCompat(`SAVEPOINT ${savepointName}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new SQLDatabaseError(`Savepoint creation failed: ${message}`);
    }
  }

  /**
   * Release a savepoint (sql.js compatible)
   */
  savepoint_release(name?: string): void {
    const savepointName = name || 'sp';
    try {
      this._runSyncCompat(`RELEASE SAVEPOINT ${savepointName}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new SQLDatabaseError(`Savepoint release failed: ${message}`);
    }
  }

  /**
   * Rollback to a savepoint (sql.js compatible)
   */
  savepoint_rollback(name?: string): void {
    const savepointName = name || 'sp';
    try {
      this._runSyncCompat(`ROLLBACK TO SAVEPOINT ${savepointName}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new SQLDatabaseError(`Savepoint rollback failed: ${message}`);
    }
  }

  /**
   * Create function (sql.js compatible stub)
   */
  create_function(name: string, func: (...args: any[]) => any): void {
    if (this.compatConfig.enableWarnings) {
      console.warn('create_function is not supported in LocalRetrieve. Use SQL functions instead.');
    }
    if (this.compatConfig.throwOnSyncLimitations) {
      throw new SQLDatabaseError('create_function is not supported in Worker-based SQLite');
    }
  }

  /**
   * Create aggregate function (sql.js compatible stub)
   */
  create_aggregate(name: string, funcs: { step: Function; finalize: Function }): void {
    if (this.compatConfig.enableWarnings) {
      console.warn('create_aggregate is not supported in LocalRetrieve. Use SQL aggregate functions instead.');
    }
    if (this.compatConfig.throwOnSyncLimitations) {
      throw new SQLDatabaseError('create_aggregate is not supported in Worker-based SQLite');
    }
  }

  /**
   * Perform hybrid search (LocalRetrieve extension)
   */
  async search(request: SearchRequest): Promise<SearchResponse> {
    if (!this.state.isOpen) {
      throw new DatabaseError('Database is not open');
    }

    if (!this.workerRPC) {
      throw new DatabaseError('Worker not available');
    }

    try {
      return await this.workerRPC.search(request);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DatabaseError(`Search failed: ${message}`);
    }
  }

  /**
   * Text-only hybrid search with automatic strategy selection (Task 6.1)
   * @param query - Search query string
   * @param options - Search configuration options
   * @returns Promise<EnhancedSearchResponse>
   */
  async searchText(query: string, options?: TextSearchOptions): Promise<EnhancedSearchResponse> {
    if (!this.state.isOpen) {
      throw new DatabaseError('Database is not open');
    }

    if (!this.workerRPC) {
      throw new DatabaseError('Worker not available');
    }

    try {
      return await this.workerRPC.searchText({ query, options });
    } catch (error) {
      // Enhanced error handling with graceful degradation
      return this._handleSearchError(error, query, options);
    }
  }

  /**
   * Advanced search with explicit strategy control (Task 6.1)
   * @param params - Advanced search parameters
   * @returns Promise<EnhancedSearchResponse>
   */
  async searchAdvanced(params: AdvancedSearchParams): Promise<EnhancedSearchResponse> {
    if (!this.state.isOpen) {
      throw new DatabaseError('Database is not open');
    }

    if (!this.workerRPC) {
      throw new DatabaseError('Worker not available');
    }

    try {
      return await this.workerRPC.searchAdvanced(params);
    } catch (error) {
      return this._handleAdvancedSearchError(error, params);
    }
  }

  /**
   * Global search across all collections (Task 6.1)
   * @param query - Search query string
   * @param options - Global search options
   * @returns Promise<GlobalSearchResponse>
   */
  async searchGlobal(query: string, options?: any): Promise<GlobalSearchResponse> {
    if (!this.state.isOpen) {
      throw new DatabaseError('Database is not open');
    }

    if (!this.workerRPC) {
      throw new DatabaseError('Worker not available');
    }

    try {
      return await this.workerRPC.searchGlobal({ query, options });
    } catch (error) {
      return this._handleGlobalSearchError(error, query, options);
    }
  }

  // ============================================================================================
  // LLM Integration API (SCRUM-17)
  // ============================================================================================

  /**
   * Enhance search query using LLM (SCRUM-17)
   *
   * @param query - The search query to enhance
   * @param options - LLM provider configuration
   * @returns Promise<EnhancedQueryResult> - Enhanced query with suggestions
   *
   * @example
   * ```typescript
   * const enhanced = await db.enhanceQuery('search docs', {
   *   provider: 'openai',
   *   model: 'gpt-4',
   *   apiKey: 'sk-...'
   * });
   * console.log(enhanced.enhancedQuery); // "document search files"
   * console.log(enhanced.suggestions);    // ["find documents", ...]
   * ```
   */
  async enhanceQuery(
    query: string,
    options?: {
      provider?: 'openai' | 'anthropic' | 'openrouter' | 'custom';
      model?: string;
      apiKey?: string;
      endpoint?: string;
      maxSuggestions?: number;
      includeIntent?: boolean;
      temperature?: number;
      timeout?: number;
    }
  ): Promise<import('./types/worker.js').EnhancedQueryResult> {
    if (!this.state.isOpen) {
      throw new DatabaseError('Database is not open');
    }

    if (!this.workerRPC) {
      throw new DatabaseError('Worker not available');
    }

    try {
      return await this.workerRPC.enhanceQuery({ query, options });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DatabaseError(`Query enhancement failed: ${message}`);
    }
  }

  /**
   * Summarize search results using LLM (SCRUM-17)
   *
   * @param results - Array of search results to summarize
   * @param options - LLM provider configuration
   * @returns Promise<ResultSummaryResult> - Summary with key points
   *
   * @example
   * ```typescript
   * const results = await db.search({ query: { text: 'documents' } });
   * const summary = await db.summarizeResults(results.results, {
   *   provider: 'anthropic',
   *   model: 'claude-3-sonnet',
   *   apiKey: 'sk-ant-...'
   * });
   * console.log(summary.summary);     // "The search results..."
   * console.log(summary.keyPoints);   // ["Document management", ...]
   * ```
   */
  async summarizeResults(
    results: any[],
    options?: {
      provider?: 'openai' | 'anthropic' | 'openrouter' | 'custom';
      model?: string;
      apiKey?: string;
      endpoint?: string;
      maxLength?: number;
      includeKeyPoints?: boolean;
      temperature?: number;
      timeout?: number;
    }
  ): Promise<import('./types/worker.js').ResultSummaryResult> {
    if (!this.state.isOpen) {
      throw new DatabaseError('Database is not open');
    }

    if (!this.workerRPC) {
      throw new DatabaseError('Worker not available');
    }

    try {
      return await this.workerRPC.summarizeResults({ results, options });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DatabaseError(`Result summarization failed: ${message}`);
    }
  }

  /**
   * Combined search with LLM enhancements (SCRUM-17)
   *
   * Performs search with optional query enhancement and result summarization.
   *
   * @param query - The search query
   * @param options - Search and LLM configuration
   * @returns Promise<LLMSearchResponseResult> - Results with LLM enhancements
   *
   * @example
   * ```typescript
   * const smartSearch = await db.searchWithLLM('AI docs', {
   *   enhanceQuery: true,
   *   summarizeResults: true,
   *   searchOptions: { limit: 20 },
   *   llmOptions: {
   *     provider: 'openai',
   *     model: 'gpt-4',
   *     apiKey: 'sk-...'
   *   }
   * });
   * console.log(smartSearch.enhancedQuery);  // Enhanced query
   * console.log(smartSearch.results);        // Search results
   * console.log(smartSearch.summary);        // AI-generated summary
   * ```
   */
  async searchWithLLM(
    query: string,
    options?: {
      enhanceQuery?: boolean;
      summarizeResults?: boolean;
      searchOptions?: import('./types/search.js').TextSearchOptions;
      llmOptions?: {
        provider?: string;
        model?: string;
        apiKey?: string;
        endpoint?: string;
        temperature?: number;
      };
    }
  ): Promise<import('./types/worker.js').LLMSearchResponseResult> {
    if (!this.state.isOpen) {
      throw new DatabaseError('Database is not open');
    }

    if (!this.workerRPC) {
      throw new DatabaseError('Worker not available');
    }

    try {
      return await this.workerRPC.searchWithLLM({ query, options });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DatabaseError(`LLM search failed: ${message}`);
    }
  }

  /**
   * Generic LLM call with arbitrary prompt (SCRUM-17)
   *
   * Provides direct access to LLM providers for custom use cases beyond
   * query enhancement or result summarization. This method accepts any
   * prompt and returns the raw LLM response.
   *
   * @param prompt - The prompt to send to the LLM
   * @param options - LLM provider configuration
   * @returns Promise<CallLLMResult> - Raw LLM response with text and metadata
   *
   * @example
   * ```typescript
   * const result = await db.callLLM('Explain quantum computing in simple terms', {
   *   provider: 'openai',
   *   model: 'gpt-4',
   *   apiKey: 'sk-...',
   *   temperature: 0.7,
   *   maxTokens: 500
   * });
   * console.log(result.text);           // LLM's response
   * console.log(result.usage);          // Token usage stats
   * console.log(result.processingTime); // Processing time in ms
   * ```
   *
   * @example
   * ```typescript
   * // Custom use case: Generate product descriptions
   * const product = { name: 'Widget Pro', features: ['Fast', 'Reliable'] };
   * const prompt = `Generate a marketing description for: ${JSON.stringify(product)}`;
   * const result = await db.callLLM(prompt, {
   *   provider: 'anthropic',
   *   model: 'claude-3-sonnet',
   *   apiKey: process.env.ANTHROPIC_API_KEY
   * });
   * console.log(result.text); // Marketing description
   * ```
   */
  async callLLM(
    prompt: string,
    options?: {
      provider?: 'openai' | 'anthropic' | 'openrouter' | 'custom';
      model?: string;
      apiKey?: string;
      endpoint?: string;
      temperature?: number;
      maxTokens?: number;
      timeout?: number;
      systemPrompt?: string;
    }
  ): Promise<import('./types/worker.js').CallLLMResult> {
    if (!this.state.isOpen) {
      throw new DatabaseError('Database is not open');
    }

    if (!this.workerRPC) {
      throw new DatabaseError('Worker not available');
    }

    try {
      return await this.workerRPC.callLLM({ prompt, options });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DatabaseError(`LLM call failed: ${message}`);
    }
  }

  // Task 6.2: Internal Embedding Pipeline API
  // ============================================================================================

  /**
   * Generate embedding for a query with intelligent caching (Task 6.2)
   * @param query - Text query to generate embedding for
   * @param collection - Collection context for embedding generation
   * @param options - Additional generation options
   * @returns Promise<QueryEmbeddingResult>
   */
  async generateQueryEmbedding(
    query: string,
    collection: string,
    options?: {
      forceRefresh?: boolean;
      timeout?: number;
      priority?: number;
      context?: {
        userId?: string;
        sessionId?: string;
        source?: string;
      };
    }
  ): Promise<QueryEmbeddingResult> {
    if (!this.state.isOpen) {
      throw new DatabaseError('Database is not open');
    }

    if (!this.workerRPC) {
      throw new DatabaseError('Worker not available');
    }

    try {
      return await this.workerRPC.generateQueryEmbedding({
        query,
        collection,
        options
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DatabaseError(`Query embedding generation failed: ${message}`);
    }
  }

  /**
   * Generate embeddings for multiple queries in batch (Task 6.2)
   * @param requests - Array of embedding requests
   * @param batchOptions - Batch processing options
   * @returns Promise<BatchQueryEmbeddingResult[]>
   */
  async batchGenerateQueryEmbeddings(
    requests: Array<{
      id: string;
      query: string;
      collection: string;
      options?: Parameters<Database['generateQueryEmbedding']>[2];
    }>,
    batchOptions?: {
      batchSize?: number;
      concurrency?: number;
      timeout?: number;
      onProgress?: (completed: number, total: number, current?: string) => void;
    }
  ): Promise<BatchQueryEmbeddingResult[]> {
    if (!this.state.isOpen) {
      throw new DatabaseError('Database is not open');
    }

    if (!this.workerRPC) {
      throw new DatabaseError('Worker not available');
    }

    try {
      return await this.workerRPC.batchGenerateQueryEmbeddings({
        requests,
        batchOptions
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DatabaseError(`Batch query embedding generation failed: ${message}`);
    }
  }

  /**
   * Warm embedding cache with common queries (Task 6.2)
   * @param collection - Collection to warm cache for
   * @param commonQueries - Array of frequently used queries
   * @returns Promise<void>
   */
  async warmEmbeddingCache(collection: string, commonQueries: string[]): Promise<void> {
    if (!this.state.isOpen) {
      throw new DatabaseError('Database is not open');
    }

    if (!this.workerRPC) {
      throw new DatabaseError('Worker not available');
    }

    try {
      await this.workerRPC.warmEmbeddingCache({
        collection,
        commonQueries
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DatabaseError(`Embedding cache warming failed: ${message}`);
    }
  }

  /**
   * Clear embedding cache (Task 6.2)
   * @param collection - Optional specific collection to clear
   * @param pattern - Optional pattern for selective clearing
   * @returns Promise<void>
   */
  async clearEmbeddingCache(collection?: string, pattern?: string): Promise<void> {
    if (!this.state.isOpen) {
      throw new DatabaseError('Database is not open');
    }

    if (!this.workerRPC) {
      throw new DatabaseError('Worker not available');
    }

    try {
      await this.workerRPC.clearEmbeddingCache({
        collection,
        pattern
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DatabaseError(`Embedding cache clearing failed: ${message}`);
    }
  }

  /**
   * Get embedding pipeline performance statistics (Task 6.2)
   * @returns Promise<PipelinePerformanceStats>
   */
  async getPipelineStats(): Promise<PipelinePerformanceStats> {
    if (!this.state.isOpen) {
      throw new DatabaseError('Database is not open');
    }

    if (!this.workerRPC) {
      throw new DatabaseError('Worker not available');
    }

    try {
      return await this.workerRPC.getPipelineStats();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DatabaseError(`Pipeline stats retrieval failed: ${message}`);
    }
  }

  /**
   * Get model status information (Task 6.2)
   * @returns Promise<ModelStatusResult>
   */
  async getModelStatus(): Promise<ModelStatusResult> {
    if (!this.state.isOpen) {
      throw new DatabaseError('Database is not open');
    }

    if (!this.workerRPC) {
      throw new DatabaseError('Worker not available');
    }

    try {
      return await this.workerRPC.getModelStatus();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DatabaseError(`Model status retrieval failed: ${message}`);
    }
  }

  // ====================================
  // Phase 4: Collection Integration
  // ====================================

  /**
   * Create a new collection with optional embedding configuration
   */
  async createCollection(params: {
    name: string;
    embeddingConfig?: import('../embedding/types.js').CollectionEmbeddingConfig;
    description?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    if (!this.state.isOpen) {
      throw new DatabaseError('Database is not open');
    }

    if (!this.workerRPC) {
      throw new DatabaseError('Worker not available');
    }

    try {
      await this.workerRPC.createCollection(params);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DatabaseError(`Collection creation failed: ${message}`);
    }
  }

  /**
   * Get embedding status for a collection
   */
  async getCollectionEmbeddingStatus(collection: string): Promise<import('../types/worker.js').CollectionEmbeddingStatusResult> {
    if (!this.state.isOpen) {
      throw new DatabaseError('Database is not open');
    }

    if (!this.workerRPC) {
      throw new DatabaseError('Worker not available');
    }

    try {
      return await this.workerRPC.getCollectionEmbeddingStatus(collection);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DatabaseError(`Failed to get collection embedding status: ${message}`);
    }
  }

  /**
   * Insert a document with automatic embedding generation
   */
  async insertDocumentWithEmbedding(params: {
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
  }): Promise<{ id: string; embeddingGenerated: boolean }> {
    if (!this.state.isOpen) {
      throw new DatabaseError('Database is not open');
    }

    if (!this.workerRPC) {
      throw new DatabaseError('Worker not available');
    }

    try {
      return await this.workerRPC.insertDocumentWithEmbedding(params);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DatabaseError(`Document insertion with embedding failed: ${message}`);
    }
  }

  /**
   * Perform semantic search on a collection
   */
  async searchSemantic(params: {
    collection: string;
    query: string;
    options?: {
      limit?: number;
      similarityThreshold?: number;
      includeEmbeddings?: boolean;
      filters?: Record<string, any>;
      generateQueryEmbedding?: boolean;
    };
  }): Promise<SearchResponse> {
    if (!this.state.isOpen) {
      throw new DatabaseError('Database is not open');
    }

    if (!this.workerRPC) {
      throw new DatabaseError('Worker not available');
    }

    try {
      return await this.workerRPC.searchSemantic(params);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DatabaseError(`Semantic search failed: ${message}`);
    }
  }

  // ====================================
  // Phase 5: Embedding Queue Management
  // ====================================

  /**
   * Add documents to the embedding generation queue (Phase 5)
   * @param params - Queue parameters including collection, documents, and priority
   * @returns Promise<number> - Number of documents added to queue
   */
  async enqueueEmbedding(params: Parameters<import('../utils/rpc').WorkerRPC['enqueueEmbedding']>[0]): Promise<number> {
    if (!this.state.isOpen) {
      throw new DatabaseError('Database is not open');
    }

    if (!this.workerRPC) {
      throw new DatabaseError('Worker not available');
    }

    try {
      return await this.workerRPC.enqueueEmbedding(params);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DatabaseError(`Embedding queue enqueue failed: ${message}`);
    }
  }

  /**
   * Process pending embedding queue items (Phase 5)
   * @param params - Optional processing parameters including collection filter and batch size
   * @returns Promise<QueueProcessResult> - Processing results
   */
  async processEmbeddingQueue(params?: Parameters<import('../utils/rpc').WorkerRPC['processEmbeddingQueue']>[0]) {
    if (!this.state.isOpen) {
      throw new DatabaseError('Database is not open');
    }

    if (!this.workerRPC) {
      throw new DatabaseError('Worker not available');
    }

    try {
      return await this.workerRPC.processEmbeddingQueue(params);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DatabaseError(`Embedding queue processing failed: ${message}`);
    }
  }

  /**
   * Get embedding queue status and statistics (Phase 5)
   * @param collection - Optional collection name to filter results
   * @returns Promise<QueueStatusResult> - Current queue status
   */
  async getQueueStatus(collection?: string) {
    if (!this.state.isOpen) {
      throw new DatabaseError('Database is not open');
    }

    if (!this.workerRPC) {
      throw new DatabaseError('Worker not available');
    }

    try {
      return await this.workerRPC.getQueueStatus(collection);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DatabaseError(`Queue status retrieval failed: ${message}`);
    }
  }

  /**
   * Clear embedding queue items (Phase 5)
   * @param params - Optional parameters to filter which items to clear
   * @returns Promise<number> - Number of items cleared
   */
  async clearEmbeddingQueue(params?: Parameters<import('../utils/rpc').WorkerRPC['clearEmbeddingQueue']>[0]): Promise<number> {
    if (!this.state.isOpen) {
      throw new DatabaseError('Database is not open');
    }

    if (!this.workerRPC) {
      throw new DatabaseError('Worker not available');
    }

    try {
      return await this.workerRPC.clearEmbeddingQueue(params);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DatabaseError(`Queue clearing failed: ${message}`);
    }
  }

  /**
   * Preload embedding models (Task 6.2)
   * @param providers - Array of provider names to preload
   * @param strategy - Loading strategy (eager, lazy, predictive)
   * @returns Promise<void>
   */
  async preloadModels(providers: string[], strategy: 'eager' | 'lazy' | 'predictive' = 'lazy'): Promise<void> {
    if (!this.state.isOpen) {
      throw new DatabaseError('Database is not open');
    }

    if (!this.workerRPC) {
      throw new DatabaseError('Worker not available');
    }

    try {
      await this.workerRPC.preloadModels({
        providers,
        strategy
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DatabaseError(`Model preloading failed: ${message}`);
    }
  }

  /**
   * Optimize model memory usage (Task 6.2)
   * @param options - Memory optimization options
   * @returns Promise<void>
   */
  async optimizeModelMemory(options?: {
    maxMemoryUsage?: number;
    maxModels?: number;
    idleTimeout?: number;
    aggressive?: boolean;
  }): Promise<void> {
    if (!this.state.isOpen) {
      throw new DatabaseError('Database is not open');
    }

    if (!this.workerRPC) {
      throw new DatabaseError('Worker not available');
    }

    try {
      await this.workerRPC.optimizeModelMemory(options);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DatabaseError(`Model memory optimization failed: ${message}`);
    }
  }

  /**
   * Initialize schema (LocalRetrieve extension)
   */
  async initializeSchema(): Promise<void> {
    if (!this.state.isOpen) {
      throw new DatabaseError('Database is not open');
    }

    if (!this.workerRPC) {
      throw new DatabaseError('Worker not available');
    }

    try {
      await this.workerRPC.initializeSchema();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DatabaseError(`Schema initialization failed: ${message}`);
    }
  }

  /**
   * Get Worker RPC instance (for Statement class)
   */
  _getWorkerRPC(): WorkerRPC | null {
    return this.workerRPC;
  }

  /**
   * Initialize worker and open database connection
   */
  async _initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (!this.workerRPC) {
      throw new DatabaseError('Worker not initialized');
    }

    try {
      // Open database (vec extension is initialized automatically in handleOpen)
      await this.workerRPC.open({
        filename: this.state.filename,
        vfs: 'opfs'
      });

      this.state.isOpen = true;
      this.isInitialized = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DatabaseError(`Database initialization failed: ${message}`);
    }
  }

  /**
   * Initialize worker RPC
   */
  private _initializeWorker(config: DatabaseConfig): void {
    try {
      // Try multiple worker URL strategies
      let workerUrl: string;
      
      if (config.workerUrl) {
        workerUrl = config.workerUrl;
      } else {
        // Use module URL for compiled package structure
        // This will work both in development (Vite) and production (npm package)
        workerUrl = new URL('../database/worker.js', import.meta.url).toString();
      }
      
      console.log('[Database._initializeWorker] Attempting to load worker from:', workerUrl);
      
      this.workerRPC = createWorkerRPC(workerUrl, config.workerConfig);
      this.state.worker = (this.workerRPC as any).worker;
      this.state.workerRPC = this.workerRPC;
      
      console.log('[Database._initializeWorker] Worker RPC created successfully');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[Database._initializeWorker] Worker initialization failed:', error);
      
      // Provide helpful error message with potential solutions
      throw new DatabaseError(
        `Worker initialization failed: ${message}\n\n` +
        'Possible solutions:\n' +
        '1. Ensure the database worker file exists at the correct path\n' +
        '2. Check that your build process includes worker files\n' +
        '3. Verify COOP/COEP headers are set for SharedArrayBuffer support\n' +
        '4. Try providing an explicit workerUrl in the config'
      );
    }
  }

  /**
   * Import buffer data
   */
  private async _importBuffer(buffer: Uint8Array): Promise<void> {
    if (!this.workerRPC) {
      throw new DatabaseError('Worker not available');
    }

    try {
      await this.workerRPC.import({
        data: buffer,
        format: 'sqlite',
        overwrite: true
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new DatabaseError(`Buffer import failed: ${message}`);
    }
  }

  /**
   * Synchronous execution compatibility layer
   * Uses blocking async call with warnings about limitations
   */
  private _execSyncCompat(sql: string): QueryExecResult[] {
    if (this.compatConfig.enableWarnings) {
      console.warn('SYNC/ASYNC COMPATIBILITY WARNING: Using synchronous API with async Worker. Consider using execAsync() for better performance.');
    }
    
    if (this.compatConfig.throwOnSyncLimitations) {
      throw new SQLDatabaseError(
        'SYNC/ASYNC COMPATIBILITY ISSUE:\n' +
        'Worker communication is inherently async. SQL executed successfully but cannot return synchronously.\n' +
        'SOLUTIONS:\n' +
        '1. Use async API: await database.execAsync(sql) instead of database.exec(sql)\n' +
        '2. Use database.prepare() for prepared statements\n' +
        '3. Consider using sql.js directly on main thread for true sync operations\n' +
        '\nThis is a known limitation of browser worker architecture.'
      );
    }

    if (!this.workerRPC) {
      throw new SQLDatabaseError('Worker not available');
    }

    // Attempt synchronous execution with timeout
    let isResolved = false;
    let result: any = null;
    let error: any = null;

    const executePromise = this.workerRPC.select({ sql });

    executePromise
      .then((res: any) => {
        result = res;
        isResolved = true;
      })
      .catch((err: any) => {
        error = err;
        isResolved = true;
      });

    // Busy wait for result (limited time)
    const startTime = Date.now();
    const timeout = this.compatConfig.workerTimeout;

    while (!isResolved && (Date.now() - startTime) < timeout) {
      // Minimal busy wait to allow event loop processing
    }

    if (!isResolved) {
      throw new SQLDatabaseError('Query execution timeout in sync compatibility mode');
    }

    if (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new SQLDatabaseError(`Query execution failed: ${message}`);
    }

    return [transformToSQLResult(result?.rows || [])];
  }

  /**
   * Synchronous run compatibility layer
   */
  private _runSyncCompat(sql: string, params?: SQLParams): void {
    if (this.compatConfig.enableWarnings) {
      console.warn('SYNC/ASYNC COMPATIBILITY WARNING: Using synchronous API with async Worker. Consider using runAsync() for better performance.');
    }

    if (!this.workerRPC) {
      throw new SQLDatabaseError('Worker not available');
    }

    let isResolved = false;
    let error: any = null;

    const executePromise = this.workerRPC.exec({ sql, params });

    executePromise
      .then(() => {
        this.rowsModified++;
        isResolved = true;
      })
      .catch((err: any) => {
        error = err;
        isResolved = true;
      });

    // Busy wait for result
    const startTime = Date.now();
    const timeout = this.compatConfig.workerTimeout;

    while (!isResolved && (Date.now() - startTime) < timeout) {
      // Minimal busy wait
    }

    if (!isResolved) {
      throw new SQLDatabaseError('Query execution timeout in sync compatibility mode');
    }

    if (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new SQLDatabaseError(`Query execution failed: ${message}`);
    }
  }

  /**
   * Synchronous export compatibility layer
   */
  private _exportSyncCompat(): Uint8Array {
    if (this.compatConfig.enableWarnings) {
      console.warn('SYNC/ASYNC COMPATIBILITY WARNING: Using synchronous export with async Worker. Consider using exportAsync() for better performance.');
    }

    if (!this.workerRPC) {
      throw new SQLDatabaseError('Worker not available');
    }

    let isResolved = false;
    let result: Uint8Array | null = null;
    let error: any = null;

    const exportPromise = this.workerRPC.export();

    exportPromise
      .then((res: Uint8Array) => {
        result = res;
        isResolved = true;
      })
      .catch((err: any) => {
        error = err;
        isResolved = true;
      });

    // Busy wait for result
    const startTime = Date.now();
    const timeout = this.compatConfig.workerTimeout;

    while (!isResolved && (Date.now() - startTime) < timeout) {
      // Minimal busy wait
    }

    if (!isResolved) {
      throw new SQLDatabaseError('Export timeout in sync compatibility mode');
    }

    if (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new SQLDatabaseError(`Export failed: ${message}`);
    }

    return result || new Uint8Array(0);
  }

  /**
   * Synchronous close compatibility layer
   */
  private _closeSyncCompat(): void {
    if (!this.workerRPC) {
      return;
    }

    let isResolved = false;
    let error: any = null;

    const closePromise = this.workerRPC.close();

    closePromise
      .then(() => {
        isResolved = true;
      })
      .catch((err: any) => {
        error = err;
        isResolved = true;
      });

    // Busy wait for result (shorter timeout for close)
    const startTime = Date.now();
    const timeout = 5000; // 5 second timeout for close

    while (!isResolved && (Date.now() - startTime) < timeout) {
      // Minimal busy wait
    }

    if (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new SQLDatabaseError(`Close failed: ${message}`);
    }
  }

  // Enhanced error handling with graceful degradation (Task 6.1)
  private async _handleSearchError(
    error: any,
    query: string,
    options?: TextSearchOptions
  ): Promise<EnhancedSearchResponse> {
    // Attempt fallback to existing search method
    if (!options?.mode || options.mode !== 'VECTOR_ONLY' as any) {
      try {
        const fallbackResult = await this.search({
          query: { text: query },
          collection: options?.collection,
          limit: options?.limit || 10
        });

        // Convert SearchResponse to EnhancedSearchResponse
        return {
          results: fallbackResult.results,
          totalResults: fallbackResult.totalResults,
          searchTime: fallbackResult.searchTime,
          strategy: 'keyword' as any,
          suggestions: [],
          debugInfo: {
            queryAnalysis: {
              originalQuery: query,
              normalizedQuery: query,
              queryType: 'unknown' as any,
              confidence: 0.5,
              features: {
                wordCount: query.split(' ').length,
                hasQuestionWords: false,
                hasBooleanOperators: false,
                hasWildcards: false,
                hasQuotes: false,
                hasNumbers: false,
                hasSpecialCharacters: false,
                averageWordLength: 5,
                containsCommonStopWords: false,
                estimatedIntent: 'search'
              },
              suggestedStrategy: 'keyword' as any,
              alternativeStrategies: [],
              estimatedComplexity: 'low'
            },
            executionPlan: {
              primaryStrategy: 'keyword' as any,
              fallbackStrategies: [],
              searchModes: [],
              fusion: {
                method: 'rrf' as any,
                weights: {
                  fts: 1,
                  vector: 0,
                  exactMatch: 1,
                  phraseMatch: 1,
                  proximity: 0.5,
                  freshness: 0.1,
                  popularity: 0.1
                },
                normalization: 'none' as any
              },
              filters: {},
              pagination: { limit: options?.limit || 20, offset: 0 },
              performance: {}
            },
            timings: {
              analysis: 0,
              planning: 0,
              execution: fallbackResult.searchTime,
              fusion: 0,
              total: fallbackResult.searchTime
            },
            indexUsage: {
              ftsIndex: true,
              vectorIndex: false
            },
            warnings: ['Fell back to basic search due to enhanced search error'],
            recommendations: ['Consider using basic search() method for simple queries']
          }
        };
      } catch (fallbackError) {
        const message = error instanceof Error ? error.message : String(error);
        const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        throw new DatabaseError(`Search failed: ${message}, Fallback failed: ${fallbackMessage}`);
      }
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new DatabaseError(`Text search failed: ${message}`);
  }

  private async _handleAdvancedSearchError(error: any, params: AdvancedSearchParams): Promise<EnhancedSearchResponse> {
    const message = error instanceof Error ? error.message : String(error);
    throw new DatabaseError(`Advanced search failed: ${message}`);
  }

  private async _handleGlobalSearchError(error: any, query: string, options?: any): Promise<GlobalSearchResponse> {
    const message = error instanceof Error ? error.message : String(error);
    throw new DatabaseError(`Global search failed: ${message}`);
  }
}