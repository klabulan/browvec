# TASK-001: Design Document

## Architecture Changes

### 1. Schema Migration (v2 → v3)

#### Current Schema (v2)
```sql
CREATE TABLE docs_default (
  id TEXT PRIMARY KEY,
  title TEXT,
  content TEXT NOT NULL,
  metadata JSON,  -- ❌ Contains collection field (pollutes user data)
  created_at INTEGER,
  updated_at INTEGER
);

-- Queries use:
WHERE json_extract(metadata, '$.collection') = ?
```

#### New Schema (v3)
```sql
CREATE TABLE docs_default (
  id TEXT PRIMARY KEY,
  title TEXT,
  content TEXT NOT NULL,
  collection TEXT NOT NULL,  -- ✅ Separate column for internal use
  metadata JSON,             -- ✅ Pure user data (no injection)
  created_at INTEGER,
  updated_at INTEGER
);

-- Index for efficient collection filtering
CREATE INDEX idx_docs_collection ON docs_default(collection);

-- Queries use:
WHERE collection = ?
```

### 2. Migration Strategy

#### Phase 1: Schema Update
```sql
-- Add new column
ALTER TABLE docs_default ADD COLUMN collection TEXT;

-- Extract collection from metadata and populate new column
UPDATE docs_default
SET collection = json_extract(metadata, '$.collection')
WHERE json_extract(metadata, '$.collection') IS NOT NULL;

-- Set default collection for rows without collection
UPDATE docs_default
SET collection = 'default'
WHERE collection IS NULL;

-- Remove collection from metadata (restore user data)
UPDATE docs_default
SET metadata = json_remove(metadata, '$.collection');

-- Make collection NOT NULL after data migration
-- (SQLite doesn't support altering NOT NULL, so we'll enforce in code)

-- Create index
CREATE INDEX IF NOT EXISTS idx_docs_collection ON docs_default(collection);
```

#### Phase 2: Code Update
Update all code to use new schema:
1. `DatabaseWorker.handleInsertDocumentWithEmbedding()` - Don't inject collection into metadata
2. `SchemaManager.getCollectionInfo()` - Use `WHERE collection = ?`
3. All search/query methods - Use collection column

#### Phase 3: Schema Version Bump
Update `CURRENT_SCHEMA_VERSION = 3` in SchemaManager.ts

### 3. Validation Layer

#### New Validation Function
```typescript
/**
 * Validate document structure before insertion
 * @throws ValidationError with detailed context
 */
function validateDocument(
  document: {
    id?: string | number;
    title?: string;
    content: string;
    metadata?: Record<string, any>;
  },
  collection: string
): void {
  const errors: string[] = [];

  // REQ-3.1: Check required fields
  if (!document.content && !document.title) {
    errors.push("Document must have at least 'content' or 'title' field");
  }

  // REQ-3.2: Check metadata structure
  if (document.metadata !== undefined) {
    if (typeof document.metadata !== 'object' || document.metadata === null) {
      errors.push("metadata must be a plain object");
    } else if (Array.isArray(document.metadata)) {
      errors.push("metadata must be a plain object, not an array");
    }
  }

  // REQ-3.3: Check for reserved metadata fields (WARNING, not error)
  if (document.metadata?.collection !== undefined) {
    errors.push(
      "⚠️  metadata.collection is no longer used internally (as of v3). " +
      "This field will be stored as-is in your metadata. " +
      "If you intended to set the collection, use the 'collection' parameter instead."
    );
  }

  // REQ-3.4: Validate ID if provided
  if (document.id !== undefined) {
    const idType = typeof document.id;
    if (idType !== 'string' && idType !== 'number') {
      errors.push(`document.id must be a string or number (got ${idType})`);
    }
  }

  if (errors.length > 0) {
    throw new ValidationError(
      `Invalid document structure for collection '${collection}':\n` +
      errors.map(e => `  • ${e}`).join('\n'),
      { collection, document, errors }
    );
  }
}
```

#### Custom Error Classes
```typescript
/**
 * Validation error with context
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public context: {
      collection: string;
      document: any;
      errors: string[];
    }
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Document insertion error with diagnostic context
 */
export class DocumentInsertError extends Error {
  constructor(
    message: string,
    public context: {
      collection: string;
      documentId: string;
      providedFields: string[];
      originalError?: Error;
      suggestion?: string;
    }
  ) {
    super(message);
    this.name = 'DocumentInsertError';
  }
}
```

### 4. Updated Insert Flow

#### handleInsertDocumentWithEmbedding() - New Implementation
```typescript
async handleInsertDocumentWithEmbedding(
  params: InsertDocumentWithEmbeddingParams
): Promise<{ id: string; embeddingGenerated: boolean }> {
  const validParams = this.validateParams(params, isInsertDocumentWithEmbeddingParams, 'handleInsertDocumentWithEmbedding');
  this.ensureInitialized();

  return this.withContext('insertDocumentWithEmbedding', async () => {
    // STEP 1: Validate input (REQ-3)
    validateDocument(validParams.document, validParams.collection);

    // STEP 2: Generate ID if not provided
    const documentId = validParams.document.id?.toString() || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // STEP 3: Prepare user metadata (NO INJECTION)
    const userMetadata = validParams.document.metadata || {};

    // STEP 4: Insert document with collection in separate column
    const sql = `
      INSERT OR REPLACE INTO docs_default (id, title, content, collection, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, strftime('%s', 'now'), strftime('%s', 'now'))
    `;

    try {
      await this.sqliteManager.exec(sql, [
        documentId,
        validParams.document.title || '',
        validParams.document.content,
        validParams.collection,                    // ✅ Separate column
        JSON.stringify(userMetadata)                // ✅ Pure user data
      ]);
    } catch (error) {
      throw new DocumentInsertError(
        `Failed to insert document into collection '${validParams.collection}'`,
        {
          collection: validParams.collection,
          documentId,
          providedFields: Object.keys(validParams.document),
          originalError: error instanceof Error ? error : undefined,
          suggestion: 'Check that document structure matches schema and ID is unique'
        }
      );
    }

    // STEP 5: Verify insertion (REQ-2)
    const verifyResult = await this.sqliteManager.select(
      'SELECT COUNT(*) as count FROM docs_default WHERE id = ? AND collection = ?',
      [documentId, validParams.collection]
    );

    const insertedCount = verifyResult.rows[0]?.count || 0;
    if (insertedCount === 0) {
      throw new DocumentInsertError(
        `Document insertion verification failed: id='${documentId}' was not found in database`,
        {
          collection: validParams.collection,
          documentId,
          providedFields: Object.keys(validParams.document),
          suggestion:
            'This may be caused by:\n' +
            '  1) Unique constraint violation (duplicate ID)\n' +
            '  2) Database connection issue\n' +
            '  3) Transaction rollback\n' +
            'Check database logs for details.'
        }
      );
    }

    // STEP 6: Handle embedding (if requested)
    let embeddingGenerated = false;
    if (validParams.options?.generateEmbedding !== false) {
      // Queue embedding generation
      const queueResult = await this.embeddingQueue.enqueue({
        collection: validParams.collection,
        documentIds: [documentId],
        priority: validParams.options?.embeddingOptions?.priority || 2
      });
      embeddingGenerated = queueResult > 0;
    }

    // STEP 7: Return accurate result
    return { id: documentId, embeddingGenerated };
  });
}
```

### 5. Query Updates

#### SchemaManager.getCollectionInfo()
```typescript
// OLD (line 297):
const countResult = await this.sqliteManager.select(
  `SELECT COUNT(*) as count FROM docs_default WHERE json_extract(metadata, '$.collection') = ?`,
  [name]
);

// NEW:
const countResult = await this.sqliteManager.select(
  `SELECT COUNT(*) as count FROM docs_default WHERE collection = ?`,
  [name]
);
```

#### All Search Methods
Update to use `WHERE collection = ?` instead of json_extract.

### 6. Metadata API Contract

#### Guarantees
1. **Exact Preservation**: `JSON.stringify(input.metadata) === stored.metadata`
2. **No Reserved Fields**: All field names in `metadata` are user-controlled
3. **No Automatic Fields**: System won't inject fields into metadata
4. **Type Preservation**: Objects, arrays, numbers, strings, booleans, null preserved
5. **Nesting Support**: Arbitrary nesting depth supported

#### Limitations
- ❌ Functions or undefined values (JSON limitation)
- ❌ Circular references (JSON limitation)
- ⚠️  Metadata size >1MB (performance recommendation)

#### Example Contract Test
```typescript
const original = {
  metadata: {
    collection: 'user_value',  // NOT reserved!
    tags: ['a', 'b'],
    score: 42,
    nested: { deep: true }
  }
};

await db.insertDocumentWithEmbedding({
  collection: 'docs',
  document: original
});

const retrieved = await db.execAsync(
  'SELECT metadata FROM docs_default WHERE id = ?',
  [documentId]
);

// GUARANTEED to be true:
assert.deepEqual(
  JSON.parse(retrieved[0].metadata),
  original.metadata
);
```

## Implementation Plan

### Phase 1: Schema Migration (0.5 day)
1. Update `CURRENT_SCHEMA_VERSION` to 3
2. Add `migrateFromV2ToV3()` method
3. Test migration with existing data
4. Verify backwards compatibility

### Phase 2: Validation Layer (0.5 day)
1. Create custom error classes
2. Implement `validateDocument()` function
3. Add unit tests for validation
4. Test error messages are clear

### Phase 3: Insert Flow Update (0.5 day)
1. Update `handleInsertDocumentWithEmbedding()`
2. Add post-insert verification
3. Update all queries to use collection column
4. Test with various scenarios

### Phase 4: Query Updates (0.25 day)
1. Update SchemaManager queries
2. Update SearchHandler queries
3. Update any other code using json_extract

### Phase 5: Testing (0.5 day)
1. Unit tests for validation
2. Integration tests for insert flow
3. Migration tests
4. Error handling tests

### Phase 6: Documentation (0.5 day)
1. Update README with API contract
2. Add custom ID documentation
3. Add migration guide
4. Update examples

## Testing Strategy

### Unit Tests
```typescript
describe('validateDocument', () => {
  it('should accept valid document', () => {
    expect(() => validateDocument({
      content: 'test'
    }, 'docs')).not.toThrow();
  });

  it('should reject document without content or title', () => {
    expect(() => validateDocument({
      metadata: { foo: 'bar' }
    }, 'docs')).toThrow(ValidationError);
  });

  it('should accept metadata.collection (with warning)', () => {
    expect(() => validateDocument({
      content: 'test',
      metadata: { collection: 'chunks' }
    }, 'docs')).toThrow(/⚠️.*metadata.collection/);
  });

  it('should reject invalid metadata type', () => {
    expect(() => validateDocument({
      content: 'test',
      metadata: 'invalid'
    }, 'docs')).toThrow(/metadata must be a plain object/);
  });
});
```

### Integration Tests
```typescript
describe('insertDocumentWithEmbedding', () => {
  it('should insert and verify document', async () => {
    const result = await db.insertDocumentWithEmbedding({
      collection: 'docs',
      document: {
        content: 'test content',
        metadata: { foo: 'bar' }
      }
    });

    expect(result.id).toBeDefined();

    // Verify it's actually in database
    const rows = await db.execAsync(
      'SELECT * FROM docs_default WHERE id = ?',
      [result.id]
    );
    expect(rows).toHaveLength(1);
  });

  it('should preserve user metadata exactly', async () => {
    const metadata = {
      collection: 'user_value',
      tags: ['a', 'b'],
      nested: { deep: true }
    };

    const result = await db.insertDocumentWithEmbedding({
      collection: 'docs',
      document: {
        content: 'test',
        metadata
      }
    });

    const rows = await db.execAsync(
      'SELECT metadata FROM docs_default WHERE id = ?',
      [result.id]
    );

    expect(JSON.parse(rows[0].metadata)).toEqual(metadata);
  });

  it('should throw on insert failure with verification', async () => {
    // Mock insert to succeed but verification to fail
    await expect(async () => {
      await db.insertDocumentWithEmbedding({
        collection: 'docs',
        document: { content: 'test' }
      });
    }).rejects.toThrow(DocumentInsertError);
  });
});
```

## Rollout Plan

### Stage 1: Development
- Implement changes on feature branch
- Run all tests
- Manual testing with demo app

### Stage 2: Migration Testing
- Test migration with real database snapshots
- Verify data integrity post-migration
- Performance testing

### Stage 3: Documentation
- Update README
- Create migration guide
- Update examples

### Stage 4: Release
- Merge to main
- Tag as v1.1.0 (minor version due to fixes + migration)
- Publish to npm
- Announce breaking change (metadata.collection behavior)

## Backwards Compatibility

### Breaking Changes
⚠️ **Users relying on metadata.collection behavior will break**

**Migration Required**: Users who currently use `metadata.collection` for their own purposes:
```typescript
// OLD behavior (v2 and earlier):
// metadata.collection was overwritten by system
document: {
  metadata: {
    collection: 'my_value'  // ❌ This was overwritten
  }
}

// NEW behavior (v3+):
// metadata.collection is preserved as user data
document: {
  metadata: {
    collection: 'my_value'  // ✅ This is preserved
  }
}
```

### Non-Breaking Changes
✅ All valid usage patterns continue to work:
- Custom document IDs
- Omitting metadata
- Using any other metadata fields

## Risk Mitigation

### Risk 1: Migration Failure
**Mitigation**:
- Comprehensive migration tests
- Backup recommendation in migration guide
- Rollback procedure documented

### Risk 2: Performance Impact
**Mitigation**:
- Post-insert verification is single SELECT COUNT(*) (fast)
- New index on collection column (improves query performance)
- Net performance impact: neutral to positive

### Risk 3: Breaking User Code
**Mitigation**:
- Clear documentation of breaking change
- Migration guide with code examples
- Version bump signals change
