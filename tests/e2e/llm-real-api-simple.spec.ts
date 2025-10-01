import { test, expect } from '@playwright/test';

/**
 * Simple test to debug worker initialization issues
 */

test.describe('LLM Real API - Debug Initialization', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/web-client/index.html');
    await page.waitForFunction(() => {
      return typeof window.LocalRetrieve !== 'undefined';
    }, { timeout: 30000 });
  });

  test('should initialize database successfully', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        console.log('Creating database...');
        // @ts-ignore
        const db = new LocalRetrieve.Database('opfs:/test-debug-init.db');

        console.log('Initializing...');
        await db._initialize();

        console.log('Checking state...');
        const state = {
          isOpen: db.state?.isOpen,
          hasWorkerRPC: !!db.workerRPC,
          hasEnhanceQuery: typeof db.enhanceQuery === 'function'
        };

        console.log('State:', state);

        await db.close();

        return {
          success: true,
          state
        };
      } catch (error) {
        console.error('Error:', error);
        return {
          success: false,
          error: error.message,
          stack: error.stack
        };
      }
    });

    console.log('Result:', JSON.stringify(result, null, 2));
    expect(result.success).toBe(true);
  });

  test('should call enhanceQuery with dummy data', async ({ page }) => {
    const result = await page.evaluate(async () => {
      try {
        // @ts-ignore
        const db = new LocalRetrieve.Database('opfs:/test-debug-enhance.db');
        await db._initialize();

        // Try calling enhanceQuery with invalid key to see what happens
        try {
          await db.enhanceQuery('test query', {
            provider: 'openai',
            model: 'gpt-4',
            apiKey: 'fake-key-for-testing'
          });
        } catch (enhanceError) {
          // We expect this to fail with API error, not initialization error
          await db.close();
          return {
            success: true,
            enhanceErrorCaught: true,
            enhanceErrorMessage: enhanceError.message,
            isInitError: enhanceError.message.includes('not initialized') || enhanceError.message.includes('Worker not')
          };
        }

        await db.close();
        return {
          success: false,
          error: 'Should have thrown error for invalid API key'
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          stack: error.stack
        };
      }
    });

    console.log('Enhance test result:', JSON.stringify(result, null, 2));
    expect(result.success).toBe(true);
    expect(result.isInitError).toBe(false); // Should NOT be initialization error
  });
});
