/**
 * LLM Module
 *
 * Public exports for LLM integration functionality.
 */

// Types
export type {
  LLMProvider,
  LLMProviderConfig,
  LLMRequestOptions,
  EnhancedQuery,
  ResultSummary,
  LLMResponse,
  LLMSearchResponse
} from './types.js';

// Errors
export {
  LLMError,
  LLMConfigError,
  LLMProviderError,
  LLMTimeoutError,
  LLMParseError
} from './errors.js';

export type { LLMErrorCode } from './errors.js';

// Configuration
export {
  DEFAULT_LLM_CONFIG,
  LLM_MODELS,
  validateProviderConfig
} from './LLMConfig.js';

// Prompt Templates
export {
  buildEnhanceQueryPrompt,
  buildSummarizeResultsPrompt,
  validatePromptLength
} from './PromptTemplates.js';
