# SCRUM-17 LLM Integration - Technical Specification

## 1. Architecture Overview

### 1.1 Module Structure

```
src/llm/                               # Public LLM module
├── providers/
│   ├── BaseLLMProvider.ts            # Abstract base class
│   ├── OpenAIProvider.ts             # OpenAI GPT-4/3.5
│   ├── AnthropicProvider.ts          # Claude models
│   ├── OpenRouterProvider.ts         # OpenRouter aggregator
│   └── CustomProvider.ts             # Generic HTTP endpoint
├── PromptTemplates.ts                # Query/summary prompt templates
├── LLMConfig.ts                      # Configuration types and validation
├── types.ts                          # LLM-specific TypeScript types
├── errors.ts                         # LLM error classes
└── index.ts                          # Public exports

src/database/worker/llm/               # Worker-side LLM logic
├── LLMManager.ts                     # Manages LLM providers in worker
└── LLMHandler.ts                     # Optional: Dedicated RPC handlers

src/types/worker.ts                    # Extended with LLM RPC types
```

### 1.2 Integration Points

```
┌─────────────────────────────────────────────┐
│         User Application                    │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│      Database Class (Main Thread)           │
│  + enhanceQuery()                           │
│  + summarizeResults()                       │
│  + searchWithLLM()                          │
└────────────────┬────────────────────────────┘
                 │ RPC (WorkerRPC)
┌────────────────▼────────────────────────────┐
│      DatabaseWorker (Worker Thread)         │
│  + handleEnhanceQuery()                     │
│  + handleSummarizeResults()                 │
│  + handleSearchWithLLM()                    │
│  ├─ LLMManager                              │
│  │  ├─ OpenAIProvider                       │
│  │  ├─ AnthropicProvider                    │
│  │  └─ CustomProvider                       │
└─────────────────────────────────────────────┘
```

---

## 2. Type Definitions

### 2.1 Core Types (`src/llm/types.ts`)

```typescript
/**
 * LLM Provider Types
 */
export type LLMProvider = 'openai' | 'anthropic' | 'openrouter' | 'custom';

/**
 * Provider Configuration
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
 * Request Options
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
  results: SearchResult[];
  enhancedQuery?: EnhancedQuery;
  summary?: ResultSummary;
  searchTime: number;
  llmTime: number;
  totalTime: number;
}
```

### 2.2 Error Types (`src/llm/errors.ts`)

```typescript
export class LLMError extends Error {
  constructor(
    message: string,
    public readonly code: LLMErrorCode,
    public readonly statusCode?: number,
    public readonly provider?: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

export type LLMErrorCode =
  | 'INVALID_CONFIG'
  | 'INVALID_API_KEY'
  | 'PROVIDER_ERROR'
  | 'TIMEOUT'
  | 'RATE_LIMIT'
  | 'NETWORK_ERROR'
  | 'PARSE_ERROR'
  | 'UNKNOWN_ERROR';

export class LLMConfigError extends LLMError {
  constructor(message: string, details?: any) {
    super(message, 'INVALID_CONFIG', undefined, undefined, details);
    this.name = 'LLMConfigError';
  }
}

export class LLMProviderError extends LLMError {
  constructor(message: string, statusCode: number, provider: string, details?: any) {
    super(message, 'PROVIDER_ERROR', statusCode, provider, details);
    this.name = 'LLMProviderError';
  }
}

export class LLMTimeoutError extends LLMError {
  constructor(provider: string, timeout: number) {
    super(`LLM request timeout after ${timeout}ms`, 'TIMEOUT', undefined, provider);
    this.name = 'LLMTimeoutError';
  }
}
```

### 2.3 Worker RPC Types (add to `src/types/worker.ts`)

```typescript
/**
 * Enhance Query Parameters
 */
export interface EnhanceQueryParams {
  query: string;
  options?: {
    provider?: string;
    model?: string;
    apiKey?: string;
    maxSuggestions?: number;
    includeIntent?: boolean;
    temperature?: number;
    timeout?: number;
  };
}

/**
 * Summarize Results Parameters
 */
export interface SummarizeResultsParams {
  results: SearchResult[];
  options?: {
    provider?: string;
    model?: string;
    apiKey?: string;
    maxLength?: number;
    includeKeyPoints?: boolean;
    temperature?: number;
    timeout?: number;
  };
}

/**
 * Search with LLM Parameters
 */
export interface SearchWithLLMParams {
  query: string;
  options?: {
    enhanceQuery?: boolean;
    summarizeResults?: boolean;
    searchOptions?: TextSearchOptions;
    llmOptions?: {
      provider?: string;
      model?: string;
      apiKey?: string;
      temperature?: number;
    };
  };
}

// Extend WorkerMethodName union
export type WorkerMethodName =
  | 'open' | 'close' | 'exec' | 'select'
  // ... existing methods ...
  | 'enhanceQuery'           // NEW
  | 'summarizeResults'       // NEW
  | 'searchWithLLM';         // NEW
```

---

## 3. Provider Implementation

### 3.1 Base Provider (`src/llm/providers/BaseLLMProvider.ts`)

```typescript
import { Logger } from '../../database/worker/utils/Logger.js';
import { LLMProviderConfig, LLMRequestOptions, LLMResponse } from '../types.js';
import { LLMError, LLMConfigError, LLMTimeoutError } from '../errors.js';

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
   * Common request execution logic
   */
  protected async executeRequest(
    prompt: string,
    options?: LLMRequestOptions
  ): Promise<LLMResponse> {
    const url = this.buildRequestURL();
    const headers = this.buildRequestHeaders();
    const body = this.buildRequestBody(prompt, options);

    const timeout = options?.timeout || this.config.timeout || 10000;
    const signal = options?.signal || AbortSignal.timeout(timeout);

    try {
      this.logger.debug(`LLM Request to ${this.config.provider}`, { prompt: prompt.substring(0, 100) });

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify(body),
        signal
      });

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
      return this.parseResponse(data);

    } catch (error) {
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
   * Public API: Enhance query
   */
  async enhanceQuery(query: string, options?: LLMRequestOptions): Promise<LLMResponse> {
    const prompt = this.buildEnhanceQueryPrompt(query);
    return await this.executeRequest(prompt, options);
  }

  /**
   * Public API: Summarize results
   */
  async summarizeResults(results: any[], options?: LLMRequestOptions): Promise<LLMResponse> {
    const prompt = this.buildSummarizeResultsPrompt(results);
    return await this.executeRequest(prompt, options);
  }

  /**
   * Build prompt for query enhancement
   */
  protected buildEnhanceQueryPrompt(query: string): string {
    return `You are a search query expert. Analyze and enhance this search query.

Original query: "${query}"

Provide:
1. Enhanced query (expanded with relevant terms)
2. 3 alternative query suggestions
3. User's likely search intent
4. Confidence score (0-1)

Format response as JSON:
{
  "enhancedQuery": "...",
  "suggestions": ["...", "...", "..."],
  "intent": "...",
  "confidence": 0.85
}`;
  }

  /**
   * Build prompt for result summarization
   */
  protected buildSummarizeResultsPrompt(results: any[]): string {
    const resultsText = results
      .map((r, i) => `${i + 1}. ${r.title}: ${r.content?.substring(0, 200)}...`)
      .join('\n\n');

    return `You are a search result summarizer. Analyze these search results and provide a concise summary.

Search Results:
${resultsText}

Provide:
1. Executive summary (2-3 sentences)
2. Key points (3-5 bullet points)
3. Main themes
4. Confidence score (0-1)

Format response as JSON:
{
  "summary": "...",
  "keyPoints": ["...", "...", "..."],
  "themes": ["...", "..."],
  "confidence": 0.9
}`;
  }
}
```

### 3.2 OpenAI Provider (`src/llm/providers/OpenAIProvider.ts`)

```typescript
import { BaseLLMProvider } from './BaseLLMProvider.js';
import { LLMRequestOptions, LLMResponse } from '../types.js';

export class OpenAIProvider extends BaseLLMProvider {
  protected buildRequestURL(): string {
    return this.config.endpoint || 'https://api.openai.com/v1/chat/completions';
  }

  protected buildRequestHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.config.apiKey}`,
      ...this.config.headers
    };
  }

  protected buildRequestBody(prompt: string, options?: LLMRequestOptions): any {
    return {
      model: this.config.model,
      messages: [
        { role: 'system', content: 'You are a helpful search assistant.' },
        { role: 'user', content: prompt }
      ],
      temperature: options?.temperature ?? this.config.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? this.config.maxTokens ?? 500,
      response_format: { type: 'json_object' }
    };
  }

  protected parseResponse(data: any): LLMResponse {
    const choice = data.choices[0];
    return {
      text: choice.message.content,
      finishReason: choice.finish_reason === 'stop' ? 'stop' : 'length',
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens
      },
      model: data.model,
      provider: 'openai'
    };
  }
}
```

### 3.3 Anthropic Provider (`src/llm/providers/AnthropicProvider.ts`)

```typescript
import { BaseLLMProvider } from './BaseLLMProvider.js';
import { LLMRequestOptions, LLMResponse } from '../types.js';

export class AnthropicProvider extends BaseLLMProvider {
  protected buildRequestURL(): string {
    return this.config.endpoint || 'https://api.anthropic.com/v1/messages';
  }

  protected buildRequestHeaders(): Record<string, string> {
    return {
      'x-api-key': this.config.apiKey!,
      'anthropic-version': '2023-06-01',
      ...this.config.headers
    };
  }

  protected buildRequestBody(prompt: string, options?: LLMRequestOptions): any {
    return {
      model: this.config.model,
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature: options?.temperature ?? this.config.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? this.config.maxTokens ?? 500,
      system: 'You are a helpful search assistant. Always respond with valid JSON.'
    };
  }

  protected parseResponse(data: any): LLMResponse {
    const content = data.content[0];
    return {
      text: content.text,
      finishReason: data.stop_reason === 'end_turn' ? 'stop' : 'length',
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens
      },
      model: data.model,
      provider: 'anthropic'
    };
  }
}
```

### 3.4 Custom Provider (`src/llm/providers/CustomProvider.ts`)

```typescript
import { BaseLLMProvider } from './BaseLLMProvider.js';
import { LLMRequestOptions, LLMResponse } from '../types.js';
import { LLMConfigError } from '../errors.js';

export class CustomProvider extends BaseLLMProvider {
  protected validateConfig(): void {
    super.validateConfig();
    if (!this.config.endpoint) {
      throw new LLMConfigError('Endpoint is required for custom provider');
    }
  }

  protected buildRequestURL(): string {
    return this.config.endpoint!;
  }

  protected buildRequestHeaders(): Record<string, string> {
    const headers: Record<string, string> = { ...this.config.headers };
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    return headers;
  }

  protected buildRequestBody(prompt: string, options?: LLMRequestOptions): any {
    // Generic OpenAI-compatible format
    return {
      model: this.config.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: options?.temperature ?? this.config.temperature ?? 0.7,
      max_tokens: options?.maxTokens ?? this.config.maxTokens ?? 500
    };
  }

  protected parseResponse(data: any): LLMResponse {
    // Try OpenAI format first
    if (data.choices && data.choices[0]) {
      const choice = data.choices[0];
      return {
        text: choice.message?.content || choice.text || '',
        finishReason: 'stop',
        model: this.config.model,
        provider: 'custom'
      };
    }

    // Fallback to simple format
    return {
      text: data.text || data.content || JSON.stringify(data),
      finishReason: 'stop',
      model: this.config.model,
      provider: 'custom'
    };
  }
}
```

---

## 4. Worker Integration

### 4.1 LLM Manager (`src/database/worker/llm/LLMManager.ts`)

```typescript
import { Logger } from '../utils/Logger.js';
import { BaseLLMProvider } from '../../../llm/providers/BaseLLMProvider.js';
import { OpenAIProvider } from '../../../llm/providers/OpenAIProvider.js';
import { AnthropicProvider } from '../../../llm/providers/AnthropicProvider.js';
import { CustomProvider } from '../../../llm/providers/CustomProvider.js';
import { LLMProviderConfig, EnhancedQuery, ResultSummary } from '../../../llm/types.js';
import { LLMError } from '../../../llm/errors.js';

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
    const cacheKey = `${config.provider}:${config.model}:${config.apiKey?.substring(0, 8)}`;

    let provider = this.providerCache.get(cacheKey);
    if (!provider) {
      provider = this.createProvider(config);
      this.providerCache.set(cacheKey, provider);
      this.logger.info(`Created LLM provider: ${config.provider}/${config.model}`);
    }

    return provider;
  }

  /**
   * Create provider instance
   */
  private createProvider(config: LLMProviderConfig): BaseLLMProvider {
    switch (config.provider) {
      case 'openai':
        return new OpenAIProvider(config, this.logger);
      case 'anthropic':
        return new AnthropicProvider(config, this.logger);
      case 'openrouter':
      case 'custom':
        return new CustomProvider(config, this.logger);
      default:
        throw new LLMError(`Unknown provider: ${config.provider}`, 'INVALID_CONFIG');
    }
  }

  /**
   * Enhance query
   */
  async enhanceQuery(
    query: string,
    config: LLMProviderConfig,
    options?: any
  ): Promise<EnhancedQuery> {
    const startTime = Date.now();
    const provider = this.getProvider(config);

    try {
      const response = await provider.enhanceQuery(query, options);
      const result = JSON.parse(response.text);

      return {
        originalQuery: query,
        enhancedQuery: result.enhancedQuery || query,
        suggestions: result.suggestions || [],
        intent: result.intent,
        confidence: result.confidence || 0.5,
        provider: config.provider,
        model: config.model,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      this.logger.error('Query enhancement failed', { error, query });
      throw error;
    }
  }

  /**
   * Summarize results
   */
  async summarizeResults(
    results: any[],
    config: LLMProviderConfig,
    options?: any
  ): Promise<ResultSummary> {
    const startTime = Date.now();
    const provider = this.getProvider(config);

    try {
      const response = await provider.summarizeResults(results, options);
      const result = JSON.parse(response.text);

      return {
        summary: result.summary || '',
        keyPoints: result.keyPoints || [],
        themes: result.themes || [],
        confidence: result.confidence || 0.5,
        provider: config.provider,
        model: config.model,
        processingTime: Date.now() - startTime
      };
    } catch (error) {
      this.logger.error('Result summarization failed', { error });
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
```

### 4.2 DatabaseWorker Integration (`src/database/worker/core/DatabaseWorker.ts`)

Add to DatabaseWorker class:

```typescript
import { LLMManager } from '../llm/LLMManager.js';

export class DatabaseWorker {
  // ... existing properties ...
  private llmManager: LLMManager;

  constructor() {
    // ... existing initialization ...
    this.llmManager = new LLMManager(this.logger);
  }

  private setupRPCHandlers(): void {
    // ... existing handlers ...

    // LLM handlers
    this.rpcHandler.register('enhanceQuery', this.handleEnhanceQuery.bind(this));
    this.rpcHandler.register('summarizeResults', this.handleSummarizeResults.bind(this));
    this.rpcHandler.register('searchWithLLM', this.handleSearchWithLLM.bind(this));
  }

  private async handleEnhanceQuery(params: EnhanceQueryParams): Promise<EnhancedQuery> {
    this.ensureInitialized();
    return this.withContext('enhanceQuery', async () => {
      const config: LLMProviderConfig = {
        provider: params.options?.provider || 'openai',
        model: params.options?.model || 'gpt-4',
        apiKey: params.options?.apiKey,
        temperature: params.options?.temperature,
        timeout: params.options?.timeout
      };

      return await this.llmManager.enhanceQuery(params.query, config, params.options);
    });
  }

  private async handleSummarizeResults(params: SummarizeResultsParams): Promise<ResultSummary> {
    this.ensureInitialized();
    return this.withContext('summarizeResults', async () => {
      const config: LLMProviderConfig = {
        provider: params.options?.provider || 'openai',
        model: params.options?.model || 'gpt-4',
        apiKey: params.options?.apiKey,
        temperature: params.options?.temperature,
        timeout: params.options?.timeout
      };

      return await this.llmManager.summarizeResults(params.results, config, params.options);
    });
  }

  private async handleSearchWithLLM(params: SearchWithLLMParams): Promise<LLMSearchResponse> {
    this.ensureInitialized();
    return this.withContext('searchWithLLM', async () => {
      const startTime = Date.now();
      let enhancedQuery: EnhancedQuery | undefined;
      let llmTime = 0;

      // Step 1: Enhance query if requested
      if (params.options?.enhanceQuery) {
        const enhanceStart = Date.now();
        const config: LLMProviderConfig = {
          provider: params.options.llmOptions?.provider || 'openai',
          model: params.options.llmOptions?.model || 'gpt-4',
          apiKey: params.options.llmOptions?.apiKey,
          temperature: params.options.llmOptions?.temperature
        };
        enhancedQuery = await this.llmManager.enhanceQuery(params.query, config);
        llmTime += Date.now() - enhanceStart;
      }

      // Step 2: Execute search with enhanced query
      const searchQuery = enhancedQuery?.enhancedQuery || params.query;
      const searchStart = Date.now();
      const searchResponse = await this.handleSearchText({
        query: searchQuery,
        options: params.options?.searchOptions
      });
      const searchTime = Date.now() - searchStart;

      // Step 3: Summarize results if requested
      let summary: ResultSummary | undefined;
      if (params.options?.summarizeResults && searchResponse.results.length > 0) {
        const summaryStart = Date.now();
        const config: LLMProviderConfig = {
          provider: params.options.llmOptions?.provider || 'openai',
          model: params.options.llmOptions?.model || 'gpt-4',
          apiKey: params.options.llmOptions?.apiKey,
          temperature: params.options.llmOptions?.temperature
        };
        summary = await this.llmManager.summarizeResults(searchResponse.results, config);
        llmTime += Date.now() - summaryStart;
      }

      return {
        results: searchResponse.results,
        enhancedQuery,
        summary,
        searchTime,
        llmTime,
        totalTime: Date.now() - startTime
      };
    });
  }
}
```

---

## 5. Public API

### 5.1 Database Class Methods (`src/database/Database.ts`)

Add to Database class:

```typescript
/**
 * Enhance search query using LLM (Task SCRUM-17)
 */
async enhanceQuery(
  query: string,
  options?: {
    provider?: 'openai' | 'anthropic' | 'openrouter' | 'custom';
    model?: string;
    apiKey?: string;
    maxSuggestions?: number;
    includeIntent?: boolean;
    temperature?: number;
    timeout?: number;
  }
): Promise<EnhancedQuery> {
  if (!this.state.isOpen) {
    throw new DatabaseError('Database is not open');
  }

  if (!this.workerRPC) {
    throw new DatabaseError('Worker not available');
  }

  try {
    return await this.workerRPC.enhanceQuery({ query, options });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new DatabaseError(`Query enhancement failed: ${message}`);
  }
}

/**
 * Summarize search results using LLM (Task SCRUM-17)
 */
async summarizeResults(
  results: SearchResult[],
  options?: {
    provider?: 'openai' | 'anthropic' | 'openrouter' | 'custom';
    model?: string;
    apiKey?: string;
    maxLength?: number;
    includeKeyPoints?: boolean;
    temperature?: number;
    timeout?: number;
  }
): Promise<ResultSummary> {
  if (!this.state.isOpen) {
    throw new DatabaseError('Database is not open');
  }

  if (!this.workerRPC) {
    throw new DatabaseError('Worker not available');
  }

  try {
    return await this.workerRPC.summarizeResults({ results, options });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new DatabaseError(`Result summarization failed: ${message}`);
  }
}

/**
 * Combined search with LLM enhancements (Task SCRUM-17)
 */
async searchWithLLM(
  query: string,
  options?: {
    enhanceQuery?: boolean;
    summarizeResults?: boolean;
    searchOptions?: TextSearchOptions;
    llmOptions?: {
      provider?: string;
      model?: string;
      apiKey?: string;
      temperature?: number;
    };
  }
): Promise<LLMSearchResponse> {
  if (!this.state.isOpen) {
    throw new DatabaseError('Database is not open');
  }

  if (!this.workerRPC) {
    throw new DatabaseError('Worker not available');
  }

  try {
    return await this.workerRPC.searchWithLLM({ query, options });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new DatabaseError(`LLM search failed: ${message}`);
  }
}
```

### 5.2 WorkerRPC Methods (`src/utils/rpc.ts`)

Add to WorkerRPC class:

```typescript
async enhanceQuery(params: Parameters<DBWorkerAPI['enhanceQuery']>[0]) {
  return this.call('enhanceQuery', params);
}

async summarizeResults(params: Parameters<DBWorkerAPI['summarizeResults']>[0]) {
  return this.call('summarizeResults', params);
}

async searchWithLLM(params: Parameters<DBWorkerAPI['searchWithLLM']>[0]) {
  return this.call('searchWithLLM', params);
}
```

---

## 6. Configuration Management

### 6.1 Default Configuration

```typescript
// src/llm/LLMConfig.ts
export const DEFAULT_LLM_CONFIG = {
  timeout: 10000,
  maxRetries: 2,
  temperature: 0.7,
  maxTokens: 500
};

export const LLM_MODELS = {
  openai: ['gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo'],
  anthropic: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
  openrouter: ['auto'] // Dynamic
};
```

### 6.2 Environment Variable Support

Not applicable for browser environment - API keys must be provided by user at runtime.

---

## 7. Error Handling Strategy

### 7.1 Error Hierarchy
```
LLMError (base)
├── LLMConfigError (configuration issues)
├── LLMProviderError (API errors)
├── LLMTimeoutError (timeout)
└── LLMParseError (response parsing)
```

### 7.2 Retry Logic

```typescript
// In BaseLLMProvider
protected async executeRequestWithRetry(
  prompt: string,
  options?: LLMRequestOptions
): Promise<LLMResponse> {
  const maxRetries = this.config.maxRetries || 2;
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await this.executeRequest(prompt, options);
    } catch (error) {
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
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  throw lastError!;
}
```

---

## 8. Testing Strategy

### 8.1 Unit Tests

- Provider tests (mock fetch)
- LLMManager tests
- Error handling tests
- Configuration validation tests

### 8.2 Integration Tests

- RPC communication tests
- Worker integration tests
- End-to-end flow tests

### 8.3 E2E Tests (Playwright)

- Query enhancement in demo
- Result summarization in demo
- Error handling UI
- Provider switching

---

## 9. Performance Considerations

### 9.1 Timeout Management
- Default timeout: 10s for query enhancement
- Default timeout: 30s for result summarization
- Configurable per request

### 9.2 Caching
- Provider instance caching
- Optional response caching (future enhancement)

### 9.3 Performance Monitoring
- Track LLM operation times
- Integrate with existing performance metrics

---

## 10. Security Considerations

### 10.1 API Key Handling
- ❌ Never store API keys in code or database
- ✅ Accept API keys as runtime parameters only
- ✅ Don't log API keys
- ✅ Mask keys in error messages

### 10.2 CORS
- LLM providers must support CORS
- Document CORS requirements
- Suggest proxy solution for providers without CORS

---

## 11. Documentation Requirements

### 11.1 API Documentation
- JSDoc comments for all public methods
- TypeScript types exported
- Usage examples in README

### 11.2 Demo Application
- Query enhancement demo
- Result summarization demo
- Provider configuration UI
- API key input (not persisted)

---

## 12. Implementation Checklist

- [ ] Create `/src/llm/` module structure
- [ ] Implement `BaseLLMProvider` abstract class
- [ ] Implement `OpenAIProvider`
- [ ] Implement `AnthropicProvider`
- [ ] Implement `CustomProvider`
- [ ] Create `LLMManager` in worker
- [ ] Integrate with `DatabaseWorker`
- [ ] Add RPC methods to `WorkerRPC`
- [ ] Add public methods to `Database` class
- [ ] Create error classes
- [ ] Add TypeScript types
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Create E2E tests
- [ ] Update demo application
- [ ] Write API documentation
- [ ] Update README with examples

---

**Status**: Specification Complete
**Next**: Create work breakdown
