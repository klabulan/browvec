import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Real API Integration Tests for SCRUM-17 LLM Integration
 *
 * These tests make actual API calls to LLM providers using real API keys.
 *
 * Prerequisites:
 * 1. Add your API keys to .llm-api-keys.json
 * 2. Ensure you have sufficient API credits
 * 3. Be aware of API usage costs
 *
 * Note: These tests are slower and cost money to run!
 */

// Helper function to initialize database and wait for worker
const initDbHelper = `
  async function initDatabase(dbPath) {
    // @ts-ignore
    const db = new LocalRetrieve.Database(dbPath);
    await db._initialize();

    // Wait for worker to be fully ready
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify worker is ready
    if (!db.workerRPC) {
      throw new Error('WorkerRPC not available after initialization');
    }

    return db;
  }
`;

// Load API keys from configuration file
let apiKeys: any;
try {
  const keysPath = resolve(__dirname, '../../.llm-api-keys.json');
  const keysContent = readFileSync(keysPath, 'utf-8');
  apiKeys = JSON.parse(keysContent);
} catch (error) {
  console.error('Failed to load API keys:', error);
  apiKeys = {};
}

// Check which providers are configured
const hasOpenAI = apiKeys.openai?.apiKey && apiKeys.openai.apiKey.length > 0;
const hasAnthropic = apiKeys.anthropic?.apiKey && apiKeys.anthropic.apiKey.length > 0;
const hasOpenRouter = apiKeys.openrouter?.apiKey && apiKeys.openrouter.apiKey.length > 0;

// Skip all tests if no API keys configured
test.describe.configure({ mode: 'serial' }); // Run tests serially to avoid rate limits

test.describe('LLM Real API Integration - OpenAI', () => {
  test.skip(!hasOpenAI, 'OpenAI API key not configured');

  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/web-client/index.html');
    await page.waitForFunction(() => {
      return typeof window.LocalRetrieve !== 'undefined';
    }, { timeout: 30000 });
  });

  test('should enhance query with OpenAI GPT-4', async ({ page }) => {
    const result = await page.evaluate(async (keys) => {
      try {
        // @ts-ignore
        const db = new LocalRetrieve.Database('opfs:/test-real-openai-enhance.db');
        await db._initialize();

        // Wait a bit for worker to be fully ready
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Check if worker is ready
        if (!db.workerRPC) {
          throw new Error('WorkerRPC not available after initialization');
        }

        const enhanced = await db.enhanceQuery('search docs', {
          provider: 'openai',
          model: keys.model,
          apiKey: keys.apiKey,
          timeout: 30000
        });

        await db.close();

        return {
          success: true,
          enhanced,
          originalQuery: enhanced.originalQuery,
          enhancedQuery: enhanced.enhancedQuery,
          hasEnhancedQuery: !!enhanced.enhancedQuery,
          hasSuggestions: Array.isArray(enhanced.suggestions) && enhanced.suggestions.length > 0,
          hasConfidence: typeof enhanced.confidence === 'number',
          processingTime: enhanced.processingTime
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          stack: error.stack
        };
      }
    }, apiKeys.openai);

    console.log('OpenAI Enhancement Result:', result);

    expect(result.success).toBe(true);
    expect(result.hasEnhancedQuery).toBe(true);
    expect(result.hasSuggestions).toBe(true);
    expect(result.hasConfidence).toBe(true);
    expect(result.processingTime).toBeGreaterThan(0);
  });

  test('should summarize results with OpenAI GPT-4', async ({ page }) => {
    const result = await page.evaluate(async (keys) => {
      try {
        // @ts-ignore
        const db = new LocalRetrieve.Database('opfs:/test-real-openai-summary.db');
        await db._initialize();
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (!db.workerRPC) {
          throw new Error('WorkerRPC not available');
        }

        await db.initializeSchema();

        // Insert test documents
        await db.exec(`
          INSERT INTO docs_default (id, title, content) VALUES
          ('1', 'JavaScript Basics', 'JavaScript is a programming language used for web development'),
          ('2', 'TypeScript Guide', 'TypeScript adds static typing to JavaScript'),
          ('3', 'React Tutorial', 'React is a JavaScript library for building user interfaces')
        `);

        // Search for documents
        const searchResults = await db.searchText({ text: 'javascript' });

        // Summarize results
        const summary = await db.summarizeResults(searchResults.results, {
          provider: 'openai',
          model: keys.model,
          apiKey: keys.apiKey,
          timeout: 30000
        });

        await db.close();

        return {
          success: true,
          summary,
          hasSummary: !!summary.summary && summary.summary.length > 0,
          hasKeyPoints: Array.isArray(summary.keyPoints) && summary.keyPoints.length > 0,
          hasThemes: Array.isArray(summary.themes),
          processingTime: summary.processingTime
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    }, apiKeys.openai);

    console.log('OpenAI Summary Result:', result);

    expect(result.success).toBe(true);
    expect(result.hasSummary).toBe(true);
    expect(result.hasKeyPoints).toBe(true);
    expect(result.processingTime).toBeGreaterThan(0);
  });

  test('should perform combined search with OpenAI', async ({ page }) => {
    const result = await page.evaluate(async (keys) => {
      try {
        // @ts-ignore
        const db = new LocalRetrieve.Database('opfs:/test-real-openai-combined.db');
        await db._initialize();
        await db.initializeSchema();

        // Insert test documents
        await db.exec(`
          INSERT INTO docs_default (id, title, content) VALUES
          ('1', 'AI Overview', 'Artificial intelligence is transforming technology'),
          ('2', 'Machine Learning', 'ML is a subset of AI that learns from data'),
          ('3', 'Deep Learning', 'Deep learning uses neural networks')
        `);

        // Combined search
        const smartSearch = await db.searchWithLLM('AI technology', {
          enhanceQuery: true,
          summarizeResults: true,
          searchOptions: { limit: 10 },
          llmOptions: {
            provider: 'openai',
            model: keys.model,
            apiKey: keys.apiKey,
            timeout: 30000
          }
        });

        await db.close();

        return {
          success: true,
          hasEnhancedQuery: !!smartSearch.enhancedQuery,
          hasResults: Array.isArray(smartSearch.results) && smartSearch.results.length > 0,
          hasSummary: !!smartSearch.summary,
          hasTimings: typeof smartSearch.searchTime === 'number' && typeof smartSearch.llmTime === 'number',
          searchTime: smartSearch.searchTime,
          llmTime: smartSearch.llmTime,
          totalTime: smartSearch.totalTime
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    }, apiKeys.openai);

    console.log('OpenAI Combined Search Result:', result);

    expect(result.success).toBe(true);
    expect(result.hasEnhancedQuery).toBe(true);
    expect(result.hasResults).toBe(true);
    expect(result.hasSummary).toBe(true);
    expect(result.hasTimings).toBe(true);
  });
});

test.describe('LLM Real API Integration - OpenRouter', () => {
  test.skip(!hasOpenRouter, 'OpenRouter API key not configured');

  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/web-client/index.html');
    await page.waitForFunction(() => {
      return typeof window.LocalRetrieve !== 'undefined';
    }, { timeout: 30000 });
  });

  test('should enhance query with OpenRouter', async ({ page }) => {
    const result = await page.evaluate(async (keys) => {
      try {
        // @ts-ignore
        const db = new LocalRetrieve.Database('opfs:/test-real-openrouter-enhance.db');
        await db._initialize();

        const enhanced = await db.enhanceQuery('find ML tutorials', {
          provider: 'openrouter',
          model: keys.model,
          apiKey: keys.apiKey,
          endpoint: keys.endpoint,
          timeout: 30000
        });

        await db.close();

        return {
          success: true,
          enhanced,
          originalQuery: enhanced.originalQuery,
          enhancedQuery: enhanced.enhancedQuery,
          suggestionsCount: enhanced.suggestions?.length || 0,
          confidence: enhanced.confidence,
          processingTime: enhanced.processingTime
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          stack: error.stack
        };
      }
    }, apiKeys.openrouter);

    console.log('OpenRouter Enhancement Result:', result);

    expect(result.success).toBe(true);
    expect(result.enhancedQuery).toBeTruthy();
    expect(result.processingTime).toBeGreaterThan(0);
  });

  test('should summarize results with OpenRouter', async ({ page }) => {
    const result = await page.evaluate(async (keys) => {
      try {
        // @ts-ignore
        const db = new LocalRetrieve.Database('opfs:/test-real-openrouter-summary.db');
        await db._initialize();
        await db.initializeSchema();

        // Insert test documents
        await db.exec(`
          INSERT INTO docs_default (id, title, content) VALUES
          ('1', 'Python Basics', 'Python is a versatile programming language'),
          ('2', 'Data Science', 'Data science uses Python for analysis'),
          ('3', 'Machine Learning', 'ML frameworks in Python include TensorFlow')
        `);

        const searchResults = await db.searchText({ text: 'python' });

        const summary = await db.summarizeResults(searchResults.results, {
          provider: 'openrouter',
          model: keys.model,
          apiKey: keys.apiKey,
          endpoint: keys.endpoint,
          timeout: 30000
        });

        await db.close();

        return {
          success: true,
          summary: summary.summary,
          keyPointsCount: summary.keyPoints?.length || 0,
          themesCount: summary.themes?.length || 0,
          confidence: summary.confidence,
          processingTime: summary.processingTime
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          stack: error.stack
        };
      }
    }, apiKeys.openrouter);

    console.log('OpenRouter Summary Result:', result);

    expect(result.success).toBe(true);
    expect(result.summary).toBeTruthy();
    expect(result.keyPointsCount).toBeGreaterThan(0);
    expect(result.processingTime).toBeGreaterThan(0);
  });
});

test.describe('LLM Real API Integration - Anthropic', () => {
  test.skip(!hasAnthropic, 'Anthropic API key not configured');

  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/web-client/index.html');
    await page.waitForFunction(() => {
      return typeof window.LocalRetrieve !== 'undefined';
    }, { timeout: 30000 });
  });

  test('should enhance query with Anthropic Claude', async ({ page }) => {
    const result = await page.evaluate(async (keys) => {
      try {
        // @ts-ignore
        const db = new LocalRetrieve.Database('opfs:/test-real-anthropic-enhance.db');
        await db._initialize();

        const enhanced = await db.enhanceQuery('database optimization', {
          provider: 'anthropic',
          model: keys.model,
          apiKey: keys.apiKey,
          timeout: 30000
        });

        await db.close();

        return {
          success: true,
          enhanced,
          hasEnhancedQuery: !!enhanced.enhancedQuery,
          hasSuggestions: Array.isArray(enhanced.suggestions) && enhanced.suggestions.length > 0,
          processingTime: enhanced.processingTime
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    }, apiKeys.anthropic);

    console.log('Anthropic Enhancement Result:', result);

    expect(result.success).toBe(true);
    expect(result.hasEnhancedQuery).toBe(true);
    expect(result.processingTime).toBeGreaterThan(0);
  });
});

test.describe('LLM Real API Integration - Performance', () => {
  test.skip(!hasOpenAI && !hasOpenRouter, 'No API keys configured for performance testing');

  const provider = hasOpenAI ? 'openai' : 'openrouter';
  const keys = hasOpenAI ? apiKeys.openai : apiKeys.openrouter;

  test('should complete query enhancement within reasonable time', async ({ page }) => {
    await page.goto('/examples/web-client/index.html');
    await page.waitForFunction(() => {
      return typeof window.LocalRetrieve !== 'undefined';
    }, { timeout: 30000 });

    const result = await page.evaluate(async (config) => {
      try {
        // @ts-ignore
        const db = new LocalRetrieve.Database('opfs:/test-real-performance.db');
        await db._initialize();

        const startTime = performance.now();

        const enhanced = await db.enhanceQuery('test query', {
          provider: config.provider,
          model: config.keys.model,
          apiKey: config.keys.apiKey,
          endpoint: config.keys.endpoint,
          timeout: 15000
        });

        const endTime = performance.now();
        const totalTime = endTime - startTime;

        await db.close();

        return {
          success: true,
          totalTime,
          processingTime: enhanced.processingTime,
          overhead: totalTime - enhanced.processingTime
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    }, { provider, keys });

    console.log('Performance Test Result:', result);

    expect(result.success).toBe(true);
    expect(result.totalTime).toBeLessThan(15000); // Should complete within 15 seconds
    expect(result.processingTime).toBeGreaterThan(0);
  });
});

test.describe('LLM Real API Integration - Error Handling', () => {
  test.skip(!hasOpenAI && !hasOpenRouter, 'No API keys configured');

  const provider = hasOpenAI ? 'openai' : 'openrouter';
  const keys = hasOpenAI ? apiKeys.openai : apiKeys.openrouter;

  test('should handle invalid model gracefully', async ({ page }) => {
    await page.goto('/examples/web-client/index.html');
    await page.waitForFunction(() => {
      return typeof window.LocalRetrieve !== 'undefined';
    }, { timeout: 30000 });

    const result = await page.evaluate(async (config) => {
      try {
        // @ts-ignore
        const db = new LocalRetrieve.Database('opfs:/test-real-error.db');
        await db._initialize();

        try {
          await db.enhanceQuery('test', {
            provider: config.provider,
            model: 'invalid-model-name-12345',
            apiKey: config.keys.apiKey,
            endpoint: config.keys.endpoint,
            timeout: 10000
          });

          await db.close();
          return { success: false, error: 'Should have thrown error' };
        } catch (error) {
          await db.close();
          return {
            success: true,
            errorCaught: true,
            errorMessage: error.message,
            hasErrorMessage: error.message.length > 0
          };
        }
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    }, { provider, keys });

    console.log('Error Handling Result:', result);

    expect(result.success).toBe(true);
    expect(result.errorCaught).toBe(true);
    expect(result.hasErrorMessage).toBe(true);
  });
});

// Summary test to log configuration
test('API Configuration Summary', async () => {
  console.log('\n=== API Configuration Status ===');
  console.log('OpenAI:', hasOpenAI ? '✅ Configured' : '❌ Not configured');
  console.log('Anthropic:', hasAnthropic ? '✅ Configured' : '❌ Not configured');
  console.log('OpenRouter:', hasOpenRouter ? '✅ Configured' : '❌ Not configured');
  console.log('================================\n');

  expect(hasOpenAI || hasAnthropic || hasOpenRouter).toBe(true);
});
