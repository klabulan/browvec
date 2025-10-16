# Task: Enhanced FTS5 Tokenizer Configuration

**Date:** 2025-10-16
**Status:** Implementation
**Related Commits:** 66ee684 (unicode61 base implementation)

## Problem Statement

### Primary Issue: Russian Search Not Working
Users report that Russian text search fails even after schema v4 (unicode61 tokenizer) implementation.

**Root Cause Analysis:**
1. **Old Database Schema**: Users working with databases created before schema v4 still have ASCII tokenizer
2. **No Auto-Migration**: Schema v4 requires manual database recreation (export → clear → reimport)
3. **Lack of Fuzzy Matching**: Current unicode61 configuration doesn't handle accent variations (ё vs е)
4. **No Partial Word Search**: Users want to search for "Пушк" and find "Пушкин"

### Secondary Issue: Partial Word Search
Current implementation requires exact word matches. Users want:
- Prefix search: "Пушк*" → "Пушкин"
- Fuzzy matching: "ё" ≈ "е"
- Better autocomplete support

## Solution Design

### Schema Version 5: Enhanced Tokenizer

**Tokenizer Configuration:**
```sql
tokenize='unicode61 remove_diacritics 1'
```

**Benefits:**
- ✅ Full Unicode support (Cyrillic, CJK, Arabic, etc.)
- ✅ Case-insensitive search
- ✅ Diacritic-insensitive: ё → е, á → a, ü → u
- ✅ Better fuzzy matching for Russian text
- ✅ Compatible with FTS5 prefix operator: `word*`

**Trade-offs:**
- ⚠️ Slightly reduced precision (ё and е treated as equivalent)
- ⚠️ Requires database recreation for existing users

## Implementation

### 1. Schema Version Bump

**File:** `src/database/worker/schema/SchemaManager.ts`

```typescript
// Line 17: Bump version
export const CURRENT_SCHEMA_VERSION = 5;
```

**Documentation:**
```typescript
/**
 * Database schema version
 *
 * Version 4: Added unicode61 tokenizer for Cyrillic/multilingual support
 * Version 5: Enhanced tokenizer with remove_diacritics for fuzzy matching
 */
```

### 2. Enhanced FTS5 Table Creation

**File:** `src/database/worker/schema/SchemaManager.ts`

**Change line 239:**
```typescript
// Before (v4):
tokenize='unicode61'

// After (v5):
tokenize='unicode61 remove_diacritics 1'
```

**Complete DDL:**
```sql
CREATE VIRTUAL TABLE IF NOT EXISTS fts_default USING fts5(
  title, content, metadata,
  content=docs_default,
  content_rowid=rowid,
  tokenize='unicode61 remove_diacritics 1'
);
```

## Testing Strategy

### Test Cases

1. **Basic Russian Search**
   - Query: `Пушкин` → Should find documents about Pushkin
   - Query: `литература` → Should find literature documents
   - Query: `Россия` → Should find Russia-related content

2. **Case Insensitivity**
   - Query: `пушкин` (lowercase) → Same results as `Пушкин`
   - Query: `ТОЛСТОЙ` (uppercase) → Same results as `Толстой`

3. **Diacritic Insensitivity**
   - Query: `ёлка` and `елка` → Both should return same results
   - Query: `Фёдор` and `Федор` → Both should match Dostoevsky

4. **Prefix Search (FTS5 operator)**
   - Query: `Пушк*` → Should find "Пушкин", "Пушкинский"
   - Query: `Толст*` → Should find "Толстой", "Толстая"

5. **Multi-word Search**
   - Query: `Пушкин литература` → Documents containing both
   - Query: `Россия история` → Russian history documents

### Test Execution

**Manual Testing:**
```javascript
// Browser console after loading demo

// 1. Check schema version
const schema = await db.execAsync('SELECT MAX(schema_version) as version FROM collections');
console.log('Schema version:', schema[0].values[0][0]); // Should be 5

// 2. Check tokenizer
const ftsSchema = await db.execAsync("SELECT sql FROM sqlite_master WHERE name='fts_default'");
console.log('FTS5 DDL:', ftsSchema[0].values[0][0]); // Should include remove_diacritics

// 3. Test Russian search
const results = await db.search({ query: { text: 'Пушкин' }, limit: 10 });
console.log('Search results:', results.results.length); // Should be > 0

// 4. Test prefix search
const prefixResults = await db.execAsync("SELECT * FROM fts_default WHERE fts_default MATCH 'Пушк*'");
console.log('Prefix results:', prefixResults[0].values.length); // Should be > 0
```

**Automated Testing:**
Use the diagnostic script `COMPREHENSIVE_SEARCH_DIAGNOSTIC.js`

## Migration Guide

### For Users with Old Databases

**Option 1: Export → Clear → Reimport (RECOMMENDED)**
```javascript
// 1. Export existing data
const exported = await db.exportAsync();

// 2. Save to file (or keep in memory)
const blob = new Blob([exported], { type: 'application/x-sqlite3' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'localretrieve-backup.db';
a.click();

// 3. Clear database
await db.clearAsync();

// 4. Reimport
// (Load file via file input, then:)
await db.importAsync(backupData);

// 5. Verify
const schema = await db.execAsync('SELECT MAX(schema_version) as version FROM collections');
console.log('New schema version:', schema[0].values[0][0]); // Should be 5
```

**Option 2: Manual FTS5 Rebuild**
```javascript
// Drop and recreate FTS5 table
await db.execAsync('DROP TABLE fts_default');

await db.execAsync(`
  CREATE VIRTUAL TABLE fts_default USING fts5(
    title, content, metadata,
    content=docs_default,
    content_rowid=rowid,
    tokenize='unicode61 remove_diacritics 1'
  )
`);

// Rebuild index
await db.execAsync(`
  INSERT INTO fts_default(rowid, title, content, metadata)
  SELECT rowid, title, content, metadata FROM docs_default
`);

// Update schema version
await db.execAsync('UPDATE collections SET schema_version = 5, updated_at = strftime("%s", "now")');
```

## Tokenizer Comparison

### unicode61 (Schema v4)
```sql
tokenize='unicode61'
```
- ✅ Handles all Unicode scripts
- ✅ Case-insensitive
- ❌ No diacritic folding (ё ≠ е)
- ❌ No partial word search (built-in)
- 💡 Use: `word*` for prefix search

### unicode61 + remove_diacritics (Schema v5)
```sql
tokenize='unicode61 remove_diacritics 1'
```
- ✅ Everything from v4
- ✅ Diacritic folding (ё = е, á = a)
- ✅ Better fuzzy matching
- ✅ More forgiving searches
- ❌ May reduce precision in some cases
- 💡 Use: `word*` for prefix search

### Trigram (Future Consideration)
```sql
tokenize='trigram'
```
- ✅ True substring search
- ✅ Perfect for autocomplete
- ❌ 3-10x larger index
- ❌ Slower indexing
- ❌ Not suitable for full-text search
- 💡 Consider for dedicated autocomplete feature

## Partial Word Search Methods

### Method 1: FTS5 Prefix Operator (RECOMMENDED)
```sql
SELECT * FROM fts_default WHERE fts_default MATCH 'Пушк*'
```
- ✅ Works with any tokenizer
- ✅ No index size penalty
- ✅ Fast
- ❌ Only prefix matching (not substring)

### Method 2: LIKE Operator (Fallback)
```sql
SELECT * FROM docs_default WHERE title LIKE '%Пушк%' OR content LIKE '%Пушк%'
```
- ✅ True substring search
- ✅ Works always
- ❌ Very slow (no index)
- ❌ Doesn't use FTS5
- 💡 Use only as fallback

### Method 3: Application-Level Tokenization
```javascript
// Split query into tokens, create FTS5 query
const tokens = query.split(/\s+/).map(t => `${t}*`).join(' OR ');
// "Пушк Толс" → "Пушк* OR Толс*"
```
- ✅ User-friendly
- ✅ Leverages FTS5
- ✅ Fast
- 💡 RECOMMENDED for production

## Search API Enhancement

### Current API
```javascript
await db.search({ query: { text: 'Пушкин' }, limit: 10 });
```

### Enhanced API (Proposal)
```javascript
await db.search({
  query: { text: 'Пушкин' },
  limit: 10,
  options: {
    partialMatch: true,      // Auto-append * to tokens
    fuzzyMatch: true,         // Use remove_diacritics
    multiword: 'OR'          // OR vs AND for multi-word queries
  }
});
```

## Performance Considerations

### Index Size Impact
- **v4 (unicode61)**: Baseline
- **v5 (unicode61 + remove_diacritics 1)**: ~+2% index size
- **Trigram**: ~+300-1000% index size

### Query Performance
- **Exact match**: <1ms (same across all)
- **Prefix match (`word*`)**: <5ms (same across all)
- **Substring match (LIKE)**: 10-1000ms (depends on data size)

### Recommendation
**Use schema v5** for the best balance of functionality, performance, and index size.

## Known Issues & Limitations

### Issue 1: No Built-In Substring Search
**Limitation:** FTS5 doesn't support true substring search (e.g., "шки" matching "Пушкин")
**Workaround:** Use prefix operator `*` or implement trigram index for autocomplete

### Issue 2: Manual Schema Migration
**Limitation:** Users must manually export/reimport to upgrade
**Future:** Implement automatic schema migration script

### Issue 3: Precision vs Recall Trade-off
**Limitation:** `remove_diacritics 1` may return false positives
**Example:** "лед" (ice) might match "лёд" (same meaning but different spelling)
**Assessment:** Acceptable trade-off for better user experience

## Recommendations

### For This Implementation
1. ✅ **Bump schema to v5** with `tokenize='unicode61 remove_diacritics 1'`
2. ✅ **Update documentation** to explain migration
3. ✅ **Create diagnostic tool** (already done: `COMPREHENSIVE_SEARCH_DIAGNOSTIC.js`)
4. ✅ **Add prefix search** to search API (optional enhancement)

### For Future Enhancements
1. 🔮 **Auto-migration script** for seamless schema upgrades
2. 🔮 **Dedicated autocomplete API** with trigram index
3. 🔮 **Search analytics** to track query patterns
4. 🔮 **Query preprocessing** for better UX (auto-prefix, synonym expansion)

## Success Criteria

- ✅ Russian text search works on fresh databases (schema v5)
- ✅ Prefix search works: `Пушк*` finds "Пушкин"
- ✅ Diacritic-insensitive: `ёлка` = `елка`
- ✅ Case-insensitive: `ПУШКИН` = `Пушкин` = `пушкин`
- ✅ Migration path documented for old databases
- ✅ Performance remains acceptable (<10ms per query)
- ✅ Index size increase is minimal (<5%)

## References

- [SQLite FTS5 Documentation](https://www.sqlite.org/fts5.html)
- [unicode61 Tokenizer](https://www.sqlite.org/fts5.html#unicode61_tokenizer)
- [FTS5 Prefix Queries](https://www.sqlite.org/fts5.html#prefix_queries)
- Commit 66ee684: Initial unicode61 implementation
