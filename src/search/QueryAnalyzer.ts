/**
 * Advanced Query Analyzer для LocalRetrieve
 *
 * Интеллектуальный анализатор запросов с возможностями:
 * - Natural language understanding и классификация запросов
 * - Intent detection и расширение запросов
 * - Извлечение ключевых слов и весовые коэффициенты
 * - Контекстное понимание и семантический анализ
 * - Machine learning для улучшения классификации со временем
 */

import type {
  QueryAnalysis,
  QueryFeatures,
  SearchContext,
  QueryHistory,
  SearchWeights
} from '../types/search.js';

import {
  QueryType,
  SearchStrategy
} from '../types/search.js';

import {
  QueryAnalysisError,
  DEFAULT_QUERY_ANALYZER_CONFIG
} from '../types/search.js';

/**
 * Конфигурация анализатора запросов
 */
export interface QueryAnalyzerConfig {
  /** Включить машинное обучение для улучшения классификации */
  enableLearning: boolean;
  /** Минимальная уверенность для применения стратегии */
  confidenceThreshold: number;
  /** Максимальная длина запроса для анализа */
  maxQueryLength: number;
  /** Языки для анализа */
  supportedLanguages: string[];
  /** Включить расширение запросов */
  enableQueryExpansion: boolean;
  /** Включить извлечение именованных сущностей */
  enableEntityExtraction: boolean;
}

/**
 * Результат анализа намерений пользователя
 */
export interface IntentAnalysisResult {
  /** Основное намерение */
  primaryIntent: 'search' | 'filter' | 'navigate' | 'compare' | 'discover' | 'verify';
  /** Уверенность в определении намерения */
  confidence: number;
  /** Дополнительные намерения */
  secondaryIntents: string[];
  /** Контекстные сигналы */
  contextSignals: {
    urgency?: 'low' | 'medium' | 'high';
    specificity?: 'broad' | 'specific' | 'precise';
    domain?: string;
    temporality?: 'past' | 'present' | 'future' | 'timeless';
  };
}

/**
 * Результат расширения запроса
 */
export interface QueryExpansionResult {
  /** Исходный запрос */
  originalQuery: string;
  /** Расширенный запрос */
  expandedQuery: string;
  /** Добавленные термины */
  addedTerms: string[];
  /** Синонимы */
  synonyms: Record<string, string[]>;
  /** Связанные концепции */
  relatedConcepts: string[];
  /** Уверенность в расширении */
  expansionConfidence: number;
}

/**
 * Результат извлечения именованных сущностей
 */
export interface EntityExtractionResult {
  /** Найденные сущности */
  entities: Array<{
    text: string;
    type: 'PERSON' | 'ORGANIZATION' | 'LOCATION' | 'DATE' | 'NUMBER' | 'PRODUCT' | 'CONCEPT';
    confidence: number;
    startIndex: number;
    endIndex: number;
  }>;
  /** Извлеченные ключевые слова */
  keywords: Array<{
    term: string;
    weight: number;
    pos?: string; // Part of speech
    idf?: number; // Inverse document frequency
  }>;
}

/**
 * Расширенный результат анализа запроса
 */
export interface AdvancedQueryAnalysis extends QueryAnalysis {
  /** Анализ намерений */
  intentAnalysis: IntentAnalysisResult;
  /** Результат расширения запроса */
  queryExpansion?: QueryExpansionResult;
  /** Извлеченные сущности */
  entityExtraction?: EntityExtractionResult;
  /** Языковые характеристики */
  linguisticFeatures: {
    language: string;
    confidence: number;
    sentiment?: 'positive' | 'negative' | 'neutral';
    formality?: 'formal' | 'informal' | 'mixed';
    complexity?: 'simple' | 'moderate' | 'complex';
  };
  /** ML-метрики для обучения */
  mlFeatures: {
    vectorizedFeatures?: Float32Array;
    semanticEmbedding?: Float32Array;
    tfIdfVector?: Float32Array;
  };
}

/**
 * Основной класс анализатора запросов
 */
export class QueryAnalyzer {
  private config: QueryAnalyzerConfig;
  private queryHistory: Map<string, QueryHistory[]>;
  private patternCache: Map<string, AdvancedQueryAnalysis>;
  private vocabularyIndex: Map<string, number>; // IDF scores
  private entityPatterns: Map<string, RegExp>;
  private synonymDictionary: Map<string, string[]>;

  // ML компоненты
  private classificationModel?: any; // Модель классификации запросов
  private embeddingModel?: any; // Модель для семантических эмбеддингов

  // Статистика для обучения
  private analysisStats: {
    totalQueries: number;
    correctClassifications: number;
    feedbackReceived: number;
    averageConfidence: number;
  };

  constructor(config: Partial<QueryAnalyzerConfig> = {}) {
    this.config = { ...DEFAULT_QUERY_ANALYZER_CONFIG, ...config };
    this.queryHistory = new Map();
    this.patternCache = new Map();
    this.vocabularyIndex = new Map();
    this.entityPatterns = new Map();
    this.synonymDictionary = new Map();

    this.analysisStats = {
      totalQueries: 0,
      correctClassifications: 0,
      feedbackReceived: 0,
      averageConfidence: 0
    };

    this.initializeLanguageResources();
  }

  /**
   * Основной метод анализа запроса с расширенными возможностями
   */
  async analyzeQuery(
    query: string,
    context: SearchContext = { documentCount: 0, averageDocumentLength: 0, indexCapabilities: { hasFTS: true, hasVector: false, hasEmbeddings: false } }
  ): Promise<AdvancedQueryAnalysis> {
    const startTime = Date.now();
    this.analysisStats.totalQueries++;

    try {
      // Валидация и предобработка
      const normalizedQuery = this.preprocessQuery(query);
      if (!normalizedQuery) {
        throw new QueryAnalysisError('Query is empty after preprocessing', { query });
      }

      // Проверка кэша
      const cacheKey = this.generateCacheKey(query, context);
      if (this.patternCache.has(cacheKey)) {
        return this.patternCache.get(cacheKey)!;
      }

      // Базовый анализ (из StrategyEngine)
      const basicFeatures = this.extractBasicFeatures(normalizedQuery);
      const queryType = this.classifyQueryType(normalizedQuery, basicFeatures);
      const confidence = this.calculateClassificationConfidence(queryType, basicFeatures, context);

      // Расширенный анализ
      const intentAnalysis = await this.analyzeIntent(normalizedQuery, basicFeatures, context);
      const linguisticFeatures = this.analyzeLinguisticFeatures(normalizedQuery);

      // Опциональные анализы
      let queryExpansion: QueryExpansionResult | undefined;
      let entityExtraction: EntityExtractionResult | undefined;

      if (this.config.enableQueryExpansion) {
        queryExpansion = await this.expandQuery(normalizedQuery, context);
      }

      if (this.config.enableEntityExtraction) {
        entityExtraction = this.extractEntitiesAndKeywords(normalizedQuery);
      }

      // ML features для обучения
      const mlFeatures = await this.extractMLFeatures(normalizedQuery, basicFeatures);

      // Стратегия на основе расширенного анализа
      const suggestedStrategy = this.selectOptimalStrategy(
        queryType, basicFeatures, intentAnalysis, context
      );
      const alternativeStrategies = this.getAlternativeStrategies(
        suggestedStrategy, queryType, intentAnalysis, context
      );

      const analysis: AdvancedQueryAnalysis = {
        originalQuery: query,
        normalizedQuery,
        queryType,
        confidence,
        features: basicFeatures,
        suggestedStrategy,
        alternativeStrategies,
        estimatedComplexity: this.estimateQueryComplexity(basicFeatures, intentAnalysis, context),
        intentAnalysis,
        queryExpansion,
        entityExtraction,
        linguisticFeatures,
        mlFeatures
      };

      // Кэширование результата
      this.patternCache.set(cacheKey, analysis);

      // Обновление статистики
      const processingTime = Date.now() - startTime;
      this.updateAnalysisStats(confidence, processingTime);

      // Сохранение в историю для обучения
      if (this.config.enableLearning) {
        this.addToHistory(query, analysis, context);
      }

      return analysis;

    } catch (error) {
      throw new QueryAnalysisError(
        `Advanced query analysis failed: ${error instanceof Error ? error.message : String(error)}`,
        { query, context }
      );
    }
  }

  /**
   * Анализ намерений пользователя
   */
  async analyzeIntent(
    query: string,
    features: QueryFeatures,
    context: SearchContext
  ): Promise<IntentAnalysisResult> {
    let primaryIntent: IntentAnalysisResult['primaryIntent'] = 'search';
    let confidence = 0.5;
    const secondaryIntents: string[] = [];

    // Анализ паттернов намерений
    if (features.hasQuestionWords) {
      primaryIntent = 'search';
      confidence += 0.3;
      if (query.match(/\b(compare|vs|versus|difference|better)\b/i)) {
        secondaryIntents.push('compare');
        confidence += 0.1;
      }
    } else if (features.hasBooleanOperators || features.hasNumbers) {
      primaryIntent = 'filter';
      confidence += 0.2;
    } else if (features.wordCount === 1 && !features.hasSpecialCharacters) {
      primaryIntent = 'navigate';
      confidence += 0.2;
    } else if (query.match(/\b(find|show|list|display)\b/i)) {
      primaryIntent = 'discover';
      confidence += 0.2;
    } else if (query.match(/\b(check|verify|confirm|validate)\b/i)) {
      primaryIntent = 'verify';
      confidence += 0.2;
    }

    // Контекстные сигналы
    const contextSignals: IntentAnalysisResult['contextSignals'] = {};

    // Urgency detection
    if (query.match(/\b(urgent|quickly|asap|immediately|now)\b/i)) {
      contextSignals.urgency = 'high';
    } else if (query.match(/\b(when possible|eventually|sometime)\b/i)) {
      contextSignals.urgency = 'low';
    } else {
      contextSignals.urgency = 'medium';
    }

    // Specificity analysis
    if (features.wordCount <= 2 && !features.hasQuotes) {
      contextSignals.specificity = 'broad';
    } else if (features.hasQuotes || features.hasNumbers) {
      contextSignals.specificity = 'precise';
    } else {
      contextSignals.specificity = 'specific';
    }

    // Domain detection (простая эвристика)
    const domains = {
      'tech': /\b(software|hardware|programming|code|api|database)\b/i,
      'business': /\b(sales|marketing|revenue|profit|customer|client)\b/i,
      'science': /\b(research|study|analysis|experiment|theory)\b/i,
      'personal': /\b(my|me|personal|private|own)\b/i
    };

    for (const [domain, pattern] of Object.entries(domains)) {
      if (pattern.test(query)) {
        contextSignals.domain = domain;
        break;
      }
    }

    // Temporality analysis
    if (query.match(/\b(was|were|did|had|yesterday|ago|last|past|previous)\b/i)) {
      contextSignals.temporality = 'past';
    } else if (query.match(/\b(will|shall|going to|tomorrow|next|future|plan|predict)\b/i)) {
      contextSignals.temporality = 'future';
    } else if (query.match(/\b(is|are|now|currently|today|present)\b/i)) {
      contextSignals.temporality = 'present';
    } else {
      contextSignals.temporality = 'timeless';
    }

    confidence = Math.min(1.0, Math.max(0.1, confidence));

    return {
      primaryIntent,
      confidence,
      secondaryIntents,
      contextSignals
    };
  }

  /**
   * Расширение запроса с использованием синонимов и связанных концепций
   */
  async expandQuery(query: string, context: SearchContext): Promise<QueryExpansionResult> {
    const words = query.toLowerCase().split(/\s+/);
    const addedTerms: string[] = [];
    const synonyms: Record<string, string[]> = {};
    const relatedConcepts: string[] = [];
    let expansionConfidence = 0.5;

    // Поиск синонимов
    for (const word of words) {
      if (this.synonymDictionary.has(word)) {
        const wordSynonyms = this.synonymDictionary.get(word)!;
        synonyms[word] = wordSynonyms;

        // Добавляем лучший синоним
        if (wordSynonyms.length > 0) {
          addedTerms.push(wordSynonyms[0]);
          expansionConfidence += 0.1;
        }
      }
    }

    // Поиск связанных концепций на основе истории запросов
    const historicalQueries = this.getRelatedHistoricalQueries(query);
    for (const historicalQuery of historicalQueries) {
      const historicalWords = historicalQuery.split(/\s+/);
      for (const word of historicalWords) {
        if (!words.includes(word) && !addedTerms.includes(word) && word.length > 3) {
          relatedConcepts.push(word);
          expansionConfidence += 0.05;
          if (relatedConcepts.length >= 3) break; // Ограничиваем количество
        }
      }
    }

    // Формирование расширенного запроса
    const expandedTerms = [...words, ...addedTerms.slice(0, 2), ...relatedConcepts.slice(0, 1)];
    const expandedQuery = expandedTerms.join(' ');

    expansionConfidence = Math.min(1.0, expansionConfidence);

    return {
      originalQuery: query,
      expandedQuery,
      addedTerms,
      synonyms,
      relatedConcepts,
      expansionConfidence
    };
  }

  /**
   * Извлечение именованных сущностей и ключевых слов
   */
  extractEntitiesAndKeywords(query: string): EntityExtractionResult {
    const entities: EntityExtractionResult['entities'] = [];
    const keywords: EntityExtractionResult['keywords'] = [];

    // Извлечение именованных сущностей с помощью паттернов
    for (const [entityType, pattern] of this.entityPatterns.entries()) {
      const matches = [...query.matchAll(pattern)];
      for (const match of matches) {
        if (match.index !== undefined) {
          entities.push({
            text: match[0],
            type: entityType as any,
            confidence: 0.8, // Статическая уверенность для паттерн-матчинга
            startIndex: match.index,
            endIndex: match.index + match[0].length
          });
        }
      }
    }

    // Извлечение ключевых слов с весами
    const words = query.toLowerCase().split(/\s+/);
    for (const word of words) {
      if (word.length > 2) { // Игнорируем короткие слова
        const idfScore = this.vocabularyIndex.get(word) || 1.0;
        const weight = this.calculateKeywordWeight(word, query);

        keywords.push({
          term: word,
          weight,
          idf: idfScore,
          pos: this.getPartOfSpeech(word) // Простая эвристика
        });
      }
    }

    // Сортировка ключевых слов по весу
    keywords.sort((a, b) => b.weight - a.weight);

    return {
      entities,
      keywords: keywords.slice(0, 10) // Ограничиваем топ-10 ключевых слов
    };
  }

  /**
   * Анализ лингвистических характеристик
   */
  analyzeLinguisticFeatures(query: string): AdvancedQueryAnalysis['linguisticFeatures'] {
    const words = query.split(/\s+/);

    // Определение языка (упрощенная эвристика)
    const russianPattern = /[\u0400-\u04ff]/;
    const englishPattern = /^[a-zA-Z\s\d\.\,\!\?]+$/;

    let language = 'unknown';
    let confidence = 0.5;

    if (russianPattern.test(query)) {
      language = 'ru';
      confidence = 0.8;
    } else if (englishPattern.test(query)) {
      language = 'en';
      confidence = 0.8;
    }

    // Анализ сентимента (упрощенная эвристика)
    const positiveWords = /\b(good|great|excellent|amazing|wonderful|perfect|best|love|like)\b/i;
    const negativeWords = /\b(bad|terrible|awful|horrible|worst|hate|problem|issue|error|wrong)\b/i;

    let sentiment: 'positive' | 'negative' | 'neutral' = 'neutral';
    if (positiveWords.test(query)) {
      sentiment = 'positive';
    } else if (negativeWords.test(query)) {
      sentiment = 'negative';
    }

    // Анализ формальности
    const formalIndicators = /\b(please|kindly|would|could|may|might|should)\b/i;
    const informalIndicators = /\b(hey|hi|yo|gonna|wanna|gotta|yeah|yep|nope)\b/i;

    let formality: 'formal' | 'informal' | 'mixed' = 'mixed';
    if (formalIndicators.test(query)) {
      formality = 'formal';
    } else if (informalIndicators.test(query)) {
      formality = 'informal';
    }

    // Анализ сложности
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
    let complexity: 'simple' | 'moderate' | 'complex' = 'moderate';

    if (words.length <= 3 && avgWordLength <= 5) {
      complexity = 'simple';
    } else if (words.length > 8 || avgWordLength > 8) {
      complexity = 'complex';
    }

    return {
      language,
      confidence,
      sentiment,
      formality,
      complexity
    };
  }

  /**
   * Извлечение ML-признаков для обучения
   */
  async extractMLFeatures(
    query: string,
    features: QueryFeatures
  ): Promise<AdvancedQueryAnalysis['mlFeatures']> {
    const mlFeatures: AdvancedQueryAnalysis['mlFeatures'] = {};

    // Векторизация базовых признаков
    const featureVector = new Float32Array(20);
    featureVector[0] = features.wordCount / 20; // Нормализация
    featureVector[1] = features.averageWordLength / 10;
    featureVector[2] = features.hasQuestionWords ? 1 : 0;
    featureVector[3] = features.hasBooleanOperators ? 1 : 0;
    featureVector[4] = features.hasWildcards ? 1 : 0;
    featureVector[5] = features.hasQuotes ? 1 : 0;
    featureVector[6] = features.hasNumbers ? 1 : 0;
    featureVector[7] = features.hasSpecialCharacters ? 1 : 0;
    featureVector[8] = features.containsCommonStopWords ? 1 : 0;

    // Добавляем дополнительные признаки
    featureVector[9] = query.length / 200; // Длина запроса
    featureVector[10] = (query.match(/[A-Z]/g) || []).length / query.length; // Доля заглавных букв
    featureVector[11] = (query.match(/\d/g) || []).length / query.length; // Доля цифр

    mlFeatures.vectorizedFeatures = featureVector;

    // TF-IDF векторизация (упрощенная)
    const words = query.toLowerCase().split(/\s+/);
    const tfIdfVector = new Float32Array(100); // Фиксированная размерность

    for (let i = 0; i < words.length && i < 100; i++) {
      const word = words[i];
      const tf = words.filter(w => w === word).length / words.length;
      const idf = this.vocabularyIndex.get(word) || 1.0;
      tfIdfVector[i] = tf * idf;
    }

    mlFeatures.tfIdfVector = tfIdfVector;

    // Семантические эмбеддинги (будут добавлены при интеграции с InternalPipeline)
    // mlFeatures.semanticEmbedding = await this.generateSemanticEmbedding(query);

    return mlFeatures;
  }

  /**
   * Предварительная обработка запроса
   */
  private preprocessQuery(query: string): string {
    if (!query || typeof query !== 'string') {
      return '';
    }

    return query
      .trim()
      .replace(/\s+/g, ' ') // Убираем лишние пробелы
      .replace(/[^\w\s\-"'.,!?()]/g, ' ') // Убираем лишние спецсимволы
      .trim();
  }

  /**
   * Извлечение базовых признаков (совместимо с StrategyEngine)
   */
  private extractBasicFeatures(query: string): QueryFeatures {
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

    // Список стоп-слов (расширенный)
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'в', 'на', 'с', 'по', 'для', 'и', 'или', 'но', 'что', 'как', 'где', 'когда', 'this', 'that',
      'it', 'is', 'was', 'are', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did'
    ]);

    const containsCommonStopWords = words.some(word => stopWords.has(word.toLowerCase()));

    // Определяем намерение пользователя (базовая логика)
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
   * Классификация типа запроса (расширенная логика)
   */
  private classifyQueryType(query: string, features: QueryFeatures): QueryType {
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

    // Вопросы (расширенная логика)
    if (features.hasQuestionWords || query.endsWith('?')) {
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

    // Именованные сущности (улучшенная логика)
    if (features.wordCount <= 2 && !features.containsCommonStopWords &&
        /^[A-Z]/.test(query)) { // Начинается с заглавной буквы
      return QueryType.ENTITY;
    }

    return QueryType.UNKNOWN;
  }

  /**
   * Расчет уверенности классификации (улучшенная логика)
   */
  private calculateClassificationConfidence(
    queryType: QueryType,
    features: QueryFeatures,
    context: SearchContext
  ): number {
    let confidence = 0.5; // Базовая уверенность

    // Увеличиваем уверенность для четких индикаторов
    if (features.hasQuotes) confidence += 0.4;
    if (features.hasBooleanOperators) confidence += 0.35;
    if (features.hasWildcards) confidence += 0.3;
    if (features.hasQuestionWords) confidence += 0.25;

    // Корректируем на основе длины запроса
    if (features.wordCount === 1) confidence += 0.15;
    else if (features.wordCount >= 4 && features.wordCount <= 8) confidence += 0.1;
    else if (features.wordCount > 15) confidence -= 0.1; // Очень длинные запросы труднее классифицировать

    // Учитываем контекст
    if (context.indexCapabilities.hasEmbeddings && queryType === QueryType.QUESTION) {
      confidence += 0.1;
    }

    // Учитываем историю успешных классификаций
    if (this.analysisStats.totalQueries > 0) {
      const historicalAccuracy = this.analysisStats.correctClassifications / this.analysisStats.totalQueries;
      confidence += historicalAccuracy * 0.1;
    }

    // Ограничиваем диапазон 0-1
    return Math.min(1, Math.max(0.1, confidence));
  }

  /**
   * Выбор оптимальной стратегии на основе расширенного анализа
   */
  private selectOptimalStrategy(
    queryType: QueryType,
    features: QueryFeatures,
    intentAnalysis: IntentAnalysisResult,
    context: SearchContext
  ): SearchStrategy {
    // Базовая логика из StrategyEngine
    let baseStrategy: SearchStrategy;

    switch (queryType) {
      case QueryType.EXACT_PHRASE:
        baseStrategy = SearchStrategy.EXACT_MATCH;
        break;
      case QueryType.BOOLEAN_QUERY:
        baseStrategy = SearchStrategy.BOOLEAN;
        break;
      case QueryType.WILDCARD:
        baseStrategy = SearchStrategy.FUZZY;
        break;
      case QueryType.QUESTION:
        baseStrategy = context.indexCapabilities.hasEmbeddings ?
          SearchStrategy.SEMANTIC : SearchStrategy.KEYWORD;
        break;
      case QueryType.SHORT_KEYWORD:
        baseStrategy = features.wordCount === 1 ?
          SearchStrategy.EXACT_MATCH : SearchStrategy.KEYWORD;
        break;
      case QueryType.LONG_PHRASE:
        baseStrategy = context.indexCapabilities.hasEmbeddings ?
          SearchStrategy.SEMANTIC : SearchStrategy.PHRASE;
        break;
      case QueryType.NUMERIC:
        baseStrategy = SearchStrategy.EXACT_MATCH;
        break;
      case QueryType.ENTITY:
        baseStrategy = SearchStrategy.EXACT_MATCH;
        break;
      default:
        baseStrategy = SearchStrategy.KEYWORD;
    }

    // Корректировка на основе анализа намерений
    if (intentAnalysis.primaryIntent === 'compare') {
      return SearchStrategy.SEMANTIC; // Семантический поиск лучше для сравнений
    }

    if (intentAnalysis.primaryIntent === 'discover' && context.indexCapabilities.hasEmbeddings) {
      return SearchStrategy.SEMANTIC; // Семантический поиск лучше для исследования
    }

    if (intentAnalysis.contextSignals.specificity === 'precise') {
      return SearchStrategy.EXACT_MATCH; // Точный поиск для конкретных запросов
    }

    if (intentAnalysis.contextSignals.urgency === 'high') {
      // Быстрые стратегии для срочных запросов
      return baseStrategy === SearchStrategy.SEMANTIC ? SearchStrategy.KEYWORD : baseStrategy;
    }

    return baseStrategy;
  }

  /**
   * Получение альтернативных стратегий (расширенная логика)
   */
  private getAlternativeStrategies(
    primaryStrategy: SearchStrategy,
    queryType: QueryType,
    intentAnalysis: IntentAnalysisResult,
    context: SearchContext
  ): SearchStrategy[] {
    const alternatives: SearchStrategy[] = [];
    const maxAlternatives = 3;

    // Всегда добавляем ключевой поиск как fallback
    if (primaryStrategy !== SearchStrategy.KEYWORD && alternatives.length < maxAlternatives) {
      alternatives.push(SearchStrategy.KEYWORD);
    }

    // Семантический поиск как альтернатива при наличии эмбеддингов
    if (context.indexCapabilities.hasEmbeddings &&
        primaryStrategy !== SearchStrategy.SEMANTIC &&
        alternatives.length < maxAlternatives) {
      alternatives.push(SearchStrategy.SEMANTIC);
    }

    // Нечеткий поиск для пользователей с возможными опечатками
    if (primaryStrategy !== SearchStrategy.FUZZY && alternatives.length < maxAlternatives) {
      alternatives.push(SearchStrategy.FUZZY);
    }

    // Фразовый поиск для длинных запросов
    if (queryType === QueryType.LONG_PHRASE &&
        primaryStrategy !== SearchStrategy.PHRASE &&
        alternatives.length < maxAlternatives) {
      alternatives.push(SearchStrategy.PHRASE);
    }

    return alternatives;
  }

  /**
   * Оценка сложности запроса (улучшенная логика)
   */
  private estimateQueryComplexity(
    features: QueryFeatures,
    intentAnalysis: IntentAnalysisResult,
    context: SearchContext
  ): 'low' | 'medium' | 'high' {
    let complexityScore = 0;

    // Факторы, увеличивающие сложность
    if (features.wordCount > 8) complexityScore += 3;
    else if (features.wordCount > 5) complexityScore += 2;
    else if (features.wordCount <= 2) complexityScore += 1; // Очень короткие запросы тоже могут быть сложными

    if (features.hasBooleanOperators) complexityScore += 3;
    if (features.hasWildcards) complexityScore += 2;
    if (features.hasQuotes) complexityScore += 1;
    if (features.hasSpecialCharacters) complexityScore += 1;

    // Контекстные факторы
    if (context.documentCount > 100000) complexityScore += 2;
    if (context.averageDocumentLength > 5000) complexityScore += 1;

    // Факторы на основе анализа намерений
    if (intentAnalysis.primaryIntent === 'compare') complexityScore += 2;
    if (intentAnalysis.contextSignals.specificity === 'broad') complexityScore += 1;

    // Определяем уровень сложности
    if (complexityScore <= 3) return 'low';
    if (complexityScore <= 7) return 'medium';
    return 'high';
  }

  // === Вспомогательные методы ===

  /**
   * Инициализация языковых ресурсов
   */
  private initializeLanguageResources(): void {
    // Инициализация базового словаря синонимов
    this.synonymDictionary.set('find', ['search', 'locate', 'discover']);
    this.synonymDictionary.set('показать', ['отобразить', 'вывести', 'представить']);
    this.synonymDictionary.set('good', ['excellent', 'great', 'wonderful']);
    this.synonymDictionary.set('bad', ['poor', 'terrible', 'awful']);

    // Инициализация паттернов для именованных сущностей
    this.entityPatterns.set('DATE', /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/g);
    this.entityPatterns.set('NUMBER', /\b\d+(?:\.\d+)?\b/g);
    this.entityPatterns.set('PERSON', /\b[A-Z][a-z]+\s[A-Z][a-z]+\b/g);
    this.entityPatterns.set('ORGANIZATION', /\b[A-Z][a-zA-Z]*\s(?:Inc|LLC|Ltd|Corp|Company)\b/g);

    // Инициализация базового IDF индекса
    this.vocabularyIndex.set('the', 0.1);
    this.vocabularyIndex.set('and', 0.2);
    this.vocabularyIndex.set('database', 2.5);
    this.vocabularyIndex.set('search', 3.0);
    this.vocabularyIndex.set('algorithm', 4.0);
  }

  /**
   * Генерация ключа кэша
   */
  private generateCacheKey(query: string, context: SearchContext): string {
    const contextKey = `${context.documentCount}_${context.indexCapabilities.hasEmbeddings}`;
    return `query_analysis:${query.toLowerCase().trim()}:${contextKey}`;
  }

  /**
   * Получение связанных исторических запросов
   */
  private getRelatedHistoricalQueries(query: string): string[] {
    const queryWords = new Set(query.toLowerCase().split(/\s+/));
    const relatedQueries: string[] = [];

    for (const [historicalQuery, histories] of this.queryHistory.entries()) {
      const historicalWords = new Set(historicalQuery.toLowerCase().split(/\s+/));
      const intersection = new Set([...queryWords].filter(x => historicalWords.has(x)));

      if (intersection.size > 0 && intersection.size / queryWords.size > 0.3) {
        relatedQueries.push(historicalQuery);
      }
    }

    return relatedQueries.slice(0, 5);
  }

  /**
   * Расчет веса ключевого слова
   */
  private calculateKeywordWeight(word: string, query: string): number {
    const tf = (query.match(new RegExp(`\\b${word}\\b`, 'gi')) || []).length / query.split(/\s+/).length;
    const idf = this.vocabularyIndex.get(word) || 1.0;
    const positionWeight = query.toLowerCase().indexOf(word) === 0 ? 1.2 : 1.0; // Больший вес для слов в начале

    return tf * idf * positionWeight;
  }

  /**
   * Простое определение части речи
   */
  private getPartOfSpeech(word: string): string {
    // Простая эвристика на основе окончаний
    if (word.match(/ing$/)) return 'VBG'; // Gerund
    if (word.match(/ed$/)) return 'VBD'; // Past tense
    if (word.match(/s$/)) return 'NNS'; // Plural noun
    if (word.match(/ly$/)) return 'RB'; // Adverb

    return 'NN'; // Default to noun
  }

  /**
   * Добавление в историю для обучения
   */
  private addToHistory(query: string, analysis: AdvancedQueryAnalysis, context: SearchContext): void {
    if (!this.queryHistory.has(query)) {
      this.queryHistory.set(query, []);
    }

    const history: QueryHistory = {
      query,
      strategy: analysis.suggestedStrategy,
      resultCount: 0, // Будет обновлено после выполнения поиска
      userInteraction: 'ignored', // Будет обновлено на основе обратной связи
      timestamp: Date.now()
    };

    this.queryHistory.get(query)!.push(history);

    // Ограничиваем размер истории
    if (this.queryHistory.get(query)!.length > 10) {
      this.queryHistory.get(query)!.shift();
    }
  }

  /**
   * Обновление статистики анализа
   */
  private updateAnalysisStats(confidence: number, processingTime: number): void {
    this.analysisStats.averageConfidence =
      (this.analysisStats.averageConfidence * (this.analysisStats.totalQueries - 1) + confidence) /
      this.analysisStats.totalQueries;
  }

  /**
   * Получение статистики производительности анализатора
   */
  getAnalysisStats() {
    return {
      ...this.analysisStats,
      cacheSize: this.patternCache.size,
      historySize: Array.from(this.queryHistory.values()).reduce((sum, arr) => sum + arr.length, 0),
      vocabularySize: this.vocabularyIndex.size
    };
  }

  /**
   * Обратная связь для улучшения классификации
   */
  provideFeedback(query: string, wasCorrect: boolean, actualStrategy?: SearchStrategy): void {
    if (wasCorrect) {
      this.analysisStats.correctClassifications++;
    }

    this.analysisStats.feedbackReceived++;

    // Обновляем историю запросов
    if (this.queryHistory.has(query)) {
      const histories = this.queryHistory.get(query)!;
      const lastHistory = histories[histories.length - 1];
      if (lastHistory) {
        lastHistory.userInteraction = wasCorrect ? 'clicked' : 'refined';
        if (actualStrategy) {
          lastHistory.strategy = actualStrategy;
        }
      }
    }
  }

  /**
   * Очистка кэшей и освобождение ресурсов
   */
  clearCache(): void {
    this.patternCache.clear();
    this.queryHistory.clear();
  }
}

/**
 * Фабричная функция для создания QueryAnalyzer
 */
export function createQueryAnalyzer(config?: Partial<QueryAnalyzerConfig>): QueryAnalyzer {
  return new QueryAnalyzer(config);
}

/**
 * Экспорт по умолчанию
 */
export default QueryAnalyzer;