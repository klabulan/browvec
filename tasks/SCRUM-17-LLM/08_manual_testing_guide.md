# SCRUM-17 LLM Integration - Manual Testing Guide

**Date**: 2025-10-01
**Version**: 1.0
**Status**: ✅ Complete - Demo UI Available for Manual Testing

---

## 🎯 Overview

The LLM integration is now fully integrated into the LocalRetrieve demo application with a dedicated UI for testing all three LLM features:

1. **Query Enhancement** - LLM improves search queries
2. **Result Summarization** - LLM summarizes search results
3. **Smart Search** - Combined enhance + search + summarize workflow

---

## 🚀 Quick Start

### 1. Start the Demo Application

```bash
# Make sure you're in the project root
cd D:\localcopilot\browvec

# Start the development server (if not already running)
npm run dev:vite

# Open your browser to:
# http://localhost:5175/examples/web-client/index.html
```

### 2. Locate the LLM Testing Section

1. Open the demo in your browser
2. Scroll down to the **"SQL Operations"** section
3. Look for the **"🤖 LLM Integration Testing"** section below SQL Results

### 3. Configure Your API Key

**Option A: Using Your API Keys**
1. Select your preferred provider from the dropdown:
   - **OpenAI (GPT-4)** - Requires OpenAI API key
   - **OpenRouter** - Recommended (access to multiple models with one key)
   - **Anthropic (Claude)** - Requires Anthropic API key
   - **Custom Endpoint** - For self-hosted LLMs

2. Paste your API key in the "API Key" field
   - OpenAI: Starts with `sk-proj-...`
   - OpenRouter: Starts with `sk-or-...`
   - Anthropic: Starts with `sk-ant-...`

**Option B: Quick Test with Your Keys**
```
You already have these API keys configured:
- OpenAI: sk-proj-at1h0EvoC3FcDirHseau...
- OpenRouter: sk-or-v1-3419f9a313a1ee4...
```

---

## 📝 Test Cases

### Test 1: Query Enhancement

**Purpose**: Verify LLM can enhance and improve search queries

**Steps**:
1. In the **Query Enhancement** section:
   - Input field should have default value: `"search AI docs"`
   - Or enter your own query
2. Select your provider (OpenRouter recommended)
3. Enter your API key
4. Click **"Enhance Query"** button
5. Wait for response (2-5 seconds)

**Expected Results**:
- ✅ Loading message appears: "Enhancing query with LLM..."
- ✅ Success message shows results containing:
  - **Original Query**: Your input query
  - **Enhanced Query**: LLM-improved version
  - **Suggestions**: Array of alternative queries
  - **Intent**: Detected search intent
  - **Confidence**: Confidence score (0-1)
  - **Processing Time**: Time in milliseconds
  - **Provider**: Which LLM was used

**Example Output**:
```
Original Query: search AI docs
Enhanced Query: artificial intelligence documentation search
Suggestions: ["AI documentation", "machine learning docs", "AI reference materials"]
Intent: document_retrieval
Confidence: 0.85
Processing Time: 2340ms
Provider: openrouter (openai/gpt-4)
```

**Common Errors**:
- "API key is required" → Enter your API key
- "Worker not initialized" → Wait for page to fully load, refresh if needed
- "401 Unauthorized" → Check your API key is correct
- Network error → Check internet connection

---

### Test 2: Result Summarization

**Purpose**: Verify LLM can summarize search results

**Prerequisites**:
- Database must have documents (click "Load Sample Data" if needed)

**Steps**:
1. In the **Result Summarization** section:
   - Input field should have default value: `"javascript"`
   - Or enter a query that will return results
2. Select your provider
3. Enter your API key
4. Click **"Search & Summarize"** button
5. Wait for response (3-7 seconds)

**Expected Results**:
- ✅ Status updates:
  - "Searching for 'javascript'..."
  - "Summarizing X results with {provider}..."
- ✅ Results display containing:
  - **Summary**: Coherent summary of all results
  - **Key Points**: Bullet points of main topics
  - **Themes**: Identified themes/categories
  - **Results Count**: Number of results summarized
  - **Confidence**: Summary confidence score
  - **Processing Time**: Time in milliseconds
  - **Provider**: Which LLM was used

**Example Output**:
```
Summary: The search results cover various aspects of JavaScript programming, including tutorials for beginners, advanced concepts like closures and async programming, and practical frameworks like React and Node.js.

Key Points: ["JavaScript basics", "ES6 features", "React framework", "Node.js backend"]
Themes: ["Programming languages", "Web development", "Frontend", "Backend"]
Results Count: 8
Confidence: 0.92
Processing Time: 3520ms
Provider: openai (gpt-4)
```

**Common Errors**:
- "No search results found to summarize" → Ensure sample data is loaded
- "Worker not initialized" → Refresh page and wait for initialization
- API errors → Check API key and credits

---

### Test 3: Smart Search (Combined)

**Purpose**: Verify complete LLM-enhanced search workflow

**Prerequisites**:
- Database must have documents

**Steps**:
1. In the **Smart Search (Combined)** section:
   - Input field should have default value: `"AI documentation"`
   - Checkboxes: ✓ Enhance Query, ✓ Summarize Results
2. Select your provider
3. Enter your API key
4. Click **"Smart Search"** button
5. Wait for response (5-10 seconds)

**Expected Results**:
- ✅ Multi-step status updates showing each phase
- ✅ Comprehensive results containing:
  - **Original Query**: Your input
  - **Results Found**: Number of matching documents
  - **Total Time**: Complete workflow time
  - **Enhanced Query**: (if enabled) LLM-improved query
  - **Suggestions**: (if enabled) Query variations
  - **Enhancement Time**: Time spent on query enhancement
  - **Summary**: (if enabled) Results summary
  - **Key Points**: (if enabled) Main points from results
  - **Summarization Time**: Time spent summarizing
  - **Search Time**: Database search time
  - **LLM Time**: Total LLM processing time
  - **Provider**: Which LLM was used

**Example Output**:
```
Original Query: AI documentation
Results Found: 12
Total Time: 7890ms
Enhanced Query: artificial intelligence technical documentation resources
Suggestions: ["AI docs", "machine learning documentation", "AI reference guides"]
Enhancement Time: 2100ms
Summary: The results provide comprehensive AI documentation covering neural networks, machine learning algorithms, and practical implementation guides across various frameworks and libraries.
Key Points: ["Neural networks", "Deep learning", "ML algorithms", "Framework guides"]
Summarization Time: 3200ms
Search Time: 450ms
LLM Time: 5300ms
Provider: openrouter (openai/gpt-4)
```

**Test Variations**:
- ✓ Only "Enhance Query" enabled → Should show enhanced query but no summary
- ✓ Only "Summarize Results" enabled → Should search with original query and summarize
- ✗ Both disabled → Should show error: "Please enable at least one LLM feature"

---

## 🧪 Additional Test Scenarios

### Test 4: Error Handling

**Test Invalid API Key**:
1. Enter fake API key: `sk-fake-key-for-testing`
2. Try any LLM function
3. Expected: Clear error message about authentication

**Test Empty Query**:
1. Clear the query input field
2. Click test button
3. Expected: Error "Please enter a query"

**Test No Results**:
1. Enter query that returns no results: `xyznonexistentquery123`
2. Try summarization
3. Expected: "No search results found to summarize"

**Test Network Error**:
1. Disconnect internet
2. Try any LLM function
3. Expected: Network error message

### Test 5: Provider Switching

1. Test with OpenAI (if you have key)
2. Switch to OpenRouter
3. Switch to Anthropic (if you have key)
4. Verify each provider works correctly
5. Compare response times and quality

### Test 6: Performance Testing

**Query Enhancement**:
- Expected time: 1-3 seconds
- Maximum acceptable: 10 seconds

**Result Summarization**:
- Expected time: 2-5 seconds
- Maximum acceptable: 30 seconds

**Smart Search**:
- Expected time: 5-10 seconds
- Maximum acceptable: 30 seconds

---

## 📊 Success Criteria

### ✅ Pass Criteria

- All three LLM functions work without errors
- Results are coherent and relevant
- Processing times within acceptable ranges
- Error messages are clear and helpful
- UI updates correctly during processing
- All providers (that you have keys for) work correctly

### ❌ Fail Criteria

- Functions crash or hang indefinitely
- Timeout errors with valid API keys
- Incoherent or nonsensical LLM responses
- UI doesn't update or freezes
- Error messages are unclear

---

## 🐛 Troubleshooting

### Issue: "Worker not initialized"

**Symptoms**: Error appears immediately when clicking test buttons

**Solutions**:
1. Refresh the page completely (Ctrl+F5 / Cmd+Shift+R)
2. Check browser console for errors (F12)
3. Ensure dev server is running
4. Try clearing browser cache
5. Check that WASM files are loading correctly

**Root Cause**: Database/Worker initialization failed or incomplete

---

### Issue: LLM requests timeout

**Symptoms**: Request hangs for 30+ seconds then fails

**Solutions**:
1. Check internet connection
2. Verify API key is correct
3. Check provider status pages:
   - OpenAI: https://status.openai.com
   - Anthropic: https://status.anthropic.com
   - OpenRouter: https://status.openrouter.ai
4. Try different provider
5. Check API usage limits/credits

---

### Issue: Poor quality responses

**Symptoms**: LLM returns irrelevant or low-quality results

**Solutions**:
1. Try different model (GPT-4 usually better than GPT-3.5)
2. Check if query is clear and specific
3. Ensure sample data is loaded
4. Try with different query
5. Switch to different provider

---

### Issue: CORS errors

**Symptoms**: Network error with CORS mentioned in console

**Solutions**:
1. OpenRouter shouldn't have CORS issues
2. For OpenAI: May need proxy if called from browser
3. Check provider's CORS policy
4. Use OpenRouter as alternative (has CORS enabled)

---

## 💡 Tips for Best Results

### Query Enhancement
- Use natural language queries
- Test with vague queries to see improvement
- Examples: "find docs" → "documentation search"
- Compare enhanced vs original results

### Result Summarization
- Works best with 3-20 results
- Too few results → summary may be redundant
- Too many results → summary may be too general
- Quality depends on document content quality

### Smart Search
- Most powerful when both features enabled
- Great for exploratory searches
- Useful when unsure of exact query
- Best with well-structured document collection

---

## 📝 Manual Test Report Template

Use this template to document your test results:

```
# LLM Integration Test Report

**Date**: ___________
**Tester**: ___________
**Provider Tested**: ___________

## Test Results

### Query Enhancement
- [ ] Passed
- [ ] Failed
- Response Time: ______ms
- Notes: ___________

### Result Summarization
- [ ] Passed
- [ ] Failed
- Response Time: ______ms
- Results Count: _____
- Notes: ___________

### Smart Search
- [ ] Passed
- [ ] Failed
- Response Time: ______ms
- Notes: ___________

## Issues Found
1. ___________
2. ___________

## Overall Assessment
- [ ] Ready for production
- [ ] Needs fixes
- [ ] Needs more testing

## Additional Comments
___________
```

---

## 🔗 Related Documentation

- **API Keys Setup**: `tests/e2e/LLM_API_KEYS_README.md`
- **Implementation Summary**: `05_implementation_summary.md`
- **Test Results**: `06_test_results.md`
- **Test Fixes**: `07_test_fixes_summary.md`

---

## 📞 Support

If you encounter issues:

1. Check browser console (F12) for errors
2. Verify API keys are valid
3. Check provider status pages
4. Review test results documentation
5. Check GitHub issues: https://github.com/anthropics/localretrieve/issues

---

**Document Status**: ✅ Complete
**Last Updated**: 2025-10-01
**Version**: 1.0
**Related**: SCRUM-17 LLM Integration
