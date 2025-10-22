# Russian Search Diagnosis - Executive Summary

**Task ID:** 20251016_russian_search_diagnosis
**Status:** PLAN Complete - Ready for DEVELOP
**Date:** 2025-10-16

---

## Problem Statement

Russian text search returns 0 results despite:
- Russian documents existing in database (11 docs confirmed)
- Parameter binding working correctly
- English search working perfectly
- FTS5 table schema having unicode61 tokenizer

---

## Root Cause Analysis (Edgar's Finding)

### What the Problem IS NOT

❌ **NOT a tokenizer issue**
- unicode61 tokenizer already added on October 12, 2025 (commit 66ee684)
- Schema version already bumped to 4
- Memory bank confirms fix applied

❌ **NOT a parameter binding issue**
- Diagnostic shows Russian text can be inserted
- Parameter binding works correctly

❌ **NOT a WASM/SQLite compilation issue**
- unicode61 available in current build
- Test shows FTS works with proper schema

### What the Problem ACTUALLY IS

✅ **FTS Index Sync Issue - Database State Corruption**

**Evidence:**
- Russian documents exist in `docs_default` table: 11 rows ✅
- Russian documents MISSING from `fts_default` table: 0 rows ❌
- Search queries FTS table (empty) → 0 results

**Root Cause:**
One of two issues:

1. **Array Matching Bug (Gotcha #21):**
   - Batch FTS sync used `.find()` with `true` fallback
   - Matches FIRST element always instead of correct position
   - Russian docs (typically last in batch) get wrong docId
   - FTS sync fails silently

2. **Database State Corruption:**
   - User's database created before unicode61 fix
   - Or FTS sync failed during batch insert
   - Documents inserted but FTS index never updated

---

## Solution Approach

### Primary Solution: FTS Index Repair Utility

**Create repair functionality:**
```typescript
await db.rebuildFTSIndex();
// Rebuilds FTS index from docs_default
```

**Why this approach:**
- Schema ALREADY correct (unicode61 in place)
- Problem is EXISTING databases with corrupt indexes
- No data loss - just rebuild index
- Simple, safe, effective

### Secondary: Fix Any Remaining Sync Bugs

**If array matching bug still exists:**
- Fix deterministic position matching
- Add FTS sync verification
- Prevent future corruption

---

## Execution Plan

### 6-Step Systematic Approach

**Step 1: Verify Database State** (1 hour)
- Check actual FTS schema (tokenizer config)
- Count rows in fts_default vs docs_default
- Test FTS search with known Russian docId
- **Output:** Diagnostic report confirming issue

**Step 2: Check FTS Sync Implementation** (1 hour)
- Review DatabaseWorker.ts batch insert code
- Trace FTS sync calls
- Verify error handling
- Check for array matching bug
- **Output:** Code review identifying sync path

**Step 3: Implement Fix** (1-2 hours)
- Create rebuildFTSIndex() utility
- Fix any batch sync bugs found
- Add FTS sync verification
- **Output:** Working repair code + tests

**Step 4: Add Diagnostic Tools** (1 hour)
- Create validateFTSIndex() method
- Add auto-detection on database init
- Update demo app with repair UI
- **Output:** User-facing diagnostics

**Step 5: Testing** (1-2 hours)
- Unit tests for Russian search
- E2E tests with 100+ Russian docs
- Regression tests for English
- Edge cases (mixed language, special chars)
- **Output:** Comprehensive test suite

**Step 6: Documentation** (1 hour)
- Implementation report
- Memory bank updates
- README troubleshooting section
- Migration guide
- **Output:** Complete documentation

**Total Estimated Time:** 4-6 hours

---

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Database already corrupt, repair fails | Medium | Export → clear → reimport fallback |
| Fix breaks English search | Low | Comprehensive regression testing |
| Performance impact of FTS rebuild | Low | Batch inserts (10 docs at a time) |
| Users don't discover repair utility | High | Auto-detect on init, show notification |

---

## Success Criteria

**Functional:**
- ✅ Russian search returns correct results
- ✅ English search still works (no regression)
- ✅ Batch inserts sync FTS correctly
- ✅ Mixed language queries work

**Quality:**
- ✅ Test coverage: 80%+ on Russian text paths
- ✅ FTS sync errors propagate (no silent failures)
- ✅ Deterministic array matching (no fuzzy logic)

**User Experience:**
- ✅ Auto-detection of FTS corruption
- ✅ One-click repair utility
- ✅ Clear error messages
- ✅ Demo app shows repair UI

---

## Key Insights from Memory Bank

### Gotchas Applied
- **#21:** FTS batch sync array matching bug
- **#11:** Partial schema is dangerous
- **Anti-pattern #18:** Swallowing FTS errors creates partial indexes
- **Anti-pattern #19:** Fuzzy array matching with `true` fallback

### Lessons Applied
- **what_works.md:** Manual FTS sync after batch inserts
- **what_doesnt.md:** FTS5 triggers cause memory exhaustion
- **what_doesnt.md:** Boolean fallback in array matching fails

### Related Patterns
- **hybrid-search.md:** FTS5 configuration with unicode61
- **schema-management.md:** Manual FTS sync pattern

---

## Next Steps

**For Main Agent:**
1. Invoke Edgar DEVELOP mode with this plan
2. Edgar will execute steps 1-6 systematically
3. Edgar will update memory bank with discoveries
4. Verify demo works after fix

**For User:**
1. Once fix ready, run `db.validateAndRepairSearch()`
2. If auto-repair doesn't work, export → clear → reimport
3. Test Russian search with "Пушкин", "Толстой", etc.
4. Report any issues for further investigation

---

## PLAN Status

✅ **PLAN COMPLETE**

**Classification:** Medium (4-6 hours, medium risk)

**Workflow State:** Registered in `.claude/memory/context/workflow_state.md`

**Next Action:** Invoke Edgar DEVELOP mode to execute plan

**Plan Document:** `D:\localcopilot\browvec\tasks\20251016_russian_search_diagnosis\plan.md`

---

*This is Edgar PLAN mode signing off. Root cause analysis complete. Investigation plan ready. DEVELOP mode should take it from here.*
