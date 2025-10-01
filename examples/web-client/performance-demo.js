/**
 * Демонстрация и тестирование производительности системы расширенной обработки запросов
 * Интеграция с существующим демо-приложением для валидации производительности
 */

import { Database } from '../../src/database/Database';
import { QueryAnalyzer } from '../../src/search/QueryAnalyzer';
import { SearchOptimizer } from '../../src/search/SearchOptimizer';
import { SearchAnalytics } from '../../src/analytics/SearchAnalytics';
import { StrategyEngine } from '../../src/search/StrategyEngine';
import { ResultProcessor } from '../../src/search/ResultProcessor';
// Note: PerformanceTests.js is disabled due to Statement API incompatibility
// Using simplified performance testing instead

/**
 * Класс для демонстрации производительности расширенной обработки запросов
 */
class AdvancedPerformanceDemo {
  constructor() {
    this.db = null;
    this.components = null;
    this.testRunner = null;
    this.isInitialized = false;
  }

  /**
   * Инициализация демонстрации производительности
   */
  async initialize() {
    try {
      console.log('🚀 Инициализация демонстрации производительности...');

      // Инициализация базы данных
      this.db = new Database('opfs:/localretrieve-performance/demo.db');
      await this.db.initLocalRetrieve();

      // Инициализация компонентов расширенной обработки запросов
      const analytics = new SearchAnalytics({
        enableRealTimeMetrics: true,
        privacyLevel: 'strict',
        batchSize: 10
      });

      const queryAnalyzer = new QueryAnalyzer({
        enableCaching: true,
        cacheSize: 100,
        enablePersonalization: true,
        enableAdvancedNLP: true
      });

      const searchOptimizer = new SearchOptimizer({
        enableDiversification: true,
        enablePersonalization: true,
        cacheSize: 50,
        rankingModel: 'learning-to-rank'
      });

      const strategyEngine = new StrategyEngine({
        database: this.db,
        enableQueryAnalyzer: true,
        queryAnalyzer,
        analytics
      });

      const resultProcessor = new ResultProcessor({
        database: this.db,
        enableSearchOptimizer: true,
        searchOptimizer,
        analytics
      });

      this.components = {
        queryAnalyzer,
        searchOptimizer,
        analytics,
        strategyEngine,
        resultProcessor
      };

      // Performance test runner disabled - using simplified testing
      this.testRunner = null;

      this.isInitialized = true;
      console.log('✅ Демонстрация производительности инициализирована');

      return true;
    } catch (error) {
      console.error('❌ Ошибка при инициализации демонстрации производительности:', error);
      return false;
    }
  }

  /**
   * Запуск быстрого теста производительности
   */
  async runQuickTest() {
    if (!this.isInitialized) {
      console.error('❌ Демонстрация не инициализирована. Вызовите initialize() сначала.');
      return null;
    }

    console.log('⚡ Запуск упрощенного теста производительности...');

    try {
      const testQueries = ['machine learning', 'database optimization', 'web development'];
      const results = [];

      for (const query of testQueries) {
        const startTime = performance.now();
        const searchResults = await this.components.strategyEngine.search(query, {
          limit: 10,
          enableAnalytics: true
        });
        const endTime = performance.now();

        results.push({
          query,
          time: endTime - startTime,
          resultCount: searchResults.results.length
        });
      }

      const avgTime = results.reduce((sum, r) => sum + r.time, 0) / results.length;
      const totalResults = results.reduce((sum, r) => sum + r.resultCount, 0);

      console.log('\n📊 РЕЗУЛЬТАТЫ УПРОЩЕННОГО ТЕСТА:');
      console.log(`   Среднее время поиска: ${avgTime.toFixed(2)}ms`);
      console.log(`   Всего результатов: ${totalResults}`);
      console.log(`   Тестовых запросов: ${results.length}`);

      return { averageTime: avgTime, totalResults, testCount: results.length, results };
    } catch (error) {
      console.error('❌ Ошибка при выполнении упрощенного теста:', error);
      return null;
    }
  }

  /**
   * Запуск всестороннего теста производительности
   */
  async runComprehensiveTest() {
    if (!this.isInitialized) {
      console.error('❌ Демонстрация не инициализирована. Вызовите initialize() сначала.');
      return null;
    }

    console.log('🔬 Запуск всестороннего теста производительности...');

    try {
      // Run comparison between basic and enhanced search
      const comparisonResult = await this.compareBasicVsEnhanced();

      // Run quick test
      const quickTestResult = await this.runQuickTest();

      // Get analytics metrics
      const analyticsResult = await this.getAnalyticsMetrics();

      console.log('\n📊 РЕЗУЛЬТАТЫ ВСЕСТОРОННЕГО ТЕСТА:');
      console.log('   ✅ Тест завершен, см. результаты выше');

      return {
        comparison: comparisonResult,
        quickTest: quickTestResult,
        analytics: analyticsResult
      };
    } catch (error) {
      console.error('❌ Ошибка при выполнении всестороннего теста:', error);
      return null;
    }
  }

  /**
   * Запуск кастомного теста производительности
   */
  async runCustomTest(config = {}) {
    if (!this.isInitialized) {
      console.error('❌ Демонстрация не инициализирована. Вызовите initialize() сначала.');
      return null;
    }

    console.log('🎛️ Запуск кастомного теста производительности...');

    try {
      const queries = config.queries || ['artificial intelligence', 'cloud computing', 'software engineering'];
      const limit = config.limit || 10;
      const results = [];

      for (const query of queries) {
        const startTime = performance.now();
        const searchResults = await this.components.strategyEngine.search(query, {
          limit,
          enableAnalytics: true
        });
        const endTime = performance.now();

        results.push({
          query,
          time: endTime - startTime,
          resultCount: searchResults.results.length
        });

        console.log(`   🔍 "${query}": ${(endTime - startTime).toFixed(2)}ms (${searchResults.results.length} результатов)`);
      }

      const avgTime = results.reduce((sum, r) => sum + r.time, 0) / results.length;

      console.log('\n📊 РЕЗУЛЬТАТЫ КАСТОМНОГО ТЕСТА:');
      console.log(`   Среднее время: ${avgTime.toFixed(2)}ms`);
      console.log(`   Запросов обработано: ${results.length}`);

      return { averageTime: avgTime, results, config };
    } catch (error) {
      console.error('❌ Ошибка при выполнении кастомного теста:', error);
      return null;
    }
  }

  /**
   * Демонстрация реального времени работы с расширенной обработкой запросов
   */
  async demonstrateRealTimePerformance() {
    if (!this.isInitialized) {
      console.error('❌ Демонстрация не инициализирована. Вызовите initialize() сначала.');
      return;
    }

    console.log('🎭 Демонстрация реального времени работы расширенной обработки запросов...');

    const testQueries = [
      'machine learning optimization techniques',
      'database performance tuning best practices',
      'web application security vulnerabilities',
      'cloud computing cost optimization strategies',
      'artificial intelligence model deployment'
    ];

    for (const query of testQueries) {
      console.log(`\n🔍 Обработка запроса: "${query}"`);

      try {
        // Измерение времени анализа запроса
        const analysisStart = performance.now();
        const analysis = await this.components.queryAnalyzer.analyzeQuery(query, {
          collectionName: 'default',
          limit: 10
        });
        const analysisTime = performance.now() - analysisStart;

        console.log(`   📊 Анализ запроса: ${analysisTime.toFixed(2)}ms`);
        console.log(`   🎯 Тип запроса: ${analysis.queryType}`);
        console.log(`   📝 Намерение: ${analysis.intent.type}`);

        // Выполнение поиска через StrategyEngine
        const searchStart = performance.now();
        const searchResults = await this.components.strategyEngine.search(query, {
          limit: 10,
          enableAnalytics: true
        });
        const searchTime = performance.now() - searchStart;

        console.log(`   🔍 Поиск: ${searchTime.toFixed(2)}ms`);
        console.log(`   📄 Найдено результатов: ${searchResults.results.length}`);

        // Обработка результатов через ResultProcessor
        const processingStart = performance.now();
        const processedResults = await this.components.resultProcessor.processResults(
          searchResults.results.map(r => ({
            id: r.id,
            content: r.content,
            metadata: r.metadata,
            score: r.score
          })),
          query,
          {
            enableOptimization: true,
            diversificationEnabled: true,
            personalizationEnabled: false
          }
        );
        const processingTime = performance.now() - processingStart;

        console.log(`   ⚡ Обработка результатов: ${processingTime.toFixed(2)}ms`);
        console.log(`   📈 Общее время: ${(analysisTime + searchTime + processingTime).toFixed(2)}ms`);

      } catch (error) {
        console.error(`   ❌ Ошибка при обработке запроса: ${error.message}`);
      }
    }
  }

  /**
   * Сравнение производительности базового и расширенного поиска
   */
  async compareBasicVsEnhanced() {
    if (!this.isInitialized) {
      console.error('❌ Демонстрация не инициализирована. Вызовите initialize() сначала.');
      return;
    }

    console.log('⚖️ Сравнение производительности базового и расширенного поиска...');

    const testQueries = [
      'machine learning',
      'database optimization',
      'web development',
      'cloud computing',
      'artificial intelligence'
    ];

    const basicTimes = [];
    const enhancedTimes = [];

    for (const query of testQueries) {
      // Базовый поиск
      const basicStart = performance.now();
      const stmt = this.db.prepare(`
        SELECT d.id, d.title, d.content
        FROM docs_default d
        JOIN fts_default fts ON d.rowid = fts.rowid
        WHERE fts MATCH ?
        LIMIT 10
      `);
      const basicResults = stmt.all([query]);
      stmt.finalize();
      const basicTime = performance.now() - basicStart;
      basicTimes.push(basicTime);

      // Расширенный поиск
      const enhancedStart = performance.now();
      const searchResults = await this.components.strategyEngine.search(query, {
        limit: 10,
        enableAnalytics: true
      });
      const enhancedTime = performance.now() - enhancedStart;
      enhancedTimes.push(enhancedTime);

      console.log(`🔍 Запрос: "${query}"`);
      console.log(`   Базовый: ${basicTime.toFixed(2)}ms (${basicResults.length} результатов)`);
      console.log(`   Расширенный: ${enhancedTime.toFixed(2)}ms (${searchResults.results.length} результатов)`);
      console.log(`   Разница: +${(enhancedTime - basicTime).toFixed(2)}ms`);
    }

    const avgBasic = basicTimes.reduce((a, b) => a + b, 0) / basicTimes.length;
    const avgEnhanced = enhancedTimes.reduce((a, b) => a + b, 0) / enhancedTimes.length;
    const avgDifference = avgEnhanced - avgBasic;

    console.log('\n📊 СВОДКА СРАВНЕНИЯ:');
    console.log(`   Среднее время базового поиска: ${avgBasic.toFixed(2)}ms`);
    console.log(`   Среднее время расширенного поиска: ${avgEnhanced.toFixed(2)}ms`);
    console.log(`   Средняя дополнительная задержка: ${avgDifference.toFixed(2)}ms`);
    console.log(`   Соответствует требованию (<100ms): ${avgDifference < 100 ? '✅ ДА' : '❌ НЕТ'}`);

    return {
      avgBasic,
      avgEnhanced,
      avgDifference,
      meetsRequirement: avgDifference < 100
    };
  }

  /**
   * Получение метрик аналитики
   */
  async getAnalyticsMetrics() {
    if (!this.isInitialized) {
      console.error('❌ Демонстрация не инициализирована. Вызовите initialize() сначала.');
      return null;
    }

    try {
      const metrics = await this.components.analytics.getMetrics();

      console.log('\n📈 МЕТРИКИ АНАЛИТИКИ:');
      console.log(`   Общее количество запросов: ${metrics.totalQueries || 0}`);
      console.log(`   Среднее время поиска: ${metrics.avgSearchTime?.toFixed(2) || 0}ms`);
      console.log(`   Общее количество результатов: ${metrics.totalResults || 0}`);
      console.log(`   Среднее количество результатов: ${metrics.avgResultCount?.toFixed(1) || 0}`);

      if (metrics.queryTypes) {
        console.log('   Типы запросов:');
        Object.entries(metrics.queryTypes).forEach(([type, count]) => {
          console.log(`     ${type}: ${count}`);
        });
      }

      return metrics;
    } catch (error) {
      console.error('❌ Ошибка при получении метрик аналитики:', error);
      return null;
    }
  }

  /**
   * Очистка ресурсов
   */
  cleanup() {
    if (this.db) {
      this.db.close();
    }
    this.isInitialized = false;
    console.log('🧹 Ресурсы очищены');
  }
}

// Экспорт для использования в браузере
window.AdvancedPerformanceDemo = AdvancedPerformanceDemo;

// Глобальная функция для быстрого запуска демонстрации
window.runPerformanceDemo = async function() {
  const demo = new AdvancedPerformanceDemo();

  try {
    await demo.initialize();

    console.log('\n🎯 Запуск демонстрации производительности...');

    // Демонстрация реального времени
    await demo.demonstrateRealTimePerformance();

    // Сравнение базового и расширенного поиска
    await demo.compareBasicVsEnhanced();

    // Быстрый тест производительности
    await demo.runQuickTest();

    // Получение метрик аналитики
    await demo.getAnalyticsMetrics();

    console.log('\n✅ Демонстрация производительности завершена');

    return demo;
  } catch (error) {
    console.error('❌ Ошибка в демонстрации производительности:', error);
    demo.cleanup();
    return null;
  }
};

// Автоматический запуск при загрузке страницы (если включено)
document.addEventListener('DOMContentLoaded', function() {
  if (window.location.search.includes('auto-performance')) {
    setTimeout(() => {
      window.runPerformanceDemo();
    }, 1000);
  }
});

console.log('🎭 Демонстрация производительности расширенной обработки запросов загружена');
console.log('💡 Используйте window.runPerformanceDemo() для запуска или добавьте ?auto-performance к URL');