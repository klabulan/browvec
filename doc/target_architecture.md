Target Architecture (Goal State)

0) Objectives & Non‑Goals

Objectives: local‑first, privacy‑preserving hybrid search (lexical + vector + rerank) running entirely in the browser with durable storage; multi‑tenant collections; multiple named vectors per collection; plug‑in providers (local/remote) for embedding and reranking; production‑grade ergonomics. Non‑Goals: running external DB servers; dynamic load_extension() in browser (all extensions are compile‑in); re‑implementing HNSW internals—sqlite‑vec is the vector engine.

1) Primary Scenarios

S1 · Local‑only search: everything on device (FTS5 + vec0). No network. Offline‑capable knowledge tools.

S2 · Hybrid providers: local DB + local or remote Embedder/Reranker picked by device policy. Enables better accuracy on weak devices.

S3 · Multi‑collection, multi‑vector: per‑user/project collections; each collection can define multiple named vectors (e.g., dense, code, image) and also FTS‑backed sparse.

S4 · Multi‑tab: concurrent readers, serialized writers. Leader election via BroadcastChannel, or SAHPool VFS with cooperative pause/unpause.

S5 · Backup & restore: export/import DB as blobs; optional encrypted snapshot sync.

2) Components

DB Worker (WASM): owns the OPFS file; exposes sql.js‑compat API + high‑level search(); compiled with SQLite (FTS5/JSON1/RTREE/math) + sqlite‑vec; VFS=opfs (COOP/COEP) or opfs‑sahpool.

Embedder Worker: implements EmbedderProvider (local WebGPU/WASM via Transformers.js + ONNX Runtime Web; or remote HTTP adapter). Batchable.

Reranker Worker: implements RerankerProvider (local cross‑encoder or remote). Batchable.

SDK (TS): orchestrates pipelines (Mode A SQL‑only; Mode B SQL+JS+rerank; Mode C light client post‑proc); abstracts providers; handles fusion (RRF/weighted), snippets, highlighting.

UI Layer: app‑specific; consumes SDK results; drives ingest and search UX.

(Optional) SharedWorker/Service Worker: centralize DB access across tabs; cache assets; note: headers for COOP/COEP must be served by origin.

3) Data Model & Storage Layout

Registry (shared)

collections(name TEXT PRIMARY KEY, created_at, user_id, meta JSON)

collection_vectors(collection TEXT, vector_name TEXT, dim INT, metric TEXT, type TEXT /*float32|int8|binary*/, UNIQUE(collection, vector_name))

collection_sparse(collection TEXT, backend TEXT /*'fts5'|'sparse'*/, config JSON)

meta(key TEXT PRIMARY KEY, value TEXT) — build provenance (providers, dims, schema version).

Per‑collection physical tables

docs_{collection} — canonical rows (rowid, id, payload columns like title, content, lang, doctype, timestamps, etc.)

fts_{collection} — FTS5 virtual table; tuned tokenizer (unicode61, diacritics, tokenchars, optional stemming).

vec_{collection}_{vector} — vec0 virtual table; columns: rowid INTEGER PRIMARY KEY, embedding float[DIM], optional metadata (filterable), aux (payload), partition columns.

Align rowid across docs/fts/vec_* for joins and locality. Add selective scalar indexes (e.g., on doctype, lang).

4) Search Pipeline

Mode A (SQL‑only): CTE merges FTS and vec candidates; normalize and fuse in SQL; return rows (lowest latency, no rerank). Mode B (default): SQL for candidate gen (FTS top k₁, vec top k₂); JS fusion (RRF/weighted); optional Reranker Worker on top‑N; final SQL fetch for snippets/highlighting. Mode C (UI‑only post‑proc): SQL (single signal), then client‑side grouping/snippets only.

Fusion & Rerank

Fusion: RRF (reciprocal rank) or weighted sum of normalized scores. MMR/diversity optional in SDK.

Rerank (optional): cross‑encoder rescoring of fused top‑N; bounded by topN and budgetMs.

5) Interfaces

External (optional)

RemoteEmbedder: POST /embed { texts[], model } -> { vectors: float32[][], dim }

RemoteReranker: POST /rerank { query, docs[], model, topN } -> { scores[] }

Telemetry (opt‑in): timings/health events.

Internal (Workers)

DB Worker RPC

open{ filename, vfs? }

exec{ sql, bind? }, select{ sql, bind? }, bulkInsert{ table, rows }

search(request: SearchRequest) -> SearchResponse (SDK can also orchestrate without this convenience)

EmbedderProvider: embed(texts: string[]) -> Float32Array[]; info() -> { name, dim, device }

RerankerProvider: scorePairs(pairs: [query, text][]) -> Float32Array

SDK Types (target)

type Distance = 'cosine'|'l2'|'dot';
type Fusion = 'rrf'|'weighted'|'dbsf';

type VectorQuery = { using: string; vector: Float32Array|number[]; k?: number; weight?: number };
type SparseQuery = { using?: 'fts5'|'sparse'; text?: string; k?: number; weight?: number };

type Rerank = { provider: 'local'|'remote'; model?: string; topN?: number; budgetMs?: number };

type SearchRequest = {
  collection: string;
  prefetch?: (VectorQuery|SparseQuery)[];
  fusion?: { type: Fusion; weights?: Record<string, number> };
  filters?: Record<string, unknown>;
  rerank?: Rerank;
  groupBy?: string;       // optional grouping field
  diversity?: number;     // 0..1 MMR-like knob
  limit: number;
};

type SearchResult = {
  id: string|number; rowid: number; score: number;
  scores: { fts?: number; vec?: Record<string, number>; rerank?: number };
  source?: { collection: string; vector?: string };
  title?: string; snippet?: string; payload?: Record<string, unknown>;
};

type SearchResponse = { results: SearchResult[]; debug?: Record<string, unknown> };

6) Technologies & Config

SQLite WASM (official ext/wasm) with OPFS VFS; compile‑in sqlite‑vec via sqlite_wasm_extra_init.c.

VFS: opfs (requires COOP/COEP) or opfs‑sahpool (no COOP/COEP, cooperative concurrency).

AI in browser: Transformers.js + ONNX Runtime Web; prefer WebGPU with WASM fallback.

Build: TypeScript, Vite/ESBuild, module workers; -O2 for speed; ALLOW_MEMORY_GROWTH on.

PRAGMAs: synchronous=NORMAL, temp_store=MEMORY, tuned cache_size, ANALYZE; PRAGMA optimize; after bulk loads.

7) Security & Privacy

No dynamic extensions; all code compiled‑in. Optional at‑rest encryption (SEE/Multiple‑Ciphers) or app‑layer crypto for sensitive blobs. Keys never stored in OPFS.

Guardrails: short write transactions; integrity checks on maintenance screens; clear UX for export/restore.

8) Performance & Sizing

Three Workers (DB/Embedder/Reranker) to avoid head‑of‑line blocking; batch ops; reuse tokenizer/graphs.

Dimensions 384–768 for common sentence models; quantization optional later.

Partition large collections by tenant/project; consider separate OPFS DB for vectors via ATTACH.

9) Observability & DevEx

Startup self‑check: versions, compile options, vec_version(); diagnostics panel.

Structured debug from search() (counts, timings, candidates per channel, fusion stats).

OPFS Explorer for inspection; snapshot generator for bug reports.

10) Risks & Mitigations

Quota: surface usage via navigator.storage.estimate(); one‑click compact/export.

Device variance: provider policy (local/remote), adaptive k₁/k₂/topN by perf budget.

Concurrency: leader‑elected writer or SAHPool pause/unpause; keep transactions short.

11) Phased Path to Goal

MVP (done in prior section): one collection, one dense vector + FTS; SQL‑only hybrid; stubs for rerank ignored.

Phase 1: collections registry, named vectors, SDK search() (Mode B) with RRF fusion; remote provider adapters.

Phase 2: local reranker, grouping/diversity knobs, optional neural‑sparse.

Phase 3: encryption options, advanced telemetry, quantization/Matryoshka vectors.

