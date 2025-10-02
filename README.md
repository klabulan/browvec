# LocalRetrieve

**Browser-native hybrid search library using SQLite WASM with vector search**

LocalRetrieve brings powerful semantic and keyword search capabilities directly to your browser - no servers required. Built on SQLite WASM with the sqlite-vec extension, it provides a sql.js-compatible API with advanced vector search, full-text search, and intelligent query fusion.

## ✨ Key Features

- 🔍 **Hybrid Search**: Combines BM25 (FTS5) + vector similarity with intelligent fusion
- 🧠 **Semantic Understanding**: Built-in embedding generation and vector search
- 💾 **Browser Persistence**: Data survives page reloads using OPFS
- ⚡ **Background Processing**: Queue-based embedding generation without blocking UI
- 🔄 **sql.js Compatible**: Drop-in replacement for existing applications
- 🤖 **LLM Integration**: Query enhancement and result summarization
- 🎯 **Zero Backend**: Everything runs client-side for maximum privacy
- 🚀 **Production Ready**: Comprehensive testing, error handling, and TypeScript support

## 📦 Installation

### From GitHub (Prebuilt)

Install the latest prebuilt version directly from GitHub:

```bash
npm install https://github.com/klabulan/browvec.git
```

Or add to your `package.json`:

```json
{
  "dependencies": {
    "localretrieve": "github:klabulan/browvec#main"
  }
}
```

**Note**: This works because prebuilt WASM files are included in the repository. To build from source instead, see the [Contributing](#-contributing) section below.

### From NPM (Coming Soon)

```bash
npm install localretrieve
```

### Browser CDN (Alternative)

```html
<script type="module">
  import { initLocalRetrieve } from 'https://unpkg.com/localretrieve/dist/localretrieve.mjs';
</script>
```

### Verify Installation

After installing, verify that all required files are present:

```bash
npm run verify
```

You should see:
```
✅ dist/localretrieve.mjs
✅ dist/sqlite3.mjs
✅ dist/sqlite3.wasm
✅ dist/database/worker.js
```

If any files are missing, you may need to build from source (see [Contributing](#-contributing)).

### Create Deployment Bundle

To create a ready-to-deploy bundle for your web application:

```bash
npm run bundle
```

This creates a `bundle/` directory with all necessary files and a comprehensive deployment guide. Simply copy the bundle contents to your static files directory:

```bash
cp -r node_modules/localretrieve/bundle/* public/lib/localretrieve/
```

See `bundle/README.md` for detailed integration instructions.

### Requirements

- **Modern Browser**: Chrome 86+, Firefox 79+, Safari 15+, or Edge 85+
- **COOP/COEP Headers**: Required for SharedArrayBuffer (automatically set in dev mode)
- **Node.js 18+**: For building from source

## 🚀 Quick Start

### Basic Setup

```typescript
import { initLocalRetrieve } from 'localretrieve';

// Initialize with browser persistence
const db = await initLocalRetrieve('opfs:/myapp/search.db');

// Database is ready - schema auto-created
console.log('Database initialized!');
```

### Add Documents

```typescript
// Insert a document
await db.runAsync(
  'INSERT INTO docs_default (id, title, content) VALUES (?, ?, ?)',
  ['doc1', 'Getting Started Guide', 'Learn how to use LocalRetrieve...']
);

// Or bulk insert
await db.bulkInsertAsync('docs_default', [
  { id: 'doc2', title: 'Advanced Features', content: 'Explore hybrid search...' },
  { id: 'doc3', title: 'API Reference', content: 'Complete API documentation...' }
]);
```

### Search

```typescript
// Text search
const results = await db.searchText('hybrid search tutorial', {
  limit: 10
});

// Results with relevance scores
results.results.forEach(result => {
  console.log(`${result.title}: ${result.score}`);
});
```

That's it! Your browser now has a powerful search engine built-in.

## 📚 Core API

### Database Initialization

```typescript
import { initLocalRetrieve, Database } from 'localretrieve';

// Recommended: Auto-initialize with persistence
const db = await initLocalRetrieve('opfs:/myapp/search.db');

// Advanced: Manual control
const db = await Database.create(undefined, 'opfs:/myapp/search.db');
await db.initializeSchema();

// In-memory only (no persistence)
const db = await Database.create();
```

### SQL Operations (sql.js Compatible)

LocalRetrieve is fully compatible with sql.js, so existing code works without changes:

```typescript
// Execute SQL (async recommended)
await db.execAsync('CREATE TABLE users (id INTEGER, name TEXT)');

// Run with parameters
await db.runAsync(
  'INSERT INTO users VALUES (?, ?)',
  [1, 'Alice']
);

// Prepared statements
const stmt = await db.prepareAsync('SELECT * FROM users WHERE id = ?');
await stmt.bindAsync([1]);
if (await stmt.stepAsync()) {
  const user = await stmt.getAsObjectAsync();
  console.log(user); // { id: 1, name: 'Alice' }
}
await stmt.freeAsync();

// Synchronous API also available (with limitations)
db.exec('SELECT * FROM users');
```

### Search Methods

#### 1. Text Search (Automatic Strategy)

Smart search that automatically selects the best strategy:

```typescript
const results = await db.searchText('machine learning tutorial', {
  collection: 'default',  // optional
  limit: 20,              // max results
  mode: 'AUTO'            // AUTO, KEYWORD, SEMANTIC, HYBRID
});

// Access results
results.results.forEach(result => {
  console.log(result.title);
  console.log(result.content);
  console.log(result.score);
});

// View debug info
console.log(results.debugInfo.strategy);  // Which strategy was used
console.log(results.searchTime);           // Performance metrics
```

#### 2. Hybrid Search (Text + Vector)

Combine keyword and semantic search:

```typescript
// With manual vector
const embedding = await generateEmbedding('search query');
const results = await db.search({
  query: {
    text: 'machine learning',
    vector: embedding  // Float32Array(384)
  },
  fusion: {
    method: 'rrf',  // or 'weighted'
    weights: { fts: 0.6, vec: 0.4 }
  },
  limit: 10
});
```

#### 3. Advanced Search (Full Control)

Explicit control over search strategy:

```typescript
const results = await db.searchAdvanced({
  query: 'neural networks',
  collection: 'documents',
  strategy: 'HYBRID',  // KEYWORD, SEMANTIC, HYBRID
  options: {
    limit: 15,
    similarityThreshold: 0.7,
    fusionMethod: 'weighted',
    fusionWeights: { keyword: 0.7, semantic: 0.3 }
  }
});
```

#### 4. Global Search (All Collections)

Search across all collections simultaneously:

```typescript
const results = await db.searchGlobal('search query', {
  limit: 50,
  groupByCollection: true
});

// Results grouped by collection
results.collections.forEach(({ name, results, totalResults }) => {
  console.log(`Collection: ${name} (${totalResults} results)`);
  results.forEach(result => console.log(result.title));
});
```

## 🧠 Semantic Search & Embeddings

### Collection Setup with Embeddings

```typescript
// Create collection with embedding configuration
await db.createCollection({
  name: 'documents',
  embeddingConfig: {
    provider: 'transformers',      // or 'openai'
    model: 'all-MiniLM-L6-v2',    // embedding model
    dimensions: 384                 // vector dimensions
  },
  description: 'My document collection'
});
```

### Insert with Automatic Embeddings

```typescript
// Insert document with auto-generated embeddings
const result = await db.insertDocumentWithEmbedding({
  collection: 'documents',
  document: {
    title: 'Machine Learning Guide',
    content: 'A comprehensive guide to machine learning algorithms...'
  },
  options: {
    generateEmbedding: true  // default: true
  }
});

console.log(result.id);                  // Generated document ID
console.log(result.embeddingGenerated);  // true
```

### Semantic Search (Text-to-Vector)

```typescript
// Search with automatic query embedding
const results = await db.searchSemantic({
  collection: 'documents',
  query: 'explain neural networks',  // Auto-converted to vector
  options: {
    limit: 10,
    similarityThreshold: 0.75,
    generateQueryEmbedding: true  // default: true
  }
});
```

## 🔄 Background Queue Processing

Process embeddings in the background without blocking the UI:

### Enqueue Documents

```typescript
// Add documents to processing queue
await db.enqueueEmbedding({
  collection: 'documents',
  documentId: 'doc123',
  textContent: 'Text to generate embedding for',
  priority: 1  // 1=high, 2=normal, 3=low
});

// Batch enqueue
for (const doc of documents) {
  await db.enqueueEmbedding({
    collection: 'documents',
    documentId: doc.id,
    textContent: doc.content,
    priority: 2
  });
}
```

### Process Queue

```typescript
// Process pending items
const result = await db.processEmbeddingQueue({
  collection: 'documents',  // optional: specific collection
  batchSize: 10,            // optional: items per batch
  maxRetries: 3             // optional: retry attempts
});

console.log(`Processed: ${result.processed}`);
console.log(`Failed: ${result.failed}`);
console.log(`Errors:`, result.errors);
```

### Queue Status

```typescript
// Get queue statistics
const status = await db.getQueueStatus('documents');

console.log(`Total: ${status.totalCount}`);
console.log(`Pending: ${status.pendingCount}`);
console.log(`Processing: ${status.processingCount}`);
console.log(`Completed: ${status.completedCount}`);
console.log(`Failed: ${status.failedCount}`);
```

### Clear Queue

```typescript
// Clear specific items
await db.clearEmbeddingQueue({
  collection: 'documents',          // optional
  status: 'failed',                 // optional: 'pending'|'completed'|'failed'
  olderThan: new Date('2024-01-01') // optional: date filter
});
```

## 🤖 LLM Integration

### Query Enhancement

Improve search queries using LLM:

```typescript
const enhanced = await db.enhanceQuery('find docs', {
  provider: 'openai',
  model: 'gpt-4',
  apiKey: 'sk-...',
  maxSuggestions: 5
});

console.log(enhanced.enhancedQuery);  // "search documents files"
console.log(enhanced.suggestions);    // ["find documents", "search files", ...]
console.log(enhanced.intent);         // "document_search"
console.log(enhanced.confidence);     // 0.85
```

### Result Summarization

Summarize search results with AI:

```typescript
const results = await db.search({ query: { text: 'machine learning' } });

const summary = await db.summarizeResults(results.results, {
  provider: 'anthropic',
  model: 'claude-3-sonnet',
  apiKey: 'sk-ant-...',
  maxLength: 500
});

console.log(summary.summary);      // "The search results cover..."
console.log(summary.keyPoints);    // ["Neural networks", "Deep learning", ...]
console.log(summary.themes);       // ["AI", "algorithms", "training"]
```

### Combined Smart Search

```typescript
// One call: enhance query + search + summarize results
const smartSearch = await db.searchWithLLM('AI docs', {
  enhanceQuery: true,
  summarizeResults: true,
  searchOptions: { limit: 20 },
  llmOptions: {
    provider: 'openai',
    model: 'gpt-4',
    apiKey: 'sk-...'
  }
});

console.log(smartSearch.enhancedQuery);  // Enhanced query
console.log(smartSearch.results);        // Search results
console.log(smartSearch.summary);        // AI summary
```

### Generic LLM Calls

Use LLM for custom tasks:

```typescript
const result = await db.callLLM('Explain quantum computing simply', {
  provider: 'openai',
  model: 'gpt-4',
  apiKey: 'sk-...',
  temperature: 0.7,
  maxTokens: 500
});

console.log(result.text);           // LLM response
console.log(result.usage);          // Token usage
console.log(result.processingTime); // Time in ms
```

## 🎯 Advanced Features

### Embedding Pipeline Control

```typescript
// Preload models for faster first query
await db.preloadModels(['transformers'], 'eager');

// Generate query embeddings with caching
const embedding = await db.generateQueryEmbedding(
  'search query',
  'documents',
  { forceRefresh: false }  // Use cache if available
);

// Warm cache with common queries
await db.warmEmbeddingCache('documents', [
  'getting started',
  'api documentation',
  'troubleshooting'
]);

// Get performance stats
const stats = await db.getPipelineStats();
console.log(stats.cacheHitRate);
console.log(stats.avgGenerationTime);

// Optimize memory usage
await db.optimizeModelMemory({
  maxMemoryUsage: 500 * 1024 * 1024,  // 500MB
  maxModels: 2,
  idleTimeout: 300000  // 5 minutes
});
```

### Export/Import Database

```typescript
// Export database to file
const data = await db.exportAsync();
const blob = new Blob([data], { type: 'application/x-sqlite3' });
const url = URL.createObjectURL(blob);
// Trigger download...

// Import database from file
const buffer = await file.arrayBuffer();
const importDb = await Database.create(new Uint8Array(buffer));
```

### Collection Management

```typescript
// Get collection embedding status
const status = await db.getCollectionEmbeddingStatus('documents');
console.log(status.provider);         // 'transformers'
console.log(status.dimensions);       // 384
console.log(status.totalDocuments);   // 1000
console.log(status.embeddedDocuments); // 950
```

### Direct SQL with Vectors

```typescript
// Insert vector manually
await db.runAsync(
  'INSERT INTO vec_default_dense (rowid, embedding) VALUES (?, ?)',
  [1, `[${myVector.join(',')}]`]  // 384-dim Float32Array
);

// Vector similarity search (raw SQL)
const results = await db.execAsync(`
  SELECT d.id, d.title, v.distance
  FROM docs_default d
  JOIN (
    SELECT rowid, distance
    FROM vec_default_dense
    WHERE embedding MATCH '[${queryVector.join(',')}]'
    ORDER BY distance
    LIMIT 10
  ) v ON d.rowid = v.rowid
`);
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│  Your Application (Main Thread)                │
├─────────────────────────────────────────────────┤
│  LocalRetrieve SDK                              │
│  - Database API (sql.js compatible)            │
│  - Search API (hybrid, semantic, text)         │
│  - Embedding API (generation, queue, cache)    │
└─────────────────┬───────────────────────────────┘
                  │ RPC over postMessage
┌─────────────────▼───────────────────────────────┐
│  Web Worker (Background Thread)                 │
├─────────────────────────────────────────────────┤
│  SQLite WASM + sqlite-vec                       │
│  - FTS5 full-text search                        │
│  - vec0 vector search                           │
│  - Embedding pipeline                           │
│  - Queue management                             │
└─────────────────┬───────────────────────────────┘
                  │ OPFS API
┌─────────────────▼───────────────────────────────┐
│  Browser Storage (Origin Private File System)   │
│  - Persistent database files                    │
│  - Survives page reloads                        │
└──────────────────────────────────────────────────┘
```

### Database Schema

```sql
-- Collections registry
CREATE TABLE collections (
  name TEXT PRIMARY KEY,
  embedding_provider TEXT,
  embedding_dimensions INTEGER,
  embedding_status TEXT,
  config JSON
);

-- Documents (default collection)
CREATE TABLE docs_default (
  rowid INTEGER PRIMARY KEY,
  id TEXT,
  title TEXT,
  content TEXT,
  metadata JSON
);

-- Full-text search index
CREATE VIRTUAL TABLE fts_default USING fts5(
  id UNINDEXED,
  title,
  content,
  tokenize = "unicode61 remove_diacritics 2"
);

-- Vector index (384 dimensions)
CREATE VIRTUAL TABLE vec_default_dense USING vec0(
  rowid INTEGER PRIMARY KEY,
  embedding float[384]
);

-- Background processing queue
CREATE TABLE embedding_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  collection_name TEXT,
  document_id TEXT,
  text_content TEXT,
  priority INTEGER DEFAULT 2,
  status TEXT DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0,
  created_at INTEGER,
  error_message TEXT
);
```

## 🧪 Testing

The library includes comprehensive test suites:

```bash
# Install dependencies
npm install
npx playwright install

# Run unit tests
npm test

# Run E2E integration tests
npm run test:e2e

# Run tests with UI
npm run test:e2e:ui

# Run all tests
npm run test:all
```

### Test Coverage

- ✅ Database initialization and persistence
- ✅ Full-text search accuracy
- ✅ Vector similarity calculations
- ✅ Hybrid search fusion algorithms
- ✅ Export/import functionality
- ✅ Queue management system
- ✅ Cross-browser compatibility
- ✅ Performance benchmarks
- ✅ Error handling scenarios

## ⚙️ Configuration

### Development Server

For local development, headers are automatically configured:

```bash
# Start dev server (with COOP/COEP headers)
npm run dev:vite

# Demo available at http://localhost:5174/examples/web-client/
```

### Production Deployment

Ensure your server sends these headers:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

**Nginx example:**
```nginx
location / {
  add_header Cross-Origin-Opener-Policy same-origin;
  add_header Cross-Origin-Embedder-Policy require-corp;
}
```

**Express example:**
```javascript
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
});
```

### Browser Support

| Browser | Minimum Version | OPFS Support | Notes |
|---------|----------------|--------------|-------|
| Chrome  | 86+            | ✅           | Full support |
| Firefox | 79+            | ✅           | Full support |
| Safari  | 15+            | ✅           | Full support |
| Edge    | 85+            | ✅           | Full support |

**Fallback**: If OPFS is unavailable, the library automatically falls back to in-memory database.

## 📊 Performance

### Benchmarks

- **Cold start**: <300ms (database creation + worker init)
- **First query**: <800ms (including schema initialization)
- **Hybrid search**: <50ms for 10k documents
- **Embedding generation**: ~20ms per document (Transformers.js)
- **Queue processing**: 50+ docs/second background
- **Bundle size**: ~2.1MB WASM + 150KB SDK

### Storage Limits

- **OPFS quota**: Browser-dependent (typically 10GB+)
- **Vector dimensions**: 384 (configurable per collection)
- **Tested corpus size**: Up to 100k documents
- **Recommended**: <50k documents per collection for optimal performance

## 🛡️ Privacy & Security

- ✅ **Zero Network**: Everything runs locally (except optional LLM/API calls)
- ✅ **Browser Sandbox**: Data isolated per origin
- ✅ **No Telemetry**: No tracking or analytics
- ✅ **API Keys**: Never stored, only passed at runtime
- ✅ **OPFS Privacy**: Data not accessible to other sites

## 📝 Examples

### Complete Search Application

```typescript
import { initLocalRetrieve } from 'localretrieve';

class SearchApp {
  async initialize() {
    // Setup database
    this.db = await initLocalRetrieve('opfs:/myapp/search.db');

    // Configure collection with embeddings
    await this.db.createCollection({
      name: 'articles',
      embeddingConfig: {
        provider: 'transformers',
        model: 'all-MiniLM-L6-v2',
        dimensions: 384
      }
    });

    console.log('Search ready!');
  }

  async addArticle(article) {
    return await this.db.insertDocumentWithEmbedding({
      collection: 'articles',
      document: {
        title: article.title,
        content: article.body,
        metadata: { author: article.author, date: article.date }
      }
    });
  }

  async search(query) {
    return await this.db.searchText(query, {
      collection: 'articles',
      limit: 20,
      mode: 'HYBRID'
    });
  }
}

// Use it
const app = new SearchApp();
await app.initialize();

// Add documents
await app.addArticle({
  title: 'Introduction to Machine Learning',
  body: 'Machine learning is a subset of artificial intelligence...',
  author: 'John Doe',
  date: '2024-01-15'
});

// Search
const results = await app.search('AI and machine learning');
results.results.forEach(r => console.log(r.title, r.score));
```

### More Examples

- **Complete Demo**: See `examples/web-client/` for full-featured demo application
- **E2E Tests**: See `tests/e2e/` for real-world usage patterns
- **API Tests**: See `tests/unit/` for API examples

## 🤝 Contributing

LocalRetrieve is in active development. See [CLAUDE.md](./CLAUDE.md) for development workflow and architecture details.

**Development setup:**

```bash
# 1. Prerequisites: Install Emscripten SDK (required for WASM compilation)
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
./emsdk install latest
./emsdk activate latest
source ./emsdk_env.sh  # Linux/Mac
# OR: emsdk_env.bat    # Windows
cd ..

# 2. Clone repository
git clone https://github.com/klabulan/browvec.git
cd browvec

# 3. Install dependencies
npm install

# 4. Build WASM + SDK (uses emsdk/ for compilation)
npm run build

# 5. Verify installation (ensures all files are present)
npm run verify

# 6. Start development server
npm run dev:vite

# 7. Run tests
npm run test:all

# 8. Create deployment bundle (optional)
npm run bundle
```

**Note**: The Emscripten SDK must be cloned to `./emsdk/` in the project root. The build script will automatically detect and use it.

**Available Scripts**:
- `npm run build` - Build WASM and TypeScript SDK
- `npm run verify` - Verify all required files are present
- `npm run bundle` - Create deployment bundle in `bundle/` directory
- `npm run dev:vite` - Start development server
- `npm run test` - Run unit tests
- `npm run test:e2e` - Run Playwright integration tests
- `npm run test:all` - Run all tests

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

## 🔗 Resources

- **Documentation**: See `CLAUDE.md` for architecture and development details
- **Demo**: Run `npm run dev:vite` and visit `http://localhost:5174/examples/web-client/`
- **Issues**: Report bugs at GitHub Issues
- **Discussions**: Community discussions at GitHub Discussions

---

**LocalRetrieve** - Bringing powerful hybrid search to every web application 🔍
