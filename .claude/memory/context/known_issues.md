# Known Issues & Technical Debt

**Last Updated:** 2025-10-16

---

## Critical Issues

_No critical issues currently_

---

## High Priority

### 1. Queue Failed Items Accumulation
**Severity:** Medium
**Impact:** Failed embeddings accumulate, require manual intervention
**Workaround:** Periodic `clearEmbeddingQueue({ status: 'failed' })`
**Fix Planned:** Auto-retry scheduler with configurable backoff

---

## Medium Priority

### 2. OPFS Silent Fallback
**Severity:** Low
**Impact:** Users may not know they're in memory-only mode
**Behavior:** If OPFS unavailable, silently falls back to in-memory
**Fix Planned:** Add UI indicator and notification system

### 3. No Query Result Caching
**Severity:** Low
**Impact:** Repeated identical queries re-execute (performance)
**Workaround:** Client-side caching if needed
**Fix Planned:** LRU cache for query results

---

## Low Priority

### 4. Large Batch Import Performance
**Severity:** Low
**Impact:** Importing 10,000+ documents can be slow
**Workaround:** Use smaller batch sizes, show progress indicator
**Fix Planned:** Optimize transaction batching

### 5. No Index Size Monitoring
**Severity:** Low
**Impact:** No visibility into vector index size/memory usage
**Workaround:** Use `export()` to check database size
**Fix Planned:** Add statistics API for index metrics

---

## Resolved Issues (Recent)

### ✅ FTS5 Trigger Memory Exhaustion (2025-10-16)
**Was:** Triggers caused memory issues on large imports
**Fixed:** Replaced with manual sync pattern
**Impact:** Resolved completely

### ✅ Cyrillic Text Search (2025-10-16)
**Was:** FTS5 didn't handle Cyrillic properly
**Fixed:** Changed to unicode61 tokenizer
**Impact:** Multilingual search now works

---

## Technical Debt

### Code Quality

1. **Worker Error Handling**
   - Some error paths don't propagate full context
   - Priority: Medium
   - Effort: 2-4 hours

2. **Test Coverage Gaps**
   - Multi-tab coordination needs more tests
   - Queue retry logic partially untested
   - Priority: Medium
   - Effort: 4-6 hours

### Documentation

1. **API Reference**
   - Some methods lack JSDoc comments
   - Priority: Low
   - Effort: 3-4 hours

2. **Migration Guides**
   - No guide for upgrading from older versions
   - Priority: Low
   - Effort: 2-3 hours

### Architecture

1. **Schema Migration System**
   - Currently drops and recreates on partial schema
   - Should support migrations for production use
   - Priority: Medium (for v1.0 release)
   - Effort: 8-12 hours

---

## Won't Fix

### 1. Synchronous API Performance
**Reason:** Sync API compatibility with sql.js requires blocking
**Alternative:** Use async methods for better performance
**Decision:** Keep for compatibility, document performance implications

### 2. IE11 Support
**Reason:** WASM and OPFS not available in IE11
**Alternative:** N/A
**Decision:** Modern browsers only (as documented)

---

## Monitoring

**How to track:**
- GitHub issues: Label with `known-issue`
- Memory bank: Update this file when discovered
- Monthly review: Prioritize and schedule fixes

**Escalation criteria:**
- Critical: Immediate attention required
- High: Fix within 1-2 weeks
- Medium: Fix within 1-2 months
- Low: Backlog, fix when convenient

---

*This document tracks known issues and technical debt. Update when new issues discovered or when issues resolved.*
