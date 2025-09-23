# LocalRetrieve MVP Installation & Usage Guide

## Quick Start (10-Minute Guide)

This guide gets you from zero to working hybrid search in under 10 minutes.

### Prerequisites

- **Node.js 18+** (check with `node --version`)
- **Modern browser** (Chrome 90+, Firefox 90+, Safari 14+)
- **HTTPS-capable local server** (Vite provides this)

### Step 1: Installation (2 minutes)

**Option A: NPM Package (Recommended)**
```bash
npm install localretrieve
```

**Option B: CDN (Quick Testing)**
```html
<script type="module">
  import { Database } from 'https://cdn.jsdelivr.net/npm/localretrieve@1.0.0/dist/localretrieve.mjs';
</script>
```

**Option C: Build from Source**
```bash
git clone https://github.com/org/browvec.git
cd browvec
npm install
npm run build
```

### Step 2: Basic Setup (2 minutes)

**Create `index.html` with required headers:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>LocalRetrieve Test</title>
</head>
<body>
  <div id="app">
    <h1>LocalRetrieve Demo</h1>
    <div id="status">Loading...</div>
    <div id="results"></div>
  </div>
  <script type="module" src="./app.js"></script>
</body>
</html>
```

**Create `app.js`:**
```javascript
import { Database } from 'localretrieve';

async function main() {
  try {
    // Initialize database with OPFS persistence
    const db = await Database.create(undefined, 'opfs:/demo/search.db');
    
    document.getElementById('status').textContent = 'Database ready!';
    
    // Your hybrid search code goes here...
    
  } catch (error) {
    document.getElementById('status').textContent = `Error: ${error.message}`;
  }
}

main();
```

**Setup development server with required headers:**
```bash
# If using Vite (recommended)
npm install -D vite
npx vite --host --https

# Or use the included dev server script
npm run dev
```

### Step 3: Initialize Schema (1 minute)

```javascript
// Add to your app.js main() function
async function initializeSearch(db) {
  // IMPORTANT: Manually initialize sqlite-vec extension first
  // This is required for WASM builds
  if (db._sqlite3_vec_init_manual) {
    const initResult = db._sqlite3_vec_init_manual(db.dbPointer);
    if (initResult !== 0) {
      throw new Error('Failed to initialize sqlite-vec extension');
    }
    console.log('sqlite-vec extension initialized');
  }
  
  // Create default collection tables
  await db.exec(`
    -- Documents table
    CREATE TABLE IF NOT EXISTS docs_default (
      rowid INTEGER PRIMARY KEY,
      id TEXT UNIQUE,
      title TEXT,
      content TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
    
    -- Full-text search table
    CREATE VIRTUAL TABLE IF NOT EXISTS fts_default USING fts5(
      id UNINDEXED,
      title,
      content,
      tokenize = "unicode61 remove_diacritics 2"
    );
    
    -- Vector search table (384-dimensional embeddings)
    CREATE VIRTUAL TABLE IF NOT EXISTS vec_default_dense USING vec0(
      rowid INTEGER PRIMARY KEY,
      embedding float[384]
    );
  `);
  
  console.log('Schema initialized with vector support');
}

// Call after database creation
await initializeSearch(db);
```

### Step 4: Add Documents (2 minutes)

```javascript
async function addDocument(db, id, title, content, vector) {
  // Insert into main docs table
  db.run(
    'INSERT OR REPLACE INTO docs_default (id, title, content) VALUES (?, ?, ?)',
    [id, title, content]
  );
  
  // Get the rowid for FTS and vector tables
  const stmt = db.prepare('SELECT rowid FROM docs_default WHERE id = ?');
  stmt.bind([id]);
  stmt.step();
  const rowid = stmt.getAsObject().rowid;
  stmt.free();
  
  // Insert into FTS table
  db.run(
    'INSERT OR REPLACE INTO fts_default (rowid, id, title, content) VALUES (?, ?, ?, ?)',
    [rowid, id, title, content]
  );
  
  // Insert into vector table
  db.run(
    'INSERT OR REPLACE INTO vec_default_dense (rowid, embedding) VALUES (?, vec_f32(?))',
    [rowid, JSON.stringify(Array.from(vector))]
  );
}

// Example usage with mock vectors
const sampleDocs = [
  {
    id: 'doc1',
    title: 'Introduction to Vector Search', 
    content: 'Vector search enables semantic similarity matching using embeddings to find related documents.',
    vector: new Float32Array(384).fill(0.1) // Mock 384-dim vector
  },
  {
    id: 'doc2',
    title: 'Full-Text Search Guide',
    content: 'Full-text search provides fast keyword-based document retrieval with relevance ranking.',
    vector: new Float32Array(384).fill(0.2) // Mock 384-dim vector
  }
];

// Add sample documents
for (const doc of sampleDocs) {
  await addDocument(db, doc.id, doc.title, doc.content, doc.vector);
}

document.getElementById('status').textContent = `Added ${sampleDocs.length} documents`;
```

### Step 5: Perform Hybrid Search (3 minutes)

```javascript
async function hybridSearch(db, textQuery, queryVector, limit = 10) {
  // Hybrid search using RRF (Reciprocal Rank Fusion)
  const searchSQL = `
    WITH fts_results AS (
      SELECT rowid, bm25(fts_default) as fts_score, 
             rank() OVER (ORDER BY bm25(fts_default)) as fts_rank
      FROM fts_default 
      WHERE fts_default MATCH ? 
      LIMIT ?
    ),
    vec_results AS (
      SELECT rowid, distance as vec_score,
             rank() OVER (ORDER BY distance) as vec_rank  
      FROM vec_default_dense
      WHERE embedding MATCH vec_f32(?) AND k = ?
    )
    SELECT 
      d.id, d.title, d.content,
      COALESCE(f.fts_score, 0) as fts_score,
      COALESCE(v.vec_score, 1) as vec_score,
      (COALESCE(1.0/(60 + f.fts_rank), 0) + COALESCE(1.0/(60 + v.vec_rank), 0)) as fusion_score
    FROM (
      SELECT rowid FROM fts_results 
      UNION 
      SELECT rowid FROM vec_results
    ) combined
    LEFT JOIN docs_default d ON d.rowid = combined.rowid
    LEFT JOIN fts_results f ON f.rowid = combined.rowid
    LEFT JOIN vec_results v ON v.rowid = combined.rowid
    ORDER BY fusion_score DESC
    LIMIT ?
  `;
  
  const stmt = db.prepare(searchSQL);
  stmt.bind([
    textQuery, 
    limit, 
    JSON.stringify(Array.from(queryVector)), 
    limit, 
    limit
  ]);
  
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  
  return results;
}

// Example search
async function performSearch() {
  const queryVector = new Float32Array(384).fill(0.15); // Mock query vector
  const results = await hybridSearch(db, 'vector search', queryVector, 5);
  
  console.log('Search results:', results);
  
  // Display results
  const resultsDiv = document.getElementById('results');
  resultsDiv.innerHTML = '<h2>Search Results:</h2>' + 
    results.map(result => `
      <div style="border: 1px solid #ccc; margin: 10px; padding: 10px;">
        <h3>${result.title}</h3>
        <p>${result.content}</p>
        <small>
          FTS Score: ${result.fts_score?.toFixed(3)} | 
          Vector Score: ${result.vec_score?.toFixed(3)} | 
          Combined: ${result.fusion_score?.toFixed(3)}
        </small>
      </div>
    `).join('');
}

// Add search button to HTML and call performSearch()
```

## Complete Working Example

**`demo.html`:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>LocalRetrieve Quick Demo</title>
</head>
<body>
  <div style="max-width: 800px; margin: 0 auto; padding: 20px;">
    <h1>LocalRetrieve Hybrid Search Demo</h1>
    
    <div id="status">Initializing...</div>
    
    <div style="margin: 20px 0;">
      <button id="search-btn">Search "vector search"</button>
      <button id="export-btn">Export Database</button>
    </div>
    
    <div id="results"></div>
  </div>
  
  <script type="module">
    import { Database } from './dist/localretrieve.mjs';
    
    async function main() {
      const status = document.getElementById('status');
      const results = document.getElementById('results');
      
      try {
        status.textContent = 'Loading database...';
        const db = await Database.create(undefined, 'opfs:/demo/quickstart.db');
        
        status.textContent = 'Setting up schema...';
        // Schema setup code here...
        
        status.textContent = 'Adding sample documents...';
        // Document insertion code here...
        
        status.textContent = 'Ready! Try searching.';
        
        document.getElementById('search-btn').onclick = async () => {
          const searchResults = await hybridSearch(db, 'vector search', new Float32Array(384).fill(0.1));
          // Display results...
        };
        
        document.getElementById('export-btn').onclick = () => {
          const exported = db.export();
          const blob = new Blob([exported], { type: 'application/octet-stream' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'localretrieve-backup.db';
          a.click();
        };
        
      } catch (error) {
        status.textContent = `Error: ${error.message}`;
        console.error(error);
      }
    }
    
    main();
  </script>
</body>
</html>
```

## Framework Integration Examples

### React Integration

```jsx
// hooks/useLocalRetrieve.js
import { useState, useEffect } from 'react';
import { Database } from 'localretrieve';

export function useLocalRetrieve(filename = 'opfs:/app/search.db') {
  const [db, setDb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    Database.create(undefined, filename)
      .then(database => {
        setDb(database);
        setLoading(false);
      })
      .catch(err => {
        setError(err);
        setLoading(false);
      });
  }, [filename]);
  
  return { db, loading, error };
}

// components/SearchApp.jsx
function SearchApp() {
  const { db, loading, error } = useLocalRetrieve();
  const [results, setResults] = useState([]);
  
  const handleSearch = async (query) => {
    if (!db) return;
    const searchResults = await hybridSearch(db, query, mockVector);
    setResults(searchResults);
  };
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <div>
      <SearchBox onSearch={handleSearch} />
      <ResultsList results={results} />
    </div>
  );
}
```

### Vite Configuration

```javascript
// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    https: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp'
    }
  },
  worker: {
    format: 'es'
  },
  assetsInclude: ['**/*.wasm']
});
```

## Troubleshooting

### Common Issues

**1. "SharedArrayBuffer is not defined"**
- **Cause**: Missing COOP/COEP headers
- **Solution**: Ensure your server sends the required headers:
  ```
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
  ```
- **Quick fix**: Use `npx vite --https` or the provided dev server

**2. "No such VFS: opfs"**
- **Cause**: OPFS not supported or WASM not properly built
- **Solution**: Use fallback to in-memory database:
  ```javascript
  const db = await Database.create(undefined, ':memory:');
  ```

**3. "Vector table creation failed"**
- **Cause**: sqlite-vec extension not properly compiled
- **Solution**: Verify WASM build includes vec0 support:
  ```sql
  db.exec('PRAGMA compile_options;'); // Should include VEC
  ```

**4. Browser compatibility issues**
- **Chrome/Edge**: Full support
- **Firefox**: OPFS support from Firefox 111+
- **Safari**: Limited OPFS support, use fallback

### Performance Tips

**1. Vector Dimensions**
- Keep vectors ≤ 1024 dimensions for good performance
- Use Float32Array, not regular arrays
- Consider quantization for large datasets

**2. Batch Operations**
- Insert multiple documents in transactions:
  ```javascript
  db.exec('BEGIN TRANSACTION');
  // Multiple inserts...
  db.exec('COMMIT');
  ```

**3. Query Optimization**
- Limit FTS and vector results before fusion
- Use appropriate FTS tokenizers for your content
- Index frequently filtered columns

## Next Steps

### Production Considerations
1. **Error Handling**: Add comprehensive error handling for quota exceeded, network issues
2. **Performance Monitoring**: Add timing and metrics collection
3. **Security**: Consider encryption for sensitive data
4. **Backup Strategy**: Implement regular database exports

### Advanced Features (Future)
- Multiple collections
- Automatic embedding generation
- Result reranking
- Advanced fusion algorithms
- Real-time updates

### API Reference
See the complete API documentation at [docs/api/README.md](docs/api/README.md)

---

**🎉 Congratulations!** You now have a working hybrid search system running entirely in your browser. The database persists across sessions, and you can search using both text and vector similarity.

For production use, review the troubleshooting section and consider implementing proper error handling and monitoring.