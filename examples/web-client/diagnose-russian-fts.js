/**
 * RUSSIAN FTS DIAGNOSTIC SCRIPT
 *
 * Run this in the browser console when the demo page is loaded:
 *
 * In the browser console, you can access the database via:
 * - window.demoInstance.db (if demo is initialized)
 *
 * Or copy/paste this entire script into console.
 */

(async function diagnoseRussianFTS() {
  console.log('%c=== RUSSIAN FTS DIAGNOSTIC ===', 'color: blue; font-weight: bold; font-size: 16px');
  console.log('');

  try {
    // Get database instance
    let db;
    if (typeof demoInstance !== 'undefined' && demoInstance.db) {
      db = demoInstance.db;
      console.log('✓ Found database via demoInstance.db');
    } else if (typeof window.demoInstance !== 'undefined' && window.demoInstance.db) {
      db = window.demoInstance.db;
      console.log('✓ Found database via window.demoInstance.db');
    } else {
      console.error('❌ Cannot find database instance!');
      console.log('Make sure the demo is loaded and initialized.');
      console.log('Try: await demoInstance.initializeDatabase()');
      return;
    }

    console.log('');

    // 1. Check schema version
    console.log('%c--- SCHEMA VERSION CHECK ---', 'color: green; font-weight: bold');
    try {
      const schemaResult = await db.execAsync(`
        SELECT schema_version, name
        FROM collections
        ORDER BY schema_version DESC
        LIMIT 1
      `);

      if (schemaResult[0]?.values && schemaResult[0].values.length > 0) {
        const schemaVersion = schemaResult[0].values[0][0];
        const collectionName = schemaResult[0].values[0][1];
        console.log(`Schema Version: ${schemaVersion}`);
        console.log(`Collection: ${collectionName}`);

        if (schemaVersion < 4) {
          console.log('%c⚠️  OLD SCHEMA DETECTED!', 'color: red; font-weight: bold');
          console.log(`   Current: v${schemaVersion}, Required: v4`);
          console.log('   Schema v4 adds unicode61 tokenizer for Russian/Cyrillic support');
        } else {
          console.log('✓ Schema is up-to-date (v4+)');
        }
      } else {
        console.warn('⚠️  No collections found - database may be new');
      }
    } catch (error) {
      console.error('❌ Failed to check schema version:', error.message);
    }
    console.log('');

    // 2. Check FTS5 table definition
    console.log('%c--- FTS5 TABLE CONFIGURATION ---', 'color: green; font-weight: bold');
    try {
      const ftsDefResult = await db.execAsync(`
        SELECT sql
        FROM sqlite_master
        WHERE type='table' AND name='fts_default'
      `);

      if (ftsDefResult[0]?.values && ftsDefResult[0].values.length > 0) {
        const ftsDefinition = ftsDefResult[0].values[0][0];
        console.log('FTS5 Table Definition:');
        console.log(ftsDefinition);
        console.log('');

        if (ftsDefinition.includes("tokenize='unicode61'") || ftsDefinition.includes('tokenize="unicode61"')) {
          console.log('✓ FTS5 has unicode61 tokenizer (supports Russian)');
        } else if (ftsDefinition.includes("tokenize='ascii'") || ftsDefinition.includes('tokenize="ascii"')) {
          console.log('%c❌ FTS5 using ASCII tokenizer!', 'color: red; font-weight: bold');
          console.log('   Russian text will NOT work with ASCII tokenizer');
        } else {
          console.log('%c❌ FTS5 using DEFAULT tokenizer (ASCII)!', 'color: red; font-weight: bold');
          console.log('   No tokenizer specified = defaults to ASCII');
          console.log('   Russian text will NOT work');
        }
      } else {
        console.error('❌ FTS5 table not found!');
      }
    } catch (error) {
      console.error('❌ Failed to check FTS5 definition:', error.message);
    }
    console.log('');

    // 3. Check document count
    console.log('%c--- DOCUMENT COUNT ---', 'color: green; font-weight: bold');
    try {
      const docsResult = await db.execAsync(`SELECT COUNT(*) as count FROM docs_default`);
      const docCount = docsResult[0]?.values[0]?.[0] || 0;
      console.log(`Total documents: ${docCount}`);

      const ftsResult = await db.execAsync(`SELECT COUNT(*) as count FROM fts_default`);
      const ftsCount = ftsResult[0]?.values[0]?.[0] || 0;
      console.log(`FTS indexed entries: ${ftsCount}`);

      if (docCount > 0 && ftsCount === 0) {
        console.log('%c⚠️  FTS INDEX IS EMPTY!', 'color: red; font-weight: bold');
        console.log('   Documents exist but are not indexed for search');
      }
    } catch (error) {
      console.error('❌ Failed to check document count:', error.message);
    }
    console.log('');

    // 4. Test Russian search queries
    console.log('%c--- RUSSIAN SEARCH TESTS ---', 'color: green; font-weight: bold');

    // First, check if we have Russian documents
    try {
      const russianDocsResult = await db.execAsync(`
        SELECT id, title
        FROM docs_default
        WHERE title LIKE '%Рус%' OR content LIKE '%Рус%'
        LIMIT 3
      `);

      if (russianDocsResult[0]?.values && russianDocsResult[0].values.length > 0) {
        console.log('✓ Found Russian documents:');
        russianDocsResult[0].values.forEach((row, idx) => {
          console.log(`  ${idx + 1}. ID: ${row[0]}, Title: ${row[1]}`);
        });
      } else {
        console.warn('⚠️  No Russian documents found in database');
        console.log('   Run: await demoInstance.populateTestData() to add test data');
      }
    } catch (error) {
      console.error('❌ Failed to find Russian documents:', error.message);
    }
    console.log('');

    // Test FTS queries with Russian text
    const testQueries = [
      'Пушкин',
      'литература',
      'Россия',
      'космос',
      'технологии'
    ];

    console.log('Testing FTS5 search with Russian queries:');
    for (const query of testQueries) {
      try {
        const result = await db.execAsync(`
          SELECT COUNT(*) as count
          FROM fts_default
          WHERE fts_default MATCH '${query}'
        `);
        const count = result[0]?.values[0]?.[0] || 0;

        if (count > 0) {
          console.log(`  ✓ "${query}": ${count} matches`);
        } else {
          console.log(`  ⚠️  "${query}": 0 matches`);
        }
      } catch (error) {
        console.log(`  %c❌ "${query}": ERROR - ${error.message}`, 'color: red');
      }
    }
    console.log('');

    // Final diagnosis
    console.log('%c=== DIAGNOSIS ===', 'color: blue; font-weight: bold; font-size: 14px');
    console.log('');

    // Check if we need to show the fix
    const schemaResult = await db.execAsync(`SELECT MAX(schema_version) as v FROM collections`);
    const currentSchema = schemaResult[0]?.values[0]?.[0] || 0;

    const ftsDefResult = await db.execAsync(`SELECT sql FROM sqlite_master WHERE name='fts_default'`);
    const ftsDefinition = ftsDefResult[0]?.values[0]?.[0] || '';
    const hasUnicode61 = ftsDefinition.includes('unicode61');

    if (currentSchema < 4 || !hasUnicode61) {
      console.log('%c❌ ROOT CAUSE: FTS5 MISSING UNICODE TOKENIZER', 'color: red; font-weight: bold');
      console.log('');
      console.log('Your database is using schema v' + currentSchema + ' with ASCII tokenizer.');
      console.log('Russian/Cyrillic text requires schema v4 with unicode61 tokenizer.');
      console.log('');
      console.log('%c=== SOLUTION ===', 'color: blue; font-weight: bold');
      console.log('');
      console.log('%c1. Clear the database:', 'font-weight: bold');
      console.log('   await db.clearAsync()');
      console.log('');
      console.log('%c2. Reload the page', 'font-weight: bold');
      console.log('   This will recreate the database with schema v4');
      console.log('');
      console.log('%c3. Re-populate test data:', 'font-weight: bold');
      console.log('   await demoInstance.populateTestData()');
      console.log('');
      console.log('%c4. Test Russian search:', 'font-weight: bold');
      console.log('   await demoInstance.performSearch("Пушкин")');
      console.log('');
      console.log('The new schema v4 will automatically use unicode61 tokenizer.');
    } else {
      console.log('✓ FTS5 configuration looks correct (unicode61 tokenizer)');
      console.log('');
      console.log('If search still fails, check:');
      console.log('  1. Documents are actually inserted (check document count above)');
      console.log('  2. FTS index is populated (should match document count)');
      console.log('  3. Search query syntax is correct');
    }

  } catch (error) {
    console.error('%c❌ DIAGNOSTIC ERROR', 'color: red; font-weight: bold');
    console.error(error);
    console.error('Stack:', error.stack);
  }

  console.log('');
  console.log('%c=== DIAGNOSTIC COMPLETE ===', 'color: blue; font-weight: bold; font-size: 16px');
})();
