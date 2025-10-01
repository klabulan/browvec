/**
 * Custom Provider
 *
 * Generic LLM provider implementation for OpenAI-compatible endpoints.
 * Works with OpenRouter, Ollama, and other custom API endpoints.
 */

import { BaseLLMProvider } from './BaseLLMProvider.js';
import type { LLMRequestOptions, LLMResponse } from '../types.js';
import { LLMConfigError, LLMParseError } from '../errors.js';

export class CustomProvider extends BaseLLMProvider {
  /**
   * Validate custom provider configuration
   */
  protected validateConfig(): void {
    super.validateConfig();
    if (!this.config.endpoint) {
      throw new LLMConfigError('Endpoint is required for custom provider');
    }
  }

  /**
   * Build custom API endpoint URL
   */
  protected buildRequestURL(): string {
    return this.config.endpoint!;
  }

  /**
   * Build custom request headers
   */
  protected buildRequestHeaders(): Record<string, string> {
    const headers: Record<string, string> = { ...this.config.headers };

    // Add authorization header if API key provided
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }

    return headers;
  }

  /**
   * Build custom request body (OpenAI-compatible format)
   */
  protected buildRequestBody(prompt: string, options?: LLMRequestOptions): any {
    return {
      model: this.config.model,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful search assistant. Always respond with valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: options?.temperature ?? this.config.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? this.config.maxTokens ?? 500
    };
  }

  /**
   * Parse custom API response (try multiple formats)
   */
  protected parseResponse(data: any): LLMResponse {
    try {
      // Try OpenAI format first
      if (data.choices && Array.isArray(data.choices) && data.choices[0]) {
        const choice = data.choices[0];
        const text = choice.message?.content || choice.text || '';

        return {
          text,
          finishReason: choice.finish_reason === 'stop' ? 'stop' : 'length',
          usage: data.usage ? {
            promptTokens: data.usage.prompt_tokens || 0,
            completionTokens: data.usage.completion_tokens || 0,
            totalTokens: data.usage.total_tokens || 0
          } : undefined,
          model: data.model || this.config.model,
          provider: 'custom'
        };
      }

      // Try Anthropic-like format
      if (data.content && Array.isArray(data.content) && data.content[0]) {
        return {
          text: data.content[0].text || '',
          finishReason: 'stop',
          model: data.model || this.config.model,
          provider: 'custom'
        };
      }

      // Fallback: try to extract text from any response
      const text = data.text || data.content || data.response || JSON.stringify(data);

      return {
        text,
        finishReason: 'stop',
        model: this.config.model,
        provider: 'custom'
      };
    } catch (error: any) {
      throw new LLMParseError(
        `Failed to parse custom provider response: ${error.message}`,
        'custom',
        { data, error: error.message }
      );
    }
  }
}
