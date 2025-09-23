# LocalRetrieve MVP Testing Strategy

## Overview

Testing strategy for the simplified MVP focusing on essential functionality verification with minimal complexity. The approach prioritizes critical path testing over comprehensive coverage.

**Testing Philosophy**: Test the minimum necessary to ensure MVP reliability while maintaining development velocity.

## Testing Pyramid (Simplified)

```
    E2E Tests (5%)
    ─────────────────
   Integration Tests (25%)
  ─────────────────────────────
 Unit Tests (70%)
─────────────────────────────────
```

**Rationale**: Heavy focus on unit tests for fast feedback, minimal E2E for critical user workflows.

## Test Types & Priorities

### 1. Unit Tests (High Priority)
**Focus**: Individual functions and classes in isolation
**Coverage Target**: >80% for core functionality
**Tools**: Vitest (faster than Jest for Vite projects)

**Key Areas**:
- Database class methods (exec, run, prepare)
- Statement operations (step, bind, getAsObject) 
- Search fusion algorithms (RRF, weighted)
- Error handling and edge cases
- Type safety validation

### 2. Integration Tests (Medium Priority)
**Focus**: Component interactions and Worker communication
**Coverage Target**: Major workflows and data flows
**Tools**: Vitest + Worker testing utilities

**Key Areas**:
- Worker RPC communication
- OPFS persistence across sessions
- Search pipeline (FTS + vector + fusion)
- Export/import roundtrip
- WASM loading and initialization

### 3. E2E Tests (Low Priority)
**Focus**: Critical user workflows only
**Coverage Target**: Happy path scenarios
**Tools**: Playwright

**Key Areas**:
- Demo application basic workflow
- Cross-browser compatibility verification
- Performance regression detection

## Testing Tools & Setup

### Core Testing Stack
```json
{
  "devDependencies": {
    "vitest": "^1.0.0",
    "playwright": "^1.40.0",
    "@vitest/coverage-v8": "^1.0.0",
    "happy-dom": "^12.0.0"
  }
}
```

### Configuration Files

**`vitest.config.ts`**:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      threshold: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80
        }
      }
    },
    setupFiles: ['tests/setup.ts']
  }
});
```

**`playwright.config.ts`**:
```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } }
  ]
});
```

## Test Examples

### Unit Test Examples

**Database Class Testing**:
```typescript
// tests/unit/database.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../../src/database/Database';

describe('Database', () => {
  let db: Database;

  beforeEach(async () => {
    db = await Database.create(':memory:');
  });

  afterEach(() => {
    db?.close();
  });

  it('should execute basic SQL', () => {
    db.exec('CREATE TABLE test (id INTEGER, name TEXT)');
    db.run('INSERT INTO test VALUES (?, ?)', [1, 'hello']);
    
    const stmt = db.prepare('SELECT * FROM test WHERE id = ?');
    stmt.bind([1]);
    
    expect(stmt.step()).toBe(true);
    expect(stmt.getAsObject()).toEqual({ id: 1, name: 'hello' });
    stmt.free();
  });

  it('should handle export/import', () => {
    db.exec('CREATE TABLE test (id INTEGER)');
    db.run('INSERT INTO test VALUES (?)', [42]);
    
    const exported = db.export();
    expect(exported).toBeInstanceOf(Uint8Array);
    
    const db2 = Database.create(':memory:');
    db2.deserialize(exported);
    
    const stmt = db2.prepare('SELECT * FROM test');
    stmt.step();
    expect(stmt.getAsObject()).toEqual({ id: 42 });
  });

  it('should handle errors gracefully', () => {
    expect(() => db.exec('INVALID SQL')).toThrow();
    expect(db.prepare('SELECT * FROM nonexistent')).toThrow();
  });
});
```

**Search Fusion Testing**:
```typescript
// tests/unit/fusion.test.ts
import { describe, it, expect } from 'vitest';
import { rrf, weightedFusion } from '../../src/search/fusion';

describe('Result Fusion', () => {
  const ftsResults = [
    { rowid: 1, score: 0.9 },
    { rowid: 2, score: 0.7 },
    { rowid: 3, score: 0.5 }
  ];
  
  const vecResults = [
    { rowid: 2, score: 0.1 }, // lower distance = higher relevance
    { rowid: 1, score: 0.3 },
    { rowid: 4, score: 0.5 }
  ];

  it('should perform RRF fusion correctly', () => {
    const fused = rrf(ftsResults, vecResults, { k: 60 });
    
    // Check that results are properly ranked
    expect(fused[0].rowid).toBe(2); // appears in both, good ranks
    expect(fused.length).toBe(4); // union of all results
    expect(fused.every(r => r.score > 0)).toBe(true);
  });

  it('should perform weighted fusion', () => {
    const fused = weightedFusion(ftsResults, vecResults, {
      ftsWeight: 0.7,
      vecWeight: 0.3
    });
    
    expect(fused[0].rowid).toBe(1); // highest FTS score
    expect(fused.every(r => r.score >= 0 && r.score <= 1)).toBe(true);
  });

  it('should handle empty result sets', () => {
    expect(rrf([], vecResults)).toEqual(vecResults);
    expect(rrf(ftsResults, [])).toEqual(ftsResults);
    expect(rrf([], [])).toEqual([]);
  });
});
```

### Integration Test Examples

**Worker Communication Testing**:
```typescript
// tests/integration/worker.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DatabaseWorker } from '../../src/database/worker';

describe('Database Worker', () => {
  let worker: Worker;
  let db: DatabaseWorker;

  beforeEach(async () => {
    worker = new Worker(new URL('../../src/database/worker.ts', import.meta.url));
    db = new DatabaseWorker(worker);
    await db.open(':memory:');
  });

  afterEach(async () => {
    await db.close();
    worker.terminate();
  });

  it('should handle SQL operations via RPC', async () => {
    await db.exec('CREATE TABLE test (id INTEGER, name TEXT)');
    await db.exec('INSERT INTO test VALUES (1, "hello")');
    
    const results = await db.select('SELECT * FROM test');
    expect(results).toEqual([{ id: 1, name: 'hello' }]);
  });

  it('should support hybrid search with manual vec initialization', async () => {
    // IMPORTANT: Manually initialize sqlite-vec extension
    const initResult = await db.exec('SELECT sqlite3_vec_init_manual()');
    expect(initResult).toBe(0); // 0 = success
    
    // Setup tables
    await db.initializeSchema();
    
    // Insert test data
    await db.exec(`
      INSERT INTO docs_default (id, title, content) VALUES
      ('1', 'Test Doc', 'hello world search'),
      ('2', 'Another', 'vector similarity test')
    `);
    
    // Insert into FTS
    await db.exec(`
      INSERT INTO fts_default (rowid, id, title, content) VALUES
      (1, '1', 'Test Doc', 'hello world search'),
      (2, '2', 'Another', 'vector similarity test')
    `);
    
    // Insert vectors using vec_f32() function
    await db.exec(`
      INSERT INTO vec_default_dense (rowid, embedding) VALUES
      (1, vec_f32('[0.1, 0.2, 0.3]')),
      (2, vec_f32('[0.4, 0.5, 0.6]'))
    `);
    
    // Perform hybrid search
    const results = await db.search({
      query: {
        text: 'hello',
        vector: new Float32Array([0.1, 0.2, 0.3])
      },
      limit: 10
    });
    
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('id');
    expect(results[0]).toHaveProperty('score');
  });
});
```

**OPFS Persistence Testing**:
```typescript
// tests/integration/persistence.test.ts
import { describe, it, expect } from 'vitest';
import { Database } from '../../src/database/Database';

describe('OPFS Persistence', () => {
  it('should persist data across sessions', async () => {
    const filename = 'opfs:/test/persistence.db';
    
    // First session - write data
    {
      const db = await Database.create(undefined, filename);
      db.exec('CREATE TABLE test (id INTEGER, value TEXT)');
      db.run('INSERT INTO test VALUES (?, ?)', [1, 'persistent']);
      db.close();
    }
    
    // Second session - read data
    {
      const db = await Database.create(undefined, filename);
      const stmt = db.prepare('SELECT * FROM test WHERE id = ?');
      stmt.bind([1]);
      
      expect(stmt.step()).toBe(true);
      expect(stmt.getAsObject()).toEqual({ id: 1, value: 'persistent' });
      
      stmt.free();
      db.close();
    }
  });

  it('should handle quota exceeded gracefully', async () => {
    // This test would need to be carefully designed to avoid
    // actually filling up the user's OPFS quota
    const db = await Database.create(undefined, 'opfs:/test/quota.db');
    
    // Mock quota exceeded scenario
    const originalExec = db.exec;
    db.exec = () => { 
      throw new Error('database or disk is full'); 
    };
    
    expect(() => db.exec('CREATE TABLE large (data BLOB)')).toThrow();
    db.close();
  });
});
```

### E2E Test Examples

**Demo Application Testing**:
```typescript
// tests/e2e/demo.test.ts
import { test, expect } from '@playwright/test';

test.describe('Demo Application', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/examples/web-client/');
  });

  test('should load demo application', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('LocalRetrieve Demo');
    await expect(page.locator('#status')).toContainText('Ready');
  });

  test('should perform basic document upload and search', async ({ page }) => {
    // Upload a document
    await page.locator('#document-text').fill('This is a test document about vector search');
    await page.locator('#vector-input').fill('0.1,0.2,0.3'); // Mock vector
    await page.locator('#add-document').click();
    
    await expect(page.locator('#status')).toContainText('Document added');
    
    // Perform search
    await page.locator('#search-text').fill('test document');
    await page.locator('#search-vector').fill('0.1,0.2,0.3');
    await page.locator('#search-button').click();
    
    // Check results
    await expect(page.locator('#results')).toContainText('test document');
    await expect(page.locator('.result-score')).toBeVisible();
  });

  test('should export and import database', async ({ page }) => {
    // Add some data first
    await page.locator('#document-text').fill('Export test document');
    await page.locator('#vector-input').fill('0.4,0.5,0.6');
    await page.locator('#add-document').click();
    
    // Export database
    await page.locator('#export-button').click();
    
    // Check that download was triggered (simplified)
    await expect(page.locator('#status')).toContainText('exported');
    
    // Import would be more complex to test due to file upload
    // This is acceptable for MVP E2E coverage
  });
});
```

## Test Data & Fixtures

**Sample Test Data**:
```typescript
// tests/fixtures/test-data.ts
export const sampleDocuments = [
  {
    id: '1',
    title: 'Introduction to Vector Search',
    content: 'Vector search enables semantic similarity matching using embeddings',
    vector: new Float32Array([0.1, 0.2, 0.3, 0.4])
  },
  {
    id: '2', 
    title: 'Full Text Search Basics',
    content: 'FTS allows fast keyword-based document retrieval with ranking',
    vector: new Float32Array([0.5, 0.6, 0.7, 0.8])
  }
];

export const sampleQueries = [
  {
    text: 'vector search',
    vector: new Float32Array([0.1, 0.2, 0.3, 0.4]),
    expectedResults: ['1'] // Document IDs expected in results
  },
  {
    text: 'text retrieval',
    vector: new Float32Array([0.5, 0.6, 0.7, 0.8]),
    expectedResults: ['2']
  }
];
```

## Testing Workflow

### Development Workflow
```bash
# Run tests during development
npm run test:watch    # Watch mode for unit tests
npm run test:unit     # Run unit tests once
npm run test:integration  # Run integration tests
npm run test:coverage # Generate coverage report

# Pre-commit checks
npm run test          # Run all tests
npm run lint          # ESLint check
npm run typecheck     # TypeScript validation
```

### CI Pipeline Testing
```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - run: npm ci
      - run: npm run build
      - run: npm run test:unit
      - run: npm run test:integration
      
      - name: Install Playwright
        run: npx playwright install
      - run: npm run test:e2e
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## Performance Testing

**Basic Performance Benchmarks**:
```typescript
// tests/performance/search-benchmark.test.ts
import { describe, it, expect } from 'vitest';
import { Database } from '../../src/database/Database';

describe('Search Performance', () => {
  it('should meet latency targets', async () => {
    const db = await Database.create(':memory:');
    
    // Setup test data (1000 documents)
    await setupLargeDataset(db, 1000);
    
    const startTime = performance.now();
    
    const results = await db.search({
      query: { text: 'test query', vector: new Float32Array([0.1, 0.2, 0.3]) },
      limit: 50
    });
    
    const latency = performance.now() - startTime;
    
    expect(latency).toBeLessThan(500); // p95 < 500ms target
    expect(results.length).toBeGreaterThan(0);
    
    db.close();
  });
});
```

## Testing Best Practices

**MVP Testing Guidelines**:

1. **Focus on Critical Path**: Test the features users will actually use
2. **Mock External Dependencies**: Mock WASM loading, file system operations when needed
3. **Test Error Conditions**: Verify graceful handling of common errors
4. **Keep Tests Fast**: Unit tests should run in <100ms each
5. **Use Real Data**: Integration tests should use realistic document samples
6. **Test Browser Compatibility**: Verify core functionality across target browsers

**What NOT to Test in MVP**:
- Complex edge cases that are unlikely to occur
- Performance optimization details
- Advanced error recovery scenarios
- Extensive browser compatibility matrix
- UI styling and visual regression

This simplified testing strategy ensures MVP reliability while maintaining development velocity and avoiding over-engineering for the initial release.