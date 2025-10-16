/**
 * TEST INLINE SQL vs PARAMETER BINDING
 *
 * Prove that inline Cyrillic fails but parameter binding works
 */

(async function testInlineVsParam() {
  console.log('%c=== INLINE vs PARAMETER BINDING TEST ===', 'color: blue; font-weight: bold; font-size: 16px');
  console.log('');

  const db = window.localRetrieveDemo?.db;
  if (!db) {
    console.error('❌ Database not found!');
    return;
  }

  const testQuery = 'Россия';

  // Test 1: Inline string (SHOULD FAIL)
  console.log('%c--- TEST 1: Inline String ---', 'color: green; font-weight: bold');
  console.log(`SQL: SELECT COUNT(*) FROM fts_default WHERE fts_default MATCH '${testQuery}'`);
  try {
    const result = await db.execAsync(`
      SELECT COUNT(*) as count
      FROM fts_default
      WHERE fts_default MATCH '${testQuery}'
    `);
    console.log('%c✓ INLINE WORKED (unexpected!)', 'color: green; font-weight: bold');
    console.log(`  Result: ${result[0]?.values[0]?.[0] || 0} matches`);
  } catch (error) {
    console.log('%c❌ INLINE FAILED (expected)', 'color: red; font-weight: bold');
    console.log(`  Error: ${error.message}`);
  }
  console.log('');

  // Test 2: Parameter binding (SHOULD WORK)
  console.log('%c--- TEST 2: Parameter Binding ---', 'color: green; font-weight: bold');
  console.log(`SQL: SELECT COUNT(*) FROM fts_default WHERE fts_default MATCH ?`);
  console.log(`Params: ["${testQuery}"]`);
  try {
    const result = await db.execAsync(
      `SELECT COUNT(*) as count FROM fts_default WHERE fts_default MATCH ?`,
      [testQuery]
    );
    console.log('%c✓ PARAMETER BINDING WORKED (expected)', 'color: green; font-weight: bold');
    console.log(`  Result: ${result[0]?.values[0]?.[0] || 0} matches`);
  } catch (error) {
    console.log('%c❌ PARAMETER BINDING FAILED (unexpected!)', 'color: red; font-weight: bold');
    console.log(`  Error: ${error.message}`);
  }
  console.log('');

  console.log('%c=== CONCLUSION ===', 'color: blue; font-weight: bold');
  console.log('');
  console.log('If inline fails but parameter binding works:');
  console.log('→ The search API must use parameter binding, not string interpolation');
  console.log('→ This is a bug in the search SQL construction');

  console.log('');
  console.log('%c=== TEST COMPLETE ===', 'color: blue; font-weight: bold; font-size: 16px');
})();
