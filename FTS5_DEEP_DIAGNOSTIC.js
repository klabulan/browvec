// DEEP FTS5 CONTENT DIAGNOSTIC
// Checks if FTS5 table has actual content or just empty rows

async function fts5DeepDiagnostic() {
  console.log('🔬 FTS5 DEEP CONTENT DIAGNOSTIC\n');
  console.log('='.repeat(80));

  const db = window.localRetrieveDemo?.db;
  if (!db) {
    console.error('❌ Demo not loaded');
    return;
  }

  try {
    // 1. Check docs_default content
    console.log('\n1️⃣ DOCS_DEFAULT CONTENT');
    console.log('-'.repeat(80));

    const docs = await db.execAsync('SELECT rowid, id, title, SUBSTR(content, 1, 100) as content_preview FROM docs_default LIMIT 5');

    if (docs[0]?.values) {
      console.log(`Found ${docs[0].values.length} documents in docs_default:`);
      docs[0].values.forEach((row, idx) => {
        console.log(`\n   Document ${idx + 1}:`);
        console.log(`   rowid: ${row[0]}`);
        console.log(`   id: ${row[1]}`);
        console.log(`   title: ${row[2] || '(empty)'}`);
        console.log(`   content: ${row[3] ? row[3].substring(0, 80) + '...' : '(empty)'}`);
      });
    }

    // 2. Check fts_default content (RAW)
    console.log('\n\n2️⃣ FTS_DEFAULT CONTENT (RAW)');
    console.log('-'.repeat(80));

    const fts = await db.execAsync('SELECT rowid, title, SUBSTR(content, 1, 100) as content_preview FROM fts_default LIMIT 5');

    if (fts[0]?.values) {
      console.log(`Found ${fts[0].values.length} rows in fts_default:`);

      let emptyCount = 0;
      fts[0].values.forEach((row, idx) => {
        const hasContent = row[1] || row[2];
        if (!hasContent) emptyCount++;

        console.log(`\n   FTS Row ${idx + 1}:`);
        console.log(`   rowid: ${row[0]}`);
        console.log(`   title: ${row[1] || '(NULL/EMPTY)'}`);
        console.log(`   content: ${row[2] ? row[2].substring(0, 80) + '...' : '(NULL/EMPTY)'}`);
      });

      if (emptyCount > 0) {
        console.log(`\n   ⚠️  WARNING: ${emptyCount}/${fts[0].values.length} FTS rows have NULL/EMPTY content!`);
        console.log('   → This is the ROOT CAUSE of search failures!');
      }
    }

    // 3. Check rowid alignment
    console.log('\n\n3️⃣ ROWID ALIGNMENT CHECK');
    console.log('-'.repeat(80));

    const alignment = await db.execAsync(`
      SELECT
        d.rowid as docs_rowid,
        f.rowid as fts_rowid,
        d.title as docs_title,
        f.title as fts_title,
        CASE
          WHEN f.title IS NULL OR f.title = '' THEN 'EMPTY'
          WHEN d.title = f.title THEN 'MATCH'
          ELSE 'MISMATCH'
        END as status
      FROM docs_default d
      LEFT JOIN fts_default f ON d.rowid = f.rowid
      LIMIT 5
    `);

    if (alignment[0]?.values) {
      console.log('Rowid alignment analysis:');
      alignment[0].values.forEach(row => {
        const status = row[4];
        const icon = status === 'MATCH' ? '✅' : status === 'MISMATCH' ? '⚠️' : '❌';
        console.log(`\n   ${icon} docs_rowid=${row[0]}, fts_rowid=${row[1] || 'NULL'}, status=${status}`);
        if (status !== 'MATCH') {
          console.log(`      docs_title: "${row[2]}"`);
          console.log(`      fts_title: "${row[3] || '(NULL/EMPTY)'}"`);
        }
      });
    }

    // 4. Test FTS5 tokenization
    console.log('\n\n4️⃣ FTS5 TOKENIZATION TEST');
    console.log('-'.repeat(80));

    // Try to manually insert a test row
    console.log('Testing if FTS5 can index Russian text...');

    try {
      // Get max rowid
      const maxRowid = await db.execAsync('SELECT MAX(rowid) as max_rowid FROM fts_default');
      const testRowid = (maxRowid[0]?.values[0]?.[0] || 0) + 1000; // Use a high rowid to avoid conflicts

      console.log(`   Creating test row with rowid=${testRowid}`);

      // Insert test data
      await db.execAsync(
        'INSERT INTO fts_default(rowid, title, content, metadata) VALUES (?, ?, ?, ?)',
        [testRowid, 'Тест заголовок', 'Тестовый контент с русским текстом о Пушкине', '{}']
      );

      console.log('   ✅ Test row inserted');

      // Try to search for it
      const searchResult = await db.execAsync(
        'SELECT rowid, title FROM fts_default WHERE fts_default MATCH ?',
        ['Пушкине']
      );

      if (searchResult[0]?.values?.length > 0) {
        console.log('   ✅ FTS5 search WORKS! Found test row.');
        console.log('   → Tokenizer is correctly configured');
        console.log('   → PROBLEM: Original data was not synced to FTS5 properly');
      } else {
        console.log('   ❌ FTS5 search FAILED even with manual insert');
        console.log('   → Possible tokenizer issue OR query syntax problem');
      }

      // Cleanup test row
      await db.execAsync('DELETE FROM fts_default WHERE rowid = ?', [testRowid]);
      console.log('   Test row cleaned up');

    } catch (err) {
      console.log(`   ❌ Test failed: ${err.message}`);
    }

    // 5. Recommended fix
    console.log('\n\n5️⃣ RECOMMENDED FIX');
    console.log('-'.repeat(80));

    console.log('\n   The FTS5 table has rows but NO CONTENT.');
    console.log('   This indicates a bug in the FTS5 sync logic during document insertion.');
    console.log('\n   TO FIX THIS:');
    console.log('\n   Option A: Rebuild FTS5 index manually');
    console.log('   ----------------------------------------');
    console.log('   ```javascript');
    console.log('   // 1. Delete empty FTS5 rows');
    console.log('   await db.execAsync("DELETE FROM fts_default");');
    console.log('   ');
    console.log('   // 2. Rebuild from docs_default');
    console.log('   await db.execAsync(`');
    console.log('     INSERT INTO fts_default(rowid, title, content, metadata)');
    console.log('     SELECT rowid, title, content, metadata FROM docs_default');
    console.log('   `);');
    console.log('   ');
    console.log('   // 3. Verify');
    console.log('   const result = await db.search({ query: { text: "Пушкин" }, limit: 10 });');
    console.log('   console.log("Search results:", result.results.length);');
    console.log('   ```');
    console.log('\n   Option B: Reload test data');
    console.log('   ----------------------------------------');
    console.log('   Click "Load Test Data" button again (will clear and reload)');

    console.log('\n' + '='.repeat(80));
    console.log('✅ Deep diagnostic complete');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ Deep diagnostic failed:', error);
    console.error(error.stack);
  }
}

// Auto-run and export
window.fts5DeepDiagnostic = fts5DeepDiagnostic;
console.log('🔬 FTS5 Deep Diagnostic loaded. Run: fts5DeepDiagnostic()');
