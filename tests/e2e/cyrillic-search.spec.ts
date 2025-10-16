import { test, expect } from '@playwright/test';

test.describe('Cyrillic/Russian Text Search (FTS Batch Sync Fix)', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to demo app
    await page.goto('http://localhost:5174/examples/web-client/');

    // Wait for app to load
    await page.waitForFunction(
      () => typeof (window as any).localRetrieveDemo !== 'undefined',
      { timeout: 10000 }
    );
  });

  test('should index ALL documents in batch including Russian documents', async ({ page }) => {
    // Initialize and clear database
    await page.evaluate(async () => {
      await (window as any).localRetrieveDemo.initializeDatabase();
      await (window as any).localRetrieveDemo.db.clearAsync();
    });

    // Insert batch with English + Russian documents
    const result = await page.evaluate(async () => {
      const docs = [
        { title: 'English Document 1', content: 'This is English content about technology' },
        { title: 'English Document 2', content: 'More English content about programming' },
        { title: 'Александр Пушкин', content: 'Русская литература и поэзия' },
        { title: 'Космос', content: 'Россия запустила первый спутник' },
        { title: 'Технологии', content: 'Современные компьютерные системы' }
      ];

      return await (window as any).localRetrieveDemo.db.batchInsertDocuments({
        collection: 'default',
        documents: docs
      });
    });

    // Verify all 5 documents were inserted
    expect(result.length).toBe(5);
    expect(result.every((r: any) => r.id)).toBeTruthy();

    // CRITICAL CHECK: Verify all documents in FTS index (1:1 mapping)
    const counts = await page.evaluate(async () => {
      const docsResult = await (window as any).localRetrieveDemo.db.execAsync(
        'SELECT COUNT(*) as count FROM docs_default'
      );
      const ftsResult = await (window as any).localRetrieveDemo.db.execAsync(
        'SELECT COUNT(*) as count FROM fts_default'
      );

      return {
        docs: docsResult[0].values[0][0],
        fts: ftsResult[0].values[0][0]
      };
    });

    // This was the BUG: FTS count < docs count (Russian docs missing from FTS)
    expect(counts.docs).toBe(5);
    expect(counts.fts).toBe(5); // ✅ CRITICAL: All docs MUST be in FTS

    console.log(`✓ FTS index verification passed: ${counts.fts}/${counts.docs} documents indexed`);
  });

  test('should search Russian text using FTS5 MATCH queries', async ({ page }) => {
    // Initialize and populate
    await page.evaluate(async () => {
      await (window as any).localRetrieveDemo.initializeDatabase();
      await (window as any).localRetrieveDemo.db.clearAsync();

      const docs = [
        { title: 'English Document', content: 'This is English content' },
        { title: 'Александр Пушкин', content: 'Русская литература и поэзия' },
        { title: 'Космос', content: 'Россия запустила первый спутник' },
        { title: 'Технологии', content: 'Современные компьютерные системы' }
      ];

      await (window as any).localRetrieveDemo.db.batchInsertDocuments({
        collection: 'default',
        documents: docs
      });
    });

    // Test Russian search queries
    const searchTests = [
      { query: 'Пушкин', expectedMatches: 1, description: 'Russian name search' },
      { query: 'Россия', expectedMatches: 1, description: 'Russian word in content' },
      { query: 'технологии', expectedMatches: 1, description: 'Russian word (lowercase)' }
    ];

    for (const testCase of searchTests) {
      const matches = await page.evaluate(async (query: string) => {
        const result = await (window as any).localRetrieveDemo.db.execAsync(
          `SELECT COUNT(*) as count FROM fts_default WHERE fts_default MATCH ?`,
          [query]
        );
        return result[0].values[0][0];
      }, testCase.query);

      expect(matches, `${testCase.description} for query: "${testCase.query}"`).toBe(testCase.expectedMatches);
      console.log(`✓ Russian FTS search passed: "${testCase.query}" → ${matches} matches`);
    }
  });

  test('should fail fast on FTS sync errors (no silent failures)', async ({ page }) => {
    // Initialize database
    await page.evaluate(async () => {
      await (window as any).localRetrieveDemo.initializeDatabase();
      await (window as any).localRetrieveDemo.db.clearAsync();
    });

    // Attempt to insert with corrupted FTS table (simulate failure)
    const errorCaught = await page.evaluate(async () => {
      try {
        // Drop FTS table to simulate failure
        await (window as any).localRetrieveDemo.db.execAsync('DROP TABLE fts_default');

        // This should throw, not silently fail
        await (window as any).localRetrieveDemo.db.batchInsertDocuments({
          collection: 'default',
          documents: [{ title: 'Test', content: 'Content' }]
        });

        return false; // Should not reach here
      } catch (error: any) {
        // Verify error contains "FTS" (not a generic error)
        return error.message.includes('FTS') || error.message.includes('fts_default');
      }
    });

    // CRITICAL CHECK: FTS sync errors MUST be thrown (not silently logged)
    expect(errorCaught, 'FTS sync error should be thrown, not swallowed').toBeTruthy();
    console.log('✓ Fail-fast behavior verified: FTS errors are thrown');
  });

  test('should handle large batch with mixed English/Russian documents', async ({ page }) => {
    // Initialize database
    await page.evaluate(async () => {
      await (window as any).localRetrieveDemo.initializeDatabase();
      await (window as any).localRetrieveDemo.db.clearAsync();
    });

    // Insert 20 documents (mix of English and Russian)
    const result = await page.evaluate(async () => {
      const docs = [];
      for (let i = 0; i < 20; i++) {
        if (i % 2 === 0) {
          docs.push({
            title: `English Document ${i}`,
            content: `English content number ${i} about technology`
          });
        } else {
          docs.push({
            title: `Русский Документ ${i}`,
            content: `Русский контент номер ${i} о технологиях`
          });
        }
      }

      return await (window as any).localRetrieveDemo.db.batchInsertDocuments({
        collection: 'default',
        documents: docs
      });
    });

    expect(result.length).toBe(20);

    // Verify FTS count matches docs count
    const counts = await page.evaluate(async () => {
      const docsResult = await (window as any).localRetrieveDemo.db.execAsync(
        'SELECT COUNT(*) FROM docs_default'
      );
      const ftsResult = await (window as any).localRetrieveDemo.db.execAsync(
        'SELECT COUNT(*) FROM fts_default'
      );

      return {
        docs: docsResult[0].values[0][0],
        fts: ftsResult[0].values[0][0]
      };
    });

    // CRITICAL: All documents must be indexed
    expect(counts.docs).toBe(20);
    expect(counts.fts).toBe(20);

    // Verify Russian search works for documents across the batch
    const russianMatches = await page.evaluate(async () => {
      const result = await (window as any).localRetrieveDemo.db.execAsync(
        `SELECT COUNT(*) FROM fts_default WHERE fts_default MATCH 'Русский'`
      );
      return result[0].values[0][0];
    });

    // Should find all 10 Russian documents
    expect(russianMatches).toBe(10);
    console.log(`✓ Large batch test passed: ${russianMatches}/10 Russian documents searchable`);
  });

  test('should verify rowid alignment between docs_default and fts_default', async ({ page }) => {
    // Initialize database
    await page.evaluate(async () => {
      await (window as any).localRetrieveDemo.initializeDatabase();
      await (window as any).localRetrieveDemo.db.clearAsync();
    });

    // Insert documents
    await page.evaluate(async () => {
      const docs = [
        { title: 'Doc 1', content: 'First document' },
        { title: 'Документ 2', content: 'Второй документ' },
        { title: 'Doc 3', content: 'Third document' },
        { title: 'Документ 4', content: 'Четвёртый документ' }
      ];

      await (window as any).localRetrieveDemo.db.batchInsertDocuments({
        collection: 'default',
        documents: docs
      });
    });

    // Verify all rowids exist in both tables
    const rowidCheck = await page.evaluate(async () => {
      const docsResult = await (window as any).localRetrieveDemo.db.execAsync(
        'SELECT rowid FROM docs_default ORDER BY rowid'
      );
      const ftsResult = await (window as any).localRetrieveDemo.db.execAsync(
        'SELECT rowid FROM fts_default ORDER BY rowid'
      );

      const docRowids = docsResult[0].values.map((v: any) => v[0]);
      const ftsRowids = ftsResult[0].values.map((v: any) => v[0]);

      return {
        docRowids,
        ftsRowids,
        aligned: JSON.stringify(docRowids) === JSON.stringify(ftsRowids)
      };
    });

    // CRITICAL: Rowids must be perfectly aligned (1:1 mapping)
    expect(rowidCheck.aligned, 'Rowids in docs_default and fts_default must match').toBeTruthy();
    expect(rowidCheck.docRowids.length).toBe(4);
    expect(rowidCheck.ftsRowids.length).toBe(4);

    console.log(`✓ Rowid alignment verified: ${rowidCheck.docRowids.join(',')} === ${rowidCheck.ftsRowids.join(',')}`);
  });
});
