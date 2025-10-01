# Component 2: LLM.js (Universal LLM Interface)

## Overview

LLM.js by @themaximalist is a lightweight, zero-dependency universal interface for accessing hundreds of LLM providers with a consistent API. It's designed for simplicity and works identically in both Node.js and browser environments.

### GitHub Statistics
- **Repository**: https://github.com/themaximalist/llm.js
- **Stars**: 111 ⭐
- **Forks**: 17
- **Contributors**: Small team (~2-3 core contributors)
- **NPM Package**: `@themaximalist/llm.js`
- **Latest Release**: 2.0.1 (2024)
- **License**: MIT
- **Maintenance**: Actively maintained (2024-2025)

### Key Features
- ✅ **Zero dependencies** - Minimal bundle size
- ✅ **Browser-compatible** - Works in browser and Node.js
- ✅ **Multiple providers** - OpenAI, Anthropic, Google, Groq, Ollama, xAI, DeepSeek
- ✅ **Simple API** - Clean, minimal interface
- ✅ **TypeScript support** - Full TypeScript definitions
- ✅ **Production features** - Streaming, tools, cost tracking, retry logic

## Architecture Overview

### Single-Class Design

LLM.js uses a simple, class-based architecture with a single `LLM` class that handles all operations:

```typescript
// Core architecture
class LLM {
  // Configuration
  service: ServiceName;
  apiKey: string;
  model: string;
  baseUrl: string;

  // Methods
  async chat(message: string): Promise<string>;
  async stream(message: string): AsyncIterator<string>;

  // Static factory
  static register(provider: typeof LLM): void;
}
```

### Provider Abstraction via Inheritance

Providers extend base classes for different API patterns:

```typescript
// Base class for OpenAI-compatible APIs
class APIv1 extends LLM {
  static DEFAULT_BASE_URL: string;
  static DEFAULT_MODEL: string;

  // Standardized methods
  parseContent(data: any): string;
  parseUsage(data: any): Usage;
}

// Custom provider implementation
class Together extends LLM.APIv1 {
  static readonly service: ServiceName = "together";
  static DEFAULT_BASE_URL = "https://api.together.xyz/v1";
  static DEFAULT_MODEL = "meta-llama/Llama-3-70b-chat-hf";
}
```

## Supported Providers

### Built-in Providers

| Provider | Service Name | Models | Browser Support |
|----------|-------------|--------|-----------------|
| OpenAI | `openai` | GPT-4o, GPT-4, GPT-3.5, o1, o3 | ✅ Yes |
| Anthropic | `anthropic` | Claude 3.5, Claude 3 | ✅ Yes |
| Google | `google` | Gemini 1.5 Pro/Flash | ✅ Yes |
| Groq | `groq` | Llama, Mixtral on Groq | ✅ Yes |
| xAI | `xai` | Grok models | ✅ Yes |
| DeepSeek | `deepseek` | DeepSeek models | ✅ Yes |
| Ollama | `ollama` | Local models | ⚠️ Node.js only |

### Custom Provider Support

Easy to add any OpenAI-compatible provider:

```typescript
class CustomProvider extends LLM.APIv1 {
  static readonly service = "custom";
  static DEFAULT_BASE_URL = "https://api.custom.com/v1";
  static DEFAULT_MODEL = "custom-model";
}

LLM.register(CustomProvider);
```

## Code Examples

### 1. Simple Text Generation

```typescript
import LLM from "@themaximalist/llm.js";

// Simplest usage - direct function call
const response = await LLM("the color of the sky is");
console.log(response); // "blue"

// With configuration
const llm = new LLM({
  service: "openai",
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-4o"
});

const result = await llm.chat("What is quantum computing?");
console.log(result);
```

**Documentation**: https://llmjs.themaximalist.com/

### 2. Chat with Message History

```typescript
import LLM from "@themaximalist/llm.js";

const llm = new LLM({
  service: "anthropic",
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: "claude-3-5-sonnet-20241022"
});

// Chat maintains conversation history
await llm.chat("What's the color of the sky in hex value?");
// Response: "#87CEEB (sky blue)"

await llm.chat("What about at night time?");
// Response: "#000033 or #191970 (midnight blue)"

await llm.chat("And during sunset?");
// Response: "#FF6347 to #FFA500 (red-orange range)"

// Access full message history
console.log(llm.messages);
```

**Documentation**: https://llmjs.themaximalist.com/

### 3. Streaming Responses

```typescript
import LLM from "@themaximalist/llm.js";

const llm = new LLM({
  service: "openai",
  model: "gpt-4o",
  stream: true
});

// Stream text as it's generated
const stream = await llm.chat("Describe the sky in detail");

for await (const chunk of stream) {
  process.stdout.write(chunk);
}

// Alternative: Direct streaming function
const directStream = await LLM("write a story", {
  stream: true,
  service: "anthropic"
});

for await (const message of directStream) {
  process.stdout.write(message);
}
```

**Documentation**: https://llmjs.themaximalist.com/

### 4. Tool/Function Calling

```typescript
import LLM from "@themaximalist/llm.js";

// Define tool schema
const weatherTool = {
  name: "get_current_weather",
  description: "Get the current weather for a city",
  input_schema: {
    type: "object",
    properties: {
      city: {
        type: "string",
        description: "The name of the city"
      },
      unit: {
        type: "string",
        enum: ["celsius", "fahrenheit"],
        description: "Temperature unit"
      }
    },
    required: ["city"]
  }
};

// Create LLM with tools
const llm = new LLM({
  service: "anthropic",
  model: "claude-3-5-sonnet-20241022",
  tools: [weatherTool]
});

// LLM will request tool call
const response = await llm.chat("What's the weather in Tokyo?");

// Check if tool was called
if (response.tool_calls) {
  const toolCall = response.tool_calls[0];
  console.log(toolCall.name); // "get_current_weather"
  console.log(toolCall.arguments); // { city: "Tokyo", unit: "celsius" }

  // Execute tool and send result back
  const weatherData = await getWeather(toolCall.arguments.city);
  const finalResponse = await llm.chat(null, {
    tool_results: [{
      tool_call_id: toolCall.id,
      content: JSON.stringify(weatherData)
    }]
  });

  console.log(finalResponse);
}
```

**Documentation**: https://llmjs.themaximalist.com/

### 5. Configuration Options

```typescript
import LLM from "@themaximalist/llm.js";

const llm = new LLM({
  // Provider configuration
  service: "openai",
  apiKey: process.env.OPENAI_API_KEY,
  baseUrl: "https://api.openai.com/v1", // Custom endpoint

  // Model selection
  model: "gpt-4o",

  // Generation parameters
  temperature: 0.7, // 0-2, controls creativity
  max_tokens: 1000, // Maximum response length
  top_p: 0.9, // Nucleus sampling
  frequency_penalty: 0.0, // Reduce repetition
  presence_penalty: 0.0, // Encourage topic diversity

  // Features
  stream: true, // Enable streaming
  extended: true, // Include metadata in responses

  // Tools and attachments
  tools: [], // Function calling tools
  attachments: [], // File attachments (images, etc.)

  // Parser configuration
  parser: "json", // Auto-parse responses (json/xml/codeBlock)
  schema: {}, // JSON schema for validation
});
```

**Documentation**: https://llmjs.themaximalist.com/docs/interfaces/Options.html

### 6. Extended Responses with Metadata

```typescript
import LLM from "@themaximalist/llm.js";

const llm = new LLM({
  service: "openai",
  model: "gpt-4o",
  extended: true // Enable metadata
});

const response = await llm.chat("Explain neural networks");

// Access extended metadata
console.log(response.content); // The actual text response
console.log(response.usage); // Token usage statistics
console.log(response.cost); // Estimated cost in USD
console.log(response.model); // Model used
console.log(response.service); // Service provider
console.log(response.finish_reason); // Why generation stopped
console.log(response.latency); // Response time in ms
```

**Documentation**: https://llmjs.themaximalist.com/

### 7. JSON Response Parsing

```typescript
import LLM from "@themaximalist/llm.js";

const llm = new LLM({
  service: "openai",
  model: "gpt-4o",
  parser: "json"
});

// LLM will automatically parse JSON from response
const data = await llm.chat(
  "Generate a user profile in JSON with name, age, and hobbies"
);

console.log(data);
// Automatically parsed:
// {
//   name: "John Doe",
//   age: 30,
//   hobbies: ["reading", "hiking", "photography"]
// }

// With schema validation
const schemaLLM = new LLM({
  service: "openai",
  model: "gpt-4o",
  parser: "json",
  schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      age: { type: "number" },
      hobbies: { type: "array", items: { type: "string" } }
    },
    required: ["name", "age"]
  }
});

const validatedData = await schemaLLM.chat("Generate a user profile");
// Will throw error if response doesn't match schema
```

**Documentation**: https://llmjs.themaximalist.com/

### 8. Custom Provider Implementation

```typescript
import LLM from "@themaximalist/llm.js";

// Extend APIv1 for OpenAI-compatible APIs
class OpenRouter extends LLM.APIv1 {
  static readonly service = "openrouter";
  static DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
  static DEFAULT_MODEL = "anthropic/claude-3.5-sonnet";

  // Optional: Custom headers
  getHeaders() {
    return {
      ...super.getHeaders(),
      "HTTP-Referer": "https://myapp.com",
      "X-Title": "My Application"
    };
  }
}

// Register provider
LLM.register(OpenRouter);

// Use custom provider
const llm = new LLM({
  service: "openrouter",
  apiKey: process.env.OPENROUTER_API_KEY,
  model: "anthropic/claude-3.5-sonnet"
});

const response = await llm.chat("Hello!");
```

**Documentation**: https://llmjs.themaximalist.com/

### 9. Error Handling with Retry

```typescript
import LLM from "@themaximalist/llm.js";

const llm = new LLM({
  service: "openai",
  model: "gpt-4o",
  maxRetries: 3 // Retry up to 3 times on failure
});

try {
  const response = await llm.chat("What is AI?");
  console.log(response);
} catch (error) {
  if (error.code === 'rate_limit_exceeded') {
    console.error('Rate limited, try again later');
  } else if (error.code === 'invalid_api_key') {
    console.error('Invalid API key');
  } else if (error.code === 'model_not_found') {
    console.error('Model does not exist');
  } else {
    console.error('Unknown error:', error);
  }
}
```

### 10. Multi-Provider Cost Tracking

```typescript
import LLM from "@themaximalist/llm.js";

// Track costs across different providers
const providers = [
  new LLM({ service: "openai", model: "gpt-4o", extended: true }),
  new LLM({ service: "anthropic", model: "claude-3-5-sonnet-20241022", extended: true }),
  new LLM({ service: "google", model: "gemini-1.5-pro", extended: true })
];

let totalCost = 0;

for (const llm of providers) {
  const response = await llm.chat("Explain quantum computing");

  console.log(`Provider: ${llm.service}`);
  console.log(`Cost: $${response.cost.toFixed(6)}`);
  console.log(`Tokens: ${response.usage.total_tokens}`);

  totalCost += response.cost;
}

console.log(`Total cost: $${totalCost.toFixed(6)}`);
```

**Documentation**: https://llmjs.themaximalist.com/

### 11. Browser Usage Example

```html
<!DOCTYPE html>
<html>
<head>
  <title>LLM.js Browser Example</title>
</head>
<body>
  <div id="app">
    <textarea id="prompt" rows="4" cols="50">What is the capital of France?</textarea>
    <button onclick="generate()">Generate</button>
    <div id="result"></div>
  </div>

  <script type="module">
    import LLM from 'https://esm.sh/@themaximalist/llm.js';

    // Initialize LLM (API key from environment or input)
    const llm = new LLM({
      service: 'openai',
      apiKey: 'YOUR_API_KEY', // Should come from secure source
      model: 'gpt-4o-mini'
    });

    window.generate = async function() {
      const prompt = document.getElementById('prompt').value;
      const resultDiv = document.getElementById('result');

      resultDiv.textContent = 'Generating...';

      try {
        const response = await llm.chat(prompt);
        resultDiv.textContent = response;
      } catch (error) {
        resultDiv.textContent = `Error: ${error.message}`;
      }
    };
  </script>
</body>
</html>
```

### 12. Streaming in Browser

```typescript
// streaming-chat.ts
import LLM from "@themaximalist/llm.js";

export async function streamChat(prompt: string, outputElement: HTMLElement) {
  const llm = new LLM({
    service: "openai",
    apiKey: getApiKey(), // From secure source
    model: "gpt-4o",
    stream: true
  });

  outputElement.textContent = '';

  try {
    const stream = await llm.chat(prompt);

    for await (const chunk of stream) {
      outputElement.textContent += chunk;
      // Auto-scroll to bottom
      outputElement.scrollTop = outputElement.scrollHeight;
    }
  } catch (error) {
    console.error('Streaming error:', error);
    outputElement.textContent = 'Error: ' + error.message;
  }
}
```

## Error Handling Patterns

### 1. Built-in Retry Logic

```typescript
const llm = new LLM({
  service: "openai",
  model: "gpt-4o",
  maxRetries: 3,
  retryDelay: 1000 // ms between retries
});

// Automatically retries on transient failures
const response = await llm.chat("Hello");
```

### 2. Error Type Detection

```typescript
try {
  const response = await llm.chat("Test");
} catch (error) {
  switch (error.code) {
    case 'rate_limit_exceeded':
      // Wait and retry
      await sleep(60000);
      return llm.chat("Test");

    case 'invalid_api_key':
      // Cannot recover
      throw new Error('API key configuration error');

    case 'model_not_found':
      // Fallback to different model
      llm.model = 'gpt-4o-mini';
      return llm.chat("Test");

    case 'context_length_exceeded':
      // Truncate and retry
      return llm.chat("Test", { max_tokens: 500 });

    default:
      throw error;
  }
}
```

### 3. Fallback Provider Pattern

```typescript
async function robustGenerate(prompt: string): Promise<string> {
  const providers = [
    { service: "openai", model: "gpt-4o" },
    { service: "anthropic", model: "claude-3-5-sonnet-20241022" },
    { service: "google", model: "gemini-1.5-pro" }
  ];

  for (const config of providers) {
    try {
      const llm = new LLM(config);
      return await llm.chat(prompt);
    } catch (error) {
      console.error(`${config.service} failed:`, error);
      // Continue to next provider
    }
  }

  throw new Error('All providers failed');
}
```

## TypeScript Interface Design

### Core Types

```typescript
// Options interface
interface Options {
  // Provider configuration
  service?: ServiceName;
  apiKey?: string;
  baseUrl?: string;

  // Model selection
  model?: string;

  // Generation parameters
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stop?: string[];

  // Features
  stream?: boolean;
  extended?: boolean;

  // Tools and attachments
  tools?: Tool[];
  attachments?: Attachment[];

  // Parser configuration
  parser?: "json" | "xml" | "codeBlock";
  schema?: object;

  // Retry configuration
  maxRetries?: number;
  retryDelay?: number;
}

// Service names
type ServiceName =
  | "openai"
  | "anthropic"
  | "google"
  | "groq"
  | "xai"
  | "deepseek"
  | "ollama"
  | string; // Allow custom services

// Extended response
interface ExtendedResponse {
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  cost: number;
  model: string;
  service: string;
  finish_reason: "stop" | "length" | "tool_calls";
  latency: number;
  tool_calls?: ToolCall[];
}

// Tool definition
interface Tool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
}

// Tool call
interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}
```

### Parser Types

```typescript
// Parser interface
interface Parsers {
  json: <T = any>(text: string) => T;
  xml: (text: string) => object;
  codeBlock: (text: string) => string;
}

// Schema validation
interface Schema {
  type: "object" | "array" | "string" | "number" | "boolean";
  properties?: Record<string, Schema>;
  items?: Schema;
  required?: string[];
  enum?: any[];
}
```

## Browser Compatibility Features

### 1. Zero Dependencies
```typescript
// No external dependencies - minimal bundle size
import LLM from "@themaximalist/llm.js";
// ~15-20KB minified
```

### 2. ES Module Support
```typescript
// Works with modern bundlers and native ESM
import LLM from "@themaximalist/llm.js";

// Also available via CDN
import LLM from "https://esm.sh/@themaximalist/llm.js";
```

### 3. Browser-Native Fetch
```typescript
// Uses native fetch API - no polyfills needed
const llm = new LLM({
  service: "openai",
  apiKey: getSecureApiKey() // From backend or secure storage
});
```

### 4. Streaming via AsyncIterator
```typescript
// Browser-compatible streaming with async iterators
const stream = await llm.chat("Tell me a story", { stream: true });

for await (const chunk of stream) {
  // Update UI in real-time
  updateUI(chunk);
}
```

## Configuration Patterns

### 1. Environment-Based Configuration

```typescript
// config/llm.ts
import LLM from "@themaximalist/llm.js";

export function createLLM(provider: string = "openai") {
  const configs = {
    openai: {
      service: "openai",
      apiKey: process.env.OPENAI_API_KEY,
      model: "gpt-4o"
    },
    anthropic: {
      service: "anthropic",
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: "claude-3-5-sonnet-20241022"
    }
  };

  return new LLM(configs[provider]);
}

// Usage
const llm = createLLM("anthropic");
```

### 2. Model Registry Pattern

```typescript
// lib/models.ts
import LLM from "@themaximalist/llm.js";

export const models = {
  fast: {
    openai: new LLM({ service: "openai", model: "gpt-4o-mini" }),
    anthropic: new LLM({ service: "anthropic", model: "claude-3-haiku-20240307" })
  },
  smart: {
    openai: new LLM({ service: "openai", model: "gpt-4o" }),
    anthropic: new LLM({ service: "anthropic", model: "claude-3-5-sonnet-20241022" })
  }
};

// Usage
const response = await models.smart.anthropic.chat("Complex question");
```

### 3. Proxy Configuration

```typescript
// For browser apps with backend proxy
const llm = new LLM({
  service: "openai",
  baseUrl: "/api/llm/openai", // Your backend proxy
  apiKey: "client-token" // Client-specific token
});
```

## Architecture Adaptability for LocalRetrieve

### Strengths for Our Use Case

1. **✅ Minimal Bundle Size**
   - Zero dependencies means ~15-20KB total
   - Perfect for browser-based applications
   - No bloat from framework integrations

2. **✅ Simple, Predictable API**
   - Easy to learn and implement
   - Minimal abstraction layers
   - Direct control over requests

3. **✅ Cost Tracking Built-in**
   - Real-time cost estimation
   - Perfect for monitoring LLM usage
   - Helps optimize provider selection

4. **✅ Custom Provider Support**
   - Easy to add new providers
   - Can implement custom logic
   - Good for experimentation

5. **✅ True Browser Compatibility**
   - No Node.js-specific dependencies
   - Works with native fetch
   - Simple streaming implementation

### Potential Challenges

1. **⚠️ Less Mature Ecosystem**
   - Smaller community (111 stars vs 18k)
   - Fewer examples and tutorials
   - Less battle-tested in production

2. **⚠️ Limited Framework Integration**
   - No built-in React/Vue hooks
   - Need to build UI integrations ourselves
   - Less opinionated architecture

3. **⚠️ Basic Error Handling**
   - Simple retry mechanism
   - Less sophisticated error types
   - Manual fallback implementation needed

4. **⚠️ Documentation Gaps**
   - Good but not comprehensive
   - Fewer real-world examples
   - Some features underdocumented

### Integration Pattern for LocalRetrieve

```typescript
// src/llm/LLMJSProvider.ts
import LLM from "@themaximalist/llm.js";

export class LLMJSProvider {
  private llm: LLM;
  private fallbackLLM?: LLM;

  constructor(config: LLMConfig) {
    // Primary provider
    this.llm = new LLM({
      service: config.provider,
      apiKey: config.apiKey,
      model: config.model,
      extended: true, // Get cost/usage data
      maxRetries: 2
    });

    // Fallback provider
    if (config.fallbackProvider) {
      this.fallbackLLM = new LLM({
        service: config.fallbackProvider,
        apiKey: config.fallbackApiKey,
        model: config.fallbackModel,
        extended: true,
        maxRetries: 1
      });
    }
  }

  async enhanceQuery(query: string, context?: string): Promise<string> {
    const prompt = `Enhance this search query for better results:
Query: ${query}
Context: ${context || "none"}

Return only the enhanced query, nothing else.`;

    try {
      const response = await this.llm.chat(prompt);
      return response.content || response;
    } catch (error) {
      console.error('Primary LLM failed:', error);

      // Try fallback
      if (this.fallbackLLM) {
        try {
          const fallbackResponse = await this.fallbackLLM.chat(prompt);
          return fallbackResponse.content || fallbackResponse;
        } catch (fallbackError) {
          console.error('Fallback LLM failed:', fallbackError);
        }
      }

      // Return original query if all fails
      return query;
    }
  }

  async summarizeResults(results: SearchResult[]): Promise<{
    summary: string;
    cost: number;
  }> {
    const resultsText = results
      .map(r => `- ${r.title}: ${r.content.substring(0, 200)}`)
      .join('\n');

    const prompt = `Summarize these search results in 2-3 sentences:
${resultsText}`;

    try {
      const response = await this.llm.chat(prompt);

      return {
        summary: response.content || response,
        cost: response.cost || 0
      };
    } catch (error) {
      console.error('Summarization failed:', error);
      return {
        summary: 'Unable to generate summary',
        cost: 0
      };
    }
  }
}
```

## Pros and Cons for LocalRetrieve

### Pros ✅

1. **Minimal bundle size** - Only ~15-20KB, perfect for browser apps
2. **Simple API** - Easy to learn and integrate
3. **Zero dependencies** - No dependency management headaches
4. **Cost tracking** - Built-in cost estimation
5. **Custom providers** - Easy to extend
6. **TypeScript support** - Full type definitions
7. **Streaming support** - Good for real-time UX
8. **Browser-native** - Works perfectly in browsers

### Cons ⚠️

1. **Small community** - Less support and examples
2. **Less mature** - Not as battle-tested
3. **No framework integration** - Need to build UI hooks
4. **Basic error handling** - Less sophisticated
5. **Limited documentation** - Fewer examples
6. **Smaller ecosystem** - Fewer integrations

## Recommended Approach for LocalRetrieve

**Use LLM.js as a lightweight alternative** when:

1. **Bundle size is critical** - Every KB matters
2. **Simple use cases** - Query enhancement, summarization
3. **Custom provider needed** - Easy to extend
4. **Cost tracking important** - Built-in cost monitoring

**Consider if**:
- You want maximum simplicity
- You don't need framework integrations
- You value small bundle size over ecosystem

## Additional Resources

1. **Official Documentation**: https://llmjs.themaximalist.com/
2. **GitHub Repository**: https://github.com/themaximalist/llm.js
3. **NPM Package**: https://www.npmjs.com/package/@themaximalist/llm.js
4. **API Documentation**: https://llmjs.themaximalist.com/docs/
5. **Examples**: https://github.com/themaximalist/llm.js/tree/main/examples
6. **Related Projects**:
   - AI.js: https://github.com/themaximalist/ai.js (Full AI toolkit)
   - ModelDeployer: https://github.com/themaximalist/ModelDeployer (API proxy)

---

**Last Updated**: 2025-10-01
**Research Status**: ✅ Complete
**Recommendation**: **Secondary Choice** - Best for bundle-size-critical scenarios
