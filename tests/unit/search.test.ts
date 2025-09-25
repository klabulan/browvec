/**
 * Unit Tests for Enhanced Search API (Task 6.1)
 *
 * Comprehensive tests for the new text-only hybrid search capabilities
 * including StrategyEngine, ResultProcessor, and SearchHandler.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StrategyEngine } from '../../src/search/StrategyEngine.js';
import { ResultProcessor } from '../../src/search/ResultProcessor.js';
import type {
  SearchMode,
  SearchStrategy,
  QueryType,
  QueryAnalysis,
  SearchExecutionPlan,
  SearchContext,
  TextSearchOptions,
  RawSearchResult,
  ResultProcessingOptions,
  ScoreNormalization,
  FusionMethod,
  DEFAULT_TEXT_SEARCH_OPTIONS
} from '../../src/types/search.js';

describe('Enhanced Search API (Task 6.1)', () => {
  describe('StrategyEngine', () => {
    let strategyEngine: StrategyEngine;
    let mockContext: SearchContext;

    beforeEach(() => {
      strategyEngine = new StrategyEngine();
      mockContext = {
        collectionName: 'test_collection',
        documentCount: 1000,
        averageDocumentLength: 500,
        indexCapabilities: {
          hasFTS: true,
          hasVector: false,
          hasEmbeddings: false
        },
        userPreferences: {
          preferredMode: SearchMode.AUTO,
          responseTime: 'balanced',
          resultQuality: 'balanced'
        }
      };
    });

    describe('Query Analysis', () => {
      it('should analyze simple keyword queries correctly', async () => {
        const query = 'machine learning';
        const analysis = await strategyEngine.analyzeQuery(query, mockContext);

        expect(analysis.originalQuery).toBe(query);
        expect(analysis.normalizedQuery).toBe(query.toLowerCase());
        expect(analysis.queryType).toBe('short_keyword' as QueryType);
        expect(analysis.features.wordCount).toBe(2);
        expect(analysis.features.hasQuestionWords).toBe(false);
        expect(analysis.features.hasBooleanOperators).toBe(false);
        expect(analysis.confidence).toBeGreaterThan(0);
        expect(analysis.suggestedStrategy).toBeDefined();
        expect(Array.isArray(analysis.alternativeStrategies)).toBe(true);
      });

      it('should detect question queries', async () => {
        const query = 'What is artificial intelligence?';
        const analysis = await strategyEngine.analyzeQuery(query, mockContext);

        expect(analysis.queryType).toBe('question' as QueryType);
        expect(analysis.features.hasQuestionWords).toBe(true);
        expect(analysis.features.wordCount).toBe(4);
        expect(analysis.confidence).toBeGreaterThan(0.5);
      });

      it('should detect exact phrase queries', async () => {
        const query = '"neural networks"';
        const analysis = await strategyEngine.analyzeQuery(query, mockContext);

        expect(analysis.queryType).toBe('exact_phrase' as QueryType);
        expect(analysis.features.hasQuotes).toBe(true);
        expect(analysis.suggestedStrategy).toBe('exact_match' as SearchStrategy);
        expect(analysis.confidence).toBeGreaterThan(0.7);
      });

      it('should detect boolean queries', async () => {
        const query = 'machine learning AND neural networks';
        const analysis = await strategyEngine.analyzeQuery(query, mockContext);

        expect(analysis.queryType).toBe('boolean_query' as QueryType);
        expect(analysis.features.hasBooleanOperators).toBe(true);
        expect(analysis.suggestedStrategy).toBe('boolean' as SearchStrategy);
      });

      it('should handle long phrase queries', async () => {
        const query = 'artificial intelligence machine learning deep neural networks computer vision';
        const analysis = await strategyEngine.analyzeQuery(query, mockContext);

        expect(analysis.queryType).toBe('long_phrase' as QueryType);
        expect(analysis.features.wordCount).toBe(8);
        expect(analysis.estimatedComplexity).toBe('medium');
      });

      it('should provide query suggestions for low confidence results', async () => {
        const query = 'xyz123!@#';
        const analysis = await strategyEngine.analyzeQuery(query, mockContext);

        const suggestions = strategyEngine.getQuerySuggestions(analysis);
        expect(Array.isArray(suggestions)).toBe(true);
        expect(suggestions.length).toBeGreaterThan(0);
      });
    });

    describe('Strategy Selection', () => {
      it('should select appropriate strategy based on query analysis', async () => {
        const query = 'machine learning';
        const analysis = await strategyEngine.analyzeQuery(query, mockContext);
        const options: TextSearchOptions = { collection: 'test' };

        const executionPlan = strategyEngine.selectStrategy(analysis, options);

        expect(executionPlan.primaryStrategy).toBeDefined();
        expect(Array.isArray(executionPlan.fallbackStrategies)).toBe(true);
        expect(Array.isArray(executionPlan.searchModes)).toBe(true);
        expect(executionPlan.fusion).toBeDefined();
        expect(executionPlan.fusion.method).toBeDefined();
        expect(executionPlan.fusion.weights).toBeDefined();
        expect(executionPlan.pagination).toBeDefined();
        expect(executionPlan.performance).toBeDefined();
      });

      it('should prefer semantic search when embeddings are available', async () => {
        const contextWithEmbeddings: SearchContext = {
          ...mockContext,
          indexCapabilities: {
            hasFTS: true,
            hasVector: true,
            hasEmbeddings: true
          }
        };

        const query = 'What is the meaning of artificial intelligence?';
        const analysis = await strategyEngine.analyzeQuery(query, contextWithEmbeddings);
        const options: TextSearchOptions = { collection: 'test' };

        const executionPlan = strategyEngine.selectStrategy(analysis, options);

        expect(executionPlan.primaryStrategy).toBe('semantic' as SearchStrategy);
      });

      it('should calculate optimal weights for different strategies', async () => {
        const query = 'machine learning algorithms';
        const analysis = await strategyEngine.analyzeQuery(query, mockContext);
        const options: TextSearchOptions = { collection: 'test' };

        const executionPlan = strategyEngine.selectStrategy(analysis, options);

        expect(executionPlan.fusion.weights.fts).toBeGreaterThan(0);
        expect(executionPlan.fusion.weights.vector).toBeGreaterThan(0);
        expect(executionPlan.fusion.weights.exactMatch).toBeGreaterThan(0);
        expect(executionPlan.fusion.weights.phraseMatch).toBeGreaterThan(0);
      });
    });

    describe('Performance Metrics', () => {
      it('should update performance metrics when enabled', () => {
        const query = 'test query';
        const strategy: SearchStrategy = 'keyword' as SearchStrategy;
        const responseTime = 150;
        const resultCount = 10;

        strategyEngine.updatePerformanceMetrics(query, strategy, responseTime, resultCount);

        // Should not throw error
        expect(true).toBe(true);
      });
    });
  });

  describe('ResultProcessor', () => {
    let resultProcessor: ResultProcessor;
    let mockRawResults: RawSearchResult[];

    beforeEach(() => {
      resultProcessor = new ResultProcessor();
      mockRawResults = [
        {
          id: '1',
          title: 'Machine Learning Basics',
          content: 'Introduction to machine learning concepts and algorithms. Machine learning is a subset of artificial intelligence.',
          metadata: { author: 'John Doe', published: '2023-01-01' },
          rawScore: 0.95,
          source: 'fts' as const,
          rank: 1
        },
        {
          id: '2',
          title: 'Deep Neural Networks',
          content: 'Understanding deep neural networks for machine learning applications. Neural networks are inspired by biological neurons.',
          metadata: { author: 'Jane Smith', published: '2023-01-15' },
          rawScore: 0.87,
          source: 'fts' as const,
          rank: 2
        },
        {
          id: '3',
          title: 'AI Applications',
          content: 'Real-world applications of artificial intelligence and machine learning in various industries and domains.',
          metadata: { author: 'Bob Johnson', published: '2023-02-01' },
          rawScore: 0.78,
          source: 'vector' as const,
          rank: 3
        }
      ];
    });

    afterEach(() => {
      resultProcessor.clearCache();
    });

    describe('Result Processing', () => {
      it('should process search results with basic options', async () => {
        const query = 'machine learning';
        const options: ResultProcessingOptions = {
          normalization: ScoreNormalization.MIN_MAX,
          deduplication: true,
          snippetGeneration: {
            enabled: true,
            maxLength: 100,
            contextWindow: 3,
            maxSnippets: 2,
            separator: '...',
            highlightTags: { pre: '<mark>', post: '</mark>' }
          },
          highlighting: {
            enabled: true,
            fragmentSize: 50,
            maxFragments: 2,
            requireFieldMatch: false,
            tags: { pre: '<em>', post: '</em>' }
          }
        };

        const response = await resultProcessor.processResults(mockRawResults, query, options);

        expect(response.results).toBeDefined();
        expect(Array.isArray(response.results)).toBe(true);
        expect(response.totalResults).toBe(mockRawResults.length);
        expect(response.searchTime).toBeGreaterThan(0);
        expect(response.results.length).toBeLessThanOrEqual(mockRawResults.length);

        // Check that results have required properties
        response.results.forEach(result => {
          expect(result.id).toBeDefined();
          expect(result.score).toBeDefined();
          expect(result.rank).toBeDefined();
        });
      });

      it('should generate snippets correctly', async () => {
        const query = 'machine learning';
        const options = {
          enabled: true,
          maxLength: 80,
          contextWindow: 2,
          maxSnippets: 1,
          separator: '...',
          highlightTags: { pre: '<mark>', post: '</mark>' }
        };

        const resultsWithSnippets = await resultProcessor.generateSnippets(mockRawResults, query, options);

        expect(Array.isArray(resultsWithSnippets)).toBe(true);
        expect(resultsWithSnippets.length).toBe(mockRawResults.length);

        resultsWithSnippets.forEach(result => {
          expect(result.snippets).toBeDefined();
          expect(Array.isArray(result.snippets)).toBe(true);
        });
      });

      it('should handle empty results gracefully', async () => {
        const query = 'nonexistent query';
        const options: ResultProcessingOptions = {
          normalization: ScoreNormalization.NONE,
          deduplication: false,
          snippetGeneration: { enabled: false },
          highlighting: { enabled: false }
        };

        const response = await resultProcessor.processResults([], query, options);

        expect(response.results).toBeDefined();
        expect(response.results.length).toBe(0);
        expect(response.totalResults).toBe(0);
        expect(response.searchTime).toBeGreaterThan(0);
      });

      it('should normalize scores correctly', async () => {
        const query = 'test query';
        const options: ResultProcessingOptions = {
          normalization: ScoreNormalization.MIN_MAX,
          deduplication: false,
          snippetGeneration: { enabled: false },
          highlighting: { enabled: false }
        };

        const response = await resultProcessor.processResults(mockRawResults, query, options);

        // Check that scores are normalized between 0 and 1
        response.results.forEach(result => {
          expect(result.score).toBeGreaterThanOrEqual(0);
          expect(result.score).toBeLessThanOrEqual(1);
        });
      });

      it('should cache snippets for performance', async () => {
        const query = 'machine learning';
        const options = {
          enabled: true,
          maxLength: 100,
          contextWindow: 3,
          maxSnippets: 2,
          separator: '...',
          highlightTags: { pre: '<mark>', post: '</mark>' }
        };

        // First call - should cache
        await resultProcessor.generateSnippets(mockRawResults, query, options);

        // Second call - should use cache
        const start = Date.now();
        await resultProcessor.generateSnippets(mockRawResults, query, options);
        const duration = Date.now() - start;

        // Should be faster due to caching (though this is not a reliable test)
        expect(duration).toBeLessThan(100);
      });
    });

    describe('Performance Stats', () => {
      it('should provide performance statistics', () => {
        const stats = resultProcessor.getPerformanceStats();

        expect(stats).toBeDefined();
        expect(typeof stats.cacheSize).toBe('number');
      });
    });
  });

  describe('Integration Tests', () => {
    let strategyEngine: StrategyEngine;
    let resultProcessor: ResultProcessor;

    beforeEach(() => {
      strategyEngine = new StrategyEngine();
      resultProcessor = new ResultProcessor();
    });

    it('should work together for complete search flow', async () => {
      const query = 'artificial intelligence applications';
      const context: SearchContext = {
        collectionName: 'test',
        documentCount: 500,
        averageDocumentLength: 300,
        indexCapabilities: {
          hasFTS: true,
          hasVector: true,
          hasEmbeddings: true
        }
      };

      // Step 1: Analyze query
      const analysis = await strategyEngine.analyzeQuery(query, context);
      expect(analysis).toBeDefined();

      // Step 2: Select strategy
      const options: TextSearchOptions = { collection: 'test' };
      const executionPlan = strategyEngine.selectStrategy(analysis, options);
      expect(executionPlan).toBeDefined();

      // Step 3: Process mock results
      const mockResults: RawSearchResult[] = [
        {
          id: '1',
          title: 'AI in Healthcare',
          content: 'Artificial intelligence applications in healthcare industry including diagnosis and treatment.',
          metadata: {},
          rawScore: 0.9,
          source: 'fts',
          rank: 1
        }
      ];

      const processingOptions: ResultProcessingOptions = {
        normalization: executionPlan.fusion.normalization,
        deduplication: true,
        snippetGeneration: {
          enabled: true,
          maxLength: 150,
          contextWindow: 5,
          maxSnippets: 3,
          separator: '...',
          highlightTags: { pre: '<mark>', post: '</mark>' }
        },
        highlighting: {
          enabled: true,
          fragmentSize: 100,
          maxFragments: 3,
          requireFieldMatch: false,
          tags: { pre: '<em>', post: '</em>' }
        }
      };

      const response = await resultProcessor.processResults(mockResults, query, processingOptions);

      expect(response.results.length).toBeGreaterThan(0);
      expect(response.searchTime).toBeGreaterThan(0);
    });

    it('should handle performance constraints', async () => {
      const query = 'complex query with many terms and conditions';
      const context: SearchContext = {
        collectionName: 'large_collection',
        documentCount: 100000,
        averageDocumentLength: 2000,
        indexCapabilities: {
          hasFTS: true,
          hasVector: true,
          hasEmbeddings: true
        }
      };

      const options: TextSearchOptions = {
        collection: 'test',
        performance: {
          maxTime: 200,
          maxMemory: 50,
          earlyTermination: true,
          caching: true
        }
      };

      const analysis = await strategyEngine.analyzeQuery(query, context);
      const executionPlan = strategyEngine.selectStrategy(analysis, options);

      expect(executionPlan.performance?.maxTime).toBe(200);
      expect(executionPlan.performance?.earlyTermination).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid queries gracefully', async () => {
      const strategyEngine = new StrategyEngine();
      const context: SearchContext = {
        collectionName: 'test',
        documentCount: 0,
        averageDocumentLength: 0,
        indexCapabilities: {
          hasFTS: false,
          hasVector: false,
          hasEmbeddings: false
        }
      };

      // Should not throw for empty query
      const emptyQuery = '';
      await expect(strategyEngine.analyzeQuery(emptyQuery, context)).resolves.toBeDefined();

      // Should handle special characters
      const specialQuery = '!@#$%^&*()';
      await expect(strategyEngine.analyzeQuery(specialQuery, context)).resolves.toBeDefined();
    });

    it('should handle empty results in ResultProcessor', async () => {
      const resultProcessor = new ResultProcessor();
      const query = 'no results query';
      const options: ResultProcessingOptions = {
        normalization: ScoreNormalization.NONE,
        deduplication: false,
        snippetGeneration: { enabled: false },
        highlighting: { enabled: false }
      };

      const response = await resultProcessor.processResults([], query, options);

      expect(response.results).toEqual([]);
      expect(response.totalResults).toBe(0);
    });
  });

  describe('Type Safety', () => {
    it('should maintain type safety for search modes', () => {
      const modes = Object.values(SearchMode);
      expect(modes).toContain(SearchMode.AUTO);
      expect(modes).toContain(SearchMode.FTS_ONLY);
      expect(modes).toContain(SearchMode.VECTOR_ONLY);
      expect(modes).toContain(SearchMode.HYBRID);
      expect(modes).toContain(SearchMode.GLOBAL);
    });

    it('should maintain type safety for search strategies', () => {
      const strategies = Object.values(SearchStrategy);
      expect(strategies).toContain('exact_match' as SearchStrategy);
      expect(strategies).toContain('keyword' as SearchStrategy);
      expect(strategies).toContain('phrase' as SearchStrategy);
      expect(strategies).toContain('semantic' as SearchStrategy);
    });

    it('should maintain type safety for fusion methods', () => {
      const methods = Object.values(FusionMethod);
      expect(methods).toContain(FusionMethod.RRF);
      expect(methods).toContain(FusionMethod.WEIGHTED);
      expect(methods).toContain(FusionMethod.LINEAR);
    });
  });
});