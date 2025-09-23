/**
 * Базовый класс для внешних провайдеров эмбеддингов (API)
 *
 * Данный модуль предоставляет общую функциональность для всех провайдеров,
 * которые используют внешние API для генерации эмбеддингов.
 *
 * Ключевые возможности:
 * - Управление API ключами
 * - Rate limiting с exponential backoff
 * - Retry логика
 * - Метрики API запросов
 * - Обработка сетевых ошибок
 */

import { BaseEmbeddingProvider, ProviderHealthStatus, ProviderMetrics } from './BaseProvider.js';
import type { EmbeddingConfig } from '../types.js';
import {
  EmbeddingError,
  ProviderError,
  NetworkError,
  AuthenticationError,
  QuotaExceededError,
  TimeoutError
} from '../errors.js';

/**
 * Конфигурация для внешних API провайдеров
 */
export interface ExternalProviderConfig {
  /** API ключ (обязателен для внешних провайдеров) */
  apiKey: string;

  /** Базовый URL для API (опционально) */
  baseUrl?: string;

  /** Таймаут запросов в миллисекундах */
  timeout?: number;

  /** Максимальное количество попыток */
  maxRetries?: number;

  /** Включить ли rate limiting */
  enableRateLimit?: boolean;

  /** Лимит запросов в минуту */
  requestsPerMinute?: number;

  /** Дополнительные заголовки */
  headers?: Record<string, string>;
}

/**
 * Информация о rate limiting
 */
interface RateLimitInfo {
  /** Количество оставшихся запросов */
  remaining: number;

  /** Время сброса лимита */
  resetTime: Date;

  /** Максимальное количество запросов в периоде */
  limit: number;
}

/**
 * Состояние retry попыток
 */
interface RetryState {
  /** Текущая попытка */
  attempt: number;

  /** Время последней попытки */
  lastAttempt: Date;

  /** Задержка перед следующей попытками */
  nextDelay: number;
}

/**
 * Абстрактный базовый класс для внешних API провайдеров
 */
export abstract class ExternalProvider extends BaseEmbeddingProvider {
  protected config?: ExternalProviderConfig;
  protected rateLimitInfo?: RateLimitInfo;
  protected requestQueue: Array<() => void> = [];
  protected isProcessingQueue = false;
  protected lastRequestTime = 0;
  protected retryStates = new Map<string, RetryState>();

  // Конфигурация по умолчанию для внешних провайдеров
  private static readonly DEFAULT_CONFIG = {
    timeout: 30000,
    maxRetries: 3,
    enableRateLimit: true,
    requestsPerMinute: 60
  };

  constructor(
    name: string,
    dimensions: number,
    maxBatchSize: number = 16, // Меньший размер батча для API
    maxTextLength: number = 8192 // Больше символов для API
  ) {
    super(name, dimensions, maxBatchSize, maxTextLength);
  }

  /**
   * Инициализация внешнего провайдера
   */
  public async initialize(config: EmbeddingConfig): Promise<void> {
    // Валидация конфигурации
    const validation = this.validateConfig(config);
    if (!validation.isValid) {
      throw new ProviderError(
        `Configuration validation failed: ${validation.errors.join(', ')}`,
        this.name,
        'CONFIG_VALIDATION_ERROR'
      );
    }

    // Проверка обязательного API ключа
    if (!config.apiKey) {
      throw new AuthenticationError(
        'API key is required for external providers',
        'invalid_key',
        { provider: this.name }
      );
    }

    // Настройка конфигурации провайдера
    this.config = {
      ...ExternalProvider.DEFAULT_CONFIG,
      apiKey: config.apiKey,
      baseUrl: config.providerOptions?.baseUrl,
      timeout: config.timeout || ExternalProvider.DEFAULT_CONFIG.timeout,
      maxRetries: config.maxRetries || ExternalProvider.DEFAULT_CONFIG.maxRetries,
      enableRateLimit: config.providerOptions?.enableRateLimit ?? ExternalProvider.DEFAULT_CONFIG.enableRateLimit,
      requestsPerMinute: config.providerOptions?.requestsPerMinute || ExternalProvider.DEFAULT_CONFIG.requestsPerMinute,
      headers: config.providerOptions?.headers || {}
    };

    // Инициализация rate limiting
    if (this.config.enableRateLimit) {
      this.initializeRateLimit();
    }

    // Выполнение специфичной для провайдера инициализации
    await this.initializeProvider(this.config);

    // Проверка здоровья после инициализации
    const health = await this.healthCheck();
    if (!health.isHealthy) {
      throw new ProviderError(
        `Provider health check failed: ${health.details}`,
        this.name,
        'HEALTH_CHECK_FAILED'
      );
    }

    this._isReady = true;
  }

  /**
   * Генерация одного эмбеддинга с retry логикой
   */
  public async generateEmbedding(text: string): Promise<Float32Array> {
    this.validateText(text);

    const startTime = Date.now();
    let lastError: Error | null = null;

    const maxRetries = this.config?.maxRetries || 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Ожидание rate limit если необходимо
        await this.waitForRateLimit();

        // Выполнение запроса
        const embedding = await this.executeEmbeddingRequest([text]);

        // Обновление метрик
        const generationTime = Date.now() - startTime;
        this.updateMetrics(generationTime, 1, false);
        this.updateApiMetrics(1, true);

        return embedding[0];

      } catch (error) {
        lastError = error as Error;

        // Проверяем, можно ли повторить запрос
        if (attempt < maxRetries && this.shouldRetry(error as Error)) {
          const delay = this.calculateRetryDelay(attempt, error as Error);
          await this.sleep(delay);
          continue;
        }

        // Если все попытки исчерпаны или ошибка не подлежит повтору
        this.updateMetrics(Date.now() - startTime, 0, true);
        this.updateApiMetrics(1, false);
        throw this.wrapError(error as Error);
      }
    }

    // Этот код не должен выполняться, но добавляем для типизации
    throw this.wrapError(lastError || new Error('Unknown error during embedding generation'));
  }

  /**
   * Пакетная генерация эмбеддингов
   */
  public async generateBatch(texts: string[]): Promise<Float32Array[]> {
    this.validateBatch(texts);

    const startTime = Date.now();
    let lastError: Error | null = null;

    const maxRetries = this.config?.maxRetries || 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Ожидание rate limit если необходимо
        await this.waitForRateLimit();

        // Выполнение запроса
        const embeddings = await this.executeEmbeddingRequest(texts);

        // Обновление метрик
        const generationTime = Date.now() - startTime;
        this.updateMetrics(generationTime, texts.length, false);
        this.updateApiMetrics(1, true);

        return embeddings;

      } catch (error) {
        lastError = error as Error;

        // Проверяем, можно ли повторить запрос
        if (attempt < maxRetries && this.shouldRetry(error as Error)) {
          const delay = this.calculateRetryDelay(attempt, error as Error);
          await this.sleep(delay);
          continue;
        }

        // Если все попытки исчерпаны или ошибка не подлежит повтору
        this.updateMetrics(Date.now() - startTime, 0, true);
        this.updateApiMetrics(1, false);
        throw this.wrapError(error as Error);
      }
    }

    // Этот код не должен выполняться, но добавляем для типизации
    throw this.wrapError(lastError || new Error('Unknown error during batch embedding generation'));
  }

  /**
   * Проверка здоровья провайдера
   */
  public async healthCheck(): Promise<ProviderHealthStatus> {
    try {
      // Проверяем наличие конфигурации (не проверяем _isReady во время инициализации)
      if (!this.config) {
        return {
          isHealthy: false,
          status: 'error',
          details: 'Provider not initialized',
          connectionStatus: 'disconnected'
        };
      }

      // Выполняем специфичную для провайдера проверку
      const isHealthy = await this.checkProviderHealth();

      return {
        isHealthy,
        status: isHealthy ? 'ready' : 'error',
        lastSuccessfulOperation: this.getLastSuccessfulOperation(),
        connectionStatus: isHealthy ? 'connected' : 'disconnected',
        details: isHealthy ? 'Provider is healthy' : 'Provider health check failed'
      };

    } catch (error) {
      return {
        isHealthy: false,
        status: 'error',
        details: error instanceof Error ? error.message : 'Unknown health check error',
        connectionStatus: 'disconnected'
      };
    }
  }

  /**
   * Получение метрик с информацией об API
   */
  public getMetrics(): ProviderMetrics {
    const baseMetrics = super.getMetrics();

    return {
      ...baseMetrics,
      apiRequestCount: this.getApiRequestCount(),
      rateLimitStatus: this.rateLimitInfo ? {
        remaining: this.rateLimitInfo.remaining,
        resetTime: this.rateLimitInfo.resetTime
      } : undefined
    };
  }

  /**
   * Очистка ресурсов
   */
  public async cleanup(): Promise<void> {
    // Очищаем очередь запросов
    this.requestQueue = [];
    this.isProcessingQueue = false;

    // Очищаем состояния retry
    this.retryStates.clear();

    // Сбрасываем готовность
    this._isReady = false;

    // Выполняем специфичную для провайдера очистку
    await this.cleanupProvider();
  }

  // Абстрактные методы для реализации в дочерних классах

  /**
   * Инициализация специфичная для провайдера
   */
  protected abstract initializeProvider(config: ExternalProviderConfig): Promise<void>;

  /**
   * Выполнение запроса к API для генерации эмбеддингов
   */
  protected abstract executeEmbeddingRequest(texts: string[]): Promise<Float32Array[]>;

  /**
   * Проверка здоровья специфичная для провайдера
   */
  protected abstract checkProviderHealth(): Promise<boolean>;

  /**
   * Очистка ресурсов специфичная для провайдера
   */
  protected abstract cleanupProvider(): Promise<void>;

  // Приватные методы для управления rate limiting и retry логикой

  /**
   * Инициализация rate limiting
   */
  private initializeRateLimit(): void {
    const requestsPerMinute = this.config?.requestsPerMinute || 60;
    this.rateLimitInfo = {
      remaining: requestsPerMinute,
      resetTime: new Date(Date.now() + 60000), // Сброс через минуту
      limit: requestsPerMinute
    };
  }

  /**
   * Ожидание rate limit
   */
  private async waitForRateLimit(): Promise<void> {
    if (!this.config?.enableRateLimit || !this.rateLimitInfo) {
      return;
    }

    // Проверяем, нужно ли сбросить счетчик
    if (Date.now() >= this.rateLimitInfo.resetTime.getTime()) {
      this.rateLimitInfo.remaining = this.rateLimitInfo.limit;
      this.rateLimitInfo.resetTime = new Date(Date.now() + 60000);
    }

    // Если нет оставшихся запросов, ждем до сброса
    if (this.rateLimitInfo.remaining <= 0) {
      const waitTime = this.rateLimitInfo.resetTime.getTime() - Date.now();
      if (waitTime > 0) {
        await this.sleep(waitTime);
        // После ожидания сбрасываем счетчик
        this.rateLimitInfo.remaining = this.rateLimitInfo.limit;
        this.rateLimitInfo.resetTime = new Date(Date.now() + 60000);
      }
    }

    // Уменьшаем счетчик оставшихся запросов
    this.rateLimitInfo.remaining--;
  }

  /**
   * Проверка, можно ли повторить запрос после ошибки
   */
  private shouldRetry(error: Error): boolean {
    // Не повторяем при ошибках аутентификации
    if (error instanceof AuthenticationError) {
      return false;
    }

    // Не повторяем при ошибках конфигурации
    if (error instanceof EmbeddingError && error.category === 'configuration') {
      return false;
    }

    // Повторяем при сетевых ошибках
    if (error instanceof NetworkError) {
      return error.recoveryInfo?.canRetry ?? false;
    }

    // Повторяем при превышении квот (rate limit)
    if (error instanceof QuotaExceededError) {
      return true;
    }

    // Повторяем при таймаутах
    if (error instanceof TimeoutError) {
      return true;
    }

    // По умолчанию не повторяем
    return false;
  }

  /**
   * Вычисление задержки для retry с exponential backoff
   */
  private calculateRetryDelay(attempt: number, error: Error): number {
    // Базовая задержка
    let baseDelay = 1000;

    // Увеличиваем задержку для разных типов ошибок
    if (error instanceof QuotaExceededError && error.resetTime) {
      // Для rate limit ждем до сброса
      return Math.max(error.resetTime.getTime() - Date.now(), 0);
    }

    if (error instanceof NetworkError) {
      baseDelay = error.recoveryInfo?.retryAfter || 2000;
    }

    if (error instanceof TimeoutError) {
      baseDelay = Math.min(error.timeoutMs * 0.5, 5000);
    }

    // Exponential backoff: 2^attempt * baseDelay + jitter
    const exponentialDelay = Math.pow(2, attempt - 1) * baseDelay;
    const jitter = Math.random() * 1000; // Добавляем случайность

    return Math.min(exponentialDelay + jitter, 30000); // Максимум 30 секунд
  }

  /**
   * Обертывание ошибок в специфичные типы
   */
  private wrapError(error: Error): EmbeddingError {
    if (error instanceof EmbeddingError) {
      return error;
    }

    // Обработка стандартных HTTP ошибок
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      return new AuthenticationError(
        'Invalid API key or unauthorized access',
        'invalid_key',
        { provider: this.name, originalError: error.message }
      );
    }

    if (error.message.includes('429') || error.message.includes('rate limit')) {
      return new QuotaExceededError(
        'API rate limit exceeded',
        'api_calls',
        0,
        this.rateLimitInfo?.limit || 0,
        this.rateLimitInfo?.resetTime,
        { provider: this.name, originalError: error.message }
      );
    }

    if (error.message.includes('timeout') || error.name === 'TimeoutError') {
      return new TimeoutError(
        'Request timeout',
        this.config?.timeout || 30000,
        'embedding_generation',
        { provider: this.name, originalError: error.message }
      );
    }

    // Сетевые ошибки
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return new NetworkError(
        error.message,
        'connection',
        undefined,
        undefined,
        { provider: this.name }
      );
    }

    // Общая ошибка провайдера
    return new ProviderError(
      error.message,
      this.name,
      'UNKNOWN_PROVIDER_ERROR',
      undefined,
      { originalError: error.message, stack: error.stack }
    );
  }

  /**
   * Обновление метрик API запросов
   */
  private updateApiMetrics(requestCount: number, success: boolean): void {
    if (!this.metrics.apiRequestCount) {
      this.metrics.apiRequestCount = 0;
    }
    this.metrics.apiRequestCount += requestCount;

    if (success) {
      (this.metrics as any).lastSuccessfulOperation = new Date();
    }
  }

  /**
   * Получение количества API запросов
   */
  private getApiRequestCount(): number {
    return this.metrics.apiRequestCount || 0;
  }

  /**
   * Получение времени последней успешной операции
   */
  private getLastSuccessfulOperation(): Date | undefined {
    return (this.metrics as any).lastSuccessfulOperation;
  }

  /**
   * Утилита для задержки
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}