/**
 * Тесты для TransformersProvider - провайдера эмбеддингов на основе Transformers.js
 *
 * Эти тесты проверяют основную функциональность провайдера, включая
 * инициализацию, генерацию эмбеддингов, работу с Web Worker и обработку ошибок.
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { TransformersProvider, createTransformersProvider, isTransformersSupported, getModelInfo } from '../../../src/embedding/providers/TransformersProvider.js';
import type { EmbeddingConfig } from '../../../src/embedding/types.js';
import { ProviderError, ProviderInitializationError, WorkerError, TimeoutError } from '../../../src/embedding/errors.js';

// Мокаем Web Worker для тестов
class MockWorker {
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public onerror: ((error: ErrorEvent) => void) | null = null;
  public onmessageerror: ((error: MessageEvent) => void) | null = null;

  private messageHandler: ((data: any) => void) | null = null;

  constructor(scriptURL: string, options?: WorkerOptions) {
    // Эмулируем создание воркера
  }

  postMessage(message: any) {
    // Эмулируем отправку сообщения в воркер
    setTimeout(() => {
      if (this.messageHandler) {
        this.messageHandler(message);
      }
    }, 10);
  }

  terminate() {
    // Эмулируем завершение воркера
  }

  // Методы для тестирования
  setMessageHandler(handler: (data: any) => void) {
    this.messageHandler = handler;
  }

  simulateMessage(response: any) {
    if (this.onmessage) {
      this.onmessage({ data: response } as MessageEvent);
    }
  }

  simulateError(error: string) {
    if (this.onerror) {
      this.onerror({ message: error } as ErrorEvent);
    }
  }
}

// Мокаем глобальные объекты
const mockWorkerConstructor = vi.fn().mockImplementation((scriptURL, options) => {
  return new MockWorker(scriptURL, options);
});

// Создаем мок window объекта для Node.js среды
const mockWindow = {
  Worker: mockWorkerConstructor,
  SharedArrayBuffer: function SharedArrayBuffer() {},
  WebAssembly: { validate: vi.fn().mockReturnValue(true) },
  navigator: { userAgent: 'test-agent' }
};

// Устанавливаем глобальные мок объекты
global.window = mockWindow as any;
global.Worker = mockWorkerConstructor as any;
global.SharedArrayBuffer = mockWindow.SharedArrayBuffer as any;
global.WebAssembly = mockWindow.WebAssembly as any;
global.navigator = mockWindow.navigator as any;

describe('TransformersProvider', () => {
  let provider: TransformersProvider;
  let mockWorker: MockWorker;

  const testConfig: EmbeddingConfig = {
    dimensions: 384,
    maxTokens: 512,
    provider: 'transformers'
  };

  beforeEach(() => {
    vi.clearAllMocks();

    provider = new TransformersProvider({
      enableLogging: false,
      modelLoadTimeout: 1000,
      operationTimeout: 500
    });

    // Получаем ссылку на созданный мок воркер
    mockWorkerConstructor.mockImplementation((scriptURL, options) => {
      mockWorker = new MockWorker(scriptURL, options);

      // Настраиваем автоматические ответы
      mockWorker.setMessageHandler((message) => {
        setTimeout(() => {
          switch (message.type) {
            case 'initialize':
              mockWorker.simulateMessage({
                id: message.id,
                success: true,
                data: { modelLoaded: true },
                metadata: { generationTime: 100, modelSize: 23000000 }
              });
              break;
            case 'generateEmbedding':
              mockWorker.simulateMessage({
                id: message.id,
                success: true,
                data: { embedding: new Float32Array(384).fill(0.1) },
                metadata: { generationTime: 50, memoryUsage: 25000000 }
              });
              break;
            case 'generateBatch':
              const embeddings = message.data.texts.map(() => new Float32Array(384).fill(0.1));
              mockWorker.simulateMessage({
                id: message.id,
                success: true,
                data: { embeddings },
                metadata: { generationTime: 100 * message.data.texts.length }
              });
              break;
            case 'healthCheck':
              mockWorker.simulateMessage({
                id: message.id,
                success: true,
                data: { status: 'healthy', memoryInfo: { availableMemory: 100000000 } }
              });
              break;
            case 'cleanup':
              mockWorker.simulateMessage({
                id: message.id,
                success: true,
                data: { cleaned: true }
              });
              break;
            default:
              mockWorker.simulateMessage({
                id: message.id,
                success: false,
                error: `Unknown message type: ${message.type}`
              });
          }
        }, 10);
      });

      return mockWorker;
    });
  });

  afterEach(async () => {
    if (provider) {
      try {
        await provider.cleanup();
      } catch (error) {
        // Игнорируем ошибки при очистке в тестах
      }
    }
  });

  describe('Конструктор и конфигурация', () => {
    it('должен создаваться с конфигурацией по умолчанию', () => {
      const provider = new TransformersProvider();

      expect(provider.name).toBe('transformers');
      expect(provider.dimensions).toBe(384);
      expect(provider.maxBatchSize).toBe(16);
      expect(provider.isReady).toBe(false);
    });

    it('должен применять пользовательскую конфигурацию', () => {
      const provider = new TransformersProvider({
        batchSize: 32,
        operationTimeout: 5000,
        enableLogging: true,
        modelPath: 'custom/model'
      });

      expect(provider.maxBatchSize).toBe(32);
    });

    it('должен сообщать о поддержке браузером', () => {
      expect(isTransformersSupported()).toBe(true);
    });

    it('должен предоставлять информацию о модели', () => {
      const modelInfo = getModelInfo();

      expect(modelInfo.id).toBe('Xenova/all-MiniLM-L6-v2');
      expect(modelInfo.dimensions).toBe(384);
      expect(modelInfo.provider).toBe('transformers');
      expect(modelInfo.modelSize).toBe(23_000_000);
    });
  });

  describe('Инициализация', () => {
    it('должен успешно инициализироваться', async () => {
      await provider.initialize(testConfig);

      expect(provider.isReady).toBe(true);
      expect(mockWorkerConstructor).toHaveBeenCalledWith(
        expect.stringContaining('transformers-worker.js'),
        expect.objectContaining({ type: 'module' })
      );
    });

    it('должен использовать единичную инициализацию', async () => {
      const promise1 = provider.initialize(testConfig);
      const promise2 = provider.initialize(testConfig);

      await Promise.all([promise1, promise2]);

      expect(mockWorkerConstructor).toHaveBeenCalledTimes(1);
      expect(provider.isReady).toBe(true);
    });

    it('должен выбрасывать ошибку при отсутствии поддержки Web Workers', async () => {
      // Временно убираем поддержку Workers
      const originalWorker = (window as any).Worker;
      delete (window as any).Worker;

      const provider = new TransformersProvider();

      await expect(provider.initialize(testConfig))
        .rejects
        .toThrow(ProviderInitializationError);

      // Восстанавливаем Worker
      (window as any).Worker = originalWorker;
    });

    it('должен обрабатывать ошибки инициализации воркера', async () => {
      mockWorkerConstructor.mockImplementation(() => {
        throw new Error('Failed to create worker');
      });

      await expect(provider.initialize(testConfig))
        .rejects
        .toThrow(ProviderInitializationError);
    });

    it('должен обрабатывать таймаут инициализации', async () => {
      const provider = new TransformersProvider({ modelLoadTimeout: 50 });

      // Мокаем воркер, который не отвечает
      mockWorkerConstructor.mockImplementation(() => {
        const worker = new MockWorker('test', {});
        worker.setMessageHandler(() => {
          // Не отвечаем на сообщения
        });
        return worker;
      });

      await expect(provider.initialize(testConfig))
        .rejects
        .toThrow('таймаут');
    }, 1000);
  });

  describe('Генерация эмбеддингов', () => {
    beforeEach(async () => {
      await provider.initialize(testConfig);
    });

    it('должен генерировать эмбеддинг для одного текста', async () => {
      const text = 'Test text for embedding';
      const embedding = await provider.generateEmbedding(text);

      expect(embedding).toBeInstanceOf(Float32Array);
      expect(embedding.length).toBe(384);
      expect(embedding[0]).toBeCloseTo(0.1, 5); // Наш мок возвращает массив заполненный 0.1
    });

    it('должен проверять валидность текста', async () => {
      await expect(provider.generateEmbedding(''))
        .rejects
        .toThrow('Input text cannot be empty');

      await expect(provider.generateEmbedding('   '))
        .rejects
        .toThrow('Input text cannot be empty');
    });

    it('должен проверять состояние инициализации', async () => {
      const uninitProvider = new TransformersProvider();

      await expect(uninitProvider.generateEmbedding('test'))
        .rejects
        .toThrow('не инициализирован');
    });

    it('должен обрабатывать ошибки генерации', async () => {
      // Настраиваем воркер на возврат ошибки
      mockWorker.setMessageHandler((message) => {
        if (message.type === 'generateEmbedding') {
          mockWorker.simulateMessage({
            id: message.id,
            success: false,
            error: 'Model inference failed'
          });
        }
      });

      await expect(provider.generateEmbedding('test'))
        .rejects
        .toThrow(ProviderError);
    });

    it('должен проверять размерность полученного эмбеддинга', async () => {
      // Настраиваем воркер на возврат неверной размерности
      mockWorker.setMessageHandler((message) => {
        if (message.type === 'generateEmbedding') {
          mockWorker.simulateMessage({
            id: message.id,
            success: true,
            data: { embedding: new Float32Array(256) }, // Неверная размерность
            metadata: { generationTime: 50 }
          });
        }
      });

      await expect(provider.generateEmbedding('test'))
        .rejects
        .toThrow('Неверная размерность эмбеддинга');
    });
  });

  describe('Пакетная генерация', () => {
    beforeEach(async () => {
      await provider.initialize(testConfig);
    });

    it('должен генерировать эмбеддинги для батча текстов', async () => {
      const texts = ['First text', 'Second text', 'Third text'];
      const embeddings = await provider.generateBatch(texts);

      expect(embeddings).toHaveLength(3);
      embeddings.forEach(embedding => {
        expect(embedding).toBeInstanceOf(Float32Array);
        expect(embedding.length).toBe(384);
      });
    });

    it('должен обрабатывать батчи в пределах лимита', async () => {
      const texts = Array.from({ length: 15 }, (_, i) => `Text ${i}`);
      const embeddings = await provider.generateBatch(texts);

      expect(embeddings).toHaveLength(15);
    });

    it('должен проверять валидность батча', async () => {
      await expect(provider.generateBatch([]))
        .rejects
        .toThrow('Batch cannot be empty');

      const largeBatch = Array.from({ length: 200 }, (_, i) => `Text ${i}`);
      await expect(provider.generateBatch(largeBatch))
        .rejects
        .toThrow('exceeds maximum');
    });

    it('должен обновлять метрики батчевой обработки', async () => {
      const texts = ['Text 1', 'Text 2', 'Text 3'];
      await provider.generateBatch(texts);

      const metrics = provider.getTransformersMetrics();
      expect(metrics.totalBatches).toBe(1);
      expect(metrics.averageBatchSize).toBe(3);
    });
  });

  describe('Управление ресурсами', () => {
    beforeEach(async () => {
      await provider.initialize(testConfig);
    });

    it('должен очищать ресурсы при вызове cleanup', async () => {
      expect(provider.isReady).toBe(true);

      await provider.cleanup();

      expect(provider.isReady).toBe(false);
    });

    it('должен обрабатывать множественные вызовы cleanup', async () => {
      await provider.cleanup();
      await expect(provider.cleanup()).resolves.not.toThrow();
    });

    it('должен отменять ожидающие запросы при cleanup', async () => {
      // Настраиваем воркер на задержку ответа
      mockWorker.setMessageHandler(() => {
        // Не отвечаем сразу
      });

      const embeddingPromise = provider.generateEmbedding('test');

      // Вызываем cleanup до завершения запроса
      await provider.cleanup();

      await expect(embeddingPromise)
        .rejects
        .toThrow('request cancelled');
    });
  });

  describe('Проверка здоровья', () => {
    it('должен сообщать о неготовности неинициализированного провайдера', async () => {
      const health = await provider.healthCheck();

      expect(health.isHealthy).toBe(false);
      expect(health.status).toBe('error');
      expect(health.connectionStatus).toBe('disconnected');
    });

    it('должен сообщать о готовности инициализированного провайдера', async () => {
      await provider.initialize(testConfig);

      const health = await provider.healthCheck();

      expect(health.isHealthy).toBe(true);
      expect(health.status).toBe('ready');
      expect(health.connectionStatus).toBe('connected');
    });

    it('должен обрабатывать ошибки проверки здоровья', async () => {
      await provider.initialize(testConfig);

      // Настраиваем воркер на ошибку
      mockWorker.setMessageHandler((message) => {
        if (message.type === 'healthCheck') {
          mockWorker.simulateError('Worker health check failed');
        }
      });

      const health = await provider.healthCheck();

      expect(health.isHealthy).toBe(false);
      expect(health.status).toBe('degraded');
    });
  });

  describe('Метрики производительности', () => {
    beforeEach(async () => {
      await provider.initialize(testConfig);
    });

    it('должен отслеживать базовые метрики', async () => {
      await provider.generateEmbedding('test');

      const metrics = provider.getMetrics();

      expect(metrics.totalRequests).toBeDefined();
      expect(metrics.successfulRequests).toBeDefined();
      expect(metrics.averageResponseTime).toBeDefined();
    });

    it('должен отслеживать Transformers-специфичные метрики', async () => {
      await provider.generateEmbedding('test');

      const metrics = provider.getTransformersMetrics();

      expect(metrics.modelLoadTime).toBeGreaterThan(0);
      expect(metrics.isModelLoaded).toBe(true);
      expect(metrics.workerActive).toBe(true);
      expect(metrics.memoryPeak).toBeGreaterThan(0);
    });

    it('должен обновлять метрики памяти', async () => {
      await provider.generateEmbedding('test');

      const metrics = provider.getTransformersMetrics();

      expect(metrics.memoryPeak).toBe(25000000); // Из нашего мока
    });
  });

  describe('Обработка таймаутов', () => {
    it('должен обрабатывать таймаут операции', async () => {
      const provider = new TransformersProvider({ operationTimeout: 50 });
      await provider.initialize(testConfig);

      // Настраиваем воркер на задержку ответа
      mockWorker.setMessageHandler(() => {
        // Не отвечаем в течение таймаута
      });

      await expect(provider.generateEmbedding('test'))
        .rejects
        .toThrow(TimeoutError);
    }, 1000);
  });

  describe('Обработка ошибок воркера', () => {
    beforeEach(async () => {
      await provider.initialize(testConfig);
    });

    it('должен обрабатывать ошибки воркера', async () => {
      const embeddingPromise = provider.generateEmbedding('test');

      // Симулируем ошибку воркера
      mockWorker.simulateError('Worker crashed');

      await expect(embeddingPromise)
        .rejects
        .toThrow(WorkerError);

      expect(provider.isReady).toBe(false);
    });

    it('должен отменять все запросы при ошибке воркера', async () => {
      const promise1 = provider.generateEmbedding('test1');
      const promise2 = provider.generateEmbedding('test2');

      // Симулируем ошибку воркера
      mockWorker.simulateError('Worker crashed');

      await expect(promise1).rejects.toThrow(WorkerError);
      await expect(promise2).rejects.toThrow(WorkerError);
    });
  });

  describe('Фабричная функция', () => {
    it('должен создавать провайдер через фабричную функцию', () => {
      const provider = createTransformersProvider({
        batchSize: 8,
        enableLogging: true
      });

      expect(provider).toBeInstanceOf(TransformersProvider);
      expect(provider.maxBatchSize).toBe(8);
    });

    it('должен создавать провайдер с настройками по умолчанию', () => {
      const provider = createTransformersProvider();

      expect(provider).toBeInstanceOf(TransformersProvider);
      expect(provider.name).toBe('transformers');
    });
  });
});