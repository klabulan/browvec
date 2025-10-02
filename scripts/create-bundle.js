#!/usr/bin/env node
/**
 * Creates a ready-to-deploy bundle of LocalRetrieve
 * Output: bundle/ directory with all files needed for web deployment
 */

const fs = require('fs-extra');
const path = require('path');

const BUNDLE_DIR = 'bundle';
const DIST_DIR = 'dist';

async function createBundle() {
    console.log('📦 Creating LocalRetrieve deployment bundle...\n');

    try {
        // Clean bundle directory
        await fs.remove(BUNDLE_DIR);
        await fs.ensureDir(BUNDLE_DIR);

        // Copy all dist files
        console.log('📋 Copying distribution files...');
        await fs.copy(DIST_DIR, BUNDLE_DIR, {
            filter: (src) => {
                // Exclude source maps in production bundles (optional)
                return !src.endsWith('.map');
            }
        });

        // Verify critical files
        const criticalFiles = ['sqlite3.wasm', 'sqlite3.mjs', 'localretrieve.mjs'];
        console.log('\n🔍 Verifying bundle...');

        for (const file of criticalFiles) {
            const filePath = path.join(BUNDLE_DIR, file);
            if (!fs.existsSync(filePath)) {
                throw new Error(`Critical file missing: ${file}\nRun 'npm run build' first`);
            }
            const stats = fs.statSync(filePath);
            const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
            console.log(`  ✅ ${file} (${sizeMB} MB)`);
        }

        // Create bundle README
        const packageJson = await fs.readJSON('package.json');
        const wasmStats = fs.statSync(path.join(BUNDLE_DIR, 'sqlite3.wasm'));
        const wasmSizeMB = (wasmStats.size / 1024 / 1024).toFixed(2);

        const bundleReadme = `# LocalRetrieve Deployment Bundle

Generated: ${new Date().toISOString()}
Version: ${packageJson.version}

## Contents

This bundle contains everything needed to deploy LocalRetrieve in a web application:

### Core Files
- \`localretrieve.mjs\` - Main SDK entry point
- \`sqlite3.mjs\` - SQLite WASM loader
- \`sqlite3.wasm\` - SQLite WASM binary (${wasmSizeMB} MB)
- \`database/worker.js\` - Background worker implementation

### Supporting Files
- \`ProviderFactory-*.mjs\` - Embedding provider implementations
- \`CacheManager-*.mjs\` - Cache management
- \`rpc-*.mjs\` - RPC communication layer

## Deployment Instructions

### 1. Copy to Your Web App

\`\`\`bash
# Copy entire bundle to your static files directory
cp -r bundle/* /path/to/your/app/lib/localretrieve/
\`\`\`

### 2. Load in Your Application

\`\`\`javascript
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
\`\`\`

### 3. Required HTTP Headers

Your server must set these headers for WASM SharedArrayBuffer support:

\`\`\`
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
\`\`\`

If using Vite, the dev server plugin handles this automatically:

\`\`\`javascript
// vite.config.js
import { localRetrievePlugin } from './lib/localretrieve/vite-plugin.js';

export default {
  plugins: [localRetrievePlugin()]
}
\`\`\`

## Browser Support

- Chrome 86+
- Firefox 79+
- Safari 15+
- Edge 85+

Requires SharedArrayBuffer and OPFS support.

## Troubleshooting

### "SQLite WASM module not loaded"
- Verify \`sqlite3.wasm\` is in the same directory as \`sqlite3.mjs\`
- Check browser console for fetch errors
- Ensure COOP/COEP headers are set

### "Failed to load worker"
- Verify \`workerUrl\` path is correct
- Check that worker.js is accessible via HTTP
- Verify service worker is not blocking requests

### Database recreates on reload
- Ensure you're using \`opfs:/\` prefix for persistent storage
- Check that OPFS is supported in your browser
- Verify you're not calling \`initLocalRetrieve()\` multiple times

## More Information

- Full documentation: https://github.com/klabulan/browvec
- Issues: https://github.com/klabulan/browvec/issues
- Examples: https://github.com/klabulan/browvec/tree/main/examples
`;

        await fs.writeFile(path.join(BUNDLE_DIR, 'README.md'), bundleReadme);

        // Create file manifest
        const manifest = {
            generated: new Date().toISOString(),
            version: packageJson.version,
            files: []
        };

        const getAllFiles = async (dir, fileList = []) => {
            const files = await fs.readdir(dir);
            for (const file of files) {
                const filePath = path.join(dir, file);
                const stats = await fs.stat(filePath);
                if (stats.isDirectory()) {
                    await getAllFiles(filePath, fileList);
                } else {
                    const relativePath = path.relative(BUNDLE_DIR, filePath);
                    fileList.push({
                        name: relativePath.replace(/\\/g, '/'),
                        size: stats.size,
                        modified: stats.mtime
                    });
                }
            }
            return fileList;
        };

        manifest.files = await getAllFiles(BUNDLE_DIR);
        await fs.writeJSON(path.join(BUNDLE_DIR, 'manifest.json'), manifest, { spaces: 2 });

        const totalSize = manifest.files.reduce((sum, f) => sum + f.size, 0);

        console.log('\n✅ Bundle created successfully!');
        console.log(`📁 Location: ${path.resolve(BUNDLE_DIR)}`);
        console.log(`📊 Total files: ${manifest.files.length}`);
        console.log(`📦 Total size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
        console.log('\n📖 See bundle/README.md for deployment instructions');

    } catch (error) {
        console.error('\n❌ Bundle creation failed:', error.message);
        process.exit(1);
    }
}

createBundle();
