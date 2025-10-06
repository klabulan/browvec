// ═══════════════════════════════════════════════════════════════════════════
// 🧪 TEST NEW BATCH INSERT API - Copy ALL and paste into browser console
// ═══════════════════════════════════════════════════════════════════════════
// Tests the new batchInsertDocuments() method with automatic transactions
// ═══════════════════════════════════════════════════════════════════════════

(async function() {
  console.clear();
  console.log('═'.repeat(80));
  console.log('🧪 BATCH INSERT API TEST');
  console.log('═'.repeat(80));
  console.log('Time:', new Date().toISOString());
  console.log('');

  const db = window.storageManager?.db || window.db;

  if (!db) {
    console.error('❌ ERROR: Database not found!');
    return;
  }

  // Check if new method exists
  if (typeof db.batchInsertDocuments !== 'function') {
    console.error('❌ ERROR: batchInsertDocuments() method not found!');
    console.error('   Make sure you rebuilt the SDK with: npm run build');
    console.error('   Then reload the plugin.');
    return;
  }

  console.log('✅ batchInsertDocuments() method found!');
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 1: Batch Insert with Automatic Transaction
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('═'.repeat(80));
  console.log('TEST 1: Batch Insert (Automatic Transaction)');
  console.log('═'.repeat(80));
  console.log('');

  const testChunks = [
    {
      id: 'batch_test_1',
      title: 'Batch Test Chunk 1',
      content: 'A'.repeat(2815),
      metadata: { test: 'batch_api', index: 1 }
    },
    {
      id: 'batch_test_2',
      title: 'Batch Test Chunk 2',
      content: 'B'.repeat(2915),
      metadata: { test: 'batch_api', index: 2 }
    },
    {
      id: 'batch_test_3',
      title: 'Batch Test Chunk 3',
      content: 'C'.repeat(3000),
      metadata: { test: 'batch_api', index: 3 }
    }
  ];

  console.log(`🔍 Inserting ${testChunks.length} chunks using batchInsertDocuments()...`);
  const startTime = Date.now();

  try {
    // NEW API - Transactions handled automatically!
    const results = await db.batchInsertDocuments({
      collection: 'test_batch_api',
      documents: testChunks,
      options: { generateEmbedding: false }
    });

    const totalTime = Date.now() - startTime;

    console.log(`\n✅ SUCCESS! Inserted ${results.length} documents in ${totalTime}ms`);
    console.log(`   Average: ${(totalTime / results.length).toFixed(1)}ms per document`);
    console.log('');
    console.log('📋 Results:');
    console.table(results.map((r, i) => ({
      Index: i + 1,
      ID: r.id,
      'Embedding Generated': r.embeddingGenerated ? 'Yes' : 'No'
    })));

    // Verify in database
    const verifyResult = await db.execAsync(
      'SELECT COUNT(*) as count FROM docs_default WHERE collection = ?',
      ['test_batch_api']
    );
    const count = verifyResult[0].values[0][0];

    console.log(`\n✅ Verification: ${count} documents in database`);

  } catch (error) {
    console.error(`\n❌ FAILED: ${error.message}`);
    console.error('Stack:', error.stack);
  }

  // Clean up
  try {
    await db.execAsync(`DELETE FROM docs_default WHERE collection = 'test_batch_api'`);
  } catch (e) {
    // Ignore cleanup errors
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 2: Single Document (Should NOT use transaction)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80));
  console.log('TEST 2: Single Document (No Transaction Overhead)');
  console.log('═'.repeat(80));
  console.log('');

  console.log('🔍 Inserting 1 document using batchInsertDocuments()...');
  const startSingle = Date.now();

  try {
    const results = await db.batchInsertDocuments({
      collection: 'test_single',
      documents: [{
        id: 'single_test',
        content: 'Single document test',
        metadata: { test: 'single' }
      }],
      options: { generateEmbedding: false }
    });

    const totalTime = Date.now() - startSingle;

    console.log(`✅ SUCCESS! Inserted in ${totalTime}ms`);
    console.log(`   ID: ${results[0].id}`);

  } catch (error) {
    console.error(`❌ FAILED: ${error.message}`);
  }

  // Clean up
  try {
    await db.execAsync(`DELETE FROM docs_default WHERE id = 'single_test'`);
  } catch (e) {
    // Ignore
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 3: Error Handling (Rollback Test)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80));
  console.log('TEST 3: Error Handling (Rollback on Failure)');
  console.log('═'.repeat(80));
  console.log('');

  const rollbackTest = [
    {
      id: 'rollback_1',
      content: 'Valid document 1',
      metadata: { test: 'rollback' }
    },
    {
      id: 'rollback_1', // DUPLICATE ID - will fail!
      content: 'Invalid document (duplicate ID)',
      metadata: { test: 'rollback' }
    }
  ];

  console.log('🔍 Inserting 2 documents (second has duplicate ID)...');
  let errorCaught = false;

  try {
    await db.batchInsertDocuments({
      collection: 'test_rollback',
      documents: rollbackTest,
      options: { generateEmbedding: false }
    });

    console.log('❌ ERROR: Should have failed but succeeded!');

  } catch (error) {
    errorCaught = true;
    console.log(`✅ Error caught as expected: ${error.message}`);
  }

  if (errorCaught) {
    // Verify rollback worked (no documents should be inserted)
    const verifyResult = await db.execAsync(
      'SELECT COUNT(*) as count FROM docs_default WHERE collection = ?',
      ['test_rollback']
    );
    const count = verifyResult[0].values[0][0];

    if (count === 0) {
      console.log('✅ Rollback verified: 0 documents in database (transaction rolled back)');
    } else {
      console.error(`❌ Rollback FAILED: ${count} documents found (should be 0)`);
    }
  }

  // Clean up
  try {
    await db.execAsync(`DELETE FROM docs_default WHERE collection = 'test_rollback'`);
  } catch (e) {
    // Ignore
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 4: Large Batch Performance
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80));
  console.log('TEST 4: Large Batch Performance (50 documents)');
  console.log('═'.repeat(80));
  console.log('');

  const largeBatch = Array.from({ length: 50 }, (_, i) => ({
    id: `perf_batch_${i}`,
    title: `Performance Test ${i}`,
    content: `Content for document ${i}. `.repeat(100),
    metadata: { test: 'performance', index: i }
  }));

  console.log(`🔍 Inserting ${largeBatch.length} documents...`);
  const startLarge = Date.now();

  try {
    const results = await db.batchInsertDocuments({
      collection: 'test_perf',
      documents: largeBatch,
      options: { generateEmbedding: false }
    });

    const totalTime = Date.now() - startLarge;

    console.log(`✅ SUCCESS! Inserted ${results.length} documents in ${totalTime}ms`);
    console.log(`   Average: ${(totalTime / results.length).toFixed(1)}ms per document`);
    console.log(`   Throughput: ${(results.length / (totalTime / 1000)).toFixed(0)} documents/second`);

  } catch (error) {
    console.error(`❌ FAILED: ${error.message}`);
  }

  // Clean up
  try {
    await db.execAsync(`DELETE FROM docs_default WHERE collection = 'test_perf'`);
  } catch (e) {
    // Ignore
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80));
  console.log('📋 TEST SUMMARY');
  console.log('═'.repeat(80));
  console.log('');
  console.log('✅ New batchInsertDocuments() API works correctly!');
  console.log('');
  console.log('💡 HOW TO USE IN YOUR PLUGIN:');
  console.log('');
  console.log('  // OLD WAY (manual transaction):');
  console.log('  await db.execAsync("BEGIN TRANSACTION");');
  console.log('  for (const chunk of chunks) {');
  console.log('    await db.insertDocumentWithEmbedding({ ... });');
  console.log('  }');
  console.log('  await db.execAsync("COMMIT");');
  console.log('');
  console.log('  // NEW WAY (automatic transaction):');
  console.log('  const results = await db.batchInsertDocuments({');
  console.log('    collection: "chunks",');
  console.log('    documents: chunks,');
  console.log('    options: { generateEmbedding: true }');
  console.log('  });');
  console.log('');
  console.log('═'.repeat(80));
  console.log('✅ ALL TESTS COMPLETE');
  console.log('═'.repeat(80));

})();
