/**
 * BROWSER CONSOLE DIAGNOSTIC SCRIPT
 *
 * Copy and paste this entire script into the R7 Office browser console
 * to diagnose why search returns no results.
 *
 * Prerequisites: Database must already be open in R7 plugin
 */

(async function diagnoseDatabaseState() {
  console.log('%c=== DATABASE STATE DIAGNOSTIC ===', 'color: blue; font-weight: bold; font-size: 16px');
  console.log('');

  try {
    // Try to get DB instance from global scope
    let db;

    if (typeof window.storageManager !== 'undefined' && window.storageManager.db) {
      db = window.storageManager.db;
      console.log('✓ Found database via window.storageManager.db');
    } else if (typeof window.db !== 'undefined') {
      db = window.db;
      console.log('✓ Found database via window.db');
    } else {
      console.error('❌ Cannot find database instance!');
      console.log('Available global objects:', Object.keys(window).filter(k => k.includes('db') || k.includes('storage')));
      return;
    }

    console.log('');

    // Check available methods
    console.log('%c--- DATABASE METHODS ---', 'color: green; font-weight: bold');
    const dbMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(db)).filter(m => typeof db[m] === 'function');
    console.log('Available methods:', dbMethods.join(', '));
    console.log('');

    // Check docs_default table (USE ASYNC!)
    console.log('%c--- DOCS_DEFAULT (Raw Documents) ---', 'color: green; font-weight: bold');
    const docsResult = await db.execAsync(`
      SELECT
        collection,
        COUNT(*) as count,
        SUM(LENGTH(content)) as total_bytes
      FROM docs_default
      GROUP BY collection
    `);

    if (docsResult[0]?.values && docsResult[0].values.length > 0) {
      const docsByCollection = {};
      docsResult[0].values.forEach(row => {
        docsByCollection[row[0]] = { count: row[1], bytes: row[2] };
      });
      console.table(docsByCollection);
    } else {
      console.warn('⚠️  No documents found in docs_default!');
    }
    console.log('');

    // Sample 3 documents from chunks
    console.log('%c--- SAMPLE DOCUMENTS (chunks collection) ---', 'color: green; font-weight: bold');
    const sampleDocs = await db.execAsync(`
      SELECT
        id,
        title,
        substr(content, 1, 80) as content_preview,
        LENGTH(content) as content_length
      FROM docs_default
      WHERE collection = 'chunks'
      LIMIT 3
    `);

    if (sampleDocs[0]?.values && sampleDocs[0].values.length > 0) {
      sampleDocs[0].values.forEach((row, idx) => {
        console.log(`%c${idx + 1}. Document`, 'font-weight: bold');
        console.log(`   ID: ${row[0]}`);
        console.log(`   Title: ${row[1] || 'N/A'}`);
        console.log(`   Content: ${row[2]}...`);
        console.log(`   Length: ${row[3]} chars`);
        console.log('');
      });
    } else {
      console.warn('⚠️  No documents in "chunks" collection!');
    }
    console.log('');

    // Check FTS5 index
    console.log('%c--- FTS5 INDEX (Full-Text Search) ---', 'color: green; font-weight: bold');
    const ftsResult = await db.execAsync(`
      SELECT COUNT(*) as fts_count
      FROM fts_default
    `);
    const ftsCount = ftsResult[0]?.values[0]?.[0] || 0;
    console.log(`FTS5 indexed entries: ${ftsCount}`);

    if (ftsCount === 0) {
      console.log('%c⚠️  FTS5 INDEX IS EMPTY!', 'color: red; font-weight: bold');
      console.log('   → Text search will return 0 results');
      console.log('   → This is why your search fails');
    } else {
      console.log('✓ FTS5 index has entries');
    }
    console.log('');

    // Test FTS5 search with actual query
    console.log('%c--- FTS5 SEARCH TEST ---', 'color: green; font-weight: bold');
    const testQueries = [
      'корпорац OR банк',  // Russian
      'корпорация',         // Single word
      'назначение'          // Another word from your search
    ];

    for (const testQuery of testQueries) {
      try {
        const ftsSearchResult = await db.execAsync(`
          SELECT COUNT(*) as match_count
          FROM fts_default
          WHERE fts_default MATCH '${testQuery}'
        `);
        const matchCount = ftsSearchResult[0]?.values[0]?.[0] || 0;
        console.log(`Query "${testQuery}": ${matchCount} matches`);
      } catch (error) {
        console.log(`Query "${testQuery}": ERROR - ${error.message}`);
      }
    }
    console.log('');

    // Check vector index
    console.log('%c--- VECTOR INDEX (Semantic Search) ---', 'color: green; font-weight: bold');
    const vecResult = await db.execAsync(`
      SELECT COUNT(*) as vec_count
      FROM vec_default_dense
    `);
    const vecCount = vecResult[0]?.values[0]?.[0] || 0;
    console.log(`Vector embeddings: ${vecCount}`);

    if (vecCount === 0) {
      console.log('%c⚠️  VECTOR INDEX IS EMPTY!', 'color: red; font-weight: bold');
      console.log('   → Semantic/vector search will fail');
      console.log('   → enableEmbedding: true will not work');
    } else {
      console.log('✓ Vector index has embeddings');
    }
    console.log('');

    // Check embedding queue
    console.log('%c--- EMBEDDING QUEUE ---', 'color: green; font-weight: bold');
    const queueResult = await db.execAsync(`
      SELECT
        status,
        COUNT(*) as count
      FROM embedding_queue
      GROUP BY status
    `);

    if (queueResult[0]?.values && queueResult[0].values.length > 0) {
      const queueStats = {};
      queueResult[0].values.forEach(row => {
        queueStats[row[0]] = row[1];
      });
      console.table(queueStats);
    } else {
      console.log('Queue is empty');
    }
    console.log('');

    // Final diagnosis
    console.log('%c=== DIAGNOSIS ===', 'color: blue; font-weight: bold; font-size: 16px');
    console.log('');

    const totalDocs = docsResult[0]?.values?.reduce((sum, row) => sum + row[1], 0) || 0;
    const chunksDocs = docsResult[0]?.values?.find(row => row[0] === 'chunks')?.[1] || 0;

    if (totalDocs === 0) {
      console.log('%c❌ ROOT CAUSE: NO DOCUMENTS', 'color: red; font-weight: bold');
      console.log('The database is empty. You need to import/index documents first.');
    } else if (chunksDocs === 0) {
      console.log('%c❌ ROOT CAUSE: NO DOCUMENTS IN "chunks" COLLECTION', 'color: red; font-weight: bold');
      console.log(`Total docs: ${totalDocs}, but none in "chunks" collection`);
      console.log('Your search is looking in "chunks" but documents are in a different collection.');
    } else if (ftsCount === 0) {
      console.log('%c❌ ROOT CAUSE: FTS5 INDEX IS EMPTY', 'color: red; font-weight: bold');
      console.log('');
      console.log('WHY: Database was created before the FTS5 manual sync fix.');
      console.log('     The old triggers were removed, but index was never rebuilt.');
      console.log('');
      console.log('SOLUTION - Option 1 (RECOMMENDED): Recreate database');
      console.log('  1. Export data if needed');
      console.log('  2. await db.clearAsync()');
      console.log('  3. Re-import documents (FTS5 will be populated automatically)');
      console.log('');
      console.log('SOLUTION - Option 2: Manually rebuild FTS5 index');
      console.log('  Run this in console:');
      console.log('  %cawait db.execAsync("INSERT INTO fts_default(fts_default) VALUES(\'rebuild\')")', 'background: #222; color: #0f0; padding: 5px; font-family: monospace');
      console.log('  Then test search again');
    } else if (vecCount === 0) {
      console.log('%c⚠️  PARTIAL PROBLEM: Vectors missing', 'color: orange; font-weight: bold');
      console.log('');
      console.log('Text search should work, but semantic search (enableEmbedding) will fail.');
      console.log('');
      console.log('SOLUTION: Generate embeddings');
      console.log('  %cawait db.processEmbeddingQueue({ collection: \'chunks\' })', 'background: #222; color: #0f0; padding: 5px; font-family: monospace');
    } else {
      console.log('%c✓ DATABASE STATE LOOKS GOOD', 'color: green; font-weight: bold');
      console.log('');
      console.log('If search still returns 0 results, check:');
      console.log('  1. Query language/tokenization (Russian text may need specific FTS5 tokenizer)');
      console.log('  2. Collection name in search params');
      console.log('  3. minScore threshold (try 0 or remove filter)');
    }

    console.log('');
    console.log('%c=== QUICK ACTIONS ===', 'color: blue; font-weight: bold');
    console.log('');
    console.log('Rebuild FTS5 index:');
    console.log('  %cawait db.execAsync("INSERT INTO fts_default(fts_default) VALUES(\'rebuild\')")', 'background: #222; color: #0f0; padding: 5px; font-family: monospace');
    console.log('');
    console.log('Test search after rebuild:');
    console.log('  %cawait db.search({ query: { text: "корпорация" }, collection: "chunks", limit: 5 })', 'background: #222; color: #0f0; padding: 5px; font-family: monospace');
    console.log('');
    console.log('Generate embeddings:');
    console.log('  %cawait db.processEmbeddingQueue({ collection: "chunks" })', 'background: #222; color: #0f0; padding: 5px; font-family: monospace');

  } catch (error) {
    console.error('%c❌ ERROR DURING DIAGNOSIS', 'color: red; font-weight: bold');
    console.error(error);
    console.error('Stack:', error.stack);
  }

  console.log('');
  console.log('%c=== DIAGNOSTIC COMPLETE ===', 'color: blue; font-weight: bold; font-size: 16px');
})();
