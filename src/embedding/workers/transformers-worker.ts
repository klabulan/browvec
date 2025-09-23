/**
 * Web Worker для генерации эмбеддингов с использованием Transformers.js
 *
 * Обрабатывает модель all-MiniLM-L6-v2 в изолированном контексте воркера
 * для предотвращения блокировки основного потока UI.
 *
 * Особенности:
 * - Ленивая загрузка модели при первом запросе
 * - Оптимизированная пакетная обработка
 * - Управление памятью и очистка ресурсов
 * - Подробная отчетность по производительности
 */

// Импорт Transformers.js
import { pipeline, Pipeline, env } from '@xenova/transformers';

/**
 * Интерфейсы для сообщений воркера
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
 * Конфигурация воркера
 */
interface WorkerConfig {
  modelPath: string;
  enableCache: boolean;
  enableLogging: boolean;
}

/**
 * Класс для управления моделью Transformers.js в воркере
 */
class TransformersWorkerManager {
  private pipeline?: Pipeline;
  private isInitialized = false;
  private config?: WorkerConfig;
  private modelLoadTime = 0;
  private totalInferences = 0;
  private totalInferenceTime = 0;
  private memoryPeak = 0;
  private lastCleanup = new Date();

  constructor() {
    // Настройки среды Transformers.js
    env.allowLocalModels = false; // Принудительно используем модели из HuggingFace Hub
    env.allowRemoteModels = true;
    env.useBrowserCache = true;   // Включаем кэширование в браузере
  }

  /**
   * Инициализация модели
   */
  async initialize(config: WorkerConfig): Promise<void> {
    try {
      this.config = config;

      if (this.config.enableLogging) {
        console.log('[TransformersWorker] Начинается загрузка модели:', config.modelPath);
      }

      const startTime = Date.now();

      // Загрузка модели для генерации эмбеддингов
      this.pipeline = await pipeline(
        'feature-extraction',
        config.modelPath,
        {
          // Настройки для оптимизации
          quantized: true,      // Используем квантизованную модель для экономии памяти
          revision: 'main',     // Используем основную ветку модели
          progress_callback: this.config.enableLogging ? this.handleProgress : undefined
        }
      );

      this.modelLoadTime = Date.now() - startTime;
      this.isInitialized = true;

      // Отслеживаем использование памяти
      this.updateMemoryUsage();

      if (this.config.enableLogging) {
        console.log(`[TransformersWorker] Модель загружена за ${this.modelLoadTime}ms`);
        console.log(`[TransformersWorker] Использование памяти: ~${Math.round(this.memoryPeak / (1024*1024))}MB`);
      }

    } catch (error) {
      this.isInitialized = false;
      throw new Error(`Ошибка инициализации модели: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Генерация эмбеддинга для одного текста
   */
  async generateEmbedding(text: string): Promise<Float32Array> {
    if (!this.isInitialized || !this.pipeline) {
      throw new Error('Модель не инициализирована');
    }

    const startTime = Date.now();

    try {
      // Генерируем эмбеддинг
      const result = await this.pipeline(text, {
        pooling: 'mean',      // Усреднение токенов
        normalize: true       // Нормализация вектора
      });

      // Конвертируем результат в Float32Array
      const embedding = this.extractEmbeddingVector(result);

      // Обновляем статистику
      const inferenceTime = Date.now() - startTime;
      this.updateInferenceStats(inferenceTime);
      this.updateMemoryUsage();

      if (this.config?.enableLogging) {
        console.log(`[TransformersWorker] Эмбеддинг сгенерирован за ${inferenceTime}ms, размерность: ${embedding.length}`);
      }

      return embedding;

    } catch (error) {
      throw new Error(`Ошибка генерации эмбеддинга: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Пакетная генерация эмбеддингов
   */
  async generateBatch(texts: string[]): Promise<Float32Array[]> {
    if (!this.isInitialized || !this.pipeline) {
      throw new Error('Модель не инициализирована');
    }

    const startTime = Date.now();

    try {
      // Для оптимизации, обрабатываем тексты параллельно небольшими группами
      const batchSize = Math.min(8, texts.length); // Оптимальный размер подгруппы
      const results: Float32Array[] = [];

      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);

        // Обрабатываем подгруппу параллельно
        const batchPromises = batch.map(text => this.pipeline!(text, {
          pooling: 'mean',
          normalize: true
        }));

        const batchResults = await Promise.all(batchPromises);

        // Конвертируем результаты
        for (const result of batchResults) {
          results.push(this.extractEmbeddingVector(result));
        }
      }

      // Обновляем статистику
      const totalInferenceTime = Date.now() - startTime;
      this.updateInferenceStats(totalInferenceTime, texts.length);
      this.updateMemoryUsage();

      if (this.config?.enableLogging) {
        console.log(`[TransformersWorker] Батч из ${texts.length} эмбеддингов сгенерирован за ${totalInferenceTime}ms`);
      }

      return results;

    } catch (error) {
      throw new Error(`Ошибка пакетной генерации: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Очистка ресурсов
   */
  async cleanup(): Promise<void> {
    try {
      if (this.pipeline) {
        // Для Transformers.js нет явного метода dispose,
        // но мы можем очистить ссылки для сборки мусора
        this.pipeline = undefined;
      }

      this.isInitialized = false;
      this.lastCleanup = new Date();

      // Принудительная сборка мусора (если доступна)
      if (global.gc) {
        global.gc();
      }

      if (this.config?.enableLogging) {
        console.log('[TransformersWorker] Ресурсы очищены');
      }

    } catch (error) {
      throw new Error(`Ошибка при очистке: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Проверка здоровья воркера
   */
  async healthCheck(): Promise<any> {
    return {
      isInitialized: this.isInitialized,
      modelLoadTime: this.modelLoadTime,
      totalInferences: this.totalInferences,
      averageInferenceTime: this.totalInferences > 0 ? this.totalInferenceTime / this.totalInferences : 0,
      memoryInfo: {
        peakUsage: this.memoryPeak,
        availableMemory: this.getAvailableMemory()
      },
      lastCleanup: this.lastCleanup.toISOString()
    };
  }

  /**
   * Извлечение вектора эмбеддинга из результата модели
   */
  private extractEmbeddingVector(result: any): Float32Array {
    // Transformers.js возвращает тензор, нужно извлечь данные
    let data: number[] | Float32Array;

    if (result && typeof result.data !== 'undefined') {
      // Новый формат Transformers.js
      data = result.data;
    } else if (Array.isArray(result)) {
      // Если результат уже массив
      data = result;
    } else if (result && result.tolist) {
      // Если есть метод tolist (старый формат)
      data = result.tolist();
    } else {
      throw new Error('Неожиданный формат результата от модели');
    }

    // Конвертируем в Float32Array
    const embedding = new Float32Array(data);

    // Проверяем размерность (должна быть 384 для all-MiniLM-L6-v2)
    if (embedding.length !== 384) {
      throw new Error(`Неожиданная размерность эмбеддинга: ${embedding.length}, ожидалось 384`);
    }

    return embedding;
  }

  /**
   * Обновление статистики инференса
   */
  private updateInferenceStats(inferenceTime: number, count: number = 1): void {
    this.totalInferences += count;
    this.totalInferenceTime += inferenceTime;
  }

  /**
   * Обновление статистики использования памяти
   */
  private updateMemoryUsage(): void {
    // Приблизительная оценка использования памяти
    if (performance.memory) {
      this.memoryPeak = Math.max(this.memoryPeak, performance.memory.usedJSHeapSize);
    }
  }

  /**
   * Получение доступной памяти
   */
  private getAvailableMemory(): number | undefined {
    if (performance.memory) {
      return performance.memory.totalJSHeapSizeLimit - performance.memory.usedJSHeapSize;
    }
    return undefined;
  }

  /**
   * Обработчик прогресса загрузки модели
   */
  private handleProgress = (progress: any): void => {
    if (this.config?.enableLogging && progress.status) {
      console.log(`[TransformersWorker] ${progress.status}: ${progress.name || ''}`);
    }
  };
}

// Создаем экземпляр менеджера
const manager = new TransformersWorkerManager();

/**
 * Обработчик сообщений от основного потока
 */
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { id, type, data } = event.data;
  const startTime = Date.now();

  try {
    let result: any;

    switch (type) {
      case 'initialize':
        await manager.initialize(data);
        result = { success: true };
        break;

      case 'generateEmbedding':
        const embedding = await manager.generateEmbedding(data.text);
        result = { embedding: Array.from(embedding) }; // Конвертируем для передачи
        break;

      case 'generateBatch':
        const embeddings = await manager.generateBatch(data.texts);
        result = {
          embeddings: embeddings.map(emb => Array.from(emb)) // Конвертируем для передачи
        };
        break;

      case 'cleanup':
        await manager.cleanup();
        result = { success: true };
        break;

      case 'healthCheck':
        result = await manager.healthCheck();
        break;

      default:
        throw new Error(`Неизвестный тип сообщения: ${type}`);
    }

    // Отправляем успешный ответ
    const response: WorkerResponse = {
      id,
      success: true,
      data: result,
      metadata: {
        generationTime: Date.now() - startTime,
        memoryUsage: performance.memory?.usedJSHeapSize
      }
    };

    self.postMessage(response);

  } catch (error) {
    // Отправляем ошибку
    const response: WorkerResponse = {
      id,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      metadata: {
        generationTime: Date.now() - startTime,
        memoryUsage: performance.memory?.usedJSHeapSize
      }
    };

    self.postMessage(response);
  }
};

/**
 * Обработчик ошибок воркера
 */
self.onerror = (error) => {
  console.error('[TransformersWorker] Глобальная ошибка воркера:', error);

  // Отправляем уведомление об ошибке
  const response: WorkerResponse = {
    id: 'error',
    success: false,
    error: `Worker error: ${error.message}`,
    metadata: {
      generationTime: 0,
      memoryUsage: performance.memory?.usedJSHeapSize
    }
  };

  self.postMessage(response);
};

/**
 * Обработчик неперехваченных отклонений промисов
 */
self.addEventListener('unhandledrejection', (event) => {
  console.error('[TransformersWorker] Неперехваченное отклонение промиса:', event.reason);

  const response: WorkerResponse = {
    id: 'rejection',
    success: false,
    error: `Unhandled promise rejection: ${event.reason}`,
    metadata: {
      generationTime: 0,
      memoryUsage: performance.memory?.usedJSHeapSize
    }
  };

  self.postMessage(response);
});

// Экспорт для TypeScript (не используется в воркере, но нужно для типизации)
export type { WorkerMessage, WorkerResponse };