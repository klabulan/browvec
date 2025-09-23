# Product name (working): **LocalRetrieve**

**One-liner:** A browser-native retrieval engine (SQLite+FTS+Vectors in WASM) with a TypeScript SDK that gives any web or Electron app private, offline, hybrid search—no servers required.

## Positioning (what it is / isn’t)

* **Is:** An **embedded component** for apps: local-first search + retrieval with Qdrant-style collections, multi-vector fields, fusion, and optional rerankers.
* **Is not:** A cloud DB or general server database. We explicitly **do not** compete with Qdrant/pgvector/Typesense for centralized, org-wide search.

## Who it serves first (initial ICPs)

1. **Web document editors** (OnlyOffice/R7 Office plugins; also Markdown/knowledge tools) needing offline, paragraph-level search with highlights and change-tracking awareness.
2. **Electron sidecars** for regulated orgs (legal, banking) needing encrypted local libraries and fast clause/KB retrieval.
3. **Developer tools** (VS Code/desktop docs viewers) for local code + docs search.

## Core jobs-to-be-done

* Ingest local docs (text/PDF/code) → build embeddings/indexes → run **hybrid search** (BM25+ANN) → fuse (RRF/MMR) → **highlight** exact snippets → optionally **rerank** with a cross-encoder → return stable anchors (paragraph/heading IDs).
* Do it **fully offline**, **durably** (OPFS), with **clear quotas**, **resume on crash**, and **portable backups**.

## Value proposition

* **Zero backend ops**: ship one WASM + SDK; works offline by default.
* **Privacy by design**: data and models stay on device unless policy allows remote calls.
* **Fast time-to-value**: collections, multi-vector fields, and snippet/highlight pipeline ready out-of-the-box.

## Non-goals (to prevent bloat)

* No multi-tenant cloud service, no cross-user indexing, no analytics warehouse.
* No promise to handle 10M+ chunks per device.
* No server clustering or HA—this is an **embedded client engine**.

---

## Architectural overview

**Runtime**

* **WASM module:** SQLite (FTS5, JSON1) + `sqlite-vec` compiled with **SIMD** & threads.
* **DB Worker:** single writer, SQL API (sql.js-compatible). Handles OPFS I/O, WAL, snapshots.
* **TypeScript SDK:** orchestration (ingest → embed → index → search → fuse → rerank → highlight), error handling, backpressure, quotas.
* **Providers:** pluggable **Embedder** and **Reranker** (local WebGPU/WASM, or approved remote).
* **Adapters:** OnlyOffice/R7 plugin API, Electron (Node bridge), VS Code extension.

**Data model**

* **Collections:** user-scoped; each = base table + FTS virtual table + one or more `vec` indexes.
* **Multi-vector fields:** e.g., `body_dense(768)`, `title_dense(384)`, `code_dense(1024)`, `sparse_bow`.
* **Anchors:** stable `paragraph_id`, `heading_path`, `file_fingerprint` (to survive rename/move).
* **Migrations:** `PRAGMA user_version`; SDK helper for up/down scripts.
* **Backups:** `serialize()` to encrypted blobs; import/export.

**Query pipeline**

1. **Prefilter** via FTS (BM25) + optional metadata SQL WHERE (scope/tags).
2. **ANN** on one or more vector fields (union).
3. **Fusion** (RRF/weighted) in Worker/SDK.
4. **Optional rerank** (cross-encoder).
5. **Snippets & highlights** using FTS offsets + vector spans; return anchors.

**Concurrency & durability**

* Single-writer **DB Worker**; cross-tab coordination with BroadcastChannel (advisory locks).
* WAL + **atomic snapshots** + resumable ingest.
* **Quota detection** + degradation path (disable vectors, keep FTS).

**Platforms**

* Chromium/Firefox desktop, Electron, VS Code. iOS/Safari supported with **fallback** (FTS-first, tiny models, or policy-gated remote). Publish device support matrix.

---

## \<SECURITY\_REVIEW>

* **At rest:** per-collection encryption (WebCrypto AES-GCM). Key sources: user passphrase, enterprise SSO secret, or Electron OS keychain. Key rotation supported; keys never persisted in plain.
* **In use:** provider allow-list + host pinning for any remote models; “**Local-Only Mode**” hard-switch.
* **App isolation:** publish strict CSP, enable Trusted Types, and recommend sandboxed iframes for untrusted content.
* **Supply chain:** SRI for WASM bundles; signed releases; hash-pinned model artifacts.
* **PII handling:** pre-index redaction hooks; query audit log (local).

---

## Product surface (what developers get)

**Public SDK**

* `openCollection(name, schema, vectors[])`
* `ingest(files|streams, { chunker, fields, tags })`
* `search(query, { fields, k, filters, fusion, reranker }) → { hits, snippets, anchors }`
* `export()/import()` (encrypted)
* `migrate(toVersion)`
* `providers.embedder(config)`, `providers.reranker(config)`

**Tooling**

* **CLI (Node/Electron)**: pre-embed and pre-index corpora; validate anchors; pack encrypted snapshots.
* **DevTools panel:** inspect tables/indexes, `EXPLAIN ANALYZE`, top-K timings, quota usage.

---

## Packaging & licensing

* **Open-source core (permissive)**: WASM engine, TS SDK, FTS+vectors, fusion, basic highlights, Dev examples.
* **Enterprise add-ons (commercial)**: encryption/key mgmt UI, policy console (local-only/remote), admin DevTools, model CDN with version pinning, device certification, priority support.

---

## Benchmarks & quality bars (must-hit targets)

* **Latency (desktop i5+)**: p50 < **120 ms**, p95 < **250 ms** for top-50 on **100k** chunk corpus (hybrid+fusion, no rerank).
* **Cold-start**: engine ready < **300 ms**; first query < **800 ms** (no model warmup).
* **Indexing**: ≥ **1,000 docs/hour** on mid-range laptop with tiny embedder; resumable.
* **Footprint**: core WASM ≤ **4–6 MB**, tiny embedder ≤ **80–120 MB** (quantized).

---

## Roadmap (12 weeks to meaningful value)

**Phase 1 — “Editor Plugin First” (Weeks 0–4)**

* Deliver OnlyOffice/R7 plugin POC: paragraph IDs, ingest + hybrid search, highlights, export/import.
* **Exit test:** index 1–2 GB doc set; top-50 p95 < 300 ms; crash-resume OK; quota warning UX works.

**Phase 2 — “Reliability & Security” (Weeks 5–8)**

* Atomic snapshots, WAL recovery, encryption at rest, provider allow-list; DevTools v1.
* **Exit test:** simulated XSS blocked by CSP/Trusted Types; encrypted backup import on new device.

**Phase 3 — “Electron Sidecar + CLI” (Weeks 9–12)**

* Electron shell, SSO key source, CLI pre-indexer, admin panel basics; cross-tab locking polish.
* **Exit test:** legal/KB demo with 100k+ chunks; import encrypted pack, query offline, audit log present.

---

## KPIs (to judge product/market traction)

* **DX:** time-to-first-search < 10 minutes for a new dev; weekly SDK downloads; example app forks.
* **Perf:** published device matrix; p95 latency and crash-free rate.
* **Adoption:** # of plugin installs (R7/OnlyOffice), # of Electron pilots, # of OEM evals.
* **Revenue (after Month 3):** # enterprise add-on trials, conversion to paid.

---

## Risks & mitigations

* **iOS/Safari quotas:** default to FTS-only + optional remote rerank; communicate limits; encourage Electron for mobile-critical use.
* **Model size & licensing:** ship tiny, clean-license models; remote providers gated; cache eviction policy.
* **Performance ceiling:** aggressive SIMD, tight ANN params, prefilter with FTS, publish honest limits and guidance.

---

## Go-to-market

* **Bottom-up**: OSS + three polished samples (R7/OnlyOffice plugin, Electron legal sidecar, VS Code search).
* **Top-down/OEM**: brief partners in doc-suite and field-service ecosystems; offer white-label + certification.
* **Enterprise**: security brief, device matrix, and paid add-on slate.

---

## What to build next (concrete tasks)

1. **WASM build pipeline** with SIMD/threads; CI that produces signed artifacts.
2. **DB Worker** with single-writer coordination and snapshot API.
3. **SDK search orchestration** (FTS prefilter → ANN → RRF → highlight).
4. **OnlyOffice/R7 adapter**: paragraph/heading anchors, diff-aware snippets.
5. **Tiny local embedder** (quantized) + optional remote provider with allow-list.
6. **DevTools v1** and **CLI pre-indexer**.
7. **Encryption module** (AES-GCM; key sources pluggable).

If we stick to this scope, “LocalRetrieve” becomes the default way to add **serious, private retrieval** to web/Electron apps—without standing up a single server.
