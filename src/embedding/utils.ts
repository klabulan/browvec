/**
 * Утилиты для системы эмбеддингов LocalRetrieve
 *
 * Данный модуль предоставляет вспомогательные функции для работы с эмбеддингами,
 * включая хеширование, валидацию, конвертацию данных и другие служебные операции.
 */

import type { CollectionEmbeddingConfig, EmbeddingConfig, Collection } from './types.js';
import { ValidationError, EmbeddingError } from './errors.js';

/**
 * Результат хеширования
 */
export interface HashResult {
  /** Хеш в виде hex строки */
  hash: string;

  /** Алгоритм хеширования */
  algorithm: string;

  /** Время создания хеша */
  timestamp: Date;

  /** Входные данные для хеширования (для отладки) */
  input?: any;
}

/**
 * Опции для генерации хеша
 */
export interface HashOptions {
  /** Алгоритм хеширования */
  algorithm?: 'SHA-256' | 'SHA-1' | 'MD5';

  /** Включать ли timestamp в хеш */
  includeTimestamp?: boolean;

  /** Дополнительный salt для хеширования */
  salt?: string;

  /** Включать ли отладочную информацию */
  includeDebugInfo?: boolean;
}

/**
 * Конфигурация для хеша кеша
 */
export interface CacheKeyConfig {
  /** Текст для хеширования */
  text: string;

  /** Конфигурация коллекции */
  collectionConfig?: CollectionEmbeddingConfig;

  /** Глобальная конфигурация */
  globalConfig?: EmbeddingConfig;

  /** Дополнительные параметры */
  additionalParams?: Record<string, any>;
}

/**
 * Результат валидации размерностей
 */
export interface DimensionValidationResult {
  /** Валидны ли размерности */
  isValid: boolean;

  /** Ожидаемая размерность */
  expectedDimensions: number;

  /** Фактическая размерность */
  actualDimensions: number;

  /** Сообщение об ошибке */
  error?: string;
}

/**
 * Метаданные производительности
 */
export interface PerformanceMetrics {
  /** Время начала операции */
  startTime: number;

  /** Время окончания операции */
  endTime?: number;

  /** Длительность в миллисекундах */
  duration?: number;

  /** Название операции */
  operation: string;

  /** Дополнительные данные */
  metadata?: Record<string, any>;
}

/**
 * Основной класс утилит для эмбеддингов
 */
export class EmbeddingUtils {
  /** Кеш для часто используемых хешей */
  private static hashCache = new Map<string, HashResult>();

  /** Максимальный размер кеша хешей */
  private static readonly MAX_HASH_CACHE_SIZE = 1000;

  /**
   * Генерация стабильного хеша для ключа кеша
   *
   * @param config - Конфигурация для генерации ключа
   * @param options - Опции хеширования
   * @returns Результат хеширования
   */
  public static async generateCacheKey(
    config: CacheKeyConfig,
    options: HashOptions = {}
  ): Promise<HashResult> {
    const {
      algorithm = 'SHA-256',
      includeTimestamp = false,
      salt = '',
      includeDebugInfo = false
    } = options;

    // Создаем стабильный объект для хеширования
    const hashInput: {
      text: string;
      provider?: string;
      model?: string;
      dimensions?: number;
      textPreprocessing?: any;
      additionalParams?: Record<string, any>;
      salt: string;
      timestamp?: number;
    } = {
      text: config.text,
      provider: config.collectionConfig?.provider || config.globalConfig?.defaultProvider,
      model: config.collectionConfig?.model || config.globalConfig?.defaultModel,
      dimensions: config.collectionConfig?.dimensions || config.globalConfig?.defaultDimensions,
      textPreprocessing: config.collectionConfig?.textPreprocessing,
      additionalParams: config.additionalParams,
      salt
    };

    if (includeTimestamp) {
      hashInput.timestamp = Date.now();
    }

    // Сортируем ключи для стабильности
    const sortedInput = EmbeddingUtils.sortObjectKeys(hashInput);
    const inputString = JSON.stringify(sortedInput);

    // Проверяем кеш
    const cacheKey = `${algorithm}:${inputString}`;
    if (EmbeddingUtils.hashCache.has(cacheKey)) {
      return EmbeddingUtils.hashCache.get(cacheKey)!;
    }

    // Генерируем хеш
    const hash = await EmbeddingUtils.hashString(inputString, algorithm);

    const result: HashResult = {
      hash,
      algorithm,
      timestamp: new Date(),
      input: includeDebugInfo ? sortedInput : undefined
    };

    // Сохраняем в кеш
    EmbeddingUtils.addToHashCache(cacheKey, result);

    return result;
  }

  /**
   * Генерация хеша текста с учетом предобработки
   *
   * @param text - Исходный текст
   * @param processingConfig - Конфигурация предобработки
   * @param options - Опции хеширования
   * @returns Результат хеширования
   */
  public static async generateTextHash(
    text: string,
    processingConfig?: any, // Избегаем циклической зависимости
    options: HashOptions = {}
  ): Promise<HashResult> {
    const config: CacheKeyConfig = {
      text,
      additionalParams: {
        textPreprocessing: processingConfig
      }
    };

    return EmbeddingUtils.generateCacheKey(config, options);
  }

  /**
   * Хеширование строки с использованием Web Crypto API
   *
   * @param input - Строка для хеширования
   * @param algorithm - Алгоритм хеширования
   * @returns Хеш в виде hex строки
   */
  public static async hashString(input: string, algorithm: string = 'SHA-256'): Promise<string> {
    // Проверяем поддержку Web Crypto API
    if (typeof crypto === 'undefined' || !crypto.subtle) {
      // Fallback для старых браузеров
      return EmbeddingUtils.simpleHash(input);
    }

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(input);
      const hashBuffer = await crypto.subtle.digest(algorithm, data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      // Fallback в случае ошибки
      console.warn('Web Crypto API failed, using simple hash:', error);
      return EmbeddingUtils.simpleHash(input);
    }
  }

  /**
   * Простой хеш для fallback (djb2 algorithm)
   *
   * @param input - Строка для хеширования
   * @returns Хеш в виде hex строки
   */
  private static simpleHash(input: string): string {
    let hash = 5381;
    for (let i = 0; i < input.length; i++) {
      hash = ((hash << 5) + hash) + input.charCodeAt(i);
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Сортировка ключей объекта для стабильного хеширования
   *
   * @param obj - Объект для сортировки
   * @returns Объект с отсортированными ключами
   */
  private static sortObjectKeys(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => EmbeddingUtils.sortObjectKeys(item));
    }

    const sortedKeys = Object.keys(obj).sort();
    const sortedObj: any = {};

    for (const key of sortedKeys) {
      sortedObj[key] = EmbeddingUtils.sortObjectKeys(obj[key]);
    }

    return sortedObj;
  }

  /**
   * Добавление результата в кеш хешей
   *
   * @param key - Ключ кеша
   * @param result - Результат хеширования
   */
  private static addToHashCache(key: string, result: HashResult): void {
    // Очищаем кеш если он переполнен
    if (EmbeddingUtils.hashCache.size >= EmbeddingUtils.MAX_HASH_CACHE_SIZE) {
      const firstKey = EmbeddingUtils.hashCache.keys().next().value;
      if (firstKey !== undefined) {
        EmbeddingUtils.hashCache.delete(firstKey);
      }
    }

    EmbeddingUtils.hashCache.set(key, result);
  }

  /**
   * Очистка кеша хешей
   */
  public static clearHashCache(): void {
    EmbeddingUtils.hashCache.clear();
  }

  /**
   * Валидация размерностей эмбеддинга
   *
   * @param embedding - Вектор эмбеддинга
   * @param expectedDimensions - Ожидаемая размерность
   * @returns Результат валидации
   */
  public static validateEmbeddingDimensions(
    embedding: Float32Array | number[],
    expectedDimensions: number
  ): DimensionValidationResult {
    const actualDimensions = embedding.length;
    const isValid = actualDimensions === expectedDimensions;

    return {
      isValid,
      expectedDimensions,
      actualDimensions,
      error: isValid ? undefined : `Expected ${expectedDimensions} dimensions, got ${actualDimensions}`
    };
  }

  /**
   * Валидация конфигурации коллекции
   *
   * @param config - Конфигурация коллекции
   * @throws {ValidationError} При невалидной конфигурации
   */
  public static validateCollectionConfig(config: CollectionEmbeddingConfig): void {
    if (!config.provider) {
      throw new ValidationError(
        'Provider is required in collection config',
        'provider',
        'must be specified'
      );
    }

    if (!config.dimensions || config.dimensions <= 0) {
      throw new ValidationError(
        'Dimensions must be a positive number',
        'dimensions',
        'dimensions > 0'
      );
    }

    // Проверяем поддерживаемые размерности
    const supportedDimensions = [384, 512, 768, 1024, 1536, 3072];
    if (!supportedDimensions.includes(config.dimensions)) {
      throw new ValidationError(
        `Unsupported dimensions: ${config.dimensions}. Supported: ${supportedDimensions.join(', ')}`,
        'dimensions',
        `one of: ${supportedDimensions.join(', ')}`
      );
    }

    if (config.batchSize && (config.batchSize <= 0 || config.batchSize > 1000)) {
      throw new ValidationError(
        'Batch size must be between 1 and 1000',
        'batchSize',
        '1 <= batchSize <= 1000'
      );
    }

    if (config.timeout && config.timeout < 1000) {
      throw new ValidationError(
        'Timeout must be at least 1000ms',
        'timeout',
        'timeout >= 1000'
      );
    }
  }

  /**
   * Конвертация массива чисел в Float32Array
   *
   * @param array - Массив чисел
   * @returns Float32Array
   */
  public static toFloat32Array(array: number[] | Float32Array): Float32Array {
    if (array instanceof Float32Array) {
      return array;
    }

    if (Array.isArray(array)) {
      return new Float32Array(array);
    }

    throw new ValidationError(
      'Input must be an array of numbers or Float32Array',
      'array',
      'Array<number> | Float32Array'
    );
  }

  /**
   * Создание глубокой копии объекта
   *
   * @param obj - Объект для копирования
   * @returns Глубокая копия объекта
   */
  public static deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime()) as unknown as T;
    }

    if (obj instanceof Array) {
      return obj.map(item => EmbeddingUtils.deepClone(item)) as unknown as T;
    }

    if (obj instanceof Float32Array) {
      return new Float32Array(obj) as unknown as T;
    }

    if (typeof obj === 'object') {
      const copy = {} as { [K in keyof T]: T[K] };
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          copy[key] = EmbeddingUtils.deepClone(obj[key]);
        }
      }
      return copy;
    }

    return obj;
  }

  /**
   * Слияние конфигураций с приоритетом
   *
   * @param base - Базовая конфигурация
   * @param override - Переопределяющая конфигурация
   * @returns Объединенная конфигурация
   */
  public static mergeConfigs<T extends Record<string, any>>(
    base: Partial<T>,
    override: Partial<T>
  ): T {
    const result = EmbeddingUtils.deepClone(base) as T;

    for (const key in override) {
      if (override.hasOwnProperty(key)) {
        const overrideValue = override[key];
        if (overrideValue !== undefined) {
          if (typeof overrideValue === 'object' && !Array.isArray(overrideValue) && overrideValue !== null) {
            // Рекурсивное слияние для объектов
            (result as any)[key] = EmbeddingUtils.mergeConfigs(
              ((result as any)[key] as Record<string, any>) || {},
              overrideValue as Record<string, any>
            );
          } else {
            // Прямое переопределение для примитивов и массивов
            (result as any)[key] = overrideValue;
          }
        }
      }
    }

    return result;
  }

  /**
   * Форматирование размера в человеко-читаемый формат
   *
   * @param bytes - Размер в байтах
   * @returns Отформатированная строка
   */
  public static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Форматирование времени в человеко-читаемый формат
   *
   * @param milliseconds - Время в миллисекундах
   * @returns Отформатированная строка
   */
  public static formatDuration(milliseconds: number): string {
    if (milliseconds < 1000) {
      return `${Math.round(milliseconds)}ms`;
    }

    const seconds = milliseconds / 1000;
    if (seconds < 60) {
      return `${seconds.toFixed(2)}s`;
    }

    const minutes = seconds / 60;
    if (minutes < 60) {
      return `${minutes.toFixed(2)}m`;
    }

    const hours = minutes / 60;
    return `${hours.toFixed(2)}h`;
  }

  /**
   * Создание таймера производительности
   *
   * @param operation - Название операции
   * @returns Объект для измерения производительности
   */
  public static createPerformanceTimer(operation: string): PerformanceMetrics {
    return {
      startTime: performance.now(),
      operation,
      metadata: {}
    };
  }

  /**
   * Завершение измерения производительности
   *
   * @param timer - Объект таймера
   * @returns Завершенные метрики
   */
  public static finishPerformanceTimer(timer: PerformanceMetrics): PerformanceMetrics {
    const endTime = performance.now();
    return {
      ...timer,
      endTime,
      duration: endTime - timer.startTime
    };
  }

  /**
   * Проверка поддержки Web Workers
   *
   * @returns true, если Web Workers поддерживаются
   */
  public static supportsWebWorkers(): boolean {
    return typeof Worker !== 'undefined';
  }

  /**
   * Проверка поддержки SharedArrayBuffer
   *
   * @returns true, если SharedArrayBuffer поддерживается
   */
  public static supportsSharedArrayBuffer(): boolean {
    return typeof SharedArrayBuffer !== 'undefined';
  }

  /**
   * Проверка поддержки OPFS (Origin Private File System)
   *
   * @returns Promise<boolean> - true, если OPFS поддерживается
   */
  public static async supportsOPFS(): Promise<boolean> {
    try {
      if ('storage' in navigator && 'getDirectory' in navigator.storage) {
        await navigator.storage.getDirectory();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Получение информации о браузере
   *
   * @returns Информация о возможностях браузера
   */
  public static async getBrowserCapabilities(): Promise<{
    webWorkers: boolean;
    sharedArrayBuffer: boolean;
    opfs: boolean;
    webCrypto: boolean;
    userAgent: string;
  }> {
    return {
      webWorkers: EmbeddingUtils.supportsWebWorkers(),
      sharedArrayBuffer: EmbeddingUtils.supportsSharedArrayBuffer(),
      opfs: await EmbeddingUtils.supportsOPFS(),
      webCrypto: typeof crypto !== 'undefined' && !!crypto.subtle,
      userAgent: navigator.userAgent
    };
  }

  /**
   * Генерация уникального ID
   *
   * @param prefix - Префикс для ID
   * @returns Уникальный идентификатор
   */
  public static generateId(prefix: string = 'emb'): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    return `${prefix}_${timestamp}_${random}`;
  }

  /**
   * Безопасное парсинг JSON с обработкой ошибок
   *
   * @param jsonString - JSON строка
   * @param defaultValue - Значение по умолчанию при ошибке
   * @returns Распарсенный объект или значение по умолчанию
   */
  public static safeJsonParse<T>(jsonString: string, defaultValue: T): T {
    try {
      return JSON.parse(jsonString) as T;
    } catch {
      return defaultValue;
    }
  }

  /**
   * Безопасная сериализация в JSON
   *
   * @param value - Значение для сериализации
   * @param defaultValue - Значение по умолчанию при ошибке
   * @returns JSON строка или значение по умолчанию
   */
  public static safeJsonStringify(value: any, defaultValue: string = '{}'): string {
    try {
      return JSON.stringify(value);
    } catch {
      return defaultValue;
    }
  }

  /**
   * Задержка выполнения
   *
   * @param milliseconds - Время задержки в миллисекундах
   * @returns Promise, который разрешается через указанное время
   */
  public static delay(milliseconds: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }

  /**
   * Дебаунс функции
   *
   * @param func - Функция для дебаунса
   * @param delay - Задержка в миллисекундах
   * @returns Дебаунсированная функция
   */
  public static debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout | number;

    return (...args: Parameters<T>) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  }

  /**
   * Троттлинг функции
   *
   * @param func - Функция для троттлинга
   * @param limit - Минимальный интервал между вызовами в миллисекундах
   * @returns Троттлированная функция
   */
  public static throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle = false;

    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
}

/**
 * Константы для системы эмбеддингов
 */
export const EmbeddingConstants = {
  /** Поддерживаемые размерности векторов */
  SUPPORTED_DIMENSIONS: [384, 512, 768, 1024, 1536, 3072] as const,

  /** Размеры батчей по умолчанию для разных провайдеров */
  DEFAULT_BATCH_SIZES: {
    transformers: 16,
    openai: 100,
    cohere: 100,
    huggingface: 32,
    custom: 32
  } as const,

  /** Таймауты по умолчанию (в миллисекундах) */
  DEFAULT_TIMEOUTS: {
    local: 30000,    // 30 секунд для локальных моделей
    api: 60000,      // 60 секунд для API
    initialization: 120000 // 2 минуты для инициализации
  } as const,

  /** Максимальные размеры текста для разных провайдеров */
  MAX_TEXT_LENGTHS: {
    transformers: 512,
    openai: 8192,
    cohere: 2048,
    huggingface: 512,
    custom: 512
  } as const,

  /** Соотношение символов к токенам для разных языков */
  CHARS_PER_TOKEN: {
    english: 4,
    russian: 3,
    chinese: 1.5,
    default: 4
  } as const,

  /** Алгоритмы хеширования */
  HASH_ALGORITHMS: ['SHA-256', 'SHA-1', 'MD5'] as const,

  /** Версия схемы конфигурации */
  CONFIG_SCHEMA_VERSION: '1.0.0'
} as const;

/**
 * Типы для константы
 */
export type SupportedDimensions = typeof EmbeddingConstants.SUPPORTED_DIMENSIONS[number];
export type ProviderType = keyof typeof EmbeddingConstants.DEFAULT_BATCH_SIZES;
export type HashAlgorithm = typeof EmbeddingConstants.HASH_ALGORITHMS[number];

/**
 * Вспомогательные функции для работы с коллекциями
 */
export class CollectionUtils {
  /**
   * Генерация имени таблицы векторов для коллекции
   *
   * @param collectionId - ID коллекции
   * @param dimensions - Размерность векторов
   * @returns Имя таблицы векторов
   */
  public static generateVectorTableName(collectionId: string, dimensions: number): string {
    return `vec_${collectionId}_${dimensions}d`;
  }

  /**
   * Валидация ID коллекции
   *
   * @param collectionId - ID коллекции для валидации
   * @throws {ValidationError} При невалидном ID
   */
  public static validateCollectionId(collectionId: string): void {
    if (!collectionId || typeof collectionId !== 'string') {
      throw new ValidationError(
        'Collection ID must be a non-empty string',
        'collectionId',
        'non-empty string'
      );
    }

    // Проверяем формат ID (только буквы, цифры, подчеркивания и дефисы)
    const validIdPattern = /^[a-zA-Z0-9_-]+$/;
    if (!validIdPattern.test(collectionId)) {
      throw new ValidationError(
        'Collection ID can only contain letters, numbers, underscores and hyphens',
        'collectionId',
        'matching pattern: /^[a-zA-Z0-9_-]+$/'
      );
    }

    if (collectionId.length > 50) {
      throw new ValidationError(
        'Collection ID cannot be longer than 50 characters',
        'collectionId',
        'length <= 50'
      );
    }
  }

  /**
   * Создание конфигурации коллекции по умолчанию
   *
   * @param provider - Тип провайдера
   * @param dimensions - Размерность векторов
   * @returns Конфигурация коллекции по умолчанию
   */
  public static createDefaultCollectionConfig(
    provider: ProviderType,
    dimensions: SupportedDimensions
  ): CollectionEmbeddingConfig {
    return {
      provider,
      dimensions,
      batchSize: EmbeddingConstants.DEFAULT_BATCH_SIZES[provider],
      cacheEnabled: true,
      timeout: provider === 'transformers'
        ? EmbeddingConstants.DEFAULT_TIMEOUTS.local
        : EmbeddingConstants.DEFAULT_TIMEOUTS.api,
      autoGenerate: false,
      textPreprocessing: {
        maxLength: EmbeddingConstants.MAX_TEXT_LENGTHS[provider],
        stripHtml: true,
        stripMarkdown: true,
        normalizeWhitespace: true,
        toLowerCase: false,
        removeSpecialChars: false
      }
    };
  }
}