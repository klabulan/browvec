# OpenAI Provider Implementation - Usage Examples

## Basic Usage

```javascript
import { createOpenAIProvider } from 'localretrieve';

// Create OpenAI provider with 384-dimensional embeddings
const provider = createOpenAIProvider(384, 'text-embedding-3-small');

// Initialize with API key
await provider.initialize({
  defaultProvider: 'openai',
  defaultDimensions: 384,
  apiKey: 'sk-your-openai-api-key-here'
});

// Generate single embedding
const embedding = await provider.generateEmbedding('Hello, world!');
console.log('Embedding dimensions:', embedding.length); // 384

// Generate batch embeddings
const embeddings = await provider.generateBatch([
  'First document',
  'Second document',
  'Third document'
]);
console.log('Batch size:', embeddings.length); // 3
```

## Model and Dimension Support

```javascript
import { isValidModelDimensionCombo, getRecommendedConfig } from 'localretrieve';

// Check if model supports specific dimensions
console.log(isValidModelDimensionCombo('text-embedding-3-small', 384));  // true
console.log(isValidModelDimensionCombo('text-embedding-3-small', 2048)); // false

// Get recommended configuration
const recommended = getRecommendedConfig({
  dimensions: 768,
  budget: 'low',
  performance: 'fast'
});
console.log(recommended);
// {
//   model: 'text-embedding-3-small',
//   dimensions: 384,
//   description: 'Cost-effective option with good performance for most use cases'
// }
```

## Error Handling

```javascript
import {
  createOpenAIProvider,
  AuthenticationError,
  QuotaExceededError,
  NetworkError
} from 'localretrieve';

const provider = createOpenAIProvider(384);

try {
  await provider.initialize({
    defaultProvider: 'openai',
    defaultDimensions: 384,
    apiKey: 'invalid-key'
  });
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.error('Invalid API key:', error.message);
  } else if (error instanceof QuotaExceededError) {
    console.error('Quota exceeded, retry after:', error.resetTime);
  } else if (error instanceof NetworkError) {
    console.error('Network error:', error.message);
  }
}
```

## Metrics and Health Monitoring

```javascript
// Check provider health
const health = await provider.healthCheck();
console.log('Provider health:', health);
// {
//   isHealthy: true,
//   status: 'ready',
//   connectionStatus: 'connected',
//   details: 'Provider is healthy'
// }

// Get performance metrics
const metrics = provider.getMetrics();
console.log('Metrics:', metrics);
// {
//   totalEmbeddings: 10,
//   averageGenerationTime: 250,
//   errorCount: 0,
//   apiRequestCount: 5,
//   rateLimitStatus: {
//     remaining: 55,
//     resetTime: new Date(...)
//   }
// }
```

## Advanced Configuration

```javascript
import { createOpenAIProvider } from 'localretrieve';

const provider = createOpenAIProvider(1536, 'text-embedding-3-small');

await provider.initialize({
  defaultProvider: 'openai',
  defaultDimensions: 1536,
  apiKey: 'sk-your-api-key',
  timeout: 60000,          // 60 second timeout
  maxRetries: 5,           // Retry up to 5 times
  providerOptions: {
    baseUrl: 'https://api.openai.com/v1',  // Custom API endpoint
    enableRateLimit: true,                  // Enable rate limiting
    requestsPerMinute: 60,                  // Custom rate limit
    headers: {
      'OpenAI-Organization': 'org-xxx',     // Organization ID
      'OpenAI-User': 'user-123'             // User ID for tracking
    }
  }
});
```

## Supported Models and Dimensions

| Model | Default Dimensions | Supported Dimensions | Cost per 1M tokens |
|-------|-------------------|---------------------|-------------------|
| text-embedding-3-small | 1536 | 384, 768, 1536 | $0.02 |
| text-embedding-3-large | 3072 | 256, 512, 1024, 3072 | $0.13 |
| text-embedding-ada-002 | 1536 | 1536 | $0.10 |

## Integration with LocalRetrieve Collections

```javascript
import { createEmbeddingProvider } from 'localretrieve';

// Create provider using collection configuration
const config = {
  provider: 'openai',
  model: 'text-embedding-3-small',
  dimensions: 384,
  apiKey: 'sk-your-api-key',
  batchSize: 50,
  cacheEnabled: true,
  autoGenerate: true
};

const provider = await createEmbeddingProvider(config);
```

## Performance Considerations

- **Batch Size**: OpenAI supports up to 100 texts per request, but smaller batches (10-50) may be more reliable
- **Rate Limiting**: Built-in rate limiting prevents hitting API limits
- **Caching**: Enable caching to avoid regenerating embeddings for the same text
- **Retry Logic**: Automatic retry with exponential backoff for transient failures
- **Timeouts**: Configure appropriate timeouts based on your application needs

## Security Notes

- API keys are stored only in memory and never persisted
- Use environment variables or secure configuration management for API keys
- Consider using OpenAI organization IDs for better access control
- Monitor usage through OpenAI dashboard to track costs and usage patterns