# FTS5 Search Issue - Comprehensive Solution

**Date:** 2025-10-16
**Priority:** CRITICAL
**Status:** ROOT CAUSE IDENTIFIED

---

## 🎯 Executive Summary

**Problem:** Russian text search returns 0 results despite having:
- ✅ Schema v4 with unicode61 tokenizer
- ✅ 11 documents in database
- ✅ 11 rows in FTS5 table

**Root Cause:** FTS5 table has **empty rows** - the sync logic during document insertion is not populating FTS5 content columns.

**Impact:** ALL text search (English + Russian) is broken, not just Russian.

---

## 🔍 Root Cause Analysis

### Diagnostic Results

```
Schema Version: 4 (unicode61 tokenizer)
Documents in docs_default: 11 ✅
Rows in fts_default: 11 ✅
Content in fts_default: 0 ❌  ← ROOT CAUSE

Search Results:
- "machine learning": 0 results (should work)
- "Пушкин": 0 results (should work)
- ALL queries: 0 results
```

### What Went Wrong

**Hypothesis 1: FTS5 Sync Logic Bug** (MOST LIKELY)
Location: `src/database/worker/core/DatabaseWorker.ts:526-568`

The manual FTS5 sync code runs after document insert:

```typescript
// Line 542-544
await this.sqliteManager.exec(
  'INSERT INTO fts_default(rowid, title, content, metadata) VALUES (?, ?, ?, ?)',
  [rowid, validParams.document.title || '', validParams.document.content || '', metadataJson]
);
```

**Potential issues:**
1. Parameters not being bound correctly
2. Transaction rollback after FTS5 insert
3. External content table (content=docs_default) misconfiguration
4. Batch insert skipping FTS5 sync (skipFtsSync parameter)

**Hypothesis 2: OPFS Deserialization Issue**
When loading database from OPFS, the FTS5 external content table might lose its link to docs_default.

---

## 🛠️ Immediate Fix (For Users)

### Fix Option 1: Manual FTS5 Rebuild (QUICK)

```javascript
// In browser console:

// 1. Check current state
const ftsCheck = await db.execAsync('SELECT rowid, title FROM fts_default LIMIT 3');
console.log('Current FTS5:', ftsCheck[0]?.values);

// 2. Delete empty FTS5 rows
await db.execAsync('DELETE FROM fts_default');
console.log('✅ FTS5 cleared');

// 3. Rebuild from docs_default
await db.execAsync(`
  INSERT INTO fts_default(rowid, title, content, metadata)
  SELECT rowid, title, content, metadata FROM docs_default
`);
console.log('✅ FTS5 rebuilt');

// 4. Verify search works
const results = await db.search({ query: { text: 'Пушкин' }, limit: 10 });
console.log('Search results:', results.results.length, 'documents');

// Expected: 1-2 Russian documents
```

### Fix Option 2: Reload Test Data (EASIEST)

1. Click **"Clear Data"** button in demo
2. Click **"Load Test Data"** button
3. Test search: `await db.search({ query: { text: 'Пушкин' }, limit: 10 })`

---

## 🔧 Code Fix (For Developers)

### Issue 1: FTS5 Sync in Single Document Insert

**File:** `src/database/worker/core/DatabaseWorker.ts`
**Lines:** 526-568

**Current Code:**
```typescript
// STEP 5.5: Manually sync FTS5 (no automatic triggers to avoid memory exhaustion)
if (!skipFtsSync) {
  this.logger.debug(`[InsertDoc] Syncing FTS5 index for document: ${documentId}`);
  try {
    const rowidResult = await this.sqliteManager.select(
      'SELECT rowid FROM docs_default WHERE id = ? AND collection = ?',
      [documentId, validParams.collection]
    );

    if (rowidResult.rows.length > 0) {
      const rowid = rowidResult.rows[0].rowid;

      await this.sqliteManager.exec(
        'INSERT INTO fts_default(rowid, title, content, metadata) VALUES (?, ?, ?, ?)',
        [rowid, validParams.document.title || '', validParams.document.content || '', metadataJson]
      );
      // ...
    }
  } catch (ftsError) {
    this.logger.warn(`FTS5 sync failed...`); // ← ERROR SWALLOWED!
  }
}
```

**Problem:** FTS5 sync errors are **logged but not propagated**. If the INSERT fails, the document is saved but becomes unsearchable.

**Proposed Fix:**
```typescript
// STEP 5.5: Manually sync FTS5 (CRITICAL for search functionality)
if (!skipFtsSync) {
  this.logger.debug(`[InsertDoc] Syncing FTS5 index for document: ${documentId}`);

  const rowidResult = await this.sqliteManager.select(
    'SELECT rowid FROM docs_default WHERE id = ? AND collection = ?',
    [documentId, validParams.collection]
  );

  if (rowidResult.rows.length === 0) {
    throw new DocumentInsertError(
      `Cannot sync FTS5: document ${documentId} not found in docs_default after insert`,
      { collection: validParams.collection, documentId }
    );
  }

  const rowid = rowidResult.rows[0].rowid;

  // CRITICAL: If FTS5 sync fails, the entire insert should fail
  try {
    await this.sqliteManager.exec(
      'INSERT INTO fts_default(rowid, title, content, metadata) VALUES (?, ?, ?, ?)',
      [rowid, validParams.document.title || '', validParams.document.content || '', metadataJson]
    );

    // Verify FTS5 insert succeeded
    const verifyResult = await this.sqliteManager.select(
      'SELECT COUNT(*) as count FROM fts_default WHERE rowid = ?',
      [rowid]
    );

    const ftsCount = verifyResult.rows[0]?.count || 0;
    if (ftsCount === 0) {
      throw new Error(
        `FTS sync verification failed for document ${documentId} (rowid: ${rowid}). ` +
        `Document was inserted but FTS index update failed.`
      );
    }

    this.logger.debug(`[InsertDoc] ✓ FTS5 sync completed and verified for document: ${documentId} (rowid: ${rowid})`);

  } catch (ftsError) {
    // CRITICAL: Propagate FTS5 errors - don't just log
    this.logger.error(`[InsertDoc] FTS5 sync FAILED for document ${documentId}:`, ftsError);
    throw new DocumentInsertError(
      `Failed to sync document to FTS5 index: ${ftsError instanceof Error ? ftsError.message : String(ftsError)}`,
      { collection: validParams.collection, documentId, rowid, originalError: ftsError }
    );
  }
}
```

### Issue 2: Batch Insert FTS5 Sync

**File:** `src/database/worker/core/DatabaseWorker.ts`
**Lines:** 754-857

**Current Code:**
```typescript
// STEP: Sync FTS5 separately in small batches (e.g., 10 at a time)
for (let ftsIdx = 0; ftsIdx < batch.length; ftsIdx += FTS_BATCH_SIZE) {
  // ...
  for (let subBatchDocIdx = 0; subBatchDocIdx < ftsSubBatch.length; subBatchDocIdx++) {
    const document = ftsSubBatch[subBatchDocIdx];

    // CRITICAL FIX (Task 2.1): Match by array position
    const globalFtsIdx = batchStartIdx + ftsIdx + subBatchDocIdx;
    const docId = results[globalFtsIdx]?.id;

    if (!docId) {
      throw new Error(/* ... */);
    }

    // Get rowid and sync to FTS5
    const rowidResult = await this.sqliteManager.select(
      'SELECT rowid FROM docs_default WHERE id = ? AND collection = ?',
      [docId, collection]
    );

    if (rowidResult.rows.length === 0) {
      throw new Error(/* ... */);
    }

    const rowid = rowidResult.rows[0].rowid;
    const metadataJson = JSON.stringify(document.metadata || {});

    // Insert into FTS5
    await this.sqliteManager.exec(
      'INSERT INTO fts_default(rowid, title, content, metadata) VALUES (?, ?, ?, ?)',
      [rowid, document.title || '', document.content || '', metadataJson]
    );

    // Verification...
  }
}
```

**Analysis:** This code looks correct, but needs better error handling and logging.

**Proposed Enhancement:**
```typescript
// Log parameters before FTS5 insert
this.logger.debug(`[BatchInsert] FTS5 insert params: rowid=${rowid}, title="${document.title?.substring(0, 30)}...", content_length=${document.content?.length}, metadata_length=${metadataJson.length}`);

// Insert into FTS5
await this.sqliteManager.exec(
  'INSERT INTO fts_default(rowid, title, content, metadata) VALUES (?, ?, ?, ?)',
  [rowid, document.title || '', document.content || '', metadataJson]
);

// Enhanced verification with content check
const verifyFtsResult = await this.sqliteManager.select(
  'SELECT rowid, title, LENGTH(content) as content_length FROM fts_default WHERE rowid = ?',
  [rowid]
);

const ftsRow = verifyFtsResult.rows[0];
if (!ftsRow) {
  throw new Error(`FTS sync verification failed: rowid ${rowid} not found after insert`);
}

if (!ftsRow.title && !ftsRow.content_length) {
  throw new Error(`FTS sync verification failed: rowid ${rowid} has NULL/empty content`);
}

this.logger.debug(`[BatchInsert] ✓ FTS sync verified: rowid=${rowid}, title="${ftsRow.title?.substring(0, 30)}...", content_length=${ftsRow.content_length}`);
```

---

## 🚀 Enhanced Solution: Schema v5 with remove_diacritics

### Implementation Plan

**1. Bump Schema Version**

File: `src/database/worker/schema/SchemaManager.ts`

```typescript
// Line 17
export const CURRENT_SCHEMA_VERSION = 5;

/**
 * Database schema version
 *
 * Version 4: Added unicode61 tokenizer for Cyrillic/multilingual support
 * Version 5: Enhanced tokenizer with remove_diacritics for fuzzy matching
 */
```

**2. Update FTS5 Tokenizer**

File: `src/database/worker/schema/SchemaManager.ts` (Line 239)

```typescript
// Before:
tokenize='unicode61'

// After:
tokenize='unicode61 remove_diacritics 1'
```

**Benefits:**
- ✅ Handles Cyrillic, CJK, Arabic, and all Unicode scripts
- ✅ Case-insensitive search
- ✅ Diacritic-insensitive: `ё` = `е`, `á` = `a`, `ü` = `u`
- ✅ Better fuzzy matching for Russian and other languages
- ✅ Compatible with FTS5 prefix operator for partial search

**Trade-offs:**
- ⚠️ Slightly reduced precision (ё and е treated identically)
- ⚠️ Requires database recreation (export → clear → reimport)

---

## 📋 Testing Checklist

### Pre-deployment Testing

- [ ] Fix FTS5 sync logic in DatabaseWorker.ts
- [ ] Add comprehensive logging for FTS5 operations
- [ ] Ensure errors are propagated (not swallowed)
- [ ] Test single document insert with verification
- [ ] Test batch document insert with verification
- [ ] Implement schema v5 with remove_diacritics
- [ ] Update documentation and migration guide

### Post-deployment Testing

- [ ] Create fresh database (schema v5)
- [ ] Load test data (English + Russian documents)
- [ ] Verify FTS5 table has content: `SELECT rowid, title, LENGTH(content) FROM fts_default LIMIT 5`
- [ ] Test English search: `search({ query: { text: 'machine learning' }})`
- [ ] Test Russian search: `search({ query: { text: 'Пушкин' }})`
- [ ] Test case-insensitive: `search({ query: { text: 'пушкин' }})`  (lowercase)
- [ ] Test diacritic-insensitive: `search({ query: { text: 'Федор' }})` vs `search({ query: { text: 'Фёдор' }})`
- [ ] Test prefix search: `db.execAsync("SELECT * FROM fts_default WHERE fts_default MATCH 'Пушк*'")`
- [ ] Test multi-word: `search({ query: { text: 'Россия история' }})`

---

## 📚 Partial Word Search Implementation

### Option 1: FTS5 Prefix Operator (Recommended)

**SQL:**
```sql
SELECT * FROM fts_default WHERE fts_default MATCH 'Пушк*'
```

**Application-level helper:**
```javascript
function enhanceQuery(userQuery) {
  // Auto-append * for partial matching
  return userQuery.split(/\s+/).map(word => `${word}*`).join(' OR ');
}

// Usage:
const query = enhanceQuery('Пушк Толст');
// Result: "Пушк* OR Толст*"
```

### Option 2: Application-level Smart Search

```javascript
async function smartSearch(query, options = {}) {
  const { partialMatch = true, fuzzyMatch = true, multiword = 'OR' } = options;

  // Tokenize query
  let tokens = query.trim().split(/\s+/);

  // Add wildcards for partial matching
  if (partialMatch) {
    tokens = tokens.map(t => `${t}*`);
  }

  // Combine with operator
  const ftsQuery = tokens.join(` ${multiword} `);

  return await db.search({ query: { text: ftsQuery }, limit: 10 });
}

// Usage:
await smartSearch('Пушк Толст');
// Executes: "Пушк* OR Толст*"
```

---

## 🎯 Success Criteria

### Immediate (Critical Fix)
- [x] Identify root cause: FTS5 sync issue
- [ ] Fix FTS5 sync in single document insert
- [ ] Fix FTS5 sync in batch document insert
- [ ] All test searches return results (English + Russian)

### Short-term (Schema v5)
- [ ] Implement remove_diacritics tokenizer
- [ ] Bump schema version to 5
- [ ] Update migration documentation
- [ ] Test diacritic-insensitive search

### Long-term (UX Enhancement)
- [ ] Implement smart search with auto-wildcard
- [ ] Add search analytics to track query patterns
- [ ] Consider trigram index for autocomplete
- [ ] Implement query preprocessing (synonyms, stemming)

---

## 📞 Support & Resources

### Diagnostic Tools
- `COMPREHENSIVE_SEARCH_DIAGNOSTIC.js` - Full system diagnostic
- `FTS5_DEEP_DIAGNOSTIC.js` - Deep FTS5 content analysis

### Documentation
- [SQLite FTS5](https://www.sqlite.org/fts5.html)
- [unicode61 Tokenizer](https://www.sqlite.org/fts5.html#unicode61_tokenizer)
- [FTS5 Prefix Queries](https://www.sqlite.org/fts5.html#prefix_queries)

### Related Tasks
- `tasks/20251012_fix_fts5_unicode_tokenizer/` - Initial unicode61 implementation
- `tasks/20251016_fts5_enhanced_tokenizer/` - Enhanced tokenizer with remove_diacritics

---

## ✅ Next Steps

### Immediate Actions (Priority: CRITICAL)
1. **Fix FTS5 sync logic** - Ensure errors are propagated
2. **Add verification** - Verify FTS5 content after insert
3. **Enhanced logging** - Debug FTS5 operations
4. **Test with diagnostic** - Run FTS5_DEEP_DIAGNOSTIC.js

### Short-term Actions (Priority: HIGH)
5. **Implement schema v5** - Add remove_diacritics
6. **Update documentation** - Migration guide
7. **Rebuild test database** - Verify fix works

### Long-term Actions (Priority: MEDIUM)
8. **Smart search API** - Auto-wildcard, fuzzy matching
9. **Search analytics** - Track query patterns
10. **Autocomplete feature** - Consider trigram index

---

**Document Version:** 1.0
**Last Updated:** 2025-10-16
**Status:** Ready for Implementation
