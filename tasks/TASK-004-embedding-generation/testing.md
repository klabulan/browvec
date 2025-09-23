# TASK-004: Embedding Generation Support - Testing Strategy

## Testing Overview

### Testing Philosophy
- **Test-Driven Development**: Write tests before implementation where possible
- **Browser-Native Testing**: Comprehensive testing across target browsers
- **Performance-Driven**: All tests include performance assertions
- **Realistic Data**: Use production-like data and scenarios

### Test Pyramid Strategy
```
                   /\
                  /  \
                 / E2E \      <- Demo workflows, cross-browser
                /      \
               /--------\
              /Integration\ <- Provider integration, RPC, DB
             /            \
            /--------------\
           /   Unit Tests   \  <- Individual classes, utilities
          /                  \
         /--------------------\
```

## Test Categories and Scope

### Unit Tests (Foundation Layer)

#### Test Suite 1: Embedding Provider Interface
**File**: `src/embedding/providers/__tests__/BaseProvider.test.ts`
**Coverage Target**: 100%

**Test Cases**:
```typescript
describe('BaseEmbeddingProvider', () => {
  describe('initialization', () => {
    it('should initialize with valid configuration');
    it('should reject invalid configuration');
    it('should handle missing required config fields');
    it('should set default values correctly');
  });

  describe('error handling', () => {
    it('should throw EmbeddingError for invalid text input');
    it('should handle null/undefined text gracefully');
    it('should validate text length limits');
    it('should handle special characters correctly');
  });

  describe('cleanup', () => {
    it('should cleanup resources on dispose');
    it('should prevent operations after disposal');
  });
});
```

#### Test Suite 2: Text Processing
**File**: `src/embedding/TextProcessor.test.ts`
**Coverage Target**: 100%

**Test Cases**:
```typescript
describe('TextProcessor', () => {
  describe('text preprocessing', () => {
    it('should remove HTML tags correctly');
    it('should normalize whitespace');
    it('should handle markdown formatting');
    it('should truncate to model limits');
    it('should preserve semantic meaning');
  });

  describe('hash generation', () => {
    it('should generate consistent hashes for same text');
    it('should generate different hashes for different text');
    it('should handle special characters in hashing');
  });

  describe('edge cases', () => {
    it('should handle empty strings');
    it('should handle very long texts');
    it('should handle non-ASCII characters');
  });
});
```

#### Test Suite 3: Cache Management
**File**: `src/embedding/cache/__tests__/CacheManager.test.ts`
**Coverage Target**: 95%

**Test Cases**:
```typescript
describe('CacheManager', () => {
  describe('memory cache', () => {
    it('should store and retrieve embeddings');
    it('should implement LRU eviction correctly');
    it('should respect size limits');
    it('should handle cache hits and misses');
  });

  describe('IndexedDB cache', () => {
    it('should persist embeddings across sessions');
    it('should handle IndexedDB unavailability');
    it('should cleanup expired entries');
  });

  describe('cache metrics', () => {
    it('should track hit/miss ratios');
    it('should measure cache performance');
  });
});
```

### Integration Tests (Provider Integration)

#### Test Suite 4: Local Provider Integration
**File**: `src/embedding/providers/__tests__/TransformersProvider.integration.test.ts`
**Coverage Target**: 90%

**Test Cases**:
```typescript
describe('TransformersProvider Integration', () => {
  beforeAll(async () => {
    // Setup test environment with WASM support
  });

  describe('model loading', () => {
    it('should load model successfully in Web Worker', { timeout: 30000 });
    it('should handle model loading failures gracefully');
    it('should cache loaded models appropriately');
  });

  describe('embedding generation', () => {
    it('should generate 384-dimensional embeddings');
    it('should produce consistent embeddings for same text');
    it('should handle batch processing correctly');
    it('should respect memory limits');

    // Performance tests
    it('should generate embeddings within time limits', {
      timeout: 1000,
      assertion: 'embedding generation < 500ms'
    });
  });

  describe('error scenarios', () => {
    it('should handle worker crashes gracefully');
    it('should recover from memory errors');
    it('should handle malformed text input');
  });
});
```

#### Test Suite 5: External Provider Integration
**File**: `src/embedding/providers/__tests__/ExternalProviders.integration.test.ts`
**Coverage Target**: 85%

**Test Cases**:
```typescript
describe('External Providers Integration', () => {
  describe('OpenAI Provider', () => {
    beforeEach(() => {
      // Mock API responses
      setupAPIResponseMocks();
    });

    it('should authenticate successfully with valid API key');
    it('should handle invalid API key gracefully');
    it('should implement rate limiting correctly');
    it('should retry failed requests with exponential backoff');
    it('should batch requests efficiently');

    // Network simulation tests
    it('should handle network timeouts');
    it('should handle API rate limit responses');
    it('should handle malformed API responses');
  });

  describe('Cohere Provider', () => {
    // Similar test structure for Cohere
  });

  describe('provider switching', () => {
    it('should fallback to secondary provider on primary failure');
    it('should maintain consistency when switching providers');
  });
});
```

#### Test Suite 6: Database Integration
**File**: `src/database/__tests__/EmbeddingIntegration.test.ts`
**Coverage Target**: 95%

**Test Cases**:
```typescript
describe('Database Embedding Integration', () => {
  describe('document insertion with embeddings', () => {
    it('should insert document and generate embeddings automatically');
    it('should handle manual embedding override');
    it('should update embedding metadata correctly');
    it('should maintain backward compatibility with existing API');
  });

  describe('semantic search', () => {
    it('should perform semantic search with generated query embeddings');
    it('should combine semantic and text search in hybrid mode');
    it('should rank results by similarity correctly');
    it('should handle empty search results');
  });

  describe('batch operations', () => {
    it('should process batch insertions with progress reporting');
    it('should handle partial failures in batch operations');
    it('should maintain transaction consistency');
  });

  describe('schema migration', () => {
    it('should migrate existing databases to support embeddings');
    it('should preserve existing data during migration');
    it('should handle schema version conflicts');
  });
});
```

### Performance Tests

#### Test Suite 7: Performance Benchmarks
**File**: `src/__tests__/performance/EmbeddingPerformance.test.ts`
**Coverage Target**: N/A (performance focused)

**Benchmark Tests**:
```typescript
describe('Embedding Performance Benchmarks', () => {
  describe('local provider performance', () => {
    it('should generate single embedding < 500ms', async () => {
      const startTime = performance.now();
      await provider.generateEmbedding(sampleText);
      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(500);
    });

    it('should process batch of 10 documents < 3s');
    it('should maintain performance under memory pressure');
    it('should show linear scaling with batch size');
  });

  describe('cache performance', () => {
    it('should retrieve cached embeddings < 5ms');
    it('should maintain performance with large cache sizes');
  });

  describe('memory usage', () => {
    it('should use < 100MB for local model');
    it('should cleanup memory properly after operations');
    it('should handle garbage collection correctly');
  });
});
```

### Browser Compatibility Tests

#### Test Suite 8: Cross-Browser Testing
**File**: `src/__tests__/browser/BrowserCompatibility.test.ts`
**Coverage Target**: 80%

**Browser Test Matrix**:
- Chrome 86+ (Windows, macOS, Linux)
- Firefox 79+ (Windows, macOS, Linux)
- Safari 15+ (macOS, iOS)
- Edge 86+ (Windows)

**Test Cases**:
```typescript
describe('Browser Compatibility', () => {
  describe('Web Worker support', () => {
    it('should create embedding workers successfully');
    it('should handle SharedArrayBuffer availability');
    it('should fallback gracefully when workers unavailable');
  });

  describe('WASM support', () => {
    it('should load Transformers.js WASM modules');
    it('should handle different WASM implementations');
  });

  describe('storage support', () => {
    it('should use IndexedDB for cache when available');
    it('should fallback to memory cache when IndexedDB unavailable');
    it('should handle storage quota exceeded errors');
  });

  describe('API support', () => {
    it('should make external API requests with proper CORS');
    it('should handle different browser security policies');
  });
});
```

### End-to-End Tests

#### Test Suite 9: Demo Application E2E
**File**: `examples/web-client/__tests__/demo.e2e.test.ts`
**Coverage Target**: 100% user workflows

**User Journey Tests**:
```typescript
describe('Demo Application E2E', () => {
  describe('embedding provider selection', () => {
    it('should allow user to select local provider');
    it('should allow user to configure external provider');
    it('should show provider status and readiness');
  });

  describe('document indexing workflow', () => {
    it('should index documents with automatic embedding generation');
    it('should show embedding generation progress');
    it('should handle embedding generation failures gracefully');
    it('should display updated document count and metrics');
  });

  describe('search workflow', () => {
    it('should perform semantic search with text query');
    it('should show both text and semantic search results');
    it('should highlight relevant matches in results');
    it('should display search performance metrics');
  });

  describe('error handling workflow', () => {
    it('should display meaningful errors for API key issues');
    it('should handle network failures gracefully');
    it('should provide recovery suggestions for common errors');
  });
});
```

## Test Data and Fixtures

### Sample Documents
```typescript
// Test data with known semantic relationships
export const testDocuments = [
  {
    title: 'Machine Learning Basics',
    content: 'Machine learning is a subset of artificial intelligence...',
    expectedSimilarTerms: ['AI', 'neural networks', 'algorithms']
  },
  {
    title: 'Web Development Guide',
    content: 'Modern web development involves HTML, CSS, and JavaScript...',
    expectedSimilarTerms: ['frontend', 'backend', 'programming']
  },
  // Additional documents covering different domains
];

// Test embeddings for known similar/dissimilar content
export const referenceEmbeddings = {
  'machine learning': new Float32Array([/* known embedding */]),
  'artificial intelligence': new Float32Array([/* similar embedding */]),
  'cooking recipes': new Float32Array([/* dissimilar embedding */])
};
```

### Mock API Responses
```typescript
// Mock responses for external API testing
export const mockAPIResponses = {
  openai: {
    success: {
      data: [{ embedding: [/* 384-dim array */] }],
      usage: { total_tokens: 10 }
    },
    rateLimited: {
      error: { code: 'rate_limit_exceeded', message: 'Rate limit exceeded' }
    },
    authError: {
      error: { code: 'invalid_api_key', message: 'Invalid API key' }
    }
  }
};
```

## Test Environment Setup

### Development Environment
```bash
# Install test dependencies
npm install --save-dev \
  @jest/globals \
  @testing-library/dom \
  @testing-library/user-event \
  jsdom \
  puppeteer \
  mock-server

# Setup test environment
npm run test:setup
```

### CI/CD Environment
```yaml
# GitHub Actions test configuration
name: Embedding Tests
on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Run unit tests
        run: npm run test:unit

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - name: Run integration tests
        run: npm run test:integration
        env:
          TEST_OPENAI_API_KEY: ${{ secrets.TEST_OPENAI_API_KEY }}

  browser-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        browser: [chrome, firefox]
    steps:
      - name: Run browser tests
        run: npm run test:browser:${{ matrix.browser }}
```

## Test Utilities and Helpers

### Embedding Test Utilities
```typescript
// Utility functions for embedding tests
export class EmbeddingTestUtils {
  static async createTestProvider(type: 'local' | 'external'): Promise<EmbeddingProvider> {
    // Create configured test provider
  }

  static assertEmbeddingDimensions(embedding: Float32Array, expectedDim: number = 384) {
    expect(embedding.length).toBe(expectedDim);
    expect(Array.from(embedding).every(x => typeof x === 'number')).toBe(true);
  }

  static calculateCosineSimilarity(a: Float32Array, b: Float32Array): number {
    // Implementation for similarity testing
  }

  static async waitForEmbeddingGeneration(promise: Promise<any>, timeoutMs: number = 5000) {
    // Helper for testing async embedding generation
  }
}
```

### Mock Provider
```typescript
// Mock provider for testing without external dependencies
export class MockEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'mock';
  readonly dimensions = 384;
  readonly maxBatchSize = 100;

  async initialize(): Promise<void> {
    // Mock initialization
  }

  async generateEmbedding(text: string): Promise<Float32Array> {
    // Generate deterministic mock embeddings based on text
    return new Float32Array(384).fill(0.1);
  }

  async generateBatch(texts: string[]): Promise<Float32Array[]> {
    return texts.map(text => this.generateEmbedding(text));
  }

  async cleanup(): Promise<void> {
    // Mock cleanup
  }
}
```

## Test Execution and Reporting

### Test Commands
```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit              # Unit tests only
npm run test:integration       # Integration tests only
npm run test:performance       # Performance benchmarks
npm run test:browser           # Cross-browser tests
npm run test:e2e              # End-to-end demo tests

# Run with coverage
npm run test:coverage

# Run in watch mode for development
npm run test:watch

# Run specific test files
npm test -- --testNamePattern="TransformersProvider"
```

### Coverage Requirements
- **Unit Tests**: >90% line coverage, >85% branch coverage
- **Integration Tests**: >80% coverage for integration paths
- **E2E Tests**: 100% critical user workflows covered

### Test Reporting
```typescript
// Jest configuration for detailed reporting
module.exports = {
  collectCoverageFrom: [
    'src/embedding/**/*.ts',
    '!src/embedding/**/*.test.ts',
    '!src/embedding/**/__tests__/**'
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    }
  }
};
```

## Quality Gates and Validation

### Pre-Commit Checks
- All unit tests must pass
- Code coverage thresholds met
- TypeScript compilation successful
- Linting rules satisfied

### Pre-Merge Checks
- All test suites pass (unit, integration, browser)
- Performance benchmarks within limits
- E2E tests pass in demo environment
- Security review completed for API handling

### Release Validation
- Full browser compatibility matrix tested
- Performance regression testing completed
- Demo application fully functional
- Documentation tests pass

## Continuous Testing Strategy

### Automated Testing Schedule
- **On every commit**: Unit tests, basic integration tests
- **On pull requests**: Full test suite including browser tests
- **Nightly builds**: Performance regression testing
- **Weekly**: Comprehensive browser compatibility testing

### Performance Regression Detection
- Automated benchmarks run on every build
- Performance alerts for >10% degradation
- Historical performance trending
- Memory usage monitoring

### Flaky Test Management
- Automatic retry for flaky tests (max 3 attempts)
- Flaky test tracking and analysis
- Regular review and fix of unstable tests
- Test environment stability monitoring