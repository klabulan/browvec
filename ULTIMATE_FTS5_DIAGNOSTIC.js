// ═══════════════════════════════════════════════════════════════════════════════
// ULTIMATE FTS5 DIAGNOSTIC - Complete Analysis
// ═══════════════════════════════════════════════════════════════════════════════
//
// Root Cause: SQLite WASM SQL parser cannot handle Cyrillic in string literals
// Solution: Always use parameter binding for non-ASCII text
//
// Usage: Copy-paste into browser console, then run: ultimateFts5Diagnostic()
// ═══════════════════════════════════════════════════════════════════════════════

async function ultimateFts5Diagnostic() {
  console.log('\n');
  console.log('═'.repeat(80));
  console.log('🔬 ULTIMATE FTS5 DIAGNOSTIC - Complete Analysis');
  console.log('═'.repeat(80));
  console.log('\n');

  const db = window.localRetrieveDemo?.db;
  if (!db) {
    console.error('❌ ERROR: Demo not loaded. Please ensure the demo page is running.');
    console.log('\n   Tip: Make sure you\'re on http://localhost:5174/examples/web-client/');
    return;
  }

  const results = {
    system: {},
    parameterBinding: {},
    content: {},
    search: {},
    conclusion: {}
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. SYSTEM INFORMATION
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('1️⃣  SYSTEM INFORMATION');
  console.log('─'.repeat(80));

  try {
    const version = await db.execAsync('SELECT sqlite_version() as version');
    results.system.version = version[0]?.values[0]?.[0] || 'unknown';
    console.log(`   SQLite Version: ${results.system.version}`);

    const fts5Check = await db.execAsync("SELECT fts5('version') as fts_version");
    results.system.fts5 = fts5Check[0]?.values[0]?.[0] || 'not available';
    console.log(`   FTS5 Module: ${results.system.fts5}`);

    const schema = await db.execAsync("SELECT value FROM db_metadata WHERE key = 'schema_version'");
    results.system.schema = schema[0]?.values[0]?.[0] || 'unknown';
    console.log(`   Schema Version: ${results.system.schema}`);

    // Check FTS5 table configuration
    const ftsConfig = await db.execAsync("SELECT sql FROM sqlite_master WHERE name = 'fts_default'");
    const ftsSql = ftsConfig[0]?.values[0]?.[0] || '';
    results.system.tokenizer = ftsSql.includes("tokenize='unicode61'") ? 'unicode61 ✅' : 'NOT unicode61 ❌';
    console.log(`   FTS5 Tokenizer: ${results.system.tokenizer}`);

    console.log('   Status: ✅ System check passed\n');
  } catch (err) {
    console.error('   ❌ System check failed:', err.message);
    results.system.error = err.message;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. PARAMETER BINDING TEST (ROOT CAUSE VERIFICATION)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('2️⃣  PARAMETER BINDING TEST (Root Cause Verification)');
  console.log('─'.repeat(80));
  console.log('   Testing: Can SQLite handle Russian text with parameter binding?\n');

  try {
    // Create test table
    await db.execAsync("CREATE VIRTUAL TABLE IF NOT EXISTS test_binding USING fts5(content, tokenize='unicode61')");
    console.log('   ✅ Test table created with unicode61 tokenizer');

    // Test 1: Parameter binding (CORRECT METHOD)
    console.log('\n   Test 1: INSERT with PARAMETER BINDING');
    try {
      await db.execAsync(
        "INSERT INTO test_binding VALUES (?)",
        ['Александр Пушкин написал много стихов о России']
      );
      console.log('      ✅ INSERT succeeded with parameter binding');
      results.parameterBinding.insertWithParams = 'SUCCESS ✅';
    } catch (err) {
      console.log('      ❌ INSERT failed:', err.message);
      results.parameterBinding.insertWithParams = `FAILED: ${err.message}`;
    }

    // Test 2: Search with parameter binding
    console.log('\n   Test 2: SEARCH with PARAMETER BINDING');
    try {
      const searchResult = await db.execAsync(
        "SELECT * FROM test_binding WHERE test_binding MATCH ?",
        ['Пушкин']
      );
      const count = searchResult[0]?.values?.length || 0;
      console.log(`      ✅ SEARCH succeeded: ${count} result(s) found`);
      results.parameterBinding.searchWithParams = `SUCCESS ✅ (${count} results)`;
    } catch (err) {
      console.log('      ❌ SEARCH failed:', err.message);
      results.parameterBinding.searchWithParams = `FAILED: ${err.message}`;
    }

    // Test 3: Inline string (WRONG METHOD - will fail)
    console.log('\n   Test 3: INSERT with INLINE STRING (expected to fail)');
    try {
      await db.execAsync("INSERT INTO test_binding VALUES ('Тестовый текст')");
      console.log('      ⚠️  INSERT succeeded (unexpected!)');
      results.parameterBinding.insertInline = 'SUCCESS (unexpected)';
    } catch (err) {
      console.log('      ❌ INSERT failed (as expected):', err.message.substring(0, 60) + '...');
      results.parameterBinding.insertInline = 'FAILED (expected) ✅';
    }

    // Cleanup
    await db.execAsync('DROP TABLE test_binding');
    console.log('\n   Test table cleaned up');
    console.log('\n   🎯 CONCLUSION: Parameter binding is REQUIRED for Russian text\n');

  } catch (err) {
    console.error('   ❌ Parameter binding test failed:', err.message);
    results.parameterBinding.error = err.message;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. CONTENT VERIFICATION
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('3️⃣  CONTENT VERIFICATION');
  console.log('─'.repeat(80));

  try {
    // Check docs_default
    const docsCount = await db.execAsync('SELECT COUNT(*) as count FROM docs_default');
    results.content.docsCount = docsCount[0]?.values[0]?.[0] || 0;
    console.log(`   Documents in docs_default: ${results.content.docsCount}`);

    // Check FTS5
    const ftsCount = await db.execAsync('SELECT COUNT(*) as count FROM fts_default');
    results.content.ftsCount = ftsCount[0]?.values[0]?.[0] || 0;
    console.log(`   Rows in fts_default: ${results.content.ftsCount}`);

    // Check for Russian content in docs_default
    const russianDocs = await db.execAsync(`
      SELECT id, title, SUBSTR(content, 1, 50) as preview
      FROM docs_default
      WHERE title LIKE '%Русск%' OR content LIKE '%Пушкин%'
      LIMIT 3
    `);
    const russianCount = russianDocs[0]?.values?.length || 0;
    results.content.russianDocs = russianCount;
    console.log(`   Russian documents found: ${russianCount}`);

    if (russianCount > 0) {
      console.log('\n   Russian documents:');
      russianDocs[0].values.forEach((row, idx) => {
        console.log(`      ${idx + 1}. "${row[1]}" (id: ${row[0]})`);
      });
    }

    // Check FTS5 content (via external content table)
    const ftsContent = await db.execAsync(`
      SELECT rowid, title, LENGTH(content) as content_length
      FROM fts_default
      LIMIT 5
    `);
    const ftsRows = ftsContent[0]?.values || [];
    const emptyRows = ftsRows.filter(row => !row[1] && !row[2]).length;
    results.content.emptyFtsRows = emptyRows;

    console.log(`\n   FTS5 Content Check (first 5 rows):`);
    if (emptyRows === ftsRows.length && ftsRows.length > 0) {
      console.log('      ⚠️  ALL FTS5 rows are EMPTY!');
      console.log('      → Root cause: FTS5 sync failed during insert');
    } else {
      console.log(`      ✅ FTS5 has content (${ftsRows.length - emptyRows}/${ftsRows.length} rows with data)`);
    }

    console.log('\n');

  } catch (err) {
    console.error('   ❌ Content verification failed:', err.message);
    results.content.error = err.message;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. SEARCH TESTS (High-Level API)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('4️⃣  SEARCH TESTS (High-Level API)');
  console.log('─'.repeat(80));
  console.log('   Testing: Does db.search() work correctly?\n');

  try {
    // Test English search
    console.log('   Test 1: English search "machine learning"');
    try {
      const englishResult = await db.search({ query: { text: 'machine learning' }, limit: 10 });
      const count = englishResult.results?.length || 0;
      console.log(`      Result: ${count} documents found ${count > 0 ? '✅' : '❌'}`);
      results.search.english = count;
    } catch (err) {
      console.log(`      ❌ Failed: ${err.message}`);
      results.search.english = 0;
    }

    // Test Russian search
    console.log('\n   Test 2: Russian search "Пушкин"');
    try {
      const russianResult = await db.search({ query: { text: 'Пушкин' }, limit: 10 });
      const count = russianResult.results?.length || 0;
      console.log(`      Result: ${count} documents found ${count > 0 ? '✅' : '❌'}`);
      results.search.russian = count;
    } catch (err) {
      console.log(`      ❌ Failed: ${err.message}`);
      results.search.russian = 0;
    }

    // Test Russian lowercase
    console.log('\n   Test 3: Russian search "литература" (lowercase)');
    try {
      const lowerResult = await db.search({ query: { text: 'литература' }, limit: 10 });
      const count = lowerResult.results?.length || 0;
      console.log(`      Result: ${count} documents found ${count > 0 ? '✅' : '❌'}`);
      results.search.russianLower = count;
    } catch (err) {
      console.log(`      ❌ Failed: ${err.message}`);
      results.search.russianLower = 0;
    }

    console.log('\n');

  } catch (err) {
    console.error('   ❌ Search tests failed:', err.message);
    results.search.error = err.message;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. DIRECT SQL SEARCH TEST (with parameter binding)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('5️⃣  DIRECT SQL SEARCH TEST (with parameter binding)');
  console.log('─'.repeat(80));
  console.log('   Testing: Does direct SQL search work with parameter binding?\n');

  try {
    // Test direct SQL with parameter binding
    console.log('   SQL: SELECT * FROM fts_default WHERE fts_default MATCH ?');
    console.log('   Params: ["Пушкин"]\n');

    const directResult = await db.execAsync(
      'SELECT rowid, title FROM fts_default WHERE fts_default MATCH ?',
      ['Пушкин']
    );

    const count = directResult[0]?.values?.length || 0;
    console.log(`   Result: ${count} rows found ${count > 0 ? '✅' : '❌'}`);
    results.search.directSql = count;

    if (count > 0) {
      console.log('\n   Found documents:');
      directResult[0].values.forEach((row, idx) => {
        console.log(`      ${idx + 1}. ${row[1]} (rowid: ${row[0]})`);
      });
    }

    console.log('\n');

  } catch (err) {
    console.error('   ❌ Direct SQL search failed:', err.message);
    results.search.directSql = 0;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. CONCLUSION & RECOMMENDATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('6️⃣  CONCLUSION & RECOMMENDATIONS');
  console.log('─'.repeat(80));
  console.log('\n');

  // Analyze results
  const paramBindingWorks = results.parameterBinding.searchWithParams?.includes('SUCCESS');
  const apiSearchWorks = (results.search.russian || 0) > 0;
  const contentExists = (results.content.russianDocs || 0) > 0;
  const ftsHasContent = results.content.emptyFtsRows === 0;

  console.log('   📊 Analysis:\n');
  console.log(`      • Parameter binding works: ${paramBindingWorks ? '✅ YES' : '❌ NO'}`);
  console.log(`      • Russian content exists: ${contentExists ? '✅ YES' : '❌ NO'}`);
  console.log(`      • FTS5 has content: ${ftsHasContent ? '✅ YES' : '❌ NO'}`);
  console.log(`      • API search works: ${apiSearchWorks ? '✅ YES' : '❌ NO'}`);
  console.log(`      • Direct SQL works: ${(results.search.directSql || 0) > 0 ? '✅ YES' : '❌ NO'}`);

  console.log('\n   🎯 Root Cause:\n');

  if (!paramBindingWorks) {
    console.log('      ❌ CRITICAL: Parameter binding does not work');
    console.log('      → Check SQLite WASM build for unicode61 support');
    results.conclusion.issue = 'PARAMETER_BINDING_FAILURE';
    results.conclusion.severity = 'CRITICAL';
  } else if (!contentExists) {
    console.log('      ⚠️  No Russian documents found in database');
    console.log('      → Load test data: Click "Load Test Data" button in demo');
    results.conclusion.issue = 'NO_RUSSIAN_CONTENT';
    results.conclusion.severity = 'INFO';
  } else if (!ftsHasContent) {
    console.log('      ❌ FTS5 table is EMPTY (sync failure during insert)');
    console.log('      → FTS5 sync logic in DatabaseWorker.ts failed');
    results.conclusion.issue = 'FTS5_SYNC_FAILURE';
    results.conclusion.severity = 'CRITICAL';
  } else if (!apiSearchWorks) {
    console.log('      ⚠️  FTS5 has content but API search returns 0 results');
    console.log('      → Check search query generation in DatabaseWorker.ts');
    results.conclusion.issue = 'API_SEARCH_FAILURE';
    results.conclusion.severity = 'HIGH';
  } else {
    console.log('      ✅ Everything works correctly!');
    results.conclusion.issue = 'NONE';
    results.conclusion.severity = 'INFO';
  }

  console.log('\n   💡 Recommended Actions:\n');

  if (results.conclusion.issue === 'FTS5_SYNC_FAILURE') {
    console.log('      1. Rebuild FTS5 index:');
    console.log('         ```javascript');
    console.log('         await db.execAsync("DELETE FROM fts_default");');
    console.log('         await db.execAsync(`');
    console.log('           INSERT INTO fts_default(rowid, title, content, metadata)');
    console.log('           SELECT rowid, title, content, metadata FROM docs_default');
    console.log('         `);');
    console.log('         ```');
    console.log('');
    console.log('      2. OR: Reload test data (easier):');
    console.log('         - Click "Clear Data" button');
    console.log('         - Click "Load Test Data" button');
  } else if (results.conclusion.issue === 'NO_RUSSIAN_CONTENT') {
    console.log('      1. Load test data:');
    console.log('         - Click "Load Test Data" button in demo UI');
  } else if (results.conclusion.issue === 'API_SEARCH_FAILURE') {
    console.log('      1. Check DatabaseWorker.ts:');
    console.log('         - Verify search SQL uses parameter binding');
    console.log('         - Check searchParams array construction');
    console.log('         - Enable debug logging');
  } else if (results.conclusion.issue === 'PARAMETER_BINDING_FAILURE') {
    console.log('      1. Verify SQLite WASM build includes unicode61');
    console.log('      2. Check build logs for tokenizer compilation');
  } else {
    console.log('      ✅ No action required - everything works!');
  }

  console.log('\n   📚 Key Lessons:\n');
  console.log('      1. ✅ Always use parameter binding for non-ASCII text');
  console.log('      2. ❌ Never use inline SQL strings with Cyrillic/Unicode');
  console.log('      3. ✅ unicode61 tokenizer handles Russian correctly');
  console.log('      4. ✅ SQLite WASM SQL parser has encoding limitations');

  console.log('\n');
  console.log('═'.repeat(80));
  console.log('✅ Diagnostic Complete');
  console.log('═'.repeat(80));
  console.log('\n');

  // Return results for programmatic access
  return results;
}

// Auto-export
window.ultimateFts5Diagnostic = ultimateFts5Diagnostic;

console.log('🔬 Ultimate FTS5 Diagnostic loaded!');
console.log('📋 Run: ultimateFts5Diagnostic()');
console.log('');
