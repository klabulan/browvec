/**
 * ProviderManager
 *
 * Manages embedding providers for different collections.
 * Handles provider initialization, caching, and lifecycle management.
 */

import type { EmbeddingProvider, CollectionEmbeddingConfig } from '../../../embedding/types.js';
import { providerFactory } from '../../../embedding/ProviderFactory.js';
import { EmbeddingError } from '../../../embedding/errors.js';
import type { SQLiteManager } from '../core/SQLiteManager.js';

/**
 * Provider cache entry
 */
interface ProviderCacheEntry {
  provider: EmbeddingProvider;
  config: CollectionEmbeddingConfig;
  lastUsed: number;
  initPromise?: Promise<EmbeddingProvider>;
}

/**
 * ProviderManager manages embedding providers for collections
 *
 * Responsibilities:
 * - Provider initialization and configuration
 * - Provider caching and lifecycle management
 * - Collection-specific provider resolution
 * - Resource cleanup and disposal
 * - Provider health monitoring
 */
export class ProviderManager {
  private providers = new Map<string, ProviderCacheEntry>();
  private initPromises = new Map<string, Promise<EmbeddingProvider>>();
  private cleanupTimer: NodeJS.Timeout | null = null;
  private readonly maxCacheAge = 30 * 60 * 1000; // 30 minutes
  private readonly cleanupInterval = 5 * 60 * 1000; // 5 minutes

  constructor(
    private sqliteManager: SQLiteManager,
    private logger?: { log: (level: string, message: string, data?: any) => void }
  ) {
    this.startCleanupTimer();
  }

  /**
   * Get or create embedding provider for a collection
   */
  async getProvider(collection: string): Promise<EmbeddingProvider | null> {
    try {
      // Check cache first
      const cached = this.providers.get(collection);
      if (cached) {
        cached.lastUsed = Date.now();
        return cached.provider;
      }

      // Check if initialization is already in progress
      const initPromise = this.initPromises.get(collection);
      if (initPromise) {
        return await initPromise;
      }

      // Start new initialization
      const promise = this.initializeProvider(collection);
      this.initPromises.set(collection, promise);

      try {
        const provider = await promise;
        this.cacheProvider(collection, provider);
        this.initPromises.delete(collection);
        return provider;
      } catch (error) {
        this.initPromises.delete(collection);
        throw error;
      }
    } catch (error) {
      this.log('error', `Failed to get embedding provider for collection '${collection}': ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Initialize embedding provider for a collection
   */
  private async initializeProvider(collection: string): Promise<EmbeddingProvider> {
    try {
      // Get collection configuration
      const collectionResult = await this.sqliteManager.select(
        'SELECT config FROM collections WHERE name = ?',
        [collection]
      );

      if (collectionResult.rows.length === 0) {
        throw new EmbeddingError(`Collection '${collection}' not found`);
      }

      const config = JSON.parse(collectionResult.rows[0].config || '{}');
      const embeddingConfig: CollectionEmbeddingConfig = config.embeddingConfig;

      if (!embeddingConfig) {
        throw new EmbeddingError(`Collection '${collection}' has no embedding configuration`);
      }

      // Create provider using factory
      const provider = await providerFactory.createProvider(embeddingConfig.type, embeddingConfig);

      // Initialize the provider
      if (typeof provider.initialize === 'function') {
        await provider.initialize(embeddingConfig);
      }

      this.log('info', `Initialized embedding provider '${embeddingConfig.type}' for collection '${collection}'`);
      return provider;
    } catch (error) {
      throw new EmbeddingError(`Failed to initialize embedding provider for collection '${collection}': ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Cache provider with metadata
   */
  private cacheProvider(collection: string, provider: EmbeddingProvider): void {
    // Get the config again for caching
    this.sqliteManager.select(
      'SELECT config FROM collections WHERE name = ?',
      [collection]
    ).then(result => {
      if (result.rows.length > 0) {
        const config = JSON.parse(result.rows[0].config || '{}');
        const embeddingConfig: CollectionEmbeddingConfig = config.embeddingConfig;

        this.providers.set(collection, {
          provider,
          config: embeddingConfig,
          lastUsed: Date.now()
        });
      }
    }).catch(error => {
      this.log('warn', `Failed to cache provider config for collection '${collection}': ${error instanceof Error ? error.message : String(error)}`);
    });
  }

  /**
   * Remove provider from cache
   */
  async removeProvider(collection: string): Promise<void> {
    const cached = this.providers.get(collection);
    if (cached) {
      try {
        if (typeof cached.provider.dispose === 'function') {
          await cached.provider.dispose();
        }
      } catch (error) {
        this.log('warn', `Error disposing provider for collection '${collection}': ${error instanceof Error ? error.message : String(error)}`);
      }

      this.providers.delete(collection);
      this.log('debug', `Removed provider for collection '${collection}' from cache`);
    }
  }

  /**
   * Update provider configuration
   */
  async updateProviderConfig(collection: string, config: CollectionEmbeddingConfig): Promise<void> {
    // Remove existing provider
    await this.removeProvider(collection);

    // Clear any pending initialization
    this.initPromises.delete(collection);

    this.log('info', `Updated provider configuration for collection '${collection}'`);
  }

  /**
   * Get provider health status
   */
  async getProviderHealth(collection: string): Promise<{ healthy: boolean; error?: string }> {
    try {
      const provider = await this.getProvider(collection);
      if (!provider) {
        return { healthy: false, error: 'Provider not available' };
      }

      // Check if provider has health check method
      if (typeof provider.healthCheck === 'function') {
        try {
          const isHealthy = await provider.healthCheck();
          return { healthy: isHealthy };
        } catch (error) {
          return { healthy: false, error: error instanceof Error ? error.message : String(error) };
        }
      }

      // Basic health check - try to generate a small embedding
      try {
        const testResult = await provider.generateEmbedding('test', { timeout: 5000 });
        return { healthy: testResult.embedding.length > 0 };
      } catch (error) {
        return { healthy: false, error: error instanceof Error ? error.message : String(error) };
      }
    } catch (error) {
      return { healthy: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  /**
   * Get all cached providers
   */
  getCachedProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get provider statistics
   */
  getProviderStats(): { collection: string; type: string; lastUsed: number }[] {
    return Array.from(this.providers.entries()).map(([collection, entry]) => ({
      collection,
      type: entry.config.type,
      lastUsed: entry.lastUsed
    }));
  }

  /**
   * Cleanup expired providers
   */
  private async cleanupExpiredProviders(): Promise<void> {
    const now = Date.now();
    const expiredCollections: string[] = [];

    for (const [collection, entry] of this.providers.entries()) {
      if (now - entry.lastUsed > this.maxCacheAge) {
        expiredCollections.push(collection);
      }
    }

    if (expiredCollections.length > 0) {
      this.log('debug', `Cleaning up ${expiredCollections.length} expired providers`);

      for (const collection of expiredCollections) {
        await this.removeProvider(collection);
      }
    }
  }

  /**
   * Start cleanup timer for expired providers
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      return;
    }

    this.cleanupTimer = setInterval(async () => {
      try {
        await this.cleanupExpiredProviders();
      } catch (error) {
        this.log('warn', `Provider cleanup error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, this.cleanupInterval);

    this.log('debug', `Started provider cleanup timer with interval: ${this.cleanupInterval}ms`);
  }

  /**
   * Stop cleanup timer
   */
  private stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
      this.log('debug', 'Stopped provider cleanup timer');
    }
  }

  /**
   * Dispose all providers and cleanup resources
   */
  async dispose(): Promise<void> {
    this.log('info', `Disposing ${this.providers.size} embedding providers`);

    // Stop cleanup timer
    this.stopCleanupTimer();

    // Dispose all providers
    const disposePromises = Array.from(this.providers.keys()).map(collection =>
      this.removeProvider(collection)
    );

    try {
      await Promise.all(disposePromises);
      this.log('info', 'All embedding providers disposed successfully');
    } catch (error) {
      this.log('error', `Error during provider disposal: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Clear all caches
    this.providers.clear();
    this.initPromises.clear();
  }

  /**
   * Force refresh all providers (reload configurations)
   */
  async refreshAll(): Promise<void> {
    this.log('info', 'Refreshing all embedding providers');

    const collections = Array.from(this.providers.keys());

    // Remove all current providers
    for (const collection of collections) {
      await this.removeProvider(collection);
    }

    this.log('info', `Refreshed ${collections.length} embedding providers`);
  }

  private log(level: string, message: string, data?: any): void {
    if (this.logger) {
      this.logger.log(level, message, data);
    } else {
      console.log(`[ProviderManager] ${level.toUpperCase()}: ${message}`, data ? data : '');
    }
  }
}