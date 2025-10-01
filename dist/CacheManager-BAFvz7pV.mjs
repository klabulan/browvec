let y = class extends Error {
  constructor(e, t, s) {
    super(e), this.code = t, this.details = s, this.name = "WorkerError";
  }
};
class Q extends y {
  constructor(e, t) {
    super(e, "DATABASE_ERROR"), this.sqliteCode = t, this.name = "DatabaseError";
  }
}
class J extends y {
  constructor(e) {
    super(e, "VECTOR_ERROR"), this.name = "VectorError";
  }
}
class Z extends y {
  constructor(e) {
    super(e, "OPFS_ERROR"), this.name = "OPFSError";
  }
}
const L = {
  maxConcurrentOperations: 10,
  operationTimeout: 3e4,
  // 30 seconds
  enablePerformanceMonitoring: !0,
  logLevel: "info"
};
class q {
  constructor(e, t = {}) {
    this.pendingCalls = /* @__PURE__ */ new Map(), this.callCounter = 0, this.performanceMetrics = {
      totalCalls: 0,
      totalTime: 0,
      errors: 0,
      timeouts: 0
    }, this.worker = e, this.config = { ...L, ...t }, this.setupWorkerListeners();
  }
  setupWorkerListeners() {
    this.worker.onmessage = (e) => {
      const t = e.data;
      if (t.type === "log") {
        const s = t.level;
        (console[s] || console.log)(t.message, ...t.args || []);
        return;
      }
      this.handleWorkerResponse(t);
    }, this.worker.onerror = (e) => {
      this.log("error", "Worker error:", e.message), this.rejectAllPending(new y("Worker error: " + e.message, "WORKER_ERROR"));
    }, this.worker.onmessageerror = (e) => {
      this.log("error", "Worker message error:", e), this.rejectAllPending(new y("Worker message error", "MESSAGE_ERROR"));
    };
  }
  handleWorkerResponse(e) {
    const t = this.pendingCalls.get(e.id);
    if (!t) {
      this.log("warn", "Received response for unknown call ID:", e.id);
      return;
    }
    if (this.pendingCalls.delete(e.id), clearTimeout(t.timeout), this.config.enablePerformanceMonitoring) {
      const s = Date.now() - t.startTime;
      this.performanceMetrics.totalCalls++, this.performanceMetrics.totalTime += s;
    }
    if (e.error) {
      this.performanceMetrics.errors++;
      const s = new y(
        e.error.message,
        e.error.code
      );
      e.error.stack && (s.stack = e.error.stack), t.reject(s);
    } else
      t.resolve(e.result);
  }
  generateCallId() {
    return `rpc_${++this.callCounter}_${Date.now()}`;
  }
  call(e, t) {
    return new Promise((s, r) => {
      if (this.pendingCalls.size >= this.config.maxConcurrentOperations) {
        this.log("error", `Rate limit exceeded for ${e}: ${this.pendingCalls.size}/${this.config.maxConcurrentOperations}`), r(new y(
          `Too many concurrent operations (max: ${this.config.maxConcurrentOperations})`,
          "RATE_LIMIT"
        ));
        return;
      }
      const i = this.generateCallId(), a = Date.now(), n = setTimeout(() => {
        this.log("error", `Operation timeout for ${e} after ${this.config.operationTimeout}ms`), this.pendingCalls.delete(i), this.performanceMetrics.timeouts++, r(new y(
          `Operation timeout after ${this.config.operationTimeout}ms`,
          "TIMEOUT"
        ));
      }, this.config.operationTimeout);
      this.pendingCalls.set(i, {
        resolve: s,
        reject: r,
        timeout: n,
        startTime: a
      });
      const o = {
        id: i,
        method: e,
        params: t
      };
      try {
        this.worker.postMessage(o);
      } catch (l) {
        this.log("error", `Failed to send RPC message for ${e}:`, l), this.pendingCalls.delete(i), clearTimeout(n), r(new y(
          `Failed to send message: ${l instanceof Error ? l.message : String(l)}`,
          "SEND_ERROR"
        ));
      }
    });
  }
  rejectAllPending(e) {
    for (const [t, s] of this.pendingCalls)
      clearTimeout(s.timeout), s.reject(e);
    this.pendingCalls.clear();
  }
  log(e, t, ...s) {
    const r = { debug: 0, info: 1, warn: 2, error: 3 }, i = r[this.config.logLevel];
    r[e] >= i && console[e](`[WorkerRPC] ${t}`, ...s);
  }
  // DBWorkerAPI implementation
  async open(e) {
    return this.call("open", e);
  }
  async close() {
    const e = await this.call("close");
    return this.rejectAllPending(new y("Worker closed", "WORKER_CLOSED")), e;
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
  // Collection management with embedding support
  async createCollection(e) {
    return this.call("createCollection", e);
  }
  async getCollectionEmbeddingStatus(e) {
    return this.call("getCollectionEmbeddingStatus", e);
  }
  // Document operations with embedding support
  async insertDocumentWithEmbedding(e) {
    return this.call("insertDocumentWithEmbedding", e);
  }
  // Search operations
  async searchSemantic(e) {
    return this.call("searchSemantic", e);
  }
  // Enhanced search API (Task 6.1)
  async searchText(e) {
    return this.call("searchText", e);
  }
  async searchAdvanced(e) {
    return this.call("searchAdvanced", e);
  }
  async searchGlobal(e) {
    return this.call("searchGlobal", e);
  }
  // Embedding generation operations
  async generateEmbedding(e) {
    return this.call("generateEmbedding", e);
  }
  async batchGenerateEmbeddings(e) {
    return this.call("batchGenerateEmbeddings", e);
  }
  async regenerateCollectionEmbeddings(e, t) {
    return this.call("regenerateCollectionEmbeddings", { collection: e, options: t });
  }
  // Embedding queue management
  async enqueueEmbedding(e) {
    return this.call("enqueueEmbedding", e);
  }
  async processEmbeddingQueue(e) {
    return this.call("processEmbeddingQueue", e);
  }
  async getQueueStatus(e) {
    return this.call("getQueueStatus", e);
  }
  async clearEmbeddingQueue(e) {
    return this.call("clearEmbeddingQueue", e);
  }
  // Task 6.2: Internal Embedding Pipeline RPC methods
  async generateQueryEmbedding(e) {
    return this.call("generateQueryEmbedding", e);
  }
  async batchGenerateQueryEmbeddings(e) {
    return this.call("batchGenerateQueryEmbeddings", e);
  }
  async warmEmbeddingCache(e) {
    return this.call("warmEmbeddingCache", e);
  }
  async clearEmbeddingCache(e) {
    return this.call("clearEmbeddingCache", e);
  }
  async getPipelineStats() {
    return this.call("getPipelineStats");
  }
  async getModelStatus() {
    return this.call("getModelStatus");
  }
  async preloadModels(e) {
    return this.call("preloadModels", e);
  }
  async optimizeModelMemory(e) {
    return this.call("optimizeModelMemory", e);
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
    this.rejectAllPending(new y("Worker terminated", "TERMINATED")), this.worker.terminate();
  }
}
class X {
  constructor(e = {}) {
    this.handlers = /* @__PURE__ */ new Map(), this.config = { ...L, ...e }, this.setupMessageHandler();
  }
  setupMessageHandler() {
    self.onmessage = async (e) => {
      const t = e.data;
      await this.handleMessage(t);
    };
  }
  async handleMessage(e) {
    let t;
    try {
      const s = this.handlers.get(e.method);
      if (!s)
        throw new y(`Unknown method: ${e.method}`, "UNKNOWN_METHOD");
      const r = await s(e.params);
      t = {
        id: e.id,
        result: r
      };
    } catch (s) {
      this.log("error", `Method ${e.method} failed:`, s), t = {
        id: e.id,
        error: {
          message: s instanceof Error ? s.message : String(s),
          code: s instanceof y ? s.code : "UNKNOWN_ERROR",
          stack: s instanceof Error ? s.stack : void 0
        }
      };
    }
    try {
      self.postMessage(t);
    } catch (s) {
      this.log("error", "Failed to post response:", s);
      const r = {
        id: e.id,
        error: {
          message: "Failed to serialize response",
          code: "SERIALIZATION_ERROR"
        }
      };
      try {
        self.postMessage(r);
      } catch (i) {
        this.log("error", "Failed to send error response:", i);
      }
    }
  }
  register(e, t) {
    this.handlers.set(e, t), this.log("debug", `Registered handler for method: ${e}`);
  }
  unregister(e) {
    this.handlers.delete(e), this.log("debug", `Unregistered handler for method: ${e}`);
  }
  log(e, t, ...s) {
    const r = { debug: 0, info: 1, warn: 2, error: 3 }, i = r[this.config.logLevel];
    r[e] >= i && console[e](`[WorkerRPCHandler] ${t}`, ...s);
  }
}
function Y(c, e) {
  const t = new Worker(c, { type: "module" });
  return new q(t, e);
}
class p extends Error {
  constructor(e, t = "EMBEDDING_ERROR", s = "unknown", r, i) {
    super(e), this.name = "EmbeddingError", this.code = t, this.category = s, this.context = r, this.recoveryInfo = i, this.timestamp = /* @__PURE__ */ new Date(), Object.setPrototypeOf(this, p.prototype);
  }
  /**
   * Создает JSON представление ошибки для логирования
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      category: this.category,
      context: this.context,
      recoveryInfo: this.recoveryInfo,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack
    };
  }
  /**
   * Создает пользовательски-дружественное сообщение об ошибке
   */
  getUserMessage() {
    switch (this.category) {
      case "provider":
        return `Ошибка провайдера эмбеддингов: ${this.message}`;
      case "network":
        return `Проблема с сетевым подключением: ${this.message}`;
      case "configuration":
        return `Ошибка конфигурации: ${this.message}`;
      case "validation":
        return `Неверные данные: ${this.message}`;
      case "quota":
        return `Превышен лимит: ${this.message}`;
      case "timeout":
        return `Превышено время ожидания: ${this.message}`;
      default:
        return this.message;
    }
  }
}
class f extends p {
  constructor(e, t, s = "PROVIDER_ERROR", r, i) {
    super(
      e,
      s,
      "provider",
      { ...i, providerName: t, modelVersion: r },
      {
        canRetry: !0,
        retryAfter: 1e3,
        maxRetries: 3,
        fallbackAvailable: !0
      }
    ), this.name = "ProviderError", this.providerName = t, this.modelVersion = r, Object.setPrototypeOf(this, f.prototype);
  }
}
class C extends f {
  constructor(e, t, s, r) {
    super(
      e,
      t,
      "PROVIDER_INIT_ERROR",
      void 0,
      { ...r, cause: s?.message }
    ), this.name = "ProviderInitializationError", this.recoveryInfo = {
      canRetry: !1,
      retryAfter: 0,
      maxRetries: 0,
      fallbackAvailable: !0,
      userActionRequired: !0,
      suggestedActions: [
        "Проверьте конфигурацию провайдера",
        "Убедитесь, что API ключ корректен",
        "Проверьте доступность сервиса"
      ]
    }, Object.setPrototypeOf(this, C.prototype);
  }
}
class D extends f {
  constructor(e, t, s, r, i) {
    super(
      e,
      t,
      "MODEL_LOAD_ERROR",
      void 0,
      { ...i, modelName: s, modelSize: r }
    ), this.name = "ModelLoadError", this.modelName = s, this.modelSize = r, Object.setPrototypeOf(this, D.prototype);
  }
}
class b extends p {
  constructor(e, t, s, r, i) {
    const a = `NETWORK_${t.toUpperCase()}_ERROR`, n = b.getRetryDelay(s, t);
    super(
      e,
      a,
      "network",
      { ...i, statusCode: s, url: r, networkType: t },
      {
        canRetry: b.isRetryable(s, t),
        retryAfter: n,
        maxRetries: 5,
        fallbackAvailable: !1
      }
    ), this.name = "NetworkError", this.statusCode = s, this.url = r, this.networkType = t, Object.setPrototypeOf(this, b.prototype);
  }
  /**
   * Определяет, можно ли повторить запрос
   */
  static isRetryable(e, t) {
    return t === "timeout" || t === "connection" ? !0 : e ? e >= 500 || e === 429 || e === 408 : !1;
  }
  /**
   * Вычисляет задержку перед повтором
   */
  static getRetryDelay(e, t) {
    return e === 429 ? 6e4 : t === "timeout" ? 5e3 : e && e >= 500 ? 2e3 : 1e3;
  }
}
class A extends p {
  constructor(e, t, s) {
    super(
      e,
      "AUTH_ERROR",
      "authentication",
      { ...s, authType: t },
      {
        canRetry: !1,
        retryAfter: 0,
        maxRetries: 0,
        fallbackAvailable: !1,
        userActionRequired: !0,
        suggestedActions: A.getSuggestedActions(t)
      }
    ), this.name = "AuthenticationError", this.authType = t, Object.setPrototypeOf(this, A.prototype);
  }
  static getSuggestedActions(e) {
    switch (e) {
      case "invalid_key":
        return ["Проверьте правильность API ключа", "Убедитесь, что ключ не истек"];
      case "expired_key":
        return ["Обновите API ключ", "Проверьте дату истечения подписки"];
      case "insufficient_permissions":
        return ["Проверьте права доступа", "Обратитесь к администратору"];
      case "quota_exceeded":
        return ["Проверьте лимиты использования", "Обновите тарифный план"];
      default:
        return ["Проверьте настройки аутентификации"];
    }
  }
}
class w extends p {
  constructor(e, t, s, r, i) {
    super(
      e,
      "CONFIG_ERROR",
      "configuration",
      { ...i, parameterName: t, expectedValue: s, actualValue: r },
      {
        canRetry: !1,
        retryAfter: 0,
        maxRetries: 0,
        fallbackAvailable: !1,
        userActionRequired: !0,
        suggestedActions: [
          `Исправьте параметр '${t}'`,
          s ? `Ожидается: ${s}` : "Проверьте документацию"
        ]
      }
    ), this.name = "ConfigurationError", this.parameterName = t, this.expectedValue = s, this.actualValue = r, Object.setPrototypeOf(this, w.prototype);
  }
}
class v extends p {
  constructor(e, t, s, r) {
    super(
      e,
      "VALIDATION_ERROR",
      "validation",
      { ...r, fieldName: t, validationRule: s },
      {
        canRetry: !1,
        retryAfter: 0,
        maxRetries: 0,
        fallbackAvailable: !1,
        userActionRequired: !0,
        suggestedActions: [`Исправьте поле '${t}' согласно правилу: ${s}`]
      }
    ), this.name = "ValidationError", this.fieldName = t, this.validationRule = s, Object.setPrototypeOf(this, v.prototype);
  }
}
class I extends p {
  constructor(e, t, s, r, i, a) {
    const n = i ? i.getTime() - Date.now() : 36e5;
    super(
      e,
      "QUOTA_EXCEEDED",
      "quota",
      { ...a, quotaType: t, currentValue: s, maxValue: r, resetTime: i },
      {
        canRetry: !0,
        retryAfter: Math.max(n, 0),
        maxRetries: 1,
        fallbackAvailable: t !== "api_calls",
        suggestedActions: I.getSuggestedActions(t, i)
      }
    ), this.name = "QuotaExceededError", this.quotaType = t, this.currentValue = s, this.maxValue = r, this.resetTime = i, Object.setPrototypeOf(this, I.prototype);
  }
  static getSuggestedActions(e, t) {
    const s = [`Превышен лимит: ${e}`];
    switch (t && s.push(`Лимит будет сброшен: ${t.toLocaleString()}`), e) {
      case "api_calls":
        s.push("Подождите до сброса лимита или обновите тариф");
        break;
      case "tokens":
        s.push("Сократите размер текста или разбейте на части");
        break;
      case "memory":
        s.push("Очистите кэш или используйте меньшую модель");
        break;
      case "concurrent_requests":
        s.push("Дождитесь завершения текущих запросов");
        break;
    }
    return s;
  }
}
class x extends p {
  constructor(e, t, s, r) {
    super(
      e,
      "TIMEOUT_ERROR",
      "timeout",
      { ...r, timeoutMs: t, operation: s },
      {
        canRetry: !0,
        retryAfter: Math.min(t * 0.5, 5e3),
        // Половина от таймаута, но не более 5 сек
        maxRetries: 3,
        fallbackAvailable: !0,
        suggestedActions: [
          "Увеличьте таймаут в настройках",
          "Проверьте размер обрабатываемых данных",
          "Попробуйте разбить операцию на части"
        ]
      }
    ), this.name = "TimeoutError", this.timeoutMs = t, this.operation = s, Object.setPrototypeOf(this, x.prototype);
  }
}
class P extends p {
  constructor(e, t, s, r) {
    super(
      e,
      "CACHE_ERROR",
      "cache",
      { ...r, cacheOperation: t, cacheKey: s },
      {
        canRetry: t !== "write",
        // Записи обычно не повторяем
        retryAfter: 1e3,
        maxRetries: 2,
        fallbackAvailable: !0
        // Можно работать без кэша
      }
    ), this.name = "CacheError", this.cacheOperation = t, this.cacheKey = s, Object.setPrototypeOf(this, P.prototype);
  }
}
class k extends p {
  constructor(e, t, s, r) {
    super(
      e,
      "WORKER_ERROR",
      "worker",
      { ...r, workerOperation: t, workerId: s },
      {
        canRetry: !0,
        retryAfter: 2e3,
        maxRetries: 3,
        fallbackAvailable: !1,
        suggestedActions: [
          "Перезагрузите страницу",
          "Проверьте поддержку Web Workers в браузере"
        ]
      }
    ), this.name = "WorkerError", this.workerId = s, this.workerOperation = t, Object.setPrototypeOf(this, k.prototype);
  }
}
class B {
  constructor(e, t, s = 32, r = 512) {
    this._isReady = !1, this.name = e, this.dimensions = t, this.maxBatchSize = s, this.maxTextLength = r, this.metrics = {
      totalEmbeddings: 0,
      averageGenerationTime: 0,
      errorCount: 0,
      metricsResetTime: /* @__PURE__ */ new Date()
    };
  }
  get isReady() {
    return this._isReady;
  }
  /**
   * Валидация конфигурации провайдера
   *
   * @param config - Конфигурация для валидации
   * @returns Результат валидации
   */
  validateConfig(e) {
    const t = [], s = [], r = [];
    return !e.provider && !e.defaultProvider && t.push("Provider type is required"), e.timeout && e.timeout < 1e3 && (s.push("Timeout less than 1 second may cause frequent timeouts"), r.push("Consider increasing timeout to at least 5000ms")), e.batchSize && e.batchSize > this.maxBatchSize && (t.push(`Batch size ${e.batchSize} exceeds maximum ${this.maxBatchSize}`), r.push(`Set batch size to ${this.maxBatchSize} or less`)), {
      isValid: t.length === 0,
      errors: t,
      warnings: s,
      suggestions: r
    };
  }
  /**
   * Валидация входного текста
   *
   * @param text - Текст для валидации
   * @throws {EmbeddingError} При невалидном тексте
   */
  validateText(e) {
    if (!e || typeof e != "string")
      throw new p("Input text must be a non-empty string");
    if (e.trim().length === 0)
      throw new p("Input text cannot be empty or whitespace only");
    const t = e.length / 4;
    if (t > this.maxTextLength)
      throw new p(
        `Text too long: ~${Math.round(t)} tokens, max: ${this.maxTextLength}`
      );
  }
  /**
   * Валидация массива текстов для пакетной обработки
   *
   * @param texts - Массив текстов для валидации
   * @throws {EmbeddingError} При невалидных данных
   */
  validateBatch(e) {
    if (!Array.isArray(e))
      throw new p("Input must be an array of strings");
    if (e.length === 0)
      throw new p("Batch cannot be empty");
    if (e.length > this.maxBatchSize)
      throw new p(
        `Batch size ${e.length} exceeds maximum ${this.maxBatchSize}`
      );
    e.forEach((t, s) => {
      try {
        this.validateText(t);
      } catch (r) {
        throw new p(
          `Invalid text at index ${s}: ${r instanceof Error ? r.message : "Unknown error"}`
        );
      }
    });
  }
  /**
   * Обновление метрик производительности
   *
   * @param generationTime - Время генерации в миллисекундах
   * @param embeddingCount - Количество сгенерированных эмбеддингов
   * @param isError - Была ли ошибка
   */
  updateMetrics(e, t = 1, s = !1) {
    if (s) {
      this.metrics.errorCount += 1;
      return;
    }
    const r = this.metrics.averageGenerationTime * this.metrics.totalEmbeddings;
    this.metrics.totalEmbeddings += t, this.metrics.averageGenerationTime = (r + e) / this.metrics.totalEmbeddings;
  }
  /**
   * Сброс метрик производительности
   */
  resetMetrics() {
    this.metrics = {
      totalEmbeddings: 0,
      averageGenerationTime: 0,
      errorCount: 0,
      metricsResetTime: /* @__PURE__ */ new Date()
    };
  }
  getMetrics() {
    return { ...this.metrics };
  }
}
class ee {
  /**
   * Нормализация вектора эмбеддинга
   *
   * @param embedding - Вектор для нормализации
   * @returns Нормализованный вектор
   */
  static normalizeEmbedding(e) {
    let t = 0;
    for (let r = 0; r < e.length; r++)
      t += e[r] * e[r];
    if (t = Math.sqrt(t), t === 0)
      throw new p("Cannot normalize zero vector");
    const s = new Float32Array(e.length);
    for (let r = 0; r < e.length; r++)
      s[r] = e[r] / t;
    return s;
  }
  /**
   * Вычисление косинусного расстояния между векторами
   *
   * @param a - Первый вектор
   * @param b - Второй вектор
   * @returns Косинусное расстояние (0 = идентичные, 2 = противоположные)
   */
  static cosineDistance(e, t) {
    if (e.length !== t.length)
      throw new p("Vectors must have the same dimensions");
    let s = 0, r = 0, i = 0;
    for (let n = 0; n < e.length; n++)
      s += e[n] * t[n], r += e[n] * e[n], i += t[n] * t[n];
    return r = Math.sqrt(r), i = Math.sqrt(i), r === 0 || i === 0 ? 2 : 1 - s / (r * i);
  }
  /**
   * Создание случайного вектора (для тестирования)
   *
   * @param dimensions - Размерность вектора
   * @param normalize - Нормализовать ли вектор
   * @returns Случайный вектор
   */
  static createRandomEmbedding(e, t = !0) {
    const s = new Float32Array(e);
    for (let r = 0; r < e; r++)
      s[r] = Math.random() * 2 - 1;
    return t ? this.normalizeEmbedding(s) : s;
  }
}
class R extends B {
  constructor(e, t, s = 16, r = 8192) {
    super(e, t, s, r), this.requestQueue = [], this.isProcessingQueue = !1, this.lastRequestTime = 0, this.retryStates = /* @__PURE__ */ new Map();
  }
  static {
    this.DEFAULT_CONFIG = {
      timeout: 3e4,
      maxRetries: 3,
      enableRateLimit: !0,
      requestsPerMinute: 60
    };
  }
  /**
   * Инициализация внешнего провайдера
   */
  async initialize(e) {
    const t = this.validateConfig(e);
    if (!t.isValid)
      throw new f(
        `Configuration validation failed: ${t.errors.join(", ")}`,
        this.name,
        "CONFIG_VALIDATION_ERROR"
      );
    if (!e.apiKey)
      throw new A(
        "API key is required for external providers",
        "invalid_key",
        { provider: this.name }
      );
    this.config = {
      ...R.DEFAULT_CONFIG,
      ...e,
      apiKey: e.apiKey,
      baseUrl: e.providerOptions?.baseUrl,
      timeout: e.timeout || R.DEFAULT_CONFIG.timeout,
      maxRetries: e.maxRetries || R.DEFAULT_CONFIG.maxRetries,
      enableRateLimit: e.providerOptions?.enableRateLimit ?? R.DEFAULT_CONFIG.enableRateLimit,
      requestsPerMinute: e.providerOptions?.requestsPerMinute || R.DEFAULT_CONFIG.requestsPerMinute,
      headers: e.providerOptions?.headers || {}
    }, this.config?.enableRateLimit && this.initializeRateLimit(), await this.initializeProvider(this.config);
    const s = await this.healthCheck();
    if (!s.isHealthy)
      throw new f(
        `Provider health check failed: ${s.details}`,
        this.name,
        "HEALTH_CHECK_FAILED"
      );
    this._isReady = !0;
  }
  /**
   * Генерация одного эмбеддинга с retry логикой
   */
  async generateEmbedding(e) {
    this.validateText(e);
    const t = Date.now();
    let s = null;
    const r = this.config?.maxRetries || 3;
    for (let i = 1; i <= r; i++)
      try {
        await this.waitForRateLimit();
        const a = await this.executeEmbeddingRequest([e]), n = Date.now() - t;
        return this.updateMetrics(n, 1, !1), this.updateApiMetrics(1, !0), a[0];
      } catch (a) {
        if (s = a, i < r && this.shouldRetry(a)) {
          const n = this.calculateRetryDelay(i, a);
          await this.sleep(n);
          continue;
        }
        throw this.updateMetrics(Date.now() - t, 0, !0), this.updateApiMetrics(1, !1), this.wrapError(a);
      }
    throw this.wrapError(s || new Error("Unknown error during embedding generation"));
  }
  /**
   * Пакетная генерация эмбеддингов
   */
  async generateBatch(e) {
    this.validateBatch(e);
    const t = Date.now();
    let s = null;
    const r = this.config?.maxRetries || 3;
    for (let i = 1; i <= r; i++)
      try {
        await this.waitForRateLimit();
        const a = await this.executeEmbeddingRequest(e), n = Date.now() - t;
        return this.updateMetrics(n, e.length, !1), this.updateApiMetrics(1, !0), a;
      } catch (a) {
        if (s = a, i < r && this.shouldRetry(a)) {
          const n = this.calculateRetryDelay(i, a);
          await this.sleep(n);
          continue;
        }
        throw this.updateMetrics(Date.now() - t, 0, !0), this.updateApiMetrics(1, !1), this.wrapError(a);
      }
    throw this.wrapError(s || new Error("Unknown error during batch embedding generation"));
  }
  /**
   * Проверка здоровья провайдера
   */
  async healthCheck() {
    try {
      if (!this.config)
        return {
          isHealthy: !1,
          status: "error",
          details: "Provider not initialized",
          connectionStatus: "disconnected"
        };
      const e = await this.checkProviderHealth();
      return {
        isHealthy: e,
        status: e ? "ready" : "error",
        lastSuccessfulOperation: this.getLastSuccessfulOperation(),
        connectionStatus: e ? "connected" : "disconnected",
        details: e ? "Provider is healthy" : "Provider health check failed"
      };
    } catch (e) {
      return {
        isHealthy: !1,
        status: "error",
        details: e instanceof Error ? e.message : "Unknown health check error",
        connectionStatus: "disconnected"
      };
    }
  }
  /**
   * Получение метрик с информацией об API
   */
  getMetrics() {
    return {
      ...super.getMetrics(),
      apiRequestCount: this.getApiRequestCount(),
      rateLimitStatus: this.rateLimitInfo ? {
        remaining: this.rateLimitInfo.remaining,
        resetTime: this.rateLimitInfo.resetTime
      } : void 0
    };
  }
  /**
   * Очистка ресурсов
   */
  async cleanup() {
    this.requestQueue = [], this.isProcessingQueue = !1, this.retryStates.clear(), this._isReady = !1, await this.cleanupProvider();
  }
  // Приватные методы для управления rate limiting и retry логикой
  /**
   * Инициализация rate limiting
   */
  initializeRateLimit() {
    const e = this.config?.requestsPerMinute || 60;
    this.rateLimitInfo = {
      remaining: e,
      resetTime: new Date(Date.now() + 6e4),
      // Сброс через минуту
      limit: e
    };
  }
  /**
   * Ожидание rate limit
   */
  async waitForRateLimit() {
    if (!(!this.config?.enableRateLimit || !this.rateLimitInfo)) {
      if (Date.now() >= this.rateLimitInfo.resetTime.getTime() && (this.rateLimitInfo.remaining = this.rateLimitInfo.limit, this.rateLimitInfo.resetTime = new Date(Date.now() + 6e4)), this.rateLimitInfo.remaining <= 0) {
        const e = this.rateLimitInfo.resetTime.getTime() - Date.now();
        e > 0 && (await this.sleep(e), this.rateLimitInfo.remaining = this.rateLimitInfo.limit, this.rateLimitInfo.resetTime = new Date(Date.now() + 6e4));
      }
      this.rateLimitInfo.remaining--;
    }
  }
  /**
   * Проверка, можно ли повторить запрос после ошибки
   */
  shouldRetry(e) {
    return e instanceof A || e instanceof p && e.category === "configuration" ? !1 : e instanceof b ? e.recoveryInfo?.canRetry ?? !1 : e instanceof I || e instanceof x;
  }
  /**
   * Вычисление задержки для retry с exponential backoff
   */
  calculateRetryDelay(e, t) {
    let s = 1e3;
    if (t instanceof I && t.resetTime)
      return Math.max(t.resetTime.getTime() - Date.now(), 0);
    t instanceof b && (s = t.recoveryInfo?.retryAfter || 2e3), t instanceof x && (s = Math.min(t.timeoutMs * 0.5, 5e3));
    const r = Math.pow(2, e - 1) * s, i = Math.random() * 1e3;
    return Math.min(r + i, 3e4);
  }
  /**
   * Обертывание ошибок в специфичные типы
   */
  wrapError(e) {
    return e instanceof p ? e : e.message.includes("401") || e.message.includes("Unauthorized") ? new A(
      "Invalid API key or unauthorized access",
      "invalid_key",
      { provider: this.name, originalError: e.message }
    ) : e.message.includes("429") || e.message.includes("rate limit") ? new I(
      "API rate limit exceeded",
      "api_calls",
      0,
      this.rateLimitInfo?.limit || 0,
      this.rateLimitInfo?.resetTime,
      { provider: this.name, originalError: e.message }
    ) : e.message.includes("timeout") || e.name === "TimeoutError" ? new x(
      "Request timeout",
      this.config?.timeout || 3e4,
      "embedding_generation",
      { provider: this.name, originalError: e.message }
    ) : e.message.includes("fetch") || e.message.includes("network") ? new b(
      e.message,
      "connection",
      void 0,
      void 0,
      { provider: this.name }
    ) : new f(
      e.message,
      this.name,
      "UNKNOWN_PROVIDER_ERROR",
      void 0,
      { originalError: e.message, stack: e.stack }
    );
  }
  /**
   * Обновление метрик API запросов
   */
  updateApiMetrics(e, t) {
    this.metrics.apiRequestCount || (this.metrics.apiRequestCount = 0), this.metrics.apiRequestCount += e, t && (this.metrics.lastSuccessfulOperation = /* @__PURE__ */ new Date());
  }
  /**
   * Получение количества API запросов
   */
  getApiRequestCount() {
    return this.metrics.apiRequestCount || 0;
  }
  /**
   * Получение времени последней успешной операции
   */
  getLastSuccessfulOperation() {
    return this.metrics.lastSuccessfulOperation;
  }
  /**
   * Утилита для задержки
   */
  sleep(e) {
    return new Promise((t) => setTimeout(t, e));
  }
}
const M = {
  "text-embedding-3-small": {
    name: "text-embedding-3-small",
    maxInputTokens: 8191,
    defaultDimensions: 1536,
    supportedDimensions: [384, 768, 1536],
    costPer1MTokens: 0.02
    // USD
  },
  "text-embedding-3-large": {
    name: "text-embedding-3-large",
    maxInputTokens: 8191,
    defaultDimensions: 3072,
    supportedDimensions: [256, 512, 1024, 3072],
    costPer1MTokens: 0.13
    // USD
  },
  "text-embedding-ada-002": {
    name: "text-embedding-ada-002",
    maxInputTokens: 8191,
    defaultDimensions: 1536,
    supportedDimensions: [1536],
    costPer1MTokens: 0.1
    // USD
  }
};
class E extends R {
  /**
   * Создание экземпляра OpenAI провайдера
   *
   * @param dimensions - Размерность векторов эмбеддингов
   * @param model - Модель OpenAI (по умолчанию text-embedding-3-small)
   */
  constructor(e, t = "text-embedding-3-small") {
    if (!(t in M))
      throw new w(
        `Unsupported OpenAI model: ${t}`,
        "model",
        `One of: ${Object.keys(M).join(", ")}`,
        t
      );
    const s = M[t];
    if (!s.supportedDimensions.includes(e))
      throw new w(
        `Unsupported dimensions ${e} for model ${t}`,
        "dimensions",
        `One of: ${s.supportedDimensions.join(", ")}`,
        e
      );
    super(
      "openai",
      e,
      100,
      // OpenAI поддерживает большие батчи
      s.maxInputTokens * 4
      // Приблизительно 4 символа на токен
    ), this.model = t, this.supportedDimensions = [...s.supportedDimensions], this.maxInputTokens = s.maxInputTokens;
  }
  /**
   * Инициализация OpenAI провайдера
   */
  async initializeProvider(e) {
    if (this.openaiConfig = {
      ...e,
      model: this.model,
      dimensions: this.dimensions,
      baseUrl: e.baseUrl || "https://api.openai.com/v1",
      organization: e.headers?.["OpenAI-Organization"],
      user: e.headers?.["OpenAI-User"]
    }, !this.openaiConfig.apiKey.startsWith("sk-"))
      throw new A(
        'Invalid OpenAI API key format. Must start with "sk-"',
        "invalid_key",
        { provider: this.name }
      );
    try {
      await this.executeEmbeddingRequest(["test"]);
    } catch (t) {
      if (t instanceof A)
        throw t;
      console.warn(`OpenAI provider test request failed: ${t}`);
    }
  }
  /**
   * Выполнение запроса к OpenAI API для генерации эмбеддингов
   */
  async executeEmbeddingRequest(e) {
    if (!this.openaiConfig)
      throw new f(
        "Provider not initialized",
        this.name,
        "PROVIDER_NOT_INITIALIZED"
      );
    const t = {
      model: this.openaiConfig.model || this.model,
      input: e,
      encoding_format: "float"
    }, s = M[this.model];
    this.dimensions !== s.defaultDimensions && (t.dimensions = this.dimensions), this.openaiConfig.user && (t.user = this.openaiConfig.user);
    const r = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.openaiConfig.apiKey}`,
      "User-Agent": "LocalRetrieve/1.0.0"
    };
    this.openaiConfig.organization && (r["OpenAI-Organization"] = this.openaiConfig.organization), this.openaiConfig.headers && Object.assign(r, this.openaiConfig.headers);
    const i = `${this.openaiConfig.baseUrl}/embeddings`;
    try {
      const a = new AbortController(), n = setTimeout(() => {
        a.abort();
      }, this.openaiConfig.timeout), o = await fetch(i, {
        method: "POST",
        headers: r,
        body: JSON.stringify(t),
        signal: a.signal
      });
      clearTimeout(n);
      const l = await o.json();
      if (!o.ok)
        throw this.createErrorFromResponse(o.status, l);
      return this.processSuccessfulResponse(l);
    } catch (a) {
      throw a instanceof Error && a.name === "AbortError" ? new b(
        `Request timeout after ${this.openaiConfig.timeout}ms`,
        "timeout",
        void 0,
        i
      ) : a instanceof TypeError && a.message.includes("fetch") ? new b(
        "Network connection failed",
        "connection",
        void 0,
        i
      ) : a;
    }
  }
  /**
   * Проверка здоровья OpenAI провайдера
   */
  async checkProviderHealth() {
    try {
      return await this.executeEmbeddingRequest(["health check"]), !0;
    } catch (e) {
      return console.warn(`OpenAI provider health check failed: ${e}`), !1;
    }
  }
  /**
   * Очистка ресурсов OpenAI провайдера
   */
  async cleanupProvider() {
    this.openaiConfig = void 0;
  }
  /**
   * Получение информации о поддерживаемых моделях
   */
  static getAvailableModels() {
    return Object.entries(M).map(([e, t]) => ({
      id: e,
      name: t.name,
      description: `OpenAI ${t.name} embedding model`,
      dimensions: t.defaultDimensions,
      supportedDimensions: t.supportedDimensions,
      maxInputLength: t.maxInputTokens,
      languages: ["en", "es", "fr", "de", "it", "pt", "ru", "ja", "ko", "zh"],
      useCases: ["semantic search", "classification", "clustering", "similarity"],
      costPerToken: t.costPer1MTokens / 1e6
    }));
  }
  /**
   * Создание специфичной ошибки на основе ответа API
   */
  createErrorFromResponse(e, t) {
    const s = t.error?.message || "Unknown OpenAI API error", r = t.error?.type || "unknown", i = t.error?.code || "unknown";
    switch (e) {
      case 401:
        return new A(
          `OpenAI API authentication failed: ${s}`,
          "invalid_key",
          { provider: this.name, errorType: r, errorCode: i }
        );
      case 429:
        return s.includes("quota") || s.includes("billing") ? new I(
          `OpenAI API quota exceeded: ${s}`,
          "api_calls",
          0,
          0,
          void 0,
          { provider: this.name, errorType: r, errorCode: i }
        ) : new I(
          `OpenAI API rate limit exceeded: ${s}`,
          "api_calls",
          0,
          0,
          new Date(Date.now() + 6e4),
          // Retry after 1 minute
          { provider: this.name, errorType: r, errorCode: i }
        );
      case 400:
        return s.includes("dimensions") || s.includes("model") ? new w(
          `OpenAI API configuration error: ${s}`,
          t.error?.param || "unknown",
          void 0,
          void 0,
          { provider: this.name, errorType: r, errorCode: i }
        ) : new v(
          `OpenAI API validation error: ${s}`,
          t.error?.param || "input",
          "OpenAI API validation",
          { provider: this.name, errorType: r, errorCode: i }
        );
      case 500:
      case 502:
      case 503:
      case 504:
        return new b(
          `OpenAI API server error: ${s}`,
          "server_error",
          e,
          void 0,
          { provider: this.name, errorType: r, errorCode: i }
        );
      default:
        return new f(
          `OpenAI API error (${e}): ${s}`,
          this.name,
          "OPENAI_API_ERROR",
          void 0,
          { status: e, errorType: r, errorCode: i }
        );
    }
  }
  /**
   * Обработка успешного ответа от OpenAI API
   */
  processSuccessfulResponse(e) {
    if (!e.data || !Array.isArray(e.data))
      throw new f(
        "Invalid response format from OpenAI API",
        this.name,
        "INVALID_RESPONSE_FORMAT"
      );
    return e.data.sort((s, r) => s.index - r.index).map((s, r) => {
      if (!s.embedding || !Array.isArray(s.embedding))
        throw new f(
          `Invalid embedding format at index ${r}`,
          this.name,
          "INVALID_EMBEDDING_FORMAT"
        );
      if (s.embedding.length !== this.dimensions)
        throw new f(
          `Embedding dimension mismatch: expected ${this.dimensions}, got ${s.embedding.length}`,
          this.name,
          "DIMENSION_MISMATCH"
        );
      return new Float32Array(s.embedding);
    });
  }
  /**
   * Валидация конфигурации для OpenAI провайдера
   */
  validateConfig(e) {
    const t = super.validateConfig(e), s = [...t.errors], r = [...t.warnings], i = [...t.suggestions];
    e.apiKey ? e.apiKey.startsWith("sk-") || (r.push('OpenAI API key should start with "sk-"'), i.push("Verify API key format")) : (s.push("OpenAI API key is required"), i.push("Set apiKey in configuration"));
    const a = e.providerOptions?.model || this.model;
    if (a in M) {
      const n = M[a];
      n.supportedDimensions.includes(this.dimensions) || (s.push(`Model ${a} does not support ${this.dimensions} dimensions`), i.push(`Use one of: ${n.supportedDimensions.join(", ")}`));
    }
    return e.batchSize && e.batchSize > this.maxBatchSize && (r.push(`Batch size ${e.batchSize} may be inefficient for OpenAI API`), i.push(`Consider using batch size of ${Math.min(this.maxBatchSize, 50)} or less`)), {
      isValid: s.length === 0,
      errors: s,
      warnings: r,
      suggestions: i
    };
  }
}
function te(c, e = "text-embedding-3-small") {
  return new E(c, e);
}
function $(c, e) {
  return c in M ? M[c].supportedDimensions.includes(e) : !1;
}
function _(c) {
  const { dimensions: e = 384, budget: t = "medium", performance: s = "balanced" } = c;
  return t === "low" || s === "fast" ? {
    model: "text-embedding-3-small",
    dimensions: Math.min(e, 384),
    description: "Cost-effective option with good performance for most use cases"
  } : (t === "high" || s === "accurate") && e <= 1024 ? {
    model: "text-embedding-3-large",
    dimensions: e <= 256 ? 256 : e <= 512 ? 512 : 1024,
    description: "High-accuracy model for demanding applications"
  } : {
    model: "text-embedding-3-small",
    dimensions: e <= 384 ? 384 : e <= 768 ? 768 : 1536,
    description: "Balanced option providing good accuracy and reasonable cost"
  };
}
class F extends B {
  constructor(e = {
    defaultProvider: "transformers",
    defaultDimensions: 384
  }) {
    super(
      "transformers",
      384,
      // Фиксированная размерность для all-MiniLM-L6-v2
      e.batchSize || 16,
      // Оптимальный размер батча для локальной модели
      512
      // Максимальная длина текста в токенах
    ), this.pendingRequests = /* @__PURE__ */ new Map(), this.messageCounter = 0, this.performanceMetrics = {
      modelLoadTime: 0,
      averageBatchSize: 0,
      totalBatches: 0,
      memoryPeak: 0,
      lastCleanup: /* @__PURE__ */ new Date()
    }, this.config = {
      workerScript: "/src/embedding/workers/transformers-worker.js",
      modelLoadTimeout: 3e4,
      // 30 секунд на загрузку модели
      operationTimeout: 1e4,
      // 10 секунд на операцию
      batchSize: 16,
      enableLogging: !1,
      modelPath: "Xenova/all-MiniLM-L6-v2",
      enableModelCache: !0,
      ...e
    };
  }
  /**
   * Инициализация провайдера и загрузка модели
   */
  async initialize(e) {
    return this.initializationPromise ? this.initializationPromise : (this.initializationPromise = this._initialize(e), this.initializationPromise);
  }
  async _initialize(e) {
    try {
      if (this.config = { ...this.config, ...e }, !window.Worker)
        throw new C(
          "Web Workers не поддерживаются в данном браузере",
          this.name,
          void 0,
          { userAgent: navigator.userAgent }
        );
      await this.createWorker();
      const t = Date.now();
      await this.sendMessage("initialize", {
        modelPath: this.config.modelPath,
        enableCache: this.config.enableModelCache,
        enableLogging: this.config.enableLogging
      }, this.config.modelLoadTimeout), this.performanceMetrics.modelLoadTime = Date.now() - t, this._isReady = !0, this.config.enableLogging && console.log(`[TransformersProvider] Модель загружена за ${this.performanceMetrics.modelLoadTime}ms`);
    } catch (t) {
      throw this._isReady = !1, t instanceof Error ? new C(
        `Ошибка инициализации Transformers.js провайдера: ${t.message}`,
        this.name,
        t,
        { config: this.config }
      ) : new C(
        "Неизвестная ошибка при инициализации провайдера",
        this.name,
        void 0,
        { config: this.config }
      );
    }
  }
  /**
   * Создание и настройка Web Worker
   */
  async createWorker() {
    try {
      const e = this.config.workerScript?.startsWith("/") ? this.config.workerScript : "/src/embedding/workers/transformers-worker.js";
      this.worker = new Worker(e, {
        type: "module",
        name: "TransformersEmbeddingWorker"
      }), this.worker.onmessage = (t) => {
        this.handleWorkerMessage(t.data);
      }, this.worker.onerror = (t) => {
        console.error("[TransformersProvider] Worker error:", t), this.handleWorkerError(new Error(`Worker error: ${t.message}`));
      }, this.worker.onmessageerror = (t) => {
        console.error("[TransformersProvider] Worker message error:", t), this.handleWorkerError(new Error("Worker message parsing error"));
      };
    } catch (e) {
      throw new k(
        `Не удалось создать Web Worker: ${e instanceof Error ? e.message : "Unknown error"}`,
        "create",
        void 0,
        { workerScript: this.config.workerScript }
      );
    }
  }
  /**
   * Генерация эмбеддинга для одного текста
   */
  async generateEmbedding(e) {
    if (this.validateText(e), !this._isReady)
      throw new f(
        "Провайдер не инициализирован. Вызовите initialize() перед использованием.",
        this.name,
        "NOT_INITIALIZED"
      );
    const t = Date.now();
    try {
      const s = await this.sendMessage("generateEmbedding", {
        text: e.trim()
      }, this.config.operationTimeout), r = Date.now() - t;
      this.updateMetrics(r, 1, !1);
      const i = new Float32Array(s.embedding);
      if (i.length !== this.dimensions)
        throw new f(
          `Неверная размерность эмбеддинга: получено ${i.length}, ожидалось ${this.dimensions}`,
          this.name,
          "INVALID_DIMENSIONS"
        );
      return i;
    } catch (s) {
      const r = Date.now() - t;
      throw this.updateMetrics(r, 1, !0), s instanceof Error ? s : new f(
        `Ошибка генерации эмбеддинга: ${s}`,
        this.name,
        "GENERATION_ERROR",
        void 0,
        { text: e.substring(0, 100) + "..." }
      );
    }
  }
  /**
   * Пакетная генерация эмбеддингов
   */
  async generateBatch(e) {
    if (this.validateBatch(e), !this._isReady)
      throw new f(
        "Провайдер не инициализирован. Вызовите initialize() перед использованием.",
        this.name,
        "NOT_INITIALIZED"
      );
    const t = Date.now();
    try {
      const s = [], r = this.maxBatchSize;
      for (let a = 0; a < e.length; a += r) {
        const n = e.slice(a, a + r), o = await this.processBatchChunk(n);
        s.push(...o);
      }
      const i = Date.now() - t;
      return this.updateMetrics(i, e.length, !1), this.performanceMetrics.totalBatches += 1, this.performanceMetrics.averageBatchSize = (this.performanceMetrics.averageBatchSize * (this.performanceMetrics.totalBatches - 1) + e.length) / this.performanceMetrics.totalBatches, s;
    } catch (s) {
      const r = Date.now() - t;
      throw this.updateMetrics(r, e.length, !0), s instanceof Error ? s : new f(
        `Ошибка пакетной генерации эмбеддингов: ${s}`,
        this.name,
        "BATCH_GENERATION_ERROR",
        void 0,
        { batchSize: e.length }
      );
    }
  }
  /**
   * Обработка части батча
   */
  async processBatchChunk(e) {
    return (await this.sendMessage("generateBatch", {
      texts: e.map((s) => s.trim())
    }, this.config.operationTimeout * Math.ceil(e.length / 4))).embeddings.map((s) => {
      const r = new Float32Array(s);
      if (r.length !== this.dimensions)
        throw new f(
          `Неверная размерность эмбеддинга: получено ${r.length}, ожидалось ${this.dimensions}`,
          this.name,
          "INVALID_DIMENSIONS"
        );
      return r;
    });
  }
  /**
   * Очистка ресурсов и завершение работы провайдера
   */
  async cleanup() {
    try {
      for (const [e, t] of this.pendingRequests)
        t.timeout && clearTimeout(t.timeout), t.reject(new Error("Provider cleanup - request cancelled"));
      if (this.pendingRequests.clear(), this.worker && this._isReady)
        try {
          await this.sendMessage("cleanup", {}, 5e3);
        } catch (e) {
          console.warn("[TransformersProvider] Cleanup warning:", e);
        }
      this.worker && (this.worker.terminate(), this.worker = void 0), this._isReady = !1, this.initializationPromise = void 0, this.performanceMetrics.lastCleanup = /* @__PURE__ */ new Date(), this.config.enableLogging && console.log("[TransformersProvider] Провайдер очищен");
    } catch (e) {
      throw new f(
        `Ошибка при очистке провайдера: ${e instanceof Error ? e.message : "Unknown error"}`,
        this.name,
        "CLEANUP_ERROR"
      );
    }
  }
  /**
   * Проверка здоровья провайдера
   */
  async healthCheck() {
    try {
      if (!this.worker || !this._isReady)
        return {
          isHealthy: !1,
          status: "error",
          details: "Провайдер не инициализирован или воркер недоступен",
          connectionStatus: "disconnected"
        };
      const e = Date.now(), t = await this.sendMessage("healthCheck", {}, 5e3), s = Date.now() - e;
      return {
        isHealthy: !0,
        lastSuccessfulOperation: /* @__PURE__ */ new Date(),
        status: "ready",
        details: `Воркер отвечает за ${s}ms`,
        availableMemory: t.memoryInfo?.availableMemory,
        connectionStatus: "connected"
      };
    } catch (e) {
      return {
        isHealthy: !1,
        status: "degraded",
        details: `Ошибка проверки здоровья: ${e instanceof Error ? e.message : "Unknown error"}`,
        connectionStatus: "limited"
      };
    }
  }
  /**
   * Получение расширенных метрик производительности
   */
  getMetrics() {
    return {
      ...super.getMetrics(),
      memoryUsage: this.performanceMetrics.memoryPeak,
      apiRequestCount: void 0,
      // Не применимо для локального провайдера
      rateLimitStatus: void 0
      // Не применимо для локального провайдера
    };
  }
  /**
   * Получение специфичных для Transformers.js метрик
   */
  getTransformersMetrics() {
    return {
      ...this.performanceMetrics,
      isModelLoaded: this._isReady,
      workerActive: !!this.worker,
      pendingRequests: this.pendingRequests.size
    };
  }
  /**
   * Отправка сообщения воркеру с обработкой таймаутов
   */
  async sendMessage(e, t, s) {
    if (!this.worker)
      throw new k("Web Worker не создан", e);
    return new Promise((r, i) => {
      const a = `${e}_${++this.messageCounter}_${Date.now()}`, n = s || this.config.operationTimeout || 1e4, o = setTimeout(() => {
        this.pendingRequests.delete(a), i(new x(
          `Операция ${e} превысила таймаут ${n}ms`,
          n,
          e
        ));
      }, n);
      this.pendingRequests.set(a, {
        resolve: r,
        reject: i,
        timestamp: Date.now(),
        timeout: o
      });
      const l = { id: a, type: e, data: t };
      this.worker.postMessage(l);
    });
  }
  /**
   * Обработка сообщений от воркера
   */
  handleWorkerMessage(e) {
    const t = this.pendingRequests.get(e.id);
    if (!t) {
      console.warn(`[TransformersProvider] Получен ответ для неизвестного запроса: ${e.id}`);
      return;
    }
    if (t.timeout && clearTimeout(t.timeout), this.pendingRequests.delete(e.id), e.metadata?.memoryUsage && (this.performanceMetrics.memoryPeak = Math.max(
      this.performanceMetrics.memoryPeak,
      e.metadata.memoryUsage
    )), e.success)
      t.resolve(e.data);
    else {
      const s = new f(
        e.error || "Неизвестная ошибка воркера",
        this.name,
        "WORKER_ERROR"
      );
      t.reject(s);
    }
  }
  /**
   * Обработка ошибок воркера
   */
  handleWorkerError(e) {
    for (const [t, s] of this.pendingRequests)
      s.timeout && clearTimeout(s.timeout), s.reject(new k(
        `Worker error: ${e.message}`,
        "worker_error",
        void 0,
        { originalError: e.message }
      ));
    this.pendingRequests.clear(), this._isReady = !1;
  }
}
function se(c) {
  return new F(c);
}
function S() {
  return typeof window < "u" && typeof Worker < "u" && typeof SharedArrayBuffer < "u" && typeof WebAssembly < "u";
}
function z() {
  return {
    id: "Xenova/all-MiniLM-L6-v2",
    name: "all-MiniLM-L6-v2",
    description: "Sentence-BERT model for generating 384-dimensional embeddings",
    dimensions: 384,
    maxInputLength: 512,
    languages: ["en", "multilingual"],
    useCases: ["sentence similarity", "semantic search", "clustering"],
    modelSize: 23e6,
    // ~23MB
    provider: "transformers"
  };
}
class u {
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
      salt: i = "",
      includeDebugInfo: a = !1
    } = t, n = {
      text: e.text,
      provider: e.collectionConfig?.provider || e.globalConfig?.defaultProvider,
      model: e.collectionConfig?.model || e.globalConfig?.defaultModel,
      dimensions: e.collectionConfig?.dimensions || e.globalConfig?.defaultDimensions,
      textPreprocessing: e.collectionConfig?.textPreprocessing,
      additionalParams: e.additionalParams,
      salt: i
    };
    r && (n.timestamp = Date.now());
    const o = u.sortObjectKeys(n), l = JSON.stringify(o), d = `${s}:${l}`;
    if (u.hashCache.has(d))
      return u.hashCache.get(d);
    const m = {
      hash: await u.hashString(l, s),
      algorithm: s,
      timestamp: /* @__PURE__ */ new Date(),
      input: a ? o : void 0
    };
    return u.addToHashCache(d, m), m;
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
    return u.generateCacheKey(r, s);
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
      return u.simpleHash(e);
    try {
      const r = new TextEncoder().encode(e), i = await crypto.subtle.digest(t, r);
      return Array.from(new Uint8Array(i)).map((n) => n.toString(16).padStart(2, "0")).join("");
    } catch (s) {
      return console.warn("Web Crypto API failed, using simple hash:", s), u.simpleHash(e);
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
      hash: u.simpleHash(e),
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
      return e.map((r) => u.sortObjectKeys(r));
    const t = Object.keys(e).sort(), s = {};
    for (const r of t)
      s[r] = u.sortObjectKeys(e[r]);
    return s;
  }
  /**
   * Добавление результата в кеш хешей
   *
   * @param key - Ключ кеша
   * @param result - Результат хеширования
   */
  static addToHashCache(e, t) {
    if (u.hashCache.size >= u.MAX_HASH_CACHE_SIZE) {
      const s = u.hashCache.keys().next().value;
      s !== void 0 && u.hashCache.delete(s);
    }
    u.hashCache.set(e, t);
  }
  /**
   * Очистка кеша хешей
   */
  static clearHashCache() {
    u.hashCache.clear();
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
      throw new v(
        "Provider is required in collection config",
        "provider",
        "must be specified"
      );
    if (!e.dimensions || e.dimensions <= 0)
      throw new v(
        "Dimensions must be a positive number",
        "dimensions",
        "dimensions > 0"
      );
    const t = [384, 512, 768, 1024, 1536, 3072];
    if (!t.includes(e.dimensions))
      throw new v(
        `Unsupported dimensions: ${e.dimensions}. Supported: ${t.join(", ")}`,
        "dimensions",
        `one of: ${t.join(", ")}`
      );
    if (e.batchSize && (e.batchSize <= 0 || e.batchSize > 1e3))
      throw new v(
        "Batch size must be between 1 and 1000",
        "batchSize",
        "1 <= batchSize <= 1000"
      );
    if (e.timeout && e.timeout < 1e3)
      throw new v(
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
    throw new v(
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
      return e.map((t) => u.deepClone(t));
    if (e instanceof Float32Array)
      return new Float32Array(e);
    if (typeof e == "object") {
      const t = {};
      for (const s in e)
        e.hasOwnProperty(s) && (t[s] = u.deepClone(e[s]));
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
    const s = u.deepClone(e);
    for (const r in t)
      if (t.hasOwnProperty(r)) {
        const i = t[r];
        i !== void 0 && (typeof i == "object" && !Array.isArray(i) && i !== null ? s[r] = u.mergeConfigs(
          s[r] || {},
          i
        ) : s[r] = i);
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
      webWorkers: u.supportsWebWorkers(),
      sharedArrayBuffer: u.supportsSharedArrayBuffer(),
      opfs: await u.supportsOPFS(),
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
const O = {
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
class re {
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
      throw new v(
        "Collection ID must be a non-empty string",
        "collectionId",
        "non-empty string"
      );
    if (!/^[a-zA-Z0-9_-]+$/.test(e))
      throw new v(
        "Collection ID can only contain letters, numbers, underscores and hyphens",
        "collectionId",
        "matching pattern: /^[a-zA-Z0-9_-]+$/"
      );
    if (e.length > 50)
      throw new v(
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
      batchSize: O.DEFAULT_BATCH_SIZES[e],
      cacheEnabled: !0,
      timeout: e === "transformers" ? O.DEFAULT_TIMEOUTS.local : O.DEFAULT_TIMEOUTS.api,
      autoGenerate: !1,
      textPreprocessing: {
        maxLength: O.MAX_TEXT_LENGTHS[e],
        stripHtml: !0,
        stripMarkdown: !0,
        normalizeWhitespace: !0,
        toLowerCase: !1,
        removeSpecialChars: !1
      }
    };
  }
}
class H {
  constructor() {
    this.providerRegistry = /* @__PURE__ */ new Map(), this.initializeProviderRegistry();
  }
  /**
   * Создание экземпляра провайдера на основе конфигурации коллекции
   */
  async createProvider(e) {
    try {
      const t = this.validateConfiguration(e);
      if (!t.isValid)
        throw new w(
          `Invalid provider configuration: ${t.errors.join(", ")}`,
          "provider",
          t.suggestions.join("; "),
          e.provider,
          {
            validation: t,
            config: { ...e, apiKey: e.apiKey ? "[REDACTED]" : void 0 }
          }
        );
      const s = this.checkProviderSupport(e.provider);
      if (!s.isSupported)
        throw new C(
          `Provider ${e.provider} is not supported: ${s.unsupportedReason}`,
          e.provider,
          void 0,
          {
            supportInfo: s,
            alternatives: s.alternatives
          }
        );
      let r;
      switch (e.provider) {
        case "transformers":
          r = await this.createTransformersProvider(e);
          break;
        case "openai":
          r = await this.createOpenAIProvider(e);
          break;
        default:
          throw new w(
            `Unsupported provider type: ${e.provider}`,
            "provider",
            "One of: transformers, openai",
            e.provider
          );
      }
      return await r.initialize({
        defaultProvider: e.provider,
        defaultDimensions: e.dimensions,
        apiKey: e.apiKey,
        batchSize: e.batchSize,
        timeout: e.timeout,
        enabled: e.autoGenerate,
        provider: e.provider
      }), r;
    } catch (t) {
      throw t instanceof Error && t.name.includes("Error") ? t : new C(
        `Failed to create provider ${e.provider}: ${t instanceof Error ? t.message : "Unknown error"}`,
        e.provider,
        t instanceof Error ? t : void 0,
        { config: { ...e, apiKey: e.apiKey ? "[REDACTED]" : void 0 } }
      );
    }
  }
  /**
   * Проверка поддержки конфигурации
   */
  supportsConfig(e) {
    const t = this.validateConfiguration(e), s = this.checkProviderSupport(e.provider);
    return t.isValid && s.isSupported;
  }
  /**
   * Получение доступных моделей для всех провайдеров
   */
  async getAvailableModels() {
    const e = [];
    return S() && e.push(z()), e.push(...E.getAvailableModels()), e;
  }
  /**
   * Получение моделей для конкретного провайдера
   */
  async getModelsForProvider(e) {
    switch (e) {
      case "transformers":
        return S() ? [z()] : [];
      case "openai":
        return E.getAvailableModels();
      default:
        return [];
    }
  }
  /**
   * Валидация конфигурации провайдера
   */
  validateConfiguration(e) {
    const t = [], s = [], r = [];
    switch (e.provider || (t.push("Provider type is required"), r.push("Specify provider type (transformers, openai)")), (!e.dimensions || e.dimensions <= 0) && (t.push("Valid dimensions value is required"), r.push("Set dimensions to a positive integer")), e.provider) {
      case "transformers":
        this.validateTransformersConfig(e, t, s, r);
        break;
      case "openai":
        this.validateOpenAIConfig(e, t, s, r);
        break;
      default:
        e.provider && (t.push(`Unsupported provider: ${e.provider}`), r.push("Use one of: transformers, openai"));
    }
    return e.batchSize && e.batchSize > 100 && (s.push("Large batch sizes may impact performance"), r.push("Consider reducing batch size to 50 or less")), e.timeout && e.timeout < 5e3 && (s.push("Short timeout may cause frequent failures"), r.push("Consider increasing timeout to at least 10 seconds")), {
      isValid: t.length === 0,
      errors: t,
      warnings: s,
      suggestions: r
    };
  }
  /**
   * Проверка поддержки провайдера в текущей среде
   */
  checkProviderSupport(e) {
    switch (e) {
      case "transformers":
        return this.checkTransformersSupport();
      case "openai":
        return this.checkOpenAISupport();
      default:
        return {
          isSupported: !1,
          unsupportedReason: `Unknown provider type: ${e}`,
          alternatives: ["transformers", "openai"],
          requirements: ["Valid provider type"]
        };
    }
  }
  /**
   * Получение информации о провайдере
   */
  getProviderInfo(e) {
    return this.providerRegistry.get(e);
  }
  /**
   * Получение всех доступных провайдеров
   */
  getAvailableProviders() {
    return Array.from(this.providerRegistry.values());
  }
  /**
   * Получение рекомендаций по выбору провайдера
   */
  getProviderRecommendations(e) {
    const t = [], { dimensions: s = 384, budget: r = "medium", performance: i = "balanced", privacy: a = "any" } = e;
    if ((a === "local" || a === "any") && S() && s === 384 && t.push({
      provider: "transformers",
      dimensions: 384,
      reason: "Local processing for privacy, no API costs, works offline",
      priority: a === "local" ? 10 : 7,
      alternatives: []
    }), (a === "cloud" || a === "any") && ((r === "low" || i === "fast") && t.push({
      provider: "openai",
      model: "text-embedding-3-small",
      dimensions: Math.min(s, 384),
      reason: "Cost-effective with good performance and flexible dimensions",
      priority: 8,
      alternatives: [
        {
          provider: "openai",
          model: "text-embedding-3-small",
          dimensions: 768,
          reason: "Better accuracy with moderate cost increase"
        }
      ]
    }), (r === "high" || i === "accurate") && t.push({
      provider: "openai",
      model: "text-embedding-3-large",
      dimensions: Math.min(s, 1024),
      reason: "Highest accuracy for demanding applications",
      priority: 9,
      alternatives: [
        {
          provider: "openai",
          model: "text-embedding-3-small",
          dimensions: 1536,
          reason: "Lower cost alternative with good accuracy"
        }
      ]
    }), i === "balanced")) {
      const n = _({ dimensions: s, budget: r, performance: i });
      t.push({
        provider: "openai",
        model: n.model,
        dimensions: n.dimensions,
        reason: n.description,
        priority: 6,
        alternatives: []
      });
    }
    return t.sort((n, o) => o.priority - n.priority);
  }
  /**
   * Создание Transformers.js провайдера
   */
  async createTransformersProvider(e) {
    if (e.dimensions !== 384)
      throw new w(
        "Transformers.js provider only supports 384 dimensions",
        "dimensions",
        "384",
        e.dimensions
      );
    return new F({
      defaultProvider: "transformers",
      defaultDimensions: 384,
      batchSize: e.batchSize || 16,
      enableLogging: !1,
      modelLoadTimeout: e.timeout || 3e4,
      operationTimeout: e.timeout || 1e4,
      enableModelCache: e.cacheEnabled !== !1,
      ...e.providerOptions
    });
  }
  /**
   * Создание OpenAI провайдера
   */
  async createOpenAIProvider(e) {
    if (!e.apiKey)
      throw new w(
        "OpenAI provider requires API key",
        "apiKey",
        "Valid OpenAI API key starting with sk-",
        void 0
      );
    const t = e.model || "text-embedding-3-small";
    if (!$(t, e.dimensions))
      throw new w(
        `Model ${t} does not support ${e.dimensions} dimensions`,
        "dimensions",
        "Valid dimensions for the selected model",
        e.dimensions,
        { model: t, provider: "openai" }
      );
    return new E(e.dimensions, t);
  }
  /**
   * Валидация конфигурации Transformers.js
   */
  validateTransformersConfig(e, t, s, r) {
    e.dimensions !== 384 && (t.push("Transformers.js provider only supports 384 dimensions"), r.push("Set dimensions to 384 for Transformers.js provider")), e.apiKey && (s.push("API key is not needed for Transformers.js provider"), r.push("Remove apiKey from configuration for local provider")), e.model && e.model !== "all-MiniLM-L6-v2" && (s.push(`Model ${e.model} is not supported by Transformers.js provider`), r.push("Use default model or remove model specification")), S() || (t.push("Transformers.js is not supported in current environment"), r.push("Use a browser with Web Workers and SharedArrayBuffer support"));
  }
  /**
   * Валидация конфигурации OpenAI
   */
  validateOpenAIConfig(e, t, s, r) {
    e.apiKey ? e.apiKey.startsWith("sk-") || (s.push('OpenAI API key should start with "sk-"'), r.push("Verify API key format")) : (t.push("OpenAI provider requires API key"), r.push("Set apiKey in configuration"));
    const i = e.model || "text-embedding-3-small";
    $(i, e.dimensions) || (t.push(`Model ${i} does not support ${e.dimensions} dimensions`), r.push("Check supported dimensions for the selected model")), e.batchSize && e.batchSize > 100 && (s.push("Large batch sizes may be inefficient for OpenAI API"), r.push("Consider using batch size of 50 or less"));
  }
  /**
   * Проверка поддержки Transformers.js
   */
  checkTransformersSupport() {
    return S() ? {
      isSupported: !0
    } : {
      isSupported: !1,
      unsupportedReason: "Browser does not support required features",
      alternatives: ["openai"],
      requirements: [
        "Web Workers support",
        "SharedArrayBuffer support",
        "WebAssembly support",
        "Modern browser (Chrome 86+, Firefox 79+, Safari 15+)"
      ]
    };
  }
  /**
   * Проверка поддержки OpenAI
   */
  checkOpenAISupport() {
    return typeof fetch > "u" ? {
      isSupported: !1,
      unsupportedReason: "Fetch API is not available",
      alternatives: ["transformers"],
      requirements: ["Modern browser with fetch API support"]
    } : {
      isSupported: !0
    };
  }
  /**
   * Инициализация реестра провайдеров
   */
  initializeProviderRegistry() {
    this.providerRegistry.set("transformers", {
      type: "transformers",
      displayName: "Transformers.js (Local)",
      description: "Local embedding generation using all-MiniLM-L6-v2 model. Runs entirely in browser with no external API calls.",
      supportedDimensions: [384],
      defaultDimensions: 384,
      requiresApiKey: !1,
      isLocal: !0,
      availableModels: S() ? [z()] : [],
      recommendedUseCases: [
        "Privacy-sensitive applications",
        "Offline functionality",
        "No API cost constraints",
        "Real-time processing",
        "Development and prototyping"
      ],
      environmentRequirements: [
        "Web Workers support",
        "SharedArrayBuffer support",
        "WebAssembly support",
        "Modern browser"
      ]
    }), this.providerRegistry.set("openai", {
      type: "openai",
      displayName: "OpenAI Embeddings API",
      description: "Cloud-based embedding generation using OpenAI models. Supports multiple models and configurable dimensions.",
      supportedDimensions: [256, 384, 512, 768, 1024, 1536, 3072],
      defaultDimensions: 1536,
      requiresApiKey: !0,
      isLocal: !1,
      availableModels: E.getAvailableModels(),
      recommendedUseCases: [
        "Production applications",
        "High accuracy requirements",
        "Multiple language support",
        "Flexible dimensions",
        "Large-scale processing"
      ],
      environmentRequirements: [
        "Internet connection",
        "Valid OpenAI API key",
        "fetch API support"
      ]
    });
  }
}
const T = new H();
async function ie(c) {
  return T.createProvider(c);
}
function ae(c) {
  return T.validateConfiguration(c);
}
function ne(c) {
  return T.checkProviderSupport(c);
}
function oe(c) {
  return T.getProviderRecommendations(c);
}
function ce() {
  return T.getAvailableProviders();
}
async function le() {
  return T.getAvailableModels();
}
class W {
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
        const m = await this.getCachedEmbedding(e, t);
        if (m)
          return this.stats.cacheHits++, this.updateCacheHitStats(m.source), m;
      }
      this.stats.cacheMisses++;
      const i = await this.getProviderForCollection(t), a = s?.timeout || 5e3, n = this.generateFreshEmbedding(e, i), o = new Promise(
        (m, g) => setTimeout(() => g(new x(`Embedding generation timeout after ${a}ms`, a, "generateQueryEmbedding")), a)
      ), l = await Promise.race([n, o]), d = Date.now() - r;
      this.stats.totalGenerationTime += d;
      const h = {
        embedding: l,
        dimensions: l.length,
        source: "provider_fresh",
        processingTime: d,
        metadata: {
          cacheHit: !1,
          modelUsed: i.getModelInfo?.()?.name,
          provider: this.getProviderType(i),
          confidence: 1
        }
      };
      return this.saveToCacheAsync(e, t, h).catch(
        (m) => console.warn("Failed to cache embedding result:", m)
      ), h;
    } catch (i) {
      const a = Date.now() - r;
      throw this.stats.totalGenerationTime += a, i instanceof p ? i : new p(
        `Failed to generate query embedding: ${i instanceof Error ? i.message : String(i)}`,
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
    const s = t?.batchSize || 32, r = t?.concurrency || 3, i = [], a = [];
    for (let d = 0; d < e.length; d += s)
      a.push(e.slice(d, d + s));
    let n = 0;
    const o = e.length, l = async (d) => {
      const h = [];
      for (const m of d)
        try {
          t?.onProgress?.(n, o, m.query.substring(0, 50) + "...");
          const g = await this.generateQueryEmbedding(
            m.query,
            m.collection,
            m.options
          );
          h.push({
            requestId: m.id,
            ...g,
            status: "completed"
          }), n++;
        } catch (g) {
          h.push({
            requestId: m.id,
            embedding: new Float32Array(0),
            dimensions: 0,
            source: "provider_fresh",
            processingTime: 0,
            status: "failed",
            error: g instanceof Error ? g.message : String(g)
          }), n++;
        }
      return h;
    };
    for (let d = 0; d < a.length; d += r) {
      const m = a.slice(d, d + r).map(l), g = await Promise.all(m);
      i.push(...g.flat());
    }
    return t?.onProgress?.(n, o, "Completed"), i;
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
      const i = await this.cacheManager.get(s, "indexeddb");
      if (i)
        return await this.cacheManager.set(s, i, { level: "memory", ttl: 3e5 }), {
          ...i,
          source: "cache_indexeddb",
          metadata: { ...i.metadata, cacheHit: !0 }
        };
      const a = await this.cacheManager.get(s, "database");
      return a ? (await Promise.all([
        this.cacheManager.set(s, a, { level: "memory", ttl: 3e5 }),
        this.cacheManager.set(s, a, { level: "indexeddb", ttl: 864e5 })
        // 24 часа
      ]), {
        ...a,
        source: "cache_database",
        metadata: { ...a.metadata, cacheHit: !0 }
      }) : null;
    } catch (r) {
      return console.warn(`Cache lookup failed for query "${e.substring(0, 50)}":`, r), null;
    }
  }
  /**
   * Предварительный прогрев кэша для популярных запросов
   */
  async warmCache(e, t) {
    const r = e.map((i, a) => ({
      id: `warmup-${a}`,
      query: i,
      collection: t,
      options: { priority: 0 }
      // Низкий приоритет для прогрева
    }));
    await this.batchGenerateEmbeddings(r, {
      batchSize: 10,
      concurrency: 2,
      onProgress: (i, a) => {
        console.log(`Cache warming progress: ${i}/${a}`);
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
      throw new w("Query must be a non-empty string", "query", "non-empty string", e);
    if (e.length > 8192)
      throw new w("Query is too long (max 8192 characters)", "query", "string with length <= 8192", e.length);
    if (!t || typeof t != "string")
      throw new w("Collection must be specified", "collection", "non-empty string", t);
  }
  /**
   * Получение провайдера для коллекции
   */
  async getProviderForCollection(e) {
    if (this.providers.has(e))
      return this.providers.get(e);
    const t = await this.getCollectionConfig(e), s = await T.createProvider(t);
    return this.providers.set(e, s), this.collectionConfigs.set(e, t), s;
  }
  /**
   * Генерация свежего эмбеддинга через провайдера
   */
  async generateFreshEmbedding(e, t) {
    const s = await t.generateEmbedding(e);
    if (!s.success || !s.embedding)
      throw new p(
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
    } catch (i) {
      console.warn("Failed to save to cache:", i);
    }
  }
  /**
   * Генерация ключа кэша
   */
  generateCacheKey(e, t) {
    const s = this.collectionConfigs.get(t), r = s ? u.hashText(JSON.stringify(s), { algorithm: "simple" }).hash : "default", i = u.hashText(e.trim().toLowerCase(), { algorithm: "simple" }).hash;
    return `embedding:${t}:${r}:${i}`;
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
async function de(c, e) {
  return new W(c, e);
}
class N {
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
    const s = this.getModelsForPreloading(e).map(async ({ provider: r, model: i }) => {
      try {
        await this.loadModel(r, i);
      } catch (a) {
        console.warn(`Failed to preload model ${r}:${i}:`, a);
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
      aggressive: i = !1
    } = e || {}, a = this.getTotalMemoryUsage(), n = this.models.size, o = Array.from(this.models.values()).filter((h) => i ? !0 : Date.now() - h.lastUsed > r).sort((h, m) => {
      const g = h.lastUsed + h.usageCount * 1e3, U = m.lastUsed + m.usageCount * 1e3;
      return g - U;
    });
    let l = 0, d = 0;
    for (const h of o) {
      if (!(a - l > t || n - d > s)) break;
      try {
        await this.unloadModel(h.modelId), l += h.memoryUsage, d++;
      } catch (g) {
        console.warn(`Failed to unload model ${h.modelId}:`, g);
      }
    }
    console.log(`Memory optimization completed: freed ${l}MB, unloaded ${d} models`);
  }
  /**
   * Получение статуса всех моделей
   */
  getModelStatus() {
    const e = Array.from(this.models.values()), t = this.getTotalMemoryUsage(), s = e.filter((i) => i.status === "ready").length, r = {};
    for (const i of e) {
      r[i.provider] || (r[i.provider] = {
        count: 0,
        memoryUsage: 0,
        avgLoadTime: 0,
        totalLoadTime: 0
      });
      const a = r[i.provider];
      a.count++, a.memoryUsage += i.memoryUsage, a.totalLoadTime += i.loadTime, a.avgLoadTime = a.totalLoadTime / a.count;
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
    const r = Date.now(), i = {
      provider: e,
      model: t || this.getDefaultModelForProvider(e),
      dimensions: this.getDimensionsForProvider(e),
      batchSize: 32,
      cacheEnabled: !0,
      autoGenerate: !0,
      timeout: 3e4
    }, a = {
      modelId: s,
      provider: e,
      modelName: i.model,
      dimensions: i.dimensions,
      providerInstance: null,
      // Будет установлено после загрузки
      lastUsed: Date.now(),
      usageCount: 0,
      memoryUsage: this.estimateModelMemoryUsage(e),
      loadTime: 0,
      status: "loading"
    };
    this.models.set(s, a), this.modelConfigs.set(s, i);
    try {
      const n = await T.createProvider(i), o = Date.now() - r;
      return a.providerInstance = n, a.loadTime = o, a.status = "ready", a.usageCount = 1, this.stats.totalLoads++, this.stats.avgLoadTime = (this.stats.avgLoadTime * (this.stats.totalLoads - 1) + o) / this.stats.totalLoads, console.log(`Model ${s} loaded successfully in ${o}ms`), {
        config: i,
        provider: n,
        metrics: this.getModelMetrics(s)
      };
    } catch (n) {
      throw a.status = "error", a.error = n instanceof Error ? n.message : String(n), new D(
        `Failed to load model ${s}: ${a.error}`,
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
      const i = this.models.get(e);
      if (!i)
        throw new D(`Model ${e} was removed during loading`, "unknown", e);
      if (i.status === "ready")
        return i.lastUsed = Date.now(), i.usageCount++, {
          config: this.modelConfigs.get(e),
          provider: i.providerInstance,
          metrics: this.getModelMetrics(e)
        };
      if (i.status === "error")
        throw new D(`Model ${e} failed to load: ${i.error}`, "unknown", e);
      await new Promise((a) => setTimeout(a, 100));
    }
    throw new D(`Model ${e} loading timeout`, "unknown", e);
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
function he(c = {}) {
  return new N(c);
}
class K {
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
      priority: i = "normal",
      tags: a = []
    } = s, n = Date.now(), o = this.estimateSize(t), l = {
      key: e,
      value: t,
      timestamp: n,
      expiresAt: r ? n + r : void 0,
      lastAccessed: n,
      accessCount: 1,
      priority: i,
      tags: a,
      size: o
    };
    await this.ensureSpace(o), this.cache.has(e) && this.removeFromAccessOrder(e), this.cache.set(e, l), this.accessOrder.unshift(e), await this.enforceConstraints();
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
      for (const [r, i] of this.cache.entries())
        i.tags.includes(s) && t.push(r);
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
    const e = this.getMemoryUsage(), t = this.stats.hits + this.stats.misses, s = t > 0 ? this.stats.hits / t * 100 : 0, r = this.cache.size > 0 ? Array.from(this.cache.values()).reduce((i, a) => i + a.size, 0) / this.cache.size : 0;
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
    const i = [], a = Array.from(this.cache.entries()), n = this.sortForEviction(a);
    for (const [o, l] of n) {
      i.push(o), r += l.size;
      const d = this.getMemoryUsage() - r, h = this.cache.size - i.length;
      if (d <= t && d <= this.config.maxMemory - e && h <= s)
        break;
    }
    for (const o of i)
      this.cache.delete(o), this.removeFromAccessOrder(o), this.stats.evictions++;
    console.log(`Evicted ${i.length} entries, freed ${r} bytes`);
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
          const i = t[s[1].priority] - t[r[1].priority];
          return i !== 0 ? i : s[1].lastAccessed - r[1].lastAccessed;
        });
      case "hybrid":
      default:
        return e.sort((s, r) => {
          const i = { low: 0, normal: 1, high: 2 }, a = (h) => i[h.priority] * 1e3, n = (h) => h.accessCount * 100, o = (h) => (Date.now() - h.lastAccessed) / 1e3, l = a(s[1]) + n(s[1]) - o(s[1]), d = a(r[1]) + n(r[1]) - o(r[1]);
          return l - d;
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
class j {
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
      const i = s.modelInfo.usageCount;
      r.averageInferenceTime = i > 1 ? (r.averageInferenceTime * (i - 1) + t.inferenceTime) / i : t.inferenceTime;
    }
    if (t.success !== void 0) {
      const i = s.modelInfo.usageCount, n = Math.round(r.successRate * (i - 1)) + (t.success ? 1 : 0);
      r.successRate = n / i;
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
      for (const [r, i] of this.cache.entries())
        i.modelInfo.provider === s && t.push(r);
    } else if (e.startsWith("tag:")) {
      const s = e.substring(4);
      for (const [r, i] of this.cache.entries())
        i.modelInfo.tags.includes(s) && t.push(r);
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
    const e = this.getAllModels(), t = e.reduce((a, n) => a + n.memoryUsage, 0), s = {};
    for (const a of e) {
      s[a.provider] || (s[a.provider] = {
        count: 0,
        memoryUsage: 0,
        totalInferenceTime: 0,
        totalSuccessRate: 0
      });
      const n = s[a.provider];
      n.count++, n.memoryUsage += a.memoryUsage, n.totalInferenceTime += a.performance.averageInferenceTime, n.totalSuccessRate += a.performance.successRate;
    }
    for (const a of Object.keys(s)) {
      const n = s[a];
      n.avgInferenceTime = n.totalInferenceTime / n.count, n.successRate = n.totalSuccessRate / n.count, delete n.totalInferenceTime, delete n.totalSuccessRate;
    }
    const r = this.stats.hits + this.stats.misses, i = r > 0 ? this.stats.hits / r * 100 : 0;
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      memoryUsage: t,
      maxMemory: this.config.maxMemory,
      providerStats: s,
      cachePerformance: {
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate: i,
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
    ), s = Math.floor(this.config.maxSize * 0.8), r = Array.from(this.cache.entries()), i = this.sortForEviction(r);
    let a = 0;
    const n = [];
    for (const [o, l] of i) {
      n.push(o), a += l.modelInfo.memoryUsage;
      const d = this.getCurrentMemoryUsage() - a, h = this.cache.size - n.length;
      if (d <= t && h <= s)
        break;
    }
    for (const o of n)
      await this.delete(o), this.stats.evictions++;
    console.log(`Evicted ${n.length} models, freed ${a}MB`);
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
          const r = this.calculateEvictionScore(t[1].modelInfo), i = this.calculateEvictionScore(s[1].modelInfo);
          return r - i;
        });
    }
  }
  /**
   * Вычисление оценки для выселения (гибридная стратегия)
   */
  calculateEvictionScore(e) {
    const s = (Date.now() - e.lastUsed) / (60 * 1e3), r = Math.max(1, e.usageCount) * 100, i = e.memoryUsage * 10, a = e.performance.successRate * 50;
    return s + i - r - a;
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
class G {
  constructor(e = {}) {
    this.queryCache = new K({
      maxSize: e.memorySize || 1e3,
      ttl: 5 * 60 * 1e3
      // 5 минут для memory cache
    }), this.modelCache = new j({
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
      const i = await this.getFromLevel(e, "indexeddb");
      if (i !== null)
        return this.stats.indexedDBHits++, this.updateAccessTimeStats("indexeddb", Date.now() - s), await this.queryCache.set(e, i), i;
      const a = await this.getFromLevel(e, "database");
      return a !== null ? (this.stats.databaseHits++, this.updateAccessTimeStats("database", Date.now() - s), await Promise.all([
        this.queryCache.set(e, a),
        this.setInIndexedDB(e, a, { ttl: 24 * 60 * 60 * 1e3 })
        // 24 часа
      ]), a) : (this.stats.misses++, null);
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
      ttl: i,
      tags: a = [],
      priority: n = "normal",
      compression: o = !1
    } = s || {};
    try {
      const l = [];
      (!r || r === "memory") && l.push(this.queryCache.set(e, t, {
        ttl: i || 5 * 60 * 1e3,
        // 5 минут по умолчанию
        priority: n,
        tags: a
      })), (!r || r === "indexeddb") && l.push(this.setInIndexedDB(e, t, {
        ttl: i || 24 * 60 * 60 * 1e3,
        // 24 часа по умолчанию
        tags: a,
        compression: o
      })), (!r || r === "database") && l.push(this.setInDatabase(e, t, {
        ttl: i || 7 * 24 * 60 * 60 * 1e3,
        // 7 дней по умолчанию
        tags: a
      })), await Promise.all(l);
    } catch (l) {
      throw new P(
        `Failed to set cache value for key "${e}": ${l instanceof Error ? l.message : String(l)}`,
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
      throw new P(
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
    const s = t.map(async (r, i) => {
      const a = `warmup:${e}:${this.hashString(r)}`, n = {
        warmedAt: Date.now(),
        collection: e,
        query: r,
        status: "placeholder"
      };
      await this.set(a, n, {
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
    for (const [r, i] of this.stats.levelAccessTimes.entries())
      s[r] = i.count > 0 ? i.total / i.count : 0;
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
        throw new P(`Unknown cache level: ${t}`, "read", `unknown:${t}`);
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
      const i = indexedDB.open(e, t);
      i.onerror = () => {
        console.warn("Failed to open IndexedDB:", i.error), s();
      }, i.onsuccess = () => {
        this.indexedDB = i.result, s();
      }, i.onupgradeneeded = () => {
        const a = i.result;
        if (!a.objectStoreNames.contains("cache")) {
          const n = a.createObjectStore("cache", { keyPath: "key" });
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
      const i = this.indexedDB.transaction(["cache"], "readonly").objectStore("cache").get(e);
      i.onsuccess = () => {
        const a = i.result;
        if (!a) {
          t(null);
          return;
        }
        if (a.expiresAt && Date.now() > a.expiresAt) {
          this.deleteFromIndexedDB(e).catch(console.warn), t(null);
          return;
        }
        t(a.value);
      }, i.onerror = () => {
        console.warn(`IndexedDB get failed for key "${e}":`, i.error), t(null);
      };
    }) : null;
  }
  /**
   * Сохранение данных в IndexedDB
   */
  async setInIndexedDB(e, t, s = {}) {
    if (await this.dbReady, !this.indexedDB) return;
    const { ttl: r, tags: i = [], compression: a = !1 } = s, n = {
      key: e,
      value: a ? this.compress(t) : t,
      timestamp: Date.now(),
      expiresAt: r ? Date.now() + r : null,
      tags: i,
      compressed: a
    };
    return new Promise((o, l) => {
      const m = this.indexedDB.transaction(["cache"], "readwrite").objectStore("cache").put(n);
      m.onsuccess = () => o(), m.onerror = () => {
        console.warn(`IndexedDB set failed for key "${e}":`, m.error), l(m.error);
      };
    });
  }
  /**
   * Удаление данных из IndexedDB
   */
  async deleteFromIndexedDB(e) {
    if (this.indexedDB)
      return new Promise((t) => {
        const i = this.indexedDB.transaction(["cache"], "readwrite").objectStore("cache").delete(e);
        i.onsuccess = () => t(), i.onerror = () => {
          console.warn(`IndexedDB delete failed for key "${e}":`, i.error), t();
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
      const i = this.indexedDB.transaction(["cache"], "readwrite").objectStore("cache").openCursor();
      i.onsuccess = () => {
        const a = i.result;
        if (a) {
          const n = a.value;
          n.expiresAt && e > n.expiresAt && a.delete(), a.continue();
        } else
          t();
      }, i.onerror = () => {
        console.warn("IndexedDB optimization failed:", i.error), t();
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
function me(c = {}) {
  return new G(c);
}
export {
  A,
  B,
  w as C,
  Q as D,
  u as E,
  K as F,
  j as G,
  X as H,
  W as I,
  N as M,
  Z as O,
  ee as P,
  I as Q,
  F as T,
  v as V,
  y as W,
  p as a,
  J as b,
  Y as c,
  q as d,
  E as e,
  te as f,
  _ as g,
  se as h,
  $ as i,
  H as j,
  ie as k,
  ne as l,
  oe as m,
  ce as n,
  le as o,
  T as p,
  R as q,
  f as r,
  x as s,
  re as t,
  O as u,
  ae as v,
  de as w,
  he as x,
  G as y,
  me as z
};
//# sourceMappingURL=CacheManager-BAFvz7pV.mjs.map
