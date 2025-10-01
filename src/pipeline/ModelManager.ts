/**
 * ModelManager - управление жизненным циклом embedding моделей
 *
 * Отвечает за интеллектуальную загрузку, кэширование и оптимизацию памяти
 * для embedding моделей. Поддерживает стратегии предзагрузки и автоматическую
 * выгрузку неиспользуемых моделей для оптимизации ресурсов.
 */

import type { EmbeddingProviderType, CollectionEmbeddingConfig } from '../embedding/types.js';
import { providerFactory } from '../embedding/ProviderFactory.js';
import { ModelLoadError, ConfigurationError, EmbeddingError } from '../embedding/errors.js';

/**
 * Стратегии загрузки моделей
 */
export type LoadingStrategy = 'eager' | 'lazy' | 'predictive';

/**
 * Информация о загруженной модели
 */
export interface LoadedModel {
  /** Уникальный ID модели */
  modelId: string;
  /** Тип провайдера */
  provider: EmbeddingProviderType;
  /** Название модели */
  modelName: string;
  /** Размерность эмбеддингов */
  dimensions: number;
  /** Экземпляр провайдера */
  providerInstance: any;
  /** Время последнего использования */
  lastUsed: number;
  /** Счетчик использований */
  usageCount: number;
  /** Приблизительное использование памяти в MB */
  memoryUsage: number;
  /** Время загрузки модели */
  loadTime: number;
  /** Статус модели */
  status: 'loading' | 'ready' | 'error' | 'unloading';
  /** Сообщение об ошибке (если есть) */
  error?: string;
}

/**
 * Статус ModelManager
 */
export interface ModelStatus {
  /** Загруженные модели */
  loadedModels: LoadedModel[];
  /** Общее использование памяти в MB */
  totalMemoryUsage: number;
  /** Количество активных моделей */
  activeCount: number;
  /** Статистика по провайдерам */
  providerStats: Record<EmbeddingProviderType, {
    count: number;
    memoryUsage: number;
    avgLoadTime: number;
  }>;
}

/**
 * Опции оптимизации памяти
 */
export interface MemoryOptimizationOptions {
  /** Максимальное использование памяти в MB */
  maxMemoryUsage?: number;
  /** Максимальное количество одновременно загруженных моделей */
  maxModels?: number;
  /** Время неактивности перед выгрузкой (мс) */
  idleTimeout?: number;
  /** Принудительная очистка всех неиспользуемых моделей */
  aggressive?: boolean;
}

/**
 * Модель с метриками производительности
 */
export interface EmbeddingModel {
  /** Конфигурация */
  config: CollectionEmbeddingConfig;
  /** Провайдер */
  provider: any;
  /** Метрики производительности */
  metrics: {
    averageInferenceTime: number;
    totalRequests: number;
    successRate: number;
    lastPerformanceCheck: number;
  };
}

/**
 * Интерфейс ModelManager
 */
export interface ModelManager {
  /**
   * Загрузка модели с указанным провайдером
   */
  loadModel(provider: EmbeddingProviderType, model?: string): Promise<EmbeddingModel>;

  /**
   * Предзагрузка моделей по стратегии
   */
  preloadModels(strategy: LoadingStrategy): Promise<void>;

  /**
   * Оптимизация использования памяти
   */
  optimizeMemory(options?: MemoryOptimizationOptions): Promise<void>;

  /**
   * Получение статуса всех моделей
   */
  getModelStatus(): ModelStatus;

  /**
   * Выгрузка неиспользуемых моделей
   */
  unloadUnusedModels(): Promise<void>;

  /**
   * Получение модели для коллекции
   */
  getModelForCollection(collection: string): Promise<EmbeddingModel | null>;

  /**
   * Прогрев модели (предварительная инициализация)
   */
  warmModel(modelId: string): Promise<void>;
}

/**
 * Основная реализация ModelManager
 */
export class ModelManagerImpl implements ModelManager {
  private models: Map<string, LoadedModel>;
  private modelConfigs: Map<string, CollectionEmbeddingConfig>;
  private memoryLimit: number;
  private maxModels: number;
  private idleTimeout: number;
  private cleanupInterval: NodeJS.Timeout | null;

  // Статистика использования
  private stats: {
    totalLoads: number;
    totalUnloads: number;
    cacheHits: number;
    cacheMisses: number;
    avgLoadTime: number;
  };

  constructor(options: {
    memoryLimit?: number;
    maxModels?: number;
    idleTimeout?: number;
    cleanupInterval?: number;
  } = {}) {
    this.models = new Map();
    this.modelConfigs = new Map();
    this.memoryLimit = options.memoryLimit || 500; // 500MB по умолчанию
    this.maxModels = options.maxModels || 5; // Максимум 5 моделей одновременно
    this.idleTimeout = options.idleTimeout || 10 * 60 * 1000; // 10 минут неактивности
    this.cleanupInterval = null;

    this.stats = {
      totalLoads: 0,
      totalUnloads: 0,
      cacheHits: 0,
      cacheMisses: 0,
      avgLoadTime: 0
    };

    // Запускаем периодическую очистку
    this.startCleanupTimer(options.cleanupInterval || 5 * 60 * 1000); // Каждые 5 минут
  }

  /**
   * Загрузка модели с кэшированием и оптимизацией
   */
  async loadModel(provider: EmbeddingProviderType, model?: string): Promise<EmbeddingModel> {
    const modelId = this.generateModelId(provider, model);

    // Проверяем наличие в кэше
    if (this.models.has(modelId)) {
      const cachedModel = this.models.get(modelId)!;

      if (cachedModel.status === 'ready') {
        // Обновляем статистику использования
        cachedModel.lastUsed = Date.now();
        cachedModel.usageCount++;
        this.stats.cacheHits++;

        return {
          config: this.modelConfigs.get(modelId)!,
          provider: cachedModel.providerInstance,
          metrics: this.getModelMetrics(modelId)
        };
      } else if (cachedModel.status === 'loading') {
        // Ждем завершения загрузки
        return this.waitForModelLoad(modelId);
      } else if (cachedModel.status === 'error') {
        // Удаляем поврежденную модель и загружаем заново
        this.models.delete(modelId);
        this.modelConfigs.delete(modelId);
      }
    }

    this.stats.cacheMisses++;

    // Проверяем лимиты и освобождаем место при необходимости
    await this.ensureResourcesAvailable();

    // Загружаем новую модель
    return this.loadNewModel(provider, model, modelId);
  }

  /**
   * Предзагрузка моделей по стратегии
   */
  async preloadModels(strategy: LoadingStrategy): Promise<void> {
    const modelsToLoad = this.getModelsForPreloading(strategy);

    const loadPromises = modelsToLoad.map(async ({ provider, model }) => {
      try {
        await this.loadModel(provider, model);
      } catch (error) {
        console.warn(`Failed to preload model ${provider}:${model}:`, error);
      }
    });

    await Promise.all(loadPromises);
  }

  /**
   * Оптимизация использования памяти
   */
  async optimizeMemory(options?: MemoryOptimizationOptions): Promise<void> {
    const {
      maxMemoryUsage = this.memoryLimit,
      maxModels = this.maxModels,
      idleTimeout = this.idleTimeout,
      aggressive = false
    } = options || {};

    const currentMemory = this.getTotalMemoryUsage();
    const currentModelCount = this.models.size;

    // Список моделей для выгрузки, отсортированный по приоритету
    const modelsToUnload = Array.from(this.models.values())
      .filter(model => {
        if (aggressive) return true;

        const timeSinceLastUsed = Date.now() - model.lastUsed;
        return timeSinceLastUsed > idleTimeout;
      })
      .sort((a, b) => {
        // Приоритет выгрузки: старые + малоиспользуемые модели
        const scoreA = a.lastUsed + (a.usageCount * 1000);
        const scoreB = b.lastUsed + (b.usageCount * 1000);
        return scoreA - scoreB;
      });

    // Выгружаем модели пока не достигнем целевых лимитов
    let freedMemory = 0;
    let unloadedCount = 0;

    for (const model of modelsToUnload) {
      const shouldUnload = (
        (currentMemory - freedMemory) > maxMemoryUsage ||
        (currentModelCount - unloadedCount) > maxModels
      );

      if (!shouldUnload) break;

      try {
        await this.unloadModel(model.modelId);
        freedMemory += model.memoryUsage;
        unloadedCount++;
      } catch (error) {
        console.warn(`Failed to unload model ${model.modelId}:`, error);
      }
    }

    console.log(`Memory optimization completed: freed ${freedMemory}MB, unloaded ${unloadedCount} models`);
  }

  /**
   * Получение статуса всех моделей
   */
  getModelStatus(): ModelStatus {
    const loadedModels = Array.from(this.models.values());
    const totalMemoryUsage = this.getTotalMemoryUsage();
    const activeCount = loadedModels.filter(m => m.status === 'ready').length;

    // Статистика по провайдерам
    const providerStats: Record<EmbeddingProviderType, any> = {} as any;

    for (const model of loadedModels) {
      if (!providerStats[model.provider]) {
        providerStats[model.provider] = {
          count: 0,
          memoryUsage: 0,
          avgLoadTime: 0,
          totalLoadTime: 0
        };
      }

      const stats = providerStats[model.provider];
      stats.count++;
      stats.memoryUsage += model.memoryUsage;
      stats.totalLoadTime += model.loadTime;
      stats.avgLoadTime = stats.totalLoadTime / stats.count;
    }

    return {
      loadedModels,
      totalMemoryUsage,
      activeCount,
      providerStats
    };
  }

  /**
   * Выгрузка неиспользуемых моделей
   */
  async unloadUnusedModels(): Promise<void> {
    const cutoffTime = Date.now() - this.idleTimeout;
    const modelsToUnload = Array.from(this.models.values())
      .filter(model => model.lastUsed < cutoffTime && model.status !== 'loading');

    const unloadPromises = modelsToUnload.map(model => this.unloadModel(model.modelId));
    await Promise.all(unloadPromises);

    console.log(`Unloaded ${modelsToUnload.length} unused models`);
  }

  /**
   * Получение модели для коллекции
   */
  async getModelForCollection(collection: string): Promise<EmbeddingModel | null> {
    // Заглушка - получение конфигурации коллекции
    const config = await this.getCollectionConfig(collection);
    if (!config) return null;

    try {
      return await this.loadModel(config.provider, config.model);
    } catch (error) {
      console.error(`Failed to load model for collection ${collection}:`, error);
      return null;
    }
  }

  /**
   * Прогрев модели
   */
  async warmModel(modelId: string): Promise<void> {
    const model = this.models.get(modelId);
    if (!model || model.status !== 'ready') {
      return;
    }

    try {
      // Выполняем тестовый вызов для инициализации модели
      const testText = "test warmup query";
      await model.providerInstance.generateEmbedding(testText);
      console.log(`Model ${modelId} warmed up successfully`);
    } catch (error) {
      console.warn(`Failed to warm up model ${modelId}:`, error);
    }
  }

  // === Приватные методы ===

  /**
   * Загрузка новой модели
   */
  private async loadNewModel(provider: EmbeddingProviderType, model: string | undefined, modelId: string): Promise<EmbeddingModel> {
    const startTime = Date.now();

    // Создаем конфигурацию модели
    const config: CollectionEmbeddingConfig = {
      provider,
      model: model || this.getDefaultModelForProvider(provider),
      dimensions: this.getDimensionsForProvider(provider),
      batchSize: 32,
      cacheEnabled: true,
      autoGenerate: true,
      timeout: 30000
    };

    // Добавляем запись о загружающейся модели
    const loadingModel: LoadedModel = {
      modelId,
      provider,
      modelName: config.model!,
      dimensions: config.dimensions,
      providerInstance: null as any, // Будет установлено после загрузки
      lastUsed: Date.now(),
      usageCount: 0,
      memoryUsage: this.estimateModelMemoryUsage(provider),
      loadTime: 0,
      status: 'loading'
    };

    this.models.set(modelId, loadingModel);
    this.modelConfigs.set(modelId, config);

    try {
      // Создаем провайдера
      const providerInstance = await providerFactory.createProvider(config);
      const loadTime = Date.now() - startTime;

      // Обновляем модель
      loadingModel.providerInstance = providerInstance;
      loadingModel.loadTime = loadTime;
      loadingModel.status = 'ready';
      loadingModel.usageCount = 1;

      // Обновляем статистику
      this.stats.totalLoads++;
      this.stats.avgLoadTime = (this.stats.avgLoadTime * (this.stats.totalLoads - 1) + loadTime) / this.stats.totalLoads;

      console.log(`Model ${modelId} loaded successfully in ${loadTime}ms`);

      return {
        config,
        provider: providerInstance,
        metrics: this.getModelMetrics(modelId)
      };

    } catch (error) {
      // Помечаем модель как ошибочную
      loadingModel.status = 'error';
      loadingModel.error = error instanceof Error ? error.message : String(error);

      throw new ModelLoadError(
        `Failed to load model ${modelId}: ${loadingModel.error}`,
        provider,
        modelId,
        undefined,
        { model }
      );
    }
  }

  /**
   * Выгрузка модели
   */
  private async unloadModel(modelId: string): Promise<void> {
    const model = this.models.get(modelId);
    if (!model) return;

    model.status = 'unloading';

    try {
      // Освобождаем ресурсы провайдера, если есть соответствующий метод
      if (model.providerInstance && typeof model.providerInstance.dispose === 'function') {
        await model.providerInstance.dispose();
      }

      this.models.delete(modelId);
      this.modelConfigs.delete(modelId);
      this.stats.totalUnloads++;

      console.log(`Model ${modelId} unloaded successfully`);

    } catch (error) {
      console.warn(`Failed to properly unload model ${modelId}:`, error);
      // Удаляем из кэша в любом случае
      this.models.delete(modelId);
      this.modelConfigs.delete(modelId);
    }
  }

  /**
   * Ожидание завершения загрузки модели
   */
  private async waitForModelLoad(modelId: string): Promise<EmbeddingModel> {
    const pollInterval = 100;
    const maxWaitTime = 30000; // 30 секунд
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const model = this.models.get(modelId);
      if (!model) {
        throw new ModelLoadError(`Model ${modelId} was removed during loading`, 'unknown', modelId);
      }

      if (model.status === 'ready') {
        model.lastUsed = Date.now();
        model.usageCount++;

        return {
          config: this.modelConfigs.get(modelId)!,
          provider: model.providerInstance,
          metrics: this.getModelMetrics(modelId)
        };
      }

      if (model.status === 'error') {
        throw new ModelLoadError(`Model ${modelId} failed to load: ${model.error}`, 'unknown', modelId);
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new ModelLoadError(`Model ${modelId} loading timeout`, 'unknown', modelId);
  }

  /**
   * Обеспечение доступности ресурсов
   */
  private async ensureResourcesAvailable(): Promise<void> {
    const currentMemory = this.getTotalMemoryUsage();
    const currentModelCount = this.models.size;

    // Проверяем превышение лимитов
    if (currentMemory > this.memoryLimit || currentModelCount >= this.maxModels) {
      await this.optimizeMemory({
        maxMemoryUsage: this.memoryLimit * 0.8, // Освобождаем до 80% лимита
        maxModels: this.maxModels - 1 // Оставляем место для новой модели
      });
    }
  }

  /**
   * Получение общего использования памяти
   */
  private getTotalMemoryUsage(): number {
    return Array.from(this.models.values())
      .reduce((total, model) => total + model.memoryUsage, 0);
  }

  /**
   * Генерация ID модели
   */
  private generateModelId(provider: EmbeddingProviderType, model?: string): string {
    const modelName = model || this.getDefaultModelForProvider(provider);
    return `${provider}:${modelName}`;
  }

  /**
   * Получение модели по умолчанию для провайдера
   */
  private getDefaultModelForProvider(provider: EmbeddingProviderType): string {
    const defaults: Record<EmbeddingProviderType, string> = {
      transformers: 'all-MiniLM-L6-v2',
      openai: 'text-embedding-3-small',
      cohere: 'embed-english-light-v3.0',
      huggingface: 'sentence-transformers/all-MiniLM-L6-v2',
      custom: 'custom-model'
    };

    return defaults[provider] || 'unknown-model';
  }

  /**
   * Получение размерности для провайдера
   */
  private getDimensionsForProvider(provider: EmbeddingProviderType): number {
    const dimensions: Record<EmbeddingProviderType, number> = {
      transformers: 384,
      openai: 1536,
      cohere: 1024,
      huggingface: 384,
      custom: 384
    };

    return dimensions[provider] || 384;
  }

  /**
   * Оценка использования памяти моделью
   */
  private estimateModelMemoryUsage(provider: EmbeddingProviderType): number {
    const estimates: Record<EmbeddingProviderType, number> = {
      transformers: 100, // ~100MB для all-MiniLM-L6-v2
      openai: 5,         // ~5MB для API клиента
      cohere: 5,         // ~5MB для API клиента
      huggingface: 80,   // ~80MB в среднем
      custom: 50         // ~50MB по умолчанию
    };

    return estimates[provider] || 50;
  }

  /**
   * Получение конфигурации коллекции (заглушка)
   */
  private async getCollectionConfig(collection: string): Promise<CollectionEmbeddingConfig | null> {
    // Заглушка - в реальной реализации это будет запрос к базе данных
    return {
      provider: 'transformers',
      model: 'all-MiniLM-L6-v2',
      dimensions: 384,
      batchSize: 32,
      cacheEnabled: true,
      autoGenerate: true,
      timeout: 30000
    };
  }

  /**
   * Получение моделей для предзагрузки
   */
  private getModelsForPreloading(strategy: LoadingStrategy): Array<{ provider: EmbeddingProviderType; model?: string }> {
    switch (strategy) {
      case 'eager':
        // Загружаем все основные модели
        return [
          { provider: 'transformers', model: 'all-MiniLM-L6-v2' },
          { provider: 'openai', model: 'text-embedding-3-small' }
        ];

      case 'predictive':
        // Загружаем наиболее часто используемые модели
        return [
          { provider: 'transformers', model: 'all-MiniLM-L6-v2' }
        ];

      case 'lazy':
      default:
        // Не загружаем ничего заранее
        return [];
    }
  }

  /**
   * Получение метрик производительности модели
   */
  private getModelMetrics(modelId: string): EmbeddingModel['metrics'] {
    // Заглушка - в реальной реализации здесь будет реальная статистика
    return {
      averageInferenceTime: 150, // мс
      totalRequests: 0,
      successRate: 1.0,
      lastPerformanceCheck: Date.now()
    };
  }

  /**
   * Запуск таймера автоматической очистки
   */
  private startCleanupTimer(interval: number): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.unloadUnusedModels().catch(error => {
        console.warn('Automated cleanup failed:', error);
      });
    }, interval);
  }

  /**
   * Остановка таймера и освобождение ресурсов
   */
  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Выгружаем все модели
    const unloadPromises = Array.from(this.models.keys()).map(modelId => this.unloadModel(modelId));
    Promise.all(unloadPromises).catch(error => {
      console.warn('Failed to dispose all models:', error);
    });
  }
}

/**
 * Фабричная функция для создания ModelManager
 */
export function createModelManager(options: {
  memoryLimit?: number;
  maxModels?: number;
  idleTimeout?: number;
  cleanupInterval?: number;
} = {}): ModelManager {
  return new ModelManagerImpl(options);
}