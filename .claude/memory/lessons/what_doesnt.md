# What Doesn't Work: Anti-Patterns to Avoid

**Last Updated:** 2025-10-16

---

## Database & SQLite

### ❌ 1. FTS5 Triggers for Sync
**Anti-pattern:** Using triggers to auto-sync FTS5 with source table
**Problem:** Memory exhaustion on large imports (1000+ docs)
**Why it fails:** Triggers fire for every row, accumulate memory
**Instead:** Manual sync after batch inserts
**Fixed:** 2025-10-16 (replaced triggers with manual pattern)

---

### ❌ 2. Regular Arrays for Vectors
**Anti-pattern:** Using `number[]` for vector embeddings
**Problem:** sqlite-vec expects Float32Array
**Why it fails:** Type mismatch causes runtime errors
**Instead:** Always use `new Float32Array([...])`
**Error message:** "Invalid embedding format"

---

### ❌ 3. Synchronous OPFS Access
**Anti-pattern:** Trying to read OPFS synchronously
**Problem:** OPFS API is always async
**Why it fails:** No sync methods exist
**Instead:** Use async/await for all OPFS operations
**Code smell:** Any OPFS function without `await`

---

### ❌ 4. Double Schema Initialization
**Anti-pattern:** Calling `initLocalRetrieve()` multiple times
**Problem:** Drops and recreates database each time
**Why it fails:** Schema detection sees existing tables
**Instead:** Call init once, store database instance
**Result:** Data loss on second init

---

## Architecture & Patterns

### ❌ 5. Complex Multi-Agent Systems (When Simple Works)
**Anti-pattern:** Creating 5+ specialized agents for small project
**Problem:** Coordination overhead, hard to maintain
**Why it fails:** Violates KISS principle
**Instead:** Universal agent with modes (like Edgar)
**Trade-off:** Fewer agents may mean larger configs

---

### ❌ 6. Blocking Main Thread with WASM
**Anti-pattern:** Running SQLite WASM on main thread
**Problem:** UI freezes during queries
**Why it fails:** JavaScript is single-threaded
**Instead:** Always run WASM in Web Worker
**Impact:** Responsive UI vs 100ms+ freezes

---

### ❌ 7. No Error Context in RPC
**Anti-pattern:** Generic error messages from worker
```typescript
// BAD
throw new Error('Database error');
```
**Problem:** Can't debug without context
**Why it fails:** Lost stack trace, no parameters
**Instead:** Propagate full error context
```typescript
// GOOD
throw new DatabaseError('Query failed', {
    sql, params, method, stack
});
```

---

## Browser APIs

### ❌ 8. Assuming OPFS Always Available
**Anti-pattern:** No fallback when OPFS fails
**Problem:** App crashes in private browsing, old browsers
**Why it fails:** OPFS support not universal
**Instead:** Graceful degradation to memory-only
**Detection:** `try { await navigator.storage.getDirectory() }`

---

### ❌ 9. Missing COOP/COEP Headers
**Anti-pattern:** Not setting security headers for SharedArrayBuffer
**Problem:** "SharedArrayBuffer is not defined"
**Why it fails:** Browser security requirements
**Instead:** Dev server must set headers:
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

---

### ❌ 10. Ignoring Quota Errors
**Anti-pattern:** Not checking storage quota before large writes
**Problem:** Unexpected failures when quota exceeded
**Why it fails:** Browser enforces storage limits
**Instead:** Check quota: `navigator.storage.estimate()`
**Recovery:** Request persistent storage or clear old data

---

## Testing & Quality

### ❌ 11. Over-Testing Trivial Code
**Anti-pattern:** Writing tests for getters/setters
```typescript
// BAD - Waste of time
test('getName returns name', () => {
    expect(obj.getName()).toBe(obj.name);
});
```
**Problem:** Brittle tests, no value
**Why it fails:** Tests obvious code, maintenance burden
**Instead:** Test business logic, edge cases, integrations

---

### ❌ 12. No Integration Tests
**Anti-pattern:** Only unit tests, no E2E/integration
**Problem:** Components work alone but fail together
**Why it fails:** Misses RPC, OPFS, browser API issues
**Instead:** Playwright E2E + integration tests
**Coverage:** Can't unit test browser API interactions

---

## Development Practices

### ❌ 13. Undocumented Architectural Decisions
**Anti-pattern:** Making major decisions without ADRs
**Problem:** Future developers don't know "why"
**Why it fails:** Context lost, decisions reversed incorrectly
**Instead:** Write ADRs for significant choices
**Format:** See `.claude/memory/architecture/decisions/TEMPLATE.md`

---

### ❌ 14. Feature Branches Without Planning
**Anti-pattern:** Starting implementation without design
**Problem:** Wrong architecture, rework required
**Why it fails:** Skips Edgar's step 1-5 (requirements → design)
**Instead:** PLAN → ARCHITECT → (ROAST if large) → DEVELOP
**Result:** Better design, less rework

---

### ❌ 15. Silently Ignoring Errors
**Anti-pattern:** Empty catch blocks or console.log only
```typescript
// BAD
try {
    await opfsWrite(data);
} catch (error) {
    console.log('Failed'); // User never knows!
}
```
**Problem:** User unaware of failures
**Why it fails:** Silent data loss
**Instead:** Notify user, log with context, attempt recovery

---

## Performance Anti-Patterns

### ❌ 16. No Debouncing on Frequent Operations
**Anti-pattern:** Saving to OPFS on every keystroke
**Problem:** Excessive I/O, performance degradation
**Why it fails:** OPFS writes are expensive
**Instead:** Debounce (1 second), batch writes
**Pattern:** See OPFS persistence pattern

---

### ❌ 17. Unindexed Collection Queries
**Anti-pattern:** Filtering by collection without index
```sql
-- BAD (full table scan)
SELECT * FROM docs_default WHERE collection = ?
```
**Problem:** Slow on large datasets
**Why it fails:** No index to optimize query
**Instead:** Add index
```sql
CREATE INDEX idx_docs_collection ON docs_default(collection);
```

---

## Common Mistakes (Quick Reference)

**Path Mistakes:**
- ❌ `"localretrieve/demo.db"` → ✅ `"opfs:/localretrieve/demo.db"`

**Type Mistakes:**
- ❌ `[0.1, 0.2, ...]` → ✅ `new Float32Array([0.1, 0.2, ...])`

**Async Mistakes:**
- ❌ `db.exec(sql)` → ✅ `await db.exec(sql)`

**Query Mistakes:**
- ❌ Selecting from FTS5 directly → ✅ JOIN with source table

**Import Mistakes:**
- ❌ 10,000 single inserts → ✅ Transaction with batches

---

## Recovery Patterns

**When you encounter these anti-patterns:**

1. **Don't panic** - Document the issue
2. **Root cause** - Why did it fail?
3. **Learn** - Add to this file
4. **Fix** - Apply correct pattern
5. **Test** - Verify fix works
6. **Document** - Update ADR or pattern doc

---

### ❌ 18. Swallowing FTS Sync Errors in Batch Operations
**Anti-pattern:** Catching FTS sync errors and only logging them
```typescript
// BAD
try {
    await syncFTS(document);
} catch (ftsError) {
    console.warn('FTS sync failed, continuing...');
    // Don't throw - FTS failure shouldn't fail batch
}
```
**Problem:** Creates partial indexes - unusable for search
**Why it fails:**
- User has no idea some documents aren't searchable
- Silent data loss (documents exist but can't be found)
- Hard to debug (no error message, just "search doesn't work")

**Instead:** Fail fast and propagate errors
```typescript
// GOOD
try {
    await syncFTS(document);
    // Verify sync succeeded
    const count = await db.select('SELECT COUNT(*) FROM fts_default WHERE rowid = ?', [rowid]);
    if (count === 0) {
        throw new Error(`FTS sync verification failed for rowid ${rowid}`);
    }
} catch (ftsError) {
    await db.exec('ROLLBACK');
    throw new Error(`FTS sync failed: ${ftsError.message}. Search will not work without FTS index.`);
}
```

**Rationale:** Documents without FTS index are **completely unusable** for search. Better to fail immediately than create broken database.

**Date added:** 2025-10-16 (Russian FTS fix)

---

### ❌ 19. Fuzzy Array Matching with Fallback to `true`
**Anti-pattern:** Using `.find()` with boolean fallback for array matching
```typescript
// BAD
const item = array.find(el => el.id ? el.id === target : true);
```
**Problem:** `true` matches FIRST element always, not "any element"
**Why it fails:** Boolean short-circuit - first `true` match wins
**Instead:** Use explicit position or proper predicate
```typescript
// GOOD - Position matching
const item = array[calculatedIndex];

// GOOD - Explicit ID matching
const item = array.find(el => el.id === target); // Only match if ID matches
```

**Impact:** Caused Russian FTS indexing bug - documents matched wrong results, FTS sync failed

**Date added:** 2025-10-16

---

*Add to this document when you discover something that doesn't work. Include "why it fails" and "instead do X" to help others avoid the same mistake.*
