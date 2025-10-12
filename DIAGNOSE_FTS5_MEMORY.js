/**
 * FTS5 MEMORY DIAGNOSTIC TOOL
 *
 * Monitors FTS5 index behavior, segment counts, and estimates memory usage
 * during batch insert operations to understand COMMIT failures.
 *
 * USAGE:
 * 1. Open browser console at http://localhost:5174/examples/web-client/
 * 2. Copy and paste this entire script
 * 3. Analyze the output
 */

(async function diagnoseFTS5Memory() {
  console.log('=== FTS5 MEMORY DIAGNOSTIC ===\n');

  const db = window.db;
  if (!db) {
    console.error('❌ Database not found.');
    return;
  }

  // Helper function
  async function query(sql) {
    const result = await db.execAsync(sql);
    const stmt = result[0];
    const rows = [];
    if (stmt && stmt.values && stmt.values.length > 0) {
      for (const row of stmt.values) {
        const obj = {};
        stmt.columns.forEach((col, idx) => { obj[col] = row[idx]; });
        rows.push(obj);
      }
    }
    return rows;
  }

  // Get FTS5 statistics
  async function getFTS5Stats(collection = 'chunks') {
    console.log(`\n--- FTS5 Statistics for collection: ${collection} ---`);

    try {
      // Row count (single shared table with collection column)
      const countResult = await query(`SELECT COUNT(*) as count FROM docs_default WHERE collection = '${collection}'`);
      console.log(`Total documents in collection: ${countResult[0]?.count || 0}`);

      // Try to get segment info (shared fts_default table)
      try {
        const segdirCheck = await query(`
          SELECT name FROM sqlite_master
          WHERE type='table' AND name='fts_default_segdir'
        `);

        if (segdirCheck.length > 0) {
          const segments = await query(`SELECT COUNT(*) as count FROM fts_default_segdir`);
          console.log(`FTS5 segments (all collections): ${segments[0]?.count || 0}`);

          // Get segment details
          const segDetails = await query(`
            SELECT level, idx, start_block, leaves_end_block, root
            FROM fts_default_segdir
            LIMIT 10
          `);
          if (segDetails.length > 0) {
            console.log(`Segment details:`, segDetails);
          }
        } else {
          console.log(`FTS5 segments: (segdir table not found - using newer FTS5 format)`);
        }
      } catch (segErr) {
        console.log(`FTS5 segments: Unable to query (${segErr.message})`);
      }

      // Size estimation
      const sizeResult = await query(`
        SELECT
          SUM(LENGTH(content)) as total_content_size,
          AVG(LENGTH(content)) as avg_content_size,
          MAX(LENGTH(content)) as max_content_size,
          MIN(LENGTH(content)) as min_content_size
        FROM docs_default
        WHERE collection = '${collection}'
      `);

      if (sizeResult.length > 0) {
        const stats = sizeResult[0];
        console.log(`Content size stats:`);
        console.log(`  Total: ${(stats.total_content_size / 1024).toFixed(2)} KB`);
        console.log(`  Average: ${stats.avg_content_size} bytes`);
        console.log(`  Max: ${stats.max_content_size} bytes`);
        console.log(`  Min: ${stats.min_content_size} bytes`);

        // Estimate FTS5 overhead
        const estimatedIndexSize = stats.total_content_size * 4; // 4x overhead assumption
        console.log(`  Estimated FTS5 index size: ${(estimatedIndexSize / 1024).toFixed(2)} KB (4x overhead)`);
      }

    } catch (err) {
      console.error(`Error getting FTS5 stats: ${err.message}`);
    }
  }

  // Monitor incremental insert behavior
  async function monitorIncrementalInsert(numDocs = 10) {
    console.log(`\n--- Incremental Insert Monitor (${numDocs} docs) ---`);

    const testCollection = 'test_incremental';

    try {
      // Cleanup
      await db.execAsync(`DELETE FROM docs_default WHERE collection = '${testCollection}'`);

      console.log(`\nInserting ${numDocs} documents one-by-one in a single transaction...\n`);

      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');

      const memorySnapshots = [];

      for (let i = 0; i < numDocs; i++) {
        const content = `This is test document number ${i}. `.repeat(50); // ~1.5KB each

        await db.execAsync(`
          INSERT INTO docs_default (id, title, content, collection, metadata)
          VALUES (
            'test_inc_${i}',
            'Test ${i}',
            '${content}',
            '${testCollection}',
            '{"index": ${i}}'
          )
        `);

        // Take snapshot every 5 docs
        if ((i + 1) % 5 === 0 || i === numDocs - 1) {
          console.log(`  Inserted ${i + 1}/${numDocs} documents (transaction still open)`);
        }
      }

      console.log(`\nAll ${numDocs} documents inserted. Attempting COMMIT...`);
      const commitStart = performance.now();

      try {
        await db.execAsync('COMMIT');
        const commitTime = (performance.now() - commitStart).toFixed(2);
        console.log(`✅ COMMIT succeeded in ${commitTime}ms`);

        // Verify
        const verify = await query(`SELECT COUNT(*) as count FROM docs_default WHERE collection = '${testCollection}'`);
        console.log(`Verified: ${verify[0].count} rows persisted`);

      } catch (commitErr) {
        console.log(`❌ COMMIT FAILED: ${commitErr.message}`);
        await db.execAsync('ROLLBACK').catch(() => {});
      }

    } catch (err) {
      console.error(`Error during incremental test: ${err.message}`);
      await db.execAsync('ROLLBACK').catch(() => {});
    }

    // Cleanup
    await db.execAsync(`DELETE FROM docs_default WHERE collection = '${testCollection}'`).catch(() => {});
  }

  // Check current database state
  console.log('--- Current Database State ---');

  // Cache configuration
  const cacheSize = await query('PRAGMA cache_size');
  const pageSize = await query('PRAGMA page_size');
  const tempStore = await query('PRAGMA temp_store');

  console.log(`Cache size: ${cacheSize[0]?.cache_size || 'unknown'} pages`);
  console.log(`Page size: ${pageSize[0]?.page_size || 'unknown'} bytes`);
  console.log(`Temp store: ${tempStore[0]?.temp_store || 'unknown'} (0=default, 1=file, 2=memory)`);

  const cacheKB = (cacheSize[0]?.cache_size || 0) < 0
    ? Math.abs(cacheSize[0]?.cache_size)
    : (cacheSize[0]?.cache_size || 0) * (pageSize[0]?.page_size || 4096) / 1024;

  console.log(`Total cache: ${cacheKB.toFixed(0)} KB = ${(cacheKB / 1024).toFixed(2)} MB`);

  // Database size
  const pageCount = await query('PRAGMA page_count');
  const dbSizeKB = ((pageCount[0]?.page_count || 0) * (pageSize[0]?.page_size || 4096)) / 1024;
  console.log(`Database size: ${dbSizeKB.toFixed(2)} KB`);

  // Get FTS5 stats for existing collections
  await getFTS5Stats('chunks');

  // Test incremental insert with monitoring
  console.log('\n\n=== TESTING INCREMENTAL INSERT ===');
  await monitorIncrementalInsert(10);
  console.log('\nTesting larger batch...');
  await monitorIncrementalInsert(20);

  // Calculate overhead multiplier from actual data
  console.log('\n\n--- Calculating Actual FTS5 Overhead ---');
  try {
    const actualData = await query(`
      SELECT
        SUM(LENGTH(content)) as total_content,
        COUNT(*) as doc_count
      FROM docs_default
      WHERE collection = 'chunks'
    `);

    if (actualData[0] && actualData[0].total_content > 0) {
      const contentSize = actualData[0].total_content;
      const docCount = actualData[0].doc_count;

      // Get actual database pages used by FTS (shared fts_default table)
      const ftsPages = await query(`
        SELECT SUM(pgsize) as fts_size FROM dbstat WHERE name LIKE 'fts_default%'
      `).catch(() => [{ fts_size: null }]);

      if (ftsPages[0]?.fts_size) {
        const actualFTSSize = ftsPages[0].fts_size;
        const actualOverhead = actualFTSSize / contentSize;

        console.log(`Content size: ${(contentSize / 1024).toFixed(2)} KB (${docCount} docs)`);
        console.log(`Actual FTS size: ${(actualFTSSize / 1024).toFixed(2)} KB`);
        console.log(`Actual overhead multiplier: ${actualOverhead.toFixed(2)}x`);
        console.log(`Current assumption: 4x`);

        if (actualOverhead > 4) {
          console.log(`⚠️  WARNING: Actual overhead (${actualOverhead.toFixed(2)}x) exceeds assumption (4x)`);
          console.log(`   Consider using ${Math.ceil(actualOverhead)}x in batch size calculation`);
        }
      } else {
        console.log(`Unable to query dbstat for precise FTS size`);
      }
    }
  } catch (err) {
    console.log(`Unable to calculate overhead: ${err.message}`);
  }

  console.log('\n\n=== DIAGNOSTIC COMPLETE ===\n');
})();
