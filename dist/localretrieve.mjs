import { c as B, V as C, E as M, p as R, g as H, T as W, C as P, M as x, a as I } from "./ProviderFactory-3B-jCMm2.mjs";
import { A as pe, B as ye, k as ve, r as Ce, O as Se, e as be, s as Me, P as Ee, Q as xe, h as Ae, b as Te, D as Re, W as Pe, d as Ie, m as ke, f as De, l as Le, j as ze, q as _e, o as Oe, n as $e, i as Be, v as He } from "./ProviderFactory-3B-jCMm2.mjs";
class k extends Error {
  constructor(e, t) {
    super(e), this.code = t, this.name = "SQLError";
  }
}
class v extends Error {
  constructor(e, t) {
    super(e), this.code = t, this.name = "SQLStatementError";
  }
}
class u extends Error {
  constructor(e, t) {
    super(e), this.code = t, this.name = "SQLDatabaseError";
  }
}
function D(c) {
  return c === null || typeof c == "number" || typeof c == "string" || c instanceof Uint8Array;
}
function T(c) {
  return c ? Array.isArray(c) ? c.every(D) : typeof c == "object" && c !== null ? Object.values(c).every(D) : !1 : !0;
}
function b(c) {
  return typeof c == "string" && c.trim().length > 0;
}
function L(c) {
  if (!c || c.length === 0)
    return { columns: [], values: [] };
  const e = c[0], t = Object.keys(e), s = c.map((r) => t.map((a) => r[a] ?? null));
  return { columns: t, values: s };
}
const U = {
  mode: "async_preferred",
  enableWarnings: !0,
  throwOnSyncLimitations: !1,
  workerTimeout: 3e4
};
class O {
  constructor(e, t) {
    if (this._finalized = !1, this._results = [], this._currentIndex = -1, this._executed = !1, this._sql = t.trim(), this.state = {
      sql: this._sql,
      bound: !1,
      stepped: !1,
      finished: !1,
      currentRow: null,
      columns: [],
      database: e
    }, !this.state.sql)
      throw new v("SQL statement cannot be empty");
  }
  /**
   * Get the SQL statement (sql.js compatible)
   */
  get sql() {
    return this._sql;
  }
  /**
   * Check if statement is finalized (sql.js compatible)
   */
  get finalized() {
    return this._finalized;
  }
  /**
   * Bind parameters to the prepared statement (sql.js compatible)
   */
  bind(e) {
    if (this._finalized)
      throw new v("Cannot bind to finalized statement");
    if (e !== void 0 && !T(e))
      throw new v("Invalid parameter types");
    return this.state.bound = !0, this.reset(), this._boundParams = e, !0;
  }
  /**
   * Execute one step of the statement (sql.js compatible)
   */
  step() {
    if (this._finalized)
      throw new v("Cannot step finalized statement");
    return this.state.finished ? !1 : (this._executed || (this._executeQuery(), this._executed = !0, this.state.stepped = !0), this._currentIndex++, this._currentIndex < this._results.length ? (this.state.currentRow = this._results[this._currentIndex], this.state.columns.length === 0 && this.state.currentRow && (this.state.columns = Object.keys(this.state.currentRow)), !0) : (this.state.finished = !0, this.state.currentRow = null, !1));
  }
  /**
   * Get current row as array of values (sql.js compatible)
   */
  get() {
    return this.state.currentRow ? this.state.columns.map((e) => this.state.currentRow[e] ?? null) : [];
  }
  /**
   * Get current row as object (sql.js compatible)
   */
  getAsObject() {
    return this.state.currentRow ? { ...this.state.currentRow } : {};
  }
  /**
   * Get column names (sql.js compatible)
   */
  getColumnNames() {
    return [...this.state.columns];
  }
  /**
   * Reset statement for re-execution (sql.js compatible)
   */
  reset() {
    if (this._finalized)
      throw new v("Cannot reset finalized statement");
    return this.state.stepped = !1, this.state.finished = !1, this.state.currentRow = null, this._currentIndex = -1, this._executed = !1, this._results = [], !0;
  }
  /**
   * Free/finalize the statement (sql.js compatible)
   */
  free() {
    if (this._finalized)
      return !0;
    this._finalized = !0, this.state.finished = !0, this.state.currentRow = null, this._results = [], this._boundParams = void 0;
    try {
      const e = this.state.database;
      e.activeStatements && e.activeStatements.has(this) && e.activeStatements.delete(this);
    } catch {
    }
    return !0;
  }
  /**
   * Async versions for enhanced API compatibility
   */
  async bindAsync(e) {
    return this.bind(e);
  }
  async stepAsync() {
    if (this._finalized)
      throw new v("Cannot step finalized statement");
    return this.state.finished ? !1 : (this._executed || (await this._executeQueryAsync(), this._executed = !0, this.state.stepped = !0), this._currentIndex++, this._currentIndex < this._results.length ? (this.state.currentRow = this._results[this._currentIndex], this.state.columns.length === 0 && this.state.currentRow && (this.state.columns = Object.keys(this.state.currentRow)), !0) : (this.state.finished = !0, this.state.currentRow = null, !1));
  }
  async getAsync() {
    return this.get();
  }
  async getAsObjectAsync() {
    return this.getAsObject();
  }
  async resetAsync() {
    return this.reset();
  }
  async freeAsync() {
    return this.free();
  }
  /**
   * Get the SQL statement (for compatibility)
   */
  getSQL() {
    return this._sql;
  }
  /**
   * Get bound parameters (for debugging)
   */
  getBoundParams() {
    return this._boundParams;
  }
  /**
   * Execute the SQL query using the database's worker interface (synchronous)
   */
  _executeQuery() {
    try {
      const t = this.state.database._getWorkerRPC?.();
      if (!t)
        throw new v("Database worker not available");
      this._executeWithWorkerSync(t);
    } catch (e) {
      const t = e instanceof Error ? e.message : String(e);
      throw new v(`Query execution failed: ${t}`);
    }
  }
  /**
   * Execute the SQL query using the database's worker interface (asynchronous)
   */
  async _executeQueryAsync() {
    try {
      const t = this.state.database._getWorkerRPC?.();
      if (!t)
        throw new v("Database worker not available");
      const s = await t.select({
        sql: this.state.sql,
        params: this._boundParams
      });
      this._results = s?.rows || [];
    } catch (e) {
      const t = e instanceof Error ? e.message : String(e);
      throw new v(`Query execution failed: ${t}`);
    }
  }
  /**
   * Execute query with worker RPC (synchronous compatibility)
   * Uses synchronous blocking for sql.js compatibility
   */
  _executeWithWorkerSync(e) {
    const t = e.select({
      sql: this.state.sql,
      params: this._boundParams
    });
    let s = !1, r = null, a = null;
    if (t.then((i) => {
      r = i, s = !0;
    }).catch((i) => {
      a = i, s = !0;
    }), !s)
      throw new v(
        `SYNC/ASYNC COMPATIBILITY ISSUE:
Query execution timeout in sync compatibility mode.
SOLUTIONS:
1. Use async API: await statement.stepAsync() instead of statement.step()
2. Increase timeout in database configuration
3. Consider using sql.js directly on main thread for true sync operations

This is a known limitation of browser worker architecture.`
      );
    if (a) {
      const i = a instanceof Error ? a.message : String(a);
      throw new v(`Query execution failed: ${i}`);
    }
    this._results = r?.rows || [];
  }
  /**
   * Get execution statistics (debugging helper)
   */
  getStats() {
    return {
      sql: this._sql,
      bound: this.state.bound,
      executed: this._executed,
      resultCount: this._results.length,
      currentIndex: this._currentIndex,
      finalized: this._finalized
    };
  }
  /**
   * Check if statement has results
   */
  hasResults() {
    return this._results.length > 0;
  }
  /**
   * Get all results at once (helper method)
   */
  getAllResults() {
    if (!this._executed)
      throw new v("Statement not executed yet");
    return [...this._results];
  }
  /**
   * Get all results as arrays (helper method)
   */
  getAllResultArrays() {
    if (!this._executed)
      throw new v("Statement not executed yet");
    return this._results.map(
      (e) => this.state.columns.map((t) => e[t] ?? null)
    );
  }
}
class o extends Error {
  constructor(e, t) {
    super(e), this.code = t, this.name = "DatabaseError";
  }
}
class V extends Error {
  constructor(e, t) {
    super(e), this.code = t, this.name = "StatementError";
  }
}
function Y(c) {
  return c && typeof c == "object" && Array.isArray(c.columns) && Array.isArray(c.values);
}
function z(c) {
  return c === null || typeof c == "number" || typeof c == "string" || c instanceof Uint8Array;
}
const N = {
  vfs: "opfs",
  pragmas: {
    synchronous: "NORMAL",
    cache_size: "-64000",
    // 64MB cache
    temp_store: "MEMORY"
  },
  workerConfig: {
    maxConcurrentOperations: 10,
    operationTimeout: 3e4,
    enablePerformanceMonitoring: !0,
    logLevel: "info"
  }
};
function Z(c) {
  return c || new URL(
    /* @vite-ignore */
    "../database/worker.js",
    import.meta.url
  ).toString();
}
function J(c) {
  return c ? Array.isArray(c) ? c.every(z) : typeof c == "object" ? Object.values(c).every(z) : !1 : !0;
}
function ee(c) {
  return typeof c == "string" && c.trim().length > 0;
}
class E {
  constructor(e = {}) {
    this.workerRPC = null, this.isInitialized = !1, this.rowsModified = 0, this.activeStatements = /* @__PURE__ */ new Set();
    const t = { ...N, ...e };
    this.state = {
      isOpen: !1,
      filename: e.filename || ":memory:",
      worker: null,
      workerRPC: null
    }, this.compatConfig = { ...U }, e.filename !== void 0 && this._initializeWorker(t);
  }
  /**
   * Static factory method for sql.js compatibility
   */
  static async create(e, t) {
    const s = {
      filename: t || ":memory:"
    }, r = new E(s);
    return await r._initialize(), e && await r._importBuffer(e), r;
  }
  /**
   * Execute SQL statement(s) and return results (sql.js compatible)
   */
  exec(e) {
    if (!this.state.isOpen)
      throw new u("Database is not open");
    if (!b(e))
      throw new u("Invalid SQL statement");
    try {
      return this._execSyncCompat(e);
    } catch (t) {
      if (t instanceof k)
        throw t;
      const s = t instanceof Error ? t.message : String(t);
      throw new u(`SQL execution failed: ${s}`);
    }
  }
  /**
   * Execute SQL statement(s) asynchronously (enhanced API)
   *
   * CRITICAL: Supports parameter binding for non-ASCII text (Cyrillic, CJK, etc.)
   * Always use parameter binding instead of inline SQL for non-ASCII strings!
   */
  async execAsync(e, t) {
    if (!this.state.isOpen)
      throw new u("Database is not open");
    if (!b(e))
      throw new u("Invalid SQL statement");
    if (t !== void 0 && !T(t))
      throw new u("Invalid SQL parameters");
    if (!this.workerRPC)
      throw new u("Worker not available");
    try {
      const s = await this.workerRPC.select({ sql: e, params: t });
      return [L(s.rows || [])];
    } catch (s) {
      const r = s instanceof Error ? s.message : String(s);
      throw new u(`SQL execution failed: ${r}`);
    }
  }
  /**
   * Run SQL statement with parameters (sql.js compatible)
   */
  run(e, t) {
    if (!this.state.isOpen)
      throw new u("Database is not open");
    if (!b(e))
      throw new u("Invalid SQL statement");
    if (t !== void 0 && !T(t))
      throw new u("Invalid SQL parameters");
    try {
      return this._runSyncCompat(e, t), this;
    } catch (s) {
      if (s instanceof k)
        throw s;
      const r = s instanceof Error ? s.message : String(s);
      throw new u(`SQL execution failed: ${r}`);
    }
  }
  /**
   * Run SQL statement with parameters asynchronously (enhanced API)
   */
  async runAsync(e, t) {
    if (!this.state.isOpen)
      throw new u("Database is not open");
    if (!b(e))
      throw new u("Invalid SQL statement");
    if (t !== void 0 && !T(t))
      throw new u("Invalid SQL parameters");
    if (!this.workerRPC)
      throw new u("Worker not available");
    try {
      return await this.workerRPC.exec({ sql: e, params: t }), this.rowsModified++, this;
    } catch (s) {
      const r = s instanceof Error ? s.message : String(s);
      throw new u(`SQL execution failed: ${r}`);
    }
  }
  /**
   * Prepare SQL statement (sql.js compatible)
   */
  prepare(e) {
    if (!this.state.isOpen)
      throw new u("Database is not open");
    if (!b(e))
      throw new u("Invalid SQL statement");
    const t = new O(this, e);
    return this.activeStatements.add(t), t;
  }
  /**
   * Prepare SQL statement asynchronously (enhanced API)
   */
  async prepareAsync(e) {
    return this.prepare(e);
  }
  /**
   * Export database as binary data (sql.js compatible)
   */
  export() {
    if (!this.state.isOpen)
      throw new u("Database is not open");
    try {
      return this._exportSyncCompat();
    } catch (e) {
      if (e instanceof k)
        throw e;
      const t = e instanceof Error ? e.message : String(e);
      throw new u(`Database export failed: ${t}`);
    }
  }
  /**
   * Export database as binary data asynchronously (enhanced API)
   */
  async exportAsync() {
    if (!this.state.isOpen)
      throw new u("Database is not open");
    if (!this.workerRPC)
      throw new u("Worker not available");
    try {
      return await this.workerRPC.export();
    } catch (e) {
      const t = e instanceof Error ? e.message : String(e);
      throw new u(`Database export failed: ${t}`);
    }
  }
  /**
   * Close database connection (sql.js compatible)
   */
  close() {
    for (const e of this.activeStatements)
      try {
        e.free();
      } catch (t) {
        console.warn("Error finalizing statement:", t);
      }
    if (this.activeStatements.clear(), this.workerRPC)
      try {
        this._closeSyncCompat();
      } catch (e) {
        console.warn("Error during database close:", e);
      }
    this.state.isOpen = !1, this.isInitialized = !1, this.state.worker && (this.state.worker.terminate(), this.state.worker = null), this.workerRPC = null, this.state.workerRPC = null;
  }
  /**
   * Close database connection asynchronously (enhanced API)
   */
  async closeAsync() {
    for (const e of this.activeStatements)
      try {
        e.free();
      } catch (t) {
        console.warn("Error finalizing statement:", t);
      }
    if (this.activeStatements.clear(), this.workerRPC)
      try {
        await this.workerRPC.close();
      } catch (e) {
        console.warn("Error during database close:", e);
      }
    this.state.isOpen = !1, this.isInitialized = !1, this.state.worker && (this.state.worker.terminate(), this.state.worker = null), this.workerRPC = null, this.state.workerRPC = null;
  }
  /**
   * Get number of rows modified by the last statement (sql.js compatible)
   */
  getRowsModified() {
    return this.rowsModified;
  }
  /**
   * Create a savepoint (sql.js compatible)
   */
  savepoint(e) {
    const t = e || `sp_${Date.now()}`;
    try {
      this._runSyncCompat(`SAVEPOINT ${t}`);
    } catch (s) {
      const r = s instanceof Error ? s.message : String(s);
      throw new u(`Savepoint creation failed: ${r}`);
    }
  }
  /**
   * Release a savepoint (sql.js compatible)
   */
  savepoint_release(e) {
    const t = e || "sp";
    try {
      this._runSyncCompat(`RELEASE SAVEPOINT ${t}`);
    } catch (s) {
      const r = s instanceof Error ? s.message : String(s);
      throw new u(`Savepoint release failed: ${r}`);
    }
  }
  /**
   * Rollback to a savepoint (sql.js compatible)
   */
  savepoint_rollback(e) {
    const t = e || "sp";
    try {
      this._runSyncCompat(`ROLLBACK TO SAVEPOINT ${t}`);
    } catch (s) {
      const r = s instanceof Error ? s.message : String(s);
      throw new u(`Savepoint rollback failed: ${r}`);
    }
  }
  /**
   * Create function (sql.js compatible stub)
   */
  create_function(e, t) {
    if (this.compatConfig.enableWarnings && console.warn("create_function is not supported in LocalRetrieve. Use SQL functions instead."), this.compatConfig.throwOnSyncLimitations)
      throw new u("create_function is not supported in Worker-based SQLite");
  }
  /**
   * Create aggregate function (sql.js compatible stub)
   */
  create_aggregate(e, t) {
    if (this.compatConfig.enableWarnings && console.warn("create_aggregate is not supported in LocalRetrieve. Use SQL aggregate functions instead."), this.compatConfig.throwOnSyncLimitations)
      throw new u("create_aggregate is not supported in Worker-based SQLite");
  }
  /**
   * Perform hybrid search (LocalRetrieve extension)
   */
  async search(e) {
    if (!this.state.isOpen)
      throw new o("Database is not open");
    if (!this.workerRPC)
      throw new o("Worker not available");
    try {
      return await this.workerRPC.search(e);
    } catch (t) {
      const s = t instanceof Error ? t.message : String(t);
      throw new o(`Search failed: ${s}`);
    }
  }
  /**
   * Text-only hybrid search with automatic strategy selection (Task 6.1)
   * @param query - Search query string
   * @param options - Search configuration options
   * @returns Promise<EnhancedSearchResponse>
   */
  async searchText(e, t) {
    if (!this.state.isOpen)
      throw new o("Database is not open");
    if (!this.workerRPC)
      throw new o("Worker not available");
    try {
      return await this.workerRPC.searchText({ query: e, options: t });
    } catch (s) {
      return this._handleSearchError(s, e, t);
    }
  }
  /**
   * Advanced search with explicit strategy control (Task 6.1)
   * @param params - Advanced search parameters
   * @returns Promise<EnhancedSearchResponse>
   */
  async searchAdvanced(e) {
    if (!this.state.isOpen)
      throw new o("Database is not open");
    if (!this.workerRPC)
      throw new o("Worker not available");
    try {
      return await this.workerRPC.searchAdvanced(e);
    } catch (t) {
      return this._handleAdvancedSearchError(t, e);
    }
  }
  /**
   * Global search across all collections (Task 6.1)
   * @param query - Search query string
   * @param options - Global search options
   * @returns Promise<GlobalSearchResponse>
   */
  async searchGlobal(e, t) {
    if (!this.state.isOpen)
      throw new o("Database is not open");
    if (!this.workerRPC)
      throw new o("Worker not available");
    try {
      return await this.workerRPC.searchGlobal({ query: e, options: t });
    } catch (s) {
      return this._handleGlobalSearchError(s, e, t);
    }
  }
  // ============================================================================================
  // LLM Integration API (SCRUM-17)
  // ============================================================================================
  /**
   * Enhance search query using LLM (SCRUM-17)
   *
   * @param query - The search query to enhance
   * @param options - LLM provider configuration
   * @returns Promise<EnhancedQueryResult> - Enhanced query with suggestions
   *
   * @example
   * ```typescript
   * const enhanced = await db.enhanceQuery('search docs', {
   *   provider: 'openai',
   *   model: 'gpt-4',
   *   apiKey: 'sk-...'
   * });
   * console.log(enhanced.enhancedQuery); // "document search files"
   * console.log(enhanced.suggestions);    // ["find documents", ...]
   * ```
   */
  async enhanceQuery(e, t) {
    if (!this.state.isOpen)
      throw new o("Database is not open");
    if (!this.workerRPC)
      throw new o("Worker not available");
    try {
      return await this.workerRPC.enhanceQuery({ query: e, options: t });
    } catch (s) {
      const r = s instanceof Error ? s.message : String(s);
      throw new o(`Query enhancement failed: ${r}`);
    }
  }
  /**
   * Summarize search results using LLM (SCRUM-17)
   *
   * @param results - Array of search results to summarize
   * @param options - LLM provider configuration
   * @returns Promise<ResultSummaryResult> - Summary with key points
   *
   * @example
   * ```typescript
   * const results = await db.search({ query: { text: 'documents' } });
   * const summary = await db.summarizeResults(results.results, {
   *   provider: 'anthropic',
   *   model: 'claude-3-sonnet',
   *   apiKey: 'sk-ant-...'
   * });
   * console.log(summary.summary);     // "The search results..."
   * console.log(summary.keyPoints);   // ["Document management", ...]
   * ```
   */
  async summarizeResults(e, t) {
    if (!this.state.isOpen)
      throw new o("Database is not open");
    if (!this.workerRPC)
      throw new o("Worker not available");
    try {
      return await this.workerRPC.summarizeResults({ results: e, options: t });
    } catch (s) {
      const r = s instanceof Error ? s.message : String(s);
      throw new o(`Result summarization failed: ${r}`);
    }
  }
  /**
   * Combined search with LLM enhancements (SCRUM-17)
   *
   * Performs search with optional query enhancement and result summarization.
   *
   * @param query - The search query
   * @param options - Search and LLM configuration
   * @returns Promise<LLMSearchResponseResult> - Results with LLM enhancements
   *
   * @example
   * ```typescript
   * const smartSearch = await db.searchWithLLM('AI docs', {
   *   enhanceQuery: true,
   *   summarizeResults: true,
   *   searchOptions: { limit: 20 },
   *   llmOptions: {
   *     provider: 'openai',
   *     model: 'gpt-4',
   *     apiKey: 'sk-...'
   *   }
   * });
   * console.log(smartSearch.enhancedQuery);  // Enhanced query
   * console.log(smartSearch.results);        // Search results
   * console.log(smartSearch.summary);        // AI-generated summary
   * ```
   */
  async searchWithLLM(e, t) {
    if (!this.state.isOpen)
      throw new o("Database is not open");
    if (!this.workerRPC)
      throw new o("Worker not available");
    try {
      return await this.workerRPC.searchWithLLM({ query: e, options: t });
    } catch (s) {
      const r = s instanceof Error ? s.message : String(s);
      throw new o(`LLM search failed: ${r}`);
    }
  }
  /**
   * Generic LLM call with arbitrary prompt (SCRUM-17)
   *
   * Provides direct access to LLM providers for custom use cases beyond
   * query enhancement or result summarization. This method accepts any
   * prompt and returns the raw LLM response.
   *
   * @param prompt - The prompt to send to the LLM
   * @param options - LLM provider configuration
   * @returns Promise<CallLLMResult> - Raw LLM response with text and metadata
   *
   * @example
   * ```typescript
   * const result = await db.callLLM('Explain quantum computing in simple terms', {
   *   provider: 'openai',
   *   model: 'gpt-4',
   *   apiKey: 'sk-...',
   *   temperature: 0.7,
   *   maxTokens: 500
   * });
   * console.log(result.text);           // LLM's response
   * console.log(result.usage);          // Token usage stats
   * console.log(result.processingTime); // Processing time in ms
   * ```
   *
   * @example
   * ```typescript
   * // Custom use case: Generate product descriptions
   * const product = { name: 'Widget Pro', features: ['Fast', 'Reliable'] };
   * const prompt = `Generate a marketing description for: ${JSON.stringify(product)}`;
   * const result = await db.callLLM(prompt, {
   *   provider: 'anthropic',
   *   model: 'claude-3-sonnet',
   *   apiKey: process.env.ANTHROPIC_API_KEY
   * });
   * console.log(result.text); // Marketing description
   * ```
   */
  async callLLM(e, t) {
    if (!this.state.isOpen)
      throw new o("Database is not open");
    if (!this.workerRPC)
      throw new o("Worker not available");
    try {
      return await this.workerRPC.callLLM({ prompt: e, options: t });
    } catch (s) {
      const r = s instanceof Error ? s.message : String(s);
      throw new o(`LLM call failed: ${r}`);
    }
  }
  // Task 6.2: Internal Embedding Pipeline API
  // ============================================================================================
  /**
   * Generate embedding for a query with intelligent caching (Task 6.2)
   * @param query - Text query to generate embedding for
   * @param collection - Collection context for embedding generation
   * @param options - Additional generation options
   * @returns Promise<QueryEmbeddingResult>
   */
  async generateQueryEmbedding(e, t, s) {
    if (!this.state.isOpen)
      throw new o("Database is not open");
    if (!this.workerRPC)
      throw new o("Worker not available");
    try {
      return await this.workerRPC.generateQueryEmbedding({
        query: e,
        collection: t,
        options: s
      });
    } catch (r) {
      const a = r instanceof Error ? r.message : String(r);
      throw new o(`Query embedding generation failed: ${a}`);
    }
  }
  /**
   * Generate embeddings for multiple queries in batch (Task 6.2)
   * @param requests - Array of embedding requests
   * @param batchOptions - Batch processing options
   * @returns Promise<BatchQueryEmbeddingResult[]>
   */
  async batchGenerateQueryEmbeddings(e, t) {
    if (!this.state.isOpen)
      throw new o("Database is not open");
    if (!this.workerRPC)
      throw new o("Worker not available");
    try {
      return await this.workerRPC.batchGenerateQueryEmbeddings({
        requests: e,
        batchOptions: t
      });
    } catch (s) {
      const r = s instanceof Error ? s.message : String(s);
      throw new o(`Batch query embedding generation failed: ${r}`);
    }
  }
  /**
   * Warm embedding cache with common queries (Task 6.2)
   * @param collection - Collection to warm cache for
   * @param commonQueries - Array of frequently used queries
   * @returns Promise<void>
   */
  async warmEmbeddingCache(e, t) {
    if (!this.state.isOpen)
      throw new o("Database is not open");
    if (!this.workerRPC)
      throw new o("Worker not available");
    try {
      await this.workerRPC.warmEmbeddingCache({
        collection: e,
        commonQueries: t
      });
    } catch (s) {
      const r = s instanceof Error ? s.message : String(s);
      throw new o(`Embedding cache warming failed: ${r}`);
    }
  }
  /**
   * Clear embedding cache (Task 6.2)
   * @param collection - Optional specific collection to clear
   * @param pattern - Optional pattern for selective clearing
   * @returns Promise<void>
   */
  async clearEmbeddingCache(e, t) {
    if (!this.state.isOpen)
      throw new o("Database is not open");
    if (!this.workerRPC)
      throw new o("Worker not available");
    try {
      await this.workerRPC.clearEmbeddingCache({
        collection: e,
        pattern: t
      });
    } catch (s) {
      const r = s instanceof Error ? s.message : String(s);
      throw new o(`Embedding cache clearing failed: ${r}`);
    }
  }
  /**
   * Get embedding pipeline performance statistics (Task 6.2)
   * @returns Promise<PipelinePerformanceStats>
   */
  async getPipelineStats() {
    if (!this.state.isOpen)
      throw new o("Database is not open");
    if (!this.workerRPC)
      throw new o("Worker not available");
    try {
      return await this.workerRPC.getPipelineStats();
    } catch (e) {
      const t = e instanceof Error ? e.message : String(e);
      throw new o(`Pipeline stats retrieval failed: ${t}`);
    }
  }
  /**
   * Get model status information (Task 6.2)
   * @returns Promise<ModelStatusResult>
   */
  async getModelStatus() {
    if (!this.state.isOpen)
      throw new o("Database is not open");
    if (!this.workerRPC)
      throw new o("Worker not available");
    try {
      return await this.workerRPC.getModelStatus();
    } catch (e) {
      const t = e instanceof Error ? e.message : String(e);
      throw new o(`Model status retrieval failed: ${t}`);
    }
  }
  // ====================================
  // Phase 4: Collection Integration
  // ====================================
  /**
   * Create a new collection with optional embedding configuration
   */
  async createCollection(e) {
    if (!this.state.isOpen)
      throw new o("Database is not open");
    if (!this.workerRPC)
      throw new o("Worker not available");
    try {
      await this.workerRPC.createCollection(e);
    } catch (t) {
      const s = t instanceof Error ? t.message : String(t);
      throw new o(`Collection creation failed: ${s}`);
    }
  }
  /**
   * Get embedding status for a collection
   */
  async getCollectionEmbeddingStatus(e) {
    if (!this.state.isOpen)
      throw new o("Database is not open");
    if (!this.workerRPC)
      throw new o("Worker not available");
    try {
      return await this.workerRPC.getCollectionEmbeddingStatus(e);
    } catch (t) {
      const s = t instanceof Error ? t.message : String(t);
      throw new o(`Failed to get collection embedding status: ${s}`);
    }
  }
  /**
   * Insert a document with automatic embedding generation
   */
  async insertDocumentWithEmbedding(e) {
    if (!this.state.isOpen)
      throw new o("Database is not open");
    if (!this.workerRPC)
      throw new o("Worker not available");
    try {
      return await this.workerRPC.insertDocumentWithEmbedding(e);
    } catch (t) {
      const s = t instanceof Error ? t.message : String(t);
      throw new o(`Document insertion with embedding failed: ${s}`);
    }
  }
  /**
   * Batch insert multiple documents with automatic transaction management
   *
   * FIXED: Transaction now handled on worker side where inserts actually happen!
   *
   * Benefits:
   * - Reliability: Prevents FTS5 lock contention errors
   * - Performance: 10-100x faster than sequential inserts
   * - Atomicity: All documents inserted or none (rollback on error)
   * - Correctness: Transaction on same connection as inserts
   *
   * @example
   * ```typescript
   * const results = await db.batchInsertDocuments({
   *   collection: 'chunks',
   *   documents: [
   *     { id: 'chunk1', content: 'First chunk...' },
   *     { id: 'chunk2', content: 'Second chunk...' },
   *     { id: 'chunk3', content: 'Third chunk...' }
   *   ],
   *   options: { generateEmbedding: false }
   * });
   *
   * console.log(`Inserted ${results.length} documents`);
   * ```
   */
  async batchInsertDocuments(e) {
    if (!this.state.isOpen)
      throw new o("Database is not open");
    if (!this.workerRPC)
      throw new o("Worker not available");
    try {
      return await this.workerRPC.batchInsertDocuments(e);
    } catch (t) {
      const s = t instanceof Error ? t.message : String(t);
      throw new o(`Batch insert failed: ${s}`);
    }
  }
  /**
   * Perform semantic search on a collection
   */
  async searchSemantic(e) {
    if (!this.state.isOpen)
      throw new o("Database is not open");
    if (!this.workerRPC)
      throw new o("Worker not available");
    try {
      return await this.workerRPC.searchSemantic(e);
    } catch (t) {
      const s = t instanceof Error ? t.message : String(t);
      throw new o(`Semantic search failed: ${s}`);
    }
  }
  // ====================================
  // Phase 5: Embedding Queue Management
  // ====================================
  /**
   * Add documents to the embedding generation queue (Phase 5)
   * @param params - Queue parameters including collection, documents, and priority
   * @returns Promise<number> - Number of documents added to queue
   */
  async enqueueEmbedding(e) {
    if (!this.state.isOpen)
      throw new o("Database is not open");
    if (!this.workerRPC)
      throw new o("Worker not available");
    try {
      return await this.workerRPC.enqueueEmbedding(e);
    } catch (t) {
      const s = t instanceof Error ? t.message : String(t);
      throw new o(`Embedding queue enqueue failed: ${s}`);
    }
  }
  /**
   * Process pending embedding queue items (Phase 5)
   * @param params - Optional processing parameters including collection filter and batch size
   * @returns Promise<QueueProcessResult> - Processing results
   */
  async processEmbeddingQueue(e) {
    if (!this.state.isOpen)
      throw new o("Database is not open");
    if (!this.workerRPC)
      throw new o("Worker not available");
    try {
      return await this.workerRPC.processEmbeddingQueue(e);
    } catch (t) {
      const s = t instanceof Error ? t.message : String(t);
      throw new o(`Embedding queue processing failed: ${s}`);
    }
  }
  /**
   * Get embedding queue status and statistics (Phase 5)
   * @param collection - Optional collection name to filter results
   * @returns Promise<QueueStatusResult> - Current queue status
   */
  async getQueueStatus(e) {
    if (!this.state.isOpen)
      throw new o("Database is not open");
    if (!this.workerRPC)
      throw new o("Worker not available");
    try {
      return await this.workerRPC.getQueueStatus(e);
    } catch (t) {
      const s = t instanceof Error ? t.message : String(t);
      throw new o(`Queue status retrieval failed: ${s}`);
    }
  }
  /**
   * Clear embedding queue items (Phase 5)
   * @param params - Optional parameters to filter which items to clear
   * @returns Promise<number> - Number of items cleared
   */
  async clearEmbeddingQueue(e) {
    if (!this.state.isOpen)
      throw new o("Database is not open");
    if (!this.workerRPC)
      throw new o("Worker not available");
    try {
      return await this.workerRPC.clearEmbeddingQueue(e);
    } catch (t) {
      const s = t instanceof Error ? t.message : String(t);
      throw new o(`Queue clearing failed: ${s}`);
    }
  }
  /**
   * Preload embedding models (Task 6.2)
   * @param providers - Array of provider names to preload
   * @param strategy - Loading strategy (eager, lazy, predictive)
   * @returns Promise<void>
   */
  async preloadModels(e, t = "lazy") {
    if (!this.state.isOpen)
      throw new o("Database is not open");
    if (!this.workerRPC)
      throw new o("Worker not available");
    try {
      await this.workerRPC.preloadModels({
        providers: e,
        strategy: t
      });
    } catch (s) {
      const r = s instanceof Error ? s.message : String(s);
      throw new o(`Model preloading failed: ${r}`);
    }
  }
  /**
   * Optimize model memory usage (Task 6.2)
   * @param options - Memory optimization options
   * @returns Promise<void>
   */
  async optimizeModelMemory(e) {
    if (!this.state.isOpen)
      throw new o("Database is not open");
    if (!this.workerRPC)
      throw new o("Worker not available");
    try {
      await this.workerRPC.optimizeModelMemory(e);
    } catch (t) {
      const s = t instanceof Error ? t.message : String(t);
      throw new o(`Model memory optimization failed: ${s}`);
    }
  }
  /**
   * Initialize schema (LocalRetrieve extension)
   */
  async initializeSchema() {
    if (!this.state.isOpen)
      throw new o("Database is not open");
    if (!this.workerRPC)
      throw new o("Worker not available");
    try {
      await this.workerRPC.initializeSchema();
    } catch (e) {
      const t = e instanceof Error ? e.message : String(e);
      throw new o(`Schema initialization failed: ${t}`);
    }
  }
  /**
   * Get Worker RPC instance (for Statement class)
   */
  _getWorkerRPC() {
    return this.workerRPC;
  }
  /**
   * Initialize worker and open database connection
   */
  async _initialize() {
    if (!this.isInitialized) {
      if (!this.workerRPC)
        throw new o("Worker not initialized");
      try {
        await this.workerRPC.open({
          filename: this.state.filename,
          vfs: "opfs"
        }), this.state.isOpen = !0, this.isInitialized = !0;
      } catch (e) {
        const t = e instanceof Error ? e.message : String(e);
        throw new o(`Database initialization failed: ${t}`);
      }
    }
  }
  /**
   * Initialize worker RPC
   */
  _initializeWorker(e) {
    try {
      let t;
      e.workerUrl ? t = e.workerUrl : t = new URL("../database/worker.js", import.meta.url).toString(), console.log("[Database._initializeWorker] Attempting to load worker from:", t), this.workerRPC = B(t, e.workerConfig), this.state.worker = this.workerRPC.worker, this.state.workerRPC = this.workerRPC, console.log("[Database._initializeWorker] Worker RPC created successfully");
    } catch (t) {
      const s = t instanceof Error ? t.message : String(t);
      throw console.error("[Database._initializeWorker] Worker initialization failed:", t), new o(
        `Worker initialization failed: ${s}

Possible solutions:
1. Ensure the database worker file exists at the correct path
2. Check that your build process includes worker files
3. Verify COOP/COEP headers are set for SharedArrayBuffer support
4. Try providing an explicit workerUrl in the config`
      );
    }
  }
  /**
   * Import buffer data
   */
  async _importBuffer(e) {
    if (!this.workerRPC)
      throw new o("Worker not available");
    try {
      await this.workerRPC.import({
        data: e,
        format: "sqlite",
        overwrite: !0
      });
    } catch (t) {
      const s = t instanceof Error ? t.message : String(t);
      throw new o(`Buffer import failed: ${s}`);
    }
  }
  /**
   * Synchronous execution compatibility layer
   * Uses blocking async call with warnings about limitations
   */
  _execSyncCompat(e) {
    if (this.compatConfig.enableWarnings && console.warn("SYNC/ASYNC COMPATIBILITY WARNING: Using synchronous API with async Worker. Consider using execAsync() for better performance."), this.compatConfig.throwOnSyncLimitations)
      throw new u(
        `SYNC/ASYNC COMPATIBILITY ISSUE:
Worker communication is inherently async. SQL executed successfully but cannot return synchronously.
SOLUTIONS:
1. Use async API: await database.execAsync(sql) instead of database.exec(sql)
2. Use database.prepare() for prepared statements
3. Consider using sql.js directly on main thread for true sync operations

This is a known limitation of browser worker architecture.`
      );
    if (!this.workerRPC)
      throw new u("Worker not available");
    let t = !1, s = null, r = null;
    if (this.workerRPC.select({ sql: e }).then((i) => {
      s = i, t = !0;
    }).catch((i) => {
      r = i, t = !0;
    }), this.compatConfig.workerTimeout, !t)
      throw new u("Query execution timeout in sync compatibility mode");
    if (r) {
      const i = r instanceof Error ? r.message : String(r);
      throw new u(`Query execution failed: ${i}`);
    }
    return [L(s?.rows || [])];
  }
  /**
   * Synchronous run compatibility layer
   */
  _runSyncCompat(e, t) {
    if (this.compatConfig.enableWarnings && console.warn("SYNC/ASYNC COMPATIBILITY WARNING: Using synchronous API with async Worker. Consider using runAsync() for better performance."), !this.workerRPC)
      throw new u("Worker not available");
    let s = !1, r = null;
    if (this.workerRPC.exec({ sql: e, params: t }).then(() => {
      this.rowsModified++, s = !0;
    }).catch((i) => {
      r = i, s = !0;
    }), this.compatConfig.workerTimeout, !s)
      throw new u("Query execution timeout in sync compatibility mode");
    if (r) {
      const i = r instanceof Error ? r.message : String(r);
      throw new u(`Query execution failed: ${i}`);
    }
  }
  /**
   * Synchronous export compatibility layer
   */
  _exportSyncCompat() {
    if (this.compatConfig.enableWarnings && console.warn("SYNC/ASYNC COMPATIBILITY WARNING: Using synchronous export with async Worker. Consider using exportAsync() for better performance."), !this.workerRPC)
      throw new u("Worker not available");
    let e = !1, t = null, s = null;
    if (this.workerRPC.export().then((a) => {
      t = a, e = !0;
    }).catch((a) => {
      s = a, e = !0;
    }), this.compatConfig.workerTimeout, !e)
      throw new u("Export timeout in sync compatibility mode");
    if (s) {
      const a = s instanceof Error ? s.message : String(s);
      throw new u(`Export failed: ${a}`);
    }
    return t || new Uint8Array(0);
  }
  /**
   * Synchronous close compatibility layer
   */
  _closeSyncCompat() {
    if (!this.workerRPC)
      return;
    let e = null;
    if (this.workerRPC.close().then(() => {
    }).catch((s) => {
      e = s;
    }), e) {
      const s = e instanceof Error ? e.message : String(e);
      throw new u(`Close failed: ${s}`);
    }
  }
  // Enhanced error handling with graceful degradation (Task 6.1)
  async _handleSearchError(e, t, s) {
    if (!s?.mode || s.mode !== "VECTOR_ONLY")
      try {
        const a = await this.search({
          query: { text: t },
          collection: s?.collection,
          limit: s?.limit || 10
        });
        return {
          results: a.results,
          totalResults: a.totalResults,
          searchTime: a.searchTime,
          strategy: "keyword",
          suggestions: [],
          debugInfo: {
            queryAnalysis: {
              originalQuery: t,
              normalizedQuery: t,
              queryType: "unknown",
              confidence: 0.5,
              features: {
                wordCount: t.split(" ").length,
                hasQuestionWords: !1,
                hasBooleanOperators: !1,
                hasWildcards: !1,
                hasQuotes: !1,
                hasNumbers: !1,
                hasSpecialCharacters: !1,
                averageWordLength: 5,
                containsCommonStopWords: !1,
                estimatedIntent: "search"
              },
              suggestedStrategy: "keyword",
              alternativeStrategies: [],
              estimatedComplexity: "low"
            },
            executionPlan: {
              primaryStrategy: "keyword",
              fallbackStrategies: [],
              searchModes: [],
              fusion: {
                method: "rrf",
                weights: {
                  fts: 1,
                  vector: 0,
                  exactMatch: 1,
                  phraseMatch: 1,
                  proximity: 0.5,
                  freshness: 0.1,
                  popularity: 0.1
                },
                normalization: "none"
              },
              filters: {},
              pagination: { limit: s?.limit || 20, offset: 0 },
              performance: {}
            },
            timings: {
              analysis: 0,
              planning: 0,
              execution: a.searchTime,
              fusion: 0,
              total: a.searchTime
            },
            indexUsage: {
              ftsIndex: !0,
              vectorIndex: !1
            },
            warnings: ["Fell back to basic search due to enhanced search error"],
            recommendations: ["Consider using basic search() method for simple queries"]
          }
        };
      } catch (a) {
        const i = e instanceof Error ? e.message : String(e), n = a instanceof Error ? a.message : String(a);
        throw new o(`Search failed: ${i}, Fallback failed: ${n}`);
      }
    const r = e instanceof Error ? e.message : String(e);
    throw new o(`Text search failed: ${r}`);
  }
  async _handleAdvancedSearchError(e, t) {
    const s = e instanceof Error ? e.message : String(e);
    throw new o(`Advanced search failed: ${s}`);
  }
  async _handleGlobalSearchError(e, t, s) {
    const r = e instanceof Error ? e.message : String(e);
    throw new o(`Global search failed: ${r}`);
  }
}
class y {
  static {
    this.HTML_TAG_REGEX = /<[^>]*>/g;
  }
  static {
    this.HTML_ENTITY_REGEX = /&[a-zA-Z0-9#]+;/g;
  }
  static {
    this.MULTIPLE_WHITESPACE_REGEX = /\s+/g;
  }
  static {
    this.SPECIAL_CHARS_REGEX = /[^\w\s\u0400-\u04FF.,!?;:'"()\-]/g;
  }
  static {
    this.CHARS_PER_TOKEN = 4;
  }
  static {
    this.MARKDOWN_PATTERNS = [
      // Заголовки
      { pattern: /^#{1,6}\s+/gm, description: "headers" },
      // Жирный и курсивный текст
      { pattern: /\*\*([^*]+)\*\*/g, replacement: "$1", description: "bold" },
      { pattern: /__([^_]+)__/g, replacement: "$1", description: "bold_alt" },
      { pattern: /\*([^*]+)\*/g, replacement: "$1", description: "italic" },
      { pattern: /_([^_]+)_/g, replacement: "$1", description: "italic_alt" },
      // Зачеркнутый текст
      { pattern: /~~([^~]+)~~/g, replacement: "$1", description: "strikethrough" },
      // Код
      { pattern: /`([^`]+)`/g, replacement: "$1", description: "inline_code" },
      { pattern: /```[\s\S]*?```/g, replacement: "", description: "code_blocks" },
      // Ссылки
      { pattern: /\[([^\]]+)\]\([^)]+\)/g, replacement: "$1", description: "links" },
      { pattern: /!\[([^\]]*)\]\([^)]+\)/g, replacement: "$1", description: "images" },
      // Списки
      { pattern: /^[\s]*[-*+]\s+/gm, replacement: "", description: "unordered_lists" },
      { pattern: /^[\s]*\d+\.\s+/gm, replacement: "", description: "ordered_lists" },
      // Цитаты
      { pattern: /^>\s*/gm, replacement: "", description: "blockquotes" },
      // Горизонтальные линии
      { pattern: /^[-*_]{3,}$/gm, replacement: "", description: "horizontal_rules" },
      // Таблицы
      { pattern: /\|.*\|/g, replacement: "", description: "tables" }
    ];
  }
  constructor(e = {}) {
    this.config = {
      maxLength: e.maxLength ?? 8192,
      stripHtml: e.stripHtml ?? !0,
      stripMarkdown: e.stripMarkdown ?? !0,
      normalizeWhitespace: e.normalizeWhitespace ?? !0,
      toLowerCase: e.toLowerCase ?? !1,
      removeSpecialChars: e.removeSpecialChars ?? !1,
      customPreprocessor: e.customPreprocessor
    }, this.statistics = {
      totalProcessed: 0,
      averageProcessingTime: 0,
      truncatedCount: 0,
      averageOriginalLength: 0,
      averageProcessedLength: 0,
      resetTime: /* @__PURE__ */ new Date()
    };
  }
  /**
   * Основной метод предобработки текста
   *
   * @param text - Исходный текст для обработки
   * @param options - Дополнительные опции обработки
   * @returns Результат предобработки
   */
  processText(e, t = {}) {
    const s = performance.now();
    this.validateInput(e);
    const r = e.length, a = [], i = {};
    let n = e;
    const l = { ...this.config, ...t };
    if (l.stripHtml) {
      const p = this.removeHtml(n);
      n = p.text, i.removedHtmlTags = p.removedCount, p.removedCount > 0 && a.push("html_removal");
    }
    if (l.stripMarkdown) {
      const p = this.removeMarkdown(n);
      n = p.text, i.removedMarkdownElements = p.removedCount, p.removedCount > 0 && a.push("markdown_removal");
    }
    if (l.normalizeWhitespace) {
      const p = n.length;
      n = this.normalizeWhitespace(n), i.normalizedWhitespace = n.length !== p, i.normalizedWhitespace && a.push("whitespace_normalization");
    }
    if (l.toLowerCase && (n = n.toLowerCase(), i.convertedToLowerCase = !0, a.push("lowercase_conversion")), l.removeSpecialChars) {
      const p = n.length;
      n = this.removeSpecialCharacters(n), i.removedSpecialChars = p - n.length, i.removedSpecialChars > 0 && a.push("special_chars_removal");
    }
    if (l.customPreprocessor)
      try {
        n = new Function("text", l.customPreprocessor)(n) || n, a.push("custom_preprocessing");
      } catch (p) {
        console.warn("Custom preprocessor failed:", p);
      }
    const h = this.truncateText(n, {
      maxCharacters: l.maxLength,
      maxTokens: t.maxTokens,
      strategy: t.strategy,
      preserveWordBoundaries: t.preserveWordBoundaries,
      addTruncationIndicator: t.addTruncationIndicator,
      truncationIndicator: t.truncationIndicator
    });
    n = h.text;
    const f = h.wasTruncated;
    f && a.push("text_truncation");
    const m = n.length, d = Math.ceil(m / y.CHARS_PER_TOKEN), w = performance.now() - s;
    return this.updateStatistics(r, m, w, f), {
      processedText: n,
      originalLength: r,
      processedLength: m,
      estimatedTokens: d,
      wasTruncated: f,
      appliedOperations: a,
      metadata: i
    };
  }
  /**
   * Удаление HTML тегов и сущностей
   *
   * @param text - Текст с HTML разметкой
   * @returns Очищенный текст и количество удаленных элементов
   */
  removeHtml(e) {
    let t = 0;
    return {
      text: e.replace(y.HTML_TAG_REGEX, (a) => (t++, " ")).replace(y.HTML_ENTITY_REGEX, (a) => (t++, {
        "&amp;": "&",
        "&lt;": "<",
        "&gt;": ">",
        "&quot;": '"',
        "&#39;": "'",
        "&apos;": "'",
        "&nbsp;": " ",
        "&copy;": "©",
        "&reg;": "®",
        "&trade;": "™"
      }[a] || " ")),
      removedCount: t
    };
  }
  /**
   * Удаление Markdown разметки
   *
   * @param text - Текст с Markdown разметкой
   * @returns Очищенный текст и количество удаленных элементов
   */
  removeMarkdown(e) {
    let t = e, s = 0;
    for (const { pattern: r, replacement: a, description: i } of y.MARKDOWN_PATTERNS) {
      t.length, a !== void 0 ? t = t.replace(r, a) : t = t.replace(r, " ");
      const n = e.match(r);
      n && (s += n.length);
    }
    return {
      text: t,
      removedCount: s
    };
  }
  /**
   * Нормализация пробельных символов
   *
   * @param text - Исходный текст
   * @returns Нормализованный текст
   */
  normalizeWhitespace(e) {
    return e.replace(y.MULTIPLE_WHITESPACE_REGEX, " ").trim();
  }
  /**
   * Удаление специальных символов
   *
   * @param text - Исходный текст
   * @returns Очищенный текст
   */
  removeSpecialCharacters(e) {
    return e.replace(y.SPECIAL_CHARS_REGEX, " ");
  }
  /**
   * Обрезка текста до заданных лимитов
   *
   * @param text - Исходный текст
   * @param options - Опции обрезки
   * @returns Результат обрезки
   */
  truncateText(e, t = {}) {
    const {
      maxCharacters: s,
      maxTokens: r,
      strategy: a = "tail",
      preserveWordBoundaries: i = !0,
      addTruncationIndicator: n = !1,
      truncationIndicator: l = "..."
    } = t;
    let h = e.length;
    if (s !== void 0 && (h = Math.min(h, s)), r !== void 0) {
      const w = r * y.CHARS_PER_TOKEN;
      h = Math.min(h, w);
    }
    if (e.length <= h)
      return { text: e, wasTruncated: !1 };
    const f = n ? l.length : 0, m = h - f;
    if (m <= 0)
      return { text: l, wasTruncated: !0 };
    let d;
    switch (a) {
      case "head":
        d = e.substring(0, m);
        break;
      case "middle":
        const w = Math.floor(m / 2), p = e.substring(0, w), $ = e.substring(e.length - w);
        d = p + $;
        break;
      case "tail":
      default:
        d = e.substring(0, m);
        break;
    }
    if (i && d.length > 0) {
      const w = d.lastIndexOf(" ");
      w > m * 0.8 && (d = d.substring(0, w));
    }
    if (n)
      if (a === "middle") {
        const w = Math.floor(d.length / 2);
        d = d.substring(0, w) + l + d.substring(w);
      } else
        d += l;
    return { text: d, wasTruncated: !0 };
  }
  /**
   * Валидация входного текста
   *
   * @param text - Текст для валидации
   * @throws {ValidationError} При невалидном тексте
   */
  validateInput(e) {
    if (typeof e != "string")
      throw new C(
        "Input must be a string",
        "text",
        'typeof text === "string"'
      );
    if (e.length === 0)
      throw new C(
        "Input text cannot be empty",
        "text",
        "text.length > 0"
      );
    if (e.length > 1e6)
      throw new C(
        "Input text is too large (max 1M characters)",
        "text",
        "text.length <= 1000000"
      );
  }
  /**
   * Обновление статистики обработки
   *
   * @param originalLength - Исходная длина текста
   * @param processedLength - Длина после обработки
   * @param processingTime - Время обработки в миллисекундах
   * @param wasTruncated - Был ли текст обрезан
   */
  updateStatistics(e, t, s, r) {
    const a = this.statistics.averageProcessingTime * this.statistics.totalProcessed, i = this.statistics.averageOriginalLength * this.statistics.totalProcessed, n = this.statistics.averageProcessedLength * this.statistics.totalProcessed;
    this.statistics.totalProcessed += 1, this.statistics.averageProcessingTime = (a + s) / this.statistics.totalProcessed, this.statistics.averageOriginalLength = (i + e) / this.statistics.totalProcessed, this.statistics.averageProcessedLength = (n + t) / this.statistics.totalProcessed, r && (this.statistics.truncatedCount += 1);
  }
  /**
   * Получение статистики обработки
   *
   * @returns Текущая статистика
   */
  getStatistics() {
    return { ...this.statistics };
  }
  /**
   * Сброс статистики обработки
   */
  resetStatistics() {
    this.statistics = {
      totalProcessed: 0,
      averageProcessingTime: 0,
      truncatedCount: 0,
      averageOriginalLength: 0,
      averageProcessedLength: 0,
      resetTime: /* @__PURE__ */ new Date()
    };
  }
  /**
   * Обновление конфигурации обработки
   *
   * @param newConfig - Новая конфигурация
   */
  updateConfig(e) {
    this.config = { ...this.config, ...e };
  }
  /**
   * Получение текущей конфигурации
   *
   * @returns Текущая конфигурация
   */
  getConfig() {
    return { ...this.config };
  }
  /**
   * Оценка количества токенов в тексте
   *
   * @param text - Текст для оценки
   * @returns Приблизительное количество токенов
   */
  static estimateTokens(e) {
    return Math.ceil(e.length / y.CHARS_PER_TOKEN);
  }
  /**
   * Проверка, нужна ли предобработка для данного текста
   *
   * @param text - Текст для проверки
   * @param config - Конфигурация предобработки
   * @returns true, если предобработка может изменить текст
   */
  static needsPreprocessing(e, t) {
    if (t.stripHtml && (y.HTML_TAG_REGEX.test(e) || y.HTML_ENTITY_REGEX.test(e)))
      return !0;
    if (t.stripMarkdown) {
      for (const { pattern: s } of y.MARKDOWN_PATTERNS)
        if (s.test(e))
          return !0;
    }
    return !!(t.normalizeWhitespace && y.MULTIPLE_WHITESPACE_REGEX.test(e) || t.toLowerCase && e !== e.toLowerCase() || t.removeSpecialChars && y.SPECIAL_CHARS_REGEX.test(e) || t.maxLength && e.length > t.maxLength);
  }
  /**
   * Быстрая очистка текста с минимальными операциями
   *
   * @param text - Исходный текст
   * @returns Быстро очищенный текст
   */
  static quickClean(e) {
    return e.replace(y.HTML_TAG_REGEX, " ").replace(y.HTML_ENTITY_REGEX, " ").replace(y.MULTIPLE_WHITESPACE_REGEX, " ").trim();
  }
}
class g {
  static {
    this.hashCache = /* @__PURE__ */ new Map();
  }
  static {
    this.MAX_HASH_CACHE_SIZE = 1e3;
  }
  /**
   * Генерация стабильного хеша для ключа кеша
   *
   * @param config - Конфигурация для генерации ключа
   * @param options - Опции хеширования
   * @returns Результат хеширования
   */
  static async generateCacheKey(e, t = {}) {
    const {
      algorithm: s = "SHA-256",
      includeTimestamp: r = !1,
      salt: a = "",
      includeDebugInfo: i = !1
    } = t, n = {
      text: e.text,
      provider: e.collectionConfig?.provider || e.globalConfig?.defaultProvider,
      model: e.collectionConfig?.model || e.globalConfig?.defaultModel,
      dimensions: e.collectionConfig?.dimensions || e.globalConfig?.defaultDimensions,
      textPreprocessing: e.collectionConfig?.textPreprocessing,
      additionalParams: e.additionalParams,
      salt: a
    };
    r && (n.timestamp = Date.now());
    const l = g.sortObjectKeys(n), h = JSON.stringify(l), f = `${s}:${h}`;
    if (g.hashCache.has(f))
      return g.hashCache.get(f);
    const d = {
      hash: await g.hashString(h, s),
      algorithm: s,
      timestamp: /* @__PURE__ */ new Date(),
      input: i ? l : void 0
    };
    return g.addToHashCache(f, d), d;
  }
  /**
   * Генерация хеша текста с учетом предобработки
   *
   * @param text - Исходный текст
   * @param processingConfig - Конфигурация предобработки
   * @param options - Опции хеширования
   * @returns Результат хеширования
   */
  static async generateTextHash(e, t, s = {}) {
    const r = {
      text: e,
      additionalParams: {
        textPreprocessing: t
      }
    };
    return g.generateCacheKey(r, s);
  }
  /**
   * Хеширование строки с использованием Web Crypto API
   *
   * @param input - Строка для хеширования
   * @param algorithm - Алгоритм хеширования
   * @returns Хеш в виде hex строки
   */
  static async hashString(e, t = "SHA-256") {
    if (typeof crypto > "u" || !crypto.subtle)
      return g.simpleHash(e);
    try {
      const r = new TextEncoder().encode(e), a = await crypto.subtle.digest(t, r);
      return Array.from(new Uint8Array(a)).map((n) => n.toString(16).padStart(2, "0")).join("");
    } catch (s) {
      return console.warn("Web Crypto API failed, using simple hash:", s), g.simpleHash(e);
    }
  }
  /**
   * Простой хеш для fallback (djb2 algorithm)
   *
   * @param input - Строка для хеширования
   * @returns Хеш в виде hex строки
   */
  static simpleHash(e) {
    let t = 5381;
    for (let s = 0; s < e.length; s++)
      t = (t << 5) + t + e.charCodeAt(s);
    return Math.abs(t).toString(16);
  }
  /**
   * Синхронная генерация хеша для текста
   *
   * @param text - Текст для хеширования
   * @param options - Опции хеширования
   * @returns Результат хеширования
   */
  static hashText(e, t = {}) {
    const s = t.algorithm === "simple" ? "simple" : "djb2";
    return {
      hash: g.simpleHash(e),
      algorithm: s,
      timestamp: /* @__PURE__ */ new Date()
    };
  }
  /**
   * Сортировка ключей объекта для стабильного хеширования
   *
   * @param obj - Объект для сортировки
   * @returns Объект с отсортированными ключами
   */
  static sortObjectKeys(e) {
    if (e === null || typeof e != "object")
      return e;
    if (Array.isArray(e))
      return e.map((r) => g.sortObjectKeys(r));
    const t = Object.keys(e).sort(), s = {};
    for (const r of t)
      s[r] = g.sortObjectKeys(e[r]);
    return s;
  }
  /**
   * Добавление результата в кеш хешей
   *
   * @param key - Ключ кеша
   * @param result - Результат хеширования
   */
  static addToHashCache(e, t) {
    if (g.hashCache.size >= g.MAX_HASH_CACHE_SIZE) {
      const s = g.hashCache.keys().next().value;
      s !== void 0 && g.hashCache.delete(s);
    }
    g.hashCache.set(e, t);
  }
  /**
   * Очистка кеша хешей
   */
  static clearHashCache() {
    g.hashCache.clear();
  }
  /**
   * Валидация размерностей эмбеддинга
   *
   * @param embedding - Вектор эмбеддинга
   * @param expectedDimensions - Ожидаемая размерность
   * @returns Результат валидации
   */
  static validateEmbeddingDimensions(e, t) {
    const s = e.length, r = s === t;
    return {
      isValid: r,
      expectedDimensions: t,
      actualDimensions: s,
      error: r ? void 0 : `Expected ${t} dimensions, got ${s}`
    };
  }
  /**
   * Валидация конфигурации коллекции
   *
   * @param config - Конфигурация коллекции
   * @throws {ValidationError} При невалидной конфигурации
   */
  static validateCollectionConfig(e) {
    if (!e.provider)
      throw new C(
        "Provider is required in collection config",
        "provider",
        "must be specified"
      );
    if (!e.dimensions || e.dimensions <= 0)
      throw new C(
        "Dimensions must be a positive number",
        "dimensions",
        "dimensions > 0"
      );
    const t = [384, 512, 768, 1024, 1536, 3072];
    if (!t.includes(e.dimensions))
      throw new C(
        `Unsupported dimensions: ${e.dimensions}. Supported: ${t.join(", ")}`,
        "dimensions",
        `one of: ${t.join(", ")}`
      );
    if (e.batchSize && (e.batchSize <= 0 || e.batchSize > 1e3))
      throw new C(
        "Batch size must be between 1 and 1000",
        "batchSize",
        "1 <= batchSize <= 1000"
      );
    if (e.timeout && e.timeout < 1e3)
      throw new C(
        "Timeout must be at least 1000ms",
        "timeout",
        "timeout >= 1000"
      );
  }
  /**
   * Конвертация массива чисел в Float32Array
   *
   * @param array - Массив чисел
   * @returns Float32Array
   */
  static toFloat32Array(e) {
    if (e instanceof Float32Array)
      return e;
    if (Array.isArray(e))
      return new Float32Array(e);
    throw new C(
      "Input must be an array of numbers or Float32Array",
      "array",
      "Array<number> | Float32Array"
    );
  }
  /**
   * Создание глубокой копии объекта
   *
   * @param obj - Объект для копирования
   * @returns Глубокая копия объекта
   */
  static deepClone(e) {
    if (e === null || typeof e != "object")
      return e;
    if (e instanceof Date)
      return new Date(e.getTime());
    if (e instanceof Array)
      return e.map((t) => g.deepClone(t));
    if (e instanceof Float32Array)
      return new Float32Array(e);
    if (typeof e == "object") {
      const t = {};
      for (const s in e)
        e.hasOwnProperty(s) && (t[s] = g.deepClone(e[s]));
      return t;
    }
    return e;
  }
  /**
   * Слияние конфигураций с приоритетом
   *
   * @param base - Базовая конфигурация
   * @param override - Переопределяющая конфигурация
   * @returns Объединенная конфигурация
   */
  static mergeConfigs(e, t) {
    const s = g.deepClone(e);
    for (const r in t)
      if (t.hasOwnProperty(r)) {
        const a = t[r];
        a !== void 0 && (typeof a == "object" && !Array.isArray(a) && a !== null ? s[r] = g.mergeConfigs(
          s[r] || {},
          a
        ) : s[r] = a);
      }
    return s;
  }
  /**
   * Форматирование размера в человеко-читаемый формат
   *
   * @param bytes - Размер в байтах
   * @returns Отформатированная строка
   */
  static formatBytes(e) {
    if (e === 0) return "0 Bytes";
    const t = 1024, s = ["Bytes", "KB", "MB", "GB"], r = Math.floor(Math.log(e) / Math.log(t));
    return parseFloat((e / Math.pow(t, r)).toFixed(2)) + " " + s[r];
  }
  /**
   * Форматирование времени в человеко-читаемый формат
   *
   * @param milliseconds - Время в миллисекундах
   * @returns Отформатированная строка
   */
  static formatDuration(e) {
    if (e < 1e3)
      return `${Math.round(e)}ms`;
    const t = e / 1e3;
    if (t < 60)
      return `${t.toFixed(2)}s`;
    const s = t / 60;
    return s < 60 ? `${s.toFixed(2)}m` : `${(s / 60).toFixed(2)}h`;
  }
  /**
   * Создание таймера производительности
   *
   * @param operation - Название операции
   * @returns Объект для измерения производительности
   */
  static createPerformanceTimer(e) {
    return {
      startTime: performance.now(),
      operation: e,
      metadata: {}
    };
  }
  /**
   * Завершение измерения производительности
   *
   * @param timer - Объект таймера
   * @returns Завершенные метрики
   */
  static finishPerformanceTimer(e) {
    const t = performance.now();
    return {
      ...e,
      endTime: t,
      duration: t - e.startTime
    };
  }
  /**
   * Проверка поддержки Web Workers
   *
   * @returns true, если Web Workers поддерживаются
   */
  static supportsWebWorkers() {
    return typeof Worker < "u";
  }
  /**
   * Проверка поддержки SharedArrayBuffer
   *
   * @returns true, если SharedArrayBuffer поддерживается
   */
  static supportsSharedArrayBuffer() {
    return typeof SharedArrayBuffer < "u";
  }
  /**
   * Проверка поддержки OPFS (Origin Private File System)
   *
   * @returns Promise<boolean> - true, если OPFS поддерживается
   */
  static async supportsOPFS() {
    try {
      return "storage" in navigator && "getDirectory" in navigator.storage ? (await navigator.storage.getDirectory(), !0) : !1;
    } catch {
      return !1;
    }
  }
  /**
   * Получение информации о браузере
   *
   * @returns Информация о возможностях браузера
   */
  static async getBrowserCapabilities() {
    return {
      webWorkers: g.supportsWebWorkers(),
      sharedArrayBuffer: g.supportsSharedArrayBuffer(),
      opfs: await g.supportsOPFS(),
      webCrypto: typeof crypto < "u" && !!crypto.subtle,
      userAgent: navigator.userAgent
    };
  }
  /**
   * Генерация уникального ID
   *
   * @param prefix - Префикс для ID
   * @returns Уникальный идентификатор
   */
  static generateId(e = "emb") {
    const t = Date.now().toString(36), s = Math.random().toString(36).substring(2);
    return `${e}_${t}_${s}`;
  }
  /**
   * Безопасное парсинг JSON с обработкой ошибок
   *
   * @param jsonString - JSON строка
   * @param defaultValue - Значение по умолчанию при ошибке
   * @returns Распарсенный объект или значение по умолчанию
   */
  static safeJsonParse(e, t) {
    try {
      return JSON.parse(e);
    } catch {
      return t;
    }
  }
  /**
   * Безопасная сериализация в JSON
   *
   * @param value - Значение для сериализации
   * @param defaultValue - Значение по умолчанию при ошибке
   * @returns JSON строка или значение по умолчанию
   */
  static safeJsonStringify(e, t = "{}") {
    try {
      return JSON.stringify(e);
    } catch {
      return t;
    }
  }
  /**
   * Задержка выполнения
   *
   * @param milliseconds - Время задержки в миллисекундах
   * @returns Promise, который разрешается через указанное время
   */
  static delay(e) {
    return new Promise((t) => setTimeout(t, e));
  }
  /**
   * Дебаунс функции
   *
   * @param func - Функция для дебаунса
   * @param delay - Задержка в миллисекундах
   * @returns Дебаунсированная функция
   */
  static debounce(e, t) {
    let s;
    return (...r) => {
      clearTimeout(s), s = setTimeout(() => e(...r), t);
    };
  }
  /**
   * Троттлинг функции
   *
   * @param func - Функция для троттлинга
   * @param limit - Минимальный интервал между вызовами в миллисекундах
   * @returns Троттлированная функция
   */
  static throttle(e, t) {
    let s = !1;
    return (...r) => {
      s || (e(...r), s = !0, setTimeout(() => s = !1, t));
    };
  }
}
const A = {
  /** Поддерживаемые размерности векторов */
  SUPPORTED_DIMENSIONS: [384, 512, 768, 1024, 1536, 3072],
  /** Размеры батчей по умолчанию для разных провайдеров */
  DEFAULT_BATCH_SIZES: {
    transformers: 16,
    openai: 100,
    cohere: 100,
    huggingface: 32,
    custom: 32
  },
  /** Таймауты по умолчанию (в миллисекундах) */
  DEFAULT_TIMEOUTS: {
    local: 3e4,
    // 30 секунд для локальных моделей
    api: 6e4,
    // 60 секунд для API
    initialization: 12e4
    // 2 минуты для инициализации
  },
  /** Максимальные размеры текста для разных провайдеров */
  MAX_TEXT_LENGTHS: {
    transformers: 512,
    openai: 8192,
    cohere: 2048,
    huggingface: 512,
    custom: 512
  },
  /** Соотношение символов к токенам для разных языков */
  CHARS_PER_TOKEN: {
    english: 4,
    russian: 3,
    chinese: 1.5,
    default: 4
  },
  /** Алгоритмы хеширования */
  HASH_ALGORITHMS: ["SHA-256", "SHA-1", "MD5"],
  /** Версия схемы конфигурации */
  CONFIG_SCHEMA_VERSION: "1.0.0"
};
class te {
  /**
   * Генерация имени таблицы векторов для коллекции
   *
   * @param collectionId - ID коллекции
   * @param dimensions - Размерность векторов
   * @returns Имя таблицы векторов
   */
  static generateVectorTableName(e, t) {
    return `vec_${e}_${t}d`;
  }
  /**
   * Валидация ID коллекции
   *
   * @param collectionId - ID коллекции для валидации
   * @throws {ValidationError} При невалидном ID
   */
  static validateCollectionId(e) {
    if (!e || typeof e != "string")
      throw new C(
        "Collection ID must be a non-empty string",
        "collectionId",
        "non-empty string"
      );
    if (!/^[a-zA-Z0-9_-]+$/.test(e))
      throw new C(
        "Collection ID can only contain letters, numbers, underscores and hyphens",
        "collectionId",
        "matching pattern: /^[a-zA-Z0-9_-]+$/"
      );
    if (e.length > 50)
      throw new C(
        "Collection ID cannot be longer than 50 characters",
        "collectionId",
        "length <= 50"
      );
  }
  /**
   * Создание конфигурации коллекции по умолчанию
   *
   * @param provider - Тип провайдера
   * @param dimensions - Размерность векторов
   * @returns Конфигурация коллекции по умолчанию
   */
  static createDefaultCollectionConfig(e, t) {
    return {
      provider: e,
      dimensions: t,
      batchSize: A.DEFAULT_BATCH_SIZES[e],
      cacheEnabled: !0,
      timeout: e === "transformers" ? A.DEFAULT_TIMEOUTS.local : A.DEFAULT_TIMEOUTS.api,
      autoGenerate: !1,
      textPreprocessing: {
        maxLength: A.MAX_TEXT_LENGTHS[e],
        stripHtml: !0,
        stripMarkdown: !0,
        normalizeWhitespace: !0,
        toLowerCase: !1,
        removeSpecialChars: !1
      }
    };
  }
}
class F {
  constructor(e, t, s = null, r = null) {
    this.key = e, this.entry = t, this.prev = s, this.next = r;
  }
}
class se {
  /**
   * Создание нового экземпляра кэша эмбеддингов
   *
   * @param config - Конфигурация кэша
   */
  constructor(e = {}) {
    this.cache = /* @__PURE__ */ new Map(), this.head = null, this.tail = null, this.cleanupTimer = null, this.disposed = !1, this.config = {
      maxEntries: e.maxEntries ?? 1e3,
      maxSizeBytes: e.maxSizeBytes ?? 50 * 1024 * 1024,
      // 50MB
      enableLogging: e.enableLogging ?? !1,
      cleanupIntervalMs: e.cleanupIntervalMs ?? 5 * 60 * 1e3,
      // 5 минут
      maxEntryAge: e.maxEntryAge ?? 60 * 60 * 1e3,
      // 1 час
      enableDetailedMetrics: e.enableDetailedMetrics ?? !0
    }, this.metrics = this.createInitialMetrics(), this.config.cleanupIntervalMs > 0 && this.startCleanupTimer(), this.config.enableLogging && console.log("[MemoryCache] Инициализирован с конфигурацией:", this.config);
  }
  /**
   * Получение эмбеддинга из кэша
   *
   * @param text - Текст для поиска в кэше
   * @param collectionConfig - Конфигурация коллекции
   * @param globalConfig - Глобальная конфигурация
   * @returns Эмбеддинг из кэша или null если не найден
   */
  async get(e, t, s) {
    this.ensureNotDisposed();
    try {
      const r = {
        text: e,
        collectionConfig: t,
        globalConfig: s
      }, i = (await g.generateCacheKey(r)).hash;
      this.metrics.totalAccesses++;
      const n = this.cache.get(i);
      return n ? (n.entry.lastAccessedAt = /* @__PURE__ */ new Date(), n.entry.accessCount++, this.metrics.hits++, this.updateHitRate(), this.moveToHead(n), this.config.enableLogging && console.log(`[MemoryCache] Попадание в кэш для ключа: ${i.substring(0, 16)}...`), n.entry.embedding) : (this.metrics.misses++, this.updateHitRate(), this.config.enableLogging && console.log(`[MemoryCache] Промах кэша для ключа: ${i.substring(0, 16)}...`), null);
    } catch (r) {
      return this.config.enableLogging && console.error("[MemoryCache] Ошибка при получении из кэша:", r), null;
    }
  }
  /**
   * Сохранение эмбеддинга в кэш
   *
   * @param text - Исходный текст
   * @param embedding - Вектор эмбеддинга
   * @param collectionConfig - Конфигурация коллекции
   * @param globalConfig - Глобальная конфигурация
   * @param providerMetadata - Метаданные провайдера
   */
  async set(e, t, s, r, a) {
    this.ensureNotDisposed();
    try {
      const i = {
        text: e,
        collectionConfig: s,
        globalConfig: r
      }, l = (await g.generateCacheKey(i)).hash, h = this.calculateEntrySize(e, t, a);
      if (h > this.config.maxSizeBytes) {
        this.config.enableLogging && console.warn("[MemoryCache] Запись слишком большая для кэширования:", h);
        return;
      }
      const f = {
        embedding: new Float32Array(t),
        // Создаем копию
        keyHash: l,
        text: e,
        dimensions: t.length,
        createdAt: /* @__PURE__ */ new Date(),
        lastAccessedAt: /* @__PURE__ */ new Date(),
        accessCount: 1,
        sizeBytes: h,
        providerMetadata: a ? { ...a } : void 0
      }, m = this.cache.get(l);
      if (m) {
        this.metrics.totalSizeBytes -= m.entry.sizeBytes, m.entry = f, this.metrics.totalSizeBytes += h, this.moveToHead(m), this.config.enableLogging && console.log(`[MemoryCache] Обновлена запись для ключа: ${l.substring(0, 16)}...`);
        return;
      }
      this.evictIfNeeded(h);
      const d = new F(l, f);
      this.cache.set(l, d), this.addToHead(d), this.metrics.currentSize = this.cache.size, this.metrics.totalSizeBytes += h, this.config.enableLogging && console.log(`[MemoryCache] Добавлена новая запись для ключа: ${l.substring(0, 16)}...`);
    } catch (i) {
      throw this.config.enableLogging && console.error("[MemoryCache] Ошибка при сохранении в кэш:", i), new M(
        "Failed to save embedding to cache",
        "CACHE_SAVE_ERROR",
        "cache",
        { originalError: i }
      );
    }
  }
  /**
   * Проверка наличия записи в кэше
   *
   * @param text - Текст для проверки
   * @param collectionConfig - Конфигурация коллекции
   * @param globalConfig - Глобальная конфигурация
   * @returns true если запись найдена в кэше
   */
  async has(e, t, s) {
    this.ensureNotDisposed();
    try {
      const r = {
        text: e,
        collectionConfig: t,
        globalConfig: s
      }, a = await g.generateCacheKey(r);
      return this.cache.has(a.hash);
    } catch (r) {
      return this.config.enableLogging && console.error("[MemoryCache] Ошибка при проверке наличия в кэше:", r), !1;
    }
  }
  /**
   * Получение метрик производительности кэша
   *
   * @returns Текущие метрики кэша
   */
  getMetrics() {
    return this.ensureNotDisposed(), { ...this.metrics };
  }
  /**
   * Сброс метрик производительности
   */
  resetMetrics() {
    this.ensureNotDisposed();
    const e = this.cache.size, t = this.metrics.totalSizeBytes;
    this.metrics = {
      ...this.createInitialMetrics(),
      currentSize: e,
      totalSizeBytes: t
    }, this.config.enableLogging && console.log("[MemoryCache] Метрики сброшены");
  }
  /**
   * Очистка всех записей из кэша
   */
  clear() {
    this.ensureNotDisposed(), this.cache.clear(), this.head = null, this.tail = null, this.metrics.currentSize = 0, this.metrics.totalSizeBytes = 0, this.config.enableLogging && console.log("[MemoryCache] Кэш очищен");
  }
  /**
   * Ручная очистка устаревших записей
   *
   * @returns Количество удаленных записей
   */
  cleanup() {
    this.ensureNotDisposed();
    const e = Date.now(), t = this.config.maxEntryAge;
    let s = 0;
    for (const [r, a] of this.cache.entries())
      e - a.entry.createdAt.getTime() > t && (this.removeNode(a), this.cache.delete(r), s++);
    return this.metrics.currentSize = this.cache.size, this.metrics.evictions += s, this.config.enableLogging && s > 0 && console.log(`[MemoryCache] Удалено ${s} устаревших записей`), s;
  }
  /**
   * Получение информации о размере кэша
   *
   * @returns Информация о размере
   */
  getSizeInfo() {
    this.ensureNotDisposed();
    const e = Math.max(
      this.metrics.currentSize / this.config.maxEntries,
      this.metrics.totalSizeBytes / this.config.maxSizeBytes
    ) * 100;
    return {
      entries: this.metrics.currentSize,
      maxEntries: this.config.maxEntries,
      sizeBytes: this.metrics.totalSizeBytes,
      maxSizeBytes: this.config.maxSizeBytes,
      utilizationPercent: Math.round(e * 100) / 100
    };
  }
  /**
   * Освобождение ресурсов кэша
   */
  dispose() {
    this.disposed || (this.cleanupTimer && (clearInterval(this.cleanupTimer), this.cleanupTimer = null), this.clear(), this.disposed = !0, this.config.enableLogging && console.log("[MemoryCache] Ресурсы освобождены"));
  }
  // === Приватные методы ===
  /**
   * Создание начальных метрик
   */
  createInitialMetrics() {
    const e = /* @__PURE__ */ new Date();
    return {
      totalAccesses: 0,
      hits: 0,
      misses: 0,
      evictions: 0,
      currentSize: 0,
      maxSize: this.config.maxEntries,
      totalSizeBytes: 0,
      maxSizeBytes: this.config.maxSizeBytes,
      hitRate: 0,
      missRate: 0,
      lastResetAt: e,
      createdAt: e
    };
  }
  /**
   * Обновление коэффициентов попаданий и промахов
   */
  updateHitRate() {
    this.metrics.totalAccesses > 0 ? (this.metrics.hitRate = this.metrics.hits / this.metrics.totalAccesses, this.metrics.missRate = this.metrics.misses / this.metrics.totalAccesses) : (this.metrics.hitRate = 0, this.metrics.missRate = 0);
  }
  /**
   * Вычисление размера записи в байтах
   */
  calculateEntrySize(e, t, s) {
    const r = e.length * 2, a = t.length * 4, i = s ? JSON.stringify(s).length * 2 : 0;
    return r + a + i + 200;
  }
  /**
   * Вытеснение записей при необходимости
   */
  evictIfNeeded(e) {
    for (; this.cache.size >= this.config.maxEntries && this.tail; )
      this.evictLRU();
    for (; this.metrics.totalSizeBytes + e > this.config.maxSizeBytes && this.tail; )
      this.evictLRU();
  }
  /**
   * Вытеснение наименее используемой записи
   */
  evictLRU() {
    if (!this.tail)
      return;
    const e = this.tail;
    this.removeNode(e), this.cache.delete(e.key), this.metrics.evictions++, this.metrics.currentSize = this.cache.size, this.metrics.totalSizeBytes -= e.entry.sizeBytes, this.config.enableLogging && console.log(`[MemoryCache] Вытеснена запись: ${e.key.substring(0, 16)}...`);
  }
  /**
   * Добавление узла в начало списка
   */
  addToHead(e) {
    e.prev = null, e.next = this.head, this.head && (this.head.prev = e), this.head = e, this.tail || (this.tail = e);
  }
  /**
   * Удаление узла из списка
   */
  removeNode(e) {
    e.prev ? e.prev.next = e.next : this.head = e.next, e.next ? e.next.prev = e.prev : this.tail = e.prev;
  }
  /**
   * Перемещение узла в начало списка
   */
  moveToHead(e) {
    this.removeNode(e), this.addToHead(e);
  }
  /**
   * Запуск таймера автоматической очистки
   */
  startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      try {
        this.cleanup();
      } catch (e) {
        this.config.enableLogging && console.error("[MemoryCache] Ошибка при автоматической очистке:", e);
      }
    }, this.config.cleanupIntervalMs);
  }
  /**
   * Проверка, что кэш не был освобожден
   */
  ensureNotDisposed() {
    if (this.disposed)
      throw new M(
        "Cache has been disposed",
        "CACHE_DISPOSED"
      );
  }
}
const S = {
  DIMENSIONS: {
    SMALL: 384,
    MEDIUM: 768,
    LARGE: 1536
  },
  BATCH_SIZE: {
    LOCAL: 32,
    EXTERNAL: 100
  },
  TIMEOUT: {
    DEFAULT: 3e4,
    LOCAL: 6e4,
    EXTERNAL: 3e4
  },
  CACHE: {
    MAX_SIZE: 1e4,
    TTL: 24 * 60 * 60 * 1e3
    // 24 hours
  },
  TEXT_LIMITS: {
    MAX_LENGTH: 8192,
    ESTIMATED_TOKENS_PER_CHAR: 0.25
  }
}, re = {
  transformers: {
    name: "Transformers.js",
    type: "local",
    description: "Local embedding generation using Transformers.js",
    requiresApiKey: !1,
    supportedDimensions: [384]
  },
  openai: {
    name: "OpenAI Embeddings",
    type: "external",
    description: "OpenAI text-embedding-3-small and text-embedding-3-large models",
    requiresApiKey: !0,
    supportedDimensions: [384, 768, 1536, 256, 512, 1024, 3072]
  },
  cohere: {
    name: "Cohere Embeddings",
    type: "external",
    description: "Cohere embedding models (coming soon)",
    requiresApiKey: !0,
    supportedDimensions: [384, 768, 1024]
  },
  huggingface: {
    name: "Hugging Face",
    type: "external",
    description: "Hugging Face Inference API (coming soon)",
    requiresApiKey: !0,
    supportedDimensions: [384, 768, 1024]
  },
  custom: {
    name: "Custom Provider",
    type: "external",
    description: "Custom embedding provider implementation",
    requiresApiKey: !1,
    supportedDimensions: []
  }
};
async function ae(c) {
  return R.createProvider(c);
}
function ie(c) {
  return R.validateConfiguration(c);
}
function ne(c) {
  const {
    dimensions: e = S.DIMENSIONS.SMALL,
    offline: t = !1,
    budget: s = "medium",
    performance: r = "balanced",
    apiKey: a
  } = c;
  if (t || !a)
    return {
      provider: "transformers",
      model: "all-MiniLM-L6-v2",
      dimensions: S.DIMENSIONS.SMALL,
      // Transformers.js поддерживает только 384
      batchSize: S.BATCH_SIZE.LOCAL,
      cacheEnabled: !0,
      autoGenerate: !0,
      timeout: S.TIMEOUT.LOCAL
    };
  const i = H({ dimensions: e, budget: s, performance: r });
  return {
    provider: "openai",
    model: i.model,
    dimensions: i.dimensions,
    apiKey: a,
    batchSize: S.BATCH_SIZE.EXTERNAL,
    cacheEnabled: !0,
    autoGenerate: !0,
    timeout: S.TIMEOUT.EXTERNAL
  };
}
function oe(c, e) {
  const t = [], s = [];
  let r = !1;
  return c.dimensions !== e.dimensions && (t.push("Dimension mismatch"), r = !0, s.push("All embeddings will need to be regenerated")), c.provider !== e.provider && (t.push("Provider change"), r = !0, s.push("Embeddings from different providers may not be compatible")), c.model !== e.model && (t.push("Model change"), r = !0, s.push("Different models produce different embeddings")), {
    compatible: t.length === 0,
    requiresRegeneration: r,
    issues: t,
    recommendations: s
  };
}
class Q {
  constructor(e, t) {
    this.cacheManager = e, this.modelManager = t, this.stats = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalGenerationTime: 0,
      cacheHitsByLevel: /* @__PURE__ */ new Map()
    }, this.providers = /* @__PURE__ */ new Map(), this.collectionConfigs = /* @__PURE__ */ new Map();
  }
  /**
   * Генерация эмбеддинга для поискового запроса с многоуровневым кэшированием
   */
  async generateQueryEmbedding(e, t, s) {
    const r = Date.now();
    this.stats.totalRequests++;
    try {
      if (this.validateInputs(e, t), !s?.forceRefresh) {
        const d = await this.getCachedEmbedding(e, t);
        if (d)
          return this.stats.cacheHits++, this.updateCacheHitStats(d.source), d;
      }
      this.stats.cacheMisses++;
      const a = await this.getProviderForCollection(t), i = s?.timeout || 5e3, n = this.generateFreshEmbedding(e, a), l = new Promise(
        (d, w) => setTimeout(() => w(new W(`Embedding generation timeout after ${i}ms`, i, "generateQueryEmbedding")), i)
      ), h = await Promise.race([n, l]), f = Date.now() - r;
      this.stats.totalGenerationTime += f;
      const m = {
        embedding: h,
        dimensions: h.length,
        source: "provider_fresh",
        processingTime: f,
        metadata: {
          cacheHit: !1,
          modelUsed: a.getModelInfo?.()?.name,
          provider: this.getProviderType(a),
          confidence: 1
        }
      };
      return this.saveToCacheAsync(e, t, m).catch(
        (d) => console.warn("Failed to cache embedding result:", d)
      ), m;
    } catch (a) {
      const i = Date.now() - r;
      throw this.stats.totalGenerationTime += i, a instanceof M ? a : new M(
        `Failed to generate query embedding: ${a instanceof Error ? a.message : String(a)}`,
        "GENERATION_FAILED",
        "provider",
        { query: e.substring(0, 100), collection: t }
      );
    }
  }
  /**
   * Batch генерация эмбеддингов с управлением прогрессом
   */
  async batchGenerateEmbeddings(e, t) {
    if (e.length === 0)
      return [];
    const s = t?.batchSize || 32, r = t?.concurrency || 3, a = [], i = [];
    for (let f = 0; f < e.length; f += s)
      i.push(e.slice(f, f + s));
    let n = 0;
    const l = e.length, h = async (f) => {
      const m = [];
      for (const d of f)
        try {
          t?.onProgress?.(n, l, d.query.substring(0, 50) + "...");
          const w = await this.generateQueryEmbedding(
            d.query,
            d.collection,
            d.options
          );
          m.push({
            requestId: d.id,
            ...w,
            status: "completed"
          }), n++;
        } catch (w) {
          m.push({
            requestId: d.id,
            embedding: new Float32Array(0),
            dimensions: 0,
            source: "provider_fresh",
            processingTime: 0,
            status: "failed",
            error: w instanceof Error ? w.message : String(w)
          }), n++;
        }
      return m;
    };
    for (let f = 0; f < i.length; f += r) {
      const d = i.slice(f, f + r).map(h), w = await Promise.all(d);
      a.push(...w.flat());
    }
    return t?.onProgress?.(n, l, "Completed"), a;
  }
  /**
   * Получение кэшированного эмбеддинга с проверкой всех уровней
   */
  async getCachedEmbedding(e, t) {
    const s = this.generateCacheKey(e, t);
    try {
      const r = await this.cacheManager.get(s, "memory");
      if (r)
        return {
          ...r,
          source: "cache_memory",
          metadata: { ...r.metadata, cacheHit: !0 }
        };
      const a = await this.cacheManager.get(s, "indexeddb");
      if (a)
        return await this.cacheManager.set(s, a, { level: "memory", ttl: 3e5 }), {
          ...a,
          source: "cache_indexeddb",
          metadata: { ...a.metadata, cacheHit: !0 }
        };
      const i = await this.cacheManager.get(s, "database");
      return i ? (await Promise.all([
        this.cacheManager.set(s, i, { level: "memory", ttl: 3e5 }),
        this.cacheManager.set(s, i, { level: "indexeddb", ttl: 864e5 })
        // 24 часа
      ]), {
        ...i,
        source: "cache_database",
        metadata: { ...i.metadata, cacheHit: !0 }
      }) : null;
    } catch (r) {
      return console.warn(`Cache lookup failed for query "${e.substring(0, 50)}":`, r), null;
    }
  }
  /**
   * Предварительный прогрев кэша для популярных запросов
   */
  async warmCache(e, t) {
    const r = e.map((a, i) => ({
      id: `warmup-${i}`,
      query: a,
      collection: t,
      options: { priority: 0 }
      // Низкий приоритет для прогрева
    }));
    await this.batchGenerateEmbeddings(r, {
      batchSize: 10,
      concurrency: 2,
      onProgress: (a, i) => {
        console.log(`Cache warming progress: ${a}/${i}`);
      }
    });
  }
  /**
   * Очистка кэшей и освобождение ресурсов
   */
  async clearCache(e) {
    if (e) {
      const t = `*:${e}:*`;
      await this.cacheManager.invalidate(t);
    } else
      await this.cacheManager.invalidate("*");
    this.stats.cacheHitsByLevel.clear();
  }
  /**
   * Получение статистики производительности
   */
  getPerformanceStats() {
    const e = this.stats.totalRequests > 0 ? this.stats.cacheHits / this.stats.totalRequests * 100 : 0, t = this.stats.totalRequests > 0 ? this.stats.totalGenerationTime / this.stats.totalRequests : 0;
    return {
      totalRequests: this.stats.totalRequests,
      cacheHitRate: e,
      averageGenerationTime: t,
      activeModels: this.modelManager.getModelStatus().loadedModels.length,
      memoryUsage: this.estimateMemoryUsage(),
      cacheStats: {
        memory: {
          hits: this.stats.cacheHitsByLevel.get("cache_memory") || 0,
          misses: this.stats.cacheMisses
        },
        indexedDB: {
          hits: this.stats.cacheHitsByLevel.get("cache_indexeddb") || 0,
          misses: 0
          // Будет реализовано в CacheManager
        },
        database: {
          hits: this.stats.cacheHitsByLevel.get("cache_database") || 0,
          misses: 0
          // Будет реализовано в CacheManager
        }
      }
    };
  }
  // === Приватные методы ===
  /**
   * Валидация входных параметров
   */
  validateInputs(e, t) {
    if (!e || typeof e != "string" || e.trim().length === 0)
      throw new P("Query must be a non-empty string", "query", "non-empty string", e);
    if (e.length > 8192)
      throw new P("Query is too long (max 8192 characters)", "query", "string with length <= 8192", e.length);
    if (!t || typeof t != "string")
      throw new P("Collection must be specified", "collection", "non-empty string", t);
  }
  /**
   * Получение провайдера для коллекции
   */
  async getProviderForCollection(e) {
    if (this.providers.has(e))
      return this.providers.get(e);
    const t = await this.getCollectionConfig(e), s = await R.createProvider(t);
    return this.providers.set(e, s), this.collectionConfigs.set(e, t), s;
  }
  /**
   * Генерация свежего эмбеддинга через провайдера
   */
  async generateFreshEmbedding(e, t) {
    const s = await t.generateEmbedding(e);
    if (!s.success || !s.embedding)
      throw new M(
        "Provider failed to generate embedding",
        "PROVIDER_ERROR",
        "provider",
        { error: s.error }
      );
    return s.embedding;
  }
  /**
   * Асинхронное сохранение в кэш
   */
  async saveToCacheAsync(e, t, s) {
    const r = this.generateCacheKey(e, t);
    try {
      await Promise.all([
        this.cacheManager.set(r, s, { level: "memory", ttl: 3e5 }),
        // 5 мин
        this.cacheManager.set(r, s, { level: "indexeddb", ttl: 864e5 }),
        // 24 часа
        this.cacheManager.set(r, s, { level: "database", ttl: 6048e5 })
        // 7 дней
      ]);
    } catch (a) {
      console.warn("Failed to save to cache:", a);
    }
  }
  /**
   * Генерация ключа кэша
   */
  generateCacheKey(e, t) {
    const s = this.collectionConfigs.get(t), r = s ? g.hashText(JSON.stringify(s), { algorithm: "simple" }).hash : "default", a = g.hashText(e.trim().toLowerCase(), { algorithm: "simple" }).hash;
    return `embedding:${t}:${r}:${a}`;
  }
  /**
   * Получение конфигурации коллекции (заглушка)
   */
  async getCollectionConfig(e) {
    return {
      provider: "transformers",
      model: "all-MiniLM-L6-v2",
      dimensions: 384,
      batchSize: 32,
      cacheEnabled: !0,
      autoGenerate: !0,
      timeout: 3e4
    };
  }
  /**
   * Получение типа провайдера
   */
  getProviderType(e) {
    return e.getModelInfo?.()?.provider || "unknown";
  }
  /**
   * Обновление статистики попаданий в кэш
   */
  updateCacheHitStats(e) {
    const t = this.stats.cacheHitsByLevel.get(e) || 0;
    this.stats.cacheHitsByLevel.set(e, t + 1);
  }
  /**
   * Оценка использования памяти
   */
  estimateMemoryUsage() {
    let e = 0;
    return e += this.providers.size * 10, e += this.modelManager.getModelStatus().loadedModels.length * 50, e += 20, e;
  }
}
async function ce(c, e) {
  return new Q(c, e);
}
class q {
  constructor(e = {}) {
    this.models = /* @__PURE__ */ new Map(), this.modelConfigs = /* @__PURE__ */ new Map(), this.memoryLimit = e.memoryLimit || 500, this.maxModels = e.maxModels || 5, this.idleTimeout = e.idleTimeout || 10 * 60 * 1e3, this.cleanupInterval = null, this.stats = {
      totalLoads: 0,
      totalUnloads: 0,
      cacheHits: 0,
      cacheMisses: 0,
      avgLoadTime: 0
    }, this.startCleanupTimer(e.cleanupInterval || 5 * 60 * 1e3);
  }
  /**
   * Загрузка модели с кэшированием и оптимизацией
   */
  async loadModel(e, t) {
    const s = this.generateModelId(e, t);
    if (this.models.has(s)) {
      const r = this.models.get(s);
      if (r.status === "ready")
        return r.lastUsed = Date.now(), r.usageCount++, this.stats.cacheHits++, {
          config: this.modelConfigs.get(s),
          provider: r.providerInstance,
          metrics: this.getModelMetrics(s)
        };
      if (r.status === "loading")
        return this.waitForModelLoad(s);
      r.status === "error" && (this.models.delete(s), this.modelConfigs.delete(s));
    }
    return this.stats.cacheMisses++, await this.ensureResourcesAvailable(), this.loadNewModel(e, t, s);
  }
  /**
   * Предзагрузка моделей по стратегии
   */
  async preloadModels(e) {
    const s = this.getModelsForPreloading(e).map(async ({ provider: r, model: a }) => {
      try {
        await this.loadModel(r, a);
      } catch (i) {
        console.warn(`Failed to preload model ${r}:${a}:`, i);
      }
    });
    await Promise.all(s);
  }
  /**
   * Оптимизация использования памяти
   */
  async optimizeMemory(e) {
    const {
      maxMemoryUsage: t = this.memoryLimit,
      maxModels: s = this.maxModels,
      idleTimeout: r = this.idleTimeout,
      aggressive: a = !1
    } = e || {}, i = this.getTotalMemoryUsage(), n = this.models.size, l = Array.from(this.models.values()).filter((m) => a ? !0 : Date.now() - m.lastUsed > r).sort((m, d) => {
      const w = m.lastUsed + m.usageCount * 1e3, p = d.lastUsed + d.usageCount * 1e3;
      return w - p;
    });
    let h = 0, f = 0;
    for (const m of l) {
      if (!(i - h > t || n - f > s)) break;
      try {
        await this.unloadModel(m.modelId), h += m.memoryUsage, f++;
      } catch (w) {
        console.warn(`Failed to unload model ${m.modelId}:`, w);
      }
    }
    console.log(`Memory optimization completed: freed ${h}MB, unloaded ${f} models`);
  }
  /**
   * Получение статуса всех моделей
   */
  getModelStatus() {
    const e = Array.from(this.models.values()), t = this.getTotalMemoryUsage(), s = e.filter((a) => a.status === "ready").length, r = {};
    for (const a of e) {
      r[a.provider] || (r[a.provider] = {
        count: 0,
        memoryUsage: 0,
        avgLoadTime: 0,
        totalLoadTime: 0
      });
      const i = r[a.provider];
      i.count++, i.memoryUsage += a.memoryUsage, i.totalLoadTime += a.loadTime, i.avgLoadTime = i.totalLoadTime / i.count;
    }
    return {
      loadedModels: e,
      totalMemoryUsage: t,
      activeCount: s,
      providerStats: r
    };
  }
  /**
   * Выгрузка неиспользуемых моделей
   */
  async unloadUnusedModels() {
    const e = Date.now() - this.idleTimeout, t = Array.from(this.models.values()).filter((r) => r.lastUsed < e && r.status !== "loading"), s = t.map((r) => this.unloadModel(r.modelId));
    await Promise.all(s), console.log(`Unloaded ${t.length} unused models`);
  }
  /**
   * Получение модели для коллекции
   */
  async getModelForCollection(e) {
    const t = await this.getCollectionConfig(e);
    if (!t) return null;
    try {
      return await this.loadModel(t.provider, t.model);
    } catch (s) {
      return console.error(`Failed to load model for collection ${e}:`, s), null;
    }
  }
  /**
   * Прогрев модели
   */
  async warmModel(e) {
    const t = this.models.get(e);
    if (!(!t || t.status !== "ready"))
      try {
        await t.providerInstance.generateEmbedding("test warmup query"), console.log(`Model ${e} warmed up successfully`);
      } catch (s) {
        console.warn(`Failed to warm up model ${e}:`, s);
      }
  }
  // === Приватные методы ===
  /**
   * Загрузка новой модели
   */
  async loadNewModel(e, t, s) {
    const r = Date.now(), a = {
      provider: e,
      model: t || this.getDefaultModelForProvider(e),
      dimensions: this.getDimensionsForProvider(e),
      batchSize: 32,
      cacheEnabled: !0,
      autoGenerate: !0,
      timeout: 3e4
    }, i = {
      modelId: s,
      provider: e,
      modelName: a.model,
      dimensions: a.dimensions,
      providerInstance: null,
      // Будет установлено после загрузки
      lastUsed: Date.now(),
      usageCount: 0,
      memoryUsage: this.estimateModelMemoryUsage(e),
      loadTime: 0,
      status: "loading"
    };
    this.models.set(s, i), this.modelConfigs.set(s, a);
    try {
      const n = await R.createProvider(a), l = Date.now() - r;
      return i.providerInstance = n, i.loadTime = l, i.status = "ready", i.usageCount = 1, this.stats.totalLoads++, this.stats.avgLoadTime = (this.stats.avgLoadTime * (this.stats.totalLoads - 1) + l) / this.stats.totalLoads, console.log(`Model ${s} loaded successfully in ${l}ms`), {
        config: a,
        provider: n,
        metrics: this.getModelMetrics(s)
      };
    } catch (n) {
      throw i.status = "error", i.error = n instanceof Error ? n.message : String(n), new x(
        `Failed to load model ${s}: ${i.error}`,
        e,
        s,
        void 0,
        { model: t }
      );
    }
  }
  /**
   * Выгрузка модели
   */
  async unloadModel(e) {
    const t = this.models.get(e);
    if (t) {
      t.status = "unloading";
      try {
        t.providerInstance && typeof t.providerInstance.dispose == "function" && await t.providerInstance.dispose(), this.models.delete(e), this.modelConfigs.delete(e), this.stats.totalUnloads++, console.log(`Model ${e} unloaded successfully`);
      } catch (s) {
        console.warn(`Failed to properly unload model ${e}:`, s), this.models.delete(e), this.modelConfigs.delete(e);
      }
    }
  }
  /**
   * Ожидание завершения загрузки модели
   */
  async waitForModelLoad(e) {
    const r = Date.now();
    for (; Date.now() - r < 3e4; ) {
      const a = this.models.get(e);
      if (!a)
        throw new x(`Model ${e} was removed during loading`, "unknown", e);
      if (a.status === "ready")
        return a.lastUsed = Date.now(), a.usageCount++, {
          config: this.modelConfigs.get(e),
          provider: a.providerInstance,
          metrics: this.getModelMetrics(e)
        };
      if (a.status === "error")
        throw new x(`Model ${e} failed to load: ${a.error}`, "unknown", e);
      await new Promise((i) => setTimeout(i, 100));
    }
    throw new x(`Model ${e} loading timeout`, "unknown", e);
  }
  /**
   * Обеспечение доступности ресурсов
   */
  async ensureResourcesAvailable() {
    const e = this.getTotalMemoryUsage(), t = this.models.size;
    (e > this.memoryLimit || t >= this.maxModels) && await this.optimizeMemory({
      maxMemoryUsage: this.memoryLimit * 0.8,
      // Освобождаем до 80% лимита
      maxModels: this.maxModels - 1
      // Оставляем место для новой модели
    });
  }
  /**
   * Получение общего использования памяти
   */
  getTotalMemoryUsage() {
    return Array.from(this.models.values()).reduce((e, t) => e + t.memoryUsage, 0);
  }
  /**
   * Генерация ID модели
   */
  generateModelId(e, t) {
    const s = t || this.getDefaultModelForProvider(e);
    return `${e}:${s}`;
  }
  /**
   * Получение модели по умолчанию для провайдера
   */
  getDefaultModelForProvider(e) {
    return {
      transformers: "all-MiniLM-L6-v2",
      openai: "text-embedding-3-small",
      cohere: "embed-english-light-v3.0",
      huggingface: "sentence-transformers/all-MiniLM-L6-v2",
      custom: "custom-model"
    }[e] || "unknown-model";
  }
  /**
   * Получение размерности для провайдера
   */
  getDimensionsForProvider(e) {
    return {
      transformers: 384,
      openai: 1536,
      cohere: 1024,
      huggingface: 384,
      custom: 384
    }[e] || 384;
  }
  /**
   * Оценка использования памяти моделью
   */
  estimateModelMemoryUsage(e) {
    return {
      transformers: 100,
      // ~100MB для all-MiniLM-L6-v2
      openai: 5,
      // ~5MB для API клиента
      cohere: 5,
      // ~5MB для API клиента
      huggingface: 80,
      // ~80MB в среднем
      custom: 50
      // ~50MB по умолчанию
    }[e] || 50;
  }
  /**
   * Получение конфигурации коллекции (заглушка)
   */
  async getCollectionConfig(e) {
    return {
      provider: "transformers",
      model: "all-MiniLM-L6-v2",
      dimensions: 384,
      batchSize: 32,
      cacheEnabled: !0,
      autoGenerate: !0,
      timeout: 3e4
    };
  }
  /**
   * Получение моделей для предзагрузки
   */
  getModelsForPreloading(e) {
    switch (e) {
      case "eager":
        return [
          { provider: "transformers", model: "all-MiniLM-L6-v2" },
          { provider: "openai", model: "text-embedding-3-small" }
        ];
      case "predictive":
        return [
          { provider: "transformers", model: "all-MiniLM-L6-v2" }
        ];
      case "lazy":
      default:
        return [];
    }
  }
  /**
   * Получение метрик производительности модели
   */
  getModelMetrics(e) {
    return {
      averageInferenceTime: 150,
      // мс
      totalRequests: 0,
      successRate: 1,
      lastPerformanceCheck: Date.now()
    };
  }
  /**
   * Запуск таймера автоматической очистки
   */
  startCleanupTimer(e) {
    this.cleanupInterval && clearInterval(this.cleanupInterval), this.cleanupInterval = setInterval(() => {
      this.unloadUnusedModels().catch((t) => {
        console.warn("Automated cleanup failed:", t);
      });
    }, e);
  }
  /**
   * Остановка таймера и освобождение ресурсов
   */
  dispose() {
    this.cleanupInterval && (clearInterval(this.cleanupInterval), this.cleanupInterval = null);
    const e = Array.from(this.models.keys()).map((t) => this.unloadModel(t));
    Promise.all(e).catch((t) => {
      console.warn("Failed to dispose all models:", t);
    });
  }
}
function le(c = {}) {
  return new q(c);
}
class G {
  constructor(e = {}) {
    this.cache = /* @__PURE__ */ new Map(), this.accessOrder = [], this.config = {
      maxSize: e.maxSize || 1e3,
      maxMemory: e.maxMemory || 100 * 1024 * 1024,
      // 100MB
      ttl: e.ttl || 5 * 60 * 1e3,
      // 5 минут
      cleanupInterval: e.cleanupInterval || 60 * 1e3,
      // 1 минута
      evictionStrategy: e.evictionStrategy || "lru"
    }, this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      expiredEntries: 0,
      totalAccessTime: 0,
      totalAccessCount: 0
    }, this.cleanupTimer = null, this.startCleanupTimer();
  }
  /**
   * Получение значения из кэша
   */
  async get(e) {
    const t = Date.now();
    try {
      const s = this.cache.get(e);
      return s ? s.expiresAt && Date.now() > s.expiresAt ? (this.cache.delete(e), this.removeFromAccessOrder(e), this.stats.expiredEntries++, this.stats.misses++, null) : (s.lastAccessed = Date.now(), s.accessCount++, this.moveToFront(e), this.stats.hits++, s.value) : (this.stats.misses++, null);
    } finally {
      this.stats.totalAccessTime += Date.now() - t, this.stats.totalAccessCount++;
    }
  }
  /**
   * Сохранение значения в кэше
   */
  async set(e, t, s = {}) {
    const {
      ttl: r = this.config.ttl,
      priority: a = "normal",
      tags: i = []
    } = s, n = Date.now(), l = this.estimateSize(t), h = {
      key: e,
      value: t,
      timestamp: n,
      expiresAt: r ? n + r : void 0,
      lastAccessed: n,
      accessCount: 1,
      priority: a,
      tags: i,
      size: l
    };
    await this.ensureSpace(l), this.cache.has(e) && this.removeFromAccessOrder(e), this.cache.set(e, h), this.accessOrder.unshift(e), await this.enforceConstraints();
  }
  /**
   * Удаление элемента из кэша
   */
  async delete(e) {
    const t = this.cache.delete(e);
    return t && this.removeFromAccessOrder(e), t;
  }
  /**
   * Проверка наличия ключа в кэше
   */
  has(e) {
    const t = this.cache.get(e);
    return t ? t.expiresAt && Date.now() > t.expiresAt ? (this.cache.delete(e), this.removeFromAccessOrder(e), this.stats.expiredEntries++, !1) : !0 : !1;
  }
  /**
   * Получение размера кэша
   */
  size() {
    return this.cache.size;
  }
  /**
   * Очистка кэша
   */
  async clear() {
    this.cache.clear(), this.accessOrder = [];
    const e = this.stats.hits, t = this.stats.misses;
    this.stats = {
      hits: e,
      misses: t,
      evictions: 0,
      expiredEntries: 0,
      totalAccessTime: this.stats.totalAccessTime,
      totalAccessCount: this.stats.totalAccessCount
    };
  }
  /**
   * Удаление элементов по паттерну или тегам
   */
  async invalidate(e) {
    const t = [];
    if (e === "*")
      t.push(...this.cache.keys());
    else if (e.startsWith("tag:")) {
      const s = e.substring(4);
      for (const [r, a] of this.cache.entries())
        a.tags.includes(s) && t.push(r);
    } else if (e.includes("*")) {
      const s = new RegExp(e.replace(/\*/g, ".*"));
      for (const r of this.cache.keys())
        s.test(r) && t.push(r);
    } else
      this.cache.has(e) && t.push(e);
    for (const s of t)
      await this.delete(s);
  }
  /**
   * Получение статистики кэша
   */
  getStats() {
    const e = this.getMemoryUsage(), t = this.stats.hits + this.stats.misses, s = t > 0 ? this.stats.hits / t * 100 : 0, r = this.cache.size > 0 ? Array.from(this.cache.values()).reduce((a, i) => a + i.size, 0) / this.cache.size : 0;
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      memoryUsage: e,
      maxMemory: this.config.maxMemory,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: s,
      evictions: this.stats.evictions,
      averageEntrySize: r,
      expiredEntries: this.stats.expiredEntries
    };
  }
  /**
   * Оптимизация кэша
   */
  async optimize() {
    await this.cleanupExpired(), await this.enforceConstraints(), this.defragmentAccessOrder();
  }
  /**
   * Получение текущего использования памяти
   */
  getMemoryUsage() {
    let e = 0;
    for (const t of this.cache.values())
      e += t.size;
    return e;
  }
  // === Приватные методы ===
  /**
   * Обеспечение доступного места в кэше
   */
  async ensureSpace(e) {
    (this.getMemoryUsage() + e > this.config.maxMemory || this.cache.size >= this.config.maxSize) && await this.evictEntries(e);
  }
  /**
   * Применение ограничений кэша
   */
  async enforceConstraints() {
    await this.cleanupExpired(), (this.getMemoryUsage() > this.config.maxMemory || this.cache.size > this.config.maxSize) && await this.evictEntries(0);
  }
  /**
   * Выселение элементов согласно стратегии
   */
  async evictEntries(e) {
    const t = this.config.maxMemory * 0.8, s = Math.floor(this.config.maxSize * 0.8);
    let r = 0;
    const a = [], i = Array.from(this.cache.entries()), n = this.sortForEviction(i);
    for (const [l, h] of n) {
      a.push(l), r += h.size;
      const f = this.getMemoryUsage() - r, m = this.cache.size - a.length;
      if (f <= t && f <= this.config.maxMemory - e && m <= s)
        break;
    }
    for (const l of a)
      this.cache.delete(l), this.removeFromAccessOrder(l), this.stats.evictions++;
    console.log(`Evicted ${a.length} entries, freed ${r} bytes`);
  }
  /**
   * Сортировка элементов для выселения
   */
  sortForEviction(e) {
    switch (this.config.evictionStrategy) {
      case "lru":
        return e.sort((s, r) => s[1].lastAccessed - r[1].lastAccessed);
      case "lfu":
        return e.sort((s, r) => s[1].accessCount - r[1].accessCount);
      case "priority":
        const t = { low: 0, normal: 1, high: 2 };
        return e.sort((s, r) => {
          const a = t[s[1].priority] - t[r[1].priority];
          return a !== 0 ? a : s[1].lastAccessed - r[1].lastAccessed;
        });
      case "hybrid":
      default:
        return e.sort((s, r) => {
          const a = { low: 0, normal: 1, high: 2 }, i = (m) => a[m.priority] * 1e3, n = (m) => m.accessCount * 100, l = (m) => (Date.now() - m.lastAccessed) / 1e3, h = i(s[1]) + n(s[1]) - l(s[1]), f = i(r[1]) + n(r[1]) - l(r[1]);
          return h - f;
        });
    }
  }
  /**
   * Очистка истекших элементов
   */
  async cleanupExpired() {
    const e = Date.now(), t = [];
    for (const [s, r] of this.cache.entries())
      r.expiresAt && e > r.expiresAt && t.push(s);
    for (const s of t)
      this.cache.delete(s), this.removeFromAccessOrder(s), this.stats.expiredEntries++;
    t.length > 0 && console.log(`Cleaned up ${t.length} expired entries`);
  }
  /**
   * Перемещение элемента в начало списка доступа (LRU)
   */
  moveToFront(e) {
    this.removeFromAccessOrder(e), this.accessOrder.unshift(e);
  }
  /**
   * Удаление элемента из списка доступа
   */
  removeFromAccessOrder(e) {
    const t = this.accessOrder.indexOf(e);
    t > -1 && this.accessOrder.splice(t, 1);
  }
  /**
   * Дефрагментация списка доступа
   */
  defragmentAccessOrder() {
    this.accessOrder = this.accessOrder.filter((e) => this.cache.has(e));
  }
  /**
   * Оценка размера значения в байтах
   */
  estimateSize(e) {
    try {
      return JSON.stringify(e).length * 2;
    } catch {
      return 1e3;
    }
  }
  /**
   * Запуск таймера очистки
   */
  startCleanupTimer() {
    this.cleanupTimer && clearInterval(this.cleanupTimer), this.cleanupTimer = setInterval(() => {
      this.cleanupExpired().catch((e) => {
        console.warn("Cleanup timer error:", e);
      });
    }, this.config.cleanupInterval);
  }
  /**
   * Остановка таймера и освобождение ресурсов
   */
  dispose() {
    this.cleanupTimer && (clearInterval(this.cleanupTimer), this.cleanupTimer = null), this.clear();
  }
}
class K {
  constructor(e = {}) {
    this.cache = /* @__PURE__ */ new Map(), this.config = {
      maxSize: e.maxSize || 10,
      maxMemory: e.maxMemory || 500,
      // 500MB
      ttl: e.ttl || 30 * 60 * 1e3,
      // 30 минут
      evictionStrategy: e.evictionStrategy || "hybrid",
      optimizationInterval: e.optimizationInterval || 5 * 60 * 1e3
      // 5 минут
    }, this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalLoadTime: 0,
      totalLoads: 0
    }, this.optimizationTimer = null, this.startOptimizationTimer();
  }
  /**
   * Получение модели из кэша
   */
  async get(e) {
    const t = this.cache.get(e);
    return t ? t.expiresAt && Date.now() > t.expiresAt ? (this.cache.delete(e), this.stats.misses++, null) : (t.modelInfo.lastUsed = Date.now(), t.modelInfo.usageCount++, this.stats.hits++, t.modelInfo) : (this.stats.misses++, null);
  }
  /**
   * Сохранение модели в кэш
   */
  async set(e, t, s) {
    await this.ensureSpace(t.memoryUsage);
    const r = {
      modelInfo: {
        ...t,
        cachedAt: Date.now(),
        lastUsed: Date.now()
      },
      providerInstance: s,
      expiresAt: this.config.ttl ? Date.now() + this.config.ttl : void 0
    };
    this.cache.set(e, r), this.stats.totalLoads++, this.stats.totalLoadTime += t.loadTime, console.log(`Model ${e} cached successfully (${t.memoryUsage}MB)`);
  }
  /**
   * Получение экземпляра провайдера
   */
  async getProvider(e) {
    return this.cache.get(e)?.providerInstance || null;
  }
  /**
   * Обновление производительности модели
   */
  async updatePerformance(e, t) {
    const s = this.cache.get(e);
    if (!s) return;
    const r = s.modelInfo.performance;
    if (t.inferenceTime !== void 0) {
      const a = s.modelInfo.usageCount;
      r.averageInferenceTime = a > 1 ? (r.averageInferenceTime * (a - 1) + t.inferenceTime) / a : t.inferenceTime;
    }
    if (t.success !== void 0) {
      const a = s.modelInfo.usageCount, n = Math.round(r.successRate * (a - 1)) + (t.success ? 1 : 0);
      r.successRate = n / a;
    }
    t.error && r.errorCount++, r.lastBenchmark = Date.now();
  }
  /**
   * Проверка наличия модели в кэше
   */
  has(e) {
    const t = this.cache.get(e);
    return t ? t.expiresAt && Date.now() > t.expiresAt ? (this.cache.delete(e), !1) : !0 : !1;
  }
  /**
   * Удаление модели из кэша
   */
  async delete(e) {
    const t = this.cache.get(e);
    if (!t) return !1;
    if (t.providerInstance && "dispose" in t.providerInstance && typeof t.providerInstance.dispose == "function")
      try {
        await t.providerInstance.dispose();
      } catch (s) {
        console.warn(`Failed to dispose provider for model ${e}:`, s);
      }
    return this.cache.delete(e);
  }
  /**
   * Удаление моделей по паттерну
   */
  async invalidate(e) {
    const t = [];
    if (e === "*")
      t.push(...this.cache.keys());
    else if (e.startsWith("provider:")) {
      const s = e.substring(9);
      for (const [r, a] of this.cache.entries())
        a.modelInfo.provider === s && t.push(r);
    } else if (e.startsWith("tag:")) {
      const s = e.substring(4);
      for (const [r, a] of this.cache.entries())
        a.modelInfo.tags.includes(s) && t.push(r);
    } else if (e.includes("*")) {
      const s = new RegExp(e.replace(/\*/g, ".*"));
      for (const r of this.cache.keys())
        s.test(r) && t.push(r);
    } else
      this.cache.has(e) && t.push(e);
    for (const s of t)
      await this.delete(s);
  }
  /**
   * Получение всех кэшированных моделей
   */
  getAllModels() {
    return Array.from(this.cache.values()).map((e) => e.modelInfo);
  }
  /**
   * Получение моделей по провайдеру
   */
  getModelsByProvider(e) {
    return this.getAllModels().filter((t) => t.provider === e);
  }
  /**
   * Получение наиболее используемых моделей
   */
  getMostUsedModels(e = 5) {
    return this.getAllModels().sort((t, s) => s.usageCount - t.usageCount).slice(0, e);
  }
  /**
   * Получение статистики кэша
   */
  getStats() {
    const e = this.getAllModels(), t = e.reduce((i, n) => i + n.memoryUsage, 0), s = {};
    for (const i of e) {
      s[i.provider] || (s[i.provider] = {
        count: 0,
        memoryUsage: 0,
        totalInferenceTime: 0,
        totalSuccessRate: 0
      });
      const n = s[i.provider];
      n.count++, n.memoryUsage += i.memoryUsage, n.totalInferenceTime += i.performance.averageInferenceTime, n.totalSuccessRate += i.performance.successRate;
    }
    for (const i of Object.keys(s)) {
      const n = s[i];
      n.avgInferenceTime = n.totalInferenceTime / n.count, n.successRate = n.totalSuccessRate / n.count, delete n.totalInferenceTime, delete n.totalSuccessRate;
    }
    const r = this.stats.hits + this.stats.misses, a = r > 0 ? this.stats.hits / r * 100 : 0;
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      memoryUsage: t,
      maxMemory: this.config.maxMemory,
      providerStats: s,
      cachePerformance: {
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate: a,
        evictions: this.stats.evictions
      }
    };
  }
  /**
   * Очистка всего кэша
   */
  async clear() {
    const e = Array.from(this.cache.keys()).map((t) => this.delete(t));
    await Promise.all(e), this.cache.clear(), this.stats = {
      hits: this.stats.hits,
      misses: this.stats.misses,
      evictions: 0,
      totalLoadTime: 0,
      totalLoads: 0
    };
  }
  /**
   * Оптимизация кэша
   */
  async optimize() {
    await this.cleanupExpired(), (this.getCurrentMemoryUsage() > this.config.maxMemory || this.cache.size > this.config.maxSize) && await this.evictModels(), console.log("Model cache optimization completed");
  }
  /**
   * Получение текущего использования памяти
   */
  getMemoryUsage() {
    return this.getCurrentMemoryUsage();
  }
  // === Приватные методы ===
  /**
   * Обеспечение свободного места в кэше
   */
  async ensureSpace(e) {
    (this.getCurrentMemoryUsage() + e > this.config.maxMemory || this.cache.size >= this.config.maxSize) && await this.evictModels(e);
  }
  /**
   * Выселение моделей согласно стратегии
   */
  async evictModels(e = 0) {
    const t = Math.min(
      this.config.maxMemory * 0.8,
      this.config.maxMemory - e
    ), s = Math.floor(this.config.maxSize * 0.8), r = Array.from(this.cache.entries()), a = this.sortForEviction(r);
    let i = 0;
    const n = [];
    for (const [l, h] of a) {
      n.push(l), i += h.modelInfo.memoryUsage;
      const f = this.getCurrentMemoryUsage() - i, m = this.cache.size - n.length;
      if (f <= t && m <= s)
        break;
    }
    for (const l of n)
      await this.delete(l), this.stats.evictions++;
    console.log(`Evicted ${n.length} models, freed ${i}MB`);
  }
  /**
   * Сортировка моделей для выселения
   */
  sortForEviction(e) {
    switch (this.config.evictionStrategy) {
      case "lru":
        return e.sort((t, s) => t[1].modelInfo.lastUsed - s[1].modelInfo.lastUsed);
      case "memory_usage":
        return e.sort((t, s) => s[1].modelInfo.memoryUsage - t[1].modelInfo.memoryUsage);
      case "usage_count":
        return e.sort((t, s) => t[1].modelInfo.usageCount - s[1].modelInfo.usageCount);
      case "hybrid":
      default:
        return e.sort((t, s) => {
          const r = this.calculateEvictionScore(t[1].modelInfo), a = this.calculateEvictionScore(s[1].modelInfo);
          return r - a;
        });
    }
  }
  /**
   * Вычисление оценки для выселения (гибридная стратегия)
   */
  calculateEvictionScore(e) {
    const s = (Date.now() - e.lastUsed) / (60 * 1e3), r = Math.max(1, e.usageCount) * 100, a = e.memoryUsage * 10, i = e.performance.successRate * 50;
    return s + a - r - i;
  }
  /**
   * Очистка истекших моделей
   */
  async cleanupExpired() {
    const e = Date.now(), t = [];
    for (const [s, r] of this.cache.entries())
      r.expiresAt && e > r.expiresAt && t.push(s);
    for (const s of t)
      await this.delete(s);
    t.length > 0 && console.log(`Cleaned up ${t.length} expired models`);
  }
  /**
   * Получение текущего использования памяти
   */
  getCurrentMemoryUsage() {
    let e = 0;
    for (const t of this.cache.values())
      e += t.modelInfo.memoryUsage;
    return e;
  }
  /**
   * Запуск таймера оптимизации
   */
  startOptimizationTimer() {
    this.optimizationTimer && clearInterval(this.optimizationTimer), this.optimizationTimer = setInterval(() => {
      this.optimize().catch((e) => {
        console.warn("Model cache optimization failed:", e);
      });
    }, this.config.optimizationInterval);
  }
  /**
   * Остановка таймера и освобождение ресурсов
   */
  dispose() {
    this.optimizationTimer && (clearInterval(this.optimizationTimer), this.optimizationTimer = null), this.clear().catch((e) => {
      console.warn("Failed to clear model cache during disposal:", e);
    });
  }
}
class X {
  constructor(e = {}) {
    this.queryCache = new G({
      maxSize: e.memorySize || 1e3,
      ttl: 5 * 60 * 1e3
      // 5 минут для memory cache
    }), this.modelCache = new K({
      maxSize: 50,
      // Максимум 50 моделей в кэше
      ttl: 30 * 60 * 1e3
      // 30 минут для моделей
    }), this.stats = {
      totalRequests: 0,
      memoryHits: 0,
      indexedDBHits: 0,
      databaseHits: 0,
      misses: 0,
      totalAccessTime: 0,
      levelAccessTimes: /* @__PURE__ */ new Map([
        ["memory", { total: 0, count: 0 }],
        ["indexeddb", { total: 0, count: 0 }],
        ["database", { total: 0, count: 0 }]
      ])
    }, this.indexedDB = null, this.dbReady = this.initIndexedDB(e.indexedDBName || "LocalRetrieveCache", e.dbVersion || 1);
  }
  /**
   * Получение данных с каскадным поиском по уровням кэша
   */
  async get(e, t) {
    const s = Date.now();
    this.stats.totalRequests++;
    try {
      if (t) {
        const n = await this.getFromLevel(e, t);
        return this.updateAccessTimeStats(t, Date.now() - s), n;
      }
      const r = await this.getFromLevel(e, "memory");
      if (r !== null)
        return this.stats.memoryHits++, this.updateAccessTimeStats("memory", Date.now() - s), r;
      const a = await this.getFromLevel(e, "indexeddb");
      if (a !== null)
        return this.stats.indexedDBHits++, this.updateAccessTimeStats("indexeddb", Date.now() - s), await this.queryCache.set(e, a), a;
      const i = await this.getFromLevel(e, "database");
      return i !== null ? (this.stats.databaseHits++, this.updateAccessTimeStats("database", Date.now() - s), await Promise.all([
        this.queryCache.set(e, i),
        this.setInIndexedDB(e, i, { ttl: 24 * 60 * 60 * 1e3 })
        // 24 часа
      ]), i) : (this.stats.misses++, null);
    } catch (r) {
      return console.warn(`Cache get operation failed for key "${e}":`, r), this.stats.misses++, null;
    } finally {
      this.stats.totalAccessTime += Date.now() - s;
    }
  }
  /**
   * Сохранение данных во всех уровнях кэша
   */
  async set(e, t, s) {
    const {
      level: r,
      ttl: a,
      tags: i = [],
      priority: n = "normal",
      compression: l = !1
    } = s || {};
    try {
      const h = [];
      (!r || r === "memory") && h.push(this.queryCache.set(e, t, {
        ttl: a || 5 * 60 * 1e3,
        // 5 минут по умолчанию
        priority: n,
        tags: i
      })), (!r || r === "indexeddb") && h.push(this.setInIndexedDB(e, t, {
        ttl: a || 24 * 60 * 60 * 1e3,
        // 24 часа по умолчанию
        tags: i,
        compression: l
      })), (!r || r === "database") && h.push(this.setInDatabase(e, t, {
        ttl: a || 7 * 24 * 60 * 60 * 1e3,
        // 7 дней по умолчанию
        tags: i
      })), await Promise.all(h);
    } catch (h) {
      throw new I(
        `Failed to set cache value for key "${e}": ${h instanceof Error ? h.message : String(h)}`,
        "SET_FAILED",
        e,
        { level: r, options: s }
      );
    }
  }
  /**
   * Каскадное удаление данных по паттерну
   */
  async invalidate(e) {
    const t = [];
    try {
      t.push(this.queryCache.invalidate(e)), t.push(this.modelCache.invalidate(e)), t.push(this.invalidateIndexedDB(e)), t.push(this.invalidateDatabase(e)), await Promise.all(t);
    } catch (s) {
      throw new I(
        `Failed to invalidate cache pattern "${e}": ${s instanceof Error ? s.message : String(s)}`,
        "INVALIDATION_FAILED",
        e
      );
    }
  }
  /**
   * Предварительный прогрев кэша для популярных запросов
   */
  async warmCache(e, t) {
    console.log(`Warming cache for collection "${e}" with ${t.length} queries`);
    const s = t.map(async (r, a) => {
      const i = `warmup:${e}:${this.hashString(r)}`, n = {
        warmedAt: Date.now(),
        collection: e,
        query: r,
        status: "placeholder"
      };
      await this.set(i, n, {
        level: "memory",
        ttl: 10 * 60 * 1e3,
        // 10 минут для прогрева
        tags: ["warmup", e]
      });
    });
    await Promise.all(s);
  }
  /**
   * Предзагрузка моделей в кэш
   */
  async preloadModels(e) {
    const t = e.map(async (s) => {
      const r = {
        modelId: `${s}-default`,
        provider: s,
        // Type assertion for provider
        modelName: `${s} Default Model`,
        dimensions: 384,
        // Default dimensions
        loadTime: 0,
        cachedAt: Date.now(),
        lastUsed: Date.now(),
        usageCount: 0,
        memoryUsage: 0,
        status: "ready",
        performance: {
          averageInferenceTime: 0,
          successRate: 1,
          errorCount: 0,
          lastBenchmark: Date.now()
        },
        tags: ["default", "preloaded"]
      };
      await this.modelCache.set(`model:${s}`, r);
    });
    await Promise.all(t), console.log(`Preloaded ${e.length} models into cache`);
  }
  /**
   * Получение статистики кэширования
   */
  getStats() {
    const e = this.stats.memoryHits + this.stats.indexedDBHits + this.stats.databaseHits, t = this.stats.totalRequests > 0 ? e / this.stats.totalRequests * 100 : 0, s = {
      memory: 0,
      indexeddb: 0,
      database: 0
    };
    for (const [r, a] of this.stats.levelAccessTimes.entries())
      s[r] = a.count > 0 ? a.total / a.count : 0;
    return {
      totalRequests: this.stats.totalRequests,
      hits: {
        memory: this.stats.memoryHits,
        indexeddb: this.stats.indexedDBHits,
        database: this.stats.databaseHits,
        total: e
      },
      misses: this.stats.misses,
      hitRate: t,
      memoryUsage: {
        memory: this.queryCache.getMemoryUsage(),
        indexeddb: this.estimateIndexedDBUsage(),
        database: this.estimateDatabaseUsage()
      },
      avgAccessTime: s
    };
  }
  /**
   * Очистка всех уровней кэша
   */
  async clear() {
    const e = [
      this.queryCache.clear(),
      this.modelCache.clear(),
      this.clearIndexedDB(),
      this.clearDatabase()
    ];
    await Promise.all(e), this.stats = {
      totalRequests: 0,
      memoryHits: 0,
      indexedDBHits: 0,
      databaseHits: 0,
      misses: 0,
      totalAccessTime: 0,
      levelAccessTimes: /* @__PURE__ */ new Map([
        ["memory", { total: 0, count: 0 }],
        ["indexeddb", { total: 0, count: 0 }],
        ["database", { total: 0, count: 0 }]
      ])
    };
  }
  /**
   * Оптимизация кэша
   */
  async optimize() {
    const e = [
      this.queryCache.optimize(),
      this.modelCache.optimize(),
      this.optimizeIndexedDB(),
      this.optimizeDatabase()
    ];
    await Promise.all(e), console.log("Cache optimization completed");
  }
  // === Приватные методы ===
  /**
   * Получение данных с конкретного уровня
   */
  async getFromLevel(e, t) {
    switch (t) {
      case "memory":
        return this.queryCache.get(e);
      case "indexeddb":
        return this.getFromIndexedDB(e);
      case "database":
        return this.getFromDatabase(e);
      default:
        throw new I(`Unknown cache level: ${t}`, "read", `unknown:${t}`);
    }
  }
  /**
   * Инициализация IndexedDB
   */
  async initIndexedDB(e, t) {
    return new Promise((s, r) => {
      if (typeof indexedDB > "u") {
        console.warn("IndexedDB not available, skipping initialization"), s();
        return;
      }
      const a = indexedDB.open(e, t);
      a.onerror = () => {
        console.warn("Failed to open IndexedDB:", a.error), s();
      }, a.onsuccess = () => {
        this.indexedDB = a.result, s();
      }, a.onupgradeneeded = () => {
        const i = a.result;
        if (!i.objectStoreNames.contains("cache")) {
          const n = i.createObjectStore("cache", { keyPath: "key" });
          n.createIndex("timestamp", "timestamp"), n.createIndex("tags", "tags", { multiEntry: !0 });
        }
      };
    });
  }
  /**
   * Получение данных из IndexedDB
   */
  async getFromIndexedDB(e) {
    return await this.dbReady, this.indexedDB ? new Promise((t) => {
      const a = this.indexedDB.transaction(["cache"], "readonly").objectStore("cache").get(e);
      a.onsuccess = () => {
        const i = a.result;
        if (!i) {
          t(null);
          return;
        }
        if (i.expiresAt && Date.now() > i.expiresAt) {
          this.deleteFromIndexedDB(e).catch(console.warn), t(null);
          return;
        }
        t(i.value);
      }, a.onerror = () => {
        console.warn(`IndexedDB get failed for key "${e}":`, a.error), t(null);
      };
    }) : null;
  }
  /**
   * Сохранение данных в IndexedDB
   */
  async setInIndexedDB(e, t, s = {}) {
    if (await this.dbReady, !this.indexedDB) return;
    const { ttl: r, tags: a = [], compression: i = !1 } = s, n = {
      key: e,
      value: i ? this.compress(t) : t,
      timestamp: Date.now(),
      expiresAt: r ? Date.now() + r : null,
      tags: a,
      compressed: i
    };
    return new Promise((l, h) => {
      const d = this.indexedDB.transaction(["cache"], "readwrite").objectStore("cache").put(n);
      d.onsuccess = () => l(), d.onerror = () => {
        console.warn(`IndexedDB set failed for key "${e}":`, d.error), h(d.error);
      };
    });
  }
  /**
   * Удаление данных из IndexedDB
   */
  async deleteFromIndexedDB(e) {
    if (this.indexedDB)
      return new Promise((t) => {
        const a = this.indexedDB.transaction(["cache"], "readwrite").objectStore("cache").delete(e);
        a.onsuccess = () => t(), a.onerror = () => {
          console.warn(`IndexedDB delete failed for key "${e}":`, a.error), t();
        };
      });
  }
  /**
   * Очистка данных в IndexedDB по паттерну
   */
  async invalidateIndexedDB(e) {
    if (this.indexedDB) {
      if (e === "*") {
        await this.clearIndexedDB();
        return;
      }
      console.warn("IndexedDB pattern invalidation not fully implemented");
    }
  }
  /**
   * Полная очистка IndexedDB
   */
  async clearIndexedDB() {
    if (this.indexedDB)
      return new Promise((e) => {
        const r = this.indexedDB.transaction(["cache"], "readwrite").objectStore("cache").clear();
        r.onsuccess = () => e(), r.onerror = () => {
          console.warn("IndexedDB clear failed:", r.error), e();
        };
      });
  }
  /**
   * Оптимизация IndexedDB (удаление устаревших записей)
   */
  async optimizeIndexedDB() {
    if (!this.indexedDB) return;
    const e = Date.now();
    return new Promise((t) => {
      const a = this.indexedDB.transaction(["cache"], "readwrite").objectStore("cache").openCursor();
      a.onsuccess = () => {
        const i = a.result;
        if (i) {
          const n = i.value;
          n.expiresAt && e > n.expiresAt && i.delete(), i.continue();
        } else
          t();
      }, a.onerror = () => {
        console.warn("IndexedDB optimization failed:", a.error), t();
      };
    });
  }
  /**
   * Заглушки для database operations (будут реализованы при интеграции с worker)
   */
  async getFromDatabase(e) {
    return console.debug(`Database get for key "${e}" - not implemented yet`), null;
  }
  async setInDatabase(e, t, s) {
    console.debug(`Database set for key "${e}" - not implemented yet`);
  }
  async invalidateDatabase(e) {
    console.debug(`Database invalidation for pattern "${e}" - not implemented yet`);
  }
  async clearDatabase() {
    console.debug("Database clear - not implemented yet");
  }
  async optimizeDatabase() {
    console.debug("Database optimization - not implemented yet");
  }
  /**
   * Вспомогательные методы
   */
  updateAccessTimeStats(e, t) {
    const s = this.stats.levelAccessTimes.get(e);
    s.total += t, s.count++;
  }
  estimateIndexedDBUsage() {
    return 10;
  }
  estimateDatabaseUsage() {
    return 50;
  }
  hashString(e) {
    let t = 0;
    for (let s = 0; s < e.length; s++) {
      const r = e.charCodeAt(s);
      t = (t << 5) - t + r, t = t & t;
    }
    return Math.abs(t).toString(36);
  }
  compress(e) {
    return JSON.stringify(e);
  }
  decompress(e) {
    return JSON.parse(e);
  }
}
function he(c = {}) {
  return new X(c);
}
const de = "1.0.0-mvp", me = [
  "sql.js-compatibility",
  "opfs-persistence",
  "hybrid-search",
  "sqlite-vec",
  "fts5",
  "worker-based",
  "embedding-generation",
  "collection-based-embeddings",
  "automatic-embedding-generation",
  "semantic-search"
];
async function ue(c = "opfs:/localretrieve/default.db", e) {
  const t = {
    ...e,
    filename: c
  }, s = new E(t);
  await s._initialize();
  try {
    await s.initializeSchema();
  } catch (r) {
    throw console.error("Schema initialization failed:", r), r;
  }
  return s;
}
async function fe(c, e = ":memory:") {
  return E.create(c, e);
}
var _;
((c) => {
  c.Database = E, c.Statement = O;
})(_ || (_ = {}));
export {
  pe as AuthenticationError,
  ye as BaseEmbeddingProvider,
  X as CacheManagerImpl,
  te as CollectionUtils,
  P as ConfigurationError,
  N as DEFAULT_DATABASE_CONFIG,
  E as Database,
  o as DatabaseError,
  S as EMBEDDING_DEFAULTS,
  A as EmbeddingConstants,
  M as EmbeddingError,
  ve as EmbeddingProviderFactoryImpl,
  g as EmbeddingUtils,
  Ce as ExternalProvider,
  me as FEATURES,
  Q as InternalPipelineImpl,
  se as MemoryCache,
  K as ModelCache,
  q as ModelManagerImpl,
  Se as OPFSError,
  be as OpenAIProvider,
  Me as ProviderError,
  Ee as ProviderUtils,
  G as QueryCache,
  xe as QuotaExceededError,
  _ as SQL,
  re as SUPPORTED_PROVIDERS,
  O as Statement,
  V as StatementError,
  y as TextProcessor,
  W as TimeoutError,
  Ae as TransformersProvider,
  de as VERSION,
  C as ValidationError,
  Te as VectorError,
  Re as WorkerDatabaseError,
  Pe as WorkerError,
  Ie as WorkerRPC,
  oe as checkConfigCompatibility,
  ke as checkProviderSupport,
  he as createCacheManager,
  fe as createDatabase,
  ae as createEmbeddingProvider,
  ce as createInternalPipeline,
  le as createModelManager,
  De as createOpenAIProvider,
  Le as createProvider,
  ze as createTransformersProvider,
  B as createWorkerRPC,
  E as default,
  _e as getAvailableModels,
  Oe as getAvailableProviders,
  $e as getProviderRecommendations,
  H as getRecommendedConfig,
  ne as getRecommendedEmbeddingConfig,
  ue as initLocalRetrieve,
  z as isSQLValue,
  Y as isStatementResult,
  Be as isValidModelDimensionCombo,
  R as providerFactory,
  Z as resolveWorkerUrl,
  ie as validateEmbeddingConfig,
  He as validateProviderConfig,
  ee as validateSQL,
  J as validateSQLParams
};
//# sourceMappingURL=localretrieve.mjs.map
