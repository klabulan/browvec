/**
 * BaseHandler
 *
 * Base class for all RPC handlers with common functionality.
 * Provides shared utilities, error handling, and context management.
 */

import type { SQLiteManager } from '../core/SQLiteManager.js';
import type { SchemaManager } from '../schema/SchemaManager.js';
import type { OPFSManager } from '../core/OPFSManager.js';
import { ErrorHandler, ContextualError } from '../utils/ErrorHandling.js';
import { ParameterValidator } from '../utils/TypeGuards.js';

/**
 * Handler dependencies injected during construction
 */
export interface HandlerDependencies {
  sqliteManager: SQLiteManager;
  schemaManager: SchemaManager;
  opfsManager: OPFSManager;
  logger?: { log: (level: string, message: string, data?: any) => void };
}

/**
 * Base handler class providing common functionality for all RPC handlers
 *
 * Features:
 * - Dependency injection and management
 * - Consistent error handling and context tracking
 * - Parameter validation utilities
 * - Logging with component identification
 * - Database connection verification
 * - Performance monitoring hooks
 */
export abstract class BaseHandler {
  protected sqliteManager: SQLiteManager;
  protected schemaManager: SchemaManager;
  protected opfsManager: OPFSManager;
  protected logger?: { log: (level: string, message: string, data?: any) => void };

  constructor(dependencies: HandlerDependencies) {
    this.sqliteManager = dependencies.sqliteManager;
    this.schemaManager = dependencies.schemaManager;
    this.opfsManager = dependencies.opfsManager;
    this.logger = dependencies.logger;
  }

  /**
   * Execute an operation with error handling and context
   */
  protected async withContext<T>(
    operation: string,
    fn: () => Promise<T>,
    params?: Record<string, any>
  ): Promise<T> {
    return ErrorHandler.withContext(
      operation,
      this.getComponentName(),
      fn,
      params
    );
  }

  /**
   * Execute an operation with retry logic
   */
  protected async withRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    retryDelay: number = 1000
  ): Promise<T> {
    return ErrorHandler.withRetry(operation, {
      strategy: 'retry',
      maxRetries,
      retryDelay,
      onRetry: (attempt, error) => {
        this.log('warn', `Operation retry ${attempt}/${maxRetries}: ${error.message}`);
      }
    });
  }

  /**
   * Validate parameters using type guards
   */
  protected validateParams<T>(
    params: any,
    typeGuard: (params: any) => params is T,
    methodName: string
  ): T {
    return ParameterValidator.validate(params, typeGuard, `${this.getComponentName()}.${methodName}`);
  }

  /**
   * Ensure database is initialized before operations
   */
  protected ensureInitialized(): void {
    if (!this.sqliteManager.isConnected()) {
      throw new Error('Database not initialized - call open() first');
    }
  }

  /**
   * Measure operation performance
   */
  protected async measurePerformance<T>(
    operation: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const startTime = Date.now();

    try {
      const result = await fn();
      const duration = Date.now() - startTime;
      this.log('debug', `${operation} completed in ${duration}ms`);
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.log('debug', `${operation} failed after ${duration}ms`);
      throw error;
    }
  }

  /**
   * Get component name for logging and error context
   */
  protected abstract getComponentName(): string;

  /**
   * Log message with component context
   */
  protected log(level: string, message: string, data?: any): void {
    if (this.logger) {
      this.logger.log(level, `[${this.getComponentName()}] ${message}`, data);
    } else {
      console.log(`[${this.getComponentName()}] ${level.toUpperCase()}: ${message}`, data ? data : '');
    }
  }

  /**
   * Create standardized error response for RPC
   */
  protected createErrorResponse(error: Error, requestId?: string): Record<string, any> {
    return ErrorHandler.createErrorResponse(error, requestId);
  }

  /**
   * Check if error is recoverable
   */
  protected isRecoverableError(error: Error): boolean {
    return ErrorHandler.isRecoverable(error);
  }

  /**
   * Create user-friendly error message
   */
  protected createUserMessage(error: Error): string {
    return ErrorHandler.createUserMessage(error);
  }

  /**
   * Sanitize sensitive data from parameters for logging
   */
  protected sanitizeParams(params: any, sensitiveKeys: string[] = []): any {
    const defaultSensitive = ['password', 'token', 'key', 'secret'];
    const allSensitive = [...defaultSensitive, ...sensitiveKeys];

    if (typeof params !== 'object' || params === null) {
      return params;
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(params)) {
      if (allSensitive.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object') {
        sanitized[key] = this.sanitizeParams(value, sensitiveKeys);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Validate collection name with business rules
   */
  protected validateCollectionName(name: any, methodName: string): string {
    return ParameterValidator.validateCollectionName(name, `${this.getComponentName()}.${methodName}`);
  }

  /**
   * Validate document ID with business rules
   */
  protected validateDocumentId(id: any, methodName: string): string {
    return ParameterValidator.validateDocumentId(id, `${this.getComponentName()}.${methodName}`);
  }

  /**
   * Validate search limit parameter
   */
  protected validateLimit(limit: any, methodName: string, defaultValue: number = 10): number {
    return ParameterValidator.validateLimit(limit, `${this.getComponentName()}.${methodName}`, defaultValue);
  }

  /**
   * Validate search threshold parameter
   */
  protected validateThreshold(threshold: any, methodName: string): number | undefined {
    return ParameterValidator.validateThreshold(threshold, `${this.getComponentName()}.${methodName}`);
  }

  /**
   * Convert Float32Array to database-compatible blob
   */
  protected embeddingToBlob(embedding: Float32Array): Uint8Array {
    return new Uint8Array(embedding.buffer);
  }

  /**
   * Convert database blob to Float32Array
   */
  protected blobToEmbedding(blob: Uint8Array): Float32Array {
    return new Float32Array(blob.buffer);
  }

  /**
   * Format SQL query for logging (remove sensitive data)
   */
  protected formatSQLForLog(sql: string, params?: any[]): string {
    let formattedSQL = sql.replace(/\s+/g, ' ').trim();

    if (params && params.length > 0) {
      // Replace first few parameters for context, but don't include all data
      const safeParams = params.slice(0, 3).map(p => {
        if (typeof p === 'string') {
          return p.length > 50 ? `"${p.substring(0, 50)}..."` : `"${p}"`;
        } else if (p instanceof Uint8Array || p instanceof Float32Array) {
          return `[${p.constructor.name} ${p.length}]`;
        } else {
          return String(p);
        }
      });

      const paramStr = params.length > 3 ?
        `[${safeParams.join(', ')}, ...${params.length - 3} more]` :
        `[${safeParams.join(', ')}]`;

      formattedSQL += ` -- params: ${paramStr}`;
    }

    return formattedSQL;
  }

  /**
   * Execute SQL with logging and error handling
   */
  protected async executeSQLWithLogging<T>(
    operation: string,
    sql: string,
    params?: any[],
    executor?: (sql: string, params?: any[]) => Promise<T>
  ): Promise<T> {
    const formattedSQL = this.formatSQLForLog(sql, params);
    this.log('debug', `${operation}: ${formattedSQL}`);

    try {
      const result = executor ?
        await executor(sql, params) :
        await this.sqliteManager.select(sql, params);

      return result as T;
    } catch (error) {
      this.log('error', `${operation} failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}