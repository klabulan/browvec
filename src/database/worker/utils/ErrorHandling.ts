/**
 * ErrorHandling
 *
 * Centralized error handling utilities with enhanced error classification,
 * context preservation, and recovery strategies.
 */

import { DatabaseError, VectorError, OPFSError } from '../../../types/worker.js';
import { EmbeddingError } from '../../../embedding/errors.js';

/**
 * Error context for enhanced error reporting
 */
export interface ErrorContext {
  operation: string;
  component: string;
  params?: Record<string, any>;
  timestamp: number;
  stackTrace?: string;
}

/**
 * Enhanced error with additional context
 */
export class ContextualError extends Error {
  public readonly context: ErrorContext;
  public readonly originalError?: Error;

  constructor(message: string, context: ErrorContext, originalError?: Error) {
    super(message);
    this.name = 'ContextualError';
    this.context = context;
    this.originalError = originalError;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ContextualError);
    }
  }

  /**
   * Get full error message with context
   */
  getFullMessage(): string {
    const parts = [
      `[${this.context.component}:${this.context.operation}]`,
      this.message
    ];

    if (this.originalError) {
      parts.push(`Original: ${this.originalError.message}`);
    }

    return parts.join(' ');
  }

  /**
   * Convert to plain object for serialization
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      context: this.context,
      originalError: this.originalError ? {
        name: this.originalError.name,
        message: this.originalError.message,
        stack: this.originalError.stack
      } : null,
      stack: this.stack
    };
  }
}

/**
 * Error recovery strategy
 */
export type RecoveryStrategy = 'retry' | 'fallback' | 'abort' | 'ignore';

/**
 * Recovery options for error handling
 */
export interface RecoveryOptions {
  strategy: RecoveryStrategy;
  maxRetries?: number;
  retryDelay?: number;
  fallbackValue?: any;
  onRetry?: (attempt: number, error: Error) => void;
  onFallback?: (error: Error) => void;
}

/**
 * Error classification result
 */
export interface ErrorClassification {
  category: 'database' | 'vector' | 'opfs' | 'embedding' | 'network' | 'validation' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
  userMessage: string;
  suggestedAction?: string;
}

/**
 * Enhanced error handling utilities
 */
export class ErrorHandler {
  private static errorHistory: ContextualError[] = [];
  private static maxHistorySize = 100;

  /**
   * Wrap an operation with error handling and context
   */
  static async withContext<T>(
    operation: string,
    component: string,
    fn: () => Promise<T>,
    params?: Record<string, any>
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      const context: ErrorContext = {
        operation,
        component,
        params,
        timestamp: Date.now(),
        stackTrace: error instanceof Error ? error.stack : undefined
      };

      const contextualError = new ContextualError(
        error instanceof Error ? error.message : String(error),
        context,
        error instanceof Error ? error : undefined
      );

      this.addToHistory(contextualError);
      throw contextualError;
    }
  }

  /**
   * Execute operation with retry logic
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    options: RecoveryOptions
  ): Promise<T> {
    const maxRetries = options.maxRetries || 3;
    const retryDelay = options.retryDelay || 1000;

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (options.onRetry) {
          options.onRetry(attempt, lastError);
        }

        if (attempt === maxRetries) {
          break;
        }

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
      }
    }

    // All retries failed
    if (options.strategy === 'fallback' && options.fallbackValue !== undefined) {
      if (options.onFallback) {
        options.onFallback(lastError!);
      }
      return options.fallbackValue;
    }

    throw lastError || new Error('Operation failed after retries');
  }

  /**
   * Classify error for appropriate handling
   */
  static classifyError(error: Error): ErrorClassification {
    if (error instanceof DatabaseError) {
      return this.classifyDatabaseError(error);
    }

    if (error instanceof VectorError) {
      return {
        category: 'vector',
        severity: 'high',
        recoverable: false,
        userMessage: 'Vector search functionality is not available',
        suggestedAction: 'Check if sqlite-vec extension is properly loaded'
      };
    }

    if (error instanceof OPFSError) {
      return {
        category: 'opfs',
        severity: 'medium',
        recoverable: true,
        userMessage: 'Data persistence may not work properly',
        suggestedAction: 'Check browser storage settings or clear storage'
      };
    }

    if (error instanceof EmbeddingError) {
      return {
        category: 'embedding',
        severity: 'medium',
        recoverable: true,
        userMessage: 'Embedding generation failed',
        suggestedAction: 'Check embedding provider configuration or try again'
      };
    }

    // Network-related errors
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return {
        category: 'network',
        severity: 'medium',
        recoverable: true,
        userMessage: 'Network operation failed',
        suggestedAction: 'Check internet connection and try again'
      };
    }

    // Validation errors
    if (error.message.includes('invalid') || error.message.includes('validation')) {
      return {
        category: 'validation',
        severity: 'low',
        recoverable: false,
        userMessage: 'Invalid input provided',
        suggestedAction: 'Check your input data and try again'
      };
    }

    // Unknown error
    return {
      category: 'unknown',
      severity: 'medium',
      recoverable: false,
      userMessage: 'An unexpected error occurred',
      suggestedAction: 'Try refreshing the page or contact support'
    };
  }

  /**
   * Classify database-specific errors
   */
  private static classifyDatabaseError(error: DatabaseError): ErrorClassification {
    const message = error.message.toLowerCase();

    if (message.includes('sqlite') && message.includes('corrupt')) {
      return {
        category: 'database',
        severity: 'critical',
        recoverable: false,
        userMessage: 'Database is corrupted',
        suggestedAction: 'Clear browser storage and reimport your data'
      };
    }

    if (message.includes('disk') || message.includes('space')) {
      return {
        category: 'database',
        severity: 'high',
        recoverable: true,
        userMessage: 'Storage space is full',
        suggestedAction: 'Clear browser storage or export data to free space'
      };
    }

    if (message.includes('locked') || message.includes('busy')) {
      return {
        category: 'database',
        severity: 'medium',
        recoverable: true,
        userMessage: 'Database is temporarily busy',
        suggestedAction: 'Wait a moment and try again'
      };
    }

    if (message.includes('permission') || message.includes('access')) {
      return {
        category: 'database',
        severity: 'high',
        recoverable: false,
        userMessage: 'Database access denied',
        suggestedAction: 'Check browser permissions and security settings'
      };
    }

    return {
      category: 'database',
      severity: 'medium',
      recoverable: false,
      userMessage: 'Database operation failed',
      suggestedAction: 'Try refreshing the page'
    };
  }

  /**
   * Create user-friendly error message with recovery suggestions
   */
  static createUserMessage(error: Error): string {
    const classification = this.classifyError(error);

    let message = classification.userMessage;

    if (classification.suggestedAction) {
      message += `. ${classification.suggestedAction}`;
    }

    return message;
  }

  /**
   * Add error to history for debugging
   */
  private static addToHistory(error: ContextualError): void {
    this.errorHistory.push(error);

    // Trim history if it exceeds max size
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory = this.errorHistory.slice(-this.maxHistorySize);
    }
  }

  /**
   * Get recent error history
   */
  static getErrorHistory(maxEntries?: number): ContextualError[] {
    if (maxEntries && maxEntries > 0) {
      return this.errorHistory.slice(-maxEntries);
    }
    return [...this.errorHistory];
  }

  /**
   * Clear error history
   */
  static clearHistory(): void {
    this.errorHistory = [];
  }

  /**
   * Check if an error is recoverable
   */
  static isRecoverable(error: Error): boolean {
    return this.classifyError(error).recoverable;
  }

  /**
   * Get error severity level
   */
  static getSeverity(error: Error): string {
    return this.classifyError(error).severity;
  }

  /**
   * Create a standardized error response for RPC
   */
  static createErrorResponse(error: Error, requestId?: string): Record<string, any> {
    const classification = this.classifyError(error);

    return {
      success: false,
      error: {
        message: error.message,
        userMessage: classification.userMessage,
        category: classification.category,
        severity: classification.severity,
        recoverable: classification.recoverable,
        suggestedAction: classification.suggestedAction,
        timestamp: Date.now(),
        requestId
      }
    };
  }

  /**
   * Sanitize error for logging (remove sensitive data)
   */
  static sanitizeError(error: Error, sensitiveKeys: string[] = []): Record<string, any> {
    const defaultSensitiveKeys = ['password', 'token', 'key', 'secret', 'auth'];
    const allSensitiveKeys = [...defaultSensitiveKeys, ...sensitiveKeys];

    const sanitize = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(sanitize);
      }

      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (allSensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
          sanitized[key] = '[REDACTED]';
        } else if (typeof value === 'object') {
          sanitized[key] = sanitize(value);
        } else {
          sanitized[key] = value;
        }
      }

      return sanitized;
    };

    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      context: error instanceof ContextualError ? sanitize(error.context) : undefined
    };
  }
}