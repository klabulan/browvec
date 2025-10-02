import { D as h, b as M, O as L, E as _, p as D, t as x } from "../ProviderFactory-BqrsaSK-.mjs";
const v = 0, $ = 100, N = 101, F = 1, z = 2, H = 3, U = 4, k = 5, O = -1;
class Q {
  constructor(e) {
    this.logger = e, this.sqlite3 = null, this.dbPtr = 0, this.operationCount = 0;
  }
  /**
   * Load SQLite WASM module
   */
  async loadWASM() {
    if (!this.sqlite3)
      try {
        const e = `${self.location.origin}/sqlite3.mjs`;
        this.log("info", `Loading SQLite WASM from: ${e}`);
        const t = await import(e);
        if (this.sqlite3 = await t.default(), !this.sqlite3?._sqlite3_open || !this.sqlite3?._sqlite3_close)
          throw new h("SQLite WASM module is incomplete - missing core functions");
        const i = this.sqlite3?._sqlite3_libversion(), s = i && this.sqlite3?.UTF8ToString ? this.sqlite3.UTF8ToString(i) : "unknown";
        this.log("info", `SQLite WASM loaded successfully, version: ${s}`);
      } catch (e) {
        const t = e instanceof Error ? e.message : String(e);
        throw this.log("error", `Failed to load SQLite WASM: ${t}`), new h(`Failed to load SQLite WASM: ${t}`);
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
    if (this.sqlite3._free(t), s !== v) {
      this.sqlite3._free(i);
      const r = this.sqlite3._sqlite3_errmsg && this.sqlite3._sqlite3_errmsg(0) || 0, o = r ? this.sqlite3.UTF8ToString(r) : `SQLite error code ${s}`;
      throw new h(`Failed to open database: ${o}`);
    }
    if (this.dbPtr = this.sqlite3.getValue(i, "i32"), this.sqlite3._free(i), !this.dbPtr)
      throw new h("Failed to get valid database pointer");
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
      throw new h("Database not initialized");
    if (!this.sqlite3._sqlite3_vec_init_manual)
      throw new M("sqlite-vec extension not available");
    const e = this.sqlite3._sqlite3_vec_init_manual(this.dbPtr);
    if (e !== v)
      throw this.log("error", `sqlite-vec initialization failed with code: ${e}`), new M(`Failed to initialize sqlite-vec extension (code: ${e})`);
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
      throw new h("Database not initialized");
    if (this.operationCount++, !t || t.length === 0) {
      const a = this.sqlite3._malloc(e.length + 1);
      this.sqlite3.stringToUTF8(e, a, e.length + 1);
      const c = this.sqlite3._sqlite3_exec(this.dbPtr, a, 0, 0, 0);
      if (this.sqlite3._free(a), c !== v) {
        const l = this.sqlite3._sqlite3_errmsg(this.dbPtr), d = this.sqlite3.UTF8ToString(l);
        throw this.log("error", `SQL execution failed: ${e} - Error: ${d}`), new h(`SQL execution failed: ${d}`);
      } else
        this.log("debug", `SQL executed successfully: ${e}`);
      return;
    }
    const i = this.sqlite3._malloc(e.length + 1);
    this.sqlite3.stringToUTF8(e, i, e.length + 1);
    const s = this.sqlite3._malloc(4), r = this.sqlite3._sqlite3_prepare_v2(this.dbPtr, i, -1, s, 0);
    if (this.sqlite3._free(i), r !== v) {
      this.sqlite3._free(s);
      const a = this.sqlite3._sqlite3_errmsg(this.dbPtr), c = this.sqlite3.UTF8ToString(a);
      throw this.log("error", `SQL preparation failed: ${e} - Error: ${c}`), new h(`Failed to prepare statement: ${c}`);
    }
    const o = this.sqlite3.getValue(s, "i32");
    this.sqlite3._free(s);
    try {
      if (t)
        if (Array.isArray(t))
          for (let c = 0; c < t.length; c++)
            this.bindParameter(o, c + 1, t[c]);
        else {
          const c = Object.keys(t);
          for (let l = 0; l < c.length; l++)
            this.bindParameter(o, l + 1, t[c[l]]);
        }
      const a = this.sqlite3._sqlite3_step(o);
      if (a !== N && a !== $) {
        const c = this.sqlite3._sqlite3_errmsg(this.dbPtr), l = this.sqlite3.UTF8ToString(c);
        throw this.log("error", `SQL execution failed: ${e} - Error: ${l}`), new h(`SQL execution failed: ${l}`);
      }
      this.log("debug", `SQL executed successfully with parameters: ${e}`);
    } finally {
      this.sqlite3._sqlite3_finalize(o);
    }
  }
  /**
   * Execute SQL query and return results
   */
  async select(e, t) {
    if (!this.sqlite3 || !this.dbPtr)
      throw new h("Database not initialized");
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
    const s = this.sqlite3._malloc(t.length + 1);
    this.sqlite3.stringToUTF8(t, s, t.length + 1);
    const r = this.sqlite3._malloc(4), o = this.sqlite3._sqlite3_prepare_v2(e, s, -1, r, 0);
    if (this.sqlite3._free(s), o !== v) {
      this.sqlite3._free(r);
      const l = this.sqlite3._sqlite3_errmsg(e), d = this.sqlite3.UTF8ToString(l);
      throw new h(`Failed to prepare statement: ${d}`);
    }
    const a = this.sqlite3.getValue(r, "i32");
    if (this.sqlite3._free(r), i) {
      if (Array.isArray(i) && i.length > 0)
        for (let l = 0; l < i.length; l++) {
          const d = i[l];
          this.bindParameter(a, l + 1, d);
        }
      else if (!Array.isArray(i)) {
        const l = Object.keys(i);
        if (l.length > 0)
          for (let d = 0; d < l.length; d++)
            this.bindParameter(a, d + 1, i[l[d]]);
      }
    }
    const c = [];
    try {
      for (; this.sqlite3._sqlite3_step(a) === $; ) {
        const l = this.sqlite3._sqlite3_column_count(a), d = {};
        for (let u = 0; u < l; u++) {
          const m = this.sqlite3.UTF8ToString(this.sqlite3._sqlite3_column_name(a, u)), E = this.sqlite3._sqlite3_column_type(a, u);
          d[m] = this.extractColumnValue(a, u, E);
        }
        c.push(d);
      }
    } finally {
      this.sqlite3._sqlite3_finalize(a);
    }
    return c;
  }
  /**
   * Bind parameter to prepared statement
   */
  bindParameter(e, t, i) {
    if (!this.sqlite3)
      throw new h("SQLite not initialized");
    if (i == null)
      this.sqlite3._sqlite3_bind_null(e, t);
    else if (typeof i == "number")
      Number.isInteger(i) ? this.sqlite3._sqlite3_bind_int(e, t, i) : this.sqlite3._sqlite3_bind_double(e, t, i);
    else if (typeof i == "string") {
      const s = this.sqlite3._malloc(i.length + 1);
      this.sqlite3.stringToUTF8(i, s, i.length + 1), this.sqlite3._sqlite3_bind_text(e, t, s, -1, O), this.sqlite3._free(s);
    } else if (i instanceof Uint8Array) {
      const s = this.sqlite3._malloc(i.length);
      if (this.sqlite3.writeArrayToMemory)
        this.sqlite3.writeArrayToMemory(i, s);
      else
        for (let r = 0; r < i.length; r++)
          this.sqlite3.setValue(s + r, i[r], "i8");
      this.sqlite3._sqlite3_bind_blob(e, t, s, i.length, O), this.sqlite3._free(s);
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
      throw new h("SQLite not initialized");
    switch (i) {
      case F:
        return this.sqlite3._sqlite3_column_int(e, t);
      case z:
        return this.sqlite3._sqlite3_column_double(e, t);
      case H:
        return this.sqlite3.UTF8ToString(this.sqlite3._sqlite3_column_text(e, t));
      case U:
        const s = this.sqlite3._sqlite3_column_blob(e, t), r = this.sqlite3._sqlite3_column_bytes(e, t), o = new Uint8Array(r);
        for (let a = 0; a < r; a++)
          o[a] = this.sqlite3.getValue(s + a, "i8");
        return o;
      case k:
      default:
        return null;
    }
  }
  /**
   * Serialize database to Uint8Array
   */
  async serialize() {
    if (!this.sqlite3 || !this.dbPtr)
      throw new h("Database not initialized");
    const e = "main", t = this.sqlite3._malloc(8), i = this.sqlite3._malloc(e.length + 1);
    try {
      if (this.sqlite3.stringToUTF8(e, i, e.length + 1), typeof this.sqlite3._sqlite3_serialize != "function")
        throw new h("sqlite3_serialize function not available");
      const s = this.sqlite3._sqlite3_serialize(this.dbPtr, i, t, 0);
      if (!s)
        throw new h("Failed to serialize database");
      const r = this.sqlite3.getValue(t, "i64"), o = new Uint8Array(Number(r));
      for (let a = 0; a < o.length; a++)
        o[a] = this.sqlite3.getValue(s + a, "i8");
      return this.sqlite3._free(s), this.log("debug", `Database serialized: ${o.length} bytes`), o;
    } finally {
      this.sqlite3._free(t), this.sqlite3._free(i);
    }
  }
  /**
   * Deserialize database from Uint8Array
   */
  async deserialize(e) {
    if (!this.sqlite3 || !this.dbPtr)
      throw new h("Database not initialized");
    const t = "main", i = this.sqlite3._malloc(t.length + 1), s = this.sqlite3._malloc(e.length);
    try {
      if (this.sqlite3.stringToUTF8(t, i, t.length + 1), this.sqlite3.writeArrayToMemory)
        this.sqlite3.writeArrayToMemory(e, s);
      else
        for (let o = 0; o < e.length; o++)
          this.sqlite3.setValue(s + o, e[o], "i8");
      if (typeof this.sqlite3._sqlite3_deserialize != "function")
        throw new h("sqlite3_deserialize function not available");
      const r = this.sqlite3._sqlite3_deserialize(
        this.dbPtr,
        i,
        s,
        BigInt(e.length),
        BigInt(e.length),
        0
      );
      if (r !== v)
        throw new h(`Failed to deserialize database (SQLite error code: ${r})`);
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
class G {
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
      const i = new L(`Failed to load from OPFS: ${t instanceof Error ? t.message : String(t)}`);
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
      throw new L(
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
const f = 2;
class W {
  constructor(e, t) {
    this.sqliteManager = e, this.logger = t;
  }
  /**
   * Initialize database schema
   */
  async initializeSchema() {
    if (!this.sqliteManager.isConnected())
      throw new h("Database not connected");
    try {
      let e = 0, t = !1;
      try {
        const i = await this.sqliteManager.select("SELECT MAX(schema_version) as version FROM collections");
        i.rows.length > 0 && i.rows[0].version !== null && (e = i.rows[0].version, this.log("info", `Current schema version: ${e}`));
        const s = await this.sqliteManager.select("SELECT COUNT(*) as count FROM docs_default");
        if (t = s.rows.length > 0 && s.rows[0].count > 0, e === f && t) {
          this.log("info", "Schema is up-to-date, skipping initialization");
          return;
        }
      } catch {
        this.log("debug", "Schema tables do not exist yet, proceeding with initialization");
      }
      if (e > 0 && e < f) {
        await this.migrateSchema(e), this.log("info", `Schema migrated from version ${e} to ${f}`);
        return;
      }
      await this.validateAndCleanupSchema(), await this.createSchema(), this.log("info", "Schema initialized successfully");
    } catch (e) {
      throw new h(`Schema initialization failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  /**
   * Migrate schema from older version to current version
   */
  async migrateSchema(e) {
    this.log("info", `Migrating schema from version ${e} to version ${f}`);
    try {
      e === 1 && await this.migrateFromV1ToV2(), this.log("info", `Successfully migrated from schema version ${e} to ${f}`);
    } catch (t) {
      throw new h(`Schema migration failed: ${t instanceof Error ? t.message : String(t)}`);
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
      UPDATE collections SET schema_version = ${f}, updated_at = strftime('%s', 'now')
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
    const t = e.rows.map((o) => o.name), i = ["docs_default", "collections", "fts_default", "vec_default_dense"], s = i.every((o) => t.includes(o));
    if (i.some((o) => t.includes(o)) && !s)
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
      -- Base documents table
      CREATE TABLE IF NOT EXISTS docs_default (
        id TEXT PRIMARY KEY,
        title TEXT,
        content TEXT NOT NULL,
        metadata JSON,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
      );

      -- Full-text search table
      CREATE VIRTUAL TABLE IF NOT EXISTS fts_default USING fts5(
        title, content, metadata,
        content=docs_default,
        content_rowid=rowid
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
        schema_version INTEGER DEFAULT ${f},
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
        throw new h(`Collection '${e}' not found`);
      const i = t.rows[0], s = await this.sqliteManager.select(
        "SELECT COUNT(*) as count FROM docs_default WHERE json_extract(metadata, '$.collection') = ?",
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
      throw new h(`Failed to get collection info: ${t instanceof Error ? t.message : String(t)}`);
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
        throw new h(`Collection '${e}' already exists`);
      const r = {
        vectorDim: t,
        metric: "cosine",
        ...i
      };
      await this.sqliteManager.exec(`
        INSERT INTO collections (name, config, schema_version, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      const o = Math.floor(Date.now() / 1e3), a = await this.sqliteManager.select(
        "SELECT ? as name, ? as config, ? as schema_version, ? as created_at, ? as updated_at",
        [
          e,
          JSON.stringify(r),
          f,
          o,
          o
        ]
      );
      await this.sqliteManager.exec(
        `INSERT INTO collections (name, config, schema_version, created_at, updated_at)
         VALUES ('${e}', '${JSON.stringify(r)}', ${f}, ${o}, ${o})`
      ), this.log("info", `Collection '${e}' created with ${t} dimensions`);
    } catch (s) {
      throw new h(`Failed to create collection: ${s instanceof Error ? s.message : String(s)}`);
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
class B {
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
          throw new h("Failed to get queue item ID");
        return this.log("info", `Enqueued embedding for document '${i}' in collection '${t}' with priority ${r} (ID: ${l})`), l;
      }
      return this.log("info", `Enqueued embedding for document '${i}' in collection '${t}' with priority ${r} (ID: ${a})`), a;
    } catch (o) {
      throw new h(`Failed to enqueue embedding: ${o instanceof Error ? o.message : String(o)}`);
    }
  }
  /**
   * Process pending items in the queue
   */
  async processQueue(e, t) {
    const { collection: i, batchSize: s = 10, maxRetries: r = 3 } = e;
    try {
      const o = await this.getPendingItems(i, s);
      if (o.length === 0)
        return this.log("info", `No pending items in embedding queue${i ? " for collection " + i : ""}`), { processed: 0, failed: 0, remainingInQueue: 0, errors: [] };
      this.log("info", `Processing ${o.length} items from embedding queue`);
      const a = {
        processed: 0,
        failed: 0,
        remainingInQueue: 0,
        errors: []
      };
      for (const l of o) {
        a.processed++;
        try {
          await this.markAsProcessing(l.id);
          const d = await t(l.collection_name, l.content);
          await this.storeEmbedding(l.collection_name, l.document_id, d), await this.markAsCompleted(l.id), this.log("debug", `Successfully processed embedding for document '${l.document_id}' in collection '${l.collection_name}'`);
        } catch (d) {
          const u = d instanceof Error ? d.message : String(d);
          l.retry_count < r ? (await this.markForRetry(l.id, l.retry_count + 1), this.log("warn", `Embedding processing failed for document '${l.document_id}', will retry (attempt ${l.retry_count + 1}/${r}): ${u}`)) : (await this.markAsFailed(l.id, u), a.failed++, a.errors.push({
            documentId: l.document_id,
            error: u
          }), this.log("error", `Embedding processing failed permanently for document '${l.document_id}' after ${r} retries: ${u}`));
        }
      }
      const c = await this.sqliteManager.select(`
        SELECT COUNT(*) as count FROM embedding_queue
        WHERE status = 'pending'${i ? " AND collection_name = ?" : ""}
      `, i ? [i] : []);
      return a.remainingInQueue = c.rows[0]?.count || 0, this.log("info", `Queue processing completed: ${a.processed - a.failed} successful, ${a.failed} failed, ${a.remainingInQueue} remaining`), a;
    } catch (o) {
      throw new h(`Failed to process embedding queue: ${o instanceof Error ? o.message : String(o)}`);
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
      let o = 0, a = 0;
      for (const l of s.rows) {
        const d = l.status, u = l.count;
        d in r && (r[d] = u, r.total += u), d === "completed" && l.avg_processing_time && (o += l.avg_processing_time * u, a += u);
      }
      a > 0 && (r.avgProcessingTime = Math.round(o / a));
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
      throw new h(`Failed to get queue status: ${t instanceof Error ? t.message : String(t)}`);
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
      const o = s.replace("DELETE FROM embedding_queue", "SELECT COUNT(*) as count FROM embedding_queue"), c = (await this.sqliteManager.select("SELECT COUNT(*) as count FROM embedding_queue")).rows[0]?.count || 0;
      return this.log("info", `Cleared ${c} items from embedding queue`), c;
    } catch (s) {
      throw new h(`Failed to clear embedding queue: ${s instanceof Error ? s.message : String(s)}`);
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
    return e && (i += " AND collection_name = ?", s.push(e)), i += " ORDER BY priority DESC, created_at ASC LIMIT ?", s.push(t), (await this.sqliteManager.select(i, s)).rows.map((o) => ({
      id: o.id,
      collection_name: o.collection_name,
      document_id: o.document_id,
      content: o.content,
      status: o.status,
      priority: o.priority,
      retry_count: o.retry_count,
      created_at: o.created_at,
      started_at: o.started_at,
      completed_at: o.completed_at,
      processed_at: o.processed_at,
      error_message: o.error_message
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
      "SELECT rowid FROM docs_default WHERE id = ? AND json_extract(metadata, '$.collection') = ?",
      [t, e]
    );
    if (s.rows.length === 0)
      throw new h(`Document '${t}' not found in collection '${e}'`);
    const r = s.rows[0].rowid, o = new Uint8Array(i.buffer);
    await this.sqliteManager.select(
      "INSERT OR REPLACE INTO vec_default_dense (rowid, embedding) VALUES (?, ?)",
      [r, o]
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
      throw new h(`Collection '${e}' does not exist`);
  }
  log(e, t, i) {
    this.logger ? this.logger.log(e, t, i) : console.log(`[EmbeddingQueue] ${e.toUpperCase()}: ${t}`, i || "");
  }
}
class V {
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
        throw new _(`Collection '${e}' not found`);
      const s = JSON.parse(t.rows[0].config || "{}").embeddingConfig;
      if (!s)
        throw new _(`Collection '${e}' has no embedding configuration`);
      const r = await D.createProvider(s);
      if (typeof r.initialize == "function") {
        const o = {
          defaultProvider: s.provider,
          defaultDimensions: s.dimensions,
          provider: s.provider,
          defaultModel: s.model,
          apiKey: s.apiKey,
          batchSize: s.batchSize,
          timeout: s.timeout,
          enabled: s.autoGenerate !== !1
        };
        await r.initialize(o);
      }
      return this.log("info", `Initialized embedding provider '${s.provider}' for collection '${e}'`), r;
    } catch (t) {
      throw new _(`Failed to initialize embedding provider for collection '${e}': ${t instanceof Error ? t.message : String(t)}`);
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
class q extends Error {
  constructor(e, t, i) {
    super(e), this.name = "ContextualError", this.context = t, this.originalError = i, Error.captureStackTrace && Error.captureStackTrace(this, q);
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
class S {
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
      const o = {
        operation: e,
        component: t,
        params: s,
        timestamp: Date.now(),
        stackTrace: r instanceof Error ? r.stack : void 0
      }, a = new q(
        r instanceof Error ? r.message : String(r),
        o,
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
    for (let o = 1; o <= i; o++)
      try {
        return await e();
      } catch (a) {
        if (r = a instanceof Error ? a : new Error(String(a)), t.onRetry && t.onRetry(o, r), o === i)
          break;
        await new Promise((c) => setTimeout(c, s * o));
      }
    if (t.strategy === "fallback" && t.fallbackValue !== void 0)
      return t.onFallback && t.onFallback(r), t.fallbackValue;
    throw r || new Error("Operation failed after retries");
  }
  /**
   * Classify error for appropriate handling
   */
  static classifyError(e) {
    return e instanceof h ? this.classifyDatabaseError(e) : e instanceof M ? {
      category: "vector",
      severity: "high",
      recoverable: !1,
      userMessage: "Vector search functionality is not available",
      suggestedAction: "Check if sqlite-vec extension is properly loaded"
    } : e instanceof L ? {
      category: "opfs",
      severity: "medium",
      recoverable: !0,
      userMessage: "Data persistence may not work properly",
      suggestedAction: "Check browser storage settings or clear storage"
    } : e instanceof _ ? {
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
    const s = [...["password", "token", "key", "secret", "auth"], ...t], r = (o) => {
      if (typeof o != "object" || o === null)
        return o;
      if (Array.isArray(o))
        return o.map(r);
      const a = {};
      for (const [c, l] of Object.entries(o))
        s.some((d) => c.toLowerCase().includes(d)) ? a[c] = "[REDACTED]" : typeof l == "object" ? a[c] = r(l) : a[c] = l;
      return a;
    };
    return {
      name: e.name,
      message: e.message,
      stack: e.stack,
      context: e instanceof q ? r(e.context) : void 0
    };
  }
}
function j(n) {
  return n == null || typeof n == "string" || typeof n == "number" || n instanceof Uint8Array || n instanceof Float32Array;
}
function I(n) {
  return Array.isArray(n) && n.every(j);
}
function X(n) {
  return typeof n == "object" && n !== null && typeof n.filename == "string" && (n.path === void 0 || typeof n.path == "string") && (n.vfs === void 0 || n.vfs === "opfs" || n.vfs === "opfs-sahpool") && (n.pragmas === void 0 || typeof n.pragmas == "object" && n.pragmas !== null);
}
function K(n) {
  return typeof n == "object" && n !== null && typeof n.sql == "string" && (n.params === void 0 || I(n.params));
}
function J(n) {
  return typeof n == "object" && n !== null && typeof n.sql == "string" && (n.params === void 0 || I(n.params));
}
function Y(n) {
  return typeof n == "object" && n !== null && typeof n.tableName == "string" && Array.isArray(n.data) && n.data.every(
    (e) => typeof e == "object" && e !== null && !Array.isArray(e)
  );
}
function Z(n) {
  return typeof n == "object" && n !== null && typeof n.name == "string" && (n.dimensions === void 0 || typeof n.dimensions == "number") && (n.config === void 0 || typeof n.config == "object" && n.config !== null);
}
function ee(n) {
  return typeof n == "object" && n !== null && typeof n.collection == "string" && // Validate nested document object
  typeof n.document == "object" && n.document !== null && (n.document.id === void 0 || typeof n.document.id == "string") && typeof n.document.content == "string" && (n.document.title === void 0 || typeof n.document.title == "string") && (n.document.metadata === void 0 || typeof n.document.metadata == "object" && n.document.metadata !== null) && // Validate optional options object
  (n.options === void 0 || typeof n.options == "object" && n.options !== null);
}
function te(n) {
  return typeof n == "object" && n !== null && (n.data instanceof Uint8Array || n.data instanceof ArrayBuffer) && (n.overwrite === void 0 || typeof n.overwrite == "boolean");
}
function ie(n) {
  return typeof n == "object" && n !== null && typeof n.collection == "string" && typeof n.content == "string" && (n.options === void 0 || typeof n.options == "object" && n.options !== null);
}
function se(n) {
  return typeof n == "object" && n !== null && typeof n.collection == "string" && Array.isArray(n.documents) && n.documents.every(
    (e) => typeof e == "object" && e !== null && typeof e.id == "string" && typeof e.content == "string"
  ) && (n.options === void 0 || typeof n.options == "object" && n.options !== null);
}
function re(n) {
  return typeof n == "object" && n !== null && typeof n.collection == "string" && typeof n.documentId == "string" && typeof n.textContent == "string" && (n.priority === void 0 || typeof n.priority == "number");
}
function ne(n) {
  return n === void 0 || typeof n == "object" && n !== null && (n.collection === void 0 || typeof n.collection == "string") && (n.batchSize === void 0 || typeof n.batchSize == "number") && (n.onProgress === void 0 || typeof n.onProgress == "function");
}
function oe(n) {
  return n === void 0 || typeof n == "object" && n !== null && (n.collection === void 0 || typeof n.collection == "string") && (n.status === void 0 || typeof n.status == "string");
}
function ae(n) {
  return typeof n == "string" && n.length > 0 && n.length <= 255 && /^[a-zA-Z0-9_-]+$/.test(n);
}
function le(n) {
  return typeof n == "string" && n.length > 0 && n.length <= 255;
}
function ce(n) {
  return typeof n == "number" && Number.isInteger(n) && n > 0 && n <= 1e4;
}
function de(n) {
  return typeof n == "number" && n >= 0 && n <= 1;
}
class T {
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
    if (!ae(e))
      throw new Error(`Invalid collection name for ${t}: must be a non-empty alphanumeric string with underscores/hyphens, max 255 characters`);
    if (["sqlite_master", "sqlite_temp_master", "sqlite_sequence"].includes(e.toLowerCase()))
      throw new Error(`Collection name '${e}' is reserved`);
    return e;
  }
  /**
   * Validate document ID with additional business rules
   */
  static validateDocumentId(e, t) {
    if (!le(e))
      throw new Error(`Invalid document ID for ${t}: must be a non-empty string, max 255 characters`);
    return e;
  }
  /**
   * Validate and sanitize SQL parameters
   */
  static validateSQLParams(e, t) {
    if (e !== void 0) {
      if (!I(e))
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
    if (!ce(e))
      throw new Error(`Invalid limit for ${t}: must be a positive integer between 1 and 10000`);
    return e;
  }
  /**
   * Validate search threshold parameter
   */
  static validateThreshold(e, t) {
    if (e !== void 0) {
      if (!de(e))
        throw new Error(`Invalid threshold for ${t}: must be a number between 0 and 1`);
      return e;
    }
  }
}
class he {
  constructor(e) {
    this.sqliteManager = e.sqliteManager, this.schemaManager = e.schemaManager, this.opfsManager = e.opfsManager, this.logger = e.logger;
  }
  /**
   * Execute an operation with error handling and context
   */
  async withContext(e, t, i) {
    return S.withContext(
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
    return S.withRetry(e, {
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
    return T.validate(e, t, `${this.getComponentName()}.${i}`);
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
    return S.createErrorResponse(e, t);
  }
  /**
   * Check if error is recoverable
   */
  isRecoverableError(e) {
    return S.isRecoverable(e);
  }
  /**
   * Create user-friendly error message
   */
  createUserMessage(e) {
    return S.createUserMessage(e);
  }
  /**
   * Sanitize sensitive data from parameters for logging
   */
  sanitizeParams(e, t = []) {
    const s = [...["password", "token", "key", "secret"], ...t];
    if (typeof e != "object" || e === null)
      return e;
    const r = {};
    for (const [o, a] of Object.entries(e))
      s.some((c) => o.toLowerCase().includes(c)) ? r[o] = "[REDACTED]" : typeof a == "object" ? r[o] = this.sanitizeParams(a, t) : r[o] = a;
    return r;
  }
  /**
   * Validate collection name with business rules
   */
  validateCollectionName(e, t) {
    return T.validateCollectionName(e, `${this.getComponentName()}.${t}`);
  }
  /**
   * Validate document ID with business rules
   */
  validateDocumentId(e, t) {
    return T.validateDocumentId(e, `${this.getComponentName()}.${t}`);
  }
  /**
   * Validate search limit parameter
   */
  validateLimit(e, t, i = 10) {
    return T.validateLimit(e, `${this.getComponentName()}.${t}`, i);
  }
  /**
   * Validate search threshold parameter
   */
  validateThreshold(e, t) {
    return T.validateThreshold(e, `${this.getComponentName()}.${t}`);
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
      const s = t.slice(0, 3).map((o) => typeof o == "string" ? o.length > 50 ? `"${o.substring(0, 50)}..."` : `"${o}"` : o instanceof Uint8Array || o instanceof Float32Array ? `[${o.constructor.name} ${o.length}]` : String(o)), r = t.length > 3 ? `[${s.join(", ")}, ...${t.length - 3} more]` : `[${s.join(", ")}]`;
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
    } catch (o) {
      throw this.log("error", `${e} failed: ${o instanceof Error ? o.message : String(o)}`), o;
    }
  }
}
class ue extends he {
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
      this.logger.info("Generating query embedding", { query: t.substring(0, 50), collection: i });
      const s = await e.getProvider(i);
      if (!s)
        throw new Error("No embedding provider available for collection");
      const r = await s.generateEmbedding(t);
      return this.logger.info("Query embedding generated successfully", {
        query: t.substring(0, 50),
        dimensions: r.length
      }), r;
    } catch (s) {
      throw this.logger.error("Failed to generate query embedding", { query: t, error: s }), s;
    }
  }
}
class y extends Error {
  constructor(e, t, i, s, r) {
    super(e), this.code = t, this.statusCode = i, this.provider = s, this.details = r, this.name = "LLMError", Object.setPrototypeOf(this, y.prototype);
  }
}
class b extends y {
  constructor(e, t) {
    super(e, "INVALID_CONFIG", void 0, void 0, t), this.name = "LLMConfigError", Object.setPrototypeOf(this, b.prototype);
  }
}
class C extends y {
  constructor(e, t, i, s) {
    super(e, "PROVIDER_ERROR", t, i, s), this.name = "LLMProviderError", Object.setPrototypeOf(this, C.prototype);
  }
}
class R extends y {
  constructor(e, t) {
    super(`LLM request timeout after ${t}ms`, "TIMEOUT", void 0, e), this.name = "LLMTimeoutError", Object.setPrototypeOf(this, R.prototype);
  }
}
class w extends y {
  constructor(e, t, i) {
    super(e, "PARSE_ERROR", void 0, t, i), this.name = "LLMParseError", Object.setPrototypeOf(this, w.prototype);
  }
}
function ge(n) {
  return `You are a search query expert. Analyze and enhance this search query.

Original query: "${n}"

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
function me(n) {
  return `You are a search result summarizer. Analyze these search results and provide a concise summary.

Search Results:
${n.map((t, i) => {
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
class P {
  constructor(e, t) {
    this.config = e, this.logger = t, this.validateConfig();
  }
  /**
   * Validate provider configuration
   */
  validateConfig() {
    if (!this.config.provider)
      throw new b("Provider is required");
    if (!this.config.model)
      throw new b("Model is required");
    if (!this.config.apiKey && this.config.provider !== "custom")
      throw new b(`API key required for provider: ${this.config.provider}`);
  }
  /**
   * Execute HTTP request to LLM API
   */
  async executeRequest(e, t) {
    const i = this.buildRequestURL(), s = this.buildRequestHeaders(), r = this.buildRequestBody(e, t), o = t?.timeout || this.config.timeout || 1e4, a = new AbortController(), c = t?.signal || a.signal, l = setTimeout(() => a.abort(), o);
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
        const E = await d.json().catch(() => ({}));
        throw new C(
          E.error?.message || d.statusText,
          d.status,
          this.config.provider,
          E
        );
      }
      const u = await d.json(), m = this.parseResponse(u);
      return this.logger.debug(`LLM Response from ${this.config.provider}`, {
        provider: this.config.provider,
        model: this.config.model,
        finishReason: m.finishReason,
        textLength: m.text.length
      }), m;
    } catch (d) {
      throw clearTimeout(l), d.name === "AbortError" ? new R(this.config.provider, o) : d instanceof y ? d : new y(
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
      } catch (o) {
        if (s = o, o instanceof b || o instanceof R || o instanceof C && o.statusCode && o.statusCode < 500)
          throw o;
        if (r < i) {
          const a = Math.pow(2, r) * 1e3;
          this.logger.warn(`LLM request failed, retrying in ${a}ms`, {
            attempt: r + 1,
            maxRetries: i,
            error: o.message
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
    const i = ge(e);
    return await this.executeRequestWithRetry(i, t);
  }
  /**
   * Public API: Summarize results
   */
  async summarizeResults(e, t) {
    const i = me(e);
    return await this.executeRequestWithRetry(i, t);
  }
}
class fe extends P {
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
      throw new w(
        `Failed to parse OpenAI response: ${t.message}`,
        "openai",
        { data: e, error: t.message }
      );
    }
  }
}
class pe extends P {
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
      throw new w(
        `Failed to parse Anthropic response: ${t.message}`,
        "anthropic",
        { data: e, error: t.message }
      );
    }
  }
}
class ye extends P {
  /**
   * Validate custom provider configuration
   */
  validateConfig() {
    if (super.validateConfig(), !this.config.endpoint)
      throw new b("Endpoint is required for custom provider");
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
      throw new w(
        `Failed to parse custom provider response: ${t.message}`,
        "custom",
        { data: e, error: t.message }
      );
    }
  }
}
class Ee {
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
        return new fe(e, this.logger);
      case "anthropic":
        return new pe(e, this.logger);
      case "openrouter":
      case "custom":
        return new ye(e, this.logger);
      default:
        throw new y(
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
      const o = await r.call(e, i), a = {
        text: o.text,
        finishReason: o.finishReason,
        usage: o.usage,
        model: o.model || t.model,
        provider: o.provider || t.provider,
        processingTime: Date.now() - s
      };
      return this.logger.debug("Generic LLM call complete", {
        provider: t.provider,
        processingTime: a.processingTime,
        textLength: a.text.length
      }), a;
    } catch (o) {
      throw this.logger.error("Generic LLM call failed", {
        error: o.message,
        provider: t.provider,
        promptLength: e.length
      }), o;
    }
  }
  /**
   * Enhance query using LLM
   */
  async enhanceQuery(e, t, i) {
    const s = Date.now(), r = this.getProvider(t);
    try {
      this.logger.debug(`Enhancing query: "${e}"`, { provider: t.provider });
      const o = await r.enhanceQuery(e, i), a = JSON.parse(o.text), c = {
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
    } catch (o) {
      throw this.logger.error("Query enhancement failed", {
        error: o.message,
        query: e,
        provider: t.provider
      }), o instanceof SyntaxError ? new w(
        "Failed to parse LLM JSON response",
        t.provider,
        { error: o.message }
      ) : o;
    }
  }
  /**
   * Summarize search results using LLM
   */
  async summarizeResults(e, t, i) {
    const s = Date.now(), r = this.getProvider(t);
    try {
      this.logger.debug(`Summarizing ${e.length} results`, { provider: t.provider });
      const o = await r.summarizeResults(e, i), a = JSON.parse(o.text), c = {
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
    } catch (o) {
      throw this.logger.error("Result summarization failed", {
        error: o.message,
        resultCount: e.length,
        provider: t.provider
      }), o instanceof SyntaxError ? new w(
        "Failed to parse LLM JSON response",
        t.provider,
        { error: o.message }
      ) : o;
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
class p {
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
    return p.LEVEL_PRIORITY[t] >= p.LEVEL_PRIORITY[this.config.level];
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
      const r = p.LEVEL_COLORS[e.level];
      t.push(`${r}${i}${p.RESET_COLOR}`);
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
    return new p({
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
    return t in p.LEVEL_PRIORITY ? t : "info";
  }
  /**
   * Static method to create a default logger instance
   */
  static create(e, t = "info") {
    return new p({ component: e, level: t });
  }
}
class be {
  constructor() {
    this.isInitialized = !1, this.startTime = Date.now(), this.logger = new p({
      level: "debug",
      component: "DatabaseWorker"
    }), this.sqliteManager = new Q(this.logger), this.opfsManager = new G(this.sqliteManager, this.logger), this.schemaManager = new W(this.sqliteManager, this.logger), this.embeddingQueue = new B(this.sqliteManager, this.logger), this.providerManager = new V(this.sqliteManager, this.logger), this.searchHandler = new ue({
      sqliteManager: this.sqliteManager,
      schemaManager: this.schemaManager,
      opfsManager: this.opfsManager,
      logger: this.logger
    }), this.llmManager = new Ee(this.logger), this.rpcHandler = new x({
      logLevel: "debug",
      operationTimeout: 3e4
    }), this.setupRPCHandlers(), this.logger.info("DatabaseWorker initialized with modular architecture + LLM support");
  }
  /**
   * Setup all RPC handlers
   */
  setupRPCHandlers() {
    this.rpcHandler.register("open", this.handleOpen.bind(this)), this.rpcHandler.register("close", this.handleClose.bind(this)), this.rpcHandler.register("exec", this.handleExec.bind(this)), this.rpcHandler.register("select", this.handleSelect.bind(this)), this.rpcHandler.register("bulkInsert", this.handleBulkInsert.bind(this)), this.rpcHandler.register("initVecExtension", this.handleInitVecExtension.bind(this)), this.rpcHandler.register("initializeSchema", this.handleInitializeSchema.bind(this)), this.rpcHandler.register("getCollectionInfo", this.handleGetCollectionInfo.bind(this)), this.rpcHandler.register("createCollection", this.handleCreateCollection.bind(this)), this.rpcHandler.register("getCollectionEmbeddingStatus", this.handleGetCollectionEmbeddingStatus.bind(this)), this.rpcHandler.register("insertDocumentWithEmbedding", this.handleInsertDocumentWithEmbedding.bind(this)), this.rpcHandler.register("generateEmbedding", this.handleGenerateEmbedding.bind(this)), this.rpcHandler.register("batchGenerateEmbeddings", this.handleBatchGenerateEmbeddings.bind(this)), this.rpcHandler.register("regenerateCollectionEmbeddings", this.handleRegenerateCollectionEmbeddings.bind(this)), this.rpcHandler.register("enqueueEmbedding", this.handleEnqueueEmbedding.bind(this)), this.rpcHandler.register("processEmbeddingQueue", this.handleProcessEmbeddingQueue.bind(this)), this.rpcHandler.register("getQueueStatus", this.handleGetQueueStatus.bind(this)), this.rpcHandler.register("clearEmbeddingQueue", this.handleClearEmbeddingQueue.bind(this)), this.rpcHandler.register("search", this.handleSearch.bind(this)), this.rpcHandler.register("searchSemantic", this.handleSearchSemantic.bind(this)), this.rpcHandler.register("searchText", this.handleSearchText.bind(this)), this.rpcHandler.register("searchAdvanced", this.handleSearchAdvanced.bind(this)), this.rpcHandler.register("searchGlobal", this.handleSearchGlobal.bind(this)), this.rpcHandler.register("enhanceQuery", this.handleEnhanceQuery.bind(this)), this.rpcHandler.register("summarizeResults", this.handleSummarizeResults.bind(this)), this.rpcHandler.register("searchWithLLM", this.handleSearchWithLLM.bind(this)), this.rpcHandler.register("callLLM", this.handleCallLLM.bind(this)), this.rpcHandler.register("generateQueryEmbedding", this.handleGenerateQueryEmbedding.bind(this)), this.rpcHandler.register("batchGenerateQueryEmbeddings", this.handleBatchGenerateQueryEmbeddings.bind(this)), this.rpcHandler.register("warmEmbeddingCache", this.handleWarmEmbeddingCache.bind(this)), this.rpcHandler.register("clearEmbeddingCache", this.handleClearEmbeddingCache.bind(this)), this.rpcHandler.register("getPipelineStats", this.handleGetPipelineStats.bind(this)), this.rpcHandler.register("getModelStatus", this.handleGetModelStatus.bind(this)), this.rpcHandler.register("preloadModels", this.handlePreloadModels.bind(this)), this.rpcHandler.register("optimizeModelMemory", this.handleOptimizeModelMemory.bind(this)), this.rpcHandler.register("export", this.handleExport.bind(this)), this.rpcHandler.register("import", this.handleImport.bind(this)), this.rpcHandler.register("clear", this.handleClear.bind(this)), this.rpcHandler.register("ping", this.handlePing.bind(this)), this.rpcHandler.register("getVersion", this.handleGetVersion.bind(this)), this.rpcHandler.register("getStats", this.handleGetStats.bind(this));
  }
  // =============================================================================
  // Core Database Operations
  // =============================================================================
  async handleOpen(e) {
    const t = this.validateParams(e, X, "handleOpen");
    return this.withContext("open", async () => {
      const i = t.filename || t.path || ":memory:";
      this.logger.info(`Opening database with filename: ${i}, vfs: ${t.vfs}`);
      let s = i;
      i.startsWith("opfs:/") && (this.logger.info(`Initializing OPFS database: ${i}`), s = await this.opfsManager.initializeDatabase(i), this.logger.info(`OPFS database path resolved to: ${s}`)), this.logger.info(`Opening SQLite database at path: ${s}`), await this.sqliteManager.openDatabase(s), await this.sqliteManager.initVecExtension();
      const r = this.opfsManager.getPendingDatabaseData();
      if (r) {
        this.logger.info("Restoring database from OPFS data"), await this.sqliteManager.deserialize(r), this.opfsManager.clearPendingDatabaseData(), this.logger.info("Database restored from OPFS successfully");
        try {
          await this.sqliteManager.exec("SELECT 1"), this.logger.info("Database connection verified after restore");
        } catch (o) {
          this.logger.error("Database connection invalid after restore, reopening...", { error: o }), this.sqliteManager.closeDatabase(), await this.sqliteManager.openDatabase(s), await this.sqliteManager.initVecExtension(), this.logger.info("Database connection re-established");
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
    const t = this.validateParams(e, K, "handleExec");
    return this.ensureInitialized(), this.withContext("exec", async () => {
      await this.sqliteManager.exec(t.sql, t.params), this.logger.debug(`Executed SQL: ${t.sql.substring(0, 100)}...`);
    });
  }
  async handleSelect(e) {
    const t = this.validateParams(e, J, "handleSelect");
    return this.ensureInitialized(), this.withContext("select", async () => {
      const i = await this.sqliteManager.select(t.sql, t.params);
      return this.logger.debug(`Selected ${i.rows.length} rows`), i;
    });
  }
  async handleBulkInsert(e) {
    const t = this.validateParams(e, Y, "handleBulkInsert");
    return this.ensureInitialized(), this.withContext("bulkInsert", async () => {
      for (const i of t.data) {
        const s = Object.keys(i), r = Object.values(i), o = s.map(() => "?").join(", "), a = `INSERT INTO ${t.tableName} (${s.join(", ")}) VALUES (${o})`;
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
    const t = this.validateParams(e, Z, "handleCreateCollection");
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
  async handleInsertDocumentWithEmbedding(e) {
    const t = this.validateParams(e, ee, "handleInsertDocumentWithEmbedding");
    return this.ensureInitialized(), this.withContext("insertDocumentWithEmbedding", async () => {
      const i = t.document.id || `doc_${Date.now()}`, s = `
        INSERT OR REPLACE INTO docs_default (id, title, content, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, strftime('%s', 'now'), strftime('%s', 'now'))
      `, r = { ...t.document.metadata, collection: t.collection };
      return await this.sqliteManager.select(s, [
        i,
        t.document.title || "",
        t.document.content,
        JSON.stringify(r)
      ]), { id: i, embeddingGenerated: !1 };
    });
  }
  async handleGenerateEmbedding(e) {
    return this.validateParams(e, ie, "handleGenerateEmbedding"), {
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
      success: this.validateParams(e, se, "handleBatchGenerateEmbeddings").documents.length,
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
    const t = this.validateParams(e, re, "handleEnqueueEmbedding");
    return this.ensureInitialized(), this.withContext("enqueueEmbedding", async () => await this.embeddingQueue.enqueue(t));
  }
  async handleProcessEmbeddingQueue(e = {}) {
    const t = this.validateParams(e, ne, "handleProcessEmbeddingQueue");
    return this.ensureInitialized(), this.withContext("processEmbeddingQueue", async () => {
      const i = async (s, r) => new Float32Array(384).fill(0.1);
      return await this.embeddingQueue.processQueue(t, i);
    });
  }
  async handleGetQueueStatus(e) {
    return this.ensureInitialized(), this.withContext("getQueueStatus", async () => await this.embeddingQueue.getStatus(e));
  }
  async handleClearEmbeddingQueue(e = {}) {
    const t = this.validateParams(e, oe, "handleClearEmbeddingQueue");
    return this.ensureInitialized(), this.withContext("clearEmbeddingQueue", async () => await this.embeddingQueue.clearQueue(t));
  }
  // =============================================================================
  // Search Operations (Simplified)
  // =============================================================================
  async handleSearch(e) {
    this.ensureInitialized();
    const t = Date.now();
    try {
      const {
        query: i,
        collection: s = "default",
        limit: r = 10,
        fusionMethod: o = "rrf",
        fusionWeights: a = { fts: 0.6, vec: 0.4 }
      } = e;
      let c = { ...i };
      if (e.options?.enableEmbedding && i.text && !i.vector)
        try {
          this.logger.info("Generating embedding for advanced search", { text: i.text });
          const g = await this.handleGenerateQueryEmbedding({
            query: i.text,
            collection: s
          });
          g.embedding && (c.vector = g.embedding, this.logger.info("Successfully generated query embedding"));
        } catch (g) {
          this.logger.warn("Failed to generate embedding, using text-only search", { embeddingError: g });
        }
      this.logger.info(`Starting search - text: "${c.text || "none"}", vector: ${c.vector ? "provided" : "none"}, collection: ${s}`);
      let l, d;
      if (c.text && c.vector) {
        this.logger.info("Performing hybrid text + vector search"), l = `
          WITH fts_results AS (
            SELECT d.rowid, d.id, d.title, d.content, d.metadata,
                   bm25(fts_${s}) as fts_score,
                   rank() OVER (ORDER BY bm25(fts_${s})) as fts_rank
            FROM docs_${s} d
            JOIN fts_${s} f ON d.rowid = f.rowid
            WHERE fts_${s} MATCH ?
            LIMIT ?
          ),
          vec_results AS (
            SELECT d.rowid, d.id, d.title, d.content, d.metadata,
                   v.distance as vec_score,
                   rank() OVER (ORDER BY v.distance) as vec_rank
            FROM docs_${s} d
            JOIN (
              SELECT rowid, distance
              FROM vec_${s}_dense
              WHERE embedding MATCH ?
              ORDER BY distance
              LIMIT ?
            ) v ON d.rowid = v.rowid
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
        const g = JSON.stringify(Array.from(c.vector));
        d = [
          c.text,
          r,
          g,
          r,
          o,
          a.fts,
          a.vec,
          r
        ];
      } else if (c.text) {
        this.logger.info("Performing text-only FTS search");
        const g = c.text.trim().split(/\s+/), A = g.length > 1 ? g.join(" OR ") : c.text;
        l = `
          SELECT d.id, d.title, d.content, d.metadata,
                 bm25(fts_${s}) as fts_score,
                 0 as vec_score,
                 -bm25(fts_${s}) as score
          FROM docs_${s} d
          JOIN fts_${s} f ON d.rowid = f.rowid
          WHERE fts_${s} MATCH ?
          ORDER BY score DESC
          LIMIT ?
        `, d = [A, r];
      } else if (c.vector) {
        this.logger.info("Performing vector-only search");
        const g = JSON.stringify(Array.from(c.vector));
        l = `
          SELECT d.id, d.title, d.content, d.metadata,
                 0 as fts_score,
                 v.distance as vec_score,
                 1.0/(1.0 + v.distance) as score
          FROM docs_${s} d
          JOIN (
            SELECT rowid, distance
            FROM vec_${s}_dense
            WHERE embedding MATCH ?
            ORDER BY distance
            LIMIT ?
          ) v ON d.rowid = v.rowid
          ORDER BY v.distance
        `, d = [g, r];
      } else
        throw new DatabaseError("Search requires either text or vector query");
      this.logger.info(`Executing search SQL with ${d.length} parameters`);
      const m = (await this.sqliteManager.select(l, d)).rows.map((g) => ({
        id: g.id,
        title: g.title,
        content: g.content,
        metadata: g.metadata ? JSON.parse(g.metadata) : void 0,
        score: g.score,
        ftsScore: g.fts_score,
        vecScore: g.vec_score
      })), E = Date.now() - t;
      return this.operationCount++, this.logger.debug(`Search completed in ${E}ms, found ${m.length} results`), {
        results: m,
        totalResults: m.length,
        searchTime: E
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
        searchTime: t.searchTime,
        strategy: "fts"
      };
    });
  }
  async handleSearchAdvanced(e) {
    return this.ensureInitialized(), this.withContext("searchAdvanced", async () => {
      const t = await this.handleSearch({
        query: e.query,
        collection: e.options?.collection || "default",
        limit: e.options?.limit || 10
      });
      return {
        results: t.results,
        searchTime: t.searchTime,
        strategy: "hybrid"
      };
    });
  }
  async handleSearchGlobal(e) {
    return this.ensureInitialized(), this.withContext("searchGlobal", async () => {
      const t = await this.handleSearch({
        query: { text: e.query },
        limit: e.options?.limit || 10
      });
      return {
        resultsByCollection: {
          default: t.results
        },
        totalResults: t.results.length,
        searchTime: t.searchTime
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
    return this.validateParams(e, te, "handleImport"), this.ensureInitialized(), this.withContext("import", async () => {
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
        model: "Xenova/all-MiniLM-L6-v2"
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
            query: i.query,
            embedding: s,
            dimensions: s.length,
            model: "Xenova/all-MiniLM-L6-v2",
            success: !0
          });
        } catch (s) {
          t.push({
            query: i.query,
            embedding: new Float32Array(),
            dimensions: 0,
            model: "Xenova/all-MiniLM-L6-v2",
            success: !1,
            error: s instanceof Error ? s.message : String(s)
          });
        }
      return t;
    });
  }
  async handleWarmEmbeddingCache(e) {
    return this.ensureInitialized(), this.withContext("warmEmbeddingCache", async () => await this.searchHandler.warmEmbeddingCache(e.collection, e.commonQueries));
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
        endpoint: e.options?.endpoint,
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
        endpoint: e.options?.endpoint,
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
        const d = Date.now(), u = {
          provider: e.options.llmOptions?.provider || "openai",
          model: e.options.llmOptions?.model || "gpt-4",
          apiKey: e.options.llmOptions?.apiKey,
          endpoint: e.options.llmOptions?.endpoint,
          temperature: e.options.llmOptions?.temperature
        };
        i = await this.llmManager.enhanceQuery(e.query, u), s += Date.now() - d;
      }
      const r = i?.enhancedQuery || e.query, o = Date.now(), a = await this.handleSearchText({
        query: r,
        options: e.options?.searchOptions
      }), c = Date.now() - o;
      let l;
      if (e.options?.summarizeResults && a.results.length > 0) {
        const d = Date.now(), u = {
          provider: e.options.llmOptions?.provider || "openai",
          model: e.options.llmOptions?.model || "gpt-4",
          apiKey: e.options.llmOptions?.apiKey,
          endpoint: e.options.llmOptions?.endpoint,
          temperature: e.options.llmOptions?.temperature
        };
        l = await this.llmManager.summarizeResults(a.results, u), s += Date.now() - d;
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
        endpoint: e.options?.endpoint,
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
    return S.withContext(e, "DatabaseWorker", t);
  }
}
new be();
self.addEventListener("error", (n) => {
  console.error("[Worker] Unhandled error:", n.error);
});
self.addEventListener("unhandledrejection", (n) => {
  console.error("[Worker] Unhandled promise rejection:", n.reason);
});
export {
  be as DatabaseWorker
};
//# sourceMappingURL=worker.js.map
