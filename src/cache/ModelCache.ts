/**
 * ModelCache - кэширование embedding моделей и их метаданных
 *
 * Специализированный кэш для embedding моделей, обеспечивающий:
 * - Кэширование загруженных моделей и их состояний
 * - Оптимизацию памяти для больших моделей
 * - Предзагрузку и warming стратегии
 * - Статистику использования моделей
 */

import type { EmbeddingProviderType } from '../embedding/types.js';
import type { EmbeddingProvider } from '../embedding/providers/BaseProvider.js';
import { CacheError } from '../embedding/errors.js';

/**
 * Кэшированная информация о модели
 */
export interface CachedModelInfo {
  /** ID модели */
  modelId: string;
  /** Тип провайдера */
  provider: EmbeddingProviderType;
  /** Название модели */
  modelName: string;
  /** Размерность эмбеддингов */
  dimensions: number;
  /** Время загрузки модели */
  loadTime: number;
  /** Время кэширования */
  cachedAt: number;
  /** Время последнего использования */
  lastUsed: number;
  /** Количество использований */
  usageCount: number;
  /** Приблизительное использование памяти в MB */
  memoryUsage: number;
  /** Статус модели */
  status: 'cached' | 'loading' | 'ready' | 'error';
  /** Метаданные производительности */
  performance: {
    averageInferenceTime: number;
    successRate: number;
    errorCount: number;
    lastBenchmark: number;
  };
  /** Теги для группировки */
  tags: string[];
}

/**
 * Конфигурация ModelCache
 */
export interface ModelCacheConfig {
  /** Максимальное количество моделей в кэше */
  maxSize?: number;
  /** Максимальное использование памяти в MB */
  maxMemory?: number;
  /** TTL для кэшированных моделей в мс */
  ttl?: number;
  /** Стратегия выселения моделей */
  evictionStrategy?: 'lru' | 'memory_usage' | 'usage_count' | 'hybrid';
  /** Интервал оптимизации кэша */
  optimizationInterval?: number;
}

/**
 * Статистика ModelCache
 */
export interface ModelCacheStats {
  /** Количество кэшированных моделей */
  size: number;
  /** Максимальный размер кэша */
  maxSize: number;
  /** Общее использование памяти в MB */
  memoryUsage: number;
  /** Максимально разрешенная память */
  maxMemory: number;
  /** Статистика по провайдерам */
  providerStats: Record<string, {
    count: number;
    memoryUsage: number;
    avgInferenceTime: number;
    successRate: number;
  }>;
  /** Производительность кэша */
  cachePerformance: {
    hits: number;
    misses: number;
    hitRate: number;
    evictions: number;
  };
}

/**
 * Запись в кэше моделей
 */
export interface ModelCacheEntry {
  /** Информация о модели */
  modelInfo: CachedModelInfo;
  /** Экземпляр провайдера (если загружен) */
  providerInstance?: EmbeddingProvider;
  /** Время истечения кэша */
  expiresAt?: number;
}

/**
 * Основная реализация ModelCache
 */
export class ModelCache {
  private cache: Map<string, ModelCacheEntry>;
  private config: Required<ModelCacheConfig>;
  private optimizationTimer: NodeJS.Timeout | null;

  // Статистика
  private stats: {
    hits: number;
    misses: number;
    evictions: number;
    totalLoadTime: number;
    totalLoads: number;
  };

  constructor(config: ModelCacheConfig = {}) {
    this.cache = new Map();

    this.config = {
      maxSize: config.maxSize || 10,
      maxMemory: config.maxMemory || 500, // 500MB
      ttl: config.ttl || 30 * 60 * 1000, // 30 минут
      evictionStrategy: config.evictionStrategy || 'hybrid',
      optimizationInterval: config.optimizationInterval || 5 * 60 * 1000 // 5 минут
    };

    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalLoadTime: 0,
      totalLoads: 0
    };

    this.optimizationTimer = null;
    this.startOptimizationTimer();
  }

  /**
   * Получение модели из кэша
   */
  async get(modelId: string): Promise<CachedModelInfo | null> {
    const entry = this.cache.get(modelId);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Проверяем истечение TTL
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(modelId);
      this.stats.misses++;
      return null;
    }

    // Обновляем статистику использования
    entry.modelInfo.lastUsed = Date.now();
    entry.modelInfo.usageCount++;

    this.stats.hits++;
    return entry.modelInfo;
  }

  /**
   * Сохранение модели в кэш
   */
  async set(modelId: string, modelInfo: CachedModelInfo, providerInstance?: EmbeddingProvider): Promise<void> {
    // Проверяем необходимость освобождения места
    await this.ensureSpace(modelInfo.memoryUsage);

    const entry: ModelCacheEntry = {
      modelInfo: {
        ...modelInfo,
        cachedAt: Date.now(),
        lastUsed: Date.now()
      },
      providerInstance,
      expiresAt: this.config.ttl ? Date.now() + this.config.ttl : undefined
    };

    this.cache.set(modelId, entry);
    this.stats.totalLoads++;
    this.stats.totalLoadTime += modelInfo.loadTime;

    console.log(`Model ${modelId} cached successfully (${modelInfo.memoryUsage}MB)`);
  }

  /**
   * Получение экземпляра провайдера
   */
  async getProvider(modelId: string): Promise<EmbeddingProvider | null> {
    const entry = this.cache.get(modelId);
    return entry?.providerInstance || null;
  }

  /**
   * Обновление производительности модели
   */
  async updatePerformance(modelId: string, stats: {
    inferenceTime?: number;
    success?: boolean;
    error?: boolean;
  }): Promise<void> {
    const entry = this.cache.get(modelId);
    if (!entry) return;

    const perf = entry.modelInfo.performance;

    if (stats.inferenceTime !== undefined) {
      const totalInferences = entry.modelInfo.usageCount;
      perf.averageInferenceTime = totalInferences > 1
        ? (perf.averageInferenceTime * (totalInferences - 1) + stats.inferenceTime) / totalInferences
        : stats.inferenceTime;
    }

    if (stats.success !== undefined) {
      const totalRequests = entry.modelInfo.usageCount;
      const successfulRequests = Math.round(perf.successRate * (totalRequests - 1));
      const newSuccessful = successfulRequests + (stats.success ? 1 : 0);
      perf.successRate = newSuccessful / totalRequests;
    }

    if (stats.error) {
      perf.errorCount++;
    }

    perf.lastBenchmark = Date.now();
  }

  /**
   * Проверка наличия модели в кэше
   */
  has(modelId: string): boolean {
    const entry = this.cache.get(modelId);
    if (!entry) return false;

    // Проверяем истечение TTL
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(modelId);
      return false;
    }

    return true;
  }

  /**
   * Удаление модели из кэша
   */
  async delete(modelId: string): Promise<boolean> {
    const entry = this.cache.get(modelId);
    if (!entry) return false;

    // Освобождаем ресурсы провайдера
    if (entry.providerInstance && 'dispose' in entry.providerInstance && typeof (entry.providerInstance as any).dispose === 'function') {
      try {
        await (entry.providerInstance as any).dispose();
      } catch (error) {
        console.warn(`Failed to dispose provider for model ${modelId}:`, error);
      }
    }

    return this.cache.delete(modelId);
  }

  /**
   * Удаление моделей по паттерну
   */
  async invalidate(pattern: string): Promise<void> {
    const keysToDelete: string[] = [];

    if (pattern === '*') {
      keysToDelete.push(...this.cache.keys());
    } else if (pattern.startsWith('provider:')) {
      const provider = pattern.substring(9);
      for (const [key, entry] of this.cache.entries()) {
        if (entry.modelInfo.provider === provider) {
          keysToDelete.push(key);
        }
      }
    } else if (pattern.startsWith('tag:')) {
      const tag = pattern.substring(4);
      for (const [key, entry] of this.cache.entries()) {
        if (entry.modelInfo.tags.includes(tag)) {
          keysToDelete.push(key);
        }
      }
    } else if (pattern.includes('*')) {
      const regex = new RegExp(pattern.replace(/\*/g, '.*'));
      for (const key of this.cache.keys()) {
        if (regex.test(key)) {
          keysToDelete.push(key);
        }
      }
    } else {
      if (this.cache.has(pattern)) {
        keysToDelete.push(pattern);
      }
    }

    // Удаляем найденные модели
    for (const key of keysToDelete) {
      await this.delete(key);
    }
  }

  /**
   * Получение всех кэшированных моделей
   */
  getAllModels(): CachedModelInfo[] {
    return Array.from(this.cache.values()).map(entry => entry.modelInfo);
  }

  /**
   * Получение моделей по провайдеру
   */
  getModelsByProvider(provider: EmbeddingProviderType): CachedModelInfo[] {
    return this.getAllModels().filter(model => model.provider === provider);
  }

  /**
   * Получение наиболее используемых моделей
   */
  getMostUsedModels(limit: number = 5): CachedModelInfo[] {
    return this.getAllModels()
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  }

  /**
   * Получение статистики кэша
   */
  getStats(): ModelCacheStats {
    const models = this.getAllModels();
    const totalMemoryUsage = models.reduce((sum, model) => sum + model.memoryUsage, 0);

    // Статистика по провайдерам
    const providerStats: Record<string, any> = {};
    for (const model of models) {
      if (!providerStats[model.provider]) {
        providerStats[model.provider] = {
          count: 0,
          memoryUsage: 0,
          totalInferenceTime: 0,
          totalSuccessRate: 0
        };
      }

      const stats = providerStats[model.provider];
      stats.count++;
      stats.memoryUsage += model.memoryUsage;
      stats.totalInferenceTime += model.performance.averageInferenceTime;
      stats.totalSuccessRate += model.performance.successRate;
    }

    // Вычисляем средние значения
    for (const provider of Object.keys(providerStats)) {
      const stats = providerStats[provider];
      stats.avgInferenceTime = stats.totalInferenceTime / stats.count;
      stats.successRate = stats.totalSuccessRate / stats.count;
      delete stats.totalInferenceTime;
      delete stats.totalSuccessRate;
    }

    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;

    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      memoryUsage: totalMemoryUsage,
      maxMemory: this.config.maxMemory,
      providerStats,
      cachePerformance: {
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate,
        evictions: this.stats.evictions
      }
    };
  }

  /**
   * Очистка всего кэша
   */
  async clear(): Promise<void> {
    const deletePromises = Array.from(this.cache.keys()).map(key => this.delete(key));
    await Promise.all(deletePromises);

    this.cache.clear();

    // Сброс статистики
    this.stats = {
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
  async optimize(): Promise<void> {
    // Удаляем истекшие модели
    await this.cleanupExpired();

    // Применяем стратегию выселения если превышены лимиты
    const currentMemory = this.getCurrentMemoryUsage();
    if (currentMemory > this.config.maxMemory || this.cache.size > this.config.maxSize) {
      await this.evictModels();
    }

    console.log('Model cache optimization completed');
  }

  /**
   * Получение текущего использования памяти
   */
  getMemoryUsage(): number {
    return this.getCurrentMemoryUsage();
  }

  // === Приватные методы ===

  /**
   * Обеспечение свободного места в кэше
   */
  private async ensureSpace(requiredMemory: number): Promise<void> {
    const currentMemory = this.getCurrentMemoryUsage();

    if (currentMemory + requiredMemory > this.config.maxMemory ||
        this.cache.size >= this.config.maxSize) {
      await this.evictModels(requiredMemory);
    }
  }

  /**
   * Выселение моделей согласно стратегии
   */
  private async evictModels(requiredSpace: number = 0): Promise<void> {
    const targetMemory = Math.min(
      this.config.maxMemory * 0.8,
      this.config.maxMemory - requiredSpace
    );
    const targetSize = Math.floor(this.config.maxSize * 0.8);

    const entries = Array.from(this.cache.entries());
    const sortedEntries = this.sortForEviction(entries);

    let freedMemory = 0;
    const keysToEvict: string[] = [];

    for (const [key, entry] of sortedEntries) {
      keysToEvict.push(key);
      freedMemory += entry.modelInfo.memoryUsage;

      const remainingMemory = this.getCurrentMemoryUsage() - freedMemory;
      const remainingCount = this.cache.size - keysToEvict.length;

      if (remainingMemory <= targetMemory && remainingCount <= targetSize) {
        break;
      }
    }

    // Выселяем модели
    for (const key of keysToEvict) {
      await this.delete(key);
      this.stats.evictions++;
    }

    console.log(`Evicted ${keysToEvict.length} models, freed ${freedMemory}MB`);
  }

  /**
   * Сортировка моделей для выселения
   */
  private sortForEviction(entries: [string, ModelCacheEntry][]): [string, ModelCacheEntry][] {
    switch (this.config.evictionStrategy) {
      case 'lru':
        return entries.sort((a, b) => a[1].modelInfo.lastUsed - b[1].modelInfo.lastUsed);

      case 'memory_usage':
        return entries.sort((a, b) => b[1].modelInfo.memoryUsage - a[1].modelInfo.memoryUsage);

      case 'usage_count':
        return entries.sort((a, b) => a[1].modelInfo.usageCount - b[1].modelInfo.usageCount);

      case 'hybrid':
      default:
        // Гибридная стратегия: учитываем все факторы
        return entries.sort((a, b) => {
          const scoreA = this.calculateEvictionScore(a[1].modelInfo);
          const scoreB = this.calculateEvictionScore(b[1].modelInfo);
          return scoreA - scoreB; // Меньший score = выселяется первым
        });
    }
  }

  /**
   * Вычисление оценки для выселения (гибридная стратегия)
   */
  private calculateEvictionScore(model: CachedModelInfo): number {
    const now = Date.now();
    const ageScore = (now - model.lastUsed) / (60 * 1000); // Минуты с последнего использования
    const usageScore = Math.max(1, model.usageCount) * 100; // Частота использования
    const memoryScore = model.memoryUsage * 10; // Использование памяти
    const performanceScore = model.performance.successRate * 50; // Производительность

    // Итоговая оценка: возраст + память - использование - производительность
    return ageScore + memoryScore - usageScore - performanceScore;
  }

  /**
   * Очистка истекших моделей
   */
  private async cleanupExpired(): Promise<void> {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt && now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      await this.delete(key);
    }

    if (keysToDelete.length > 0) {
      console.log(`Cleaned up ${keysToDelete.length} expired models`);
    }
  }

  /**
   * Получение текущего использования памяти
   */
  private getCurrentMemoryUsage(): number {
    let totalMemory = 0;
    for (const entry of this.cache.values()) {
      totalMemory += entry.modelInfo.memoryUsage;
    }
    return totalMemory;
  }

  /**
   * Запуск таймера оптимизации
   */
  private startOptimizationTimer(): void {
    if (this.optimizationTimer) {
      clearInterval(this.optimizationTimer);
    }

    this.optimizationTimer = setInterval(() => {
      this.optimize().catch(error => {
        console.warn('Model cache optimization failed:', error);
      });
    }, this.config.optimizationInterval);
  }

  /**
   * Остановка таймера и освобождение ресурсов
   */
  dispose(): void {
    if (this.optimizationTimer) {
      clearInterval(this.optimizationTimer);
      this.optimizationTimer = null;
    }

    this.clear().catch(error => {
      console.warn('Failed to clear model cache during disposal:', error);
    });
  }
}