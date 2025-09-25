/**
 * Result Processor для LocalRetrieve
 *
 * Обработчик результатов поиска с функциями нормализации оценок,
 * объединения результатов, генерации сниппетов и re-ranking.
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
  ResultProcessorConfig
} from '../types/search.js';

import {
  FusionMethod,
  ScoreNormalization,
  DEFAULT_RESULT_PROCESSOR_CONFIG,
  ResultProcessingError,
  normalizeScore,
  combineScores
} from '../types/search.js';

/**
 * Основной процессор результатов поиска
 */
export class ResultProcessor {
  private config: ResultProcessorConfig;
  private snippetCache = new Map<string, string[]>();
  private scoreStats = new Map<string, { min: number; max: number; avg: number }>();

  constructor(config: Partial<ResultProcessorConfig> = {}) {
    this.config = { ...DEFAULT_RESULT_PROCESSOR_CONFIG, ...config };
  }

  /**
   * Основная функция обработки результатов
   */
  async processResults(
    results: RawSearchResult[],
    query: string,
    options: ResultProcessingOptions
  ): Promise<SearchResponse> {
    const startTime = Date.now();

    try {
      // Фаза 1: Нормализация оценок
      const normalizedResults = this.normalizeScores(results, options.normalization);

      // Фаза 2: Дедупликация (если включена)
      const deduplicatedResults = options.deduplication ?
        this.deduplicateResults(normalizedResults) : normalizedResults;

      // Фаза 3: Генерация сниппетов
      const resultsWithSnippets: ResultWithSnippets[] = options.snippetGeneration?.enabled ?
        await this.generateSnippets(deduplicatedResults, query, options.snippetGeneration) :
        deduplicatedResults.map(r => ({ ...r, snippets: [], score: r.rawScore }));

      // Фаза 4: Подсветка совпадений
      const highlightedResults: ResultWithSnippets[] = options.highlighting?.enabled ?
        this.highlightMatches(resultsWithSnippets, query, options.highlighting) :
        resultsWithSnippets;

      // Фаза 5: Re-ranking (если включен)
      const rerankedResults: RankedResult[] = options.reranking?.enabled ?
        await this.rerankResults(highlightedResults, query, {
          query,
          userProfile: {},
          sessionContext: {},
          clickHistory: []
        }) : highlightedResults.map(r => ({ ...r, finalScore: r.score })) as RankedResult[];

      // Фаза 6: Кластеризация (если включена)
      const clusteredResults: RankedResult[] = options.clustering ?
        this.clusterResults(rerankedResults, query) : rerankedResults;

      // Итоговое ранжирование и сортировка
      const finalResults = this.finalizeResults(clusteredResults, query);

      const processingTime = Date.now() - startTime;

      return {
        results: finalResults,
        totalResults: finalResults.length,
        searchTime: processingTime,
        strategy: 'hybrid' as any, // Будет обновлено вызывающим кодом
        debugInfo: {
          timings: {
            analysis: 0,
            planning: 0,
            execution: 0,
            fusion: processingTime,
            total: processingTime
          }
        } as any
      };

    } catch (error) {
      throw new ResultProcessingError(
        `Failed to process search results: ${error instanceof Error ? error.message : String(error)}`,
        { resultsCount: results.length, query, options }
      );
    }
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
      scoreStatsSize: this.scoreStats.size
    };
  }
}