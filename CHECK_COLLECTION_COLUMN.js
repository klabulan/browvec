/**
 * CHECK COLLECTION COLUMN
 *
 * Verify collection values in docs_default for Russian documents
 */

(async function checkCollectionColumn() {
  console.log('%c=== CHECK COLLECTION COLUMN ===', 'color: blue; font-weight: bold; font-size: 16px');
  console.log('');

  const db = window.localRetrieveDemo?.db;
  if (!db) {
    console.error('❌ Database not found!');
    return;
  }

  try {
    // Check collection values for all documents
    console.log('%c--- ALL DOCUMENTS (collection column) ---', 'color: green; font-weight: bold');
    const allDocsResult = await db.execAsync(`
      SELECT rowid, id, title, collection
      FROM docs_default
      ORDER BY rowid
    `);

    if (allDocsResult[0]?.values?.length > 0) {
      console.log('Documents with collection values:');
      allDocsResult[0].values.forEach((row) => {
        const rowid = row[0];
        const id = row[1];
        const title = row[2];
        const collection = row[3];

        const hasRussian = title && /[А-Яа-я]/.test(title);
        const style = hasRussian ? 'font-weight: bold; color: orange' : '';

        console.log(`%crowid=${rowid}, id=${id}, collection="${collection || 'NULL'}", title="${title}"`, style);
      });
    } else {
      console.log('❌ No documents found!');
    }
    console.log('');

    // Count by collection
    console.log('%c--- DOCUMENTS BY COLLECTION ---', 'color: green; font-weight: bold');
    const countResult = await db.execAsync(`
      SELECT
        COALESCE(collection, 'NULL') as coll,
        COUNT(*) as count
      FROM docs_default
      GROUP BY collection
    `);

    if (countResult[0]?.values?.length > 0) {
      console.table(
        countResult[0].values.reduce((acc, row) => {
          acc[row[0]] = row[1];
          return acc;
        }, {})
      );
    }
    console.log('');

    // Test search with collection filter
    console.log('%c--- SEARCH TEST WITH COLLECTION FILTER ---', 'color: green; font-weight: bold');

    const testQueries = [
      { query: 'Россия', collection: 'default' },
      { query: 'Россия', collection: 'chunks' },
      { query: 'Россия', collection: null }
    ];

    for (const test of testQueries) {
      try {
        let sql, params;

        if (test.collection === null) {
          // No collection filter
          sql = `
            SELECT COUNT(*) as count
            FROM docs_default d
            JOIN fts_default f ON d.rowid = f.rowid
            WHERE fts_default MATCH ?
          `;
          params = [test.query];
        } else {
          // With collection filter
          sql = `
            SELECT COUNT(*) as count
            FROM docs_default d
            JOIN fts_default f ON d.rowid = f.rowid
            WHERE d.collection = ? AND fts_default MATCH ?
          `;
          params = [test.collection, test.query];
        }

        const result = await db.execAsync(sql, params);
        const count = result[0]?.values[0]?.[0] || 0;

        if (count > 0) {
          console.log(`✓ "${test.query}" in collection "${test.collection || 'ANY'}": ${count} matches`);
        } else {
          console.log(`⚠️  "${test.query}" in collection "${test.collection || 'ANY'}": 0 matches`);
        }
      } catch (error) {
        console.log(`❌ "${test.query}" in collection "${test.collection}": ERROR - ${error.message}`);
      }
    }
    console.log('');

    // Diagnosis
    console.log('%c=== DIAGNOSIS ===', 'color: blue; font-weight: bold');
    console.log('');
    console.log('If Russian documents have wrong collection value:');
    console.log('→ Search API filters by collection="default" but docs are in different collection');
    console.log('→ Need to check batchInsertDocuments to ensure it sets collection correctly');

  } catch (error) {
    console.error('%c❌ ERROR', 'color: red; font-weight: bold');
    console.error(error.message);
    console.error(error.stack);
  }

  console.log('');
  console.log('%c=== CHECK COMPLETE ===', 'color: blue; font-weight: bold; font-size: 16px');
})();
