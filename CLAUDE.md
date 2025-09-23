# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LocalRetrieve is a browser-based hybrid search library using SQLite WASM with the sqlite-vec extension. It provides sql.js compatible Database interface with vector search capabilities that persist in the browser using OPFS (Origin Private File System).

## Build Commands

### Essential Build Commands
```bash
# Build WASM files (SQLite + sqlite-vec extension)
npm run build:wasm

# Build TypeScript SDK
npm run build:sdk

# Full build (WASM + SDK)
npm run build

# Development server
npm run dev:vite

# Run tests
npm test

# Run environment tests only
npm test:env
```

### Critical Build Dependencies
- **Emscripten**: Required for WASM compilation. Must be cloned to `./emsdk/` directory
- **COOP/COEP Headers**: Development server automatically sets required headers for SharedArrayBuffer
- **Build artifacts**: WASM files go to both `dist/` and `public/` directories

## Architecture Overview

### Core Components Architecture

**Database Layer (3-tier)**:
1. **Public API** (`src/index.ts`, `src/database/Database.ts`) - sql.js compatible interface
2. **Worker RPC** (`src/utils/rpc.ts`) - Web Worker communication layer
3. **WASM Worker** (`src/database/worker.ts`) - SQLite operations in Web Worker

**Key Design Patterns**:
- **Worker Isolation**: All SQLite operations run in Web Worker to avoid blocking main thread
- **RPC Communication**: Structured message passing between main thread and worker
- **OPFS Persistence**: Database files stored in Origin Private File System for persistence
- **Dual API**: Both sync (sql.js compatible) and async methods available

### Database Schema Requirements

The system expects these specific tables to exist:
- `docs_default` - Base documents table
- `fts_default` - FTS5 full-text search virtual table
- `vec_default_dense` - Vector search virtual table (384-dimensional)
- `collections` - Metadata table

**Critical**: Schema initialization checks for ALL 4 tables. If partial schema exists, it drops and recreates all tables to ensure consistency.

### File Structure Significance

```
src/
├── index.ts              # Main SDK entry point, exports Database/Statement classes
├── database/
│   ├── Database.ts       # sql.js compatible Database class
│   ├── Statement.ts      # sql.js compatible Statement class
│   └── worker.ts         # Web Worker with actual SQLite operations
├── utils/
│   ├── rpc.ts           # Worker RPC abstraction layer
│   └── vite-plugin.ts   # Vite plugin for development
└── types/               # TypeScript definitions for all interfaces

examples/web-client/     # Complete demo application
├── demo.js             # Main demo application logic
├── index.html          # Demo UI
└── test-data.js        # Sample documents with mock vectors
```

## Critical Implementation Details

### WASM Loading Strategy
- SQLite WASM loads from `/sqlite3.mjs` and `/sqlite3.wasm` URLs
- Build process copies WASM files to both `dist/` and `public/` directories
- Worker loads WASM module dynamically using `import()` with URL resolution

### OPFS Database Persistence
- Database paths starting with `opfs:/` trigger OPFS persistence mode
- System creates temporary in-memory database, then syncs to/from OPFS
- Default demo path: `opfs:/localretrieve-demo/demo.db`

### Schema Initialization Logic
The schema initialization (`handleInitializeSchema` in `worker.ts`) has specific logic:
1. Checks for existence of ALL required tables (docs_default, fts_default, vec_default_dense, collections)
2. Only skips initialization if all 4 tables exist
3. If partial schema detected, drops existing tables and recreates from scratch
4. This prevents corruption from incomplete previous sessions

### Vector Table Configuration
- Uses `vec0` virtual table type from sqlite-vec extension
- Fixed 384-dimensional float vectors
- Expects Float32Array input format
- Cosine distance metric for similarity search

## Development Patterns

### Error Handling Pattern
- Database operations throw `DatabaseError` with descriptive messages
- Worker errors are propagated through RPC layer with context
- OPFS errors have specific `OPFSError` type for storage issues

### RPC Communication Pattern
All database operations follow this pattern:
1. Main thread calls method on Database class
2. Database class forwards to WorkerRPC
3. WorkerRPC sends message to worker
4. Worker executes SQLite operation
5. Result propagated back through same chain

### Testing Strategy
- Environment tests verify browser capabilities (SharedArrayBuffer, OPFS)
- Demo application serves as integration test
- WASM build verification through actual SQLite operations

## Development Server Requirements

**Critical Headers Required**:
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

These headers are automatically set by the Vite dev server and are required for SharedArrayBuffer support.

**Browser Compatibility**:
- Chrome 86+, Firefox 79+, Safari 15+ (for OPFS support)
- SharedArrayBuffer must be available
- ES modules support required

## Common Issues & Solutions

### Database Persistence Issues
- **Problem**: Database recreates on each page load
- **Cause**: Schema initialization runs twice or incomplete table creation
- **Solution**: Ensure `initLocalRetrieve()` handles schema properly, avoid double initialization

### WASM Loading Failures
- **Problem**: "SQLite WASM module not loaded"
- **Cause**: Incorrect WASM file paths or missing files
- **Solution**: Verify WASM files in both `dist/` and `public/`, check URL resolution in worker

### Vector Table Errors
- **Problem**: "no such table: vec_default_dense"
- **Cause**: sqlite-vec extension not loaded or table creation failed
- **Solution**: Verify WASM build includes sqlite-vec, check extension loading in worker initialization

### OPFS Access Errors
- **Problem**: OPFS operations failing
- **Cause**: Missing browser support or incorrect headers
- **Solution**: Verify COOP/COEP headers, test in supported browser, fallback to memory database

## Demo Application Notes

The `examples/web-client/` demo provides a complete reference implementation:
- Proper database initialization sequence
- Hybrid search UI with both text and vector inputs
- Import/export functionality (partial implementation)
- Real-time database statistics
- Sample data with 384-dimensional mock vectors

The demo expects to run at `http://localhost:5174/examples/web-client/index.html` when using `npm run dev:vite`.