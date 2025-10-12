/**
 * Check Current Database Configuration
 *
 * Run this in R7 Office console AFTER opening a document:
 *
 * 1. Open the browser DevTools console
 * 2. Copy and paste this entire script
 * 3. It will check your current LocalRetrieve database settings
 */

(async function checkCurrentDatabase() {
  console.log('='.repeat(80));
  console.log('CURRENT DATABASE CONFIGURATION CHECK');
  console.log('='.repeat(80));

  try {
    // Try to access the existing database instance
    // R7 Office should have this in the global scope or a manager
    let db = null;

    // Check common places where the database might be stored
    if (typeof window.storageManager.db !== 'undefined') {
      db = window.storageManager.db;
      console.log('✓ Found database at window.window.storageManager.db');
    } else if (typeof window.db !== 'undefined') {
      db = window.db;
      console.log('✓ Found database at window.db');
    } else {
      console.log('❌ Database not found in window scope');
      console.log('Please assign your database instance:');
      console.log('  window.testDB = yourDatabaseInstance;');
      console.log('Then run this script again.');
      return;
    }

    // Check SQLite PRAGMAs
    console.log('\n[1/3] SQLite PRAGMA Settings');
    console.log('-'.repeat(80));

    const pragmaChecks = [
      { name: 'cache_size', description: 'Page cache size' },
      { name: 'journal_mode', description: 'Transaction journal mode' },
      { name: 'temp_store', description: 'Temp table storage' },
      { name: 'synchronous', description: 'Sync level' },
      { name: 'page_size', description: 'Page size in bytes' },
      { name: 'page_count', description: 'Total pages in database' }
    ];

    for (const pragma of pragmaChecks) {
      try {
        const result = await db.execAsync(`PRAGMA ${pragma.name}`);
        let value = result[0]?.values?.[0]?.[0];

        // Format specific values
        if (pragma.name === 'cache_size') {
          const cacheSize = value;
          const cacheMB = cacheSize < 0
            ? Math.abs(cacheSize) / 1024  // Negative = KB
            : (cacheSize * 4) / 1024;     // Positive = pages (4KB each)
          value = `${cacheSize} (${cacheMB.toFixed(1)}MB)`;
        } else if (pragma.name === 'temp_store') {
          const modes = { 0: 'DEFAULT', 1: 'FILE', 2: 'MEMORY' };
          value = `${value} (${modes[value] || 'UNKNOWN'})`;
        }

        console.log(`  ${pragma.name.padEnd(20)} = ${value} ${pragma.description ? '// ' + pragma.description : ''}`);
      } catch (err) {
        console.log(`  ${pragma.name.padEnd(20)} = ERROR: ${err.message}`);
      }
    }

    // Check database statistics
    console.log('\n[2/3] Database Statistics');
    console.log('-'.repeat(80));

    try {
      // Check document count
      const countResult = await db.execAsync('SELECT COUNT(*) as count FROM docs_default');
      const docCount = countResult[0]?.values?.[0]?.[0] || 0;
      console.log(`  Total documents: ${docCount}`);

      // Check database size
      const sizeResult = await db.execAsync('SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()');
      const dbSize = sizeResult[0]?.values?.[0]?.[0] || 0;
      console.log(`  Database size: ${(dbSize / 1024).toFixed(1)}KB (${dbSize} bytes)`);

      // Check FTS5 index size (approximate)
      const ftsResult = await db.execAsync("SELECT SUM(pgsize) as fts_size FROM dbstat WHERE name LIKE 'fts_%'");
      const ftsSize = ftsResult[0]?.values?.[0]?.[0] || 0;
      console.log(`  FTS5 index size: ${(ftsSize / 1024).toFixed(1)}KB`);

    } catch (err) {
      console.log(`  Statistics error: ${err.message}`);
    }

    // Check browser memory
    console.log('\n[3/3] Browser Memory Info');
    console.log('-'.repeat(80));

    if (typeof performance !== 'undefined' && performance.memory) {
      const mem = performance.memory;
      console.log(`  JS Heap Used: ${(mem.usedJSHeapSize / 1024 / 1024).toFixed(1)}MB`);
      console.log(`  JS Heap Total: ${(mem.totalJSHeapSize / 1024 / 1024).toFixed(1)}MB`);
      console.log(`  JS Heap Limit: ${(mem.jsHeapSizeLimit / 1024 / 1024).toFixed(1)}MB`);
    } else {
      console.log('  ℹ performance.memory not available (Chrome only)');
    }

    // Analysis and recommendations
    console.log('\n' + '='.repeat(80));
    console.log('ANALYSIS & RECOMMENDATIONS');
    console.log('='.repeat(80));

    // Get cache_size value for analysis
    const cacheResult = await db.execAsync('PRAGMA cache_size');
    const cacheSize = cacheResult[0]?.values?.[0]?.[0] || 0;
    const cacheMB = cacheSize < 0 ? Math.abs(cacheSize) / 1024 : (cacheSize * 4) / 1024;

    const journalResult = await db.execAsync('PRAGMA journal_mode');
    const journalMode = journalResult[0]?.values?.[0]?.[0] || '';

    console.log('\n📊 Current Configuration:');
    console.log(`  Cache: ${cacheMB.toFixed(1)}MB`);
    console.log(`  Journal: ${journalMode}`);

    console.log('\n⚠️ Issues Detected:');
    let hasIssues = false;

    if (cacheMB > 20) {
      hasIssues = true;
      console.log(`  • Cache size (${cacheMB.toFixed(0)}MB) likely exceeds WASM heap (typically 16-32MB)`);
      console.log('    → This causes "database or disk is full" errors');
      console.log('    → Recommended: cache_size = -8000 (8MB)');
    }

    if (journalMode.toLowerCase() === 'memory') {
      hasIssues = true;
      console.log('  • In-memory journal adds memory pressure during transactions');
      console.log('    → Recommended: journal_mode = DELETE (disk-based)');
    }

    if (!hasIssues) {
      console.log('  ✓ No obvious configuration issues detected');
    }

    console.log('\n💡 To fix, update DatabaseWorker.ts lines 250-253:');
    console.log('  PRAGMA cache_size = -8000     // 8MB instead of -64000');
    console.log('  PRAGMA journal_mode = DELETE  // Disk instead of MEMORY');

  } catch (err) {
    console.error('\n❌ CHECK FAILED:', err.message);
    console.error('Stack:', err.stack);
  }

  console.log('\n' + '='.repeat(80));
})();
