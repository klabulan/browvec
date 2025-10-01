/**
 * Advanced Search Analytics для LocalRetrieve
 *
 * Комплексная система аналитики поисковых запросов с отслеживанием
 * пользовательского поведения, производительности системы, качества
 * результатов и A/B тестирования для непрерывного улучшения поиска.
 *
 * Архитектурные принципы:
 * - Реальное время: событийная система сбора метрик
 * - Privacy-first: агрегированные данные без личной информации
 * - Performance tracking: детальные метрики производительности
 * - Quality assessment: автоматическая оценка качества результатов
 * - ML insights: данные для улучшения ML-моделей
 */

import type {
  SearchResponse,
  SearchResult,
  QueryAnalysis
} from '../types/search.js';

import {
  SearchStrategy,
  FusionMethod,
  SearchMode,
  QueryType
} from '../types/search.js';

import type { AdvancedQueryAnalysis } from '../search/QueryAnalyzer.js';
import type { OptimizedResult, OptimizationContext } from '../search/SearchOptimizer.js';

/**
 * События аналитики
 */
export type AnalyticsEvent =
  | QueryEvent
  | ResultEvent
  | UserInteractionEvent
  | PerformanceEvent
  | ErrorEvent
  | ExperimentEvent;

/**
 * Событие запроса
 */
export interface QueryEvent {
  type: 'query';
  timestamp: number;
  sessionId: string;
  queryId: string;
  query: string;
  queryHash: string; // Хешированный запрос для приватности
  analysis: {
    queryType: QueryType;
    confidence: number;
    complexity: 'low' | 'medium' | 'high';
    language: string;
    wordCount: number;
    suggestedStrategy: SearchStrategy;
  };
  context: {
    collection?: string;
    mode: SearchMode;
    userAgent?: string;
    deviceType?: 'desktop' | 'mobile' | 'tablet';
    location?: string; // Регион, не точное местоположение
  };
}

/**
 * Событие результатов
 */
export interface ResultEvent {
  type: 'result';
  timestamp: number;
  sessionId: string;
  queryId: string;
  searchTime: number;
  strategy: SearchStrategy;
  fusion?: FusionMethod;
  totalResults: number;
  returnedResults: number;
  topScores: number[]; // Топ-10 скоров для анализа распределения
  qualityMetrics: {
    averageScore: number;
    scoreVariance: number;
    diversityIndex: number;
    coverageScore: number; // Покрытие запроса результатами
  };
}

/**
 * Событие взаимодействия пользователя
 */
export interface UserInteractionEvent {
  type: 'interaction';
  timestamp: number;
  sessionId: string;
  queryId: string;
  action: 'click' | 'view' | 'skip' | 'refine_query' | 'change_strategy' | 'export' | 'share';
  targetId?: string; // ID результата для click/view
  targetRank?: number; // Позиция результата
  dwell_time?: number; // Время, проведенное с результатом
  refinedQuery?: string; // Новый запрос при рефайне
  metadata?: Record<string, any>;
}

/**
 * Событие производительности
 */
export interface PerformanceEvent {
  type: 'performance';
  timestamp: number;
  sessionId: string;
  queryId: string;
  metrics: {
    queryProcessingTime: number;
    analysisTime: number;
    embeddingGenerationTime?: number;
    searchExecutionTime: number;
    resultProcessingTime: number;
    totalTime: number;
    memoryUsage?: number;
    cacheHitRate?: number;
    indexUsage: {
      fts: boolean;
      vector: boolean;
      metadata: boolean;
    };
  };
}

/**
 * Событие ошибки
 */
export interface ErrorEvent {
  type: 'error';
  timestamp: number;
  sessionId: string;
  queryId?: string;
  errorType: 'query_parsing' | 'search_execution' | 'result_processing' | 'embedding_generation' | 'timeout' | 'system';
  errorCode: string;
  errorMessage: string;
  context: Record<string, any>;
  recoveryAction?: string;
}

/**
 * Событие эксперимента (A/B тест)
 */
export interface ExperimentEvent {
  type: 'experiment';
  timestamp: number;
  sessionId: string;
  queryId: string;
  experimentId: string;
  variant: string;
  hypothesis: string;
  metrics: Record<string, number>;
}

/**
 * Агрегированные метрики по времени
 */
export interface TimeSeriesMetrics {
  timestamp: number;
  interval: 'minute' | 'hour' | 'day' | 'week';
  metrics: {
    queryCount: number;
    uniqueSessions: number;
    averageResponseTime: number;
    errorRate: number;
    topQueries: Array<{ query: string; count: number }>;
    topStrategies: Array<{ strategy: SearchStrategy; count: number; avgTime: number }>;
    qualityScore: number;
    userSatisfaction: number; // На основе взаимодействий
  };
}

/**
 * Аналитика производительности
 */
export interface PerformanceAnalytics {
  overall: {
    totalQueries: number;
    averageResponseTime: number;
    p50ResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    successRate: number;
    errorRate: number;
  };
  strategies: Map<SearchStrategy, {
    queryCount: number;
    averageTime: number;
    successRate: number;
    averageQuality: number;
  }>;
  collections: Map<string, {
    queryCount: number;
    averageTime: number;
    errorRate: number;
  }>;
  trends: {
    hourly: number[];
    daily: number[];
    weekly: number[];
  };
}

/**
 * Аналитика качества
 */
export interface QualityAnalytics {
  overall: {
    averageRelevanceScore: number;
    diversityIndex: number;
    coverageScore: number;
    userSatisfactionScore: number;
  };
  byQueryType: Map<QueryType, {
    count: number;
    averageQuality: number;
    successRate: number;
    averageResultCount: number;
  }>;
  byStrategy: Map<SearchStrategy, {
    count: number;
    qualityScore: number;
    userEngagement: number;
  }>;
  improvements: Array<{
    metric: string;
    currentValue: number;
    previousValue: number;
    changePercent: number;
    trend: 'improving' | 'declining' | 'stable';
  }>;
}

/**
 * Аналитика поведения пользователей
 */
export interface UserBehaviorAnalytics {
  sessions: {
    totalSessions: number;
    averageSessionDuration: number;
    averageQueriesPerSession: number;
    bounceRate: number; // Процент сессий с одним запросом
  };
  queries: {
    totalQueries: number;
    uniqueQueries: number;
    averageQueryLength: number;
    queryRefinementRate: number; // Процент запросов, которые были уточнены
  };
  interactions: {
    clickThroughRate: number;
    averageDwellTime: number;
    topResultClickRate: number; // Процент кликов по первому результату
    resultInteractionRate: number; // Средний процент результатов, с которыми взаимодействовали
  };
  patterns: Array<{
    pattern: string;
    frequency: number;
    successRate: number;
    description: string;
  }>;
}

/**
 * Конфигурация аналитики
 */
export interface SearchAnalyticsConfig {
  /** Включить сбор аналитики */
  enabled: boolean;

  /** Включить детальное логирование производительности */
  enablePerformanceTracking: boolean;

  /** Включить отслеживание качества */
  enableQualityTracking: boolean;

  /** Включить отслеживание поведения пользователей */
  enableUserTracking: boolean;

  /** Максимальное количество событий в памяти */
  maxEventsInMemory: number;

  /** Интервал агрегации метрик (в миллисекундах) */
  aggregationInterval: number;

  /** Retention период для исторических данных (в днях) */
  dataRetentionDays: number;

  /** Настройки приватности */
  privacy: {
    hashQueries: boolean;
    anonymizeSessions: boolean;
    excludePersonalData: boolean;
  };

  /** Пороговые значения для алертов */
  thresholds: {
    slowQueryTime: number; // мс
    highErrorRate: number; // процент
    lowQualityScore: number; // 0-1
    lowUserSatisfaction: number; // 0-1
  };
}

/**
 * Основной класс аналитики поиска
 */
export class SearchAnalytics {
  private config: SearchAnalyticsConfig;
  private events: AnalyticsEvent[] = [];
  private timeSeries: TimeSeriesMetrics[] = [];

  // Агрегированные метрики
  private performanceMetrics: PerformanceAnalytics;
  private qualityMetrics: QualityAnalytics;
  private behaviorMetrics: UserBehaviorAnalytics;

  // Кэши для быстрого доступа
  private sessionCache = new Map<string, SessionData>();
  private queryCache = new Map<string, QueryData>();

  // Статистика в реальном времени
  private realtimeStats = {
    activeQueries: 0,
    recentErrors: 0,
    averageResponseTime: 0,
    lastMinuteQueries: 0
  };

  // A/B эксперименты
  private experiments = new Map<string, ExperimentData>();

  // Подписчики на события
  private eventListeners = new Map<string, Array<(event: AnalyticsEvent) => void>>();

  constructor(config: Partial<SearchAnalyticsConfig> = {}) {
    this.config = {
      enabled: true,
      enablePerformanceTracking: true,
      enableQualityTracking: true,
      enableUserTracking: true,
      maxEventsInMemory: 10000,
      aggregationInterval: 60000, // 1 минута
      dataRetentionDays: 30,
      privacy: {
        hashQueries: true,
        anonymizeSessions: false,
        excludePersonalData: true
      },
      thresholds: {
        slowQueryTime: 1000,
        highErrorRate: 5.0,
        lowQualityScore: 0.6,
        lowUserSatisfaction: 0.7
      },
      ...config
    };

    this.performanceMetrics = this.initializePerformanceMetrics();
    this.qualityMetrics = this.initializeQualityMetrics();
    this.behaviorMetrics = this.initializeBehaviorMetrics();

    if (this.config.enabled) {
      this.startAggregationTimer();
    }
  }

  /**
   * Отслеживание запроса
   */
  trackQuery(
    queryId: string,
    sessionId: string,
    query: string,
    analysis: AdvancedQueryAnalysis,
    context: any
  ): void {
    if (!this.config.enabled) return;

    const queryEvent: QueryEvent = {
      type: 'query',
      timestamp: Date.now(),
      sessionId: this.anonymizeSession(sessionId),
      queryId,
      query: this.config.privacy.hashQueries ? this.hashQuery(query) : query,
      queryHash: this.hashQuery(query),
      analysis: {
        queryType: analysis.queryType,
        confidence: analysis.confidence,
        complexity: analysis.estimatedComplexity,
        language: analysis.linguisticFeatures?.language || 'unknown',
        wordCount: analysis.features.wordCount,
        suggestedStrategy: analysis.suggestedStrategy
      },
      context: {
        collection: context.collection,
        mode: context.mode || SearchMode.AUTO,
        deviceType: this.detectDeviceType(context.userAgent),
        location: context.location
      }
    };

    this.addEvent(queryEvent);
    this.updateQueryCache(queryId, query, analysis);
    this.updateRealtimeStats('query', queryEvent);
  }

  /**
   * Отслеживание результатов
   */
  trackResults(
    queryId: string,
    sessionId: string,
    response: SearchResponse,
    optimizedResults?: OptimizedResult[]
  ): void {
    if (!this.config.enabled) return;

    const topScores = response.results.slice(0, 10).map(r => r.score);
    const qualityMetrics = this.calculateQualityMetrics(response.results, optimizedResults);

    const resultEvent: ResultEvent = {
      type: 'result',
      timestamp: Date.now(),
      sessionId: this.anonymizeSession(sessionId),
      queryId,
      searchTime: response.searchTime,
      strategy: response.strategy,
      fusion: response.fusion,
      totalResults: response.totalResults,
      returnedResults: response.results.length,
      topScores,
      qualityMetrics
    };

    this.addEvent(resultEvent);
    this.updateRealtimeStats('result', resultEvent);
  }

  /**
   * Отслеживание взаимодействий пользователя
   */
  trackInteraction(
    queryId: string,
    sessionId: string,
    action: UserInteractionEvent['action'],
    details: Partial<UserInteractionEvent> = {}
  ): void {
    if (!this.config.enabled || !this.config.enableUserTracking) return;

    const interactionEvent: UserInteractionEvent = {
      type: 'interaction',
      timestamp: Date.now(),
      sessionId: this.anonymizeSession(sessionId),
      queryId,
      action,
      ...details
    };

    this.addEvent(interactionEvent);
    this.updateSessionCache(sessionId, interactionEvent);
  }

  /**
   * Отслеживание производительности
   */
  trackPerformance(
    queryId: string,
    sessionId: string,
    metrics: PerformanceEvent['metrics']
  ): void {
    if (!this.config.enabled || !this.config.enablePerformanceTracking) return;

    const performanceEvent: PerformanceEvent = {
      type: 'performance',
      timestamp: Date.now(),
      sessionId: this.anonymizeSession(sessionId),
      queryId,
      metrics
    };

    this.addEvent(performanceEvent);
    this.updateRealtimeStats('performance', performanceEvent);

    // Проверяем пороговые значения
    this.checkPerformanceThresholds(performanceEvent);
  }

  /**
   * Отслеживание ошибок
   */
  trackError(
    errorType: ErrorEvent['errorType'],
    errorCode: string,
    errorMessage: string,
    context: Record<string, any>,
    sessionId?: string,
    queryId?: string
  ): void {
    if (!this.config.enabled) return;

    const errorEvent: ErrorEvent = {
      type: 'error',
      timestamp: Date.now(),
      sessionId: sessionId ? this.anonymizeSession(sessionId) : 'unknown',
      queryId,
      errorType,
      errorCode,
      errorMessage: this.sanitizeErrorMessage(errorMessage),
      context: this.sanitizeContext(context)
    };

    this.addEvent(errorEvent);
    this.realtimeStats.recentErrors++;
  }

  /**
   * Отслеживание A/B экспериментов
   */
  trackExperiment(
    queryId: string,
    sessionId: string,
    experimentId: string,
    variant: string,
    hypothesis: string,
    metrics: Record<string, number>
  ): void {
    if (!this.config.enabled) return;

    const experimentEvent: ExperimentEvent = {
      type: 'experiment',
      timestamp: Date.now(),
      sessionId: this.anonymizeSession(sessionId),
      queryId,
      experimentId,
      variant,
      hypothesis,
      metrics
    };

    this.addEvent(experimentEvent);
    this.updateExperimentData(experimentId, variant, metrics);
  }

  /**
   * Получение метрик производительности
   */
  getPerformanceAnalytics(timeRange?: { start: number; end: number }): PerformanceAnalytics {
    return this.aggregatePerformanceMetrics(timeRange);
  }

  /**
   * Получение метрик качества
   */
  getQualityAnalytics(timeRange?: { start: number; end: number }): QualityAnalytics {
    return this.aggregateQualityMetrics(timeRange);
  }

  /**
   * Получение метрик поведения
   */
  getBehaviorAnalytics(timeRange?: { start: number; end: number }): UserBehaviorAnalytics {
    return this.aggregateBehaviorMetrics(timeRange);
  }

  /**
   * Получение временных рядов
   */
  getTimeSeriesData(
    metric: string,
    interval: 'minute' | 'hour' | 'day',
    timeRange?: { start: number; end: number }
  ): Array<{ timestamp: number; value: number }> {
    return this.aggregateTimeSeriesData(metric, interval, timeRange);
  }

  /**
   * Получение статистики в реальном времени
   */
  getRealtimeStats() {
    return { ...this.realtimeStats };
  }

  /**
   * Получение топ запросов
   */
  getTopQueries(limit: number = 10): Array<{ query: string; count: number; avgQuality: number }> {
    const queryStats = new Map<string, { count: number; totalQuality: number }>();

    for (const event of this.events) {
      if (event.type === 'query') {
        const query = event.query;
        const stats = queryStats.get(query) || { count: 0, totalQuality: 0 };
        stats.count++;
        queryStats.set(query, stats);
      }
    }

    return Array.from(queryStats.entries())
      .map(([query, stats]) => ({
        query,
        count: stats.count,
        avgQuality: stats.totalQuality / stats.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Получение рекомендаций по улучшению
   */
  getOptimizationRecommendations(): Array<{
    area: 'performance' | 'quality' | 'user_experience';
    recommendation: string;
    impact: 'high' | 'medium' | 'low';
    effort: 'high' | 'medium' | 'low';
    metrics?: Record<string, number>;
  }> {
    const recommendations: Array<{
      area: 'performance' | 'quality' | 'user_experience';
      recommendation: string;
      impact: 'high' | 'medium' | 'low';
      effort: 'high' | 'medium' | 'low';
      metrics?: Record<string, number>;
    }> = [];

    const perf = this.getPerformanceAnalytics();
    const quality = this.getQualityAnalytics();
    const behavior = this.getBehaviorAnalytics();

    // Проверяем производительность
    if (perf.overall.averageResponseTime > this.config.thresholds.slowQueryTime) {
      recommendations.push({
        area: 'performance',
        recommendation: `Средне время ответа (${perf.overall.averageResponseTime}ms) превышает порог. Рассмотрите оптимизацию кэширования и индексов.`,
        impact: 'high',
        effort: 'medium',
        metrics: { currentTime: perf.overall.averageResponseTime, threshold: this.config.thresholds.slowQueryTime }
      });
    }

    // Проверяем качество
    if (quality.overall.averageRelevanceScore < this.config.thresholds.lowQualityScore) {
      recommendations.push({
        area: 'quality',
        recommendation: `Низкая оценка релевантности (${quality.overall.averageRelevanceScore}). Улучшите алгоритмы ранжирования.`,
        impact: 'high',
        effort: 'high',
        metrics: { currentScore: quality.overall.averageRelevanceScore, threshold: this.config.thresholds.lowQualityScore }
      });
    }

    // Проверяем пользовательский опыт
    if (behavior.interactions.clickThroughRate < 0.3) {
      recommendations.push({
        area: 'user_experience',
        recommendation: `Низкий CTR (${(behavior.interactions.clickThroughRate * 100).toFixed(1)}%). Улучшите сниппеты и ранжирование.`,
        impact: 'medium',
        effort: 'medium',
        metrics: { ctr: behavior.interactions.clickThroughRate }
      });
    }

    if (behavior.sessions.bounceRate > 0.7) {
      recommendations.push({
        area: 'user_experience',
        recommendation: `Высокий bounce rate (${(behavior.sessions.bounceRate * 100).toFixed(1)}%). Улучшите понимание запросов и качество первых результатов.`,
        impact: 'high',
        effort: 'medium',
        metrics: { bounceRate: behavior.sessions.bounceRate }
      });
    }

    return recommendations.sort((a, b) => {
      const impactWeight = { high: 3, medium: 2, low: 1 };
      return impactWeight[b.impact] - impactWeight[a.impact];
    });
  }

  /**
   * Подписка на события
   */
  addEventListener(
    eventType: AnalyticsEvent['type'] | 'all',
    listener: (event: AnalyticsEvent) => void
  ): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType)!.push(listener);
  }

  /**
   * Отписка от событий
   */
  removeEventListener(
    eventType: AnalyticsEvent['type'] | 'all',
    listener: (event: AnalyticsEvent) => void
  ): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index >= 0) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Экспорт данных
   */
  exportData(
    format: 'json' | 'csv',
    timeRange?: { start: number; end: number },
    eventTypes?: AnalyticsEvent['type'][]
  ): string {
    const filteredEvents = this.filterEvents(timeRange, eventTypes);

    if (format === 'json') {
      return JSON.stringify({
        exportTime: Date.now(),
        timeRange,
        eventTypes,
        totalEvents: filteredEvents.length,
        events: filteredEvents
      }, null, 2);
    } else {
      return this.convertToCSV(filteredEvents);
    }
  }

  /**
   * Очистка старых данных
   */
  cleanupOldData(): void {
    const cutoffTime = Date.now() - (this.config.dataRetentionDays * 24 * 60 * 60 * 1000);

    this.events = this.events.filter(event => event.timestamp > cutoffTime);
    this.timeSeries = this.timeSeries.filter(ts => ts.timestamp > cutoffTime);

    // Очищаем кэши
    for (const [sessionId, sessionData] of this.sessionCache.entries()) {
      if (sessionData.lastActivity < cutoffTime) {
        this.sessionCache.delete(sessionId);
      }
    }

    for (const [queryId, queryData] of this.queryCache.entries()) {
      if (queryData.timestamp < cutoffTime) {
        this.queryCache.delete(queryId);
      }
    }
  }

  // === Приватные методы ===

  /**
   * Добавление события
   */
  private addEvent(event: AnalyticsEvent): void {
    this.events.push(event);

    // Уведомляем подписчиков
    this.notifyEventListeners(event);

    // Ограничиваем размер массива событий
    if (this.events.length > this.config.maxEventsInMemory) {
      this.events.splice(0, this.events.length - this.config.maxEventsInMemory);
    }
  }

  /**
   * Уведомление подписчиков
   */
  private notifyEventListeners(event: AnalyticsEvent): void {
    // Уведомляем подписчиков на конкретный тип события
    const typeListeners = this.eventListeners.get(event.type);
    if (typeListeners) {
      for (const listener of typeListeners) {
        try {
          listener(event);
        } catch (error) {
          console.warn('Analytics event listener error:', error);
        }
      }
    }

    // Уведомляем подписчиков на все события
    const allListeners = this.eventListeners.get('all');
    if (allListeners) {
      for (const listener of allListeners) {
        try {
          listener(event);
        } catch (error) {
          console.warn('Analytics event listener error:', error);
        }
      }
    }
  }

  /**
   * Инициализация метрик производительности
   */
  private initializePerformanceMetrics(): PerformanceAnalytics {
    return {
      overall: {
        totalQueries: 0,
        averageResponseTime: 0,
        p50ResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        successRate: 0,
        errorRate: 0
      },
      strategies: new Map(),
      collections: new Map(),
      trends: {
        hourly: new Array(24).fill(0),
        daily: new Array(7).fill(0),
        weekly: new Array(4).fill(0)
      }
    };
  }

  /**
   * Инициализация метрик качества
   */
  private initializeQualityMetrics(): QualityAnalytics {
    return {
      overall: {
        averageRelevanceScore: 0,
        diversityIndex: 0,
        coverageScore: 0,
        userSatisfactionScore: 0
      },
      byQueryType: new Map(),
      byStrategy: new Map(),
      improvements: []
    };
  }

  /**
   * Инициализация метрик поведения
   */
  private initializeBehaviorMetrics(): UserBehaviorAnalytics {
    return {
      sessions: {
        totalSessions: 0,
        averageSessionDuration: 0,
        averageQueriesPerSession: 0,
        bounceRate: 0
      },
      queries: {
        totalQueries: 0,
        uniqueQueries: 0,
        averageQueryLength: 0,
        queryRefinementRate: 0
      },
      interactions: {
        clickThroughRate: 0,
        averageDwellTime: 0,
        topResultClickRate: 0,
        resultInteractionRate: 0
      },
      patterns: []
    };
  }

  /**
   * Расчет метрик качества результатов
   */
  private calculateQualityMetrics(results: SearchResult[], optimizedResults?: OptimizedResult[]) {
    const scores = results.map(r => r.score);
    const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

    // Дисперсия скоров
    const scoreVariance = scores.length > 1
      ? scores.reduce((sum, score) => sum + Math.pow(score - averageScore, 2), 0) / scores.length
      : 0;

    // Индекс разнообразия (на основе уникальности контента)
    const uniqueContent = new Set(results.map(r =>
      (r.title || '').substring(0, 50) + (r.content || '').substring(0, 100)
    ));
    const diversityIndex = results.length > 0 ? uniqueContent.size / results.length : 0;

    // Покрытие (упрощенная метрика)
    const coverageScore = Math.min(1, results.length / 10); // Предполагаем оптимум в 10 результатов

    return {
      averageScore,
      scoreVariance,
      diversityIndex,
      coverageScore
    };
  }

  /**
   * Обновление статистики в реальном времени
   */
  private updateRealtimeStats(eventType: string, event: AnalyticsEvent): void {
    switch (eventType) {
      case 'query':
        this.realtimeStats.lastMinuteQueries++;
        break;
      case 'performance':
        const perfEvent = event as PerformanceEvent;
        this.realtimeStats.averageResponseTime =
          (this.realtimeStats.averageResponseTime + perfEvent.metrics.totalTime) / 2;
        break;
    }
  }

  /**
   * Обновление кэша запросов
   */
  private updateQueryCache(queryId: string, query: string, analysis: AdvancedQueryAnalysis): void {
    this.queryCache.set(queryId, {
      queryId,
      query,
      timestamp: Date.now(),
      analysis
    });
  }

  /**
   * Обновление кэша сессий
   */
  private updateSessionCache(sessionId: string, interaction: UserInteractionEvent): void {
    const sessionData = this.sessionCache.get(sessionId) || {
      sessionId,
      startTime: Date.now(),
      lastActivity: Date.now(),
      queryCount: 0,
      interactionCount: 0
    };

    sessionData.lastActivity = interaction.timestamp;
    sessionData.interactionCount++;

    if (interaction.action === 'click') {
      sessionData.clickCount = (sessionData.clickCount || 0) + 1;
    }

    this.sessionCache.set(sessionId, sessionData);
  }

  /**
   * Обновление данных экспериментов
   */
  private updateExperimentData(experimentId: string, variant: string, metrics: Record<string, number>): void {
    const experimentData = this.experiments.get(experimentId) || {
      experimentId,
      variants: new Map(),
      totalParticipants: 0
    };

    const variantData = experimentData.variants.get(variant) || {
      variant,
      participants: 0,
      totalMetrics: new Map()
    };

    variantData.participants++;

    for (const [metricName, value] of Object.entries(metrics)) {
      const currentTotal = variantData.totalMetrics.get(metricName) || 0;
      variantData.totalMetrics.set(metricName, currentTotal + value);
    }

    experimentData.variants.set(variant, variantData);
    experimentData.totalParticipants++;
    this.experiments.set(experimentId, experimentData);
  }

  /**
   * Проверка пороговых значений производительности
   */
  private checkPerformanceThresholds(event: PerformanceEvent): void {
    if (event.metrics.totalTime > this.config.thresholds.slowQueryTime) {
      this.emitAlert('slow_query', {
        queryId: event.queryId,
        responseTime: event.metrics.totalTime,
        threshold: this.config.thresholds.slowQueryTime
      });
    }
  }

  /**
   * Эмиссия алерта
   */
  private emitAlert(alertType: string, data: any): void {
    // Здесь можно интегрировать с системой алертов
    console.warn(`Analytics Alert [${alertType}]:`, data);
  }

  /**
   * Анонимизация сессии
   */
  private anonymizeSession(sessionId: string): string {
    if (!this.config.privacy.anonymizeSessions) {
      return sessionId;
    }
    return this.hashString(sessionId);
  }

  /**
   * Хеширование запроса
   */
  private hashQuery(query: string): string {
    return this.hashString(query.toLowerCase().trim());
  }

  /**
   * Простое хеширование строки
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * Определение типа устройства
   */
  private detectDeviceType(userAgent?: string): 'desktop' | 'mobile' | 'tablet' {
    if (!userAgent) return 'desktop';

    if (/Mobile|Android|iPhone|iPad|iPod|Windows Phone/i.test(userAgent)) {
      if (/iPad|tablet/i.test(userAgent)) return 'tablet';
      return 'mobile';
    }
    return 'desktop';
  }

  /**
   * Санитизация сообщения об ошибке
   */
  private sanitizeErrorMessage(message: string): string {
    if (!this.config.privacy.excludePersonalData) {
      return message;
    }

    // Удаляем потенциально чувствительные данные
    return message
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
      .replace(/\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g, '[CARD]')
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]');
  }

  /**
   * Санитизация контекста
   */
  private sanitizeContext(context: Record<string, any>): Record<string, any> {
    if (!this.config.privacy.excludePersonalData) {
      return context;
    }

    const sanitized = { ...context };
    delete sanitized.userId;
    delete sanitized.email;
    delete sanitized.personalData;

    return sanitized;
  }

  /**
   * Агрегация метрик производительности
   */
  private aggregatePerformanceMetrics(timeRange?: { start: number; end: number }): PerformanceAnalytics {
    const events = this.filterEvents(timeRange, ['performance', 'query', 'result']);

    const performanceEvents = events.filter(e => e.type === 'performance') as PerformanceEvent[];
    const queryEvents = events.filter(e => e.type === 'query') as QueryEvent[];
    const resultEvents = events.filter(e => e.type === 'result') as ResultEvent[];
    const errorEvents = events.filter(e => e.type === 'error') as ErrorEvent[];

    const responseTimes = performanceEvents.map(e => e.metrics.totalTime);
    responseTimes.sort((a, b) => a - b);

    const overall = {
      totalQueries: queryEvents.length,
      averageResponseTime: responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0,
      p50ResponseTime: responseTimes.length > 0 ? responseTimes[Math.floor(responseTimes.length * 0.5)] : 0,
      p95ResponseTime: responseTimes.length > 0 ? responseTimes[Math.floor(responseTimes.length * 0.95)] : 0,
      p99ResponseTime: responseTimes.length > 0 ? responseTimes[Math.floor(responseTimes.length * 0.99)] : 0,
      successRate: queryEvents.length > 0 ? (queryEvents.length - errorEvents.length) / queryEvents.length : 0,
      errorRate: queryEvents.length > 0 ? errorEvents.length / queryEvents.length : 0
    };

    // Агрегируем по стратегиям
    const strategies = new Map<SearchStrategy, {
      queryCount: number;
      averageTime: number;
      successRate: number;
      averageQuality: number;
    }>();

    for (const event of resultEvents) {
      const current = strategies.get(event.strategy) || {
        queryCount: 0,
        averageTime: 0,
        successRate: 0,
        averageQuality: 0
      };

      current.queryCount++;
      current.averageTime = (current.averageTime + event.searchTime) / 2;
      current.averageQuality = (current.averageQuality + event.qualityMetrics.averageScore) / 2;

      strategies.set(event.strategy, current);
    }

    return {
      overall,
      strategies,
      collections: new Map(), // Будет реализовано при необходимости
      trends: this.performanceMetrics.trends // Используем существующие тренды
    };
  }

  /**
   * Агрегация метрик качества
   */
  private aggregateQualityMetrics(timeRange?: { start: number; end: number }): QualityAnalytics {
    const events = this.filterEvents(timeRange, ['result', 'interaction', 'query']);

    const resultEvents = events.filter(e => e.type === 'result') as ResultEvent[];
    const interactionEvents = events.filter(e => e.type === 'interaction') as UserInteractionEvent[];
    const queryEvents = events.filter(e => e.type === 'query') as QueryEvent[];

    // Общие метрики качества
    const relevanceScores = resultEvents.map(e => e.qualityMetrics.averageScore);
    const diversityScores = resultEvents.map(e => e.qualityMetrics.diversityIndex);
    const coverageScores = resultEvents.map(e => e.qualityMetrics.coverageScore);

    const overall = {
      averageRelevanceScore: relevanceScores.length > 0
        ? relevanceScores.reduce((a, b) => a + b, 0) / relevanceScores.length : 0,
      diversityIndex: diversityScores.length > 0
        ? diversityScores.reduce((a, b) => a + b, 0) / diversityScores.length : 0,
      coverageScore: coverageScores.length > 0
        ? coverageScores.reduce((a, b) => a + b, 0) / coverageScores.length : 0,
      userSatisfactionScore: this.calculateUserSatisfaction(interactionEvents)
    };

    // Агрегируем по типу запроса
    const byQueryType = new Map<QueryType, {
      count: number;
      averageQuality: number;
      successRate: number;
      averageResultCount: number;
    }>();

    for (const queryEvent of queryEvents) {
      const resultEvent = resultEvents.find(r => r.queryId === queryEvent.queryId);
      if (resultEvent) {
        const current = byQueryType.get(queryEvent.analysis.queryType) || {
          count: 0,
          averageQuality: 0,
          successRate: 0,
          averageResultCount: 0
        };

        current.count++;
        current.averageQuality = (current.averageQuality + resultEvent.qualityMetrics.averageScore) / 2;
        current.averageResultCount = (current.averageResultCount + resultEvent.returnedResults) / 2;

        byQueryType.set(queryEvent.analysis.queryType, current);
      }
    }

    return {
      overall,
      byQueryType,
      byStrategy: new Map(), // Будет реализовано при необходимости
      improvements: [] // Будет реализовано для отслеживания трендов
    };
  }

  /**
   * Агрегация метрик поведения
   */
  private aggregateBehaviorMetrics(timeRange?: { start: number; end: number }): UserBehaviorAnalytics {
    const events = this.filterEvents(timeRange, ['query', 'interaction']);

    const queryEvents = events.filter(e => e.type === 'query') as QueryEvent[];
    const interactionEvents = events.filter(e => e.type === 'interaction') as UserInteractionEvent[];

    // Группируем по сессиям
    const sessionStats = new Map<string, {
      queries: number;
      duration: number;
      interactions: number;
      clicks: number;
    }>();

    for (const event of [...queryEvents, ...interactionEvents]) {
      const current = sessionStats.get(event.sessionId) || {
        queries: 0,
        duration: 0,
        interactions: 0,
        clicks: 0
      };

      if (event.type === 'query') {
        current.queries++;
      } else if (event.type === 'interaction') {
        current.interactions++;
        if (event.action === 'click') {
          current.clicks++;
        }
      }

      sessionStats.set(event.sessionId, current);
    }

    const sessions = Array.from(sessionStats.values());
    const totalSessions = sessions.length;
    const bounceSessions = sessions.filter(s => s.queries === 1).length;

    const clickEvents = interactionEvents.filter(e => e.action === 'click');
    const totalClicks = clickEvents.length;
    const topResultClicks = clickEvents.filter(e => e.targetRank === 1).length;

    return {
      sessions: {
        totalSessions,
        averageSessionDuration: sessions.length > 0
          ? sessions.reduce((sum, s) => sum + s.duration, 0) / sessions.length : 0,
        averageQueriesPerSession: sessions.length > 0
          ? sessions.reduce((sum, s) => sum + s.queries, 0) / sessions.length : 0,
        bounceRate: totalSessions > 0 ? bounceSessions / totalSessions : 0
      },
      queries: {
        totalQueries: queryEvents.length,
        uniqueQueries: new Set(queryEvents.map(e => e.queryHash)).size,
        averageQueryLength: queryEvents.length > 0
          ? queryEvents.reduce((sum, e) => sum + e.analysis.wordCount, 0) / queryEvents.length : 0,
        queryRefinementRate: this.calculateRefinementRate(interactionEvents)
      },
      interactions: {
        clickThroughRate: queryEvents.length > 0 ? totalClicks / queryEvents.length : 0,
        averageDwellTime: this.calculateAverageDwellTime(interactionEvents),
        topResultClickRate: totalClicks > 0 ? topResultClicks / totalClicks : 0,
        resultInteractionRate: this.calculateResultInteractionRate(interactionEvents, queryEvents)
      },
      patterns: [] // Будет реализовано для выявления паттернов
    };
  }

  /**
   * Расчет пользовательского удовлетворения
   */
  private calculateUserSatisfaction(interactions: UserInteractionEvent[]): number {
    if (interactions.length === 0) return 0;

    const positiveInteractions = interactions.filter(i =>
      i.action === 'click' || i.action === 'export' || i.action === 'share'
    ).length;

    return positiveInteractions / interactions.length;
  }

  /**
   * Расчет коэффициента рефайнмента запросов
   */
  private calculateRefinementRate(interactions: UserInteractionEvent[]): number {
    const refinements = interactions.filter(i => i.action === 'refine_query').length;
    const totalQueries = new Set(interactions.map(i => i.queryId)).size;

    return totalQueries > 0 ? refinements / totalQueries : 0;
  }

  /**
   * Расчет среднего времени взаимодействия
   */
  private calculateAverageDwellTime(interactions: UserInteractionEvent[]): number {
    const dwellTimes = interactions
      .map(i => i.dwell_time)
      .filter(time => time !== undefined) as number[];

    return dwellTimes.length > 0
      ? dwellTimes.reduce((sum, time) => sum + time, 0) / dwellTimes.length : 0;
  }

  /**
   * Расчет коэффициента взаимодействия с результатами
   */
  private calculateResultInteractionRate(
    interactions: UserInteractionEvent[],
    queries: QueryEvent[]
  ): number {
    if (queries.length === 0) return 0;

    const interactionsPerQuery = new Map<string, Set<string>>();

    for (const interaction of interactions) {
      if (interaction.targetId) {
        if (!interactionsPerQuery.has(interaction.queryId)) {
          interactionsPerQuery.set(interaction.queryId, new Set());
        }
        interactionsPerQuery.get(interaction.queryId)!.add(interaction.targetId);
      }
    }

    const totalInteractedResults = Array.from(interactionsPerQuery.values())
      .reduce((sum, results) => sum + results.size, 0);

    // Предполагаем среднее количество результатов на запрос = 10
    const estimatedTotalResults = queries.length * 10;

    return estimatedTotalResults > 0 ? totalInteractedResults / estimatedTotalResults : 0;
  }

  /**
   * Агрегация данных временных рядов
   */
  private aggregateTimeSeriesData(
    metric: string,
    interval: 'minute' | 'hour' | 'day',
    timeRange?: { start: number; end: number }
  ): Array<{ timestamp: number; value: number }> {
    const events = this.filterEvents(timeRange);

    const intervals = new Map<number, number>();
    const intervalMs = {
      minute: 60 * 1000,
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000
    }[interval];

    for (const event of events) {
      const intervalStart = Math.floor(event.timestamp / intervalMs) * intervalMs;

      let value = 0;
      switch (metric) {
        case 'queryCount':
          if (event.type === 'query') value = 1;
          break;
        case 'errorCount':
          if (event.type === 'error') value = 1;
          break;
        case 'averageResponseTime':
          if (event.type === 'performance') {
            value = (event as PerformanceEvent).metrics.totalTime;
          }
          break;
      }

      intervals.set(intervalStart, (intervals.get(intervalStart) || 0) + value);
    }

    return Array.from(intervals.entries())
      .map(([timestamp, value]) => ({ timestamp, value }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Фильтрация событий
   */
  private filterEvents(
    timeRange?: { start: number; end: number },
    eventTypes?: AnalyticsEvent['type'][]
  ): AnalyticsEvent[] {
    let filtered = this.events;

    if (timeRange) {
      filtered = filtered.filter(event =>
        event.timestamp >= timeRange.start && event.timestamp <= timeRange.end
      );
    }

    if (eventTypes) {
      filtered = filtered.filter(event => eventTypes.includes(event.type));
    }

    return filtered;
  }

  /**
   * Конвертация в CSV
   */
  private convertToCSV(events: AnalyticsEvent[]): string {
    if (events.length === 0) return '';

    const headers = ['timestamp', 'type', 'sessionId', 'queryId'];
    const rows = [headers.join(',')];

    for (const event of events) {
      const row = [
        event.timestamp,
        event.type,
        event.sessionId,
        event.type === 'query' || event.type === 'result' || event.type === 'performance' || event.type === 'interaction' || event.type === 'experiment'
          ? (event as any).queryId || ''
          : ''
      ];
      rows.push(row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','));
    }

    return rows.join('\n');
  }

  /**
   * Запуск таймера агрегации
   */
  private startAggregationTimer(): void {
    setInterval(() => {
      this.aggregateMetrics();
      this.cleanupOldData();
      this.realtimeStats.recentErrors = Math.max(0, this.realtimeStats.recentErrors - 1);
      this.realtimeStats.lastMinuteQueries = 0;
    }, this.config.aggregationInterval);
  }

  /**
   * Агрегация метрик
   */
  private aggregateMetrics(): void {
    const now = Date.now();
    const intervalStart = Math.floor(now / this.config.aggregationInterval) * this.config.aggregationInterval;

    // Агрегируем метрики за последний интервал
    const recentEvents = this.events.filter(event =>
      event.timestamp >= intervalStart - this.config.aggregationInterval &&
      event.timestamp < intervalStart
    );

    if (recentEvents.length > 0) {
      const metrics = this.calculateIntervalMetrics(recentEvents);

      this.timeSeries.push({
        timestamp: intervalStart,
        interval: 'minute',
        metrics
      });

      // Ограничиваем размер временных рядов
      if (this.timeSeries.length > 1440) { // 24 часа при интервале в 1 минуту
        this.timeSeries.splice(0, this.timeSeries.length - 1440);
      }
    }
  }

  /**
   * Расчет метрик за интервал
   */
  private calculateIntervalMetrics(events: AnalyticsEvent[]): TimeSeriesMetrics['metrics'] {
    const queryEvents = events.filter(e => e.type === 'query') as QueryEvent[];
    const performanceEvents = events.filter(e => e.type === 'performance') as PerformanceEvent[];
    const errorEvents = events.filter(e => e.type === 'error') as ErrorEvent[];
    const interactionEvents = events.filter(e => e.type === 'interaction') as UserInteractionEvent[];

    const uniqueSessions = new Set(events.map(e => e.sessionId)).size;

    const responseTimes = performanceEvents.map(e => e.metrics.totalTime);
    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;

    const errorRate = queryEvents.length > 0 ? errorEvents.length / queryEvents.length : 0;

    // Топ запросы
    const queryFreq = new Map<string, number>();
    for (const event of queryEvents) {
      queryFreq.set(event.queryHash, (queryFreq.get(event.queryHash) || 0) + 1);
    }
    const topQueries = Array.from(queryFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([query, count]) => ({ query: query.substring(0, 20), count }));

    // Топ стратегии (из ResultEvent понадобится)
    const topStrategies: Array<{ strategy: SearchStrategy; count: number; avgTime: number }> = [];

    const clicks = interactionEvents.filter(e => e.action === 'click').length;
    const userSatisfaction = queryEvents.length > 0 ? clicks / queryEvents.length : 0;

    return {
      queryCount: queryEvents.length,
      uniqueSessions,
      averageResponseTime,
      errorRate,
      topQueries,
      topStrategies,
      qualityScore: 0.8, // Заглушка
      userSatisfaction
    };
  }
}

// Интерфейсы для внутренних структур данных
interface SessionData {
  sessionId: string;
  startTime: number;
  lastActivity: number;
  queryCount: number;
  interactionCount: number;
  clickCount?: number;
}

interface QueryData {
  queryId: string;
  query: string;
  timestamp: number;
  analysis: AdvancedQueryAnalysis;
}

interface ExperimentData {
  experimentId: string;
  variants: Map<string, {
    variant: string;
    participants: number;
    totalMetrics: Map<string, number>;
  }>;
  totalParticipants: number;
}

/**
 * Конфигурация по умолчанию
 */
export const DEFAULT_SEARCH_ANALYTICS_CONFIG: SearchAnalyticsConfig = {
  enabled: true,
  enablePerformanceTracking: true,
  enableQualityTracking: true,
  enableUserTracking: true,
  maxEventsInMemory: 10000,
  aggregationInterval: 60000, // 1 минута
  dataRetentionDays: 30,
  privacy: {
    hashQueries: true,
    anonymizeSessions: false,
    excludePersonalData: true
  },
  thresholds: {
    slowQueryTime: 1000,
    highErrorRate: 5.0,
    lowQualityScore: 0.6,
    lowUserSatisfaction: 0.7
  }
};

/**
 * Фабричная функция для создания SearchAnalytics
 */
export function createSearchAnalytics(config?: Partial<SearchAnalyticsConfig>): SearchAnalytics {
  return new SearchAnalytics(config);
}

/**
 * Экспорт по умолчанию
 */
export default SearchAnalytics;