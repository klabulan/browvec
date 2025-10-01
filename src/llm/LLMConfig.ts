/**
 * LLM Configuration
 *
 * Default configuration values and model mappings.
 */

/**
 * Default LLM Configuration
 */
export const DEFAULT_LLM_CONFIG = {
  timeout: 10000,        // 10 seconds
  maxRetries: 2,
  temperature: 0.7,
  maxTokens: 500
};

/**
 * Available models per provider
 */
export const LLM_MODELS = {
  openai: [
    'gpt-4',
    'gpt-4-turbo',
    'gpt-3.5-turbo'
  ],
  anthropic: [
    'claude-3-opus-20240229',
    'claude-3-sonnet-20240229',
    'claude-3-haiku-20240307'
  ],
  openrouter: [
    'auto'  // OpenRouter handles model selection
  ],
  custom: [
    'default'
  ]
};

/**
 * Validate provider configuration
 */
export function validateProviderConfig(config: any): boolean {
  if (!config || typeof config !== 'object') {
    return false;
  }

  if (!config.provider || typeof config.provider !== 'string') {
    return false;
  }

  if (!config.model || typeof config.model !== 'string') {
    return false;
  }

  return true;
}
