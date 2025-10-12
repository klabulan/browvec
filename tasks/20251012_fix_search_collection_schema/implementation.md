# Implementation

## Changes Made

### File: `src/database/worker/core/DatabaseWorker.ts`

**Lines 879-930: Hybrid Search (Text + Vector)**

**Before:**
```typescript
FROM docs_${collection} d
JOIN fts_${collection} f ON d.rowid = f.rowid
WHERE fts_${collection} MATCH ?
```

**After:**
```typescript
FROM docs_default d
JOIN fts_default f ON d.rowid = f.rowid
WHERE d.collection = ? AND fts_default MATCH ?
```

**Parameter Changes:**
```typescript
// Before
searchParams = [
  searchQuery.text, limit,
  vectorJson, limit,
  fusionMethod,
  fusionWeights.fts, fusionWeights.vec,
  limit
];

// After
searchParams = [
  collection, searchQuery.text, limit,  // ← Added collection parameter
  vectorJson, limit,
  collection,                             // ← Added collection parameter for vec_results
  fusionMethod,
  fusionWeights.fts, fusionWeights.vec,
  limit
];
```

**Lines 939-951: Text-Only Search (FTS)**

**Before:**
```typescript
FROM docs_${collection} d
JOIN fts_${collection} f ON d.rowid = f.rowid
WHERE fts_${collection} MATCH ?
```

**After:**
```typescript
FROM docs_default d
JOIN fts_default f ON d.rowid = f.rowid
WHERE d.collection = ? AND fts_default MATCH ?
```

**Parameter Changes:**
```typescript
// Before
searchParams = [ftsQuery, limit];

// After
searchParams = [collection, ftsQuery, limit];  // ← Added collection parameter
```

**Lines 957-974: Vector-Only Search**

**Before:**
```typescript
FROM docs_${collection} d
JOIN (
  SELECT rowid, distance
  FROM vec_${collection}_dense
  WHERE embedding MATCH ?
  ...
) v ON d.rowid = v.rowid
```

**After:**
```typescript
FROM docs_default d
JOIN (
  SELECT rowid, distance
  FROM vec_default_dense
  WHERE embedding MATCH ?
  ...
) v ON d.rowid = v.rowid
WHERE d.collection = ?
```

**Parameter Changes:**
```typescript
// Before
searchParams = [vectorJson, limit];

// After
searchParams = [vectorJson, limit, collection];  // ← Added collection parameter
```

## Technical Details

### Schema v3 Architecture

The schema uses a **single-table pattern** with collection differentiation:

- **`docs_default`** - Single table with `collection` column (indexed)
- **`fts_default`** - FTS5 EXTERNAL CONTENT table referencing docs_default
- **`vec_default_dense`** - vec0 virtual table with embeddings

### How Collection Filtering Works

1. **Filter docs first**: `WHERE d.collection = ?` uses the indexed column
2. **Join FTS by rowid**: FTS5 automatically gets the right content via rowid
3. **Join vector by rowid**: vec0 gets the matching embedding via rowid

### Performance Considerations

- Collection column has index: `idx_docs_collection` (SchemaManager.ts:227)
- Filtering by indexed column is efficient (O(log n))
- No performance degradation vs. multi-table approach
- Actually better: single table = fewer file handles, better cache locality

## Build Results

```
npm run build:sdk
✓ 46 modules transformed
✓ built in 861ms
```

All TypeScript compilation successful, no errors.

## Testing Plan

1. ✅ Build SDK - PASSED
2. ⏳ Test demo application with "chunks" collection
3. ⏳ Run E2E tests
4. ⏳ Verify multi-collection search works

## Rollback Plan

If issues occur, revert commit:
```bash
git checkout HEAD~1 -- src/database/worker/core/DatabaseWorker.ts
npm run build:sdk
```
