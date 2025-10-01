/**
 * Advanced Search Optimizer для LocalRetrieve
 *
 * Система интеллектуальной оптимизации результатов поиска с использованием
 * ML-алгоритмов для re-ranking, диверсификации результатов и оптимизации
 * релевантности на основе пользовательского поведения и контекста.
 *
 * Архитектурные принципы:
 * - ML-based re-ranking с использованием Learning-to-Rank алгоритмов
 * - Контекстная оптимизация на основе пользовательского профиля
 * - Диверсификация результатов для избежания дублирования
 * - Персонализация на основе истории взаимодействий
 * - Интеграция с существующим ResultProcessor
 */

import type {
  SearchResult,
  RawSearchResult,
  ResultWithSnippets,
  RankedResult,
  SearchResponse,
  RerankingContext,
  QueryHistory,
  SearchWeights,
  FusionMethod,
  ScoreExplanation
} from '../types/search.js';

import {
  ResultProcessingError,
  FusionMethod as FusionMethodEnum,
  SearchStrategy,
  combineScores
} from '../types/search.js';

import type { AdvancedQueryAnalysis } from './QueryAnalyzer.js';

/**
 * Конфигурация оптимизатора поиска
 */
export interface SearchOptimizerConfig {
  /** Включить ML-based re-ranking */
  enableMLReranking: boolean;

  /** Включить диверсификацию результатов */
  enableDiversification: boolean;

  /** Включить персонализацию */
  enablePersonalization: boolean;

  /** Максимальное количество результатов для обработки */
  maxResults: number;

  /** Минимальная уверенность для применения re-ranking */
  rerankingThreshold: number;

  /** Вес различных факторов ранжирования */
  rankingWeights: {
    relevance: number;
    diversity: number;
    quality: number;
    freshness: number;
    popularity: number;
    personalization: number;
  };

  /** Алгоритм диверсификации */
  diversificationAlgorithm: 'mmd' | 'cluster' | 'round_robin' | 'semantic';

  /** Параметры персонализации */
  personalizationConfig: {
    clickHistoryWeight: number;
    sessionContextWeight: number;
    userProfileWeight: number;
    decayFactor: number; // Фактор затухания для старых взаимодействий
  };
}

/**
 * Контекст оптимизации результатов
 */
export interface OptimizationContext extends RerankingContext {
  /** Анализ запроса от QueryAnalyzer */
  queryAnalysis?: AdvancedQueryAnalysis;

  /** Временная метка запроса */
  timestamp: number;

  /** ID сессии пользователя */
  sessionId?: string;

  /** Тип устройства */
  deviceType?: 'desktop' | 'mobile' | 'tablet';

  /** Предыдущие результаты в сессии */
  sessionResults?: SearchResult[];

  /** Метаданные A/B тестирования */
  experimentContext?: {
    variant: string;
    experimentId: string;
  };
}

/**
 * Результат ML-ранжирования
 */
export interface MLRankingResult {
  /** Новый скор после ML re-ranking */
  mlScore: number;

  /** Факторы, повлиявшие на ранжирование */
  factors: Array<{
    name: string;
    value: number;
    weight: number;
    impact: number;
  }>;

  /** Уверенность модели в ранжировании */
  confidence: number;

  /** Объяснение изменения позиции */
  explanation: string;
}

/**
 * Результат диверсификации
 */
export interface DiversificationResult {
  /** Скор диверсификации */
  diversityScore: number;

  /** Кластер, к которому принадлежит результат */
  clusterId: string;

  /** Сходство с другими результатами */
  similarity: Array<{
    resultId: string;
    score: number;
  }>;

  /** Причины включения/исключения */
  diversificationReason: string;
}

/**
 * Результат персонализации
 */
export interface PersonalizationResult {
  /** Персональный скор */
  personalScore: number;

  /** Факторы персонализации */
  factors: {
    clickHistoryBoost: number;
    sessionContextBoost: number;
    userProfileBoost: number;
    timeDecayFactor: number;
  };

  /** Объяснение персонализации */
  explanation: string;
}

/**
 * Расширенный результат после оптимизации
 */
export interface OptimizedResult extends RankedResult {
  /** Результаты ML-ранжирования */
  mlRanking?: MLRankingResult;

  /** Результаты диверсификации */
  diversification?: DiversificationResult;

  /** Результаты персонализации */
  personalization?: PersonalizationResult;

  /** Исходный ранг до оптимизации */
  originalRank: number;

  /** Изменение ранга */
  rankChange: number;

  /** Подробное объяснение итогового скора */
  detailedExplanation: ScoreExplanation;
}

/**
 * Метрики производительности оптимизатора
 */
export interface OptimizerPerformanceMetrics {
  /** Среднее время оптимизации */
  averageOptimizationTime: number;

  /** Количество обработанных запросов */
  totalQueries: number;

  /** Среднее улучшение релевантности */
  averageRelevanceImprovement: number;

  /** Коэффициент диверсификации */
  diversificationRate: number;

  /** Эффективность персонализации */
  personalizationEffectiveness: number;

  /** Статистика по экспериментам */
  experimentStats: Map<string, {
    queriesCount: number;
    averageCTR: number;
    averageRelevance: number;
  }>;
}

/**
 * Основной класс оптимизатора поиска
 */
export class SearchOptimizer {
  private config: SearchOptimizerConfig;
  private performanceMetrics: OptimizerPerformanceMetrics;

  // ML модели для ранжирования
  private rerankingModel?: any; // Learning-to-Rank модель
  private diversificationModel?: any; // Модель для диверсификации
  private personalizationModel?: any; // Модель персонализации

  // Кэши для оптимизации производительности
  private featureCache = new Map<string, Float32Array>();
  private similarityCache = new Map<string, Map<string, number>>();

  // Профили пользователей
  private userProfiles = new Map<string, UserProfile>();

  // Статистика для обучения моделей
  private trainingData: Array<{
    features: Float32Array;
    relevanceScore: number;
    userInteraction: 'clicked' | 'ignored' | 'refined';
  }> = [];

  constructor(config: Partial<SearchOptimizerConfig> = {}) {
    this.config = {
      enableMLReranking: true,
      enableDiversification: true,
      enablePersonalization: true,
      maxResults: 100,
      rerankingThreshold: 0.6,
      rankingWeights: {
        relevance: 0.4,
        diversity: 0.15,
        quality: 0.15,
        freshness: 0.1,
        popularity: 0.1,
        personalization: 0.1
      },
      diversificationAlgorithm: 'semantic',
      personalizationConfig: {
        clickHistoryWeight: 0.3,
        sessionContextWeight: 0.2,
        userProfileWeight: 0.3,
        decayFactor: 0.95 // 5% затухание по времени
      },
      ...config
    };

    this.performanceMetrics = {
      averageOptimizationTime: 0,
      totalQueries: 0,
      averageRelevanceImprovement: 0,
      diversificationRate: 0,
      personalizationEffectiveness: 0,
      experimentStats: new Map()
    };

    this.initializeModels();
  }

  /**
   * Главный метод оптимизации результатов поиска
   */
  async optimizeResults(
    results: ResultWithSnippets[],
    query: string,
    context: OptimizationContext
  ): Promise<OptimizedResult[]> {
    const startTime = Date.now();

    try {
      if (results.length === 0) {
        return [];
      }

      // Ограничиваем количество результатов для обработки
      const limitedResults = results.slice(0, this.config.maxResults);

      // Фаза 1: Извлечение признаков для ML
      const featuresMap = await this.extractFeaturesForResults(limitedResults, query, context);

      // Фаза 2: ML-based re-ranking (если включен)
      let rankedResults = limitedResults.map((result, index) => ({
        ...result,
        originalRank: index + 1,
        rankChange: 0
      } as OptimizedResult));

      if (this.config.enableMLReranking) {
        rankedResults = await this.performMLReranking(rankedResults, query, context, featuresMap);
      }

      // Фаза 3: Диверсификация результатов (если включена)
      if (this.config.enableDiversification) {
        rankedResults = await this.diversifyResults(rankedResults, query, context);
      }

      // Фаза 4: Персонализация (если включена)
      if (this.config.enablePersonalization && context.sessionId) {
        rankedResults = await this.personalizeResults(rankedResults, query, context);
      }

      // Фаза 5: Итоговое ранжирование и объяснения
      const finalResults = this.finalizeOptimization(rankedResults, context);

      // Обновление метрик
      const optimizationTime = Date.now() - startTime;
      this.updatePerformanceMetrics(results, finalResults, optimizationTime, context);

      return finalResults;

    } catch (error) {
      throw new ResultProcessingError(
        `Search optimization failed: ${error instanceof Error ? error.message : String(error)}`,
        { query, resultsCount: results.length, context }
      );
    }
  }

  /**
   * ML-based re-ranking результатов
   */
  private async performMLReranking(
    results: OptimizedResult[],
    query: string,
    context: OptimizationContext,
    featuresMap: Map<string, Float32Array>
  ): Promise<OptimizedResult[]> {
    const rankedResults = [...results];

    for (const result of rankedResults) {
      const features = featuresMap.get(result.id);
      if (!features) continue;

      // Получаем ML-скор от модели (заглушка - в реальности это будет обученная модель)
      const mlRanking = await this.getMlRankingScore(features, query, context);

      result.mlRanking = mlRanking;

      // Комбинируем исходный скор с ML-скором
      const combinedScore = this.combineScores(
        result.finalScore || result.score,
        mlRanking.mlScore,
        0.7, // Вес исходного скора
        0.3  // Вес ML-скора
      );

      result.finalScore = combinedScore;
    }

    // Пересортируем по новым скорам
    rankedResults.sort((a, b) => (b.finalScore || b.score) - (a.finalScore || a.score));

    // Обновляем ранги и изменения
    rankedResults.forEach((result, index) => {
      const newRank = index + 1;
      result.rankChange = result.originalRank - newRank;
      result.rank = newRank;
    });

    return rankedResults;
  }

  /**
   * Диверсификация результатов для устранения дублирования
   */
  private async diversifyResults(
    results: OptimizedResult[],
    query: string,
    context: OptimizationContext
  ): Promise<OptimizedResult[]> {
    switch (this.config.diversificationAlgorithm) {
      case 'semantic':
        return this.semanticDiversification(results, query, context);
      case 'cluster':
        return this.clusterBasedDiversification(results, query, context);
      case 'mmd':
        return this.mmdDiversification(results, query, context);
      case 'round_robin':
        return this.roundRobinDiversification(results, query, context);
      default:
        return this.semanticDiversification(results, query, context);
    }
  }

  /**
   * Семантическая диверсификация
   */
  private async semanticDiversification(
    results: OptimizedResult[],
    query: string,
    context: OptimizationContext
  ): Promise<OptimizedResult[]> {
    const diversifiedResults: OptimizedResult[] = [];
    const selectedResults = new Set<string>();

    // Сначала добавляем самый релевантный результат
    if (results.length > 0) {
      const firstResult = results[0];
      diversifiedResults.push({
        ...firstResult,
        diversification: {
          diversityScore: 1.0,
          clusterId: 'cluster_0',
          similarity: [],
          diversificationReason: 'Highest relevance score'
        }
      });
      selectedResults.add(firstResult.id);
    }

    // Добавляем остальные результаты на основе баланса релевантности и разнообразия
    for (let i = 1; i < results.length; i++) {
      let bestResult: OptimizedResult | null = null;
      let bestScore = -Infinity;

      for (const candidate of results) {
        if (selectedResults.has(candidate.id)) continue;

        // Рассчитываем скор разнообразия
        const diversityScore = await this.calculateDiversityScore(
          candidate, diversifiedResults
        );

        // Комбинируем релевантность и разнообразие
        const alpha = 0.7; // Вес релевантности
        const beta = 0.3;  // Вес разнообразия
        const combinedScore = alpha * (candidate.finalScore || candidate.score) + beta * diversityScore;

        if (combinedScore > bestScore) {
          bestScore = combinedScore;
          bestResult = {
            ...candidate,
            diversification: {
              diversityScore,
              clusterId: `cluster_${diversifiedResults.length}`,
              similarity: [],
              diversificationReason: `Balanced relevance (${candidate.finalScore?.toFixed(2)}) and diversity (${diversityScore.toFixed(2)})`
            }
          };
        }
      }

      if (bestResult) {
        diversifiedResults.push(bestResult);
        selectedResults.add(bestResult.id);
      }
    }

    return diversifiedResults;
  }

  /**
   * Кластерная диверсификация
   */
  private async clusterBasedDiversification(
    results: OptimizedResult[],
    query: string,
    context: OptimizationContext
  ): Promise<OptimizedResult[]> {
    // Группируем результаты в кластеры по содержимому
    const clusters = this.clusterResults(results);
    const diversifiedResults: OptimizedResult[] = [];

    // Берем лучший результат из каждого кластера
    for (const [clusterId, clusterResults] of clusters.entries()) {
      const sortedClusterResults = clusterResults.sort((a, b) =>
        (b.finalScore || b.score) - (a.finalScore || a.score)
      );

      for (const result of sortedClusterResults) {
        if (diversifiedResults.length >= this.config.maxResults) break;

        diversifiedResults.push({
          ...result,
          diversification: {
            diversityScore: 0.8,
            clusterId,
            similarity: [],
            diversificationReason: `Best result in cluster ${clusterId}`
          }
        });
      }
    }

    return diversifiedResults.sort((a, b) =>
      (b.finalScore || b.score) - (a.finalScore || a.score)
    );
  }

  /**
   * MMD (Maximum Mean Discrepancy) диверсификация
   */
  private async mmdDiversification(
    results: OptimizedResult[],
    query: string,
    context: OptimizationContext
  ): Promise<OptimizedResult[]> {
    // Упрощенная реализация MMD
    const diversifiedResults: OptimizedResult[] = [];
    const remainingResults = [...results];

    // Добавляем первый результат
    if (remainingResults.length > 0) {
      const first = remainingResults.shift()!;
      diversifiedResults.push({
        ...first,
        diversification: {
          diversityScore: 1.0,
          clusterId: 'mmd_0',
          similarity: [],
          diversificationReason: 'MMD initialization'
        }
      });
    }

    // Итеративно добавляем результаты, максимизируя MMD
    while (remainingResults.length > 0 && diversifiedResults.length < this.config.maxResults) {
      let bestCandidate: OptimizedResult | null = null;
      let bestMmdScore = -Infinity;
      let bestIndex = -1;

      for (let i = 0; i < remainingResults.length; i++) {
        const candidate = remainingResults[i];
        const mmdScore = await this.calculateMMDScore(candidate, diversifiedResults);

        if (mmdScore > bestMmdScore) {
          bestMmdScore = mmdScore;
          bestCandidate = candidate;
          bestIndex = i;
        }
      }

      if (bestCandidate && bestIndex >= 0) {
        diversifiedResults.push({
          ...bestCandidate,
          diversification: {
            diversityScore: bestMmdScore,
            clusterId: `mmd_${diversifiedResults.length}`,
            similarity: [],
            diversificationReason: `MMD score: ${bestMmdScore.toFixed(3)}`
          }
        });
        remainingResults.splice(bestIndex, 1);
      } else {
        break;
      }
    }

    return diversifiedResults;
  }

  /**
   * Round-robin диверсификация
   */
  private async roundRobinDiversification(
    results: OptimizedResult[],
    query: string,
    context: OptimizationContext
  ): Promise<OptimizedResult[]> {
    // Группируем по источнику или типу контента
    const groups = new Map<string, OptimizedResult[]>();

    for (const result of results) {
      const groupKey = this.getResultGroupKey(result);
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(result);
    }

    // Сортируем каждую группу по релевантности
    for (const group of groups.values()) {
      group.sort((a, b) => (b.finalScore || b.score) - (a.finalScore || a.score));
    }

    // Round-robin выбор
    const diversifiedResults: OptimizedResult[] = [];
    const groupArrays = Array.from(groups.values());
    let maxIndex = Math.max(...groupArrays.map(arr => arr.length));

    for (let i = 0; i < maxIndex && diversifiedResults.length < this.config.maxResults; i++) {
      for (const group of groupArrays) {
        if (i < group.length && diversifiedResults.length < this.config.maxResults) {
          const result = group[i];
          diversifiedResults.push({
            ...result,
            diversification: {
              diversityScore: 0.8,
              clusterId: `rr_${this.getResultGroupKey(result)}`,
              similarity: [],
              diversificationReason: `Round-robin from group ${this.getResultGroupKey(result)}, position ${i + 1}`
            }
          });
        }
      }
    }

    return diversifiedResults;
  }

  /**
   * Персонализация результатов
   */
  private async personalizeResults(
    results: OptimizedResult[],
    query: string,
    context: OptimizationContext
  ): Promise<OptimizedResult[]> {
    const userId = context.sessionId!;
    const userProfile = this.getUserProfile(userId);

    const personalizedResults = results.map(result => {
      const personalization = this.calculatePersonalizationScore(result, userProfile, context);

      // Применяем персональный буст
      const personalizedScore = (result.finalScore || result.score) *
        (1 + personalization.personalScore * this.config.rankingWeights.personalization);

      return {
        ...result,
        personalization,
        finalScore: personalizedScore
      };
    });

    // Пересортируем с учетом персонализации
    personalizedResults.sort((a, b) => (b.finalScore || b.score) - (a.finalScore || a.score));

    // Обновляем ранги
    personalizedResults.forEach((result, index) => {
      result.rank = index + 1;
      result.rankChange = result.originalRank - (index + 1);
    });

    return personalizedResults;
  }

  /**
   * Итоговая обработка оптимизированных результатов
   */
  private finalizeOptimization(
    results: OptimizedResult[],
    context: OptimizationContext
  ): OptimizedResult[] {
    return results.map(result => ({
      ...result,
      detailedExplanation: this.generateDetailedExplanation(result, context)
    }));
  }

  // === Вспомогательные методы ===

  /**
   * Извлечение признаков для ML-модели
   */
  private async extractFeaturesForResults(
    results: ResultWithSnippets[],
    query: string,
    context: OptimizationContext
  ): Promise<Map<string, Float32Array>> {
    const featuresMap = new Map<string, Float32Array>();

    for (const result of results) {
      const cacheKey = `${result.id}_${query}`;

      if (this.featureCache.has(cacheKey)) {
        featuresMap.set(result.id, this.featureCache.get(cacheKey)!);
        continue;
      }

      const features = this.extractResultFeatures(result, query, context);
      featuresMap.set(result.id, features);
      this.featureCache.set(cacheKey, features);
    }

    return featuresMap;
  }

  /**
   * Извлечение признаков для конкретного результата
   */
  private extractResultFeatures(
    result: ResultWithSnippets,
    query: string,
    context: OptimizationContext
  ): Float32Array {
    const features = new Float32Array(50); // Фиксированная размерность
    let index = 0;

    // Базовые признаки релевантности
    features[index++] = result.score || 0;
    features[index++] = result.normalizedScore || 0;
    features[index++] = result.ftsScore || 0;
    features[index++] = result.vecScore || 0;

    // Признаки контента
    features[index++] = (result.title?.length || 0) / 100;
    features[index++] = (result.content?.length || 0) / 1000;
    features[index++] = result.snippets?.length || 0;

    // Признаки совпадения с запросом
    const queryWords = query.toLowerCase().split(/\s+/);
    const titleWords = (result.title || '').toLowerCase().split(/\s+/);
    const contentWords = (result.content || '').toLowerCase().split(/\s+/);

    const titleMatches = queryWords.filter(word => titleWords.includes(word)).length;
    const contentMatches = queryWords.filter(word => contentWords.includes(word)).length;

    features[index++] = titleMatches / Math.max(queryWords.length, 1);
    features[index++] = contentMatches / Math.max(queryWords.length, 1);

    // Позиционные признаки
    features[index++] = result.rank / 100; // Нормализованный ранг

    // Признаки качества
    features[index++] = result.metadata ? Object.keys(result.metadata).length / 10 : 0;

    // Временные признаки (если есть)
    const now = Date.now();
    if (result.metadata?.timestamp) {
      const age = (now - Number(result.metadata.timestamp)) / (1000 * 60 * 60 * 24); // Возраст в днях
      features[index++] = Math.max(0, 1 - age / 365); // Фактор свежести (0-1)
    } else {
      features[index++] = 0.5; // Нейтральная свежесть
    }

    // Признаки коллекции
    features[index++] = result.collection ? 1 : 0;

    // Заполняем оставшиеся признаки нулями
    while (index < features.length) {
      features[index++] = 0;
    }

    return features;
  }

  /**
   * Получение ML-скора от модели (заглушка)
   */
  private async getMlRankingScore(
    features: Float32Array,
    query: string,
    context: OptimizationContext
  ): Promise<MLRankingResult> {
    // Заглушка для ML-модели
    // В реальной реализации здесь была бы обученная Learning-to-Rank модель

    const factors = [
      { name: 'Content Relevance', value: features[0], weight: 0.4, impact: features[0] * 0.4 },
      { name: 'Title Match', value: features[7], weight: 0.3, impact: features[7] * 0.3 },
      { name: 'Freshness', value: features[11], weight: 0.2, impact: features[11] * 0.2 },
      { name: 'Quality', value: features[10], weight: 0.1, impact: features[10] * 0.1 }
    ];

    const mlScore = factors.reduce((sum, factor) => sum + factor.impact, 0);

    return {
      mlScore: Math.max(0, Math.min(1, mlScore)),
      factors,
      confidence: 0.8,
      explanation: `ML model boosted score based on ${factors.filter(f => f.impact > 0.1).map(f => f.name).join(', ')}`
    };
  }

  /**
   * Расчет скора разнообразия
   */
  private async calculateDiversityScore(
    candidate: OptimizedResult,
    selectedResults: OptimizedResult[]
  ): Promise<number> {
    if (selectedResults.length === 0) return 1.0;

    let totalSimilarity = 0;
    let comparisons = 0;

    for (const selected of selectedResults) {
      const similarity = await this.calculateSimilarity(candidate, selected);
      totalSimilarity += similarity;
      comparisons++;
    }

    const avgSimilarity = comparisons > 0 ? totalSimilarity / comparisons : 0;
    return Math.max(0, 1 - avgSimilarity); // Чем меньше похожесть, тем больше разнообразие
  }

  /**
   * Расчет схожести между результатами
   */
  private async calculateSimilarity(result1: OptimizedResult, result2: OptimizedResult): Promise<number> {
    const cacheKey = `${result1.id}_${result2.id}`;

    if (this.similarityCache.has(result1.id)) {
      const resultCache = this.similarityCache.get(result1.id)!;
      if (resultCache.has(result2.id)) {
        return resultCache.get(result2.id)!;
      }
    }

    // Простой алгоритм схожести на основе пересечения слов
    const words1 = new Set(((result1.title || '') + ' ' + (result1.content || '')).toLowerCase().split(/\s+/));
    const words2 = new Set(((result2.title || '') + ' ' + (result2.content || '')).toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    const similarity = union.size > 0 ? intersection.size / union.size : 0;

    // Кэшируем результат
    if (!this.similarityCache.has(result1.id)) {
      this.similarityCache.set(result1.id, new Map());
    }
    this.similarityCache.get(result1.id)!.set(result2.id, similarity);

    return similarity;
  }

  /**
   * Расчет MMD скора
   */
  private async calculateMMDScore(
    candidate: OptimizedResult,
    selectedResults: OptimizedResult[]
  ): Promise<number> {
    // Упрощенная реализация MMD
    const diversityScore = await this.calculateDiversityScore(candidate, selectedResults);
    const relevanceScore = candidate.finalScore || candidate.score;

    // Баланс между релевантностью и разнообразием
    const alpha = 0.6; // Вес релевантности
    const beta = 0.4;  // Вес разнообразия

    return alpha * relevanceScore + beta * diversityScore;
  }

  /**
   * Кластеризация результатов
   */
  private clusterResults(results: OptimizedResult[]): Map<string, OptimizedResult[]> {
    const clusters = new Map<string, OptimizedResult[]>();

    for (const result of results) {
      // Простая кластеризация по первым словам заголовка
      const title = result.title || 'untitled';
      const firstWords = title.toLowerCase().split(/\s+/).slice(0, 2).join('_');
      const clusterId = `cluster_${firstWords}`;

      if (!clusters.has(clusterId)) {
        clusters.set(clusterId, []);
      }
      clusters.get(clusterId)!.push(result);
    }

    return clusters;
  }

  /**
   * Получение ключа группы для результата
   */
  private getResultGroupKey(result: OptimizedResult): string {
    // Группируем по коллекции или источнику
    if (result.collection) {
      return result.collection;
    }

    if (result.source) {
      return result.source;
    }

    // Группируем по типу контента на основе метаданных
    if (result.metadata?.type) {
      return String(result.metadata.type);
    }

    return 'default';
  }

  /**
   * Получение или создание профиля пользователя
   */
  private getUserProfile(userId: string): UserProfile {
    if (!this.userProfiles.has(userId)) {
      this.userProfiles.set(userId, {
        userId,
        preferences: new Map(),
        clickHistory: [],
        sessionCount: 0,
        lastActivity: Date.now()
      });
    }

    return this.userProfiles.get(userId)!;
  }

  /**
   * Расчет персонального скора
   */
  private calculatePersonalizationScore(
    result: OptimizedResult,
    userProfile: UserProfile,
    context: OptimizationContext
  ): PersonalizationResult {
    const config = this.config.personalizationConfig;
    const factors = {
      clickHistoryBoost: 0,
      sessionContextBoost: 0,
      userProfileBoost: 0,
      timeDecayFactor: 1
    };

    // Анализ истории кликов
    if (context.clickHistory && context.clickHistory.length > 0) {
      const relevantClicks = context.clickHistory.filter(click =>
        this.isRelevantClick(click, result)
      );

      if (relevantClicks.length > 0) {
        const clickBoost = relevantClicks.length / context.clickHistory.length;
        factors.clickHistoryBoost = clickBoost * config.clickHistoryWeight;
      }
    }

    // Контекст сессии
    if (context.sessionResults && context.sessionResults.length > 0) {
      const sessionRelevance = this.calculateSessionRelevance(result, context.sessionResults);
      factors.sessionContextBoost = sessionRelevance * config.sessionContextWeight;
    }

    // Профиль пользователя
    factors.userProfileBoost = this.calculateProfileRelevance(result, userProfile) *
      config.userProfileWeight;

    // Временное затухание
    const timeSinceLastActivity = Date.now() - userProfile.lastActivity;
    const daysSinceActivity = timeSinceLastActivity / (1000 * 60 * 60 * 24);
    factors.timeDecayFactor = Math.pow(config.decayFactor, daysSinceActivity);

    const personalScore = (factors.clickHistoryBoost + factors.sessionContextBoost +
      factors.userProfileBoost) * factors.timeDecayFactor;

    return {
      personalScore: Math.max(0, Math.min(1, personalScore)),
      factors,
      explanation: `Personalized based on user activity and preferences (boost: ${(personalScore * 100).toFixed(1)}%)`
    };
  }

  /**
   * Проверка релевантности клика
   */
  private isRelevantClick(click: QueryHistory, result: OptimizedResult): boolean {
    // Простая проверка на основе совпадения слов
    const clickWords = new Set(click.query.toLowerCase().split(/\s+/));
    const resultWords = new Set(((result.title || '') + ' ' + (result.content || '')).toLowerCase().split(/\s+/));

    const intersection = new Set([...clickWords].filter(x => resultWords.has(x)));
    return intersection.size / Math.max(clickWords.size, 1) > 0.3;
  }

  /**
   * Расчет релевантности сессии
   */
  private calculateSessionRelevance(result: OptimizedResult, sessionResults: SearchResult[]): number {
    // Анализируем, насколько результат похож на уже просмотренные в сессии
    let totalSimilarity = 0;
    let comparisons = 0;

    for (const sessionResult of sessionResults.slice(-5)) { // Последние 5 результатов
      const similarity = this.calculateSimpleTextSimilarity(
        (result.title || '') + ' ' + (result.content || ''),
        (sessionResult.title || '') + ' ' + (sessionResult.content || '')
      );

      totalSimilarity += similarity;
      comparisons++;
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  /**
   * Расчет релевантности профиля
   */
  private calculateProfileRelevance(result: OptimizedResult, userProfile: UserProfile): number {
    let relevanceScore = 0;

    // Анализируем предпочтения пользователя
    for (const [preference, weight] of userProfile.preferences.entries()) {
      const resultText = ((result.title || '') + ' ' + (result.content || '')).toLowerCase();
      if (resultText.includes(preference.toLowerCase())) {
        relevanceScore += weight;
      }
    }

    return Math.max(0, Math.min(1, relevanceScore));
  }

  /**
   * Простой расчет схожести текстов
   */
  private calculateSimpleTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));

    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Комбинирование скоров
   */
  private combineScores(score1: number, score2: number, weight1: number, weight2: number): number {
    return score1 * weight1 + score2 * weight2;
  }

  /**
   * Генерация подробного объяснения скора
   */
  private generateDetailedExplanation(result: OptimizedResult, context: OptimizationContext): ScoreExplanation {
    const components = [
      {
        name: 'Base Relevance Score',
        score: result.score,
        weight: this.config.rankingWeights.relevance,
        details: 'Original search relevance score'
      }
    ];

    if (result.mlRanking) {
      components.push({
        name: 'ML Ranking Boost',
        score: result.mlRanking.mlScore,
        weight: 0.3,
        details: result.mlRanking.explanation
      });
    }

    if (result.diversification) {
      components.push({
        name: 'Diversity Score',
        score: result.diversification.diversityScore,
        weight: this.config.rankingWeights.diversity,
        details: result.diversification.diversificationReason
      });
    }

    if (result.personalization) {
      components.push({
        name: 'Personalization Boost',
        score: result.personalization.personalScore,
        weight: this.config.rankingWeights.personalization,
        details: result.personalization.explanation
      });
    }

    const totalScore = result.finalScore || result.score;

    return {
      totalScore,
      components,
      formula: 'weighted_sum(base_relevance, ml_boost, diversity, personalization)'
    };
  }

  /**
   * Обновление метрик производительности
   */
  private updatePerformanceMetrics(
    originalResults: ResultWithSnippets[],
    optimizedResults: OptimizedResult[],
    optimizationTime: number,
    context: OptimizationContext
  ): void {
    this.performanceMetrics.totalQueries++;

    // Обновляем среднее время оптимизации
    this.performanceMetrics.averageOptimizationTime =
      (this.performanceMetrics.averageOptimizationTime * (this.performanceMetrics.totalQueries - 1) +
       optimizationTime) / this.performanceMetrics.totalQueries;

    // Рассчитываем улучшение релевантности (простая метрика)
    const originalTopScore = originalResults.length > 0 ? originalResults[0].score : 0;
    const optimizedTopScore = optimizedResults.length > 0 ? (optimizedResults[0].finalScore || optimizedResults[0].score) : 0;
    const improvement = optimizedTopScore - originalTopScore;

    this.performanceMetrics.averageRelevanceImprovement =
      (this.performanceMetrics.averageRelevanceImprovement * (this.performanceMetrics.totalQueries - 1) +
       improvement) / this.performanceMetrics.totalQueries;

    // Обновляем статистику диверсификации
    const diversifiedCount = optimizedResults.filter(r => r.diversification).length;
    const diversificationRate = optimizedResults.length > 0 ? diversifiedCount / optimizedResults.length : 0;

    this.performanceMetrics.diversificationRate =
      (this.performanceMetrics.diversificationRate * (this.performanceMetrics.totalQueries - 1) +
       diversificationRate) / this.performanceMetrics.totalQueries;

    // Обновляем эффективность персонализации
    const personalizedCount = optimizedResults.filter(r => r.personalization && r.personalization.personalScore > 0).length;
    const personalizationRate = optimizedResults.length > 0 ? personalizedCount / optimizedResults.length : 0;

    this.performanceMetrics.personalizationEffectiveness =
      (this.performanceMetrics.personalizationEffectiveness * (this.performanceMetrics.totalQueries - 1) +
       personalizationRate) / this.performanceMetrics.totalQueries;

    // Обновляем статистику экспериментов
    if (context.experimentContext) {
      const experimentId = context.experimentContext.experimentId;
      if (!this.performanceMetrics.experimentStats.has(experimentId)) {
        this.performanceMetrics.experimentStats.set(experimentId, {
          queriesCount: 0,
          averageCTR: 0,
          averageRelevance: 0
        });
      }

      const stats = this.performanceMetrics.experimentStats.get(experimentId)!;
      stats.queriesCount++;
      // CTR и relevance будут обновлены при получении обратной связи
    }
  }

  /**
   * Инициализация ML моделей
   */
  private initializeModels(): void {
    // Заглушки для ML моделей
    // В реальной реализации здесь была бы инициализация обученных моделей
    this.rerankingModel = null;
    this.diversificationModel = null;
    this.personalizationModel = null;
  }

  /**
   * Получение метрик производительности
   */
  getPerformanceMetrics(): OptimizerPerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Обновление пользовательского профиля на основе обратной связи
   */
  updateUserProfile(
    userId: string,
    query: string,
    clickedResults: SearchResult[],
    interaction: 'clicked' | 'ignored' | 'refined'
  ): void {
    const profile = this.getUserProfile(userId);
    profile.lastActivity = Date.now();

    if (interaction === 'clicked' && clickedResults.length > 0) {
      // Обновляем предпочтения на основе кликнутых результатов
      for (const result of clickedResults) {
        const words = ((result.title || '') + ' ' + (result.content || '')).toLowerCase().split(/\s+/);
        for (const word of words) {
          if (word.length > 3) { // Игнорируем короткие слова
            const currentWeight = profile.preferences.get(word) || 0;
            profile.preferences.set(word, Math.min(1, currentWeight + 0.1));
          }
        }
      }

      // Добавляем в историю кликов
      profile.clickHistory.push({
        query,
        strategy: SearchStrategy.KEYWORD, // Будет обновлено извне
        resultCount: clickedResults.length,
        userInteraction: interaction,
        timestamp: Date.now()
      });

      // Ограничиваем размер истории
      if (profile.clickHistory.length > 100) {
        profile.clickHistory.splice(0, profile.clickHistory.length - 100);
      }
    }

    profile.sessionCount++;
  }

  /**
   * Обратная связь для обучения моделей
   */
  provideFeedback(
    query: string,
    results: OptimizedResult[],
    userInteractions: Array<{
      resultId: string;
      interaction: 'clicked' | 'ignored' | 'refined';
    }>
  ): void {
    // Собираем данные для обучения
    for (const result of results) {
      const interaction = userInteractions.find(i => i.resultId === result.id);
      if (interaction) {
        const features = this.featureCache.get(`${result.id}_${query}`);
        if (features) {
          const relevanceScore = interaction.interaction === 'clicked' ? 1 :
                                interaction.interaction === 'ignored' ? 0 : 0.5;

          this.trainingData.push({
            features,
            relevanceScore,
            userInteraction: interaction.interaction
          });

          // Ограничиваем размер обучающих данных
          if (this.trainingData.length > 10000) {
            this.trainingData.splice(0, 1000); // Удаляем старые данные
          }
        }
      }
    }

    // В реальной реализации здесь была бы переобучение моделей
  }

  /**
   * Очистка кэшей
   */
  clearCache(): void {
    this.featureCache.clear();
    this.similarityCache.clear();
  }
}

/**
 * Интерфейс пользовательского профиля
 */
interface UserProfile {
  userId: string;
  preferences: Map<string, number>; // слово -> вес предпочтения
  clickHistory: QueryHistory[];
  sessionCount: number;
  lastActivity: number;
}

/**
 * Конфигурация по умолчанию
 */
export const DEFAULT_SEARCH_OPTIMIZER_CONFIG: SearchOptimizerConfig = {
  enableMLReranking: true,
  enableDiversification: true,
  enablePersonalization: true,
  maxResults: 100,
  rerankingThreshold: 0.6,
  rankingWeights: {
    relevance: 0.4,
    diversity: 0.15,
    quality: 0.15,
    freshness: 0.1,
    popularity: 0.1,
    personalization: 0.1
  },
  diversificationAlgorithm: 'semantic',
  personalizationConfig: {
    clickHistoryWeight: 0.3,
    sessionContextWeight: 0.2,
    userProfileWeight: 0.3,
    decayFactor: 0.95
  }
};

/**
 * Фабричная функция для создания SearchOptimizer
 */
export function createSearchOptimizer(config?: Partial<SearchOptimizerConfig>): SearchOptimizer {
  return new SearchOptimizer(config);
}

/**
 * Экспорт по умолчанию
 */
export default SearchOptimizer;