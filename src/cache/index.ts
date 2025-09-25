/**
 * Cache exports for LocalRetrieve
 *
 * Экспорты многоуровневой системы кэширования для эмбеддингов,
 * включая memory, IndexedDB и SQLite уровни с оптимизацией производительности.
 */

// Main cache coordinator
export {
  type CacheManager,
  CacheManagerImpl,
  createCacheManager,
  type CacheLevel,
  type CacheOptions,
  type CacheStatistics,
  type CacheResult
} from './CacheManager.js';

// Query-specific caching
export {
  QueryCache,
  type QueryCacheOptions,
  type QueryCacheEntry,
  type QueryCacheConfig,
  type QueryCacheStats
} from './QueryCache.js';

// Model caching
export {
  ModelCache,
  type CachedModelInfo,
  type ModelCacheConfig,
  type ModelCacheStats,
  type ModelCacheEntry
} from './ModelCache.js';

/**
 * Default cache configurations
 */
export const DEFAULT_CACHE_CONFIG = {
  MEMORY_SIZE: 1000, // Максимально 1000 элементов в memory cache
  MEMORY_TTL: 5 * 60 * 1000, // 5 минут для memory cache
  INDEXEDDB_TTL: 24 * 60 * 60 * 1000, // 24 часа для IndexedDB
  DATABASE_TTL: 7 * 24 * 60 * 60 * 1000, // 7 дней для SQLite database
  CLEANUP_INTERVAL: 60 * 1000, // Очистка каждую минуту
  MAX_MEMORY_MB: 100, // 100MB максимум для memory cache
  MAX_MODELS: 10, // Максимум 10 моделей в кэше
  MODEL_MEMORY_LIMIT: 500 // 500MB для всех моделей
} as const;

/**
 * Утилитарные функции для работы с кэшем
 */
export class CacheUtils {
  /**
   * Генерация ключа кэша для query embedding
   */
  static generateQueryCacheKey(query: string, collection: string, configHash: string): string {
    const queryHash = CacheUtils.hashString(query.trim().toLowerCase());
    return `query:${collection}:${configHash}:${queryHash}`;
  }

  /**
   * Генерация ключа кэша для модели
   */
  static generateModelCacheKey(provider: string, model: string): string {
    return `model:${provider}:${model}`;
  }

  /**
   * Простая hash функция для строк
   */
  static hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Оценка размера объекта в байтах
   */
  static estimateObjectSize(obj: any): number {
    try {
      const jsonString = JSON.stringify(obj);
      return jsonString.length * 2; // UTF-16 uses 2 bytes per character
    } catch {
      return 1000; // 1KB fallback
    }
  }

  /**
   * Проверка доступности IndexedDB
   */
  static isIndexedDBAvailable(): boolean {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  }

  /**
   * Проверка, является ли паттерн wildcard
   */
  static isWildcardPattern(pattern: string): boolean {
    return pattern.includes('*') || pattern.includes('?');
  }

  /**
   * Конвертация wildcard паттерна в RegExp
   */
  static wildcardToRegex(pattern: string): RegExp {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const regexPattern = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
    return new RegExp(`^${regexPattern}$`, 'i');
  }

  /**
   * Форматирование размера в человекочитаемый вид
   */
  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Проверка истечения TTL
   */
  static isExpired(timestamp: number, ttl: number): boolean {
    return Date.now() > (timestamp + ttl);
  }

  /**
   * Создание expires timestamp
   */
  static createExpiresAt(ttl: number): number {
    return Date.now() + ttl;
  }
}

/**
 * Типы для интеграции с другими системами
 */
export interface CacheIntegration {
  /** Интеграция с worker для database уровня */
  workerRPC?: {
    get: (key: string) => Promise<any>;
    set: (key: string, value: any, options?: any) => Promise<void>;
    delete: (key: string) => Promise<boolean>;
    clear: () => Promise<void>;
  };

  /** Интеграция с метриками */
  metricsCollector?: {
    recordCacheHit: (level: CacheLevel) => void;
    recordCacheMiss: () => void;
    recordCacheEviction: (level: CacheLevel) => void;
    recordAccessTime: (level: CacheLevel, time: number) => void;
  };

  /** Интеграция с логированием */
  logger?: {
    debug: (message: string, data?: any) => void;
    info: (message: string, data?: any) => void;
    warn: (message: string, data?: any) => void;
    error: (message: string, data?: any) => void;
  };
}

/**
 * Фабричная функция для создания полной cache системы с интеграциями
 */
export function createIntegratedCacheSystem(
  config: Partial<typeof DEFAULT_CACHE_CONFIG> = {},
  integrations: CacheIntegration = {}
) {
  const fullConfig = { ...DEFAULT_CACHE_CONFIG, ...config };

  const cacheManager = createCacheManager({
    memorySize: fullConfig.MEMORY_SIZE,
    indexedDBName: 'LocalRetrieveCache',
    dbVersion: 1
  });

  // Настройка интеграций если предоставлены
  if (integrations.workerRPC) {
    // TODO: Настроить интеграцию с worker RPC
  }

  if (integrations.metricsCollector) {
    // TODO: Настроить сбор метрик
  }

  if (integrations.logger) {
    // TODO: Настроить логирование
  }

  return {
    cacheManager,
    config: fullConfig,
    utils: CacheUtils
  };
}