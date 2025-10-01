/**
 * Enhanced Search Strategy Engine для LocalRetrieve
 *
 * Интеллектуальный движок анализа запросов и выбора стратегии поиска
 * с интеграцией расширенного QueryAnalyzer для улучшенного понимания
 * запросов и более точного выбора стратегий.
 *
 * Архитектурные улучшения:
 * - Интеграция с QueryAnalyzer для расширенного анализа NLP
 * - Контекстно-зависимый выбор стратегий
 * - Адаптивное обучение на основе пользовательского поведения
 * - Поддержка персонализированных стратегий
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
  StrategyEngineConfig,
  QueryHistory
} from '../types/search.js';

import { QueryAnalyzer, type AdvancedQueryAnalysis, type QueryAnalyzerConfig } from './QueryAnalyzer.js';
import type { SearchAnalytics } from '../analytics/SearchAnalytics.js';

/**
 * Расширенная конфигурация StrategyEngine с поддержкой QueryAnalyzer
 */
export interface EnhancedStrategyEngineConfig extends StrategyEngineConfig {
  /** Включить расширенный анализ через QueryAnalyzer */
  enableAdvancedAnalysis: boolean;

  /** Конфигурация QueryAnalyzer */
  queryAnalyzerConfig?: Partial<QueryAnalyzerConfig>;

  /** Включить персонализированные стратегии */
  enablePersonalization: boolean;

  /** Включить интеграцию с аналитикой */
  enableAnalyticsIntegration: boolean;

  /** Веса для комбинирования базового и расширенного анализа */
  analysisWeights: {
    baseAnalysis: number;
    advancedAnalysis: number;
  };
}

/**
 * Основной движок анализа запросов и выбора стратегии с расширенными возможностями
 */
export class StrategyEngine {
  private config: EnhancedStrategyEngineConfig;
  private queryPatterns: Map<string, QueryAnalysis>;
  private performanceMetrics: Map<string, number>;

  // Интеграция с QueryAnalyzer
  private queryAnalyzer?: QueryAnalyzer;
  private analytics?: SearchAnalytics;

  // Кэш расширенных анализов
  private advancedAnalysisCache = new Map<string, AdvancedQueryAnalysis>();

  // История для персонализации
  private userHistory = new Map<string, QueryHistory[]>();

  // Статистика производительности
  private strategyPerformance = new Map<SearchStrategy, {
    totalUses: number;
    avgResponseTime: number;
    successRate: number;
    userSatisfaction: number;
  }>();

  constructor(
    config: Partial<EnhancedStrategyEngineConfig> = {},
    analytics?: SearchAnalytics
  ) {
    this.config = {
      ...DEFAULT_STRATEGY_ENGINE_CONFIG,
      enableAdvancedAnalysis: true,
      enablePersonalization: true,
      enableAnalyticsIntegration: true,
      analysisWeights: {
        baseAnalysis: 0.4,
        advancedAnalysis: 0.6
      },
      ...config
    };
    this.queryPatterns = new Map();
    this.performanceMetrics = new Map();
    this.analytics = analytics;

    // Инициализируем QueryAnalyzer если включен расширенный анализ
    if (this.config.enableAdvancedAnalysis) {
      this.queryAnalyzer = new QueryAnalyzer(this.config.queryAnalyzerConfig);
    }
  }

  /**
   * Расширенный анализ запроса с интеграцией QueryAnalyzer
   */
  async analyzeQuery(
    query: string,
    context: SearchContext = {
      documentCount: 0,
      averageDocumentLength: 0,
      indexCapabilities: { hasFTS: true, hasVector: false, hasEmbeddings: false }
    },
    userContext?: {
      userId?: string;
      sessionId?: string;
      previousQueries?: QueryHistory[];
    }
  ): Promise<QueryAnalysis> {
    try {
      // Базовый анализ (совместимость с существующим кодом)
      const baseAnalysis = await this.performBaseAnalysis(query, context);

      // Расширенный анализ через QueryAnalyzer (если включен)
      let enhancedAnalysis: AdvancedQueryAnalysis | null = null;
      if (this.config.enableAdvancedAnalysis && this.queryAnalyzer) {
        enhancedAnalysis = await this.performAdvancedAnalysis(query, context, userContext?.previousQueries);
      }

      // Комбинируем анализы
      const finalAnalysis = this.combineAnalyses(baseAnalysis, enhancedAnalysis, context, userContext);

      // Интеграция с аналитикой
      if (this.config.enableAnalyticsIntegration && this.analytics) {
        this.analytics.trackQuery(
          this.generateQueryId(query),
          userContext?.sessionId || 'anonymous',
          query,
          enhancedAnalysis || this.convertToEnhancedAnalysis(baseAnalysis),
          context
        );
      }

      // Кэшируем анализ для повторного использования
      if (this.config.enableLearning) {
        this.queryPatterns.set(query, finalAnalysis);
      }

      return finalAnalysis;
    } catch (error) {
      // Логируем ошибку в аналитику
      if (this.config.enableAnalyticsIntegration && this.analytics) {
        this.analytics.trackError(
          'query_parsing',
          'ANALYSIS_FAILED',
          error instanceof Error ? error.message : String(error),
          { query: query.substring(0, 100), context },
          userContext?.sessionId
        );
      }

      throw new QueryAnalysisError(
        `Enhanced query analysis failed: ${error instanceof Error ? error.message : String(error)}`,
        { query, context, userContext }
      );
    }
  }

  /**
   * Выполнение базового анализа (совместимость)
   */
  private async performBaseAnalysis(query: string, context: SearchContext): Promise<QueryAnalysis> {
    const normalizedQuery = this.normalizeQuery(query);
    const features = this.extractFeatures(normalizedQuery);
    const queryType = this.classifyQuery(normalizedQuery, features);
    const confidence = this.calculateConfidence(queryType, features);

    const suggestedStrategy = this.selectPrimaryStrategy(queryType, features, context);
    const alternativeStrategies = this.getAlternativeStrategies(suggestedStrategy, queryType, context);

    return {
      originalQuery: query,
      normalizedQuery,
      queryType,
      confidence,
      features,
      suggestedStrategy,
      alternativeStrategies,
      estimatedComplexity: this.estimateComplexity(features, context)
    };
  }

  /**
   * Выполнение расширенного анализа через QueryAnalyzer
   */
  private async performAdvancedAnalysis(
    query: string,
    context: SearchContext,
    userHistory?: QueryHistory[]
  ): Promise<AdvancedQueryAnalysis | null> {
    if (!this.queryAnalyzer) return null;

    const cacheKey = this.generateAnalysisCacheKey(query, context);

    // Проверяем кэш
    if (this.advancedAnalysisCache.has(cacheKey)) {
      return this.advancedAnalysisCache.get(cacheKey)!;
    }

    try {
      const analysis = await this.queryAnalyzer.analyzeQuery(query, context);

      // Кэшируем результат
      this.advancedAnalysisCache.set(cacheKey, analysis);

      return analysis;
    } catch (error) {
      console.warn('Advanced query analysis failed, falling back to basic analysis:', error);
      return null;
    }
  }

  /**
   * Комбинирование базового и расширенного анализов
   */
  private combineAnalyses(
    baseAnalysis: QueryAnalysis,
    enhancedAnalysis: AdvancedQueryAnalysis | null,
    context: SearchContext,
    userContext?: { userId?: string; sessionId?: string }
  ): QueryAnalysis {
    if (!enhancedAnalysis) {
      return baseAnalysis;
    }

    // Комбинируем уверенность с учетом весов
    const combinedConfidence =
      baseAnalysis.confidence * this.config.analysisWeights.baseAnalysis +
      enhancedAnalysis.confidence * this.config.analysisWeights.advancedAnalysis;

    // Выбираем лучшую стратегию на основе комбинированного анализа
    const enhancedStrategy = this.selectEnhancedStrategy(
      baseAnalysis,
      enhancedAnalysis,
      context,
      userContext
    );

    // Комбинируем альтернативные стратегии
    const combinedAlternatives = this.combineAlternativeStrategies(
      baseAnalysis.alternativeStrategies,
      enhancedAnalysis.alternativeStrategies
    );

    return {
      originalQuery: baseAnalysis.originalQuery,
      normalizedQuery: baseAnalysis.normalizedQuery,
      queryType: enhancedAnalysis.queryType, // Используем результат расширенного анализа
      confidence: combinedConfidence,
      features: baseAnalysis.features,
      suggestedStrategy: enhancedStrategy,
      alternativeStrategies: combinedAlternatives,
      estimatedComplexity: enhancedAnalysis.estimatedComplexity
    };
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

  // === Методы интеграции с QueryAnalyzer ===

  /**
   * Выбор расширенной стратегии на основе комбинированного анализа
   */
  private selectEnhancedStrategy(
    baseAnalysis: QueryAnalysis,
    enhancedAnalysis: AdvancedQueryAnalysis,
    context: SearchContext,
    userContext?: { userId?: string; sessionId?: string }
  ): SearchStrategy {
    // Учитываем анализ намерений из расширенного анализа
    if (enhancedAnalysis.intentAnalysis?.primaryIntent === 'compare' &&
        context.indexCapabilities.hasEmbeddings) {
      return SearchStrategy.SEMANTIC;
    }

    if (enhancedAnalysis.intentAnalysis?.primaryIntent === 'discover' &&
        context.indexCapabilities.hasEmbeddings) {
      return SearchStrategy.SEMANTIC;
    }

    // Учитываем специфичность запроса
    if (enhancedAnalysis.intentAnalysis?.contextSignals.specificity === 'precise') {
      return SearchStrategy.EXACT_MATCH;
    }

    // Учитываем срочность запроса
    if (enhancedAnalysis.intentAnalysis?.contextSignals.urgency === 'high') {
      // Предпочитаем быстрые стратегии
      return baseAnalysis.suggestedStrategy === SearchStrategy.SEMANTIC
        ? SearchStrategy.KEYWORD
        : baseAnalysis.suggestedStrategy;
    }

    // Персонализация на основе истории пользователя
    if (this.config.enablePersonalization && userContext?.userId) {
      const personalizedStrategy = this.getPersonalizedStrategy(
        userContext.userId,
        enhancedAnalysis,
        context
      );
      if (personalizedStrategy) {
        return personalizedStrategy;
      }
    }

    // Используем расширенную стратегию, если уверенность высокая
    if (enhancedAnalysis.confidence > 0.8) {
      return enhancedAnalysis.suggestedStrategy;
    }

    // Иначе комбинируем стратегии на основе весов
    return this.combineStrategies(baseAnalysis.suggestedStrategy, enhancedAnalysis.suggestedStrategy);
  }

  /**
   * Комбинирование альтернативных стратегий
   */
  private combineAlternativeStrategies(
    baseAlternatives: SearchStrategy[],
    enhancedAlternatives: SearchStrategy[]
  ): SearchStrategy[] {
    const combined = new Set([...baseAlternatives, ...enhancedAlternatives]);
    return Array.from(combined).slice(0, this.config.maxAlternatives);
  }

  /**
   * Получение персонализированной стратегии
   */
  private getPersonalizedStrategy(
    userId: string,
    analysis: AdvancedQueryAnalysis,
    context: SearchContext
  ): SearchStrategy | null {
    const userHistory = this.userHistory.get(userId);
    if (!userHistory || userHistory.length === 0) {
      return null;
    }

    // Анализируем успешные стратегии пользователя
    const strategySuccess = new Map<SearchStrategy, number>();
    for (const historyItem of userHistory) {
      if (historyItem.userInteraction === 'clicked') {
        const current = strategySuccess.get(historyItem.strategy) || 0;
        strategySuccess.set(historyItem.strategy, current + 1);
      }
    }

    // Находим наиболее успешную стратегию
    if (strategySuccess.size > 0) {
      const sortedStrategies = Array.from(strategySuccess.entries())
        .sort((a, b) => b[1] - a[1]);

      const bestStrategy = sortedStrategies[0][0];

      // Используем персонализированную стратегию только если у нее достаточно данных
      if (sortedStrategies[0][1] >= 3) {
        return bestStrategy;
      }
    }

    return null;
  }

  /**
   * Комбинирование двух стратегий
   */
  private combineStrategies(strategy1: SearchStrategy, strategy2: SearchStrategy): SearchStrategy {
    // Приоритет семантическому поиску если доступен
    if ((strategy1 === SearchStrategy.SEMANTIC || strategy2 === SearchStrategy.SEMANTIC)) {
      return SearchStrategy.SEMANTIC;
    }

    // Приоритет точному поиску
    if (strategy1 === SearchStrategy.EXACT_MATCH || strategy2 === SearchStrategy.EXACT_MATCH) {
      return SearchStrategy.EXACT_MATCH;
    }

    // По умолчанию возвращаем первую стратегию
    return strategy1;
  }

  /**
   * Генерация ID запроса для аналитики
   */
  private generateQueryId(query: string): string {
    const timestamp = Date.now().toString(36);
    const hash = this.simpleHash(query).toString(36);
    return `q_${timestamp}_${hash}`;
  }

  /**
   * Генерация ключа кэша для расширенного анализа
   */
  private generateAnalysisCacheKey(query: string, context: SearchContext): string {
    const contextKey = JSON.stringify({
      collection: context.collectionName,
      documentCount: Math.floor(context.documentCount / 1000), // Округляем для лучшего кэширования
      capabilities: context.indexCapabilities
    });
    return `${query.toLowerCase()}_${this.simpleHash(contextKey)}`;
  }

  /**
   * Конвертация базового анализа в расширенный формат для аналитики
   */
  private convertToEnhancedAnalysis(baseAnalysis: QueryAnalysis): AdvancedQueryAnalysis {
    return {
      ...baseAnalysis,
      intentAnalysis: {
        primaryIntent: 'search',
        confidence: baseAnalysis.confidence,
        secondaryIntents: [],
        contextSignals: {
          urgency: 'medium',
          specificity: baseAnalysis.features.wordCount <= 2 ? 'broad' : 'specific',
          temporality: 'timeless'
        }
      },
      linguisticFeatures: {
        language: 'unknown',
        confidence: 0.5,
        complexity: baseAnalysis.estimatedComplexity === 'low' ? 'simple'
          : baseAnalysis.estimatedComplexity === 'medium' ? 'moderate'
          : baseAnalysis.estimatedComplexity === 'high' ? 'complex'
          : 'simple'
      },
      mlFeatures: {}
    };
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
   * Обновление истории пользователя
   */
  updateUserHistory(userId: string, queryHistory: QueryHistory): void {
    if (!this.config.enablePersonalization) return;

    if (!this.userHistory.has(userId)) {
      this.userHistory.set(userId, []);
    }

    const history = this.userHistory.get(userId)!;
    history.push(queryHistory);

    // Ограничиваем размер истории
    if (history.length > 50) {
      history.splice(0, history.length - 50);
    }
  }

  /**
   * Обновление статистики производительности стратегий
   */
  updateStrategyPerformance(
    strategy: SearchStrategy,
    responseTime: number,
    resultCount: number,
    userSatisfaction: number
  ): void {
    const stats = this.strategyPerformance.get(strategy) || {
      totalUses: 0,
      avgResponseTime: 0,
      successRate: 0,
      userSatisfaction: 0
    };

    stats.totalUses++;
    stats.avgResponseTime = (stats.avgResponseTime * (stats.totalUses - 1) + responseTime) / stats.totalUses;
    stats.successRate = (stats.successRate * (stats.totalUses - 1) + (resultCount > 0 ? 1 : 0)) / stats.totalUses;
    stats.userSatisfaction = (stats.userSatisfaction * (stats.totalUses - 1) + userSatisfaction) / stats.totalUses;

    this.strategyPerformance.set(strategy, stats);
  }

  /**
   * Получение статистики производительности
   */
  getStrategyPerformanceStats() {
    return new Map(this.strategyPerformance);
  }

  /**
   * Получение рекомендаций по оптимизации на основе расширенной аналитики
   */
  getOptimizationRecommendations(): Array<{
    recommendation: string;
    impact: 'high' | 'medium' | 'low';
    strategy?: SearchStrategy;
  }> {
    const recommendations: Array<{
      recommendation: string;
      impact: 'high' | 'medium' | 'low';
      strategy?: SearchStrategy;
    }> = [];

    // Анализируем производительность стратегий
    for (const [strategy, stats] of this.strategyPerformance) {
      if (stats.avgResponseTime > 1000) {
        recommendations.push({
          recommendation: `Стратегия ${strategy} работает медленно (${stats.avgResponseTime.toFixed(0)}ms). Рассмотрите оптимизацию.`,
          impact: 'high',
          strategy
        });
      }

      if (stats.successRate < 0.7) {
        recommendations.push({
          recommendation: `Стратегия ${strategy} имеет низкий успех (${(stats.successRate * 100).toFixed(1)}%). Проверьте конфигурацию.`,
          impact: 'medium',
          strategy
        });
      }

      if (stats.userSatisfaction < 0.6) {
        recommendations.push({
          recommendation: `Пользователи не удовлетворены результатами стратегии ${strategy} (${(stats.userSatisfaction * 100).toFixed(1)}%).`,
          impact: 'high',
          strategy
        });
      }
    }

    return recommendations.sort((a, b) => {
      const impactWeight = { high: 3, medium: 2, low: 1 };
      return impactWeight[b.impact] - impactWeight[a.impact];
    });
  }

  /**
   * Очистка кэшей и статистики
   */
  clearCache(): void {
    this.queryPatterns.clear();
    this.advancedAnalysisCache.clear();
    this.userHistory.clear();

    if (this.queryAnalyzer) {
      this.queryAnalyzer.clearCache();
    }
  }
}