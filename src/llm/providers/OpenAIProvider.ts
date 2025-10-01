/**
 * OpenAI Provider
 *
 * LLM provider implementation for OpenAI's GPT models.
 * Supports GPT-4, GPT-4-turbo, and GPT-3.5-turbo.
 */

import { BaseLLMProvider } from './BaseLLMProvider.js';
import type { LLMRequestOptions, LLMResponse } from '../types.js';
import { LLMParseError } from '../errors.js';

export class OpenAIProvider extends BaseLLMProvider {
  /**
   * Build OpenAI API endpoint URL
   */
  protected buildRequestURL(): string {
    return this.config.endpoint || 'https://api.openai.com/v1/chat/completions';
  }

  /**
   * Build OpenAI request headers
   */
  protected buildRequestHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.config.apiKey}`,
      ...this.config.headers
    };
  }

  /**
   * Build OpenAI request body
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
      response_format: { type: 'json_object' }
    };
  }

  /**
   * Parse OpenAI API response
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
        model: data.model,
        provider: 'openai'
      };
    } catch (error: any) {
      throw new LLMParseError(
        `Failed to parse OpenAI response: ${error.message}`,
        'openai',
        { data, error: error.message }
      );
    }
  }
}
