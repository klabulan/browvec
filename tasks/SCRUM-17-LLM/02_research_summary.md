# LLM Integration Research Summary

## Top 3 JavaScript/TypeScript Solutions for Browser-Based LLM Integration

### Solution 1: Vercel AI SDK ⭐ RECOMMENDED

**Overview**:
- **GitHub**: https://github.com/vercel/ai
- **Downloads**: 2M+ weekly (most popular)
- **Status**: Actively maintained, v5.0 released 2025
- **TypeScript**: Full type safety across entire stack
- **Browser Support**: ✅ Direct browser integration, client-only mode

**Key Patterns**:

#### 1. Provider Abstraction Pattern
```typescript
// Provider interface with unified API
import { createOpenAI, createAnthropic } from '@ai-sdk/openai';

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Unified generateText API
const result = await generateText({
  model: openai('gpt-4'),
  prompt: 'Enhance this query: search for documents'
});
```

#### 2. Request/Response Handling
```typescript
// Non-streaming (buffered response)
const { text } = await generateText({
  model: openai('gpt-4'),
  prompt: query,
  maxTokens: 500,
  temperature: 0.7
});

// Streaming support (not needed for our use case)
const { textStream } = await streamText({
  model: openai('gpt-4'),
  prompt: query
});
```

#### 3. Error Handling Strategy
```typescript
try {
  const result = await generateText({
    model: openai('gpt-4'),
    prompt: query,
    maxRetries: 2,
    abortSignal: AbortSignal.timeout(10000)
  });
} catch (error) {
  if (error instanceof APIError) {
    // Handle API-specific errors
    console.error(`API Error: ${error.statusCode} - ${error.message}`);
  }
}
```

#### 4. TypeScript Interface Design
```typescript
// Fully typed parameters and responses
interface GenerateTextParams {
  model: LanguageModel;
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  maxRetries?: number;
  abortSignal?: AbortSignal;
}

interface GenerateTextResult {
  text: string;
  finishReason: 'stop' | 'length' | 'error';
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
```

#### 5. Configuration Pattern
```typescript
// Provider configuration
const provider = createOpenAI({
  apiKey: 'sk-...',
  baseURL: 'https://api.openai.com/v1', // customizable
  headers: {
    'Custom-Header': 'value'
  }
});

// Per-request configuration
const result = await generateText({
  model: provider('gpt-4'),
  prompt: query,
  temperature: 0.7,
  maxTokens: 500
});
```

**Pros for LocalRetrieve**:
- ✅ Lightweight core (no framework dependencies)
- ✅ Excellent TypeScript support
- ✅ Clean provider abstraction
- ✅ Browser-compatible (uses fetch)
- ✅ Timeout and retry built-in
- ✅ Well-documented with examples

**Cons**:
- ⚠️ Designed for React/Next.js (but core is framework-agnostic)
- ⚠️ Streaming features we don't need

**Adaptability**: 🔥 HIGH - Core patterns directly applicable

---

### Solution 2: LangChain.js

**Overview**:
- **GitHub**: https://github.com/langchain-ai/langchainjs
- **Status**: Mature framework, v1.0 coming October 2025
- **TypeScript**: Full TypeScript support
- **Browser Support**: ✅ Via WebLLM integration

**Key Patterns**:

#### 1. Provider Abstraction Pattern
```typescript
// Model classes with unified interface
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";

const llm = new ChatOpenAI({
  modelName: "gpt-4",
  temperature: 0.7,
  openAIApiKey: "sk-..."
});

// Unified invoke API
const response = await llm.invoke("Enhance this query: search documents");
```

#### 2. Chain Pattern (for our use case)
```typescript
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

// Query Enhancement Chain
const enhanceChain = ChatPromptTemplate
  .fromTemplate("Expand and clarify this search query: {query}")
  .pipe(llm)
  .pipe(new StringOutputParser());

const enhanced = await enhanceChain.invoke({ query: userQuery });

// Summarization Chain
const summarizeChain = ChatPromptTemplate
  .fromTemplate("Summarize these search results: {results}")
  .pipe(llm)
  .pipe(new StringOutputParser());

const summary = await summarizeChain.invoke({ results: JSON.stringify(results) });
```

#### 3. Error Handling Strategy
```typescript
// Retry mechanism
const llm = new ChatOpenAI({
  modelName: "gpt-4",
  maxRetries: 2,
  timeout: 10000
});

try {
  const response = await llm.invoke(query);
} catch (error) {
  // Fallback to alternative provider
  const fallbackLLM = new ChatAnthropic({ modelName: "claude-3" });
  const response = await fallbackLLM.invoke(query);
}
```

#### 4. Browser-Specific Pattern (WebLLM)
```typescript
// For browser environments
import { ChatWebLLM } from "@langchain/community/chat_models/webllm";

const llm = new ChatWebLLM({
  model: "Llama-3.1-8B-Instruct-q4f32_1-MLC",
  chatOptions: { temperature: 0.5 }
});

// Note: Downloads full model weights on first use
const response = await llm.invoke("query");
```

**Pros for LocalRetrieve**:
- ✅ Comprehensive framework
- ✅ Chain pattern for workflows
- ✅ Multiple provider support
- ✅ Strong TypeScript support

**Cons**:
- ❌ Heavy framework (many dependencies)
- ❌ Designed for Node.js primarily
- ❌ WebLLM downloads GB of model weights (not suitable)
- ❌ Overkill for simple LLM API calls

**Adaptability**: 🟡 MEDIUM - Chain pattern useful, but framework too heavy

---

### Solution 3: LLM.js by TheMaximalist

**Overview**:
- **GitHub**: https://github.com/themaximalist/llm.js
- **Status**: Active, browser support added 2024
- **TypeScript**: TypeScript support
- **Browser Support**: ✅ Explicit browser mode

**Key Patterns**:

#### 1. Universal Interface Pattern
```typescript
import LLM from "llm.js";

// Simple unified API
const response = await LLM("Enhance this query", {
  provider: "openai",
  model: "gpt-4",
  apiKey: "sk-..."
});

// Alternative providers with same API
const response2 = await LLM("Summarize results", {
  provider: "anthropic",
  model: "claude-3",
  apiKey: "sk-ant-..."
});
```

#### 2. Provider Auto-Detection (Node.js only)
```typescript
// In Node.js, auto-detects env vars
// OPENAI_API_KEY, ANTHROPIC_API_KEY, etc.
const response = await LLM("query"); // Uses default provider

// In browser, explicit configuration required
const response = await LLM("query", {
  provider: "openai",
  apiKey: userProvidedKey
});
```

#### 3. Simple Configuration
```typescript
// Minimal configuration
const llm = new LLM({
  provider: "openai",
  model: "gpt-4",
  apiKey: "sk-...",
  temperature: 0.7,
  maxTokens: 500
});

const text = await llm.chat("Enhance this query: search documents");
```

#### 4. Multiple Provider Support
```typescript
// OpenAI
await LLM(prompt, { provider: "openai", model: "gpt-4" });

// Anthropic
await LLM(prompt, { provider: "anthropic", model: "claude-3" });

// Google
await LLM(prompt, { provider: "google", model: "gemini-pro" });

// xAI
await LLM(prompt, { provider: "xai", model: "grok-beta" });

// DeepSeek
await LLM(prompt, { provider: "deepseek", model: "deepseek-chat" });

// Local (Ollama)
await LLM(prompt, { provider: "ollama", model: "llama2" });
```

**Pros for LocalRetrieve**:
- ✅ Lightweight and simple
- ✅ Browser support
- ✅ Multiple providers with unified API
- ✅ Minimal dependencies

**Cons**:
- ⚠️ Less documentation than Vercel AI SDK
- ⚠️ Smaller community
- ⚠️ Less TypeScript sophistication

**Adaptability**: 🟢 GOOD - Simple patterns, easy to adapt

---

## Pattern Comparison

| Pattern | Vercel AI SDK | LangChain.js | LLM.js |
|---------|---------------|--------------|--------|
| **Provider Abstraction** | Factory functions | Class-based | Universal function |
| **TypeScript Quality** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Browser Support** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Error Handling** | Built-in retries, timeouts | Retry mechanism | Basic |
| **Configuration** | Flexible, per-request | Constructor-based | Simple options |
| **Complexity** | Low-Medium | High | Low |
| **Adaptability** | Very High | Medium | High |

---

## Key Patterns to Adopt for LocalRetrieve

### 1. Provider Factory Pattern (from Vercel AI SDK)
```typescript
// src/llm/providers/ProviderFactory.ts
export function createLLMProvider(config: LLMProviderConfig): BaseLLMProvider {
  switch (config.provider) {
    case 'openai':
      return new OpenAIProvider(config);
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'openrouter':
      return new OpenRouterProvider(config);
    case 'custom':
      return new CustomProvider(config);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}
```

### 2. Unified Request Interface (from all 3)
```typescript
interface LLMRequest {
  prompt: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
  maxRetries?: number;
  signal?: AbortSignal;
}

interface LLMResponse {
  text: string;
  finishReason: 'stop' | 'length' | 'error' | 'timeout';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  provider: string;
  model: string;
  cached?: boolean;
}
```

### 3. Abstract Base Provider (adapted pattern)
```typescript
// src/llm/providers/BaseLLMProvider.ts
export abstract class BaseLLMProvider {
  protected config: LLMProviderConfig;
  protected logger: Logger;

  constructor(config: LLMProviderConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
    this.validateConfig();
  }

  abstract enhance(query: string, options?: LLMRequestOptions): Promise<EnhancedQuery>;
  abstract summarize(results: SearchResult[], options?: LLMRequestOptions): Promise<Summary>;

  protected abstract validateConfig(): void;
  protected abstract buildRequest(prompt: string, options?: LLMRequestOptions): RequestInit;

  protected async callAPI(request: RequestInit, signal?: AbortSignal): Promise<any> {
    // Common fetch logic with timeout and retry
  }
}
```

### 4. Error Handling Pattern (from Vercel AI SDK)
```typescript
export class LLMError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
    public readonly provider?: string
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

// Usage in provider
try {
  const response = await fetch(url, { signal, ...requestInit });
  if (!response.ok) {
    throw new LLMError(
      `API request failed: ${response.statusText}`,
      'API_ERROR',
      response.status,
      this.config.provider
    );
  }
} catch (error) {
  if (error.name === 'AbortError') {
    throw new LLMError('Request timeout', 'TIMEOUT', undefined, this.config.provider);
  }
  throw error;
}
```

### 5. Configuration Pattern (hybrid approach)
```typescript
// Per-collection configuration (stored in DB)
interface CollectionLLMConfig {
  provider: 'openai' | 'anthropic' | 'openrouter' | 'custom';
  model: string;
  temperature?: number;
  maxTokens?: number;
}

// Runtime configuration (passed by user)
interface LLMRequestOptions {
  apiKey: string; // Required, not stored
  timeout?: number;
  maxRetries?: number;
  temperature?: number;
  signal?: AbortSignal;
}
```

---

## Recommendation for LocalRetrieve

**Adopt Vercel AI SDK patterns** for the following reasons:

1. ✅ **Best TypeScript Support**: Full type safety, exactly what we need
2. ✅ **Browser-First Design**: Uses native fetch, no Node.js dependencies
3. ✅ **Lightweight Core**: No framework coupling, clean abstractions
4. ✅ **Production-Ready**: 2M+ weekly downloads, battle-tested
5. ✅ **Built-in Reliability**: Timeout, retry, abort signal support
6. ✅ **Flexible Architecture**: Provider factory pattern matches our needs

**Key Patterns to Implement**:
- Provider factory pattern
- Unified `generateText` API
- AbortSignal for timeout handling
- Typed request/response interfaces
- Error hierarchy with specific error codes

**Adaptation Strategy**:
- Clone provider abstraction pattern → `BaseLLMProvider`
- Implement OpenAI, Anthropic, OpenRouter, Custom providers
- Integrate with existing Worker RPC pattern
- Add to DatabaseWorker as `LLMManager`
- Expose through `Database` class public API

---

**Next Steps**: Create detailed technical specification based on these patterns.
