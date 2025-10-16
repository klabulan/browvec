// COMPREHENSIVE SEARCH DIAGNOSTIC FOR RUSSIAN TEXT
// This script performs a complete diagnosis of FTS5 configuration and search functionality

async function comprehensiveSearchDiagnostic() {
  console.log('🔬 COMPREHENSIVE SEARCH DIAGNOSTIC\n');
  console.log('='.repeat(80));

  const db = window.localRetrieveDemo?.db;
  if (!db) {
    console.error('❌ Demo not loaded. Please load the demo first.');
    return;
  }

  const results = {
    schemaVersion: null,
    tokenizerConfig: null,
    dataPresence: {},
    searchTests: {},
    recommendations: []
  };

  try {
    // ==========================
    // 1. CHECK SCHEMA VERSION
    // ==========================
    console.log('\n1️⃣ SCHEMA VERSION CHECK');
    console.log('-'.repeat(80));

    try {
      const schemaResult = await db.execAsync('SELECT MAX(schema_version) as version FROM collections');
      results.schemaVersion = schemaResult[0]?.values[0]?.[0];
      console.log(`   Current schema version: ${results.schemaVersion}`);

      if (results.schemaVersion < 4) {
        console.log('   ⚠️  WARNING: Schema version < 4 does not have unicode61 tokenizer!');
        results.recommendations.push('CRITICAL: Upgrade to schema v4 by exporting data, clearing database, and reimporting');
      } else {
        console.log('   ✅ Schema version 4+ detected (should have unicode61)');
      }
    } catch (err) {
      console.log('   ❌ Could not determine schema version:', err.message);
    }

    // ==========================
    // 2. CHECK FTS5 TOKENIZER CONFIGURATION
    // ==========================
    console.log('\n2️⃣ FTS5 TOKENIZER CONFIGURATION');
    console.log('-'.repeat(80));

    try {
      const ftsSchema = await db.execAsync("SELECT sql FROM sqlite_master WHERE name='fts_default'");
      const ddl = ftsSchema[0]?.values[0]?.[0] || '';
      results.tokenizerConfig = ddl;

      console.log('   FTS5 DDL:');
      console.log('   ' + ddl.split('\n').join('\n   '));

      const hasUnicode61 = ddl.includes('unicode61');
      const hasRemoveDiacritics = ddl.includes('remove_diacritics');

      console.log(`\n   Tokenizer analysis:`);
      console.log(`   - Has unicode61: ${hasUnicode61 ? '✅' : '❌'}`);
      console.log(`   - Has remove_diacritics: ${hasRemoveDiacritics ? '✅' : '❌'}`);

      if (!hasUnicode61) {
        console.log('   ❌ PROBLEM: FTS5 is using default (ASCII) tokenizer!');
        results.recommendations.push('CRITICAL: FTS5 table needs to be recreated with unicode61 tokenizer');
      }
    } catch (err) {
      console.log('   ❌ Could not read FTS5 schema:', err.message);
    }

    // ==========================
    // 3. CHECK DATA PRESENCE
    // ==========================
    console.log('\n3️⃣ DATA PRESENCE CHECK');
    console.log('-'.repeat(80));

    // Check docs_default
    try {
      const docsCount = await db.execAsync('SELECT COUNT(*) as count FROM docs_default');
      results.dataPresence.docs_default = docsCount[0]?.values[0]?.[0] || 0;
      console.log(`   docs_default: ${results.dataPresence.docs_default} documents`);
    } catch (err) {
      console.log('   ❌ docs_default error:', err.message);
    }

    // Check fts_default
    try {
      const ftsCount = await db.execAsync('SELECT COUNT(*) as count FROM fts_default');
      results.dataPresence.fts_default = ftsCount[0]?.values[0]?.[0] || 0;
      console.log(`   fts_default: ${results.dataPresence.fts_default} indexed documents`);

      if (results.dataPresence.docs_default !== results.dataPresence.fts_default) {
        console.log(`   ⚠️  WARNING: Mismatch! ${results.dataPresence.docs_default - results.dataPresence.fts_default} documents not in FTS index`);
        results.recommendations.push('WARNING: FTS index is out of sync with docs_default table');
      }
    } catch (err) {
      console.log('   ❌ fts_default error:', err.message);
    }

    // Check Russian content
    try {
      const russianDocs = await db.execAsync(`
        SELECT rowid, title, SUBSTR(content, 1, 50) as content_preview
        FROM fts_default
        WHERE title LIKE '%Русс%' OR content LIKE '%Пушкин%'
        LIMIT 5
      `);
      results.dataPresence.russianDocsInFTS = russianDocs[0]?.values?.length || 0;
      console.log(`   Russian documents in FTS: ${results.dataPresence.russianDocsInFTS}`);

      if (results.dataPresence.russianDocsInFTS > 0) {
        console.log('   ✅ Russian text IS present in FTS5 table');
        russianDocs[0].values.forEach(row => {
          console.log(`      rowid ${row[0]}: "${row[1]}"`);
        });
      } else {
        console.log('   ❌ NO Russian text found in FTS5 table!');
      }
    } catch (err) {
      console.log('   ❌ Russian content check error:', err.message);
    }

    // ==========================
    // 4. SEARCH FUNCTIONALITY TESTS
    // ==========================
    console.log('\n4️⃣ SEARCH FUNCTIONALITY TESTS');
    console.log('-'.repeat(80));

    const searchTests = [
      { name: 'English: "machine learning"', query: 'machine learning', expected: true },
      { name: 'English: "database"', query: 'database', expected: true },
      { name: 'Russian: "Пушкин"', query: 'Пушкин', expected: true },
      { name: 'Russian lowercase: "пушкин"', query: 'пушкин', expected: true },
      { name: 'Russian: "литература"', query: 'литература', expected: true },
      { name: 'Russian: "Толстой"', query: 'Толстой', expected: true },
      { name: 'Russian: "Россия"', query: 'Россия', expected: true },
      { name: 'Russian: "космос"', query: 'космос', expected: true },
      { name: 'Russian: "наука"', query: 'наука', expected: true },
      { name: 'Partial: "Пушк*"', query: 'Пушк*', expected: false }, // FTS5 prefix search
      { name: 'Partial: "Толст*"', query: 'Толст*', expected: false }  // FTS5 prefix search
    ];

    for (const test of searchTests) {
      try {
        const result = await db.execAsync(`
          SELECT COUNT(*) as count
          FROM fts_default
          WHERE fts_default MATCH ?
        `, [test.query]);

        const count = result[0]?.values[0]?.[0] || 0;
        const passed = count > 0;
        results.searchTests[test.name] = { query: test.query, count, passed };

        const status = passed ? '✅' : '❌';
        const expectation = test.expected ? '(expected to work)' : '(partial search test)';
        console.log(`   ${status} ${test.name}: ${count} results ${expectation}`);

        if (!passed && test.expected) {
          results.recommendations.push(`SEARCH FAILED: "${test.query}" returned 0 results but should work`);
        }
      } catch (err) {
        console.log(`   ❌ ${test.name}: ERROR - ${err.message}`);
        results.searchTests[test.name] = { query: test.query, error: err.message };
      }
    }

    // ==========================
    // 5. COMPARE MATCH vs LIKE
    // ==========================
    console.log('\n5️⃣ MATCH vs LIKE COMPARISON (Root Cause Identification)');
    console.log('-'.repeat(80));

    const testWord = 'Пушкин';

    try {
      // Test LIKE (works directly on text, no tokenizer)
      const likeResult = await db.execAsync(`
        SELECT COUNT(*) as count FROM fts_default WHERE title LIKE ?
      `, [`%${testWord}%`]);
      const likeCount = likeResult[0]?.values[0]?.[0] || 0;

      // Test MATCH (uses FTS5 tokenizer)
      const matchResult = await db.execAsync(`
        SELECT COUNT(*) as count FROM fts_default WHERE fts_default MATCH ?
      `, [testWord]);
      const matchCount = matchResult[0]?.values[0]?.[0] || 0;

      console.log(`   Testing with word: "${testWord}"`);
      console.log(`   LIKE '%${testWord}%': ${likeCount} results`);
      console.log(`   MATCH '${testWord}': ${matchCount} results`);

      if (likeCount > 0 && matchCount === 0) {
        console.log('\n   🔍 ROOT CAUSE IDENTIFIED:');
        console.log('   Text EXISTS in FTS5 table (LIKE works)');
        console.log('   But MATCH fails (tokenizer issue)');
        console.log('   → Tokenizer is not processing Cyrillic correctly!');
        results.recommendations.push('ROOT CAUSE: Tokenizer not processing Cyrillic - needs unicode61 with proper config');
      } else if (likeCount === 0 && matchCount === 0) {
        console.log('\n   🔍 ROOT CAUSE IDENTIFIED:');
        console.log('   Text does NOT exist in FTS5 table');
        console.log('   → FTS5 index not synced or data not inserted');
        results.recommendations.push('ROOT CAUSE: Data not in FTS5 table - sync issue');
      } else if (matchCount > 0) {
        console.log('\n   ✅ SEARCH WORKING: Both LIKE and MATCH return results');
      }
    } catch (err) {
      console.log(`   ❌ Comparison test error: ${err.message}`);
    }

    // ==========================
    // 6. TOKENIZER OPTIONS ANALYSIS
    // ==========================
    console.log('\n6️⃣ TOKENIZER OPTIONS FOR PARTIAL SEARCH');
    console.log('-'.repeat(80));

    console.log(`\n   Current: tokenize='unicode61'`);
    console.log(`   \n   Options for better search:`);
    console.log(`   \n   A. tokenize='unicode61'`);
    console.log(`      ✅ Handles Cyrillic, CJK, Arabic`);
    console.log(`      ✅ Case-insensitive`);
    console.log(`      ❌ No built-in partial word search`);
    console.log(`      💡 Use FTS5 prefix operator: "Пушк*" for partial search`);

    console.log(`   \n   B. tokenize='unicode61 remove_diacritics 1'`);
    console.log(`      ✅ Everything from (A)`);
    console.log(`      ✅ Removes accents (Ё→Е, etc.)`);
    console.log(`      ⚠️  May affect search precision`);
    console.log(`      💡 Better for fuzzy matching`);

    console.log(`   \n   C. Use trigrams for partial search`);
    console.log(`      ✅ True substring search`);
    console.log(`      ❌ Requires FTS5 rebuild with 'trigram' tokenizer`);
    console.log(`      ❌ Much larger index size`);
    console.log(`      💡 Best for autocomplete/fuzzy search`);

    console.log(`   \n   RECOMMENDATION:`);
    console.log(`   - For standard search: unicode61 (current) is GOOD`);
    console.log(`   - For accent-insensitive: add remove_diacritics 1`);
    console.log(`   - For partial words: use FTS5 prefix operator "word*"`);
    console.log(`   - For true substring: consider trigrams (heavier)`);

    // ==========================
    // SUMMARY & RECOMMENDATIONS
    // ==========================
    console.log('\n\n' + '='.repeat(80));
    console.log('📊 DIAGNOSTIC SUMMARY');
    console.log('='.repeat(80));

    console.log(`\nSchema Version: ${results.schemaVersion || 'UNKNOWN'}`);
    console.log(`Tokenizer: ${results.tokenizerConfig.includes('unicode61') ? 'unicode61 ✅' : 'ASCII (default) ❌'}`);
    console.log(`Documents in docs_default: ${results.dataPresence.docs_default || 0}`);
    console.log(`Documents in fts_default: ${results.dataPresence.fts_default || 0}`);
    console.log(`Russian docs in FTS: ${results.dataPresence.russianDocsInFTS || 0}`);

    const passedTests = Object.values(results.searchTests).filter(t => t.passed).length;
    const totalTests = Object.keys(results.searchTests).length;
    console.log(`\nSearch tests passed: ${passedTests}/${totalTests}`);

    if (results.recommendations.length > 0) {
      console.log(`\n\n🔧 RECOMMENDATIONS (${results.recommendations.length}):`);
      results.recommendations.forEach((rec, idx) => {
        console.log(`\n${idx + 1}. ${rec}`);
      });
    } else {
      console.log('\n✅ NO ISSUES FOUND - Search is working correctly!');
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ Diagnostic complete');
    console.log('='.repeat(80));

    return results;

  } catch (error) {
    console.error('\n❌ Diagnostic failed:', error);
    console.error(error.stack);
    return results;
  }
}

// Auto-run and export
window.comprehensiveSearchDiagnostic = comprehensiveSearchDiagnostic;
console.log('🔬 Comprehensive search diagnostic loaded. Run: comprehensiveSearchDiagnostic()');

// Auto-run
comprehensiveSearchDiagnostic().then(results => {
  console.log('\n📦 Diagnostic results stored in window.lastDiagnosticResults');
  window.lastDiagnosticResults = results;
});
