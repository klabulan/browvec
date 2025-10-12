/**
 * ACTUAL CHUNKS DIAGNOSTIC TOOL
 *
 * Analyzes the actual chunk data that's failing to identify why
 * batch inserts are failing at COMMIT.
 *
 * USAGE:
 * 1. Open browser console at http://localhost:5174/examples/web-client/
 * 2. Copy and paste this entire script
 * 3. Review analysis of your actual failing chunk data
 */

(async function diagnoseActualChunks() {
  console.log('=== ACTUAL CHUNKS DIAGNOSTIC ===\n');

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

  console.log('--- Analyzing Existing Chunks ---\n');

  // Get chunk statistics
  const chunkStats = await query(`
    SELECT
      COUNT(*) as total_chunks,
      SUM(LENGTH(content)) as total_content_size,
      AVG(LENGTH(content)) as avg_content_size,
      MAX(LENGTH(content)) as max_content_size,
      MIN(LENGTH(content)) as min_content_size
    FROM docs_chunks
    WHERE collection = 'chunks'
  `);

  if (chunkStats[0] && chunkStats[0].total_chunks > 0) {
    const stats = chunkStats[0];
    console.log(`Current chunks in database:`);
    console.log(`  Total chunks: ${stats.total_chunks}`);
    console.log(`  Total content: ${(stats.total_content_size / 1024).toFixed(2)} KB`);
    console.log(`  Average chunk: ${stats.avg_content_size} bytes`);
    console.log(`  Largest chunk: ${stats.max_content_size} bytes`);
    console.log(`  Smallest chunk: ${stats.min_content_size} bytes`);

    // Estimate batch size based on current data
    const cacheInfo = await query('PRAGMA cache_size');
    const cacheSize = cacheInfo[0]?.cache_size || -64000;
    const cacheKB = cacheSize < 0 ? Math.abs(cacheSize) : cacheSize * 4;
    const availableKB = cacheKB * 0.25; // 25% of cache
    const availableBytes = availableKB * 1024;

    // Calculate with FTS5 overhead
    const avgChunkWithOverhead = stats.avg_content_size * 5; // Try 5x instead of 4x
    const calculatedBatch = Math.floor(availableBytes / avgChunkWithOverhead);

    console.log(`\nBatch size calculation based on actual data:`);
    console.log(`  Cache size: ${cacheKB.toFixed(0)} KB`);
    console.log(`  Available for batch (25%): ${availableKB.toFixed(0)} KB`);
    console.log(`  Avg chunk + 5x overhead: ${(avgChunkWithOverhead / 1024).toFixed(2)} KB`);
    console.log(`  Calculated batch size: ${calculatedBatch}`);
    console.log(`  Current MAX_BATCH setting: 50`);

    if (calculatedBatch < 50) {
      console.log(`  ⚠️  WARNING: Calculated (${calculatedBatch}) < MAX_BATCH (50)`);
    }
  } else {
    console.log(`No chunks found in database yet.`);
  }

  // Simulate the exact scenario that's failing
  console.log('\n\n--- Simulating Failed Batch Insert ---\n');
  console.log('This will use REAL chunk-sized documents to test batch insert.\n');

  async function testWithRealSizedChunks(batchSize) {
    console.log(`Testing batch size: ${batchSize}`);

    // Use actual average chunk size from stats
    const avgSize = chunkStats[0]?.avg_content_size || 500;
    const maxSize = chunkStats[0]?.max_content_size || 1000;

    try {
      // Clear test data
      await db.execAsync(`DELETE FROM docs_default WHERE collection = 'test_real'`);

      console.log(`  Generating ${batchSize} documents (avg: ${avgSize} bytes, max: ${maxSize} bytes)...`);

      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');

      for (let i = 0; i < batchSize; i++) {
        // Generate document with realistic size variation
        const docSize = i % 3 === 0 ? maxSize : avgSize; // Mix of avg and max sizes
        const content = 'x'.repeat(docSize);

        await db.execAsync(`
          INSERT INTO docs_default (id, title, content, collection, metadata)
          VALUES (
            'real_test_${i}',
            'Real Test ${i}',
            '${content}',
            'test_real',
            '{"test": true, "index": ${i}}'
          )
        `);
      }

      console.log(`  ${batchSize} documents inserted, attempting COMMIT...`);
      const commitStart = performance.now();

      await db.execAsync('COMMIT');
      const commitTime = (performance.now() - commitStart).toFixed(2);

      console.log(`  ✅ SUCCESS! COMMIT took ${commitTime}ms\n`);
      return { success: true, commitTime };

    } catch (err) {
      console.log(`  ❌ FAILED: ${err.message}\n`);
      await db.execAsync('ROLLBACK').catch(() => {});
      return { success: false, error: err.message };
    } finally {
      // Cleanup
      await db.execAsync(`DELETE FROM docs_default WHERE collection = 'test_real'`).catch(() => {});
    }
  }

  // Test with realistic batch sizes
  console.log('Testing with real chunk sizes:\n');

  const testSizes = [20, 15, 10, 8, 5, 3];
  const results = [];

  for (const size of testSizes) {
    const result = await testWithRealSizedChunks(size);
    results.push({ batchSize: size, ...result });

    if (result.success) {
      console.log(`✅ Found working batch size: ${size}\n`);
      break;
    }

    await new Promise(resolve => setTimeout(resolve, 300));
  }

  // Analyze what failed with 38 chunks
  console.log('\n--- Analysis: Why Did 38 Chunks Fail? ---\n');

  if (chunkStats[0] && chunkStats[0].total_chunks >= 38) {
    // Calculate total size of 38 chunks
    const avgSize = chunkStats[0].avg_content_size;
    const totalContent = avgSize * 38;
    const totalWithOverhead4x = totalContent * 4;
    const totalWithOverhead5x = totalContent * 5;
    const totalWithOverhead6x = totalContent * 6;

    console.log(`38 chunks analysis:`);
    console.log(`  Total content: ${(totalContent / 1024).toFixed(2)} KB`);
    console.log(`  With 4x overhead: ${(totalWithOverhead4x / 1024).toFixed(2)} KB`);
    console.log(`  With 5x overhead: ${(totalWithOverhead5x / 1024).toFixed(2)} KB`);
    console.log(`  With 6x overhead: ${(totalWithOverhead6x / 1024).toFixed(2)} KB`);

    const cacheInfo = await query('PRAGMA cache_size');
    const cacheSize = cacheInfo[0]?.cache_size || -64000;
    const cacheKB = cacheSize < 0 ? Math.abs(cacheSize) : cacheSize * 4;
    const available25 = cacheKB * 0.25;
    const available50 = cacheKB * 0.50;

    console.log(`\nCache allocation:`);
    console.log(`  Total cache: ${cacheKB.toFixed(0)} KB`);
    console.log(`  25% allocation: ${available25.toFixed(0)} KB`);
    console.log(`  50% allocation: ${available50.toFixed(0)} KB`);

    if (totalWithOverhead4x / 1024 > available25) {
      console.log(`\n⚠️  38 chunks with 4x overhead (${(totalWithOverhead4x / 1024).toFixed(0)} KB) exceeds 25% cache (${available25.toFixed(0)} KB)`);
    }

    if (totalWithOverhead5x / 1024 > available25) {
      console.log(`⚠️  38 chunks with 5x overhead (${(totalWithOverhead5x / 1024).toFixed(0)} KB) exceeds 25% cache (${available25.toFixed(0)} KB)`);
    }
  }

  // Summary
  console.log('\n\n=== SUMMARY & RECOMMENDATIONS ===\n');

  const workingSize = results.find(r => r.success);
  if (workingSize) {
    console.log(`✅ Maximum working batch size: ${workingSize.batchSize}`);
    console.log(`   Recommended MAX_BATCH: ${Math.max(3, Math.floor(workingSize.batchSize * 0.8))}`);
    console.log(`\n   Update DatabaseWorker.ts:`);
    console.log(`   - Change MAX_BATCH from 50 to ${Math.max(3, Math.floor(workingSize.batchSize * 0.8))}`);
    console.log(`   - Consider increasing cache allocation from 25% to 35%`);
    console.log(`   - Or use higher overhead multiplier (5x or 6x instead of 4x)`);
  } else {
    console.log(`❌ All tested batch sizes failed.`);
    console.log(`   Possible solutions:`);
    console.log(`   1. Increase PRAGMA cache_size`);
    console.log(`   2. Reduce MAX_BATCH to 2 or 1`);
    console.log(`   3. Use multiple smaller transactions`);
  }

  console.log('\n=== DIAGNOSTIC COMPLETE ===\n');
})();
