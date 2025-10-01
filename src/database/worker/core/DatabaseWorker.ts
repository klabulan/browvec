/**
 * DatabaseWorker
 *
 * Main coordinator class for the refactored database worker.
 * Manages all worker components and coordinates RPC operations.
 */

import { WorkerRPCHandler } from '../../../utils/rpc.js';
import { SQLiteManager } from './SQLiteManager.js';
import { OPFSManager } from './OPFSManager.js';
import { SchemaManager } from '../schema/SchemaManager.js';
import { EmbeddingQueue } from '../embedding/EmbeddingQueue.js';
import { ProviderManager } from '../embedding/ProviderManager.js';
import { SearchHandler } from '../handlers/SearchHandler.js';
import { LLMManager } from '../llm/LLMManager.js';
import { Logger } from '../utils/Logger.js';
import { ErrorHandler } from '../utils/ErrorHandling.js';

import type {
  OpenDatabaseParams,
  ExecParams,
  SelectParams,
  BulkInsertParams,
  SearchRequest,
  SearchResponse,
  CollectionInfo,
  QueryResult,
  ExportParams,
  ImportParams,
  CreateCollectionParams,
  InsertDocumentWithEmbeddingParams,
  SemanticSearchParams,
  CollectionEmbeddingStatusResult,
  GenerateEmbeddingRequest,
  GenerateEmbeddingResult,
  BatchEmbeddingRequest,
  BatchEmbeddingResult,
  EnqueueEmbeddingParams,
  ProcessEmbeddingQueueParams,
  ProcessEmbeddingQueueResult,
  QueueStatusResult,
  ClearEmbeddingQueueParams,
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
  ModelStatusResult,
  // SCRUM-17: LLM Integration types
  EnhanceQueryParams,
  EnhancedQueryResult,
  SummarizeResultsParams,
  ResultSummaryResult,
  SearchWithLLMParams,
  LLMSearchResponseResult
} from '../../../types/worker.js';

import {
  isOpenDatabaseParams,
  isExecParams,
  isSelectParams,
  isBulkInsertParams,
  isSearchRequest,
  isCreateCollectionParams,
  isInsertDocumentWithEmbeddingParams,
  isSemanticSearchParams,
  isExportParams,
  isImportParams,
  isGenerateEmbeddingRequest,
  isBatchEmbeddingRequest,
  isEnqueueEmbeddingParams,
  isProcessEmbeddingQueueParams,
  isClearEmbeddingQueueParams
} from '../utils/TypeGuards.js';

/**
 * Main DatabaseWorker coordinator class
 *
 * This class replaces the monolithic worker implementation with a modular,
 * well-organized architecture. It coordinates between different components
 * and provides a clean RPC interface.
 *
 * Architecture:
 * - SQLiteManager: Direct SQLite WASM operations
 * - OPFSManager: Persistence and file operations
 * - SchemaManager: Schema initialization and migrations
 * - EmbeddingQueue: Background embedding processing
 * - ProviderManager: Embedding provider management
 * - Logger: Centralized logging
 * - ErrorHandler: Enhanced error handling
 */
export class DatabaseWorker {
  // Core components
  private sqliteManager: SQLiteManager;
  private opfsManager: OPFSManager;
  private schemaManager: SchemaManager;
  private embeddingQueue: EmbeddingQueue;
  private providerManager: ProviderManager;
  private searchHandler: SearchHandler;
  private llmManager: LLMManager;
  private logger: Logger;

  // RPC handler
  private rpcHandler: WorkerRPCHandler;

  // Worker state
  private isInitialized = false;
  private startTime = Date.now();

  constructor() {
    // Initialize logger first
    this.logger = new Logger({
      level: 'debug',
      component: 'DatabaseWorker'
    });

    // Initialize core components
    this.sqliteManager = new SQLiteManager(this.logger);
    this.opfsManager = new OPFSManager(this.sqliteManager, this.logger);
    this.schemaManager = new SchemaManager(this.sqliteManager, this.logger);
    this.embeddingQueue = new EmbeddingQueue(this.sqliteManager, this.logger);
    this.providerManager = new ProviderManager(this.sqliteManager, this.logger);
    this.searchHandler = new SearchHandler({
      sqliteManager: this.sqliteManager,
      schemaManager: this.schemaManager,
      opfsManager: this.opfsManager,
      logger: this.logger
    });
    this.llmManager = new LLMManager(this.logger);

    // Initialize RPC handler
    this.rpcHandler = new WorkerRPCHandler({
      logLevel: 'debug',
      operationTimeout: 30000
    });

    this.setupRPCHandlers();
    this.logger.info('DatabaseWorker initialized with modular architecture + LLM support');
  }

  /**
   * Setup all RPC handlers
   */
  private setupRPCHandlers(): void {
    // Core database operations
    this.rpcHandler.register('open', this.handleOpen.bind(this));
    this.rpcHandler.register('close', this.handleClose.bind(this));
    this.rpcHandler.register('exec', this.handleExec.bind(this));
    this.rpcHandler.register('select', this.handleSelect.bind(this));
    this.rpcHandler.register('bulkInsert', this.handleBulkInsert.bind(this));

    // WASM-specific operations
    this.rpcHandler.register('initVecExtension', this.handleInitVecExtension.bind(this));

    // Schema management
    this.rpcHandler.register('initializeSchema', this.handleInitializeSchema.bind(this));
    this.rpcHandler.register('getCollectionInfo', this.handleGetCollectionInfo.bind(this));

    // Collection management
    this.rpcHandler.register('createCollection', this.handleCreateCollection.bind(this));
    this.rpcHandler.register('getCollectionEmbeddingStatus', this.handleGetCollectionEmbeddingStatus.bind(this));

    // Document operations with embedding support
    this.rpcHandler.register('insertDocumentWithEmbedding', this.handleInsertDocumentWithEmbedding.bind(this));

    // Embedding generation operations
    this.rpcHandler.register('generateEmbedding', this.handleGenerateEmbedding.bind(this));
    this.rpcHandler.register('batchGenerateEmbeddings', this.handleBatchGenerateEmbeddings.bind(this));
    this.rpcHandler.register('regenerateCollectionEmbeddings', this.handleRegenerateCollectionEmbeddings.bind(this));

    // Embedding queue management
    this.rpcHandler.register('enqueueEmbedding', this.handleEnqueueEmbedding.bind(this));
    this.rpcHandler.register('processEmbeddingQueue', this.handleProcessEmbeddingQueue.bind(this));
    this.rpcHandler.register('getQueueStatus', this.handleGetQueueStatus.bind(this));
    this.rpcHandler.register('clearEmbeddingQueue', this.handleClearEmbeddingQueue.bind(this));

    // Search operations
    this.rpcHandler.register('search', this.handleSearch.bind(this));
    this.rpcHandler.register('searchSemantic', this.handleSearchSemantic.bind(this));
    // Enhanced search API (Task 6.1)
    this.rpcHandler.register('searchText', this.handleSearchText.bind(this));
    this.rpcHandler.register('searchAdvanced', this.handleSearchAdvanced.bind(this));
    this.rpcHandler.register('searchGlobal', this.handleSearchGlobal.bind(this));

    // LLM operations (SCRUM-17)
    this.rpcHandler.register('enhanceQuery', this.handleEnhanceQuery.bind(this));
    this.rpcHandler.register('summarizeResults', this.handleSummarizeResults.bind(this));
    this.rpcHandler.register('searchWithLLM', this.handleSearchWithLLM.bind(this));
    this.rpcHandler.register('callLLM', this.handleCallLLM.bind(this));

    // Task 6.2: Internal Embedding Pipeline Operations
    this.rpcHandler.register('generateQueryEmbedding', this.handleGenerateQueryEmbedding.bind(this));
    this.rpcHandler.register('batchGenerateQueryEmbeddings', this.handleBatchGenerateQueryEmbeddings.bind(this));
    this.rpcHandler.register('warmEmbeddingCache', this.handleWarmEmbeddingCache.bind(this));
    this.rpcHandler.register('clearEmbeddingCache', this.handleClearEmbeddingCache.bind(this));
    this.rpcHandler.register('getPipelineStats', this.handleGetPipelineStats.bind(this));
    this.rpcHandler.register('getModelStatus', this.handleGetModelStatus.bind(this));
    this.rpcHandler.register('preloadModels', this.handlePreloadModels.bind(this));
    this.rpcHandler.register('optimizeModelMemory', this.handleOptimizeModelMemory.bind(this));

    // Data export/import
    this.rpcHandler.register('export', this.handleExport.bind(this));
    this.rpcHandler.register('import', this.handleImport.bind(this));
    this.rpcHandler.register('clear', this.handleClear.bind(this));

    // Utility operations
    this.rpcHandler.register('ping', this.handlePing.bind(this));
    this.rpcHandler.register('getVersion', this.handleGetVersion.bind(this));
    this.rpcHandler.register('getStats', this.handleGetStats.bind(this));
  }

  // =============================================================================
  // Core Database Operations
  // =============================================================================

  private async handleOpen(params: OpenDatabaseParams): Promise<void> {
    const validParams = this.validateParams(params, isOpenDatabaseParams, 'handleOpen');

    return this.withContext('open', async () => {
      // Use filename as the primary path, fall back to path if provided
      const dbFilename = validParams.filename || validParams.path || ':memory:';
      this.logger.info(`Opening database with filename: ${dbFilename}, vfs: ${validParams.vfs}`);

      // Initialize OPFS if using opfs:/ path
      let dbPath = dbFilename;
      if (dbFilename.startsWith('opfs:/')) {
        this.logger.info(`Initializing OPFS database: ${dbFilename}`);
        dbPath = await this.opfsManager.initializeDatabase(dbFilename);
        this.logger.info(`OPFS database path resolved to: ${dbPath}`);
      }

      // Open database connection
      this.logger.info(`Opening SQLite database at path: ${dbPath}`);
      await this.sqliteManager.openDatabase(dbPath);

      // Initialize sqlite-vec extension
      await this.sqliteManager.initVecExtension();

      // Apply pending OPFS data if available
      const pendingData = this.opfsManager.getPendingDatabaseData();
      if (pendingData) {
        this.logger.info('Restoring database from OPFS data');
        await this.sqliteManager.deserialize(pendingData);
        this.opfsManager.clearPendingDatabaseData();
        this.logger.info('Database restored from OPFS successfully');

        // Verify database integrity after deserialization
        try {
          await this.sqliteManager.exec('SELECT 1');
          this.logger.info('Database connection verified after restore');
        } catch (error) {
          this.logger.error('Database connection invalid after restore, reopening...', { error });
          // Close and reopen the connection
          this.sqliteManager.closeDatabase();
          await this.sqliteManager.openDatabase(dbPath);
          await this.sqliteManager.initVecExtension();
          this.logger.info('Database connection re-established');
        }
      }

      // Start OPFS auto-sync if using OPFS
      if (dbFilename.startsWith('opfs:/')) {
        this.opfsManager.startAutoSync();
      }

      this.isInitialized = true;
      this.logger.info(`Database opened successfully: ${dbFilename}`);
    });
  }

  private async handleClose(): Promise<void> {
    return this.withContext('close', async () => {
      if (!this.isInitialized) {
        return;
      }

      try {
        // Cleanup embedding providers
        await this.providerManager.dispose();

        // Force final sync to OPFS
        await this.opfsManager.forceSync();

        // Stop auto-sync
        this.opfsManager.stopAutoSync();

        // Close database
        this.sqliteManager.closeDatabase();

        // Cleanup OPFS manager
        this.opfsManager.cleanup();

        this.isInitialized = false;
        this.logger.info('Database closed successfully');
      } catch (error) {
        this.logger.error(`Error during database close: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }
    });
  }

  private async handleExec(params: ExecParams): Promise<QueryResult | void> {
    const validParams = this.validateParams(params, isExecParams, 'handleExec');
    this.ensureInitialized();

    return this.withContext('exec', async () => {
      await this.sqliteManager.exec(validParams.sql, validParams.params);
      this.logger.debug(`Executed SQL: ${validParams.sql.substring(0, 100)}...`);
    });
  }

  private async handleSelect(params: SelectParams): Promise<QueryResult> {
    const validParams = this.validateParams(params, isSelectParams, 'handleSelect');
    this.ensureInitialized();

    return this.withContext('select', async () => {
      const result = await this.sqliteManager.select(validParams.sql, validParams.params);
      this.logger.debug(`Selected ${result.rows.length} rows`);
      return result;
    });
  }

  private async handleBulkInsert(params: BulkInsertParams): Promise<void> {
    const validParams = this.validateParams(params, isBulkInsertParams, 'handleBulkInsert');
    this.ensureInitialized();

    return this.withContext('bulkInsert', async () => {
      // TODO: Implement efficient bulk insert
      // For now, use individual inserts
      for (const row of validParams.data) {
        const columns = Object.keys(row);
        const values = Object.values(row);
        const placeholders = columns.map(() => '?').join(', ');

        const sql = `INSERT INTO ${validParams.tableName} (${columns.join(', ')}) VALUES (${placeholders})`;
        await this.sqliteManager.select(sql, values);
      }

      this.logger.info(`Bulk inserted ${validParams.data.length} rows into ${validParams.tableName}`);
    });
  }

  // =============================================================================
  // Schema and Extension Operations
  // =============================================================================

  private async handleInitVecExtension(): Promise<void> {
    this.ensureInitialized();

    return this.withContext('initVecExtension', async () => {
      await this.sqliteManager.initVecExtension();
    });
  }

  private async handleInitializeSchema(): Promise<void> {
    this.ensureInitialized();

    return this.withContext('initializeSchema', async () => {
      await this.schemaManager.initializeSchema();
    });
  }

  private async handleGetCollectionInfo(name: string): Promise<CollectionInfo> {
    this.ensureInitialized();
    const collectionName = this.validateCollectionName(name, 'getCollectionInfo');

    return this.withContext('getCollectionInfo', async () => {
      return await this.schemaManager.getCollectionInfo(collectionName);
    });
  }

  private async handleCreateCollection(params: CreateCollectionParams): Promise<void> {
    const validParams = this.validateParams(params, isCreateCollectionParams, 'handleCreateCollection');
    this.ensureInitialized();

    return this.withContext('createCollection', async () => {
      await this.schemaManager.createCollection(
        validParams.name,
        validParams.dimensions || 384,
        validParams.config || {}
      );
    });
  }

  // =============================================================================
  // Embedding Operations (Simplified for demo)
  // =============================================================================

  private async handleGetCollectionEmbeddingStatus(collection: string): Promise<CollectionEmbeddingStatusResult> {
    // Simplified implementation
    return {
      collection,
      collectionId: collection,
      provider: 'local',
      model: 'all-MiniLM-L6-v2',
      dimensions: 384,
      documentsWithEmbeddings: 0,
      totalDocuments: 0,
      isReady: true,
      generationProgress: 1.0,
      lastUpdated: new Date(),
      configErrors: []
    };
  }

  private async handleInsertDocumentWithEmbedding(params: InsertDocumentWithEmbeddingParams): Promise<{ id: string; embeddingGenerated: boolean }> {
    // Simplified implementation
    const validParams = this.validateParams(params, isInsertDocumentWithEmbeddingParams, 'handleInsertDocumentWithEmbedding');
    this.ensureInitialized();

    return this.withContext('insertDocumentWithEmbedding', async () => {
      // Generate ID if not provided
      const documentId = validParams.document.id || `doc_${Date.now()}`;

      // Insert document
      const sql = `
        INSERT OR REPLACE INTO docs_default (id, title, content, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, strftime('%s', 'now'), strftime('%s', 'now'))
      `;

      const metadata = { ...validParams.document.metadata, collection: validParams.collection };
      await this.sqliteManager.select(sql, [
        documentId,
        validParams.document.title || '',
        validParams.document.content,
        JSON.stringify(metadata)
      ]);

      return { id: documentId, embeddingGenerated: false };
    });
  }

  private async handleGenerateEmbedding(params: GenerateEmbeddingRequest): Promise<GenerateEmbeddingResult> {
    // Simplified implementation
    const validParams = this.validateParams(params, isGenerateEmbeddingRequest, 'handleGenerateEmbedding');

    return {
      embedding: new Float32Array(384).fill(0.1), // Mock embedding
      dimensions: 384,
      generationTime: 100,
      cached: false,
      provider: 'local'
    };
  }

  private async handleBatchGenerateEmbeddings(params: BatchEmbeddingRequest): Promise<BatchEmbeddingResult> {
    // Simplified implementation
    const validParams = this.validateParams(params, isBatchEmbeddingRequest, 'handleBatchGenerateEmbeddings');

    return {
      success: validParams.documents.length,
      failed: 0,
      errors: [],
      processingTime: 100
    };
  }

  private async handleRegenerateCollectionEmbeddings(params: { collection: string; options?: any }): Promise<BatchEmbeddingResult> {
    // Simplified implementation
    return {
      success: 0,
      failed: 0,
      errors: [],
      processingTime: 0
    };
  }

  // =============================================================================
  // Queue Operations
  // =============================================================================

  private async handleEnqueueEmbedding(params: EnqueueEmbeddingParams): Promise<number> {
    const validParams = this.validateParams(params, isEnqueueEmbeddingParams, 'handleEnqueueEmbedding');
    this.ensureInitialized();

    return this.withContext('enqueueEmbedding', async () => {
      return await this.embeddingQueue.enqueue(validParams);
    });
  }

  private async handleProcessEmbeddingQueue(params: ProcessEmbeddingQueueParams = {}): Promise<ProcessEmbeddingQueueResult> {
    const validParams = this.validateParams(params, isProcessEmbeddingQueueParams, 'handleProcessEmbeddingQueue');
    this.ensureInitialized();

    return this.withContext('processEmbeddingQueue', async () => {
      // Simple mock embedding generator
      const embeddingGenerator = async (collection: string, content: string): Promise<Float32Array> => {
        return new Float32Array(384).fill(0.1);
      };

      return await this.embeddingQueue.processQueue(validParams, embeddingGenerator);
    });
  }

  private async handleGetQueueStatus(collection?: string): Promise<QueueStatusResult> {
    this.ensureInitialized();

    return this.withContext('getQueueStatus', async () => {
      return await this.embeddingQueue.getStatus(collection);
    });
  }

  private async handleClearEmbeddingQueue(params: ClearEmbeddingQueueParams = {}): Promise<number> {
    const validParams = this.validateParams(params, isClearEmbeddingQueueParams, 'handleClearEmbeddingQueue');
    this.ensureInitialized();

    return this.withContext('clearEmbeddingQueue', async () => {
      return await this.embeddingQueue.clearQueue(validParams);
    });
  }

  // =============================================================================
  // Search Operations (Simplified)
  // =============================================================================

  private async handleSearch(params: SearchRequest): Promise<SearchResponse> {
    this.ensureInitialized();
    const startTime = Date.now();

    try {
      const {
        query,
        collection = 'default',
        limit = 10,
        fusionMethod = 'rrf',
        fusionWeights = { fts: 0.6, vec: 0.4 }
      } = params;

      // Generate embedding if advanced mode enabled but no vector provided
      let searchQuery = { ...query };
      if (params.options?.enableEmbedding && query.text && !query.vector) {
        try {
          this.logger.info('Generating embedding for advanced search', { text: query.text });
          const embedding = await this.handleGenerateQueryEmbedding({
            query: query.text,
            collection
          });
          if (embedding.embedding) {
            searchQuery.vector = embedding.embedding;
            this.logger.info('Successfully generated query embedding');
          }
        } catch (embeddingError) {
          this.logger.warn('Failed to generate embedding, using text-only search', { embeddingError });
        }
      }

      this.logger.info(`Starting search - text: "${searchQuery.text || 'none'}", vector: ${searchQuery.vector ? 'provided' : 'none'}, collection: ${collection}`);

      // Handle different search scenarios
      let searchSQL: string;
      let searchParams: any[];

      if (searchQuery.text && searchQuery.vector) {
        // Hybrid search combining FTS and vector search
        this.logger.info('Performing hybrid text + vector search');

        searchSQL = `
          WITH fts_results AS (
            SELECT d.rowid, d.id, d.title, d.content, d.metadata,
                   bm25(fts_${collection}) as fts_score,
                   rank() OVER (ORDER BY bm25(fts_${collection})) as fts_rank
            FROM docs_${collection} d
            JOIN fts_${collection} f ON d.rowid = f.rowid
            WHERE fts_${collection} MATCH ?
            LIMIT ?
          ),
          vec_results AS (
            SELECT d.rowid, d.id, d.title, d.content, d.metadata,
                   v.distance as vec_score,
                   rank() OVER (ORDER BY v.distance) as vec_rank
            FROM docs_${collection} d
            JOIN (
              SELECT rowid, distance
              FROM vec_${collection}_dense
              WHERE embedding MATCH ?
              ORDER BY distance
              LIMIT ?
            ) v ON d.rowid = v.rowid
          )
          SELECT DISTINCT
            COALESCE(f.id, v.id) as id,
            COALESCE(f.title, v.title) as title,
            COALESCE(f.content, v.content) as content,
            COALESCE(f.metadata, v.metadata) as metadata,
            COALESCE(f.fts_score, 0) as fts_score,
            COALESCE(v.vec_score, 1) as vec_score,
            CASE
              WHEN ? = 'rrf' THEN
                (COALESCE(1.0/(60 + f.fts_rank), 0) + COALESCE(1.0/(60 + v.vec_rank), 0))
              ELSE
                (? * COALESCE(-f.fts_score, 0) + ? * COALESCE(1.0/(1.0 + v.vec_score), 0))
            END as score
          FROM fts_results f
          FULL OUTER JOIN vec_results v ON f.rowid = v.rowid
          ORDER BY score DESC
          LIMIT ?
        `;

        const vectorJson = JSON.stringify(Array.from(searchQuery.vector));
        searchParams = [
          searchQuery.text, limit,
          vectorJson, limit,
          fusionMethod,
          fusionWeights.fts, fusionWeights.vec,
          limit
        ];
      } else if (searchQuery.text) {
        // Text-only search
        this.logger.info('Performing text-only FTS search');

        // For multi-word queries, use OR
        const words = searchQuery.text.trim().split(/\s+/);
        const ftsQuery = words.length > 1 ? words.join(' OR ') : searchQuery.text;

        searchSQL = `
          SELECT d.id, d.title, d.content, d.metadata,
                 bm25(fts_${collection}) as fts_score,
                 0 as vec_score,
                 -bm25(fts_${collection}) as score
          FROM docs_${collection} d
          JOIN fts_${collection} f ON d.rowid = f.rowid
          WHERE fts_${collection} MATCH ?
          ORDER BY score DESC
          LIMIT ?
        `;

        searchParams = [ftsQuery, limit];
      } else if (searchQuery.vector) {
        // Vector-only search
        this.logger.info('Performing vector-only search');

        const vectorJson = JSON.stringify(Array.from(searchQuery.vector));
        searchSQL = `
          SELECT d.id, d.title, d.content, d.metadata,
                 0 as fts_score,
                 v.distance as vec_score,
                 1.0/(1.0 + v.distance) as score
          FROM docs_${collection} d
          JOIN (
            SELECT rowid, distance
            FROM vec_${collection}_dense
            WHERE embedding MATCH ?
            ORDER BY distance
            LIMIT ?
          ) v ON d.rowid = v.rowid
          ORDER BY v.distance
        `;

        searchParams = [vectorJson, limit];
      } else {
        throw new DatabaseError('Search requires either text or vector query');
      }

      this.logger.info(`Executing search SQL with ${searchParams.length} parameters`);

      const searchResult = await this.sqliteManager.select(searchSQL, searchParams);

      const results: SearchResult[] = searchResult.rows.map(row => ({
        id: row.id,
        title: row.title,
        content: row.content,
        metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        score: row.score,
        ftsScore: row.fts_score,
        vecScore: row.vec_score
      }));

      const searchTime = Date.now() - startTime;
      this.operationCount++;

      this.logger.debug(`Search completed in ${searchTime}ms, found ${results.length} results`);

      return {
        results,
        totalResults: results.length,
        searchTime
      };

    } catch (error) {
      this.logger.error('Search failed', { error });
      return {
        results: [],
        totalResults: 0,
        searchTime: Date.now() - startTime
      };
    }
  }

  private async handleSearchSemantic(params: SemanticSearchParams): Promise<SearchResponse> {
    // Simplified implementation
    return {
      results: [],
      totalResults: 0,
      searchTime: 5
    };
  }

  // Enhanced Search API (Task 6.1)
  // Note: These methods are placeholders for future enhanced search implementation
  private async handleSearchText(params: TextSearchParams): Promise<EnhancedSearchResponse> {
    this.ensureInitialized();
    return this.withContext('searchText', async () => {
      // Fallback to regular search for now
      const searchResult = await this.handleSearch({
        query: { text: params.query },
        collection: params.options?.collection || 'default',
        limit: params.options?.limit || 10
      });

      return {
        results: searchResult.results,
        searchTime: searchResult.searchTime,
        strategy: 'fts'
      };
    });
  }

  private async handleSearchAdvanced(params: AdvancedSearchParams): Promise<EnhancedSearchResponse> {
    this.ensureInitialized();
    return this.withContext('searchAdvanced', async () => {
      // Fallback to regular search
      const searchResult = await this.handleSearch({
        query: params.query,
        collection: params.options?.collection || 'default',
        limit: params.options?.limit || 10
      });

      return {
        results: searchResult.results,
        searchTime: searchResult.searchTime,
        strategy: 'hybrid'
      };
    });
  }

  private async handleSearchGlobal(params: GlobalSearchParams): Promise<GlobalSearchResponse> {
    this.ensureInitialized();
    return this.withContext('searchGlobal', async () => {
      // Simple implementation - search across all collections
      const searchResult = await this.handleSearch({
        query: { text: params.query },
        limit: params.options?.limit || 10
      });

      return {
        resultsByCollection: {
          default: searchResult.results
        },
        totalResults: searchResult.results.length,
        searchTime: searchResult.searchTime
      };
    });
  }

  // =============================================================================
  // Import/Export Operations
  // =============================================================================

  private async handleExport(params?: ExportParams): Promise<Uint8Array> {
    this.ensureInitialized();

    return this.withContext('export', async () => {
      return await this.sqliteManager.serialize();
    });
  }

  private async handleImport(params: ImportParams): Promise<void> {
    const validParams = this.validateParams(params, isImportParams, 'handleImport');
    this.ensureInitialized();

    return this.withContext('import', async () => {
      const data = params.data instanceof ArrayBuffer ? new Uint8Array(params.data) : params.data;
      await this.sqliteManager.deserialize(data);

      // Reinitialize schema if needed
      await this.schemaManager.initializeSchema();
    });
  }

  private async handleClear(): Promise<void> {
    this.ensureInitialized();

    return this.withContext('clear', async () => {
      // Clear OPFS data
      await this.opfsManager.clearDatabase();

      // Reinitialize schema
      await this.schemaManager.initializeSchema();
    });
  }

  // =============================================================================
  // Utility Operations
  // =============================================================================

  private async handlePing(): Promise<{ status: string; timestamp: number }> {
    return {
      status: this.isInitialized ? 'ready' : 'not_initialized',
      timestamp: Date.now()
    };
  }

  private async handleGetVersion(): Promise<{ sqlite: string; vec: string; sdk: string }> {
    return {
      sqlite: this.sqliteManager.getVersion(),
      vec: 'available',
      sdk: '1.0.0'
    };
  }

  private async handleGetStats(): Promise<{ memory: number; dbSize: number; operations: number }> {
    const uptime = Date.now() - this.startTime;

    return {
      memory: 0, // Not easily available in worker context
      dbSize: 0, // Would need to calculate
      operations: this.sqliteManager.getOperationCount()
    };
  }

  // =============================================================================
  // Helper Methods
  // Task 6.2: Internal Embedding Pipeline Handlers
  // =============================================================================

  private async handleGenerateQueryEmbedding(params: GenerateQueryEmbeddingParams): Promise<QueryEmbeddingResult> {
    this.ensureInitialized();
    return this.withContext('generateQueryEmbedding', async () => {
      // Use SearchHandler with existing ProviderManager
      const embedding = await this.searchHandler.generateEmbeddingWithProvider(
        this.providerManager,
        params.query,
        params.collection
      );

      return {
        embedding,
        dimensions: embedding.length,
        model: 'Xenova/all-MiniLM-L6-v2'
      };
    });
  }

  private async handleBatchGenerateQueryEmbeddings(params: BatchGenerateQueryEmbeddingsParams): Promise<BatchQueryEmbeddingResult[]> {
    this.ensureInitialized();
    return this.withContext('batchGenerateQueryEmbeddings', async () => {
      // Simple batch processing - generate embeddings sequentially
      const results: BatchQueryEmbeddingResult[] = [];

      for (const request of params.requests) {
        try {
          const embedding = await this.searchHandler.generateEmbeddingWithProvider(
            this.providerManager,
            request.query,
            request.collection
          );

          results.push({
            query: request.query,
            embedding,
            dimensions: embedding.length,
            model: 'Xenova/all-MiniLM-L6-v2',
            success: true
          });
        } catch (error) {
          results.push({
            query: request.query,
            embedding: new Float32Array(),
            dimensions: 0,
            model: 'Xenova/all-MiniLM-L6-v2',
            success: false,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      return results;
    });
  }

  private async handleWarmEmbeddingCache(params: WarmEmbeddingCacheParams): Promise<void> {
    this.ensureInitialized();
    return this.withContext('warmEmbeddingCache', async () => {
      // Use the SearchHandler's warmEmbeddingCache method
      return await this.searchHandler.warmEmbeddingCache(params.collection, params.commonQueries);
    });
  }

  private async handleClearEmbeddingCache(params?: ClearEmbeddingCacheParams): Promise<void> {
    this.ensureInitialized();
    return this.withContext('clearEmbeddingCache', async () => {
      const embeddingPipeline = (this.searchHandler as any).embeddingPipeline;

      if (!embeddingPipeline) {
        this.logger.warn('Embedding pipeline not available for cache clearing');
        return;
      }

      await (this.searchHandler as any).pipelineInitialized;

      if (params?.pattern) {
        // TODO: Implement pattern-based cache clearing
        this.logger.warn('Pattern-based cache clearing not yet implemented');
      } else {
        await embeddingPipeline.clearCache(params?.collection);
      }
    });
  }

  private async handleGetPipelineStats(): Promise<PipelinePerformanceStats> {
    this.ensureInitialized();
    return this.withContext('getPipelineStats', async () => {
      const embeddingPipeline = (this.searchHandler as any).embeddingPipeline;

      if (!embeddingPipeline) {
        // Return empty stats if pipeline not available
        return {
          totalRequests: 0,
          cacheHitRate: 0,
          averageGenerationTime: 0,
          activeModels: 0,
          memoryUsage: 0,
          cacheStats: {
            memory: { hits: 0, misses: 0 },
            indexedDB: { hits: 0, misses: 0 },
            database: { hits: 0, misses: 0 }
          }
        };
      }

      await (this.searchHandler as any).pipelineInitialized;
      return embeddingPipeline.getPerformanceStats();
    });
  }

  private async handleGetModelStatus(): Promise<ModelStatusResult> {
    this.ensureInitialized();
    return this.withContext('getModelStatus', async () => {
      const modelManager = (this.searchHandler as any).modelManager;

      if (!modelManager) {
        // Return empty status if model manager not available
        return {
          loadedModels: [],
          totalMemoryUsage: 0,
          activeCount: 0,
          providerStats: {}
        };
      }

      await (this.searchHandler as any).pipelineInitialized;
      const modelStatus = modelManager.getModelStatus();

      // Convert to the expected format
      return {
        loadedModels: modelStatus.loadedModels.map((model: any) => ({
          modelId: model.modelId,
          provider: model.provider,
          modelName: model.modelName,
          dimensions: model.dimensions,
          memoryUsage: model.memoryUsage,
          lastUsed: model.lastUsed,
          usageCount: model.usageCount,
          status: model.status
        })),
        totalMemoryUsage: modelStatus.totalMemoryUsage,
        activeCount: modelStatus.activeCount,
        providerStats: modelStatus.providerStats
      };
    });
  }

  private async handlePreloadModels(params: PreloadModelsParams): Promise<void> {
    this.ensureInitialized();
    return this.withContext('preloadModels', async () => {
      const modelManager = (this.searchHandler as any).modelManager;

      if (!modelManager) {
        this.logger.warn('Model manager not available for preloading');
        return;
      }

      await (this.searchHandler as any).pipelineInitialized;
      await modelManager.preloadModels(params.strategy || 'lazy');
    });
  }

  private async handleOptimizeModelMemory(params?: OptimizeModelMemoryParams): Promise<void> {
    this.ensureInitialized();
    return this.withContext('optimizeModelMemory', async () => {
      const modelManager = (this.searchHandler as any).modelManager;

      if (!modelManager) {
        this.logger.warn('Model manager not available for memory optimization');
        return;
      }

      await (this.searchHandler as any).pipelineInitialized;
      await modelManager.optimizeMemory(params);
    });
  }

  // =============================================================================
  // LLM Operations (SCRUM-17)
  // =============================================================================

  private async handleEnhanceQuery(params: EnhanceQueryParams): Promise<EnhancedQueryResult> {
    this.ensureInitialized();
    return this.withContext('enhanceQuery', async () => {
      const config: import('../../../llm/types.js').LLMProviderConfig = {
        provider: (params.options?.provider as any) || 'openai',
        model: params.options?.model || 'gpt-4',
        apiKey: params.options?.apiKey,
        endpoint: params.options?.endpoint,
        temperature: params.options?.temperature,
        timeout: params.options?.timeout
      };

      return await this.llmManager.enhanceQuery(params.query, config, params.options);
    });
  }

  private async handleSummarizeResults(params: SummarizeResultsParams): Promise<ResultSummaryResult> {
    this.ensureInitialized();
    return this.withContext('summarizeResults', async () => {
      const config: import('../../../llm/types.js').LLMProviderConfig = {
        provider: (params.options?.provider as any) || 'openai',
        model: params.options?.model || 'gpt-4',
        apiKey: params.options?.apiKey,
        endpoint: params.options?.endpoint,
        temperature: params.options?.temperature,
        timeout: params.options?.timeout
      };

      return await this.llmManager.summarizeResults(params.results, config, params.options);
    });
  }

  private async handleSearchWithLLM(params: SearchWithLLMParams): Promise<LLMSearchResponseResult> {
    this.ensureInitialized();
    return this.withContext('searchWithLLM', async () => {
      const startTime = Date.now();
      let enhancedQuery: EnhancedQueryResult | undefined;
      let llmTime = 0;

      // Step 1: Enhance query if requested
      if (params.options?.enhanceQuery) {
        const enhanceStart = Date.now();
        const config: import('../../../llm/types.js').LLMProviderConfig = {
          provider: (params.options.llmOptions?.provider as any) || 'openai',
          model: params.options.llmOptions?.model || 'gpt-4',
          apiKey: params.options.llmOptions?.apiKey,
          endpoint: params.options.llmOptions?.endpoint,
          temperature: params.options.llmOptions?.temperature
        };
        enhancedQuery = await this.llmManager.enhanceQuery(params.query, config);
        llmTime += Date.now() - enhanceStart;
      }

      // Step 2: Execute search with enhanced query
      const searchQuery = enhancedQuery?.enhancedQuery || params.query;
      const searchStart = Date.now();
      const searchResponse = await this.handleSearchText({
        query: searchQuery,
        options: params.options?.searchOptions
      });
      const searchTime = Date.now() - searchStart;

      // Step 3: Summarize results if requested
      let summary: ResultSummaryResult | undefined;
      if (params.options?.summarizeResults && searchResponse.results.length > 0) {
        const summaryStart = Date.now();
        const config: import('../../../llm/types.js').LLMProviderConfig = {
          provider: (params.options.llmOptions?.provider as any) || 'openai',
          model: params.options.llmOptions?.model || 'gpt-4',
          apiKey: params.options.llmOptions?.apiKey,
          endpoint: params.options.llmOptions?.endpoint,
          temperature: params.options.llmOptions?.temperature
        };
        summary = await this.llmManager.summarizeResults(searchResponse.results, config);
        llmTime += Date.now() - summaryStart;
      }

      return {
        results: searchResponse.results,
        enhancedQuery,
        summary,
        searchTime,
        llmTime,
        totalTime: Date.now() - startTime
      };
    });
  }

  private async handleCallLLM(params: import('../../../types/worker.js').CallLLMParams): Promise<import('../../../types/worker.js').CallLLMResult> {
    this.ensureInitialized();
    return this.withContext('callLLM', async () => {
      const config: import('../../../llm/types.js').LLMProviderConfig = {
        provider: (params.options?.provider as any) || 'openai',
        model: params.options?.model || 'gpt-4',
        apiKey: params.options?.apiKey,
        endpoint: params.options?.endpoint,
        temperature: params.options?.temperature,
        maxTokens: params.options?.maxTokens,
        timeout: params.options?.timeout
      };

      const result = await this.llmManager.callLLM(params.prompt, config, params.options);

      return {
        text: result.text,
        finishReason: result.finishReason as 'stop' | 'length' | 'error' | 'timeout',
        usage: result.usage,
        model: result.model,
        provider: result.provider,
        processingTime: result.processingTime
      };
    });
  }

  // =============================================================================
  // Helper Methods
  // =============================================================================

  private validateParams<T>(
    params: any,
    typeGuard: (params: any) => params is T,
    methodName: string
  ): T {
    if (!typeGuard(params)) {
      throw new Error(`Invalid parameters for ${methodName}: ${JSON.stringify(params)}`);
    }
    return params;
  }

  private validateCollectionName(name: any, methodName: string): string {
    if (typeof name !== 'string' || name.length === 0) {
      throw new Error(`Invalid collection name for ${methodName}: must be a non-empty string`);
    }
    return name;
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('Database not initialized - call open() first');
    }
  }

  private async withContext<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    return ErrorHandler.withContext(operation, 'DatabaseWorker', fn);
  }
}