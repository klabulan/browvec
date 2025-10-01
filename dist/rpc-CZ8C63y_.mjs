class o extends Error {
  constructor(e, r, t) {
    super(e), this.code = r, this.details = t, this.name = "WorkerError";
  }
}
class m extends o {
  constructor(e, r) {
    super(e, "DATABASE_ERROR"), this.sqliteCode = r, this.name = "DatabaseError";
  }
}
class u extends o {
  constructor(e) {
    super(e, "VECTOR_ERROR"), this.name = "VectorError";
  }
}
class p extends o {
  constructor(e) {
    super(e, "OPFS_ERROR"), this.name = "OPFSError";
  }
}
const h = {
  maxConcurrentOperations: 10,
  operationTimeout: 3e4,
  // 30 seconds
  enablePerformanceMonitoring: !0,
  logLevel: "info"
};
class d {
  constructor(e, r = {}) {
    this.pendingCalls = /* @__PURE__ */ new Map(), this.callCounter = 0, this.performanceMetrics = {
      totalCalls: 0,
      totalTime: 0,
      errors: 0,
      timeouts: 0
    }, this.worker = e, this.config = { ...h, ...r }, this.setupWorkerListeners();
  }
  setupWorkerListeners() {
    this.worker.onmessage = (e) => {
      const r = e.data;
      if (r.type === "log") {
        const t = r.level;
        (console[t] || console.log)(r.message, ...r.args || []);
        return;
      }
      this.handleWorkerResponse(r);
    }, this.worker.onerror = (e) => {
      this.log("error", "Worker error:", e.message), this.rejectAllPending(new o("Worker error: " + e.message, "WORKER_ERROR"));
    }, this.worker.onmessageerror = (e) => {
      this.log("error", "Worker message error:", e), this.rejectAllPending(new o("Worker message error", "MESSAGE_ERROR"));
    };
  }
  handleWorkerResponse(e) {
    const r = this.pendingCalls.get(e.id);
    if (!r) {
      this.log("warn", "Received response for unknown call ID:", e.id);
      return;
    }
    if (this.pendingCalls.delete(e.id), clearTimeout(r.timeout), this.config.enablePerformanceMonitoring) {
      const t = Date.now() - r.startTime;
      this.performanceMetrics.totalCalls++, this.performanceMetrics.totalTime += t;
    }
    if (e.error) {
      this.performanceMetrics.errors++;
      const t = new o(
        e.error.message,
        e.error.code
      );
      e.error.stack && (t.stack = e.error.stack), r.reject(t);
    } else
      r.resolve(e.result);
  }
  generateCallId() {
    return `rpc_${++this.callCounter}_${Date.now()}`;
  }
  call(e, r) {
    return new Promise((t, s) => {
      if (this.pendingCalls.size >= this.config.maxConcurrentOperations) {
        this.log("error", `Rate limit exceeded for ${e}: ${this.pendingCalls.size}/${this.config.maxConcurrentOperations}`), s(new o(
          `Too many concurrent operations (max: ${this.config.maxConcurrentOperations})`,
          "RATE_LIMIT"
        ));
        return;
      }
      const n = this.generateCallId(), l = Date.now(), c = setTimeout(() => {
        this.log("error", `Operation timeout for ${e} after ${this.config.operationTimeout}ms`), this.pendingCalls.delete(n), this.performanceMetrics.timeouts++, s(new o(
          `Operation timeout after ${this.config.operationTimeout}ms`,
          "TIMEOUT"
        ));
      }, this.config.operationTimeout);
      this.pendingCalls.set(n, {
        resolve: t,
        reject: s,
        timeout: c,
        startTime: l
      });
      const g = {
        id: n,
        method: e,
        params: r
      };
      try {
        this.worker.postMessage(g);
      } catch (a) {
        this.log("error", `Failed to send RPC message for ${e}:`, a), this.pendingCalls.delete(n), clearTimeout(c), s(new o(
          `Failed to send message: ${a instanceof Error ? a.message : String(a)}`,
          "SEND_ERROR"
        ));
      }
    });
  }
  rejectAllPending(e) {
    for (const [r, t] of this.pendingCalls)
      clearTimeout(t.timeout), t.reject(e);
    this.pendingCalls.clear();
  }
  log(e, r, ...t) {
    const s = { debug: 0, info: 1, warn: 2, error: 3 }, n = s[this.config.logLevel];
    s[e] >= n && console[e](`[WorkerRPC] ${r}`, ...t);
  }
  // DBWorkerAPI implementation
  async open(e) {
    return this.call("open", e);
  }
  async close() {
    const e = await this.call("close");
    return this.rejectAllPending(new o("Worker closed", "WORKER_CLOSED")), e;
  }
  async exec(e) {
    return this.call("exec", e);
  }
  async select(e) {
    return this.call("select", e);
  }
  async bulkInsert(e) {
    return this.call("bulkInsert", e);
  }
  async initVecExtension() {
    return this.call("initVecExtension");
  }
  async initializeSchema() {
    return this.call("initializeSchema");
  }
  async getCollectionInfo(e) {
    return this.call("getCollectionInfo", e);
  }
  async search(e) {
    return this.call("search", e);
  }
  async export(e) {
    return this.call("export", e);
  }
  async import(e) {
    return this.call("import", e);
  }
  async clear() {
    return this.call("clear");
  }
  async getVersion() {
    return this.call("getVersion");
  }
  async getStats() {
    return this.call("getStats");
  }
  // Utility methods
  getPerformanceMetrics() {
    const e = this.performanceMetrics.totalCalls > 0 ? this.performanceMetrics.totalTime / this.performanceMetrics.totalCalls : 0;
    return {
      ...this.performanceMetrics,
      averageLatency: e,
      pendingOperations: this.pendingCalls.size,
      successRate: this.performanceMetrics.totalCalls > 0 ? (this.performanceMetrics.totalCalls - this.performanceMetrics.errors) / this.performanceMetrics.totalCalls : 1
    };
  }
  terminate() {
    this.rejectAllPending(new o("Worker terminated", "TERMINATED")), this.worker.terminate();
  }
}
class f {
  constructor(e = {}) {
    this.handlers = /* @__PURE__ */ new Map(), this.config = { ...h, ...e }, this.setupMessageHandler();
  }
  setupMessageHandler() {
    self.onmessage = async (e) => {
      const r = e.data;
      await this.handleMessage(r);
    };
  }
  async handleMessage(e) {
    let r;
    try {
      const t = this.handlers.get(e.method);
      if (!t)
        throw new o(`Unknown method: ${e.method}`, "UNKNOWN_METHOD");
      const s = await t(e.params);
      r = {
        id: e.id,
        result: s
      };
    } catch (t) {
      this.log("error", `Method ${e.method} failed:`, t), r = {
        id: e.id,
        error: {
          message: t instanceof Error ? t.message : String(t),
          code: t instanceof o ? t.code : "UNKNOWN_ERROR",
          stack: t instanceof Error ? t.stack : void 0
        }
      };
    }
    try {
      self.postMessage(r);
    } catch (t) {
      this.log("error", "Failed to post response:", t);
      const s = {
        id: e.id,
        error: {
          message: "Failed to serialize response",
          code: "SERIALIZATION_ERROR"
        }
      };
      try {
        self.postMessage(s);
      } catch (n) {
        this.log("error", "Failed to send error response:", n);
      }
    }
  }
  register(e, r) {
    this.handlers.set(e, r), this.log("debug", `Registered handler for method: ${e}`);
  }
  unregister(e) {
    this.handlers.delete(e), this.log("debug", `Unregistered handler for method: ${e}`);
  }
  log(e, r, ...t) {
    const s = { debug: 0, info: 1, warn: 2, error: 3 }, n = s[this.config.logLevel];
    s[e] >= n && console[e](`[WorkerRPCHandler] ${r}`, ...t);
  }
}
function R(i, e) {
  const r = new Worker(i, { type: "module" });
  return new d(r, e);
}
export {
  m as D,
  p as O,
  u as V,
  o as W,
  d as a,
  f as b,
  R as c
};
//# sourceMappingURL=rpc-CZ8C63y_.mjs.map
