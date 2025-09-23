/**
 * Web Worker для генерации эмбеддингов с использованием Transformers.js
 *
 * JavaScript версия воркера для непосредственного использования в браузере.
 * Компилируется из TypeScript версии или используется напрямую.
 */

// Используем динамический импорт для лучшей совместимости с Vite в Web Workers
let pipeline, env;
let transformersLoaded = false;

/**
 * Класс для управления моделью Transformers.js в воркере
 */
class TransformersWorkerManager {
  constructor() {
    this.pipeline = null;
    this.isInitialized = false;
    this.config = null;
    this.modelLoadTime = 0;
    this.totalInferences = 0;
    this.totalInferenceTime = 0;
    this.memoryPeak = 0;
    this.lastCleanup = new Date();
  }

  /**
   * Загрузка библиотеки Transformers.js
   */
  async loadTransformers() {
    if (!transformersLoaded) {
      try {
        const transformers = await import('@xenova/transformers');
        pipeline = transformers.pipeline;
        env = transformers.env;

        // Настройки среды Transformers.js
        env.allowLocalModels = false;
        env.allowRemoteModels = true;
        env.useBrowserCache = true;

        transformersLoaded = true;
        console.log('[TransformersWorker] Transformers.js загружен успешно');
      } catch (error) {
        throw new Error(`Не удалось загрузить @xenova/transformers: ${error.message}`);
      }
    }
  }

  /**
   * Инициализация модели
   */
  async initialize(config) {
    try {
      this.config = config;

      if (this.config.enableLogging) {
        console.log('[TransformersWorker] Начинается загрузка модели:', config.modelPath);
      }

      // Сначала загружаем библиотеку
      await this.loadTransformers();

      const startTime = Date.now();

      // Загрузка модели для генерации эмбеддингов
      this.pipeline = await pipeline(
        'feature-extraction',
        config.modelPath,
        {
          quantized: true,
          revision: 'main',
          progress_callback: this.config.enableLogging ? this.handleProgress.bind(this) : undefined
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
      throw new Error(`Ошибка инициализации модели: ${error.message}`);
    }
  }

  /**
   * Генерация эмбеддинга для одного текста
   */
  async generateEmbedding(text) {
    if (!this.isInitialized || !this.pipeline) {
      throw new Error('Модель не инициализирована');
    }

    const startTime = Date.now();

    try {
      // Генерируем эмбеддинг
      const result = await this.pipeline(text, {
        pooling: 'mean',
        normalize: true
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
      throw new Error(`Ошибка генерации эмбеддинга: ${error.message}`);
    }
  }

  /**
   * Пакетная генерация эмбеддингов
   */
  async generateBatch(texts) {
    if (!this.isInitialized || !this.pipeline) {
      throw new Error('Модель не инициализирована');
    }

    const startTime = Date.now();

    try {
      // Для оптимизации, обрабатываем тексты параллельно небольшими группами
      const batchSize = Math.min(8, texts.length);
      const results = [];

      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize);

        // Обрабатываем подгруппу параллельно
        const batchPromises = batch.map(text => this.pipeline(text, {
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
      throw new Error(`Ошибка пакетной генерации: ${error.message}`);
    }
  }

  /**
   * Очистка ресурсов
   */
  async cleanup() {
    try {
      if (this.pipeline) {
        this.pipeline = null;
      }

      this.isInitialized = false;
      this.lastCleanup = new Date();

      // Принудительная сборка мусора (если доступна)
      if (typeof gc !== 'undefined') {
        gc();
      }

      if (this.config?.enableLogging) {
        console.log('[TransformersWorker] Ресурсы очищены');
      }

    } catch (error) {
      throw new Error(`Ошибка при очистке: ${error.message}`);
    }
  }

  /**
   * Проверка здоровья воркера
   */
  async healthCheck() {
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
  extractEmbeddingVector(result) {
    // Transformers.js возвращает тензор, нужно извлечь данные
    let data;

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
  updateInferenceStats(inferenceTime, count = 1) {
    this.totalInferences += count;
    this.totalInferenceTime += inferenceTime;
  }

  /**
   * Обновление статистики использования памяти
   */
  updateMemoryUsage() {
    // Приблизительная оценка использования памяти
    if (performance.memory) {
      this.memoryPeak = Math.max(this.memoryPeak, performance.memory.usedJSHeapSize);
    }
  }

  /**
   * Получение доступной памяти
   */
  getAvailableMemory() {
    if (performance.memory) {
      return performance.memory.totalJSHeapSizeLimit - performance.memory.usedJSHeapSize;
    }
    return undefined;
  }

  /**
   * Обработчик прогресса загрузки модели
   */
  handleProgress(progress) {
    if (this.config?.enableLogging && progress.status) {
      console.log(`[TransformersWorker] ${progress.status}: ${progress.name || ''}`);
    }
  }
}

// Создаем экземпляр менеджера
const manager = new TransformersWorkerManager();

/**
 * Обработчик сообщений от основного потока
 */
self.onmessage = async (event) => {
  const { id, type, data } = event.data;
  const startTime = Date.now();

  try {
    let result;

    switch (type) {
      case 'initialize':
        await manager.initialize(data);
        result = { success: true };
        break;

      case 'generateEmbedding':
        const embedding = await manager.generateEmbedding(data.text);
        result = { embedding: Array.from(embedding) };
        break;

      case 'generateBatch':
        const embeddings = await manager.generateBatch(data.texts);
        result = {
          embeddings: embeddings.map(emb => Array.from(emb))
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
    const response = {
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
    const response = {
      id,
      success: false,
      error: error.message,
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

  const response = {
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

  const response = {
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