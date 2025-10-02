let d = class extends Error {
  constructor(e, t, r) {
    super(e), this.code = t, this.details = r, this.name = "WorkerError";
  }
};
class $ extends d {
  constructor(e, t) {
    super(e, "DATABASE_ERROR"), this.sqliteCode = t, this.name = "DatabaseError";
  }
}
class z extends d {
  constructor(e) {
    super(e, "VECTOR_ERROR"), this.name = "VectorError";
  }
}
class q extends d {
  constructor(e) {
    super(e, "OPFS_ERROR"), this.name = "OPFSError";
  }
}
const P = {
  maxConcurrentOperations: 10,
  operationTimeout: 3e4,
  // 30 seconds
  enablePerformanceMonitoring: !0,
  logLevel: "info"
};
class S {
  constructor(e, t = {}) {
    this.pendingCalls = /* @__PURE__ */ new Map(), this.callCounter = 0, this.performanceMetrics = {
      totalCalls: 0,
      totalTime: 0,
      errors: 0,
      timeouts: 0
    }, this.worker = e, this.config = { ...P, ...t }, this.setupWorkerListeners();
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
      this.log("error", "Worker error:", e.message), this.rejectAllPending(new d("Worker error: " + e.message, "WORKER_ERROR"));
    }, this.worker.onmessageerror = (e) => {
      this.log("error", "Worker message error:", e), this.rejectAllPending(new d("Worker message error", "MESSAGE_ERROR"));
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
      const r = new d(
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
    return new Promise((r, i) => {
      if (this.pendingCalls.size >= this.config.maxConcurrentOperations) {
        this.log("error", `Rate limit exceeded for ${e}: ${this.pendingCalls.size}/${this.config.maxConcurrentOperations}`), i(new d(
          `Too many concurrent operations (max: ${this.config.maxConcurrentOperations})`,
          "RATE_LIMIT"
        ));
        return;
      }
      const s = this.generateCallId(), n = Date.now(), o = setTimeout(() => {
        this.log("error", `Operation timeout for ${e} after ${this.config.operationTimeout}ms`), this.pendingCalls.delete(s), this.performanceMetrics.timeouts++, i(new d(
          `Operation timeout after ${this.config.operationTimeout}ms`,
          "TIMEOUT"
        ));
      }, this.config.operationTimeout);
      this.pendingCalls.set(s, {
        resolve: r,
        reject: i,
        timeout: o,
        startTime: n
      });
      const h = {
        id: s,
        method: e,
        params: t
      };
      try {
        this.worker.postMessage(h);
      } catch (p) {
        this.log("error", `Failed to send RPC message for ${e}:`, p), this.pendingCalls.delete(s), clearTimeout(o), i(new d(
          `Failed to send message: ${p instanceof Error ? p.message : String(p)}`,
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
    const i = { debug: 0, info: 1, warn: 2, error: 3 }, s = i[this.config.logLevel];
    i[e] >= s && console[e](`[WorkerRPC] ${t}`, ...r);
  }
  // DBWorkerAPI implementation
  async open(e) {
    return this.call("open", e);
  }
  async close() {
    const e = await this.call("close");
    return this.rejectAllPending(new d("Worker closed", "WORKER_CLOSED")), e;
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
    this.rejectAllPending(new d("Worker terminated", "TERMINATED")), this.worker.terminate();
  }
}
class _ {
  constructor(e = {}) {
    this.handlers = /* @__PURE__ */ new Map(), this.config = { ...P, ...e }, this.setupMessageHandler();
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
        throw new d(`Unknown method: ${e.method}`, "UNKNOWN_METHOD");
      const i = await r(e.params);
      t = {
        id: e.id,
        result: i
      };
    } catch (r) {
      this.log("error", `Method ${e.method} failed:`, r), t = {
        id: e.id,
        error: {
          message: r instanceof Error ? r.message : String(r),
          code: r instanceof d ? r.code : "UNKNOWN_ERROR",
          stack: r instanceof Error ? r.stack : void 0
        }
      };
    }
    try {
      self.postMessage(t);
    } catch (r) {
      this.log("error", "Failed to post response:", r);
      const i = {
        id: e.id,
        error: {
          message: "Failed to serialize response",
          code: "SERIALIZATION_ERROR"
        }
      };
      try {
        self.postMessage(i);
      } catch (s) {
        this.log("error", "Failed to send error response:", s);
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
    const i = { debug: 0, info: 1, warn: 2, error: 3 }, s = i[this.config.logLevel];
    i[e] >= s && console[e](`[WorkerRPCHandler] ${t}`, ...r);
  }
}
function W(a, e) {
  const t = new Worker(a, { type: "module" });
  return new S(t, e);
}
class c extends Error {
  constructor(e, t = "EMBEDDING_ERROR", r = "unknown", i, s) {
    super(e), this.name = "EmbeddingError", this.code = t, this.category = r, this.context = i, this.recoveryInfo = s, this.timestamp = /* @__PURE__ */ new Date(), Object.setPrototypeOf(this, c.prototype);
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
class l extends c {
  constructor(e, t, r = "PROVIDER_ERROR", i, s) {
    super(
      e,
      r,
      "provider",
      { ...s, providerName: t, modelVersion: i },
      {
        canRetry: !0,
        retryAfter: 1e3,
        maxRetries: 3,
        fallbackAvailable: !0
      }
    ), this.name = "ProviderError", this.providerName = t, this.modelVersion = i, Object.setPrototypeOf(this, l.prototype);
  }
}
class v extends l {
  constructor(e, t, r, i) {
    super(
      e,
      t,
      "PROVIDER_INIT_ERROR",
      void 0,
      { ...i, cause: r?.message }
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
    }, Object.setPrototypeOf(this, v.prototype);
  }
}
class u extends c {
  constructor(e, t, r, i, s) {
    const n = `NETWORK_${t.toUpperCase()}_ERROR`, o = u.getRetryDelay(r, t);
    super(
      e,
      n,
      "network",
      { ...s, statusCode: r, url: i, networkType: t },
      {
        canRetry: u.isRetryable(r, t),
        retryAfter: o,
        maxRetries: 5,
        fallbackAvailable: !1
      }
    ), this.name = "NetworkError", this.statusCode = r, this.url = i, this.networkType = t, Object.setPrototypeOf(this, u.prototype);
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
class g extends c {
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
        suggestedActions: g.getSuggestedActions(t)
      }
    ), this.name = "AuthenticationError", this.authType = t, Object.setPrototypeOf(this, g.prototype);
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
class m extends c {
  constructor(e, t, r, i, s) {
    super(
      e,
      "CONFIG_ERROR",
      "configuration",
      { ...s, parameterName: t, expectedValue: r, actualValue: i },
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
    ), this.name = "ConfigurationError", this.parameterName = t, this.expectedValue = r, this.actualValue = i, Object.setPrototypeOf(this, m.prototype);
  }
}
class O extends c {
  constructor(e, t, r, i) {
    super(
      e,
      "VALIDATION_ERROR",
      "validation",
      { ...i, fieldName: t, validationRule: r },
      {
        canRetry: !1,
        retryAfter: 0,
        maxRetries: 0,
        fallbackAvailable: !1,
        userActionRequired: !0,
        suggestedActions: [`Исправьте поле '${t}' согласно правилу: ${r}`]
      }
    ), this.name = "ValidationError", this.fieldName = t, this.validationRule = r, Object.setPrototypeOf(this, O.prototype);
  }
}
class w extends c {
  constructor(e, t, r, i, s, n) {
    const o = s ? s.getTime() - Date.now() : 36e5;
    super(
      e,
      "QUOTA_EXCEEDED",
      "quota",
      { ...n, quotaType: t, currentValue: r, maxValue: i, resetTime: s },
      {
        canRetry: !0,
        retryAfter: Math.max(o, 0),
        maxRetries: 1,
        fallbackAvailable: t !== "api_calls",
        suggestedActions: w.getSuggestedActions(t, s)
      }
    ), this.name = "QuotaExceededError", this.quotaType = t, this.currentValue = r, this.maxValue = i, this.resetTime = s, Object.setPrototypeOf(this, w.prototype);
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
class R extends c {
  constructor(e, t, r, i) {
    super(
      e,
      "TIMEOUT_ERROR",
      "timeout",
      { ...i, timeoutMs: t, operation: r },
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
    ), this.name = "TimeoutError", this.timeoutMs = t, this.operation = r, Object.setPrototypeOf(this, R.prototype);
  }
}
class k extends c {
  constructor(e, t, r, i) {
    super(
      e,
      "WORKER_ERROR",
      "worker",
      { ...i, workerOperation: t, workerId: r },
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
    ), this.name = "WorkerError", this.workerId = r, this.workerOperation = t, Object.setPrototypeOf(this, k.prototype);
  }
}
class T {
  constructor(e, t, r = 32, i = 512) {
    this._isReady = !1, this.name = e, this.dimensions = t, this.maxBatchSize = r, this.maxTextLength = i, this.metrics = {
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
    const t = [], r = [], i = [];
    return !e.provider && !e.defaultProvider && t.push("Provider type is required"), e.timeout && e.timeout < 1e3 && (r.push("Timeout less than 1 second may cause frequent timeouts"), i.push("Consider increasing timeout to at least 5000ms")), e.batchSize && e.batchSize > this.maxBatchSize && (t.push(`Batch size ${e.batchSize} exceeds maximum ${this.maxBatchSize}`), i.push(`Set batch size to ${this.maxBatchSize} or less`)), {
      isValid: t.length === 0,
      errors: t,
      warnings: r,
      suggestions: i
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
      throw new c("Input text must be a non-empty string");
    if (e.trim().length === 0)
      throw new c("Input text cannot be empty or whitespace only");
    const t = e.length / 4;
    if (t > this.maxTextLength)
      throw new c(
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
      throw new c("Input must be an array of strings");
    if (e.length === 0)
      throw new c("Batch cannot be empty");
    if (e.length > this.maxBatchSize)
      throw new c(
        `Batch size ${e.length} exceeds maximum ${this.maxBatchSize}`
      );
    e.forEach((t, r) => {
      try {
        this.validateText(t);
      } catch (i) {
        throw new c(
          `Invalid text at index ${r}: ${i instanceof Error ? i.message : "Unknown error"}`
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
    const i = this.metrics.averageGenerationTime * this.metrics.totalEmbeddings;
    this.metrics.totalEmbeddings += t, this.metrics.averageGenerationTime = (i + e) / this.metrics.totalEmbeddings;
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
class N {
  /**
   * Нормализация вектора эмбеддинга
   *
   * @param embedding - Вектор для нормализации
   * @returns Нормализованный вектор
   */
  static normalizeEmbedding(e) {
    let t = 0;
    for (let i = 0; i < e.length; i++)
      t += e[i] * e[i];
    if (t = Math.sqrt(t), t === 0)
      throw new c("Cannot normalize zero vector");
    const r = new Float32Array(e.length);
    for (let i = 0; i < e.length; i++)
      r[i] = e[i] / t;
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
      throw new c("Vectors must have the same dimensions");
    let r = 0, i = 0, s = 0;
    for (let o = 0; o < e.length; o++)
      r += e[o] * t[o], i += e[o] * e[o], s += t[o] * t[o];
    return i = Math.sqrt(i), s = Math.sqrt(s), i === 0 || s === 0 ? 2 : 1 - r / (i * s);
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
    for (let i = 0; i < e; i++)
      r[i] = Math.random() * 2 - 1;
    return t ? this.normalizeEmbedding(r) : r;
  }
}
class y extends T {
  constructor(e, t, r = 16, i = 8192) {
    super(e, t, r, i), this.requestQueue = [], this.isProcessingQueue = !1, this.lastRequestTime = 0, this.retryStates = /* @__PURE__ */ new Map();
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
      throw new l(
        `Configuration validation failed: ${t.errors.join(", ")}`,
        this.name,
        "CONFIG_VALIDATION_ERROR"
      );
    if (!e.apiKey)
      throw new g(
        "API key is required for external providers",
        "invalid_key",
        { provider: this.name }
      );
    this.config = {
      ...y.DEFAULT_CONFIG,
      apiKey: e.apiKey,
      baseUrl: e.providerOptions?.baseUrl,
      timeout: e.timeout || y.DEFAULT_CONFIG.timeout,
      maxRetries: e.maxRetries || y.DEFAULT_CONFIG.maxRetries,
      enableRateLimit: e.providerOptions?.enableRateLimit ?? y.DEFAULT_CONFIG.enableRateLimit,
      requestsPerMinute: e.providerOptions?.requestsPerMinute || y.DEFAULT_CONFIG.requestsPerMinute,
      headers: e.providerOptions?.headers || {}
    }, this.config.enableRateLimit && this.initializeRateLimit(), await this.initializeProvider(this.config);
    const r = await this.healthCheck();
    if (!r.isHealthy)
      throw new l(
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
    const i = this.config?.maxRetries || 3;
    for (let s = 1; s <= i; s++)
      try {
        await this.waitForRateLimit();
        const n = await this.executeEmbeddingRequest([e]), o = Date.now() - t;
        return this.updateMetrics(o, 1, !1), this.updateApiMetrics(1, !0), n[0];
      } catch (n) {
        if (r = n, s < i && this.shouldRetry(n)) {
          const o = this.calculateRetryDelay(s, n);
          await this.sleep(o);
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
    const i = this.config?.maxRetries || 3;
    for (let s = 1; s <= i; s++)
      try {
        await this.waitForRateLimit();
        const n = await this.executeEmbeddingRequest(e), o = Date.now() - t;
        return this.updateMetrics(o, e.length, !1), this.updateApiMetrics(1, !0), n;
      } catch (n) {
        if (r = n, s < i && this.shouldRetry(n)) {
          const o = this.calculateRetryDelay(s, n);
          await this.sleep(o);
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
    return e instanceof g || e instanceof c && e.category === "configuration" ? !1 : e instanceof u ? e.recoveryInfo?.canRetry ?? !1 : e instanceof w || e instanceof R;
  }
  /**
   * Вычисление задержки для retry с exponential backoff
   */
  calculateRetryDelay(e, t) {
    let r = 1e3;
    if (t instanceof w && t.resetTime)
      return Math.max(t.resetTime.getTime() - Date.now(), 0);
    t instanceof u && (r = t.recoveryInfo?.retryAfter || 2e3), t instanceof R && (r = Math.min(t.timeoutMs * 0.5, 5e3));
    const i = Math.pow(2, e - 1) * r, s = Math.random() * 1e3;
    return Math.min(i + s, 3e4);
  }
  /**
   * Обертывание ошибок в специфичные типы
   */
  wrapError(e) {
    return e instanceof c ? e : e.message.includes("401") || e.message.includes("Unauthorized") ? new g(
      "Invalid API key or unauthorized access",
      "invalid_key",
      { provider: this.name, originalError: e.message }
    ) : e.message.includes("429") || e.message.includes("rate limit") ? new w(
      "API rate limit exceeded",
      "api_calls",
      0,
      this.rateLimitInfo?.limit || 0,
      this.rateLimitInfo?.resetTime,
      { provider: this.name, originalError: e.message }
    ) : e.message.includes("timeout") || e.name === "TimeoutError" ? new R(
      "Request timeout",
      this.config?.timeout || 3e4,
      "embedding_generation",
      { provider: this.name, originalError: e.message }
    ) : e.message.includes("fetch") || e.message.includes("network") ? new u(
      e.message,
      "connection",
      void 0,
      void 0,
      { provider: this.name }
    ) : new l(
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
const f = {
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
class I extends y {
  /**
   * Создание экземпляра OpenAI провайдера
   *
   * @param dimensions - Размерность векторов эмбеддингов
   * @param model - Модель OpenAI (по умолчанию text-embedding-3-small)
   */
  constructor(e, t = "text-embedding-3-small") {
    if (!(t in f))
      throw new m(
        `Unsupported OpenAI model: ${t}`,
        "model",
        `One of: ${Object.keys(f).join(", ")}`,
        t
      );
    const r = f[t];
    if (!r.supportedDimensions.includes(e))
      throw new m(
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
      throw new g(
        'Invalid OpenAI API key format. Must start with "sk-"',
        "invalid_key",
        { provider: this.name }
      );
    try {
      await this.executeEmbeddingRequest(["test"]);
    } catch (t) {
      if (t instanceof g)
        throw t;
      console.warn(`OpenAI provider test request failed: ${t}`);
    }
  }
  /**
   * Выполнение запроса к OpenAI API для генерации эмбеддингов
   */
  async executeEmbeddingRequest(e) {
    if (!this.openaiConfig)
      throw new l(
        "Provider not initialized",
        this.name,
        "PROVIDER_NOT_INITIALIZED"
      );
    const t = {
      model: this.openaiConfig.model || this.model,
      input: e,
      encoding_format: "float"
    }, r = f[this.model];
    this.dimensions !== r.defaultDimensions && (t.dimensions = this.dimensions), this.openaiConfig.user && (t.user = this.openaiConfig.user);
    const i = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.openaiConfig.apiKey}`,
      "User-Agent": "LocalRetrieve/1.0.0"
    };
    this.openaiConfig.organization && (i["OpenAI-Organization"] = this.openaiConfig.organization), this.openaiConfig.headers && Object.assign(i, this.openaiConfig.headers);
    const s = `${this.openaiConfig.baseUrl}/embeddings`;
    try {
      const n = new AbortController(), o = setTimeout(() => {
        n.abort();
      }, this.openaiConfig.timeout), h = await fetch(s, {
        method: "POST",
        headers: i,
        body: JSON.stringify(t),
        signal: n.signal
      });
      clearTimeout(o);
      const p = await h.json();
      if (!h.ok)
        throw this.createErrorFromResponse(h.status, p);
      return this.processSuccessfulResponse(p);
    } catch (n) {
      throw n.name === "AbortError" ? new u(
        `Request timeout after ${this.openaiConfig.timeout}ms`,
        "timeout",
        void 0,
        s
      ) : n instanceof TypeError && n.message.includes("fetch") ? new u(
        "Network connection failed",
        "connection",
        void 0,
        s
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
    return Object.entries(f).map(([e, t]) => ({
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
    const r = t.error?.message || "Unknown OpenAI API error", i = t.error?.type || "unknown", s = t.error?.code || "unknown";
    switch (e) {
      case 401:
        return new g(
          `OpenAI API authentication failed: ${r}`,
          "invalid_key",
          { provider: this.name, errorType: i, errorCode: s }
        );
      case 429:
        return r.includes("quota") || r.includes("billing") ? new w(
          `OpenAI API quota exceeded: ${r}`,
          "api_calls",
          0,
          0,
          void 0,
          { provider: this.name, errorType: i, errorCode: s }
        ) : new w(
          `OpenAI API rate limit exceeded: ${r}`,
          "api_calls",
          0,
          0,
          new Date(Date.now() + 6e4),
          // Retry after 1 minute
          { provider: this.name, errorType: i, errorCode: s }
        );
      case 400:
        return r.includes("dimensions") || r.includes("model") ? new m(
          `OpenAI API configuration error: ${r}`,
          t.error?.param || "unknown",
          void 0,
          void 0,
          { provider: this.name, errorType: i, errorCode: s }
        ) : new O(
          `OpenAI API validation error: ${r}`,
          t.error?.param || "input",
          "OpenAI API validation",
          { provider: this.name, errorType: i, errorCode: s }
        );
      case 500:
      case 502:
      case 503:
      case 504:
        return new u(
          `OpenAI API server error: ${r}`,
          "server_error",
          e,
          void 0,
          { provider: this.name, errorType: i, errorCode: s }
        );
      default:
        return new l(
          `OpenAI API error (${e}): ${r}`,
          this.name,
          "OPENAI_API_ERROR",
          void 0,
          { status: e, errorType: i, errorCode: s }
        );
    }
  }
  /**
   * Обработка успешного ответа от OpenAI API
   */
  processSuccessfulResponse(e) {
    if (!e.data || !Array.isArray(e.data))
      throw new l(
        "Invalid response format from OpenAI API",
        this.name,
        "INVALID_RESPONSE_FORMAT"
      );
    return e.data.sort((r, i) => r.index - i.index).map((r, i) => {
      if (!r.embedding || !Array.isArray(r.embedding))
        throw new l(
          `Invalid embedding format at index ${i}`,
          this.name,
          "INVALID_EMBEDDING_FORMAT"
        );
      if (r.embedding.length !== this.dimensions)
        throw new l(
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
    const t = super.validateConfig(e), r = [...t.errors], i = [...t.warnings], s = [...t.suggestions];
    e.apiKey ? e.apiKey.startsWith("sk-") || (i.push('OpenAI API key should start with "sk-"'), s.push("Verify API key format")) : (r.push("OpenAI API key is required"), s.push("Set apiKey in configuration"));
    const n = e.providerOptions?.model || this.model;
    if (n in f) {
      const o = f[n];
      o.supportedDimensions.includes(this.dimensions) || (r.push(`Model ${n} does not support ${this.dimensions} dimensions`), s.push(`Use one of: ${o.supportedDimensions.join(", ")}`));
    }
    return e.batchSize && e.batchSize > this.maxBatchSize && (i.push(`Batch size ${e.batchSize} may be inefficient for OpenAI API`), s.push(`Consider using batch size of ${Math.min(this.maxBatchSize, 50)} or less`)), {
      isValid: r.length === 0,
      errors: r,
      warnings: i,
      suggestions: s
    };
  }
}
function U(a, e = "text-embedding-3-small") {
  return new I(a, e);
}
function M(a, e) {
  return a in f ? f[a].supportedDimensions.includes(e) : !1;
}
function D(a) {
  const { dimensions: e = 384, budget: t = "medium", performance: r = "balanced" } = a;
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
class C extends T {
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
        throw new v(
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
      throw this._isReady = !1, t instanceof Error ? new v(
        `Ошибка инициализации Transformers.js провайдера: ${t.message}`,
        this.name,
        t,
        { config: this.config }
      ) : new v(
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
      throw new l(
        "Провайдер не инициализирован. Вызовите initialize() перед использованием.",
        this.name,
        "NOT_INITIALIZED"
      );
    const t = Date.now();
    try {
      const r = await this.sendMessage("generateEmbedding", {
        text: e.trim()
      }, this.config.operationTimeout), i = Date.now() - t;
      this.updateMetrics(i, 1, !1);
      const s = new Float32Array(r.embedding);
      if (s.length !== this.dimensions)
        throw new l(
          `Неверная размерность эмбеддинга: получено ${s.length}, ожидалось ${this.dimensions}`,
          this.name,
          "INVALID_DIMENSIONS"
        );
      return s;
    } catch (r) {
      const i = Date.now() - t;
      throw this.updateMetrics(i, 1, !0), r instanceof Error ? r : new l(
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
      throw new l(
        "Провайдер не инициализирован. Вызовите initialize() перед использованием.",
        this.name,
        "NOT_INITIALIZED"
      );
    const t = Date.now();
    try {
      const r = [], i = this.maxBatchSize;
      for (let n = 0; n < e.length; n += i) {
        const o = e.slice(n, n + i), h = await this.processBatchChunk(o);
        r.push(...h);
      }
      const s = Date.now() - t;
      return this.updateMetrics(s, e.length, !1), this.performanceMetrics.totalBatches += 1, this.performanceMetrics.averageBatchSize = (this.performanceMetrics.averageBatchSize * (this.performanceMetrics.totalBatches - 1) + e.length) / this.performanceMetrics.totalBatches, r;
    } catch (r) {
      const i = Date.now() - t;
      throw this.updateMetrics(i, e.length, !0), r instanceof Error ? r : new l(
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
      const i = new Float32Array(r);
      if (i.length !== this.dimensions)
        throw new l(
          `Неверная размерность эмбеддинга: получено ${i.length}, ожидалось ${this.dimensions}`,
          this.name,
          "INVALID_DIMENSIONS"
        );
      return i;
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
      throw new l(
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
      throw new k("Web Worker не создан", e);
    return new Promise((i, s) => {
      const n = `${e}_${++this.messageCounter}_${Date.now()}`, o = r || this.config.operationTimeout || 1e4, h = setTimeout(() => {
        this.pendingRequests.delete(n), s(new R(
          `Операция ${e} превысила таймаут ${o}ms`,
          o,
          e
        ));
      }, o);
      this.pendingRequests.set(n, {
        resolve: i,
        reject: s,
        timestamp: Date.now(),
        timeout: h
      });
      const p = { id: n, type: e, data: t };
      this.worker.postMessage(p);
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
      const r = new l(
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
      r.timeout && clearTimeout(r.timeout), r.reject(new k(
        `Worker error: ${e.message}`,
        "worker_error",
        void 0,
        { originalError: e.message }
      ));
    this.pendingRequests.clear(), this._isReady = !1;
  }
}
function F(a) {
  return new C(a);
}
function b() {
  return typeof window < "u" && typeof Worker < "u" && typeof SharedArrayBuffer < "u" && typeof WebAssembly < "u";
}
function E() {
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
class x {
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
        throw new m(
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
        throw new v(
          `Provider ${e.provider} is not supported: ${r.unsupportedReason}`,
          e.provider,
          void 0,
          {
            supportInfo: r,
            alternatives: r.alternatives
          }
        );
      let i;
      switch (e.provider) {
        case "transformers":
          i = await this.createTransformersProvider(e);
          break;
        case "openai":
          i = await this.createOpenAIProvider(e);
          break;
        default:
          throw new m(
            `Unsupported provider type: ${e.provider}`,
            "provider",
            "One of: transformers, openai",
            e.provider
          );
      }
      return await i.initialize({
        defaultProvider: e.provider,
        defaultDimensions: e.dimensions,
        apiKey: e.apiKey,
        batchSize: e.batchSize,
        timeout: e.timeout,
        enabled: e.autoGenerate,
        provider: e.provider
      }), i;
    } catch (t) {
      throw t instanceof Error && t.name.includes("Error") ? t : new v(
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
    return b() && e.push(E()), e.push(...I.getAvailableModels()), e;
  }
  /**
   * Получение моделей для конкретного провайдера
   */
  async getModelsForProvider(e) {
    switch (e) {
      case "transformers":
        return b() ? [E()] : [];
      case "openai":
        return I.getAvailableModels();
      default:
        return [];
    }
  }
  /**
   * Валидация конфигурации провайдера
   */
  validateConfiguration(e) {
    const t = [], r = [], i = [];
    switch (e.provider || (t.push("Provider type is required"), i.push("Specify provider type (transformers, openai)")), (!e.dimensions || e.dimensions <= 0) && (t.push("Valid dimensions value is required"), i.push("Set dimensions to a positive integer")), e.provider) {
      case "transformers":
        this.validateTransformersConfig(e, t, r, i);
        break;
      case "openai":
        this.validateOpenAIConfig(e, t, r, i);
        break;
      default:
        e.provider && (t.push(`Unsupported provider: ${e.provider}`), i.push("Use one of: transformers, openai"));
    }
    return e.batchSize && e.batchSize > 100 && (r.push("Large batch sizes may impact performance"), i.push("Consider reducing batch size to 50 or less")), e.timeout && e.timeout < 5e3 && (r.push("Short timeout may cause frequent failures"), i.push("Consider increasing timeout to at least 10 seconds")), {
      isValid: t.length === 0,
      errors: t,
      warnings: r,
      suggestions: i
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
    const t = [], { dimensions: r = 384, budget: i = "medium", performance: s = "balanced", privacy: n = "any" } = e;
    if ((n === "local" || n === "any") && b() && r === 384 && t.push({
      provider: "transformers",
      dimensions: 384,
      reason: "Local processing for privacy, no API costs, works offline",
      priority: n === "local" ? 10 : 7,
      alternatives: []
    }), (n === "cloud" || n === "any") && ((i === "low" || s === "fast") && t.push({
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
    }), (i === "high" || s === "accurate") && t.push({
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
    }), s === "balanced")) {
      const o = D({ dimensions: r, budget: i, performance: s });
      t.push({
        provider: "openai",
        model: o.model,
        dimensions: o.dimensions,
        reason: o.description,
        priority: 6,
        alternatives: []
      });
    }
    return t.sort((o, h) => h.priority - o.priority);
  }
  /**
   * Создание Transformers.js провайдера
   */
  async createTransformersProvider(e) {
    if (e.dimensions !== 384)
      throw new m(
        "Transformers.js provider only supports 384 dimensions",
        "dimensions",
        "384",
        e.dimensions
      );
    return new C({
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
      throw new m(
        "OpenAI provider requires API key",
        "apiKey",
        "Valid OpenAI API key starting with sk-",
        void 0
      );
    const t = e.model || "text-embedding-3-small";
    if (!M(t, e.dimensions))
      throw new m(
        `Model ${t} does not support ${e.dimensions} dimensions`,
        "dimensions",
        "Valid dimensions for the selected model",
        e.dimensions,
        { model: t, provider: "openai" }
      );
    return new I(e.dimensions, t);
  }
  /**
   * Валидация конфигурации Transformers.js
   */
  validateTransformersConfig(e, t, r, i) {
    e.dimensions !== 384 && (t.push("Transformers.js provider only supports 384 dimensions"), i.push("Set dimensions to 384 for Transformers.js provider")), e.apiKey && (r.push("API key is not needed for Transformers.js provider"), i.push("Remove apiKey from configuration for local provider")), e.model && e.model !== "all-MiniLM-L6-v2" && (r.push(`Model ${e.model} is not supported by Transformers.js provider`), i.push("Use default model or remove model specification")), b() || (t.push("Transformers.js is not supported in current environment"), i.push("Use a browser with Web Workers and SharedArrayBuffer support"));
  }
  /**
   * Валидация конфигурации OpenAI
   */
  validateOpenAIConfig(e, t, r, i) {
    e.apiKey ? e.apiKey.startsWith("sk-") || (r.push('OpenAI API key should start with "sk-"'), i.push("Verify API key format")) : (t.push("OpenAI provider requires API key"), i.push("Set apiKey in configuration"));
    const s = e.model || "text-embedding-3-small";
    M(s, e.dimensions) || (t.push(`Model ${s} does not support ${e.dimensions} dimensions`), i.push("Check supported dimensions for the selected model")), e.batchSize && e.batchSize > 100 && (r.push("Large batch sizes may be inefficient for OpenAI API"), i.push("Consider using batch size of 50 or less"));
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
      availableModels: b() ? [E()] : [],
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
      availableModels: I.getAvailableModels(),
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
const A = new x();
async function B(a) {
  return A.createProvider(a);
}
function j(a) {
  return A.validateConfiguration(a);
}
function V(a) {
  return A.checkProviderSupport(a);
}
function K(a) {
  return A.getProviderRecommendations(a);
}
function H() {
  return A.getAvailableProviders();
}
async function G() {
  return A.getAvailableModels();
}
export {
  g as A,
  T as B,
  m as C,
  $ as D,
  c as E,
  q as O,
  N as P,
  w as Q,
  C as T,
  O as V,
  d as W,
  z as a,
  S as b,
  W as c,
  I as d,
  U as e,
  F as f,
  D as g,
  x as h,
  M as i,
  B as j,
  V as k,
  K as l,
  H as m,
  G as n,
  y as o,
  A as p,
  l as q,
  R as r,
  _ as s,
  j as v
};
//# sourceMappingURL=ProviderFactory-CL7NNQM2.mjs.map
