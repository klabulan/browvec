/**
 * Фабрика провайдеров эмбеддингов для LocalRetrieve
 *
 * Данный модуль реализует фабрику для создания экземпляров провайдеров эмбеддингов
 * на основе конфигурации коллекции. Поддерживает локальные и внешние провайдеры
 * с валидацией конфигурации и управлением моделями.
 *
 * Поддерживаемые провайдеры:
 * - Transformers.js: Локальные модели с фиксированной размерностью 384
 * - OpenAI: API модели с конфигурируемыми размерностями (384, 768, 1536)
 *
 * Основные функции:
 * - Создание провайдеров на основе конфигурации коллекции
 * - Валидация параметров провайдера
 * - Получение информации о доступных моделях
 * - Рекомендации по конфигурации
 */

import type {
  EmbeddingProvider,
  EmbeddingProviderFactory,
  ModelInfo,
  ProviderConfigValidation
} from './providers/BaseProvider.js';
import type { CollectionEmbeddingConfig, EmbeddingProviderType } from './types.js';
import { TransformersProvider, getModelInfo as getTransformersModelInfo, isTransformersSupported } from './providers/TransformersProvider.js';
import { OpenAIProvider, getRecommendedConfig, isValidModelDimensionCombo } from './providers/OpenAIProvider.js';
import {
  ProviderError,
  ConfigurationError,
  ProviderInitializationError,
  ValidationError
} from './errors.js';

/**
 * Результат проверки поддержки провайдера
 */
export interface ProviderSupportInfo {
  /** Поддерживается ли провайдер в текущей среде */
  isSupported: boolean;

  /** Причина отсутствия поддержки */
  unsupportedReason?: string;

  /** Рекомендуемые альтернативы */
  alternatives?: EmbeddingProviderType[];

  /** Требования для поддержки */
  requirements?: string[];
}

/**
 * Информация о конфигурации провайдера
 */
export interface ProviderConfigInfo {
  /** Тип провайдера */
  type: EmbeddingProviderType;

  /** Название для отображения */
  displayName: string;

  /** Описание провайдера */
  description: string;

  /** Поддерживаемые размерности */
  supportedDimensions: number[];

  /** Размерность по умолчанию */
  defaultDimensions: number;

  /** Требуется ли API ключ */
  requiresApiKey: boolean;

  /** Работает ли провайдер локально */
  isLocal: boolean;

  /** Доступные модели */
  availableModels: ModelInfo[];

  /** Рекомендуемые случаи использования */
  recommendedUseCases: string[];

  /** Требования к окружению */
  environmentRequirements: string[];
}

/**
 * Рекомендации по выбору провайдера
 */
export interface ProviderRecommendation {
  /** Рекомендуемый тип провайдера */
  provider: EmbeddingProviderType;

  /** Рекомендуемая модель */
  model?: string;

  /** Рекомендуемая размерность */
  dimensions: number;

  /** Причина рекомендации */
  reason: string;

  /** Приоритет рекомендации (1-10, 10 - наивысший) */
  priority: number;

  /** Альтернативные варианты */
  alternatives: Array<{
    provider: EmbeddingProviderType;
    model?: string;
    dimensions: number;
    reason: string;
  }>;
}

/**
 * Основная фабрика провайдеров эмбеддингов
 */
export class EmbeddingProviderFactoryImpl implements EmbeddingProviderFactory {
  /** Регистр доступных провайдеров */
  private readonly providerRegistry = new Map<EmbeddingProviderType, ProviderConfigInfo>();

  constructor() {
    this.initializeProviderRegistry();
  }

  /**
   * Создание экземпляра провайдера на основе конфигурации коллекции
   */
  public async createProvider(config: CollectionEmbeddingConfig): Promise<EmbeddingProvider> {
    try {
      // Валидация базовой конфигурации
      const validation = this.validateConfiguration(config);
      if (!validation.isValid) {
        throw new ConfigurationError(
          `Invalid provider configuration: ${validation.errors.join(', ')}`,
          'provider',
          validation.suggestions.join('; '),
          config.provider,
          {
            validation,
            config: { ...config, apiKey: config.apiKey ? '[REDACTED]' : undefined }
          }
        );
      }

      // Проверка поддержки провайдера
      const supportInfo = this.checkProviderSupport(config.provider);
      if (!supportInfo.isSupported) {
        throw new ProviderInitializationError(
          `Provider ${config.provider} is not supported: ${supportInfo.unsupportedReason}`,
          config.provider,
          undefined,
          {
            supportInfo,
            alternatives: supportInfo.alternatives
          }
        );
      }

      // Создание экземпляра провайдера
      let provider: EmbeddingProvider;

      switch (config.provider) {
        case 'transformers':
          provider = await this.createTransformersProvider(config);
          break;

        case 'openai':
          provider = await this.createOpenAIProvider(config);
          break;

        default:
          throw new ConfigurationError(
            `Unsupported provider type: ${config.provider}`,
            'provider',
            'One of: transformers, openai',
            config.provider
          );
      }

      // Инициализация провайдера
      await provider.initialize({
        defaultProvider: config.provider,
        defaultDimensions: config.dimensions,
        apiKey: config.apiKey,
        batchSize: config.batchSize,
        timeout: config.timeout,
        enabled: config.autoGenerate,
        provider: config.provider
      });

      return provider;

    } catch (error) {
      if (error instanceof Error && (error.name.includes('Error'))) {
        throw error; // Пробрасываем уже обработанные ошибки
      }

      throw new ProviderInitializationError(
        `Failed to create provider ${config.provider}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        config.provider,
        error instanceof Error ? error : undefined,
        { config: { ...config, apiKey: config.apiKey ? '[REDACTED]' : undefined } }
      );
    }
  }

  /**
   * Проверка поддержки конфигурации
   */
  public supportsConfig(config: CollectionEmbeddingConfig): boolean {
    const validation = this.validateConfiguration(config);
    const supportInfo = this.checkProviderSupport(config.provider);

    return validation.isValid && supportInfo.isSupported;
  }

  /**
   * Получение доступных моделей для всех провайдеров
   */
  public async getAvailableModels(): Promise<ModelInfo[]> {
    const models: ModelInfo[] = [];

    // Transformers.js модели
    if (isTransformersSupported()) {
      models.push(getTransformersModelInfo());
    }

    // OpenAI модели
    models.push(...OpenAIProvider.getAvailableModels());

    return models;
  }

  /**
   * Получение моделей для конкретного провайдера
   */
  public async getModelsForProvider(providerType: EmbeddingProviderType): Promise<ModelInfo[]> {
    switch (providerType) {
      case 'transformers':
        return isTransformersSupported() ? [getTransformersModelInfo()] : [];

      case 'openai':
        return OpenAIProvider.getAvailableModels();

      default:
        return [];
    }
  }

  /**
   * Валидация конфигурации провайдера
   */
  public validateConfiguration(config: CollectionEmbeddingConfig): ProviderConfigValidation {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Базовая валидация
    if (!config.provider) {
      errors.push('Provider type is required');
      suggestions.push('Specify provider type (transformers, openai)');
    }

    if (!config.dimensions || config.dimensions <= 0) {
      errors.push('Valid dimensions value is required');
      suggestions.push('Set dimensions to a positive integer');
    }

    // Валидация для конкретного провайдера
    switch (config.provider) {
      case 'transformers':
        this.validateTransformersConfig(config, errors, warnings, suggestions);
        break;

      case 'openai':
        this.validateOpenAIConfig(config, errors, warnings, suggestions);
        break;

      default:
        if (config.provider) {
          errors.push(`Unsupported provider: ${config.provider}`);
          suggestions.push('Use one of: transformers, openai');
        }
    }

    // Общие рекомендации
    if (config.batchSize && config.batchSize > 100) {
      warnings.push('Large batch sizes may impact performance');
      suggestions.push('Consider reducing batch size to 50 or less');
    }

    if (config.timeout && config.timeout < 5000) {
      warnings.push('Short timeout may cause frequent failures');
      suggestions.push('Consider increasing timeout to at least 10 seconds');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  /**
   * Проверка поддержки провайдера в текущей среде
   */
  public checkProviderSupport(providerType: EmbeddingProviderType): ProviderSupportInfo {
    switch (providerType) {
      case 'transformers':
        return this.checkTransformersSupport();

      case 'openai':
        return this.checkOpenAISupport();

      default:
        return {
          isSupported: false,
          unsupportedReason: `Unknown provider type: ${providerType}`,
          alternatives: ['transformers', 'openai'],
          requirements: ['Valid provider type']
        };
    }
  }

  /**
   * Получение информации о провайдере
   */
  public getProviderInfo(providerType: EmbeddingProviderType): ProviderConfigInfo | undefined {
    return this.providerRegistry.get(providerType);
  }

  /**
   * Получение всех доступных провайдеров
   */
  public getAvailableProviders(): ProviderConfigInfo[] {
    return Array.from(this.providerRegistry.values());
  }

  /**
   * Получение рекомендаций по выбору провайдера
   */
  public getProviderRecommendations(requirements: {
    dimensions?: number;
    budget?: 'low' | 'medium' | 'high';
    performance?: 'fast' | 'balanced' | 'accurate';
    privacy?: 'local' | 'cloud' | 'any';
    useCase?: string;
  }): ProviderRecommendation[] {
    const recommendations: ProviderRecommendation[] = [];
    const { dimensions = 384, budget = 'medium', performance = 'balanced', privacy = 'any' } = requirements;

    // Локальные провайдеры для приватности
    if (privacy === 'local' || privacy === 'any') {
      if (isTransformersSupported() && dimensions === 384) {
        recommendations.push({
          provider: 'transformers',
          dimensions: 384,
          reason: 'Local processing for privacy, no API costs, works offline',
          priority: privacy === 'local' ? 10 : 7,
          alternatives: []
        });
      }
    }

    // Внешние API для гибкости
    if (privacy === 'cloud' || privacy === 'any') {
      if (budget === 'low' || performance === 'fast') {
        recommendations.push({
          provider: 'openai',
          model: 'text-embedding-3-small',
          dimensions: Math.min(dimensions, 384),
          reason: 'Cost-effective with good performance and flexible dimensions',
          priority: 8,
          alternatives: [
            {
              provider: 'openai',
              model: 'text-embedding-3-small',
              dimensions: 768,
              reason: 'Better accuracy with moderate cost increase'
            }
          ]
        });
      }

      if (budget === 'high' || performance === 'accurate') {
        recommendations.push({
          provider: 'openai',
          model: 'text-embedding-3-large',
          dimensions: Math.min(dimensions, 1024),
          reason: 'Highest accuracy for demanding applications',
          priority: 9,
          alternatives: [
            {
              provider: 'openai',
              model: 'text-embedding-3-small',
              dimensions: 1536,
              reason: 'Lower cost alternative with good accuracy'
            }
          ]
        });
      }

      // Сбалансированный выбор
      if (performance === 'balanced') {
        const openaiConfig = getRecommendedConfig({ dimensions, budget, performance });
        recommendations.push({
          provider: 'openai',
          model: openaiConfig.model,
          dimensions: openaiConfig.dimensions,
          reason: openaiConfig.description,
          priority: 6,
          alternatives: []
        });
      }
    }

    // Сортируем по приоритету
    return recommendations.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Создание Transformers.js провайдера
   */
  private async createTransformersProvider(config: CollectionEmbeddingConfig): Promise<TransformersProvider> {
    if (config.dimensions !== 384) {
      throw new ConfigurationError(
        'Transformers.js provider only supports 384 dimensions',
        'dimensions',
        '384',
        config.dimensions
      );
    }

    return new TransformersProvider({
      defaultProvider: 'transformers',
      defaultDimensions: 384,
      batchSize: config.batchSize || 16,
      enableLogging: false,
      modelLoadTimeout: config.timeout || 30000,
      operationTimeout: config.timeout || 10000,
      enableModelCache: config.cacheEnabled !== false,
      ...config.providerOptions
    });
  }

  /**
   * Создание OpenAI провайдера
   */
  private async createOpenAIProvider(config: CollectionEmbeddingConfig): Promise<OpenAIProvider> {
    if (!config.apiKey) {
      throw new ConfigurationError(
        'OpenAI provider requires API key',
        'apiKey',
        'Valid OpenAI API key starting with sk-',
        undefined
      );
    }

    const model = config.model || 'text-embedding-3-small';

    // Проверяем совместимость модели и размерности
    if (!isValidModelDimensionCombo(model, config.dimensions)) {
      throw new ConfigurationError(
        `Model ${model} does not support ${config.dimensions} dimensions`,
        'dimensions',
        'Valid dimensions for the selected model',
        config.dimensions,
        { model, provider: 'openai' }
      );
    }

    return new OpenAIProvider(config.dimensions, model);
  }

  /**
   * Валидация конфигурации Transformers.js
   */
  private validateTransformersConfig(
    config: CollectionEmbeddingConfig,
    errors: string[],
    warnings: string[],
    suggestions: string[]
  ): void {
    if (config.dimensions !== 384) {
      errors.push('Transformers.js provider only supports 384 dimensions');
      suggestions.push('Set dimensions to 384 for Transformers.js provider');
    }

    if (config.apiKey) {
      warnings.push('API key is not needed for Transformers.js provider');
      suggestions.push('Remove apiKey from configuration for local provider');
    }

    if (config.model && config.model !== 'all-MiniLM-L6-v2') {
      warnings.push(`Model ${config.model} is not supported by Transformers.js provider`);
      suggestions.push('Use default model or remove model specification');
    }

    if (!isTransformersSupported()) {
      errors.push('Transformers.js is not supported in current environment');
      suggestions.push('Use a browser with Web Workers and SharedArrayBuffer support');
    }
  }

  /**
   * Валидация конфигурации OpenAI
   */
  private validateOpenAIConfig(
    config: CollectionEmbeddingConfig,
    errors: string[],
    warnings: string[],
    suggestions: string[]
  ): void {
    if (!config.apiKey) {
      errors.push('OpenAI provider requires API key');
      suggestions.push('Set apiKey in configuration');
    } else if (!config.apiKey.startsWith('sk-')) {
      warnings.push('OpenAI API key should start with "sk-"');
      suggestions.push('Verify API key format');
    }

    const model = config.model || 'text-embedding-3-small';
    if (!isValidModelDimensionCombo(model, config.dimensions)) {
      errors.push(`Model ${model} does not support ${config.dimensions} dimensions`);
      suggestions.push('Check supported dimensions for the selected model');
    }

    if (config.batchSize && config.batchSize > 100) {
      warnings.push('Large batch sizes may be inefficient for OpenAI API');
      suggestions.push('Consider using batch size of 50 or less');
    }
  }

  /**
   * Проверка поддержки Transformers.js
   */
  private checkTransformersSupport(): ProviderSupportInfo {
    if (!isTransformersSupported()) {
      return {
        isSupported: false,
        unsupportedReason: 'Browser does not support required features',
        alternatives: ['openai'],
        requirements: [
          'Web Workers support',
          'SharedArrayBuffer support',
          'WebAssembly support',
          'Modern browser (Chrome 86+, Firefox 79+, Safari 15+)'
        ]
      };
    }

    return {
      isSupported: true
    };
  }

  /**
   * Проверка поддержки OpenAI
   */
  private checkOpenAISupport(): ProviderSupportInfo {
    // OpenAI API доступен во всех современных браузерах с fetch
    if (typeof fetch === 'undefined') {
      return {
        isSupported: false,
        unsupportedReason: 'Fetch API is not available',
        alternatives: ['transformers'],
        requirements: ['Modern browser with fetch API support']
      };
    }

    return {
      isSupported: true
    };
  }

  /**
   * Инициализация реестра провайдеров
   */
  private initializeProviderRegistry(): void {
    // Transformers.js провайдер
    this.providerRegistry.set('transformers', {
      type: 'transformers',
      displayName: 'Transformers.js (Local)',
      description: 'Local embedding generation using all-MiniLM-L6-v2 model. Runs entirely in browser with no external API calls.',
      supportedDimensions: [384],
      defaultDimensions: 384,
      requiresApiKey: false,
      isLocal: true,
      availableModels: isTransformersSupported() ? [getTransformersModelInfo()] : [],
      recommendedUseCases: [
        'Privacy-sensitive applications',
        'Offline functionality',
        'No API cost constraints',
        'Real-time processing',
        'Development and prototyping'
      ],
      environmentRequirements: [
        'Web Workers support',
        'SharedArrayBuffer support',
        'WebAssembly support',
        'Modern browser'
      ]
    });

    // OpenAI провайдер
    this.providerRegistry.set('openai', {
      type: 'openai',
      displayName: 'OpenAI Embeddings API',
      description: 'Cloud-based embedding generation using OpenAI models. Supports multiple models and configurable dimensions.',
      supportedDimensions: [256, 384, 512, 768, 1024, 1536, 3072],
      defaultDimensions: 1536,
      requiresApiKey: true,
      isLocal: false,
      availableModels: OpenAIProvider.getAvailableModels(),
      recommendedUseCases: [
        'Production applications',
        'High accuracy requirements',
        'Multiple language support',
        'Flexible dimensions',
        'Large-scale processing'
      ],
      environmentRequirements: [
        'Internet connection',
        'Valid OpenAI API key',
        'fetch API support'
      ]
    });
  }
}

/**
 * Singleton instance of the provider factory
 */
export const providerFactory = new EmbeddingProviderFactoryImpl();

/**
 * Convenience function to create a provider
 */
export async function createEmbeddingProvider(config: CollectionEmbeddingConfig): Promise<EmbeddingProvider> {
  return providerFactory.createProvider(config);
}

/**
 * Convenience function to validate provider configuration
 */
export function validateProviderConfig(config: CollectionEmbeddingConfig): ProviderConfigValidation {
  return providerFactory.validateConfiguration(config);
}

/**
 * Convenience function to check provider support
 */
export function checkProviderSupport(providerType: EmbeddingProviderType): ProviderSupportInfo {
  return providerFactory.checkProviderSupport(providerType);
}

/**
 * Convenience function to get provider recommendations
 */
export function getProviderRecommendations(requirements: {
  dimensions?: number;
  budget?: 'low' | 'medium' | 'high';
  performance?: 'fast' | 'balanced' | 'accurate';
  privacy?: 'local' | 'cloud' | 'any';
  useCase?: string;
}): ProviderRecommendation[] {
  return providerFactory.getProviderRecommendations(requirements);
}

/**
 * Convenience function to get all available providers
 */
export function getAvailableProviders(): ProviderConfigInfo[] {
  return providerFactory.getAvailableProviders();
}

/**
 * Convenience function to get available models
 */
export async function getAvailableModels(): Promise<ModelInfo[]> {
  return providerFactory.getAvailableModels();
}

// Note: EmbeddingProviderFactoryImpl is already exported above