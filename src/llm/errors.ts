/**
 * LLM Error Classes
 *
 * Error types for LLM operations.
 */

/**
 * LLM Error Codes
 */
export type LLMErrorCode =
  | 'INVALID_CONFIG'
  | 'INVALID_API_KEY'
  | 'PROVIDER_ERROR'
  | 'TIMEOUT'
  | 'RATE_LIMIT'
  | 'NETWORK_ERROR'
  | 'PARSE_ERROR'
  | 'UNKNOWN_ERROR';

/**
 * Base LLM Error
 */
export class LLMError extends Error {
  constructor(
    message: string,
    public readonly code: LLMErrorCode,
    public readonly statusCode?: number,
    public readonly provider?: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'LLMError';
    Object.setPrototypeOf(this, LLMError.prototype);
  }
}

/**
 * LLM Configuration Error
 */
export class LLMConfigError extends LLMError {
  constructor(message: string, details?: any) {
    super(message, 'INVALID_CONFIG', undefined, undefined, details);
    this.name = 'LLMConfigError';
    Object.setPrototypeOf(this, LLMConfigError.prototype);
  }
}

/**
 * LLM Provider Error (API errors)
 */
export class LLMProviderError extends LLMError {
  constructor(message: string, statusCode: number, provider: string, details?: any) {
    super(message, 'PROVIDER_ERROR', statusCode, provider, details);
    this.name = 'LLMProviderError';
    Object.setPrototypeOf(this, LLMProviderError.prototype);
  }
}

/**
 * LLM Timeout Error
 */
export class LLMTimeoutError extends LLMError {
  constructor(provider: string, timeout: number) {
    super(`LLM request timeout after ${timeout}ms`, 'TIMEOUT', undefined, provider);
    this.name = 'LLMTimeoutError';
    Object.setPrototypeOf(this, LLMTimeoutError.prototype);
  }
}

/**
 * LLM Parse Error
 */
export class LLMParseError extends LLMError {
  constructor(message: string, provider: string, details?: any) {
    super(message, 'PARSE_ERROR', undefined, provider, details);
    this.name = 'LLMParseError';
    Object.setPrototypeOf(this, LLMParseError.prototype);
  }
}
