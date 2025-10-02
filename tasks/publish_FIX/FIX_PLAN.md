# LocalRetrieve Integration Fix Plan

**Date**: 2025-10-02
**Status**: Ready for Implementation
**Based on**: architecture.md analysis

---

## Executive Summary

This plan addresses the core issue identified in `architecture.md`: **WASM files are build artifacts not committed to git, causing incomplete npm installations from GitHub**.

**Strategy**: Hybrid approach
- **Immediate**: Improve LocalRetrieve package distribution (this repo)
- **Reference**: Provide integration guidance for downstream projects

---

## Current State Assessment

### ✅ What's Working
- Build system produces all required files:
  - `dist/sqlite3.wasm` (1.33 MB) ✓
  - `dist/database/worker.js` ✓
  - `dist/*.mjs` SDK files ✓
- WASM compilation with sqlite-vec extension ✓
- TypeScript build pipeline ✓

### ❌ What's Broken
- `npm install https://github.com/klabulan/browvec.git` doesn't include WASM files
- No verification that installation is complete
- No easy way to create deployment bundles
- Integration instructions incomplete

### 🎯 Root Cause
WASM files are in `.gitignore` as build artifacts, so GitHub-based npm installs get incomplete packages.

---

## Solution: Track B (Upstream Improvements)

Make LocalRetrieve a complete, self-contained npm package.

---

## Implementation Plan

### Phase 1: Include WASM in Distribution (Priority: CRITICAL)

**Objective**: Ensure WASM files are available in all installation scenarios

#### Option 1A: Commit WASM to Git (RECOMMENDED)
**Rationale**:
- WASM files are stable binary artifacts
- Size is reasonable (~1.3 MB for sqlite3.wasm)
- Precedent: sql.js and other similar packages do this
- Simplest solution

**Changes**:

1. **Update `.gitignore`**:
```diff
# Build outputs
dist/**/*.js.map
-dist/**/*.wasm
+# Keep WASM files - essential for npm installs from GitHub
+# dist/**/*.wasm

dist/**/*.d.ts
```

2. **Commit existing WASM**:
```bash
git add -f dist/sqlite3.wasm
git commit -m "build: Include WASM binaries for GitHub npm installs"
```

3. **Update build documentation** in README.md

**Pros**:
- ✅ Works immediately with GitHub npm installs
- ✅ No infrastructure changes needed
- ✅ Matches industry practice (sql.js, etc.)

**Cons**:
- ❌ Increases repo size (~1.3 MB per version)
- ❌ Binary files in git (but Git handles this well for files that don't change often)

---

#### Option 1B: Use Git LFS (ALTERNATIVE)
**If repo size is a concern**:

1. **Install Git LFS**:
```bash
git lfs install
```

2. **Track WASM files**:
```bash
git lfs track "dist/*.wasm"
git add .gitattributes
```

3. **Commit WASM**:
```bash
git add dist/sqlite3.wasm
git commit -m "build: Track WASM files with Git LFS"
```

**Pros**:
- ✅ Repo stays small
- ✅ WASM files available in installs

**Cons**:
- ❌ Requires Git LFS on all dev machines
- ❌ GitHub LFS bandwidth limits
- ❌ More complex setup

---

### Phase 2: Installation Verification (Priority: HIGH)

**Objective**: Fail fast with clear error messages if installation is incomplete

**Create**: `scripts/verify-install.js`

```javascript
#!/usr/bin/env node
/**
 * Verifies LocalRetrieve installation has all required files
 * Runs automatically via postinstall hook
 */

const fs = require('fs');
const path = require('path');

const REQUIRED_FILES = [
    'dist/localretrieve.mjs',
    'dist/sqlite3.mjs',
    'dist/sqlite3.wasm',
    'dist/database/worker.js'
];

console.log('🔍 Verifying LocalRetrieve installation...\n');

let missing = [];
let present = [];

for (const file of REQUIRED_FILES) {
    const filePath = path.join(__dirname, '..', file);
    const exists = fs.existsSync(filePath);

    if (exists) {
        const stats = fs.statSync(filePath);
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
        present.push(`  ✅ ${file} (${sizeMB} MB)`);
    } else {
        missing.push(`  ❌ ${file}`);
    }
}

if (present.length > 0) {
    console.log('Present:');
    present.forEach(msg => console.log(msg));
    console.log();
}

if (missing.length > 0) {
    console.error('❌ LocalRetrieve installation incomplete!\n');
    console.error('Missing required files:');
    missing.forEach(msg => console.error(msg));
    console.error('\n📋 To fix this:');
    console.error('  1. Clone the repository: git clone https://github.com/klabulan/browvec.git');
    console.error('  2. Build WASM: npm run build:wasm');
    console.error('  3. Build SDK: npm run build:sdk');
    console.error('\n💡 Or install from npm registry once published: npm install localretrieve');
    process.exit(1);
}

console.log('✅ LocalRetrieve installation verified successfully!\n');
```

**Update `package.json`**:
```json
{
  "scripts": {
    "postinstall": "node scripts/verify-install.js",
    "verify": "node scripts/verify-install.js"
  }
}
```

**Benefits**:
- Clear error messages when WASM missing
- Guides users to fix the issue
- Runs automatically after `npm install`

---

### Phase 3: Deployment Bundle Tool (Priority: MEDIUM)

**Objective**: Make it easy for integrators to get a complete deployment bundle

**Create**: `scripts/create-bundle.js`

```javascript
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
        const bundleReadme = `# LocalRetrieve Deployment Bundle

Generated: ${new Date().toISOString()}

## Contents

This bundle contains everything needed to deploy LocalRetrieve in a web application:

### Core Files
- \`localretrieve.mjs\` - Main SDK entry point
- \`sqlite3.mjs\` - SQLite WASM loader
- \`sqlite3.wasm\` - SQLite WASM binary (${(fs.statSync(path.join(BUNDLE_DIR, 'sqlite3.wasm')).size / 1024 / 1024).toFixed(2)} MB)
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
            version: require('../package.json').version,
            files: []
        };

        const files = await fs.readdir(BUNDLE_DIR);
        for (const file of files) {
            const filePath = path.join(BUNDLE_DIR, file);
            const stats = await fs.stat(filePath);
            if (stats.isFile()) {
                manifest.files.push({
                    name: file,
                    size: stats.size,
                    modified: stats.mtime
                });
            }
        }

        await fs.writeJSON(path.join(BUNDLE_DIR, 'manifest.json'), manifest, { spaces: 2 });

        console.log('\n✅ Bundle created successfully!');
        console.log(`📁 Location: ${path.resolve(BUNDLE_DIR)}`);
        console.log(`📊 Total files: ${manifest.files.length}`);
        console.log(`📦 Total size: ${(manifest.files.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024).toFixed(2)} MB`);
        console.log('\n📖 See bundle/README.md for deployment instructions');

    } catch (error) {
        console.error('\n❌ Bundle creation failed:', error.message);
        process.exit(1);
    }
}

createBundle();
```

**Update `package.json`**:
```json
{
  "scripts": {
    "bundle": "node scripts/create-bundle.js",
    "prebundle": "npm run build"
  },
  "devDependencies": {
    "fs-extra": "^11.1.1"
  }
}
```

**Benefits**:
- One command to create deployment bundle
- Includes comprehensive README
- Validates all files present
- Easy for integrators to use

---

### Phase 4: Documentation Updates (Priority: HIGH)

**Update `README.md`** with clear installation instructions:

```markdown
## Installation

### Option 1: From npm Registry (Recommended - when published)

\`\`\`bash
npm install localretrieve
\`\`\`

### Option 2: From GitHub (Requires Build)

\`\`\`bash
# Clone repository
git clone https://github.com/klabulan/browvec.git
cd browvec

# Install dependencies
npm install

# Build WASM and SDK
npm run build

# Verify installation
npm run verify
\`\`\`

### Option 3: Deployment Bundle

\`\`\`bash
# Build and create bundle
npm run bundle

# Copy to your project
cp -r bundle/* /path/to/your/app/lib/localretrieve/
\`\`\`

## Verification

After installation, verify all files are present:

\`\`\`bash
npm run verify
\`\`\`

You should see:
\`\`\`
✅ dist/localretrieve.mjs
✅ dist/sqlite3.mjs
✅ dist/sqlite3.wasm
✅ dist/database/worker.js
\`\`\`
```

---

## Implementation Checklist

### ⚡ Critical (Must Do First)

- [ ] **Phase 1**: Include WASM in distribution
  - [ ] Choose: Option 1A (commit to git) OR 1B (Git LFS)
  - [ ] Update `.gitignore`
  - [ ] Commit WASM files
  - [ ] Test GitHub npm install

- [ ] **Phase 2**: Add verification script
  - [ ] Create `scripts/verify-install.js`
  - [ ] Add `postinstall` hook
  - [ ] Test on clean install

### 🔧 Important (High Value)

- [ ] **Phase 3**: Bundle tool
  - [ ] Create `scripts/create-bundle.js`
  - [ ] Add `fs-extra` dependency
  - [ ] Test bundle creation
  - [ ] Validate bundle completeness

- [ ] **Phase 4**: Documentation
  - [ ] Update README installation section
  - [ ] Add troubleshooting guide
  - [ ] Document bundle workflow
  - [ ] Add integration examples

### 🚀 Nice to Have (Future)

- [ ] **CI/CD**: Add GitHub Actions
  - [ ] Build verification on PR
  - [ ] Auto-create releases with bundles
  - [ ] Publish to npm registry

- [ ] **Developer Experience**
  - [ ] Add `npm run dev:bundle` with watch mode
  - [ ] Create integration test suite
  - [ ] Add bundle size monitoring

---

## Testing Plan

### Test 1: GitHub npm Install
```bash
# Clean test
rm -rf /tmp/test-install
mkdir /tmp/test-install
cd /tmp/test-install
npm init -y
npm install https://github.com/klabulan/browvec.git

# Should succeed with all files present
ls -lh node_modules/localretrieve/dist/sqlite3.wasm
```

### Test 2: Verification Script
```bash
cd /tmp/test-install/node_modules/localretrieve
npm run verify

# Should output:
# ✅ LocalRetrieve installation verified successfully!
```

### Test 3: Bundle Creation
```bash
cd /path/to/browvec
npm run bundle

# Should create bundle/ with all files
ls -lh bundle/sqlite3.wasm
cat bundle/README.md
```

### Test 4: Bundle Integration
```bash
# Copy bundle to test app
cp -r bundle/* /tmp/test-app/lib/localretrieve/

# Load in browser and verify initialization succeeds
```

---

## Migration Path for Integrators

### For Existing Projects Using Manual Copy

**Before** (current manual process):
```bash
# Copy files manually from browvec/dist
cp browvec/dist/*.mjs my-app/lib/localretrieve/
cp browvec/dist/sqlite3.wasm my-app/lib/localretrieve/
cp browvec/dist/database/worker.js my-app/lib/localretrieve/database/
```

**After** (with bundle tool):
```bash
# In browvec repo
npm run bundle

# Copy entire bundle
cp -r browvec/bundle/* my-app/lib/localretrieve/
```

### For New Projects

**Option A: npm install + bundle**
```bash
npm install https://github.com/klabulan/browvec.git
cd node_modules/localretrieve
npm run bundle
cp -r bundle/* ../../public/lib/localretrieve/
```

**Option B: Direct bundle download** (after GitHub releases implemented)
```bash
curl -L https://github.com/klabulan/browvec/releases/latest/download/bundle.tar.gz | tar xz
mv bundle/* public/lib/localretrieve/
```

---

## Success Criteria

1. ✅ `npm install https://github.com/klabulan/browvec.git` includes WASM files
2. ✅ `npm run verify` confirms installation completeness
3. ✅ `npm run bundle` creates deployment-ready package
4. ✅ Bundle README provides clear integration instructions
5. ✅ No manual file copying required for integrators
6. ✅ Clear error messages when setup incomplete

---

## Timeline Estimate

| Phase | Effort | Duration |
|-------|--------|----------|
| Phase 1: WASM in git | 30 min | Same day |
| Phase 2: Verification | 1 hour | Same day |
| Phase 3: Bundle tool | 2 hours | Same day |
| Phase 4: Documentation | 1 hour | Same day |
| **Total** | **~5 hours** | **1 day** |

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Git repo size increases | Low | WASM is only 1.3MB, changes infrequently |
| Git LFS complexity | Medium | Document setup clearly, OR use Option 1A instead |
| Breaking changes for integrators | Low | Changes are additive, existing workflows still work |
| npm publish issues | Low | Test with `npm pack` first |

---

## Decision: Recommended Approach

**Recommendation**: **Option 1A (Commit WASM to git)**

**Rationale**:
1. ✅ Simplest for developers (no Git LFS setup)
2. ✅ Works with GitHub npm installs immediately
3. ✅ Industry standard (sql.js, other WASM packages do this)
4. ✅ 1.3 MB is acceptable for modern repos
5. ✅ WASM changes infrequently (stable builds)

**Next Steps**:
1. Get approval for approach
2. Implement Phase 1 (WASM in git)
3. Implement Phase 2 (verification)
4. Test with clean install
5. Implement Phase 3-4 if approved

---

## Appendix: Integration Reference

For downstream projects (like R7 Copilot), see `INTEGRATION_GUIDE.md` (to be created) for:
- Service worker setup patterns
- OPFS path handling
- Multi-tab coordination
- Error handling best practices

---

**Status**: ✅ Ready for review and approval
**Next**: Create verification script and test WASM commit approach
