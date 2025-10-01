/**
 * Базовый интерфейс и типы для провайдеров эмбеддингов
 *
 * Данный модуль определяет основной интерфейс EmbeddingProvider, который должны
 * реализовывать все провайдеры эмбеддингов (локальные и внешние).
 *
 * Ключевые принципы:
 * - Фиксированная размерность на экземпляр провайдера
 * - Конфигурация на уровне коллекций
 * - Неблокирующая архитектура для UI
 */

import type { EmbeddingConfig, CollectionEmbeddingConfig } from '../types.js';
import { EmbeddingError, ProviderError } from '../errors.js';

/**
 * Базовый интерфейс провайдера эмбеддингов
 *
 * Каждый экземпляр провайдера имеет фиксированную размерность,
 * которая устанавливается при создании и не может быть изменена.
 */
export interface EmbeddingProvider {
  /** Уникальное имя провайдера (например: 'transformers', 'openai', 'cohere') */
  readonly name: string;

  /** Размерность векторов, которые генерирует данный экземпляр провайдера */
  readonly dimensions: number;

  /** Максимальный размер батча для пакетной обработки */
  readonly maxBatchSize: number;

  /** Максимальная длина текста в токенах для данного провайдера */
  readonly maxTextLength: number;

  /** Флаг готовности провайдера к работе */
  readonly isReady: boolean;

  /**
   * Инициализация провайдера с заданной конфигурацией
   *
   * @param config - Конфигурация эмбеддингов
   * @throws {ProviderError} При ошибках загрузки модели или аутентификации
   */
  initialize(config: EmbeddingConfig): Promise<void>;

  /**
   * Генерация эмбеддинга для одного текста
   *
   * @param text - Текст для генерации эмбеддинга
   * @returns Вектор размерности this.dimensions
   * @throws {EmbeddingError} При ошибках генерации
   */
  generateEmbedding(text: string): Promise<Float32Array>;

  /**
   * Пакетная генерация эмбеддингов
   *
   * Рекомендуется для обработки больших объемов данных.
   * Размер батча не должен превышать maxBatchSize.
   *
   * @param texts - Массив текстов для обработки
   * @returns Массив векторов в том же порядке, что и входные тексты
   * @throws {EmbeddingError} При ошибках генерации
   */
  generateBatch(texts: string[]): Promise<Float32Array[]>;

  /**
   * Очистка ресурсов и завершение работы провайдера
   *
   * Должна вызываться при завершении работы с провайдером
   * для освобождения памяти и других ресурсов.
   */
  cleanup(): Promise<void>;

  /**
   * Проверка здоровья провайдера
   *
   * @returns Информация о состоянии провайдера
   */
  healthCheck(): Promise<ProviderHealthStatus>;

  /**
   * Получение статистики работы провайдера
   *
   * @returns Метрики производительности
   */
  getMetrics(): ProviderMetrics;
}

/**
 * Статус здоровья провайдера
 */
export interface ProviderHealthStatus {
  /** Готов ли провайдер к работе */
  isHealthy: boolean;

  /** Время последней успешной операции */
  lastSuccessfulOperation?: Date;

  /** Описание текущего состояния */
  status: 'ready' | 'initializing' | 'error' | 'degraded';

  /** Дополнительная информация о состоянии */
  details?: string;

  /** Доступная память (для локальных провайдеров) */
  availableMemory?: number;

  /** Состояние подключения (для внешних API) */
  connectionStatus?: 'connected' | 'disconnected' | 'limited';
}

/**
 * Метрики производительности провайдера
 */
export interface ProviderMetrics {
  /** Общее количество сгенерированных эмбеддингов */
  totalEmbeddings: number;

  /** Среднее время генерации одного эмбеддинга (мс) */
  averageGenerationTime: number;

  /** Количество ошибок */
  errorCount: number;

  /** Время последнего сброса метрик */
  metricsResetTime: Date;

  /** Использование памяти (байты) */
  memoryUsage?: number;

  /** Количество запросов к внешнему API */
  apiRequestCount?: number;

  /** Скорость ограничений (requests per minute) */
  rateLimitStatus?: {
    remaining: number;
    resetTime: Date;
  };
}

/**
 * Результат валидации конфигурации провайдера
 */
export interface ProviderConfigValidation {
  /** Валидна ли конфигурация */
  isValid: boolean;

  /** Ошибки валидации */
  errors: string[];

  /** Предупреждения */
  warnings: string[];

  /** Рекомендуемые исправления */
  suggestions: string[];
}

/**
 * Абстрактный базовый класс для провайдеров эмбеддингов
 *
 * Предоставляет общую функциональность и валидацию для всех провайдеров.
 */
export abstract class BaseEmbeddingProvider implements EmbeddingProvider {
  public readonly name: string;
  public readonly dimensions: number;
  public readonly maxBatchSize: number;
  public readonly maxTextLength: number;

  protected _isReady = false;
  protected metrics: ProviderMetrics;
  protected config?: EmbeddingConfig;

  constructor(
    name: string,
    dimensions: number,
    maxBatchSize: number = 32,
    maxTextLength: number = 512
  ) {
    this.name = name;
    this.dimensions = dimensions;
    this.maxBatchSize = maxBatchSize;
    this.maxTextLength = maxTextLength;

    this.metrics = {
      totalEmbeddings: 0,
      averageGenerationTime: 0,
      errorCount: 0,
      metricsResetTime: new Date()
    };
  }

  public get isReady(): boolean {
    return this._isReady;
  }

  /**
   * Валидация конфигурации провайдера
   *
   * @param config - Конфигурация для валидации
   * @returns Результат валидации
   */
  public validateConfig(config: EmbeddingConfig): ProviderConfigValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Базовая валидация
    if (!config.provider && !config.defaultProvider) {
      errors.push('Provider type is required');
    }

    if (config.timeout && config.timeout < 1000) {
      warnings.push('Timeout less than 1 second may cause frequent timeouts');
      suggestions.push('Consider increasing timeout to at least 5000ms');
    }

    if (config.batchSize && config.batchSize > this.maxBatchSize) {
      errors.push(`Batch size ${config.batchSize} exceeds maximum ${this.maxBatchSize}`);
      suggestions.push(`Set batch size to ${this.maxBatchSize} or less`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  /**
   * Валидация входного текста
   *
   * @param text - Текст для валидации
   * @throws {EmbeddingError} При невалидном тексте
   */
  protected validateText(text: string): void {
    if (!text || typeof text !== 'string') {
      throw new EmbeddingError('Input text must be a non-empty string');
    }

    if (text.trim().length === 0) {
      throw new EmbeddingError('Input text cannot be empty or whitespace only');
    }

    // Проверка длины (примерная оценка токенов)
    const estimatedTokens = text.length / 4; // Примерно 4 символа на токен
    if (estimatedTokens > this.maxTextLength) {
      throw new EmbeddingError(
        `Text too long: ~${Math.round(estimatedTokens)} tokens, max: ${this.maxTextLength}`
      );
    }
  }

  /**
   * Валидация массива текстов для пакетной обработки
   *
   * @param texts - Массив текстов для валидации
   * @throws {EmbeddingError} При невалидных данных
   */
  protected validateBatch(texts: string[]): void {
    if (!Array.isArray(texts)) {
      throw new EmbeddingError('Input must be an array of strings');
    }

    if (texts.length === 0) {
      throw new EmbeddingError('Batch cannot be empty');
    }

    if (texts.length > this.maxBatchSize) {
      throw new EmbeddingError(
        `Batch size ${texts.length} exceeds maximum ${this.maxBatchSize}`
      );
    }

    // Валидация каждого текста
    texts.forEach((text, index) => {
      try {
        this.validateText(text);
      } catch (error) {
        throw new EmbeddingError(
          `Invalid text at index ${index}: ${error instanceof Error ? error.message : 'Unknown error'}`
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
  protected updateMetrics(generationTime: number, embeddingCount: number = 1, isError: boolean = false): void {
    if (isError) {
      this.metrics.errorCount += 1;
      return;
    }

    const totalTime = this.metrics.averageGenerationTime * this.metrics.totalEmbeddings;
    this.metrics.totalEmbeddings += embeddingCount;
    this.metrics.averageGenerationTime = (totalTime + generationTime) / this.metrics.totalEmbeddings;
  }

  /**
   * Сброс метрик производительности
   */
  public resetMetrics(): void {
    this.metrics = {
      totalEmbeddings: 0,
      averageGenerationTime: 0,
      errorCount: 0,
      metricsResetTime: new Date()
    };
  }

  public getMetrics(): ProviderMetrics {
    return { ...this.metrics };
  }

  // Абстрактные методы, которые должны быть реализованы в дочерних классах
  public abstract initialize(config: EmbeddingConfig): Promise<void>;
  public abstract generateEmbedding(text: string): Promise<Float32Array>;
  public abstract generateBatch(texts: string[]): Promise<Float32Array[]>;
  public abstract cleanup(): Promise<void>;
  public abstract healthCheck(): Promise<ProviderHealthStatus>;
}

/**
 * Фабрика для создания провайдеров эмбеддингов
 */
export interface EmbeddingProviderFactory {
  /**
   * Создание экземпляра провайдера
   *
   * @param config - Конфигурация коллекции
   * @returns Экземпляр провайдера с фиксированной размерностью
   */
  createProvider(config: CollectionEmbeddingConfig): Promise<EmbeddingProvider>;

  /**
   * Проверка поддержки конфигурации
   *
   * @param config - Конфигурация для проверки
   * @returns true, если конфигурация поддерживается
   */
  supportsConfig(config: CollectionEmbeddingConfig): boolean;

  /**
   * Получение доступных моделей для провайдера
   *
   * @returns Список доступных моделей с их характеристиками
   */
  getAvailableModels(): Promise<ModelInfo[]>;
}

/**
 * Информация о доступной модели
 */
export interface ModelInfo {
  /** Идентификатор модели */
  id: string;

  /** Отображаемое название */
  name: string;

  /** Описание модели */
  description: string;

  /** Размерность векторов */
  dimensions: number;

  /** Максимальная длина входного текста */
  maxInputLength: number;

  /** Поддерживаемые языки */
  languages: string[];

  /** Рекомендуемые случаи использования */
  useCases: string[];

  /** Размер модели (для локальных моделей) */
  modelSize?: number;

  /** Стоимость за токен (для API) */
  costPerToken?: number;
}

/**
 * Вспомогательные функции для работы с провайдерами
 */
export class ProviderUtils {
  /**
   * Нормализация вектора эмбеддинга
   *
   * @param embedding - Вектор для нормализации
   * @returns Нормализованный вектор
   */
  static normalizeEmbedding(embedding: Float32Array): Float32Array {
    let norm = 0;
    for (let i = 0; i < embedding.length; i++) {
      norm += embedding[i] * embedding[i];
    }
    norm = Math.sqrt(norm);

    if (norm === 0) {
      throw new EmbeddingError('Cannot normalize zero vector');
    }

    const normalized = new Float32Array(embedding.length);
    for (let i = 0; i < embedding.length; i++) {
      normalized[i] = embedding[i] / norm;
    }

    return normalized;
  }

  /**
   * Вычисление косинусного расстояния между векторами
   *
   * @param a - Первый вектор
   * @param b - Второй вектор
   * @returns Косинусное расстояние (0 = идентичные, 2 = противоположные)
   */
  static cosineDistance(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new EmbeddingError('Vectors must have the same dimensions');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 2; // Максимальное расстояние для нулевых векторов
    }

    const cosineSimilarity = dotProduct / (normA * normB);
    return 1 - cosineSimilarity; // Конвертация в расстояние
  }

  /**
   * Создание случайного вектора (для тестирования)
   *
   * @param dimensions - Размерность вектора
   * @param normalize - Нормализовать ли вектор
   * @returns Случайный вектор
   */
  static createRandomEmbedding(dimensions: number, normalize: boolean = true): Float32Array {
    const embedding = new Float32Array(dimensions);
    for (let i = 0; i < dimensions; i++) {
      embedding[i] = Math.random() * 2 - 1; // Значения от -1 до 1
    }

    return normalize ? this.normalizeEmbedding(embedding) : embedding;
  }
}