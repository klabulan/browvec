# LocalRetrieve Deployment Bundle

Generated: 2025-10-02T07:22:50.361Z
Version: 0.1.0

## Contents

This bundle contains everything needed to deploy LocalRetrieve in a web application:

### Core Files
- `localretrieve.mjs` - Main SDK entry point
- `sqlite3.mjs` - SQLite WASM loader
- `sqlite3.wasm` - SQLite WASM binary (1.27 MB)
- `database/worker.js` - Background worker implementation

### Supporting Files
- `ProviderFactory-*.mjs` - Embedding provider implementations
- `CacheManager-*.mjs` - Cache management
- `rpc-*.mjs` - RPC communication layer

## Deployment Instructions

### 1. Copy to Your Web App

```bash
# Copy entire bundle to your static files directory
cp -r bundle/* /path/to/your/app/lib/localretrieve/
```

### 2. Load in Your Application

```javascript
// Import the SDK
import { initLocalRetrieve } from './lib/localretrieve/localretrieve.mjs';

// Initialize database
const db = await initLocalRetrieve('opfs:/myapp.db', {
    workerUrl: './lib/localretrieve/database/worker.js'
});

// Use the database
const docId = await db.insertDocumentWithEmbedding({
    collection: 'documents',
    content: 'Hello, world!',
    metadata: { title: 'Test Document' }
});

// Search
const results = await db.searchAdvanced({
    collection: 'documents',
    query: 'hello',
    limit: 10
});
```

### 3. Required HTTP Headers

Your server must set these headers for WASM SharedArrayBuffer support:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

If using Vite, the dev server plugin handles this automatically:

```javascript
// vite.config.js
import { localRetrievePlugin } from './lib/localretrieve/vite-plugin.js';

export default {
  plugins: [localRetrievePlugin()]
}
```

## Browser Support

- Chrome 86+
- Firefox 79+
- Safari 15+
- Edge 85+

Requires SharedArrayBuffer and OPFS support.

## Troubleshooting

### "SQLite WASM module not loaded"
- Verify `sqlite3.wasm` is in the same directory as `sqlite3.mjs`
- Check browser console for fetch errors
- Ensure COOP/COEP headers are set

### "Failed to load worker"
- Verify `workerUrl` path is correct
- Check that worker.js is accessible via HTTP
- Verify service worker is not blocking requests

### Database recreates on reload
- Ensure you're using `opfs:/` prefix for persistent storage
- Check that OPFS is supported in your browser
- Verify you're not calling `initLocalRetrieve()` multiple times

## More Information

- Full documentation: https://github.com/klabulan/browvec
- Issues: https://github.com/klabulan/browvec/issues
- Examples: https://github.com/klabulan/browvec/tree/main/examples
