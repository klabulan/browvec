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
      if (this.logger) {
        this.logger.log('info', `Generating query embedding: ${query.substring(0, 50)}`);
      }

      const provider = await providerManager.getProvider(collection);
      if (!provider) {
        throw new Error('No embedding provider available for collection');
      }

      const embedding = await provider.generateEmbedding(query);

      if (this.logger) {
        this.logger.log('info', `Query embedding generated successfully, dimensions: ${embedding.length}`);
      }

      return embedding;

    } catch (error) {
      if (this.logger) {
        this.logger.log('error', `Failed to generate query embedding: ${error instanceof Error ? error.message : String(error)}`);
      }
      throw error;
    }
  }
}