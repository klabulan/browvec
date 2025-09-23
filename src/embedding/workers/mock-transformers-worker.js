/**
 * Mock Web Worker для демонстрации TransformersProvider без реальной модели
 *
 * Этот воркер имитирует поведение настоящего Transformers.js воркера
 * для целей тестирования и демонстрации архитектуры.
 */

/**
 * Класс для имитации управления моделью Transformers.js
 */
class MockTransformersWorkerManager {
  constructor() {
    this.isInitialized = false;
    this.config = null;
    this.modelLoadTime = 0;
    this.totalInferences = 0;
    this.totalInferenceTime = 0;
    this.memoryPeak = 0;
    this.lastCleanup = new Date();
  }

  /**
   * Имитация инициализации модели
   */
  async initialize(config) {
    try {
      this.config = config;

      if (this.config.enableLogging) {
        console.log('[MockTransformersWorker] Имитация загрузки модели:', config.modelPath);
      }

      const startTime = Date.now();

      // Имитируем загрузку модели с реалистичной задержкой
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

      this.modelLoadTime = Date.now() - startTime;
      this.isInitialized = true;

      // Имитируем использование памяти
      this.memoryPeak = 25 * 1024 * 1024; // ~25MB

      if (this.config.enableLogging) {
        console.log(`[MockTransformersWorker] Модель "загружена" за ${this.modelLoadTime}ms`);
        console.log(`[MockTransformersWorker] Имитация использования памяти: ~${Math.round(this.memoryPeak / (1024*1024))}MB`);
      }

    } catch (error) {
      this.isInitialized = false;
      throw new Error(`Ошибка имитации инициализации модели: ${error.message}`);
    }
  }

  /**
   * Имитация генерации эмбеддинга для одного текста
   */
  async generateEmbedding(text) {
    if (!this.isInitialized) {
      throw new Error('Модель не инициализирована');
    }

    const startTime = Date.now();

    try {
      // Имитируем время обработки
      await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 200));

      // Генерируем случайный эмбеддинг 384-мерности
      const embedding = this.generateMockEmbedding(text);

      // Обновляем статистику
      const inferenceTime = Date.now() - startTime;
      this.updateInferenceStats(inferenceTime);
      this.updateMemoryUsage();

      if (this.config?.enableLogging) {
        console.log(`[MockTransformersWorker] Эмбеддинг "сгенерирован" за ${inferenceTime}ms, размерность: ${embedding.length}`);
      }

      return embedding;

    } catch (error) {
      throw new Error(`Ошибка имитации генерации эмбеддинга: ${error.message}`);
    }
  }

  /**
   * Имитация пакетной генерации эмбеддингов
   */
  async generateBatch(texts) {
    if (!this.isInitialized) {
      throw new Error('Модель не инициализирована');
    }

    const startTime = Date.now();

    try {
      // Имитируем время обработки батча
      const processingTime = texts.length * (30 + Math.random() * 100);
      await new Promise(resolve => setTimeout(resolve, processingTime));

      // Генерируем эмбеддинги для всех текстов
      const results = texts.map(text => this.generateMockEmbedding(text));

      // Обновляем статистику
      const totalInferenceTime = Date.now() - startTime;
      this.updateInferenceStats(totalInferenceTime, texts.length);
      this.updateMemoryUsage();

      if (this.config?.enableLogging) {
        console.log(`[MockTransformersWorker] Батч из ${texts.length} эмбеддингов "сгенерирован" за ${totalInferenceTime}ms`);
      }

      return results;

    } catch (error) {
      throw new Error(`Ошибка имитации пакетной генерации: ${error.message}`);
    }
  }

  /**
   * Имитация очистки ресурсов
   */
  async cleanup() {
    try {
      // Имитируем время очистки
      await new Promise(resolve => setTimeout(resolve, 100));

      this.isInitialized = false;
      this.lastCleanup = new Date();

      if (this.config?.enableLogging) {
        console.log('[MockTransformersWorker] Ресурсы "очищены"');
      }

    } catch (error) {
      throw new Error(`Ошибка при имитации очистки: ${error.message}`);
    }
  }

  /**
   * Имитация проверки здоровья воркера
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
      lastCleanup: this.lastCleanup.toISOString(),
      isMock: true // Указываем, что это мок-версия
    };
  }

  /**
   * Генерация случайного эмбеддинга на основе текста
   */
  generateMockEmbedding(text) {
    // Создаем детерминированный эмбеддинг на основе хэша текста
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash + text.charCodeAt(i)) & 0xffffffff;
    }

    // Используем хэш как seed для генерации
    const embedding = new Float32Array(384);
    let seed = hash;

    for (let i = 0; i < 384; i++) {
      // Простой PRNG на основе seed
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      embedding[i] = (seed / 0xffffffff - 0.5) * 2; // Нормализуем в [-1, 1]
    }

    // Нормализуем вектор (L2 нормализация)
    let magnitude = 0;
    for (let i = 0; i < 384; i++) {
      magnitude += embedding[i] * embedding[i];
    }
    magnitude = Math.sqrt(magnitude);

    for (let i = 0; i < 384; i++) {
      embedding[i] /= magnitude;
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
    // Имитируем небольшой рост памяти
    this.memoryPeak += Math.random() * 1024 * 1024; // До 1MB прироста

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
    return 100 * 1024 * 1024; // 100MB по умолчанию
  }
}

// Создаем экземпляр мок-менеджера
const manager = new MockTransformersWorkerManager();

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
        result = { success: true, mock: true };
        break;

      case 'generateEmbedding':
        const embedding = await manager.generateEmbedding(data.text);
        result = { embedding: Array.from(embedding), mock: true };
        break;

      case 'generateBatch':
        const embeddings = await manager.generateBatch(data.texts);
        result = {
          embeddings: embeddings.map(emb => Array.from(emb)),
          mock: true
        };
        break;

      case 'cleanup':
        await manager.cleanup();
        result = { success: true, mock: true };
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
        memoryUsage: performance.memory?.usedJSHeapSize,
        isMock: true
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
        memoryUsage: performance.memory?.usedJSHeapSize,
        isMock: true
      }
    };

    self.postMessage(response);
  }
};

/**
 * Обработчик ошибок воркера
 */
self.onerror = (error) => {
  console.error('[MockTransformersWorker] Глобальная ошибка воркера:', error);

  const response = {
    id: 'error',
    success: false,
    error: `Mock Worker error: ${error.message}`,
    metadata: {
      generationTime: 0,
      memoryUsage: performance.memory?.usedJSHeapSize,
      isMock: true
    }
  };

  self.postMessage(response);
};

// Уведомляем о готовности мок-воркера
console.log('[MockTransformersWorker] Mock worker initialized and ready');