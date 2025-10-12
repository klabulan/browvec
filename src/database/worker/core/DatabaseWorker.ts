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
  private operationCount = 0;

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
    this.rpcHandler.register('batchInsertDocuments', this.handleBatchInsertDocuments.bind(this));

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

      // Configure SQLite for browser environment (prevent "database or disk is full" errors)
      // CRITICAL FIX: Reduced cache_size to fit in 16MB WASM heap (was -64000/64MB, causing malloc failures)
      // CRITICAL FIX: Changed journal_mode to DELETE (disk-based) to reduce memory pressure
      await this.sqliteManager.exec('PRAGMA temp_store = MEMORY');          // Store temp tables in memory
      await this.sqliteManager.exec('PRAGMA cache_size = -8000');           // 8MB cache (fits in 16MB heap)
      await this.sqliteManager.exec('PRAGMA synchronous = NORMAL');         // Balance performance/durability
      await this.sqliteManager.exec('PRAGMA journal_mode = DELETE');        // Disk-based journal (OPFS)
      this.logger.info('SQLite PRAGMAs configured for WASM environment (8MB cache, disk journal)');

      // Initialize sqlite-vec extension
      await this.sqliteManager.initVecExtension();

      // Apply pending OPFS data if available
      const pendingData = this.opfsManager.getPendingDatabaseData();
      if (pendingData) {
        this.logger.info('Restoring database from OPFS data');
        await this.sqliteManager.deserialize(pendingData);
        this.opfsManager.clearPendingDatabaseData();
        this.logger.info('Database restored from OPFS successfully');

        // CRITICAL: Force correct PRAGMAs after restore (overrides old settings from OPFS)
        await this.sqliteManager.exec('PRAGMA cache_size = -8000');           // 8MB cache
        await this.sqliteManager.exec('PRAGMA journal_mode = DELETE');        // Disk-based journal
        this.logger.info('PRAGMAs enforced after OPFS restore (8MB cache, disk journal)');

        // Verify database integrity after deserialization
        try {
          await this.sqliteManager.exec('SELECT 1');
          this.logger.info('Database connection verified after restore');
        } catch (error) {
          this.logger.error('Database connection invalid after restore, reopening...', { error });
          // Close and reopen the connection
          this.sqliteManager.closeDatabase();
          await this.sqliteManager.openDatabase(dbPath);

          // Reapply PRAGMAs after reopening (CRITICAL: Use same settings as initial open)
          await this.sqliteManager.exec('PRAGMA temp_store = MEMORY');
          await this.sqliteManager.exec('PRAGMA cache_size = -8000');           // 8MB cache (fits in 16MB heap)
          await this.sqliteManager.exec('PRAGMA synchronous = NORMAL');
          await this.sqliteManager.exec('PRAGMA journal_mode = DELETE');        // Disk-based journal

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

  private async handleInsertDocumentWithEmbedding(
    params: InsertDocumentWithEmbeddingParams,
    skipFtsSync: boolean = false
  ): Promise<{ id: string; embeddingGenerated: boolean }> {
    const validParams = this.validateParams(params, isInsertDocumentWithEmbeddingParams, 'handleInsertDocumentWithEmbedding');
    this.ensureInitialized();

    return this.withContext('insertDocumentWithEmbedding', async () => {
      // STEP 1: Validate document structure
      const { validateDocument, generateDocumentId, sanitizeDocumentId } = await import('../utils/Validation.js');
      const { DocumentInsertError } = await import('../utils/Errors.js');

      this.logger.debug(`[InsertDoc] Validating document for collection: ${validParams.collection}`);
      validateDocument(validParams.document, validParams.collection);

      // STEP 2: Generate or sanitize document ID
      const documentId = validParams.document.id
        ? sanitizeDocumentId(validParams.document.id)
        : generateDocumentId();

      this.logger.debug(`[InsertDoc] Document ID: ${documentId}, content length: ${(validParams.document.content || '').length}`);

      // STEP 3: Prepare user metadata (NO INJECTION - pure user data)
      const userMetadata = validParams.document.metadata || {};
      const metadataJson = JSON.stringify(userMetadata);

      this.logger.debug(`[InsertDoc] Metadata size: ${metadataJson.length} bytes`);

      // STEP 4: Insert document with collection in separate column
      const sql = `
        INSERT OR REPLACE INTO docs_default (id, title, content, collection, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, strftime('%s', 'now'), strftime('%s', 'now'))
      `;

      this.logger.debug(`[InsertDoc] Executing INSERT for document: ${documentId}`);

      try {
        await this.sqliteManager.exec(sql, [
          documentId,
          validParams.document.title || '',
          validParams.document.content || '',
          validParams.collection,           // ✅ Separate column for collection
          metadataJson                       // ✅ Pure user metadata
        ]);
        this.logger.debug(`[InsertDoc] ✓ INSERT completed for document: ${documentId}`);
      } catch (error) {
        this.logger.error(`[InsertDoc] ✗ INSERT failed for document: ${documentId} - ${error instanceof Error ? error.message : String(error)}`);
        throw new DocumentInsertError(
          `Failed to insert document into collection '${validParams.collection}'`,
          {
            collection: validParams.collection,
            documentId,
            providedFields: Object.keys(validParams.document),
            originalError: error instanceof Error ? error : undefined,
            suggestion: 'Check that document structure matches schema and ID is unique'
          }
        );
      }

      // STEP 5: Verify insertion (post-insert verification)
      this.logger.debug(`[InsertDoc] Verifying insertion for document: ${documentId}`);
      const verifyResult = await this.sqliteManager.select(
        'SELECT COUNT(*) as count FROM docs_default WHERE id = ? AND collection = ?',
        [documentId, validParams.collection]
      );

      const insertedCount = verifyResult.rows[0]?.count || 0;
      if (insertedCount === 0) {
        this.logger.error(`[InsertDoc] ✗ Verification failed: document ${documentId} not found in database`);
        throw new DocumentInsertError(
          `Document insertion verification failed: id='${documentId}' was not found in database`,
          {
            collection: validParams.collection,
            documentId,
            providedFields: Object.keys(validParams.document),
            suggestion:
              'This may be caused by:\n' +
              '  1) Unique constraint violation (duplicate ID)\n' +
              '  2) Database connection issue\n' +
              '  3) Transaction rollback\n' +
              'Check database logs for details.'
          }
        );
      }

      this.logger.info(`Document inserted successfully: ${documentId} in collection ${validParams.collection}`);

      // STEP 5.5: Manually sync FTS5 (no automatic triggers to avoid memory exhaustion)
      // Skip FTS5 sync if requested (e.g., during batch processing)
      if (!skipFtsSync) {
        this.logger.debug(`[InsertDoc] Syncing FTS5 index for document: ${documentId}`);
        try {
          // Get rowid for FTS5
          const rowidResult = await this.sqliteManager.select(
            'SELECT rowid FROM docs_default WHERE id = ? AND collection = ?',
            [documentId, validParams.collection]
          );

          if (rowidResult.rows.length > 0) {
            const rowid = rowidResult.rows[0].rowid;

            // Manually insert into FTS5
            await this.sqliteManager.exec(
              'INSERT INTO fts_default(rowid, title, content, metadata) VALUES (?, ?, ?, ?)',
              [rowid, validParams.document.title || '', validParams.document.content || '', metadataJson]
            );

            this.logger.debug(`[InsertDoc] ✓ FTS5 sync completed for document: ${documentId} (rowid: ${rowid})`);
          }
        } catch (ftsError) {
          // Log FTS5 error but don't fail the insert - document is already in docs_default
          this.logger.warn(`[InsertDoc] FTS5 sync failed for document ${documentId}, search may not work: ${ftsError instanceof Error ? ftsError.message : String(ftsError)}`);
        }
      } else {
        this.logger.debug(`[InsertDoc] Skipping FTS5 sync for document: ${documentId} (batch mode)`);
      }

      // STEP 6: Return accurate result
      return { id: documentId, embeddingGenerated: false };
    });
  }

  /**
   * Calculate optimal batch size based on document sizes and available cache
   *
   * FTS5 defers index building until COMMIT, which can exceed memory limits.
   * This calculates safe batch size to avoid "database full" on commit.
   */
  private async calculateOptimalBatchSize(documents: Array<any>): Promise<number> {
    try {
      // Get current cache size (in KB if negative, in pages if positive)
      const cacheResult = await this.sqliteManager.select('PRAGMA cache_size');
      const cacheSize = cacheResult.rows[0]?.cache_size || -64000; // Default 64MB

      // Convert to KB
      const cacheKB = cacheSize < 0 ? Math.abs(cacheSize) : cacheSize * 4; // 4KB page size

      // Use 25% of cache for batch (leave room for FTS5 overhead, temp data, etc.)
      const availableKB = cacheKB * 0.25;
      const availableBytes = availableKB * 1024;

      // Calculate average document size
      let totalSize = 0;
      const sampleSize = Math.min(10, documents.length); // Sample first 10 docs

      for (let i = 0; i < sampleSize; i++) {
        const doc = documents[i];
        const contentSize = (doc.content || '').length;
        const titleSize = (doc.title || '').length;
        const metadataSize = JSON.stringify(doc.metadata || {}).length;

        // FTS5 overhead: ~3-5x content size for tokenization + index
        const ftsOverhead = contentSize * 4;

        totalSize += contentSize + titleSize + metadataSize + ftsOverhead;
      }

      const avgDocSize = totalSize / sampleSize;

      // Calculate how many docs fit in available memory
      let batchSize = Math.floor(availableBytes / avgDocSize);

      // Apply limits
      const MIN_BATCH = 5;   // Always do at least 5
      const MAX_BATCH = 50;  // Never more than 50 (safety)

      batchSize = Math.max(MIN_BATCH, Math.min(MAX_BATCH, batchSize));

      this.logger.debug(`Batch size calculation: cache=${cacheKB}KB, available=${availableKB.toFixed(0)}KB, avgDocSize=${(avgDocSize/1024).toFixed(1)}KB, batchSize=${batchSize}`);

      return batchSize;

    } catch (error) {
      // Fallback to conservative batch size
      this.logger.warn('Failed to calculate optimal batch size, using default: 10', { error });
      return 10;
    }
  }

  /**
   * Batch insert documents with WORKER-SIDE transaction management
   *
   * CRITICAL: Transaction MUST be on worker side where actual inserts happen!
   * Main thread and worker have SEPARATE SQLite connections.
   *
   * Uses adaptive batching to avoid FTS5 memory limits during COMMIT.
   */
  private async handleBatchInsertDocuments(params: {
    collection: string;
    documents: Array<{
      id?: string;
      title?: string;
      content: string;
      metadata?: Record<string, any>;
    }>;
    options?: {
      generateEmbedding?: boolean;
      embeddingOptions?: any;
    };
  }): Promise<Array<{ id: string; embeddingGenerated: boolean }>> {
    this.ensureInitialized();

    return this.withContext('batchInsertDocuments', async () => {
      const { collection, documents, options } = params;

      this.logger.info(`[BatchInsert] === BATCH INSERT STARTED ===`);
      this.logger.info(`[BatchInsert] Collection: ${collection}`);
      this.logger.info(`[BatchInsert] Total documents: ${documents.length}`);
      this.logger.info(`[BatchInsert] Options: ${JSON.stringify(options)}`);

      if (!documents || documents.length === 0) {
        this.logger.warn(`[BatchInsert] No documents to insert, returning empty array`);
        return [];
      }

      // Log document size statistics
      const docSizes = documents.map(d => ({
        contentLength: (d.content || '').length,
        titleLength: (d.title || '').length,
        metadataSize: JSON.stringify(d.metadata || {}).length,
        id: d.id || 'auto-generated'
      }));
      const totalContentSize = docSizes.reduce((sum, d) => sum + d.contentLength, 0);
      const avgContentSize = totalContentSize / documents.length;
      const maxContentSize = Math.max(...docSizes.map(d => d.contentLength));
      const minContentSize = Math.min(...docSizes.map(d => d.contentLength));

      this.logger.info(`[BatchInsert] Document sizes: avg=${avgContentSize.toFixed(0)} bytes, min=${minContentSize}, max=${maxContentSize}, total=${totalContentSize} bytes`);

      // Single document - no transaction overhead needed
      if (documents.length === 1) {
        this.logger.info(`[BatchInsert] Single document, using direct insert without batching`);
        const result = await this.handleInsertDocumentWithEmbedding({
          collection,
          document: documents[0],
          options
        });
        this.logger.info(`[BatchInsert] === BATCH INSERT COMPLETED (1 document) ===`);
        return [result];
      }

      // Calculate optimal batch size based on document sizes and cache
      this.logger.info(`[BatchInsert] Calculating optimal batch size...`);
      const BATCH_SIZE = await this.calculateOptimalBatchSize(documents);
      const results: Array<{ id: string; embeddingGenerated: boolean }> = [];
      const totalBatches = Math.ceil(documents.length / BATCH_SIZE);

      this.logger.info(`[BatchInsert] Batch size: ${BATCH_SIZE}, total batches: ${totalBatches}`);
      this.logger.info(`[BatchInsert] Starting batch insert of ${documents.length} documents in collection ${collection} (adaptive batch size: ${BATCH_SIZE})`);

      try {
        // Process in batches to avoid FTS5 index memory issues during COMMIT
        for (let i = 0; i < documents.length; i += BATCH_SIZE) {
          const batch = documents.slice(i, i + BATCH_SIZE);
          const batchNum = Math.floor(i / BATCH_SIZE) + 1;
          const batchStartIdx = i;
          const batchEndIdx = Math.min(i + BATCH_SIZE, documents.length);

          this.logger.info(`[BatchInsert] ========================================`);
          this.logger.info(`[BatchInsert] Processing batch ${batchNum}/${totalBatches}`);
          this.logger.info(`[BatchInsert] Batch range: documents ${batchStartIdx + 1}-${batchEndIdx} of ${documents.length}`);
          this.logger.info(`[BatchInsert] Batch size: ${batch.length} documents`);

          // Log batch content stats
          const batchTotalSize = batch.reduce((sum, d) => sum + (d.content || '').length, 0);
          this.logger.info(`[BatchInsert] Batch total content size: ${batchTotalSize} bytes (${(batchTotalSize/1024).toFixed(1)}KB)`);

          // BEGIN TRANSACTION for this batch
          this.logger.debug(`[BatchInsert] Executing: BEGIN IMMEDIATE TRANSACTION`);
          await this.sqliteManager.exec('BEGIN IMMEDIATE TRANSACTION');
          this.logger.info(`[BatchInsert] Transaction started for batch ${batchNum}`);

          try {
            // Insert all documents in this batch (skip FTS5 sync to avoid memory exhaustion)
            this.logger.info(`[BatchInsert] Inserting ${batch.length} documents...`);
            for (let docIdx = 0; docIdx < batch.length; docIdx++) {
              const document = batch[docIdx];
              const globalDocIdx = batchStartIdx + docIdx;

              this.logger.debug(`[BatchInsert] Inserting document ${globalDocIdx + 1}/${documents.length} (${docIdx + 1}/${batch.length} in batch)`);
              this.logger.debug(`[BatchInsert] Document ID: ${document.id || 'auto'}, content length: ${(document.content || '').length}`);

              const result = await this.handleInsertDocumentWithEmbedding({
                collection,
                document,
                options
              }, true); // Skip FTS5 sync during transaction

              results.push(result);
              this.logger.debug(`[BatchInsert] Document inserted: ${result.id}`);
            }

            this.logger.info(`[BatchInsert] All ${batch.length} documents inserted in batch ${batchNum}, attempting COMMIT...`);

            // COMMIT this batch (documents only, NO FTS5 yet)
            this.logger.debug(`[BatchInsert] Executing: COMMIT`);
            await this.sqliteManager.exec('COMMIT');

            this.logger.info(`[BatchInsert] ✓ Batch ${batchNum}/${totalBatches} COMMITTED successfully`);
            this.logger.info(`[BatchInsert] Progress: ${results.length}/${documents.length} documents inserted`);

            // STEP: Sync FTS5 separately in small batches (e.g., 10 at a time)
            this.logger.info(`[BatchInsert] Syncing FTS5 for batch ${batchNum} (${batch.length} documents)...`);
            const FTS_BATCH_SIZE = 10;
            const ftsSubBatches = Math.ceil(batch.length / FTS_BATCH_SIZE);

            for (let ftsIdx = 0; ftsIdx < batch.length; ftsIdx += FTS_BATCH_SIZE) {
              const ftsSubBatch = batch.slice(ftsIdx, ftsIdx + FTS_BATCH_SIZE);
              const ftsBatchNum = Math.floor(ftsIdx / FTS_BATCH_SIZE) + 1;

              this.logger.debug(`[BatchInsert] FTS5 sub-batch ${ftsBatchNum}/${ftsSubBatches} (${ftsSubBatch.length} documents)`);

              // Begin transaction for FTS5 batch
              await this.sqliteManager.exec('BEGIN TRANSACTION');

              try {
                for (const document of ftsSubBatch) {
                  // Get document ID (it was generated during insert)
                  const docId = results.find(r => {
                    const doc = document as any;
                    return doc.id ? r.id === doc.id : true; // Match by ID if available
                  })?.id;

                  if (docId) {
                    // Get rowid and sync to FTS5
                    const rowidResult = await this.sqliteManager.select(
                      'SELECT rowid FROM docs_default WHERE id = ? AND collection = ?',
                      [docId, collection]
                    );

                    if (rowidResult.rows.length > 0) {
                      const rowid = rowidResult.rows[0].rowid;
                      const metadataJson = JSON.stringify(document.metadata || {});

                      await this.sqliteManager.exec(
                        'INSERT INTO fts_default(rowid, title, content, metadata) VALUES (?, ?, ?, ?)',
                        [rowid, document.title || '', document.content || '', metadataJson]
                      );
                    }
                  }
                }

                // Commit FTS5 batch
                await this.sqliteManager.exec('COMMIT');
                this.logger.debug(`[BatchInsert] ✓ FTS5 sub-batch ${ftsBatchNum} committed`);

              } catch (ftsError) {
                // Rollback FTS5 batch on error
                try {
                  await this.sqliteManager.exec('ROLLBACK');
                } catch {}
                this.logger.warn(`[BatchInsert] FTS5 sync failed for sub-batch ${ftsBatchNum}: ${ftsError instanceof Error ? ftsError.message : String(ftsError)}`);
                // Don't throw - FTS5 failure shouldn't fail the whole batch
              }
            }

            this.logger.info(`[BatchInsert] ✓ FTS5 sync completed for batch ${batchNum}`);

          } catch (batchError) {
            this.logger.error(`[BatchInsert] ✗ Batch ${batchNum} FAILED during insert or commit`);
            this.logger.error(`[BatchInsert] Error type: ${batchError instanceof Error ? batchError.constructor.name : typeof batchError}`);
            this.logger.error(`[BatchInsert] Error message: ${batchError instanceof Error ? batchError.message : String(batchError)}`);
            this.logger.error(`[BatchInsert] Documents inserted in failed batch before error: ${results.length - batchStartIdx}`);

            // ROLLBACK this batch only
            try {
              this.logger.debug(`[BatchInsert] Attempting ROLLBACK...`);
              await this.sqliteManager.exec('ROLLBACK');
              this.logger.info(`[BatchInsert] Transaction rolled back for batch ${batchNum}`);
            } catch (rollbackError) {
              this.logger.warn(`[BatchInsert] ROLLBACK failed (transaction may have auto-rolled back): ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}`);
              // Ignore rollback errors (transaction may have auto-rolled back)
            }

            // Re-throw to stop further batches
            this.logger.error(`[BatchInsert] Stopping batch processing due to error in batch ${batchNum}`);
            throw batchError;
          }
        }

        this.logger.info(`[BatchInsert] ========================================`);
        this.logger.info(`[BatchInsert] ✓ ALL BATCHES COMPLETED SUCCESSFULLY`);
        this.logger.info(`[BatchInsert] Total documents inserted: ${results.length}/${documents.length}`);
        this.logger.info(`[BatchInsert] === BATCH INSERT COMPLETED ===`);
        return results;

      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const errorDetails = {
          documentsAttempted: documents.length,
          documentsInserted: results.length,
          documentsFailed: documents.length - results.length,
          failurePoint: `document ${results.length + 1}`,
          errorMessage: message,
          collection
        };

        this.logger.error(`[BatchInsert] === BATCH INSERT FAILED ===`);
        this.logger.error(`[BatchInsert] Error details: ${JSON.stringify(errorDetails, null, 2)}`);

        throw new Error(`Batch insert failed at document ${results.length + 1}/${documents.length}: ${message}`);
      }
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
      const anyParams = params as any;
      if (anyParams.options?.enableEmbedding && query.text && !query.vector) {
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
                   bm25(fts_default) as fts_score,
                   rank() OVER (ORDER BY bm25(fts_default)) as fts_rank
            FROM docs_default d
            JOIN fts_default f ON d.rowid = f.rowid
            WHERE d.collection = ? AND fts_default MATCH ?
            LIMIT ?
          ),
          vec_results AS (
            SELECT d.rowid, d.id, d.title, d.content, d.metadata,
                   v.distance as vec_score,
                   rank() OVER (ORDER BY v.distance) as vec_rank
            FROM docs_default d
            JOIN (
              SELECT rowid, distance
              FROM vec_default_dense
              WHERE embedding MATCH ?
              ORDER BY distance
              LIMIT ?
            ) v ON d.rowid = v.rowid
            WHERE d.collection = ?
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
          collection, searchQuery.text, limit,
          vectorJson, limit,
          collection,
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
                 bm25(fts_default) as fts_score,
                 0 as vec_score,
                 -bm25(fts_default) as score
          FROM docs_default d
          JOIN fts_default f ON d.rowid = f.rowid
          WHERE d.collection = ? AND fts_default MATCH ?
          ORDER BY score DESC
          LIMIT ?
        `;

        searchParams = [collection, ftsQuery, limit];
      } else if (searchQuery.vector) {
        // Vector-only search
        this.logger.info('Performing vector-only search');

        const vectorJson = JSON.stringify(Array.from(searchQuery.vector));
        searchSQL = `
          SELECT d.id, d.title, d.content, d.metadata,
                 0 as fts_score,
                 v.distance as vec_score,
                 1.0/(1.0 + v.distance) as score
          FROM docs_default d
          JOIN (
            SELECT rowid, distance
            FROM vec_default_dense
            WHERE embedding MATCH ?
            ORDER BY distance
            LIMIT ?
          ) v ON d.rowid = v.rowid
          WHERE d.collection = ?
          ORDER BY v.distance
        `;

        searchParams = [vectorJson, limit, collection];
      } else {
        throw new Error('Search requires either text or vector query');
      }

      this.logger.info(`Executing search SQL with ${searchParams.length} parameters`);

      const searchResult = await this.sqliteManager.select(searchSQL, searchParams);

      const results: import('../../../types/worker.js').SearchResult[] = searchResult.rows.map(row => ({
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
        totalResults: searchResult.totalResults,
        searchTime: searchResult.searchTime,
        strategy: 'fts' as import('../../../types/search.js').SearchStrategy
      };
    });
  }

  private async handleSearchAdvanced(params: AdvancedSearchParams): Promise<EnhancedSearchResponse> {
    this.ensureInitialized();
    return this.withContext('searchAdvanced', async () => {
      // Fallback to regular search
      const searchResult = await this.handleSearch({
        query: typeof params.query === 'string' ? { text: params.query } : params.query,
        collection: params.collections?.[0] || 'default',
        limit: 10
      });

      return {
        results: searchResult.results,
        totalResults: searchResult.totalResults,
        searchTime: searchResult.searchTime,
        strategy: 'hybrid' as import('../../../types/search.js').SearchStrategy
      };
    });
  }

  private async handleSearchGlobal(params: GlobalSearchParams): Promise<GlobalSearchResponse> {
    this.ensureInitialized();
    return this.withContext('searchGlobal', async () => {
      // Simple implementation - search across all collections
      const searchResult = await this.handleSearch({
        query: { text: params.query },
        limit: 10
      });

      return {
        results: searchResult.results,
        totalResults: searchResult.totalResults,
        searchTime: searchResult.searchTime,
        strategy: 'fts' as import('../../../types/search.js').SearchStrategy,
        collectionResults: [{
          collection: 'default',
          results: searchResult.results,
          totalInCollection: searchResult.totalResults
        }],
        collectionsSearched: ['default']
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
        model: 'Xenova/all-MiniLM-L6-v2',
        source: 'provider_fresh' as const,
        processingTime: 0
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
            requestId: request.id,
            embedding,
            dimensions: embedding.length,
            source: 'provider_fresh' as const,
            processingTime: 0,
            status: 'completed' as const
          });
        } catch (error) {
          results.push({
            requestId: request.id,
            embedding: new Float32Array(),
            dimensions: 0,
            source: 'provider_fresh' as const,
            processingTime: 0,
            status: 'failed' as const,
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
      // Placeholder - cache warming not yet implemented
      this.logger.info('Cache warming not yet implemented');
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