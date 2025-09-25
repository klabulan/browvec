/**
 * Search Strategy Engine для LocalRetrieve
 *
 * Интеллектуальный движок анализа запросов и выбора стратегии поиска.
 * Автоматически определяет наиболее подходящий тип поиска на основе
 * анализа запроса и контекста коллекции.
 */

import {
  SearchMode,
  SearchStrategy,
  QueryType,
  FusionMethod,
  ScoreNormalization,
  QueryAnalysisError,
  StrategySelectionError,
  normalizeScore,
  DEFAULT_STRATEGY_ENGINE_CONFIG
} from '../types/search.js';

import type {
  QueryAnalysis,
  QueryFeatures,
  SearchExecutionPlan,
  SearchContext,
  TextSearchOptions,
  SearchWeights,
  StrategyEngineConfig
} from '../types/search.js';

/**
 * Основной движок анализа запросов и выбора стратегии
 */
export class StrategyEngine {
  private config: StrategyEngineConfig;
  private queryPatterns: Map<string, QueryAnalysis>;
  private performanceMetrics: Map<string, number>;

  constructor(config: Partial<StrategyEngineConfig> = {}) {
    this.config = { ...DEFAULT_STRATEGY_ENGINE_CONFIG, ...config };
    this.queryPatterns = new Map();
    this.performanceMetrics = new Map();
  }

  /**
   * Анализирует запрос и определяет его характеристики
   */
  async analyzeQuery(query: string, context: SearchContext = { documentCount: 0, averageDocumentLength: 0, indexCapabilities: { hasFTS: true, hasVector: false, hasEmbeddings: false } }): Promise<QueryAnalysis> {
    try {
      const normalizedQuery = this.normalizeQuery(query);
      const features = this.extractFeatures(normalizedQuery);
      const queryType = this.classifyQuery(normalizedQuery, features);
      const confidence = this.calculateConfidence(queryType, features);

      const suggestedStrategy = this.selectPrimaryStrategy(queryType, features, context);
      const alternativeStrategies = this.getAlternativeStrategies(suggestedStrategy, queryType, context);

      const analysis: QueryAnalysis = {
        originalQuery: query,
        normalizedQuery,
        queryType,
        confidence,
        features,
        suggestedStrategy,
        alternativeStrategies,
        estimatedComplexity: this.estimateComplexity(features, context)
      };

      // Кэшируем анализ для повторного использования
      if (this.config.enableLearning) {
        this.queryPatterns.set(query, analysis);
      }

      return analysis;
    } catch (error) {
      throw new QueryAnalysisError(
        `Failed to analyze query: ${error instanceof Error ? error.message : String(error)}`,
        { query, context }
      );
    }
  }

  /**
   * Выбирает оптимальную стратегию поиска на основе анализа
   */
  selectStrategy(analysis: QueryAnalysis, options: TextSearchOptions): SearchExecutionPlan {
    try {
      const strategy = options.strategy || analysis.suggestedStrategy;
      const mode = this.selectSearchMode(strategy, analysis, options);

      const plan: SearchExecutionPlan = {
        primaryStrategy: strategy,
        fallbackStrategies: this.getFallbackStrategies(strategy, analysis),
        searchModes: [mode],
        fusion: {
          method: options.fusion?.method || FusionMethod.RRF,
          weights: this.calculateOptimalWeights(strategy, analysis, options),
          normalization: options.fusion?.normalization || ScoreNormalization.MIN_MAX
        },
        filters: options.filters || {},
        pagination: {
          limit: options.limit || 20,
          offset: options.offset || 0
        },
        performance: options.performance || {
          maxTime: 500,
          maxMemory: 100,
          earlyTermination: true,
          caching: true
        }
      };

      return plan;
    } catch (error) {
      throw new StrategySelectionError(
        `Failed to select search strategy: ${error instanceof Error ? error.message : String(error)}`,
        { analysis, options }
      );
    }
  }

  /**
   * Выполняет план поиска (интеграция с SearchHandler)
   */
  async executeSearchPlan(plan: SearchExecutionPlan, query: string, context: SearchContext): Promise<any> {
    // Этот метод будет интегрирован с SearchHandler в worker'е
    // Пока возвращаем план для дальнейшей обработки
    return {
      plan,
      query,
      timestamp: Date.now(),
      context
    };
  }

  /**
   * Нормализация запроса
   */
  private normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ') // Убираем лишние пробелы
      .replace(/[^\w\s"'-]/g, ' ') // Убираем специальные символы кроме кавычек и дефисов
      .trim();
  }

  /**
   * Извлечение характеристик запроса
   */
  private extractFeatures(query: string): QueryFeatures {
    const words = query.split(/\s+/);
    const wordCount = words.length;

    // Определяем различные характеристики
    const hasQuestionWords = /^(что|как|где|когда|почему|кто|какой|which|what|how|where|when|why|who)\b/i.test(query);
    const hasBooleanOperators = /\b(and|or|not|и|или|не)\b/i.test(query);
    const hasWildcards = /[*?]/.test(query);
    const hasQuotes = /"[^"]*"/.test(query);
    const hasNumbers = /\d+/.test(query);
    const hasSpecialCharacters = /[!@#$%^&*()_+=\[\]{}|\\:";'<>?,.\/]/.test(query);

    const averageWordLength = words.reduce((sum, word) => sum + word.length, 0) / wordCount;

    // Список стоп-слов (упрощенный)
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'в', 'на', 'с', 'по', 'для', 'и', 'или', 'но', 'что', 'как', 'где', 'когда'
    ]);

    const containsCommonStopWords = words.some(word => stopWords.has(word.toLowerCase()));

    // Определяем намерение пользователя
    let estimatedIntent: 'search' | 'filter' | 'navigate' | 'compare' = 'search';
    if (hasQuestionWords) estimatedIntent = 'search';
    else if (hasBooleanOperators) estimatedIntent = 'filter';
    else if (words.length === 1) estimatedIntent = 'navigate';
    else if (query.includes('vs') || query.includes('против') || query.includes('compare')) {
      estimatedIntent = 'compare';
    }

    return {
      wordCount,
      hasQuestionWords,
      hasBooleanOperators,
      hasWildcards,
      hasQuotes,
      hasNumbers,
      hasSpecialCharacters,
      averageWordLength,
      containsCommonStopWords,
      estimatedIntent
    };
  }

  /**
   * Классификация типа запроса
   */
  private classifyQuery(query: string, features: QueryFeatures): QueryType {
    // Точные фразы в кавычках
    if (features.hasQuotes) {
      return QueryType.EXACT_PHRASE;
    }

    // Булевые запросы
    if (features.hasBooleanOperators) {
      return QueryType.BOOLEAN_QUERY;
    }

    // Запросы с подстановочными символами
    if (features.hasWildcards) {
      return QueryType.WILDCARD;
    }

    // Вопросы
    if (features.hasQuestionWords) {
      return QueryType.QUESTION;
    }

    // Числовые запросы
    if (features.hasNumbers && features.wordCount <= 3) {
      return QueryType.NUMERIC;
    }

    // Короткие ключевые слова
    if (features.wordCount <= 3) {
      return QueryType.SHORT_KEYWORD;
    }

    // Длинные фразы
    if (features.wordCount >= 4) {
      return QueryType.LONG_PHRASE;
    }

    // Именованные сущности (упрощенная логика)
    if (features.wordCount <= 2 && !features.containsCommonStopWords) {
      return QueryType.ENTITY;
    }

    return QueryType.UNKNOWN;
  }

  /**
   * Расчет уверенности в классификации
   */
  private calculateConfidence(queryType: QueryType, features: QueryFeatures): number {
    let confidence = 0.5; // Базовая уверенность

    // Увеличиваем уверенность для четких индикаторов
    if (features.hasQuotes) confidence += 0.3;
    if (features.hasBooleanOperators) confidence += 0.25;
    if (features.hasWildcards) confidence += 0.2;
    if (features.hasQuestionWords) confidence += 0.2;

    // Корректируем на основе длины запроса
    if (features.wordCount === 1) confidence += 0.1;
    else if (features.wordCount >= 4) confidence += 0.15;

    // Ограничиваем диапазон 0-1
    return Math.min(1, Math.max(0, confidence));
  }

  /**
   * Выбор основной стратегии поиска
   */
  private selectPrimaryStrategy(
    queryType: QueryType,
    features: QueryFeatures,
    context: SearchContext
  ): SearchStrategy {
    // Правила выбора стратегии на основе типа запроса
    switch (queryType) {
      case QueryType.EXACT_PHRASE:
        return SearchStrategy.EXACT_MATCH;

      case QueryType.BOOLEAN_QUERY:
        return SearchStrategy.BOOLEAN;

      case QueryType.WILDCARD:
        return SearchStrategy.FUZZY;

      case QueryType.QUESTION:
        return context.indexCapabilities.hasEmbeddings ?
          SearchStrategy.SEMANTIC : SearchStrategy.KEYWORD;

      case QueryType.SHORT_KEYWORD:
        return features.wordCount === 1 ?
          SearchStrategy.EXACT_MATCH : SearchStrategy.KEYWORD;

      case QueryType.LONG_PHRASE:
        return context.indexCapabilities.hasEmbeddings ?
          SearchStrategy.SEMANTIC : SearchStrategy.PHRASE;

      case QueryType.NUMERIC:
        return SearchStrategy.EXACT_MATCH;

      case QueryType.ENTITY:
        return SearchStrategy.EXACT_MATCH;

      default:
        return this.config.fallbackStrategy;
    }
  }

  /**
   * Получение альтернативных стратегий
   */
  private getAlternativeStrategies(
    primaryStrategy: SearchStrategy,
    queryType: QueryType,
    context: SearchContext
  ): SearchStrategy[] {
    const alternatives: SearchStrategy[] = [];
    const maxAlternatives = this.config.maxAlternatives;

    // Добавляем альтернативы в порядке приоритета
    if (primaryStrategy !== SearchStrategy.KEYWORD && alternatives.length < maxAlternatives) {
      alternatives.push(SearchStrategy.KEYWORD);
    }

    if (context.indexCapabilities.hasEmbeddings &&
        primaryStrategy !== SearchStrategy.SEMANTIC &&
        alternatives.length < maxAlternatives) {
      alternatives.push(SearchStrategy.SEMANTIC);
    }

    if (primaryStrategy !== SearchStrategy.FUZZY && alternatives.length < maxAlternatives) {
      alternatives.push(SearchStrategy.FUZZY);
    }

    if (queryType === QueryType.LONG_PHRASE &&
        primaryStrategy !== SearchStrategy.PHRASE &&
        alternatives.length < maxAlternatives) {
      alternatives.push(SearchStrategy.PHRASE);
    }

    return alternatives;
  }

  /**
   * Выбор режима поиска
   */
  private selectSearchMode(strategy: SearchStrategy, analysis: QueryAnalysis, options: TextSearchOptions): SearchMode {
    if (options.mode && options.mode !== SearchMode.AUTO) {
      return options.mode;
    }

    // Логика автоматического выбора режима
    switch (strategy) {
      case SearchStrategy.SEMANTIC:
        return SearchMode.VECTOR_ONLY;

      case SearchStrategy.EXACT_MATCH:
      case SearchStrategy.KEYWORD:
      case SearchStrategy.BOOLEAN:
        return SearchMode.FTS_ONLY;

      case SearchStrategy.PHRASE:
      case SearchStrategy.FUZZY:
        return SearchMode.HYBRID;

      default:
        return this.config.defaultMode;
    }
  }

  /**
   * Расчет оптимальных весов для объединения результатов
   */
  private calculateOptimalWeights(
    strategy: SearchStrategy,
    analysis: QueryAnalysis,
    options: TextSearchOptions
  ): SearchWeights {
    const baseWeights: SearchWeights = {
      fts: 0.7,
      vector: 0.3,
      exactMatch: 1.2,
      phraseMatch: 1.1,
      proximity: 1.0,
      freshness: 0.1,
      popularity: 0.1
    };

    // Корректируем веса на основе стратегии
    switch (strategy) {
      case SearchStrategy.SEMANTIC:
        baseWeights.vector = 0.8;
        baseWeights.fts = 0.2;
        break;

      case SearchStrategy.EXACT_MATCH:
        baseWeights.exactMatch = 1.5;
        baseWeights.fts = 0.8;
        break;

      case SearchStrategy.PHRASE:
        baseWeights.phraseMatch = 1.3;
        baseWeights.proximity = 1.2;
        break;

      case SearchStrategy.KEYWORD:
        baseWeights.fts = 0.8;
        baseWeights.vector = 0.2;
        break;
    }

    // Корректируем на основе типа запроса
    switch (analysis.queryType) {
      case QueryType.QUESTION:
        baseWeights.vector += 0.1;
        break;

      case QueryType.SHORT_KEYWORD:
        baseWeights.exactMatch += 0.2;
        break;

      case QueryType.LONG_PHRASE:
        baseWeights.phraseMatch += 0.1;
        baseWeights.proximity += 0.1;
        break;
    }

    // Применяем пользовательские веса если заданы
    if (options.fusion?.weights) {
      return { ...baseWeights, ...options.fusion.weights };
    }

    return baseWeights;
  }

  /**
   * Получение резервных стратегий
   */
  private getFallbackStrategies(primaryStrategy: SearchStrategy, analysis: QueryAnalysis): SearchStrategy[] {
    const fallbacks: SearchStrategy[] = [];

    // Определяем fallback стратегии в порядке приоритета
    switch (primaryStrategy) {
      case SearchStrategy.SEMANTIC:
        fallbacks.push(SearchStrategy.KEYWORD, SearchStrategy.FUZZY);
        break;

      case SearchStrategy.EXACT_MATCH:
        fallbacks.push(SearchStrategy.KEYWORD, SearchStrategy.FUZZY);
        break;

      case SearchStrategy.PHRASE:
        fallbacks.push(SearchStrategy.KEYWORD, SearchStrategy.PROXIMITY);
        break;

      case SearchStrategy.BOOLEAN:
        fallbacks.push(SearchStrategy.KEYWORD);
        break;

      default:
        fallbacks.push(SearchStrategy.KEYWORD);
        break;
    }

    return fallbacks.slice(0, 2); // Ограничиваем двумя fallback стратегиями
  }

  /**
   * Оценка сложности запроса
   */
  private estimateComplexity(features: QueryFeatures, context: SearchContext): 'low' | 'medium' | 'high' {
    let complexityScore = 0;

    // Факторы, увеличивающие сложность
    if (features.wordCount > 5) complexityScore += 2;
    if (features.hasBooleanOperators) complexityScore += 2;
    if (features.hasWildcards) complexityScore += 1;
    if (features.hasQuotes) complexityScore += 1;
    if (context.documentCount > 100000) complexityScore += 2;
    if (context.averageDocumentLength > 5000) complexityScore += 1;

    // Определяем уровень сложности
    if (complexityScore <= 2) return 'low';
    if (complexityScore <= 5) return 'medium';
    return 'high';
  }

  /**
   * Обновление метрик производительности для обучения
   */
  updatePerformanceMetrics(query: string, strategy: SearchStrategy, responseTime: number, resultCount: number): void {
    if (!this.config.enableLearning) return;

    const metricKey = `${strategy}_${query.length <= 20 ? 'short' : 'long'}`;
    const currentMetric = this.performanceMetrics.get(metricKey) || 0;

    // Простое экспоненциальное сглаживание
    const alpha = 0.1;
    const newMetric = alpha * responseTime + (1 - alpha) * currentMetric;

    this.performanceMetrics.set(metricKey, newMetric);
  }

  /**
   * Получение рекомендаций для улучшения запроса
   */
  getQuerySuggestions(analysis: QueryAnalysis): string[] {
    const suggestions: string[] = [];

    // Предложения на основе анализа
    if (analysis.confidence < this.config.confidenceThreshold) {
      suggestions.push('Попробуйте переформулировать запрос более конкретно');
    }

    if (analysis.features.wordCount === 1) {
      suggestions.push('Добавьте дополнительные ключевые слова для более точного поиска');
    }

    if (analysis.queryType === QueryType.UNKNOWN) {
      suggestions.push('Используйте кавычки для точного поиска фразы');
    }

    if (analysis.features.hasSpecialCharacters) {
      suggestions.push('Удалите специальные символы для лучших результатов');
    }

    return suggestions;
  }
}