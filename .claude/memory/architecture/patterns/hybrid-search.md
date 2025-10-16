# Pattern: Hybrid Search (BM25 + Vector)

**Category:** Search / Retrieval
**Status:** Proven

---

## Overview

LocalRetrieve implements hybrid search combining:
1. **BM25** (full-text search via FTS5) - keyword matching
2. **Vector similarity** (sqlite-vec) - semantic matching

Results merged using configurable weighting.

## Schema

```sql
-- Document storage
CREATE TABLE docs_default (
    id INTEGER PRIMARY KEY,
    content TEXT NOT NULL,
    metadata TEXT,  -- JSON
    collection TEXT DEFAULT 'default',
    created_at INTEGER DEFAULT (unixepoch())
);

-- FTS5 for keyword search
CREATE VIRTUAL TABLE fts_default USING fts5(
    content,
    content=docs_default,
    content_rowid=id,
    tokenize='unicode61'
);

-- Vector search
CREATE VIRTUAL TABLE vec_default_dense USING vec0(
    embedding FLOAT[384]
);

-- Keep FTS5 synced with docs_default
-- Manual sync pattern (triggers replaced after optimization)
```

## Search Implementation

```typescript
interface SearchOptions {
    query: string;
    limit?: number;
    alpha?: number;  // BM25 weight (0-1), vector weight = 1-alpha
    collection?: string;
}

async function hybridSearch(options: SearchOptions): Promise<SearchResult[]> {
    const { query, limit = 10, alpha = 0.5, collection = 'default' } = options;

    // 1. Generate query embedding
    const queryEmbedding = await generateEmbedding(query);

    // 2. BM25 search
    const bm25Results = await db.all(`
        SELECT
            d.id,
            d.content,
            fts.rank AS bm25_score
        FROM fts_default fts
        JOIN docs_default d ON fts.rowid = d.id
        WHERE fts_default MATCH ?
          AND d.collection = ?
        ORDER BY rank
        LIMIT ?
    `, [query, collection, limit * 2]);

    // 3. Vector search
    const vectorResults = await db.all(`
        SELECT
            v.rowid AS id,
            d.content,
            v.distance AS vector_distance
        FROM vec_default_dense v
        JOIN docs_default d ON v.rowid = d.id
        WHERE v.embedding MATCH ?
          AND d.collection = ?
          AND k = ?
        ORDER BY distance
    `, [queryEmbedding, collection, limit * 2]);

    // 4. Normalize scores
    const normalizedBM25 = normalizeScores(bm25Results, 'bm25_score');
    const normalizedVector = normalizeScores(vectorResults, 'vector_distance', true); // Invert distance

    // 5. Merge and rank
    const merged = mergeResults(normalizedBM25, normalizedVector, alpha);

    // 6. Return top k
    return merged.slice(0, limit);
}

function mergeResults(bm25: Result[], vector: Result[], alpha: number): SearchResult[] {
    const scoresMap = new Map<number, { bm25: number, vector: number }>();

    // Collect scores
    bm25.forEach(r => {
        scoresMap.set(r.id, { bm25: r.score, vector: 0 });
    });

    vector.forEach(r => {
        const existing = scoresMap.get(r.id) || { bm25: 0, vector: 0 };
        existing.vector = r.score;
        scoresMap.set(r.id, existing);
    });

    // Calculate hybrid scores
    const results = Array.from(scoresMap.entries()).map(([id, scores]) => ({
        id,
        hybridScore: alpha * scores.bm25 + (1 - alpha) * scores.vector,
        bm25Score: scores.bm25,
        vectorScore: scores.vector
    }));

    // Sort by hybrid score
    results.sort((a, b) => b.hybridScore - a.hybridScore);

    return results;
}
```

## Score Normalization

```typescript
function normalizeScores(
    results: any[],
    scoreField: string,
    invertDistance = false
): Result[] {
    if (results.length === 0) return [];

    const scores = results.map(r => r[scoreField]);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const range = max - min || 1;

    return results.map(r => {
        let score = (r[scoreField] - min) / range;

        // For distances, invert (lower distance = higher score)
        if (invertDistance) {
            score = 1 - score;
        }

        return {
            id: r.id,
            content: r.content,
            score
        };
    });
}
```

## Tuning Alpha Parameter

**Alpha = BM25 weight** (0 to 1)
- `alpha = 1.0` → Pure BM25 (keyword only)
- `alpha = 0.5` → Balanced hybrid (default)
- `alpha = 0.0` → Pure vector (semantic only)

**Heuristics:**
- Exact terms/names → Higher alpha (0.7-0.9)
- Conceptual search → Lower alpha (0.3-0.5)
- Multi-lingual → Lower alpha (vectors better)
- Technical jargon → Higher alpha (BM25 better)

## Performance

**Query latency:**
- BM25 search: ~5-20ms (depends on corpus size)
- Vector search: ~10-50ms (depends on index size)
- Merging: ~1-5ms
- **Total:** ~20-75ms for typical queries

**Optimization:**
```sql
-- Index collections for faster filtering
CREATE INDEX idx_docs_collection ON docs_default(collection);

-- Limit search space
LIMIT ? * 2  -- Get 2x results from each, merge to top k
```

## Common Pitfalls

### ❌ Not Normalizing Scores
BM25 and vector distances have different ranges - MUST normalize before merging.

### ❌ Wrong Alpha Interpretation
```typescript
// WRONG - Backwards alpha
const score = (1 - alpha) * bm25 + alpha * vector;

// CORRECT - Alpha is BM25 weight
const score = alpha * bm25 + (1 - alpha) * vector;
```

### ❌ Forgetting to Generate Embedding
Vector search requires embedding - can't use raw query text.

## Related Patterns

- [SQLite WASM](sqlite-wasm.md) - FTS5 and vec0 extensions
- [Embedding Queue](embedding-queue.md) - Generate embeddings for docs
- [Schema Management](schema-management.md) - Table creation

## Last Updated

2025-10-16
