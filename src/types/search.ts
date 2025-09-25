/**
 * Comprehensive Search Type Definitions for LocalRetrieve
 *
 * Defines types for enhanced text-only hybrid search capabilities,
 * including query classification, search strategy selection,
 * and result processing with score normalization.
 */

// Base types
export type SQLValue = number | string | Uint8Array | null;

// Search mode enumeration
export enum SearchMode {
  AUTO = 'auto',           // Автоматический выбор стратегии на основе анализа запроса
  FTS_ONLY = 'fts_only',   // Только полнотекстовый поиск
  VECTOR_ONLY = 'vector_only', // Только векторный поиск
  HYBRID = 'hybrid',       // Гибридный поиск с объединением результатов
  GLOBAL = 'global'        // Глобальный поиск по всем коллекциям
}

// Search strategy types
export enum SearchStrategy {
  EXACT_MATCH = 'exact_match',     // Точное совпадение для коротких запросов
  KEYWORD = 'keyword',             // Поиск по ключевым словам
  PHRASE = 'phrase',               // Поиск фраз с учетом порядка слов
  SEMANTIC = 'semantic',           // Семантический поиск на основе embeddings
  FUZZY = 'fuzzy',                 // Нечеткий поиск с учетом опечаток
  PROXIMITY = 'proximity',         // Поиск с учетом близости слов
  BOOLEAN = 'boolean'              // Булевый поиск с операторами
}

// Query classification types
export enum QueryType {
  UNKNOWN = 'unknown',
  SHORT_KEYWORD = 'short_keyword',     // Короткие ключевые слова (1-3 слова)
  LONG_PHRASE = 'long_phrase',         // Длинные фразы (4+ слов)
  QUESTION = 'question',               // Вопросы (начинающиеся с вопросительных слов)
  BOOLEAN_QUERY = 'boolean_query',     // Булевые операторы (AND, OR, NOT)
  EXACT_PHRASE = 'exact_phrase',       // Точные фразы в кавычках
  WILDCARD = 'wildcard',               // Запросы с подстановочными символами
  NUMERIC = 'numeric',                 // Числовые запросы
  ENTITY = 'entity'                    // Именованные сущности
}

// Fusion methods for combining search results
export enum FusionMethod {
  RRF = 'rrf',                    // Reciprocal Rank Fusion
  WEIGHTED = 'weighted',          // Взвешенное объединение
  LINEAR = 'linear',              // Линейная комбинация оценок
  HARMONIC = 'harmonic',          // Гармоническое среднее
  GEOMETRIC = 'geometric',        // Геометрическое среднее
  BAYESIAN = 'bayesian'           // Байесовское объединение
}

// Score normalization methods
export enum ScoreNormalization {
  NONE = 'none',                  // Без нормализации
  MIN_MAX = 'min_max',           // Min-Max нормализация
  Z_SCORE = 'z_score',           // Z-score нормализация
  SIGMOID = 'sigmoid',           // Сигмоидная нормализация
  RANK_BASED = 'rank_based'      // Нормализация на основе ранга
}

// Search context for strategy selection
export interface SearchContext {
  collectionName?: string;
  documentCount: number;
  averageDocumentLength: number;
  indexCapabilities: {
    hasFTS: boolean;
    hasVector: boolean;
    hasEmbeddings: boolean;
  };
  userPreferences?: {
    preferredMode?: SearchMode;
    responseTime?: 'fast' | 'balanced' | 'comprehensive';
    resultQuality?: 'speed' | 'balanced' | 'precision';
  };
  previousQueries?: QueryHistory[];
}

// Query history for learning user patterns
export interface QueryHistory {
  query: string;
  strategy: SearchStrategy;
  resultCount: number;
  userInteraction: 'clicked' | 'ignored' | 'refined';
  timestamp: number;
}

// Query analysis result
export interface QueryAnalysis {
  originalQuery: string;
  normalizedQuery: string;
  queryType: QueryType;
  confidence: number;          // Уверенность классификации (0-1)
  features: QueryFeatures;
  suggestedStrategy: SearchStrategy;
  alternativeStrategies: SearchStrategy[];
  estimatedComplexity: 'low' | 'medium' | 'high';
}

// Query feature extraction
export interface QueryFeatures {
  wordCount: number;
  hasQuestionWords: boolean;
  hasBooleanOperators: boolean;
  hasWildcards: boolean;
  hasQuotes: boolean;
  hasNumbers: boolean;
  hasSpecialCharacters: boolean;
  averageWordLength: number;
  containsCommonStopWords: boolean;
  estimatedIntent: 'search' | 'filter' | 'navigate' | 'compare';
}

// Search execution plan
export interface SearchExecutionPlan {
  primaryStrategy: SearchStrategy;
  fallbackStrategies: SearchStrategy[];
  searchModes: SearchMode[];
  fusion: {
    method: FusionMethod;
    weights: SearchWeights;
    normalization: ScoreNormalization;
  };
  filters: SearchFilters;
  pagination: PaginationOptions;
  performance: PerformanceConstraints;
}

// Search weight configuration
export interface SearchWeights {
  fts: number;                // Вес полнотекстового поиска
  vector: number;             // Вес векторного поиска
  exactMatch: number;         // Вес точных совпадений
  phraseMatch: number;        // Вес совпадения фраз
  proximity: number;          // Вес близости слов
  freshness: number;          // Вес свежести документов
  popularity: number;         // Вес популярности документов
}

// Text search options (enhanced version of existing)
export interface TextSearchOptions {
  collection?: string;
  mode?: SearchMode;
  strategy?: SearchStrategy;
  limit?: number;
  offset?: number;
  filters?: SearchFilters;
  fusion?: FusionConfig;
  snippets?: SnippetOptions;
  highlight?: HighlightOptions;
  performance?: PerformanceConstraints;
  context?: Partial<SearchContext>;
}

// Advanced search parameters
export interface AdvancedSearchParams {
  query: string;
  collections?: string[];
  searchPlan?: Partial<SearchExecutionPlan>;
  boosts?: FieldBoosts;
  filters?: AdvancedFilters;
  aggregations?: AggregationRequest[];
  facets?: FacetRequest[];
  explain?: boolean;          // Возвращать объяснение релевантности
}

// Global search options (across all collections)
export interface GlobalSearchOptions {
  maxCollections?: number;
  collectionFilter?: (collection: string) => boolean;
  mergeStrategy?: 'interleave' | 'group_by_collection' | 'unified_ranking';
  crossCollectionBoosts?: Record<string, number>;
  diversification?: DiversificationOptions;
}

// Search filters
export interface SearchFilters {
  metadata?: Record<string, any>;
  dateRange?: {
    field: string;
    start?: Date | string | number;
    end?: Date | string | number;
  };
  numericRange?: {
    field: string;
    min?: number;
    max?: number;
  };
  textFilter?: {
    field: string;
    value: string;
    operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'regex';
  };
  exists?: string[];           // Поля, которые должны существовать
  missing?: string[];          // Поля, которые не должны существовать
}

// Advanced filters with complex logic
export interface AdvancedFilters extends SearchFilters {
  bool?: {
    must?: SearchFilters[];
    should?: SearchFilters[];
    must_not?: SearchFilters[];
    minimum_should_match?: number;
  };
  script?: {
    source: string;
    params?: Record<string, any>;
  };
}

// Field boost configuration
export interface FieldBoosts {
  title?: number;
  content?: number;
  metadata?: Record<string, number>;
  customFields?: Record<string, number>;
}

// Fusion configuration
export interface FusionConfig {
  method: FusionMethod;
  weights?: SearchWeights;
  normalization?: ScoreNormalization;
  parameters?: Record<string, any>;
}

// Snippet generation options
export interface SnippetOptions {
  enabled: boolean;
  maxLength?: number;
  contextWindow?: number;      // Количество слов до и после совпадения
  maxSnippets?: number;
  separator?: string;
  highlightTags?: {
    pre: string;
    post: string;
  };
}

// Highlight configuration
export interface HighlightOptions {
  enabled: boolean;
  fields?: string[];
  fragmentSize?: number;
  maxFragments?: number;
  requireFieldMatch?: boolean;
  tags?: {
    pre: string;
    post: string;
  };
}

// Performance constraints
export interface PerformanceConstraints {
  maxTime?: number;           // Максимальное время выполнения (мс)
  maxMemory?: number;         // Максимальное использование памяти (MB)
  earlyTermination?: boolean; // Ранняя остановка при достижении лимита
  caching?: boolean;          // Использование кэша
}

// Pagination options
export interface PaginationOptions {
  limit: number;
  offset: number;
  deep?: boolean;             // Глубокая пагинация
  cursor?: string;            // Cursor-based пагинация
}

// Diversification options for global search
export interface DiversificationOptions {
  enabled: boolean;
  maxPerCollection?: number;
  diversityField?: string;
  algorithm?: 'mmd' | 'cluster' | 'round_robin';
}

// Aggregation request
export interface AggregationRequest {
  name: string;
  type: 'terms' | 'histogram' | 'date_histogram' | 'range' | 'stats';
  field: string;
  size?: number;
  parameters?: Record<string, any>;
}

// Facet request
export interface FacetRequest {
  name: string;
  field: string;
  type: 'terms' | 'range' | 'date_range';
  size?: number;
  filters?: SearchFilters;
}

// Search result types (enhanced)
export interface SearchResult {
  id: string;
  title?: string;
  content?: string;
  metadata?: Record<string, any>;
  score: number;
  normalizedScore?: number;
  ftsScore?: number;
  vecScore?: number;
  explanation?: ScoreExplanation;
  snippets?: string[];
  highlights?: Record<string, string[]>;
  collection?: string;
  rank: number;
  distance?: number;          // Для векторного поиска
}

// Score explanation for debugging
export interface ScoreExplanation {
  totalScore: number;
  components: Array<{
    name: string;
    score: number;
    weight: number;
    details?: string;
  }>;
  formula?: string;
}

// Enhanced search response
export interface SearchResponse {
  results: SearchResult[];
  totalResults: number;
  searchTime: number;
  strategy: SearchStrategy;
  fusion?: FusionMethod;
  aggregations?: Record<string, any>;
  facets?: Record<string, any>;
  suggestions?: string[];     // Предложения для исправления запроса
  debugInfo?: SearchDebugInfo;
}

// Global search response (across collections)
export interface GlobalSearchResponse extends SearchResponse {
  collectionResults: Array<{
    collection: string;
    results: SearchResult[];
    totalInCollection: number;
  }>;
  collectionsSearched: string[];
}

// Debug information for search tuning
export interface SearchDebugInfo {
  queryAnalysis: QueryAnalysis;
  executionPlan: SearchExecutionPlan;
  timings: {
    analysis: number;
    planning: number;
    execution: number;
    fusion: number;
    total: number;
  };
  indexUsage: {
    ftsIndex?: boolean;
    vectorIndex?: boolean;
    filterIndex?: boolean;
  };
  warnings?: string[];
  recommendations?: string[];
}

// Raw search result before processing
export interface RawSearchResult {
  id: string;
  title?: string;
  content?: string;
  metadata?: Record<string, any>;
  rawScore: number;
  source: 'fts' | 'vector' | 'hybrid';
  rank: number;
}

// Result processing options
export interface ResultProcessingOptions {
  normalization: ScoreNormalization;
  deduplication?: boolean;
  clustering?: boolean;
  reranking?: RerankingOptions;
  snippetGeneration?: SnippetOptions;
  highlighting?: HighlightOptions;
}

// Re-ranking options
export interface RerankingOptions {
  enabled: boolean;
  model?: string;
  features?: string[];
  learningToRank?: boolean;
}

// Re-ranking context
export interface RerankingContext {
  query: string;
  userProfile?: Record<string, any>;
  sessionContext?: Record<string, any>;
  clickHistory?: QueryHistory[];
}

// Result with snippets
export interface ResultWithSnippets extends SearchResult {
  snippets: string[];
  snippetScore?: number;
  rawScore: number;
  source: 'fts' | 'vector' | 'hybrid';
}

// Ranked result after processing
export interface RankedResult extends ResultWithSnippets {
  finalScore: number;
  rerankingScore?: number;
  diversityScore?: number;
  rawScore: number;
  source: 'fts' | 'vector' | 'hybrid';
}

// Search statistics
export interface SearchStatistics {
  totalQueries: number;
  averageResponseTime: number;
  successRate: number;
  popularStrategies: Record<SearchStrategy, number>;
  errorRate: number;
  cacheHitRate: number;
}

// Configuration types for different components
export interface StrategyEngineConfig {
  defaultMode: SearchMode;
  enableLearning: boolean;
  confidenceThreshold: number;
  fallbackStrategy: SearchStrategy;
  maxAlternatives: number;
}

export interface ResultProcessorConfig {
  defaultNormalization: ScoreNormalization;
  enableSnippets: boolean;
  defaultSnippetLength: number;
  enableHighlighting: boolean;
  maxProcessingTime: number;
}

// Error types specific to search operations
export class SearchError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'SearchError';
  }
}

export class QueryAnalysisError extends SearchError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'QUERY_ANALYSIS_ERROR', details);
    this.name = 'QueryAnalysisError';
  }
}

export class StrategySelectionError extends SearchError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'STRATEGY_SELECTION_ERROR', details);
    this.name = 'StrategySelectionError';
  }
}

export class ResultProcessingError extends SearchError {
  constructor(message: string, details?: Record<string, any>) {
    super(message, 'RESULT_PROCESSING_ERROR', details);
    this.name = 'ResultProcessingError';
  }
}

// Type guards for runtime type checking
export function isSearchMode(value: any): value is SearchMode {
  return Object.values(SearchMode).includes(value);
}

export function isSearchStrategy(value: any): value is SearchStrategy {
  return Object.values(SearchStrategy).includes(value);
}

export function isFusionMethod(value: any): value is FusionMethod {
  return Object.values(FusionMethod).includes(value);
}

export function isTextSearchOptions(value: any): value is TextSearchOptions {
  return typeof value === 'object' && value !== null;
}

export function isSearchResult(value: any): value is SearchResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof value.id === 'string' &&
    typeof value.score === 'number'
  );
}

// Utility functions for search operations
export function normalizeScore(
  score: number,
  min: number,
  max: number,
  method: ScoreNormalization = ScoreNormalization.MIN_MAX
): number {
  switch (method) {
    case ScoreNormalization.MIN_MAX:
      return max === min ? 0 : (score - min) / (max - min);
    case ScoreNormalization.SIGMOID:
      return 1 / (1 + Math.exp(-score));
    case ScoreNormalization.NONE:
    default:
      return score;
  }
}

export function combineScores(
  scores: number[],
  weights: number[],
  method: FusionMethod = FusionMethod.WEIGHTED
): number {
  if (scores.length !== weights.length) {
    throw new Error('Scores and weights arrays must have the same length');
  }

  switch (method) {
    case FusionMethod.WEIGHTED:
      return scores.reduce((sum, score, idx) => sum + score * weights[idx], 0);
    case FusionMethod.HARMONIC:
      const weightedSum = scores.reduce((sum, score, idx) => sum + weights[idx] / score, 0);
      return weights.reduce((sum, weight) => sum + weight, 0) / weightedSum;
    case FusionMethod.GEOMETRIC:
      const product = scores.reduce((prod, score, idx) => prod * Math.pow(score, weights[idx]), 1);
      const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
      return Math.pow(product, 1 / weightSum);
    default:
      return combineScores(scores, weights, FusionMethod.WEIGHTED);
  }
}

// Default configurations
export const DEFAULT_TEXT_SEARCH_OPTIONS: Required<Omit<TextSearchOptions, 'collection'>> = {
  mode: SearchMode.AUTO,
  strategy: SearchStrategy.KEYWORD,
  limit: 20,
  offset: 0,
  filters: {},
  fusion: {
    method: FusionMethod.RRF,
    weights: {
      fts: 0.7,
      vector: 0.3,
      exactMatch: 1.2,
      phraseMatch: 1.1,
      proximity: 1.0,
      freshness: 0.1,
      popularity: 0.1
    },
    normalization: ScoreNormalization.MIN_MAX
  },
  snippets: {
    enabled: true,
    maxLength: 150,
    contextWindow: 5,
    maxSnippets: 3,
    separator: '...',
    highlightTags: { pre: '<mark>', post: '</mark>' }
  },
  highlight: {
    enabled: true,
    fragmentSize: 100,
    maxFragments: 3,
    requireFieldMatch: false,
    tags: { pre: '<em>', post: '</em>' }
  },
  performance: {
    maxTime: 500,
    maxMemory: 100,
    earlyTermination: true,
    caching: true
  },
  context: {}
};

export const DEFAULT_STRATEGY_ENGINE_CONFIG: StrategyEngineConfig = {
  defaultMode: SearchMode.AUTO,
  enableLearning: true,
  confidenceThreshold: 0.7,
  fallbackStrategy: SearchStrategy.KEYWORD,
  maxAlternatives: 3
};

export const DEFAULT_RESULT_PROCESSOR_CONFIG: ResultProcessorConfig = {
  defaultNormalization: ScoreNormalization.MIN_MAX,
  enableSnippets: true,
  defaultSnippetLength: 150,
  enableHighlighting: true,
  maxProcessingTime: 100
};