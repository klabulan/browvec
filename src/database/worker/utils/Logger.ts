/**
 * Logger
 *
 * Centralized logging utility for worker components with level-based filtering
 * and structured message formatting.
 */

/**
 * Available log levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Log entry structure
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  component?: string;
  data?: any;
}

/**
 * Logger configuration options
 */
export interface LoggerConfig {
  level: LogLevel;
  component?: string;
  enableTimestamp?: boolean;
  enableColors?: boolean;
}

/**
 * Centralized logger for worker components
 *
 * Provides structured logging with level filtering, component identification,
 * and optional data attachment. Supports different output formats for
 * development and production environments.
 */
export class Logger {
  private config: Required<LoggerConfig>;
  private logHistory: LogEntry[] = [];
  private maxHistorySize = 1000;

  // Log level priorities for filtering
  private static readonly LEVEL_PRIORITY: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };

  // Console colors for different log levels
  private static readonly LEVEL_COLORS: Record<LogLevel, string> = {
    debug: '\x1b[36m', // Cyan
    info: '\x1b[32m',  // Green
    warn: '\x1b[33m',  // Yellow
    error: '\x1b[31m'  // Red
  };

  private static readonly RESET_COLOR = '\x1b[0m';

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: config.level || 'info',
      component: config.component || 'Worker',
      enableTimestamp: config.enableTimestamp !== false,
      enableColors: config.enableColors !== false
    };
  }

  /**
   * Log a debug message
   */
  debug(message: string, data?: any): void {
    this.log('debug', message, data);
  }

  /**
   * Log an info message
   */
  info(message: string, data?: any): void {
    this.log('info', message, data);
  }

  /**
   * Log a warning message
   */
  warn(message: string, data?: any): void {
    this.log('warn', message, data);
  }

  /**
   * Log an error message
   */
  error(message: string, data?: any): void {
    this.log('error', message, data);
  }

  /**
   * Core logging method
   */
  log(level: LogLevel | string, message: string, data?: any): void {
    // Check if this log level should be output
    if (!this.shouldLog(level)) {
      return;
    }

    const timestamp = Date.now();
    const logEntry: LogEntry = {
      level: level as LogLevel,
      message,
      timestamp,
      component: this.config.component,
      data
    };

    // Add to history
    this.addToHistory(logEntry);

    // Output to console
    this.outputToConsole(logEntry);
  }

  /**
   * Check if a log level should be output based on configuration
   */
  private shouldLog(level: LogLevel | string): boolean {
    const normalizedLevel = level as LogLevel;
    return Logger.LEVEL_PRIORITY[normalizedLevel] >= Logger.LEVEL_PRIORITY[this.config.level];
  }

  /**
   * Add log entry to history buffer
   */
  private addToHistory(entry: LogEntry): void {
    this.logHistory.push(entry);

    // Trim history if it exceeds max size
    if (this.logHistory.length > this.maxHistorySize) {
      this.logHistory = this.logHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Output log entry to console with formatting
   */
  private outputToConsole(entry: LogEntry): void {
    const parts: string[] = [];

    // Add timestamp if enabled
    if (this.config.enableTimestamp) {
      const timestamp = new Date(entry.timestamp).toISOString();
      parts.push(`[${timestamp}]`);
    }

    // Add component
    if (entry.component) {
      parts.push(`[${entry.component}]`);
    }

    // Add level with color if enabled
    const levelStr = entry.level.toUpperCase();
    if (this.config.enableColors && typeof window === 'undefined') {
      // Only use colors in Node.js/Worker environment
      const color = Logger.LEVEL_COLORS[entry.level];
      parts.push(`${color}${levelStr}${Logger.RESET_COLOR}`);
    } else {
      parts.push(levelStr);
    }

    // Add message
    parts.push(entry.message);

    const logMessage = parts.join(' ');

    // Choose appropriate console method
    switch (entry.level) {
      case 'debug':
        console.debug(logMessage, entry.data);
        break;
      case 'info':
        console.info(logMessage, entry.data);
        break;
      case 'warn':
        console.warn(logMessage, entry.data);
        break;
      case 'error':
        console.error(logMessage, entry.data);
        break;
    }
  }

  /**
   * Get recent log history
   */
  getHistory(maxEntries?: number): LogEntry[] {
    if (maxEntries && maxEntries > 0) {
      return this.logHistory.slice(-maxEntries);
    }
    return [...this.logHistory];
  }

  /**
   * Clear log history
   */
  clearHistory(): void {
    this.logHistory = [];
  }

  /**
   * Update logger configuration
   */
  updateConfig(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  /**
   * Create a child logger with a specific component name
   */
  child(component: string): Logger {
    return new Logger({
      ...this.config,
      component
    });
  }

  /**
   * Create a simple log function compatible with existing code
   */
  createLogFunction(): (level: string, message: string, data?: any) => void {
    return (level: string, message: string, data?: any) => {
      // Map string levels to LogLevel type
      const mappedLevel = this.mapStringToLogLevel(level);
      this.log(mappedLevel, message, data);
    };
  }

  /**
   * Map string level to LogLevel type
   */
  private mapStringToLogLevel(level: string): LogLevel {
    const normalizedLevel = level.toLowerCase();
    if (normalizedLevel in Logger.LEVEL_PRIORITY) {
      return normalizedLevel as LogLevel;
    }
    // Default to info for unknown levels
    return 'info';
  }

  /**
   * Static method to create a default logger instance
   */
  static create(component?: string, level: LogLevel = 'info'): Logger {
    return new Logger({ component, level });
  }
}