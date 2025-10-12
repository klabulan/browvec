# Requirements

## Business Requirements

**BR-1:** Search must work across all collections (default, chunks, custom)
**BR-2:** Search results must be filtered by the requested collection
**BR-3:** Existing demo application must continue to function

## Functional Requirements

**FR-1:** Text-only search must query `fts_default` with collection filter
**FR-2:** Vector-only search must query `vec_default_dense` with collection filter
**FR-3:** Hybrid search must query both FTS and vector tables with collection filter
**FR-4:** Search SQL parameters must include collection name

## Non-Functional Requirements

**NFR-1:** No breaking changes to public API
**NFR-2:** Performance must not degrade (collection column is indexed)
**NFR-3:** All existing tests must pass

## Constraints

**C-1:** Must maintain backward compatibility with schema v3
**C-2:** Must not modify schema (schema is correct, only SQL is wrong)
**C-3:** Must use indexed `collection` column for performance

## Acceptance Criteria

- [ ] Search query uses `docs_default WHERE collection = ?`
- [ ] FTS query uses `fts_default` with rowid join to filtered docs
- [ ] Vector query uses `vec_default_dense` with rowid join to filtered docs
- [ ] All three search modes work (text, vector, hybrid)
- [ ] Demo application search returns results
- [ ] E2E tests pass
- [ ] No performance regression
