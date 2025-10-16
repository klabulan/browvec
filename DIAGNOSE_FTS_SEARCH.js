/**
 * FTS SEARCH DIAGNOSTIC
 *
 * Diagnose why Russian FTS search returns 0 results
 * Run in browser console after loading sample data
 */

(async function diagnoseFTSSearch() {
  console.log('%c=== FTS SEARCH DIAGNOSTIC ===', 'color: blue; font-weight: bold; font-size: 16px');
  console.log('');

  try {
    const db = window.localRetrieveDemo?.db;
    if (!db) {
      console.error('❌ Database not found! Make sure demo is loaded.');
      return;
    }

    // 1. Check what's in FTS table
    console.log('%c--- FTS TABLE CONTENTS ---', 'color: green; font-weight: bold');
    const ftsContents = await db.execAsync(`
      SELECT rowid, title, substr(content, 1, 100) as content_preview
      FROM fts_default
      WHERE title LIKE '%Рус%' OR content LIKE '%Рус%'
      LIMIT 5
    `);

    if (ftsContents[0]?.values?.length > 0) {
      console.log('✓ Russian documents in FTS:');
      ftsContents[0].values.forEach((row, idx) => {
        console.log(`  ${idx + 1}. [rowid=${row[0]}] ${row[1]}`);
        console.log(`     Content: ${row[2]}...`);
      });
    } else {
      console.log('❌ No Russian documents found in FTS table!');
    }
    console.log('');

    // 2. Test different FTS query patterns
    console.log('%c--- FTS QUERY TESTS ---', 'color: green; font-weight: bold');

    const testQueries = [
      { query: 'русск', desc: 'Partial word (fragment)' },
      { query: 'русск*', desc: 'Prefix search' },
      { query: 'Русская', desc: 'Complete word (exact case)' },
      { query: 'русская', desc: 'Complete word (lowercase)' },
      { query: 'Россия', desc: 'Complete word "Russia"' },
      { query: 'литература', desc: 'Complete word "literature"' },
      { query: 'Пушкин', desc: 'Complete word "Pushkin"' },
      { query: 'космос', desc: 'Complete word "space"' }
    ];

    for (const test of testQueries) {
      try {
        const result = await db.execAsync(`
          SELECT COUNT(*) as count
          FROM fts_default
          WHERE fts_default MATCH ?
        `, [test.query]);

        const count = result[0]?.values[0]?.[0] || 0;

        if (count > 0) {
          console.log(`✓ "${test.query}" (${test.desc}): ${count} matches`);
        } else {
          console.log(`⚠️  "${test.query}" (${test.desc}): 0 matches`);
        }
      } catch (error) {
        console.log(`❌ "${test.query}" (${test.desc}): ERROR - ${error.message}`);
      }
    }
    console.log('');

    // 3. Show actual matched results for a working query
    console.log('%c--- SAMPLE SEARCH RESULTS ---', 'color: green; font-weight: bold');
    try {
      const searchResult = await db.execAsync(`
        SELECT rowid, title, substr(content, 1, 100) as content_preview
        FROM fts_default
        WHERE fts_default MATCH ?
        LIMIT 3
      `, ['Россия']);

      if (searchResult[0]?.values?.length > 0) {
        console.log('✓ Search "Россия" results:');
        searchResult[0].values.forEach((row, idx) => {
          console.log(`  ${idx + 1}. [rowid=${row[0]}] ${row[1]}`);
          console.log(`     ${row[2]}...`);
        });
      } else {
        console.log('⚠️  Search "Россия" returned no results');
      }
    } catch (error) {
      console.error('❌ Search error:', error.message);
    }
    console.log('');

    // 4. Diagnosis and solution
    console.log('%c=== DIAGNOSIS ===', 'color: blue; font-weight: bold; font-size: 14px');
    console.log('');
    console.log('%cFTS5 TOKENIZATION:', 'font-weight: bold');
    console.log('FTS5 indexes COMPLETE WORDS, not fragments.');
    console.log('');
    console.log('%cFor Russian search:', 'font-weight: bold');
    console.log('✓ Use complete words: "Россия", "литература", "Пушкин"');
    console.log('✓ Use prefix search for partial words: "русск*" (with asterisk)');
    console.log('✓ Use OR for multiple terms: "Россия OR космос"');
    console.log('❌ Avoid fragments without *: "русск" (won\'t match anything)');
    console.log('');
    console.log('%cIn the demo UI:', 'font-weight: bold');
    console.log('Click one of the sample query buttons like:');
    console.log('  • "Пушкин" (should work)');
    console.log('  • "литература" (should work)');
    console.log('  • "Россия" (should work)');

  } catch (error) {
    console.error('%c❌ DIAGNOSTIC ERROR', 'color: red; font-weight: bold');
    console.error(error);
  }

  console.log('');
  console.log('%c=== DIAGNOSTIC COMPLETE ===', 'color: blue; font-weight: bold; font-size: 16px');
})();
