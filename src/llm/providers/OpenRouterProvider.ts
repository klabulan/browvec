/**
 * OpenRouter Provider
 *
 * LLM provider implementation for OpenRouter's unified API.
 * Provides access to 100+ models from OpenAI, Anthropic, Meta, Mistral, and more.
 * See: https://openrouter.ai/docs
 */

import { BaseLLMProvider } from './BaseLLMProvider.js';
import type { LLMRequestOptions, LLMResponse } from '../types.js';
import { LLMParseError } from '../errors.js';

export class OpenRouterProvider extends BaseLLMProvider {
  /**
   * Build OpenRouter API endpoint URL
   */
  protected buildRequestURL(): string {
    return this.config.endpoint || 'https://openrouter.ai/api/v1/chat/completions';
  }

  /**
   * Build OpenRouter request headers
   * Includes optional HTTP-Referer and X-Title for usage tracking
   */
  protected buildRequestHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.config.apiKey}`,
      ...this.config.headers
    };

    // OpenRouter recommends these headers for better analytics and ranking
    // https://openrouter.ai/docs#requests
    if (!headers['HTTP-Referer']) {
      headers['HTTP-Referer'] = typeof window !== 'undefined'
        ? window.location.origin
        : 'https://localretrieve.dev';
    }

    if (!headers['X-Title']) {
      headers['X-Title'] = 'LocalRetrieve';
    }

    return headers;
  }

  /**
   * Build OpenRouter request body (OpenAI-compatible format)
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
      max_tokens: options?.maxTokens ?? this.config.maxTokens ?? 500,
      // OpenRouter supports response_format for compatible models
      response_format: { type: 'json_object' }
    };
  }

  /**
   * Parse OpenRouter API response
   * OpenRouter uses OpenAI-compatible response format
   */
  protected parseResponse(data: any): LLMResponse {
    try {
      if (!data.choices || !data.choices[0]) {
        throw new Error('Invalid response structure: missing choices');
      }

      const choice = data.choices[0];
      const messageContent = choice.message?.content;

      if (!messageContent) {
        throw new Error('Invalid response structure: missing message content');
      }

      return {
        text: messageContent,
        finishReason: choice.finish_reason === 'stop' ? 'stop' : 'length',
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        } : undefined,
        model: data.model || this.config.model,
        provider: 'openrouter'
      };
    } catch (error: any) {
      throw new LLMParseError(
        `Failed to parse OpenRouter response: ${error.message}`,
        'openrouter',
        { data, error: error.message }
      );
    }
  }
}
