/**
 * Классы ошибок для системы эмбеддингов LocalRetrieve
 *
 * Данный модуль предоставляет иерархию классов ошибок для различных
 * типов проблем, которые могут возникнуть при работе с эмбеддингами.
 */

/**
 * Базовый класс для всех ошибок системы эмбеддингов
 */
export class EmbeddingError extends Error {
  /** Код ошибки для программной обработки */
  public readonly code: string;

  /** Категория ошибки */
  public readonly category: ErrorCategory;

  /** Дополнительный контекст ошибки */
  public readonly context?: Record<string, any>;

  /** Информация о возможном восстановлении */
  public readonly recoveryInfo?: ErrorRecoveryInfo;

  /** Время возникновения ошибки */
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: string = 'EMBEDDING_ERROR',
    category: ErrorCategory = 'unknown',
    context?: Record<string, any>,
    recoveryInfo?: ErrorRecoveryInfo
  ) {
    super(message);
    this.name = 'EmbeddingError';
    this.code = code;
    this.category = category;
    this.context = context;
    this.recoveryInfo = recoveryInfo;
    this.timestamp = new Date();

    // Обеспечиваем правильный прототип для instanceof
    Object.setPrototypeOf(this, EmbeddingError.prototype);
  }

  /**
   * Создает JSON представление ошибки для логирования
   */
  toJSON(): ErrorJSON {
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
  getUserMessage(): string {
    switch (this.category) {
      case 'provider':
        return `Ошибка провайдера эмбеддингов: ${this.message}`;
      case 'network':
        return `Проблема с сетевым подключением: ${this.message}`;
      case 'configuration':
        return `Ошибка конфигурации: ${this.message}`;
      case 'validation':
        return `Неверные данные: ${this.message}`;
      case 'quota':
        return `Превышен лимит: ${this.message}`;
      case 'timeout':
        return `Превышено время ожидания: ${this.message}`;
      default:
        return this.message;
    }
  }
}

/**
 * Ошибки провайдера эмбеддингов
 */
export class ProviderError extends EmbeddingError {
  /** Имя провайдера */
  public readonly providerName: string;

  /** Версия модели (если применимо) */
  public readonly modelVersion?: string;

  constructor(
    message: string,
    providerName: string,
    code: string = 'PROVIDER_ERROR',
    modelVersion?: string,
    context?: Record<string, any>
  ) {
    super(
      message,
      code,
      'provider',
      { ...context, providerName, modelVersion },
      {
        canRetry: true,
        retryAfter: 1000,
        maxRetries: 3,
        fallbackAvailable: true
      }
    );
    this.name = 'ProviderError';
    this.providerName = providerName;
    this.modelVersion = modelVersion;

    Object.setPrototypeOf(this, ProviderError.prototype);
  }
}

/**
 * Ошибки инициализации провайдера
 */
export class ProviderInitializationError extends ProviderError {
  constructor(
    message: string,
    providerName: string,
    cause?: Error,
    context?: Record<string, any>
  ) {
    super(
      message,
      providerName,
      'PROVIDER_INIT_ERROR',
      undefined,
      { ...context, cause: cause?.message }
    );
    this.name = 'ProviderInitializationError';

    // Инициализация обычно не подлежит автоматическому повтору
    this.recoveryInfo = {
      canRetry: false,
      retryAfter: 0,
      maxRetries: 0,
      fallbackAvailable: true,
      userActionRequired: true,
      suggestedActions: [
        'Проверьте конфигурацию провайдера',
        'Убедитесь, что API ключ корректен',
        'Проверьте доступность сервиса'
      ]
    };

    Object.setPrototypeOf(this, ProviderInitializationError.prototype);
  }
}

/**
 * Ошибки загрузки модели
 */
export class ModelLoadError extends ProviderError {
  /** Имя модели */
  public readonly modelName: string;

  /** Размер модели в байтах */
  public readonly modelSize?: number;

  constructor(
    message: string,
    providerName: string,
    modelName: string,
    modelSize?: number,
    context?: Record<string, any>
  ) {
    super(
      message,
      providerName,
      'MODEL_LOAD_ERROR',
      undefined,
      { ...context, modelName, modelSize }
    );
    this.name = 'ModelLoadError';
    this.modelName = modelName;
    this.modelSize = modelSize;

    Object.setPrototypeOf(this, ModelLoadError.prototype);
  }
}

/**
 * Сетевые ошибки
 */
export class NetworkError extends EmbeddingError {
  /** HTTP статус код (если применимо) */
  public readonly statusCode?: number;

  /** URL запроса */
  public readonly url?: string;

  /** Тип сетевой ошибки */
  public readonly networkType: NetworkErrorType;

  constructor(
    message: string,
    networkType: NetworkErrorType,
    statusCode?: number,
    url?: string,
    context?: Record<string, any>
  ) {
    const code = `NETWORK_${networkType.toUpperCase()}_ERROR`;
    const retryAfter = NetworkError.getRetryDelay(statusCode, networkType);

    super(
      message,
      code,
      'network',
      { ...context, statusCode, url, networkType },
      {
        canRetry: NetworkError.isRetryable(statusCode, networkType),
        retryAfter,
        maxRetries: 5,
        fallbackAvailable: false
      }
    );

    this.name = 'NetworkError';
    this.statusCode = statusCode;
    this.url = url;
    this.networkType = networkType;

    Object.setPrototypeOf(this, NetworkError.prototype);
  }

  /**
   * Определяет, можно ли повторить запрос
   */
  private static isRetryable(statusCode?: number, networkType?: NetworkErrorType): boolean {
    if (networkType === 'timeout' || networkType === 'connection') {
      return true;
    }

    if (statusCode) {
      // Повторяем при серверных ошибках и некоторых клиентских
      return statusCode >= 500 || statusCode === 429 || statusCode === 408;
    }

    return false;
  }

  /**
   * Вычисляет задержку перед повтором
   */
  private static getRetryDelay(statusCode?: number, networkType?: NetworkErrorType): number {
    if (statusCode === 429) return 60000; // Rate limit - ждем минуту
    if (networkType === 'timeout') return 5000; // Timeout - ждем 5 секунд
    if (statusCode && statusCode >= 500) return 2000; // Server error - ждем 2 секунды
    return 1000; // По умолчанию 1 секунда
  }
}

/**
 * Ошибки аутентификации
 */
export class AuthenticationError extends EmbeddingError {
  /** Тип ошибки аутентификации */
  public readonly authType: AuthErrorType;

  constructor(
    message: string,
    authType: AuthErrorType,
    context?: Record<string, any>
  ) {
    super(
      message,
      'AUTH_ERROR',
      'authentication',
      { ...context, authType },
      {
        canRetry: false,
        retryAfter: 0,
        maxRetries: 0,
        fallbackAvailable: false,
        userActionRequired: true,
        suggestedActions: AuthenticationError.getSuggestedActions(authType)
      }
    );

    this.name = 'AuthenticationError';
    this.authType = authType;

    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }

  private static getSuggestedActions(authType: AuthErrorType): string[] {
    switch (authType) {
      case 'invalid_key':
        return ['Проверьте правильность API ключа', 'Убедитесь, что ключ не истек'];
      case 'expired_key':
        return ['Обновите API ключ', 'Проверьте дату истечения подписки'];
      case 'insufficient_permissions':
        return ['Проверьте права доступа', 'Обратитесь к администратору'];
      case 'quota_exceeded':
        return ['Проверьте лимиты использования', 'Обновите тарифный план'];
      default:
        return ['Проверьте настройки аутентификации'];
    }
  }
}

/**
 * Ошибки конфигурации
 */
export class ConfigurationError extends EmbeddingError {
  /** Имя некорректного параметра */
  public readonly parameterName: string;

  /** Ожидаемое значение или тип */
  public readonly expectedValue?: string;

  /** Текущее (неверное) значение */
  public readonly actualValue?: any;

  constructor(
    message: string,
    parameterName: string,
    expectedValue?: string,
    actualValue?: any,
    context?: Record<string, any>
  ) {
    super(
      message,
      'CONFIG_ERROR',
      'configuration',
      { ...context, parameterName, expectedValue, actualValue },
      {
        canRetry: false,
        retryAfter: 0,
        maxRetries: 0,
        fallbackAvailable: false,
        userActionRequired: true,
        suggestedActions: [
          `Исправьте параметр '${parameterName}'`,
          expectedValue ? `Ожидается: ${expectedValue}` : 'Проверьте документацию'
        ]
      }
    );

    this.name = 'ConfigurationError';
    this.parameterName = parameterName;
    this.expectedValue = expectedValue;
    this.actualValue = actualValue;

    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

/**
 * Ошибки валидации данных
 */
export class ValidationError extends EmbeddingError {
  /** Поле, которое не прошло валидацию */
  public readonly fieldName: string;

  /** Правило валидации, которое было нарушено */
  public readonly validationRule: string;

  constructor(
    message: string,
    fieldName: string,
    validationRule: string,
    context?: Record<string, any>
  ) {
    super(
      message,
      'VALIDATION_ERROR',
      'validation',
      { ...context, fieldName, validationRule },
      {
        canRetry: false,
        retryAfter: 0,
        maxRetries: 0,
        fallbackAvailable: false,
        userActionRequired: true,
        suggestedActions: [`Исправьте поле '${fieldName}' согласно правилу: ${validationRule}`]
      }
    );

    this.name = 'ValidationError';
    this.fieldName = fieldName;
    this.validationRule = validationRule;

    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/**
 * Ошибки превышения лимитов
 */
export class QuotaExceededError extends EmbeddingError {
  /** Тип превышенного лимита */
  public readonly quotaType: QuotaType;

  /** Текущее значение */
  public readonly currentValue: number;

  /** Максимально допустимое значение */
  public readonly maxValue: number;

  /** Время сброса лимита */
  public readonly resetTime?: Date;

  constructor(
    message: string,
    quotaType: QuotaType,
    currentValue: number,
    maxValue: number,
    resetTime?: Date,
    context?: Record<string, any>
  ) {
    const retryAfter = resetTime ? resetTime.getTime() - Date.now() : 3600000; // 1 час по умолчанию

    super(
      message,
      'QUOTA_EXCEEDED',
      'quota',
      { ...context, quotaType, currentValue, maxValue, resetTime },
      {
        canRetry: true,
        retryAfter: Math.max(retryAfter, 0),
        maxRetries: 1,
        fallbackAvailable: quotaType !== 'api_calls',
        suggestedActions: QuotaExceededError.getSuggestedActions(quotaType, resetTime)
      }
    );

    this.name = 'QuotaExceededError';
    this.quotaType = quotaType;
    this.currentValue = currentValue;
    this.maxValue = maxValue;
    this.resetTime = resetTime;

    Object.setPrototypeOf(this, QuotaExceededError.prototype);
  }

  private static getSuggestedActions(quotaType: QuotaType, resetTime?: Date): string[] {
    const actions = [`Превышен лимит: ${quotaType}`];

    if (resetTime) {
      actions.push(`Лимит будет сброшен: ${resetTime.toLocaleString()}`);
    }

    switch (quotaType) {
      case 'api_calls':
        actions.push('Подождите до сброса лимита или обновите тариф');
        break;
      case 'tokens':
        actions.push('Сократите размер текста или разбейте на части');
        break;
      case 'memory':
        actions.push('Очистите кэш или используйте меньшую модель');
        break;
      case 'concurrent_requests':
        actions.push('Дождитесь завершения текущих запросов');
        break;
    }

    return actions;
  }
}

/**
 * Ошибки тайм-аута
 */
export class TimeoutError extends EmbeddingError {
  /** Время ожидания в миллисекундах */
  public readonly timeoutMs: number;

  /** Операция, которая была прервана */
  public readonly operation: string;

  constructor(
    message: string,
    timeoutMs: number,
    operation: string,
    context?: Record<string, any>
  ) {
    super(
      message,
      'TIMEOUT_ERROR',
      'timeout',
      { ...context, timeoutMs, operation },
      {
        canRetry: true,
        retryAfter: Math.min(timeoutMs * 0.5, 5000), // Половина от таймаута, но не более 5 сек
        maxRetries: 3,
        fallbackAvailable: true,
        suggestedActions: [
          'Увеличьте таймаут в настройках',
          'Проверьте размер обрабатываемых данных',
          'Попробуйте разбить операцию на части'
        ]
      }
    );

    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
    this.operation = operation;

    Object.setPrototypeOf(this, TimeoutError.prototype);
  }
}

/**
 * Ошибки работы с кэшем
 */
export class CacheError extends EmbeddingError {
  /** Тип операции с кэшем */
  public readonly cacheOperation: CacheOperation;

  /** Ключ кэша */
  public readonly cacheKey?: string;

  constructor(
    message: string,
    cacheOperation: CacheOperation,
    cacheKey?: string,
    context?: Record<string, any>
  ) {
    super(
      message,
      'CACHE_ERROR',
      'cache',
      { ...context, cacheOperation, cacheKey },
      {
        canRetry: cacheOperation !== 'write', // Записи обычно не повторяем
        retryAfter: 1000,
        maxRetries: 2,
        fallbackAvailable: true // Можно работать без кэша
      }
    );

    this.name = 'CacheError';
    this.cacheOperation = cacheOperation;
    this.cacheKey = cacheKey;

    Object.setPrototypeOf(this, CacheError.prototype);
  }
}

/**
 * Ошибки работы с воркерами
 */
export class WorkerError extends EmbeddingError {
  /** Идентификатор воркера */
  public readonly workerId?: string;

  /** Тип операции воркера */
  public readonly workerOperation: string;

  constructor(
    message: string,
    workerOperation: string,
    workerId?: string,
    context?: Record<string, any>
  ) {
    super(
      message,
      'WORKER_ERROR',
      'worker',
      { ...context, workerOperation, workerId },
      {
        canRetry: true,
        retryAfter: 2000,
        maxRetries: 3,
        fallbackAvailable: false,
        suggestedActions: [
          'Перезагрузите страницу',
          'Проверьте поддержку Web Workers в браузере'
        ]
      }
    );

    this.name = 'WorkerError';
    this.workerId = workerId;
    this.workerOperation = workerOperation;

    Object.setPrototypeOf(this, WorkerError.prototype);
  }
}

// Типы для категоризации ошибок

export type ErrorCategory =
  | 'provider'        // Ошибки провайдера эмбеддингов
  | 'network'         // Сетевые ошибки
  | 'authentication' // Ошибки аутентификации
  | 'configuration'  // Ошибки конфигурации
  | 'validation'     // Ошибки валидации данных
  | 'quota'          // Превышение лимитов
  | 'timeout'        // Ошибки тайм-аута
  | 'cache'          // Ошибки кэширования
  | 'worker'         // Ошибки воркеров
  | 'unknown';       // Неизвестные ошибки

export type NetworkErrorType =
  | 'connection'     // Ошибки подключения
  | 'timeout'        // Таймауты сети
  | 'rate_limit'     // Превышение rate limit
  | 'server_error'   // Ошибки сервера (5xx)
  | 'client_error'   // Ошибки клиента (4xx)
  | 'dns'           // Ошибки DNS
  | 'ssl';          // Ошибки SSL/TLS

export type AuthErrorType =
  | 'invalid_key'               // Неверный API ключ
  | 'expired_key'               // Истекший ключ
  | 'insufficient_permissions'  // Недостаточно прав
  | 'quota_exceeded';           // Превышена квота

export type QuotaType =
  | 'api_calls'           // Лимит API вызовов
  | 'tokens'              // Лимит токенов
  | 'memory'              // Лимит памяти
  | 'concurrent_requests' // Лимит одновременных запросов
  | 'storage';            // Лимит хранилища

export type CacheOperation =
  | 'read'    // Чтение из кэша
  | 'write'   // Запись в кэш
  | 'delete'  // Удаление из кэша
  | 'clear'   // Очистка кэша
  | 'init';   // Инициализация кэша

// Интерфейсы для дополнительной информации

export interface ErrorRecoveryInfo {
  /** Можно ли автоматически повторить операцию */
  canRetry: boolean;

  /** Задержка перед повтором в миллисекундах */
  retryAfter: number;

  /** Максимальное количество попыток */
  maxRetries: number;

  /** Доступен ли fallback механизм */
  fallbackAvailable: boolean;

  /** Требуется ли действие пользователя */
  userActionRequired?: boolean;

  /** Предлагаемые действия для исправления */
  suggestedActions?: string[];
}

export interface ErrorJSON {
  name: string;
  message: string;
  code: string;
  category: ErrorCategory;
  context?: Record<string, any>;
  recoveryInfo?: ErrorRecoveryInfo;
  timestamp: string;
  stack?: string;
}

/**
 * Утилитарные функции для работы с ошибками
 */
export class ErrorUtils {
  /**
   * Проверяет, является ли ошибка ошибкой эмбеддингов
   */
  static isEmbeddingError(error: any): error is EmbeddingError {
    return error instanceof EmbeddingError;
  }

  /**
   * Проверяет, можно ли повторить операцию после ошибки
   */
  static canRetry(error: Error): boolean {
    if (ErrorUtils.isEmbeddingError(error)) {
      return error.recoveryInfo?.canRetry ?? false;
    }
    return false;
  }

  /**
   * Получает задержку перед повтором
   */
  static getRetryDelay(error: Error): number {
    if (ErrorUtils.isEmbeddingError(error)) {
      return error.recoveryInfo?.retryAfter ?? 1000;
    }
    return 1000;
  }

  /**
   * Получает максимальное количество повторов
   */
  static getMaxRetries(error: Error): number {
    if (ErrorUtils.isEmbeddingError(error)) {
      return error.recoveryInfo?.maxRetries ?? 3;
    }
    return 3;
  }

  /**
   * Создает пользовательски-дружественное сообщение об ошибке
   */
  static getUserMessage(error: Error): string {
    if (ErrorUtils.isEmbeddingError(error)) {
      return error.getUserMessage();
    }
    return error.message;
  }

  /**
   * Получает предлагаемые действия для исправления ошибки
   */
  static getSuggestedActions(error: Error): string[] {
    if (ErrorUtils.isEmbeddingError(error)) {
      return error.recoveryInfo?.suggestedActions ?? [];
    }
    return [];
  }

  /**
   * Конвертирует любую ошибку в EmbeddingError
   */
  static toEmbeddingError(error: any, defaultMessage: string = 'Unknown error'): EmbeddingError {
    if (ErrorUtils.isEmbeddingError(error)) {
      return error;
    }

    if (error instanceof Error) {
      return new EmbeddingError(
        error.message || defaultMessage,
        'UNKNOWN_ERROR',
        'unknown',
        { originalError: error.name, stack: error.stack }
      );
    }

    return new EmbeddingError(
      typeof error === 'string' ? error : defaultMessage,
      'UNKNOWN_ERROR',
      'unknown',
      { originalError: error }
    );
  }

  /**
   * Логирует ошибку с соответствующим уровнем
   */
  static logError(error: Error, logger?: Console): void {
    const log = logger || console;

    if (ErrorUtils.isEmbeddingError(error)) {
      const level = ErrorUtils.getLogLevel(error.category);
      const logMethod = log[level] || log.error;
      logMethod(`[${error.category.toUpperCase()}] ${error.name}: ${error.message}`, error.toJSON());
    } else {
      log.error('Unknown error:', error);
    }
  }

  /**
   * Определяет уровень логирования для категории ошибки
   */
  private static getLogLevel(category: ErrorCategory): 'error' | 'warn' | 'info' {
    switch (category) {
      case 'provider':
      case 'network':
      case 'authentication':
      case 'worker':
        return 'error';
      case 'quota':
      case 'timeout':
        return 'warn';
      case 'cache':
      case 'validation':
      case 'configuration':
        return 'info';
      default:
        return 'error';
    }
  }
}