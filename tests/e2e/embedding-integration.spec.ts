import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from .env.test
function loadTestEnv() {
  const envPath = path.join(__dirname, '../../.env.test');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars: Record<string, string> = {};

    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim();
          envVars[key.trim()] = value.replace(/^['"]|['"]$/g, ''); // Strip quotes
        }
      }
    });

    return envVars;
  }
  return {};
}

const testEnv = loadTestEnv();
const OPENAI_API_KEY = testEnv.OPENAI_API_KEY || process.env.OPENAI_API_KEY;

test.describe('Embedding Integration Tests', () => {
  let page: Page;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();

    // Navigate to the demo
    await page.goto('/examples/web-client/index.html');

    // Wait for the demo to initialize
    await page.waitForSelector('#db-status');
    await expect(page.locator('#db-status')).toHaveText('Connected', { timeout: 10000 });
  });

  test.afterEach(async () => {
    await page?.close();
  });

  test('should display embedding configuration UI', async () => {
    // Check if embedding configuration panel exists
    await expect(page.locator('h2:has-text("Embedding Configuration")')).toBeVisible();

    // Check provider selection
    await expect(page.locator('#embedding-provider')).toBeVisible();

    // Check default provider status
    await expect(page.locator('.provider-status .status-text')).toHaveText('Local processing - No API key required');
  });

  test('should switch between providers correctly', async () => {
    // Switch to OpenAI provider
    await page.selectOption('#embedding-provider', 'openai');

    // Check that OpenAI configuration becomes visible
    await expect(page.locator('#openai-config')).toBeVisible();
    await expect(page.locator('.provider-status .status-text')).toHaveText('OpenAI API - API key required');

    // Switch back to Transformers
    await page.selectOption('#embedding-provider', 'transformers');

    // Check that OpenAI configuration becomes hidden
    await expect(page.locator('#openai-config')).toBeHidden();
    await expect(page.locator('.provider-status .status-text')).toHaveText('Local processing - No API key required');
  });

  test('should generate mock embedding with Transformers provider', async () => {
    // Ensure Transformers provider is selected
    await page.selectOption('#embedding-provider', 'transformers');

    // Enter test text
    const testText = 'This is a test text for embedding generation';
    await page.fill('#test-text', testText);

    // Generate embedding
    await page.click('#generate-embedding-btn');

    // Wait for results (increased timeout for embedding generation)
    await expect(page.locator('.embedding-result')).toBeVisible({ timeout: 20000 });

    // Check embedding info
    await expect(page.locator('.embedding-result')).toContainText('Provider: transformers');
    await expect(page.locator('.embedding-result')).toContainText('Dimensions: 384');

    // Check that "Add to Collection" button is enabled
    await expect(page.locator('#add-to-collection-btn')).toBeEnabled();

    // Check embedding vector display
    await expect(page.locator('.embedding-vector')).toBeVisible();
  });

  test.skip(!OPENAI_API_KEY, 'should test real OpenAI integration with API key');
  test('should test real OpenAI integration with API key', async () => {
    // Switch to OpenAI provider
    await page.selectOption('#embedding-provider', 'openai');

    // Enter API key
    await page.fill('#openai-api-key', OPENAI_API_KEY!);

    // Check that test button is enabled
    await expect(page.locator('#test-api-key')).toBeEnabled();

    // Test API connection
    await page.click('#test-api-key');

    // Wait for connection test result
    await expect(page.locator('.provider-status .status-text')).toHaveText('API connection successful', { timeout: 15000 });

    // Configure model and dimensions
    await page.selectOption('#openai-model', 'text-embedding-3-small');
    await page.selectOption('#embedding-dimensions', '384');

    // Enter test text
    const testText = 'Machine learning is transforming modern technology';
    await page.fill('#test-text', testText);

    // Generate real embedding
    await page.click('#generate-embedding-btn');

    // Wait for real embedding results
    await expect(page.locator('.embedding-result')).toBeVisible({ timeout: 20000 });

    // Check OpenAI-specific results
    await expect(page.locator('.embedding-result')).toContainText('Provider: openai');
    await expect(page.locator('.embedding-result')).toContainText('Model: text-embedding-3-small');
    await expect(page.locator('.embedding-result')).toContainText('Dimensions: 384');

    // Check usage statistics (OpenAI specific)
    await expect(page.locator('.embedding-result')).toContainText('Tokens Used:');
    await expect(page.locator('.embedding-result')).toContainText('Prompt Tokens:');

    // Check that "Add to Collection" button is enabled
    await expect(page.locator('#add-to-collection-btn')).toBeEnabled();

    // Verify embedding vector is displayed and looks correct
    const embeddingVector = await page.locator('.embedding-vector').textContent();
    expect(embeddingVector).toMatch(/^\[[-\d\.\,\s]+.*\]$/); // Should look like an array of numbers

    // Test different dimensions
    await page.selectOption('#embedding-dimensions', '768');
    await page.click('#generate-embedding-btn');

    // Wait for new results
    await expect(page.locator('.embedding-result')).toContainText('Dimensions: 768', { timeout: 20000 });
  });

  test('should handle API key validation', async () => {
    // Switch to OpenAI provider
    await page.selectOption('#embedding-provider', 'openai');

    // Enter invalid API key
    await page.fill('#openai-api-key', 'invalid-key');

    // Test API connection with invalid key
    await page.click('#test-api-key');

    // Should show error status
    await expect(page.locator('.provider-status')).toHaveClass(/error/);
    await expect(page.locator('.provider-status .status-text')).toContainText('API test failed');
  });

  test('should manage collection creation workflow', async () => {
    // Test collection name input
    await page.fill('#collection-name', 'test-collection');
    await page.fill('#collection-description', 'Test collection for E2E testing');

    // Create collection
    await page.click('#create-collection-btn');

    // Should show success message
    await expect(page.locator('.status-message.success')).toContainText('Collection "test-collection" created successfully');

    // Form should be reset
    await expect(page.locator('#collection-name')).toHaveValue('default');
    await expect(page.locator('#collection-description')).toHaveValue('');
  });

  test('should list collections', async () => {
    // Click list collections
    await page.click('#list-collections-btn');

    // Should show collections list
    await expect(page.locator('.collection-list')).toBeVisible();
    await expect(page.locator('.collection-item')).toContainText('default');

    // Should show statistics
    await expect(page.locator('#embedding-stats')).toContainText('Found 1 collection(s)');
  });

  test('should validate required fields', async () => {
    // Try to generate embedding without text
    await page.fill('#test-text', '');
    await page.click('#generate-embedding-btn');

    // Should show error
    await expect(page.locator('.status-message.error')).toContainText('Please enter text to generate embedding');

    // Try to create collection without name
    await page.fill('#collection-name', '');
    await page.click('#create-collection-btn');

    // Should show error
    await expect(page.locator('.status-message.error')).toContainText('Collection name is required');
  });

  test('should show progress indicators', async () => {
    // Enter test text
    await page.fill('#test-text', 'Test text for progress check');

    // Start embedding generation
    await page.click('#generate-embedding-btn');

    // Check that progress bar appears
    await expect(page.locator('#embedding-progress')).toBeVisible();
    await expect(page.locator('.progress-fill')).toBeVisible();

    // Progress should eventually complete and disappear
    await expect(page.locator('#embedding-progress')).toBeHidden({ timeout: 10000 });
  });

  test('should handle embedding workflow end-to-end', async () => {
    // Select provider (use transformers for reliable testing)
    await page.selectOption('#embedding-provider', 'transformers');

    // Generate embedding
    const testText = 'End-to-end test for embedding workflow';
    await page.fill('#test-text', testText);
    await page.click('#generate-embedding-btn');

    // Wait for embedding results
    await expect(page.locator('.embedding-result')).toBeVisible({ timeout: 10000 });

    // Add to collection
    await page.fill('#collection-name', 'e2e-test');
    await page.click('#add-to-collection-btn');

    // Should show success message
    await expect(page.locator('.status-message.success')).toContainText('Embedding added to collection "e2e-test" successfully');

    // Embedding should be cleared and button disabled
    await expect(page.locator('#add-to-collection-btn')).toBeDisabled();
    await expect(page.locator('#embedding-results')).toContainText('No embedding generated yet');
  });
});