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
    content: 'A comprehensive guide to machine learning algorithms...',
    metadata: {
      author: 'John Doe',
      tags: ['ml', 'ai', 'tutorial'],
      customField: 'any value'  // metadata is preserved exactly
    }
  },
  options: {
    generateEmbedding: true  // default: true
  }
});

console.log(result.id);                  // Generated document ID
console.log(result.embeddingGenerated);  // true

// Use custom document ID
const customResult = await db.insertDocumentWithEmbedding({
  collection: 'documents',
  document: {
    id: 'doc-2024-001',  // Custom ID (string or number)
    title: 'Custom ID Document',
    content: 'Document with user-specified ID'
  }
});

console.log(customResult.id);  // 'doc-2024-001'
```

#### Batch Insert (Recommended for Multiple Documents)

For inserting multiple documents, use `batchInsertDocuments()` which automatically manages transactions for:
- **Reliability**: Prevents FTS5 lock contention errors
- **Performance**: 10-100x faster than sequential inserts
- **Atomicity**: All documents inserted or none (automatic rollback on error)

```typescript
// Batch insert with automatic transaction management
const results = await db.batchInsertDocuments({
  collection: 'chunks',
  documents: [
    {
      id: 'chunk_1',
      title: 'Chapter 1',
      content: 'First chapter content...',
      metadata: { chapter: 1, pages: 15 }
    },
    {
      id: 'chunk_2',
      title: 'Chapter 2',
      content: 'Second chapter content...',
      metadata: { chapter: 2, pages: 22 }
    },
    {
      id: 'chunk_3',
      title: 'Chapter 3',
      content: 'Third chapter content...',
      metadata: { chapter: 3, pages: 18 }
    }
  ],
  options: {
    generateEmbedding: true
  }
});

console.log(`Inserted ${results.length} documents`);
// Results: Array of { id: string, embeddingGenerated: boolean }
```

**When to use:**
- ✅ Inserting 2+ documents sequentially
- ✅ Bulk data imports
- ✅ Processing large files split into chunks
- ✅ Any batch operation

**Performance example:**
```typescript
// 50 documents batch insert
const startTime = Date.now();

const results = await db.batchInsertDocuments({
  collection: 'articles',
  documents: articles, // Array of 50 documents
  options: { generateEmbedding: false }
});

console.log(`Inserted ${results.length} in ${Date.now() - startTime}ms`);
// Typical result: ~50-100ms for 50 documents
// vs 500-2000ms with sequential inserts
```

**Error handling (automatic rollback):**
```typescript
try {
  const results = await db.batchInsertDocuments({
    collection: 'docs',
    documents: myDocuments
  });

  console.log('All documents inserted successfully');

} catch (error) {
  // All inserts automatically rolled back on error
  // Database remains in consistent state
  console.error('Batch insert failed:', error.message);
}
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

LocalRetrieve supports multiple LLM providers for query enhancement and result summarization:

- **OpenAI** - GPT-4, GPT-3.5-turbo
- **Anthropic** - Claude 3 (Opus, Sonnet, Haiku)
- **OpenRouter** - 100+ models (GPT-4, Claude, Llama, Mixtral, Gemini, and more)
- **Custom** - Any OpenAI-compatible endpoint

### Query Enhancement

Improve search queries using LLM:

```typescript
// Using OpenAI
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

// Using Anthropic Claude
const summary = await db.summarizeResults(results.results, {
  provider: 'anthropic',
  model: 'claude-3-sonnet-20240229',
  apiKey: 'sk-ant-...',
  maxLength: 500
});

console.log(summary.summary);      // "The search results cover..."
console.log(summary.keyPoints);    // ["Neural networks", "Deep learning", ...]
console.log(summary.themes);       // ["AI", "algorithms", "training"]
```

### OpenRouter Integration

Access 100+ models through one API with OpenRouter:

```typescript
// Query enhancement with OpenRouter (endpoint is optional - has default)
const enhanced = await db.enhanceQuery('AI tutorials', {
  provider: 'openrouter',
  model: 'openai/gpt-4',              // or 'anthropic/claude-3-opus'
  apiKey: 'sk-or-v1-...'              // Get at https://openrouter.ai/keys
});

// Use auto-routing (OpenRouter picks best model)
const result = await db.callLLM('Summarize quantum computing', {
  provider: 'openrouter',
  model: 'openrouter/auto',
  apiKey: 'sk-or-v1-...'
});

// Custom endpoint (optional - defaults to https://openrouter.ai/api/v1/chat/completions)
const custom = await db.enhanceQuery('query', {
  provider: 'openrouter',
  model: 'openai/gpt-4',
  apiKey: 'sk-or-v1-...',
  endpoint: 'https://custom-openrouter-proxy.com/v1/chat/completions'
});
```

**Popular OpenRouter models:**
- `openai/gpt-4` - GPT-4 via OpenRouter
- `anthropic/claude-3-opus` - Claude 3 Opus
- `meta-llama/llama-3-70b-instruct` - Meta's Llama 3
- `mistralai/mixtral-8x7b-instruct` - Mistral Mixtral
- `google/gemini-pro` - Google Gemini
- `openrouter/auto` - Auto-select best model

### Getting API Keys

- **OpenAI**: https://platform.openai.com/api-keys
- **Anthropic**: https://console.anthropic.com/settings/keys
- **OpenRouter**: https://openrouter.ai/keys (recommended - access to all models with one key)

**Security Note**: API keys are never stored by LocalRetrieve - they're only passed at runtime and kept in memory.

### Combined Smart Search

The `searchWithLLM` method combines search with optional query enhancement and result summarization in a single call:

```typescript
// Example: Full-featured smart search with OpenRouter
const smartSearch = await db.searchWithLLM('machine learning tutorials', {
  enhanceQuery: true,              // Improve the query with LLM
  summarizeResults: true,          // Generate AI summary of results
  searchOptions: {
    limit: 20,
    minScore: 0.5,
    collection: 'default',
    enableEmbedding: true          // Enable hybrid search (text + vector)
  },
  llmOptions: {
    provider: 'openrouter',
    model: 'openai/gpt-4',
    apiKey: 'sk-or-v1-...',
    temperature: 0.7
  }
});

// Response structure
console.log(smartSearch.results);            // SearchResult[]
console.log(smartSearch.enhancedQuery);      // Query enhancement details
console.log(smartSearch.summary);            // AI-generated summary
console.log(smartSearch.searchTime);         // Time for search (ms)
console.log(smartSearch.llmTime);            // Time for LLM calls (ms)
console.log(smartSearch.totalTime);          // Total time (ms)
```

#### Response Structure

When `summarizeResults: true`:

```typescript
{
  results: SearchResult[],           // Search results array
  summary: {
    summary: string,                 // Main summary text
    keyPoints: string[],             // Key points extracted from results
    themes: string[],                // Identified themes
    confidence: number,              // Confidence score (0-1)
    provider: string,                // LLM provider used
    model: string,                   // Model name
    processingTime: number           // Processing time in ms
  },
  enhancedQuery?: {                  // Present when enhanceQuery=true
    originalQuery: string,
    enhancedQuery: string,
    suggestions: string[],
    intent?: string,
    confidence: number,
    provider: string,
    model: string,
    processingTime: number
  },
  searchTime: number,
  llmTime: number,
  totalTime: number
}
```

#### Search Options

All options for `searchWithLLM`:

```typescript
interface SearchWithLLMOptions {
  // LLM features
  enhanceQuery?: boolean;          // Use LLM to improve query (default: false)
  summarizeResults?: boolean;      // Generate AI summary (default: false)

  // Search configuration
  searchOptions?: {
    limit?: number;                // Max results (default: 10)
    minScore?: number;             // Minimum relevance score (0-1)
    collection?: string;           // Collection name (default: 'default')
    offset?: number;               // Skip N results (pagination)
    enableEmbedding?: boolean;     // Auto-generate query embedding for hybrid search (default: false)
  };

  // LLM provider configuration
  llmOptions?: {
    provider?: 'openai' | 'anthropic' | 'openrouter' | 'custom';
    model?: string;                // Model name
    apiKey?: string;               // API key (required)
    endpoint?: string;             // Custom endpoint (optional)
    temperature?: number;          // 0-1, creativity (default: 0.7)
    maxTokens?: number;            // Max tokens (default: 500)
    timeout?: number;              // Timeout in ms (default: 10000)
  };
}
```

#### Use Cases

**1. Search with summary only:**
```typescript
const result = await db.searchWithLLM('python tutorials', {
  summarizeResults: true,
  searchOptions: { limit: 15 },
  llmOptions: {
    provider: 'openrouter',
    model: 'anthropic/claude-3-sonnet',
    apiKey: 'sk-or-v1-...'
  }
});

console.log(result.summary.summary);       // "The results show various Python learning resources..."
console.log(result.summary.keyPoints);     // ["Beginner tutorials", "Advanced topics", ...]
console.log(result.summary.themes);        // ["Programming", "Education", "Web development"]
```

**2. Query enhancement only:**
```typescript
const result = await db.searchWithLLM('find ML docs', {
  enhanceQuery: true,
  llmOptions: {
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    apiKey: 'sk-...'
  }
});

console.log(result.enhancedQuery.enhancedQuery);  // "machine learning documentation"
console.log(result.enhancedQuery.suggestions);     // ["ML tutorials", "deep learning guides", ...]
```

**3. Full smart search (both features + hybrid):**
```typescript
const result = await db.searchWithLLM('AI', {
  enhanceQuery: true,
  summarizeResults: true,
  searchOptions: {
    limit: 20,
    minScore: 0.6,
    enableEmbedding: true          // Use hybrid search (text + vector)
  },
  llmOptions: {
    provider: 'openrouter',
    model: 'openrouter/auto',     // Auto-select best model
    apiKey: 'sk-or-v1-...'
  }
});

// Original query enhanced to better search query
console.log(result.enhancedQuery.enhancedQuery);

// Search results
result.results.forEach(r => {
  console.log(`${r.title}: ${r.score}`);
});

// AI summary of all results
console.log(result.summary.summary);
console.log(`Processed in ${result.totalTime}ms`);
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

**Current Schema Version: 3** (automatically migrates from v2)

```sql
-- Collections registry
CREATE TABLE collections (
  name TEXT PRIMARY KEY,
  embedding_provider TEXT,
  embedding_dimensions INTEGER,
  embedding_status TEXT,
  config JSON
);

-- Documents (default collection) - Schema v3
CREATE TABLE docs_default (
  rowid INTEGER PRIMARY KEY,
  id TEXT UNIQUE,
  title TEXT,
  content TEXT NOT NULL,
  collection TEXT NOT NULL,  -- v3: Separate column for internal use
  metadata JSON,             -- v3: Pure user data (no injection)
  created_at INTEGER,
  updated_at INTEGER
);

-- Index for efficient collection filtering
CREATE INDEX idx_docs_collection ON docs_default(collection);

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

## 📋 Metadata API Contract (Schema v3)

LocalRetrieve guarantees **exact preservation** of user metadata without internal field injection.

### Guarantees

1. ✅ **Exact Preservation**: `JSON.stringify(input.metadata) === stored.metadata`
2. ✅ **No Reserved Fields**: All field names in `metadata` are user-controlled
3. ✅ **No Automatic Fields**: System won't inject fields into metadata
4. ✅ **Type Preservation**: Objects, arrays, numbers, strings, booleans, null preserved
5. ✅ **Nesting Support**: Arbitrary nesting depth supported

### Custom Document IDs

You can provide custom IDs for documents:

```typescript
// String ID
await db.insertDocumentWithEmbedding({
  collection: 'docs',
  document: {
    id: 'user-doc-123',
    content: 'Custom ID document'
  }
});

// Numeric ID
await db.insertDocumentWithEmbedding({
  collection: 'docs',
  document: {
    id: 12345,
    content: 'Numeric ID document'
  }
});
```

**ID Requirements**:
- Must be unique within the collection
- Type: `string` or `number`
- Cannot be empty string
- Auto-generated if not provided: `doc_{timestamp}_{random}`

### Validation & Error Handling

LocalRetrieve validates documents before insertion:

```typescript
try {
  await db.insertDocumentWithEmbedding({
    collection: 'docs',
    document: {
      content: 'Valid document'
    }
  });
} catch (error) {
  if (error.name === 'ValidationError') {
    // Input validation failed
    console.error('Validation errors:', error.context.errors);
  } else if (error.name === 'DocumentInsertError') {
    // Insert operation failed
    console.error('Insert failed:', error.message);
    console.error('Suggestion:', error.context.suggestion);
  }
}
```

**Validation Rules**:
- ✅ At least `content` OR `title` must be provided
- ✅ `metadata` must be a plain object (not array or primitive)
- ✅ `id` must be string or number (if provided)
- ⚠️  Warning if `metadata` >1MB (performance)
- ⚠️  Warning if `metadata.collection` exists (no longer reserved, see migration notes)

### Schema v3 Migration Notes

**⚠️ Breaking Change** (v2 → v3): `metadata.collection` behavior changed

**Before (v2)**:
```typescript
// metadata.collection was OVERWRITTEN by system
document: {
  metadata: { collection: 'my_value' }  // ❌ Lost - became 'default'
}
```

**After (v3)**:
```typescript
// metadata.collection is PRESERVED as user data
document: {
  metadata: { collection: 'my_value' }  // ✅ Stored exactly as provided
}
// Collection tracked separately in collection column
```

**Automatic Migration**: Existing databases automatically upgrade from v2 to v3 on first use.

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
