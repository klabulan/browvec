// DIAGNOSE RUSSIAN SEARCH QUERIES
// The issue: Russian texts ARE in fts_default, but MATCH queries don't work

async function diagnoseRussianSearch() {
  console.log('🔍 DIAGNOSING RUSSIAN SEARCH QUERIES...\n');

  const db = window.localRetrieveDemo?.db;
  if (!db) {
    console.error('❌ Demo not loaded');
    return;
  }

  try {
    // 1. Verify Russian texts ARE in fts_default
    console.log('1️⃣ CHECK: Russian texts in fts_default');
    const ftsRows = await db.execAsync(`
      SELECT rowid, title, content FROM fts_default LIMIT 20
    `);

    let russianCount = 0;
    ftsRows[0]?.values?.forEach(row => {
      const title = row[1] || '';
      const content = row[2] || '';
      const hasRussian = /[А-Яа-яЁё]/.test(title + content);
      if (hasRussian) {
        russianCount++;
        console.log(`   ✅ rowid ${row[0]}: "${title.substring(0, 50)}..."`);
      }
    });
    console.log(`   Total Russian docs in FTS: ${russianCount}`);

    if (russianCount === 0) {
      console.error('   ❌ NO Russian texts found in fts_default!');
      return;
    }

    // 2. Check tokenizer configuration
    console.log('\n2️⃣ FTS TOKENIZER CONFIG:');
    const ftsSchema = await db.execAsync(`
      SELECT sql FROM sqlite_master WHERE name='fts_default'
    `);
    const ddl = ftsSchema[0]?.values[0]?.[0] || '';
    console.log('   DDL:', ddl);

    const hasUnicode61 = ddl.includes('unicode61');
    console.log('   Has unicode61:', hasUnicode61 ? '✅' : '❌');

    // 3. Test different search syntaxes
    console.log('\n3️⃣ TEST SEARCH SYNTAXES:');

    // Test 1: Direct MATCH
    console.log('\n   Test 1: Direct MATCH with Russian word');
    try {
      const r1 = await db.execAsync(`
        SELECT rowid, title FROM fts_default WHERE fts_default MATCH 'Пушкин'
      `);
      console.log(`   Result: ${r1[0]?.values?.length || 0} rows`);
      if (r1[0]?.values?.length > 0) {
        r1[0].values.forEach(row => console.log(`      rowid ${row[0]}: ${row[1]}`));
      }
    } catch (err) {
      console.error('   ❌ Error:', err.message);
    }

    // Test 2: Lowercase
    console.log('\n   Test 2: Lowercase Russian word');
    try {
      const r2 = await db.execAsync(`
        SELECT rowid, title FROM fts_default WHERE fts_default MATCH 'пушкин'
      `);
      console.log(`   Result: ${r2[0]?.values?.length || 0} rows`);
    } catch (err) {
      console.error('   ❌ Error:', err.message);
    }

    // Test 3: Column-specific search
    console.log('\n   Test 3: Column-specific search');
    try {
      const r3 = await db.execAsync(`
        SELECT rowid, title FROM fts_default WHERE title MATCH 'Пушкин'
      `);
      console.log(`   Result: ${r3[0]?.values?.length || 0} rows`);
    } catch (err) {
      console.error('   ❌ Error:', err.message);
    }

    // Test 4: LIKE instead of MATCH
    console.log('\n   Test 4: LIKE instead of MATCH');
    try {
      const r4 = await db.execAsync(`
        SELECT rowid, title FROM fts_default WHERE title LIKE '%Пушкин%'
      `);
      console.log(`   Result: ${r4[0]?.values?.length || 0} rows`);
      if (r4[0]?.values?.length > 0) {
        console.log('   ✅ LIKE works! This means text IS there.');
        r4[0].values.forEach(row => console.log(`      rowid ${row[0]}: ${row[1]}`));
      }
    } catch (err) {
      console.error('   ❌ Error:', err.message);
    }

    // Test 5: Check what tokens FTS created
    console.log('\n   Test 5: What tokens exist in FTS?');
    try {
      // Get a sample Russian title
      const sampleRow = await db.execAsync(`
        SELECT title FROM fts_default WHERE title LIKE '%Пушкин%' LIMIT 1
      `);
      const sampleTitle = sampleRow[0]?.values[0]?.[0];

      if (sampleTitle) {
        console.log(`   Sample title: "${sampleTitle}"`);

        // Try searching for individual words
        const words = sampleTitle.split(/\s+/);
        for (const word of words.slice(0, 3)) {
          try {
            const r = await db.execAsync(`
              SELECT COUNT(*) as count FROM fts_default WHERE fts_default MATCH ?
            `, [word]);
            const count = r[0]?.values[0]?.[0] || 0;
            console.log(`   Word "${word}": ${count} matches`);
          } catch (err) {
            console.log(`   Word "${word}": ERROR - ${err.message}`);
          }
        }
      }
    } catch (err) {
      console.error('   ❌ Error:', err.message);
    }

    // 4. Check if unicode61 tokenizer is actually being used
    console.log('\n4️⃣ TOKENIZER VERIFICATION:');
    try {
      // Try to search for English word to verify FTS works at all
      const englishTest = await db.execAsync(`
        SELECT rowid, title FROM fts_default WHERE fts_default MATCH 'technology'
      `);
      console.log(`   English search "technology": ${englishTest[0]?.values?.length || 0} results`);

      if (englishTest[0]?.values?.length > 0) {
        console.log('   ✅ FTS works for English');
      } else {
        console.log('   ❌ FTS not working even for English!');
      }
    } catch (err) {
      console.error('   ❌ Error:', err.message);
    }

    // 5. Summary
    console.log('\n📊 DIAGNOSIS SUMMARY:');
    console.log('   - Russian texts in fts_default:', russianCount > 0 ? '✅ YES' : '❌ NO');
    console.log('   - unicode61 tokenizer:', hasUnicode61 ? '✅ YES' : '❌ NO');
    console.log('   - LIKE search works:', '(check Test 4 above)');
    console.log('   - MATCH search works:', '(check Test 1-3 above)');

    console.log('\n🔧 NEXT STEPS:');
    console.log('   If LIKE works but MATCH fails:');
    console.log('   → Tokenizer is not processing Cyrillic correctly');
    console.log('   → Check if unicode61 remove_diacritics or categories are wrong');
    console.log('   ');
    console.log('   If MATCH works for English but not Russian:');
    console.log('   → Tokenizer configuration issue with Cyrillic');
    console.log('   ');
    console.log('   If neither LIKE nor MATCH works:');
    console.log('   → Text encoding issue or wrong column');

  } catch (error) {
    console.error('❌ Diagnostic failed:', error);
  }
}

// Auto-run
diagnoseRussianSearch();
