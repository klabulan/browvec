# LLM API Keys Configuration for Testing

## Overview

This directory contains E2E tests for the SCRUM-17 LLM Integration feature. To test with real LLM providers, you need to configure API keys.

## Setup Instructions

### 1. Create Your API Keys File

Copy the example file to create your personal API keys configuration:

```bash
cp ../../.llm-api-keys.example.json ../../.llm-api-keys.json
```

### 2. Add Your API Keys

Edit `.llm-api-keys.json` and add your actual API keys:

```json
{
  "openai": {
    "apiKey": "sk-your-actual-openai-key",
    "model": "gpt-4"
  },
  "anthropic": {
    "apiKey": "sk-ant-your-actual-anthropic-key",
    "model": "claude-3-sonnet-20240229"
  },
  "openrouter": {
    "apiKey": "sk-or-your-actual-openrouter-key",
    "model": "openai/gpt-4",
    "endpoint": "https://openrouter.ai/api/v1/chat/completions"
  }
}
```

### 3. Security Notes

⚠️ **IMPORTANT**:
- The `.llm-api-keys.json` file is **gitignored** and will NOT be committed to the repository
- Never commit your actual API keys to version control
- Keep your API keys secure and do not share them

## Where to Get API Keys

### OpenAI
- **URL**: https://platform.openai.com/api-keys
- **Models**: `gpt-4`, `gpt-4-turbo`, `gpt-3.5-turbo`
- **Format**: `sk-...` (starts with "sk-")

### Anthropic (Claude)
- **URL**: https://console.anthropic.com/settings/keys
- **Models**: `claude-3-opus-20240229`, `claude-3-sonnet-20240229`, `claude-3-haiku-20240307`
- **Format**: `sk-ant-...` (starts with "sk-ant-")

### OpenRouter
- **URL**: https://openrouter.ai/keys
- **Models**: Access to multiple LLM providers through one API
- **Format**: `sk-or-...` (starts with "sk-or-")
- **Advantage**: Single API for GPT-4, Claude, Llama, and many others

## Running Tests with Real API Keys

### Basic Test Run (Mock Mode - Default)
```bash
npm run test:e2e -- tests/e2e/llm-integration.spec.ts
```

### Test with Real API Keys (Manual Testing)
The current tests are designed for validation without real API calls. To test with real providers:

1. Open browser console during test execution
2. Manually test in the demo application at `http://localhost:5175/examples/web-client/index.html`
3. Use the demo's JavaScript console to test LLM functionality

### Example Manual Test in Browser Console

```javascript
// In the demo application console:

// Load your API keys (if using a script)
const keys = {
  openai: { apiKey: 'your-key', model: 'gpt-4' }
};

// Test Query Enhancement
const enhanced = await window.demoInstance.db.enhanceQuery(
  'search documents',
  {
    provider: 'openai',
    model: keys.openai.model,
    apiKey: keys.openai.apiKey
  }
);
console.log('Enhanced:', enhanced);

// Test Result Summarization
const results = await window.demoInstance.db.searchText({ text: 'javascript' });
const summary = await window.demoInstance.db.summarizeResults(
  results.results,
  {
    provider: 'openai',
    model: keys.openai.model,
    apiKey: keys.openai.apiKey
  }
);
console.log('Summary:', summary);

// Test Combined Search
const smartSearch = await window.demoInstance.db.searchWithLLM(
  'AI documentation',
  {
    enhanceQuery: true,
    summarizeResults: true,
    searchOptions: { limit: 10 },
    llmOptions: {
      provider: 'openai',
      model: keys.openai.model,
      apiKey: keys.openai.apiKey
    }
  }
);
console.log('Smart Search:', smartSearch);
```

## Test Configuration

The E2E tests in `llm-integration.spec.ts` validate:

1. ✅ **API Availability** - All LLM methods exist
2. ✅ **Parameter Validation** - Errors for invalid inputs
3. ✅ **Error Handling** - Graceful error messages
4. ✅ **Type Safety** - TypeScript type checking
5. ✅ **RPC Communication** - Worker communication layer
6. ✅ **Provider Configuration** - Multiple provider support

## Cost Considerations

⚠️ **API Usage Costs**:
- OpenAI GPT-4: ~$0.03 per 1K tokens
- Anthropic Claude: ~$0.015 per 1K tokens
- OpenRouter: Varies by model

**Recommendation**: Start with small test queries and monitor usage on provider dashboards.

## Troubleshooting

### Issue: Tests failing with "API key required"
**Solution**: The tests are designed to fail gracefully without API keys. This is expected behavior for validation tests.

### Issue: "Network error" or "CORS error"
**Solution**:
1. Check that the dev server is running: `npm run dev:vite`
2. Verify CORS headers are set correctly (should be automatic)
3. Some providers may require proxy setup for CORS

### Issue: "Rate limit exceeded"
**Solution**:
1. Wait a few minutes before retrying
2. Use OpenRouter as an alternative (has higher rate limits)
3. Check your API key usage on the provider's dashboard

### Issue: Invalid API key format
**Solution**:
- OpenAI keys start with `sk-`
- Anthropic keys start with `sk-ant-`
- OpenRouter keys start with `sk-or-`

## Files Structure

```
D:\localcopilot\browvec\
├── .llm-api-keys.json              # Your API keys (gitignored)
├── .llm-api-keys.example.json      # Template file (committed)
├── .gitignore                       # Includes .llm-api-keys.json
└── tests/
    └── e2e/
        ├── llm-integration.spec.ts  # E2E tests
        └── LLM_API_KEYS_README.md  # This file
```

## Additional Resources

- **SCRUM-17 Documentation**: `tasks/SCRUM-17-LLM/`
- **Test Results**: `tasks/SCRUM-17-LLM/06_test_results.md`
- **Implementation Summary**: `tasks/SCRUM-17-LLM/05_implementation_summary.md`
- **Technical Specification**: `tasks/SCRUM-17-LLM/03_technical_specification.md`

## Support

If you encounter issues:
1. Check the test results document: `tasks/SCRUM-17-LLM/06_test_results.md`
2. Review provider documentation linked above
3. Verify API keys are active and have sufficient credits
4. Check network connectivity and CORS settings

---

**Last Updated**: 2025-10-01
**Related**: SCRUM-17 LLM Integration
**Status**: ✅ Configuration Complete
