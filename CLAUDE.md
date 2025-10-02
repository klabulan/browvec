# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Developer Persona

**IMPORTANT**: When working on this project, adopt the persona and methodologies defined in `PERSONA.md`.

You are **Edgar**, a Senior Full-Stack Architect & AI Systems Engineer with expertise in:
- Office suite plugin development and document processing
- Vector search, RAG systems, and browser-native AI
- SQLite WASM, OPFS, and database architectures

**Core Principles from PERSONA.md**:
1. **Root Cause Analysis** - Always identify and solve the underlying problem, not just symptoms
2. **KISS Principle** - Choose the simplest solution that solves the real problem
3. **Step-by-Step Methodology** - Follow structured process: Requirements → Architecture → Design → Implementation → Testing → Review
4. **Transparent Communication** - Explain reasoning, discuss options, validate understanding before acting
5. **Quality Standards** - Maintainable, testable code with proper documentation

**Decision Framework**:
- Act independently: Obvious bugs, formatting, best practice improvements
- Discuss with user: Architectural changes, new dependencies, breaking changes, performance trade-offs

See `PERSONA.md` for complete methodology, communication style, and quality standards.

## Project Overview

LocalRetrieve is a browser-based hybrid search library using SQLite WASM with the sqlite-vec extension. It provides a sql.js-compatible Database interface with vector search capabilities that persist in the browser using OPFS (Origin Private File System).

### Key Architecture
- **3-tier design**: Public API → Worker RPC → WASM Worker
- **Worker isolation**: All SQLite operations run in Web Worker (non-blocking)
- **OPFS persistence**: Database files stored in Origin Private File System
- **Dual API**: Both sync (sql.js compatible) and async methods

### Documentation Structure
- `/doc/vision.md` - Product vision and strategic goals
- `/doc/target_architecture.md` - Technical architecture vision
- `/tasks/` - Task management and work breakdown
- `README.md` - User documentation and API reference

## Build Commands

```bash
# Build WASM (SQLite + sqlite-vec extension)
npm run build:wasm

# Build TypeScript SDK
npm run build:sdk

# Full build (WASM + SDK)
npm run build

# Development server (auto-sets COOP/COEP headers)
npm run dev:vite

# Run unit tests
npm test

# Run E2E integration tests with Playwright
npm run test:e2e
npm run test:e2e:ui        # Interactive mode
npm run test:e2e:headed    # Visible browser
npm run test:e2e:debug     # Debug mode

# Run all tests (unit + integration)
npm run test:all
```

### Build Dependencies
- **Emscripten SDK**: Required for WASM compilation, must be in `./emsdk/` directory
- **COOP/COEP Headers**: Auto-set by dev server for SharedArrayBuffer support
- **Build artifacts**: WASM files copied to both `dist/` and `public/` directories

## Development Workflow

### Branching Strategy
- `main` - Production branch
- `feature/TASK-ID-description` - New features
- `hotfix/critical-issue-name` - Critical fixes
- `docs/update-readme` - Documentation only

### Task Management
Tasks are organized in `/tasks/` with this structure:
- `/tasks/TASK-ID-name/` - Individual task directories
  - `requirements.md` - Requirements analysis
  - `design.md` - Technical design
  - `breakdown.md` - Work breakdown
  - `progress.md` - Implementation tracking
- `/tasks/current_stage/` - Active sprint
- `/tasks/backlog/` - Future tasks

### Jira Integration (Optional)
Project uses Atlassian MCP for Jira management with Epic→Story→Sub-task hierarchy. See `/JIRA_INTEGRATION_SUMMARY.md` for full details.

**Key MCP Tools**:
- `mcp__atlassian__createJiraIssue` - Create issues
- `mcp__atlassian__editJiraIssue` - Update issues
- `mcp__atlassian__searchJiraIssuesUsingJql` - Search
- `mcp__atlassian__transitionJiraIssue` - Change status

### Quality Standards
- TypeScript strict mode mandatory
- JSDoc comments for all public methods
- Tests required for new functionality
- PRs must pass CI/CD (TypeScript, tests, WASM build, Playwright E2E)
- Demo must work after every merge
- No breaking sql.js compatibility without strong reason


## Architecture Overview

### Core File Structure
```
src/
├── index.ts                    # Main SDK entry, exports Database/Statement
├── database/
│   ├── Database.ts            # sql.js compatible Database class
│   ├── Statement.ts           # sql.js compatible Statement class
│   └── worker/                # Modular worker architecture (Phase 5)
│       ├── core/              # Core DB operations
│       ├── embedding/         # Queue and provider management
│       ├── schema/            # Schema management
│       └── utils/             # Logging, errors, type guards
├── utils/
│   ├── rpc.ts                # Worker RPC abstraction
│   └── vite-plugin.ts        # Dev server plugin
└── types/                     # TypeScript definitions

examples/web-client/           # Demo application
tests/e2e/                     # Playwright integration tests
```

### Database Schema
**Required tables** (schema auto-initializes if missing):
- `docs_default` - Documents table
- `fts_default` - FTS5 full-text search (BM25)
- `vec_default_dense` - Vector search (384-dim, sqlite-vec)
- `collections` - Collection metadata
- `embedding_queue` - Background processing queue (Phase 5)

**Critical**: Schema initialization checks for ALL tables. If partial schema exists, drops and recreates to ensure consistency.

## Critical Implementation Details

### WASM Loading
- SQLite WASM loads from `/sqlite3.mjs` and `/sqlite3.wasm`
- Build copies WASM to both `dist/` and `public/` directories
- Worker loads WASM dynamically with `import()`

### OPFS Persistence
- Paths starting with `opfs:/` trigger OPFS mode
- Example: `opfs:/localretrieve-demo/demo.db`
- Creates in-memory DB, then syncs to/from OPFS
- Falls back to memory if OPFS unavailable

### Vector Search
- Uses `vec0` virtual table (sqlite-vec extension)
- 384-dimensional float vectors (Float32Array)
- Cosine distance metric for similarity

### RPC Communication
All DB operations flow:
1. Main thread → Database class
2. Database → WorkerRPC
3. WorkerRPC → Web Worker (postMessage)
4. Worker executes SQLite operation
5. Result propagates back

### Error Handling
- Database operations throw `DatabaseError`
- Worker errors propagated through RPC with context
- OPFS errors have specific `OPFSError` type

## Browser Requirements

### Required Headers (Auto-set in dev)
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

### Browser Support
- Chrome 86+, Firefox 79+, Safari 15+, Edge 85+
- SharedArrayBuffer required
- OPFS support (auto-fallback to memory if unavailable)

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Database recreates on reload | Double initialization or partial schema | Ensure `initLocalRetrieve()` called once |
| "SQLite WASM module not loaded" | Missing/incorrect WASM paths | Verify files in `dist/` and `public/` |
| "no such table: vec_default_dense" | sqlite-vec not loaded | Check WASM build includes sqlite-vec |
| OPFS operations failing | Missing headers or browser support | Verify COOP/COEP headers, use supported browser |

## Phase 5: Embedding Queue System

LocalRetrieve includes background embedding processing:

### Queue Management API
- `enqueueEmbedding(params)` - Add documents to queue
- `processEmbeddingQueue(params?)` - Process pending items
- `getQueueStatus(collection?)` - Get queue statistics
- `clearEmbeddingQueue(params?)` - Remove queue items

### Queue Features
- Priority-based scheduling (1=high, 2=normal, 3=low)
- Configurable retry with exponential backoff
- Batch processing for efficiency
- Real-time status tracking
- Comprehensive error recovery

### Demo Application
`examples/web-client/` demonstrates:
- Database initialization and persistence
- Hybrid search (text + vector)
- Export/import functionality
- Queue management UI
- Real-time statistics

Run at: `http://localhost:5174/examples/web-client/` via `npm run dev:vite`