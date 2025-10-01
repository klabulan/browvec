/**
 * Simple and robust SearchHandler for LocalRetrieve Worker
 * Handles embedding generation for advanced search mode using existing infrastructure
 */

import { BaseHandler, type HandlerDependencies } from './BaseHandler.js';
import type { QueryResult } from '../../../types/worker.js';

/**
 * Simple search handler with embedding generation capability
 * Uses DatabaseWorker's existing ProviderManager instead of creating its own
 */
export class SearchHandler extends BaseHandler {
  getComponentName(): string {
    return 'SearchHandler';
  }

  constructor(dependencies: HandlerDependencies) {
    super(dependencies);
  }

  /**
   * Generate query embedding using DatabaseWorker's ProviderManager
   * This method should be called by DatabaseWorker, not used standalone
   */
  async generateEmbeddingWithProvider(providerManager: any, query: string, collection: string = 'default'): Promise<Float32Array> {
    try {
      this.logger.info('Generating query embedding', { query: query.substring(0, 50), collection });

      const provider = await providerManager.getProvider(collection);
      if (!provider) {
        throw new Error('No embedding provider available for collection');
      }

      const embedding = await provider.generateEmbedding(query);

      this.logger.info('Query embedding generated successfully', {
        query: query.substring(0, 50),
        dimensions: embedding.length
      });

      return embedding;

    } catch (error) {
      this.logger.error('Failed to generate query embedding', { query, error });
      throw error;
    }
  }
}