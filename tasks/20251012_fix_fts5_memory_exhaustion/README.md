# Fix FTS5 Memory Exhaustion During Batch Insert

**Date:** 2025-10-12
**Status:** ✅ COMPLETED
**Priority:** CRITICAL

## Problem

After adding FTS5 sync triggers in commit 9eb593f, batch document inserts failed with:
```
Error: database or disk is full
```

**Root Cause:** FTS5 triggers fired for EVERY document insert inside the transaction, accumulating all indexing data in memory until COMMIT. With 38 documents, this exceeded the 8MB SQLite cache limit.

**Error Flow:**
1. BEGIN TRANSACTION
2. Insert 38 documents → Each fires FTS5 trigger → FTS5 data accumulates in memory
3. COMMIT tries to finalize FTS5 indexes → **Memory exhaustion** → Error
4. Transaction rolls back

## Solution

**Manual FTS5 Sync with Controlled Batching**

Remove automatic triggers and manually sync FTS5 in small, separate batches after document inserts commit:

1. **Remove FTS5 triggers** from SchemaManager
2. **Add skipFtsSync parameter** to handleInsertDocumentWithEmbedding()
3. **Skip FTS5 during batch transaction** (documents only)
4. **Sync FTS5 separately** in 10-document batches with individual transactions

## Benefits

- ✅ **Prevents memory exhaustion** - FTS5 batches are small (10 docs max)
- ✅ **Maintains search functionality** - FTS5 index stays synced
- ✅ **Better error handling** - FTS5 failures don't break document inserts
- ✅ **Performance maintained** - Same indexing work, just split up
- ✅ **Aligns with vector pattern** - Vectors already inserted manually

## Files Changed

1. `src/database/worker/schema/SchemaManager.ts` - Removed FTS5 triggers
2. `src/database/worker/core/DatabaseWorker.ts` - Manual FTS5 sync logic

## Related Issues

- **Previous Fix:** 9eb593f (Added FTS5 triggers - caused this issue)
- **Original Issue:** FTS5 index was empty without triggers
- **This Fix:** Manual sync prevents memory issues while keeping FTS5 working
