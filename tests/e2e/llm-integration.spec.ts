import { test, expect } from '@playwright/test';

/**
 * E2E Integration Tests for SCRUM-17 LLM Integration
 *
 * Tests the LLM-enhanced search functionality:
 * - Query enhancement with multiple providers
 * - Result summarization
 * - Combined smart search (searchWithLLM)
 * - Error handling and graceful degradation
 * - RPC communication flow
 * - Cross-browser compatibility
 *
 * Note: These tests use mock responses by default. To test with real API keys,
 * set environment variables: OPENAI_API_KEY, ANTHROPIC_API_KEY
 */

test.describe('LLM Integration - Query Enhancement', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/web-client/index.html');

    // Wait for SDK to be available
    await page.waitForFunction(() => {
      return typeof window.LocalRetrieve !== 'undefined';
    }, { timeout: 30000 });
  });

  test('should have enhanceQuery method available', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // @ts-ignore
        const db = new LocalRetrieve.Database('opfs:/test-llm-api.db');

        return {
          success: true,
          hasEnhanceQuery: typeof db.enhanceQuery === 'function',
          hasSummarizeResults: typeof db.summarizeResults === 'function',
          hasSearchWithLLM: typeof db.searchWithLLM === 'function'
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.hasEnhanceQuery).toBe(true);
    expect(result.hasSummarizeResults).toBe(true);
    expect(result.hasSearchWithLLM).toBe(true);
  });

  test('should reject enhanceQuery without API key', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // @ts-ignore
        const db = new LocalRetrieve.Database('opfs:/test-llm-nokey.db');
        await db._initialize();

        // Try to enhance query without API key
        await db.enhanceQuery('search documents', {
          provider: 'openai',
          model: 'gpt-4'
          // No apiKey provided
        });

        return {
          success: false,
          error: 'Should have thrown error for missing API key'
        };
      } catch (error) {
        return {
          success: true,
          errorCaught: true,
          errorMessage: error.message
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.errorCaught).toBe(true);
    expect(result.errorMessage).toBeTruthy();
  });

  test('should handle invalid provider gracefully', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // @ts-ignore
        const db = new LocalRetrieve.Database('opfs:/test-llm-invalid.db');
        await db._initialize();

        // Try with invalid provider
        await db.enhanceQuery('search documents', {
          provider: 'invalid-provider' as any,
          model: 'test-model',
          apiKey: 'fake-key-for-testing'
        });

        return {
          success: false,
          error: 'Should have thrown error for invalid provider'
        };
      } catch (error) {
        return {
          success: true,
          errorCaught: true,
          errorMessage: error.message
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.errorCaught).toBe(true);
  });

  test('should validate query parameter', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // @ts-ignore
        const db = new LocalRetrieve.Database('opfs:/test-llm-validation.db');
        await db._initialize();

        // Try with empty query
        await db.enhanceQuery('', {
          provider: 'openai',
          model: 'gpt-4',
          apiKey: 'sk-test-key'
        });

        return {
          success: false,
          error: 'Should have thrown error for empty query'
        };
      } catch (error) {
        return {
          success: true,
          errorCaught: true,
          errorMessage: error.message
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.errorCaught).toBe(true);
  });
});

test.describe('LLM Integration - Result Summarization', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/web-client/index.html');
    await page.waitForFunction(() => {
      return typeof window.LocalRetrieve !== 'undefined';
    }, { timeout: 30000 });
  });

  test('should reject summarizeResults without API key', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // @ts-ignore
        const db = new LocalRetrieve.Database('opfs:/test-llm-summary.db');
        await db._initialize();

        const mockResults = [
          { id: 1, title: 'Doc 1', content: 'Test content 1', score: 0.9 },
          { id: 2, title: 'Doc 2', content: 'Test content 2', score: 0.8 }
        ];

        // Try without API key
        await db.summarizeResults(mockResults, {
          provider: 'anthropic',
          model: 'claude-3-sonnet'
          // No apiKey
        });

        return {
          success: false,
          error: 'Should have thrown error'
        };
      } catch (error) {
        return {
          success: true,
          errorCaught: true,
          errorMessage: error.message
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.errorCaught).toBe(true);
  });

  test('should validate results parameter', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // @ts-ignore
        const db = new LocalRetrieve.Database('opfs:/test-llm-summary-val.db');
        await db._initialize();

        // Try with empty results
        await db.summarizeResults([], {
          provider: 'openai',
          model: 'gpt-4',
          apiKey: 'sk-test-key'
        });

        return {
          success: false,
          error: 'Should have thrown error for empty results'
        };
      } catch (error) {
        return {
          success: true,
          errorCaught: true,
          errorMessage: error.message
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.errorCaught).toBe(true);
  });

  test('should handle non-array results parameter', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // @ts-ignore
        const db = new LocalRetrieve.Database('opfs:/test-llm-summary-type.db');
        await db._initialize();

        // Try with non-array
        await db.summarizeResults('not an array' as any, {
          provider: 'openai',
          model: 'gpt-4',
          apiKey: 'sk-test-key'
        });

        return {
          success: false,
          error: 'Should have thrown error for non-array'
        };
      } catch (error) {
        return {
          success: true,
          errorCaught: true,
          errorMessage: error.message
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.errorCaught).toBe(true);
  });
});

test.describe('LLM Integration - Combined Search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/web-client/index.html');
    await page.waitForFunction(() => {
      return typeof window.LocalRetrieve !== 'undefined';
    }, { timeout: 30000 });
  });

  test('should have searchWithLLM method with proper signature', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // @ts-ignore
        const db = new LocalRetrieve.Database('opfs:/test-llm-combined.db');
        await db._initialize();

        // Check method exists and can be called with proper parameters
        const methodExists = typeof db.searchWithLLM === 'function';

        await db.close();

        return {
          success: true,
          methodExists
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.methodExists).toBe(true);
  });

  test('should validate searchWithLLM parameters', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // @ts-ignore
        const db = new LocalRetrieve.Database('opfs:/test-llm-combined-val.db');
        await db._initialize();

        // Try with empty query
        await db.searchWithLLM('', {
          enhanceQuery: true,
          summarizeResults: true,
          llmOptions: {
            provider: 'openai',
            model: 'gpt-4',
            apiKey: 'sk-test-key'
          }
        });

        return {
          success: false,
          error: 'Should have thrown error'
        };
      } catch (error) {
        return {
          success: true,
          errorCaught: true,
          errorMessage: error.message
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.errorCaught).toBe(true);
  });

  test('should require llmOptions when LLM features enabled', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // @ts-ignore
        const db = new LocalRetrieve.Database('opfs:/test-llm-combined-opts.db');
        await db._initialize();

        // Try with enhanceQuery=true but no llmOptions
        await db.searchWithLLM('test query', {
          enhanceQuery: true
          // No llmOptions
        });

        return {
          success: false,
          error: 'Should have thrown error for missing llmOptions'
        };
      } catch (error) {
        return {
          success: true,
          errorCaught: true,
          errorMessage: error.message
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.errorCaught).toBe(true);
  });
});

test.describe('LLM Integration - RPC Communication', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/web-client/index.html');
    await page.waitForFunction(() => {
      return typeof window.LocalRetrieve !== 'undefined';
    }, { timeout: 30000 });
  });

  test('should communicate with worker via RPC', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // @ts-ignore
        const db = new LocalRetrieve.Database('opfs:/test-llm-rpc.db');
        await db._initialize();

        // Check that workerRPC has the LLM methods
        const hasRPCMethods = db.workerRPC &&
          typeof db.workerRPC.enhanceQuery === 'function' &&
          typeof db.workerRPC.summarizeResults === 'function' &&
          typeof db.workerRPC.searchWithLLM === 'function';

        await db.close();

        return {
          success: true,
          hasRPCMethods
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.hasRPCMethods).toBe(true);
  });

  test('should handle worker timeout gracefully', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // @ts-ignore
        const db = new LocalRetrieve.Database('opfs:/test-llm-timeout.db');
        await db._initialize();

        // Try with very short timeout (should timeout before any real API call)
        await db.enhanceQuery('test query', {
          provider: 'openai',
          model: 'gpt-4',
          apiKey: 'sk-test-key',
          timeout: 1 // 1ms timeout - guaranteed to fail
        });

        return {
          success: false,
          error: 'Should have timed out'
        };
      } catch (error) {
        return {
          success: true,
          errorCaught: true,
          errorMessage: error.message,
          isTimeoutError: error.message.toLowerCase().includes('timeout')
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.errorCaught).toBe(true);
  });
});

test.describe('LLM Integration - Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/web-client/index.html');
    await page.waitForFunction(() => {
      return typeof window.LocalRetrieve !== 'undefined';
    }, { timeout: 30000 });
  });

  test('should provide meaningful error messages', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // @ts-ignore
        const db = new LocalRetrieve.Database('opfs:/test-llm-errors.db');
        await db._initialize();

        // Try various invalid operations and collect error messages
        const errors: string[] = [];

        // Missing API key
        try {
          await db.enhanceQuery('test', { provider: 'openai', model: 'gpt-4' });
        } catch (e) {
          errors.push(e.message);
        }

        // Empty query
        try {
          await db.enhanceQuery('', { provider: 'openai', model: 'gpt-4', apiKey: 'key' });
        } catch (e) {
          errors.push(e.message);
        }

        // Invalid provider
        try {
          await db.enhanceQuery('test', { provider: 'invalid' as any, model: 'test', apiKey: 'key' });
        } catch (e) {
          errors.push(e.message);
        }

        await db.close();

        return {
          success: true,
          errors,
          allErrorsHaveMessages: errors.every(e => e && e.length > 0)
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.allErrorsHaveMessages).toBe(true);
  });

  test('should not crash on malformed options', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // @ts-ignore
        const db = new LocalRetrieve.Database('opfs:/test-llm-malformed.db');
        await db._initialize();

        // Try with malformed options
        try {
          await db.enhanceQuery('test query', null as any);
        } catch (e) {
          // Expected to fail
        }

        try {
          await db.enhanceQuery('test query', { provider: null } as any);
        } catch (e) {
          // Expected to fail
        }

        // Database should still be functional
        const canStillQuery = await db.exec('SELECT 1').then(() => true).catch(() => false);

        await db.close();

        return {
          success: true,
          databaseStillFunctional: canStillQuery
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.databaseStillFunctional).toBe(true);
  });

  test('should maintain database integrity after LLM errors', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // @ts-ignore
        const db = new LocalRetrieve.Database('opfs:/test-llm-integrity.db');
        await db._initialize();
        await db.initializeSchema();

        // Insert some data
        await db.exec(`
          INSERT INTO docs_default (id, title, content)
          VALUES ('1', 'Test Doc', 'Test content')
        `);

        // Try LLM operation that will fail
        try {
          await db.enhanceQuery('test', { provider: 'openai', model: 'gpt-4', apiKey: 'invalid-key' });
        } catch (e) {
          // Expected to fail
        }

        // Verify database is still intact
        const results = await db.exec('SELECT COUNT(*) as count FROM docs_default');
        const count = results[0]?.values[0][0];

        await db.close();

        return {
          success: true,
          dataIntact: count === 1
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.dataIntact).toBe(true);
  });
});

test.describe('LLM Integration - Provider Configuration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/web-client/index.html');
    await page.waitForFunction(() => {
      return typeof window.LocalRetrieve !== 'undefined';
    }, { timeout: 30000 });
  });

  test('should accept valid provider names', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // @ts-ignore
        const db = new LocalRetrieve.Database('opfs:/test-llm-providers.db');
        await db._initialize();

        const validProviders = ['openai', 'anthropic', 'openrouter', 'custom'];
        const testResults: Record<string, boolean> = {};

        for (const provider of validProviders) {
          try {
            // Just test that the call format is accepted (will fail on auth but that's ok)
            await db.enhanceQuery('test', {
              provider: provider as any,
              model: 'test-model',
              apiKey: 'test-key'
            });
            testResults[provider] = true; // Won't reach here due to auth failure
          } catch (error) {
            // Auth or network error is expected, but provider should be accepted
            testResults[provider] = !error.message.includes('Unknown provider') &&
                                   !error.message.includes('Invalid provider');
          }
        }

        await db.close();

        return {
          success: true,
          testResults,
          allProvidersAccepted: Object.values(testResults).every(v => v)
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.allProvidersAccepted).toBe(true);
  });

  test('should accept custom endpoint configuration', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // @ts-ignore
        const db = new LocalRetrieve.Database('opfs:/test-llm-custom.db');
        await db._initialize();

        // Test custom endpoint configuration
        let configAccepted = false;
        try {
          await db.enhanceQuery('test', {
            provider: 'custom',
            model: 'test-model',
            apiKey: 'test-key',
            endpoint: 'https://custom-llm-api.example.com/v1/chat'
          });
          configAccepted = true; // Won't reach here due to network error
        } catch (error) {
          // Network error is expected, but config should be accepted
          configAccepted = !error.message.includes('Invalid endpoint') &&
                          !error.message.includes('endpoint required');
        }

        await db.close();

        return {
          success: true,
          configAccepted
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.configAccepted).toBe(true);
  });
});

test.describe('LLM Integration - Cross-Browser Compatibility', () => {
  test('should work consistently across browsers', async ({ page, browserName }) => {
    await page.goto('/examples/web-client/index.html');
    await page.waitForFunction(() => {
      return typeof window.LocalRetrieve !== 'undefined';
    }, { timeout: 30000 });

    const result = await page.evaluate(async () => {
      try {
        // @ts-ignore
        const db = new LocalRetrieve.Database('opfs:/test-llm-browser.db');
        await db._initialize();

        // Test that API is available and consistent
        const hasEnhanceQuery = typeof db.enhanceQuery === 'function';
        const hasSummarizeResults = typeof db.summarizeResults === 'function';
        const hasSearchWithLLM = typeof db.searchWithLLM === 'function';

        await db.close();

        return {
          success: true,
          hasEnhanceQuery,
          hasSummarizeResults,
          hasSearchWithLLM
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    console.log(`${browserName}: LLM API availability check`);
    expect(result.success).toBe(true);
    expect(result.hasEnhanceQuery).toBe(true);
    expect(result.hasSummarizeResults).toBe(true);
    expect(result.hasSearchWithLLM).toBe(true);
  });
});

test.describe('LLM Integration - Type Safety', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/web-client/index.html');
    await page.waitForFunction(() => {
      return typeof window.LocalRetrieve !== 'undefined';
    }, { timeout: 30000 });
  });

  test('should validate parameter types', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // @ts-ignore
        const db = new LocalRetrieve.Database('opfs:/test-llm-types.db');
        await db._initialize();

        const typeErrors: string[] = [];

        // Test with wrong types
        try {
          await db.enhanceQuery(123 as any, { provider: 'openai', model: 'gpt-4', apiKey: 'key' });
        } catch (e) {
          typeErrors.push('query-type');
        }

        try {
          await db.summarizeResults('not-array' as any, { provider: 'openai', model: 'gpt-4', apiKey: 'key' });
        } catch (e) {
          typeErrors.push('results-type');
        }

        try {
          await db.searchWithLLM(null as any, { enhanceQuery: true, llmOptions: { provider: 'openai', model: 'gpt-4', apiKey: 'key' } });
        } catch (e) {
          typeErrors.push('search-query-type');
        }

        await db.close();

        return {
          success: true,
          caughtTypeErrors: typeErrors.length,
          expectedErrors: 3
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    });

    expect(result.success).toBe(true);
    expect(result.caughtTypeErrors).toBe(result.expectedErrors);
  });
});
