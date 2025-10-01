class n extends Error {
  constructor(e, r, s) {
    super(e), this.code = r, this.details = s, this.name = "WorkerError";
  }
}
class m extends n {
  constructor(e, r) {
    super(e, "DATABASE_ERROR"), this.sqliteCode = r, this.name = "DatabaseError";
  }
}
class u extends n {
  constructor(e) {
    super(e, "VECTOR_ERROR"), this.name = "VectorError";
  }
}
class p extends n {
  constructor(e) {
    super(e, "OPFS_ERROR"), this.name = "OPFSError";
  }
}
const g = {
  maxConcurrentOperations: 10,
  operationTimeout: 3e4,
  // 30 seconds
  enablePerformanceMonitoring: !0,
  logLevel: "info"
};
class h {
  constructor(e, r = {}) {
    this.pendingCalls = /* @__PURE__ */ new Map(), this.callCounter = 0, this.performanceMetrics = {
      totalCalls: 0,
      totalTime: 0,
      errors: 0,
      timeouts: 0
    }, this.worker = e, this.config = { ...g, ...r }, this.setupWorkerListeners();
  }
  setupWorkerListeners() {
    this.worker.onmessage = (e) => {
      console.log("[WorkerRPC] Received message from worker:", e.data);
      const r = e.data;
      this.handleWorkerResponse(r);
    }, this.worker.onerror = (e) => {
      this.log("error", "Worker error:", e.message), this.rejectAllPending(new n("Worker error: " + e.message, "WORKER_ERROR"));
    }, this.worker.onmessageerror = (e) => {
      this.log("error", "Worker message error:", e), this.rejectAllPending(new n("Worker message error", "MESSAGE_ERROR"));
    };
  }
  handleWorkerResponse(e) {
    console.log("[WorkerRPC.handleWorkerResponse] Processing response:", e);
    const r = this.pendingCalls.get(e.id);
    if (!r) {
      console.log("[WorkerRPC.handleWorkerResponse] No pending call found for ID:", e.id), this.log("warn", "Received response for unknown call ID:", e.id);
      return;
    }
    if (this.pendingCalls.delete(e.id), clearTimeout(r.timeout), this.config.enablePerformanceMonitoring) {
      const s = Date.now() - r.startTime;
      this.performanceMetrics.totalCalls++, this.performanceMetrics.totalTime += s;
    }
    if (e.error) {
      this.performanceMetrics.errors++;
      const s = new n(
        e.error.message,
        e.error.code
      );
      e.error.stack && (s.stack = e.error.stack), r.reject(s);
    } else
      r.resolve(e.result);
  }
  generateCallId() {
    return `rpc_${++this.callCounter}_${Date.now()}`;
  }
  call(e, r) {
    return console.log(`[WorkerRPC.call] Starting RPC call: ${e}`, r), new Promise((s, o) => {
      if (this.pendingCalls.size >= this.config.maxConcurrentOperations) {
        console.log(`[WorkerRPC.call] Rate limit exceeded for ${e}`), o(new n(
          `Too many concurrent operations (max: ${this.config.maxConcurrentOperations})`,
          "RATE_LIMIT"
        ));
        return;
      }
      const t = this.generateCallId(), l = Date.now();
      console.log(`[WorkerRPC.call] Generated call ID ${t} for method ${e}`);
      const c = setTimeout(() => {
        console.log(`[WorkerRPC.call] Timeout for call ${t} (${e})`), this.pendingCalls.delete(t), this.performanceMetrics.timeouts++, o(new n(
          `Operation timeout after ${this.config.operationTimeout}ms`,
          "TIMEOUT"
        ));
      }, this.config.operationTimeout);
      this.pendingCalls.set(t, {
        resolve: s,
        reject: o,
        timeout: c,
        startTime: l
      }), console.log(`[WorkerRPC.call] Stored pending call ${t}, sending message to worker`);
      const d = {
        id: t,
        method: e,
        params: r
      };
      try {
        this.worker.postMessage(d), console.log(`[WorkerRPC.call] Message posted for ${t}: ${e}`), this.log("debug", `RPC call: ${e}`, r);
      } catch (i) {
        console.log(`[WorkerRPC.call] Error posting message for ${t}:`, i), this.pendingCalls.delete(t), clearTimeout(c), o(new n(
          `Failed to send message: ${i instanceof Error ? i.message : String(i)}`,
          "SEND_ERROR"
        ));
      }
    });
  }
  rejectAllPending(e) {
    for (const [r, s] of this.pendingCalls)
      clearTimeout(s.timeout), s.reject(e);
    this.pendingCalls.clear();
  }
  log(e, r, ...s) {
    const o = { debug: 0, info: 1, warn: 2, error: 3 }, t = o[this.config.logLevel];
    o[e] >= t && console[e](`[WorkerRPC] ${r}`, ...s);
  }
  // DBWorkerAPI implementation
  async open(e) {
    return this.call("open", e);
  }
  async close() {
    const e = await this.call("close");
    return this.rejectAllPending(new n("Worker closed", "WORKER_CLOSED")), e;
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
    this.rejectAllPending(new n("Worker terminated", "TERMINATED")), this.worker.terminate();
  }
}
class R {
  constructor(e = {}) {
    this.handlers = /* @__PURE__ */ new Map(), this.config = { ...g, ...e }, this.setupMessageHandler();
  }
  setupMessageHandler() {
    self.onmessage = async (e) => {
      console.log("[WorkerRPCHandler] Received message:", e.data);
      const r = e.data;
      await this.handleMessage(r);
    };
  }
  async handleMessage(e) {
    const r = Date.now();
    let s;
    try {
      this.log("debug", `Handling method: ${e.method}`, e.params);
      const o = this.handlers.get(e.method);
      if (!o)
        throw new n(`Unknown method: ${e.method}`, "UNKNOWN_METHOD");
      const t = await o(e.params);
      console.log("[WorkerRPCHandler] Handler completed, result:", t), s = {
        id: e.id,
        result: t
      }, console.log("[WorkerRPCHandler] Prepared response:", s), this.log("debug", `Method ${e.method} completed in ${Date.now() - r}ms`);
    } catch (o) {
      this.log("error", `Method ${e.method} failed:`, o), s = {
        id: e.id,
        error: {
          message: o instanceof Error ? o.message : String(o),
          code: o instanceof n ? o.code : "UNKNOWN_ERROR",
          stack: o instanceof Error ? o.stack : void 0
        }
      };
    }
    try {
      console.log("[WorkerRPCHandler] Posting response:", s), self.postMessage(s), console.log("[WorkerRPCHandler] Response posted successfully");
    } catch (o) {
      this.log("error", "Failed to post response:", o);
      const t = {
        id: e.id,
        error: {
          message: "Failed to serialize response",
          code: "SERIALIZATION_ERROR"
        }
      };
      try {
        self.postMessage(t);
      } catch (l) {
        this.log("error", "Failed to send error response:", l);
      }
    }
  }
  register(e, r) {
    this.handlers.set(e, r), this.log("debug", `Registered handler for method: ${e}`);
  }
  unregister(e) {
    this.handlers.delete(e), this.log("debug", `Unregistered handler for method: ${e}`);
  }
  log(e, r, ...s) {
    const o = { debug: 0, info: 1, warn: 2, error: 3 }, t = o[this.config.logLevel];
    o[e] >= t && console[e](`[WorkerRPCHandler] ${r}`, ...s);
  }
}
function f(a, e) {
  const r = new Worker(a, { type: "module" });
  return new h(r, e);
}
export {
  m as D,
  p as O,
  u as V,
  n as W,
  h as a,
  R as b,
  f as c
};
//# sourceMappingURL=rpc-uwOhc_KU.mjs.map
