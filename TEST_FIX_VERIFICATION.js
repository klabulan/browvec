// ═══════════════════════════════════════════════════════════════════════════
// 🔧 FIX VERIFICATION TEST - Copy ALL and paste into browser console
// ═══════════════════════════════════════════════════════════════════════════
// Verifies that batchInsertDocuments() now actually persists data
// Tests worker-side transaction fix
// ═══════════════════════════════════════════════════════════════════════════

(async function() {
  console.clear();
  console.log('═'.repeat(80));
  console.log('🔧 BATCH INSERT FIX VERIFICATION');
  console.log('═'.repeat(80));
  console.log('Time:', new Date().toISOString());
  console.log('');

  const db = window.storageManager?.db || window.db;

  if (!db) {
    console.error('❌ ERROR: Database not found!');
    return;
  }

  console.log('✅ Database found');
  console.log('');

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 1: Batch Insert Data Persistence (THE BUG FIX)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('═'.repeat(80));
  console.log('TEST 1: Verify Data Actually Persists');
  console.log('═'.repeat(80));
  console.log('');

  // Clean up any previous test data
  try {
    await db.execAsync(`DELETE FROM docs_default WHERE collection = 'test_fix_verification'`);
  } catch (e) {
    // Ignore
  }

  const testDocs = [
    {
      id: 'verify_chunk_1',
      title: 'Verification Test 1',
      content: 'A'.repeat(2815),
      metadata: { test: 'fix_verification', index: 1 }
    },
    {
      id: 'verify_chunk_2',
      title: 'Verification Test 2',
      content: 'B'.repeat(2915),
      metadata: { test: 'fix_verification', index: 2 }
    },
    {
      id: 'verify_chunk_3',
      title: 'Verification Test 3',
      content: 'C'.repeat(3000),
      metadata: { test: 'fix_verification', index: 3 }
    }
  ];

  console.log(`🔍 Step 1: Inserting ${testDocs.length} documents...`);
  const startTime = Date.now();

  let insertResults;
  try {
    insertResults = await db.batchInsertDocuments({
      collection: 'test_fix_verification',
      documents: testDocs,
      options: { generateEmbedding: false }
    });

    const insertTime = Date.now() - startTime;
    console.log(`✅ Insert returned successfully (${insertTime}ms)`);
    console.log(`   Returned ${insertResults.length} results`);

  } catch (error) {
    console.error(`❌ Insert FAILED: ${error.message}`);
    return;
  }

  console.log('');
  console.log('🔍 Step 2: Verifying data in database...');

  // CRITICAL TEST: Check if data actually exists in database
  const verifyResult = await db.execAsync(
    `SELECT COUNT(*) as count FROM docs_default WHERE collection = 'test_fix_verification'`
  );

  const actualCount = verifyResult[0].values[0][0];

  console.log('');
  console.log('📊 RESULTS:');
  console.log(`   Expected rows: ${testDocs.length}`);
  console.log(`   Actual rows:   ${actualCount}`);
  console.log(`   Insert logs:   ${insertResults.length} "success" messages`);
  console.log('');

  if (actualCount === testDocs.length) {
    console.log('✅✅✅ FIX VERIFIED! Data persisted correctly! ✅✅✅');
    console.log('');
    console.log('🎉 Worker-side transaction fix is working!');

    // Verify document details
    const details = await db.execAsync(
      `SELECT id, title, LENGTH(content) as content_length FROM docs_default WHERE collection = 'test_fix_verification' ORDER BY id`
    );

    console.log('');
    console.log('📋 Persisted Documents:');
    details[0].values.forEach((row, i) => {
      console.log(`   ${i + 1}. ID: ${row[0]}, Title: ${row[1]}, Content: ${row[2]} bytes`);
    });

  } else if (actualCount === 0) {
    console.error('❌❌❌ BUG STILL EXISTS! ❌❌❌');
    console.error('');
    console.error('Data was NOT persisted!');
    console.error('');
    console.error('Possible causes:');
    console.error('  1. Old build still loaded (need to clear cache/reload)');
    console.error('  2. Fix not properly deployed');
    console.error('  3. Different issue than expected');
    console.error('');
    console.error('Try:');
    console.error('  1. Hard refresh: Ctrl+Shift+R');
    console.error('  2. Clear cache and reload plugin');
    console.error('  3. Rebuild: npm run build');

  } else {
    console.warn(`⚠️  PARTIAL SUCCESS: ${actualCount}/${testDocs.length} documents persisted`);
    console.warn('   Some data was saved but not all');
  }

  // Clean up
  try {
    await db.execAsync(`DELETE FROM docs_default WHERE collection = 'test_fix_verification'`);
    console.log('');
    console.log('🧹 Test data cleaned up');
  } catch (e) {
    // Ignore
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 2: Large Batch Test
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80));
  console.log('TEST 2: Large Batch (38 documents like user\'s case)');
  console.log('═'.repeat(80));
  console.log('');

  const largeBatch = Array.from({ length: 38 }, (_, i) => ({
    id: `large_test_${i + 1}`,
    title: `Large Batch Test ${i + 1}`,
    content: `Content ${i + 1}. `.repeat(200),
    metadata: { test: 'large_batch', index: i + 1 }
  }));

  console.log(`🔍 Inserting ${largeBatch.length} documents...`);
  const startLarge = Date.now();

  try {
    const results = await db.batchInsertDocuments({
      collection: 'test_large_batch',
      documents: largeBatch,
      options: { generateEmbedding: false }
    });

    const insertTime = Date.now() - startLarge;

    // Verify
    const verifyLarge = await db.execAsync(
      `SELECT COUNT(*) as count FROM docs_default WHERE collection = 'test_large_batch'`
    );
    const actualLarge = verifyLarge[0].values[0][0];

    console.log('');
    console.log('📊 LARGE BATCH RESULTS:');
    console.log(`   Expected: ${largeBatch.length}`);
    console.log(`   Actual:   ${actualLarge}`);
    console.log(`   Time:     ${insertTime}ms`);
    console.log(`   Speed:    ${(insertTime / largeBatch.length).toFixed(1)}ms per document`);
    console.log('');

    if (actualLarge === largeBatch.length) {
      console.log(`✅ LARGE BATCH SUCCESS! All ${largeBatch.length} documents persisted!`);
    } else {
      console.error(`❌ LARGE BATCH FAILED: Only ${actualLarge}/${largeBatch.length} persisted`);
    }

    // Clean up
    await db.execAsync(`DELETE FROM docs_default WHERE collection = 'test_large_batch'`);

  } catch (error) {
    console.error(`❌ Large batch failed: ${error.message}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEST 3: Rollback Test (Error Handling)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80));
  console.log('TEST 3: Transaction Rollback (Duplicate ID Error)');
  console.log('═'.repeat(80));
  console.log('');

  const rollbackDocs = [
    {
      id: 'rollback_test_1',
      content: 'Valid document 1',
      metadata: { test: 'rollback' }
    },
    {
      id: 'rollback_test_1', // DUPLICATE - will fail
      content: 'Invalid document',
      metadata: { test: 'rollback' }
    }
  ];

  console.log('🔍 Inserting documents with duplicate ID (should rollback)...');

  let errorCaught = false;
  try {
    await db.batchInsertDocuments({
      collection: 'test_rollback',
      documents: rollbackDocs,
      options: { generateEmbedding: false }
    });

    console.error('❌ ERROR: Should have failed but succeeded!');

  } catch (error) {
    errorCaught = true;
    console.log(`✅ Error caught as expected: ${error.message}`);
  }

  if (errorCaught) {
    // Verify rollback
    const rollbackVerify = await db.execAsync(
      `SELECT COUNT(*) as count FROM docs_default WHERE collection = 'test_rollback'`
    );
    const rollbackCount = rollbackVerify[0].values[0][0];

    console.log('');
    console.log('📊 ROLLBACK VERIFICATION:');
    console.log(`   Documents in DB: ${rollbackCount}`);
    console.log('');

    if (rollbackCount === 0) {
      console.log('✅ ROLLBACK SUCCESS! Transaction properly rolled back (0 documents)');
    } else {
      console.error(`❌ ROLLBACK FAILED! ${rollbackCount} documents leaked (should be 0)`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FINAL SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('\n' + '═'.repeat(80));
  console.log('📋 FIX VERIFICATION SUMMARY');
  console.log('═'.repeat(80));
  console.log('');
  console.log('Original Bug:');
  console.log('  ❌ batchInsertDocuments() showed "success" logs but data was lost');
  console.log('  ❌ Transaction on main thread, inserts on worker thread');
  console.log('  ❌ Two separate SQLite connections - transaction had no effect');
  console.log('');
  console.log('Fix Applied:');
  console.log('  ✅ Transaction moved to worker side (same connection as inserts)');
  console.log('  ✅ Worker handles BEGIN, INSERT, COMMIT on single connection');
  console.log('  ✅ Main thread just calls worker RPC method');
  console.log('');
  console.log('Expected Results:');
  console.log('  ✅ Data should persist correctly');
  console.log('  ✅ Batch operations should be atomic');
  console.log('  ✅ Errors should rollback cleanly');
  console.log('');
  console.log('═'.repeat(80));
  console.log('✅ VERIFICATION COMPLETE');
  console.log('═'.repeat(80));
  console.log('');
  console.log('💡 If fix is verified, you can now use batchInsertDocuments() safely!');

})();
