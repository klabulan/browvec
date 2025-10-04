import { test, expect } from '@playwright/test';

/**
 * E2E Schema v3 Tests for LocalRetrieve SDK (TASK-001)
 *
 * Tests Schema v3 features introduced in TASK-001:
 * - Metadata API contract (exact preservation, no field injection)
 * - Custom document IDs (string or number)
 * - Input validation (ValidationError, DocumentInsertError)
 * - Collection column separation from metadata
 * - Post-insert verification
 * - Schema migration from v2 to v3
 */

test.describe('Schema v3 - Metadata Preservation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/web-client/index.html');
    await page.waitForFunction(() => {
      return typeof window.LocalRetrieve !== 'undefined';
    }, { timeout: 30000 });
  });

  test('should preserve metadata exactly without field injection', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // @ts-ignore
        const { initLocalRetrieve } = window.LocalRetrieve;
        const db = await initLocalRetrieve('opfs:/test-metadata-preservation.db');

        // Insert document with complex metadata
        const testMetadata = {
          author: 'John Doe',
          tags: ['ai', 'ml', 'tutorial'],
          nested: {
            deep: {
              value: 'preserved'
            }
          },
          collection: 'user-defined-value',  // No longer reserved!
          customField: 42,
          arrayField: [1, 2, 3],
          boolField: true,
          nullField: null
        };

        const insertResult = await db.insertDocumentWithEmbedding({
          collection: 'default',
          document: {
            title: 'Metadata Test',
            content: 'Testing metadata preservation',
            metadata: testMetadata
          }
        });

        // Retrieve and verify metadata
        const rows = await db.execAsync(
          'SELECT metadata FROM docs_default WHERE id = ?',
          [insertResult.id]
        );

        const storedMetadata = JSON.parse(rows[0].values[0][0]);

        await db.close();

        return {
          success: true,
          original: testMetadata,
          stored: storedMetadata,
          matches: JSON.stringify(testMetadata) === JSON.stringify(storedMetadata),
          hasCollectionField: storedMetadata.collection === 'user-defined-value'
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.matches).toBe(true);
    expect(result.hasCollectionField).toBe(true);
    expect(result.stored).toEqual(result.original);
  });

  test('should handle empty metadata correctly', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // @ts-ignore
        const { initLocalRetrieve } = window.LocalRetrieve;
        const db = await initLocalRetrieve('opfs:/test-empty-metadata.db');

        // Insert with no metadata
        const result1 = await db.insertDocumentWithEmbedding({
          collection: 'default',
          document: {
            content: 'Document without metadata'
          }
        });

        // Insert with empty object
        const result2 = await db.insertDocumentWithEmbedding({
          collection: 'default',
          document: {
            content: 'Document with empty metadata',
            metadata: {}
          }
        });

        const rows = await db.execAsync(
          'SELECT id, metadata FROM docs_default WHERE id IN (?, ?)',
          [result1.id, result2.id]
        );

        await db.close();

        return {
          success: true,
          metadata1: rows[0].values[0][1],
          metadata2: rows[0].values[1][1]
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.metadata1).toBe('{}');
    expect(result.metadata2).toBe('{}');
  });

  test('should preserve nested objects and arrays in metadata', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // @ts-ignore
        const { initLocalRetrieve } = window.LocalRetrieve;
        const db = await initLocalRetrieve('opfs:/test-nested-metadata.db');

        const complexMetadata = {
          level1: {
            level2: {
              level3: {
                data: 'deeply nested'
              }
            }
          },
          mixedArray: [
            { type: 'object', value: 1 },
            'string',
            42,
            [1, 2, 3],
            true,
            null
          ]
        };

        const insertResult = await db.insertDocumentWithEmbedding({
          collection: 'default',
          document: {
            content: 'Nested metadata test',
            metadata: complexMetadata
          }
        });

        const rows = await db.execAsync(
          'SELECT metadata FROM docs_default WHERE id = ?',
          [insertResult.id]
        );

        const retrieved = JSON.parse(rows[0].values[0][0]);

        await db.close();

        return {
          success: true,
          matches: JSON.stringify(complexMetadata) === JSON.stringify(retrieved),
          deepNested: retrieved.level1?.level2?.level3?.data,
          arrayLength: retrieved.mixedArray?.length
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.matches).toBe(true);
    expect(result.deepNested).toBe('deeply nested');
    expect(result.arrayLength).toBe(6);
  });
});

test.describe('Schema v3 - Custom Document IDs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/web-client/index.html');
    await page.waitForFunction(() => {
      return typeof window.LocalRetrieve !== 'undefined';
    }, { timeout: 30000 });
  });

  test('should accept string custom IDs', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // @ts-ignore
        const { initLocalRetrieve } = window.LocalRetrieve;
        const db = await initLocalRetrieve('opfs:/test-string-ids.db');

        const customId = 'user-doc-123-abc';

        const insertResult = await db.insertDocumentWithEmbedding({
          collection: 'default',
          document: {
            id: customId,
            content: 'Document with custom string ID'
          }
        });

        const rows = await db.execAsync(
          'SELECT id FROM docs_default WHERE id = ?',
          [customId]
        );

        await db.close();

        return {
          success: true,
          returnedId: insertResult.id,
          foundInDb: rows[0].values.length > 0,
          storedId: rows[0].values[0][0]
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.returnedId).toBe('user-doc-123-abc');
    expect(result.foundInDb).toBe(true);
    expect(result.storedId).toBe('user-doc-123-abc');
  });

  test('should accept numeric custom IDs', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // @ts-ignore
        const { initLocalRetrieve } = window.LocalRetrieve;
        const db = await initLocalRetrieve('opfs:/test-numeric-ids.db');

        const customId = 12345;

        const insertResult = await db.insertDocumentWithEmbedding({
          collection: 'default',
          document: {
            id: customId,
            content: 'Document with custom numeric ID'
          }
        });

        const rows = await db.execAsync(
          'SELECT id FROM docs_default WHERE id = ?',
          [customId.toString()]
        );

        await db.close();

        return {
          success: true,
          returnedId: insertResult.id,
          foundInDb: rows[0].values.length > 0,
          storedId: rows[0].values[0][0]
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.returnedId).toBe('12345');
    expect(result.foundInDb).toBe(true);
    expect(result.storedId).toBe('12345');
  });

  test('should auto-generate ID when not provided', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // @ts-ignore
        const { initLocalRetrieve } = window.LocalRetrieve;
        const db = await initLocalRetrieve('opfs:/test-auto-ids.db');

        const insertResult = await db.insertDocumentWithEmbedding({
          collection: 'default',
          document: {
            content: 'Document without explicit ID'
          }
        });

        const rows = await db.execAsync(
          'SELECT id FROM docs_default WHERE id = ?',
          [insertResult.id]
        );

        await db.close();

        return {
          success: true,
          hasId: !!insertResult.id,
          idPattern: insertResult.id.startsWith('doc_'),
          foundInDb: rows[0].values.length > 0
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.hasId).toBe(true);
    expect(result.idPattern).toBe(true);
    expect(result.foundInDb).toBe(true);
  });
});

test.describe('Schema v3 - Input Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/web-client/index.html');
    await page.waitForFunction(() => {
      return typeof window.LocalRetrieve !== 'undefined';
    }, { timeout: 30000 });
  });

  test('should reject document without content or title', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // @ts-ignore
        const { initLocalRetrieve } = window.LocalRetrieve;
        const db = await initLocalRetrieve('opfs:/test-validation-required.db');

        let error = null;
        try {
          await db.insertDocumentWithEmbedding({
            collection: 'default',
            document: {
              metadata: { test: 'value' }
            }
          });
        } catch (e) {
          error = {
            name: e.name,
            message: e.message,
            hasContext: !!e.context
          };
        }

        await db.close();

        return {
          success: true,
          gotError: !!error,
          errorName: error?.name,
          isValidationError: error?.name === 'ValidationError'
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.gotError).toBe(true);
    expect(result.isValidationError).toBe(true);
  });

  test('should reject invalid metadata type', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // @ts-ignore
        const { initLocalRetrieve } = window.LocalRetrieve;
        const db = await initLocalRetrieve('opfs:/test-validation-metadata.db');

        const errors = [];

        // Test array as metadata
        try {
          await db.insertDocumentWithEmbedding({
            collection: 'default',
            document: {
              content: 'test',
              metadata: ['array', 'not', 'allowed']
            }
          });
        } catch (e) {
          errors.push({ type: 'array', name: e.name });
        }

        // Test string as metadata
        try {
          await db.insertDocumentWithEmbedding({
            collection: 'default',
            document: {
              content: 'test',
              metadata: 'string not allowed'
            }
          });
        } catch (e) {
          errors.push({ type: 'string', name: e.name });
        }

        // Test null as metadata
        try {
          await db.insertDocumentWithEmbedding({
            collection: 'default',
            document: {
              content: 'test',
              metadata: null
            }
          });
        } catch (e) {
          errors.push({ type: 'null', name: e.name });
        }

        await db.close();

        return {
          success: true,
          errors: errors,
          allValidationErrors: errors.every(e => e.name === 'ValidationError')
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.allValidationErrors).toBe(true);
  });

  test('should reject invalid ID types', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // @ts-ignore
        const { initLocalRetrieve } = window.LocalRetrieve;
        const db = await initLocalRetrieve('opfs:/test-validation-id.db');

        const errors = [];

        // Test empty string
        try {
          await db.insertDocumentWithEmbedding({
            collection: 'default',
            document: {
              id: '',
              content: 'test'
            }
          });
        } catch (e) {
          errors.push({ type: 'empty-string', name: e.name });
        }

        // Test object as ID
        try {
          await db.insertDocumentWithEmbedding({
            collection: 'default',
            document: {
              id: { invalid: 'object' },
              content: 'test'
            }
          });
        } catch (e) {
          errors.push({ type: 'object', name: e.name });
        }

        await db.close();

        return {
          success: true,
          errors: errors,
          allValidationErrors: errors.every(e => e.name === 'ValidationError')
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.allValidationErrors).toBe(true);
  });

  test('should warn about metadata.collection field', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // @ts-ignore
        const { initLocalRetrieve } = window.LocalRetrieve;
        const db = await initLocalRetrieve('opfs:/test-validation-warning.db');

        let error = null;
        try {
          await db.insertDocumentWithEmbedding({
            collection: 'default',
            document: {
              content: 'test',
              metadata: {
                collection: 'some-value'  // Should trigger warning
              }
            }
          });
        } catch (e) {
          error = {
            name: e.name,
            message: e.message,
            hasWarning: e.message.includes('⚠️') || e.message.includes('warning')
          };
        }

        await db.close();

        return {
          success: true,
          gotError: !!error,
          errorName: error?.name,
          hasWarning: error?.hasWarning
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    expect(result.success).toBe(true);
    // Note: Depending on implementation, this might be a warning or validation error
    expect(result.gotError).toBe(true);
  });
});

test.describe('Schema v3 - Collection Column', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/web-client/index.html');
    await page.waitForFunction(() => {
      return typeof window.LocalRetrieve !== 'undefined';
    }, { timeout: 30000 });
  });

  test('should store collection in separate column', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // @ts-ignore
        const { initLocalRetrieve } = window.LocalRetrieve;
        const db = await initLocalRetrieve('opfs:/test-collection-column.db');

        // Insert documents in different collections
        const doc1 = await db.insertDocumentWithEmbedding({
          collection: 'default',
          document: { content: 'Default collection doc' }
        });

        const doc2 = await db.insertDocumentWithEmbedding({
          collection: 'articles',
          document: { content: 'Articles collection doc' }
        });

        // Verify collection column
        const rows = await db.execAsync(
          'SELECT id, collection, metadata FROM docs_default ORDER BY id'
        );

        await db.close();

        return {
          success: true,
          row1: {
            collection: rows[0].values[0][1],
            metadata: rows[0].values[0][2]
          },
          row2: {
            collection: rows[0].values[1][1],
            metadata: rows[0].values[1][2]
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
    expect(result.row1.collection).toBe('default');
    expect(result.row2.collection).toBe('articles');
    // Metadata should be empty objects, not containing collection
    expect(result.row1.metadata).toBe('{}');
    expect(result.row2.metadata).toBe('{}');
  });

  test('should query by collection column efficiently', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // @ts-ignore
        const { initLocalRetrieve } = window.LocalRetrieve;
        const db = await initLocalRetrieve('opfs:/test-collection-query.db');

        // Insert multiple documents
        await db.insertDocumentWithEmbedding({
          collection: 'docs',
          document: { content: 'Doc 1' }
        });
        await db.insertDocumentWithEmbedding({
          collection: 'docs',
          document: { content: 'Doc 2' }
        });
        await db.insertDocumentWithEmbedding({
          collection: 'articles',
          document: { content: 'Article 1' }
        });

        // Query using collection column
        const docsRows = await db.execAsync(
          'SELECT COUNT(*) as count FROM docs_default WHERE collection = ?',
          ['docs']
        );

        const articlesRows = await db.execAsync(
          'SELECT COUNT(*) as count FROM docs_default WHERE collection = ?',
          ['articles']
        );

        await db.close();

        return {
          success: true,
          docsCount: docsRows[0].values[0][0],
          articlesCount: articlesRows[0].values[0][0]
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.docsCount).toBe(2);
    expect(result.articlesCount).toBe(1);
  });

  test('should have index on collection column', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // @ts-ignore
        const { initLocalRetrieve } = window.LocalRetrieve;
        const db = await initLocalRetrieve('opfs:/test-collection-index.db');

        // Check for index
        const indexes = await db.execAsync(
          "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='docs_default'"
        );

        const indexNames = indexes[0]?.values?.map(row => row[0]) || [];

        await db.close();

        return {
          success: true,
          hasCollectionIndex: indexNames.some(name => name.includes('collection'))
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.hasCollectionIndex).toBe(true);
  });
});

test.describe('Schema v3 - Migration from v2', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/web-client/index.html');
    await page.waitForFunction(() => {
      return typeof window.LocalRetrieve !== 'undefined';
    }, { timeout: 30000 });
  });

  test('should migrate v2 database to v3 automatically', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // @ts-ignore
        const { initLocalRetrieve } = window.LocalRetrieve;
        const db = await initLocalRetrieve('opfs:/test-v2-to-v3-migration.db');

        // Clear and create v2-style schema
        await db.clearAsync();

        // Manually create v2 schema (without collection column)
        await db.execAsync(`
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

        // Insert v2-style document with collection in metadata
        await db.runAsync(
          'INSERT INTO docs_default (id, title, content, metadata) VALUES (?, ?, ?, ?)',
          ['v2-doc-1', 'V2 Document', 'Content', JSON.stringify({ collection: 'default', data: 'test' })]
        );

        // Close and reinitialize to trigger migration
        await db.close();

        const db2 = await initLocalRetrieve('opfs:/test-v2-to-v3-migration.db');

        // Check if collection column exists
        const schema = await db2.execAsync('PRAGMA table_info(docs_default)');
        const columns = schema[0]?.values?.map(row => row[1]) || [];

        // Verify migration cleaned metadata
        const rows = await db2.execAsync(
          'SELECT id, collection, metadata FROM docs_default WHERE id = ?',
          ['v2-doc-1']
        );

        const migratedMetadata = rows[0]?.values[0]?.[2] ? JSON.parse(rows[0].values[0][2]) : null;

        await db2.close();

        return {
          success: true,
          hasCollectionColumn: columns.includes('collection'),
          collectionValue: rows[0]?.values[0]?.[1],
          metadataStillHasData: migratedMetadata?.data === 'test',
          metadataNoLongerHasCollection: !migratedMetadata?.collection
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.hasCollectionColumn).toBe(true);
    expect(result.collectionValue).toBe('default');
    expect(result.metadataStillHasData).toBe(true);
    expect(result.metadataNoLongerHasCollection).toBe(true);
  });
});
