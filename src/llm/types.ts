/**
 * LLM Types
 *
 * Type definitions for LLM integration functionality.
 */

/**
 * Supported LLM providers
 */
export type LLMProvider = 'openai' | 'anthropic' | 'openrouter' | 'custom';

/**
 * LLM Provider Configuration
 */
export interface LLMProviderConfig {
  provider: LLMProvider;
  model: string;
  apiKey?: string;          // Runtime-provided, not stored
  endpoint?: string;        // For custom providers
  temperature?: number;     // 0-1, default 0.7
  maxTokens?: number;       // Default 500
  timeout?: number;         // Default 10000ms
  maxRetries?: number;      // Default 2
  headers?: Record<string, string>;
}

/**
 * Request Options for LLM operations
 */
export interface LLMRequestOptions {
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  signal?: AbortSignal;
  context?: Record<string, any>;
}

/**
 * Enhanced Query Result
 */
export interface EnhancedQuery {
  originalQuery: string;
  enhancedQuery: string;
  suggestions: string[];
  intent?: string;
  confidence: number;
  provider: string;
  model: string;
  processingTime: number;
}

/**
 * Result Summary
 */
export interface ResultSummary {
  summary: string;
  keyPoints: string[];
  themes: string[];
  confidence: number;
  provider: string;
  model: string;
  processingTime: number;
}

/**
 * LLM Response (internal)
 */
export interface LLMResponse {
  text: string;
  finishReason: 'stop' | 'length' | 'error' | 'timeout';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
  provider: string;
}

/**
 * Combined Search with LLM Result
 */
export interface LLMSearchResponse {
  results: any[];  // Will be typed as SearchResult[] when integrated
  enhancedQuery?: EnhancedQuery;
  summary?: ResultSummary;
  searchTime: number;
  llmTime: number;
  totalTime: number;
}
