/**
 * CHECK ROWID ALIGNMENT
 *
 * Verify rowid alignment between docs_default and fts_default
 */

(async function checkRowidAlignment() {
  console.log('%c=== CHECK ROWID ALIGNMENT ===', 'color: blue; font-weight: bold; font-size: 16px');
  console.log('');

  const db = window.localRetrieveDemo?.db;
  if (!db) {
    console.error('❌ Database not found!');
    return;
  }

  try {
    // Get rowids for Russian documents from docs_default
    console.log('%c--- RUSSIAN DOCS IN docs_default ---', 'color: green; font-weight: bold');
    const docsResult = await db.execAsync(`
      SELECT d.rowid, d.id, d.title
      FROM docs_default d
      WHERE d.title LIKE '%Рус%' OR d.title LIKE '%Росс%'
      ORDER BY d.rowid
    `);

    const docsRowids = [];
    if (docsResult[0]?.values?.length > 0) {
      console.log('Russian documents in docs_default:');
      docsResult[0].values.forEach((row) => {
        console.log(`  rowid=${row[0]}, id=${row[1]}, title="${row[2]}"`);
        docsRowids.push(row[0]);
      });
    } else {
      console.log('❌ No Russian documents in docs_default!');
    }
    console.log('');

    // Get rowids for Russian documents from fts_default
    console.log('%c--- RUSSIAN DOCS IN fts_default ---', 'color: green; font-weight: bold');
    const ftsResult = await db.execAsync(`
      SELECT f.rowid, f.title
      FROM fts_default f
      WHERE f.title LIKE '%Рус%' OR f.title LIKE '%Росс%'
      ORDER BY f.rowid
    `);

    const ftsRowids = [];
    if (ftsResult[0]?.values?.length > 0) {
      console.log('Russian documents in fts_default:');
      ftsResult[0].values.forEach((row) => {
        console.log(`  rowid=${row[0]}, title="${row[1]}"`);
        ftsRowids.push(row[0]);
      });
    } else {
      console.log('❌ No Russian documents in fts_default!');
    }
    console.log('');

    // Compare rowids
    console.log('%c--- ROWID COMPARISON ---', 'color: green; font-weight: bold');
    if (docsRowids.length > 0 && ftsRowids.length > 0) {
      const matching = docsRowids.filter(r => ftsRowids.includes(r));
      const docsOnly = docsRowids.filter(r => !ftsRowids.includes(r));
      const ftsOnly = ftsRowids.filter(r => !docsRowids.includes(r));

      console.log(`Matching rowids: ${matching.join(', ')}`);
      console.log(`Only in docs_default: ${docsOnly.join(', ') || 'none'}`);
      console.log(`Only in fts_default: ${ftsOnly.join(', ') || 'none'}`);

      if (docsOnly.length > 0 || ftsOnly.length > 0) {
        console.log('%c❌ ROWID MISMATCH DETECTED!', 'color: red; font-weight: bold');
        console.log('This is why JOIN fails and search returns 0 results!');
      } else {
        console.log('✓ Rowids match between tables');
      }
    }
    console.log('');

    // Test JOIN explicitly
    console.log('%c--- TEST JOIN ---', 'color: green; font-weight: bold');
    const joinResult = await db.execAsync(`
      SELECT d.rowid as doc_rowid, f.rowid as fts_rowid, d.id, d.title
      FROM docs_default d
      JOIN fts_default f ON d.rowid = f.rowid
      WHERE d.title LIKE '%Рус%' OR d.title LIKE '%Росс%'
    `);

    if (joinResult[0]?.values?.length > 0) {
      console.log('✓ JOIN succeeded for Russian documents:');
      joinResult[0].values.forEach((row) => {
        console.log(`  doc_rowid=${row[0]}, fts_rowid=${row[1]}, id=${row[2]}, title="${row[3]}"`);
      });
    } else {
      console.log('%c❌ JOIN RETURNS ZERO ROWS!', 'color: red; font-weight: bold');
      console.log('Russian documents have mismatched rowids between docs_default and fts_default');
    }
    console.log('');

    // Show all rowids in both tables
    console.log('%c--- ALL ROWIDS (side by side) ---', 'color: green; font-weight: bold');

    const allDocs = await db.execAsync(`SELECT d.rowid, d.id FROM docs_default d ORDER BY d.rowid`);
    const allFts = await db.execAsync(`SELECT f.rowid FROM fts_default f ORDER BY f.rowid`);

    const docRowids = allDocs[0]?.values || [];
    const ftsRowidList = (allFts[0]?.values || []).map(r => r[0]);

    console.log('rowid | docs_default | fts_default');
    console.log('------|--------------|------------');

    const maxRowid = Math.max(
      ...docRowids.map(r => r[0]),
      ...ftsRowidList
    );

    for (let i = 1; i <= maxRowid; i++) {
      const inDocs = docRowids.find(r => r[0] === i);
      const inFts = ftsRowidList.includes(i);

      const docsId = inDocs ? `id=${inDocs[1]}` : 'MISSING';
      const ftsStatus = inFts ? 'EXISTS' : 'MISSING';

      const mismatch = (inDocs && !inFts) || (!inDocs && inFts);
      const style = mismatch ? 'color: red; font-weight: bold' : '';

      console.log(`%c${i.toString().padStart(5)} | ${docsId.padEnd(12)} | ${ftsStatus}`, style);
    }
    console.log('');

    // Diagnosis
    console.log('%c=== DIAGNOSIS ===', 'color: blue; font-weight: bold');
    console.log('');
    console.log('If rowids mismatch:');
    console.log('→ FTS5 was rebuilt incorrectly or out of sync');
    console.log('→ Need to rebuild FTS5 index with correct rowids');
    console.log('');
    console.log('SOLUTION:');
    console.log('1. DELETE FROM fts_default');
    console.log('2. INSERT INTO fts_default SELECT rowid, title, content, metadata FROM docs_default');

  } catch (error) {
    console.error('%c❌ ERROR', 'color: red; font-weight: bold');
    console.error(error.message);
    console.error(error.stack);
  }

  console.log('');
  console.log('%c=== CHECK COMPLETE ===', 'color: blue; font-weight: bold; font-size: 16px');
})();
