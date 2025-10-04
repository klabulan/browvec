# TASK-001: Document Insertion Improvements

## Overview
Fix critical issues in `insertDocumentWithEmbedding()` API including silent failures, metadata pollution, missing validation, and unclear documentation.

## Problem Statement

### 1. Silent Failure - Documents Not Inserted
**Issue**: API returns success even when no rows are inserted to database.
```javascript
// Returns: {id: 'chunk_id', embeddingGenerated: false}
// But database shows: 0 rows inserted
```

**Root Cause**: No post-insert verification to confirm row was actually inserted.

**Impact**: Critical - Users believe documents are saved but data is lost.

### 2. Metadata Pollution - Reserved Fields
**Issue**: Internal collection discriminator pollutes user metadata.
```javascript
// User provides:
metadata: {
  collection: 'chunks',  // User's own field
  doc_id: 'parent-123'
}

// System injects (line 431, DatabaseWorker.ts):
const metadata = { ...validParams.document.metadata, collection: validParams.collection };

// Result: User's metadata.collection field gets overwritten
```

**Root Cause**:
- Collection information stored INSIDE user metadata JSON (line 431, DatabaseWorker.ts)
- Queries use `json_extract(metadata, '$.collection')` to filter (line 297, SchemaManager.ts)
- No separation between internal fields and user fields

**Impact**: Critical - Namespace collision, data corruption, breaks user expectations.

### 3. Missing Input Validation
**Issue**: Invalid document structure is silently ignored.

**Missing Validations**:
- Required fields check (content or title must exist)
- Metadata type validation (must be plain object)
- Reserved field detection (metadata.collection conflict)
- ID type validation (string or number only)

**Impact**: High - Silent failures, hard to debug.

### 4. No Return Value Verification
**Issue**: Loop returns `{saved: 38}` but actual database rows may be different.

**Impact**: Medium - Misleading success metrics.

### 5. Poor Error Messages
**Issue**: Generic errors without context about what failed and why.

**Impact**: Medium - Poor developer experience, hard debugging.

### 6. Unclear Custom ID Support
**Issue**: Documentation doesn't clarify if custom `document.id` is supported.

**Impact**: Low - Confusion, inconsistent usage patterns.

## Requirements

### REQ-1: Schema Separation (Critical)
**Must Have**:
- Add `collection` column to `docs_default` table (separate from metadata)
- Migrate existing data to use new column
- Ensure backwards compatibility during migration
- Update all queries to use new column

**Acceptance Criteria**:
- [ ] New column added: `ALTER TABLE docs_default ADD COLUMN collection TEXT`
- [ ] Index created: `CREATE INDEX idx_docs_collection ON docs_default(collection)`
- [ ] Migration script updates existing rows
- [ ] All queries updated to use `WHERE collection = ?` instead of json_extract
- [ ] User metadata preserved exactly as provided (no injection)

### REQ-2: Post-Insert Verification (Critical)
**Must Have**:
- Verify row exists after INSERT using COUNT query
- Throw descriptive error if verification fails

**Acceptance Criteria**:
- [ ] After INSERT, run: `SELECT COUNT(*) FROM docs_default WHERE id = ?`
- [ ] If count = 0, throw error with diagnostic info
- [ ] Error message includes: document ID, collection, suggested causes

### REQ-3: Input Validation (High)
**Must Have**:
- Validate required fields before INSERT
- Check metadata structure
- Detect reserved field conflicts
- Validate ID type if provided

**Acceptance Criteria**:
- [ ] Function `validateDocument(document, collection)` created
- [ ] Checks: content OR title exists
- [ ] Checks: metadata is plain object (if provided)
- [ ] Checks: metadata.collection not used (warn about conflict)
- [ ] Checks: document.id is string or number (if provided)
- [ ] Throws `ValidationError` with clear messages

### REQ-4: Accurate Return Values (Medium)
**Must Have**:
- Return actual number of inserted rows
- Include failure details in batch operations

**Acceptance Criteria**:
- [ ] Batch operations verify each insert
- [ ] Return: `{saved: actualCount, failed: failedCount, errors: errorDetails[]}`
- [ ] Failed items include document ID and error message

### REQ-5: Enhanced Error Messages (Medium)
**Must Have**:
- Include context in all errors
- Suggest solutions when possible
- Use custom error class `DocumentInsertError`

**Acceptance Criteria**:
- [ ] Custom error class with context object
- [ ] Context includes: collection, documentId, providedFields, originalError, suggestion
- [ ] All insert errors wrapped with context

### REQ-6: Documentation Updates (Low)
**Must Have**:
- Document custom ID support
- Document metadata API contract
- Show metadata preservation guarantee
- Provide migration guide

**Acceptance Criteria**:
- [ ] README section: "Custom Document IDs"
- [ ] README section: "Metadata API Contract"
- [ ] Examples of metadata round-trip preservation
- [ ] Migration guide for users currently using metadata.collection

## Success Metrics
1. **Zero Silent Failures**: All insert failures throw errors
2. **Metadata Integrity**: User metadata preserved exactly (JSON.stringify(input) === stored)
3. **No Reserved Fields**: Users can use ANY field name in metadata
4. **Clear Errors**: All errors include actionable context
5. **Accurate Metrics**: Return values match database state

## Out of Scope
- Changing overall architecture (3-tier design remains)
- Performance optimizations
- Adding new features beyond fixes
- Breaking changes to existing valid usage patterns

## Dependencies
- SQLite WASM (sqlite-vec extension)
- OPFS for persistence
- Existing schema (must migrate, not replace)

## Risks
- **Migration Risk**: Existing databases must be migrated without data loss
- **Breaking Change Risk**: Users relying on metadata.collection behavior will break
- **Performance Risk**: Post-insert verification adds query overhead (minimal)

## Timeline
- Design: 0.5 day
- Implementation: 1.5 days
- Testing: 0.5 day
- Documentation: 0.5 day
- **Total**: 3 days
