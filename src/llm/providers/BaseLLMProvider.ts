/**
 * Base LLM Provider
 *
 * Abstract base class for all LLM provider implementations.
 * Provides common functionality for HTTP requests, error handling, and retries.
 */

import type { Logger } from '../../database/worker/utils/Logger.js';
import type { LLMProviderConfig, LLMRequestOptions, LLMResponse } from '../types.js';
import { LLMError, LLMConfigError, LLMProviderError, LLMTimeoutError, LLMParseError } from '../errors.js';
import { buildEnhanceQueryPrompt, buildSummarizeResultsPrompt } from '../PromptTemplates.js';

export abstract class BaseLLMProvider {
  protected config: LLMProviderConfig;
  protected logger: Logger;

  constructor(config: LLMProviderConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.validateConfig();
  }

  /**
   * Abstract methods to be implemented by specific providers
   */
  protected abstract buildRequestURL(): string;
  protected abstract buildRequestHeaders(): Record<string, string>;
  protected abstract buildRequestBody(prompt: string, options?: LLMRequestOptions): any;
  protected abstract parseResponse(response: any): LLMResponse;

  /**
   * Validate provider configuration
   */
  protected validateConfig(): void {
    if (!this.config.provider) {
      throw new LLMConfigError('Provider is required');
    }
    if (!this.config.model) {
      throw new LLMConfigError('Model is required');
    }
    if (!this.config.apiKey && this.config.provider !== 'custom') {
      throw new LLMConfigError(`API key required for provider: ${this.config.provider}`);
    }
  }

  /**
   * Execute HTTP request to LLM API
   */
  protected async executeRequest(
    prompt: string,
    options?: LLMRequestOptions
  ): Promise<LLMResponse> {
    const url = this.buildRequestURL();
    const headers = this.buildRequestHeaders();
    const body = this.buildRequestBody(prompt, options);

    const timeout = options?.timeout || this.config.timeout || 10000;
    const controller = new AbortController();
    const signal = options?.signal || controller.signal;

    // Setup timeout
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      this.logger.debug(`LLM Request to ${this.config.provider}`, {
        provider: this.config.provider,
        model: this.config.model,
        promptLength: prompt.length
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify(body),
        signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new LLMProviderError(
          errorBody.error?.message || response.statusText,
          response.status,
          this.config.provider,
          errorBody
        );
      }

      const data = await response.json();
      const llmResponse = this.parseResponse(data);

      this.logger.debug(`LLM Response from ${this.config.provider}`, {
        provider: this.config.provider,
        model: this.config.model,
        finishReason: llmResponse.finishReason,
        textLength: llmResponse.text.length
      });

      return llmResponse;

    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new LLMTimeoutError(this.config.provider, timeout);
      }
      if (error instanceof LLMError) {
        throw error;
      }
      throw new LLMError(
        `LLM request failed: ${error.message}`,
        'NETWORK_ERROR',
        undefined,
        this.config.provider,
        error
      );
    }
  }

  /**
   * Execute request with retry logic
   */
  protected async executeRequestWithRetry(
    prompt: string,
    options?: LLMRequestOptions
  ): Promise<LLMResponse> {
    const maxRetries = this.config.maxRetries || 2;
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.executeRequest(prompt, options);
      } catch (error: any) {
        lastError = error;

        // Don't retry on config errors or timeouts
        if (error instanceof LLMConfigError || error instanceof LLMTimeoutError) {
          throw error;
        }

        // Don't retry on 4xx errors (client errors)
        if (error instanceof LLMProviderError && error.statusCode && error.statusCode < 500) {
          throw error;
        }

        // Wait before retry (exponential backoff)
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000;
          this.logger.warn(`LLM request failed, retrying in ${delay}ms`, {
            attempt: attempt + 1,
            maxRetries,
            error: error.message
          });
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }

  /**
   * Public API: Generic LLM call with arbitrary prompt (SCRUM-17)
   *
   * This method provides direct access to the LLM with any custom prompt.
   * Use this for custom use cases beyond query enhancement or summarization.
   *
   * @param prompt - The prompt to send to the LLM
   * @param options - Optional request configuration
   * @returns Raw LLM response with text and metadata
   */
  async call(prompt: string, options?: LLMRequestOptions): Promise<LLMResponse> {
    return await this.executeRequestWithRetry(prompt, options);
  }

  /**
   * Public API: Enhance query
   */
  async enhanceQuery(query: string, options?: LLMRequestOptions): Promise<LLMResponse> {
    const prompt = buildEnhanceQueryPrompt(query);
    return await this.executeRequestWithRetry(prompt, options);
  }

  /**
   * Public API: Summarize results
   */
  async summarizeResults(results: any[], options?: LLMRequestOptions): Promise<LLMResponse> {
    const prompt = buildSummarizeResultsPrompt(results);
    return await this.executeRequestWithRetry(prompt, options);
  }
}
