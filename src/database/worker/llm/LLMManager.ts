/**
 * LLM Manager
 *
 * Manages LLM provider instances and operations in the worker context.
 * Handles provider creation, caching, and LLM operations.
 */

import type { Logger } from '../utils/Logger.js';
import { BaseLLMProvider } from '../../../llm/providers/BaseLLMProvider.js';
import { OpenAIProvider } from '../../../llm/providers/OpenAIProvider.js';
import { AnthropicProvider } from '../../../llm/providers/AnthropicProvider.js';
import { OpenRouterProvider } from '../../../llm/providers/OpenRouterProvider.js';
import { CustomProvider } from '../../../llm/providers/CustomProvider.js';
import type { LLMProviderConfig, EnhancedQuery, ResultSummary } from '../../../llm/types.js';
import { LLMError, LLMParseError } from '../../../llm/errors.js';

export class LLMManager {
  private logger: Logger;
  private providerCache = new Map<string, BaseLLMProvider>();

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Get or create provider instance
   */
  private getProvider(config: LLMProviderConfig): BaseLLMProvider {
    // Create cache key from provider, model, and first 8 chars of API key
    const apiKeyPrefix = config.apiKey ? config.apiKey.substring(0, 8) : 'none';
    const cacheKey = `${config.provider}:${config.model}:${apiKeyPrefix}`;

    let provider = this.providerCache.get(cacheKey);
    if (!provider) {
      provider = this.createProvider(config);
      this.providerCache.set(cacheKey, provider);
      this.logger.info(`Created LLM provider: ${config.provider}/${config.model}`);
    }

    return provider;
  }

  /**
   * Create provider instance based on configuration
   */
  private createProvider(config: LLMProviderConfig): BaseLLMProvider {
    switch (config.provider) {
      case 'openai':
        return new OpenAIProvider(config, this.logger);

      case 'anthropic':
        return new AnthropicProvider(config, this.logger);

      case 'openrouter':
        return new OpenRouterProvider(config, this.logger);

      case 'custom':
        return new CustomProvider(config, this.logger);

      default:
        throw new LLMError(
          `Unknown provider: ${config.provider}`,
          'INVALID_CONFIG',
          undefined,
          config.provider
        );
    }
  }

  /**
   * Generic LLM call with arbitrary prompt (SCRUM-17)
   *
   * Provides direct access to LLM for custom use cases.
   * Returns raw LLM response without JSON parsing.
   */
  async callLLM(
    prompt: string,
    config: LLMProviderConfig,
    options?: any
  ): Promise<{ text: string; finishReason: string; usage?: any; model: string; provider: string; processingTime: number }> {
    const startTime = Date.now();
    const provider = this.getProvider(config);

    try {
      this.logger.debug(`Generic LLM call`, {
        provider: config.provider,
        promptLength: prompt.length
      });

      const response = await provider.call(prompt, options);

      const result = {
        text: response.text,
        finishReason: response.finishReason,
        usage: response.usage,
        model: response.model || config.model,
        provider: response.provider || config.provider,
        processingTime: Date.now() - startTime
      };

      this.logger.debug('Generic LLM call complete', {
        provider: config.provider,
        processingTime: result.processingTime,
        textLength: result.text.length
      });

      return result;

    } catch (error: any) {
      this.logger.error('Generic LLM call failed', {
        error: error.message,
        provider: config.provider,
        promptLength: prompt.length
      });

      throw error;
    }
  }

  /**
   * Enhance query using LLM
   */
  async enhanceQuery(
    query: string,
    config: LLMProviderConfig,
    options?: any
  ): Promise<EnhancedQuery> {
    const startTime = Date.now();
    const provider = this.getProvider(config);

    try {
      this.logger.debug(`Enhancing query: "${query}"`, { provider: config.provider });

      const response = await provider.enhanceQuery(query, options);
      const result = JSON.parse(response.text);

      const enhancedQuery: EnhancedQuery = {
        originalQuery: query,
        enhancedQuery: result.enhancedQuery || query,
        suggestions: Array.isArray(result.suggestions) ? result.suggestions : [],
        intent: result.intent,
        confidence: typeof result.confidence === 'number' ? result.confidence : 0.5,
        provider: config.provider,
        model: config.model,
        processingTime: Date.now() - startTime
      };

      this.logger.debug('Query enhancement complete', {
        provider: config.provider,
        enhancedQuery: enhancedQuery.enhancedQuery,
        processingTime: enhancedQuery.processingTime
      });

      return enhancedQuery;

    } catch (error: any) {
      this.logger.error('Query enhancement failed', {
        error: error.message,
        query,
        provider: config.provider
      });

      // If JSON parsing fails, try to extract data manually
      if (error instanceof SyntaxError) {
        throw new LLMParseError(
          'Failed to parse LLM JSON response',
          config.provider,
          { error: error.message }
        );
      }

      throw error;
    }
  }

  /**
   * Summarize search results using LLM
   */
  async summarizeResults(
    results: any[],
    config: LLMProviderConfig,
    options?: any
  ): Promise<ResultSummary> {
    const startTime = Date.now();
    const provider = this.getProvider(config);

    try {
      this.logger.debug(`Summarizing ${results.length} results`, { provider: config.provider });

      const response = await provider.summarizeResults(results, options);
      const result = JSON.parse(response.text);

      const summary: ResultSummary = {
        summary: result.summary || '',
        keyPoints: Array.isArray(result.keyPoints) ? result.keyPoints : [],
        themes: Array.isArray(result.themes) ? result.themes : [],
        confidence: typeof result.confidence === 'number' ? result.confidence : 0.5,
        provider: config.provider,
        model: config.model,
        processingTime: Date.now() - startTime
      };

      this.logger.debug('Result summarization complete', {
        provider: config.provider,
        processingTime: summary.processingTime
      });

      return summary;

    } catch (error: any) {
      this.logger.error('Result summarization failed', {
        error: error.message,
        resultCount: results.length,
        provider: config.provider
      });

      // If JSON parsing fails, try to extract data manually
      if (error instanceof SyntaxError) {
        throw new LLMParseError(
          'Failed to parse LLM JSON response',
          config.provider,
          { error: error.message }
        );
      }

      throw error;
    }
  }

  /**
   * Clear provider cache
   */
  clearCache(): void {
    this.providerCache.clear();
    this.logger.info('LLM provider cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      providers: this.providerCache.size,
      keys: Array.from(this.providerCache.keys())
    };
  }
}
