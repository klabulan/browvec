import { test, expect } from '@playwright/test';

/**
 * E2E API Tests for LocalRetrieve SDK
 *
 * Tests the core SDK functionality through browser automation:
 * - Database class instantiation
 * - SQL operations and compatibility
 * - Vector operations
 * - OPFS persistence
 * - Worker communication
 * - Error handling
 */

test.describe('LocalRetrieve SDK API', () => {
  test.beforeEach(async ({ page }) => {
    // Create a test page that imports the SDK
    await page.goto('/examples/web-client/index.html');

    // Wait for SDK to be available
    await page.waitForFunction(() => {
      return typeof window.LocalRetrieve !== 'undefined';
    }, { timeout: 30000 });
  });

  test('should instantiate Database class', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // @ts-ignore - LocalRetrieve is loaded globally in demo
        const db = new LocalRetrieve.Database('opfs:/test-api.db');
        return {
          success: true,
          type: typeof db,
          hasExec: typeof db.exec === 'function',
          hasPrepare: typeof db.prepare === 'function',
          hasClose: typeof db.close === 'function'
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.type).toBe('object');
    expect(result.hasExec).toBe(true);
    expect(result.hasPrepare).toBe(true);
    expect(result.hasClose).toBe(true);
  });

  test('should execute basic SQL operations', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // @ts-ignore
        const db = new LocalRetrieve.Database('opfs:/test-sql.db');

        // Create a simple table
        await db.exec('CREATE TABLE test_table (id INTEGER PRIMARY KEY, name TEXT)');

        // Insert data
        const stmt = await db.prepare('INSERT INTO test_table (name) VALUES (?)');
        await stmt.run(['Test Name']);
        await stmt.finalize();

        // Query data
        const results = await db.exec('SELECT * FROM test_table');

        await db.close();

        return {
          success: true,
          hasResults: results.length > 0,
          rowCount: results[0]?.values?.length || 0
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.hasResults).toBe(true);
    expect(result.rowCount).toBeGreaterThan(0);
  });

  test('should handle prepared statements correctly', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // @ts-ignore
        const db = new LocalRetrieve.Database('opfs:/test-prepared.db');

        await db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, age INTEGER)');

        // Test prepared statement with multiple parameters
        const stmt = await db.prepare('INSERT INTO users (email, age) VALUES (?, ?)');

        await stmt.run(['user1@example.com', 25]);
        await stmt.run(['user2@example.com', 30]);
        await stmt.run(['user3@example.com', 35]);

        await stmt.finalize();

        // Query back the data
        const selectStmt = await db.prepare('SELECT * FROM users WHERE age > ?');
        const result = await selectStmt.all([28]);
        await selectStmt.finalize();

        await db.close();

        return {
          success: true,
          resultCount: result.length,
          hasCorrectData: result.some(row => row.email === 'user2@example.com')
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.resultCount).toBe(2); // users with age > 28
    expect(result.hasCorrectData).toBe(true);
  });

  test('should support vector operations', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // @ts-ignore
        const db = new LocalRetrieve.Database('opfs:/test-vectors.db');

        // Initialize schema
        await db.exec(`
          CREATE TABLE IF NOT EXISTS docs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            content TEXT
          )
        `);

        await db.exec(`
          CREATE VIRTUAL TABLE IF NOT EXISTS vec_docs USING vec0(
            id INTEGER PRIMARY KEY,
            embedding FLOAT[384]
          )
        `);

        // Insert document with vector
        const docStmt = await db.prepare('INSERT INTO docs (title, content) VALUES (?, ?)');
        const docResult = await docStmt.run(['Test Document', 'This is test content']);
        await docStmt.finalize();

        const docId = docResult.lastInsertRowid;

        // Create a simple test vector (384 dimensions)
        const testVector = new Float32Array(384);
        for (let i = 0; i < 384; i++) {
          testVector[i] = Math.random() * 0.1; // Small random values
        }

        // Insert vector
        const vecStmt = await db.prepare('INSERT INTO vec_docs (id, embedding) VALUES (?, ?)');
        await vecStmt.run([docId, testVector]);
        await vecStmt.finalize();

        // Perform vector search
        const searchVector = new Float32Array(384);
        for (let i = 0; i < 384; i++) {
          searchVector[i] = Math.random() * 0.1;
        }

        const searchStmt = await db.prepare(`
          SELECT d.title, d.content, v.distance
          FROM vec_docs v
          JOIN docs d ON d.id = v.id
          WHERE v.embedding MATCH ?
          ORDER BY v.distance
          LIMIT 5
        `);

        const searchResults = await searchStmt.all([searchVector]);
        await searchStmt.finalize();

        await db.close();

        return {
          success: true,
          hasVectorResults: searchResults.length > 0,
          hasDistance: searchResults[0]?.distance !== undefined
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.hasVectorResults).toBe(true);
    expect(result.hasDistance).toBe(true);
  });

  test('should persist data with OPFS', async ({ page }) => {
    const dbPath = `opfs:/test-persistence-${Date.now()}.db`;

    // First session: create and populate database
    const createResult = await page.evaluate(async (path) => {
      try {
        // @ts-ignore
        const db = new LocalRetrieve.Database(path);

        await db.exec('CREATE TABLE persistence_test (id INTEGER PRIMARY KEY, value TEXT)');
        await db.exec("INSERT INTO persistence_test (value) VALUES ('persistent_data')");

        const results = await db.exec('SELECT COUNT(*) as count FROM persistence_test');
        const count = results[0]?.values[0][0];

        await db.close();

        return {
          success: true,
          insertedCount: count
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    }, dbPath);

    expect(createResult.success).toBe(true);
    expect(createResult.insertedCount).toBe(1);

    // Reload page to simulate new session
    await page.reload();
    await page.waitForFunction(() => {
      return typeof window.LocalRetrieve !== 'undefined';
    }, { timeout: 30000 });

    // Second session: verify data persisted
    const readResult = await page.evaluate(async (path) => {
      try {
        // @ts-ignore
        const db = new LocalRetrieve.Database(path);

        const results = await db.exec('SELECT value FROM persistence_test');
        const value = results[0]?.values[0][0];

        await db.close();

        return {
          success: true,
          persistedValue: value
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    }, dbPath);

    expect(readResult.success).toBe(true);
    expect(readResult.persistedValue).toBe('persistent_data');
  });

  test('should handle database errors gracefully', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // @ts-ignore
        const db = new LocalRetrieve.Database('opfs:/test-errors.db');

        let syntaxError = null;
        let constraintError = null;

        // Test syntax error
        try {
          await db.exec('INVALID SQL SYNTAX');
        } catch (error) {
          syntaxError = error.message;
        }

        // Setup for constraint error
        await db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY)');
        await db.exec('INSERT INTO test (id) VALUES (1)');

        // Test constraint error
        try {
          await db.exec('INSERT INTO test (id) VALUES (1)'); // Duplicate primary key
        } catch (error) {
          constraintError = error.message;
        }

        await db.close();

        return {
          success: true,
          hasSyntaxError: syntaxError !== null,
          hasConstraintError: constraintError !== null,
          syntaxErrorMessage: syntaxError,
          constraintErrorMessage: constraintError
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.hasSyntaxError).toBe(true);
    expect(result.hasConstraintError).toBe(true);
    expect(result.syntaxErrorMessage).toContain('syntax');
    expect(result.constraintErrorMessage).toContain('UNIQUE');
  });

  test('should support concurrent operations', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // @ts-ignore
        const db = new LocalRetrieve.Database('opfs:/test-concurrent.db');

        await db.exec('CREATE TABLE concurrent_test (id INTEGER PRIMARY KEY, value INTEGER)');

        // Perform multiple concurrent operations
        const promises = [];
        for (let i = 0; i < 10; i++) {
          promises.push(
            db.exec(`INSERT INTO concurrent_test (value) VALUES (${i})`)
          );
        }

        await Promise.all(promises);

        // Verify all inserts completed
        const results = await db.exec('SELECT COUNT(*) as count FROM concurrent_test');
        const count = results[0]?.values[0][0];

        await db.close();

        return {
          success: true,
          finalCount: count
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.finalCount).toBe(10);
  });

  test('should handle large datasets efficiently', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // @ts-ignore
        const db = new LocalRetrieve.Database('opfs:/test-large.db');

        await db.exec('CREATE TABLE large_test (id INTEGER PRIMARY KEY, data TEXT)');

        const startTime = performance.now();

        // Insert 1000 records
        const stmt = await db.prepare('INSERT INTO large_test (data) VALUES (?)');
        for (let i = 0; i < 1000; i++) {
          await stmt.run([`Data item ${i} with some content to make it realistic`]);
        }
        await stmt.finalize();

        const insertTime = performance.now() - startTime;

        // Query all records
        const queryStart = performance.now();
        const results = await db.exec('SELECT COUNT(*) as count FROM large_test');
        const queryTime = performance.now() - queryStart;

        const count = results[0]?.values[0][0];

        await db.close();

        return {
          success: true,
          recordCount: count,
          insertTime: insertTime,
          queryTime: queryTime
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.recordCount).toBe(1000);
    expect(result.insertTime).toBeLessThan(10000); // Should complete within 10 seconds
    expect(result.queryTime).toBeLessThan(1000); // Query should be fast
  });
});