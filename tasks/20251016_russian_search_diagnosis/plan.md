# Task: Russian Text Search Diagnosis and Fix

**Task ID:** 20251016_russian_search_diagnosis
**Date Created:** 2025-10-16
**Status:** PLAN Complete
**Classification:** Medium (4-6 hours, medium risk)

---

## Root Cause Analysis

### Stated Request
"Russian text search returns 0 results despite Russian documents existing in database"

### Underlying Business Need
Users need full-text search to work for Cyrillic (Russian) text and other non-ASCII languages for LocalRetrieve to be viable for international markets.

### Root Problem (Deep Analysis)

**The REAL problem is NOT tokenization** - that was already fixed on October 12, 2025 (commit 66ee684):
- unicode61 tokenizer ALREADY added to FTS5 table
- Schema version ALREADY bumped to 4
- Memory bank confirms: "✅ Cyrillic Text Search (2025-10-16) Fixed"

**The REAL problem is FTS5 INDEX SYNC** - documented in memory bank gotcha #21 and anti-pattern #19:
- Russian documents ARE being inserted into `docs_default` (11 docs confirmed)
- Russian documents ARE NOT being properly synced to `fts_default` table
- Root cause: Array matching bug in batch FTS sync logic (`.find()` with `true` fallback)

**Evidence from user's diagnostics:**
```
✅ docs_default: 11 Russian documents exist
✅ Parameter binding: Works correctly
❌ fts_default search: 0 results for "Пушкин"
❌ Direct SQL: SELECT * FROM fts_default WHERE fts_default MATCH ? returns 0
```

**Why this is NOT a tokenizer problem:**
1. Test creates FTS table with unicode61 (line 74) → Works
2. Production schema already has unicode61 (SchemaManager.ts line 239) → Should work
3. Documents can be INSERTED (parameter binding works)
4. But they're not SEARCHABLE (FTS index missing entries)

**Conclusion:** This is a **database state corruption issue**, not a schema issue.

---

## Memory Bank Context

### Related Patterns
1. **hybrid-search.md** - FTS5 configuration (unicode61 tokenizer documented)
2. **schema-management.md** - Manual FTS sync pattern (trigger removal documented)

### Past Work
1. **2025-10-12:** unicode61 tokenizer added (commit 66ee684)
2. **2025-10-12:** FTS5 triggers replaced with manual sync (commit 8e7e467)
3. **2025-10-16:** Array matching bug discovered (gotcha #21)

### Gotchas to Avoid
- **Gotcha #21:** FTS batch sync array matching - `.find()` with `true` fallback matches FIRST element
- **Gotcha #11:** Partial schema is dangerous - auto-init drops ALL tables
- **Anti-pattern #18:** Swallowing FTS sync errors creates partial indexes

### Lessons from Memory Bank
- **what_works.md:** Manual FTS sync after batch inserts (proven pattern)
- **what_doesnt.md:** FTS5 triggers for sync (causes memory exhaustion)
- **what_doesnt.md:** Fuzzy array matching with boolean fallback (causes wrong docId lookup)

---

## Classification

### Size
**Medium** (4-6 hours)

### Risk
**Medium** - Fix affects batch insert logic (core functionality)

### Estimated Effort
- Investigation: 1 hour (verify actual schema, check FTS sync code)
- Fix implementation: 1-2 hours (ensure proper FTS sync)
- Testing: 1-2 hours (verify Russian search, test batch inserts)
- Documentation: 1 hour (update memory bank, document fix)

**Total:** 4-6 hours

---

## Execution Steps

### Step 1: Verify Database State
**What:** Diagnose the ACTUAL problem in user's database
**Who:** Edgar DEVELOP mode
**Output:** Diagnostic report showing FTS table state
**Depends on:** None

**Tasks:**
1. Check actual `fts_default` table schema (PRAGMA table_info)
2. Verify tokenizer configuration (sqlite_master)
3. Count rows in `fts_default` vs `docs_default`
4. Test FTS5 search with known Russian document ID

**Success Criteria:**
- Confirm whether FTS5 has unicode61 tokenizer
- Identify if rows are missing from fts_default
- Determine if this is schema issue or data issue

---

### Step 2: Check FTS Sync Implementation
**What:** Review batch insert code for FTS sync logic
**Who:** Edgar DEVELOP mode
**Output:** Code review identifying FTS sync path
**Depends on:** Step 1 (database state verified)

**Tasks:**
1. Review `DatabaseWorker.ts` batch insert method
2. Trace FTS sync calls in batch operations
3. Check for error handling/swallowing
4. Verify array matching logic (gotcha #21 check)

**Success Criteria:**
- Understand exact FTS sync code path
- Identify if array matching bug still present
- Confirm error handling propagates failures

---

### Step 3: Implement Fix
**What:** Fix FTS sync issue or provide database repair
**Who:** Edgar DEVELOP mode
**Output:** Working code + tests
**Depends on:** Step 2 (root cause identified)

**Approach A - If schema outdated (tokenizer missing):**
- User must recreate database (export → clear → reimport)
- Add migration helper to detect old schema
- Update documentation with upgrade path

**Approach B - If FTS sync bug (rows missing):**
- Fix array matching logic if still present
- Add FTS sync verification after batch insert
- Provide repair script to reindex existing data

**Approach C - If database corruption (partial index):**
- Create utility to rebuild FTS index from docs_default
- Add validation check on database init
- Provide user-facing repair command

**Success Criteria:**
- Russian search returns correct results
- English search still works (no regression)
- Batch inserts sync FTS correctly
- Tests verify fix

---

### Step 4: Add Diagnostic Tools
**What:** Create utilities to detect and fix this issue
**Who:** Edgar DEVELOP mode
**Output:** Diagnostic and repair utilities
**Depends on:** Step 3 (fix implemented)

**Tasks:**
1. Add `validateFTSIndex()` method to Database class
2. Add `rebuildFTSIndex()` method for repair
3. Add schema version check with helpful error messages
4. Update demo app with diagnostic UI

**Success Criteria:**
- Users can self-diagnose FTS issues
- One-click repair for corrupted indexes
- Clear error messages guide users

---

### Step 5: Testing
**What:** Comprehensive testing of Russian search
**Who:** Edgar DEVELOP mode
**Output:** Test suite with Cyrillic coverage
**Depends on:** Step 4 (utilities added)

**Test Cases:**
1. **Unit tests:**
   - FTS sync with Cyrillic text
   - Batch insert with mixed English/Russian
   - Array matching logic (prevent regression)
   - Parameter binding with Russian text

2. **Integration tests (E2E):**
   - Insert 100 Russian documents
   - Search for common Russian terms
   - Verify all results returned
   - Test mixed-language queries

3. **Edge cases:**
   - Empty strings
   - Very long Russian text (10,000+ chars)
   - Special characters (ё, ъ, ь)
   - Combined Cyrillic + Latin queries

**Success Criteria:**
- All tests pass
- Coverage on Russian text paths: 80%+
- No regressions in English search

---

### Step 6: Documentation
**What:** Document fix and update memory bank
**Who:** Edgar DEVELOP mode
**Output:** Updated docs and memory bank
**Depends on:** Step 5 (testing complete)

**Tasks:**
1. Update `tasks/20251016_russian_search_diagnosis/implementation.md`
2. Update memory bank:
   - `lessons/gotchas.md` - Add new discovery if found
   - `lessons/what_works.md` - Document solution
   - `context/known_issues.md` - Mark as resolved
3. Update README.md with troubleshooting section
4. Add migration guide if schema change required

**Success Criteria:**
- Complete implementation documentation
- Memory bank reflects latest learnings
- Users have clear troubleshooting path

---

## Investigation Plan (Step-by-Step Diagnosis)

### Phase 1: Schema Verification

**Check 1: FTS5 Table Schema**
```sql
-- Get actual FTS5 table creation statement
SELECT sql FROM sqlite_master WHERE name = 'fts_default';
```
**Expected:** Should see `tokenize='unicode61'`
**If not:** Schema outdated, need database recreation

**Check 2: Table Row Counts**
```sql
-- Compare document count
SELECT 'docs_default' as table_name, COUNT(*) as count FROM docs_default
UNION ALL
SELECT 'fts_default', COUNT(*) FROM fts_default;
```
**Expected:** Same count in both tables
**If different:** FTS sync failed for some documents

**Check 3: Russian Content in FTS**
```sql
-- Check if Russian text actually indexed
SELECT rowid, content FROM docs_default WHERE collection = 'default' LIMIT 1;
-- Then search FTS for that rowid
SELECT * FROM fts_default WHERE rowid = [rowid_from_above];
```
**Expected:** Row exists in FTS with Russian content
**If not:** FTS sync issue

---

### Phase 2: Code Path Analysis

**Check 4: Batch Insert Code**
```typescript
// Find batch insert method in DatabaseWorker.ts
// Look for FTS sync calls
// Verify error handling
```

**Key questions:**
- Is FTS sync called after batch insert?
- Are errors caught and swallowed?
- Is array matching using deterministic logic?

**Check 5: Array Matching Logic**
```typescript
// Search for patterns like:
// .find(el => condition ? match : true)
// This is the anti-pattern from gotcha #21
```

**If found:** Fix by using position-based matching or explicit ID

---

### Phase 3: Database State Repair

**If FTS table corrupt (rows missing):**
```sql
-- Rebuild FTS index from docs_default
DELETE FROM fts_default;
INSERT INTO fts_default(rowid, title, content, metadata)
SELECT rowid, title, content, metadata FROM docs_default;
```

**If schema outdated (no unicode61):**
- User MUST export data
- Clear database (DROP ALL tables)
- Reimport data with new schema

---

## Solution Approach

### Primary Solution: FTS Index Repair Utility

**Rationale:**
- Schema ALREADY has unicode61 (verified in SchemaManager.ts)
- Problem is EXISTING databases with partial/corrupt FTS indexes
- Need repair path that doesn't lose user data

**Implementation:**
```typescript
// Add to Database class
async rebuildFTSIndex(collection: string = 'default'): Promise<void> {
    // 1. Clear existing FTS index
    await this.exec('DELETE FROM fts_default');

    // 2. Rebuild from docs_default
    const docs = await this.all(
        'SELECT rowid, title, content, metadata FROM docs_default WHERE collection = ?',
        [collection]
    );

    // 3. Batch sync to FTS (10 at a time to avoid memory issues)
    for (let i = 0; i < docs.length; i += 10) {
        const batch = docs.slice(i, i + 10);
        await this.exec('BEGIN TRANSACTION');

        for (const doc of batch) {
            await this.run(
                'INSERT INTO fts_default(rowid, title, content, metadata) VALUES (?, ?, ?, ?)',
                [doc.rowid, doc.title, doc.content, doc.metadata]
            );
        }

        await this.exec('COMMIT');
    }
}
```

**API Addition:**
```typescript
// Public method for users
async validateAndRepairSearch(): Promise<{ valid: boolean; repaired: boolean }> {
    // 1. Check if FTS count matches docs count
    const docsCount = await this.select('SELECT COUNT(*) FROM docs_default');
    const ftsCount = await this.select('SELECT COUNT(*) FROM fts_default');

    if (docsCount === ftsCount) {
        return { valid: true, repaired: false };
    }

    // 2. Rebuild FTS index
    await this.rebuildFTSIndex();

    return { valid: false, repaired: true };
}
```

---

### Secondary Solution: Fix Batch Sync Logic

**If array matching bug still exists:**
```typescript
// BEFORE (WRONG):
const docId = results.find(r => {
    return doc.id ? r.id === doc.id : true; // BUG: true matches first!
})?.id;

// AFTER (CORRECT):
const resultIndex = batchStartIdx + ftsIdx + subBatchDocIdx;
const docId = results[resultIndex]?.id;

if (!docId) {
    throw new Error(`FTS sync failed: No result at index ${resultIndex}`);
}
```

**Verification:**
- Add test with Russian documents at END of batch
- Ensure they get correct array index
- Verify FTS sync succeeds

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Database already corrupt, repair fails | Medium | High | Provide export → clear → reimport fallback |
| Fix breaks English search | Low | Critical | Comprehensive regression testing |
| Performance impact of FTS rebuild | Low | Medium | Batch inserts (10 docs at a time) |
| Users don't know about repair utility | High | Medium | Auto-detect on init, show notification |
| Array matching bug already fixed | Medium | Low | Code review first before changing |

---

## Success Criteria

**Functional:**
- [ ] Russian search returns correct results for "Пушкин", "Толстой", etc.
- [ ] English search still works (no regression)
- [ ] Batch inserts (100+ docs) sync FTS correctly
- [ ] Mixed language queries work

**Quality:**
- [ ] Test coverage on Russian text paths: 80%+
- [ ] FTS sync errors propagate (no silent failures)
- [ ] Deterministic array matching (no fuzzy logic)

**User Experience:**
- [ ] Auto-detection of FTS corruption on database init
- [ ] One-click repair utility exposed in API
- [ ] Clear error messages guide users
- [ ] Demo app shows repair UI

**Documentation:**
- [ ] Implementation report in tasks/ directory
- [ ] Memory bank updated with learnings
- [ ] README troubleshooting section added
- [ ] Migration guide if needed

---

## Next Steps

1. **Invoke Edgar DEVELOP mode** with this plan
2. Edgar will execute steps 1-6 systematically
3. Edgar will update memory bank with discoveries
4. Main agent should verify demo works after fix

---

## Notes

**Key Insight from Memory Bank:**
This is NOT a new tokenizer problem - unicode61 was already added. This is a database state issue where existing FTS indexes are corrupt or incomplete, likely from the array matching bug that was discovered and documented in gotcha #21.

**KISS Principle:**
Don't rebuild WASM or change schema. Provide repair utility for corrupted databases.

**Edgar's Philosophy:**
Fix the ROOT CAUSE (FTS sync logic + corrupted databases), not the SYMPTOM (Russian search failure).

---

**PLAN READY**

**CLASSIFICATION:** Medium

**NEXT STEPS:**
1. Invoke Edgar DEVELOP mode with this plan
2. Execute investigation (Steps 1-2)
3. Implement fix (Step 3)
4. Add diagnostics (Step 4)
5. Test thoroughly (Step 5)
6. Document learnings (Step 6)

I (Edgar PLAN mode) am now DONE. Main agent should execute plan.
