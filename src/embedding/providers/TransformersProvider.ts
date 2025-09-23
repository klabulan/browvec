/**
 * Провайдер эмбеддингов на основе Transformers.js
 *
 * Реализует локальную генерацию эмбеддингов с использованием модели all-MiniLM-L6-v2
 * через Web Worker для неблокирующей производительности.
 *
 * Ключевые особенности:
 * - Фиксированная размерность 384 для модели all-MiniLM-L6-v2
 * - Ленивая загрузка модели (только при первом запросе)
 * - Работа в Web Worker для изоляции
 * - Базовая оптимизация производительности
 * - Управление памятью и очистка ресурсов
 */

import type { EmbeddingConfig } from '../types.js';
import { BaseEmbeddingProvider, type ProviderHealthStatus, type ProviderMetrics } from './BaseProvider.js';
import { ProviderError, ProviderInitializationError, ModelLoadError, TimeoutError, WorkerError } from '../errors.js';

/**
 * Конфигурация для Transformers.js провайдера
 */
export interface TransformersProviderConfig {
  /** Путь к скрипту воркера */
  workerScript?: string;

  /** Максимальное время загрузки модели в миллисекундах */
  modelLoadTimeout?: number;

  /** Максимальное время ожидания операции в миллисекундах */
  operationTimeout?: number;

  /** Размер батча для оптимизации */
  batchSize?: number;

  /** Включить ли детальное логирование */
  enableLogging?: boolean;

  /** Путь к модели (по умолчанию 'Xenova/all-MiniLM-L6-v2') */
  modelPath?: string;

  /** Кэширование модели в localStorage */
  enableModelCache?: boolean;
}

/**
 * Сообщения для взаимодействия с Web Worker
 */
interface WorkerMessage {
  id: string;
  type: 'initialize' | 'generateEmbedding' | 'generateBatch' | 'cleanup' | 'healthCheck';
  data?: any;
}

interface WorkerResponse {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    generationTime: number;
    modelSize?: number;
    memoryUsage?: number;
  };
}

/**
 * Провайдер эмбеддингов на основе Transformers.js
 *
 * Использует модель all-MiniLM-L6-v2 для генерации 384-мерных эмбеддингов.
 * Все операции выполняются в Web Worker для неблокирующей производительности.
 */
export class TransformersProvider extends BaseEmbeddingProvider {
  /** Экземпляр Web Worker */
  private worker?: Worker;

  /** Конфигурация провайдера */
  private config: TransformersProviderConfig;

  /** Очередь ожидающих запросов */
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
    timestamp: number;
    timeout?: NodeJS.Timeout;
  }>();

  /** Счетчик для уникальных идентификаторов сообщений */
  private messageCounter = 0;

  /** Статус инициализации */
  private initializationPromise?: Promise<void>;

  /** Метрики производительности */
  private performanceMetrics = {
    modelLoadTime: 0,
    averageBatchSize: 0,
    totalBatches: 0,
    memoryPeak: 0,
    lastCleanup: new Date()
  };

  constructor(config: TransformersProviderConfig = {}) {
    super(
      'transformers',
      384, // Фиксированная размерность для all-MiniLM-L6-v2
      config.batchSize || 16, // Оптимальный размер батча для локальной модели
      512 // Максимальная длина текста в токенах
    );

    this.config = {
      workerScript: '/src/embedding/workers/transformers-worker.js',
      modelLoadTimeout: 30000, // 30 секунд на загрузку модели
      operationTimeout: 10000,  // 10 секунд на операцию
      batchSize: 16,
      enableLogging: false,
      modelPath: 'Xenova/all-MiniLM-L6-v2',
      enableModelCache: true,
      ...config
    };
  }

  /**
   * Инициализация провайдера и загрузка модели
   */
  public async initialize(config: EmbeddingConfig): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._initialize(config);
    return this.initializationPromise;
  }

  private async _initialize(config: EmbeddingConfig): Promise<void> {
    try {
      this.config = { ...this.config, ...config };

      // Проверяем поддержку Web Workers
      if (!window.Worker) {
        throw new ProviderInitializationError(
          'Web Workers не поддерживаются в данном браузере',
          this.name,
          undefined,
          { userAgent: navigator.userAgent }
        );
      }

      // Создаем Web Worker
      await this.createWorker();

      // Инициализируем модель в воркере
      const startTime = Date.now();
      await this.sendMessage('initialize', {
        modelPath: this.config.modelPath,
        enableCache: this.config.enableModelCache,
        enableLogging: this.config.enableLogging
      }, this.config.modelLoadTimeout);

      this.performanceMetrics.modelLoadTime = Date.now() - startTime;
      this._isReady = true;

      if (this.config.enableLogging) {
        console.log(`[TransformersProvider] Модель загружена за ${this.performanceMetrics.modelLoadTime}ms`);
      }

    } catch (error) {
      this._isReady = false;

      if (error instanceof Error) {
        throw new ProviderInitializationError(
          `Ошибка инициализации Transformers.js провайдера: ${error.message}`,
          this.name,
          error,
          { config: this.config }
        );
      }

      throw new ProviderInitializationError(
        'Неизвестная ошибка при инициализации провайдера',
        this.name,
        undefined,
        { config: this.config }
      );
    }
  }

  /**
   * Создание и настройка Web Worker
   */
  private async createWorker(): Promise<void> {
    try {
      // Для разработки используем полный путь, для продакшна - относительный
      const workerUrl = this.config.workerScript?.startsWith('/')
        ? this.config.workerScript
        : `/src/embedding/workers/transformers-worker.js`;

      this.worker = new Worker(workerUrl, {
        type: 'module',
        name: 'TransformersEmbeddingWorker'
      });

      // Настраиваем обработчик сообщений
      this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        this.handleWorkerMessage(event.data);
      };

      // Обработчик ошибок воркера
      this.worker.onerror = (error) => {
        console.error('[TransformersProvider] Worker error:', error);
        this.handleWorkerError(new Error(`Worker error: ${error.message}`));
      };

      // Обработчик неожиданного завершения воркера
      this.worker.onmessageerror = (error) => {
        console.error('[TransformersProvider] Worker message error:', error);
        this.handleWorkerError(new Error('Worker message parsing error'));
      };

    } catch (error) {
      throw new WorkerError(
        `Не удалось создать Web Worker: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'create',
        undefined,
        { workerScript: this.config.workerScript }
      );
    }
  }

  /**
   * Генерация эмбеддинга для одного текста
   */
  public async generateEmbedding(text: string): Promise<Float32Array> {
    this.validateText(text);

    if (!this._isReady) {
      throw new ProviderError(
        'Провайдер не инициализирован. Вызовите initialize() перед использованием.',
        this.name,
        'NOT_INITIALIZED'
      );
    }

    const startTime = Date.now();

    try {
      const response = await this.sendMessage('generateEmbedding', {
        text: text.trim()
      }, this.config.operationTimeout);

      const generationTime = Date.now() - startTime;
      this.updateMetrics(generationTime, 1, false);

      // Убеждаемся, что получили Float32Array правильной размерности
      const embedding = new Float32Array(response.embedding);
      if (embedding.length !== this.dimensions) {
        throw new ProviderError(
          `Неверная размерность эмбеддинга: получено ${embedding.length}, ожидалось ${this.dimensions}`,
          this.name,
          'INVALID_DIMENSIONS'
        );
      }

      return embedding;

    } catch (error) {
      const generationTime = Date.now() - startTime;
      this.updateMetrics(generationTime, 1, true);

      if (error instanceof Error) {
        throw error;
      }

      throw new ProviderError(
        `Ошибка генерации эмбеддинга: ${error}`,
        this.name,
        'GENERATION_ERROR',
        undefined,
        { text: text.substring(0, 100) + '...' }
      );
    }
  }

  /**
   * Пакетная генерация эмбеддингов
   */
  public async generateBatch(texts: string[]): Promise<Float32Array[]> {
    this.validateBatch(texts);

    if (!this._isReady) {
      throw new ProviderError(
        'Провайдер не инициализирован. Вызовите initialize() перед использованием.',
        this.name,
        'NOT_INITIALIZED'
      );
    }

    const startTime = Date.now();

    try {
      // Для больших батчей разбиваем на части
      const results: Float32Array[] = [];
      const chunkSize = this.maxBatchSize;

      for (let i = 0; i < texts.length; i += chunkSize) {
        const chunk = texts.slice(i, i + chunkSize);
        const chunkResults = await this.processBatchChunk(chunk);
        results.push(...chunkResults);
      }

      const generationTime = Date.now() - startTime;
      this.updateMetrics(generationTime, texts.length, false);

      // Обновляем метрики батчевой обработки
      this.performanceMetrics.totalBatches += 1;
      this.performanceMetrics.averageBatchSize =
        (this.performanceMetrics.averageBatchSize * (this.performanceMetrics.totalBatches - 1) + texts.length)
        / this.performanceMetrics.totalBatches;

      return results;

    } catch (error) {
      const generationTime = Date.now() - startTime;
      this.updateMetrics(generationTime, texts.length, true);

      if (error instanceof Error) {
        throw error;
      }

      throw new ProviderError(
        `Ошибка пакетной генерации эмбеддингов: ${error}`,
        this.name,
        'BATCH_GENERATION_ERROR',
        undefined,
        { batchSize: texts.length }
      );
    }
  }

  /**
   * Обработка части батча
   */
  private async processBatchChunk(texts: string[]): Promise<Float32Array[]> {
    const response = await this.sendMessage('generateBatch', {
      texts: texts.map(t => t.trim())
    }, this.config.operationTimeout! * Math.ceil(texts.length / 4)); // Увеличиваем таймаут для батчей

    return response.embeddings.map((embData: number[] | Float32Array) => {
      const embedding = new Float32Array(embData);
      if (embedding.length !== this.dimensions) {
        throw new ProviderError(
          `Неверная размерность эмбеддинга: получено ${embedding.length}, ожидалось ${this.dimensions}`,
          this.name,
          'INVALID_DIMENSIONS'
        );
      }
      return embedding;
    });
  }

  /**
   * Очистка ресурсов и завершение работы провайдера
   */
  public async cleanup(): Promise<void> {
    try {
      // Отменяем все ожидающие запросы
      for (const [id, request] of this.pendingRequests) {
        if (request.timeout) {
          clearTimeout(request.timeout);
        }
        request.reject(new Error('Provider cleanup - request cancelled'));
      }
      this.pendingRequests.clear();

      // Очищаем ресурсы в воркере
      if (this.worker && this._isReady) {
        try {
          await this.sendMessage('cleanup', {}, 5000);
        } catch (error) {
          // Игнорируем ошибки при очистке, продолжаем завершение
          console.warn('[TransformersProvider] Cleanup warning:', error);
        }
      }

      // Завершаем воркер
      if (this.worker) {
        this.worker.terminate();
        this.worker = undefined;
      }

      this._isReady = false;
      this.initializationPromise = undefined;
      this.performanceMetrics.lastCleanup = new Date();

      if (this.config.enableLogging) {
        console.log('[TransformersProvider] Провайдер очищен');
      }

    } catch (error) {
      throw new ProviderError(
        `Ошибка при очистке провайдера: ${error instanceof Error ? error.message : 'Unknown error'}`,
        this.name,
        'CLEANUP_ERROR'
      );
    }
  }

  /**
   * Проверка здоровья провайдера
   */
  public async healthCheck(): Promise<ProviderHealthStatus> {
    try {
      if (!this.worker || !this._isReady) {
        return {
          isHealthy: false,
          status: 'error',
          details: 'Провайдер не инициализирован или воркер недоступен',
          connectionStatus: 'disconnected'
        };
      }

      // Проверяем отзывчивость воркера
      const startTime = Date.now();
      const response = await this.sendMessage('healthCheck', {}, 5000);
      const responseTime = Date.now() - startTime;

      return {
        isHealthy: true,
        lastSuccessfulOperation: new Date(),
        status: 'ready',
        details: `Воркер отвечает за ${responseTime}ms`,
        availableMemory: response.memoryInfo?.availableMemory,
        connectionStatus: 'connected'
      };

    } catch (error) {
      return {
        isHealthy: false,
        status: 'degraded',
        details: `Ошибка проверки здоровья: ${error instanceof Error ? error.message : 'Unknown error'}`,
        connectionStatus: 'limited'
      };
    }
  }

  /**
   * Получение расширенных метрик производительности
   */
  public getMetrics(): ProviderMetrics {
    const baseMetrics = super.getMetrics();

    return {
      ...baseMetrics,
      memoryUsage: this.performanceMetrics.memoryPeak,
      apiRequestCount: undefined, // Не применимо для локального провайдера
      rateLimitStatus: undefined  // Не применимо для локального провайдера
    };
  }

  /**
   * Получение специфичных для Transformers.js метрик
   */
  public getTransformersMetrics() {
    return {
      ...this.performanceMetrics,
      isModelLoaded: this._isReady,
      workerActive: !!this.worker,
      pendingRequests: this.pendingRequests.size
    };
  }

  /**
   * Отправка сообщения воркеру с обработкой таймаутов
   */
  private async sendMessage(type: WorkerMessage['type'], data: any, timeoutMs?: number): Promise<any> {
    if (!this.worker) {
      throw new WorkerError('Web Worker не создан', type);
    }

    return new Promise((resolve, reject) => {
      const id = `${type}_${++this.messageCounter}_${Date.now()}`;
      const timeout = timeoutMs || this.config.operationTimeout || 10000;

      // Настраиваем таймаут
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new TimeoutError(
          `Операция ${type} превысила таймаут ${timeout}ms`,
          timeout,
          type
        ));
      }, timeout);

      // Сохраняем запрос
      this.pendingRequests.set(id, {
        resolve,
        reject,
        timestamp: Date.now(),
        timeout: timeoutHandle
      });

      // Отправляем сообщение
      const message: WorkerMessage = { id, type, data };
      this.worker!.postMessage(message);
    });
  }

  /**
   * Обработка сообщений от воркера
   */
  private handleWorkerMessage(response: WorkerResponse): void {
    const request = this.pendingRequests.get(response.id);
    if (!request) {
      console.warn(`[TransformersProvider] Получен ответ для неизвестного запроса: ${response.id}`);
      return;
    }

    // Очищаем таймаут и удаляем запрос
    if (request.timeout) {
      clearTimeout(request.timeout);
    }
    this.pendingRequests.delete(response.id);

    // Обновляем метрики памяти
    if (response.metadata?.memoryUsage) {
      this.performanceMetrics.memoryPeak = Math.max(
        this.performanceMetrics.memoryPeak,
        response.metadata.memoryUsage
      );
    }

    // Обрабатываем ответ
    if (response.success) {
      request.resolve(response.data);
    } else {
      const error = new ProviderError(
        response.error || 'Неизвестная ошибка воркера',
        this.name,
        'WORKER_ERROR'
      );
      request.reject(error);
    }
  }

  /**
   * Обработка ошибок воркера
   */
  private handleWorkerError(error: Error): void {
    // Отклоняем все ожидающие запросы
    for (const [id, request] of this.pendingRequests) {
      if (request.timeout) {
        clearTimeout(request.timeout);
      }
      request.reject(new WorkerError(
        `Worker error: ${error.message}`,
        'worker_error',
        undefined,
        { originalError: error.message }
      ));
    }
    this.pendingRequests.clear();

    this._isReady = false;
  }
}

/**
 * Фабричная функция для создания TransformersProvider
 */
export function createTransformersProvider(config?: TransformersProviderConfig): TransformersProvider {
  return new TransformersProvider(config);
}

/**
 * Проверка поддержки Transformers.js в текущей среде
 */
export function isTransformersSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof Worker !== 'undefined' &&
    typeof SharedArrayBuffer !== 'undefined' &&
    typeof WebAssembly !== 'undefined'
  );
}

/**
 * Получение информации о модели all-MiniLM-L6-v2
 */
export function getModelInfo() {
  return {
    id: 'Xenova/all-MiniLM-L6-v2',
    name: 'all-MiniLM-L6-v2',
    description: 'Sentence-BERT model for generating 384-dimensional embeddings',
    dimensions: 384,
    maxInputLength: 512,
    languages: ['en', 'multilingual'],
    useCases: ['sentence similarity', 'semantic search', 'clustering'],
    modelSize: 23_000_000, // ~23MB
    provider: 'transformers'
  };
}