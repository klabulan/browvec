/**
 * SearchHandler для LocalRetrieve Worker
 *
 * Обрабатывает расширенные поисковые запросы с использованием StrategyEngine и ResultProcessor.
 * Реализует интеллектуальный выбор стратегии поиска и комплексную обработку результатов.
 *
 * Интеграция с Task 6.2 Internal Embedding Generation Pipeline:
 * - Автоматическая генерация эмбеддингов для поисковых запросов
 * - Многоуровневое кэширование embedding результатов
 * - Оптимизированное управление моделями
 */

import { BaseHandler, type HandlerDependencies } from './BaseHandler.js';
import { StrategyEngine } from '../../../search/StrategyEngine.js';
import { ResultProcessor } from '../../../search/ResultProcessor.js';
import type { InternalPipeline } from '../../../pipeline/InternalPipeline.js';
import { createInternalPipeline } from '../../../pipeline/InternalPipeline.js';
import { createCacheManager } from '../../../cache/CacheManager.js';
import { createModelManager } from '../../../pipeline/ModelManager.js';
import type {
  TextSearchParams,
  AdvancedSearchParams,
  GlobalSearchParams,
  EnhancedSearchResponse,
  GlobalSearchResponse,
  SearchRequest,
  SearchResponse,
  SearchResult,
  QueryResult
} from '../../../types/worker.js';
import {
  SearchStrategy,
  SearchMode,
  ScoreNormalization,
  FusionMethod,
  DEFAULT_TEXT_SEARCH_OPTIONS,
  SearchError,
  QueryAnalysisError,
  StrategySelectionError,
  ResultProcessingError
} from '../../../types/search.js';
import type {
  SearchContext,
  QueryAnalysis,
  SearchExecutionPlan,
  RawSearchResult,
  ResultProcessingOptions,
  SearchDebugInfo
} from '../../../types/search.js';

/**
 * Основной обработчик поисковых запросов в worker'е с интеграцией embedding pipeline
 */
export class SearchHandler extends BaseHandler {
  private strategyEngine: StrategyEngine;
  private resultProcessor: ResultProcessor;
  private searchMetrics: Map<string, { count: number; avgTime: number; errors: number }>;
  private contextCache: Map<string, SearchContext>;

  // Task 6.2: Internal Embedding Generation Pipeline
  private embeddingPipeline: InternalPipeline | null;
  private pipelineInitialized: Promise<void>;

  getComponentName(): string {
    return 'SearchHandler';
  }

  constructor(dependencies: HandlerDependencies) {
    super(dependencies);

    this.strategyEngine = new StrategyEngine();
    this.resultProcessor = new ResultProcessor();
    this.searchMetrics = new Map();
    this.contextCache = new Map();

    // Инициализация embedding pipeline
    this.embeddingPipeline = null;
    this.pipelineInitialized = this.initializeEmbeddingPipeline();
  }

  /**
   * Инициализация системы генерации эмбеддингов
   */
  private async initializeEmbeddingPipeline(): Promise<void> {
    try {
      this.log('info', 'Initializing embedding pipeline for SearchHandler');

      // Создаем компоненты pipeline
      const cacheManager = createCacheManager({
        memorySize: 500, // 500 элементов в memory cache
        indexedDBName: 'LocalRetrieve_SearchCache',
        dbVersion: 1
      });

      const modelManager = createModelManager({
        memoryLimit: 200, // 200MB для моделей в поиске
        maxModels: 3, // Максимум 3 модели одновременно
        idleTimeout: 15 * 60 * 1000, // 15 минут неактивности
        cleanupInterval: 10 * 60 * 1000 // Очистка каждые 10 минут
      });

      this.embeddingPipeline = await createInternalPipeline(cacheManager, modelManager);

      // Предзагрузка наиболее часто используемых моделей
      await modelManager.preloadModels('predictive');

      this.log('info', 'Embedding pipeline initialized successfully');
    } catch (error) {
      this.log('error', 'Failed to initialize embedding pipeline', { error });
      // Продолжаем работу без embedding pipeline (fallback к FTS-only)
    }
  }


  /**
   * Обработка интеллектуального текстового поиска
   */
  async handleSearchText(params: TextSearchParams): Promise<EnhancedSearchResponse> {
    const startTime = Date.now();
    const methodName = 'searchText';

    try {
      this.log('info', 'Starting intelligent text search', { query: params.query, options: params.options });

      // Валидация параметров
      this.validateSearchParams(params.query, params.options);

      // Получение или создание контекста поиска
      const context = await this.getSearchContext(params.options?.collection);

      // Анализ запроса и выбор стратегии
      const analysis = await this.strategyEngine.analyzeQuery(params.query, context);
      this.log('debug', 'Query analysis completed', { analysis });

      // Создание плана выполнения
      const mergedOptions = { ...DEFAULT_TEXT_SEARCH_OPTIONS, ...params.options };
      const executionPlan = this.strategyEngine.selectStrategy(analysis, mergedOptions);
      this.log('debug', 'Execution plan created', { plan: executionPlan });

      // Выполнение поиска
      const rawResults = await this.executeSearch(executionPlan, params.query, context);

      // Обработка результатов
      const processedResponse = await this.processSearchResults(
        rawResults,
        params.query,
        executionPlan,
        analysis
      );

      // Обновление метрик производительности
      const responseTime = Date.now() - startTime;
      this.updateSearchMetrics(methodName, responseTime, processedResponse.results.length, false);
      this.strategyEngine.updatePerformanceMetrics(params.query, executionPlan.primaryStrategy, responseTime, processedResponse.results.length);

      this.log('info', 'Text search completed successfully', {
        query: params.query,
        strategy: executionPlan.primaryStrategy,
        resultCount: processedResponse.results.length,
        responseTime
      });

      return {
        ...processedResponse,
        strategy: executionPlan.primaryStrategy,
        fusion: executionPlan.fusion.method,
        suggestions: this.strategyEngine.getQuerySuggestions(analysis),
        debugInfo: {
          queryAnalysis: analysis,
          executionPlan,
          timings: {
            analysis: 0, // Будет обновлено в будущих версиях
            planning: 0,
            execution: responseTime - 100, // Приблизительное время выполнения
            fusion: 50, // Приблизительное время fusion
            total: responseTime
          },
          indexUsage: {
            ftsIndex: executionPlan.searchModes.includes(SearchMode.FTS_ONLY) || executionPlan.searchModes.includes(SearchMode.HYBRID),
            vectorIndex: executionPlan.searchModes.includes(SearchMode.VECTOR_ONLY) || executionPlan.searchModes.includes(SearchMode.HYBRID)
          },
          warnings: this.generateSearchWarnings(analysis, executionPlan, processedResponse),
          recommendations: this.generateSearchRecommendations(analysis, executionPlan, processedResponse)
        }
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateSearchMetrics(methodName, responseTime, 0, true);

      this.log('error', 'Text search failed', { query: params.query, error });

      if (error instanceof SearchError) {
        throw error;
      }

      throw new SearchError(
        `Text search failed: ${error instanceof Error ? error.message : String(error)}`,
        'TEXT_SEARCH_ERROR',
        { query: params.query, options: params.options }
      );
    }
  }

  /**
   * Обработка расширенного поиска с настраиваемыми параметрами
   */
  async handleSearchAdvanced(params: AdvancedSearchParams): Promise<EnhancedSearchResponse> {
    const startTime = Date.now();
    const methodName = 'searchAdvanced';

    try {
      this.log('info', 'Starting advanced search', { query: params.query, collections: params.collections });

      // Валидация параметров
      this.validateAdvancedSearchParams(params);

      // Если указаны коллекции, выполняем поиск по каждой
      const collections = params.collections || [params.collections?.[0] || 'default'];
      const searchPromises = collections.map(collection =>
        this.executeAdvancedSearchForCollection(params, collection)
      );

      const collectionResults = await Promise.all(searchPromises);

      // Объединяем результаты с разных коллекций
      const mergedResults = this.mergeCollectionResults(collectionResults, params);

      // Применяем глобальную обработку результатов
      const finalResults = await this.applyAdvancedResultProcessing(mergedResults, params);

      const responseTime = Date.now() - startTime;
      this.updateSearchMetrics(methodName, responseTime, finalResults.results.length, false);

      this.log('info', 'Advanced search completed', {
        query: params.query,
        collections: collections.length,
        resultCount: finalResults.results.length,
        responseTime
      });

      return {
        ...finalResults,
        debugInfo: {
          queryAnalysis: finalResults.debugInfo?.queryAnalysis || {
            originalQuery: '',
            normalizedQuery: '',
            queryType: 'unknown' as any,
            confidence: 0.5,
            features: {
              wordCount: 1,
              hasQuestionWords: false,
              hasBooleanOperators: false,
              hasWildcards: false,
              hasQuotes: false,
              hasNumbers: false,
              hasSpecialCharacters: false,
              averageWordLength: 5,
              containsCommonStopWords: false,
              estimatedIntent: 'search'
            },
            suggestedStrategy: 'keyword' as any,
            alternativeStrategies: [],
            estimatedComplexity: 'low'
          },
          executionPlan: finalResults.debugInfo?.executionPlan || {
            primaryStrategy: 'keyword' as any,
            fallbackStrategies: [],
            searchModes: [],
            fusion: {
              method: 'rrf' as any,
              weights: {
                fts: 1,
                vector: 0,
                exactMatch: 1,
                phraseMatch: 1,
                proximity: 0.5,
                freshness: 0.1,
                popularity: 0.1
              },
              normalization: 'none' as any
            },
            filters: {},
            pagination: { limit: 20, offset: 0 },
            performance: {}
          },
          timings: {
            analysis: 0,
            planning: 0,
            execution: responseTime - 100,
            fusion: 50,
            total: responseTime
          },
          indexUsage: finalResults.debugInfo?.indexUsage || {
            ftsIndex: true,
            vectorIndex: false
          },
          warnings: finalResults.debugInfo?.warnings || [],
          recommendations: finalResults.debugInfo?.recommendations || []
        }
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateSearchMetrics(methodName, responseTime, 0, true);

      this.log('error', 'Advanced search failed', { query: params.query, error });

      throw new SearchError(
        `Advanced search failed: ${error instanceof Error ? error.message : String(error)}`,
        'ADVANCED_SEARCH_ERROR',
        { query: params.query, collections: params.collections }
      );
    }
  }

  /**
   * Обработка глобального поиска по всем коллекциям
   */
  async handleSearchGlobal(params: GlobalSearchParams): Promise<GlobalSearchResponse> {
    const startTime = Date.now();
    const methodName = 'searchGlobal';

    try {
      this.log('info', 'Starting global search', { query: params.query, options: params.options });

      // Получение списка доступных коллекций
      const allCollections = await this.getAvailableCollections();
      this.log('debug', 'Found collections for global search', { collections: allCollections });

      // Фильтрация коллекций по настройкам
      const targetCollections = this.filterCollectionsForGlobalSearch(allCollections, params.options);

      // Выполнение поиска по каждой коллекции
      const collectionSearchPromises = targetCollections.map(collection =>
        this.executeGlobalSearchForCollection(params.query, collection, params.options)
      );

      const collectionResults = await Promise.all(collectionSearchPromises);

      // Применение стратегии объединения результатов
      const mergedResponse = this.mergeGlobalSearchResults(
        collectionResults,
        params.query,
        params.options
      );

      const responseTime = Date.now() - startTime;
      this.updateSearchMetrics(methodName, responseTime, mergedResponse.results.length, false);

      this.log('info', 'Global search completed', {
        query: params.query,
        collectionsSearched: targetCollections.length,
        totalResults: mergedResponse.results.length,
        responseTime
      });

      return {
        ...mergedResponse,
        collectionsSearched: targetCollections,
        debugInfo: {
          queryAnalysis: mergedResponse.debugInfo?.queryAnalysis || {
            originalQuery: '',
            normalizedQuery: '',
            queryType: 'unknown' as any,
            confidence: 0.5,
            features: {
              wordCount: 1,
              hasQuestionWords: false,
              hasBooleanOperators: false,
              hasWildcards: false,
              hasQuotes: false,
              hasNumbers: false,
              hasSpecialCharacters: false,
              averageWordLength: 5,
              containsCommonStopWords: false,
              estimatedIntent: 'search'
            },
            suggestedStrategy: 'keyword' as any,
            alternativeStrategies: [],
            estimatedComplexity: 'low'
          },
          executionPlan: mergedResponse.debugInfo?.executionPlan || {
            primaryStrategy: 'keyword' as any,
            fallbackStrategies: [],
            searchModes: [],
            fusion: {
              method: 'rrf' as any,
              weights: {
                fts: 1,
                vector: 0,
                exactMatch: 1,
                phraseMatch: 1,
                proximity: 0.5,
                freshness: 0.1,
                popularity: 0.1
              },
              normalization: 'none' as any
            },
            filters: {},
            pagination: { limit: 20, offset: 0 },
            performance: {}
          },
          timings: {
            analysis: 0,
            planning: 0,
            execution: responseTime - 100,
            fusion: 50,
            total: responseTime
          },
          indexUsage: mergedResponse.debugInfo?.indexUsage || {
            ftsIndex: true,
            vectorIndex: false
          },
          warnings: mergedResponse.debugInfo?.warnings || [],
          recommendations: mergedResponse.debugInfo?.recommendations || []
        }
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.updateSearchMetrics(methodName, responseTime, 0, true);

      this.log('error', 'Global search failed', { query: params.query, error });

      throw new SearchError(
        `Global search failed: ${error instanceof Error ? error.message : String(error)}`,
        'GLOBAL_SEARCH_ERROR',
        { query: params.query, options: params.options }
      );
    }
  }

  /**
   * Получение контекста поиска для коллекции
   */
  private async getSearchContext(collectionName?: string): Promise<SearchContext> {
    const cacheKey = collectionName || 'default';

    if (this.contextCache.has(cacheKey)) {
      return this.contextCache.get(cacheKey)!;
    }

    try {
      const collection = collectionName || 'default';

      // Получаем информацию о коллекции
      const collectionInfo = await this.getCollectionInfo(collection);

      // Определяем возможности индексов
      const indexCapabilities = await this.getIndexCapabilities(collection);

      const context: SearchContext = {
        collectionName: collection,
        documentCount: collectionInfo.documentCount,
        averageDocumentLength: collectionInfo.averageDocumentLength || 500, // Значение по умолчанию
        indexCapabilities,
        userPreferences: {
          preferredMode: SearchMode.AUTO,
          responseTime: 'balanced',
          resultQuality: 'balanced'
        }
      };

      // Кэшируем контекст на 5 минут
      this.contextCache.set(cacheKey, context);
      setTimeout(() => this.contextCache.delete(cacheKey), 5 * 60 * 1000);

      return context;

    } catch (error) {
      this.log('warn', 'Failed to get search context, using default', { collection: collectionName, error });

      // Возвращаем базовый контекст в случае ошибки
      return {
        collectionName: collectionName || 'default',
        documentCount: 0,
        averageDocumentLength: 500,
        indexCapabilities: {
          hasFTS: true,
          hasVector: false,
          hasEmbeddings: false
        }
      };
    }
  }

  /**
   * Получение информации о коллекции
   */
  private async getCollectionInfo(collection: string): Promise<{ documentCount: number; averageDocumentLength?: number }> {
    try {
      // Получаем количество документов
      const countResult = await this.sqliteManager.select(`SELECT COUNT(*) as count FROM docs_${collection}`);
      const documentCount = countResult.rows[0]?.count as number || 0;

      // Получаем среднюю длину документов
      const lengthResult = await this.sqliteManager.select(`
        SELECT AVG(LENGTH(content)) as avg_length
        FROM docs_${collection}
        WHERE content IS NOT NULL
      `);
      const averageDocumentLength = lengthResult.rows[0]?.avg_length as number || 500;

      return { documentCount, averageDocumentLength };

    } catch (error) {
      this.log('warn', 'Failed to get collection info', { collection, error });
      return { documentCount: 0, averageDocumentLength: 500 };
    }
  }

  /**
   * Определение возможностей индексов для коллекции
   */
  private async getIndexCapabilities(collection: string): Promise<{ hasFTS: boolean; hasVector: boolean; hasEmbeddings: boolean }> {
    try {
      // Проверяем наличие FTS индекса
      const ftsResult = await this.sqliteManager.select(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='fts_${collection}'
      `);
      const hasFTS = ftsResult.rows.length > 0;

      // Проверяем наличие векторного индекса
      const vecResult = await this.sqliteManager.select(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name='vec_${collection}_dense'
      `);
      const hasVector = vecResult.rows.length > 0;

      // Проверяем наличие embeddings (проверяем наличие непустых векторов)
      let hasEmbeddings = false;
      if (hasVector) {
        const embeddingResult = await this.sqliteManager.select(`
          SELECT COUNT(*) as count FROM vec_${collection}_dense
          WHERE embedding IS NOT NULL LIMIT 1
        `);
        hasEmbeddings = (embeddingResult.rows[0]?.count as number || 0) > 0;
      }

      return { hasFTS, hasVector, hasEmbeddings };

    } catch (error) {
      this.log('warn', 'Failed to get index capabilities', { collection, error });
      return { hasFTS: true, hasVector: false, hasEmbeddings: false };
    }
  }

  /**
   * Выполнение поиска согласно плану
   */
  private async executeSearch(
    plan: SearchExecutionPlan,
    query: string,
    context: SearchContext
  ): Promise<RawSearchResult[]> {
    const results: RawSearchResult[] = [];

    for (const mode of plan.searchModes) {
      switch (mode) {
        case SearchMode.FTS_ONLY:
          const ftsResults = await this.executeFTSSearch(query, context.collectionName || 'default', plan);
          results.push(...ftsResults);
          break;

        case SearchMode.VECTOR_ONLY:
          if (context.indexCapabilities.hasEmbeddings) {
            const vecResults = await this.executeVectorSearch(query, context.collectionName || 'default', plan);
            results.push(...vecResults);
          }
          break;

        case SearchMode.HYBRID:
          const hybridResults = await this.executeHybridSearch(query, context.collectionName || 'default', plan);
          results.push(...hybridResults);
          break;
      }
    }

    return results;
  }

  /**
   * Выполнение полнотекстового поиска
   */
  private async executeFTSSearch(
    query: string,
    collection: string,
    plan: SearchExecutionPlan
  ): Promise<RawSearchResult[]> {
    try {
      // Use SQLiteManager methods directly instead of getDatabase()

      // Подготавливаем FTS запрос
      const ftsQuery = this.prepareFTSQuery(query, plan.primaryStrategy);

      const sql = `
        SELECT
          d.id,
          d.title,
          d.content,
          d.metadata,
          bm25(fts_${collection}) as score
        FROM fts_${collection} fts
        JOIN docs_${collection} d ON d.id = fts.id
        WHERE fts MATCH ?
        ORDER BY score
        LIMIT ?
      `;

      const result = await this.sqliteManager.select(sql, [ftsQuery, plan.pagination.limit]);

      return this.parseSearchResults(result, 'fts');

    } catch (error) {
      this.log('warn', 'FTS search failed, returning empty results', { query, collection, error });
      return [];
    }
  }

  /**
   * Выполнение векторного поиска с использованием Internal Embedding Pipeline
   */
  private async executeVectorSearch(
    query: string,
    collection: string,
    plan: SearchExecutionPlan
  ): Promise<RawSearchResult[]> {
    try {
      // Убеждаемся что pipeline инициализирован
      await this.pipelineInitialized;

      if (!this.embeddingPipeline) {
        this.log('warn', 'Embedding pipeline not available, skipping vector search');
        return [];
      }

      // Генерируем embedding для поискового запроса
      const startTime = Date.now();
      const embeddingResult = await this.embeddingPipeline.generateQueryEmbedding(
        query,
        collection,
        {
          timeout: 5000, // 5 секунд таймаут для generation
          context: {
            source: 'vector_search',
            sessionId: 'search_session' // В реальной реализации можно передать ID сессии
          }
        }
      );

      const embeddingTime = Date.now() - startTime;
      this.log('debug', 'Query embedding generated', {
        query: query.substring(0, 50),
        embeddingTime,
        dimensions: embeddingResult.dimensions,
        source: embeddingResult.source,
        cacheHit: embeddingResult.metadata?.cacheHit
      });

      // Выполняем векторный поиск в SQLite
      const vectorSearchStartTime = Date.now();
      const searchResults = await this.performVectorSimilaritySearch(
        embeddingResult.embedding,
        collection,
        plan
      );

      const vectorSearchTime = Date.now() - vectorSearchStartTime;
      this.log('debug', 'Vector similarity search completed', {
        resultCount: searchResults.length,
        searchTime: vectorSearchTime
      });

      return searchResults;

    } catch (error) {
      this.log('warn', 'Vector search failed, returning empty results', { query, collection, error });
      return [];
    }
  }

  /**
   * Выполнение similarity search в SQLite векторной таблице
   */
  private async performVectorSimilaritySearch(
    queryEmbedding: Float32Array,
    collection: string,
    plan: SearchExecutionPlan
  ): Promise<RawSearchResult[]> {
    try {
      // Конвертируем Float32Array в blob для SQLite
      const embeddingBlob = new Uint8Array(queryEmbedding.buffer);

      // Выполняем векторный поиск используя sqlite-vec расширение
      const sql = `
        SELECT
          d.id,
          d.title,
          d.content,
          d.metadata,
          vec_distance_cosine(v.embedding, ?) as distance
        FROM vec_${collection}_dense v
        JOIN docs_${collection} d ON d.rowid = v.rowid
        WHERE v.embedding IS NOT NULL
        ORDER BY distance ASC
        LIMIT ?
      `;

      const result = await this.sqliteManager.select(sql, [embeddingBlob, plan.pagination.limit]);

      // Конвертируем distance в score (меньшее расстояние = больший score)
      return result.rows.map((row: any, index: number) => ({
        id: String(row.id),
        title: row.title ? String(row.title) : undefined,
        content: row.content ? String(row.content) : undefined,
        metadata: row.metadata ? JSON.parse(String(row.metadata)) : {},
        rawScore: 1.0 - Math.min(row.distance, 1.0), // Инвертируем distance в score [0,1]
        source: 'vector' as const,
        rank: index + 1
      }));

    } catch (error) {
      this.log('error', 'Vector similarity search failed', { error });
      throw error;
    }
  }

  /**
   * Выполнение гибридного поиска
   */
  private async executeHybridSearch(
    query: string,
    collection: string,
    plan: SearchExecutionPlan
  ): Promise<RawSearchResult[]> {
    try {
      // Выполняем оба типа поиска параллельно
      const [ftsResults, vecResults] = await Promise.all([
        this.executeFTSSearch(query, collection, plan),
        this.executeVectorSearch(query, collection, plan)
      ]);

      // Объединяем результаты согласно стратегии fusion
      return this.fuseSearchResults(ftsResults, vecResults, plan.fusion);

    } catch (error) {
      this.log('warn', 'Hybrid search failed, falling back to FTS', { query, collection, error });
      return this.executeFTSSearch(query, collection, plan);
    }
  }

  /**
   * Объединение результатов FTS и векторного поиска
   */
  private fuseSearchResults(
    ftsResults: RawSearchResult[],
    vecResults: RawSearchResult[],
    fusionConfig: SearchExecutionPlan['fusion']
  ): RawSearchResult[] {
    // Простая реализация RRF (Reciprocal Rank Fusion)
    const resultMap = new Map<string, RawSearchResult & { ftsRank?: number; vecRank?: number; fusedScore?: number }>();

    // Обрабатываем FTS результаты
    ftsResults.forEach((result, index) => {
      const enhanced = { ...result, ftsRank: index + 1 };
      resultMap.set(result.id, enhanced);
    });

    // Обрабатываем векторные результаты
    vecResults.forEach((result, index) => {
      const existing = resultMap.get(result.id);
      if (existing) {
        existing.vecRank = index + 1;
      } else {
        resultMap.set(result.id, { ...result, vecRank: index + 1 });
      }
    });

    // Вычисляем RRF score
    const k = 60; // RRF parameter
    const fusedResults = Array.from(resultMap.values()).map(result => {
      const ftsScore = result.ftsRank ? 1 / (k + result.ftsRank) : 0;
      const vecScore = result.vecRank ? 1 / (k + result.vecRank) : 0;

      const fusedScore = fusionConfig.weights.fts * ftsScore + fusionConfig.weights.vector * vecScore;

      return {
        ...result,
        rawScore: fusedScore,
        fusedScore
      };
    });

    // Сортируем по объединенной оценке
    return fusedResults
      .sort((a, b) => (b.fusedScore || 0) - (a.fusedScore || 0))
      .slice(0, 20); // Ограничиваем результаты
  }

  /**
   * Обработка результатов поиска
   */
  private async processSearchResults(
    rawResults: RawSearchResult[],
    query: string,
    plan: SearchExecutionPlan,
    analysis: QueryAnalysis
  ): Promise<SearchResponse> {
    const processingOptions: ResultProcessingOptions = {
      normalization: plan.fusion.normalization,
      deduplication: true,
      clustering: false, // Отключаем для простоты
      reranking: { enabled: false }, // Отключаем для простоты
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

    return this.resultProcessor.processResults(rawResults, query, processingOptions);
  }

  /**
   * Подготовка FTS запроса в зависимости от стратегии
   */
  private prepareFTSQuery(query: string, strategy: SearchStrategy): string {
    switch (strategy) {
      case SearchStrategy.EXACT_MATCH:
        return `"${query}"`;

      case SearchStrategy.PHRASE:
        return `"${query}"`;

      case SearchStrategy.BOOLEAN:
        return query; // Предполагаем, что пользователь уже указал операторы

      case SearchStrategy.FUZZY:
        // SQLite FTS не поддерживает нечеткий поиск напрямую
        return query.split(' ').map(word => `${word}*`).join(' OR ');

      default:
        return query;
    }
  }

  /**
   * Парсинг результатов запроса SQLite в RawSearchResult
   */
  private parseSearchResults(result: QueryResult, source: 'fts' | 'vector' | 'hybrid'): RawSearchResult[] {
    if (!result || !result.rows || result.rows.length === 0) {
      return [];
    }

    return result.rows.map((row: Record<string, any>, index: number) => ({
      id: String(row.id),
      title: row.title ? String(row.title) : undefined,
      content: row.content ? String(row.content) : undefined,
      metadata: row.metadata ? JSON.parse(String(row.metadata)) : {},
      rawScore: typeof row.score === 'number' ? row.score : 0,
      source,
      rank: index + 1
    }));
  }

  // Вспомогательные методы для валидации
  private validateSearchParams(query: string, options?: any): void {
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      throw new QueryAnalysisError('Query must be a non-empty string');
    }

    if (query.length > 1000) {
      throw new QueryAnalysisError('Query is too long (max 1000 characters)');
    }
  }

  private validateAdvancedSearchParams(params: AdvancedSearchParams): void {
    this.validateSearchParams(params.query);

    if (params.collections && !Array.isArray(params.collections)) {
      throw new StrategySelectionError('Collections must be an array');
    }
  }

  // Заглушки для методов, которые будут реализованы в будущих итерациях
  private async executeAdvancedSearchForCollection(params: AdvancedSearchParams, collection: string): Promise<any> {
    // Заглушка - будет реализовано
    return { collection, results: [], total: 0 };
  }

  private mergeCollectionResults(results: any[], params: AdvancedSearchParams): any {
    // Заглушка - будет реализовано
    return { results: [], total: 0 };
  }

  private async applyAdvancedResultProcessing(results: any, params: AdvancedSearchParams): Promise<EnhancedSearchResponse> {
    // Заглушка - будет реализовано
    return { results: [], totalResults: 0, searchTime: 0, strategy: 'keyword' as any };
  }

  private async getAvailableCollections(): Promise<string[]> {
    try {
      // Use SQLiteManager methods directly instead of getDatabase()
      const result = await this.sqliteManager.select(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name LIKE 'docs_%'
      `);

      return result.rows?.map(row => String(row.name).replace('docs_', '')) || ['default'];
    } catch {
      return ['default'];
    }
  }

  private filterCollectionsForGlobalSearch(collections: string[], options?: any): string[] {
    if (!options) return collections.slice(0, 10); // Ограничиваем по умолчанию

    let filtered = collections;

    if (options.maxCollections) {
      filtered = filtered.slice(0, options.maxCollections);
    }

    if (options.collectionFilter) {
      filtered = filtered.filter(options.collectionFilter);
    }

    return filtered;
  }

  private async executeGlobalSearchForCollection(query: string, collection: string, options?: any): Promise<any> {
    // Заглушка - базовый поиск по коллекции
    try {
      const searchRequest: SearchRequest = {
        query: { text: query },
        collection,
        limit: 5 // Ограничиваем для глобального поиска
      };

      // Используем существующий метод поиска
      const context = await this.getSearchContext(collection);
      const analysis = await this.strategyEngine.analyzeQuery(query, context);
      const plan = this.strategyEngine.selectStrategy(analysis, { collection });
      const rawResults = await this.executeSearch(plan, query, context);

      return {
        collection,
        results: rawResults.slice(0, 5),
        total: rawResults.length
      };

    } catch (error) {
      this.log('warn', 'Global search failed for collection', { collection, error });
      return { collection, results: [], total: 0 };
    }
  }

  private mergeGlobalSearchResults(
    collectionResults: any[],
    query: string,
    options?: any
  ): GlobalSearchResponse {
    // Простое объединение результатов из разных коллекций
    const allResults: SearchResult[] = [];
    const collectionGroups: GlobalSearchResponse['collectionResults'] = [];

    collectionResults.forEach(({ collection, results, total }) => {
      collectionGroups.push({ collection, results, totalInCollection: total });
      allResults.push(...results.map((r: any) => ({ ...r, collection })));
    });

    // Сортируем по оценке релевантности
    allResults.sort((a, b) => b.score - a.score);

    return {
      results: allResults.slice(0, 20), // Ограничиваем общие результаты
      totalResults: allResults.length,
      searchTime: 0, // Будет установлено вызывающим кодом
      strategy: 'keyword' as any,
      collectionResults: collectionGroups,
      collectionsSearched: collectionResults.map(r => r.collection)
    };
  }

  private generateSearchWarnings(analysis: QueryAnalysis, plan: SearchExecutionPlan, response: SearchResponse): string[] {
    const warnings: string[] = [];

    if (analysis.confidence < 0.5) {
      warnings.push('Query analysis confidence is low - results may not be optimal');
    }

    if (response.results.length === 0) {
      warnings.push('No results found - consider broadening your search terms');
    }

    if (plan.primaryStrategy === SearchStrategy.SEMANTIC && !plan.searchModes.includes(SearchMode.VECTOR_ONLY)) {
      warnings.push('Semantic search requested but vector index not available');
    }

    return warnings;
  }

  private generateSearchRecommendations(analysis: QueryAnalysis, plan: SearchExecutionPlan, response: SearchResponse): string[] {
    const recommendations: string[] = [];

    if (response.results.length < 3) {
      recommendations.push('Try using broader search terms or synonyms');
    }

    if (analysis.features.wordCount === 1) {
      recommendations.push('Consider adding more specific keywords for better results');
    }

    if (analysis.queryType === 'unknown' as any) {
      recommendations.push('Try using quotes for exact phrase matching');
    }

    return recommendations;
  }

  private updateSearchMetrics(method: string, responseTime: number, resultCount: number, hasError: boolean): void {
    const current = this.searchMetrics.get(method) || { count: 0, avgTime: 0, errors: 0 };

    const newCount = current.count + 1;
    const newAvgTime = (current.avgTime * current.count + responseTime) / newCount;
    const newErrors = current.errors + (hasError ? 1 : 0);

    this.searchMetrics.set(method, {
      count: newCount,
      avgTime: newAvgTime,
      errors: newErrors
    });
  }

  /**
   * Получение статистики производительности с метриками embedding pipeline
   */
  getPerformanceStats() {
    const stats = Object.fromEntries(this.searchMetrics);

    // Базовая статистика поиска
    const baseStats = {
      searchMetrics: stats,
      cacheStats: {
        contextCacheSize: this.contextCache.size,
        ...this.resultProcessor.getPerformanceStats()
      }
    };

    // Добавляем статистику embedding pipeline если доступна
    if (this.embeddingPipeline) {
      const pipelineStats = this.embeddingPipeline.getPerformanceStats();

      return {
        ...baseStats,
        embeddingPipeline: {
          totalRequests: pipelineStats.totalRequests,
          cacheHitRate: pipelineStats.cacheHitRate,
          averageGenerationTime: pipelineStats.averageGenerationTime,
          activeModels: pipelineStats.activeModels,
          memoryUsage: pipelineStats.memoryUsage,
          cacheStats: pipelineStats.cacheStats
        }
      };
    }

    return baseStats;
  }

  /**
   * Прогрев кэша embedding'ов для популярных запросов
   */
  async warmEmbeddingCache(collection: string, commonQueries: string[]): Promise<void> {
    await this.pipelineInitialized;

    if (!this.embeddingPipeline) {
      this.log('warn', 'Cannot warm embedding cache - pipeline not available');
      return;
    }

    try {
      this.log('info', `Warming embedding cache for collection "${collection}" with ${commonQueries.length} queries`);
      await this.embeddingPipeline.warmCache(commonQueries, collection);
      this.log('info', 'Embedding cache warming completed');
    } catch (error) {
      this.log('error', 'Failed to warm embedding cache', { error, collection });
    }
  }

  /**
   * Очистка кэшей включая embedding pipeline
   */
  async clearCaches(): Promise<void> {
    this.contextCache.clear();
    this.resultProcessor.clearCache();

    // Очищаем кэш embedding pipeline если доступен
    if (this.embeddingPipeline) {
      try {
        await this.embeddingPipeline.clearCache();
        this.log('info', 'Embedding pipeline caches cleared');
      } catch (error) {
        this.log('warn', 'Failed to clear embedding pipeline caches', { error });
      }
    }

    this.log('info', 'All search caches cleared');
  }

  /**
   * Очистка ресурсов при завершении работы
   */
  async dispose(): Promise<void> {
    try {
      await this.clearCaches();

      // Остановка embedding pipeline если доступен
      if (this.embeddingPipeline) {
        // ModelManager и CacheManager должны иметь методы dispose
        // Это будет вызвано при shutdown worker'а
      }

      this.log('info', 'SearchHandler disposed successfully');
    } catch (error) {
      this.log('error', 'Error during SearchHandler disposal', { error });
    }
  }
}