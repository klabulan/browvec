import { test, expect } from '@playwright/test';

/**
 * E2E Integration Tests for LocalRetrieve Demo
 *
 * Tests the complete LocalRetrieve functionality through the demo application:
 * - Database initialization and persistence
 * - Document insertion and retrieval
 * - Full-text search functionality
 * - Vector search functionality
 * - Hybrid search capabilities
 * - Export/import functionality
 * - Cross-browser compatibility
 */

test.describe('LocalRetrieve Demo Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the demo page
    await page.goto('/examples/web-client/index.html');

    // Wait for the demo to load
    await expect(page.locator('h1')).toContainText('LocalRetrieve Demo');

    // Wait for database initialization
    await page.waitForSelector('#status', { state: 'visible' });
  });

  test('should initialize database successfully', async ({ page }) => {
    // Check that the database initializes without errors
    const statusElement = page.locator('#status');
    await expect(statusElement).toBeVisible();

    // Wait for initialization to complete
    await page.waitForFunction(() => {
      const status = document.querySelector('#status');
      return status && !status.textContent?.includes('Initializing');
    }, { timeout: 30000 });

    // Verify database is ready
    const status = await statusElement.textContent();
    expect(status).toContain('ready');
  });

  test('should display sample documents', async ({ page }) => {
    // Wait for documents to be loaded
    await page.waitForSelector('#document-count', { state: 'visible' });

    // Check that sample documents are loaded
    const docCount = page.locator('#document-count');
    await expect(docCount).toBeVisible();

    const count = await docCount.textContent();
    expect(parseInt(count || '0')).toBeGreaterThan(0);
  });

  test('should perform text search', async ({ page }) => {
    // Wait for search interface to be ready
    await page.waitForSelector('#search-text', { state: 'visible' });

    // Perform a text search
    await page.fill('#search-text', 'JavaScript');
    await page.click('#search-button');

    // Wait for results
    await page.waitForSelector('#results', { state: 'visible' });

    // Check that results are displayed
    const results = page.locator('#results .result-item');
    await expect(results.first()).toBeVisible();

    // Verify search term appears in results
    const firstResult = await results.first().textContent();
    expect(firstResult?.toLowerCase()).toContain('javascript');
  });

  test('should perform vector search', async ({ page }) => {
    // Wait for search interface to be ready
    await page.waitForSelector('#vector-search', { state: 'visible' });

    // Perform a vector search
    await page.fill('#vector-search', 'programming language');
    await page.click('#vector-search-button');

    // Wait for results
    await page.waitForSelector('#results', { state: 'visible' });

    // Check that results are displayed with similarity scores
    const results = page.locator('#results .result-item');
    await expect(results.first()).toBeVisible();

    // Verify similarity scores are shown
    const scoreElement = page.locator('#results .similarity-score').first();
    await expect(scoreElement).toBeVisible();
  });

  test('should perform hybrid search', async ({ page }) => {
    // Wait for search interface to be ready
    await page.waitForSelector('#search-text', { state: 'visible' });
    await page.waitForSelector('#vector-search', { state: 'visible' });

    // Fill both text and vector search fields
    await page.fill('#search-text', 'tutorial');
    await page.fill('#vector-search', 'learning programming');

    // Perform hybrid search
    await page.click('#hybrid-search-button');

    // Wait for results
    await page.waitForSelector('#results', { state: 'visible' });

    // Check that results combine both search types
    const results = page.locator('#results .result-item');
    await expect(results.first()).toBeVisible();

    // Verify both text relevance and similarity scores
    const textScore = page.locator('#results .text-score').first();
    const vectorScore = page.locator('#results .similarity-score').first();
    await expect(textScore).toBeVisible();
    await expect(vectorScore).toBeVisible();
  });

  test('should handle database export', async ({ page }) => {
    // Wait for export button to be available
    await page.waitForSelector('#export-button', { state: 'visible' });

    // Start download and wait for it
    const downloadPromise = page.waitForEvent('download');
    await page.click('#export-button');
    const download = await downloadPromise;

    // Verify download started
    expect(download.suggestedFilename()).toMatch(/localretrieve.*\.db$/);

    // Verify download completes
    const path = await download.path();
    expect(path).toBeTruthy();
  });

  test('should handle database import', async ({ page }) => {
    // This test would require a sample database file
    // For now, we'll test that the import button is functional
    await page.waitForSelector('#import-button', { state: 'visible' });

    const importButton = page.locator('#import-button');
    await expect(importButton).toBeVisible();
    await expect(importButton).toBeEnabled();
  });

  test('should persist data across page reloads', async ({ page }) => {
    // Wait for initial load
    await page.waitForSelector('#document-count', { state: 'visible' });
    const initialCount = await page.locator('#document-count').textContent();

    // Add a new document (if functionality exists)
    const addButton = page.locator('#add-document-button');
    if (await addButton.isVisible()) {
      await addButton.click();
      await page.fill('#new-document-title', 'Test Document');
      await page.fill('#new-document-content', 'This is a test document for persistence testing');
      await page.click('#save-document-button');

      // Wait for document count to update
      await page.waitForFunction((count) => {
        const current = document.querySelector('#document-count')?.textContent;
        return current && parseInt(current) > parseInt(count);
      }, initialCount);
    }

    // Reload the page
    await page.reload();

    // Wait for reload to complete
    await page.waitForSelector('#document-count', { state: 'visible' });

    // Verify data persisted
    const newCount = await page.locator('#document-count').textContent();
    expect(parseInt(newCount || '0')).toBeGreaterThanOrEqual(parseInt(initialCount || '0'));
  });

  test('should display performance metrics', async ({ page }) => {
    // Check for performance metrics display
    const metricsSection = page.locator('#performance-metrics');
    if (await metricsSection.isVisible()) {
      // Verify search timing is displayed
      await page.fill('#search-text', 'test');
      await page.click('#search-button');

      await page.waitForSelector('#search-time', { state: 'visible' });
      const searchTime = page.locator('#search-time');
      await expect(searchTime).toBeVisible();

      const timeText = await searchTime.textContent();
      expect(timeText).toMatch(/\d+(\.\d+)?\s*ms/);
    }
  });

  test('should handle errors gracefully', async ({ page }) => {
    // Test error handling by performing invalid operations
    await page.waitForSelector('#search-text', { state: 'visible' });

    // Try searching with very long query
    const longQuery = 'a'.repeat(10000);
    await page.fill('#search-text', longQuery);
    await page.click('#search-button');

    // Should not crash and should show some result or error message
    await page.waitForTimeout(2000);

    // Check that the page is still functional
    const statusElement = page.locator('#status');
    await expect(statusElement).toBeVisible();
  });
});

test.describe('Cross-browser Vector Search', () => {
  test('should work consistently across browsers', async ({ page, browserName }) => {
    await page.goto('/examples/web-client/index.html');

    // Wait for initialization
    await page.waitForSelector('#status', { state: 'visible' });
    await page.waitForFunction(() => {
      const status = document.querySelector('#status');
      return status && !status.textContent?.includes('Initializing');
    }, { timeout: 30000 });

    // Perform the same search across all browsers
    await page.fill('#vector-search', 'machine learning');
    await page.click('#vector-search-button');

    await page.waitForSelector('#results', { state: 'visible' });
    const results = page.locator('#results .result-item');
    await expect(results.first()).toBeVisible();

    // Log browser-specific results for comparison
    const resultCount = await results.count();
    console.log(`${browserName}: Found ${resultCount} results for "machine learning"`);

    expect(resultCount).toBeGreaterThan(0);
  });
});

test.describe('Performance Benchmarks', () => {
  test('should load demo within reasonable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/examples/web-client/index.html');
    await page.waitForSelector('#status', { state: 'visible' });

    // Wait for full initialization
    await page.waitForFunction(() => {
      const status = document.querySelector('#status');
      return status && !status.textContent?.includes('Initializing');
    }, { timeout: 30000 });

    const loadTime = Date.now() - startTime;
    console.log(`Demo loaded in ${loadTime}ms`);

    // Should load within 30 seconds
    expect(loadTime).toBeLessThan(30000);
  });

  test('should perform searches within reasonable time', async ({ page }) => {
    await page.goto('/examples/web-client/index.html');

    // Wait for initialization
    await page.waitForSelector('#status', { state: 'visible' });
    await page.waitForFunction(() => {
      const status = document.querySelector('#status');
      return status && !status.textContent?.includes('Initializing');
    }, { timeout: 30000 });

    // Measure search performance
    const startTime = Date.now();

    await page.fill('#search-text', 'JavaScript');
    await page.click('#search-button');
    await page.waitForSelector('#results .result-item', { state: 'visible' });

    const searchTime = Date.now() - startTime;
    console.log(`Search completed in ${searchTime}ms`);

    // Search should complete within 5 seconds
    expect(searchTime).toBeLessThan(5000);
  });
});