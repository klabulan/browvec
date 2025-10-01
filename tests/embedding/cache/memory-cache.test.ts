/**
 * Тесты для MemoryCache - простого кэша эмбеддингов в памяти
 *
 * Эти тесты проверяют основную функциональность кэша, включая
 * LRU алгоритм, метрики и обработку ошибок.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryCache, MemoryCacheFactory, type MemoryCacheConfig } from '../../../src/embedding/cache/MemoryCache.js';
import type { CollectionEmbeddingConfig } from '../../../src/embedding/types.js';

// Мокаем EmbeddingUtils для тестирования
vi.mock('../../../src/embedding/utils.js', () => ({
  EmbeddingUtils: {
    generateCacheKey: vi.fn().mockImplementation(async (config) => ({
      hash: `hash_${JSON.stringify(config.text)}_${config.collectionConfig?.provider || 'default'}`,
      algorithm: 'SHA-256',
      timestamp: new Date(),
    }))
  }
}));

describe('MemoryCache', () => {
  let cache: MemoryCache;
  const testEmbedding = new Float32Array([0.1, 0.2, 0.3, 0.4]);
  const testConfig: CollectionEmbeddingConfig = {
    provider: 'transformers',
    dimensions: 384,
    batchSize: 32
  };

  beforeEach(() => {
    cache = new MemoryCache({
      maxEntries: 5,
      maxSizeBytes: 1024 * 1024, // 1MB
      enableLogging: false,
      cleanupIntervalMs: 0 // Отключаем автоочистку для тестов
    });
  });

  afterEach(() => {
    cache.dispose();
  });

  describe('Основная функциональность', () => {
    it('должен сохранять и получать эмбеддинги', async () => {
      const text = 'test text';

      // Сначала кэш пустой
      const notFound = await cache.get(text, testConfig);
      expect(notFound).toBeNull();

      // Сохраняем эмбеддинг
      await cache.set(text, testEmbedding, testConfig);

      // Получаем из кэша
      const retrieved = await cache.get(text, testConfig);
      expect(retrieved).not.toBeNull();
      expect(retrieved).toEqual(testEmbedding);
    });

    it('должен проверять наличие записей в кэше', async () => {
      const text = 'test text';

      // Сначала записи нет
      const notExists = await cache.has(text, testConfig);
      expect(notExists).toBe(false);

      // Добавляем запись
      await cache.set(text, testEmbedding, testConfig);

      // Теперь запись есть
      const exists = await cache.has(text, testConfig);
      expect(exists).toBe(true);
    });

    it('должен различать записи с разными конфигурациями', async () => {
      const text = 'same text';
      const config1: CollectionEmbeddingConfig = {
        provider: 'transformers',
        dimensions: 384
      };
      const config2: CollectionEmbeddingConfig = {
        provider: 'openai',
        dimensions: 1536
      };

      const embedding1 = new Float32Array([1, 2, 3]);
      const embedding2 = new Float32Array([4, 5, 6]);

      // Сохраняем с разными конфигурациями
      await cache.set(text, embedding1, config1);
      await cache.set(text, embedding2, config2);

      // Получаем правильные эмбеддинги для каждой конфигурации
      const retrieved1 = await cache.get(text, config1);
      const retrieved2 = await cache.get(text, config2);

      expect(retrieved1).toEqual(embedding1);
      expect(retrieved2).toEqual(embedding2);
    });
  });

  describe('LRU алгоритм', () => {
    it('должен вытеснять наименее используемые записи при превышении лимита', async () => {
      // Заполняем кэш до максимума (5 записей)
      for (let i = 0; i < 5; i++) {
        await cache.set(`text${i}`, new Float32Array([i]), testConfig);
      }

      // Все записи должны быть в кэше
      for (let i = 0; i < 5; i++) {
        const exists = await cache.has(`text${i}`, testConfig);
        expect(exists).toBe(true);
      }

      // Добавляем еще одну запись - должна вытеснить первую
      await cache.set('text5', new Float32Array([5]), testConfig);

      // Первая запись должна быть вытеснена
      const firstExists = await cache.has('text0', testConfig);
      expect(firstExists).toBe(false);

      // Последняя запись должна быть в кэше
      const lastExists = await cache.has('text5', testConfig);
      expect(lastExists).toBe(true);
    });

    it('должен перемещать часто используемые записи в начало', async () => {
      // Добавляем 3 записи
      await cache.set('text0', new Float32Array([0]), testConfig);
      await cache.set('text1', new Float32Array([1]), testConfig);
      await cache.set('text2', new Float32Array([2]), testConfig);

      // Обращаемся к первой записи
      await cache.get('text0', testConfig);

      // Добавляем записи до превышения лимита
      await cache.set('text3', new Float32Array([3]), testConfig);
      await cache.set('text4', new Float32Array([4]), testConfig);
      await cache.set('text5', new Float32Array([5]), testConfig); // Должна вытеснить text1

      // text0 должна остаться (была недавно использована)
      const text0Exists = await cache.has('text0', testConfig);
      expect(text0Exists).toBe(true);

      // text1 должна быть вытеснена (наименее используемая)
      const text1Exists = await cache.has('text1', testConfig);
      expect(text1Exists).toBe(false);
    });
  });

  describe('Метрики', () => {
    it('должен отслеживать попадания и промахи', async () => {
      const text = 'test text';

      // Промах кэша
      await cache.get(text, testConfig);
      let metrics = cache.getMetrics();
      expect(metrics.misses).toBe(1);
      expect(metrics.hits).toBe(0);
      expect(metrics.hitRate).toBe(0);

      // Добавляем запись
      await cache.set(text, testEmbedding, testConfig);

      // Попадание в кэш
      await cache.get(text, testConfig);
      metrics = cache.getMetrics();
      expect(metrics.hits).toBe(1);
      expect(metrics.misses).toBe(1);
      expect(metrics.hitRate).toBe(0.5);
    });

    it('должен отслеживать вытеснения', async () => {
      // Заполняем кэш сверх лимита
      for (let i = 0; i < 7; i++) {
        await cache.set(`text${i}`, new Float32Array([i]), testConfig);
      }

      const metrics = cache.getMetrics();
      expect(metrics.evictions).toBe(2); // Должно быть 2 вытеснения
      expect(metrics.currentSize).toBe(5); // Размер не должен превышать максимум
    });

    it('должен сбрасывать метрики', async () => {
      // Генерируем активность
      await cache.set('text', testEmbedding, testConfig);
      await cache.get('text', testConfig);

      let metrics = cache.getMetrics();
      expect(metrics.totalAccesses).toBeGreaterThan(0);

      // Сбрасываем метрики
      cache.resetMetrics();
      metrics = cache.getMetrics();
      expect(metrics.totalAccesses).toBe(0);
      expect(metrics.hits).toBe(0);
      expect(metrics.misses).toBe(0);
    });
  });

  describe('Управление памятью', () => {
    it('должен очищать весь кэш', async () => {
      // Добавляем несколько записей
      await cache.set('text1', testEmbedding, testConfig);
      await cache.set('text2', testEmbedding, testConfig);

      // Проверяем, что записи есть
      let metrics = cache.getMetrics();
      expect(metrics.currentSize).toBe(2);

      // Очищаем кэш
      cache.clear();

      // Проверяем, что кэш пустой
      metrics = cache.getMetrics();
      expect(metrics.currentSize).toBe(0);

      const exists = await cache.has('text1', testConfig);
      expect(exists).toBe(false);
    });

    it('должен предоставлять информацию о размере', async () => {
      const sizeInfo = cache.getSizeInfo();
      expect(sizeInfo.entries).toBe(0);
      expect(sizeInfo.maxEntries).toBe(5);
      expect(sizeInfo.utilizationPercent).toBe(0);

      // Добавляем записи
      await cache.set('text1', testEmbedding, testConfig);
      await cache.set('text2', testEmbedding, testConfig);

      const newSizeInfo = cache.getSizeInfo();
      expect(newSizeInfo.entries).toBe(2);
      expect(newSizeInfo.utilizationPercent).toBeGreaterThan(0);
    });
  });

  describe('Обработка ошибок', () => {
    it('должен обрабатывать ошибки при освобожденном кэше', async () => {
      cache.dispose();

      // Все операции должны выбрасывать ошибки
      await expect(cache.get('text', testConfig)).rejects.toThrow('Cache has been disposed');
      await expect(cache.set('text', testEmbedding, testConfig)).rejects.toThrow('Cache has been disposed');
      await expect(cache.has('text', testConfig)).rejects.toThrow('Cache has been disposed');
      expect(() => cache.getMetrics()).toThrow('Cache has been disposed');
    });

    it('должен безопасно обрабатывать множественные вызовы dispose', () => {
      expect(() => {
        cache.dispose();
        cache.dispose();
        cache.dispose();
      }).not.toThrow();
    });
  });
});

describe('MemoryCacheFactory', () => {
  it('должен создавать кэши разных размеров', () => {
    const small = MemoryCacheFactory.createSmall();
    const medium = MemoryCacheFactory.createMedium();
    const large = MemoryCacheFactory.createLarge();
    const persistent = MemoryCacheFactory.createPersistent();

    expect(small.getSizeInfo().maxEntries).toBe(100);
    expect(medium.getSizeInfo().maxEntries).toBe(1000);
    expect(large.getSizeInfo().maxEntries).toBe(5000);
    expect(persistent.getSizeInfo().maxEntries).toBe(2000);

    // Очищаем ресурсы
    small.dispose();
    medium.dispose();
    large.dispose();
    persistent.dispose();
  });
});