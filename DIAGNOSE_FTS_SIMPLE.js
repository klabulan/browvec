/**
 * SIMPLE FTS DIAGNOSTIC
 *
 * Check if FTS index is actually populated
 */

(async function diagnoseFTS() {
  console.log('%c=== SIMPLE FTS DIAGNOSTIC ===', 'color: blue; font-weight: bold; font-size: 16px');
  console.log('');

  const db = window.localRetrieveDemo?.db;
  if (!db) {
    console.error('❌ Database not found!');
    return;
  }

  try {
    // 1. Count rows in docs_default
    console.log('%c--- DOCUMENT COUNT ---', 'color: green; font-weight: bold');
    const docsResult = await db.execAsync(`SELECT COUNT(*) as count FROM docs_default`);
    const docsCount = docsResult[0]?.values[0]?.[0] || 0;
    console.log(`docs_default: ${docsCount} rows`);

    // 2. Count rows in fts_default
    const ftsResult = await db.execAsync(`SELECT COUNT(*) as count FROM fts_default`);
    const ftsCount = ftsResult[0]?.values[0]?.[0] || 0;
    console.log(`fts_default: ${ftsCount} rows`);
    console.log('');

    if (ftsCount === 0) {
      console.log('%c❌ FTS INDEX IS EMPTY!', 'color: red; font-weight: bold');
      console.log('This is why search returns 0 results.');
      console.log('');
      console.log('SOLUTION: Rebuild FTS index');
      console.log('await db.execAsync("INSERT INTO fts_default(fts_default) VALUES(\'rebuild\')");');
      return;
    }

    // 3. Test direct FTS queries
    console.log('%c--- FTS SEARCH TESTS ---', 'color: green; font-weight: bold');

    const testQueries = ['Русская', 'Россия', 'литература', 'Пушкин', 'космос'];

    for (const query of testQueries) {
      try {
        const result = await db.execAsync(
          `SELECT COUNT(*) as count FROM fts_default WHERE fts_default MATCH ?`,
          [query]
        );
        const count = result[0]?.values[0]?.[0] || 0;

        if (count > 0) {
          console.log(`✓ "${query}": ${count} matches`);

          // Show sample result
          const sample = await db.execAsync(
            `SELECT title FROM fts_default WHERE fts_default MATCH ? LIMIT 1`,
            [query]
          );
          if (sample[0]?.values?.length > 0) {
            console.log(`   Sample: ${sample[0].values[0][0]}`);
          }
        } else {
          console.log(`⚠️  "${query}": 0 matches`);
        }
      } catch (error) {
        console.log(`❌ "${query}": ERROR - ${error.message}`);
      }
    }
    console.log('');

    // 4. Check what's actually in FTS (sample rows)
    console.log('%c--- FTS TABLE SAMPLE ---', 'color: green; font-weight: bold');
    const sampleResult = await db.execAsync(`
      SELECT rowid, title FROM fts_default LIMIT 5
    `);

    if (sampleResult[0]?.values?.length > 0) {
      console.log('Sample rows in FTS:');
      sampleResult[0].values.forEach((row, idx) => {
        console.log(`  ${idx + 1}. [rowid=${row[0]}] ${row[1]}`);
      });
    } else {
      console.log('❌ No rows in FTS table!');
    }

  } catch (error) {
    console.error('%c❌ ERROR', 'color: red; font-weight: bold');
    console.error(error.message);
    console.error(error.stack);
  }

  console.log('');
  console.log('%c=== DIAGNOSTIC COMPLETE ===', 'color: blue; font-weight: bold; font-size: 16px');
})();
