import { D as m, b as U, O as Q, E as F, p as X, t as J } from "../ProviderFactory-3B-jCMm2.mjs";
const A = 0, K = 100, Y = 101, Z = 1, ee = 2, te = 3, ie = 4, se = 5, V = -1;
class re {
  constructor(e) {
    this.logger = e, this.sqlite3 = null, this.dbPtr = 0, this.operationCount = 0;
  }
  /**
   * Load SQLite WASM module
   */
  async loadWASM() {
    if (!this.sqlite3)
      try {
        const e = "../sqlite3.mjs";
        this.log("info", `Loading SQLite WASM from: ${e}`);
        const t = await import(e);
        if (this.sqlite3 = await t.default(), !this.sqlite3?._sqlite3_open || !this.sqlite3?._sqlite3_close)
          throw new m("SQLite WASM module is incomplete - missing core functions");
        const i = this.sqlite3?._sqlite3_libversion(), s = i && this.sqlite3?.UTF8ToString ? this.sqlite3.UTF8ToString(i) : "unknown";
        this.log("info", `SQLite WASM loaded successfully, version: ${s}`);
      } catch (e) {
        const t = e instanceof Error ? e.message : String(e);
        throw this.log("error", `Failed to load SQLite WASM: ${t}`), new m(`Failed to load SQLite WASM: ${t}`);
      }
  }
  /**
   * Open database connection
   */
  async openDatabase(e) {
    this.sqlite3 || await this.loadWASM(), this.dbPtr && this.closeDatabase();
    const t = this.sqlite3._malloc(e.length + 1);
    this.sqlite3.stringToUTF8(e, t, e.length + 1);
    const i = this.sqlite3._malloc(4), s = this.sqlite3._sqlite3_open(t, i);
    if (this.sqlite3._free(t), s !== A) {
      this.sqlite3._free(i);
      const r = this.sqlite3._sqlite3_errmsg && this.sqlite3._sqlite3_errmsg(0) || 0, n = r ? this.sqlite3.UTF8ToString(r) : `SQLite error code ${s}`;
      throw new m(`Failed to open database: ${n}`);
    }
    if (this.dbPtr = this.sqlite3.getValue(i, "i32"), this.sqlite3._free(i), !this.dbPtr)
      throw new m("Failed to get valid database pointer");
    this.log("info", `Database opened successfully: ${e}`);
  }
  /**
   * Close database connection
   */
  closeDatabase() {
    if (!(!this.sqlite3 || !this.dbPtr))
      try {
        this.sqlite3._sqlite3_close(this.dbPtr), this.dbPtr = 0, this.log("info", "Database closed successfully");
      } catch (e) {
        this.log("error", `Error closing database: ${e instanceof Error ? e.message : String(e)}`);
      }
  }
  /**
   * Initialize sqlite-vec extension
   */
  async initVecExtension() {
    if (!this.sqlite3 || !this.dbPtr)
      throw new m("Database not initialized");
    if (!this.sqlite3._sqlite3_vec_init_manual)
      throw new U("sqlite-vec extension not available");
    const e = this.sqlite3._sqlite3_vec_init_manual(this.dbPtr);
    if (e !== A)
      throw this.log("error", `sqlite-vec initialization failed with code: ${e}`), new U(`Failed to initialize sqlite-vec extension (code: ${e})`);
    this.log("info", "sqlite-vec extension initialized successfully");
    try {
      const t = await this.select("SELECT vec_f32('[1.0, 2.0, 3.0]') as test_vector");
      this.log("info", `vec_f32 function test result: ${JSON.stringify(t.rows[0])}`);
    } catch (t) {
      this.log("warn", `vec_f32 test failed: ${t instanceof Error ? t.message : String(t)}`);
    }
  }
  /**
   * Execute SQL statement with optional parameters
   */
  async exec(e, t) {
    if (!this.sqlite3 || !this.dbPtr)
      throw new m("Database not initialized");
    this.operationCount++;
    const i = e.trim().toUpperCase(), s = i.startsWith("BEGIN") || i.startsWith("COMMIT") || i.startsWith("ROLLBACK");
    if (s ? this.log("info", `[SQLExec] Executing transaction command: ${e}`) : this.log("debug", `[SQLExec] Executing: ${e.substring(0, 100)}${e.length > 100 ? "..." : ""}`), !t || t.length === 0) {
      const d = this.sqlite3.lengthBytesUTF8(e), h = this.sqlite3._malloc(d + 1);
      this.sqlite3.stringToUTF8(e, h, d + 1);
      const E = this.sqlite3._sqlite3_exec(this.dbPtr, h, 0, 0, 0);
      if (this.sqlite3._free(h), E !== A) {
        const u = this.sqlite3._sqlite3_errmsg(this.dbPtr), g = this.sqlite3.UTF8ToString(u);
        throw this.log("error", `[SQLExec] SQL execution failed: ${e} - Error: ${g}`), new m(`SQL execution failed: ${g}`);
      } else
        s ? this.log("info", `[SQLExec] ✓ Transaction command completed: ${e}`) : this.log("debug", "[SQLExec] ✓ SQL executed successfully");
      return;
    }
    const r = this.sqlite3.lengthBytesUTF8(e), n = this.sqlite3._malloc(r + 1);
    this.sqlite3.stringToUTF8(e, n, r + 1);
    const a = this.sqlite3._malloc(4), c = this.sqlite3._sqlite3_prepare_v2(this.dbPtr, n, -1, a, 0);
    if (this.sqlite3._free(n), c !== A) {
      this.sqlite3._free(a);
      const d = this.sqlite3._sqlite3_errmsg(this.dbPtr), h = this.sqlite3.UTF8ToString(d);
      throw this.log("error", `SQL preparation failed: ${e} - Error: ${h}`), new m(`Failed to prepare statement: ${h}`);
    }
    const l = this.sqlite3.getValue(a, "i32");
    this.sqlite3._free(a);
    try {
      if (t)
        if (Array.isArray(t))
          for (let h = 0; h < t.length; h++)
            this.bindParameter(l, h + 1, t[h]);
        else {
          const h = Object.keys(t);
          for (let E = 0; E < h.length; E++)
            this.bindParameter(l, E + 1, t[h[E]]);
        }
      const d = this.sqlite3._sqlite3_step(l);
      if (d !== Y && d !== K) {
        const h = this.sqlite3._sqlite3_errmsg(this.dbPtr), E = this.sqlite3.UTF8ToString(h);
        throw this.log("error", `SQL execution failed: ${e} - Error: ${E}`), new m(`SQL execution failed: ${E}`);
      }
      this.log("debug", `SQL executed successfully with parameters: ${e}`);
    } finally {
      this.sqlite3._sqlite3_finalize(l);
    }
  }
  /**
   * Execute SQL query and return results
   */
  async select(e, t) {
    if (!this.sqlite3 || !this.dbPtr)
      throw new m("Database not initialized");
    this.operationCount++;
    const i = this.executeQuery(this.dbPtr, e, t);
    return {
      rows: i,
      columns: i.length > 0 ? Object.keys(i[0]) : []
    };
  }
  /**
   * Execute SQL query with parameters and return results
   */
  executeQuery(e, t, i) {
    const s = this.sqlite3.lengthBytesUTF8(t), r = this.sqlite3._malloc(s + 1);
    this.sqlite3.stringToUTF8(t, r, s + 1);
    const n = this.sqlite3._malloc(4), a = this.sqlite3._sqlite3_prepare_v2(e, r, -1, n, 0);
    if (this.sqlite3._free(r), a !== A) {
      this.sqlite3._free(n);
      const d = this.sqlite3._sqlite3_errmsg(e), h = this.sqlite3.UTF8ToString(d);
      throw new m(`Failed to prepare statement: ${h}`);
    }
    const c = this.sqlite3.getValue(n, "i32");
    if (this.sqlite3._free(n), i) {
      if (Array.isArray(i) && i.length > 0)
        for (let d = 0; d < i.length; d++) {
          const h = i[d];
          this.bindParameter(c, d + 1, h);
        }
      else if (!Array.isArray(i)) {
        const d = Object.keys(i);
        if (d.length > 0)
          for (let h = 0; h < d.length; h++)
            this.bindParameter(c, h + 1, i[d[h]]);
      }
    }
    const l = [];
    try {
      for (; this.sqlite3._sqlite3_step(c) === K; ) {
        const d = this.sqlite3._sqlite3_column_count(c), h = {};
        for (let E = 0; E < d; E++) {
          const u = this.sqlite3.UTF8ToString(this.sqlite3._sqlite3_column_name(c, E)), g = this.sqlite3._sqlite3_column_type(c, E);
          h[u] = this.extractColumnValue(c, E, g);
        }
        l.push(h);
      }
    } finally {
      this.sqlite3._sqlite3_finalize(c);
    }
    return l;
  }
  /**
   * Bind parameter to prepared statement
   */
  bindParameter(e, t, i) {
    if (!this.sqlite3)
      throw new m("SQLite not initialized");
    if (i == null)
      this.sqlite3._sqlite3_bind_null(e, t);
    else if (typeof i == "number")
      Number.isInteger(i) ? this.sqlite3._sqlite3_bind_int(e, t, i) : this.sqlite3._sqlite3_bind_double(e, t, i);
    else if (typeof i == "string") {
      const s = this.sqlite3.lengthBytesUTF8(i), r = this.sqlite3._malloc(s + 1);
      this.sqlite3.stringToUTF8(i, r, s + 1), this.sqlite3._sqlite3_bind_text(e, t, r, -1, V), this.sqlite3._free(r);
    } else if (i instanceof Uint8Array) {
      const s = this.sqlite3._malloc(i.length);
      if (this.sqlite3.writeArrayToMemory)
        this.sqlite3.writeArrayToMemory(i, s);
      else
        for (let r = 0; r < i.length; r++)
          this.sqlite3.setValue(s + r, i[r], "i8");
      this.sqlite3._sqlite3_bind_blob(e, t, s, i.length, V), this.sqlite3._free(s);
    } else if (i instanceof Float32Array) {
      const s = new Uint8Array(i.buffer);
      this.bindParameter(e, t, s);
    }
  }
  /**
   * Extract column value from result set
   */
  extractColumnValue(e, t, i) {
    if (!this.sqlite3)
      throw new m("SQLite not initialized");
    switch (i) {
      case Z:
        return this.sqlite3._sqlite3_column_int(e, t);
      case ee:
        return this.sqlite3._sqlite3_column_double(e, t);
      case te:
        return this.sqlite3.UTF8ToString(this.sqlite3._sqlite3_column_text(e, t));
      case ie:
        const s = this.sqlite3._sqlite3_column_blob(e, t), r = this.sqlite3._sqlite3_column_bytes(e, t), n = new Uint8Array(r);
        for (let a = 0; a < r; a++)
          n[a] = this.sqlite3.getValue(s + a, "i8");
        return n;
      case se:
      default:
        return null;
    }
  }
  /**
   * Serialize database to Uint8Array
   */
  async serialize() {
    if (!this.sqlite3 || !this.dbPtr)
      throw new m("Database not initialized");
    const e = "main", t = this.sqlite3._malloc(8), i = this.sqlite3._malloc(e.length + 1);
    try {
      if (this.sqlite3.stringToUTF8(e, i, e.length + 1), typeof this.sqlite3._sqlite3_serialize != "function")
        throw new m("sqlite3_serialize function not available");
      const s = this.sqlite3._sqlite3_serialize(this.dbPtr, i, t, 0);
      if (!s)
        throw new m("Failed to serialize database");
      const r = this.sqlite3.getValue(t, "i64"), n = new Uint8Array(Number(r));
      for (let a = 0; a < n.length; a++)
        n[a] = this.sqlite3.getValue(s + a, "i8");
      return this.sqlite3._free(s), this.log("debug", `Database serialized: ${n.length} bytes`), n;
    } finally {
      this.sqlite3._free(t), this.sqlite3._free(i);
    }
  }
  /**
   * Deserialize database from Uint8Array
   */
  async deserialize(e) {
    if (!this.sqlite3 || !this.dbPtr)
      throw new m("Database not initialized");
    const t = "main", i = this.sqlite3._malloc(t.length + 1), s = this.sqlite3._malloc(e.length);
    try {
      if (this.sqlite3.stringToUTF8(t, i, t.length + 1), this.sqlite3.writeArrayToMemory)
        this.sqlite3.writeArrayToMemory(e, s);
      else
        for (let n = 0; n < e.length; n++)
          this.sqlite3.setValue(s + n, e[n], "i8");
      if (typeof this.sqlite3._sqlite3_deserialize != "function")
        throw new m("sqlite3_deserialize function not available");
      const r = this.sqlite3._sqlite3_deserialize(
        this.dbPtr,
        i,
        s,
        BigInt(e.length),
        BigInt(e.length),
        0
      );
      if (r !== A)
        throw new m(`Failed to deserialize database (SQLite error code: ${r})`);
      this.log("debug", `Database deserialized: ${e.length} bytes`);
    } finally {
      this.sqlite3._free(i);
    }
  }
  /**
   * Get database connection status
   */
  isConnected() {
    return this.sqlite3 !== null && this.dbPtr !== 0;
  }
  /**
   * Get SQLite version
   */
  getVersion() {
    return this.sqlite3 ? this.sqlite3.UTF8ToString(this.sqlite3._sqlite3_libversion()) : "Not loaded";
  }
  /**
   * Get operation count
   */
  getOperationCount() {
    return this.operationCount;
  }
  /**
   * Get database pointer (for advanced operations)
   */
  getDbPtr() {
    return this.dbPtr;
  }
  /**
   * Get SQLite module reference (for advanced operations)
   */
  getSQLite3Module() {
    return this.sqlite3;
  }
  log(e, t) {
    this.logger ? this.logger.log(e, t) : console.log(`[SQLiteManager] ${e.toUpperCase()}: ${t}`);
  }
}
class ne {
  constructor(e, t) {
    this.sqliteManager = e, this.logger = t, this.opfsPath = null, this.tempDbName = null, this.lastSyncTime = 0, this.syncInterval = 5e3, this.syncTimer = null, this.pendingDatabaseData = null;
  }
  /**
   * Initialize OPFS database with persistence support
   * Creates a temporary file that is periodically synced to OPFS
   */
  async initializeDatabase(e) {
    try {
      const t = e.replace(/^opfs:\/\/?/, "");
      if (!this.isOPFSSupported())
        return this.log("warn", "OPFS not supported, falling back to memory database"), ":memory:";
      const i = ":memory:";
      this.opfsPath = t, this.tempDbName = i;
      try {
        await this.loadDatabaseFromOPFS(t), this.log("info", `Loaded existing database from OPFS: ${t}`);
      } catch {
        this.log("info", `Creating new database for OPFS path: ${t}`);
      }
      return i;
    } catch (t) {
      return this.log("warn", `OPFS initialization failed: ${t instanceof Error ? t.message : String(t)}, using memory database`), ":memory:";
    }
  }
  /**
   * Check if OPFS is supported by the browser
   */
  isOPFSSupported() {
    return typeof navigator < "u" && typeof navigator.storage < "u" && typeof navigator.storage.getDirectory == "function";
  }
  /**
   * Load database from OPFS storage
   */
  async loadDatabaseFromOPFS(e) {
    try {
      if (!this.isOPFSSupported())
        throw new Error("OPFS not supported");
      const t = await navigator.storage.getDirectory(), i = e.split("/").filter((l) => l.length > 0);
      let s = t;
      for (let l = 0; l < i.length - 1; l++)
        s = await s.getDirectoryHandle(i[l], { create: !1 });
      const r = i[i.length - 1], a = await (await s.getFileHandle(r, { create: !1 })).getFile(), c = new Uint8Array(await a.arrayBuffer());
      if (c.length === 0)
        throw new Error("Empty database file");
      this.pendingDatabaseData = c, this.log("info", `Loaded ${c.length} bytes from OPFS: ${e}`);
    } catch (t) {
      const i = new Q(`Failed to load from OPFS: ${t instanceof Error ? t.message : String(t)}`);
      throw this.handleOPFSError(i, "load"), i;
    }
  }
  /**
   * Save database to OPFS storage
   */
  async saveDatabaseToOPFS() {
    if (!(!this.opfsPath || !this.sqliteManager.isConnected()))
      try {
        if (!this.isOPFSSupported())
          throw new Error("OPFS not supported");
        const e = await this.sqliteManager.serialize();
        await this.ensureSufficientSpace(e.length * 2);
        const t = await navigator.storage.getDirectory(), i = this.opfsPath.split("/").filter((d) => d.length > 0);
        let s = t;
        for (let d = 0; d < i.length - 1; d++)
          s = await s.getDirectoryHandle(i[d], { create: !0 });
        const r = i[i.length - 1], a = await (await s.getFileHandle(r, { create: !0 })).createWritable(), c = new ArrayBuffer(e.length);
        new Uint8Array(c).set(e), await a.write(c), await a.close(), this.lastSyncTime = Date.now(), this.log("debug", `Saved ${e.length} bytes to OPFS: ${this.opfsPath}`);
      } catch (e) {
        this.handleOPFSError(e instanceof Error ? e : new Error(String(e)), "save");
      }
  }
  /**
   * Clear OPFS database file
   */
  async clearDatabase() {
    if (this.opfsPath)
      try {
        if (!this.isOPFSSupported()) {
          this.log("warn", "OPFS not supported, cannot clear database");
          return;
        }
        const e = await navigator.storage.getDirectory(), t = this.opfsPath.split("/").filter((r) => r.length > 0);
        let i = e;
        for (let r = 0; r < t.length - 1; r++)
          try {
            i = await i.getDirectoryHandle(t[r], { create: !1 });
          } catch {
            this.log("debug", `Directory ${t[r]} doesn't exist, nothing to clear`);
            return;
          }
        const s = t[t.length - 1];
        try {
          await i.removeEntry(s), this.log("info", `Cleared OPFS database: ${this.opfsPath}`);
        } catch {
          this.log("debug", `File ${s} doesn't exist, nothing to clear`);
        }
      } catch (e) {
        this.handleOPFSError(e instanceof Error ? e : new Error(String(e)), "clear");
      }
  }
  /**
   * Start automatic OPFS synchronization
   */
  startAutoSync() {
    this.syncTimer || (this.syncTimer = setInterval(async () => {
      try {
        await this.saveDatabaseToOPFS();
      } catch (e) {
        this.log("warn", `Auto-sync failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }, this.syncInterval), this.log("info", `Started OPFS auto-sync with interval: ${this.syncInterval}ms`));
  }
  /**
   * Stop automatic OPFS synchronization
   */
  stopAutoSync() {
    this.syncTimer && (clearInterval(this.syncTimer), this.syncTimer = null, this.log("info", "Stopped OPFS auto-sync"));
  }
  /**
   * Force immediate OPFS synchronization
   */
  async forceSync() {
    this.opfsPath && this.sqliteManager.isConnected() && (await this.saveDatabaseToOPFS(), this.log("info", "Force sync completed"));
  }
  /**
   * Check OPFS storage quota
   */
  async checkQuota() {
    try {
      if (!this.isOPFSSupported() || !navigator.storage.estimate)
        return { available: -1, used: -1, total: -1 };
      const e = await navigator.storage.estimate(), t = e.quota || 0, i = e.usage || 0;
      return {
        available: t - i,
        used: i,
        total: t
      };
    } catch (e) {
      return this.log("warn", `Failed to check storage quota: ${e instanceof Error ? e.message : String(e)}`), { available: -1, used: -1, total: -1 };
    }
  }
  /**
   * Ensure sufficient storage space is available
   */
  async ensureSufficientSpace(e) {
    const t = await this.checkQuota();
    if (t.available === -1) {
      this.log("warn", "Cannot determine storage quota, proceeding with caution");
      return;
    }
    if (t.available < e) {
      const i = (t.available / 1048576).toFixed(2), s = (e / (1024 * 1024)).toFixed(2);
      throw new Q(
        `Insufficient storage space. Available: ${i}MB, Required: ${s}MB. Please clear browser data or use database.export() to backup your data.`
      );
    }
  }
  /**
   * Get pending database data for restoration
   */
  getPendingDatabaseData() {
    return this.pendingDatabaseData;
  }
  /**
   * Clear pending database data after restoration
   */
  clearPendingDatabaseData() {
    this.pendingDatabaseData = null;
  }
  /**
   * Get OPFS path
   */
  getOPFSPath() {
    return this.opfsPath;
  }
  /**
   * Get temporary database name
   */
  getTempDbName() {
    return this.tempDbName;
  }
  /**
   * Get last sync time
   */
  getLastSyncTime() {
    return this.lastSyncTime;
  }
  /**
   * Handle OPFS-specific errors with appropriate logging and user guidance
   */
  handleOPFSError(e, t) {
    this.log("error", `OPFS ${t} failed: ${e.message}`), e.message.includes("quota") || e.message.includes("storage") ? this.log("warn", "Storage quota exceeded. Consider clearing data or using export functionality.") : e.message.includes("permission") || e.message.includes("access") ? this.log("warn", "OPFS access denied. Browser may not support OPFS or permissions are restricted.") : e.message.includes("corrupt") || e.message.includes("invalid") ? this.log("warn", "Database file may be corrupted. Consider recreating the database.") : this.log("warn", "Unexpected OPFS error. Data may not persist between sessions."), this.log("info", "Mitigation strategies:"), this.log("info", "1. Use database.export() to backup your data"), this.log("info", "2. Clear browser storage to free up space"), this.log("info", "3. Use an in-memory database if persistence is not required");
  }
  /**
   * Cleanup resources
   */
  cleanup() {
    this.stopAutoSync(), this.opfsPath = null, this.tempDbName = null, this.pendingDatabaseData = null, this.lastSyncTime = 0;
  }
  log(e, t) {
    this.logger ? this.logger.log(e, t) : console.log(`[OPFSManager] ${e.toUpperCase()}: ${t}`);
  }
}
const M = 4;
class oe {
  constructor(e, t) {
    this.sqliteManager = e, this.logger = t;
  }
  /**
   * Initialize database schema
   */
  async initializeSchema() {
    if (!this.sqliteManager.isConnected())
      throw new m("Database not connected");
    try {
      let e = 0, t = !1;
      try {
        const i = await this.sqliteManager.select("SELECT MAX(schema_version) as version FROM collections");
        i.rows.length > 0 && i.rows[0].version !== null && (e = i.rows[0].version, this.log("info", `Current schema version: ${e}`));
        const s = await this.sqliteManager.select("SELECT COUNT(*) as count FROM docs_default");
        if (t = s.rows.length > 0 && s.rows[0].count > 0, e === M && t) {
          this.log("info", "Schema is up-to-date, skipping initialization");
          return;
        }
      } catch {
        this.log("debug", "Schema tables do not exist yet, proceeding with initialization");
      }
      if (e > 0 && e < M)
        throw new m(
          `Database schema v${e} detected. Schema v${M} requires database recreation. Please export your data, clear the database (db.clearAsync()), and reimport.`
        );
      await this.validateAndCleanupSchema(), await this.createSchema(), this.log("info", "Schema initialized successfully");
    } catch (e) {
      throw new m(`Schema initialization failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  /**
   * Migrate schema from older version to current version
   */
  async migrateSchema(e) {
    this.log("info", `Migrating schema from version ${e} to version ${M}`);
    try {
      this.log("info", `Successfully migrated from schema version ${e} to ${M}`);
    } catch (t) {
      throw new m(`Schema migration failed: ${t instanceof Error ? t.message : String(t)}`);
    }
  }
  /**
   * Migrate from schema version 1 to version 2
   */
  async migrateFromV1ToV2() {
    await this.sqliteManager.exec(`
      ALTER TABLE collections ADD COLUMN embedding_provider TEXT DEFAULT 'local';
      ALTER TABLE collections ADD COLUMN embedding_dimensions INTEGER DEFAULT 384;
      ALTER TABLE collections ADD COLUMN embedding_status TEXT DEFAULT 'enabled' CHECK(embedding_status IN ('enabled', 'disabled', 'pending'));
      ALTER TABLE collections ADD COLUMN processing_status TEXT DEFAULT 'idle' CHECK(processing_status IN ('idle', 'processing', 'error'));
    `), await this.sqliteManager.exec(`
      CREATE TABLE IF NOT EXISTS embedding_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        collection_name TEXT NOT NULL,
        document_id TEXT NOT NULL,
        text_content TEXT NOT NULL,
        priority INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
        retry_count INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        started_at INTEGER,
        completed_at INTEGER,
        processed_at INTEGER,
        error_message TEXT,
        FOREIGN KEY(collection_name) REFERENCES collections(name) ON DELETE CASCADE
      );
    `), await this.sqliteManager.exec(`
      CREATE INDEX IF NOT EXISTS idx_embedding_queue_status ON embedding_queue(status);
      CREATE INDEX IF NOT EXISTS idx_embedding_queue_collection ON embedding_queue(collection_name);
      CREATE INDEX IF NOT EXISTS idx_embedding_queue_priority ON embedding_queue(priority DESC);
      CREATE INDEX IF NOT EXISTS idx_embedding_queue_created ON embedding_queue(created_at);
    `), await this.sqliteManager.exec(`
      UPDATE collections SET schema_version = 2, updated_at = strftime('%s', 'now')
    `);
  }
  /**
   * Validate existing schema and cleanup incomplete installations
   */
  async validateAndCleanupSchema() {
    const e = await this.sqliteManager.select(`
      SELECT name FROM sqlite_master
      WHERE name IN ('docs_default', 'collections', 'fts_default', 'vec_default_dense', 'embedding_queue')
      ORDER BY name
    `);
    this.log("info", "Raw table query results:", e.rows);
    const t = e.rows.map((n) => n.name), i = ["docs_default", "collections", "fts_default", "vec_default_dense"], s = i.every((n) => t.includes(n));
    if (i.some((n) => t.includes(n)) && !s)
      this.log("warn", "Detected incomplete schema - cleaning up and recreating"), await this.cleanupIncompleteSchema(t);
    else if (s) {
      this.log("info", "Complete schema detected, skipping initialization");
      return;
    }
  }
  /**
   * Clean up incomplete schema installation
   */
  async cleanupIncompleteSchema(e) {
    const t = ["fts_default", "vec_default_dense"];
    for (const s of t)
      if (e.includes(s))
        try {
          await this.sqliteManager.exec(`DROP TABLE IF EXISTS ${s}`), this.log("info", `Dropped virtual table: ${s}`);
        } catch (r) {
          this.log("warn", `Failed to drop virtual table ${s}: ${r}`);
        }
    const i = ["docs_default", "collections", "embedding_queue"];
    for (const s of i)
      if (e.includes(s))
        try {
          await this.sqliteManager.exec(`DROP TABLE IF EXISTS ${s}`), this.log("info", `Dropped regular table: ${s}`);
        } catch (r) {
          this.log("warn", `Failed to drop regular table ${s}: ${r}`);
        }
  }
  /**
   * Create complete database schema
   */
  async createSchema() {
    await this.sqliteManager.exec(`
      -- Base documents table (v3 schema with separate collection column)
      CREATE TABLE IF NOT EXISTS docs_default (
        id TEXT PRIMARY KEY,
        title TEXT,
        content TEXT NOT NULL,
        collection TEXT NOT NULL DEFAULT 'default',
        metadata JSON,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      -- Index for efficient collection filtering
      CREATE INDEX IF NOT EXISTS idx_docs_collection ON docs_default(collection);

      -- Full-text search table (EXTERNAL CONTENT - requires manual sync)
      -- NOTE: FTS5 sync is handled manually in DatabaseWorker to avoid
      --       memory exhaustion during batch transactions
      -- TOKENIZER: unicode61 for proper Unicode support (Cyrillic, CJK, etc.)
      CREATE VIRTUAL TABLE IF NOT EXISTS fts_default USING fts5(
        title, content, metadata,
        content=docs_default,
        content_rowid=rowid,
        tokenize='unicode61'
      );

      -- Vector search table (384-dimensional dense vectors)
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_default_dense USING vec0(
        embedding float[384]
      );

      -- Collections metadata with embedding configuration
      CREATE TABLE IF NOT EXISTS collections (
        name TEXT PRIMARY KEY,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now')),
        schema_version INTEGER DEFAULT ${M},
        config JSON,
        embedding_provider TEXT DEFAULT 'local',
        embedding_dimensions INTEGER DEFAULT 384,
        embedding_status TEXT DEFAULT 'enabled' CHECK(embedding_status IN ('enabled', 'disabled', 'pending')),
        processing_status TEXT DEFAULT 'idle' CHECK(processing_status IN ('idle', 'processing', 'error'))
      );

      -- Embedding queue for background processing
      CREATE TABLE IF NOT EXISTS embedding_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        collection_name TEXT NOT NULL,
        document_id TEXT NOT NULL,
        text_content TEXT NOT NULL,
        priority INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'completed', 'failed')),
        retry_count INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        started_at INTEGER,
        completed_at INTEGER,
        processed_at INTEGER,
        error_message TEXT,
        FOREIGN KEY(collection_name) REFERENCES collections(name) ON DELETE CASCADE
      );

      -- Create indexes for embedding queue performance
      CREATE INDEX IF NOT EXISTS idx_embedding_queue_status ON embedding_queue(status);
      CREATE INDEX IF NOT EXISTS idx_embedding_queue_collection ON embedding_queue(collection_name);
      CREATE INDEX IF NOT EXISTS idx_embedding_queue_priority ON embedding_queue(priority DESC);
      CREATE INDEX IF NOT EXISTS idx_embedding_queue_created ON embedding_queue(created_at);

      -- Insert default collection info
      INSERT OR IGNORE INTO collections (name, config)
      VALUES ('default', '{"vectorDim": 384, "metric": "cosine"}');
    `);
  }
  /**
   * Get collection information
   */
  async getCollectionInfo(e) {
    try {
      const t = await this.sqliteManager.select(
        "SELECT * FROM collections WHERE name = ?",
        [e]
      );
      if (t.rows.length === 0)
        throw new m(`Collection '${e}' not found`);
      const i = t.rows[0], s = await this.sqliteManager.select(
        "SELECT COUNT(*) as count FROM docs_default WHERE collection = ?",
        [e]
      );
      let r;
      try {
        r = JSON.parse(i.config || "{}");
      } catch {
        r = {};
      }
      return {
        name: i.name,
        createdAt: i.created_at,
        schemaVersion: i.schema_version,
        vectorDimensions: r.vectorDim || 384,
        documentCount: s.rows[0]?.count || 0
      };
    } catch (t) {
      throw new m(`Failed to get collection info: ${t instanceof Error ? t.message : String(t)}`);
    }
  }
  /**
   * Create a new collection
   */
  async createCollection(e, t = 384, i = {}) {
    try {
      if ((await this.sqliteManager.select(
        "SELECT name FROM collections WHERE name = ?",
        [e]
      )).rows.length > 0)
        throw new m(`Collection '${e}' already exists`);
      const r = {
        vectorDim: t,
        metric: "cosine",
        ...i
      };
      await this.sqliteManager.exec(`
        INSERT INTO collections (name, config, schema_version, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      const n = Math.floor(Date.now() / 1e3), a = await this.sqliteManager.select(
        "SELECT ? as name, ? as config, ? as schema_version, ? as created_at, ? as updated_at",
        [
          e,
          JSON.stringify(r),
          M,
          n,
          n
        ]
      );
      await this.sqliteManager.exec(
        `INSERT INTO collections (name, config, schema_version, created_at, updated_at)
         VALUES ('${e}', '${JSON.stringify(r)}', ${M}, ${n}, ${n})`
      ), this.log("info", `Collection '${e}' created with ${t} dimensions`);
    } catch (s) {
      throw new m(`Failed to create collection: ${s instanceof Error ? s.message : String(s)}`);
    }
  }
  /**
   * Check if collection exists
   */
  async collectionExists(e) {
    try {
      return (await this.sqliteManager.select(
        "SELECT name FROM collections WHERE name = ?",
        [e]
      )).rows.length > 0;
    } catch {
      return !1;
    }
  }
  /**
   * Get current schema version
   */
  async getSchemaVersion() {
    try {
      return (await this.sqliteManager.select("SELECT MAX(schema_version) as version FROM collections")).rows[0]?.version || 0;
    } catch {
      return 0;
    }
  }
  /**
   * Validate schema integrity
   */
  async validateSchema() {
    try {
      const e = ["docs_default", "collections", "fts_default", "vec_default_dense"];
      for (const t of e)
        if ((await this.sqliteManager.select(
          "SELECT name FROM sqlite_master WHERE type='table' AND name = ?",
          [t]
        )).rows.length === 0)
          return this.log("error", `Required table '${t}' is missing`), !1;
      return !0;
    } catch (e) {
      return this.log("error", `Schema validation failed: ${e instanceof Error ? e.message : String(e)}`), !1;
    }
  }
  log(e, t, i) {
    this.logger ? this.logger.log(e, t, i) : console.log(`[SchemaManager] ${e.toUpperCase()}: ${t}`, i || "");
  }
}
class ae {
  constructor(e, t) {
    this.sqliteManager = e, this.logger = t;
  }
  /**
   * Enqueue a document for embedding generation
   */
  async enqueue(e) {
    const { collection: t, documentId: i, textContent: s, priority: r = 0 } = e;
    try {
      await this.verifyCollectionExists(t);
      const a = (await this.sqliteManager.select(`
        INSERT OR REPLACE INTO embedding_queue
        (collection_name, document_id, text_content, priority, status, created_at)
        VALUES (?, ?, ?, ?, 'pending', strftime('%s', 'now'))
        RETURNING id
      `, [t, i, s, r])).rows[0]?.id;
      if (!a) {
        const l = (await this.sqliteManager.select("SELECT last_insert_rowid() as id")).rows[0]?.id;
        if (!l)
          throw new m("Failed to get queue item ID");
        return this.log("info", `Enqueued embedding for document '${i}' in collection '${t}' with priority ${r} (ID: ${l})`), l;
      }
      return this.log("info", `Enqueued embedding for document '${i}' in collection '${t}' with priority ${r} (ID: ${a})`), a;
    } catch (n) {
      throw new m(`Failed to enqueue embedding: ${n instanceof Error ? n.message : String(n)}`);
    }
  }
  /**
   * Process pending items in the queue
   */
  async processQueue(e, t) {
    const { collection: i, batchSize: s = 10, maxRetries: r = 3 } = e;
    try {
      const n = await this.getPendingItems(i, s);
      if (n.length === 0)
        return this.log("info", `No pending items in embedding queue${i ? " for collection " + i : ""}`), { processed: 0, failed: 0, remainingInQueue: 0, errors: [] };
      this.log("info", `Processing ${n.length} items from embedding queue`);
      const a = {
        processed: 0,
        failed: 0,
        remainingInQueue: 0,
        errors: []
      };
      for (const l of n) {
        a.processed++;
        try {
          await this.markAsProcessing(l.id);
          const d = await t(l.collection_name, l.content);
          await this.storeEmbedding(l.collection_name, l.document_id, d), await this.markAsCompleted(l.id), this.log("debug", `Successfully processed embedding for document '${l.document_id}' in collection '${l.collection_name}'`);
        } catch (d) {
          const h = d instanceof Error ? d.message : String(d);
          l.retry_count < r ? (await this.markForRetry(l.id, l.retry_count + 1), this.log("warn", `Embedding processing failed for document '${l.document_id}', will retry (attempt ${l.retry_count + 1}/${r}): ${h}`)) : (await this.markAsFailed(l.id, h), a.failed++, a.errors.push({
            documentId: l.document_id,
            error: h
          }), this.log("error", `Embedding processing failed permanently for document '${l.document_id}' after ${r} retries: ${h}`));
        }
      }
      const c = await this.sqliteManager.select(`
        SELECT COUNT(*) as count FROM embedding_queue
        WHERE status = 'pending'${i ? " AND collection_name = ?" : ""}
      `, i ? [i] : []);
      return a.remainingInQueue = c.rows[0]?.count || 0, this.log("info", `Queue processing completed: ${a.processed - a.failed} successful, ${a.failed} failed, ${a.remainingInQueue} remaining`), a;
    } catch (n) {
      throw new m(`Failed to process embedding queue: ${n instanceof Error ? n.message : String(n)}`);
    }
  }
  /**
   * Get queue status statistics
   */
  async getStatus(e) {
    try {
      let t = `
        SELECT
          status,
          COUNT(*) as count,
          AVG(CASE
            WHEN status = 'completed' AND processed_at IS NOT NULL AND started_at IS NOT NULL
            THEN processed_at - started_at
            ELSE NULL
          END) as avg_processing_time
        FROM embedding_queue
      `, i = [];
      e && (t += " WHERE collection_name = ?", i.push(e)), t += " GROUP BY status";
      const s = await this.sqliteManager.select(t, i), r = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        total: 0
      };
      let n = 0, a = 0;
      for (const l of s.rows) {
        const d = l.status, h = l.count;
        d in r && (r[d] = h, r.total += h), d === "completed" && l.avg_processing_time && (n += l.avg_processing_time * h, a += h);
      }
      a > 0 && (r.avgProcessingTime = Math.round(n / a));
      let c = [];
      return e || (c = (await this.sqliteManager.select(`
          SELECT DISTINCT collection_name
          FROM embedding_queue
          ORDER BY collection_name
        `)).rows.map((d) => d.collection_name)), {
        collection: e || "global",
        pendingCount: r.pending,
        processingCount: r.processing,
        completedCount: r.completed,
        failedCount: r.failed,
        totalCount: r.total,
        averageProcessingTime: r.avgProcessingTime
      };
    } catch (t) {
      throw new m(`Failed to get queue status: ${t instanceof Error ? t.message : String(t)}`);
    }
  }
  /**
   * Clear queue items based on criteria
   */
  async clearQueue(e = {}) {
    const { collection: t, status: i } = e;
    try {
      let s = "DELETE FROM embedding_queue WHERE 1=1";
      const r = [];
      t && (s += " AND collection_name = ?", r.push(t)), i && (s += " AND status = ?", r.push(i)), await this.sqliteManager.exec(s);
      const n = s.replace("DELETE FROM embedding_queue", "SELECT COUNT(*) as count FROM embedding_queue"), c = (await this.sqliteManager.select("SELECT COUNT(*) as count FROM embedding_queue")).rows[0]?.count || 0;
      return this.log("info", `Cleared ${c} items from embedding queue`), c;
    } catch (s) {
      throw new m(`Failed to clear embedding queue: ${s instanceof Error ? s.message : String(s)}`);
    }
  }
  /**
   * Get pending queue items with priority ordering
   */
  async getPendingItems(e, t = 10) {
    let i = `
      SELECT id, collection_name, document_id, text_content as content, status, priority,
             retry_count, created_at, started_at, completed_at, processed_at, error_message
      FROM embedding_queue
      WHERE status = 'pending'
    `;
    const s = [];
    return e && (i += " AND collection_name = ?", s.push(e)), i += " ORDER BY priority DESC, created_at ASC LIMIT ?", s.push(t), (await this.sqliteManager.select(i, s)).rows.map((n) => ({
      id: n.id,
      collection_name: n.collection_name,
      document_id: n.document_id,
      content: n.content,
      status: n.status,
      priority: n.priority,
      retry_count: n.retry_count,
      created_at: n.created_at,
      started_at: n.started_at,
      completed_at: n.completed_at,
      processed_at: n.processed_at,
      error_message: n.error_message
    }));
  }
  /**
   * Mark queue item as processing
   */
  async markAsProcessing(e) {
    await this.sqliteManager.exec(`
      UPDATE embedding_queue
      SET status = 'processing', started_at = strftime('%s', 'now')
      WHERE id = ?
    `), await this.sqliteManager.select(
      "UPDATE embedding_queue SET status = 'processing', started_at = strftime('%s', 'now') WHERE id = ? RETURNING id",
      [e]
    );
  }
  /**
   * Mark queue item as completed
   */
  async markAsCompleted(e) {
    await this.sqliteManager.select(
      "UPDATE embedding_queue SET status = 'completed', completed_at = strftime('%s', 'now'), processed_at = strftime('%s', 'now') WHERE id = ? RETURNING id",
      [e]
    );
  }
  /**
   * Mark queue item as failed
   */
  async markAsFailed(e, t) {
    await this.sqliteManager.select(
      "UPDATE embedding_queue SET status = 'failed', error_message = ?, processed_at = strftime('%s', 'now') WHERE id = ? RETURNING id",
      [t, e]
    );
  }
  /**
   * Mark queue item for retry
   */
  async markForRetry(e, t) {
    await this.sqliteManager.select(
      "UPDATE embedding_queue SET status = 'pending', retry_count = ?, processed_at = strftime('%s', 'now') WHERE id = ? RETURNING id",
      [t, e]
    );
  }
  /**
   * Store embedding in vector table
   */
  async storeEmbedding(e, t, i) {
    const s = await this.sqliteManager.select(
      "SELECT rowid FROM docs_default WHERE id = ? AND collection = ?",
      [t, e]
    );
    if (s.rows.length === 0)
      throw new m(`Document '${t}' not found in collection '${e}'`);
    const r = s.rows[0].rowid, n = new Uint8Array(i.buffer);
    await this.sqliteManager.select(
      "INSERT OR REPLACE INTO vec_default_dense (rowid, embedding) VALUES (?, ?)",
      [r, n]
    ), this.log("debug", `Stored embedding for document '${t}' (rowid: ${r}) with ${i.length} dimensions`);
  }
  /**
   * Verify collection exists
   */
  async verifyCollectionExists(e) {
    if ((await this.sqliteManager.select(
      "SELECT name FROM collections WHERE name = ?",
      [e]
    )).rows.length === 0)
      throw new m(`Collection '${e}' does not exist`);
  }
  log(e, t, i) {
    this.logger ? this.logger.log(e, t, i) : console.log(`[EmbeddingQueue] ${e.toUpperCase()}: ${t}`, i || "");
  }
}
class le {
  // 5 minutes
  constructor(e, t) {
    this.sqliteManager = e, this.logger = t, this.providers = /* @__PURE__ */ new Map(), this.initPromises = /* @__PURE__ */ new Map(), this.cleanupTimer = null, this.maxCacheAge = 30 * 60 * 1e3, this.cleanupInterval = 5 * 60 * 1e3, this.startCleanupTimer();
  }
  /**
   * Get or create embedding provider for a collection
   */
  async getProvider(e) {
    try {
      const t = this.providers.get(e);
      if (t)
        return t.lastUsed = Date.now(), t.provider;
      const i = this.initPromises.get(e);
      if (i)
        return await i;
      const s = this.initializeProvider(e);
      this.initPromises.set(e, s);
      try {
        const r = await s;
        return this.cacheProvider(e, r), this.initPromises.delete(e), r;
      } catch (r) {
        throw this.initPromises.delete(e), r;
      }
    } catch (t) {
      return this.log("error", `Failed to get embedding provider for collection '${e}': ${t instanceof Error ? t.message : String(t)}`), null;
    }
  }
  /**
   * Initialize embedding provider for a collection
   */
  async initializeProvider(e) {
    try {
      const t = await this.sqliteManager.select(
        "SELECT config FROM collections WHERE name = ?",
        [e]
      );
      if (t.rows.length === 0)
        throw new F(`Collection '${e}' not found`);
      const s = JSON.parse(t.rows[0].config || "{}").embeddingConfig;
      if (!s)
        throw new F(`Collection '${e}' has no embedding configuration`);
      const r = await X.createProvider(s);
      if (typeof r.initialize == "function") {
        const n = {
          defaultProvider: s.provider,
          defaultDimensions: s.dimensions,
          provider: s.provider,
          defaultModel: s.model,
          apiKey: s.apiKey,
          batchSize: s.batchSize,
          timeout: s.timeout,
          enabled: s.autoGenerate !== !1
        };
        await r.initialize(n);
      }
      return this.log("info", `Initialized embedding provider '${s.provider}' for collection '${e}'`), r;
    } catch (t) {
      throw new F(`Failed to initialize embedding provider for collection '${e}': ${t instanceof Error ? t.message : String(t)}`);
    }
  }
  /**
   * Cache provider with metadata
   */
  cacheProvider(e, t) {
    this.sqliteManager.select(
      "SELECT config FROM collections WHERE name = ?",
      [e]
    ).then((i) => {
      if (i.rows.length > 0) {
        const r = JSON.parse(i.rows[0].config || "{}").embeddingConfig;
        this.providers.set(e, {
          provider: t,
          config: r,
          lastUsed: Date.now()
        });
      }
    }).catch((i) => {
      this.log("warn", `Failed to cache provider config for collection '${e}': ${i instanceof Error ? i.message : String(i)}`);
    });
  }
  /**
   * Remove provider from cache
   */
  async removeProvider(e) {
    const t = this.providers.get(e);
    if (t) {
      try {
        typeof t.provider.dispose == "function" && await t.provider.dispose();
      } catch (i) {
        this.log("warn", `Error disposing provider for collection '${e}': ${i instanceof Error ? i.message : String(i)}`);
      }
      this.providers.delete(e), this.log("debug", `Removed provider for collection '${e}' from cache`);
    }
  }
  /**
   * Update provider configuration
   */
  async updateProviderConfig(e, t) {
    await this.removeProvider(e), this.initPromises.delete(e), this.log("info", `Updated provider configuration for collection '${e}'`);
  }
  /**
   * Get provider health status
   */
  async getProviderHealth(e) {
    try {
      const t = await this.getProvider(e);
      if (!t)
        return { healthy: !1, error: "Provider not available" };
      if (typeof t.healthCheck == "function")
        try {
          return { healthy: (await t.healthCheck()).isHealthy };
        } catch (i) {
          return { healthy: !1, error: i instanceof Error ? i.message : String(i) };
        }
      try {
        return { healthy: (await t.generateEmbedding("test")).length > 0 };
      } catch (i) {
        return { healthy: !1, error: i instanceof Error ? i.message : String(i) };
      }
    } catch (t) {
      return { healthy: !1, error: t instanceof Error ? t.message : String(t) };
    }
  }
  /**
   * Get all cached providers
   */
  getCachedProviders() {
    return Array.from(this.providers.keys());
  }
  /**
   * Get provider statistics
   */
  getProviderStats() {
    return Array.from(this.providers.entries()).map(([e, t]) => ({
      collection: e,
      type: t.config.provider,
      lastUsed: t.lastUsed
    }));
  }
  /**
   * Cleanup expired providers
   */
  async cleanupExpiredProviders() {
    const e = Date.now(), t = [];
    for (const [i, s] of this.providers.entries())
      e - s.lastUsed > this.maxCacheAge && t.push(i);
    if (t.length > 0) {
      this.log("debug", `Cleaning up ${t.length} expired providers`);
      for (const i of t)
        await this.removeProvider(i);
    }
  }
  /**
   * Start cleanup timer for expired providers
   */
  startCleanupTimer() {
    this.cleanupTimer || (this.cleanupTimer = setInterval(async () => {
      try {
        await this.cleanupExpiredProviders();
      } catch (e) {
        this.log("warn", `Provider cleanup error: ${e instanceof Error ? e.message : String(e)}`);
      }
    }, this.cleanupInterval), this.log("debug", `Started provider cleanup timer with interval: ${this.cleanupInterval}ms`));
  }
  /**
   * Stop cleanup timer
   */
  stopCleanupTimer() {
    this.cleanupTimer && (clearInterval(this.cleanupTimer), this.cleanupTimer = null, this.log("debug", "Stopped provider cleanup timer"));
  }
  /**
   * Dispose all providers and cleanup resources
   */
  async dispose() {
    this.log("info", `Disposing ${this.providers.size} embedding providers`), this.stopCleanupTimer();
    const e = Array.from(this.providers.keys()).map(
      (t) => this.removeProvider(t)
    );
    try {
      await Promise.all(e), this.log("info", "All embedding providers disposed successfully");
    } catch (t) {
      this.log("error", `Error during provider disposal: ${t instanceof Error ? t.message : String(t)}`);
    }
    this.providers.clear(), this.initPromises.clear();
  }
  /**
   * Force refresh all providers (reload configurations)
   */
  async refreshAll() {
    this.log("info", "Refreshing all embedding providers");
    const e = Array.from(this.providers.keys());
    for (const t of e)
      await this.removeProvider(t);
    this.log("info", `Refreshed ${e.length} embedding providers`);
  }
  log(e, t, i) {
    this.logger ? this.logger.log(e, t, i) : console.log(`[ProviderManager] ${e.toUpperCase()}: ${t}`, i || "");
  }
}
class k extends Error {
  constructor(e, t, i) {
    super(e), this.name = "ContextualError", this.context = t, this.originalError = i, Error.captureStackTrace && Error.captureStackTrace(this, k);
  }
  /**
   * Get full error message with context
   */
  getFullMessage() {
    const e = [
      `[${this.context.component}:${this.context.operation}]`,
      this.message
    ];
    return this.originalError && e.push(`Original: ${this.originalError.message}`), e.join(" ");
  }
  /**
   * Convert to plain object for serialization
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      context: this.context,
      originalError: this.originalError ? {
        name: this.originalError.name,
        message: this.originalError.message,
        stack: this.originalError.stack
      } : null,
      stack: this.stack
    };
  }
}
class N {
  static {
    this.errorHistory = [];
  }
  static {
    this.maxHistorySize = 100;
  }
  /**
   * Wrap an operation with error handling and context
   */
  static async withContext(e, t, i, s) {
    try {
      return await i();
    } catch (r) {
      const n = {
        operation: e,
        component: t,
        params: s,
        timestamp: Date.now(),
        stackTrace: r instanceof Error ? r.stack : void 0
      }, a = new k(
        r instanceof Error ? r.message : String(r),
        n,
        r instanceof Error ? r : void 0
      );
      throw this.addToHistory(a), a;
    }
  }
  /**
   * Execute operation with retry logic
   */
  static async withRetry(e, t) {
    const i = t.maxRetries || 3, s = t.retryDelay || 1e3;
    let r = null;
    for (let n = 1; n <= i; n++)
      try {
        return await e();
      } catch (a) {
        if (r = a instanceof Error ? a : new Error(String(a)), t.onRetry && t.onRetry(n, r), n === i)
          break;
        await new Promise((c) => setTimeout(c, s * n));
      }
    if (t.strategy === "fallback" && t.fallbackValue !== void 0)
      return t.onFallback && t.onFallback(r), t.fallbackValue;
    throw r || new Error("Operation failed after retries");
  }
  /**
   * Classify error for appropriate handling
   */
  static classifyError(e) {
    return e instanceof m ? this.classifyDatabaseError(e) : e instanceof U ? {
      category: "vector",
      severity: "high",
      recoverable: !1,
      userMessage: "Vector search functionality is not available",
      suggestedAction: "Check if sqlite-vec extension is properly loaded"
    } : e instanceof Q ? {
      category: "opfs",
      severity: "medium",
      recoverable: !0,
      userMessage: "Data persistence may not work properly",
      suggestedAction: "Check browser storage settings or clear storage"
    } : e instanceof F ? {
      category: "embedding",
      severity: "medium",
      recoverable: !0,
      userMessage: "Embedding generation failed",
      suggestedAction: "Check embedding provider configuration or try again"
    } : e.message.includes("fetch") || e.message.includes("network") ? {
      category: "network",
      severity: "medium",
      recoverable: !0,
      userMessage: "Network operation failed",
      suggestedAction: "Check internet connection and try again"
    } : e.message.includes("invalid") || e.message.includes("validation") ? {
      category: "validation",
      severity: "low",
      recoverable: !1,
      userMessage: "Invalid input provided",
      suggestedAction: "Check your input data and try again"
    } : {
      category: "unknown",
      severity: "medium",
      recoverable: !1,
      userMessage: "An unexpected error occurred",
      suggestedAction: "Try refreshing the page or contact support"
    };
  }
  /**
   * Classify database-specific errors
   */
  static classifyDatabaseError(e) {
    const t = e.message.toLowerCase();
    return t.includes("sqlite") && t.includes("corrupt") ? {
      category: "database",
      severity: "critical",
      recoverable: !1,
      userMessage: "Database is corrupted",
      suggestedAction: "Clear browser storage and reimport your data"
    } : t.includes("disk") || t.includes("space") ? {
      category: "database",
      severity: "high",
      recoverable: !0,
      userMessage: "Storage space is full",
      suggestedAction: "Clear browser storage or export data to free space"
    } : t.includes("locked") || t.includes("busy") ? {
      category: "database",
      severity: "medium",
      recoverable: !0,
      userMessage: "Database is temporarily busy",
      suggestedAction: "Wait a moment and try again"
    } : t.includes("permission") || t.includes("access") ? {
      category: "database",
      severity: "high",
      recoverable: !1,
      userMessage: "Database access denied",
      suggestedAction: "Check browser permissions and security settings"
    } : {
      category: "database",
      severity: "medium",
      recoverable: !1,
      userMessage: "Database operation failed",
      suggestedAction: "Try refreshing the page"
    };
  }
  /**
   * Create user-friendly error message with recovery suggestions
   */
  static createUserMessage(e) {
    const t = this.classifyError(e);
    let i = t.userMessage;
    return t.suggestedAction && (i += `. ${t.suggestedAction}`), i;
  }
  /**
   * Add error to history for debugging
   */
  static addToHistory(e) {
    this.errorHistory.push(e), this.errorHistory.length > this.maxHistorySize && (this.errorHistory = this.errorHistory.slice(-this.maxHistorySize));
  }
  /**
   * Get recent error history
   */
  static getErrorHistory(e) {
    return e && e > 0 ? this.errorHistory.slice(-e) : [...this.errorHistory];
  }
  /**
   * Clear error history
   */
  static clearHistory() {
    this.errorHistory = [];
  }
  /**
   * Check if an error is recoverable
   */
  static isRecoverable(e) {
    return this.classifyError(e).recoverable;
  }
  /**
   * Get error severity level
   */
  static getSeverity(e) {
    return this.classifyError(e).severity;
  }
  /**
   * Create a standardized error response for RPC
   */
  static createErrorResponse(e, t) {
    const i = this.classifyError(e);
    return {
      success: !1,
      error: {
        message: e.message,
        userMessage: i.userMessage,
        category: i.category,
        severity: i.severity,
        recoverable: i.recoverable,
        suggestedAction: i.suggestedAction,
        timestamp: Date.now(),
        requestId: t
      }
    };
  }
  /**
   * Sanitize error for logging (remove sensitive data)
   */
  static sanitizeError(e, t = []) {
    const s = [...["password", "token", "key", "secret", "auth"], ...t], r = (n) => {
      if (typeof n != "object" || n === null)
        return n;
      if (Array.isArray(n))
        return n.map(r);
      const a = {};
      for (const [c, l] of Object.entries(n))
        s.some((d) => c.toLowerCase().includes(d)) ? a[c] = "[REDACTED]" : typeof l == "object" ? a[c] = r(l) : a[c] = l;
      return a;
    };
    return {
      name: e.name,
      message: e.message,
      stack: e.stack,
      context: e instanceof k ? r(e.context) : void 0
    };
  }
}
function ce(o) {
  return o == null || typeof o == "string" || typeof o == "number" || o instanceof Uint8Array || o instanceof Float32Array;
}
function W(o) {
  return Array.isArray(o) && o.every(ce);
}
function de(o) {
  return typeof o == "object" && o !== null && typeof o.filename == "string" && (o.path === void 0 || typeof o.path == "string") && (o.vfs === void 0 || o.vfs === "opfs" || o.vfs === "opfs-sahpool") && (o.pragmas === void 0 || typeof o.pragmas == "object" && o.pragmas !== null);
}
function he(o) {
  return typeof o == "object" && o !== null && typeof o.sql == "string" && (o.params === void 0 || W(o.params));
}
function ge(o) {
  return typeof o == "object" && o !== null && typeof o.sql == "string" && (o.params === void 0 || W(o.params));
}
function ue(o) {
  return typeof o == "object" && o !== null && typeof o.tableName == "string" && Array.isArray(o.data) && o.data.every(
    (e) => typeof e == "object" && e !== null && !Array.isArray(e)
  );
}
function fe(o) {
  return typeof o == "object" && o !== null && typeof o.name == "string" && (o.dimensions === void 0 || typeof o.dimensions == "number") && (o.config === void 0 || typeof o.config == "object" && o.config !== null);
}
function me(o) {
  return typeof o == "object" && o !== null && typeof o.collection == "string" && // Validate nested document object
  typeof o.document == "object" && o.document !== null && (o.document.id === void 0 || typeof o.document.id == "string") && typeof o.document.content == "string" && (o.document.title === void 0 || typeof o.document.title == "string") && (o.document.metadata === void 0 || typeof o.document.metadata == "object" && o.document.metadata !== null) && // Validate optional options object
  (o.options === void 0 || typeof o.options == "object" && o.options !== null);
}
function Ee(o) {
  return typeof o == "object" && o !== null && (o.data instanceof Uint8Array || o.data instanceof ArrayBuffer) && (o.overwrite === void 0 || typeof o.overwrite == "boolean");
}
function pe(o) {
  return typeof o == "object" && o !== null && typeof o.collection == "string" && typeof o.content == "string" && (o.options === void 0 || typeof o.options == "object" && o.options !== null);
}
function ye(o) {
  return typeof o == "object" && o !== null && typeof o.collection == "string" && Array.isArray(o.documents) && o.documents.every(
    (e) => typeof e == "object" && e !== null && typeof e.id == "string" && typeof e.content == "string"
  ) && (o.options === void 0 || typeof o.options == "object" && o.options !== null);
}
function be(o) {
  return typeof o == "object" && o !== null && typeof o.collection == "string" && typeof o.documentId == "string" && typeof o.textContent == "string" && (o.priority === void 0 || typeof o.priority == "number");
}
function we(o) {
  return o === void 0 || typeof o == "object" && o !== null && (o.collection === void 0 || typeof o.collection == "string") && (o.batchSize === void 0 || typeof o.batchSize == "number") && (o.onProgress === void 0 || typeof o.onProgress == "function");
}
function Se(o) {
  return o === void 0 || typeof o == "object" && o !== null && (o.collection === void 0 || typeof o.collection == "string") && (o.status === void 0 || typeof o.status == "string");
}
function ve(o) {
  return typeof o == "string" && o.length > 0 && o.length <= 255 && /^[a-zA-Z0-9_-]+$/.test(o);
}
function Te(o) {
  return typeof o == "string" && o.length > 0 && o.length <= 255;
}
function _e(o) {
  return typeof o == "number" && Number.isInteger(o) && o > 0 && o <= 1e4;
}
function Ce(o) {
  return typeof o == "number" && o >= 0 && o <= 1;
}
class P {
  /**
   * Validate and sanitize parameters for a worker method
   */
  static validate(e, t, i) {
    if (!t(e))
      throw new Error(`Invalid parameters for ${i}: ${JSON.stringify(e)}`);
    return e;
  }
  /**
   * Validate collection name with additional business rules
   */
  static validateCollectionName(e, t) {
    if (!ve(e))
      throw new Error(`Invalid collection name for ${t}: must be a non-empty alphanumeric string with underscores/hyphens, max 255 characters`);
    if (["sqlite_master", "sqlite_temp_master", "sqlite_sequence"].includes(e.toLowerCase()))
      throw new Error(`Collection name '${e}' is reserved`);
    return e;
  }
  /**
   * Validate document ID with additional business rules
   */
  static validateDocumentId(e, t) {
    if (!Te(e))
      throw new Error(`Invalid document ID for ${t}: must be a non-empty string, max 255 characters`);
    return e;
  }
  /**
   * Validate and sanitize SQL parameters
   */
  static validateSQLParams(e, t) {
    if (e !== void 0) {
      if (!W(e))
        throw new Error(`Invalid SQL parameters for ${t}: must be an array of SQL values`);
      return Array.isArray(e) ? e.forEach((i, s) => {
        if (typeof i == "string" && i.length > 1e5)
          throw new Error(`SQL parameter ${s} too large (${i.length} chars) for ${t}`);
        if (i instanceof Uint8Array && i.length > 1e7)
          throw new Error(`SQL parameter ${s} blob too large (${i.length} bytes) for ${t}`);
      }) : Object.entries(e).forEach(([i, s]) => {
        if (typeof s == "string" && s.length > 1e5)
          throw new Error(`SQL parameter ${i} too large (${s.length} chars) for ${t}`);
        if (s instanceof Uint8Array && s.length > 1e7)
          throw new Error(`SQL parameter ${i} blob too large (${s.length} bytes) for ${t}`);
      }), e;
    }
  }
  /**
   * Validate embedding dimensions
   */
  static validateEmbeddingDimensions(e, t) {
    if (typeof e != "number" || !Number.isInteger(e) || e <= 0)
      throw new Error(`Invalid embedding dimensions for ${t}: must be a positive integer`);
    if (e > 4096)
      throw new Error(`Embedding dimensions too large for ${t}: maximum 4096 dimensions supported`);
    return e;
  }
  /**
   * Validate search limit parameter
   */
  static validateLimit(e, t, i = 10) {
    if (e === void 0)
      return i;
    if (!_e(e))
      throw new Error(`Invalid limit for ${t}: must be a positive integer between 1 and 10000`);
    return e;
  }
  /**
   * Validate search threshold parameter
   */
  static validateThreshold(e, t) {
    if (e !== void 0) {
      if (!Ce(e))
        throw new Error(`Invalid threshold for ${t}: must be a number between 0 and 1`);
      return e;
    }
  }
}
class Ie {
  constructor(e) {
    this.sqliteManager = e.sqliteManager, this.schemaManager = e.schemaManager, this.opfsManager = e.opfsManager, this.logger = e.logger;
  }
  /**
   * Execute an operation with error handling and context
   */
  async withContext(e, t, i) {
    return N.withContext(
      e,
      this.getComponentName(),
      t,
      i
    );
  }
  /**
   * Execute an operation with retry logic
   */
  async withRetry(e, t = 3, i = 1e3) {
    return N.withRetry(e, {
      strategy: "retry",
      maxRetries: t,
      retryDelay: i,
      onRetry: (s, r) => {
        this.log("warn", `Operation retry ${s}/${t}: ${r.message}`);
      }
    });
  }
  /**
   * Validate parameters using type guards
   */
  validateParams(e, t, i) {
    return P.validate(e, t, `${this.getComponentName()}.${i}`);
  }
  /**
   * Ensure database is initialized before operations
   */
  ensureInitialized() {
    if (!this.sqliteManager.isConnected())
      throw new Error("Database not initialized - call open() first");
  }
  /**
   * Measure operation performance
   */
  async measurePerformance(e, t) {
    const i = Date.now();
    try {
      const s = await t(), r = Date.now() - i;
      return this.log("debug", `${e} completed in ${r}ms`), s;
    } catch (s) {
      const r = Date.now() - i;
      throw this.log("debug", `${e} failed after ${r}ms`), s;
    }
  }
  /**
   * Log message with component context
   */
  log(e, t, i) {
    this.logger ? this.logger.log(e, `[${this.getComponentName()}] ${t}`, i) : console.log(`[${this.getComponentName()}] ${e.toUpperCase()}: ${t}`, i || "");
  }
  /**
   * Create standardized error response for RPC
   */
  createErrorResponse(e, t) {
    return N.createErrorResponse(e, t);
  }
  /**
   * Check if error is recoverable
   */
  isRecoverableError(e) {
    return N.isRecoverable(e);
  }
  /**
   * Create user-friendly error message
   */
  createUserMessage(e) {
    return N.createUserMessage(e);
  }
  /**
   * Sanitize sensitive data from parameters for logging
   */
  sanitizeParams(e, t = []) {
    const s = [...["password", "token", "key", "secret"], ...t];
    if (typeof e != "object" || e === null)
      return e;
    const r = {};
    for (const [n, a] of Object.entries(e))
      s.some((c) => n.toLowerCase().includes(c)) ? r[n] = "[REDACTED]" : typeof a == "object" ? r[n] = this.sanitizeParams(a, t) : r[n] = a;
    return r;
  }
  /**
   * Validate collection name with business rules
   */
  validateCollectionName(e, t) {
    return P.validateCollectionName(e, `${this.getComponentName()}.${t}`);
  }
  /**
   * Validate document ID with business rules
   */
  validateDocumentId(e, t) {
    return P.validateDocumentId(e, `${this.getComponentName()}.${t}`);
  }
  /**
   * Validate search limit parameter
   */
  validateLimit(e, t, i = 10) {
    return P.validateLimit(e, `${this.getComponentName()}.${t}`, i);
  }
  /**
   * Validate search threshold parameter
   */
  validateThreshold(e, t) {
    return P.validateThreshold(e, `${this.getComponentName()}.${t}`);
  }
  /**
   * Convert Float32Array to database-compatible blob
   */
  embeddingToBlob(e) {
    return new Uint8Array(e.buffer);
  }
  /**
   * Convert database blob to Float32Array
   */
  blobToEmbedding(e) {
    return new Float32Array(e.buffer);
  }
  /**
   * Format SQL query for logging (remove sensitive data)
   */
  formatSQLForLog(e, t) {
    let i = e.replace(/\s+/g, " ").trim();
    if (t && t.length > 0) {
      const s = t.slice(0, 3).map((n) => typeof n == "string" ? n.length > 50 ? `"${n.substring(0, 50)}..."` : `"${n}"` : n instanceof Uint8Array || n instanceof Float32Array ? `[${n.constructor.name} ${n.length}]` : String(n)), r = t.length > 3 ? `[${s.join(", ")}, ...${t.length - 3} more]` : `[${s.join(", ")}]`;
      i += ` -- params: ${r}`;
    }
    return i;
  }
  /**
   * Execute SQL with logging and error handling
   */
  async executeSQLWithLogging(e, t, i, s) {
    const r = this.formatSQLForLog(t, i);
    this.log("debug", `${e}: ${r}`);
    try {
      return s ? await s(t, i) : await this.sqliteManager.select(t, i);
    } catch (n) {
      throw this.log("error", `${e} failed: ${n instanceof Error ? n.message : String(n)}`), n;
    }
  }
}
class Re extends Ie {
  getComponentName() {
    return "SearchHandler";
  }
  constructor(e) {
    super(e);
  }
  /**
   * Generate query embedding using DatabaseWorker's ProviderManager
   * This method should be called by DatabaseWorker, not used standalone
   */
  async generateEmbeddingWithProvider(e, t, i = "default") {
    try {
      this.logger && this.logger.log("info", `Generating query embedding: ${t.substring(0, 50)}`);
      const s = await e.getProvider(i);
      if (!s)
        throw new Error("No embedding provider available for collection");
      const r = await s.generateEmbedding(t);
      return this.logger && this.logger.log("info", `Query embedding generated successfully, dimensions: ${r.length}`), r;
    } catch (s) {
      throw this.logger && this.logger.log("error", `Failed to generate query embedding: ${s instanceof Error ? s.message : String(s)}`), s;
    }
  }
}
class C extends Error {
  constructor(e, t, i, s, r) {
    super(e), this.code = t, this.statusCode = i, this.provider = s, this.details = r, this.name = "LLMError", Object.setPrototypeOf(this, C.prototype);
  }
}
class $ extends C {
  constructor(e, t) {
    super(e, "INVALID_CONFIG", void 0, void 0, t), this.name = "LLMConfigError", Object.setPrototypeOf(this, $.prototype);
  }
}
class H extends C {
  constructor(e, t, i, s) {
    super(e, "PROVIDER_ERROR", t, i, s), this.name = "LLMProviderError", Object.setPrototypeOf(this, H.prototype);
  }
}
class z extends C {
  constructor(e, t) {
    super(`LLM request timeout after ${t}ms`, "TIMEOUT", void 0, e), this.name = "LLMTimeoutError", Object.setPrototypeOf(this, z.prototype);
  }
}
class q extends C {
  constructor(e, t, i) {
    super(e, "PARSE_ERROR", void 0, t, i), this.name = "LLMParseError", Object.setPrototypeOf(this, q.prototype);
  }
}
function Le(o) {
  return `You are a search query expert. Analyze and enhance this search query.

Original query: "${o}"

Provide:
1. Enhanced query (expanded with relevant terms)
2. 3 alternative query suggestions
3. User's likely search intent
4. Confidence score (0-1)

Format response as JSON:
{
  "enhancedQuery": "...",
  "suggestions": ["...", "...", "..."],
  "intent": "...",
  "confidence": 0.85
}`;
}
function Me(o) {
  return `You are a search result summarizer. Analyze these search results and provide a concise summary.

Search Results:
${o.map((t, i) => {
    const s = t.title || "Untitled", r = t.content ? t.content.substring(0, 200) : "No content";
    return `${i + 1}. ${s}: ${r}...`;
  }).join(`

`)}

Provide:
1. Executive summary (2-3 sentences)
2. Key points (3-5 bullet points)
3. Main themes
4. Confidence score (0-1)

Format response as JSON:
{
  "summary": "...",
  "keyPoints": ["...", "...", "..."],
  "themes": ["...", "..."],
  "confidence": 0.9
}`;
}
class B {
  constructor(e, t) {
    this.config = e, this.logger = t, this.validateConfig();
  }
  /**
   * Validate provider configuration
   */
  validateConfig() {
    if (!this.config.provider)
      throw new $("Provider is required");
    if (!this.config.model)
      throw new $("Model is required");
    if (!this.config.apiKey && this.config.provider !== "custom")
      throw new $(`API key required for provider: ${this.config.provider}`);
  }
  /**
   * Execute HTTP request to LLM API
   */
  async executeRequest(e, t) {
    const i = this.buildRequestURL(), s = this.buildRequestHeaders(), r = this.buildRequestBody(e, t), n = t?.timeout || this.config.timeout || 1e4, a = new AbortController(), c = t?.signal || a.signal, l = setTimeout(() => a.abort(), n);
    try {
      this.logger.debug(`LLM Request to ${this.config.provider}`, {
        provider: this.config.provider,
        model: this.config.model,
        promptLength: e.length
      });
      const d = await fetch(i, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...s
        },
        body: JSON.stringify(r),
        signal: c
      });
      if (clearTimeout(l), !d.ok) {
        const u = await d.json().catch(() => ({}));
        throw new H(
          u.error?.message || d.statusText,
          d.status,
          this.config.provider,
          u
        );
      }
      const h = await d.json(), E = this.parseResponse(h);
      return this.logger.debug(`LLM Response from ${this.config.provider}`, {
        provider: this.config.provider,
        model: this.config.model,
        finishReason: E.finishReason,
        textLength: E.text.length
      }), E;
    } catch (d) {
      throw clearTimeout(l), d.name === "AbortError" ? new z(this.config.provider, n) : d instanceof C ? d : new C(
        `LLM request failed: ${d.message}`,
        "NETWORK_ERROR",
        void 0,
        this.config.provider,
        d
      );
    }
  }
  /**
   * Execute request with retry logic
   */
  async executeRequestWithRetry(e, t) {
    const i = this.config.maxRetries || 2;
    let s;
    for (let r = 0; r <= i; r++)
      try {
        return await this.executeRequest(e, t);
      } catch (n) {
        if (s = n, n instanceof $ || n instanceof z || n instanceof H && n.statusCode && n.statusCode < 500)
          throw n;
        if (r < i) {
          const a = Math.pow(2, r) * 1e3;
          this.logger.warn(`LLM request failed, retrying in ${a}ms`, {
            attempt: r + 1,
            maxRetries: i,
            error: n.message
          }), await new Promise((c) => setTimeout(c, a));
        }
      }
    throw s;
  }
  /**
   * Public API: Generic LLM call with arbitrary prompt (SCRUM-17)
   *
   * This method provides direct access to the LLM with any custom prompt.
   * Use this for custom use cases beyond query enhancement or summarization.
   *
   * @param prompt - The prompt to send to the LLM
   * @param options - Optional request configuration
   * @returns Raw LLM response with text and metadata
   */
  async call(e, t) {
    return await this.executeRequestWithRetry(e, t);
  }
  /**
   * Public API: Enhance query
   */
  async enhanceQuery(e, t) {
    const i = Le(e);
    return await this.executeRequestWithRetry(i, t);
  }
  /**
   * Public API: Summarize results
   */
  async summarizeResults(e, t) {
    const i = Me(e);
    return await this.executeRequestWithRetry(i, t);
  }
}
class qe extends B {
  /**
   * Build OpenAI API endpoint URL
   */
  buildRequestURL() {
    return this.config.endpoint || "https://api.openai.com/v1/chat/completions";
  }
  /**
   * Build OpenAI request headers
   */
  buildRequestHeaders() {
    return {
      Authorization: `Bearer ${this.config.apiKey}`,
      ...this.config.headers
    };
  }
  /**
   * Build OpenAI request body
   */
  buildRequestBody(e, t) {
    return {
      model: this.config.model,
      messages: [
        {
          role: "system",
          content: "You are a helpful search assistant. Always respond with valid JSON."
        },
        {
          role: "user",
          content: e
        }
      ],
      temperature: t?.temperature ?? this.config.temperature ?? 0.7,
      max_tokens: t?.maxTokens ?? this.config.maxTokens ?? 500,
      response_format: { type: "json_object" }
    };
  }
  /**
   * Parse OpenAI API response
   */
  parseResponse(e) {
    try {
      if (!e.choices || !e.choices[0])
        throw new Error("Invalid response structure: missing choices");
      const t = e.choices[0], i = t.message?.content;
      if (!i)
        throw new Error("Invalid response structure: missing message content");
      return {
        text: i,
        finishReason: t.finish_reason === "stop" ? "stop" : "length",
        usage: e.usage ? {
          promptTokens: e.usage.prompt_tokens,
          completionTokens: e.usage.completion_tokens,
          totalTokens: e.usage.total_tokens
        } : void 0,
        model: e.model,
        provider: "openai"
      };
    } catch (t) {
      throw new q(
        `Failed to parse OpenAI response: ${t.message}`,
        "openai",
        { data: e, error: t.message }
      );
    }
  }
}
class $e extends B {
  /**
   * Build Anthropic API endpoint URL
   */
  buildRequestURL() {
    return this.config.endpoint || "https://api.anthropic.com/v1/messages";
  }
  /**
   * Build Anthropic request headers
   */
  buildRequestHeaders() {
    return {
      "x-api-key": this.config.apiKey,
      "anthropic-version": "2023-06-01",
      ...this.config.headers
    };
  }
  /**
   * Build Anthropic request body
   */
  buildRequestBody(e, t) {
    return {
      model: this.config.model,
      messages: [
        {
          role: "user",
          content: e
        }
      ],
      temperature: t?.temperature ?? this.config.temperature ?? 0.7,
      max_tokens: t?.maxTokens ?? this.config.maxTokens ?? 500,
      system: "You are a helpful search assistant. Always respond with valid JSON."
    };
  }
  /**
   * Parse Anthropic API response
   */
  parseResponse(e) {
    try {
      if (!e.content || !Array.isArray(e.content) || e.content.length === 0)
        throw new Error("Invalid response structure: missing content array");
      const t = e.content[0];
      if (!t.text)
        throw new Error("Invalid response structure: missing text in content");
      return {
        text: t.text,
        finishReason: e.stop_reason === "end_turn" ? "stop" : "length",
        usage: e.usage ? {
          promptTokens: e.usage.input_tokens,
          completionTokens: e.usage.output_tokens,
          totalTokens: e.usage.input_tokens + e.usage.output_tokens
        } : void 0,
        model: e.model,
        provider: "anthropic"
      };
    } catch (t) {
      throw new q(
        `Failed to parse Anthropic response: ${t.message}`,
        "anthropic",
        { data: e, error: t.message }
      );
    }
  }
}
class Oe extends B {
  /**
   * Build OpenRouter API endpoint URL
   */
  buildRequestURL() {
    return this.config.endpoint || "https://openrouter.ai/api/v1/chat/completions";
  }
  /**
   * Build OpenRouter request headers
   * Includes optional HTTP-Referer and X-Title for usage tracking
   */
  buildRequestHeaders() {
    const e = {
      Authorization: `Bearer ${this.config.apiKey}`,
      ...this.config.headers
    };
    return e["HTTP-Referer"] || (e["HTTP-Referer"] = typeof window < "u" ? window.location.origin : "https://localretrieve.dev"), e["X-Title"] || (e["X-Title"] = "LocalRetrieve"), e;
  }
  /**
   * Build OpenRouter request body (OpenAI-compatible format)
   */
  buildRequestBody(e, t) {
    return {
      model: this.config.model,
      messages: [
        {
          role: "system",
          content: "You are a helpful search assistant. Always respond with valid JSON."
        },
        {
          role: "user",
          content: e
        }
      ],
      temperature: t?.temperature ?? this.config.temperature ?? 0.7,
      max_tokens: t?.maxTokens ?? this.config.maxTokens ?? 500,
      // OpenRouter supports response_format for compatible models
      response_format: { type: "json_object" }
    };
  }
  /**
   * Parse OpenRouter API response
   * OpenRouter uses OpenAI-compatible response format
   */
  parseResponse(e) {
    try {
      if (!e.choices || !e.choices[0])
        throw new Error("Invalid response structure: missing choices");
      const t = e.choices[0], i = t.message?.content;
      if (!i)
        throw new Error("Invalid response structure: missing message content");
      return {
        text: i,
        finishReason: t.finish_reason === "stop" ? "stop" : "length",
        usage: e.usage ? {
          promptTokens: e.usage.prompt_tokens,
          completionTokens: e.usage.completion_tokens,
          totalTokens: e.usage.total_tokens
        } : void 0,
        model: e.model || this.config.model,
        provider: "openrouter"
      };
    } catch (t) {
      throw new q(
        `Failed to parse OpenRouter response: ${t.message}`,
        "openrouter",
        { data: e, error: t.message }
      );
    }
  }
}
class Ae extends B {
  /**
   * Validate custom provider configuration
   */
  validateConfig() {
    if (super.validateConfig(), !this.config.endpoint)
      throw new $("Endpoint is required for custom provider");
  }
  /**
   * Build custom API endpoint URL
   */
  buildRequestURL() {
    return this.config.endpoint;
  }
  /**
   * Build custom request headers
   */
  buildRequestHeaders() {
    const e = { ...this.config.headers };
    return this.config.apiKey && (e.Authorization = `Bearer ${this.config.apiKey}`), e;
  }
  /**
   * Build custom request body (OpenAI-compatible format)
   */
  buildRequestBody(e, t) {
    return {
      model: this.config.model,
      messages: [
        {
          role: "system",
          content: "You are a helpful search assistant. Always respond with valid JSON."
        },
        {
          role: "user",
          content: e
        }
      ],
      temperature: t?.temperature ?? this.config.temperature ?? 0.7,
      max_tokens: t?.maxTokens ?? this.config.maxTokens ?? 500
    };
  }
  /**
   * Parse custom API response (try multiple formats)
   */
  parseResponse(e) {
    try {
      if (e.choices && Array.isArray(e.choices) && e.choices[0]) {
        const i = e.choices[0];
        return {
          text: i.message?.content || i.text || "",
          finishReason: i.finish_reason === "stop" ? "stop" : "length",
          usage: e.usage ? {
            promptTokens: e.usage.prompt_tokens || 0,
            completionTokens: e.usage.completion_tokens || 0,
            totalTokens: e.usage.total_tokens || 0
          } : void 0,
          model: e.model || this.config.model,
          provider: "custom"
        };
      }
      return e.content && Array.isArray(e.content) && e.content[0] ? {
        text: e.content[0].text || "",
        finishReason: "stop",
        model: e.model || this.config.model,
        provider: "custom"
      } : {
        text: e.text || e.content || e.response || JSON.stringify(e),
        finishReason: "stop",
        model: this.config.model,
        provider: "custom"
      };
    } catch (t) {
      throw new q(
        `Failed to parse custom provider response: ${t.message}`,
        "custom",
        { data: e, error: t.message }
      );
    }
  }
}
class Ne {
  constructor(e) {
    this.providerCache = /* @__PURE__ */ new Map(), this.logger = e;
  }
  /**
   * Get or create provider instance
   */
  getProvider(e) {
    const t = e.apiKey ? e.apiKey.substring(0, 8) : "none", i = `${e.provider}:${e.model}:${t}`;
    let s = this.providerCache.get(i);
    return s || (s = this.createProvider(e), this.providerCache.set(i, s), this.logger.info(`Created LLM provider: ${e.provider}/${e.model}`)), s;
  }
  /**
   * Create provider instance based on configuration
   */
  createProvider(e) {
    switch (e.provider) {
      case "openai":
        return new qe(e, this.logger);
      case "anthropic":
        return new $e(e, this.logger);
      case "openrouter":
        return new Oe(e, this.logger);
      case "custom":
        return new Ae(e, this.logger);
      default:
        throw new C(
          `Unknown provider: ${e.provider}`,
          "INVALID_CONFIG",
          void 0,
          e.provider
        );
    }
  }
  /**
   * Generic LLM call with arbitrary prompt (SCRUM-17)
   *
   * Provides direct access to LLM for custom use cases.
   * Returns raw LLM response without JSON parsing.
   */
  async callLLM(e, t, i) {
    const s = Date.now(), r = this.getProvider(t);
    try {
      this.logger.debug("Generic LLM call", {
        provider: t.provider,
        promptLength: e.length
      });
      const n = await r.call(e, i), a = {
        text: n.text,
        finishReason: n.finishReason,
        usage: n.usage,
        model: n.model || t.model,
        provider: n.provider || t.provider,
        processingTime: Date.now() - s
      };
      return this.logger.debug("Generic LLM call complete", {
        provider: t.provider,
        processingTime: a.processingTime,
        textLength: a.text.length
      }), a;
    } catch (n) {
      throw this.logger.error("Generic LLM call failed", {
        error: n.message,
        provider: t.provider,
        promptLength: e.length
      }), n;
    }
  }
  /**
   * Enhance query using LLM
   */
  async enhanceQuery(e, t, i) {
    const s = Date.now(), r = this.getProvider(t);
    try {
      this.logger.debug(`Enhancing query: "${e}"`, { provider: t.provider });
      const n = await r.enhanceQuery(e, i), a = JSON.parse(n.text), c = {
        originalQuery: e,
        enhancedQuery: a.enhancedQuery || e,
        suggestions: Array.isArray(a.suggestions) ? a.suggestions : [],
        intent: a.intent,
        confidence: typeof a.confidence == "number" ? a.confidence : 0.5,
        provider: t.provider,
        model: t.model,
        processingTime: Date.now() - s
      };
      return this.logger.debug("Query enhancement complete", {
        provider: t.provider,
        enhancedQuery: c.enhancedQuery,
        processingTime: c.processingTime
      }), c;
    } catch (n) {
      throw this.logger.error("Query enhancement failed", {
        error: n.message,
        query: e,
        provider: t.provider
      }), n instanceof SyntaxError ? new q(
        "Failed to parse LLM JSON response",
        t.provider,
        { error: n.message }
      ) : n;
    }
  }
  /**
   * Summarize search results using LLM
   */
  async summarizeResults(e, t, i) {
    const s = Date.now(), r = this.getProvider(t);
    try {
      this.logger.debug(`Summarizing ${e.length} results`, { provider: t.provider });
      const n = await r.summarizeResults(e, i), a = JSON.parse(n.text), c = {
        summary: a.summary || "",
        keyPoints: Array.isArray(a.keyPoints) ? a.keyPoints : [],
        themes: Array.isArray(a.themes) ? a.themes : [],
        confidence: typeof a.confidence == "number" ? a.confidence : 0.5,
        provider: t.provider,
        model: t.model,
        processingTime: Date.now() - s
      };
      return this.logger.debug("Result summarization complete", {
        provider: t.provider,
        processingTime: c.processingTime
      }), c;
    } catch (n) {
      throw this.logger.error("Result summarization failed", {
        error: n.message,
        resultCount: e.length,
        provider: t.provider
      }), n instanceof SyntaxError ? new q(
        "Failed to parse LLM JSON response",
        t.provider,
        { error: n.message }
      ) : n;
    }
  }
  /**
   * Clear provider cache
   */
  clearCache() {
    this.providerCache.clear(), this.logger.info("LLM provider cache cleared");
  }
  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      providers: this.providerCache.size,
      keys: Array.from(this.providerCache.keys())
    };
  }
}
class _ {
  constructor(e = {}) {
    this.logHistory = [], this.maxHistorySize = 1e3, this.config = {
      level: e.level || "info",
      component: e.component || "Worker",
      enableTimestamp: e.enableTimestamp !== !1,
      enableColors: e.enableColors !== !1
    };
  }
  static {
    this.LEVEL_PRIORITY = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    };
  }
  static {
    this.LEVEL_COLORS = {
      debug: "\x1B[36m",
      // Cyan
      info: "\x1B[32m",
      // Green
      warn: "\x1B[33m",
      // Yellow
      error: "\x1B[31m"
      // Red
    };
  }
  static {
    this.RESET_COLOR = "\x1B[0m";
  }
  /**
   * Log a debug message
   */
  debug(e, t) {
    this.log("debug", e, t);
  }
  /**
   * Log an info message
   */
  info(e, t) {
    this.log("info", e, t);
  }
  /**
   * Log a warning message
   */
  warn(e, t) {
    this.log("warn", e, t);
  }
  /**
   * Log an error message
   */
  error(e, t) {
    this.log("error", e, t);
  }
  /**
   * Core logging method
   */
  log(e, t, i) {
    if (!this.shouldLog(e))
      return;
    const s = Date.now(), r = {
      level: e,
      message: t,
      timestamp: s,
      component: this.config.component,
      data: i
    };
    this.addToHistory(r), this.outputToConsole(r);
  }
  /**
   * Check if a log level should be output based on configuration
   */
  shouldLog(e) {
    const t = e;
    return _.LEVEL_PRIORITY[t] >= _.LEVEL_PRIORITY[this.config.level];
  }
  /**
   * Add log entry to history buffer
   */
  addToHistory(e) {
    this.logHistory.push(e), this.logHistory.length > this.maxHistorySize && (this.logHistory = this.logHistory.slice(-this.maxHistorySize));
  }
  /**
   * Output log entry to console with formatting
   */
  outputToConsole(e) {
    const t = [];
    if (this.config.enableTimestamp) {
      const r = new Date(e.timestamp).toISOString();
      t.push(`[${r}]`);
    }
    e.component && t.push(`[${e.component}]`);
    const i = e.level.toUpperCase();
    if (this.config.enableColors && typeof window > "u") {
      const r = _.LEVEL_COLORS[e.level];
      t.push(`${r}${i}${_.RESET_COLOR}`);
    } else
      t.push(i);
    t.push(e.message);
    const s = t.join(" ");
    switch (e.level) {
      case "debug":
        console.debug(s, e.data);
        break;
      case "info":
        console.info(s, e.data);
        break;
      case "warn":
        console.warn(s, e.data);
        break;
      case "error":
        console.error(s, e.data);
        break;
    }
  }
  /**
   * Get recent log history
   */
  getHistory(e) {
    return e && e > 0 ? this.logHistory.slice(-e) : [...this.logHistory];
  }
  /**
   * Clear log history
   */
  clearHistory() {
    this.logHistory = [];
  }
  /**
   * Update logger configuration
   */
  updateConfig(e) {
    this.config = { ...this.config, ...e };
  }
  /**
   * Get current configuration
   */
  getConfig() {
    return { ...this.config };
  }
  /**
   * Create a child logger with a specific component name
   */
  child(e) {
    return new _({
      ...this.config,
      component: e
    });
  }
  /**
   * Create a simple log function compatible with existing code
   */
  createLogFunction() {
    return (e, t, i) => {
      const s = this.mapStringToLogLevel(e);
      this.log(s, t, i);
    };
  }
  /**
   * Map string level to LogLevel type
   */
  mapStringToLogLevel(e) {
    const t = e.toLowerCase();
    return t in _.LEVEL_PRIORITY ? t : "info";
  }
  /**
   * Static method to create a default logger instance
   */
  static create(e, t = "info") {
    return new _({ component: e, level: t });
  }
}
class De {
  constructor() {
    this.isInitialized = !1, this.startTime = Date.now(), this.operationCount = 0, this.LIKE_STOP_WORDS = /* @__PURE__ */ new Set([
      "the",
      "is",
      "at",
      "which",
      "on",
      "a",
      "an",
      "to",
      "in",
      "for",
      "of",
      "and",
      "or",
      "but",
      "are",
      "was",
      "were",
      "been",
      "be",
      "have",
      "has"
    ]), this.MIN_LIKE_QUERY_LENGTH = 3, this.MAX_LIKE_RESULTS = 100, this.LIKE_TIMEOUT_MS = 500, this.logger = new _({
      level: "debug",
      component: "DatabaseWorker"
    }), this.sqliteManager = new re(this.logger), this.opfsManager = new ne(this.sqliteManager, this.logger), this.schemaManager = new oe(this.sqliteManager, this.logger), this.embeddingQueue = new ae(this.sqliteManager, this.logger), this.providerManager = new le(this.sqliteManager, this.logger), this.searchHandler = new Re({
      sqliteManager: this.sqliteManager,
      schemaManager: this.schemaManager,
      opfsManager: this.opfsManager,
      logger: this.logger
    }), this.llmManager = new Ne(this.logger), this.rpcHandler = new J({
      logLevel: "debug",
      operationTimeout: 3e4
    }), this.setupRPCHandlers(), this.logger.info("DatabaseWorker initialized with modular architecture + LLM support");
  }
  /**
   * Setup all RPC handlers
   */
  setupRPCHandlers() {
    this.rpcHandler.register("open", this.handleOpen.bind(this)), this.rpcHandler.register("close", this.handleClose.bind(this)), this.rpcHandler.register("exec", this.handleExec.bind(this)), this.rpcHandler.register("select", this.handleSelect.bind(this)), this.rpcHandler.register("bulkInsert", this.handleBulkInsert.bind(this)), this.rpcHandler.register("initVecExtension", this.handleInitVecExtension.bind(this)), this.rpcHandler.register("initializeSchema", this.handleInitializeSchema.bind(this)), this.rpcHandler.register("getCollectionInfo", this.handleGetCollectionInfo.bind(this)), this.rpcHandler.register("createCollection", this.handleCreateCollection.bind(this)), this.rpcHandler.register("getCollectionEmbeddingStatus", this.handleGetCollectionEmbeddingStatus.bind(this)), this.rpcHandler.register("insertDocumentWithEmbedding", this.handleInsertDocumentWithEmbedding.bind(this)), this.rpcHandler.register("batchInsertDocuments", this.handleBatchInsertDocuments.bind(this)), this.rpcHandler.register("generateEmbedding", this.handleGenerateEmbedding.bind(this)), this.rpcHandler.register("batchGenerateEmbeddings", this.handleBatchGenerateEmbeddings.bind(this)), this.rpcHandler.register("regenerateCollectionEmbeddings", this.handleRegenerateCollectionEmbeddings.bind(this)), this.rpcHandler.register("enqueueEmbedding", this.handleEnqueueEmbedding.bind(this)), this.rpcHandler.register("processEmbeddingQueue", this.handleProcessEmbeddingQueue.bind(this)), this.rpcHandler.register("getQueueStatus", this.handleGetQueueStatus.bind(this)), this.rpcHandler.register("clearEmbeddingQueue", this.handleClearEmbeddingQueue.bind(this)), this.rpcHandler.register("search", this.handleSearch.bind(this)), this.rpcHandler.register("searchSemantic", this.handleSearchSemantic.bind(this)), this.rpcHandler.register("searchText", this.handleSearchText.bind(this)), this.rpcHandler.register("searchAdvanced", this.handleSearchAdvanced.bind(this)), this.rpcHandler.register("searchGlobal", this.handleSearchGlobal.bind(this)), this.rpcHandler.register("enhanceQuery", this.handleEnhanceQuery.bind(this)), this.rpcHandler.register("summarizeResults", this.handleSummarizeResults.bind(this)), this.rpcHandler.register("searchWithLLM", this.handleSearchWithLLM.bind(this)), this.rpcHandler.register("callLLM", this.handleCallLLM.bind(this)), this.rpcHandler.register("generateQueryEmbedding", this.handleGenerateQueryEmbedding.bind(this)), this.rpcHandler.register("batchGenerateQueryEmbeddings", this.handleBatchGenerateQueryEmbeddings.bind(this)), this.rpcHandler.register("warmEmbeddingCache", this.handleWarmEmbeddingCache.bind(this)), this.rpcHandler.register("clearEmbeddingCache", this.handleClearEmbeddingCache.bind(this)), this.rpcHandler.register("getPipelineStats", this.handleGetPipelineStats.bind(this)), this.rpcHandler.register("getModelStatus", this.handleGetModelStatus.bind(this)), this.rpcHandler.register("preloadModels", this.handlePreloadModels.bind(this)), this.rpcHandler.register("optimizeModelMemory", this.handleOptimizeModelMemory.bind(this)), this.rpcHandler.register("export", this.handleExport.bind(this)), this.rpcHandler.register("import", this.handleImport.bind(this)), this.rpcHandler.register("clear", this.handleClear.bind(this)), this.rpcHandler.register("ping", this.handlePing.bind(this)), this.rpcHandler.register("getVersion", this.handleGetVersion.bind(this)), this.rpcHandler.register("getStats", this.handleGetStats.bind(this));
  }
  // =============================================================================
  // Core Database Operations
  // =============================================================================
  async handleOpen(e) {
    const t = this.validateParams(e, de, "handleOpen");
    return this.withContext("open", async () => {
      const i = t.filename || t.path || ":memory:";
      this.logger.info(`Opening database with filename: ${i}, vfs: ${t.vfs}`);
      let s = i;
      i.startsWith("opfs:/") && (this.logger.info(`Initializing OPFS database: ${i}`), s = await this.opfsManager.initializeDatabase(i), this.logger.info(`OPFS database path resolved to: ${s}`)), this.logger.info(`Opening SQLite database at path: ${s}`), await this.sqliteManager.openDatabase(s), await this.sqliteManager.exec("PRAGMA temp_store = MEMORY"), await this.sqliteManager.exec("PRAGMA cache_size = -8000"), await this.sqliteManager.exec("PRAGMA synchronous = NORMAL"), await this.sqliteManager.exec("PRAGMA journal_mode = DELETE"), this.logger.info("SQLite PRAGMAs configured for WASM environment (8MB cache, disk journal)"), await this.sqliteManager.initVecExtension();
      const r = this.opfsManager.getPendingDatabaseData();
      if (r) {
        this.logger.info("Restoring database from OPFS data"), await this.sqliteManager.deserialize(r), this.opfsManager.clearPendingDatabaseData(), this.logger.info("Database restored from OPFS successfully"), await this.sqliteManager.exec("PRAGMA cache_size = -8000"), await this.sqliteManager.exec("PRAGMA journal_mode = DELETE"), this.logger.info("PRAGMAs enforced after OPFS restore (8MB cache, disk journal)");
        try {
          await this.sqliteManager.exec("SELECT 1"), this.logger.info("Database connection verified after restore");
        } catch (n) {
          this.logger.error("Database connection invalid after restore, reopening...", { error: n }), this.sqliteManager.closeDatabase(), await this.sqliteManager.openDatabase(s), await this.sqliteManager.exec("PRAGMA temp_store = MEMORY"), await this.sqliteManager.exec("PRAGMA cache_size = -8000"), await this.sqliteManager.exec("PRAGMA synchronous = NORMAL"), await this.sqliteManager.exec("PRAGMA journal_mode = DELETE"), await this.sqliteManager.initVecExtension(), this.logger.info("Database connection re-established");
        }
      }
      i.startsWith("opfs:/") && this.opfsManager.startAutoSync(), this.isInitialized = !0, this.logger.info(`Database opened successfully: ${i}`);
    });
  }
  async handleClose() {
    return this.withContext("close", async () => {
      if (this.isInitialized)
        try {
          await this.providerManager.dispose(), await this.opfsManager.forceSync(), this.opfsManager.stopAutoSync(), this.sqliteManager.closeDatabase(), this.opfsManager.cleanup(), this.isInitialized = !1, this.logger.info("Database closed successfully");
        } catch (e) {
          throw this.logger.error(`Error during database close: ${e instanceof Error ? e.message : String(e)}`), e;
        }
    });
  }
  async handleExec(e) {
    const t = this.validateParams(e, he, "handleExec");
    return this.ensureInitialized(), this.withContext("exec", async () => {
      await this.sqliteManager.exec(t.sql, t.params), this.logger.debug(`Executed SQL: ${t.sql.substring(0, 100)}...`);
    });
  }
  async handleSelect(e) {
    const t = this.validateParams(e, ge, "handleSelect");
    return this.ensureInitialized(), this.withContext("select", async () => {
      const i = await this.sqliteManager.select(t.sql, t.params);
      return this.logger.debug(`Selected ${i.rows.length} rows`), i;
    });
  }
  async handleBulkInsert(e) {
    const t = this.validateParams(e, ue, "handleBulkInsert");
    return this.ensureInitialized(), this.withContext("bulkInsert", async () => {
      for (const i of t.data) {
        const s = Object.keys(i), r = Object.values(i), n = s.map(() => "?").join(", "), a = `INSERT INTO ${t.tableName} (${s.join(", ")}) VALUES (${n})`;
        await this.sqliteManager.select(a, r);
      }
      this.logger.info(`Bulk inserted ${t.data.length} rows into ${t.tableName}`);
    });
  }
  // =============================================================================
  // Schema and Extension Operations
  // =============================================================================
  async handleInitVecExtension() {
    return this.ensureInitialized(), this.withContext("initVecExtension", async () => {
      await this.sqliteManager.initVecExtension();
    });
  }
  async handleInitializeSchema() {
    return this.ensureInitialized(), this.withContext("initializeSchema", async () => {
      await this.schemaManager.initializeSchema();
    });
  }
  async handleGetCollectionInfo(e) {
    this.ensureInitialized();
    const t = this.validateCollectionName(e, "getCollectionInfo");
    return this.withContext("getCollectionInfo", async () => await this.schemaManager.getCollectionInfo(t));
  }
  async handleCreateCollection(e) {
    const t = this.validateParams(e, fe, "handleCreateCollection");
    return this.ensureInitialized(), this.withContext("createCollection", async () => {
      await this.schemaManager.createCollection(
        t.name,
        t.dimensions || 384,
        t.config || {}
      );
    });
  }
  // =============================================================================
  // Embedding Operations (Simplified for demo)
  // =============================================================================
  async handleGetCollectionEmbeddingStatus(e) {
    return {
      collection: e,
      collectionId: e,
      provider: "local",
      model: "all-MiniLM-L6-v2",
      dimensions: 384,
      documentsWithEmbeddings: 0,
      totalDocuments: 0,
      isReady: !0,
      generationProgress: 1,
      lastUpdated: /* @__PURE__ */ new Date(),
      configErrors: []
    };
  }
  async handleInsertDocumentWithEmbedding(e, t = !1) {
    const i = this.validateParams(e, me, "handleInsertDocumentWithEmbedding");
    return this.ensureInitialized(), this.withContext("insertDocumentWithEmbedding", async () => {
      const { validateDocument: s, generateDocumentId: r, sanitizeDocumentId: n } = await import("../Validation-E21ecA_U.mjs"), { DocumentInsertError: a } = await import("../Errors-CBeo1Lsn.mjs");
      this.logger.debug(`[InsertDoc] Validating document for collection: ${i.collection}`), s(i.document, i.collection);
      const c = i.document.id ? n(i.document.id) : r();
      this.logger.debug(`[InsertDoc] Document ID: ${c}, content length: ${(i.document.content || "").length}`);
      const l = i.document.metadata || {}, d = JSON.stringify(l);
      this.logger.debug(`[InsertDoc] Metadata size: ${d.length} bytes`);
      const h = `
        INSERT OR REPLACE INTO docs_default (id, title, content, collection, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, strftime('%s', 'now'), strftime('%s', 'now'))
      `;
      this.logger.debug(`[InsertDoc] Executing INSERT for document: ${c}`);
      try {
        await this.sqliteManager.exec(h, [
          c,
          i.document.title || "",
          i.document.content || "",
          i.collection,
          // ✅ Separate column for collection
          d
          // ✅ Pure user metadata
        ]), this.logger.debug(`[InsertDoc] ✓ INSERT completed for document: ${c}`);
      } catch (g) {
        throw this.logger.error(`[InsertDoc] ✗ INSERT failed for document: ${c} - ${g instanceof Error ? g.message : String(g)}`), new a(
          `Failed to insert document into collection '${i.collection}'`,
          {
            collection: i.collection,
            documentId: c,
            providedFields: Object.keys(i.document),
            originalError: g instanceof Error ? g : void 0,
            suggestion: "Check that document structure matches schema and ID is unique"
          }
        );
      }
      if (this.logger.debug(`[InsertDoc] Verifying insertion for document: ${c}`), ((await this.sqliteManager.select(
        "SELECT COUNT(*) as count FROM docs_default WHERE id = ? AND collection = ?",
        [c, i.collection]
      )).rows[0]?.count || 0) === 0)
        throw this.logger.error(`[InsertDoc] ✗ Verification failed: document ${c} not found in database`), new a(
          `Document insertion verification failed: id='${c}' was not found in database`,
          {
            collection: i.collection,
            documentId: c,
            providedFields: Object.keys(i.document),
            suggestion: `This may be caused by:
  1) Unique constraint violation (duplicate ID)
  2) Database connection issue
  3) Transaction rollback
Check database logs for details.`
          }
        );
      if (this.logger.info(`Document inserted successfully: ${c} in collection ${i.collection}`), t)
        this.logger.debug(`[InsertDoc] Skipping FTS5 sync for document: ${c} (batch mode)`);
      else {
        this.logger.debug(`[InsertDoc] Syncing FTS5 index for document: ${c}`);
        try {
          const g = await this.sqliteManager.select(
            "SELECT rowid FROM docs_default WHERE id = ? AND collection = ?",
            [c, i.collection]
          );
          if (g.rows.length > 0) {
            const p = g.rows[0].rowid;
            if (await this.sqliteManager.exec(
              "INSERT INTO fts_default(rowid, title, content, metadata) VALUES (?, ?, ?, ?)",
              [p, i.document.title || "", i.document.content || "", d]
            ), ((await this.sqliteManager.select(
              "SELECT COUNT(*) as count FROM fts_default WHERE rowid = ?",
              [p]
            )).rows[0]?.count || 0) === 0)
              throw new Error(
                `FTS sync verification failed for document ${c} (rowid: ${p}). Document was inserted but FTS index update failed.`
              );
            this.logger.debug(`[InsertDoc] ✓ FTS5 sync completed and verified for document: ${c} (rowid: ${p})`);
          }
        } catch (g) {
          this.logger.warn(`[InsertDoc] FTS5 sync failed for document ${c}, search may not work: ${g instanceof Error ? g.message : String(g)}`);
        }
      }
      return { id: c, embeddingGenerated: !1 };
    });
  }
  /**
   * Calculate optimal batch size based on document sizes and available cache
   *
   * FTS5 defers index building until COMMIT, which can exceed memory limits.
   * This calculates safe batch size to avoid "database full" on commit.
   */
  async calculateOptimalBatchSize(e) {
    try {
      const i = (await this.sqliteManager.select("PRAGMA cache_size")).rows[0]?.cache_size || -64e3, s = i < 0 ? Math.abs(i) : i * 4, r = s * 0.25, n = r * 1024;
      let a = 0;
      const c = Math.min(10, e.length);
      for (let u = 0; u < c; u++) {
        const g = e[u], p = (g.content || "").length, I = (g.title || "").length, D = JSON.stringify(g.metadata || {}).length, R = p * 4;
        a += p + I + D + R;
      }
      const l = a / c;
      let d = Math.floor(n / l);
      return d = Math.max(5, Math.min(50, d)), this.logger.debug(`Batch size calculation: cache=${s}KB, available=${r.toFixed(0)}KB, avgDocSize=${(l / 1024).toFixed(1)}KB, batchSize=${d}`), d;
    } catch (t) {
      return this.logger.warn("Failed to calculate optimal batch size, using default: 10", { error: t }), 10;
    }
  }
  /**
   * Batch insert documents with WORKER-SIDE transaction management
   *
   * CRITICAL: Transaction MUST be on worker side where actual inserts happen!
   * Main thread and worker have SEPARATE SQLite connections.
   *
   * Uses adaptive batching to avoid FTS5 memory limits during COMMIT.
   */
  async handleBatchInsertDocuments(e) {
    return this.ensureInitialized(), this.withContext("batchInsertDocuments", async () => {
      const { collection: t, documents: i, options: s } = e;
      if (this.logger.info("[BatchInsert] === BATCH INSERT STARTED ==="), this.logger.info(`[BatchInsert] Collection: ${t}`), this.logger.info(`[BatchInsert] Total documents: ${i.length}`), this.logger.info(`[BatchInsert] Options: ${JSON.stringify(s)}`), !i || i.length === 0)
        return this.logger.warn("[BatchInsert] No documents to insert, returning empty array"), [];
      const r = i.map((u) => ({
        contentLength: (u.content || "").length,
        titleLength: (u.title || "").length,
        metadataSize: JSON.stringify(u.metadata || {}).length,
        id: u.id || "auto-generated"
      })), n = r.reduce((u, g) => u + g.contentLength, 0), a = n / i.length, c = Math.max(...r.map((u) => u.contentLength)), l = Math.min(...r.map((u) => u.contentLength));
      if (this.logger.info(`[BatchInsert] Document sizes: avg=${a.toFixed(0)} bytes, min=${l}, max=${c}, total=${n} bytes`), i.length === 1) {
        this.logger.info("[BatchInsert] Single document, using direct insert without batching");
        const u = await this.handleInsertDocumentWithEmbedding({
          collection: t,
          document: i[0],
          options: s
        });
        return this.logger.info("[BatchInsert] === BATCH INSERT COMPLETED (1 document) ==="), [u];
      }
      this.logger.info("[BatchInsert] Calculating optimal batch size...");
      const d = await this.calculateOptimalBatchSize(i), h = [], E = Math.ceil(i.length / d);
      this.logger.info(`[BatchInsert] Batch size: ${d}, total batches: ${E}`), this.logger.info(`[BatchInsert] Starting batch insert of ${i.length} documents in collection ${t} (adaptive batch size: ${d})`);
      try {
        for (let u = 0; u < i.length; u += d) {
          const g = i.slice(u, u + d), p = Math.floor(u / d) + 1, I = u, D = Math.min(u + d, i.length);
          this.logger.info("[BatchInsert] ========================================"), this.logger.info(`[BatchInsert] Processing batch ${p}/${E}`), this.logger.info(`[BatchInsert] Batch range: documents ${I + 1}-${D} of ${i.length}`), this.logger.info(`[BatchInsert] Batch size: ${g.length} documents`);
          const R = g.reduce((b, T) => b + (T.content || "").length, 0);
          this.logger.info(`[BatchInsert] Batch total content size: ${R} bytes (${(R / 1024).toFixed(1)}KB)`), this.logger.debug("[BatchInsert] Executing: BEGIN IMMEDIATE TRANSACTION"), await this.sqliteManager.exec("BEGIN IMMEDIATE TRANSACTION"), this.logger.info(`[BatchInsert] Transaction started for batch ${p}`);
          try {
            this.logger.info(`[BatchInsert] Inserting ${g.length} documents...`);
            for (let w = 0; w < g.length; w++) {
              const v = g[w], f = I + w;
              this.logger.debug(`[BatchInsert] Inserting document ${f + 1}/${i.length} (${w + 1}/${g.length} in batch)`), this.logger.debug(`[BatchInsert] Document ID: ${v.id || "auto"}, content length: ${(v.content || "").length}`);
              const y = await this.handleInsertDocumentWithEmbedding({
                collection: t,
                document: v,
                options: s
              }, !0);
              h.push(y), this.logger.debug(`[BatchInsert] Document inserted: ${y.id}`);
            }
            this.logger.info(`[BatchInsert] All ${g.length} documents inserted in batch ${p}, attempting COMMIT...`), this.logger.debug("[BatchInsert] Executing: COMMIT"), await this.sqliteManager.exec("COMMIT"), this.logger.info(`[BatchInsert] ✓ Batch ${p}/${E} COMMITTED successfully`), this.logger.info(`[BatchInsert] Progress: ${h.length}/${i.length} documents inserted`), this.logger.info(`[BatchInsert] Syncing FTS5 for batch ${p} (${g.length} documents)...`);
            const b = 10, T = Math.ceil(g.length / b);
            for (let w = 0; w < g.length; w += b) {
              const v = g.slice(w, w + b), f = Math.floor(w / b) + 1;
              this.logger.debug(`[BatchInsert] FTS5 sub-batch ${f}/${T} (${v.length} documents)`), await this.sqliteManager.exec("BEGIN TRANSACTION");
              try {
                for (let y = 0; y < v.length; y++) {
                  const S = v[y], L = I + w + y, O = h[L]?.id;
                  if (!O)
                    throw new Error(
                      `FTS sync failed: Cannot find result for document at global index ${L} (batch ${p}, FTS sub-batch ${f}, local index ${y}). Total results: ${h.length}`
                    );
                  const G = await this.sqliteManager.select(
                    "SELECT rowid FROM docs_default WHERE id = ? AND collection = ?",
                    [O, t]
                  );
                  if (G.rows.length === 0)
                    throw new Error(
                      `FTS sync failed: Document ID ${O} not found in docs_default. Collection: ${t}, global index: ${L}`
                    );
                  const x = G.rows[0].rowid, j = JSON.stringify(S.metadata || {});
                  if (await this.sqliteManager.exec(
                    "INSERT INTO fts_default(rowid, title, content, metadata) VALUES (?, ?, ?, ?)",
                    [x, S.title || "", S.content || "", j]
                  ), ((await this.sqliteManager.select(
                    "SELECT COUNT(*) as count FROM fts_default WHERE rowid = ?",
                    [x]
                  )).rows[0]?.count || 0) === 0)
                    throw new Error(
                      `FTS sync verification failed: rowid ${x} not found in fts_default after insert. Document: ${O}, Collection: ${t}, global index: ${L}`
                    );
                  this.logger.debug(`[BatchInsert] ✓ FTS sync verified for document ${O} (rowid: ${x})`);
                }
                await this.sqliteManager.exec("COMMIT"), this.logger.debug(`[BatchInsert] ✓ FTS5 sub-batch ${f} committed`);
              } catch (y) {
                try {
                  await this.sqliteManager.exec("ROLLBACK"), this.logger.debug(`[BatchInsert] FTS sub-batch ${f} rolled back`);
                } catch (S) {
                  this.logger.warn(`[BatchInsert] Rollback failed: ${S instanceof Error ? S.message : String(S)}`);
                }
                throw this.logger.error(
                  `[BatchInsert] FTS sync failed for sub-batch ${f}/${T}: ${y instanceof Error ? y.message : String(y)}`
                ), new Error(
                  `FTS index sync failed for batch ${p}, FTS sub-batch ${f}. Search will not work without FTS index. Original error: ${y instanceof Error ? y.message : String(y)}`
                );
              }
            }
            this.logger.info(`[BatchInsert] ✓ FTS5 sync completed for batch ${p}`);
          } catch (b) {
            this.logger.error(`[BatchInsert] ✗ Batch ${p} FAILED during insert or commit`), this.logger.error(`[BatchInsert] Error type: ${b instanceof Error ? b.constructor.name : typeof b}`), this.logger.error(`[BatchInsert] Error message: ${b instanceof Error ? b.message : String(b)}`), this.logger.error(`[BatchInsert] Documents inserted in failed batch before error: ${h.length - I}`);
            try {
              this.logger.debug("[BatchInsert] Attempting ROLLBACK..."), await this.sqliteManager.exec("ROLLBACK"), this.logger.info(`[BatchInsert] Transaction rolled back for batch ${p}`);
            } catch (T) {
              this.logger.warn(`[BatchInsert] ROLLBACK failed (transaction may have auto-rolled back): ${T instanceof Error ? T.message : String(T)}`);
            }
            throw this.logger.error(`[BatchInsert] Stopping batch processing due to error in batch ${p}`), b;
          }
        }
        return this.logger.info("[BatchInsert] ========================================"), this.logger.info("[BatchInsert] ✓ ALL BATCHES COMPLETED SUCCESSFULLY"), this.logger.info(`[BatchInsert] Total documents inserted: ${h.length}/${i.length}`), this.logger.info("[BatchInsert] === BATCH INSERT COMPLETED ==="), h;
      } catch (u) {
        const g = u instanceof Error ? u.message : String(u), p = {
          documentsAttempted: i.length,
          documentsInserted: h.length,
          documentsFailed: i.length - h.length,
          failurePoint: `document ${h.length + 1}`,
          errorMessage: g,
          collection: t
        };
        throw this.logger.error("[BatchInsert] === BATCH INSERT FAILED ==="), this.logger.error(`[BatchInsert] Error details: ${JSON.stringify(p, null, 2)}`), new Error(`Batch insert failed at document ${h.length + 1}/${i.length}: ${g}`);
      }
    });
  }
  async handleGenerateEmbedding(e) {
    return this.validateParams(e, pe, "handleGenerateEmbedding"), {
      embedding: new Float32Array(384).fill(0.1),
      // Mock embedding
      dimensions: 384,
      generationTime: 100,
      cached: !1,
      provider: "local"
    };
  }
  async handleBatchGenerateEmbeddings(e) {
    return {
      success: this.validateParams(e, ye, "handleBatchGenerateEmbeddings").documents.length,
      failed: 0,
      errors: [],
      processingTime: 100
    };
  }
  async handleRegenerateCollectionEmbeddings(e) {
    return {
      success: 0,
      failed: 0,
      errors: [],
      processingTime: 0
    };
  }
  // =============================================================================
  // Queue Operations
  // =============================================================================
  async handleEnqueueEmbedding(e) {
    const t = this.validateParams(e, be, "handleEnqueueEmbedding");
    return this.ensureInitialized(), this.withContext("enqueueEmbedding", async () => await this.embeddingQueue.enqueue(t));
  }
  async handleProcessEmbeddingQueue(e = {}) {
    const t = this.validateParams(e, we, "handleProcessEmbeddingQueue");
    return this.ensureInitialized(), this.withContext("processEmbeddingQueue", async () => {
      const i = async (s, r) => new Float32Array(384).fill(0.1);
      return await this.embeddingQueue.processQueue(t, i);
    });
  }
  async handleGetQueueStatus(e) {
    return this.ensureInitialized(), this.withContext("getQueueStatus", async () => await this.embeddingQueue.getStatus(e));
  }
  async handleClearEmbeddingQueue(e = {}) {
    const t = this.validateParams(e, Se, "handleClearEmbeddingQueue");
    return this.ensureInitialized(), this.withContext("clearEmbeddingQueue", async () => await this.embeddingQueue.clearQueue(t));
  }
  /**
   * Escape LIKE wildcards to prevent SQL injection / unintended matches
   * CRITICAL: Must escape %, _, and \ characters
   */
  escapeLikeWildcards(e) {
    return e.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
  }
  /**
   * Execute LIKE-based substring search with safety constraints
   *
   * Safety checks:
   * - Wildcard escaping (SQL injection prevention)
   * - Minimum query length (3 chars)
   * - Stop word filtering
   * - Result limit (max 100)
   * - Timeout (500ms)
   */
  async executeLIKESearch(e, t, i) {
    if (!e || e.trim().length === 0)
      return { rows: [], skipReason: "too_short" };
    const s = e.trim();
    if (s.length < this.MIN_LIKE_QUERY_LENGTH)
      return this.logger.debug(`LIKE search skipped: query too short (${s.length} < ${this.MIN_LIKE_QUERY_LENGTH})`), { rows: [], skipReason: "too_short" };
    if (this.LIKE_STOP_WORDS.has(s.toLowerCase()))
      return this.logger.debug(`LIKE search skipped: stop word "${s}"`), { rows: [], skipReason: "stop_word" };
    const r = this.escapeLikeWildcards(s), n = `%${r}%`, a = `
      SELECT
        d.id,
        d.title,
        d.content,
        d.metadata,
        ROW_NUMBER() OVER (
          ORDER BY
            -- Primary: Where match appears (title > content)
            CASE
              WHEN d.title LIKE ? ESCAPE '\\' THEN 1
              WHEN d.content LIKE ? ESCAPE '\\' THEN 2
              ELSE 3
            END,
            -- Secondary: Position of match (earlier = better)
            COALESCE(
              INSTR(d.title, ?),
              INSTR(d.content, ?)
            ),
            -- Tertiary: Document length (shorter = better)
            LENGTH(d.content) ASC
        ) - 1 AS like_rank  -- 0-indexed for RRF
      FROM docs_default d
      WHERE d.collection = ?
        AND (
          d.title LIKE ? ESCAPE '\\' OR
          d.content LIKE ? ESCAPE '\\'
        )
      LIMIT ?
    `, c = [
      n,
      // CASE: title check
      n,
      // CASE: content check
      r,
      // INSTR: title position
      r,
      // INSTR: content position
      t,
      n,
      // WHERE: title match
      n,
      // WHERE: content match
      Math.min(i * 2, this.MAX_LIKE_RESULTS)
      // Cap at MAX_LIKE_RESULTS
    ];
    try {
      const l = await this.sqliteManager.select(a, c);
      return this.logger.debug(`LIKE search completed: ${l.rows.length} results`), { rows: l.rows };
    } catch (l) {
      return l instanceof Error && (l.name === "TimeoutError" || l.message?.includes("timeout")) ? (this.logger.warn(`LIKE query timeout after ${this.LIKE_TIMEOUT_MS}ms, skipping substring search`, {
        query: s,
        collection: t
      }), { rows: [], skipReason: "timeout" }) : (this.logger.error(`LIKE search error: ${l instanceof Error ? l.message : String(l)}`), { rows: [], skipReason: "error" });
    }
  }
  async handleSearch(e) {
    this.ensureInitialized();
    const t = Date.now();
    try {
      const {
        query: i,
        collection: s = "default",
        limit: r = 10,
        fusionMethod: n = "rrf",
        fusionWeights: a = { fts: 0.6, vec: 0.4 },
        enableLikeSearch: c = !1
        // NEW: Opt-in for LIKE search (3-way RRF)
      } = e;
      if (c && n === "weighted_rrf" && a.like !== void 0) {
        const f = a.fts + a.vec + a.like;
        if (Math.abs(f - 1) > 0.01)
          throw new Error(
            `3-way RRF weights must sum to 1.0, got ${f.toFixed(3)} (fts: ${a.fts}, vec: ${a.vec}, like: ${a.like})`
          );
      }
      let l = { ...i };
      if (e.options?.enableEmbedding && i.text && !i.vector)
        try {
          this.logger.info("Generating embedding for advanced search", { text: i.text });
          const f = await this.handleGenerateQueryEmbedding({
            query: i.text,
            collection: s
          });
          f.embedding && (l.vector = f.embedding, this.logger.info("Successfully generated query embedding"));
        } catch (f) {
          this.logger.warn("Failed to generate embedding, using text-only search", { embeddingError: f });
        }
      this.logger.info(`Starting search - text: "${l.text || "none"}", vector: ${l.vector ? "provided" : "none"}, collection: ${s}, LIKE enabled: ${c}`);
      let h = [], E, u = 0;
      if (c && l.text) {
        const f = Date.now(), y = await this.executeLIKESearch(l.text, s, r);
        h = y.rows, E = y.skipReason, u = Date.now() - f, this.logger.info(`LIKE search completed in ${u}ms: ${h.length} results${E ? ` (skipped: ${E})` : ""}`), h.length > 0 && this.logger.debug(`LIKE results: ${h.map((S) => S.id).join(", ")}`);
      }
      let g, p, I = 0, D = 0, R = 0;
      if (l.text && l.vector) {
        const f = c && h.length > 0;
        if (this.logger.info(`Performing ${f ? "3-way" : "2-way"} hybrid search`), f) {
          g = `
            WITH fts_results AS (
              SELECT d.rowid, d.id, d.title, d.content, d.metadata,
                     bm25(fts_default) as fts_score,
                     rank() OVER (ORDER BY bm25(fts_default)) as fts_rank
              FROM docs_default d
              JOIN fts_default f ON d.rowid = f.rowid
              WHERE d.collection = ? AND fts_default MATCH ?
              LIMIT ?
            ),
            vec_results AS (
              SELECT d.rowid, d.id, d.title, d.content, d.metadata,
                     v.distance as vec_score,
                     rank() OVER (ORDER BY v.distance) as vec_rank
              FROM docs_default d
              JOIN (
                SELECT rowid, distance
                FROM vec_default_dense
                WHERE embedding MATCH ?
                ORDER BY distance
                LIMIT ?
              ) v ON d.rowid = v.rowid
              WHERE d.collection = ?
            ),
            like_results AS (
              SELECT d.rowid, d.id, d.title, d.content, d.metadata,
                     lr.like_rank
              FROM docs_default d
              JOIN (
                ${h.map((S, L) => `SELECT '${S.id}' as id, ${S.like_rank} as like_rank`).join(" UNION ALL ")}
              ) lr ON d.id = lr.id
              WHERE d.collection = ?
            )
            SELECT DISTINCT
              COALESCE(f.id, v.id, l.id) as id,
              COALESCE(f.title, v.title, l.title) as title,
              COALESCE(f.content, v.content, l.content) as content,
              COALESCE(f.metadata, v.metadata, l.metadata) as metadata,
              COALESCE(f.fts_score, 0) as fts_score,
              COALESCE(v.vec_score, 1) as vec_score,
              COALESCE(l.like_rank, -1) as like_rank,
              CASE
                WHEN ? = 'rrf' THEN
                  (COALESCE(1.0/(60 + f.fts_rank), 0) +
                   COALESCE(1.0/(60 + v.vec_rank), 0) +
                   COALESCE(1.0/(60 + l.like_rank), 0))
                ELSE
                  (? * COALESCE(-f.fts_score, 0) +
                   ? * COALESCE(1.0/(1.0 + v.vec_score), 0) +
                   ? * CASE WHEN l.like_rank >= 0 THEN 1.0/(1.0 + l.like_rank) ELSE 0 END)
              END as score
            FROM fts_results f
            FULL OUTER JOIN vec_results v ON f.rowid = v.rowid
            FULL OUTER JOIN like_results l ON COALESCE(f.rowid, v.rowid) = l.rowid
            ORDER BY score DESC
            LIMIT ?
          `;
          const y = JSON.stringify(Array.from(l.vector));
          p = [
            s,
            l.text,
            r,
            y,
            r,
            s,
            s,
            // LIKE CTE collection filter
            n,
            a.fts,
            a.vec,
            a.like || 0.2,
            r
          ];
        } else {
          g = `
            WITH fts_results AS (
              SELECT d.rowid, d.id, d.title, d.content, d.metadata,
                     bm25(fts_default) as fts_score,
                     rank() OVER (ORDER BY bm25(fts_default)) as fts_rank
              FROM docs_default d
              JOIN fts_default f ON d.rowid = f.rowid
              WHERE d.collection = ? AND fts_default MATCH ?
              LIMIT ?
            ),
            vec_results AS (
              SELECT d.rowid, d.id, d.title, d.content, d.metadata,
                     v.distance as vec_score,
                     rank() OVER (ORDER BY v.distance) as vec_rank
              FROM docs_default d
              JOIN (
                SELECT rowid, distance
                FROM vec_default_dense
                WHERE embedding MATCH ?
                ORDER BY distance
                LIMIT ?
              ) v ON d.rowid = v.rowid
              WHERE d.collection = ?
            )
            SELECT DISTINCT
              COALESCE(f.id, v.id) as id,
              COALESCE(f.title, v.title) as title,
              COALESCE(f.content, v.content) as content,
              COALESCE(f.metadata, v.metadata) as metadata,
              COALESCE(f.fts_score, 0) as fts_score,
              COALESCE(v.vec_score, 1) as vec_score,
              CASE
                WHEN ? = 'rrf' THEN
                  (COALESCE(1.0/(60 + f.fts_rank), 0) + COALESCE(1.0/(60 + v.vec_rank), 0))
                ELSE
                  (? * COALESCE(-f.fts_score, 0) + ? * COALESCE(1.0/(1.0 + v.vec_score), 0))
              END as score
            FROM fts_results f
            FULL OUTER JOIN vec_results v ON f.rowid = v.rowid
            ORDER BY score DESC
            LIMIT ?
          `;
          const y = JSON.stringify(Array.from(l.vector));
          p = [
            s,
            l.text,
            r,
            y,
            r,
            s,
            n,
            a.fts,
            a.vec,
            r
          ];
        }
      } else if (l.text) {
        const f = c && h.length > 0;
        this.logger.info(`Performing text-only search${f ? " with LIKE" : ""}`);
        const y = l.text.trim().split(/\s+/), S = y.length > 1 ? y.join(" OR ") : l.text;
        f ? (g = `
            WITH fts_results AS (
              SELECT d.rowid, d.id, d.title, d.content, d.metadata,
                     bm25(fts_default) as fts_score,
                     rank() OVER (ORDER BY bm25(fts_default)) as fts_rank
              FROM docs_default d
              JOIN fts_default f ON d.rowid = f.rowid
              WHERE d.collection = ? AND fts_default MATCH ?
              LIMIT ?
            ),
            like_results AS (
              SELECT d.rowid, d.id, d.title, d.content, d.metadata,
                     lr.like_rank
              FROM docs_default d
              JOIN (
                ${h.map((L, O) => `SELECT '${L.id}' as id, ${L.like_rank} as like_rank`).join(" UNION ALL ")}
              ) lr ON d.id = lr.id
              WHERE d.collection = ?
            )
            SELECT DISTINCT
              COALESCE(f.id, l.id) as id,
              COALESCE(f.title, l.title) as title,
              COALESCE(f.content, l.content) as content,
              COALESCE(f.metadata, l.metadata) as metadata,
              COALESCE(f.fts_score, 0) as fts_score,
              0 as vec_score,
              COALESCE(l.like_rank, -1) as like_rank,
              CASE
                WHEN ? = 'rrf' THEN
                  (COALESCE(1.0/(60 + f.fts_rank), 0) +
                   COALESCE(1.0/(60 + l.like_rank), 0))
                ELSE
                  (? * COALESCE(-f.fts_score, 0) +
                   ? * CASE WHEN l.like_rank >= 0 THEN 1.0/(1.0 + l.like_rank) ELSE 0 END)
              END as score
            FROM fts_results f
            FULL OUTER JOIN like_results l ON f.rowid = l.rowid
            ORDER BY score DESC
            LIMIT ?
          `, p = [
          s,
          S,
          r,
          s,
          // LIKE CTE collection filter
          n,
          a.fts,
          a.like || 0.3,
          r
        ]) : (g = `
            SELECT d.id, d.title, d.content, d.metadata,
                   bm25(fts_default) as fts_score,
                   0 as vec_score,
                   -bm25(fts_default) as score
            FROM docs_default d
            JOIN fts_default f ON d.rowid = f.rowid
            WHERE d.collection = ? AND fts_default MATCH ?
            ORDER BY score DESC
            LIMIT ?
          `, p = [s, S, r]);
      } else if (l.vector) {
        this.logger.info("Performing vector-only search");
        const f = JSON.stringify(Array.from(l.vector));
        g = `
          SELECT d.id, d.title, d.content, d.metadata,
                 0 as fts_score,
                 v.distance as vec_score,
                 1.0/(1.0 + v.distance) as score
          FROM docs_default d
          JOIN (
            SELECT rowid, distance
            FROM vec_default_dense
            WHERE embedding MATCH ?
            ORDER BY distance
            LIMIT ?
          ) v ON d.rowid = v.rowid
          WHERE d.collection = ?
          ORDER BY v.distance
        `, p = [f, r, s];
      } else
        throw new Error("Search requires either text or vector query");
      this.logger.info(`Executing search SQL with ${p.length} parameters`), this.logger.debug(`SQL Query:
${g}`), this.logger.debug(`Parameters: ${JSON.stringify(p.slice(0, 5))}...`);
      const b = Date.now(), T = await this.sqliteManager.select(g, p);
      R = Date.now() - b, this.logger.debug(`Search returned ${T.rows.length} rows`);
      const w = T.rows.map((f) => ({
        id: f.id,
        title: f.title,
        content: f.content,
        metadata: f.metadata ? JSON.parse(f.metadata) : void 0,
        score: f.score,
        ftsScore: f.fts_score,
        vecScore: f.vec_score,
        // Add LIKE score/rank if available (3-way RRF only)
        likeRank: f.like_rank !== void 0 && f.like_rank >= 0 ? f.like_rank : void 0,
        likeScore: f.like_rank !== void 0 && f.like_rank >= 0 ? 1 / (1 + f.like_rank) : void 0
      })), v = Date.now() - t;
      return this.operationCount++, this.logger.debug(`Search completed in ${v}ms, found ${w.length} results`), this.logger.debug(`Timing breakdown: LIKE=${u}ms, Fusion=${R}ms, Total=${v}ms`), {
        results: w,
        totalResults: w.length,
        searchTime: v,
        // Enhanced debugInfo with timing breakdown and LIKE monitoring
        debugInfo: {
          query: {
            text: l.text || void 0,
            hasVector: !!l.vector
          },
          searchMethod: l.text && l.vector ? "hybrid" : l.text ? "text" : "vector",
          fusionMethod: n,
          likeEnabled: c,
          likeExecuted: c && !!l.text,
          likeTimeout: E === "timeout",
          likeSkipped: !!E,
          likeSkipReason: E,
          likeResultCount: h.length,
          timing: {
            total: v,
            likeSearch: u,
            fusion: R,
            // FTS/Vec times not separately tracked (combined in fusion)
            ftsTime: 0,
            vectorTime: 0
          },
          weights: a,
          collection: s,
          limit: r
        }
      };
    } catch (i) {
      return this.logger.error("Search failed", { error: i }), {
        results: [],
        totalResults: 0,
        searchTime: Date.now() - t
      };
    }
  }
  async handleSearchSemantic(e) {
    return {
      results: [],
      totalResults: 0,
      searchTime: 5
    };
  }
  // Enhanced Search API (Task 6.1)
  // Note: These methods are placeholders for future enhanced search implementation
  async handleSearchText(e) {
    return this.ensureInitialized(), this.withContext("searchText", async () => {
      const t = await this.handleSearch({
        query: { text: e.query },
        collection: e.options?.collection || "default",
        limit: e.options?.limit || 10
      });
      return {
        results: t.results,
        totalResults: t.totalResults,
        searchTime: t.searchTime,
        strategy: "fts"
      };
    });
  }
  async handleSearchAdvanced(e) {
    return this.ensureInitialized(), this.withContext("searchAdvanced", async () => {
      const t = await this.handleSearch({
        query: typeof e.query == "string" ? { text: e.query } : e.query,
        collection: e.collections?.[0] || "default",
        limit: 10
      });
      return {
        results: t.results,
        totalResults: t.totalResults,
        searchTime: t.searchTime,
        strategy: "hybrid"
      };
    });
  }
  async handleSearchGlobal(e) {
    return this.ensureInitialized(), this.withContext("searchGlobal", async () => {
      const t = await this.handleSearch({
        query: { text: e.query },
        limit: 10
      });
      return {
        results: t.results,
        totalResults: t.totalResults,
        searchTime: t.searchTime,
        strategy: "fts",
        collectionResults: [{
          collection: "default",
          results: t.results,
          totalInCollection: t.totalResults
        }],
        collectionsSearched: ["default"]
      };
    });
  }
  // =============================================================================
  // Import/Export Operations
  // =============================================================================
  async handleExport(e) {
    return this.ensureInitialized(), this.withContext("export", async () => await this.sqliteManager.serialize());
  }
  async handleImport(e) {
    return this.validateParams(e, Ee, "handleImport"), this.ensureInitialized(), this.withContext("import", async () => {
      const t = e.data instanceof ArrayBuffer ? new Uint8Array(e.data) : e.data;
      await this.sqliteManager.deserialize(t), await this.schemaManager.initializeSchema();
    });
  }
  async handleClear() {
    return this.ensureInitialized(), this.withContext("clear", async () => {
      await this.opfsManager.clearDatabase(), await this.schemaManager.initializeSchema();
    });
  }
  // =============================================================================
  // Utility Operations
  // =============================================================================
  async handlePing() {
    return {
      status: this.isInitialized ? "ready" : "not_initialized",
      timestamp: Date.now()
    };
  }
  async handleGetVersion() {
    return {
      sqlite: this.sqliteManager.getVersion(),
      vec: "available",
      sdk: "1.0.0"
    };
  }
  async handleGetStats() {
    return Date.now() - this.startTime, {
      memory: 0,
      // Not easily available in worker context
      dbSize: 0,
      // Would need to calculate
      operations: this.sqliteManager.getOperationCount()
    };
  }
  // =============================================================================
  // Helper Methods
  // Task 6.2: Internal Embedding Pipeline Handlers
  // =============================================================================
  async handleGenerateQueryEmbedding(e) {
    return this.ensureInitialized(), this.withContext("generateQueryEmbedding", async () => {
      const t = await this.searchHandler.generateEmbeddingWithProvider(
        this.providerManager,
        e.query,
        e.collection
      );
      return {
        embedding: t,
        dimensions: t.length,
        model: "Xenova/all-MiniLM-L6-v2",
        source: "provider_fresh",
        processingTime: 0
      };
    });
  }
  async handleBatchGenerateQueryEmbeddings(e) {
    return this.ensureInitialized(), this.withContext("batchGenerateQueryEmbeddings", async () => {
      const t = [];
      for (const i of e.requests)
        try {
          const s = await this.searchHandler.generateEmbeddingWithProvider(
            this.providerManager,
            i.query,
            i.collection
          );
          t.push({
            requestId: i.id,
            embedding: s,
            dimensions: s.length,
            source: "provider_fresh",
            processingTime: 0,
            status: "completed"
          });
        } catch (s) {
          t.push({
            requestId: i.id,
            embedding: new Float32Array(),
            dimensions: 0,
            source: "provider_fresh",
            processingTime: 0,
            status: "failed",
            error: s instanceof Error ? s.message : String(s)
          });
        }
      return t;
    });
  }
  async handleWarmEmbeddingCache(e) {
    return this.ensureInitialized(), this.withContext("warmEmbeddingCache", async () => {
      this.logger.info("Cache warming not yet implemented");
    });
  }
  async handleClearEmbeddingCache(e) {
    return this.ensureInitialized(), this.withContext("clearEmbeddingCache", async () => {
      const t = this.searchHandler.embeddingPipeline;
      if (!t) {
        this.logger.warn("Embedding pipeline not available for cache clearing");
        return;
      }
      await this.searchHandler.pipelineInitialized, e?.pattern ? this.logger.warn("Pattern-based cache clearing not yet implemented") : await t.clearCache(e?.collection);
    });
  }
  async handleGetPipelineStats() {
    return this.ensureInitialized(), this.withContext("getPipelineStats", async () => {
      const e = this.searchHandler.embeddingPipeline;
      return e ? (await this.searchHandler.pipelineInitialized, e.getPerformanceStats()) : {
        totalRequests: 0,
        cacheHitRate: 0,
        averageGenerationTime: 0,
        activeModels: 0,
        memoryUsage: 0,
        cacheStats: {
          memory: { hits: 0, misses: 0 },
          indexedDB: { hits: 0, misses: 0 },
          database: { hits: 0, misses: 0 }
        }
      };
    });
  }
  async handleGetModelStatus() {
    return this.ensureInitialized(), this.withContext("getModelStatus", async () => {
      const e = this.searchHandler.modelManager;
      if (!e)
        return {
          loadedModels: [],
          totalMemoryUsage: 0,
          activeCount: 0,
          providerStats: {}
        };
      await this.searchHandler.pipelineInitialized;
      const t = e.getModelStatus();
      return {
        loadedModels: t.loadedModels.map((i) => ({
          modelId: i.modelId,
          provider: i.provider,
          modelName: i.modelName,
          dimensions: i.dimensions,
          memoryUsage: i.memoryUsage,
          lastUsed: i.lastUsed,
          usageCount: i.usageCount,
          status: i.status
        })),
        totalMemoryUsage: t.totalMemoryUsage,
        activeCount: t.activeCount,
        providerStats: t.providerStats
      };
    });
  }
  async handlePreloadModels(e) {
    return this.ensureInitialized(), this.withContext("preloadModels", async () => {
      const t = this.searchHandler.modelManager;
      if (!t) {
        this.logger.warn("Model manager not available for preloading");
        return;
      }
      await this.searchHandler.pipelineInitialized, await t.preloadModels(e.strategy || "lazy");
    });
  }
  async handleOptimizeModelMemory(e) {
    return this.ensureInitialized(), this.withContext("optimizeModelMemory", async () => {
      const t = this.searchHandler.modelManager;
      if (!t) {
        this.logger.warn("Model manager not available for memory optimization");
        return;
      }
      await this.searchHandler.pipelineInitialized, await t.optimizeMemory(e);
    });
  }
  // =============================================================================
  // LLM Operations (SCRUM-17)
  // =============================================================================
  async handleEnhanceQuery(e) {
    return this.ensureInitialized(), this.withContext("enhanceQuery", async () => {
      const t = {
        provider: e.options?.provider || "openai",
        model: e.options?.model || "gpt-4",
        apiKey: e.options?.apiKey,
        temperature: e.options?.temperature,
        timeout: e.options?.timeout
      };
      return await this.llmManager.enhanceQuery(e.query, t, e.options);
    });
  }
  async handleSummarizeResults(e) {
    return this.ensureInitialized(), this.withContext("summarizeResults", async () => {
      const t = {
        provider: e.options?.provider || "openai",
        model: e.options?.model || "gpt-4",
        apiKey: e.options?.apiKey,
        temperature: e.options?.temperature,
        timeout: e.options?.timeout
      };
      return await this.llmManager.summarizeResults(e.results, t, e.options);
    });
  }
  async handleSearchWithLLM(e) {
    return this.ensureInitialized(), this.withContext("searchWithLLM", async () => {
      const t = Date.now();
      let i, s = 0;
      if (e.options?.enhanceQuery) {
        const d = Date.now(), h = {
          provider: e.options.llmOptions?.provider || "openai",
          model: e.options.llmOptions?.model || "gpt-4",
          apiKey: e.options.llmOptions?.apiKey,
          temperature: e.options.llmOptions?.temperature
        };
        i = await this.llmManager.enhanceQuery(e.query, h), s += Date.now() - d;
      }
      const r = i?.enhancedQuery || e.query, n = Date.now(), a = await this.handleSearchText({
        query: r,
        options: e.options?.searchOptions
      }), c = Date.now() - n;
      let l;
      if (e.options?.summarizeResults && a.results.length > 0) {
        const d = Date.now(), h = {
          provider: e.options.llmOptions?.provider || "openai",
          model: e.options.llmOptions?.model || "gpt-4",
          apiKey: e.options.llmOptions?.apiKey,
          temperature: e.options.llmOptions?.temperature
        };
        l = await this.llmManager.summarizeResults(a.results, h), s += Date.now() - d;
      }
      return {
        results: a.results,
        enhancedQuery: i,
        summary: l,
        searchTime: c,
        llmTime: s,
        totalTime: Date.now() - t
      };
    });
  }
  async handleCallLLM(e) {
    return this.ensureInitialized(), this.withContext("callLLM", async () => {
      const t = {
        provider: e.options?.provider || "openai",
        model: e.options?.model || "gpt-4",
        apiKey: e.options?.apiKey,
        temperature: e.options?.temperature,
        maxTokens: e.options?.maxTokens,
        timeout: e.options?.timeout
      }, i = await this.llmManager.callLLM(e.prompt, t, e.options);
      return {
        text: i.text,
        finishReason: i.finishReason,
        usage: i.usage,
        model: i.model,
        provider: i.provider,
        processingTime: i.processingTime
      };
    });
  }
  // =============================================================================
  // Helper Methods
  // =============================================================================
  validateParams(e, t, i) {
    if (!t(e))
      throw new Error(`Invalid parameters for ${i}: ${JSON.stringify(e)}`);
    return e;
  }
  validateCollectionName(e, t) {
    if (typeof e != "string" || e.length === 0)
      throw new Error(`Invalid collection name for ${t}: must be a non-empty string`);
    return e;
  }
  ensureInitialized() {
    if (!this.isInitialized)
      throw new Error("Database not initialized - call open() first");
  }
  async withContext(e, t) {
    return N.withContext(e, "DatabaseWorker", t);
  }
}
new De();
self.addEventListener("error", (o) => {
  console.error("[Worker] Unhandled error:", o.error);
});
self.addEventListener("unhandledrejection", (o) => {
  console.error("[Worker] Unhandled promise rejection:", o.reason);
});
export {
  De as DatabaseWorker
};
//# sourceMappingURL=worker.js.map
