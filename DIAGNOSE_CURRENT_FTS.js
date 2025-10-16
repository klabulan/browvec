// DIAGNOSE CURRENT FTS STATE
// Copy this entire script and paste into the browser console at http://localhost:5174/examples/web-client/

async function diagnoseFTS() {
  console.log('🔍 DIAGNOSING FTS STATE...\n');

  const db = window.localRetrieveDemo?.db;
  if (!db) {
    console.error('❌ Demo not loaded. Make sure demo is initialized.');
    return;
  }

  try {
    // 1. Check schema version
    console.log('1️⃣ SCHEMA VERSION:');
    const version = await db.execAsync('PRAGMA user_version');
    console.log('   Version:', version[0]?.values[0]?.[0]);

    // 2. Check FTS tokenizer
    console.log('\n2️⃣ FTS TOKENIZER:');
    const tokenizer = await db.execAsync(`
      SELECT sql FROM sqlite_master
      WHERE type='table' AND name='fts_default'
    `);
    console.log('   FTS Table DDL:', tokenizer[0]?.values[0]?.[0]);

    // 3. Check row counts
    console.log('\n3️⃣ ROW COUNTS:');
    const docsCount = await db.execAsync('SELECT COUNT(*) as count FROM docs_default');
    const ftsCount = await db.execAsync('SELECT COUNT(*) as count FROM fts_default');

    const docs = docsCount[0]?.values[0]?.[0] || 0;
    const fts = ftsCount[0]?.values[0]?.[0] || 0;

    console.log('   docs_default:', docs, 'rows');
    console.log('   fts_default:', fts, 'rows');
    console.log('   Match:', docs === fts ? '✅ 1:1 MAPPING' : `❌ MISMATCH! ${docs - fts} docs missing from FTS`);

    // 4. Check Russian docs specifically
    console.log('\n4️⃣ RUSSIAN DOCUMENTS IN docs_default:');
    const russianDocs = await db.execAsync(`
      SELECT rowid, id, title
      FROM docs_default
      WHERE title LIKE '%Пушкин%' OR title LIKE '%Космос%' OR title LIKE '%Технологии%'
      ORDER BY rowid
    `);

    if (russianDocs[0]?.values?.length > 0) {
      russianDocs[0].values.forEach(row => {
        console.log(`   rowid ${row[0]}: ${row[2]} (id: ${row[1]})`);
      });
    } else {
      console.log('   ❌ No Russian docs found in docs_default');
    }

    // 5. Check if Russian docs are in FTS
    console.log('\n5️⃣ RUSSIAN DOCUMENTS IN fts_default:');
    const russianFTS = await db.execAsync(`
      SELECT rowid, title
      FROM fts_default
      WHERE title MATCH 'Пушкин OR Космос OR Технологии'
    `);

    if (russianFTS[0]?.values?.length > 0) {
      russianFTS[0].values.forEach(row => {
        console.log(`   rowid ${row[0]}: ${row[1]}`);
      });
    } else {
      console.log('   ❌ No Russian docs found in fts_default');
    }

    // 6. Try actual Russian search
    console.log('\n6️⃣ RUSSIAN SEARCH TEST:');
    try {
      const searchResult = await db.execAsync(`
        SELECT rowid, title, content
        FROM fts_default
        WHERE fts_default MATCH 'Пушкин'
      `);

      if (searchResult[0]?.values?.length > 0) {
        console.log('   ✅ Search for "Пушкин" returned', searchResult[0].values.length, 'results');
        searchResult[0].values.forEach(row => {
          console.log(`      rowid ${row[0]}: ${row[1]}`);
        });
      } else {
        console.log('   ❌ Search for "Пушкин" returned 0 results');
      }
    } catch (err) {
      console.error('   ❌ Search failed:', err.message);
    }

    // 7. Check if fix is in place (verification queries exist)
    console.log('\n7️⃣ CHECK IF FIX IS DEPLOYED:');
    console.log('   To verify the fix is deployed, check if batchInsertDocuments');
    console.log('   has FTS verification queries. This requires checking source code.');
    console.log('   Run: npm run build:sdk');
    console.log('   Then reload this page.');

    // 8. Summary
    console.log('\n📊 SUMMARY:');
    console.log('   Schema version:', version[0]?.values[0]?.[0] === 4 ? '✅ v4 (unicode61)' : '❌ Not v4');
    console.log('   Row count match:', docs === fts ? '✅ All docs indexed' : `❌ ${docs - fts} docs missing`);
    console.log('   Russian search:', russianFTS[0]?.values?.length > 0 ? '✅ Works' : '❌ Broken');

    if (docs !== fts || russianFTS[0]?.values?.length === 0) {
      console.log('\n🔧 RECOMMENDED ACTIONS:');
      console.log('   1. Run: npm run build:sdk');
      console.log('   2. Reload this page');
      console.log('   3. Run: await db.clearAsync()');
      console.log('   4. Run: await demoInstance.populateTestData()');
      console.log('   5. Run this diagnostic again');
    }

  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
  }
}

// Auto-run
diagnoseFTS();
