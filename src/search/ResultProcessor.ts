/**
 * Enhanced Result Processor для LocalRetrieve
 *
 * Расширенный обработчик результатов поиска с интеграцией ML-based оптимизации,
 * персонализации, диверсификации и аналитического отслеживания качества.
 *
 * Архитектурные улучшения:
 * - Интеграция с SearchOptimizer для ML-based re-ranking
 * - Персонализированная обработка результатов
 * - Интеграция с аналитикой для отслеживания качества
 * - Адаптивные алгоритмы на основе пользовательского поведения
 */

import type {
  SearchResult,
  RawSearchResult,
  ResultWithSnippets,
  RankedResult,
  SearchResponse,
  ResultProcessingOptions,
  SnippetOptions,
  HighlightOptions,
  RerankingOptions,
  RerankingContext,
  ScoreExplanation,
  ResultProcessorConfig,
  QueryHistory
} from '../types/search.js';

import {
  FusionMethod,
  ScoreNormalization,
  DEFAULT_RESULT_PROCESSOR_CONFIG,
  ResultProcessingError,
  normalizeScore,
  combineScores
} from '../types/search.js';

import {
  SearchOptimizer,
  type OptimizedResult,
  type OptimizationContext,
  type SearchOptimizerConfig
} from './SearchOptimizer.js';

import type { SearchAnalytics } from '../analytics/SearchAnalytics.js';
import type { AdvancedQueryAnalysis } from './QueryAnalyzer.js';

/**
 * Расширенная конфигурация ResultProcessor с поддержкой SearchOptimizer
 */
export interface EnhancedResultProcessorConfig extends ResultProcessorConfig {
  /** Включить ML-based оптимизацию через SearchOptimizer */
  enableAdvancedOptimization: boolean;

  /** Конфигурация SearchOptimizer */
  searchOptimizerConfig?: Partial<SearchOptimizerConfig>;

  /** Включить интеграцию с аналитикой */
  enableAnalyticsIntegration: boolean;

  /** Включить адаптивную обработку на основе пользовательского поведения */
  enableAdaptiveProcessing: boolean;

  /** Веса для комбинирования базовой и расширенной обработки */
  processingWeights: {
    baseProcessing: number;
    advancedOptimization: number;
  };

  /** Настройки качества результатов */
  qualitySettings: {
    minRelevanceScore: number;
    maxResultsForOptimization: number;
    diversityThreshold: number;
  };
}

/**
 * Расширенный контекст обработки результатов
 */
export interface EnhancedResultProcessingOptions extends ResultProcessingOptions {
  /** Анализ запроса от QueryAnalyzer */
  queryAnalysis?: AdvancedQueryAnalysis;

  /** Контекст пользователя для персонализации */
  userContext?: {
    userId?: string;
    sessionId?: string;
    deviceType?: 'desktop' | 'mobile' | 'tablet';
    previousInteractions?: QueryHistory[];
  };

  /** Контекст коллекции */
  collectionContext?: {
    name: string;
    documentCount: number;
    averageDocumentLength: number;
  };

  /** Настройки производительности */
  performanceConstraints?: {
    maxProcessingTime: number;
    prioritizeSpeed: boolean;
    enableCaching: boolean;
  };
}

/**
 * Основной процессор результатов поиска с расширенными возможностями
 */
export class ResultProcessor {
  private config: EnhancedResultProcessorConfig;
  private snippetCache = new Map<string, string[]>();
  private scoreStats = new Map<string, { min: number; max: number; avg: number }>();

  // Интеграция с SearchOptimizer
  private searchOptimizer?: SearchOptimizer;
  private analytics?: SearchAnalytics;

  // Кэш оптимизированных результатов
  private optimizedResultsCache = new Map<string, OptimizedResult[]>();

  // Адаптивные параметры на основе пользовательского поведения
  private adaptiveParams = new Map<string, {
    preferredSnippetLength: number;
    diversityPreference: number;
    qualityThreshold: number;
  }>();

  // Статистика производительности
  private processingStats = {
    totalProcessed: 0,
    averageProcessingTime: 0,
    qualityImprovementRate: 0,
    userSatisfactionRate: 0
  };

  constructor(
    config: Partial<EnhancedResultProcessorConfig> = {},
    analytics?: SearchAnalytics
  ) {
    this.config = {
      ...DEFAULT_RESULT_PROCESSOR_CONFIG,
      enableAdvancedOptimization: true,
      enableAnalyticsIntegration: true,
      enableAdaptiveProcessing: true,
      processingWeights: {
        baseProcessing: 0.4,
        advancedOptimization: 0.6
      },
      qualitySettings: {
        minRelevanceScore: 0.1,
        maxResultsForOptimization: 100,
        diversityThreshold: 0.3
      },
      ...config
    };

    this.analytics = analytics;

    this.processingStats = {
      totalProcessed: 0,
      averageProcessingTime: 0,
      qualityImprovementRate: 0,
      userSatisfactionRate: 0
    };

    // Инициализируем SearchOptimizer если включена расширенная оптимизация
    if (this.config.enableAdvancedOptimization) {
      this.searchOptimizer = new SearchOptimizer(this.config.searchOptimizerConfig);
    }
  }

  /**
   * Расширенная функция обработки результатов с интеграцией SearchOptimizer
   */
  async processResults(
    results: RawSearchResult[],
    query: string,
    options: EnhancedResultProcessingOptions
  ): Promise<SearchResponse> {
    const startTime = Date.now();
    this.processingStats.totalProcessed++;

    try {
      // Предварительная фильтрация по качеству
      const qualityFilteredResults = this.filterByQuality(results);

      // Фаза 1: Базовая обработка (совместимость)
      const baseProcessedResults = await this.performBaseProcessing(
        qualityFilteredResults,
        query,
        options
      );

      // Фаза 2: Расширенная оптимизация через SearchOptimizer (если включена)
      let optimizedResults: OptimizedResult[] = baseProcessedResults.map(r => r as OptimizedResult);

      if (this.config.enableAdvancedOptimization && this.searchOptimizer) {
        optimizedResults = await this.performAdvancedOptimization(
          baseProcessedResults,
          query,
          options
        );
      }

      // Фаза 3: Адаптивная постобработка
      if (this.config.enableAdaptiveProcessing && options.userContext?.userId) {
        optimizedResults = await this.applyAdaptiveProcessing(
          optimizedResults,
          query,
          options
        );
      }

      // Фаза 4: Итоговая обработка и конвертация в стандартный формат
      const finalResults = this.finalizeResults(optimizedResults, query);

      const processingTime = Date.now() - startTime;

      // Интеграция с аналитикой
      if (this.config.enableAnalyticsIntegration && this.analytics && options.userContext?.sessionId) {
        this.analytics.trackResults(
          this.generateResultId(query),
          options.userContext.sessionId,
          {
            results: finalResults,
            totalResults: finalResults.length,
            searchTime: processingTime,
            strategy: 'hybrid' as any
          },
          optimizedResults
        );
      }

      // Обновляем статистику производительности
      this.updateProcessingStats(processingTime, finalResults, optimizedResults);

      const response: SearchResponse = {
        results: finalResults,
        totalResults: finalResults.length,
        searchTime: processingTime,
        strategy: 'hybrid' as any,
        debugInfo: {
          queryAnalysis: options.queryAnalysis || {
            query: query,
            features: { wordCount: query.split(' ').length, hasQuotes: false },
            type: 'unknown' as any,
            strategy: 'hybrid' as any,
            confidence: 0.5
          } as any,
          executionPlan: {
            strategy: 'hybrid' as any,
            steps: ['processing'],
            estimatedTime: processingTime
          } as any,
          timings: {
            analysis: 0,
            planning: 0,
            execution: 0,
            fusion: processingTime,
            total: processingTime
          },
          indexUsage: {
            ftsIndex: true,
            vectorIndex: options.queryAnalysis?.features ?
              options.queryAnalysis.features.wordCount > 3 : false,
            filterIndex: false
          }
        }
      };

      return response;

    } catch (error) {
      // Логируем ошибку в аналитику
      if (this.config.enableAnalyticsIntegration && this.analytics && options.userContext?.sessionId) {
        this.analytics.trackError(
          'result_processing',
          'PROCESSING_FAILED',
          error instanceof Error ? error.message : String(error),
          { query: query.substring(0, 100), resultsCount: results.length },
          options.userContext.sessionId
        );
      }

      throw new ResultProcessingError(
        `Enhanced result processing failed: ${error instanceof Error ? error.message : String(error)}`,
        { resultsCount: results.length, query, options }
      );
    }
  }

  /**
   * Базовая обработка результатов (совместимость с существующим кодом)
   */
  private async performBaseProcessing(
    results: RawSearchResult[],
    query: string,
    options: EnhancedResultProcessingOptions
  ): Promise<RankedResult[]> {
    // Фаза 1: Нормализация оценок
    const normalizedResults = this.normalizeScores(results, options.normalization || ScoreNormalization.MIN_MAX);

    // Фаза 2: Дедупликация (если включена)
    const deduplicatedResults = options.deduplication ?
      this.deduplicateResults(normalizedResults) : normalizedResults;

    // Фаза 3: Генерация сниппетов с адаптивными параметрами
    const snippetOptions = this.getAdaptiveSnippetOptions(options);
    const resultsWithSnippets: ResultWithSnippets[] = options.snippetGeneration?.enabled ?
      await this.generateSnippets(deduplicatedResults, query, snippetOptions) :
      deduplicatedResults.map(r => ({ ...r, snippets: [], score: r.rawScore }));

    // Фаза 4: Подсветка совпадений
    const highlightedResults: ResultWithSnippets[] = options.highlighting?.enabled ?
      this.highlightMatches(resultsWithSnippets, query, options.highlighting) :
      resultsWithSnippets;

    // Фаза 5: Базовое re-ranking (если включен)
    const rerankedResults: RankedResult[] = options.reranking?.enabled ?
      await this.rerankResults(highlightedResults, query, {
        query,
        userProfile: options.userContext || {},
        sessionContext: {},
        clickHistory: options.userContext?.previousInteractions || []
      }) : highlightedResults.map(r => ({ ...r, finalScore: r.score })) as RankedResult[];

    return rerankedResults;
  }

  /**
   * Генерация сниппетов для результатов
   */
  async generateSnippets(
    results: RawSearchResult[],
    query: string,
    options: SnippetOptions
  ): Promise<ResultWithSnippets[]> {
    const cacheKey = `${query}_${JSON.stringify(options)}`;

    try {
      return Promise.all(
        results.map(async (result) => {
          const resultCacheKey = `${cacheKey}_${result.id}`;

          // Проверяем кэш
          if (this.snippetCache.has(resultCacheKey)) {
            return {
              ...result,
              snippets: this.snippetCache.get(resultCacheKey)!,
              normalizedScore: result.rawScore,
              score: result.rawScore
            };
          }

          const snippets = await this.extractSnippets(result, query, options);

          // Кэшируем результат
          this.snippetCache.set(resultCacheKey, snippets);

          return {
            ...result,
            snippets,
            normalizedScore: result.rawScore,
            snippetScore: this.calculateSnippetScore(snippets, query),
            score: result.rawScore
          };
        })
      );
    } catch (error) {
      throw new ResultProcessingError(
        `Failed to generate snippets: ${error instanceof Error ? error.message : String(error)}`,
        { query, options, resultsCount: results.length }
      );
    }
  }

  /**
   * Re-ranking результатов на основе дополнительных факторов
   */
  async rerankResults(
    results: ResultWithSnippets[],
    query: string,
    context: RerankingContext
  ): Promise<RankedResult[]> {
    try {
      return results.map((result, index) => {
        const diversityScore = this.calculateDiversityScore(result, results, index);
        const contextScore = this.calculateContextScore(result, context);
        const qualityScore = this.calculateQualityScore(result);

        // Комбинируем различные факторы
        const rerankingScore = combineScores(
          [result.normalizedScore || result.rawScore, diversityScore, contextScore, qualityScore],
          [0.6, 0.15, 0.15, 0.1],
          FusionMethod.WEIGHTED
        );

        const finalScore = (result.normalizedScore || result.rawScore) * 0.7 + rerankingScore * 0.3;

        return {
          ...result,
          finalScore,
          rerankingScore,
          diversityScore,
          score: finalScore
        };
      }).sort((a, b) => b.finalScore - a.finalScore);

    } catch (error) {
      throw new ResultProcessingError(
        `Failed to rerank results: ${error instanceof Error ? error.message : String(error)}`,
        { query, context, resultsCount: results.length }
      );
    }
  }

  /**
   * Нормализация оценок релевантности
   */
  private normalizeScores(results: RawSearchResult[], method: ScoreNormalization): RawSearchResult[] {
    if (results.length === 0 || method === ScoreNormalization.NONE) {
      return results;
    }

    const scores = results.map(r => r.rawScore);
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);

    return results.map(result => ({
      ...result,
      rawScore: normalizeScore(result.rawScore, minScore, maxScore, method)
    }));
  }

  /**
   * Дедупликация результатов
   */
  private deduplicateResults(results: RawSearchResult[]): RawSearchResult[] {
    const seen = new Set<string>();
    const deduplicated: RawSearchResult[] = [];

    for (const result of results) {
      // Создаем ключ для дедупликации на основе содержимого
      const dedupeKey = this.createDeduplicationKey(result);

      if (!seen.has(dedupeKey)) {
        seen.add(dedupeKey);
        deduplicated.push(result);
      }
    }

    return deduplicated;
  }

  /**
   * Создание ключа для дедупликации
   */
  private createDeduplicationKey(result: RawSearchResult): string {
    // Используем комбинацию title и первых 100 символов контента
    const titlePart = result.title ? result.title.toLowerCase().trim() : '';
    const contentPart = result.content ? result.content.substring(0, 100).toLowerCase().trim() : '';
    return `${titlePart}|${contentPart}`;
  }

  /**
   * Извлечение сниппетов из контента
   */
  private async extractSnippets(
    result: RawSearchResult,
    query: string,
    options: SnippetOptions
  ): Promise<string[]> {
    const content = result.content || '';
    const queryWords = this.extractQueryWords(query);

    if (!content || queryWords.length === 0) {
      return [content.substring(0, options.maxLength || 150)];
    }

    const snippets: string[] = [];
    const contentLower = content.toLowerCase();

    // Находим все совпадения
    const matches: Array<{ index: number; word: string; length: number }> = [];

    queryWords.forEach(word => {
      const wordLower = word.toLowerCase();
      let index = 0;

      while (index < contentLower.length) {
        const foundIndex = contentLower.indexOf(wordLower, index);
        if (foundIndex === -1) break;

        matches.push({
          index: foundIndex,
          word: word,
          length: word.length
        });

        index = foundIndex + 1;
      }
    });

    // Сортируем совпадения по позиции
    matches.sort((a, b) => a.index - b.index);

    const contextWindow = options.contextWindow || 5;
    const maxSnippets = options.maxSnippets || 3;
    const maxLength = options.maxLength || 150;

    // Генерируем сниппеты вокруг совпадений
    const usedRanges = new Set<string>();

    for (const match of matches.slice(0, maxSnippets)) {
      const words = content.split(/\s+/);
      const wordIndex = this.findWordIndex(words, match.index);

      const startIndex = Math.max(0, wordIndex - contextWindow);
      const endIndex = Math.min(words.length, wordIndex + contextWindow + 1);

      const snippetWords = words.slice(startIndex, endIndex);
      let snippet = snippetWords.join(' ');

      // Обрезаем до максимальной длины
      if (snippet.length > maxLength) {
        snippet = snippet.substring(0, maxLength) + '...';
      }

      // Добавляем префикс/суффикс если нужно
      if (startIndex > 0) snippet = '...' + snippet;
      if (endIndex < words.length) snippet = snippet + '...';

      const rangeKey = `${startIndex}-${endIndex}`;
      if (!usedRanges.has(rangeKey)) {
        snippets.push(snippet);
        usedRanges.add(rangeKey);
      }
    }

    // Если не найдено совпадений, берем начало контента
    if (snippets.length === 0) {
      snippets.push(content.substring(0, maxLength) + (content.length > maxLength ? '...' : ''));
    }

    return snippets.slice(0, maxSnippets);
  }

  /**
   * Подсветка совпадений в результатах
   */
  private highlightMatches(
    results: ResultWithSnippets[],
    query: string,
    options: HighlightOptions
  ): ResultWithSnippets[] {
    const queryWords = this.extractQueryWords(query);
    const preTag = options.tags?.pre || '<mark>';
    const postTag = options.tags?.post || '</mark>';

    return results.map(result => {
      const highlightedSnippets = result.snippets.map(snippet => {
        let highlighted = snippet;

        queryWords.forEach(word => {
          const regex = new RegExp(`\\b${this.escapeRegex(word)}\\b`, 'gi');
          highlighted = highlighted.replace(regex, `${preTag}$&${postTag}`);
        });

        return highlighted;
      });

      return {
        ...result,
        snippets: highlightedSnippets,
        highlights: {
          content: highlightedSnippets
        }
      };
    });
  }

  /**
   * Кластеризация результатов (простая группировка по похожести)
   */
  private clusterResults(results: RankedResult[], query: string): RankedResult[] {
    // Простая кластеризация на основе похожести заголовков
    const clusters = new Map<string, RankedResult[]>();

    results.forEach(result => {
      const clusterKey = this.generateClusterKey(result);
      if (!clusters.has(clusterKey)) {
        clusters.set(clusterKey, []);
      }
      clusters.get(clusterKey)!.push(result);
    });

    // Возвращаем лучший результат из каждого кластера
    const clustered: RankedResult[] = [];
    clusters.forEach(cluster => {
      // Сортируем по финальному скору и берем лучший
      cluster.sort((a, b) => b.finalScore - a.finalScore);
      clustered.push(cluster[0]);
    });

    return clustered.sort((a, b) => b.finalScore - a.finalScore);
  }

  /**
   * Финальная обработка результатов
   */
  private finalizeResults(results: RankedResult[], query: string): SearchResult[] {
    return results.map((result, index) => ({
      id: result.id,
      title: result.title,
      content: result.content,
      metadata: result.metadata,
      score: result.finalScore,
      normalizedScore: result.normalizedScore,
      ftsScore: result.source === 'fts' ? result.rawScore : undefined,
      vecScore: result.source === 'vector' ? result.rawScore : undefined,
      snippets: result.snippets,
      highlights: result.highlights,
      collection: result.metadata?.collection,
      rank: index + 1,
      explanation: this.generateScoreExplanation(result)
    }));
  }

  /**
   * Извлечение слов запроса для поиска и подсветки
   */
  private extractQueryWords(query: string): string[] {
    // Удаляем кавычки и специальные символы, разбиваем на слова
    return query
      .replace(/[""'']/g, '"')
      .replace(/[^\w\s"-]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2) // Игнорируем очень короткие слова
      .map(word => word.replace(/^"+|"+$/g, '')); // Убираем кавычки с краев
  }

  /**
   * Поиск индекса слова в массиве по позиции в тексте
   */
  private findWordIndex(words: string[], charIndex: number): number {
    let currentIndex = 0;
    for (let i = 0; i < words.length; i++) {
      if (currentIndex >= charIndex) {
        return i;
      }
      currentIndex += words[i].length + 1; // +1 для пробела
    }
    return words.length - 1;
  }

  /**
   * Экранирование специальных символов для regex
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Расчет оценки качества сниппета
   */
  private calculateSnippetScore(snippets: string[], query: string): number {
    const queryWords = this.extractQueryWords(query);
    let totalScore = 0;

    snippets.forEach(snippet => {
      const snippetLower = snippet.toLowerCase();
      const wordMatches = queryWords.filter(word =>
        snippetLower.includes(word.toLowerCase())
      ).length;

      const coverage = queryWords.length > 0 ? wordMatches / queryWords.length : 0;
      totalScore += coverage;
    });

    return snippets.length > 0 ? totalScore / snippets.length : 0;
  }

  /**
   * Расчет оценки разнообразия для устранения дублирования
   */
  private calculateDiversityScore(
    result: ResultWithSnippets,
    allResults: ResultWithSnippets[],
    currentIndex: number
  ): number {
    if (currentIndex === 0) return 1; // Первый результат всегда имеет максимальное разнообразие

    const currentContent = (result.content || '').toLowerCase();
    let similaritySum = 0;
    let comparisonCount = 0;

    // Сравниваем только с предыдущими результатами (которые уже были выбраны)
    for (let i = 0; i < Math.min(currentIndex, 5); i++) {
      const otherContent = (allResults[i].content || '').toLowerCase();
      const similarity = this.calculateTextSimilarity(currentContent, otherContent);
      similaritySum += similarity;
      comparisonCount++;
    }

    const avgSimilarity = comparisonCount > 0 ? similaritySum / comparisonCount : 0;
    return 1 - avgSimilarity; // Чем меньше похожесть, тем выше разнообразие
  }

  /**
   * Расчет контекстной оценки на основе пользовательского профиля
   */
  private calculateContextScore(result: ResultWithSnippets, context: RerankingContext): number {
    let contextScore = 0.5; // Базовая оценка

    // Учитываем историю кликов пользователя
    if (context.clickHistory && context.clickHistory.length > 0) {
      const relevantHistory = context.clickHistory.filter(h =>
        h.query.toLowerCase().includes(context.query.toLowerCase()) ||
        context.query.toLowerCase().includes(h.query.toLowerCase())
      );

      if (relevantHistory.length > 0) {
        const avgInteractionScore = relevantHistory
          .map(h => h.userInteraction === 'clicked' ? 1 : h.userInteraction === 'refined' ? 0.5 : 0)
          .reduce((sum: number, score: number) => sum + score, 0) / relevantHistory.length;

        contextScore += avgInteractionScore * 0.3;
      }
    }

    // Учитываем пользовательский профиль
    if (context.userProfile) {
      // Простая логика - можно расширить в зависимости от требований
      const profileBoost = Object.keys(context.userProfile).length * 0.05;
      contextScore += Math.min(profileBoost, 0.2);
    }

    return Math.min(1, Math.max(0, contextScore));
  }

  /**
   * Расчет оценки качества результата
   */
  private calculateQualityScore(result: ResultWithSnippets): number {
    let qualityScore = 0.5; // Базовая оценка

    // Факторы качества
    if (result.title && result.title.length > 10) qualityScore += 0.1;
    if (result.content && result.content.length > 100) qualityScore += 0.1;
    if (result.snippets && result.snippets.length > 0) qualityScore += 0.1;
    if (result.metadata && Object.keys(result.metadata).length > 0) qualityScore += 0.05;

    // Штрафы за низкое качество
    if (result.content && result.content.length < 50) qualityScore -= 0.1;
    if (!result.title) qualityScore -= 0.05;

    return Math.min(1, Math.max(0, qualityScore));
  }

  /**
   * Генерация ключа кластера для группировки похожих результатов
   */
  private generateClusterKey(result: ResultWithSnippets): string {
    // Простой алгоритм кластеризации на основе первых слов заголовка
    const title = result.title || '';
    const words = title.toLowerCase().split(/\s+/);
    const keyWords = words.slice(0, 3).join('_');
    return keyWords || 'misc';
  }

  /**
   * Расчет текстовой похожести (упрощенный алгоритм)
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.split(/\s+/));
    const words2 = new Set(text2.split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Генерация объяснения оценки релевантности
   */
  private generateScoreExplanation(result: RankedResult): ScoreExplanation {
    const components = [
      {
        name: 'Base Score',
        score: result.rawScore,
        weight: 0.6,
        details: `Original relevance score from ${result.source} search`
      }
    ];

    if (result.rerankingScore !== undefined) {
      components.push({
        name: 'Reranking Score',
        score: result.rerankingScore,
        weight: 0.3,
        details: 'Score adjustment based on context and quality factors'
      });
    }

    if (result.diversityScore !== undefined) {
      components.push({
        name: 'Diversity Score',
        score: result.diversityScore,
        weight: 0.15,
        details: 'Bonus for content diversity and deduplication'
      });
    }

    if (result.snippetScore !== undefined) {
      components.push({
        name: 'Snippet Score',
        score: result.snippetScore,
        weight: 0.1,
        details: 'Quality of generated snippets and query coverage'
      });
    }

    return {
      totalScore: result.finalScore,
      components,
      formula: 'weighted_sum(base_score * 0.6, reranking_score * 0.3, diversity_score * 0.15, snippet_score * 0.1)'
    };
  }

  /**
   * Очистка кэша сниппетов
   */
  clearCache(): void {
    this.snippetCache.clear();
    this.scoreStats.clear();
  }

  /**
   * Получение статистики производительности
   */
  getPerformanceStats() {
    return {
      cacheSize: this.snippetCache.size,
      scoreStatsSize: this.scoreStats.size,
      ...this.processingStats,
      optimizerStats: this.searchOptimizer?.getPerformanceMetrics()
    };
  }

  // === Методы интеграции с SearchOptimizer ===

  /**
   * Фильтрация результатов по качеству
   */
  private filterByQuality(results: RawSearchResult[]): RawSearchResult[] {
    return results.filter(result =>
      result.rawScore >= this.config.qualitySettings.minRelevanceScore &&
      (result.title || result.content) // Должно быть минимальное содержимое
    ).slice(0, this.config.qualitySettings.maxResultsForOptimization);
  }

  /**
   * Расширенная оптимизация через SearchOptimizer
   */
  private async performAdvancedOptimization(
    results: RankedResult[],
    query: string,
    options: EnhancedResultProcessingOptions
  ): Promise<OptimizedResult[]> {
    if (!this.searchOptimizer || results.length === 0) {
      return results.map(r => r as OptimizedResult);
    }

    const cacheKey = this.generateOptimizationCacheKey(query, results, options);

    // Проверяем кэш
    if (options.performanceConstraints?.enableCaching !== false) {
      const cached = this.optimizedResultsCache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      // Создаем контекст оптимизации
      const optimizationContext: OptimizationContext = {
        query,
        timestamp: Date.now(),
        sessionId: options.userContext?.sessionId,
        userProfile: options.userContext || {},
        sessionContext: {},
        clickHistory: options.userContext?.previousInteractions || [],
        queryAnalysis: options.queryAnalysis,
        deviceType: options.userContext?.deviceType
      };

      // Конвертируем в формат SearchOptimizer
      const resultsWithSnippets: ResultWithSnippets[] = results.map(r => ({
        ...r,
        snippets: r.snippets || [],
        rawScore: r.score,
        source: 'hybrid' as any,
        normalizedScore: r.normalizedScore || r.score
      }));

      // Выполняем оптимизацию
      const optimizedResults = await this.searchOptimizer.optimizeResults(
        resultsWithSnippets,
        query || '',
        optimizationContext
      );

      // Кэшируем результат
      if (options.performanceConstraints?.enableCaching !== false) {
        this.optimizedResultsCache.set(cacheKey, optimizedResults);

        // Ограничиваем размер кэша
        if (this.optimizedResultsCache.size > 1000) {
          const firstKey = this.optimizedResultsCache.keys().next().value;
          if (firstKey !== undefined) {
            this.optimizedResultsCache.delete(firstKey);
          }
        }
      }

      return optimizedResults;

    } catch (error) {
      console.warn('Advanced optimization failed, using base results:', error);
      return results.map(r => r as OptimizedResult);
    }
  }

  /**
   * Адаптивная постобработка на основе пользовательского поведения
   */
  private async applyAdaptiveProcessing(
    results: OptimizedResult[],
    query: string,
    options: EnhancedResultProcessingOptions
  ): Promise<OptimizedResult[]> {
    const userId = options.userContext!.userId!;
    const params = this.getAdaptiveParams(userId);

    // Адаптивная фильтрация по качеству
    const qualityThreshold = params.qualityThreshold;
    const qualityFiltered = results.filter(r =>
      (r.finalScore || r.score) >= qualityThreshold
    );

    // Адаптивная диверсификация
    if (params.diversityPreference > 0.5 && qualityFiltered.length > 5) {
      return this.applyAdaptiveDiversification(qualityFiltered, params.diversityPreference);
    }

    return qualityFiltered;
  }

  /**
   * Адаптивная диверсификация
   */
  private applyAdaptiveDiversification(
    results: OptimizedResult[],
    diversityPreference: number
  ): OptimizedResult[] {
    // Простой алгоритм адаптивной диверсификации
    const diversified: OptimizedResult[] = [];
    const used = new Set<string>();

    // Сначала добавляем топ результат
    if (results.length > 0) {
      diversified.push(results[0]);
      used.add(this.generateContentHash(results[0]));
    }

    // Затем добавляем разнообразные результаты
    for (const result of results.slice(1)) {
      const contentHash = this.generateContentHash(result);

      // Проверяем разнообразие с уже выбранными результатами
      let isDiverse = true;
      const similarity = this.calculateMaxSimilarity(result, diversified);

      if (similarity > (1 - diversityPreference)) {
        isDiverse = false;
      }

      if (isDiverse && !used.has(contentHash)) {
        diversified.push(result);
        used.add(contentHash);
      }

      if (diversified.length >= 20) break; // Ограничиваем количество
    }

    return diversified;
  }


  /**
   * Получение адаптивных опций для сниппетов
   */
  private getAdaptiveSnippetOptions(options: EnhancedResultProcessingOptions): SnippetOptions {
    const baseOptions = options.snippetGeneration || {
      enabled: true,
      maxLength: 150,
      contextWindow: 5,
      maxSnippets: 3
    };

    if (options.userContext?.userId) {
      const params = this.getAdaptiveParams(options.userContext.userId);
      return {
        ...baseOptions,
        maxLength: Math.round(params.preferredSnippetLength)
      };
    }

    return baseOptions;
  }

  /**
   * Получение адаптивных параметров для пользователя
   */
  private getAdaptiveParams(userId: string): {
    preferredSnippetLength: number;
    diversityPreference: number;
    qualityThreshold: number;
  } {
    const existing = this.adaptiveParams.get(userId);
    if (existing) {
      return existing;
    }

    // Параметры по умолчанию
    const defaultParams = {
      preferredSnippetLength: 150,
      diversityPreference: 0.3,
      qualityThreshold: this.config.qualitySettings.minRelevanceScore
    };

    this.adaptiveParams.set(userId, defaultParams);
    return defaultParams;
  }

  /**
   * Генерация ключа кэша для оптимизации
   */
  private generateOptimizationCacheKey(
    query: string,
    results: RankedResult[],
    options: EnhancedResultProcessingOptions
  ): string {
    const keyFactors = [
      query.toLowerCase(),
      results.length.toString(),
      results.slice(0, 3).map(r => r.id).join(','), // Топ-3 ID результатов
      options.userContext?.userId || 'anonymous',
      options.queryAnalysis?.queryType || 'unknown'
    ];

    return this.simpleHash(keyFactors.join('|')).toString(36);
  }

  /**
   * Генерация ID результата для аналитики
   */
  private generateResultId(query: string): string {
    const timestamp = Date.now().toString(36);
    const hash = this.simpleHash(query).toString(36);
    return `r_${timestamp}_${hash}`;
  }

  /**
   * Генерация хеша контента для дедупликации
   */
  private generateContentHash(result: OptimizedResult): string {
    const content = (result.title || '') + ' ' + (result.content || '').substring(0, 200);
    return this.simpleHash(content).toString();
  }

  /**
   * Расчет максимальной схожести с существующими результатами
   */
  private calculateMaxSimilarity(result: OptimizedResult, existingResults: OptimizedResult[]): number {
    if (existingResults.length === 0) return 0;

    let maxSimilarity = 0;
    const resultContent = (result.title || '') + ' ' + (result.content || '');

    for (const existing of existingResults) {
      const existingContent = (existing.title || '') + ' ' + (existing.content || '');
      const similarity = this.calculateTextSimilarity(resultContent, existingContent);
      maxSimilarity = Math.max(maxSimilarity, similarity);
    }

    return maxSimilarity;
  }

  /**
   * Обновление статистики производительности
   */
  private updateProcessingStats(
    processingTime: number,
    finalResults: SearchResult[],
    optimizedResults: OptimizedResult[]
  ): void {
    // Обновляем среднее время обработки
    this.processingStats.averageProcessingTime =
      (this.processingStats.averageProcessingTime * (this.processingStats.totalProcessed - 1) +
       processingTime) / this.processingStats.totalProcessed;

    // Рассчитываем улучшение качества (если есть оптимизированные результаты)
    if (optimizedResults.length > 0) {
      const optimizationCount = optimizedResults.filter(r =>
        r.mlRanking || r.diversification || r.personalization
      ).length;

      const currentImprovement = optimizationCount / optimizedResults.length;
      this.processingStats.qualityImprovementRate =
        (this.processingStats.qualityImprovementRate * (this.processingStats.totalProcessed - 1) +
         currentImprovement) / this.processingStats.totalProcessed;
    }
  }

  /**
   * Обновление пользовательских предпочтений на основе взаимодействий
   */
  updateUserPreferences(
    userId: string,
    interactions: Array<{
      resultId: string;
      action: 'click' | 'dwell' | 'skip';
      duration?: number;
      snippetUsed?: boolean;
    }>
  ): void {
    const params = this.getAdaptiveParams(userId);

    for (const interaction of interactions) {
      switch (interaction.action) {
        case 'click':
          // Увеличиваем порог качества для успешных кликов
          params.qualityThreshold = Math.min(1, params.qualityThreshold + 0.01);
          break;

        case 'dwell':
          if (interaction.duration && interaction.duration > 5000) {
            // Долгое взаимодействие - снижаем предпочтение разнообразия
            params.diversityPreference = Math.max(0, params.diversityPreference - 0.05);
          }
          break;

        case 'skip':
          // Пропуск результата - возможно нужно больше разнообразия
          params.diversityPreference = Math.min(1, params.diversityPreference + 0.02);
          break;
      }

      // Адаптируем длину сниппетов
      if (interaction.snippetUsed) {
        params.preferredSnippetLength = Math.min(300, params.preferredSnippetLength * 1.1);
      }
    }

    this.adaptiveParams.set(userId, params);
  }

  /**
   * Получение рекомендаций по оптимизации
   */
  getOptimizationRecommendations(): Array<{
    area: 'performance' | 'quality' | 'personalization';
    recommendation: string;
    impact: 'high' | 'medium' | 'low';
    currentValue?: number;
  }> {
    const recommendations: Array<{
      area: 'performance' | 'quality' | 'personalization';
      recommendation: string;
      impact: 'high' | 'medium' | 'low';
      currentValue?: number;
    }> = [];

    // Анализ производительности
    if (this.processingStats.averageProcessingTime > 200) {
      recommendations.push({
        area: 'performance',
        recommendation: `Среднее время обработки (${this.processingStats.averageProcessingTime.toFixed(0)}ms) превышает рекомендуемое. Рассмотрите увеличение кэширования или снижение maxResultsForOptimization.`,
        impact: 'high',
        currentValue: this.processingStats.averageProcessingTime
      });
    }

    // Анализ качества
    if (this.processingStats.qualityImprovementRate < 0.3) {
      recommendations.push({
        area: 'quality',
        recommendation: `Низкий уровень применения оптимизаций (${(this.processingStats.qualityImprovementRate * 100).toFixed(1)}%). Проверьте настройки SearchOptimizer.`,
        impact: 'medium',
        currentValue: this.processingStats.qualityImprovementRate
      });
    }

    // Анализ персонализации
    const personalizedUsers = this.adaptiveParams.size;
    if (personalizedUsers > 0) {
      const avgDiversityPreference = Array.from(this.adaptiveParams.values())
        .reduce((sum, params) => sum + params.diversityPreference, 0) / personalizedUsers;

      if (avgDiversityPreference > 0.8) {
        recommendations.push({
          area: 'personalization',
          recommendation: `Высокое предпочтение разнообразия у пользователей (${(avgDiversityPreference * 100).toFixed(1)}%). Рассмотрите улучшение алгоритмов диверсификации.`,
          impact: 'medium',
          currentValue: avgDiversityPreference
        });
      }
    }

    return recommendations.sort((a, b) => {
      const impactWeight = { high: 3, medium: 2, low: 1 };
      return impactWeight[b.impact] - impactWeight[a.impact];
    });
  }

  /**
   * Простое хеширование для генерации ключей
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Интеграция с SearchOptimizer для обратной связи
   */
  provideFeedback(
    query: string,
    results: OptimizedResult[],
    userInteractions: Array<{
      resultId: string;
      interaction: 'clicked' | 'ignored' | 'refined';
    }>
  ): void {
    if (this.searchOptimizer) {
      this.searchOptimizer.provideFeedback(query, results, userInteractions);
    }

    // Обновляем пользовательские предпочтения
    for (const interaction of userInteractions) {
      const result = results.find(r => r.id === interaction.resultId);
      if (result && result.personalization) {
        // Логика обновления будет реализована в updateUserPreferences
      }
    }
  }

}