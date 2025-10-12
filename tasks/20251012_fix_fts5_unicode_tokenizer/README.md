# Fix FTS5 Cyrillic Search - Add Unicode61 Tokenizer

**Date:** 2025-10-12
**Type:** Bug Fix
**Schema Version:** 3 → 4

## Problem

FTS5 full-text search was failing on non-ASCII text (Cyrillic, CJK, etc.) with error:
```
unrecognized token: "'госор"
```

**Root Cause:** FTS5 table was created without specifying a tokenizer, defaulting to `ascii` which only handles ASCII characters (a-z, A-Z, 0-9).

## Analysis

### WASM Build Investigation
- **SQLite Version:** 3.47.1 (via amalgamation)
- **FTS5 Enabled:** Yes (`-DSQLITE_ENABLE_FTS5=1`)
- **ICU Support:** No (not compiled with `-DSQLITE_ENABLE_ICU`)
- **Available Tokenizers:**
  - ✅ `ascii` (default, limited to ASCII)
  - ✅ `unicode61` (built-in, handles Unicode properly)
  - ✅ `trigram` (character-based, multilingual)
  - ✅ `porter` (English stemming)
  - ❌ `icu` (requires ICU compilation)

### Evidence
- English search: ✅ `MATCH 'problem'` worked
- Cyrillic search: ❌ `MATCH 'госорганах'` failed
- Data present: ✅ Direct SELECT returned Cyrillic content correctly

## Solution

**Added `unicode61` tokenizer to FTS5 table creation** - this tokenizer is built into SQLite and properly handles Unicode characters including Cyrillic, CJK, Arabic, etc.

### Changes Made

**File:** `src/database/worker/schema/SchemaManager.ts`

1. **Bumped schema version:**
   ```typescript
   export const CURRENT_SCHEMA_VERSION = 4; // was 3
   ```

2. **Added tokenizer to FTS5 table:**
   ```sql
   CREATE VIRTUAL TABLE IF NOT EXISTS fts_default USING fts5(
     title, content, metadata,
     content=docs_default,
     content_rowid=rowid,
     tokenize='unicode61'  -- ← Added this line
   );
   ```

3. **Updated error message** to use dynamic schema version

## Impact

- **Breaking Change:** Yes - requires database recreation
- **Migration Path:** Users must export data, clear database, and reimport
- **Benefit:** Full-text search now works with all Unicode languages
- **Performance:** No significant impact (unicode61 is efficient)

## Testing Instructions

1. **Recreate database:**
   ```javascript
   await db.clearAsync();
   // Re-initialize database (schema v4 will be created)
   ```

2. **Test Cyrillic search:**
   ```javascript
   await db.execAsync("SELECT COUNT(*) FROM fts_default WHERE fts_default MATCH 'госорганах'");
   // Should return results without tokenization error
   ```

3. **Verify tokenizer:**
   ```javascript
   // Check FTS5 table configuration
   await db.execAsync("SELECT sql FROM sqlite_master WHERE name='fts_default'");
   // Should show tokenize='unicode61' in the CREATE statement
   ```

## Rollback

If issues arise, revert to schema v3:
1. Set `CURRENT_SCHEMA_VERSION = 3` in SchemaManager.ts
2. Remove `tokenize='unicode61'` from FTS5 table creation
3. Rebuild SDK: `npm run build:sdk`
4. Clear and recreate databases

## References

- [SQLite FTS5 Tokenizers](https://www.sqlite.org/fts5.html#tokenizers)
- [Unicode61 Tokenizer Documentation](https://www.sqlite.org/fts5.html#unicode61_tokenizer)
- Build configuration: `scripts/build-wasm.sh`
