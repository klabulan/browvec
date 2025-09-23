# **ACTUAL IMPLEMENTATION STATUS**

## **GOAL vs REALITY**

**TARGET**: A single WASM package with OPFS persistence and sql.js compatibility
**ACHIEVED**: ✅ WASM + sql.js compatibility | ❌ OPFS persistence disabled

### **What's Working (60% Complete)**

* ✅ **SQLite WASM** (with `FTS5`, `JSON1`, `RTREE`, math functions) - 2.1MB build
* ✅ **sqlite‑vec** (vector index / ANN for hybrid search) - manual initialization working
* ✅ **sql.js‑compatible wrapper** - complete Database/Statement API (900+ lines)
* ✅ **TypeScript** typings - comprehensive type definitions
* ✅ **Hybrid Search** - production-ready FTS5 + vec0 fusion

### **Critical Issues (40% Missing)**

* ❌ **OPFS VFS DISABLED** - Line 156 in worker.ts: `opfs:/` → `:memory:`
* ❌ **NO DATA PERSISTENCE** - All data lost on page refresh
* ❌ **Export/Import Broken** - Returns placeholder strings only
* ❌ **Missing Demo** - No working end-to-end example

**Architecture**: Web Worker + SQLite C API (not `sqlite3.oo1.DB` as planned)

---

## Prerequisites

* **Node.js** 18+
* **Emscripten SDK** (emsdk) ≥ 3.1.56 (or recent stable)
* A **dev server with COOP/COEP** headers (for SharedArrayBuffer performance); see *Hosting* below.

### Reference URLs (read once)

* SQLite Wasm docs: [https://sqlite.org/wasm/doc/trunk/index.md](https://sqlite.org/wasm/doc/trunk/index.md)
* SQLite source tree (Wasm build lives under `ext/wasm/`): [https://github.com/sqlite/sqlite](https://github.com/sqlite/sqlite)
* sqlite‑vec: [https://github.com/asg017/sqlite-vec](https://github.com/asg017/sqlite-vec)
* OPFS explainer: [https://web.dev/articles/origin-private-file-system](https://web.dev/articles/origin-private-file-system)

---

# **CURRENT IMPLEMENTATION ANALYSIS**

### **Actual Architecture Choices**

* ❌ **OPFS VFS** - Built and available but deliberately disabled in code
* ❌ **`sqlite3.oo1.DB`** - Not used; implemented direct SQLite C API integration
* ✅ **Web Worker** - Implemented with comprehensive RPC system
* ❌ **Durable files** - `opfs:/app/db.sqlite` converted to `:memory:` databases

### **Why OPFS Was Disabled**
**Evidence**: Line 156 in `src/database/worker.ts`:
```typescript
// For now, let's use in-memory database to avoid OPFS issues
const actualFilename = filename.startsWith('opfs:/') ? ':memory:' : filename;
```
**Impact**: Complete loss of data persistence - critical production blocker

## **CURRENT BUILD SYSTEM** ✅ WORKING

**Actual Implementation** (differs from original plan):

```bash
# 1) Emscripten SDK included in project
# emsdk/ directory contains complete SDK
# Auto-setup in build script

# 2) Build workspace is .build/ (not ~/sqlite-wasm-vec)
ls .build/
# sqlite/          # SQLite source
# sqlite-vec/      # sqlite-vec source

# 3) Automated build script
./scripts/build-wasm.sh    # ✅ Complete automated build
./scripts/dev-server.sh    # ✅ Development server with COOP/COEP
```

**Build Output**:
```
dist/
├── sqlite3.wasm          # ✅ 2.1MB WASM module
├── sqlite3.mjs           # ✅ ESM loader
├── database/             # ✅ Compiled TypeScript
└── types/                # ✅ Type declarations
```
git clone --depth 1 https://github.com/sqlite/sqlite.git
# sqlite-vec
git clone --depth 1 https://github.com/asg017/sqlite-vec.git
```

> We’ll build from `sqlite/ext/wasm` using its Makefile and add `sqlite-vec` as extra C sources.

## A2) Register sqlite‑vec as a built‑in extension (official method)

The **official SQLite WASM** build supports compile‑time extensions via a special file named `ext/wasm/sqlite_wasm_extra_init.c`. If this file exists, it is compiled automatically and invoked during initialization. Use it to **include** `sqlite-vec` and **auto‑register** it.

**`ext/wasm/sqlite_wasm_extra_init.c`**

```c
// Compile-time registration of sqlite-vec for SQLite WASM
// See: "Adding Client-custom Init Code" in sqlite.org/wasm docs
#include "sqlite3.h"

// Pull the extension code into this compilation unit
#include "../../.build/sqlite-vec/sqlite-vec.c"

extern int sqlite3_vec_init(sqlite3*, char**, const sqlite3_api_routines*);

// Custom function to manually initialize vec extension on a database
int sqlite3_vec_init_manual(sqlite3* db) {
  return sqlite3_vec_init(db, NULL, NULL);
}

int sqlite3_wasm_extra_init(const char *z){
  // For WASM builds, register as auto-extension
  sqlite3_auto_extension((void(*)(void))sqlite3_vec_init);
  return 0; // 0 => success
}
```

**Important Note**: In practice, manual initialization works more reliably. After opening a database connection, call:
```javascript
// After opening database, manually initialize vec extension
const initResult = sqlite3Module._sqlite3_vec_init_manual(dbPointer);
if (initResult === 0) {
  console.log('sqlite-vec extension initialized successfully');
}
```

> Rationale: the WASM build cannot `load_extension()` at runtime, so extensions must be compiled in. This hook is the documented way to do it. After this, `CREATE VIRTUAL TABLE ... USING vec0(...)` will work in the browser build.

## A3) Build with OPFS, FTS5/JSON1, and sqlite‑vec

From `sqlite/ext/wasm`:

```bash
cd sqlite/ext/wasm

# Clean previous outputs
make clean || true

# Feature flags (speed-focused build; use -Oz for smallest size)
export CFLAGS="\
  -DSQLITE_ENABLE_FTS5 \
  -DSQLITE_ENABLE_RTREE \
  -DSQLITE_ENABLE_JSON1 \
  -DSQLITE_ENABLE_MATH_FUNCTIONS \
  -DSQLITE_OMIT_LOAD_EXTENSION \
  -O2"

# Build with OPFS VFS; sqlite_wasm_extra_init.c is auto-picked up
make sqlite3.wasm ENABLE_VFS_OPFS=1 OPTS="$CFLAGS" EXT_CFLAGS="$CFLAGS"

# Outputs:
#   ./sqlite3.wasm
#   ./sqlite3.mjs              (ESM loader)
#   ./sqlite3-opfs-async-proxy.js (worker helper)
```

> The SQLite docs note `-O2` tends to be fastest while `-Oz` is \~10% slower but smaller. Pick per your goals.

> If your `make` reports unknown vars, update SQLite to a newer tag (the `ext/wasm` scaffolding evolves). As a fallback, see **A3′ Direct emcc** below.

### A3′) (Fallback) Direct `emcc` build without Makefile

If you can’t use the Makefile, compile the amalgamation + OPFS VFS + your `sqlite_wasm_extra_init.c` directly. Example (paths adjusted):

```bash
cd sqlite
# Ensure sqlite3.c exists (e.g., run src/tool/mksqlite3c.tcl)

emcc \
  -I. -Isrc -Iext/wasm \
  sqlite3.c ext/wasm/api/sqlite3-wasm.c ext/wasm/api/sqlite3-opfs.c \
  ext/wasm/sqlite_wasm_extra_init.c \
  -o dist/sqlite3-vec.mjs \
  -sENVIRONMENT=web \
  -sMODULARIZE=1 -sEXPORT_ES6=1 \
  -sALLOW_MEMORY_GROWTH=1 \
  -sWASM_BIGINT \
  -sSINGLE_FILE=0 \
  -sEXPORTED_RUNTIME_METHODS=ccall,cwrap,FS \
  -sEXPORT_NAME=createSQLite3Module \
  -O2 \
  -DSQLITE_ENABLE_FTS5 -DSQLITE_ENABLE_RTREE -DSQLITE_ENABLE_JSON1 \
  -DSQLITE_ENABLE_MATH_FUNCTIONS -DSQLITE_OMIT_LOAD_EXTENSION
# Produces dist/sqlite3-vec.mjs + dist/sqlite3-vec.wasm
```

> The official Makefile bakes in worker helpers and OPFS plumbing; prefer it when possible.

## A4) Add a sql.js‑compatible wrapper (TypeScript)

The official build exposes `sqlite3` with `sqlite3.oo1.DB` (OO API) and/or a **Worker Promiser**. Below is a lightweight compatibility layer exposing **`new SQL.Database(buffer?)`** + familiar methods. It stores durable data in **OPFS** when you pass a path like `opfs:/app/app.db`.

**`src/sqljs-compat.ts`**

```ts
// Minimal sql.js compatibility wrapper over sqlite3.oo1.DB
// Assumes you built/bundled sqlite3.mjs (+ wasm) into your app.

import initSQLite, { type SQLite3 } from "./sqlite3-bundler-friendly.mjs";

export type SQLValue = number | string | Uint8Array | null;
export interface ExecOptions { sql: string; bind?: Record<string, SQLValue> | SQLValue[] }

export class Statement {
  constructor(private stmt: any) {}
  bind(params?: Record<string, SQLValue> | SQLValue[]) { this.stmt.bind(params ?? {}); return this; }
  step(): boolean { return this.stmt.step(); }
  getAsObject(): Record<string, unknown> { return this.stmt.get(Object); }
  free() { this.stmt.finalize(); }
}

export class Database {
  private sqlite3!: SQLite3;
  private db!: any; // sqlite3.oo1.DB

  // If filename starts with "opfs:/", DB is durable. Otherwise in-memory.
  constructor(buffer?: Uint8Array, private filename = ":memory:") {}

  static async create(buffer?: Uint8Array, filename = "opfs:/app/app.db") {
    const sqlite3 = await initSQLite({ locateFile: (f: string) => new URL(f, import.meta.url).toString() });
    const db = new Database(buffer, filename);
    db.sqlite3 = sqlite3;
    db.open();
    if (buffer && db.filename !== ":memory:") db.deserialize(buffer);
    return db;
  }

  private open() {
    // For OPFS: use 'ct' flags (create if missing, read/write, truncate optional)
    this.db = new this.sqlite3.oo1.DB(this.filename);
  }

  exec(sql: string | ExecOptions, params?: Record<string, SQLValue> | SQLValue[]) {
    if (typeof sql === "string") this.db.exec(sql);
    else this.db.exec(sql);
    return this; // mimic sql.js chainability
  }

  run(sql: string, params?: Record<string, SQLValue> | SQLValue[]) {
    this.db.exec({ sql, bind: params ?? [] });
    return this;
  }

  prepare(sql: string) { return new Statement(this.db.prepare(sql)); }

  export(): Uint8Array { return this.db.serialize(); }
  deserialize(buf: Uint8Array) { return this.db.deserialize(buf); }

  close() { this.db.close(); }
}
```

> This minimal layer maps the common sql.js flow. If you rely on advanced sql.js features (`create_function`, `register_extension`, etc.), extend the wrapper accordingly using `sqlite3.oo1` or the C‑API bridges.

### Types (d.ts)

**`src/sqljs-compat.d.ts`**

```ts
export type SQLValue = number | string | Uint8Array | null;
export interface ExecOptions { sql: string; bind?: Record<string, SQLValue> | SQLValue[] }
export class Statement {
  constructor(stmt: any);
  bind(params?: Record<string, SQLValue> | SQLValue[]): this;
  step(): boolean;
  getAsObject(): Record<string, unknown>;
  free(): void;
}
export class Database {
  constructor(buffer?: Uint8Array, filename?: string);
  static create(buffer?: Uint8Array, filename?: string): Promise<Database>;
  exec(sql: string | ExecOptions, params?: Record<string, SQLValue> | SQLValue[]): this;
  run(sql: string, params?: Record<string, SQLValue> | SQLValue[]): this;
  prepare(sql: string): Statement;
  export(): Uint8Array;
  deserialize(buf: Uint8Array): void;
  close(): void;
}
```

## A5) VFS selection: `opfs` vs `opfs-sahpool`

* **`opfs` VFS** (default in this guide): requires **COOP/COEP** (SharedArrayBuffer) but offers transparent file naming and better concurrency semantics. Use when you control headers.

  * For contention, you can enable `unlock-asap` (may cost performance):

    ```ts
    const db = new sqlite3.oo1.OpfsDb('file:app.db?vfs=opfs&opfs-unlock-asap=1');
    ```
* **`opfs-sahpool` VFS**: does **not** require COOP/COEP and is often the fastest raw I/O path, but **no transparent multi-connection concurrency** and it manages its own filename mapping.

  ```ts
  const poolUtil = await sqlite3.installOpfsSAHPoolVfs();
  const db = new poolUtil.OpfsSAHPoolDb('/app/app.db'); // absolute path
  // (3.50+) cooperative concurrency helpers:
  // await poolUtil.pauseVfs();
  // await poolUtil.unpauseVfs();
  ```

## A6) Web Worker with OPFS

It’s best practice to run the DB in a **Worker**. Use the official bundle’s worker helper or a simple custom worker that instantiates the module and uses the wrapper above.

**`src/db.worker.ts`**

```ts
import { Database } from "./sqljs-compat";

let db: Database | null = null;

self.onmessage = async (ev: MessageEvent) => {
  const [cmd, payload] = ev.data as [string, any];
  switch (cmd) {
    case "open": {
      db = await Database.create(undefined, payload?.filename ?? "opfs:/app/app.db");
      self.postMessage(["open.ok", null]);
      break;
    }
    case "exec": {
      try { db!.exec(payload.sql); self.postMessage(["exec.ok", null]); }
      catch (e: any) { self.postMessage(["exec.err", String(e?.message || e)]); }
      break;
    }
    case "select": {
      try {
        const rows: any[] = [];
        const stmt = db!.prepare(payload.sql);
        while (stmt.step()) rows.push(stmt.getAsObject());
        stmt.free();
        self.postMessage(["select.ok", rows]);
      } catch (e: any) { self.postMessage(["select.err", String(e?.message || e)]); }
      break;
    }
    case "export": {
      const buf = db!.export();
      self.postMessage(["export.ok", buf], [buf.buffer]);
      break;
    }
    case "close": {
      db?.close(); db = null; self.postMessage(["close.ok", null]);
      break;
    }
  }
};
```

**Main thread usage**

```ts
const w = new Worker(new URL("./db.worker.ts", import.meta.url), { type: "module" });
const call = (cmd: string, payload?: any) => new Promise((resolve, reject) => {
  const onmsg = (ev: MessageEvent) => {
    const [type, data] = ev.data;
    if (type === `${cmd}.ok`) { w.removeEventListener("message", onmsg); resolve(data); }
    else if (type === `${cmd}.err`) { w.removeEventListener("message", onmsg); reject(new Error(data)); }
  };
  w.addEventListener("message", onmsg);
  w.postMessage([cmd, payload]);
});

await call("open", { filename: "opfs:/app/app.db" });
await call("exec", { sql: "CREATE TABLE IF NOT EXISTS kv(k TEXT PRIMARY KEY, v TEXT)" });
```

## MVP architecture & extension points

* **Scope (MVP)**: one DB Worker; durable OPFS file; **one text table (`docs`)** and **one vector table (`vec`)**. No embedder/reranker workers yet.
* **Forward‑compat hooks**: keep SQL and file paths generic (no hard‑coded collection names); reserve a `meta` table for future collection/vector registry; accept optional `search()` parameters like `rerank` but **ignore** them in MVP.
* **Query pattern (MVP)**: SQL‑only or SQL‑fused hybrid (FTS5 + vec0) using the example below; post‑processing limited to lightweight snippet/highlighting in UI.

> This keeps the MVP simple while staying congruent with the goal architecture (providers, collections, rerank) to be added later.

## A7) Hybrid search (FTS5 + sqlite‑vec) — example

```sql
-- Text index
CREATE VIRTUAL TABLE IF NOT EXISTS docs USING fts5(
  id UNINDEXED,
  content,
  tokenize = "unicode61 remove_diacritics 2"
);

-- Vector index
CREATE VIRTUAL TABLE IF NOT EXISTS vec USING vec0(
  rowid INTEGER PRIMARY KEY,       -- implicit integer key
  embedding float[384]
);

-- Seed example
INSERT INTO docs(rowid, id, content) VALUES(1, 1, 'hello hybrid search');
INSERT INTO vec(rowid, embedding) VALUES(1, vec_f32(?));  -- bind Float32Array or JSON array

-- KNN over vec0 returns a synthetic column `distance` (smaller = closer)
WITH q AS (
  SELECT vec_f32(?) AS q
)
SELECT d.id,
       d.content,
       1.0/(1.0 + bm25(d))                               AS fts_score,
       1.0/(1.0 + (SELECT distance))                     AS vec_score,
       (0.6*1.0/(1.0 + bm25(d)) + 0.4*1.0/(1.0 + (SELECT distance))) AS hybrid
FROM (
  SELECT rowid, distance
  FROM vec, q
  WHERE embedding MATCH q AND k = 10
) v
JOIN docs d ON d.rowid = v.rowid
WHERE d MATCH ?
ORDER BY hybrid DESC
LIMIT 10;
```

## A8) Packaging, bundling, and hosting

### Bundler (Vite / Webpack)

* Place `sqlite3.mjs`, `sqlite3.wasm`, and any helper JS files in your src and **import via URL** so bundler emits them to `dist`.
* Pass a `locateFile` callback in `initSQLite` so the loader can find `sqlite3.wasm` at runtime.
* Mark worker files with `{ type: 'module' }`.

### Hosting (SharedArrayBuffer ready)

Enable cross‑origin isolation to unlock faster paths. Set these **HTTP headers**:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Serve over **HTTPS**. For local Vite:

**`vite.config.ts`** (snippet)

```ts
export default defineConfig({
  server: {
    https: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    }
  }
});
```

> Without COOP/COEP it still works, but some OPFS optimizations and SAB‑based APIs may be slower.

## A9) Test checklist

1. **Module exports**: log keys from the initialized `sqlite3` object; confirm `oo1` is present and OPFS works (`new DB('opfs:/test.db')`).
2. **Durability**: write → reload page → open same `opfs:/...` path → row is present.
3. **Vector ops**: `CREATE VIRTUAL TABLE ... vec0(...)` works; `distance()` returns a number.
4. **Hybrid**: FTS5 + vec query returns expected order.

## A10) Troubleshooting

* *“No such VFS: opfs”*: rebuild with `ENABLE_VFS_OPFS=1` (or include `sqlite3-opfs.c`).
* *“attempt to write a readonly database”*: you opened a readonly handle; re‑open without `immutable` flags.
* *Crashes on mobile Safari*: ensure HTTPS + COOP/COEP; update Emscripten and SQLite to recent versions.
* *Vector functions missing*: confirm `vec0` table creation succeeds; ensure `vec.c` compiled in; log `PRAGMA compile_options;`.

---

---

## Web best practices (from field usage)

* **Use a dedicated Worker** with OPFS `SyncAccessHandle` for writes; keep the DB open for the app lifetime.
* Enable **cross‑origin isolation** (COOP/COEP) for SharedArrayBuffer paths; fall back gracefully if not available.
* Prefer **`opfs:/...` URIs** and use `delete-before-open=1` when you need a clean reset.
* Handle **multi‑tab**: either gate writes with a simple heartbeat/lock in OPFS metadata or route all DB access through a single shared endpoint (SharedWorker or service‑worker message channel). Read‑only connections are usually safe when no transaction is held.
* After any bulk import, run `ANALYZE`, build appropriate **indexes**, and consider `VACUUM`/`PRAGMA wal_checkpoint` for size/health.
* Verify features at startup: `SELECT sqlite_version(), vec_version();` and `PRAGMA compile_options;`.
* For embeddings, keep dimensions modest (256–1024) and **normalize** if your distance metric expects it (e.g., cosine).
* Provide export/backup via `db.serialize()` and let users download the blob; optionally sync encrypted snapshots to your backend.

---

## A11) PRAGMAs & tuning for the browser

* **WAL**: supported on OPFS as of SQLite 3.47 *only in exclusive locking*, and it **does not** improve concurrency. Consider `DELETE`/`TRUNCATE` journaling or measure carefully with `opfs-sahpool`.

  ```sql
  PRAGMA locking_mode=exclusive;  -- before enabling WAL on OPFS
  PRAGMA journal_mode=wal;        -- optional; benchmark your workload
  ```
* **Synchronous**: `PRAGMA synchronous=NORMAL;` balances durability with speed for local-first apps.
* **Temp**: `PRAGMA temp_store=MEMORY;` to avoid temp I/O stalls.
* **Cache**: `PRAGMA cache_size=-262144;` (\~256 MiB page cache). Tune per device.
* **Analyze / Optimize**: after bulk imports, run `ANALYZE; PRAGMA optimize;`.
* **Verify Build**: `PRAGMA compile_options;` and `SELECT sqlite_version(), vec_version();`.

## A12) Hybrid storage architecture (OPFS + in-memory)

* **Durable base**: store main DB in OPFS (`opfs` or `opfs-sahpool`).
* **Hot path**: use `:memory:` or temp tables for caches/queues/derived data; periodically persist.
* **Search layout**:

  * `docs` (FTS5) for text with appropriate tokenizer/stop-words.
  * `vec` (`vec0`) for embeddings. Prefer **metadata columns** for filterable fields; **aux columns** for large payloads; **partition keys** for multi-tenant shards.
  * Optionally `ATTACH` a second OPFS file for vectors to isolate I/O.
* **Backups/sync**: expose `db.serialize()` for download; optionally upload encrypted snapshots to a backend and merge server-side.

## A13) Quota, backpressure & fallbacks

* Monitor `navigator.storage.estimate()` to surface **usage/quota** and warn users. Offer a one‑click `VACUUM` + export when near limits.
* If headers for COOP/COEP are not possible, prefer `opfs-sahpool`. If OPFS is unavailable, fall back to `:memory:` or a WASMFS build and still allow export.
* Multi‑tab: route writes through a **single tab’s Worker** (or a SharedWorker) and coordinate via `BroadcastChannel`.

## A14) Debugging & observability

* **OPFS Explorer** DevTools extension to inspect the OPFS.
* Log compile options and versions on startup; add a hidden diagnostics page.
* Track long transactions and chunk large writes; avoid holding locks for long.

# Fully scripted build (copy/paste)

**`scripts/build-wasm.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

# Config
SQLITE_TAG=${SQLITE_TAG:-trunk}   # or a specific tag, e.g., version-3.47.0
ROOT_DIR=$(pwd)
BUILD_DIR="$ROOT_DIR/.build"

# Toolchain
if ! command -v emcc >/dev/null; then
  echo "Emscripten not found. Run: git clone https://github.com/emscripten-core/emsdk && cd emsdk && ./emsdk install latest && ./emsdk activate latest && source ./emsdk_env.sh" >&2
  exit 1
fi

mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

# Fetch
[ -d sqlite ] || git clone --depth 1 --branch "$SQLITE_TAG" https://github.com/sqlite/sqlite.git
[ -d sqlite-vec ] || git clone --depth 1 https://github.com/asg017/sqlite-vec.git

# Add compile-time init (pulls vec.c via #include)
cp -f "$ROOT_DIR/ext/wasm/sqlite_wasm_extra_init.c" sqlite/ext/wasm/sqlite_wasm_extra_init.c

# Build
pushd sqlite/ext/wasm
make clean || true
export CFLAGS="-DSQLITE_ENABLE_FTS5 -DSQLITE_ENABLE_RTREE -DSQLITE_ENABLE_JSON1 -DSQLITE_ENABLE_MATH_FUNCTIONS -DSQLITE_OMIT_LOAD_EXTENSION -O2"
make sqlite3.wasm ENABLE_VFS_OPFS=1 OPTS="$CFLAGS" EXT_CFLAGS="$CFLAGS"

# Copy artifacts out
mkdir -p "$ROOT_DIR/dist"
cp -v sqlite3.wasm sqlite3.mjs sqlite3-opfs-async-proxy.js "$ROOT_DIR/dist/"
popd

echo "✅ Build complete. See ./dist (sqlite3.mjs + sqlite3.wasm)."

**Project structure (suggested)**
```

project/
├─ dist/                          # build outputs (wasm + js)
├─ src/
│  ├─ sqljs-compat.ts             # wrapper
│  ├─ db.worker.ts                # worker API
│  └─ main.ts                     # app entry
├─ ext/wasm/vec\_shim.c            # auto-register sqlite-vec
├─ scripts/build-wasm.sh          # one-shot builder
├─ vite.config.ts                 # COOP/COEP headers
└─ package.json

````

---

# **ACTUAL WORKING EXAMPLES** ✅

## **Current SDK Usage** (Working Implementation)

**`example-usage.ts`**
```typescript
import { Database } from 'localretrieve';

// ⚠️  PERSISTENCE ISSUE: This will be in-memory only!
const db = await Database.create(undefined, 'opfs:/app/app.db'); // Becomes :memory:

// ✅ Schema initialization works
await db.initializeSchema();

// ✅ SQL operations work perfectly
await db.execAsync(`
  INSERT INTO docs_default (id, title, content)
  VALUES ('doc1', 'Test Document', 'This is a hybrid search test');
`);

// ✅ Hybrid search works
const results = await db.search({
  query: {
    text: 'hybrid search',
    vector: new Float32Array(384).fill(0.1) // 384-dim vector
  },
  limit: 10
});

console.log('Search results:', results);

// ❌ Export returns placeholder only
const backup = await db.exportAsync(); // "SQLite database export placeholder"
```

## **Development Server** (Working)

```bash
# ✅ Start development server with COOP/COEP headers
npm run dev
# or
./scripts/dev-server.sh

# Server runs on https://localhost:5173
# SharedArrayBuffer available
# WASM loading works
```

## **Current Test Files** ✅

The following test files demonstrate working functionality:
- `test-core-001-sql-compat.html` - sql.js API compatibility tests
- `test-setup-004-database.html` - Database functionality tests
- `test-worker-integration.html` - Worker RPC tests

**⚠️  CRITICAL NOTE**: All examples work but **data is lost on page refresh** due to OPFS being disabled.

---

# Notes on performance & limits

* **OPFS** gives near‑native, durable I/O. It’s per‑origin; users can clear it from site data.
* Use a **Worker** and consider **SharedArrayBuffer** (with COOP/COEP) to reduce copies.
* Pre‑warm the DB: open once at app start; keep a singleton worker.
* For vectors, keep dimension modest (e.g. 256–1024) and compress embeddings if size matters.

---

# Security & operations

* Never try to `load_extension()` in the browser. Always **compile‑in** extensions (as shown).
* Handle OPFS errors (quota exceeded). Provide a **compact/vacuum** path and periodic `VACUUM`.
* Backups: let users **export()** and download DB periodically; optionally sync to backend encrypted blobs.

---

## You now have

* A reproducible **WASM build** with **OPFS** + **sqlite‑vec** + **FTS5**.
* A **sql.js‑compatible** wrapper for minimal code changes.
* Worker wiring and hosting instructions for production.

> If you want me to tailor the wrapper to your existing `sqlite-worker.js` message protocol, I can refactor it 1:1 so you can drop it in without touching callers.
