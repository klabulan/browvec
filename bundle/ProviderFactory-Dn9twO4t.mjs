let u = class extends Error {
  constructor(e, t, r) {
    super(e), this.code = t, this.details = r, this.name = "WorkerError";
  }
};
class B extends u {
  constructor(e, t) {
    super(e, "DATABASE_ERROR"), this.sqliteCode = t, this.name = "DatabaseError";
  }
}
class H extends u {
  constructor(e) {
    super(e, "VECTOR_ERROR"), this.name = "VectorError";
  }
}
class K extends u {
  constructor(e) {
    super(e, "OPFS_ERROR"), this.name = "OPFSError";
  }
}
const D = {
  maxConcurrentOperations: 10,
  operationTimeout: 3e4,
  // 30 seconds
  enablePerformanceMonitoring: !0,
  logLevel: "info"
};
class _ {
  constructor(e, t = {}) {
    this.pendingCalls = /* @__PURE__ */ new Map(), this.callCounter = 0, this.performanceMetrics = {
      totalCalls: 0,
      totalTime: 0,
      errors: 0,
      timeouts: 0
    }, this.worker = e, this.config = { ...D, ...t }, this.setupWorkerListeners();
  }
  setupWorkerListeners() {
    this.worker.onmessage = (e) => {
      const t = e.data;
      if (t.type === "log") {
        const r = t.level;
        (console[r] || console.log)(t.message, ...t.args || []);
        return;
      }
      this.handleWorkerResponse(t);
    }, this.worker.onerror = (e) => {
      this.log("error", "Worker error:", e.message), this.rejectAllPending(new u("Worker error: " + e.message, "WORKER_ERROR"));
    }, this.worker.onmessageerror = (e) => {
      this.log("error", "Worker message error:", e), this.rejectAllPending(new u("Worker message error", "MESSAGE_ERROR"));
    };
  }
  handleWorkerResponse(e) {
    const t = this.pendingCalls.get(e.id);
    if (!t) {
      this.log("warn", "Received response for unknown call ID:", e.id);
      return;
    }
    if (this.pendingCalls.delete(e.id), clearTimeout(t.timeout), this.config.enablePerformanceMonitoring) {
      const r = Date.now() - t.startTime;
      this.performanceMetrics.totalCalls++, this.performanceMetrics.totalTime += r;
    }
    if (e.error) {
      this.performanceMetrics.errors++;
      const r = new u(
        e.error.message,
        e.error.code
      );
      e.error.stack && (r.stack = e.error.stack), t.reject(r);
    } else
      t.resolve(e.result);
  }
  generateCallId() {
    return `rpc_${++this.callCounter}_${Date.now()}`;
  }
  call(e, t) {
    return new Promise((r, s) => {
      if (this.pendingCalls.size >= this.config.maxConcurrentOperations) {
        this.log("error", `Rate limit exceeded for ${e}: ${this.pendingCalls.size}/${this.config.maxConcurrentOperations}`), s(new u(
          `Too many concurrent operations (max: ${this.config.maxConcurrentOperations})`,
          "RATE_LIMIT"
        ));
        return;
      }
      const i = this.generateCallId(), n = Date.now(), a = setTimeout(() => {
        this.log("error", `Operation timeout for ${e} after ${this.config.operationTimeout}ms`), this.pendingCalls.delete(i), this.performanceMetrics.timeouts++, s(new u(
          `Operation timeout after ${this.config.operationTimeout}ms`,
          "TIMEOUT"
        ));
      }, this.config.operationTimeout);
      this.pendingCalls.set(i, {
        resolve: r,
        reject: s,
        timeout: a,
        startTime: n
      });
      const h = {
        id: i,
        method: e,
        params: t
      };
      try {
        this.worker.postMessage(h);
      } catch (m) {
        this.log("error", `Failed to send RPC message for ${e}:`, m), this.pendingCalls.delete(i), clearTimeout(a), s(new u(
          `Failed to send message: ${m instanceof Error ? m.message : String(m)}`,
          "SEND_ERROR"
        ));
      }
    });
  }
  rejectAllPending(e) {
    for (const [t, r] of this.pendingCalls)
      clearTimeout(r.timeout), r.reject(e);
    this.pendingCalls.clear();
  }
  log(e, t, ...r) {
    const s = { debug: 0, info: 1, warn: 2, error: 3 }, i = s[this.config.logLevel];
    s[e] >= i && console[e](`[WorkerRPC] ${t}`, ...r);
  }
  // DBWorkerAPI implementation
  async open(e) {
    return this.call("open", e);
  }
  async close() {
    const e = await this.call("close");
    return this.rejectAllPending(new u("Worker closed", "WORKER_CLOSED")), e;
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
    this.rejectAllPending(new u("Worker terminated", "TERMINATED")), this.worker.terminate();
  }
}
class U {
  constructor(e = {}) {
    this.handlers = /* @__PURE__ */ new Map(), this.config = { ...D, ...e }, this.setupMessageHandler();
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
      const r = this.handlers.get(e.method);
      if (!r)
        throw new u(`Unknown method: ${e.method}`, "UNKNOWN_METHOD");
      const s = await r(e.params);
      t = {
        id: e.id,
        result: s
      };
    } catch (r) {
      this.log("error", `Method ${e.method} failed:`, r), t = {
        id: e.id,
        error: {
          message: r instanceof Error ? r.message : String(r),
          code: r instanceof u ? r.code : "UNKNOWN_ERROR",
          stack: r instanceof Error ? r.stack : void 0
        }
      };
    }
    try {
      self.postMessage(t);
    } catch (r) {
      this.log("error", "Failed to post response:", r);
      const s = {
        id: e.id,
        error: {
          message: "Failed to serialize response",
          code: "SERIALIZATION_ERROR"
        }
      };
      try {
        self.postMessage(s);
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
  log(e, t, ...r) {
    const s = { debug: 0, info: 1, warn: 2, error: 3 }, i = s[this.config.logLevel];
    s[e] >= i && console[e](`[WorkerRPCHandler] ${t}`, ...r);
  }
}
function V(o, e) {
  const t = new Worker(o, { type: "module" });
  return new _(t, e);
}
class l extends Error {
  constructor(e, t = "EMBEDDING_ERROR", r = "unknown", s, i) {
    super(e), this.name = "EmbeddingError", this.code = t, this.category = r, this.context = s, this.recoveryInfo = i, this.timestamp = /* @__PURE__ */ new Date(), Object.setPrototypeOf(this, l.prototype);
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
class d extends l {
  constructor(e, t, r = "PROVIDER_ERROR", s, i) {
    super(
      e,
      r,
      "provider",
      { ...i, providerName: t, modelVersion: s },
      {
        canRetry: !0,
        retryAfter: 1e3,
        maxRetries: 3,
        fallbackAvailable: !0
      }
    ), this.name = "ProviderError", this.providerName = t, this.modelVersion = s, Object.setPrototypeOf(this, d.prototype);
  }
}
class R extends d {
  constructor(e, t, r, s) {
    super(
      e,
      t,
      "PROVIDER_INIT_ERROR",
      void 0,
      { ...s, cause: r?.message }
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
    }, Object.setPrototypeOf(this, R.prototype);
  }
}
class x extends d {
  constructor(e, t, r, s, i) {
    super(
      e,
      t,
      "MODEL_LOAD_ERROR",
      void 0,
      { ...i, modelName: r, modelSize: s }
    ), this.name = "ModelLoadError", this.modelName = r, this.modelSize = s, Object.setPrototypeOf(this, x.prototype);
  }
}
class g extends l {
  constructor(e, t, r, s, i) {
    const n = `NETWORK_${t.toUpperCase()}_ERROR`, a = g.getRetryDelay(r, t);
    super(
      e,
      n,
      "network",
      { ...i, statusCode: r, url: s, networkType: t },
      {
        canRetry: g.isRetryable(r, t),
        retryAfter: a,
        maxRetries: 5,
        fallbackAvailable: !1
      }
    ), this.name = "NetworkError", this.statusCode = r, this.url = s, this.networkType = t, Object.setPrototypeOf(this, g.prototype);
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
class w extends l {
  constructor(e, t, r) {
    super(
      e,
      "AUTH_ERROR",
      "authentication",
      { ...r, authType: t },
      {
        canRetry: !1,
        retryAfter: 0,
        maxRetries: 0,
        fallbackAvailable: !1,
        userActionRequired: !0,
        suggestedActions: w.getSuggestedActions(t)
      }
    ), this.name = "AuthenticationError", this.authType = t, Object.setPrototypeOf(this, w.prototype);
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
class f extends l {
  constructor(e, t, r, s, i) {
    super(
      e,
      "CONFIG_ERROR",
      "configuration",
      { ...i, parameterName: t, expectedValue: r, actualValue: s },
      {
        canRetry: !1,
        retryAfter: 0,
        maxRetries: 0,
        fallbackAvailable: !1,
        userActionRequired: !0,
        suggestedActions: [
          `Исправьте параметр '${t}'`,
          r ? `Ожидается: ${r}` : "Проверьте документацию"
        ]
      }
    ), this.name = "ConfigurationError", this.parameterName = t, this.expectedValue = r, this.actualValue = s, Object.setPrototypeOf(this, f.prototype);
  }
}
class p extends l {
  constructor(e, t, r, s) {
    super(
      e,
      "VALIDATION_ERROR",
      "validation",
      { ...s, fieldName: t, validationRule: r },
      {
        canRetry: !1,
        retryAfter: 0,
        maxRetries: 0,
        fallbackAvailable: !1,
        userActionRequired: !0,
        suggestedActions: [`Исправьте поле '${t}' согласно правилу: ${r}`]
      }
    ), this.name = "ValidationError", this.fieldName = t, this.validationRule = r, Object.setPrototypeOf(this, p.prototype);
  }
}
class v extends l {
  constructor(e, t, r, s, i, n) {
    const a = i ? i.getTime() - Date.now() : 36e5;
    super(
      e,
      "QUOTA_EXCEEDED",
      "quota",
      { ...n, quotaType: t, currentValue: r, maxValue: s, resetTime: i },
      {
        canRetry: !0,
        retryAfter: Math.max(a, 0),
        maxRetries: 1,
        fallbackAvailable: t !== "api_calls",
        suggestedActions: v.getSuggestedActions(t, i)
      }
    ), this.name = "QuotaExceededError", this.quotaType = t, this.currentValue = r, this.maxValue = s, this.resetTime = i, Object.setPrototypeOf(this, v.prototype);
  }
  static getSuggestedActions(e, t) {
    const r = [`Превышен лимит: ${e}`];
    switch (t && r.push(`Лимит будет сброшен: ${t.toLocaleString()}`), e) {
      case "api_calls":
        r.push("Подождите до сброса лимита или обновите тариф");
        break;
      case "tokens":
        r.push("Сократите размер текста или разбейте на части");
        break;
      case "memory":
        r.push("Очистите кэш или используйте меньшую модель");
        break;
      case "concurrent_requests":
        r.push("Дождитесь завершения текущих запросов");
        break;
    }
    return r;
  }
}
class I extends l {
  constructor(e, t, r, s) {
    super(
      e,
      "TIMEOUT_ERROR",
      "timeout",
      { ...s, timeoutMs: t, operation: r },
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
    ), this.name = "TimeoutError", this.timeoutMs = t, this.operation = r, Object.setPrototypeOf(this, I.prototype);
  }
}
class L extends l {
  constructor(e, t, r, s) {
    super(
      e,
      "CACHE_ERROR",
      "cache",
      { ...s, cacheOperation: t, cacheKey: r },
      {
        canRetry: t !== "write",
        // Записи обычно не повторяем
        retryAfter: 1e3,
        maxRetries: 2,
        fallbackAvailable: !0
        // Можно работать без кэша
      }
    ), this.name = "CacheError", this.cacheOperation = t, this.cacheKey = r, Object.setPrototypeOf(this, L.prototype);
  }
}
class T extends l {
  constructor(e, t, r, s) {
    super(
      e,
      "WORKER_ERROR",
      "worker",
      { ...s, workerOperation: t, workerId: r },
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
    ), this.name = "WorkerError", this.workerId = r, this.workerOperation = t, Object.setPrototypeOf(this, T.prototype);
  }
}
class $ {
  constructor(e, t, r = 32, s = 512) {
    this._isReady = !1, this.name = e, this.dimensions = t, this.maxBatchSize = r, this.maxTextLength = s, this.metrics = {
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
    const t = [], r = [], s = [];
    return !e.provider && !e.defaultProvider && t.push("Provider type is required"), e.timeout && e.timeout < 1e3 && (r.push("Timeout less than 1 second may cause frequent timeouts"), s.push("Consider increasing timeout to at least 5000ms")), e.batchSize && e.batchSize > this.maxBatchSize && (t.push(`Batch size ${e.batchSize} exceeds maximum ${this.maxBatchSize}`), s.push(`Set batch size to ${this.maxBatchSize} or less`)), {
      isValid: t.length === 0,
      errors: t,
      warnings: r,
      suggestions: s
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
      throw new l("Input text must be a non-empty string");
    if (e.trim().length === 0)
      throw new l("Input text cannot be empty or whitespace only");
    const t = e.length / 4;
    if (t > this.maxTextLength)
      throw new l(
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
      throw new l("Input must be an array of strings");
    if (e.length === 0)
      throw new l("Batch cannot be empty");
    if (e.length > this.maxBatchSize)
      throw new l(
        `Batch size ${e.length} exceeds maximum ${this.maxBatchSize}`
      );
    e.forEach((t, r) => {
      try {
        this.validateText(t);
      } catch (s) {
        throw new l(
          `Invalid text at index ${r}: ${s instanceof Error ? s.message : "Unknown error"}`
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
  updateMetrics(e, t = 1, r = !1) {
    if (r) {
      this.metrics.errorCount += 1;
      return;
    }
    const s = this.metrics.averageGenerationTime * this.metrics.totalEmbeddings;
    this.metrics.totalEmbeddings += t, this.metrics.averageGenerationTime = (s + e) / this.metrics.totalEmbeddings;
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
class j {
  /**
   * Нормализация вектора эмбеддинга
   *
   * @param embedding - Вектор для нормализации
   * @returns Нормализованный вектор
   */
  static normalizeEmbedding(e) {
    let t = 0;
    for (let s = 0; s < e.length; s++)
      t += e[s] * e[s];
    if (t = Math.sqrt(t), t === 0)
      throw new l("Cannot normalize zero vector");
    const r = new Float32Array(e.length);
    for (let s = 0; s < e.length; s++)
      r[s] = e[s] / t;
    return r;
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
      throw new l("Vectors must have the same dimensions");
    let r = 0, s = 0, i = 0;
    for (let a = 0; a < e.length; a++)
      r += e[a] * t[a], s += e[a] * e[a], i += t[a] * t[a];
    return s = Math.sqrt(s), i = Math.sqrt(i), s === 0 || i === 0 ? 2 : 1 - r / (s * i);
  }
  /**
   * Создание случайного вектора (для тестирования)
   *
   * @param dimensions - Размерность вектора
   * @param normalize - Нормализовать ли вектор
   * @returns Случайный вектор
   */
  static createRandomEmbedding(e, t = !0) {
    const r = new Float32Array(e);
    for (let s = 0; s < e; s++)
      r[s] = Math.random() * 2 - 1;
    return t ? this.normalizeEmbedding(r) : r;
  }
}
class A extends $ {
  constructor(e, t, r = 16, s = 8192) {
    super(e, t, r, s), this.requestQueue = [], this.isProcessingQueue = !1, this.lastRequestTime = 0, this.retryStates = /* @__PURE__ */ new Map();
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
      throw new d(
        `Configuration validation failed: ${t.errors.join(", ")}`,
        this.name,
        "CONFIG_VALIDATION_ERROR"
      );
    if (!e.apiKey)
      throw new w(
        "API key is required for external providers",
        "invalid_key",
        { provider: this.name }
      );
    this.config = {
      ...A.DEFAULT_CONFIG,
      apiKey: e.apiKey,
      baseUrl: e.providerOptions?.baseUrl,
      timeout: e.timeout || A.DEFAULT_CONFIG.timeout,
      maxRetries: e.maxRetries || A.DEFAULT_CONFIG.maxRetries,
      enableRateLimit: e.providerOptions?.enableRateLimit ?? A.DEFAULT_CONFIG.enableRateLimit,
      requestsPerMinute: e.providerOptions?.requestsPerMinute || A.DEFAULT_CONFIG.requestsPerMinute,
      headers: e.providerOptions?.headers || {}
    }, this.config.enableRateLimit && this.initializeRateLimit(), await this.initializeProvider(this.config);
    const r = await this.healthCheck();
    if (!r.isHealthy)
      throw new d(
        `Provider health check failed: ${r.details}`,
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
    let r = null;
    const s = this.config?.maxRetries || 3;
    for (let i = 1; i <= s; i++)
      try {
        await this.waitForRateLimit();
        const n = await this.executeEmbeddingRequest([e]), a = Date.now() - t;
        return this.updateMetrics(a, 1, !1), this.updateApiMetrics(1, !0), n[0];
      } catch (n) {
        if (r = n, i < s && this.shouldRetry(n)) {
          const a = this.calculateRetryDelay(i, n);
          await this.sleep(a);
          continue;
        }
        throw this.updateMetrics(Date.now() - t, 0, !0), this.updateApiMetrics(1, !1), this.wrapError(n);
      }
    throw this.wrapError(r || new Error("Unknown error during embedding generation"));
  }
  /**
   * Пакетная генерация эмбеддингов
   */
  async generateBatch(e) {
    this.validateBatch(e);
    const t = Date.now();
    let r = null;
    const s = this.config?.maxRetries || 3;
    for (let i = 1; i <= s; i++)
      try {
        await this.waitForRateLimit();
        const n = await this.executeEmbeddingRequest(e), a = Date.now() - t;
        return this.updateMetrics(a, e.length, !1), this.updateApiMetrics(1, !0), n;
      } catch (n) {
        if (r = n, i < s && this.shouldRetry(n)) {
          const a = this.calculateRetryDelay(i, n);
          await this.sleep(a);
          continue;
        }
        throw this.updateMetrics(Date.now() - t, 0, !0), this.updateApiMetrics(1, !1), this.wrapError(n);
      }
    throw this.wrapError(r || new Error("Unknown error during batch embedding generation"));
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
    return e instanceof w || e instanceof l && e.category === "configuration" ? !1 : e instanceof g ? e.recoveryInfo?.canRetry ?? !1 : e instanceof v || e instanceof I;
  }
  /**
   * Вычисление задержки для retry с exponential backoff
   */
  calculateRetryDelay(e, t) {
    let r = 1e3;
    if (t instanceof v && t.resetTime)
      return Math.max(t.resetTime.getTime() - Date.now(), 0);
    t instanceof g && (r = t.recoveryInfo?.retryAfter || 2e3), t instanceof I && (r = Math.min(t.timeoutMs * 0.5, 5e3));
    const s = Math.pow(2, e - 1) * r, i = Math.random() * 1e3;
    return Math.min(s + i, 3e4);
  }
  /**
   * Обертывание ошибок в специфичные типы
   */
  wrapError(e) {
    return e instanceof l ? e : e.message.includes("401") || e.message.includes("Unauthorized") ? new w(
      "Invalid API key or unauthorized access",
      "invalid_key",
      { provider: this.name, originalError: e.message }
    ) : e.message.includes("429") || e.message.includes("rate limit") ? new v(
      "API rate limit exceeded",
      "api_calls",
      0,
      this.rateLimitInfo?.limit || 0,
      this.rateLimitInfo?.resetTime,
      { provider: this.name, originalError: e.message }
    ) : e.message.includes("timeout") || e.name === "TimeoutError" ? new I(
      "Request timeout",
      this.config?.timeout || 3e4,
      "embedding_generation",
      { provider: this.name, originalError: e.message }
    ) : e.message.includes("fetch") || e.message.includes("network") ? new g(
      e.message,
      "connection",
      void 0,
      void 0,
      { provider: this.name }
    ) : new d(
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
const y = {
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
class E extends A {
  /**
   * Создание экземпляра OpenAI провайдера
   *
   * @param dimensions - Размерность векторов эмбеддингов
   * @param model - Модель OpenAI (по умолчанию text-embedding-3-small)
   */
  constructor(e, t = "text-embedding-3-small") {
    if (!(t in y))
      throw new f(
        `Unsupported OpenAI model: ${t}`,
        "model",
        `One of: ${Object.keys(y).join(", ")}`,
        t
      );
    const r = y[t];
    if (!r.supportedDimensions.includes(e))
      throw new f(
        `Unsupported dimensions ${e} for model ${t}`,
        "dimensions",
        `One of: ${r.supportedDimensions.join(", ")}`,
        e
      );
    super(
      "openai",
      e,
      100,
      // OpenAI поддерживает большие батчи
      r.maxInputTokens * 4
      // Приблизительно 4 символа на токен
    ), this.model = t, this.supportedDimensions = r.supportedDimensions, this.maxInputTokens = r.maxInputTokens;
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
      throw new w(
        'Invalid OpenAI API key format. Must start with "sk-"',
        "invalid_key",
        { provider: this.name }
      );
    try {
      await this.executeEmbeddingRequest(["test"]);
    } catch (t) {
      if (t instanceof w)
        throw t;
      console.warn(`OpenAI provider test request failed: ${t}`);
    }
  }
  /**
   * Выполнение запроса к OpenAI API для генерации эмбеддингов
   */
  async executeEmbeddingRequest(e) {
    if (!this.openaiConfig)
      throw new d(
        "Provider not initialized",
        this.name,
        "PROVIDER_NOT_INITIALIZED"
      );
    const t = {
      model: this.openaiConfig.model || this.model,
      input: e,
      encoding_format: "float"
    }, r = y[this.model];
    this.dimensions !== r.defaultDimensions && (t.dimensions = this.dimensions), this.openaiConfig.user && (t.user = this.openaiConfig.user);
    const s = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.openaiConfig.apiKey}`,
      "User-Agent": "LocalRetrieve/1.0.0"
    };
    this.openaiConfig.organization && (s["OpenAI-Organization"] = this.openaiConfig.organization), this.openaiConfig.headers && Object.assign(s, this.openaiConfig.headers);
    const i = `${this.openaiConfig.baseUrl}/embeddings`;
    try {
      const n = new AbortController(), a = setTimeout(() => {
        n.abort();
      }, this.openaiConfig.timeout), h = await fetch(i, {
        method: "POST",
        headers: s,
        body: JSON.stringify(t),
        signal: n.signal
      });
      clearTimeout(a);
      const m = await h.json();
      if (!h.ok)
        throw this.createErrorFromResponse(h.status, m);
      return this.processSuccessfulResponse(m);
    } catch (n) {
      throw n.name === "AbortError" ? new g(
        `Request timeout after ${this.openaiConfig.timeout}ms`,
        "timeout",
        void 0,
        i
      ) : n instanceof TypeError && n.message.includes("fetch") ? new g(
        "Network connection failed",
        "connection",
        void 0,
        i
      ) : n;
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
    return Object.entries(y).map(([e, t]) => ({
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
    const r = t.error?.message || "Unknown OpenAI API error", s = t.error?.type || "unknown", i = t.error?.code || "unknown";
    switch (e) {
      case 401:
        return new w(
          `OpenAI API authentication failed: ${r}`,
          "invalid_key",
          { provider: this.name, errorType: s, errorCode: i }
        );
      case 429:
        return r.includes("quota") || r.includes("billing") ? new v(
          `OpenAI API quota exceeded: ${r}`,
          "api_calls",
          0,
          0,
          void 0,
          { provider: this.name, errorType: s, errorCode: i }
        ) : new v(
          `OpenAI API rate limit exceeded: ${r}`,
          "api_calls",
          0,
          0,
          new Date(Date.now() + 6e4),
          // Retry after 1 minute
          { provider: this.name, errorType: s, errorCode: i }
        );
      case 400:
        return r.includes("dimensions") || r.includes("model") ? new f(
          `OpenAI API configuration error: ${r}`,
          t.error?.param || "unknown",
          void 0,
          void 0,
          { provider: this.name, errorType: s, errorCode: i }
        ) : new p(
          `OpenAI API validation error: ${r}`,
          t.error?.param || "input",
          "OpenAI API validation",
          { provider: this.name, errorType: s, errorCode: i }
        );
      case 500:
      case 502:
      case 503:
      case 504:
        return new g(
          `OpenAI API server error: ${r}`,
          "server_error",
          e,
          void 0,
          { provider: this.name, errorType: s, errorCode: i }
        );
      default:
        return new d(
          `OpenAI API error (${e}): ${r}`,
          this.name,
          "OPENAI_API_ERROR",
          void 0,
          { status: e, errorType: s, errorCode: i }
        );
    }
  }
  /**
   * Обработка успешного ответа от OpenAI API
   */
  processSuccessfulResponse(e) {
    if (!e.data || !Array.isArray(e.data))
      throw new d(
        "Invalid response format from OpenAI API",
        this.name,
        "INVALID_RESPONSE_FORMAT"
      );
    return e.data.sort((r, s) => r.index - s.index).map((r, s) => {
      if (!r.embedding || !Array.isArray(r.embedding))
        throw new d(
          `Invalid embedding format at index ${s}`,
          this.name,
          "INVALID_EMBEDDING_FORMAT"
        );
      if (r.embedding.length !== this.dimensions)
        throw new d(
          `Embedding dimension mismatch: expected ${this.dimensions}, got ${r.embedding.length}`,
          this.name,
          "DIMENSION_MISMATCH"
        );
      return new Float32Array(r.embedding);
    });
  }
  /**
   * Валидация конфигурации для OpenAI провайдера
   */
  validateConfig(e) {
    const t = super.validateConfig(e), r = [...t.errors], s = [...t.warnings], i = [...t.suggestions];
    e.apiKey ? e.apiKey.startsWith("sk-") || (s.push('OpenAI API key should start with "sk-"'), i.push("Verify API key format")) : (r.push("OpenAI API key is required"), i.push("Set apiKey in configuration"));
    const n = e.providerOptions?.model || this.model;
    if (n in y) {
      const a = y[n];
      a.supportedDimensions.includes(this.dimensions) || (r.push(`Model ${n} does not support ${this.dimensions} dimensions`), i.push(`Use one of: ${a.supportedDimensions.join(", ")}`));
    }
    return e.batchSize && e.batchSize > this.maxBatchSize && (s.push(`Batch size ${e.batchSize} may be inefficient for OpenAI API`), i.push(`Consider using batch size of ${Math.min(this.maxBatchSize, 50)} or less`)), {
      isValid: r.length === 0,
      errors: r,
      warnings: s,
      suggestions: i
    };
  }
}
function G(o, e = "text-embedding-3-small") {
  return new E(o, e);
}
function S(o, e) {
  return o in y ? y[o].supportedDimensions.includes(e) : !1;
}
function W(o) {
  const { dimensions: e = 384, budget: t = "medium", performance: r = "balanced" } = o;
  return t === "low" || r === "fast" ? {
    model: "text-embedding-3-small",
    dimensions: Math.min(e, 384),
    description: "Cost-effective option with good performance for most use cases"
  } : (t === "high" || r === "accurate") && e <= 1024 ? {
    model: "text-embedding-3-large",
    dimensions: e <= 256 ? 256 : e <= 512 ? 512 : 1024,
    description: "High-accuracy model for demanding applications"
  } : {
    model: "text-embedding-3-small",
    dimensions: e <= 384 ? 384 : e <= 768 ? 768 : 1536,
    description: "Balanced option providing good accuracy and reasonable cost"
  };
}
class z extends $ {
  constructor(e = {}) {
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
        throw new R(
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
      throw this._isReady = !1, t instanceof Error ? new R(
        `Ошибка инициализации Transformers.js провайдера: ${t.message}`,
        this.name,
        t,
        { config: this.config }
      ) : new R(
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
      throw new T(
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
      throw new d(
        "Провайдер не инициализирован. Вызовите initialize() перед использованием.",
        this.name,
        "NOT_INITIALIZED"
      );
    const t = Date.now();
    try {
      const r = await this.sendMessage("generateEmbedding", {
        text: e.trim()
      }, this.config.operationTimeout), s = Date.now() - t;
      this.updateMetrics(s, 1, !1);
      const i = new Float32Array(r.embedding);
      if (i.length !== this.dimensions)
        throw new d(
          `Неверная размерность эмбеддинга: получено ${i.length}, ожидалось ${this.dimensions}`,
          this.name,
          "INVALID_DIMENSIONS"
        );
      return i;
    } catch (r) {
      const s = Date.now() - t;
      throw this.updateMetrics(s, 1, !0), r instanceof Error ? r : new d(
        `Ошибка генерации эмбеддинга: ${r}`,
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
      throw new d(
        "Провайдер не инициализирован. Вызовите initialize() перед использованием.",
        this.name,
        "NOT_INITIALIZED"
      );
    const t = Date.now();
    try {
      const r = [], s = this.maxBatchSize;
      for (let n = 0; n < e.length; n += s) {
        const a = e.slice(n, n + s), h = await this.processBatchChunk(a);
        r.push(...h);
      }
      const i = Date.now() - t;
      return this.updateMetrics(i, e.length, !1), this.performanceMetrics.totalBatches += 1, this.performanceMetrics.averageBatchSize = (this.performanceMetrics.averageBatchSize * (this.performanceMetrics.totalBatches - 1) + e.length) / this.performanceMetrics.totalBatches, r;
    } catch (r) {
      const s = Date.now() - t;
      throw this.updateMetrics(s, e.length, !0), r instanceof Error ? r : new d(
        `Ошибка пакетной генерации эмбеддингов: ${r}`,
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
      texts: e.map((r) => r.trim())
    }, this.config.operationTimeout * Math.ceil(e.length / 4))).embeddings.map((r) => {
      const s = new Float32Array(r);
      if (s.length !== this.dimensions)
        throw new d(
          `Неверная размерность эмбеддинга: получено ${s.length}, ожидалось ${this.dimensions}`,
          this.name,
          "INVALID_DIMENSIONS"
        );
      return s;
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
      throw new d(
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
      const e = Date.now(), t = await this.sendMessage("healthCheck", {}, 5e3), r = Date.now() - e;
      return {
        isHealthy: !0,
        lastSuccessfulOperation: /* @__PURE__ */ new Date(),
        status: "ready",
        details: `Воркер отвечает за ${r}ms`,
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
  async sendMessage(e, t, r) {
    if (!this.worker)
      throw new T("Web Worker не создан", e);
    return new Promise((s, i) => {
      const n = `${e}_${++this.messageCounter}_${Date.now()}`, a = r || this.config.operationTimeout || 1e4, h = setTimeout(() => {
        this.pendingRequests.delete(n), i(new I(
          `Операция ${e} превысила таймаут ${a}ms`,
          a,
          e
        ));
      }, a);
      this.pendingRequests.set(n, {
        resolve: s,
        reject: i,
        timestamp: Date.now(),
        timeout: h
      });
      const m = { id: n, type: e, data: t };
      this.worker.postMessage(m);
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
      const r = new d(
        e.error || "Неизвестная ошибка воркера",
        this.name,
        "WORKER_ERROR"
      );
      t.reject(r);
    }
  }
  /**
   * Обработка ошибок воркера
   */
  handleWorkerError(e) {
    for (const [t, r] of this.pendingRequests)
      r.timeout && clearTimeout(r.timeout), r.reject(new T(
        `Worker error: ${e.message}`,
        "worker_error",
        void 0,
        { originalError: e.message }
      ));
    this.pendingRequests.clear(), this._isReady = !1;
  }
}
function Q(o) {
  return new z(o);
}
function b() {
  return typeof window < "u" && typeof Worker < "u" && typeof SharedArrayBuffer < "u" && typeof WebAssembly < "u";
}
function M() {
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
class c {
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
      algorithm: r = "SHA-256",
      includeTimestamp: s = !1,
      salt: i = "",
      includeDebugInfo: n = !1
    } = t, a = {
      text: e.text,
      provider: e.collectionConfig?.provider || e.globalConfig?.defaultProvider,
      model: e.collectionConfig?.model || e.globalConfig?.defaultModel,
      dimensions: e.collectionConfig?.dimensions || e.globalConfig?.defaultDimensions,
      textPreprocessing: e.collectionConfig?.textPreprocessing,
      additionalParams: e.additionalParams,
      salt: i
    };
    s && (a.timestamp = Date.now());
    const h = c.sortObjectKeys(a), m = JSON.stringify(h), C = `${r}:${m}`;
    if (c.hashCache.has(C))
      return c.hashCache.get(C);
    const P = {
      hash: await c.hashString(m, r),
      algorithm: r,
      timestamp: /* @__PURE__ */ new Date(),
      input: n ? h : void 0
    };
    return c.addToHashCache(C, P), P;
  }
  /**
   * Генерация хеша текста с учетом предобработки
   *
   * @param text - Исходный текст
   * @param processingConfig - Конфигурация предобработки
   * @param options - Опции хеширования
   * @returns Результат хеширования
   */
  static async generateTextHash(e, t, r = {}) {
    const s = {
      text: e,
      additionalParams: {
        textPreprocessing: t
      }
    };
    return c.generateCacheKey(s, r);
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
      return c.simpleHash(e);
    try {
      const s = new TextEncoder().encode(e), i = await crypto.subtle.digest(t, s);
      return Array.from(new Uint8Array(i)).map((a) => a.toString(16).padStart(2, "0")).join("");
    } catch (r) {
      return console.warn("Web Crypto API failed, using simple hash:", r), c.simpleHash(e);
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
    for (let r = 0; r < e.length; r++)
      t = (t << 5) + t + e.charCodeAt(r);
    return Math.abs(t).toString(16);
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
      return e.map((s) => c.sortObjectKeys(s));
    const t = Object.keys(e).sort(), r = {};
    for (const s of t)
      r[s] = c.sortObjectKeys(e[s]);
    return r;
  }
  /**
   * Добавление результата в кеш хешей
   *
   * @param key - Ключ кеша
   * @param result - Результат хеширования
   */
  static addToHashCache(e, t) {
    if (c.hashCache.size >= c.MAX_HASH_CACHE_SIZE) {
      const r = c.hashCache.keys().next().value;
      r !== void 0 && c.hashCache.delete(r);
    }
    c.hashCache.set(e, t);
  }
  /**
   * Очистка кеша хешей
   */
  static clearHashCache() {
    c.hashCache.clear();
  }
  /**
   * Валидация размерностей эмбеддинга
   *
   * @param embedding - Вектор эмбеддинга
   * @param expectedDimensions - Ожидаемая размерность
   * @returns Результат валидации
   */
  static validateEmbeddingDimensions(e, t) {
    const r = e.length, s = r === t;
    return {
      isValid: s,
      expectedDimensions: t,
      actualDimensions: r,
      error: s ? void 0 : `Expected ${t} dimensions, got ${r}`
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
      throw new p(
        "Provider is required in collection config",
        "provider",
        "must be specified"
      );
    if (!e.dimensions || e.dimensions <= 0)
      throw new p(
        "Dimensions must be a positive number",
        "dimensions",
        "dimensions > 0"
      );
    const t = [384, 512, 768, 1024, 1536, 3072];
    if (!t.includes(e.dimensions))
      throw new p(
        `Unsupported dimensions: ${e.dimensions}. Supported: ${t.join(", ")}`,
        "dimensions",
        `one of: ${t.join(", ")}`
      );
    if (e.batchSize && (e.batchSize <= 0 || e.batchSize > 1e3))
      throw new p(
        "Batch size must be between 1 and 1000",
        "batchSize",
        "1 <= batchSize <= 1000"
      );
    if (e.timeout && e.timeout < 1e3)
      throw new p(
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
    throw new p(
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
      return e.map((t) => c.deepClone(t));
    if (e instanceof Float32Array)
      return new Float32Array(e);
    if (typeof e == "object") {
      const t = {};
      for (const r in e)
        e.hasOwnProperty(r) && (t[r] = c.deepClone(e[r]));
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
    const r = c.deepClone(e);
    for (const s in t)
      if (t.hasOwnProperty(s)) {
        const i = t[s];
        i !== void 0 && (typeof i == "object" && !Array.isArray(i) && i !== null ? r[s] = c.mergeConfigs(
          r[s] || {},
          i
        ) : r[s] = i);
      }
    return r;
  }
  /**
   * Форматирование размера в человеко-читаемый формат
   *
   * @param bytes - Размер в байтах
   * @returns Отформатированная строка
   */
  static formatBytes(e) {
    if (e === 0) return "0 Bytes";
    const t = 1024, r = ["Bytes", "KB", "MB", "GB"], s = Math.floor(Math.log(e) / Math.log(t));
    return parseFloat((e / Math.pow(t, s)).toFixed(2)) + " " + r[s];
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
    const r = t / 60;
    return r < 60 ? `${r.toFixed(2)}m` : `${(r / 60).toFixed(2)}h`;
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
      webWorkers: c.supportsWebWorkers(),
      sharedArrayBuffer: c.supportsSharedArrayBuffer(),
      opfs: await c.supportsOPFS(),
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
    const t = Date.now().toString(36), r = Math.random().toString(36).substring(2);
    return `${e}_${t}_${r}`;
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
    let r;
    return (...s) => {
      clearTimeout(r), r = setTimeout(() => e(...s), t);
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
    let r = !1;
    return (...s) => {
      r || (e(...s), r = !0, setTimeout(() => r = !1, t));
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
class Z {
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
      throw new p(
        "Collection ID must be a non-empty string",
        "collectionId",
        "non-empty string"
      );
    if (!/^[a-zA-Z0-9_-]+$/.test(e))
      throw new p(
        "Collection ID can only contain letters, numbers, underscores and hyphens",
        "collectionId",
        "matching pattern: /^[a-zA-Z0-9_-]+$/"
      );
    if (e.length > 50)
      throw new p(
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
class q {
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
        throw new f(
          `Invalid provider configuration: ${t.errors.join(", ")}`,
          "provider",
          t.suggestions.join("; "),
          e.provider,
          {
            validation: t,
            config: { ...e, apiKey: e.apiKey ? "[REDACTED]" : void 0 }
          }
        );
      const r = this.checkProviderSupport(e.provider);
      if (!r.isSupported)
        throw new R(
          `Provider ${e.provider} is not supported: ${r.unsupportedReason}`,
          e.provider,
          void 0,
          {
            supportInfo: r,
            alternatives: r.alternatives
          }
        );
      let s;
      switch (e.provider) {
        case "transformers":
          s = await this.createTransformersProvider(e);
          break;
        case "openai":
          s = await this.createOpenAIProvider(e);
          break;
        default:
          throw new f(
            `Unsupported provider type: ${e.provider}`,
            "provider",
            "One of: transformers, openai",
            e.provider
          );
      }
      return await s.initialize({
        defaultProvider: e.provider,
        defaultDimensions: e.dimensions,
        apiKey: e.apiKey,
        batchSize: e.batchSize,
        timeout: e.timeout,
        enabled: e.autoGenerate,
        provider: e.provider
      }), s;
    } catch (t) {
      throw t instanceof Error && t.name.includes("Error") ? t : new R(
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
    const t = this.validateConfiguration(e), r = this.checkProviderSupport(e.provider);
    return t.isValid && r.isSupported;
  }
  /**
   * Получение доступных моделей для всех провайдеров
   */
  async getAvailableModels() {
    const e = [];
    return b() && e.push(M()), e.push(...E.getAvailableModels()), e;
  }
  /**
   * Получение моделей для конкретного провайдера
   */
  async getModelsForProvider(e) {
    switch (e) {
      case "transformers":
        return b() ? [M()] : [];
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
    const t = [], r = [], s = [];
    switch (e.provider || (t.push("Provider type is required"), s.push("Specify provider type (transformers, openai)")), (!e.dimensions || e.dimensions <= 0) && (t.push("Valid dimensions value is required"), s.push("Set dimensions to a positive integer")), e.provider) {
      case "transformers":
        this.validateTransformersConfig(e, t, r, s);
        break;
      case "openai":
        this.validateOpenAIConfig(e, t, r, s);
        break;
      default:
        e.provider && (t.push(`Unsupported provider: ${e.provider}`), s.push("Use one of: transformers, openai"));
    }
    return e.batchSize && e.batchSize > 100 && (r.push("Large batch sizes may impact performance"), s.push("Consider reducing batch size to 50 or less")), e.timeout && e.timeout < 5e3 && (r.push("Short timeout may cause frequent failures"), s.push("Consider increasing timeout to at least 10 seconds")), {
      isValid: t.length === 0,
      errors: t,
      warnings: r,
      suggestions: s
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
    const t = [], { dimensions: r = 384, budget: s = "medium", performance: i = "balanced", privacy: n = "any" } = e;
    if ((n === "local" || n === "any") && b() && r === 384 && t.push({
      provider: "transformers",
      dimensions: 384,
      reason: "Local processing for privacy, no API costs, works offline",
      priority: n === "local" ? 10 : 7,
      alternatives: []
    }), (n === "cloud" || n === "any") && ((s === "low" || i === "fast") && t.push({
      provider: "openai",
      model: "text-embedding-3-small",
      dimensions: Math.min(r, 384),
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
    }), (s === "high" || i === "accurate") && t.push({
      provider: "openai",
      model: "text-embedding-3-large",
      dimensions: Math.min(r, 1024),
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
      const a = W({ dimensions: r, budget: s, performance: i });
      t.push({
        provider: "openai",
        model: a.model,
        dimensions: a.dimensions,
        reason: a.description,
        priority: 6,
        alternatives: []
      });
    }
    return t.sort((a, h) => h.priority - a.priority);
  }
  /**
   * Создание Transformers.js провайдера
   */
  async createTransformersProvider(e) {
    if (e.dimensions !== 384)
      throw new f(
        "Transformers.js provider only supports 384 dimensions",
        "dimensions",
        "384",
        e.dimensions
      );
    return new z({
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
      throw new f(
        "OpenAI provider requires API key",
        "apiKey",
        "Valid OpenAI API key starting with sk-",
        void 0
      );
    const t = e.model || "text-embedding-3-small";
    if (!S(t, e.dimensions))
      throw new f(
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
  validateTransformersConfig(e, t, r, s) {
    e.dimensions !== 384 && (t.push("Transformers.js provider only supports 384 dimensions"), s.push("Set dimensions to 384 for Transformers.js provider")), e.apiKey && (r.push("API key is not needed for Transformers.js provider"), s.push("Remove apiKey from configuration for local provider")), e.model && e.model !== "all-MiniLM-L6-v2" && (r.push(`Model ${e.model} is not supported by Transformers.js provider`), s.push("Use default model or remove model specification")), b() || (t.push("Transformers.js is not supported in current environment"), s.push("Use a browser with Web Workers and SharedArrayBuffer support"));
  }
  /**
   * Валидация конфигурации OpenAI
   */
  validateOpenAIConfig(e, t, r, s) {
    e.apiKey ? e.apiKey.startsWith("sk-") || (r.push('OpenAI API key should start with "sk-"'), s.push("Verify API key format")) : (t.push("OpenAI provider requires API key"), s.push("Set apiKey in configuration"));
    const i = e.model || "text-embedding-3-small";
    S(i, e.dimensions) || (t.push(`Model ${i} does not support ${e.dimensions} dimensions`), s.push("Check supported dimensions for the selected model")), e.batchSize && e.batchSize > 100 && (r.push("Large batch sizes may be inefficient for OpenAI API"), s.push("Consider using batch size of 50 or less"));
  }
  /**
   * Проверка поддержки Transformers.js
   */
  checkTransformersSupport() {
    return b() ? {
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
      availableModels: b() ? [M()] : [],
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
const k = new q();
async function X(o) {
  return k.createProvider(o);
}
function J(o) {
  return k.validateConfiguration(o);
}
function Y(o) {
  return k.checkProviderSupport(o);
}
function ee(o) {
  return k.getProviderRecommendations(o);
}
function te() {
  return k.getAvailableProviders();
}
async function re() {
  return k.getAvailableModels();
}
export {
  w as A,
  $ as B,
  f as C,
  B as D,
  c as E,
  x as M,
  K as O,
  j as P,
  v as Q,
  z as T,
  p as V,
  u as W,
  l as a,
  H as b,
  V as c,
  _ as d,
  E as e,
  G as f,
  W as g,
  Q as h,
  S as i,
  q as j,
  X as k,
  Y as l,
  ee as m,
  te as n,
  re as o,
  k as p,
  A as q,
  d as r,
  I as s,
  Z as t,
  O as u,
  J as v,
  L as w,
  U as x
};
//# sourceMappingURL=ProviderFactory-Dn9twO4t.mjs.map
