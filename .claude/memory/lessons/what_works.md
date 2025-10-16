# What Works: Successful Patterns

**Last Updated:** 2025-10-16

---

## FTS Batch Sync Verification Pattern

**Context:** Manually syncing FTS5 index after batch document inserts

**Pattern:**
```typescript
// 1. Insert document into docs_default
await db.exec('INSERT INTO docs_default ...', [params]);

// 2. Get rowid for FTS sync
const rowidResult = await db.select(
    'SELECT rowid FROM docs_default WHERE id = ?',
    [documentId]
);
const rowid = rowidResult.rows[0].rowid;

// 3. Insert into FTS index
await db.exec(
    'INSERT INTO fts_default(rowid, title, content, metadata) VALUES (?, ?, ?, ?)',
    [rowid, title, content, metadata]
);

// 4. CRITICAL: Verify FTS sync succeeded
const verifyResult = await db.select(
    'SELECT COUNT(*) as count FROM fts_default WHERE rowid = ?',
    [rowid]
);

if (verifyResult.rows[0]?.count === 0) {
    throw new Error(`FTS sync verification failed for rowid ${rowid}`);
}
```

**Why it works:**
- Verification query confirms FTS row exists
- Fails fast if sync failed silently
- Prevents partial indexes
- Gives clear error messages

**When to use:** Every FTS sync operation (single or batch)

**Performance impact:** Minimal (~1ms per document)

**Evidence:** Fixed Russian FTS indexing bug (2025-10-16)

---

## Array Position Matching for Batch Processing

**Context:** Matching documents to results in batch operations

**Pattern:**
```typescript
// Calculate exact position in results array
const globalIndex = batchStartIdx + localIdx;
const result = results[globalIndex];

// Fail fast if no match
if (!result) {
    throw new Error(`No result at index ${globalIndex}, total: ${results.length}`);
}

// Use result
const id = result.id;
```

**Why it works:**
- **Deterministic** - same input → same output
- **No fuzzy matching** - no `true` fallback bugs
- **Clear errors** - exact index in error message
- **Debuggable** - can trace index calculation

**Alternatives considered:**
- ❌ `.find()` with ID matching: Fails when docs have no ID
- ❌ `.find()` with `true` fallback: Matches first element always (BUG!)

**When to use:** Any batch processing where order matters

**Evidence:** Fixed Russian FTS indexing bug caused by fuzzy matching

**Date added:** 2025-10-16

---

## Architecture Decisions

### 1. Worker Isolation for WASM
**Pattern:** Run SQLite WASM in dedicated Web Worker
**Why it works:**
- Main thread never blocks
- UI remains responsive during heavy queries
- Clean separation of concerns
- Browser can optimize worker thread independently

**When to use:** Any CPU-intensive browser operation

---

### 2. OPFS for Persistence
**Pattern:** Use OPFS instead of IndexedDB for database storage
**Why it works:**
- Direct file I/O (faster than IndexedDB)
- SQLite expects file system semantics
- Atomic writes
- Quota management by browser

**When to use:** Storing large binary data (databases, files)

---

### 3. Hybrid Search (BM25 + Vector)
**Pattern:** Combine keyword and semantic search
**Why it works:**
- BM25 excellent for exact terms
- Vectors handle conceptual similarity
- Weighted merging gives best of both
- Tunable alpha parameter for different use cases

**When to use:** Search where both keywords and meaning matter

---

### 4. Priority Queue for Background Tasks
**Pattern:** Queue with high/normal/low priorities
**Why it works:**
- User-initiated tasks jump the queue
- Bulk operations don't block interactive use
- Clear predictability for users
- Simple to implement and reason about

**When to use:** Any background processing with varying urgency

---

### 5. Graceful Degradation
**Pattern:** Fallback to in-memory when OPFS unavailable
**Why it works:**
- System still usable in degraded state
- No crashes or errors
- Transparent to API consumers
- Users can choose to enable persistence

**When to use:** Browser APIs with inconsistent support

---

## Implementation Techniques

### 6. RPC Pattern for Worker Communication
**Pattern:** Request/response RPC over postMessage
**Why it works:**
- Familiar async/await API
- Automatic error propagation
- Timeout handling built-in
- Easy to test

**Code example:** See `src/utils/rpc.ts`

---

### 7. Manual FTS5 Sync (Not Triggers)
**Pattern:** Manually insert into FTS5 instead of triggers
**Why it works:**
- Avoids memory exhaustion on large imports
- Full control over sync timing
- Can batch FTS5 updates
- Better error handling

**Lesson learned:** Triggers convenient but can cause issues at scale

---

### 8. Float32Array for Vectors
**Pattern:** Always use Float32Array, never regular arrays
**Why it works:**
- Compatible with WASM memory
- Efficient transfer between main/worker threads
- Required by sqlite-vec
- Better memory efficiency

**Critical:** sqlite-vec will fail with wrong type

---

### 9. Pragma matic Testing
**Pattern:** Test business logic and integration points, skip trivial code
**Why it works:**
- Focuses effort on high-value tests
- Faster test suites
- More maintainable (less brittle tests)
- 60-70% coverage on code that matters

**Balance:** Still test edge cases and error paths

---

### 10. Schema Auto-Initialization
**Pattern:** Check and create schema on database open
**Why it works:**
- Zero-config for users
- Handles first-time use automatically
- Detects and fixes partial schema
- Idempotent (safe to run multiple times)

**Implementation:** IF NOT EXISTS + consistency check

---

## Development Practices

### 11. Task-Based Documentation
**Pattern:** Document every task in tasks/YYYYMMDD_name/
**Why it works:**
- Preserves context and decisions
- Easy to find past work
- Onboarding new contributors
- Debugging historical issues

**Structure:** requirements.md, architecture.md, implementation.md, review.md

---

### 12. Incremental Commits
**Pattern:** Small, atomic commits with clear messages
**Why it works:**
- Easy to review
- Easy to revert if needed
- Clear project history
- Bisectable for debugging

**Format:** `type(scope): description`

---

### 13. Examples as Integration Tests
**Pattern:** Demo application (examples/web-client/) doubles as E2E test
**Why it works:**
- Tests real user workflows
- Catches integration issues
- Living documentation
- Marketing/showcase value

**Bonus:** Playwright tests run against demo

---

### 14. Memory Bank Pattern (This System!)
**Pattern:** Persistent knowledge base for AI agents
**Why it works:**
- Context preserved across sessions
- Patterns documented once, reused forever
- Lessons learned captured
- Reduces repeated mistakes

**Meta:** This document is proof of concept!

---

## Communication Patterns

### 15. Edgar's Root Cause Analysis
**Pattern:** Always ask "why" before implementing
**Why it works:**
- Solves real problems, not symptoms
- Avoids wasted effort
- Better solutions emerge
- User needs truly addressed

**Example:** "Add spinner" → Root cause: blocking UI → Solution: worker isolation

---

### 16. KISS Principle
**Pattern:** Choose simplest solution that works
**Why it works:**
- Easier to maintain
- Fewer bugs
- Faster to implement
- More understandable

**Example:** Universal Edgar agent vs 3 separate agents

---

## Anti-Patterns That Look Good But Aren't

**Beware of:**
- FTS5 triggers (memory exhaustion)
- Synchronous OPFS (doesn't exist - always async)
- Regular arrays for vectors (incompatible)
- Over-testing trivial code (waste of time)
- Complex multi-agent systems (when simple works)

See `what_doesnt.md` for full anti-patterns list.

---

*Add to this document when you discover something that works well. Include "why it works" to help future decisions.*
