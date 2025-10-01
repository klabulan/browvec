/**
 * Типы и интерфейсы для системы эмбеддингов LocalRetrieve
 *
 * Данный модуль определяет все типы, необходимые для работы с эмбеддингами
 * на уровне коллекций, включая конфигурацию, результаты и метаданные.
 */

/**
 * Конфигурация эмбеддингов на уровне коллекции
 *
 * Каждая коллекция может иметь свою конфигурацию эмбеддингов,
 * включая разные провайдеры, модели и размерности.
 */
export interface CollectionEmbeddingConfig {
  /** Тип провайдера эмбеддингов */
  provider: EmbeddingProviderType;

  /** Название модели (опционально, по умолчанию используется стандартная модель провайдера) */
  model?: string;

  /** Размерность векторов эмбеддингов для данной коллекции */
  dimensions: number;

  /** API ключ для внешних провайдеров (не сохраняется в БД) */
  apiKey?: string;

  /** Размер батча для пакетной обработки */
  batchSize?: number;

  /** Включено ли кэширование эмбеддингов */
  cacheEnabled?: boolean;

  /** Таймаут генерации эмбеддингов в миллисекундах */
  timeout?: number;

  /** Автоматическая генерация эмбеддингов при добавлении документов */
  autoGenerate?: boolean;

  /** Стратегия предобработки текста */
  textPreprocessing?: TextPreprocessingConfig;

  /** Дополнительные параметры для конкретного провайдера */
  providerOptions?: Record<string, any>;
}

/**
 * Глобальная конфигурация системы эмбеддингов
 *
 * Используется как fallback для коллекций без собственной конфигурации
 * и для общих настроек системы.
 */
export interface EmbeddingConfig {
  /** Провайдер по умолчанию для новых коллекций */
  defaultProvider: EmbeddingProviderType;

  /** Провайдер для конкретной операции (используется в BaseProvider) */
  provider?: EmbeddingProviderType;

  /** Модель по умолчанию */
  defaultModel?: string;

  /** Размерность по умолчанию */
  defaultDimensions: number;

  /** API ключ по умолчанию (не сохраняется в localStorage) */
  apiKey?: string;

  /** Стратегия кэширования */
  cacheStrategy?: CacheStrategy;

  /** Размер батча по умолчанию */
  batchSize?: number;

  /** Таймаут по умолчанию */
  timeout?: number;

  /** Включены ли эмбеддинги по умолчанию */
  enabled?: boolean;

  /** Максимальное количество одновременных операций */
  maxConcurrentOperations?: number;

  /** Настройки воркера для эмбеддингов */
  workerConfig?: EmbeddingWorkerConfig;
}

/**
 * Поддерживаемые типы провайдеров эмбеддингов
 */
export type EmbeddingProviderType =
  | 'transformers'  // Локальные модели через Transformers.js
  | 'openai'        // OpenAI Embeddings API
  | 'cohere'        // Cohere Embeddings API
  | 'huggingface'   // Hugging Face Inference API
  | 'custom';       // Пользовательский провайдер

/**
 * Стратегии кэширования эмбеддингов
 */
export type CacheStrategy =
  | 'memory'      // Кэш в памяти воркера
  | 'indexeddb'   // Персистентный кэш в IndexedDB
  | 'sqlite'      // Кэш в SQLite таблице
  | 'hybrid'      // Комбинация memory + indexeddb
  | 'none';       // Без кэширования

/**
 * Конфигурация предобработки текста
 */
export interface TextPreprocessingConfig {
  /** Максимальная длина текста в символах */
  maxLength?: number;

  /** Удалять ли HTML теги */
  stripHtml?: boolean;

  /** Удалять ли Markdown разметку */
  stripMarkdown?: boolean;

  /** Нормализовать ли пробелы */
  normalizeWhitespace?: boolean;

  /** Конвертировать ли в нижний регистр */
  toLowerCase?: boolean;

  /** Удалять ли специальные символы */
  removeSpecialChars?: boolean;

  /** Пользовательская функция предобработки */
  customPreprocessor?: string; // Serialized function
}

/**
 * Конфигурация воркера для эмбеддингов
 */
export interface EmbeddingWorkerConfig {
  /** URL скрипта воркера */
  workerScript?: string;

  /** Максимальное время ожидания ответа от воркера */
  timeout?: number;

  /** Включить ли детальное логирование */
  enableLogging?: boolean;

  /** Использовать ли SharedArrayBuffer для передачи векторов */
  useSharedArrayBuffer?: boolean;

  /** Максимальный размер очереди операций */
  maxQueueSize?: number;
}

/**
 * Результат генерации эмбеддинга
 */
export interface EmbeddingResult {
  /** Сгенерированный вектор эмбеддинга */
  embedding: Float32Array;

  /** Идентификатор документа */
  documentId: string;

  /** Исходный текст */
  text: string;

  /** Время генерации */
  generatedAt: Date;

  /** Использованный провайдер */
  provider: string;

  /** Использованная модель */
  model: string;

  /** Размерность вектора */
  dimensions: number;

  /** Хэш текста для кэширования */
  textHash: string;

  /** Метаданные генерации */
  metadata?: EmbeddingMetadata;
}

/**
 * Метаданные генерации эмбеддинга
 */
export interface EmbeddingMetadata {
  /** Время генерации в миллисекундах */
  generationTime: number;

  /** Длина исходного текста */
  textLength: number;

  /** Количество токенов (приблизительно) */
  estimatedTokens: number;

  /** Была ли использована предобработка */
  preprocessed: boolean;

  /** Была ли найдена в кэше */
  fromCache: boolean;

  /** Дополнительная информация от провайдера */
  providerMetadata?: Record<string, any>;
}

/**
 * Запрос на генерацию эмбеддинга
 */
export interface EmbeddingRequest {
  /** Текст для генерации эмбеддинга */
  text: string;

  /** Идентификатор коллекции */
  collectionId: string;

  /** Идентификатор документа (опционально) */
  documentId?: string;

  /** Приоритет запроса */
  priority?: EmbeddingPriority;

  /** Дополнительные опции */
  options?: EmbeddingRequestOptions;
}

/**
 * Опции запроса эмбеддинга
 */
export interface EmbeddingRequestOptions {
  /** Принудительная перегенерация (игнорировать кэш) */
  forceRegenerate?: boolean;

  /** Включить метаданные в ответ */
  includeMetadata?: boolean;

  /** Пользовательская предобработка текста */
  customPreprocessing?: boolean;

  /** Таймаут для конкретного запроса */
  timeout?: number;
}

/**
 * Приоритет запроса эмбеддинга
 */
export type EmbeddingPriority = 'low' | 'normal' | 'high' | 'urgent';

/**
 * Результат пакетной генерации эмбеддингов
 */
export interface BatchEmbeddingResult {
  /** Результаты генерации */
  results: EmbeddingResult[];

  /** Общее время обработки */
  totalTime: number;

  /** Количество успешных операций */
  successCount: number;

  /** Количество ошибок */
  errorCount: number;

  /** Ошибки для конкретных элементов */
  errors: Array<{
    index: number;
    error: string;
    text: string;
  }>;

  /** Метаданные пакетной обработки */
  batchMetadata: BatchMetadata;
}

/**
 * Метаданные пакетной обработки
 */
export interface BatchMetadata {
  /** Размер батча */
  batchSize: number;

  /** Использованный провайдер */
  provider: string;

  /** Количество элементов из кэша */
  cacheHits: number;

  /** Среднее время генерации на элемент */
  averageGenerationTime: number;

  /** Общий объем обработанного текста */
  totalTextLength: number;
}

/**
 * Статус операции эмбеддинга
 */
export interface EmbeddingOperationStatus {
  /** Уникальный идентификатор операции */
  operationId: string;

  /** Текущий статус */
  status: EmbeddingOperationState;

  /** Прогресс выполнения (0-100) */
  progress: number;

  /** Обработано элементов */
  processedCount: number;

  /** Общее количество элементов */
  totalCount: number;

  /** Время начала операции */
  startTime: Date;

  /** Ожидаемое время завершения */
  estimatedCompletionTime?: Date;

  /** Текущий обрабатываемый элемент */
  currentItem?: string;

  /** Ошибки, произошедшие во время операции */
  errors: string[];
}

/**
 * Состояния операции эмбеддинга
 */
export type EmbeddingOperationState =
  | 'pending'     // Ожидает обработки
  | 'initializing' // Инициализация провайдера
  | 'processing'  // В процессе обработки
  | 'paused'      // Приостановлена
  | 'completed'   // Завершена успешно
  | 'failed'      // Завершена с ошибкой
  | 'cancelled';  // Отменена пользователем

/**
 * Конфигурация коллекции с эмбеддингами
 */
export interface Collection {
  /** Уникальный идентификатор коллекции */
  id: string;

  /** Отображаемое название коллекции */
  name: string;

  /** Конфигурация эмбеддингов (опционально) */
  embeddingConfig?: CollectionEmbeddingConfig;

  /** Название таблицы векторов */
  vectorTableName?: string;

  /** Количество документов в коллекции */
  documentCount: number;

  /** Количество документов с эмбеддингами */
  documentsWithEmbeddings: number;

  /** Время создания коллекции */
  createdAt: Date;

  /** Время последнего обновления */
  updatedAt: Date;

  /** Метаданные коллекции */
  metadata?: CollectionMetadata;
}

/**
 * Метаданные коллекции
 */
export interface CollectionMetadata {
  /** Описание коллекции */
  description?: string;

  /** Теги для категоризации */
  tags?: string[];

  /** Автор коллекции */
  author?: string;

  /** Версия схемы */
  schemaVersion: number;

  /** Настройки индексации */
  indexingSettings?: IndexingSettings;

  /** Статистика коллекции */
  statistics?: CollectionStatistics;
}

/**
 * Настройки индексации
 */
export interface IndexingSettings {
  /** Поля для FTS индексации */
  ftsFields: string[];

  /** Поля для векторной индексации */
  vectorFields: string[];

  /** Поля для фильтрации */
  filterFields: string[];

  /** Настройки FTS */
  ftsConfig?: {
    language?: string;
    stemming?: boolean;
    stopWords?: string[];
  };
}

/**
 * Статистика коллекции
 */
export interface CollectionStatistics {
  /** Общий размер текста в символах */
  totalTextLength: number;

  /** Средняя длина документа */
  averageDocumentLength: number;

  /** Самый длинный документ */
  maxDocumentLength: number;

  /** Количество уникальных слов */
  uniqueWordCount: number;

  /** Статистика эмбеддингов */
  embeddingStats?: {
    averageGenerationTime: number;
    cacheHitRate: number;
    lastGeneratedAt: Date;
  };
}

/**
 * Состояние эмбеддингов коллекции
 */
export interface CollectionEmbeddingStatus {
  /** Идентификатор коллекции */
  collectionId: string;

  /** Используемый провайдер */
  provider: string;

  /** Используемая модель */
  model: string;

  /** Размерность векторов */
  dimensions: number;

  /** Количество документов с эмбеддингами */
  documentsWithEmbeddings: number;

  /** Общее количество документов */
  totalDocuments: number;

  /** Готова ли коллекция к поиску */
  isReady: boolean;

  /** Прогресс генерации эмбеддингов (0-100) */
  generationProgress: number;

  /** Время последнего обновления */
  lastUpdated: Date;

  /** Текущие операции */
  activeOperations: EmbeddingOperationStatus[];

  /** Ошибки конфигурации */
  configErrors: string[];
}

/**
 * Настройки семантического поиска
 */
export interface SemanticSearchOptions {
  /** Максимальное количество результатов */
  limit?: number;

  /** Минимальный порог сходства (0-1) */
  similarityThreshold?: number;

  /** Включить ли векторы эмбеддингов в результаты */
  includeEmbeddings?: boolean;

  /** Фильтры для документов */
  filters?: Record<string, any>;

  /** Перевешивание результатов */
  reranking?: RerankingOptions;
}

/**
 * Настройки гибридного поиска
 */
export interface HybridSearchOptions extends SemanticSearchOptions {
  /** Вес текстового поиска (0-1) */
  textWeight?: number;

  /** Вес семантического поиска (0-1) */
  semanticWeight?: number;

  /** Метод слияния результатов */
  fusionMethod?: 'rrf' | 'weighted' | 'custom';

  /** Параметры RRF (Reciprocal Rank Fusion) */
  rrfParams?: {
    k?: number; // Константа для RRF (по умолчанию 60)
  };

  /** Настройки FTS поиска */
  ftsOptions?: {
    mode?: 'phrase' | 'terms' | 'prefix';
    boost?: Record<string, number>; // Boost для полей
  };
}

/**
 * Настройки переранжирования результатов
 */
export interface RerankingOptions {
  /** Тип переранжирования */
  type: 'cross-encoder' | 'custom' | 'none';

  /** Модель для переранжирования */
  model?: string;

  /** Максимальное количество документов для переранжирования */
  maxDocuments?: number;

  /** Дополнительные параметры */
  params?: Record<string, any>;
}

/**
 * Результат поиска с эмбеддингами
 */
export interface SearchResultWithEmbedding {
  /** Идентификатор документа */
  id: string;

  /** Заголовок документа */
  title?: string;

  /** Содержимое документа */
  content?: string;

  /** Метаданные документа */
  metadata?: Record<string, any>;

  /** Общий скор */
  score: number;

  /** Скор FTS поиска */
  ftsScore?: number;

  /** Скор векторного поиска */
  vectorScore?: number;

  /** Вектор эмбеддинга (если запрошен) */
  embedding?: Float32Array;

  /** Выделенные фрагменты текста */
  highlights?: string[];

  /** Тип соответствия */
  matchType?: 'exact' | 'fuzzy' | 'semantic' | 'hybrid';
}

/**
 * Конфигурация экспорта эмбеддингов
 */
export interface EmbeddingExportConfig {
  /** Включить ли векторы в экспорт */
  includeVectors?: boolean;

  /** Включить ли метаданные */
  includeMetadata?: boolean;

  /** Формат экспорта */
  format?: 'json' | 'csv' | 'parquet' | 'binary';

  /** Сжатие */
  compression?: 'none' | 'gzip' | 'brotli';

  /** Фильтры для экспорта */
  filters?: {
    collections?: string[];
    dateRange?: {
      from: Date;
      to: Date;
    };
    minSimilarity?: number;
  };
}

/**
 * Конфигурация импорта эмбеддингов
 */
export interface EmbeddingImportConfig {
  /** Стратегия обработки дубликатов */
  duplicateStrategy?: 'skip' | 'overwrite' | 'merge';

  /** Валидировать ли размерности */
  validateDimensions?: boolean;

  /** Автоматически создавать коллекции */
  autoCreateCollections?: boolean;

  /** Пакетный размер для импорта */
  batchSize?: number;

  /** Колбэк прогресса */
  onProgress?: (progress: number, processed: number, total: number) => void;
}

/**
 * Событие изменения эмбеддингов
 */
export interface EmbeddingChangeEvent {
  /** Тип события */
  type: 'generated' | 'cached' | 'error' | 'deleted';

  /** Идентификатор коллекции */
  collectionId: string;

  /** Идентификатор документа */
  documentId?: string;

  /** Данные события */
  data?: any;

  /** Время события */
  timestamp: Date;
}

/**
 * Настройки мониторинга эмбеддингов
 */
export interface EmbeddingMonitoringConfig {
  /** Включен ли мониторинг */
  enabled: boolean;

  /** Интервал сбора метрик в миллисекундах */
  metricsInterval: number;

  /** Максимальное количество событий в истории */
  maxEventHistory: number;

  /** Типы событий для отслеживания */
  trackedEvents: string[];

  /** Колбэки для уведомлений */
  callbacks?: {
    onError?: (error: Error) => void;
    onGenerated?: (result: EmbeddingResult) => void;
    onCacheHit?: (textHash: string) => void;
  };
}