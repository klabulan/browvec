# Provider Factory Usage Guide

The Provider Factory provides a unified interface for creating and managing embedding providers in LocalRetrieve. It handles provider instantiation, configuration validation, and provides recommendations for optimal configurations.

## Basic Usage

### Creating Providers

```typescript
import { createProvider, validateProviderConfig } from 'localretrieve/embedding';

// Transformers.js (Local) Provider
const localConfig = {
  provider: 'transformers' as const,
  dimensions: 384,
  batchSize: 16,
  cacheEnabled: true,
  autoGenerate: true
};

// Validate configuration first
const validation = validateProviderConfig(localConfig);
if (!validation.isValid) {
  console.error('Configuration errors:', validation.errors);
  console.log('Suggestions:', validation.suggestions);
}

// Create the provider
const localProvider = await createProvider(localConfig);

// OpenAI Provider
const openaiConfig = {
  provider: 'openai' as const,
  model: 'text-embedding-3-small',
  dimensions: 768,
  apiKey: 'sk-your-api-key-here',
  batchSize: 50,
  timeout: 30000
};

const openaiProvider = await createProvider(openaiConfig);
```

### Getting Provider Information

```typescript
import {
  getAvailableProviders,
  getAvailableModels,
  checkProviderSupport
} from 'localretrieve/embedding';

// Get all available providers
const providers = getAvailableProviders();
console.log('Available providers:', providers);

// Get all available models
const models = await getAvailableModels();
console.log('Available models:', models);

// Check if a specific provider is supported
const transformersSupport = checkProviderSupport('transformers');
if (!transformersSupport.isSupported) {
  console.log('Transformers.js not supported:', transformersSupport.unsupportedReason);
  console.log('Try these alternatives:', transformersSupport.alternatives);
}
```

### Getting Recommendations

```typescript
import { getProviderRecommendations } from 'localretrieve/embedding';

// Get recommendations based on requirements
const recommendations = getProviderRecommendations({
  dimensions: 384,
  budget: 'low',
  performance: 'balanced',
  privacy: 'local'
});

console.log('Recommended configuration:', recommendations[0]);
// Output: { provider: 'transformers', dimensions: 384, reason: '...', priority: 10 }

// For cloud-based high accuracy
const cloudRecs = getProviderRecommendations({
  dimensions: 1024,
  budget: 'high',
  performance: 'accurate',
  privacy: 'cloud'
});

console.log('Cloud recommendations:', cloudRecs);
```

## Advanced Usage

### Custom Factory Instance

```typescript
import { EmbeddingProviderFactoryImpl } from 'localretrieve/embedding';

// Create your own factory instance
const customFactory = new EmbeddingProviderFactoryImpl();

// Check provider support
const support = customFactory.checkProviderSupport('openai');

// Validate complex configurations
const validation = customFactory.validateConfiguration({
  provider: 'openai',
  model: 'text-embedding-3-large',
  dimensions: 2048, // Invalid - will catch this
  apiKey: 'invalid-key' // Invalid format - will catch this
});

if (!validation.isValid) {
  console.error('Validation failed:', validation.errors);
  // Output: ['Model text-embedding-3-large does not support 2048 dimensions', ...]
}
```

### Error Handling

```typescript
import {
  createProvider,
  ConfigurationError,
  ProviderInitializationError
} from 'localretrieve/embedding';

try {
  const provider = await createProvider({
    provider: 'openai',
    dimensions: 384,
    apiKey: 'invalid-key'
  });
} catch (error) {
  if (error instanceof ConfigurationError) {
    console.error('Configuration issue:', error.message);
    console.log('Parameter:', error.parameterName);
    console.log('Expected:', error.expectedValue);
  } else if (error instanceof ProviderInitializationError) {
    console.error('Provider initialization failed:', error.message);
    console.log('Provider:', error.providerName);
    console.log('Suggested actions:', error.recoveryInfo?.suggestedActions);
  }
}
```

## Configuration Validation

The Provider Factory provides comprehensive validation:

### Transformers.js Validation

- ✅ Dimensions must be exactly 384
- ✅ No API key required
- ✅ Checks browser support for Web Workers and SharedArrayBuffer
- ✅ Validates batch size limits

### OpenAI Validation

- ✅ API key format validation (must start with "sk-")
- ✅ Model and dimension compatibility checks
- ✅ Batch size recommendations
- ✅ Timeout configuration validation

## Provider Support Checking

```typescript
import { checkProviderSupport } from 'localretrieve/embedding';

// Check Transformers.js support
const transformersSupport = checkProviderSupport('transformers');
if (!transformersSupport.isSupported) {
  console.log('Requirements not met:', transformersSupport.requirements);
  // Requirements: ['Web Workers support', 'SharedArrayBuffer support', ...]
}

// Check OpenAI support (always supported if fetch is available)
const openaiSupport = checkProviderSupport('openai');
console.log('OpenAI supported:', openaiSupport.isSupported);
```

## Model Information

```typescript
import { getAvailableModels } from 'localretrieve/embedding';

const models = await getAvailableModels();

models.forEach(model => {
  console.log(`Model: ${model.name}`);
  console.log(`Dimensions: ${model.dimensions}`);
  console.log(`Max input: ${model.maxInputLength} tokens`);
  console.log(`Languages: ${model.languages.join(', ')}`);
  console.log(`Use cases: ${model.useCases.join(', ')}`);
  console.log('---');
});
```

## Provider Selection Guidelines

### Choose Transformers.js when:
- Privacy is critical (local processing)
- No API costs desired
- Offline functionality required
- 384 dimensions are sufficient
- Development/prototyping

### Choose OpenAI when:
- High accuracy needed
- Multiple languages required
- Flexible dimensions needed (256-3072)
- Production applications
- Don't mind API costs

## Error Recovery

The Provider Factory includes built-in error recovery information:

```typescript
import { ErrorUtils } from 'localretrieve/embedding';

try {
  const provider = await createProvider(config);
} catch (error) {
  if (ErrorUtils.canRetry(error)) {
    const delay = ErrorUtils.getRetryDelay(error);
    const maxRetries = ErrorUtils.getMaxRetries(error);

    console.log(`Can retry after ${delay}ms, max ${maxRetries} times`);

    // Implement retry logic
    setTimeout(async () => {
      try {
        const provider = await createProvider(config);
        // Success
      } catch (retryError) {
        console.error('Retry failed:', retryError);
      }
    }, delay);
  } else {
    const suggestions = ErrorUtils.getSuggestedActions(error);
    console.log('Manual intervention required:', suggestions);
  }
}
```