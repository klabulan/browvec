/**
 * Anthropic Provider
 *
 * LLM provider implementation for Anthropic's Claude models.
 * Supports Claude 3 Opus, Sonnet, and Haiku.
 */

import { BaseLLMProvider } from './BaseLLMProvider.js';
import type { LLMRequestOptions, LLMResponse } from '../types.js';
import { LLMParseError } from '../errors.js';

export class AnthropicProvider extends BaseLLMProvider {
  /**
   * Build Anthropic API endpoint URL
   */
  protected buildRequestURL(): string {
    return this.config.endpoint || 'https://api.anthropic.com/v1/messages';
  }

  /**
   * Build Anthropic request headers
   */
  protected buildRequestHeaders(): Record<string, string> {
    return {
      'x-api-key': this.config.apiKey!,
      'anthropic-version': '2023-06-01',
      ...this.config.headers
    };
  }

  /**
   * Build Anthropic request body
   */
  protected buildRequestBody(prompt: string, options?: LLMRequestOptions): any {
    return {
      model: this.config.model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: options?.temperature ?? this.config.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? this.config.maxTokens ?? 500,
      system: 'You are a helpful search assistant. Always respond with valid JSON.'
    };
  }

  /**
   * Parse Anthropic API response
   */
  protected parseResponse(data: any): LLMResponse {
    try {
      if (!data.content || !Array.isArray(data.content) || data.content.length === 0) {
        throw new Error('Invalid response structure: missing content array');
      }

      const content = data.content[0];
      if (!content.text) {
        throw new Error('Invalid response structure: missing text in content');
      }

      return {
        text: content.text,
        finishReason: data.stop_reason === 'end_turn' ? 'stop' : 'length',
        usage: data.usage ? {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens
        } : undefined,
        model: data.model,
        provider: 'anthropic'
      };
    } catch (error: any) {
      throw new LLMParseError(
        `Failed to parse Anthropic response: ${error.message}`,
        'anthropic',
        { data, error: error.message }
      );
    }
  }
}
