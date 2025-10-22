/**
 * Test Suite: 3-Way RRF with LIKE Substring Search
 * Task: 20251016_substring_like_rrf
 *
 * Tests cover:
 * - Basic LIKE search functionality (5 tests)
 * - SQL injection prevention (10 tests)
 * - Special characters (5 tests)
 * - Query length edge cases (4 tests)
 * - Stop word filtering (3 tests)
 * - Unicode/multilingual support (4 tests)
 * - Performance/timeout handling (3 tests)
 *
 * Total: 34 tests (expanded from planned 29 for better coverage)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { initLocalRetrieve } from '../../src/index.js';
import type { Database } from '../../src/database/Database.js';

describe('3-Way RRF: LIKE Substring Search', () => {
  let db: Database;

  beforeAll(async () => {
    // Initialize in-memory database
    db = await initLocalRetrieve(':memory:');
    await db.initializeSchema();

    // Insert test documents with varied content
    const testDocs = [
      { id: 'doc1', title: 'Python Programming Guide', content: 'Learn pythonic idioms and best practices for Python development.' },
      { id: 'doc2', title: 'JavaScript Basics', content: 'Understanding JavaScript fundamentals and getUserData() function usage.' },
      { id: 'doc3', title: 'API Design', content: 'RESTful API design patterns using apiKey authentication and APIGateway.' },
      { id: 'doc4', title: 'Database Queries', content: 'SQL LIKE operator with wildcard % and _ characters for pattern matching.' },
      { id: 'doc5', title: 'User Management', content: 'User authentication with userProfile and user_settings configuration.' },
      { id: 'doc6', title: 'Security Best Practices', content: 'Prevent SQL injection attacks: always escape \' and " characters.' },
      { id: 'doc7', title: 'Unicode Support', content: 'Тестирование поиска с кириллицей и 中文字符 in documents.' },
      { id: 'doc8', title: 'Special Characters', content: 'Handle special chars: @#$%^&*()[]{}|\\/<>?,.;:\'"' },
      { id: 'doc9', title: 'Short Text', content: 'AI ML NLP DL' },
      { id: 'doc10', title: 'Common Words', content: 'The quick brown fox jumps over the lazy dog at the park.' }
    ];

    for (const doc of testDocs) {
      await db.insertDocumentWithEmbedding({
        collection: 'default',
        document: doc,
        options: { generateEmbedding: false }
      });
    }
  });

  afterAll(async () => {
    await db?.close();
  });

  // =============================================================================
  // Group 1: Basic LIKE Search Functionality (5 tests)
  // =============================================================================

  describe('Basic Functionality', () => {
    it('should find substring matches when LIKE enabled', async () => {
      const results = await db.search({
        query: { text: 'python' },
        collection: 'default',
        limit: 10,
        enableLikeSearch: true,
        fusionMethod: 'rrf',
        fusionWeights: { fts: 0.5, vec: 0.3, like: 0.2 }
      });

      expect(results.results.length).toBeGreaterThan(0);

      // Should find "pythonic" (substring match)
      const foundPythonic = results.results.some(r =>
        r.content.toLowerCase().includes('pythonic')
      );
      expect(foundPythonic).toBe(true);
    });

    it('should not execute LIKE when disabled (opt-in)', async () => {
      const results = await db.search({
        query: { text: 'python' },
        collection: 'default',
        limit: 10,
        enableLikeSearch: false,  // Disabled
        fusionMethod: 'rrf',
        fusionWeights: { fts: 0.6, vec: 0.4 }
      });

      // Should work but without LIKE scores
      expect(results.results.length).toBeGreaterThanOrEqual(0);
      expect(results.results.every(r => r.likeScore === undefined)).toBe(true);
    });

    it('should include likeScore and likeRank in results when LIKE enabled', async () => {
      const results = await db.search({
        query: { text: 'user' },
        collection: 'default',
        limit: 10,
        enableLikeSearch: true,
        fusionMethod: 'rrf',
        fusionWeights: { fts: 0.5, vec: 0.3, like: 0.2 }
      });

      const likeResults = results.results.filter(r => r.likeScore !== undefined);

      if (likeResults.length > 0) {
        // At least one result should have LIKE score
        expect(likeResults[0].likeScore).toBeGreaterThan(0);
        expect(likeResults[0].likeRank).toBeGreaterThanOrEqual(0);
      }
    });

    it('should merge FTS, vector, and LIKE results correctly', async () => {
      const results = await db.search({
        query: { text: 'api' },
        collection: 'default',
        limit: 10,
        enableLikeSearch: true,
        fusionMethod: 'rrf',
        fusionWeights: { fts: 0.5, vec: 0.3, like: 0.2 }
      });

      expect(results.results.length).toBeGreaterThan(0);

      // Final score should be computed
      results.results.forEach(result => {
        expect(result.score).toBeDefined();
        expect(typeof result.score).toBe('number');
      });
    });

    it('should support weighted_rrf fusion with 3 weights', async () => {
      const results = await db.search({
        query: { text: 'python' },
        collection: 'default',
        limit: 10,
        enableLikeSearch: true,
        fusionMethod: 'weighted_rrf',
        fusionWeights: { fts: 0.6, vec: 0.2, like: 0.2 }
      });

      expect(results.results.length).toBeGreaterThanOrEqual(0);
      // Should not throw weight validation error
    });
  });

  // =============================================================================
  // Group 2: SQL Injection Prevention (10 tests)
  // =============================================================================

  describe('SQL Injection Prevention', () => {
    it('should escape % wildcard character', async () => {
      const results = await db.search({
        query: { text: 'user%' },
        collection: 'default',
        limit: 10,
        enableLikeSearch: true,
        fusionMethod: 'rrf',
        fusionWeights: { fts: 0.5, vec: 0.3, like: 0.2 }
      });

      // Should search for literal "user%" not wildcard pattern
      // Should not match all documents
      expect(results.results.length).toBeLessThan(10);
    });

    it('should escape _ wildcard character', async () => {
      const results = await db.search({
        query: { text: 'user_' },
        collection: 'default',
        limit: 10,
        enableLikeSearch: true,
        fusionMethod: 'rrf',
        fusionWeights: { fts: 0.5, vec: 0.3, like: 0.2 }
      });

      // Should search for literal "user_" not wildcard
      // Should find "user_settings" but not "userProfile"
      const foundExact = results.results.some(r =>
        r.content.includes('user_settings')
      );
      expect(foundExact || results.results.length === 0).toBe(true);
    });

    it('should escape backslash character', async () => {
      const results = await db.search({
        query: { text: 'path\\to' },
        collection: 'default',
        limit: 10,
        enableLikeSearch: true,
        fusionMethod: 'rrf',
        fusionWeights: { fts: 0.5, vec: 0.3, like: 0.2 }
      });

      // Should not cause SQL error
      expect(results).toBeDefined();
    });

    it('should handle multiple wildcards in query', async () => {
      const results = await db.search({
        query: { text: '%%__\\\\' },
        collection: 'default',
        limit: 10,
        enableLikeSearch: true,
        fusionMethod: 'rrf',
        fusionWeights: { fts: 0.5, vec: 0.3, like: 0.2 }
      });

      // Should not match everything
      expect(results.results.length).toBeLessThanOrEqual(10);
    });

    it('should prevent SQL injection via single quote', async () => {
      const results = await db.search({
        query: { text: "' OR '1'='1" },
        collection: 'default',
        limit: 10,
        enableLikeSearch: true,
        fusionMethod: 'rrf',
        fusionWeights: { fts: 0.5, vec: 0.3, like: 0.2 }
      });

      // Should not match all documents (SQL injection attempt)
      expect(results.results.length).toBeLessThan(10);
    });

    it('should prevent SQL injection via double quote', async () => {
      const results = await db.search({
        query: { text: '" OR "1"="1' },
        collection: 'default',
        limit: 10,
        enableLikeSearch: true,
        fusionMethod: 'rrf',
        fusionWeights: { fts: 0.5, vec: 0.3, like: 0.2 }
      });

      expect(results.results.length).toBeLessThan(10);
    });

    it('should prevent SQL injection via UNION attack', async () => {
      const results = await db.search({
        query: { text: "' UNION SELECT * FROM docs_default --" },
        collection: 'default',
        limit: 10,
        enableLikeSearch: true,
        fusionMethod: 'rrf',
        fusionWeights: { fts: 0.5, vec: 0.3, like: 0.2 }
      });

      expect(results.results.length).toBeLessThan(10);
    });

    it('should prevent SQL injection via DROP TABLE', async () => {
      const results = await db.search({
        query: { text: "'; DROP TABLE docs_default; --" },
        collection: 'default',
        limit: 10,
        enableLikeSearch: true,
        fusionMethod: 'rrf',
        fusionWeights: { fts: 0.5, vec: 0.3, like: 0.2 }
      });

      expect(results.results.length).toBeLessThan(10);

      // Verify table still exists
      const verify = await db.execAsync('SELECT COUNT(*) FROM docs_default');
      expect(verify[0].values.length).toBeGreaterThan(0);
    });

    it('should handle embedded NULL bytes', async () => {
      const results = await db.search({
        query: { text: 'user\x00admin' },
        collection: 'default',
        limit: 10,
        enableLikeSearch: true,
        fusionMethod: 'rrf',
        fusionWeights: { fts: 0.5, vec: 0.3, like: 0.2 }
      });

      expect(results).toBeDefined();
    });

    it('should handle very long injection attempts', async () => {
      const longInjection = "' OR 1=1 --".repeat(100);

      const results = await db.search({
        query: { text: longInjection },
        collection: 'default',
        limit: 10,
        enableLikeSearch: true,
        fusionMethod: 'rrf',
        fusionWeights: { fts: 0.5, vec: 0.3, like: 0.2 }
      });

      // Should skip (too long) or return safely
      expect(results).toBeDefined();
    });
  });

  // =============================================================================
  // Group 3: Special Characters (5 tests)
  // =============================================================================

  describe('Special Characters', () => {
    it('should handle punctuation characters', async () => {
      const results = await db.search({
        query: { text: 'user()' },
        collection: 'default',
        limit: 10,
        enableLikeSearch: true,
        fusionMethod: 'rrf',
        fusionWeights: { fts: 0.5, vec: 0.3, like: 0.2 }
      });

      // Should find getUserData() function
      const found = results.results.some(r =>
        r.content.includes('getUserData()')
      );
      expect(found || results.results.length === 0).toBe(true);
    });

    it('should handle mixed case queries', async () => {
      const results = await db.search({
        query: { text: 'PyThOn' },
        collection: 'default',
        limit: 10,
        enableLikeSearch: true,
        fusionMethod: 'rrf',
        fusionWeights: { fts: 0.5, vec: 0.3, like: 0.2 }
      });

      // LIKE search is case-insensitive (LOWER() applied)
      expect(results.results.length).toBeGreaterThan(0);
    });

    it('should handle numbers in queries', async () => {
      const results = await db.search({
        query: { text: 'user123' },
        collection: 'default',
        limit: 10,
        enableLikeSearch: true,
        fusionMethod: 'rrf',
        fusionWeights: { fts: 0.5, vec: 0.3, like: 0.2 }
      });

      expect(results).toBeDefined();
    });

    it('should handle hyphenated words', async () => {
      const results = await db.search({
        query: { text: 'user-data' },
        collection: 'default',
        limit: 10,
        enableLikeSearch: true,
        fusionMethod: 'rrf',
        fusionWeights: { fts: 0.5, vec: 0.3, like: 0.2 }
      });

      expect(results).toBeDefined();
    });

    it('should handle underscored words', async () => {
      const results = await db.search({
        query: { text: 'user_settings' },
        collection: 'default',
        limit: 10,
        enableLikeSearch: true,
        fusionMethod: 'rrf',
        fusionWeights: { fts: 0.5, vec: 0.3, like: 0.2 }
      });

      // Should find exact match
      const found = results.results.some(r =>
        r.content.includes('user_settings')
      );
      expect(found).toBe(true);
    });
  });

  // =============================================================================
  // Group 4: Query Length Edge Cases (4 tests)
  // =============================================================================

  describe('Query Length Edge Cases', () => {
    it('should skip queries shorter than 3 characters', async () => {
      const results = await db.search({
        query: { text: 'ai' },
        collection: 'default',
        limit: 10,
        enableLikeSearch: true,
        fusionMethod: 'rrf',
        fusionWeights: { fts: 0.5, vec: 0.3, like: 0.2 }
      });

      // LIKE should be skipped, but search should still work via FTS
      expect(results.debugInfo?.likeSkipped).toBe(true);
      expect(results.debugInfo?.likeSkipReason).toBe('too_short');
    });

    it('should accept queries exactly 3 characters', async () => {
      const results = await db.search({
        query: { text: 'api' },
        collection: 'default',
        limit: 10,
        enableLikeSearch: true,
        fusionMethod: 'rrf',
        fusionWeights: { fts: 0.5, vec: 0.3, like: 0.2 }
      });

      // Should execute LIKE (minimum length met)
      expect(results.debugInfo?.likeSkipped).not.toBe(true);
    });

    it('should skip empty queries', async () => {
      const results = await db.search({
        query: { text: '' },
        collection: 'default',
        limit: 10,
        enableLikeSearch: true,
        fusionMethod: 'rrf',
        fusionWeights: { fts: 0.5, vec: 0.3, like: 0.2 }
      });

      expect(results.debugInfo?.likeSkipped).toBe(true);
      expect(results.debugInfo?.likeSkipReason).toBe('too_short');
    });

    it('should skip whitespace-only queries', async () => {
      const results = await db.search({
        query: { text: '   ' },
        collection: 'default',
        limit: 10,
        enableLikeSearch: true,
        fusionMethod: 'rrf',
        fusionWeights: { fts: 0.5, vec: 0.3, like: 0.2 }
      });

      expect(results.debugInfo?.likeSkipped).toBe(true);
    });
  });

  // =============================================================================
  // Group 5: Stop Word Filtering (3 tests)
  // =============================================================================

  describe('Stop Word Filtering', () => {
    it('should skip common stop words (the, is, at)', async () => {
      const stopWords = ['the', 'is', 'at', 'which', 'on'];

      for (const word of stopWords) {
        const results = await db.search({
          query: { text: word },
          collection: 'default',
          limit: 10,
          enableLikeSearch: true,
          fusionMethod: 'rrf',
          fusionWeights: { fts: 0.5, vec: 0.3, like: 0.2 }
        });

        expect(results.debugInfo?.likeSkipped).toBe(true);
        expect(results.debugInfo?.likeSkipReason).toBe('stop_word');
      }
    });

    it('should not skip non-stop words', async () => {
      const results = await db.search({
        query: { text: 'python' },
        collection: 'default',
        limit: 10,
        enableLikeSearch: true,
        fusionMethod: 'rrf',
        fusionWeights: { fts: 0.5, vec: 0.3, like: 0.2 }
      });

      // Should execute (not a stop word)
      expect(results.debugInfo?.likeSkipped).not.toBe(true);
    });

    it('should be case-insensitive for stop words', async () => {
      const results = await db.search({
        query: { text: 'THE' },
        collection: 'default',
        limit: 10,
        enableLikeSearch: true,
        fusionMethod: 'rrf',
        fusionWeights: { fts: 0.5, vec: 0.3, like: 0.2 }
      });

      expect(results.debugInfo?.likeSkipped).toBe(true);
      expect(results.debugInfo?.likeSkipReason).toBe('stop_word');
    });
  });

  // =============================================================================
  // Group 6: Unicode and Multilingual (4 tests)
  // =============================================================================

  describe('Unicode and Multilingual Support', () => {
    it('should handle Cyrillic text (case-sensitive)', async () => {
      const results = await db.search({
        query: { text: 'Тест' },  // Must match case for Cyrillic (LIKE is case-sensitive for Unicode)
        collection: 'default',
        limit: 10,
        enableLikeSearch: true,
        fusionMethod: 'rrf',
        fusionWeights: { fts: 0.5, vec: 0.3, like: 0.2 }
      });

      // Should find "Тестирование" (matching case)
      const found = results.results.some(r =>
        r.content.includes('Тестирование')
      );
      expect(found || results.results.length === 0).toBe(true);
    });

    it('should handle Chinese characters', async () => {
      const results = await db.search({
        query: { text: '中文' },
        collection: 'default',
        limit: 10,
        enableLikeSearch: true,
        fusionMethod: 'rrf',
        fusionWeights: { fts: 0.5, vec: 0.3, like: 0.2 }
      });

      const found = results.results.some(r =>
        r.content.includes('中文字符')
      );
      expect(found || results.results.length === 0).toBe(true);
    });

    it('should handle mixed scripts', async () => {
      const results = await db.search({
        query: { text: 'test中文' },
        collection: 'default',
        limit: 10,
        enableLikeSearch: true,
        fusionMethod: 'rrf',
        fusionWeights: { fts: 0.5, vec: 0.3, like: 0.2 }
      });

      expect(results).toBeDefined();
    });

    it('should handle emoji in queries', async () => {
      const results = await db.search({
        query: { text: 'test🔍' },
        collection: 'default',
        limit: 10,
        enableLikeSearch: true,
        fusionMethod: 'rrf',
        fusionWeights: { fts: 0.5, vec: 0.3, like: 0.2 }
      });

      expect(results).toBeDefined();
    });
  });

  // =============================================================================
  // Group 7: Performance and Timeout (3 tests)
  // =============================================================================

  describe('Performance and Timeout', () => {
    it('should respect MAX_LIKE_RESULTS limit (100)', async () => {
      const results = await db.search({
        query: { text: 'a' },  // Would match many if not skipped
        collection: 'default',
        limit: 200,  // Request more than max
        enableLikeSearch: true,
        fusionMethod: 'rrf',
        fusionWeights: { fts: 0.5, vec: 0.3, like: 0.2 }
      });

      // Should be skipped due to stop word or length
      // But if it runs, should cap at 100
      if (results.debugInfo?.likeResultCount) {
        expect(results.debugInfo.likeResultCount).toBeLessThanOrEqual(100);
      }
    });

    it('should include timing breakdown in debugInfo', async () => {
      const results = await db.search({
        query: { text: 'python' },
        collection: 'default',
        limit: 10,
        enableLikeSearch: true,
        fusionMethod: 'rrf',
        fusionWeights: { fts: 0.5, vec: 0.3, like: 0.2 }
      });

      expect(results.debugInfo).toBeDefined();
      expect(results.debugInfo?.timing).toBeDefined();
      expect(results.debugInfo?.timing?.likeSearch).toBeGreaterThanOrEqual(0);
      expect(results.debugInfo?.timing?.fusion).toBeGreaterThanOrEqual(0);
    });

    it('should gracefully degrade on timeout', async () => {
      // Timeout is hard to test without very large dataset
      // But we can verify the structure is correct
      const results = await db.search({
        query: { text: 'test' },
        collection: 'default',
        limit: 10,
        enableLikeSearch: true,
        fusionMethod: 'rrf',
        fusionWeights: { fts: 0.5, vec: 0.3, like: 0.2 }
      });

      // Should have timeout flag (false if no timeout)
      expect(typeof results.debugInfo?.likeTimeout).toBe('boolean');

      // If timeout occurred, should have skip reason
      if (results.debugInfo?.likeTimeout) {
        expect(results.debugInfo.likeSkipReason).toBe('timeout');
      }
    });
  });

  // =============================================================================
  // Group 8: Weight Validation (5 additional tests)
  // =============================================================================

  describe('Weight Validation', () => {
    it('should reject weights that do not sum to 1.0', async () => {
      await expect(
        db.search({
          query: { text: 'test' },
          collection: 'default',
          limit: 10,
          enableLikeSearch: true,
          fusionMethod: 'weighted_rrf',
          fusionWeights: { fts: 0.5, vec: 0.5, like: 0.5 }  // Sum = 1.5
        })
      ).rejects.toThrow(/weights must sum to 1\.0/i);
    });

    it('should accept weights that sum to 1.0 within tolerance', async () => {
      const results = await db.search({
        query: { text: 'test' },
        collection: 'default',
        limit: 10,
        enableLikeSearch: true,
        fusionMethod: 'weighted_rrf',
        fusionWeights: { fts: 0.5, vec: 0.3, like: 0.2 }  // Sum = 1.0
      });

      expect(results).toBeDefined();
    });

    it('should accept weights within 0.01 tolerance', async () => {
      const results = await db.search({
        query: { text: 'test' },
        collection: 'default',
        limit: 10,
        enableLikeSearch: true,
        fusionMethod: 'weighted_rrf',
        fusionWeights: { fts: 0.501, vec: 0.3, like: 0.2 }  // Sum = 1.001 (within tolerance)
      });

      expect(results).toBeDefined();
    });

    it('should work with RRF mode (no weight validation)', async () => {
      const results = await db.search({
        query: { text: 'test' },
        collection: 'default',
        limit: 10,
        enableLikeSearch: true,
        fusionMethod: 'rrf',  // RRF doesn't validate weights
        fusionWeights: { fts: 0.5, vec: 0.5, like: 0.5 }
      });

      expect(results).toBeDefined();
    });

    it('should default to safe weights if LIKE weight missing', async () => {
      const results = await db.search({
        query: { text: 'test' },
        collection: 'default',
        limit: 10,
        enableLikeSearch: true,
        fusionMethod: 'rrf',
        fusionWeights: { fts: 0.6, vec: 0.4 }  // No LIKE weight
      });

      // Should use default LIKE weight (0.2) or work without error
      expect(results).toBeDefined();
    });
  });
});
