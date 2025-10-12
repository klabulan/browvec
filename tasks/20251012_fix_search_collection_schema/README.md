# Fix Search Collection Schema Mismatch

**Task ID:** 20251012_fix_search_collection_schema
**Date:** 2025-10-12
**Priority:** CRITICAL (Production Bug)
**Status:** In Progress

## Problem

Search functionality fails with error: `no such table: docs_chunks`

**User Impact:**
- All search queries fail when using non-default collections
- Demo application cannot search imported documents

## Root Cause

The search implementation in `DatabaseWorker.ts:handleSearch()` uses the OLD multi-table schema pattern:
```sql
FROM docs_${collection} d
JOIN fts_${collection} f
```

But the ACTUAL schema (v3, implemented in TASK-001) uses a single-table pattern with collection column:
```sql
FROM docs_default d
WHERE d.collection = ?
```

**Why This Happened:**
Schema v3 migration (TASK-001) updated:
- ✅ Schema creation (`SchemaManager.ts`)
- ✅ Document insertion (`DatabaseWorker.ts:handleInsertDocumentWithEmbedding`)
- ✅ Tests (`schema-v3.spec.ts`, `collection-schema.spec.ts`)
- ❌ **Search queries were NOT updated** ← THIS IS THE BUG

## Solution

Update all search SQL queries in `DatabaseWorker.ts:handleSearch()` to:
1. Use correct table names: `docs_default`, `fts_default`, `vec_default_dense`
2. Add `WHERE d.collection = ?` filter clauses
3. Update parameter bindings to include collection name

## Files Affected

- `src/database/worker/core/DatabaseWorker.ts` - Fix search SQL (lines 880-971)

## Verification

1. Run unit tests: `npm test`
2. Run E2E tests: `npm run test:e2e`
3. Test demo application search with "chunks" collection
4. Verify search works with multiple collections

## Rollback

If issues occur, revert commit and use git history to restore previous version.
