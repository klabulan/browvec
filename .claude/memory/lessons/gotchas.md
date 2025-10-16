# Gotchas & Common Pitfalls

**Last Updated:** 2025-10-16

---

## OPFS Pitfalls

### 1. Path Format is Critical
```typescript
// ❌ WRONG - Missing "opfs:/" prefix
await initLocalRetrieve("localretrieve/demo.db");

// ✅ CORRECT
await initLocalRetrieve("opfs:/localretrieve/demo.db");
```
**Symptom:** Works but doesn't persist
**Why:** Without `opfs:/`, treated as in-memory

---

### 2. OPFS is Always Async
```typescript
// ❌ WRONG - No such thing as sync OPFS
const data = readFromOPFSSync(path);

// ✅ CORRECT
const data = await readFromOPFS(path);
```
**Symptom:** TypeError or undefined
**Why:** OPFS API has no synchronous methods

---

### 3. Private Browsing Breaks OPFS
**Scenario:** User opens app in private/incognito mode
**Result:** OPFS unavailable, falls back to memory
**Gotcha:** No error, silent fallback
**Detection:** Check `navigator.storage.persist()`

---

## SQLite & WASM Gotchas

### 4. Vector Dimensions Must Match
```typescript
// ❌ WRONG - 512 dimensions
const embedding = new Float32Array(512);

// ✅ CORRECT - Must be 384
const embedding = new Float32Array(384);
```
**Symptom:** "Dimension mismatch" error
**Why:** sqlite-vec configured for 384-dim

---

### 5. Statements Must Be Finalized
```typescript
// ❌ WRONG - Memory leak
const stmt = db.prepare("SELECT * FROM docs");
stmt.step();
// stmt never finalized!

// ✅ CORRECT
const stmt = db.prepare("SELECT * FROM docs");
try {
    stmt.step();
} finally {
    stmt.finalize();
}
```
**Symptom:** Memory usage grows over time
**Why:** WASM doesn't auto-cleanup statements

---

### 6. FTS5 Queries Need Special Syntax
```typescript
// ❌ WRONG - Regular LIKE won't use FTS5 index
SELECT * FROM fts_default WHERE content LIKE '%search%';

// ✅ CORRECT - Use MATCH operator
SELECT * FROM fts_default WHERE fts_default MATCH 'search';
```
**Symptom:** Slow queries, no BM25 ranking
**Why:** LIKE doesn't trigger FTS5 engine

---

## Browser API Gotchas

### 7. SharedArrayBuffer Requires Headers
**Scenario:** WASM fails to load with "SharedArrayBuffer not defined"
**Cause:** Missing COOP/COEP headers
**Fix:** Dev server must set:
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```
**Gotcha:** Works locally, fails in production if headers not set

---

### 8. Web Locks Don't Work in All Contexts
**Scenario:** navigator.locks is undefined
**Causes:**
- Non-secure context (HTTP instead of HTTPS)
- Iframe without proper permissions
- Very old browser

**Detection:**
```typescript
if (!navigator.locks) {
    console.warn('Web Locks not available, multi-tab sync disabled');
}
```

---

## Worker RPC Gotchas

### 9. Worker Errors Lose Context by Default
```typescript
// ❌ WRONG - Lost stack trace
self.postMessage({ id, error: error.message });

// ✅ CORRECT - Preserve context
self.postMessage({
    id,
    error: {
        message: error.message,
        stack: error.stack,
        method, params  // Include request context
    }
});
```
**Symptom:** Can't debug worker errors
**Why:** Structured clone drops Error object properties

---

### 10. Large Data Transfer Can Be Slow
**Scenario:** Exporting 100MB database
**Gotcha:** postMessage copies by default
**Fix:** Use Transferable objects
```typescript
// Uint8Array.buffer is Transferable
worker.postMessage(
    { data: uint8Array },
    [uint8Array.buffer]  // Transfer ownership
);
```
**Benefit:** Zero-copy transfer

---

## Schema & Migrations

### 11. Partial Schema is Dangerous
**Scenario:** Only some tables exist
**Gotcha:** Auto-init drops ALL tables and recreates
**Why:** Ensures consistency
**Prevention:** Always use complete schema or none

---

### 12. Schema Changes Break Existing Databases
**Scenario:** Add new required column
**Result:** Old databases fail
**Solution:** Schema versioning + migrations
**Current:** Not implemented (on roadmap)

---

## Testing Gotchas

### 13. OPFS Not Available in Tests
**Scenario:** Tests fail with "getDirectory is not a function"
**Cause:** Test environment (jsdom) doesn't have OPFS
**Fix:** Mock OPFS or use Playwright for E2E
```typescript
// Mock for unit tests
vi.spyOn(navigator.storage, 'getDirectory')
    .mockImplementation(mockOPFS);
```

---

### 14. Async Timing in Tests
**Scenario:** Test passes/fails randomly
**Cause:** Not waiting for async operations
**Fix:** Always `await` or use `waitFor`
```typescript
// ❌ WRONG
db.exec(sql);  // Fire and forget
expect(db.get(...)).toBe(...);  // Might not be done

// ✅ CORRECT
await db.exec(sql);
expect(await db.get(...)).toBe(...);
```

---

## Performance Gotchas

### 15. Unindexed Lookups are Slow
```sql
-- ❌ SLOW - Full table scan
SELECT * FROM docs_default WHERE collection = ?

-- ✅ FAST - Uses index
-- (After: CREATE INDEX idx_docs_collection ON docs_default(collection))
SELECT * FROM docs_default WHERE collection = ?
```
**Gotcha:** Works fine with 100 rows, crawls at 10,000

---

### 16. Too Many RPC Calls
```typescript
// ❌ WRONG - 1000 RPC calls
for (const doc of docs) {
    await db.run(`INSERT INTO docs_default ...`, [doc]);
}

// ✅ CORRECT - 1 RPC call
await db.exec(`BEGIN TRANSACTION`);
for (const doc of docs) {
    await db.run(`INSERT INTO docs_default ...`, [doc]);
}
await db.exec(`COMMIT`);
```
**Difference:** 10x faster with transaction

---

## Security & Privacy Gotchas

### 17. OPFS Data Not Encrypted
**Gotcha:** OPFS data stored as plain files
**Risk:** Other origins can't access (good), but device access possible
**Mitigation:** Client-side encryption if needed
**Note:** Same as IndexedDB behavior

---

### 18. Cross-Origin Embeddings Fail
**Scenario:** Embed LocalRetrieve in iframe from different origin
**Result:** COOP/COEP violations, features disabled
**Fix:** Same-origin iframes only, or proper CORP headers

---

## Deployment Gotchas

### 19. WASM Files Must Be Served Correctly
**Gotcha:** Wrong MIME type breaks loading
**Fix:** Ensure `.wasm` served as `application/wasm`
**Vite:** Handles automatically
**Other servers:** May need config

---

### 20. Build Output Paths Matter
**Scenario:** WASM files not found in production
**Cause:** Build outputs to `dist/` but server expects `public/`
**Fix:** Copy WASM to both locations
```bash
npm run build:wasm  # Already handles this
```

---

## Quick Gotcha Checklist

Before deploying or debugging, check:
- [ ] OPFS paths start with `opfs:/`
- [ ] COOP/COEP headers set for SharedArrayBuffer
- [ ] Vectors are Float32Array (384-dim)
- [ ] Statements finalized after use
- [ ] Errors include full context
- [ ] Large data uses Transferable objects
- [ ] Schema complete (not partial)
- [ ] Collections indexed for filtering
- [ ] Transactions used for bulk inserts
- [ ] WASM files deployed with correct MIME types

---

### 21. FTS Batch Sync Array Matching Gotcha
**Scenario:** Using `.find()` with `true` fallback for array matching
**Problem:**
```typescript
// ❌ WRONG - Matches FIRST result always when doc has no ID
const docId = results.find(r => {
    return doc.id ? r.id === doc.id : true;
})?.id;
```
**Why it fails:** `true` matches FIRST element in array, causing:
- Wrong docId lookup (all docs without ID match results[0])
- FTS sync failures for later documents in batch
- Silent partial indexing (some docs indexed, others not)

**Fix:** Use array position instead of fuzzy matching
```typescript
// ✅ CORRECT - Deterministic position matching
const resultIndex = batchStartIdx + ftsIdx + subBatchDocIdx;
const docId = results[resultIndex]?.id;

if (!docId) {
    throw new Error(`FTS sync failed: No result at index ${resultIndex}`);
}
```

**Symptom:** Russian/Cyrillic docs (typically last in batch) not searchable
**Root cause:** Positional bug, not language/tokenizer issue
**Impact:** Documents exist in `docs_default` but missing from `fts_default`

**Lesson:** Never use fuzzy matching (`true` fallback) for array indexing. Always use deterministic position or explicit ID matching.

**Date discovered:** 2025-10-16 (Task 20251016_russian_fts_indexing_fix)

---

*This document captures surprising behaviors and easy-to-miss details. Update when you encounter a gotcha!*
