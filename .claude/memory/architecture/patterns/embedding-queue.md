# Pattern: Embedding Queue System

**Category:** Background Processing
**Status:** Proven (Phase 5)
**Related ADR:** [004-embedding-queue-architecture](../decisions/004-embedding-queue-architecture.md)

---

## Overview

LocalRetrieve Phase 5 implements background embedding processing with:
- Priority-based queue
- Retry with exponential backoff
- Batch processing
- Real-time status tracking

## Queue Schema

```sql
CREATE TABLE embedding_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    doc_id INTEGER NOT NULL,
    collection TEXT DEFAULT 'default',
    content TEXT NOT NULL,
    priority INTEGER DEFAULT 2,  -- 1=high, 2=normal, 3=low
    status TEXT DEFAULT 'pending',  -- pending, processing, completed, failed
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    error_message TEXT,
    created_at INTEGER DEFAULT (unixepoch()),
    processed_at INTEGER,
    FOREIGN KEY (doc_id) REFERENCES docs_default(id) ON DELETE CASCADE
);

-- Index for queue processing
CREATE INDEX idx_queue_status_priority
ON embedding_queue(status, priority, created_at);
```

## API Methods

### 1. Enqueue Documents

```typescript
await db.enqueueEmbedding({
    docId: 123,
    content: 'Document text to embed',
    collection: 'default',
    priority: 1  // 1=high, 2=normal, 3=low
});
```

### 2. Process Queue

```typescript
await db.processEmbeddingQueue({
    batchSize: 10,          // Process up to 10 items
    collection: 'default',  // Optional: filter by collection
    provider: 'transformers-js'  // Embedding provider
});
```

### 3. Get Status

```typescript
const status = await db.getQueueStatus('default');
// Returns:
// {
//     pending: 42,
//     processing: 2,
//     completed: 158,
//     failed: 3,
//     total: 205
// }
```

### 4. Clear Queue

```typescript
await db.clearEmbeddingQueue({
    collection: 'default',
    status: 'failed'  // Optional: clear only failed items
});
```

## Processing Algorithm

```typescript
async function processEmbeddingQueue(options: ProcessOptions): Promise<ProcessResult> {
    const { batchSize = 10, collection, provider = 'transformers-js' } = options;

    // 1. Fetch pending items (ordered by priority, then age)
    const items = await db.all(`
        SELECT id, doc_id, content, retry_count, max_retries
        FROM embedding_queue
        WHERE status = 'pending'
          AND (? IS NULL OR collection = ?)
        ORDER BY priority ASC, created_at ASC
        LIMIT ?
    `, [collection, collection, batchSize]);

    if (items.length === 0) {
        return { processed: 0, succeeded: 0, failed: 0 };
    }

    // 2. Mark as processing
    const itemIds = items.map(i => i.id);
    await db.run(`
        UPDATE embedding_queue
        SET status = 'processing'
        WHERE id IN (${itemIds.join(',')})
    `);

    // 3. Process each item
    let succeeded = 0, failed = 0;

    for (const item of items) {
        try {
            // Generate embedding
            const embedding = await generateEmbedding(item.content, provider);

            // Store in vector table
            await db.run(`
                INSERT INTO vec_default_dense (rowid, embedding)
                VALUES (?, ?)
                ON CONFLICT(rowid) DO UPDATE SET embedding = excluded.embedding
            `, [item.doc_id, embedding]);

            // Mark completed
            await db.run(`
                UPDATE embedding_queue
                SET status = 'completed',
                    processed_at = unixepoch()
                WHERE id = ?
            `, [item.id]);

            succeeded++;

        } catch (error) {
            // Retry logic
            const shouldRetry = item.retry_count < item.max_retries;

            if (shouldRetry) {
                // Increment retry count, back to pending
                await db.run(`
                    UPDATE embedding_queue
                    SET status = 'pending',
                        retry_count = retry_count + 1,
                        error_message = ?
                    WHERE id = ?
                `, [error.message, item.id]);
            } else {
                // Max retries reached, mark failed
                await db.run(`
                    UPDATE embedding_queue
                    SET status = 'failed',
                        error_message = ?,
                        processed_at = unixepoch()
                    WHERE id = ?
                `, [error.message, item.id]);
            }

            failed++;
        }
    }

    return {
        processed: items.length,
        succeeded,
        failed
    };
}
```

## Retry Strategy

**Exponential backoff (client-side):**

```typescript
async function processWithBackoff(maxAttempts = 3): Promise<void> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const result = await processEmbeddingQueue({ batchSize: 10 });

        if (result.failed === 0) {
            break; // All succeeded
        }

        if (attempt < maxAttempts - 1) {
            // Wait before retry (exponential backoff)
            const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
            await sleep(delay);
        }
    }
}
```

**Server tracks retry count:**
- Each failure increments `retry_count`
- After `max_retries`, status → 'failed'
- Failed items require manual intervention or queue clear

## Priority Levels

**1 = High Priority:**
- User-initiated actions
- Interactive search results
- Recently added documents

**2 = Normal Priority (default):**
- Bulk imports
- Background processing
- Scheduled tasks

**3 = Low Priority:**
- Historical data
- Optional content
- Non-critical embeddings

## Batch Processing

**Benefits:**
- Amortize provider initialization cost
- Reduce RPC overhead
- Better progress tracking

**Optimal batch size:**
- Small corpus (<1000 docs): 5-10
- Medium corpus (1000-10000): 10-50
- Large corpus (>10000): 50-100

## Performance Characteristics

**Processing rate:**
- Transformers.js: ~1-5 docs/sec (client-side)
- OpenAI API: ~10-50 docs/sec (server, rate-limited)
- Local ONNX: ~5-20 docs/sec (client-side, optimized)

**Storage:**
- Queue overhead: ~100 bytes/item
- 10,000 queued items: ~1MB

## Common Pitfalls

### ❌ Processing Without Provider
```typescript
// WRONG - No embedding provider configured
await processEmbeddingQueue({ batchSize: 10 });

// CORRECT - Specify provider
await processEmbeddingQueue({
    batchSize: 10,
    provider: 'transformers-js'
});
```

### ❌ Infinite Retry Loop
```typescript
// WRONG - No max retries
INSERT INTO embedding_queue (..., max_retries) VALUES (..., -1);

// CORRECT - Set reasonable max
INSERT INTO embedding_queue (..., max_retries) VALUES (..., 3);
```

### ❌ Not Handling Failed Items
Failed items accumulate - periodically clear or retry:
```typescript
// Option 1: Retry failed items
await db.run(`UPDATE embedding_queue SET status = 'pending', retry_count = 0 WHERE status = 'failed'`);

// Option 2: Clear failed items
await db.clearEmbeddingQueue({ status: 'failed' });
```

## Related Patterns

- [Hybrid Search](hybrid-search.md) - Uses generated embeddings
- [Worker RPC](worker-rpc.md) - Queue operations via RPC
- [Schema Management](schema-management.md) - Queue table creation

## References

- Implementation: `src/database/worker/embedding/`
- Demo: `examples/web-client/` (queue management UI)

## Last Updated

2025-10-16
