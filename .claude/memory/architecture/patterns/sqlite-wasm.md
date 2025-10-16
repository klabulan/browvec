# Pattern: SQLite WASM Integration

**Category:** Database / WASM
**Status:** Proven
**Related ADR:** [003-sqlite-vec-integration](../decisions/003-sqlite-vec-integration.md)

---

## Overview

LocalRetrieve uses SQLite compiled to WebAssembly with custom extensions (sqlite-vec for vector search, FTS5 for full-text search). WASM module loads dynamically in worker thread.

## Build Configuration

**Tools:** Emscripten SDK (emsdk)

**Location:** Build scripts use `npm run build:wasm`

**Extensions included:**
- `sqlite-vec` - Vector similarity search
- `FTS5` - Full-text search with BM25 ranking
- `JSON1` - JSON functions
- `RTREE` - R-tree indexes (spatial)

## Loading Pattern

```typescript
// Worker thread: Dynamic WASM import
let SQLite: any = null;

async function loadSQLiteWASM() {
    if (SQLite) return SQLite; // Already loaded

    // Import WASM module
    const module = await import('/sqlite3.mjs');

    // Initialize with WASM binary
    SQLite = await module.default({
        locateFile(file: string) {
            // WASM files in public/ and dist/
            return `/${file}`;
        }
    });

    return SQLite;
}
```

**File locations:**
- Build output: `dist/sqlite3.wasm`, `dist/sqlite3.mjs`
- Public assets: `public/sqlite3.wasm`, `public/sqlite3.mjs`
- Dev server serves from both locations

## Extension Usage

### sqlite-vec (Vector Search)

```sql
-- Create virtual table for vectors
CREATE VIRTUAL TABLE vec_default_dense USING vec0(
    embedding FLOAT[384]  -- 384-dimensional vectors
);

-- Insert vector
INSERT INTO vec_default_dense (rowid, embedding)
VALUES (1, vector_blob(?));

-- Similarity search (cosine distance)
SELECT rowid, distance
FROM vec_default_dense
WHERE embedding MATCH ?
  AND k = 10  -- Top 10 results
ORDER BY distance;
```

**Critical:** Vectors MUST be Float32Array, 384 dimensions

### FTS5 (Full-Text Search)

```sql
-- Create FTS5 table with BM25 ranking
CREATE VIRTUAL TABLE fts_default USING fts5(
    content,
    tokenize = 'unicode61'  -- UTF-8 support, case-insensitive
);

-- Full-text search with BM25 score
SELECT rowid, rank, content
FROM fts_default
WHERE fts_default MATCH ?
ORDER BY rank;
```

## Memory Management

**WASM memory:**
- Initial: 16MB
- Maximum: 2GB (browser limit)
- Grows automatically as needed

**SQLite cache:**
```sql
-- Set cache size (pages)
PRAGMA cache_size = 10000;  -- ~40MB with 4KB pages

-- Set page size
PRAGMA page_size = 4096;  -- 4KB pages (default)
```

## Performance Characteristics

**WASM overhead:**
- Loading: ~50-100ms (one-time)
- Function calls: ~0.01-0.1ms overhead vs native
- Memory access: Near-native speed

**Optimization flags:**
```
-O3                    # Maximum optimization
-flto                  # Link-time optimization
-s WASM=1              # Output WASM
-s ALLOW_MEMORY_GROWTH=1  # Dynamic memory
```

## Common Pitfalls

### ❌ Double Initialization
```typescript
// WRONG - Loading twice wastes time
const db1 = await loadSQLiteWASM();
const db2 = await loadSQLiteWASM(); // Loads again

// CORRECT - Cache loaded module
let SQLiteModule = null;
async function getSQLite() {
    if (!SQLiteModule) {
        SQLiteModule = await loadSQLiteWASM();
    }
    return SQLiteModule;
}
```

### ❌ Wrong Vector Format
```typescript
// WRONG - Regular array
const vector = [0.1, 0.2, 0.3, ...];

// CORRECT - Float32Array
const vector = new Float32Array([0.1, 0.2, 0.3, ...]);
```

### ❌ Missing COOP/COEP Headers
```
Error: SharedArrayBuffer is not defined
```

**Solution:** Dev server must set headers:
```javascript
headers: {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp'
}
```

## Related Patterns

- [Worker RPC](worker-rpc.md) - WASM runs in worker
- [Hybrid Search](hybrid-search.md) - Uses FTS5 + vec0
- [Schema Management](schema-management.md) - Creates FTS5/vec0 tables

## References

- **SQLite WASM:** https://sqlite.org/wasm/
- **sqlite-vec:** https://github.com/asg017/sqlite-vec
- **Emscripten:** https://emscripten.org/

## Last Updated

2025-10-16
