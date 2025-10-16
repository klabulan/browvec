/**
 * CHECK FTS5 TOKENIZER CONFIGURATION
 *
 * Verify if FTS table is using unicode61 or ascii tokenizer
 */

(async function checkFTSTokenizer() {
  console.log('%c=== CHECK FTS TOKENIZER ===', 'color: blue; font-weight: bold; font-size: 16px');
  console.log('');

  const db = window.localRetrieveDemo?.db;
  if (!db) {
    console.error('❌ Database not found!');
    return;
  }

  try {
    // 1. Get the FTS table definition
    console.log('%c--- FTS TABLE DEFINITION ---', 'color: green; font-weight: bold');
    const tableDefResult = await db.execAsync(`
      SELECT sql
      FROM sqlite_master
      WHERE type='table' AND name='fts_default'
    `);

    if (tableDefResult[0]?.values?.length > 0) {
      const tableDef = tableDefResult[0].values[0][0];
      console.log('CREATE statement:');
      console.log(tableDef);
      console.log('');

      // Check tokenizer
      if (tableDef.includes("tokenize='unicode61'") || tableDef.includes('tokenize="unicode61"') || tableDef.includes('tokenize=unicode61')) {
        console.log('%c✓ FTS5 is using UNICODE61 tokenizer', 'color: green; font-weight: bold');
        console.log('  This SHOULD support Russian/Cyrillic text');
      } else if (tableDef.includes("tokenize='ascii'") || tableDef.includes('tokenize="ascii"') || tableDef.includes('tokenize=ascii')) {
        console.log('%c❌ FTS5 is using ASCII tokenizer!', 'color: red; font-weight: bold');
        console.log('  This DOES NOT support Russian/Cyrillic text');
        console.log('  You need to recreate the FTS table with unicode61');
      } else if (tableDef.includes('tokenize=')) {
        const tokenizerMatch = tableDef.match(/tokenize[=\s]*['"']?(\w+)['"']?/);
        console.log(`%c⚠️  FTS5 is using tokenizer: ${tokenizerMatch ? tokenizerMatch[1] : 'unknown'}`, 'color: orange; font-weight: bold');
      } else {
        console.log('%c❌ NO TOKENIZER SPECIFIED (defaults to ASCII)!', 'color: red; font-weight: bold');
        console.log('  Russian text will NOT work with default tokenizer');
        console.log('  You need to recreate the FTS table with unicode61');
      }
    } else {
      console.error('❌ fts_default table not found!');
    }
    console.log('');

    // 2. Check schema version
    console.log('%c--- SCHEMA VERSION ---', 'color: green; font-weight: bold');
    const schemaResult = await db.execAsync(`
      SELECT schema_version, name
      FROM collections
      ORDER BY schema_version DESC
      LIMIT 1
    `);

    if (schemaResult[0]?.values?.length > 0) {
      const schemaVersion = schemaResult[0].values[0][0];
      const collectionName = schemaResult[0].values[0][1];
      console.log(`Schema Version: ${schemaVersion}`);
      console.log(`Collection: ${collectionName}`);

      if (schemaVersion < 4) {
        console.log('%c⚠️  OLD SCHEMA DETECTED!', 'color: red; font-weight: bold');
        console.log(`   Current: v${schemaVersion}, Required: v4`);
        console.log('   Schema v4 adds unicode61 tokenizer');
      } else {
        console.log('✓ Schema is v4+ (should have unicode61)');
      }
    }
    console.log('');

    // 3. Test if tokenizer accepts Cyrillic
    console.log('%c--- TOKENIZER TEST ---', 'color: green; font-weight: bold');
    console.log('Testing if FTS tokenizer can process Cyrillic...');

    try {
      // Try to search with snippet function (forces tokenization)
      const testResult = await db.execAsync(`
        SELECT snippet(fts_default, 1, '<b>', '</b>', '...', 10) as snippet
        FROM fts_default
        WHERE fts_default MATCH 'Россия'
        LIMIT 1
      `);

      if (testResult[0]?.values?.length > 0) {
        console.log('%c✓ Tokenizer processed Cyrillic and found match!', 'color: green; font-weight: bold');
        console.log(`  Snippet: ${testResult[0].values[0][0]}`);
      } else {
        console.log('%c⚠️  No matches found', 'color: orange; font-weight: bold');
        console.log('  Either tokenizer cannot process Cyrillic OR text not indexed');
      }
    } catch (error) {
      console.log('%c❌ Tokenizer test failed', 'color: red; font-weight: bold');
      console.log(`  Error: ${error.message}`);
    }
    console.log('');

    // 4. Final diagnosis
    console.log('%c=== DIAGNOSIS ===', 'color: blue; font-weight: bold');
    console.log('');
    console.log('If FTS table is using ASCII tokenizer or no tokenizer:');
    console.log('→ You need to RECREATE the database with schema v4');
    console.log('');
    console.log('SOLUTION:');
    console.log('1. await db.clearAsync()');
    console.log('2. Reload the page (recreates with v4 schema)');
    console.log('3. Load sample data again');

  } catch (error) {
    console.error('%c❌ ERROR', 'color: red; font-weight: bold');
    console.error(error.message);
    console.error(error.stack);
  }

  console.log('');
  console.log('%c=== CHECK COMPLETE ===', 'color: blue; font-weight: bold; font-size: 16px');
})();
