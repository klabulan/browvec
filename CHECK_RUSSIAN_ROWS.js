/**
 * CHECK RUSSIAN DOCUMENT ROWS
 *
 * Specifically check rows 9, 10, 11 in FTS
 */

(async function checkRussianRows() {
  console.log('%c=== CHECK RUSSIAN ROWS ===', 'color: blue; font-weight: bold; font-size: 16px');
  console.log('');

  const db = window.localRetrieveDemo?.db;
  if (!db) {
    console.error('❌ Database not found!');
    return;
  }

  try {
    // Check docs_default rows 9, 10, 11
    console.log('%c--- docs_default (rows 9-11) ---', 'color: green; font-weight: bold');
    const docsResult = await db.execAsync(`
      SELECT rowid, id, title, substr(content, 1, 80) as content_preview
      FROM docs_default
      WHERE rowid >= 9 AND rowid <= 11
      ORDER BY rowid
    `);

    if (docsResult[0]?.values?.length > 0) {
      docsResult[0].values.forEach((row) => {
        console.log(`rowid=${row[0]}, id=${row[1]}`);
        console.log(`  title: ${row[2]}`);
        console.log(`  content: ${row[3]}...`);
        console.log('');
      });
    } else {
      console.log('❌ No rows 9-11 found in docs_default!');
    }

    // Check fts_default rows 9, 10, 11
    console.log('%c--- fts_default (rows 9-11) ---', 'color: green; font-weight: bold');
    const ftsResult = await db.execAsync(`
      SELECT rowid, title, substr(content, 1, 80) as content_preview
      FROM fts_default
      WHERE rowid >= 9 AND rowid <= 11
      ORDER BY rowid
    `);

    if (ftsResult[0]?.values?.length > 0) {
      ftsResult[0].values.forEach((row) => {
        console.log(`rowid=${row[0]}`);
        console.log(`  title: ${row[1]}`);
        console.log(`  content: ${row[2]}...`);
        console.log('');
      });
    } else {
      console.log('%c❌ ROWS 9-11 MISSING FROM FTS!', 'color: red; font-weight: bold');
      console.log('This is the problem! Russian docs are not in FTS index.');
    }

    // Try to manually search for any Russian text in FTS
    console.log('%c--- SEARCH FOR ANY CYRILLIC ---', 'color: green; font-weight: bold');
    const cyrillicResult = await db.execAsync(`
      SELECT rowid, title
      FROM fts_default
      WHERE title GLOB '*[А-Яа-я]*'
      LIMIT 5
    `);

    if (cyrillicResult[0]?.values?.length > 0) {
      console.log('✓ Found rows with Cyrillic in FTS:');
      cyrillicResult[0].values.forEach((row) => {
        console.log(`  rowid=${row[0]}: ${row[1]}`);
      });
    } else {
      console.log('%c❌ NO CYRILLIC TEXT IN FTS AT ALL!', 'color: red; font-weight: bold');
      console.log('FTS table has English docs only.');
    }
    console.log('');

    console.log('%c=== DIAGNOSIS ===', 'color: blue; font-weight: bold');
    console.log('');
    console.log('If rows 9-11 are missing from FTS or have no Cyrillic:');
    console.log('→ The batchInsertDocuments API did not sync Russian docs to FTS');
    console.log('→ Need to rebuild FTS index from docs_default');
    console.log('');
    console.log('SOLUTION:');
    console.log('await db.execAsync("INSERT INTO fts_default(fts_default) VALUES(\'rebuild\')");');

  } catch (error) {
    console.error('%c❌ ERROR', 'color: red; font-weight: bold');
    console.error(error.message);
    console.error(error.stack);
  }

  console.log('');
  console.log('%c=== CHECK COMPLETE ===', 'color: blue; font-weight: bold; font-size: 16px');
})();
