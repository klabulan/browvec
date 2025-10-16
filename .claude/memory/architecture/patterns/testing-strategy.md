# Pattern: Pragmatic Testing Strategy

**Category:** Quality Assurance
**Status:** Proven

---

## Overview

LocalRetrieve uses pragmatic testing: test what matters, don't over-test trivial code.

## Test Pyramid

```
      E2E Tests (Playwright)
     /                      \
    /   Integration Tests     \
   /   (SQLite, OPFS, RPC)     \
  /______________________________\
       Unit Tests (Business Logic)
```

## What to Test

**✅ DO test:**
- Complex business logic
- Edge cases and error handling
- Database operations (integration)
- RPC communication
- OPFS persistence
- User workflows (E2E)

**❌ DON'T test:**
- Trivial getters/setters
- Framework code
- Third-party libraries
- Obvious code paths

## Unit Tests

**Location:** `src/**/*.test.ts`
**Runner:** Vitest

```typescript
// Example: Testing hybrid search score merging
describe('mergeResults', () => {
    it('should merge BM25 and vector scores with alpha weighting', () => {
        const bm25 = [{ id: 1, score: 0.8 }];
        const vector = [{ id: 1, score: 0.6 }];

        const result = mergeResults(bm25, vector, 0.5);

        expect(result[0].hybridScore).toBe(0.7); // 0.5*0.8 + 0.5*0.6
    });
});
```

## Integration Tests

Test component interactions:

```typescript
describe('OPFS Persistence Integration', () => {
    it('should persist database across reloads', async () => {
        // Create database
        const db1 = await initLocalRetrieve('opfs:/test/db.db');
        await db1.run(`INSERT INTO docs_default (content) VALUES (?)`, ['test']);
        await db1.close();

        // Reload
        const db2 = await initLocalRetrieve('opfs:/test/db.db');
        const result = await db2.get(`SELECT content FROM docs_default`);

        expect(result.content).toBe('test');
    });
});
```

## E2E Tests (Playwright)

**Location:** `tests/e2e/*.spec.ts`

```typescript
test('user can search documents', async ({ page }) => {
    await page.goto('http://localhost:5174/examples/web-client/');

    // Add document
    await page.fill('[data-testid="doc-input"]', 'Test document');
    await page.click('[data-testid="add-doc"]');

    // Search
    await page.fill('[data-testid="search-input"]', 'test');
    await page.click('[data-testid="search-button"]');

    // Verify results
    await expect(page.locator('[data-testid="search-result"]')).toContainText('Test document');
});
```

## Coverage Goals

- **Critical paths:** 80-90%
- **Security-sensitive:** 100%
- **Overall project:** 60-70% (pragmatic)

## Commands

```bash
npm test              # Unit tests
npm run test:e2e      # E2E tests
npm run test:all      # All tests
```

## Last Updated

2025-10-16
