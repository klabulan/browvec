/**
 * Класс для предобработки текста перед генерацией эмбеддингов
 *
 * Данный модуль предоставляет комплексную предобработку текста, включая:
 * - Удаление HTML тегов и сущностей
 * - Очистка markdown разметки
 * - Нормализация пробелов и специальных символов
 * - Обрезка текста до лимитов модели
 * - Поддержка различных форматов документов
 */

import type { TextPreprocessingConfig } from './types.js';
import { ValidationError, EmbeddingError } from './errors.js';

/**
 * Результат предобработки текста
 */
export interface TextProcessingResult {
  /** Обработанный текст */
  processedText: string;

  /** Исходная длина текста */
  originalLength: number;

  /** Длина после обработки */
  processedLength: number;

  /** Приблизительное количество токенов */
  estimatedTokens: number;

  /** Был ли текст обрезан */
  wasTruncated: boolean;

  /** Примененные операции предобработки */
  appliedOperations: string[];

  /** Метаданные обработки */
  metadata: {
    removedHtmlTags?: number;
    removedMarkdownElements?: number;
    normalizedWhitespace?: boolean;
    convertedToLowerCase?: boolean;
    removedSpecialChars?: number;
  };
}

/**
 * Опции обрезки текста
 */
export interface TruncationOptions {
  /** Максимальная длина в символах */
  maxCharacters?: number;

  /** Максимальное количество токенов (приблизительно) */
  maxTokens?: number;

  /** Стратегия обрезки */
  strategy?: 'head' | 'tail' | 'middle';

  /** Сохранять ли границы слов */
  preserveWordBoundaries?: boolean;

  /** Добавлять ли индикатор обрезки */
  addTruncationIndicator?: boolean;

  /** Текст индикатора обрезки */
  truncationIndicator?: string;
}

/**
 * Статистика предобработки
 */
export interface ProcessingStatistics {
  /** Общее количество обработанных текстов */
  totalProcessed: number;

  /** Среднее время обработки в миллисекундах */
  averageProcessingTime: number;

  /** Количество текстов, которые были обрезаны */
  truncatedCount: number;

  /** Средняя длина исходного текста */
  averageOriginalLength: number;

  /** Средняя длина обработанного текста */
  averageProcessedLength: number;

  /** Время сброса статистики */
  resetTime: Date;
}

/**
 * Основной класс для предобработки текста
 */
export class TextProcessor {
  private config: Required<Omit<TextPreprocessingConfig, 'customPreprocessor'>> & { customPreprocessor?: string };
  private statistics: ProcessingStatistics;

  /** Регулярное выражение для HTML тегов */
  private static readonly HTML_TAG_REGEX = /<[^>]*>/g;

  /** Регулярное выражение для HTML сущностей */
  private static readonly HTML_ENTITY_REGEX = /&[a-zA-Z0-9#]+;/g;

  /** Регулярное выражение для множественных пробелов */
  private static readonly MULTIPLE_WHITESPACE_REGEX = /\s+/g;

  /** Регулярное выражение для специальных символов */
  private static readonly SPECIAL_CHARS_REGEX = /[^\w\s\u0400-\u04FF.,!?;:'"()\-]/g;

  /** Приблизительное соотношение символов к токенам */
  private static readonly CHARS_PER_TOKEN = 4;

  /** Markdown элементы для удаления */
  private static readonly MARKDOWN_PATTERNS = [
    // Заголовки
    { pattern: /^#{1,6}\s+/gm, description: 'headers' },
    // Жирный и курсивный текст
    { pattern: /\*\*([^*]+)\*\*/g, replacement: '$1', description: 'bold' },
    { pattern: /__([^_]+)__/g, replacement: '$1', description: 'bold_alt' },
    { pattern: /\*([^*]+)\*/g, replacement: '$1', description: 'italic' },
    { pattern: /_([^_]+)_/g, replacement: '$1', description: 'italic_alt' },
    // Зачеркнутый текст
    { pattern: /~~([^~]+)~~/g, replacement: '$1', description: 'strikethrough' },
    // Код
    { pattern: /`([^`]+)`/g, replacement: '$1', description: 'inline_code' },
    { pattern: /```[\s\S]*?```/g, replacement: '', description: 'code_blocks' },
    // Ссылки
    { pattern: /\[([^\]]+)\]\([^)]+\)/g, replacement: '$1', description: 'links' },
    { pattern: /!\[([^\]]*)\]\([^)]+\)/g, replacement: '$1', description: 'images' },
    // Списки
    { pattern: /^[\s]*[-*+]\s+/gm, replacement: '', description: 'unordered_lists' },
    { pattern: /^[\s]*\d+\.\s+/gm, replacement: '', description: 'ordered_lists' },
    // Цитаты
    { pattern: /^>\s*/gm, replacement: '', description: 'blockquotes' },
    // Горизонтальные линии
    { pattern: /^[-*_]{3,}$/gm, replacement: '', description: 'horizontal_rules' },
    // Таблицы
    { pattern: /\|.*\|/g, replacement: '', description: 'tables' }
  ];

  constructor(config: Partial<TextPreprocessingConfig> = {}) {
    // Устанавливаем значения по умолчанию
    this.config = {
      maxLength: config.maxLength ?? 8192,
      stripHtml: config.stripHtml ?? true,
      stripMarkdown: config.stripMarkdown ?? true,
      normalizeWhitespace: config.normalizeWhitespace ?? true,
      toLowerCase: config.toLowerCase ?? false,
      removeSpecialChars: config.removeSpecialChars ?? false,
      customPreprocessor: config.customPreprocessor
    };

    this.statistics = {
      totalProcessed: 0,
      averageProcessingTime: 0,
      truncatedCount: 0,
      averageOriginalLength: 0,
      averageProcessedLength: 0,
      resetTime: new Date()
    };
  }

  /**
   * Основной метод предобработки текста
   *
   * @param text - Исходный текст для обработки
   * @param options - Дополнительные опции обработки
   * @returns Результат предобработки
   */
  public processText(
    text: string,
    options: Partial<TextPreprocessingConfig & TruncationOptions> = {}
  ): TextProcessingResult {
    const startTime = performance.now();

    // Валидация входных данных
    this.validateInput(text);

    const originalLength = text.length;
    const appliedOperations: string[] = [];
    const metadata: TextProcessingResult['metadata'] = {};

    let processedText = text;

    // Объединяем конфигурацию с опциями
    const effectiveConfig = { ...this.config, ...options };

    // Удаление HTML
    if (effectiveConfig.stripHtml) {
      const htmlResult = this.removeHtml(processedText);
      processedText = htmlResult.text;
      metadata.removedHtmlTags = htmlResult.removedCount;
      if (htmlResult.removedCount > 0) {
        appliedOperations.push('html_removal');
      }
    }

    // Удаление Markdown
    if (effectiveConfig.stripMarkdown) {
      const markdownResult = this.removeMarkdown(processedText);
      processedText = markdownResult.text;
      metadata.removedMarkdownElements = markdownResult.removedCount;
      if (markdownResult.removedCount > 0) {
        appliedOperations.push('markdown_removal');
      }
    }

    // Нормализация пробелов
    if (effectiveConfig.normalizeWhitespace) {
      const beforeLength = processedText.length;
      processedText = this.normalizeWhitespace(processedText);
      metadata.normalizedWhitespace = processedText.length !== beforeLength;
      if (metadata.normalizedWhitespace) {
        appliedOperations.push('whitespace_normalization');
      }
    }

    // Приведение к нижнему регистру
    if (effectiveConfig.toLowerCase) {
      processedText = processedText.toLowerCase();
      metadata.convertedToLowerCase = true;
      appliedOperations.push('lowercase_conversion');
    }

    // Удаление специальных символов
    if (effectiveConfig.removeSpecialChars) {
      const beforeLength = processedText.length;
      processedText = this.removeSpecialCharacters(processedText);
      metadata.removedSpecialChars = beforeLength - processedText.length;
      if (metadata.removedSpecialChars > 0) {
        appliedOperations.push('special_chars_removal');
      }
    }

    // Применение пользовательской функции предобработки
    if (effectiveConfig.customPreprocessor) {
      try {
        const customFunction = new Function('text', effectiveConfig.customPreprocessor);
        processedText = customFunction(processedText) || processedText;
        appliedOperations.push('custom_preprocessing');
      } catch (error) {
        // Игнорируем ошибки в пользовательской функции, но логируем
        console.warn('Custom preprocessor failed:', error);
      }
    }

    // Обрезка текста
    const truncationResult = this.truncateText(processedText, {
      maxCharacters: effectiveConfig.maxLength,
      maxTokens: options.maxTokens,
      strategy: options.strategy,
      preserveWordBoundaries: options.preserveWordBoundaries,
      addTruncationIndicator: options.addTruncationIndicator,
      truncationIndicator: options.truncationIndicator
    });

    processedText = truncationResult.text;
    const wasTruncated = truncationResult.wasTruncated;

    if (wasTruncated) {
      appliedOperations.push('text_truncation');
    }

    const processedLength = processedText.length;
    const estimatedTokens = Math.ceil(processedLength / TextProcessor.CHARS_PER_TOKEN);

    // Обновление статистики
    const processingTime = performance.now() - startTime;
    this.updateStatistics(originalLength, processedLength, processingTime, wasTruncated);

    return {
      processedText,
      originalLength,
      processedLength,
      estimatedTokens,
      wasTruncated,
      appliedOperations,
      metadata
    };
  }

  /**
   * Удаление HTML тегов и сущностей
   *
   * @param text - Текст с HTML разметкой
   * @returns Очищенный текст и количество удаленных элементов
   */
  private removeHtml(text: string): { text: string; removedCount: number } {
    let removedCount = 0;

    // Удаляем HTML теги
    const withoutTags = text.replace(TextProcessor.HTML_TAG_REGEX, (match) => {
      removedCount++;
      return ' '; // Заменяем пробелом для сохранения разделения слов
    });

    // Удаляем HTML сущности и декодируем их
    const withoutEntities = withoutTags.replace(TextProcessor.HTML_ENTITY_REGEX, (match) => {
      removedCount++;
      // Декодируем наиболее распространенные сущности
      const entityMap: Record<string, string> = {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&#39;': "'",
        '&apos;': "'",
        '&nbsp;': ' ',
        '&copy;': '©',
        '&reg;': '®',
        '&trade;': '™'
      };

      return entityMap[match] || ' ';
    });

    return {
      text: withoutEntities,
      removedCount
    };
  }

  /**
   * Удаление Markdown разметки
   *
   * @param text - Текст с Markdown разметкой
   * @returns Очищенный текст и количество удаленных элементов
   */
  private removeMarkdown(text: string): { text: string; removedCount: number } {
    let processedText = text;
    let removedCount = 0;

    for (const { pattern, replacement, description } of TextProcessor.MARKDOWN_PATTERNS) {
      const beforeLength = processedText.length;

      if (replacement !== undefined) {
        // Замена с сохранением содержимого
        processedText = processedText.replace(pattern, replacement);
      } else {
        // Полное удаление
        processedText = processedText.replace(pattern, ' ');
      }

      // Подсчитываем количество изменений по количеству совпадений
      const matches = text.match(pattern);
      if (matches) {
        removedCount += matches.length;
      }
    }

    return {
      text: processedText,
      removedCount
    };
  }

  /**
   * Нормализация пробельных символов
   *
   * @param text - Исходный текст
   * @returns Нормализованный текст
   */
  private normalizeWhitespace(text: string): string {
    return text
      // Заменяем множественные пробелы на одинарные
      .replace(TextProcessor.MULTIPLE_WHITESPACE_REGEX, ' ')
      // Удаляем пробелы в начале и конце
      .trim();
  }

  /**
   * Удаление специальных символов
   *
   * @param text - Исходный текст
   * @returns Очищенный текст
   */
  private removeSpecialCharacters(text: string): string {
    return text.replace(TextProcessor.SPECIAL_CHARS_REGEX, ' ');
  }

  /**
   * Обрезка текста до заданных лимитов
   *
   * @param text - Исходный текст
   * @param options - Опции обрезки
   * @returns Результат обрезки
   */
  private truncateText(
    text: string,
    options: TruncationOptions = {}
  ): { text: string; wasTruncated: boolean } {
    const {
      maxCharacters,
      maxTokens,
      strategy = 'tail',
      preserveWordBoundaries = true,
      addTruncationIndicator = false,
      truncationIndicator = '...'
    } = options;

    // Определяем максимальную длину
    let maxLength = text.length;

    if (maxCharacters !== undefined) {
      maxLength = Math.min(maxLength, maxCharacters);
    }

    if (maxTokens !== undefined) {
      const maxCharsFromTokens = maxTokens * TextProcessor.CHARS_PER_TOKEN;
      maxLength = Math.min(maxLength, maxCharsFromTokens);
    }

    // Если текст не нужно обрезать
    if (text.length <= maxLength) {
      return { text, wasTruncated: false };
    }

    // Резервируем место для индикатора обрезки
    const indicatorLength = addTruncationIndicator ? truncationIndicator.length : 0;
    const targetLength = maxLength - indicatorLength;

    if (targetLength <= 0) {
      return { text: truncationIndicator, wasTruncated: true };
    }

    let truncatedText: string;

    switch (strategy) {
      case 'head':
        truncatedText = text.substring(0, targetLength);
        break;

      case 'middle':
        const halfLength = Math.floor(targetLength / 2);
        const startPart = text.substring(0, halfLength);
        const endPart = text.substring(text.length - halfLength);
        truncatedText = startPart + endPart;
        break;

      case 'tail':
      default:
        truncatedText = text.substring(0, targetLength);
        break;
    }

    // Сохранение границ слов
    if (preserveWordBoundaries && truncatedText.length > 0) {
      // Ищем последний пробел
      const lastSpaceIndex = truncatedText.lastIndexOf(' ');
      if (lastSpaceIndex > targetLength * 0.8) { // Не обрезаем слишком много
        truncatedText = truncatedText.substring(0, lastSpaceIndex);
      }
    }

    // Добавление индикатора обрезки
    if (addTruncationIndicator) {
      if (strategy === 'middle') {
        const halfLength = Math.floor(truncatedText.length / 2);
        truncatedText = truncatedText.substring(0, halfLength) +
                       truncationIndicator +
                       truncatedText.substring(halfLength);
      } else {
        truncatedText += truncationIndicator;
      }
    }

    return { text: truncatedText, wasTruncated: true };
  }

  /**
   * Валидация входного текста
   *
   * @param text - Текст для валидации
   * @throws {ValidationError} При невалидном тексте
   */
  private validateInput(text: string): void {
    if (typeof text !== 'string') {
      throw new ValidationError(
        'Input must be a string',
        'text',
        'typeof text === "string"'
      );
    }

    if (text.length === 0) {
      throw new ValidationError(
        'Input text cannot be empty',
        'text',
        'text.length > 0'
      );
    }

    if (text.length > 1000000) { // 1MB символов
      throw new ValidationError(
        'Input text is too large (max 1M characters)',
        'text',
        'text.length <= 1000000'
      );
    }
  }

  /**
   * Обновление статистики обработки
   *
   * @param originalLength - Исходная длина текста
   * @param processedLength - Длина после обработки
   * @param processingTime - Время обработки в миллисекундах
   * @param wasTruncated - Был ли текст обрезан
   */
  private updateStatistics(
    originalLength: number,
    processedLength: number,
    processingTime: number,
    wasTruncated: boolean
  ): void {
    const totalTime = this.statistics.averageProcessingTime * this.statistics.totalProcessed;
    const totalOriginalLength = this.statistics.averageOriginalLength * this.statistics.totalProcessed;
    const totalProcessedLength = this.statistics.averageProcessedLength * this.statistics.totalProcessed;

    this.statistics.totalProcessed += 1;
    this.statistics.averageProcessingTime = (totalTime + processingTime) / this.statistics.totalProcessed;
    this.statistics.averageOriginalLength = (totalOriginalLength + originalLength) / this.statistics.totalProcessed;
    this.statistics.averageProcessedLength = (totalProcessedLength + processedLength) / this.statistics.totalProcessed;

    if (wasTruncated) {
      this.statistics.truncatedCount += 1;
    }
  }

  /**
   * Получение статистики обработки
   *
   * @returns Текущая статистика
   */
  public getStatistics(): ProcessingStatistics {
    return { ...this.statistics };
  }

  /**
   * Сброс статистики обработки
   */
  public resetStatistics(): void {
    this.statistics = {
      totalProcessed: 0,
      averageProcessingTime: 0,
      truncatedCount: 0,
      averageOriginalLength: 0,
      averageProcessedLength: 0,
      resetTime: new Date()
    };
  }

  /**
   * Обновление конфигурации обработки
   *
   * @param newConfig - Новая конфигурация
   */
  public updateConfig(newConfig: Partial<TextPreprocessingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Получение текущей конфигурации
   *
   * @returns Текущая конфигурация
   */
  public getConfig(): TextPreprocessingConfig {
    return { ...this.config };
  }

  /**
   * Оценка количества токенов в тексте
   *
   * @param text - Текст для оценки
   * @returns Приблизительное количество токенов
   */
  public static estimateTokens(text: string): number {
    return Math.ceil(text.length / TextProcessor.CHARS_PER_TOKEN);
  }

  /**
   * Проверка, нужна ли предобработка для данного текста
   *
   * @param text - Текст для проверки
   * @param config - Конфигурация предобработки
   * @returns true, если предобработка может изменить текст
   */
  public static needsPreprocessing(text: string, config: TextPreprocessingConfig): boolean {
    if (config.stripHtml && (TextProcessor.HTML_TAG_REGEX.test(text) || TextProcessor.HTML_ENTITY_REGEX.test(text))) {
      return true;
    }

    if (config.stripMarkdown) {
      for (const { pattern } of TextProcessor.MARKDOWN_PATTERNS) {
        if (pattern.test(text)) {
          return true;
        }
      }
    }

    if (config.normalizeWhitespace && TextProcessor.MULTIPLE_WHITESPACE_REGEX.test(text)) {
      return true;
    }

    if (config.toLowerCase && text !== text.toLowerCase()) {
      return true;
    }

    if (config.removeSpecialChars && TextProcessor.SPECIAL_CHARS_REGEX.test(text)) {
      return true;
    }

    if (config.maxLength && text.length > config.maxLength) {
      return true;
    }

    return false;
  }

  /**
   * Быстрая очистка текста с минимальными операциями
   *
   * @param text - Исходный текст
   * @returns Быстро очищенный текст
   */
  public static quickClean(text: string): string {
    return text
      .replace(TextProcessor.HTML_TAG_REGEX, ' ')
      .replace(TextProcessor.HTML_ENTITY_REGEX, ' ')
      .replace(TextProcessor.MULTIPLE_WHITESPACE_REGEX, ' ')
      .trim();
  }
}