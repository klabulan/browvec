/**
 * BATCH SIZE DIAGNOSTIC TOOL
 *
 * Tests progressively smaller batch sizes to find the maximum safe size
 * for FTS5 COMMIT operations with your specific document set.
 *
 * USAGE:
 * 1. Open browser console at http://localhost:5174/examples/web-client/
 * 2. Copy and paste this entire script
 * 3. Wait for results
 */

(async function diagnoseBatchSize() {
  console.log('=== BATCH SIZE DIAGNOSTIC STARTING ===\n');

  // Get database instance
  const db = window.db;
  if (!db) {
    console.error('❌ Database not found. Make sure demo is running and initialized.');
    return;
  }

  // Helper function to query database
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

  // Sample document generator (matches your chunk sizes)
  function generateTestDoc(id, size = 500) {
    const content = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. '.repeat(Math.ceil(size / 120));
    return {
      id: `test_batch_${id}`,
      title: `Test Document ${id}`,
      content: content.substring(0, size),
      metadata: { test: true, index: id, timestamp: Date.now() }
    };
  }

  // Test batch insertion with specific size
  async function testBatchSize(batchSize, docSize = 500) {
    console.log(`\n--- Testing batch size: ${batchSize} (doc size: ~${docSize} chars) ---`);

    try {
      // Clear previous test data (single shared table with collection column)
      await db.execAsync('DELETE FROM docs_default WHERE collection = "test_batch"');

      // Generate test documents
      const docs = [];
      for (let i = 0; i < batchSize; i++) {
        docs.push(generateTestDoc(i, docSize));
      }

      // Manual transaction test (mimics worker behavior)
      console.log(`  Step 1: BEGIN TRANSACTION`);
      await db.execAsync('BEGIN IMMEDIATE TRANSACTION');

      let insertedCount = 0;
      try {
        // Insert all documents (FTS auto-indexes via triggers)
        for (const doc of docs) {
          await db.execAsync(`
            INSERT INTO docs_default (id, title, content, collection, metadata)
            VALUES (
              '${doc.id}',
              '${doc.title}',
              '${doc.content.replace(/'/g, "''")}',
              'test_batch',
              '${JSON.stringify(doc.metadata).replace(/'/g, "''")}'
            )
          `);

          insertedCount++;
        }

        console.log(`  Step 2: ✓ Inserted ${insertedCount} documents into transaction`);

        // This is where FTS5 builds indexes and fails
        console.log(`  Step 3: Attempting COMMIT (FTS5 builds indexes here)...`);
        const commitStart = performance.now();
        await db.execAsync('COMMIT');
        const commitTime = (performance.now() - commitStart).toFixed(2);

        console.log(`  ✅ SUCCESS! Batch size ${batchSize} works (COMMIT took ${commitTime}ms)`);

        // Verify data persisted
        const verifyRows = await query(`SELECT COUNT(*) as count FROM docs_default WHERE collection = 'test_batch'`);
        console.log(`  Verified: ${verifyRows[0].count} rows persisted`);

        return { success: true, batchSize, commitTime, insertedCount };

      } catch (insertError) {
        console.log(`  ❌ FAILED during ${insertedCount === batchSize ? 'COMMIT' : 'INSERT'}`);
        console.log(`  Documents inserted before failure: ${insertedCount}/${batchSize}`);
        console.log(`  Error: ${insertError.message}`);

        // Try to rollback
        try {
          await db.execAsync('ROLLBACK');
          console.log(`  Transaction rolled back`);
        } catch (rbError) {
          console.log(`  Rollback note: ${rbError.message}`);
        }

        return {
          success: false,
          batchSize,
          failedAt: insertedCount === batchSize ? 'COMMIT' : insertedCount + 1,
          error: insertError.message
        };
      }

    } catch (error) {
      console.log(`  ❌ Test setup failed: ${error.message}`);
      return { success: false, batchSize, error: error.message };
    }
  }

  // Get cache info
  console.log('Current cache configuration:');
  const cacheInfo = await query('PRAGMA cache_size');
  console.log(`  cache_size: ${cacheInfo[0]?.cache_size || 'unknown'}`);
  const pageSizeInfo = await query('PRAGMA page_size');
  console.log(`  page_size: ${pageSizeInfo[0]?.page_size || 'unknown'} bytes\n`);

  // Test progressive batch sizes
  console.log('=== TESTING BATCH SIZES ===\n');
  console.log('Testing: 30, 20, 15, 10, 5, 3, 1\n');

  const results = [];
  const testSizes = [30, 20, 15, 10, 5, 3, 1];

  for (const size of testSizes) {
    const result = await testBatchSize(size, 500);
    results.push(result);

    // If successful, we found a working batch size
    if (result.success) {
      console.log(`\n✅ Found working batch size: ${size}`);

      // Test one size larger to confirm boundary
      if (testSizes.indexOf(size) > 0) {
        const nextSize = testSizes[testSizes.indexOf(size) - 1];
        console.log(`\nConfirming that ${nextSize} fails...`);
        const confirmFail = await testBatchSize(nextSize, 500);
        results.push(confirmFail);
      }

      break;
    }

    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  // Test with larger documents (matching your actual chunks)
  console.log('\n\n=== TESTING WITH LARGER DOCUMENTS ===\n');
  const successfulSize = results.find(r => r.success)?.batchSize;
  if (successfulSize) {
    console.log(`Testing batch size ${successfulSize} with 1500-char documents (like your actual chunks)\n`);
    const largeDocResult = await testBatchSize(successfulSize, 1500);
    results.push({ ...largeDocResult, note: 'large_docs' });
  }

  // Summary
  console.log('\n\n=== DIAGNOSTIC SUMMARY ===\n');
  console.log('Test Results:');
  results.forEach(r => {
    const note = r.note ? ` [${r.note}]` : '';
    if (r.success) {
      console.log(`  ✅ Batch ${r.batchSize}: SUCCESS (COMMIT: ${r.commitTime}ms)${note}`);
    } else {
      console.log(`  ❌ Batch ${r.batchSize}: FAILED at ${r.failedAt}${note}`);
    }
  });

  // Recommendation
  const firstSuccess = results.find(r => r.success);
  if (firstSuccess) {
    const recommended = Math.max(1, Math.floor(firstSuccess.batchSize * 0.75));
    console.log(`\n📊 RECOMMENDATION:`);
    console.log(`   Maximum safe batch size: ${firstSuccess.batchSize}`);
    console.log(`   Recommended production value: ${recommended}`);
    console.log(`   (75% of max for safety margin)`);
    console.log(`\n   Update DatabaseWorker.ts line ~565:`);
    console.log(`   const MIN_BATCH = 1;`);
    console.log(`   const MAX_BATCH = ${recommended}; // ← Change this`);
  } else {
    console.log(`\n⚠️  CRITICAL: Even batch size 1 failed!`);
    console.log(`   This indicates a serious issue. Run DIAGNOSTICS.js for full analysis.`);
  }

  // Cleanup
  console.log('\n\nCleaning up test data...');
  try {
    await db.execAsync('DELETE FROM docs_default WHERE collection = "test_batch"');
    console.log('✓ Test data removed\n');
  } catch (err) {
    console.warn('⚠️  Cleanup warning:', err.message, '\n');
  }

  console.log('=== DIAGNOSTIC COMPLETE ===\n');
})();
