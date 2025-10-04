/**
 * EmbeddingQueue
 *
 * Manages background embedding processing queue operations.
 * Handles queuing, batch processing, and status tracking of embedding generation tasks.
 */

import type { SQLiteManager } from '../core/SQLiteManager.js';
import type {
  EnqueueEmbeddingParams,
  ProcessEmbeddingQueueParams,
  ProcessEmbeddingQueueResult,
  QueueStatusResult,
  ClearEmbeddingQueueParams
} from '../../../types/worker.js';
import { DatabaseError } from '../../../types/worker.js';
import { EmbeddingError } from '../../../embedding/errors.js';

/**
 * Queue item structure
 */
export interface QueueItem {
  id: number;
  collection_name: string;
  document_id: string;
  content: string;
  metadata?: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: number;
  retry_count: number;
  created_at: number;
  started_at?: number;
  completed_at?: number;
  processed_at?: number;
  error_message?: string;
}

/**
 * Queue processing statistics
 */
export interface QueueStats {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
  avgProcessingTime?: number;
}

/**
 * EmbeddingQueue manages background embedding processing
 *
 * Responsibilities:
 * - Queue document embedding requests
 * - Batch processing of embedding tasks
 * - Priority-based task scheduling
 * - Status tracking and reporting
 * - Error handling and retry logic
 * - Queue maintenance and cleanup
 */
export class EmbeddingQueue {
  constructor(
    private sqliteManager: SQLiteManager,
    private logger?: { log: (level: string, message: string, data?: any) => void }
  ) {}

  /**
   * Enqueue a document for embedding generation
   */
  async enqueue(params: EnqueueEmbeddingParams): Promise<number> {
    const { collection, documentId, textContent, priority = 0 } = params;

    try {
      // Verify collection exists
      await this.verifyCollectionExists(collection);

      // Insert into queue with INSERT OR REPLACE to handle duplicates
      const result = await this.sqliteManager.select(`
        INSERT OR REPLACE INTO embedding_queue
        (collection_name, document_id, text_content, priority, status, created_at)
        VALUES (?, ?, ?, ?, 'pending', strftime('%s', 'now'))
        RETURNING id
      `, [collection, documentId, textContent, priority]);

      const queueId = result.rows[0]?.id;
      if (!queueId) {
        // Fallback for databases that don't support RETURNING
        const lastInsertResult = await this.sqliteManager.select('SELECT last_insert_rowid() as id');
        const fallbackId = lastInsertResult.rows[0]?.id;

        if (!fallbackId) {
          throw new DatabaseError('Failed to get queue item ID');
        }

        this.log('info', `Enqueued embedding for document '${documentId}' in collection '${collection}' with priority ${priority} (ID: ${fallbackId})`);
        return fallbackId;
      }

      this.log('info', `Enqueued embedding for document '${documentId}' in collection '${collection}' with priority ${priority} (ID: ${queueId})`);
      return queueId;
    } catch (error) {
      throw new DatabaseError(`Failed to enqueue embedding: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Process pending items in the queue
   */
  async processQueue(params: ProcessEmbeddingQueueParams, embeddingGenerator: (collection: string, content: string) => Promise<Float32Array>): Promise<ProcessEmbeddingQueueResult> {
    const { collection, batchSize = 10, maxRetries = 3 } = params;

    try {
      // Get pending queue items
      const queueItems = await this.getPendingItems(collection, batchSize);

      if (queueItems.length === 0) {
        this.log('info', `No pending items in embedding queue${collection ? ' for collection ' + collection : ''}`);
        return { processed: 0, failed: 0, remainingInQueue: 0, errors: [] };
      }

      this.log('info', `Processing ${queueItems.length} items from embedding queue`);

      const result: ProcessEmbeddingQueueResult = {
        processed: 0,
        failed: 0,
        remainingInQueue: 0,
        errors: []
      };

      // Process each item in the batch
      for (const item of queueItems) {
        result.processed++;

        try {
          // Mark as processing
          await this.markAsProcessing(item.id);

          // Generate embedding
          const embedding = await embeddingGenerator(item.collection_name, item.content);

          // Store the embedding in vector table
          await this.storeEmbedding(item.collection_name, item.document_id, embedding);

          // Mark as completed
          await this.markAsCompleted(item.id);

          this.log('debug', `Successfully processed embedding for document '${item.document_id}' in collection '${item.collection_name}'`);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);

          // Handle retry logic
          if (item.retry_count < maxRetries) {
            await this.markForRetry(item.id, item.retry_count + 1);
            this.log('warn', `Embedding processing failed for document '${item.document_id}', will retry (attempt ${item.retry_count + 1}/${maxRetries}): ${errorMessage}`);
          } else {
            // Mark as failed after max retries
            await this.markAsFailed(item.id, errorMessage);
            result.failed++;
            result.errors.push({
              documentId: item.document_id,
              error: errorMessage
            });
            this.log('error', `Embedding processing failed permanently for document '${item.document_id}' after ${maxRetries} retries: ${errorMessage}`);
          }
        }
      }

      // Calculate remaining items in queue
      const remainingResult = await this.sqliteManager.select(`
        SELECT COUNT(*) as count FROM embedding_queue
        WHERE status = 'pending'${collection ? ' AND collection_name = ?' : ''}
      `, collection ? [collection] : []);
      result.remainingInQueue = remainingResult.rows[0]?.count || 0;

      this.log('info', `Queue processing completed: ${result.processed - result.failed} successful, ${result.failed} failed, ${result.remainingInQueue} remaining`);
      return result;
    } catch (error) {
      throw new DatabaseError(`Failed to process embedding queue: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get queue status statistics
   */
  async getStatus(collection?: string): Promise<QueueStatusResult> {
    try {
      let baseQuery = `
        SELECT
          status,
          COUNT(*) as count,
          AVG(CASE
            WHEN status = 'completed' AND processed_at IS NOT NULL AND started_at IS NOT NULL
            THEN processed_at - started_at
            ELSE NULL
          END) as avg_processing_time
        FROM embedding_queue
      `;

      let queryParams: any[] = [];
      if (collection) {
        baseQuery += ' WHERE collection_name = ?';
        queryParams.push(collection);
      }

      baseQuery += ' GROUP BY status';

      const result = await this.sqliteManager.select(baseQuery, queryParams);

      // Initialize counters
      const stats: QueueStats = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        total: 0
      };

      let totalProcessingTime = 0;
      let completedWithTime = 0;

      // Process results
      for (const row of result.rows) {
        const status = row.status as keyof QueueStats;
        const count = row.count as number;

        if (status in stats) {
          (stats as any)[status] = count;
          stats.total += count;
        }

        if (status === 'completed' && row.avg_processing_time) {
          totalProcessingTime += row.avg_processing_time * count;
          completedWithTime += count;
        }
      }

      // Calculate average processing time
      if (completedWithTime > 0) {
        stats.avgProcessingTime = Math.round(totalProcessingTime / completedWithTime);
      }

      // Get collection-specific information if requested
      let collections: string[] = [];
      if (!collection) {
        const collectionsResult = await this.sqliteManager.select(`
          SELECT DISTINCT collection_name
          FROM embedding_queue
          ORDER BY collection_name
        `);
        collections = collectionsResult.rows.map(row => row.collection_name);
      }

      return {
        collection: collection || 'global',
        pendingCount: stats.pending,
        processingCount: stats.processing,
        completedCount: stats.completed,
        failedCount: stats.failed,
        totalCount: stats.total,
        averageProcessingTime: stats.avgProcessingTime
      };
    } catch (error) {
      throw new DatabaseError(`Failed to get queue status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Clear queue items based on criteria
   */
  async clearQueue(params: ClearEmbeddingQueueParams = {}): Promise<number> {
    const { collection, status } = params;

    try {
      let deleteQuery = 'DELETE FROM embedding_queue WHERE 1=1';
      const queryParams: any[] = [];

      if (collection) {
        deleteQuery += ' AND collection_name = ?';
        queryParams.push(collection);
      }

      if (status) {
        deleteQuery += ' AND status = ?';
        queryParams.push(status);
      }

      await this.sqliteManager.exec(deleteQuery);

      // Get the number of deleted rows (approximation since exec doesn't return rowsAffected)
      const countQuery = deleteQuery.replace('DELETE FROM embedding_queue', 'SELECT COUNT(*) as count FROM embedding_queue');
      const beforeCount = await this.sqliteManager.select('SELECT COUNT(*) as count FROM embedding_queue');
      const deletedCount = beforeCount.rows[0]?.count || 0;

      this.log('info', `Cleared ${deletedCount} items from embedding queue`);
      return deletedCount;
    } catch (error) {
      throw new DatabaseError(`Failed to clear embedding queue: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get pending queue items with priority ordering
   */
  private async getPendingItems(collection?: string, limit: number = 10): Promise<QueueItem[]> {
    let query = `
      SELECT id, collection_name, document_id, text_content as content, status, priority,
             retry_count, created_at, started_at, completed_at, processed_at, error_message
      FROM embedding_queue
      WHERE status = 'pending'
    `;

    const queryParams: any[] = [];
    if (collection) {
      query += ' AND collection_name = ?';
      queryParams.push(collection);
    }

    query += ' ORDER BY priority DESC, created_at ASC LIMIT ?';
    queryParams.push(limit);

    const result = await this.sqliteManager.select(query, queryParams);

    return result.rows.map(row => ({
      id: row.id,
      collection_name: row.collection_name,
      document_id: row.document_id,
      content: row.content,
      status: row.status,
      priority: row.priority,
      retry_count: row.retry_count,
      created_at: row.created_at,
      started_at: row.started_at,
      completed_at: row.completed_at,
      processed_at: row.processed_at,
      error_message: row.error_message
    }));
  }

  /**
   * Mark queue item as processing
   */
  private async markAsProcessing(queueId: number): Promise<void> {
    await this.sqliteManager.exec(`
      UPDATE embedding_queue
      SET status = 'processing', started_at = strftime('%s', 'now')
      WHERE id = ?
    `);
    // Note: exec doesn't support parameters, so we use select instead
    await this.sqliteManager.select(
      "UPDATE embedding_queue SET status = 'processing', started_at = strftime('%s', 'now') WHERE id = ? RETURNING id",
      [queueId]
    );
  }

  /**
   * Mark queue item as completed
   */
  private async markAsCompleted(queueId: number): Promise<void> {
    await this.sqliteManager.select(
      "UPDATE embedding_queue SET status = 'completed', completed_at = strftime('%s', 'now'), processed_at = strftime('%s', 'now') WHERE id = ? RETURNING id",
      [queueId]
    );
  }

  /**
   * Mark queue item as failed
   */
  private async markAsFailed(queueId: number, errorMessage: string): Promise<void> {
    await this.sqliteManager.select(
      "UPDATE embedding_queue SET status = 'failed', error_message = ?, processed_at = strftime('%s', 'now') WHERE id = ? RETURNING id",
      [errorMessage, queueId]
    );
  }

  /**
   * Mark queue item for retry
   */
  private async markForRetry(queueId: number, retryCount: number): Promise<void> {
    await this.sqliteManager.select(
      "UPDATE embedding_queue SET status = 'pending', retry_count = ?, processed_at = strftime('%s', 'now') WHERE id = ? RETURNING id",
      [retryCount, queueId]
    );
  }

  /**
   * Store embedding in vector table
   */
  private async storeEmbedding(collection: string, documentId: string, embedding: Float32Array): Promise<void> {
    // Get the rowid for the document (using collection column in schema v3+)
    const docResult = await this.sqliteManager.select(
      `SELECT rowid FROM docs_default WHERE id = ? AND collection = ?`,
      [documentId, collection]
    );

    if (docResult.rows.length === 0) {
      throw new DatabaseError(`Document '${documentId}' not found in collection '${collection}'`);
    }

    const rowid = docResult.rows[0].rowid;

    // Convert Float32Array to blob
    const embeddingBlob = new Uint8Array(embedding.buffer);

    // Insert into vector table
    await this.sqliteManager.select(
      `INSERT OR REPLACE INTO vec_default_dense (rowid, embedding) VALUES (?, ?)`,
      [rowid, embeddingBlob]
    );

    this.log('debug', `Stored embedding for document '${documentId}' (rowid: ${rowid}) with ${embedding.length} dimensions`);
  }

  /**
   * Verify collection exists
   */
  private async verifyCollectionExists(collection: string): Promise<void> {
    const result = await this.sqliteManager.select(
      'SELECT name FROM collections WHERE name = ?',
      [collection]
    );

    if (result.rows.length === 0) {
      throw new DatabaseError(`Collection '${collection}' does not exist`);
    }
  }

  private log(level: string, message: string, data?: any): void {
    if (this.logger) {
      this.logger.log(level, message, data);
    } else {
      console.log(`[EmbeddingQueue] ${level.toUpperCase()}: ${message}`, data ? data : '');
    }
  }
}