// ═══════════════════════════════════════════════════════════════════════════
// 🔍 DATABASE DIAGNOSTICS - Copy ALL of this and paste into browser console
// ═══════════════════════════════════════════════════════════════════════════
// NO IMPORTS - Pure browser JavaScript - Safe to paste directly into console
// Uses execAsync (sql.js format) - Compatible with LocalRetrieve
// ═══════════════════════════════════════════════════════════════════════════

(async function() {
 // console.clear();
  console.log('═'.repeat(80));
  console.log('🔍 DATABASE DIAGNOSTICS REPORT');
  console.log('═'.repeat(80));
  console.log('Time:', new Date().toISOString());
  console.log('');

  // Get database instance (adjust if needed)
  const db = window.storageManager?.db || window.db || window.localretrieve || (window.Database ? new window.Database() : null);

  if (!db) {
    console.error('❌ ERROR: Database instance not found!');
    console.log('💡 Try one of these:');
    console.log('   1. If using storageManager: window.storageManager.db');
    console.log('   2. If using global db: window.db');
    console.log('   3. Modify this script: const db = yourDatabaseInstance;');
    console.log('\nAvailable window properties:');
    console.log(Object.keys(window).filter(k => k.toLowerCase().includes('db') || k.toLowerCase().includes('storage') || k.toLowerCase().includes('local')));
    return;
  }

  // Helper to execute SQL and convert sql.js format to simple array
  async function query(sql) {
    const result = await db.execAsync(sql);
    if (!result || result.length === 0) return [];

    const stmt = result[0];
    const rows = [];

    if (stmt.values && stmt.values.length > 0) {
      for (const row of stmt.values) {
        const obj = {};
        stmt.columns.forEach((col, idx) => {
          obj[col] = row[idx];
        });
        rows.push(obj);
      }
    }

    return rows;
  }

  const log = (title, data) => {
    console.log('\n' + '─'.repeat(80));
    console.log('📋 ' + title);
    console.log('─'.repeat(80));
    if (Array.isArray(data) && data.length > 0) {
      console.table(data);
    } else if (typeof data === 'object') {
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(data);
    }
  };

  try {
    // ════════════════════════════════════════════════════════════════════════
    // 1. DATABASE SIZE LIMITS (MOST CRITICAL!)
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n🔍 Checking database size limits...');
    const limits = await query(`
      SELECT
        (SELECT * FROM pragma_page_count()) as current_pages,
        (SELECT * FROM pragma_max_page_count()) as max_pages,
        (SELECT * FROM pragma_page_size()) as page_size_bytes,
        (SELECT * FROM pragma_freelist_count()) as freelist_pages,
        ROUND((SELECT * FROM pragma_page_count()) * 1.0 / (SELECT * FROM pragma_max_page_count()) * 100, 2) as usage_percent,
        ROUND((SELECT * FROM pragma_page_count()) * (SELECT * FROM pragma_page_size()) / 1024.0 / 1024.0, 2) as current_size_mb,
        ROUND((SELECT * FROM pragma_max_page_count()) * (SELECT * FROM pragma_page_size()) / 1024.0 / 1024.0, 2) as max_size_mb
    `);
    log('1. DATABASE SIZE LIMITS', limits);

    const usage = limits[0]?.usage_percent || 0;
    if (usage > 90) {
      console.error('🚨 CRITICAL: Database is ' + usage + '% full! This is likely your problem!');
    } else if (usage > 70) {
      console.warn('⚠️  WARNING: Database is ' + usage + '% full');
    } else {
      console.log('✅ Database size OK: ' + usage + '% used');
    }

    // ════════════════════════════════════════════════════════════════════════
    // 2. MEMORY CONFIGURATION
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n🔍 Checking memory configuration...');
    const memory = await query(`
      SELECT
        (SELECT * FROM pragma_cache_size()) as cache_size_pages,
        CASE
          WHEN (SELECT * FROM pragma_cache_size()) < 0
          THEN ABS((SELECT * FROM pragma_cache_size()))
          ELSE (SELECT * FROM pragma_cache_size()) * (SELECT * FROM pragma_page_size()) / 1024
        END as cache_size_kb,
        (SELECT * FROM pragma_temp_store()) as temp_store_mode,
        (SELECT * FROM pragma_journal_mode()) as journal_mode,
        (SELECT * FROM pragma_synchronous()) as synchronous_mode
    `);
    log('2. MEMORY CONFIGURATION', memory);

    const cacheKB = memory[0]?.cache_size_kb || 0;
    if (cacheKB < 32000) {
      console.warn('⚠️  WARNING: Cache only ' + (cacheKB/1024).toFixed(1) + 'MB - may cause FTS5 issues');
      console.log('💡 FIX: Run: await db.execAsync("PRAGMA cache_size = -131072")  // 128MB');
    } else {
      console.log('✅ Cache size OK: ' + (cacheKB/1024).toFixed(1) + 'MB');
    }

    // ════════════════════════════════════════════════════════════════════════
    // 3. TABLE STATISTICS
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n🔍 Checking table statistics...');
    const tables = await query(`
      SELECT 'docs_default' as table_name, COUNT(*) as row_count,
             ROUND(AVG(LENGTH(content)), 0) as avg_content_bytes,
             MAX(LENGTH(content)) as max_content_bytes
      FROM docs_default
      UNION ALL
      SELECT 'fts_default', COUNT(*), NULL, NULL FROM fts_default
      UNION ALL
      SELECT 'vec_default_dense', COUNT(*), NULL, NULL FROM vec_default_dense
      UNION ALL
      SELECT 'embedding_queue', COUNT(*), NULL, NULL FROM embedding_queue
    `);
    log('3. TABLE ROW COUNTS', tables);

    // ════════════════════════════════════════════════════════════════════════
    // 4. CONSTRAINTS (Can cause insert failures!)
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n🔍 Checking table constraints...');
    const constraints = await query(`
      SELECT
        m.name as table_name,
        p.name as column_name,
        p.type as column_type,
        p.pk as is_primary_key,
        p."notnull" as is_not_null,
        p.dflt_value as default_value
      FROM sqlite_master m
      JOIN pragma_table_info(m.name) p
      WHERE m.type = 'table'
        AND m.name = 'docs_default'
      ORDER BY p.cid
    `);
    log('4. DOCS_DEFAULT TABLE CONSTRAINTS', constraints);

    const notNullCols = constraints.filter(c => c.is_not_null).map(c => c.column_name);
    console.log('🔒 NOT NULL columns (must provide):', notNullCols.join(', '));
    console.log('🔑 PRIMARY KEY:', constraints.find(c => c.is_primary_key)?.column_name || 'none');

    // ════════════════════════════════════════════════════════════════════════
    // 5. RECENT DOCUMENTS
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n🔍 Checking recent documents...');
    const recent = await query(`
      SELECT
        id,
        collection,
        LENGTH(content) as content_bytes,
        LENGTH(COALESCE(title, '')) as title_bytes,
        LENGTH(COALESCE(metadata, '{}')) as metadata_bytes,
        created_at,
        datetime(created_at, 'unixepoch') as created_datetime
      FROM docs_default
      ORDER BY created_at DESC
      LIMIT 5
    `);
    log('5. RECENT DOCUMENTS (last 5)', recent);

    // ════════════════════════════════════════════════════════════════════════
    // 6. FTS5 STATISTICS
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n🔍 Checking FTS5 index...');
    try {
      const fts5Segments = await query(`
        SELECT COUNT(*) as segment_count FROM fts_default_data WHERE id >= 1
      `);
      log('6. FTS5 INDEX SEGMENTS', fts5Segments);

      if (fts5Segments[0]?.segment_count > 100) {
        console.warn('⚠️  WARNING: FTS5 has ' + fts5Segments[0].segment_count + ' segments (fragmented)');
        console.log('💡 FIX: Run: await db.execAsync("INSERT INTO fts_default(fts_default) VALUES(\'optimize\')")');
      }
    } catch (e) {
      console.log('⚠️  Could not check FTS5 segments:', e.message);
    }

    // ════════════════════════════════════════════════════════════════════════
    // 7. BROWSER STORAGE QUOTA
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n🔍 Checking browser storage quota...');
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      const quotaData = {
        usage_mb: (estimate.usage / 1024 / 1024).toFixed(2),
        quota_mb: (estimate.quota / 1024 / 1024).toFixed(2),
        usage_percent: ((estimate.usage / estimate.quota) * 100).toFixed(2),
        available_mb: ((estimate.quota - estimate.usage) / 1024 / 1024).toFixed(2)
      };
      log('7. BROWSER STORAGE QUOTA (OPFS)', [quotaData]);

      if ((estimate.usage / estimate.quota) > 0.9) {
        console.error('🚨 CRITICAL: Browser storage is ' + quotaData.usage_percent + '% full!');
        console.log('💡 FIX: Clear old data or request more quota');
      } else {
        console.log('✅ Browser storage OK: ' + quotaData.usage_percent + '% used');
      }
    } else {
      console.log('⚠️  Storage API not available in this browser');
    }

    // ════════════════════════════════════════════════════════════════════════
    // 8. SUMMARY & DIAGNOSIS
    // ════════════════════════════════════════════════════════════════════════
    console.log('\n' + '═'.repeat(80));
    console.log('📊 DIAGNOSIS SUMMARY');
    console.log('═'.repeat(80));

    const issues = [];
    const fixes = [];

    if (limits[0]?.usage_percent > 90) {
      issues.push('🚨 Database size limit reached (' + limits[0].usage_percent + '%)');
      fixes.push('Clear old documents or increase max_page_count');
    }

    if (memory[0]?.cache_size_kb < 32000) {
      issues.push('⚠️  Cache too small (' + (memory[0].cache_size_kb/1024).toFixed(1) + 'MB)');
      fixes.push('await db.execAsync("PRAGMA cache_size = -131072")');
    }

    if (navigator.storage) {
      const est = await navigator.storage.estimate();
      if ((est.usage / est.quota) > 0.9) {
        issues.push('🚨 Browser storage quota nearly full');
        fixes.push('Clear browser data or request persistent storage');
      }
    }

    const notNull = constraints.filter(c => c.is_not_null);
    if (notNull.length > 0) {
      issues.push('ℹ️  Required fields: ' + notNull.map(c => c.column_name).join(', '));
      fixes.push('Ensure all NOT NULL fields are provided when inserting');
    }

    if (issues.length === 0) {
      console.log('✅ No obvious issues detected!');
      console.log('\n💡 If you\'re still getting errors, the issue may be:');
      console.log('   - Duplicate ID (PRIMARY KEY violation)');
      console.log('   - Invalid constraint (CHECK constraint)');
      console.log('   - Old build (rebuild with: npm run build)');
    } else {
      console.log('⚠️  ISSUES FOUND:');
      issues.forEach(i => console.log('   ' + i));
      console.log('\n💡 RECOMMENDED FIXES:');
      fixes.forEach(f => console.log('   ' + f));
    }

    console.log('\n═'.repeat(80));
    console.log('✅ DIAGNOSTICS COMPLETE');
    console.log('═'.repeat(80));

  } catch (error) {
    console.error('\n❌ ERROR running diagnostics:', error);
    console.error('Stack:', error.stack);
    console.log('\n💡 Common issues:');
    console.log('   - Database not initialized: Make sure db is ready');
    console.log('   - Wrong db instance: Try window.storageManager.db');
    console.log('   - Method not available: This script uses execAsync()');
  }
})();
