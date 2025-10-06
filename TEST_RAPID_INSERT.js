// ═══════════════════════════════════════════════════════════════════════════
// 🧪 RAPID INSERT FTS5 BUG TEST - Copy ALL and paste into browser console
// ═══════════════════════════════════════════════════════════════════════════
// Tests the "database or disk is full" error on rapid sequential inserts
// ═══════════════════════════════════════════════════════════════════════════

(async function() {
  console.clear();
  console.log('═'.repeat(80));
  console.log('🧪 RAPID INSERT FTS5 BUG TEST');
  console.log('═'.repeat(80));
  console.log('Time:', new Date().toISOString());
  console.log('');

  const db = window.storageManager?.db || window.db;

  if (!db) {
    console.error('❌ ERROR: Database not found!');
    return;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 1: REPRODUCE BUG - Rapid inserts WITHOUT transaction
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('═'.repeat(80));
  console.log('TEST 1: REPRODUCE BUG - Sequential inserts WITHOUT transaction');
  console.log('═'.repeat(80));
  console.log('Expected: First succeeds ✅, Second fails ❌ with "database or disk is full"');
  console.log('');

  const testChunks = [
    {
      id: 'test_bug_chunk_1',
      title: 'Bug Test Chunk 1',
      content: 'A'.repeat(2815), // Simulates large Cyrillic content
      metadata: { test: 'bug_reproduction', index: 1 }
    },
    {
      id: 'test_bug_chunk_2',
      title: 'Bug Test Chunk 2',
      content: 'B'.repeat(2915), // Second large chunk
      metadata: { test: 'bug_reproduction', index: 2 }
    }
  ];

  let test1Results = {
    first: { success: false, error: null, time: 0 },
    second: { success: false, error: null, time: 0 }
  };

  // First insert (should succeed)
  console.log('🔍 Inserting first chunk (2815 bytes)...');
  const start1 = Date.now();
  try {
    await window.storageManager.db.insertDocumentWithEmbedding({
      collection: 'test_chunks',
      document: testChunks[0],
      options: { generateEmbedding: false }
    });
    test1Results.first.success = true;
    test1Results.first.time = Date.now() - start1;
    console.log(`✅ First chunk inserted successfully (${test1Results.first.time}ms)`);
  } catch (error) {
    test1Results.first.error = error.message;
    test1Results.first.time = Date.now() - start1;
    console.error(`❌ First chunk FAILED: ${error.message}`);
  }

  // Small delay to see if timing matters
  await new Promise(resolve => setTimeout(resolve, 10));

  // Second insert (may fail with "database or disk is full")
  console.log('🔍 Inserting second chunk (2915 bytes)...');
  const start2 = Date.now();
  try {
    await window.storageManager.db.insertDocumentWithEmbedding({
      collection: 'test_chunks',
      document: testChunks[1],
      options: { generateEmbedding: false }
    });
    test1Results.second.success = true;
    test1Results.second.time = Date.now() - start2;
    console.log(`✅ Second chunk inserted successfully (${test1Results.second.time}ms)`);
  } catch (error) {
    test1Results.second.error = error.message;
    test1Results.second.time = Date.now() - start2;
    console.error(`❌ Second chunk FAILED: ${error.message}`);
  }

  console.log('\n📊 TEST 1 RESULTS:');
  console.table({
    'First Insert': {
      Success: test1Results.first.success ? '✅' : '❌',
      Time: test1Results.first.time + 'ms',
      Error: test1Results.first.error || 'None'
    },
    'Second Insert': {
      Success: test1Results.second.success ? '✅' : '❌',
      Time: test1Results.second.time + 'ms',
      Error: test1Results.second.error || 'None'
    }
  });

  if (test1Results.first.success && !test1Results.second.success) {
    console.log('🎯 BUG REPRODUCED! First succeeded, second failed.');
    console.log('   This is the exact issue you\'re experiencing.');
  } else if (test1Results.first.success && test1Results.second.success) {
    console.log('⚠️  Bug did NOT reproduce - both succeeded.');
    console.log('   Environment may be different or bug is already fixed.');
  } else {
    console.log('❌ Unexpected result - first insert should succeed.');
  }

  // Clean up
  try {
    await db.execAsync(`DELETE FROM docs_default WHERE id LIKE 'test_bug_%'`);
  } catch (e) {
    // Ignore cleanup errors
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 2: FIX - Rapid inserts WITH transaction
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80));
  console.log('TEST 2: FIX - Batch inserts WITH transaction wrapper');
  console.log('═'.repeat(80));
  console.log('Expected: All inserts succeed ✅');
  console.log('');

  const fixChunks = [
    {
      id: 'test_fix_chunk_1',
      title: 'Fix Test Chunk 1',
      content: 'A'.repeat(2815),
      metadata: { test: 'fix_verification', index: 1 }
    },
    {
      id: 'test_fix_chunk_2',
      title: 'Fix Test Chunk 2',
      content: 'B'.repeat(2915),
      metadata: { test: 'fix_verification', index: 2 }
    },
    {
      id: 'test_fix_chunk_3',
      title: 'Fix Test Chunk 3',
      content: 'C'.repeat(3000),
      metadata: { test: 'fix_verification', index: 3 }
    }
  ];

  console.log(`🔍 Inserting ${fixChunks.length} chunks with transaction...`);
  const startFix = Date.now();
  let fixResults = {
    success: false,
    count: 0,
    time: 0,
    error: null
  };

  await db.execAsync('BEGIN IMMEDIATE TRANSACTION');

  try {
    for (let i = 0; i < fixChunks.length; i++) {
      await window.storageManager.db.insertDocumentWithEmbedding({
        collection: 'test_chunks',
        document: fixChunks[i],
        options: { generateEmbedding: false }
      });
      fixResults.count++;
      console.log(`  ✅ Chunk ${i + 1}/${fixChunks.length} inserted`);
    }

    await db.execAsync('COMMIT');
    fixResults.success = true;
    fixResults.time = Date.now() - startFix;

    console.log(`\n✅ Transaction committed successfully (${fixResults.time}ms)`);

  } catch (error) {
    await db.execAsync('ROLLBACK');
    fixResults.error = error.message;
    fixResults.time = Date.now() - startFix;
    console.error(`❌ Transaction failed and rolled back: ${error.message}`);
  }

  console.log('\n📊 TEST 2 RESULTS:');
  console.table({
    'Transaction Method': {
      Success: fixResults.success ? '✅' : '❌',
      'Chunks Inserted': `${fixResults.count}/${fixChunks.length}`,
      Time: fixResults.time + 'ms',
      'Avg per chunk': (fixResults.time / fixResults.count).toFixed(1) + 'ms',
      Error: fixResults.error || 'None'
    }
  });

  if (fixResults.success) {
    console.log('✅ FIX VERIFIED! Transaction wrapper solved the problem.');
  } else {
    console.log('❌ Fix did not work as expected.');
  }

  // Clean up
  try {
    await db.execAsync(`DELETE FROM docs_default WHERE id LIKE 'test_fix_%'`);
  } catch (e) {
    // Ignore cleanup errors
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 3: PERFORMANCE - Compare transaction vs no transaction
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80));
  console.log('TEST 3: PERFORMANCE - Transaction speedup');
  console.log('═'.repeat(80));
  console.log('');

  const perfChunkCount = 10;
  const createPerfChunk = (id) => ({
    id: `perf_${id}`,
    title: `Performance Test ${id}`,
    content: 'Lorem ipsum. '.repeat(200),
    metadata: { test: 'performance', id }
  });

  // Method 1: With transaction
  console.log(`🔍 Inserting ${perfChunkCount} chunks WITH transaction...`);
  const perfStart1 = Date.now();

  await db.execAsync('BEGIN IMMEDIATE TRANSACTION');
  for (let i = 0; i < perfChunkCount; i++) {
    await window.storageManager.db.insertDocumentWithEmbedding({
      collection: 'perf_tx',
      document: createPerfChunk(`tx_${i}`),
      options: { generateEmbedding: false }
    });
  }
  await db.execAsync('COMMIT');

  const perfTime1 = Date.now() - perfStart1;

  // Method 2: Without transaction (may fail)
  console.log(`🔍 Inserting ${perfChunkCount} chunks WITHOUT transaction...`);
  const perfStart2 = Date.now();
  let perfSuccessCount = 0;

  for (let i = 0; i < perfChunkCount; i++) {
    try {
      await window.storageManager.db.insertDocumentWithEmbedding({
        collection: 'perf_no_tx',
        document: createPerfChunk(`no_tx_${i}`),
        options: { generateEmbedding: false }
      });
      perfSuccessCount++;
    } catch (error) {
      console.log(`  ❌ Failed at chunk ${i + 1}: ${error.message}`);
      break;
    }
  }

  const perfTime2 = Date.now() - perfStart2;

  console.log('\n📊 PERFORMANCE COMPARISON:');
  console.table({
    'With Transaction': {
      Success: '✅',
      Count: `${perfChunkCount}/${perfChunkCount}`,
      'Total Time': perfTime1 + 'ms',
      'Avg/chunk': (perfTime1 / perfChunkCount).toFixed(1) + 'ms'
    },
    'Without Transaction': {
      Success: perfSuccessCount === perfChunkCount ? '✅' : '❌',
      Count: `${perfSuccessCount}/${perfChunkCount}`,
      'Total Time': perfTime2 + 'ms',
      'Avg/chunk': perfSuccessCount > 0 ? (perfTime2 / perfSuccessCount).toFixed(1) + 'ms' : 'N/A'
    }
  });

  if (perfSuccessCount === perfChunkCount) {
    const speedup = (perfTime2 / perfTime1).toFixed(1);
    console.log(`🚀 Transaction is ${speedup}x FASTER!`);
  } else {
    console.log(`⚠️  Without transaction failed after ${perfSuccessCount} inserts`);
  }

  // Clean up
  try {
    await db.execAsync(`DELETE FROM docs_default WHERE id LIKE 'perf_%'`);
  } catch (e) {
    // Ignore cleanup errors
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80));
  console.log('📋 TEST SUMMARY');
  console.log('═'.repeat(80));

  console.log('\n🔬 FINDINGS:');
  console.log(`  • Bug reproduced: ${test1Results.first.success && !test1Results.second.success ? 'YES ✅' : 'NO ❌'}`);
  console.log(`  • Fix works: ${fixResults.success ? 'YES ✅' : 'NO ❌'}`);
  console.log(`  • Performance improvement: ${perfSuccessCount === perfChunkCount ? (perfTime2 / perfTime1).toFixed(1) + 'x faster' : 'N/A'}`);

  console.log('\n💡 RECOMMENDATION:');
  if (test1Results.first.success && !test1Results.second.success && fixResults.success) {
    console.log('  ✅ Bug confirmed! Use transaction wrapper for batch inserts.');
    console.log('  ✅ Wrap your chunk insertion loop with:');
    console.log('     await db.execAsync("BEGIN IMMEDIATE TRANSACTION")');
    console.log('     // ... insert chunks ...');
    console.log('     await db.execAsync("COMMIT")');
  } else if (test1Results.first.success && test1Results.second.success) {
    console.log('  ℹ️  Bug did not reproduce in your environment.');
    console.log('  ℹ️  Still recommended to use transactions for batch inserts (faster!)');
  } else {
    console.log('  ⚠️  Unexpected results - check database state');
  }

  console.log('\n' + '═'.repeat(80));
  console.log('✅ TESTS COMPLETE');
  console.log('═'.repeat(80));

})();
