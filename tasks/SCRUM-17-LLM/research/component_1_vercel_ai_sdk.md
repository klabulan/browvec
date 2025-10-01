# Component 1: Vercel AI SDK

## Overview

The Vercel AI SDK is a production-ready TypeScript toolkit for building AI-powered applications with support for multiple frameworks and LLM providers. Created by the Vercel/Next.js team, it's one of the most actively maintained and widely adopted solutions in the JavaScript ecosystem.

### GitHub Statistics
- **Repository**: https://github.com/vercel/ai
- **Stars**: 18.1k ⭐
- **Forks**: 3k
- **Contributors**: 528
- **NPM Downloads**: 2M+ weekly
- **Latest Release**: @ai-sdk/azure@2.0.42 (January 2025)
- **License**: Apache 2.0
- **Maintenance**: Actively maintained (2024-2025)

### Key Features
- ✅ **Browser-compatible**: Full browser support with React, Vue, Svelte, Angular
- ✅ **Multiple providers**: OpenAI, Anthropic, Google, Azure, xAI, Groq, Mistral, etc.
- ✅ **Clean abstraction**: Unified API across all providers
- ✅ **Production-ready error handling**: Built-in retry, error callbacks, graceful degradation
- ✅ **Full TypeScript support**: End-to-end type safety
- ✅ **Actively maintained**: Weekly updates and releases

## Architecture Overview

### Two-Layer Architecture

The AI SDK is organized into two primary libraries:

1. **AI SDK Core** (`ai` package)
   - Unified API for text generation, structured objects, tool calls
   - Provider-agnostic interface
   - Streaming support
   - Error handling and retry logic

2. **AI SDK UI** (`@ai-sdk/react`, `@ai-sdk/vue`, `@ai-sdk/svelte`)
   - Framework-specific hooks (useChat, useCompletion, useObject)
   - State management
   - Real-time streaming UI updates
   - Error state handling

### Provider Abstraction Pattern

```typescript
// Core abstraction - same interface for all providers
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';

// All providers use the same interface
const result1 = await generateText({
  model: openai('gpt-4o'),
  prompt: 'What is the capital of France?'
});

const result2 = await generateText({
  model: anthropic('claude-3-5-sonnet-20241022'),
  prompt: 'What is the capital of France?'
});

const result3 = await generateText({
  model: google('gemini-1.5-pro'),
  prompt: 'What is the capital of France?'
});
```

## Supported Providers

### Official Provider Packages

| Provider | Package | Models |
|----------|---------|--------|
| OpenAI | `@ai-sdk/openai` | GPT-4o, GPT-4 Turbo, GPT-3.5, o1, o3 |
| Anthropic | `@ai-sdk/anthropic` | Claude 3.5 Sonnet/Opus, Claude 3 |
| Google | `@ai-sdk/google` | Gemini 1.5 Pro/Flash, Gemini 2.0 |
| Azure OpenAI | `@ai-sdk/azure` | Azure-hosted OpenAI models |
| xAI | `@ai-sdk/xai` | Grok-4, Grok-3 |
| Mistral | `@ai-sdk/mistral` | Mistral Large, Mistral Medium |
| Groq | `@ai-sdk/groq` | Llama, Mixtral on Groq infrastructure |
| Cohere | `@ai-sdk/cohere` | Command R+, Command models |

### Community Providers

- **OpenRouter** (`@openrouter/ai-sdk-provider`) - 300+ models
- **Replicate** - Custom model hosting
- **Together AI** - Fast inference infrastructure
- **Fireworks AI** - Optimized LLM serving

### Custom Provider Support

```typescript
import { customProvider } from 'ai';

// Create custom provider for any OpenAI-compatible API
const myProvider = customProvider({
  languageModels: {
    'my-model': {
      specificationVersion: 'v1',
      provider: 'my-provider',
      modelId: 'my-model',
      defaultSettings: {},
    },
  },
});
```

## Code Examples

### 1. Basic Text Generation

```typescript
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

// Simple text generation
const { text } = await generateText({
  model: openai('gpt-4o'),
  prompt: 'Write a vegetarian lasagna recipe for 4 people.'
});

console.log(text);
```

**Documentation**: https://ai-sdk.dev/docs/ai-sdk-core/generating-text

### 2. Advanced Prompting with System Instructions

```typescript
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

const { text } = await generateText({
  model: anthropic('claude-3-5-sonnet-20241022'),
  system: 'You are a professional writer. You write simple, clear, and concise content.',
  prompt: `Summarize the following article in 3-5 sentences: ${article}`,
  temperature: 0.7,
  maxTokens: 500
});
```

**Documentation**: https://ai-sdk.dev/docs/ai-sdk-core/prompts

### 3. Streaming Text Generation

```typescript
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

const result = streamText({
  model: openai('gpt-4o'),
  prompt: 'Invent a new holiday and describe its traditions.'
});

// Async iteration over text chunks
for await (const textPart of result.textStream) {
  process.stdout.write(textPart);
}

// Or get full text when complete
const fullText = await result.text;
```

**Documentation**: https://ai-sdk.dev/docs/ai-sdk-core/streaming

### 4. Browser Usage with React Hook

```typescript
'use client';
import { useState } from 'react';
import { useChat } from '@ai-sdk/react';

export default function ChatInterface() {
  const { messages, status, sendMessage, error } = useChat({
    api: '/api/chat',
    onError: (error) => {
      console.error('Chat error:', error);
    }
  });

  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      sendMessage({ text: input });
      setInput('');
    }
  };

  return (
    <div className="chat-container">
      {/* Message display */}
      <div className="messages">
        {messages.map(message => (
          <div key={message.id} className={`message ${message.role}`}>
            <strong>{message.role}:</strong>
            {message.parts.map((part, index) => {
              switch (part.type) {
                case 'text':
                  return <span key={index}>{part.text}</span>;
                case 'tool-call':
                  return <div key={index}>Tool: {part.toolName}</div>;
                default:
                  return null;
              }
            })}
          </div>
        ))}
      </div>

      {/* Error handling */}
      {error && (
        <div className="error-banner">
          <p>An error occurred: {error.message}</p>
          <button onClick={() => sendMessage({ text: messages[messages.length - 1].parts[0].text })}>
            Retry
          </button>
        </div>
      )}

      {/* Input form */}
      <form onSubmit={handleSubmit}>
        <input
          value={input}
          placeholder="Send a message..."
          onChange={e => setInput(e.target.value)}
          disabled={status !== 'ready'}
        />
        <button type="submit" disabled={status !== 'ready'}>
          Send
        </button>
      </form>
    </div>
  );
}
```

**Documentation**: https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat

### 5. Server-Side API Route (Next.js)

```typescript
// app/api/chat/route.ts
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: openai('gpt-4o'),
    messages,
    system: 'You are a helpful assistant.',
  });

  return result.toDataStreamResponse();
}
```

**Documentation**: https://ai-sdk.dev/docs/ai-sdk-core/stream-protocol

### 6. Error Handling with Retry

```typescript
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';

try {
  const result = await generateText({
    model: openai('gpt-4o'),
    prompt: 'Tell me a joke',
    maxRetries: 3, // Retry up to 3 times
    onError: ({ error }) => {
      console.error('Generation error:', error);
    }
  });

  console.log(result.text);
} catch (error) {
  if (error.name === 'AI_RetryError') {
    console.error('Failed after retries:', error);
  } else if (error.name === 'AI_APIError') {
    console.error('API error:', error.statusCode, error.message);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

**Documentation**: https://ai-sdk.dev/docs/ai-sdk-ui/error-handling

### 7. Custom Provider with OpenRouter

```typescript
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';

// Initialize OpenRouter provider (300+ models)
const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Access any model through OpenRouter
const model = openrouter('anthropic/claude-3.5-sonnet');

const result = await generateText({
  model,
  prompt: 'Explain quantum computing in simple terms',
  extraBody: {
    provider: {
      order: ['Together', 'DeepInfra'], // Provider preference
    }
  }
});

// Access usage metadata
if (result.providerMetadata?.openrouter?.usage) {
  console.log('Cost:', result.providerMetadata.openrouter.usage.cost);
  console.log('Latency:', result.providerMetadata.openrouter.usage.latency);
}
```

**Documentation**: https://openrouter.ai/docs/community/vercel-ai-sdk

### 8. Streaming with Error Recovery

```typescript
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

const result = streamText({
  model: openai('gpt-4o'),
  prompt: 'Write a long story',
  onError: ({ error }) => {
    console.error('Stream error:', error);
    // Log error but continue with partial results
  }
});

// Handle stream interruption gracefully
try {
  for await (const textPart of result.textStream) {
    process.stdout.write(textPart);
  }
} catch (error) {
  console.error('Stream interrupted:', error);
  // Get partial text generated before error
  const partialText = await result.text.catch(() => 'Error getting text');
  console.log('Partial text:', partialText);
}
```

### 9. Multi-Provider Fallback Pattern

```typescript
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';

async function generateWithFallback(prompt: string) {
  const providers = [
    { name: 'OpenAI', model: openai('gpt-4o') },
    { name: 'Anthropic', model: anthropic('claude-3-5-sonnet-20241022') },
    { name: 'Google', model: google('gemini-1.5-pro') }
  ];

  for (const provider of providers) {
    try {
      console.log(`Trying ${provider.name}...`);
      const result = await generateText({
        model: provider.model,
        prompt,
        maxRetries: 1
      });
      return result.text;
    } catch (error) {
      console.error(`${provider.name} failed:`, error.message);
      // Continue to next provider
    }
  }

  throw new Error('All providers failed');
}

// Usage
const text = await generateWithFallback('Explain machine learning');
```

### 10. Browser-Only Usage (Client-Side Direct)

```typescript
// Direct browser usage without backend proxy
import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

// Client-side configuration (use environment variables carefully!)
const openai = createOpenAI({
  apiKey: clientApiKey, // Should come from secure source
  baseURL: 'https://api.openai.com/v1' // Or custom proxy
});

const result = await generateText({
  model: openai('gpt-4o-mini'),
  prompt: 'Hello, world!'
});
```

**Note**: For production, always use a backend proxy to protect API keys.

## Error Handling Patterns

### 1. Built-in Error Types

```typescript
import {
  RetryError,
  APIError,
  InvalidResponseError
} from 'ai';

try {
  const result = await generateText({
    model: openai('gpt-4o'),
    prompt: 'Test'
  });
} catch (error) {
  if (error instanceof RetryError) {
    // Failed after multiple retry attempts
    console.error('Retry exhausted:', error.attempts);
  } else if (error instanceof APIError) {
    // API returned error status
    console.error('API error:', error.statusCode, error.message);
  } else if (error instanceof InvalidResponseError) {
    // Invalid response format
    console.error('Invalid response:', error);
  }
}
```

### 2. React Hook Error Handling

```typescript
const { error, regenerate, setMessages } = useChat({
  onError: (error) => {
    // Custom error handling
    console.error('Chat error:', error);

    // Could send to error tracking service
    trackError(error);
  }
});

// UI error display
{error && (
  <div className="error">
    <p>An error occurred: {error.message}</p>
    <button onClick={() => {
      setMessages(messages.slice(0, -1)); // Remove last message
      regenerate(); // Retry
    }}>
      Retry
    </button>
  </div>
)}
```

### 3. Graceful Degradation

```typescript
async function robustGenerate(prompt: string) {
  try {
    return await generateText({
      model: openai('gpt-4o'),
      prompt,
      maxRetries: 3
    });
  } catch (error) {
    console.error('Primary model failed:', error);

    // Fallback to cheaper/faster model
    try {
      return await generateText({
        model: openai('gpt-4o-mini'),
        prompt,
        maxRetries: 2
      });
    } catch (fallbackError) {
      console.error('Fallback model failed:', fallbackError);

      // Return default response
      return { text: 'Service temporarily unavailable' };
    }
  }
}
```

## TypeScript Interface Design

### Core Types

```typescript
// From @ai-sdk/provider specification
interface LanguageModelV1 {
  specificationVersion: 'v1';
  provider: string;
  modelId: string;
  defaultSettings?: {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
    frequencyPenalty?: number;
    presencePenalty?: number;
  };

  doGenerate(options: LanguageModelV1CallOptions): Promise<LanguageModelV1CallResponse>;
  doStream(options: LanguageModelV1CallOptions): Promise<LanguageModelV1StreamResponse>;
}

interface LanguageModelV1CallOptions {
  model: LanguageModelV1;
  prompt: LanguageModelV1Prompt;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
  responseFormat?: { type: 'text' | 'json' };
}

interface GenerateTextResult<T = any> {
  text: string;
  finishReason: 'stop' | 'length' | 'content-filter' | 'error';
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  response: {
    id: string;
    timestamp: Date;
    modelId: string;
  };
  providerMetadata?: T;
}
```

### React Hook Types

```typescript
interface UseChatOptions {
  api?: string;
  id?: string;
  initialMessages?: Message[];
  onError?: (error: Error) => void;
  onFinish?: (message: Message) => void;
  headers?: Record<string, string>;
  body?: Record<string, any>;
}

interface UseChatReturn {
  messages: Message[];
  status: 'ready' | 'streaming' | 'error';
  error: Error | undefined;
  sendMessage: (message: { text: string }) => void;
  regenerate: () => void;
  stop: () => void;
  setMessages: (messages: Message[]) => void;
  reload: () => void;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts: MessagePart[];
  createdAt?: Date;
}

type MessagePart =
  | { type: 'text'; text: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; args: any }
  | { type: 'tool-result'; toolCallId: string; result: any };
```

## Browser Compatibility Features

### 1. Automatic Headers for CORS

```typescript
// SDK automatically handles CORS and necessary headers
const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  headers: {
    'Custom-Header': 'value'
  }
});
```

### 2. Server-Sent Events (SSE) Streaming

```typescript
// Browser-native SSE streaming support
const result = streamText({
  model: openai('gpt-4o'),
  prompt: 'Write a story'
});

// SSE protocol handled automatically
return result.toDataStreamResponse();
```

### 3. Client-Side State Management

```typescript
// Built-in state management for browser apps
const { messages, status } = useChat();

// Status values:
// - 'ready': Ready for new messages
// - 'streaming': Currently receiving response
// - 'error': Error occurred
```

### 4. WebSocket Support (Optional)

```typescript
// Alternative to HTTP for real-time apps
import { useChat } from '@ai-sdk/react';

const { messages } = useChat({
  transport: 'websocket', // Use WebSocket instead of HTTP
  api: 'ws://localhost:3000/chat'
});
```

## Configuration Patterns

### 1. Environment-Based Configuration

```typescript
// config/ai-providers.ts
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';

export const providers = {
  openai: createOpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    organization: process.env.OPENAI_ORG_ID
  }),
  anthropic: createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
  })
};

// Usage
import { providers } from './config/ai-providers';
const model = providers.openai('gpt-4o');
```

### 2. Model Registry Pattern

```typescript
// lib/models.ts
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';

export const models = {
  // Fast, cheap models for simple tasks
  fast: {
    openai: openai('gpt-4o-mini'),
    anthropic: anthropic('claude-3-haiku-20240307')
  },
  // Smart models for complex tasks
  smart: {
    openai: openai('gpt-4o'),
    anthropic: anthropic('claude-3-5-sonnet-20241022')
  },
  // Specialized models
  code: openai('o1-preview'),
  vision: openai('gpt-4o')
};

// Usage
import { models } from './lib/models';
const result = await generateText({
  model: models.smart.anthropic,
  prompt: 'Explain quantum mechanics'
});
```

### 3. Custom Proxy Configuration

```typescript
// For browser apps, configure custom proxy
const openai = createOpenAI({
  baseURL: '/api/openai-proxy', // Your backend proxy
  apiKey: 'client-token', // Client-specific token
  fetch: customFetch // Optional custom fetch implementation
});
```

## Architecture Adaptability for LocalRetrieve

### Strengths for Our Use Case

1. **✅ Excellent Provider Abstraction**
   - Clean separation between provider logic and application code
   - Easy to swap providers or add fallbacks
   - Consistent interface for query enhancement and summarization

2. **✅ Production-Ready Error Handling**
   - Built-in retry mechanisms
   - Comprehensive error types
   - Graceful degradation support
   - Perfect for unreliable LLM APIs

3. **✅ TypeScript Excellence**
   - Full type safety end-to-end
   - Well-documented type definitions
   - Easy to integrate with our existing TypeScript codebase

4. **✅ Browser-First Design**
   - Works seamlessly in browser environments
   - React/Vue/Svelte hooks for UI integration
   - SSE streaming natively supported
   - No Node.js dependencies required

5. **✅ Active Maintenance**
   - Weekly updates and bug fixes
   - Strong community support
   - Vercel backing ensures longevity
   - Excellent documentation

### Potential Challenges

1. **⚠️ Backend Proxy Required for Security**
   - API keys shouldn't be exposed client-side
   - Need to implement secure proxy layer
   - Adds deployment complexity

2. **⚠️ Bundle Size Concerns**
   - Full SDK is ~50-100KB minified
   - May need tree-shaking optimization
   - Provider packages add additional size

3. **⚠️ React-Centric Documentation**
   - Most examples use React
   - Need to adapt patterns for vanilla JS/TypeScript
   - Framework-agnostic core is less documented

### Integration Pattern for LocalRetrieve

```typescript
// src/llm/AISDKProvider.ts
import { generateText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';

export class AISDKLLMProvider {
  private models: Map<string, any>;

  constructor(config: LLMConfig) {
    this.models = new Map([
      ['openai', openai(config.openai?.model || 'gpt-4o-mini')],
      ['anthropic', anthropic(config.anthropic?.model || 'claude-3-haiku-20240307')]
    ]);
  }

  async enhanceQuery(query: string, context?: string): Promise<string> {
    const model = this.models.get(this.config.defaultProvider);

    try {
      const result = await generateText({
        model,
        system: 'Enhance search queries for hybrid vector/FTS search',
        prompt: `Original query: ${query}\nContext: ${context || 'none'}`,
        temperature: 0.3,
        maxTokens: 100,
        maxRetries: 2
      });

      return result.text;
    } catch (error) {
      console.error('Query enhancement failed:', error);
      return query; // Fallback to original
    }
  }

  async summarizeResults(results: SearchResult[]): Promise<string> {
    const model = this.models.get(this.config.defaultProvider);

    const resultsText = results
      .map(r => `- ${r.title}: ${r.content.substring(0, 200)}`)
      .join('\n');

    try {
      const result = await generateText({
        model,
        system: 'Summarize search results concisely',
        prompt: `Summarize these search results:\n${resultsText}`,
        temperature: 0.5,
        maxTokens: 300,
        maxRetries: 2
      });

      return result.text;
    } catch (error) {
      console.error('Summarization failed:', error);
      return 'Unable to generate summary';
    }
  }
}
```

## Pros and Cons for LocalRetrieve

### Pros ✅

1. **Best-in-class TypeScript support** - Perfect fit for our TypeScript codebase
2. **Production-ready** - Battle-tested by thousands of applications
3. **Excellent documentation** - Comprehensive guides and examples
4. **Active community** - Fast bug fixes and feature additions
5. **Clean abstractions** - Easy to understand and extend
6. **Multiple providers** - Not locked into single vendor
7. **Streaming support** - Great for real-time UX
8. **Framework flexibility** - Can use with or without React/Vue

### Cons ⚠️

1. **Requires backend proxy** - Can't use directly in browser for security
2. **Bundle size** - Adds ~50-100KB to client bundle
3. **Vercel ecosystem focus** - Some features optimized for Vercel deployment
4. **Learning curve** - Need to understand provider patterns
5. **Provider packages** - Each provider is separate dependency

## Recommended Approach for LocalRetrieve

**Use Vercel AI SDK as the primary LLM integration solution** with these considerations:

1. **Create thin wrapper** around AI SDK core for our specific needs
2. **Implement backend proxy** for secure API key management
3. **Start with 1-2 providers** (OpenAI + one fallback)
4. **Use tree-shaking** to minimize bundle size
5. **Leverage streaming** for better UX in demos
6. **Follow their error handling patterns** for robustness

## Additional Resources

1. **Official Documentation**: https://ai-sdk.dev/docs
2. **GitHub Repository**: https://github.com/vercel/ai
3. **Provider Documentation**: https://ai-sdk.dev/providers
4. **API Reference**: https://ai-sdk.dev/docs/reference
5. **Examples Repository**: https://github.com/vercel/ai/tree/main/examples
6. **Community Discord**: Vercel Discord #ai-sdk channel
7. **Blog Posts**: https://vercel.com/blog (search for "AI SDK")
8. **OpenRouter Integration**: https://openrouter.ai/docs/community/vercel-ai-sdk
9. **Custom Providers Guide**: https://ai-sdk.dev/providers/community-providers/custom-providers
10. **Troubleshooting Guide**: https://ai-sdk.dev/docs/troubleshooting

---

**Last Updated**: 2025-10-01
**Research Status**: ✅ Complete
**Recommendation**: **Primary Choice** - Best overall fit for LocalRetrieve
