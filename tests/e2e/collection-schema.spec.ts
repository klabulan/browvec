import { test, expect } from '@playwright/test';

/**
 * E2E Collection Schema Tests for LocalRetrieve SDK
 *
 * Tests Phase 5 collection schema functionality:
 * - Enhanced collections table with embedding configuration
 * - Embedding queue table and operations
 * - Schema v3 with collection column (TASK-001)
 * - Collection-based embedding management
 * - Queue management operations
 * - Cross-browser compatibility
 * - Performance benchmarks
 *
 * Note: Schema v3 introduced in TASK-001 adds collection column to docs_default
 * and separates metadata from internal fields. See schema-v3.spec.ts for
 * detailed Schema v3 feature tests.
 */

test.describe('Collection Schema Phase 5', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the demo page
    await page.goto('/examples/web-client/index.html');

    // Wait for SDK to be available
    await page.waitForFunction(() => {
      return typeof window.LocalRetrieve !== 'undefined';
    }, { timeout: 30000 });
  });

  test.describe('Schema Migration and Initialization', () => {
    test('should initialize v3 schema with all required tables and columns', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          // @ts-ignore - LocalRetrieve is loaded globally in demo
          const db = new LocalRetrieve.Database('opfs:/test-schema-v3.db');

          // Clear any existing database
          await db.clear();

          // Initialize should create v3 schema
          await db.initLocalRetrieve();

          // Check for all required tables
          const tables = await db.exec(`
            SELECT name FROM sqlite_master
            WHERE type='table'
            ORDER BY name
          `);

          const tableNames = tables.map((row: any) => row.name);

          // Check docs_default table has v3 schema (collection column)
          const docsSchema = await db.exec(`
            PRAGMA table_info(docs_default)
          `);

          const docsColumns = docsSchema.map((row: any) => row.name);

          // Check collections table schema
          const collectionsSchema = await db.exec(`
            PRAGMA table_info(collections)
          `);

          const collectionsColumns = collectionsSchema.map((row: any) => row.name);

          await db.close();

          return {
            success: true,
            tables: tableNames,
            hasAllRequiredTables: [
              'docs_default',
              'fts_default',
              'vec_default_dense',
              'collections',
              'embedding_queue'
            ].every(table => tableNames.includes(table)),
            docsColumns: docsColumns,
            hasCollectionColumn: docsColumns.includes('collection'),
            collectionsColumns: collectionsColumns,
            hasCollectionsV2Columns: [
              'embedding_provider',
              'embedding_dimensions',
              'embedding_status',
              'processing_status'
            ].every(col => collectionsColumns.includes(col))
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      });

      expect(result.success).toBe(true);
      expect(result.hasAllRequiredTables).toBe(true);
      expect(result.hasCollectionColumn).toBe(true);
      expect(result.hasCollectionsV2Columns).toBe(true);
      expect(result.tables).toHaveLength(5);
    });

    test('should support schema migrations (v1→v2→v3)', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          // @ts-ignore - LocalRetrieve is loaded globally in demo
          const db = new LocalRetrieve.Database('opfs:/test-migration-chain.db');

          // Clear database first
          await db.clear();

          // Simulate v1 schema (basic collections table, no embedding fields)
          await db.exec(`
            CREATE TABLE collections (
              name TEXT PRIMARY KEY,
              created_at INTEGER DEFAULT (strftime('%s', 'now')),
              updated_at INTEGER DEFAULT (strftime('%s', 'now')),
              schema_version INTEGER DEFAULT 1,
              config JSON
            )
          `);

          // Simulate v2 schema (docs without collection column)
          await db.exec(`
            CREATE TABLE docs_default (
              rowid INTEGER PRIMARY KEY,
              id TEXT UNIQUE,
              title TEXT,
              content TEXT NOT NULL,
              metadata JSON,
              created_at INTEGER,
              updated_at INTEGER
            )
          `);

          await db.exec(`
            INSERT INTO collections (name, config)
            VALUES ('default', '{"vectorDim": 384}')
          `);

          // Insert v2-style document (collection in metadata)
          await db.exec(`
            INSERT INTO docs_default (id, content, metadata)
            VALUES ('v2-doc', 'content', '{"collection": "default", "data": "test"}')
          `);

          // Close and reopen to trigger migrations
          await db.close();

          const db2 = new LocalRetrieve.Database('opfs:/test-migration-chain.db');
          await db2.initLocalRetrieve();

          // Check if migrations occurred
          const collectionsSchema = await db2.exec(`
            PRAGMA table_info(collections)
          `);

          const collectionsColumns = collectionsSchema.map((row: any) => row.name);

          const docsSchema = await db2.exec(`
            PRAGMA table_info(docs_default)
          `);

          const docsColumns = docsSchema.map((row: any) => row.name);

          // Check embedding_queue table exists
          const queueExists = await db2.exec(`
            SELECT count(*) as count FROM sqlite_master
            WHERE type='table' AND name='embedding_queue'
          `);

          // Verify v2→v3 migration cleaned metadata
          const migratedDoc = await db2.exec(`
            SELECT collection, metadata FROM docs_default WHERE id = 'v2-doc'
          `);

          await db2.close();

          return {
            success: true,
            hasCollectionsV2Columns: [
              'embedding_provider',
              'embedding_dimensions',
              'embedding_status',
              'processing_status'
            ].every(col => collectionsColumns.includes(col)),
            hasDocsV3CollectionColumn: docsColumns.includes('collection'),
            hasQueueTable: queueExists[0]?.count === 1,
            migratedCollectionValue: migratedDoc[0]?.collection,
            migratedMetadata: migratedDoc[0]?.metadata
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      });

      expect(result.success).toBe(true);
      expect(result.hasCollectionsV2Columns).toBe(true);
      expect(result.hasDocsV3CollectionColumn).toBe(true);
      expect(result.hasQueueTable).toBe(true);
      expect(result.migratedCollectionValue).toBe('default');
      // Metadata should no longer contain collection field
      const metadata = JSON.parse(result.migratedMetadata);
      expect(metadata.collection).toBeUndefined();
      expect(metadata.data).toBe('test');
    });
  });

  test.describe('Enhanced Collections Management', () => {
    test('should create collection with embedding configuration', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          // @ts-ignore - LocalRetrieve is loaded globally in demo
          const db = new LocalRetrieve.Database('opfs:/test-collection-create.db');
          await db.clear();
          await db.initLocalRetrieve();

          // Create collection with embedding config
          await db.createCollection({
            name: 'documents',
            dimensions: 768,
            config: {
              embeddingProvider: 'openai',
              embeddingModel: 'text-embedding-3-small'
            }
          });

          // Verify collection was created
          const collections = await db.exec(`
            SELECT * FROM collections WHERE name = 'documents'
          `);

          await db.close();

          return {
            success: true,
            collection: collections[0],
            hasEmbeddingConfig: collections[0]?.embedding_dimensions === 768
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      });

      expect(result.success).toBe(true);
      expect(result.hasEmbeddingConfig).toBe(true);
      expect(result.collection?.name).toBe('documents');
    });

    test('should get collection embedding status', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          // @ts-ignore - LocalRetrieve is loaded globally in demo
          const db = new LocalRetrieve.Database('opfs:/test-collection-status.db');
          await db.clear();
          await db.initLocalRetrieve();

          // Create test collection
          await db.createCollection({
            name: 'test-docs',
            dimensions: 384
          });

          // Get embedding status
          const status = await db.getCollectionEmbeddingStatus('test-docs');

          await db.close();

          return {
            success: true,
            status: status
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      });

      expect(result.success).toBe(true);
      expect(result.status).toBeDefined();
      expect(result.status.collection).toBe('test-docs');
      expect(typeof result.status.isReady).toBe('boolean');
      expect(typeof result.status.generationProgress).toBe('number');
    });
  });

  test.describe('Embedding Queue Operations', () => {
    test('should enqueue embedding for processing', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          // @ts-ignore - LocalRetrieve is loaded globally in demo
          const db = new LocalRetrieve.Database('opfs:/test-queue-enqueue.db');
          await db.clear();
          await db.initLocalRetrieve();

          // Create test collection
          await db.createCollection({
            name: 'queue-test',
            dimensions: 384
          });

          // Enqueue embedding
          const queueId = await db.enqueueEmbedding({
            collection: 'queue-test',
            documentId: 'doc-123',
            textContent: 'This is test content for embedding',
            priority: 1
          });

          // Check queue status
          const status = await db.getQueueStatus('queue-test');

          await db.close();

          return {
            success: true,
            queueId: queueId,
            queueStatus: status
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      });

      expect(result.success).toBe(true);
      expect(typeof result.queueId).toBe('number');
      expect(result.queueStatus.totalCount).toBeGreaterThan(0);
      expect(result.queueStatus.pendingCount).toBeGreaterThan(0);
    });

    test('should process embedding queue in batches', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          // @ts-ignore - LocalRetrieve is loaded globally in demo
          const db = new LocalRetrieve.Database('opfs:/test-queue-process.db');
          await db.clear();
          await db.initLocalRetrieve();

          // Create test collection
          await db.createCollection({
            name: 'process-test',
            dimensions: 384
          });

          // Enqueue multiple embeddings
          const queueIds = [];
          for (let i = 0; i < 5; i++) {
            const id = await db.enqueueEmbedding({
              collection: 'process-test',
              documentId: `doc-${i}`,
              textContent: `Test content ${i}`,
              priority: i % 2 + 1
            });
            queueIds.push(id);
          }

          // Process queue
          const processResult = await db.processEmbeddingQueue({
            collection: 'process-test',
            batchSize: 3
          });

          // Check final status
          const finalStatus = await db.getQueueStatus('process-test');

          await db.close();

          return {
            success: true,
            queueIds: queueIds,
            processResult: processResult,
            finalStatus: finalStatus
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      });

      expect(result.success).toBe(true);
      expect(result.queueIds).toHaveLength(5);
      expect(result.processResult).toBeDefined();
      expect(typeof result.processResult.processed).toBe('number');
      expect(typeof result.processResult.remainingInQueue).toBe('number');
    });

    test('should clear embedding queue with filters', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          // @ts-ignore - LocalRetrieve is loaded globally in demo
          const db = new LocalRetrieve.Database('opfs:/test-queue-clear.db');
          await db.clear();
          await db.initLocalRetrieve();

          // Create test collection
          await db.createCollection({
            name: 'clear-test',
            dimensions: 384
          });

          // Enqueue some embeddings
          for (let i = 0; i < 3; i++) {
            await db.enqueueEmbedding({
              collection: 'clear-test',
              documentId: `doc-${i}`,
              textContent: `Content ${i}`,
              priority: 1
            });
          }

          const beforeClear = await db.getQueueStatus('clear-test');

          // Clear completed items (should be 0)
          const clearedCompleted = await db.clearEmbeddingQueue({
            collection: 'clear-test',
            status: 'completed'
          });

          // Clear all pending items
          const clearedAll = await db.clearEmbeddingQueue({
            collection: 'clear-test',
            status: 'pending'
          });

          const afterClear = await db.getQueueStatus('clear-test');

          await db.close();

          return {
            success: true,
            beforeClear: beforeClear,
            clearedCompleted: clearedCompleted,
            clearedAll: clearedAll,
            afterClear: afterClear
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      });

      expect(result.success).toBe(true);
      expect(result.beforeClear.totalCount).toBe(3);
      expect(result.clearedCompleted).toBe(0);
      expect(result.clearedAll).toBe(3);
      expect(result.afterClear.totalCount).toBe(0);
    });

    test('should get comprehensive queue status', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          // @ts-ignore - LocalRetrieve is loaded globally in demo
          const db = new LocalRetrieve.Database('opfs:/test-queue-status.db');
          await db.clear();
          await db.initLocalRetrieve();

          // Create multiple collections
          await db.createCollection({ name: 'col1', dimensions: 384 });
          await db.createCollection({ name: 'col2', dimensions: 768 });

          // Add items to queues
          await db.enqueueEmbedding({
            collection: 'col1',
            documentId: 'doc1',
            textContent: 'Content 1'
          });

          await db.enqueueEmbedding({
            collection: 'col2',
            documentId: 'doc2',
            textContent: 'Content 2'
          });

          // Get status for specific collection
          const col1Status = await db.getQueueStatus('col1');

          // Get global status (all collections)
          const globalStatus = await db.getQueueStatus();

          await db.close();

          return {
            success: true,
            col1Status: col1Status,
            globalStatus: globalStatus
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      });

      expect(result.success).toBe(true);
      expect(result.col1Status.totalCount).toBe(1);
      expect(result.globalStatus.totalCount).toBe(2);
      expect(result.col1Status.pendingCount).toBe(1);
      expect(result.globalStatus.pendingCount).toBe(2);
    });
  });

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle queue operations on non-existent collection', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          // @ts-ignore - LocalRetrieve is loaded globally in demo
          const db = new LocalRetrieve.Database('opfs:/test-error-handling.db');
          await db.clear();
          await db.initLocalRetrieve();

          let enqueueFailed = false;
          try {
            await db.enqueueEmbedding({
              collection: 'non-existent',
              documentId: 'doc1',
              textContent: 'Content'
            });
          } catch (error) {
            enqueueFailed = true;
          }

          let statusFailed = false;
          try {
            await db.getQueueStatus('non-existent');
          } catch (error) {
            statusFailed = true;
          }

          await db.close();

          return {
            success: true,
            enqueueFailed: enqueueFailed,
            statusFailed: statusFailed
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      });

      expect(result.success).toBe(true);
      expect(result.enqueueFailed).toBe(true);
      expect(result.statusFailed).toBe(true);
    });

    test('should handle invalid queue parameters gracefully', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          // @ts-ignore - LocalRetrieve is loaded globally in demo
          const db = new LocalRetrieve.Database('opfs:/test-invalid-params.db');
          await db.clear();
          await db.initLocalRetrieve();

          // Create test collection
          await db.createCollection({
            name: 'param-test',
            dimensions: 384
          });

          let invalidEnqueue = false;
          try {
            await db.enqueueEmbedding({
              collection: 'param-test',
              // Missing required fields
            });
          } catch (error) {
            invalidEnqueue = true;
          }

          let invalidProcess = false;
          try {
            await db.processEmbeddingQueue({
              collection: 'param-test',
              batchSize: -1 // Invalid batch size
            });
          } catch (error) {
            invalidProcess = true;
          }

          await db.close();

          return {
            success: true,
            invalidEnqueue: invalidEnqueue,
            invalidProcess: invalidProcess
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      });

      expect(result.success).toBe(true);
      expect(result.invalidEnqueue).toBe(true);
      expect(result.invalidProcess).toBe(true);
    });
  });

  test.describe('Performance and Scalability', () => {
    test('should handle large queue operations efficiently', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          // @ts-ignore - LocalRetrieve is loaded globally in demo
          const db = new LocalRetrieve.Database('opfs:/test-performance.db');
          await db.clear();
          await db.initLocalRetrieve();

          await db.createCollection({
            name: 'perf-test',
            dimensions: 384
          });

          const startTime = Date.now();

          // Enqueue 50 embeddings
          const promises = [];
          for (let i = 0; i < 50; i++) {
            promises.push(db.enqueueEmbedding({
              collection: 'perf-test',
              documentId: `doc-${i}`,
              textContent: `Performance test content ${i}`,
              priority: Math.floor(i / 10) + 1
            }));
          }

          await Promise.all(promises);

          const enqueueTime = Date.now() - startTime;

          // Get status
          const statusStart = Date.now();
          const status = await db.getQueueStatus('perf-test');
          const statusTime = Date.now() - statusStart;

          // Clear all
          const clearStart = Date.now();
          const cleared = await db.clearEmbeddingQueue({
            collection: 'perf-test'
          });
          const clearTime = Date.now() - clearStart;

          await db.close();

          return {
            success: true,
            enqueueTime: enqueueTime,
            statusTime: statusTime,
            clearTime: clearTime,
            totalItems: status.totalCount,
            clearedItems: cleared
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      });

      expect(result.success).toBe(true);
      expect(result.totalItems).toBe(50);
      expect(result.clearedItems).toBe(50);

      // Performance assertions
      expect(result.enqueueTime).toBeLessThan(5000); // 5 seconds max
      expect(result.statusTime).toBeLessThan(100); // 100ms max
      expect(result.clearTime).toBeLessThan(1000); // 1 second max
    });
  });

  test.describe('Cross-browser Compatibility', () => {
    test('should work consistently across browser engines', async ({ page, browserName }) => {
      const result = await page.evaluate(async () => {
        try {
          // @ts-ignore - LocalRetrieve is loaded globally in demo
          const db = new LocalRetrieve.Database(`opfs:/test-browser-${Date.now()}.db`);
          await db.clear();
          await db.initLocalRetrieve();

          // Test core functionality
          await db.createCollection({
            name: 'browser-test',
            dimensions: 384
          });

          const queueId = await db.enqueueEmbedding({
            collection: 'browser-test',
            documentId: 'browser-doc',
            textContent: 'Cross-browser test content'
          });

          const status = await db.getQueueStatus('browser-test');

          await db.close();

          return {
            success: true,
            queueId: queueId,
            status: status,
            browserFeatures: {
              hasOPFS: typeof navigator.storage?.getDirectory === 'function',
              hasSharedArrayBuffer: typeof SharedArrayBuffer !== 'undefined',
              hasWebAssembly: typeof WebAssembly !== 'undefined'
            }
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      });

      expect(result.success).toBe(true);
      expect(typeof result.queueId).toBe('number');
      expect(result.status.totalCount).toBe(1);

      // Browser capability checks
      console.log(`Browser: ${browserName}, Features:`, result.browserFeatures);
      expect(result.browserFeatures.hasWebAssembly).toBe(true);
    });
  });

  test.describe('Backward Compatibility', () => {
    test('should maintain compatibility with existing Database API', async ({ page }) => {
      const result = await page.evaluate(async () => {
        try {
          // @ts-ignore - LocalRetrieve is loaded globally in demo
          const db = new LocalRetrieve.Database('opfs:/test-compat.db');
          await db.clear();
          await db.initLocalRetrieve();

          // Test existing API methods still work
          await db.exec("INSERT INTO docs_default (id, title, content) VALUES (?, ?, ?)",
                        ['doc1', 'Test Title', 'Test content']);

          const results = await db.exec("SELECT * FROM docs_default WHERE id = ?", ['doc1']);

          // Test search functionality
          const searchResults = await db.search({ text: 'Test' });

          await db.close();

          return {
            success: true,
            insertWorked: results.length > 0,
            searchWorked: searchResults.results.length > 0,
            hasNewMethods: {
              createCollection: typeof db.createCollection === 'function',
              enqueueEmbedding: typeof db.enqueueEmbedding === 'function',
              getQueueStatus: typeof db.getQueueStatus === 'function'
            }
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      });

      expect(result.success).toBe(true);
      expect(result.insertWorked).toBe(true);
      expect(result.searchWorked).toBe(true);
      expect(result.hasNewMethods.createCollection).toBe(true);
      expect(result.hasNewMethods.enqueueEmbedding).toBe(true);
      expect(result.hasNewMethods.getQueueStatus).toBe(true);
    });
  });
});