/**
 * OpenAI провайдер эмбеддингов для LocalRetrieve
 *
 * Данный модуль реализует провайдер эмбеддингов для OpenAI Embeddings API,
 * поддерживающий модель text-embedding-3-small с конфигурируемыми размерностями.
 *
 * Поддерживаемые возможности:
 * - text-embedding-3-small модель
 * - Конфигурируемые размерности: 384, 768, 1536
 * - Автоматический retry с exponential backoff
 * - Rate limiting и quota management
 * - Пакетная обработка запросов
 * - Secure API key handling (только в памяти)
 */

import { ExternalProvider, ExternalProviderConfig } from './ExternalProvider.js';
import type { EmbeddingConfig } from '../types.js';
import {
  ProviderError,
  NetworkError,
  AuthenticationError,
  QuotaExceededError,
  ValidationError,
  ConfigurationError
} from '../errors.js';

/**
 * Конфигурация OpenAI провайдера
 */
interface OpenAIConfig extends ExternalProviderConfig {
  /** Модель для использования (по умолчанию text-embedding-3-small) */
  model?: string;

  /** Размерность выходных векторов */
  dimensions: number;

  /** Организация OpenAI (опционально) */
  organization?: string;

  /** Пользователь для отслеживания использования */
  user?: string;
}

/**
 * Поддерживаемые модели OpenAI
 */
const OPENAI_MODELS = {
  'text-embedding-3-small': {
    name: 'text-embedding-3-small',
    maxInputTokens: 8191,
    defaultDimensions: 1536,
    supportedDimensions: [384, 768, 1536],
    costPer1MTokens: 0.02 // USD
  },
  'text-embedding-3-large': {
    name: 'text-embedding-3-large',
    maxInputTokens: 8191,
    defaultDimensions: 3072,
    supportedDimensions: [256, 512, 1024, 3072],
    costPer1MTokens: 0.13 // USD
  },
  'text-embedding-ada-002': {
    name: 'text-embedding-ada-002',
    maxInputTokens: 8191,
    defaultDimensions: 1536,
    supportedDimensions: [1536],
    costPer1MTokens: 0.10 // USD
  }
} as const;

/**
 * Структура запроса к OpenAI API
 */
interface OpenAIEmbeddingRequest {
  /** Модель для использования */
  model: string;

  /** Входной текст или массив текстов */
  input: string | string[];

  /** Размерность выходных векторов (опционально) */
  dimensions?: number;

  /** Пользователь для отслеживания */
  user?: string;

  /** Кодировка (всегда float для нашего случая) */
  encoding_format?: 'float' | 'base64';
}

/**
 * Структура ответа от OpenAI API
 */
interface OpenAIEmbeddingResponse {
  /** Тип объекта */
  object: 'list';

  /** Данные эмбеддингов */
  data: Array<{
    object: 'embedding';
    index: number;
    embedding: number[];
  }>;

  /** Модель, которая была использована */
  model: string;

  /** Информация об использовании токенов */
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

/**
 * Структура ошибки OpenAI API
 */
interface OpenAIErrorResponse {
  error: {
    message: string;
    type: string;
    param?: string;
    code?: string;
  };
}

/**
 * OpenAI провайдер эмбеддингов
 */
export class OpenAIProvider extends ExternalProvider {
  private openaiConfig?: OpenAIConfig;
  private model: string;
  private supportedDimensions: number[];
  private maxInputTokens: number;

  /**
   * Создание экземпляра OpenAI провайдера
   *
   * @param dimensions - Размерность векторов эмбеддингов
   * @param model - Модель OpenAI (по умолчанию text-embedding-3-small)
   */
  constructor(
    dimensions: number,
    model: string = 'text-embedding-3-small'
  ) {
    // Валидация модели
    if (!(model in OPENAI_MODELS)) {
      throw new ConfigurationError(
        `Unsupported OpenAI model: ${model}`,
        'model',
        `One of: ${Object.keys(OPENAI_MODELS).join(', ')}`,
        model
      );
    }

    const modelInfo = OPENAI_MODELS[model as keyof typeof OPENAI_MODELS];

    // Валидация размерности для выбранной модели
    if (!modelInfo.supportedDimensions.includes(dimensions)) {
      throw new ConfigurationError(
        `Unsupported dimensions ${dimensions} for model ${model}`,
        'dimensions',
        `One of: ${modelInfo.supportedDimensions.join(', ')}`,
        dimensions
      );
    }

    super(
      'openai',
      dimensions,
      100, // OpenAI поддерживает большие батчи
      modelInfo.maxInputTokens * 4 // Приблизительно 4 символа на токен
    );

    this.model = model;
    this.supportedDimensions = modelInfo.supportedDimensions;
    this.maxInputTokens = modelInfo.maxInputTokens;
  }

  /**
   * Инициализация OpenAI провайдера
   */
  protected async initializeProvider(config: ExternalProviderConfig): Promise<void> {
    // Создание конфигурации OpenAI
    this.openaiConfig = {
      ...config,
      model: this.model,
      dimensions: this.dimensions,
      baseUrl: config.baseUrl || 'https://api.openai.com/v1',
      organization: config.headers?.['OpenAI-Organization'],
      user: config.headers?.['OpenAI-User']
    };

    // Валидация API ключа
    if (!this.openaiConfig.apiKey.startsWith('sk-')) {
      throw new AuthenticationError(
        'Invalid OpenAI API key format. Must start with "sk-"',
        'invalid_key',
        { provider: this.name }
      );
    }

    // Выполнение тестового запроса для проверки аутентификации
    try {
      await this.executeEmbeddingRequest(['test']);
    } catch (error) {
      // Если это ошибка аутентификации, пробрасываем её
      if (error instanceof AuthenticationError) {
        throw error;
      }
      // Для других ошибок продолжаем инициализацию
      console.warn(`OpenAI provider test request failed: ${error}`);
    }
  }

  /**
   * Выполнение запроса к OpenAI API для генерации эмбеддингов
   */
  protected async executeEmbeddingRequest(texts: string[]): Promise<Float32Array[]> {
    if (!this.openaiConfig) {
      throw new ProviderError(
        'Provider not initialized',
        this.name,
        'PROVIDER_NOT_INITIALIZED'
      );
    }

    // Подготовка запроса
    const requestBody: OpenAIEmbeddingRequest = {
      model: this.openaiConfig.model || this.model,
      input: texts,
      encoding_format: 'float'
    };

    // Добавляем размерность только если она отличается от дефолтной
    const modelInfo = OPENAI_MODELS[this.model as keyof typeof OPENAI_MODELS];
    if (this.dimensions !== modelInfo.defaultDimensions) {
      requestBody.dimensions = this.dimensions;
    }

    // Добавляем пользователя если указан
    if (this.openaiConfig.user) {
      requestBody.user = this.openaiConfig.user;
    }

    // Подготовка заголовков
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.openaiConfig.apiKey}`,
      'User-Agent': 'LocalRetrieve/1.0.0'
    };

    // Добавляем организацию если указана
    if (this.openaiConfig.organization) {
      headers['OpenAI-Organization'] = this.openaiConfig.organization;
    }

    // Дополнительные заголовки
    if (this.openaiConfig.headers) {
      Object.assign(headers, this.openaiConfig.headers);
    }

    const url = `${this.openaiConfig.baseUrl}/embeddings`;

    try {
      // Создание контроллера для отмены запроса по таймауту
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, this.openaiConfig.timeout);

      // Выполнение запроса
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      // Обработка ответа
      const responseData = await response.json();

      if (!response.ok) {
        throw this.createErrorFromResponse(response.status, responseData as OpenAIErrorResponse);
      }

      // Обработка успешного ответа
      return this.processSuccessfulResponse(responseData as OpenAIEmbeddingResponse);

    } catch (error) {
      // Обработка ошибок запроса
      if (error.name === 'AbortError') {
        throw new NetworkError(
          `Request timeout after ${this.openaiConfig.timeout}ms`,
          'timeout',
          undefined,
          url
        );
      }

      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new NetworkError(
          'Network connection failed',
          'connection',
          undefined,
          url
        );
      }

      // Пробрасываем уже обработанные ошибки
      throw error;
    }
  }

  /**
   * Проверка здоровья OpenAI провайдера
   */
  protected async checkProviderHealth(): Promise<boolean> {
    try {
      // Выполняем минимальный запрос для проверки доступности API
      await this.executeEmbeddingRequest(['health check']);
      return true;
    } catch (error) {
      console.warn(`OpenAI provider health check failed: ${error}`);
      return false;
    }
  }

  /**
   * Очистка ресурсов OpenAI провайдера
   */
  protected async cleanupProvider(): Promise<void> {
    // Очищаем конфигурацию (включая API ключ)
    this.openaiConfig = undefined;
  }

  /**
   * Получение информации о поддерживаемых моделях
   */
  public static getAvailableModels() {
    return Object.entries(OPENAI_MODELS).map(([id, info]) => ({
      id,
      name: info.name,
      description: `OpenAI ${info.name} embedding model`,
      dimensions: info.defaultDimensions,
      supportedDimensions: info.supportedDimensions,
      maxInputLength: info.maxInputTokens,
      languages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh'],
      useCases: ['semantic search', 'classification', 'clustering', 'similarity'],
      costPerToken: info.costPer1MTokens / 1000000
    }));
  }

  /**
   * Создание специфичной ошибки на основе ответа API
   */
  private createErrorFromResponse(status: number, errorData: OpenAIErrorResponse): Error {
    const errorMessage = errorData.error?.message || 'Unknown OpenAI API error';
    const errorType = errorData.error?.type || 'unknown';
    const errorCode = errorData.error?.code || 'unknown';

    switch (status) {
      case 401:
        return new AuthenticationError(
          `OpenAI API authentication failed: ${errorMessage}`,
          'invalid_key',
          { provider: this.name, errorType, errorCode }
        );

      case 429:
        // Определяем тип превышения лимита
        if (errorMessage.includes('quota') || errorMessage.includes('billing')) {
          return new QuotaExceededError(
            `OpenAI API quota exceeded: ${errorMessage}`,
            'api_calls',
            0,
            0,
            undefined,
            { provider: this.name, errorType, errorCode }
          );
        } else {
          return new QuotaExceededError(
            `OpenAI API rate limit exceeded: ${errorMessage}`,
            'api_calls',
            0,
            0,
            new Date(Date.now() + 60000), // Retry after 1 minute
            { provider: this.name, errorType, errorCode }
          );
        }

      case 400:
        if (errorMessage.includes('dimensions') || errorMessage.includes('model')) {
          return new ConfigurationError(
            `OpenAI API configuration error: ${errorMessage}`,
            errorData.error?.param || 'unknown',
            undefined,
            undefined,
            { provider: this.name, errorType, errorCode }
          );
        } else {
          return new ValidationError(
            `OpenAI API validation error: ${errorMessage}`,
            errorData.error?.param || 'input',
            'OpenAI API validation',
            { provider: this.name, errorType, errorCode }
          );
        }

      case 500:
      case 502:
      case 503:
      case 504:
        return new NetworkError(
          `OpenAI API server error: ${errorMessage}`,
          'server_error',
          status,
          undefined,
          { provider: this.name, errorType, errorCode }
        );

      default:
        return new ProviderError(
          `OpenAI API error (${status}): ${errorMessage}`,
          this.name,
          'OPENAI_API_ERROR',
          undefined,
          { status, errorType, errorCode }
        );
    }
  }

  /**
   * Обработка успешного ответа от OpenAI API
   */
  private processSuccessfulResponse(response: OpenAIEmbeddingResponse): Float32Array[] {
    if (!response.data || !Array.isArray(response.data)) {
      throw new ProviderError(
        'Invalid response format from OpenAI API',
        this.name,
        'INVALID_RESPONSE_FORMAT'
      );
    }

    // Сортируем по индексу для сохранения порядка
    const sortedData = response.data.sort((a, b) => a.index - b.index);

    return sortedData.map((item, index) => {
      if (!item.embedding || !Array.isArray(item.embedding)) {
        throw new ProviderError(
          `Invalid embedding format at index ${index}`,
          this.name,
          'INVALID_EMBEDDING_FORMAT'
        );
      }

      // Проверяем размерность
      if (item.embedding.length !== this.dimensions) {
        throw new ProviderError(
          `Embedding dimension mismatch: expected ${this.dimensions}, got ${item.embedding.length}`,
          this.name,
          'DIMENSION_MISMATCH'
        );
      }

      // Конвертируем в Float32Array
      return new Float32Array(item.embedding);
    });
  }

  /**
   * Валидация конфигурации для OpenAI провайдера
   */
  public validateConfig(config: EmbeddingConfig) {
    const baseValidation = super.validateConfig(config);

    // Дополнительная валидация для OpenAI
    const errors = [...baseValidation.errors];
    const warnings = [...baseValidation.warnings];
    const suggestions = [...baseValidation.suggestions];

    // Проверка API ключа
    if (!config.apiKey) {
      errors.push('OpenAI API key is required');
      suggestions.push('Set apiKey in configuration');
    } else if (!config.apiKey.startsWith('sk-')) {
      warnings.push('OpenAI API key should start with "sk-"');
      suggestions.push('Verify API key format');
    }

    // Проверка модели и размерности
    const modelName = config.providerOptions?.model || this.model;
    if (modelName in OPENAI_MODELS) {
      const modelInfo = OPENAI_MODELS[modelName as keyof typeof OPENAI_MODELS];
      if (!modelInfo.supportedDimensions.includes(this.dimensions)) {
        errors.push(`Model ${modelName} does not support ${this.dimensions} dimensions`);
        suggestions.push(`Use one of: ${modelInfo.supportedDimensions.join(', ')}`);
      }
    }

    // Проверка размера батча
    if (config.batchSize && config.batchSize > this.maxBatchSize) {
      warnings.push(`Batch size ${config.batchSize} may be inefficient for OpenAI API`);
      suggestions.push(`Consider using batch size of ${Math.min(this.maxBatchSize, 50)} or less`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }
}

/**
 * Фабричная функция для создания OpenAI провайдера
 */
export function createOpenAIProvider(
  dimensions: number,
  model: string = 'text-embedding-3-small'
): OpenAIProvider {
  return new OpenAIProvider(dimensions, model);
}

/**
 * Проверка поддерживается ли комбинация модели и размерности
 */
export function isValidModelDimensionCombo(model: string, dimensions: number): boolean {
  if (!(model in OPENAI_MODELS)) {
    return false;
  }

  const modelInfo = OPENAI_MODELS[model as keyof typeof OPENAI_MODELS];
  return modelInfo.supportedDimensions.includes(dimensions);
}

/**
 * Получение рекомендуемой конфигурации для заданных требований
 */
export function getRecommendedConfig(
  requirements: {
    dimensions?: number;
    budget?: 'low' | 'medium' | 'high';
    performance?: 'fast' | 'balanced' | 'accurate';
  }
): {
  model: string;
  dimensions: number;
  description: string;
} {
  const { dimensions = 384, budget = 'medium', performance = 'balanced' } = requirements;

  // Рекомендации на основе бюджета и производительности
  if (budget === 'low' || performance === 'fast') {
    return {
      model: 'text-embedding-3-small',
      dimensions: Math.min(dimensions, 384),
      description: 'Cost-effective option with good performance for most use cases'
    };
  }

  if (budget === 'high' || performance === 'accurate') {
    if (dimensions <= 1024) {
      return {
        model: 'text-embedding-3-large',
        dimensions: dimensions <= 256 ? 256 : dimensions <= 512 ? 512 : 1024,
        description: 'High-accuracy model for demanding applications'
      };
    }
  }

  // Сбалансированный выбор
  return {
    model: 'text-embedding-3-small',
    dimensions: dimensions <= 384 ? 384 : dimensions <= 768 ? 768 : 1536,
    description: 'Balanced option providing good accuracy and reasonable cost'
  };
}