/**
 * Custom Error Classes for LocalRetrieve
 *
 * Provides enhanced error classes with context for better debugging and error reporting.
 */

/**
 * Validation error with structured context
 *
 * Thrown when document structure doesn't meet requirements before insertion.
 */
export class ValidationError extends Error {
  constructor(
    message: string,
    public context: {
      collection: string;
      document: any;
      errors: string[];
    }
  ) {
    super(message);
    this.name = 'ValidationError';

    // Maintain proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }

  /**
   * Format error for logging
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      context: this.context,
      stack: this.stack
    };
  }
}

/**
 * Document insertion error with diagnostic context
 *
 * Thrown when document insertion fails, including verification failures.
 */
export class DocumentInsertError extends Error {
  constructor(
    message: string,
    public context: {
      collection: string;
      documentId: string;
      providedFields: string[];
      originalError?: Error;
      suggestion?: string;
    }
  ) {
    super(message);
    this.name = 'DocumentInsertError';

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DocumentInsertError);
    }
  }

  /**
   * Format error for logging
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      context: {
        ...this.context,
        originalError: this.context.originalError?.message
      },
      stack: this.stack
    };
  }
}

/**
 * Collection operation error
 *
 * Thrown when collection-level operations fail.
 */
export class CollectionError extends Error {
  constructor(
    message: string,
    public context: {
      collection: string;
      operation: string;
      details?: any;
    }
  ) {
    super(message);
    this.name = 'CollectionError';

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, CollectionError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      context: this.context,
      stack: this.stack
    };
  }
}
