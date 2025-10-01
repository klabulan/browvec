# SCRUM-17 LLM Integration - Requirements Analysis

## 1. JIRA Requirements Summary

**Epic**: [EPIC] LLM Integration for Enhanced Search
**Key**: SCRUM-17
**Status**: To Do
**Labels**: ai-features, enhancement, llm-integration, mvp

### Business Objectives
- **Enhanced User Experience**: Provide intelligent search query suggestions and result summaries
- **Competitive Advantage**: Position LocalRetrieve as AI-enhanced search solution
- **Developer Adoption**: Offer simple LLM integration for browser applications
- **MVP Foundation**: Establish architecture for future AI features

### Technical Scope
- **Query Enhancement**: LLM-powered query expansion and refinement
- **Result Summarization**: Intelligent aggregation of search results
- **Provider Connections**: OpenAI, OpenRouter, and custom endpoint support
- **Simple Orchestrator**: Basic workflow coordination between search and LLM

### Architecture Requirements
- **Worker-based Execution**: Utilize existing RPC patterns in Web Worker
- **Parallel to Embedding System**: Separate `/llm/` module maintaining modularity
- **Graceful Degradation**: Search functionality works without LLM
- **sql.js Compatibility**: Maintain existing database interface patterns

### Success Criteria
- LLM providers configurable and operational
- Query enhancement improves search relevance
- Result summarization provides clear value
- No performance impact on core search
- Comprehensive testing across browsers
- Demo application showcases capabilities

### Complexity Assessment
- **Total Effort**: 6-10 days implementation
- **Risk Level**: LOW-MEDIUM (reuses existing patterns)
- **Dependencies**: Existing RPC system, HTTP client patterns
- **Testing**: Extends current E2E test suite

## 2. Current Application State Analysis

### 2.1 Architecture Overview

LocalRetrieve follows a **3-tier Worker-based Architecture**:

```
┌─────────────────────────────────────────────┐
│        Main Thread (Public API)             │
│  - Database.ts (sql.js compatible)          │
│  - Statement.ts                             │
│  - Search methods (search, searchText, etc) │
└────────────────┬────────────────────────────┘
                 │ RPC Communication
                 │ (WorkerRPC)
┌────────────────▼────────────────────────────┐
│        Web Worker (Worker Thread)           │
│  - DatabaseWorker (Coordinator)             │
│  - SQLiteManager (WASM operations)          │
│  - SchemaManager (Schema/migrations)        │
│  - SearchHandler (Search logic)             │
│  - EmbeddingQueue (Background processing)   │
│  - ProviderManager (Embedding providers)    │
└────────────────┬────────────────────────────┘
                 │ WASM Interface
┌────────────────▼────────────────────────────┐
│     SQLite WASM + sqlite-vec Extension      │
│  - FTS5 (full-text search)                  │
│  - vec0 (vector search)                     │
│  - OPFS (persistence)                       │
└─────────────────────────────────────────────┘
```

### 2.2 Key Patterns Identified

#### 2.2.1 RPC Communication Pattern (src/utils/rpc.ts)
**Strengths**:
- Type-safe message passing with `WorkerRPC` and `WorkerRPCHandler`
- Built-in timeout handling (default 30s)
- Performance monitoring and metrics
- Error propagation with context preservation
- Rate limiting (max 10 concurrent operations)

**Usage Pattern**:
```typescript
// Client side (Database.ts)
this.workerRPC.call('methodName', params)

// Worker side (DatabaseWorker.ts)
this.rpcHandler.register('methodName', this.handleMethod.bind(this))
```

**Relevance for LLM**: This exact pattern can be extended for LLM operations with minimal changes.

#### 2.2.2 Modular Worker Architecture (src/database/worker/)
**Current Structure**:
```
src/database/worker/
├── core/
│   ├── DatabaseWorker.ts    # Main coordinator
│   ├── SQLiteManager.ts     # SQLite operations
│   └── OPFSManager.ts       # Persistence
├── embedding/
│   ├── EmbeddingQueue.ts    # Background processing
│   └── ProviderManager.ts   # Provider abstraction
├── handlers/
│   └── SearchHandler.ts     # Search logic
├── schema/
│   └── SchemaManager.ts     # Schema management
└── utils/
    ├── Logger.ts            # Centralized logging
    ├── ErrorHandling.ts     # Error utilities
    └── TypeGuards.ts        # Type validation
```

**Relevance for LLM**: The `/embedding/` module structure provides a blueprint for creating parallel `/llm/` module.

#### 2.2.3 Provider Abstraction Pattern (src/embedding/)
**Current Implementation**:
- `BaseProvider.ts` - Abstract base class
- `TransformersProvider.ts` - Local browser-based embeddings (Transformers.js)
- `OpenAIProvider.ts` - External API provider
- `ExternalProvider.ts` - Generic HTTP endpoint
- `ProviderFactory.ts` - Factory pattern for instantiation

**Configuration Pattern**:
```typescript
interface CollectionEmbeddingConfig {
  provider: 'transformers' | 'openai' | 'external';
  model: string;
  apiKey?: string;
  endpoint?: string;
  dimensions: number;
}
```

**Relevance for LLM**: This exact pattern can be cloned for LLM providers.

#### 2.2.4 Queue Management Pattern (Phase 5 - Recently Completed)
**Features**:
- Priority-based scheduling
- Retry logic with exponential backoff
- Batch processing
- Status tracking
- Cross-browser compatibility

**API Pattern**:
```typescript
// Enqueue
await db.enqueueEmbedding({ collection, documents, priority })

// Process
await db.processEmbeddingQueue({ collection, batchSize })

// Status
await db.getQueueStatus(collection)

// Clear
await db.clearEmbeddingQueue({ collection, status })
```

**Relevance for LLM**: LLM operations could reuse queue infrastructure OR operate without queues (synchronous).

#### 2.2.5 Enhanced Search API (Task 6.1 - Recently Completed)
**Current Methods**:
- `searchText(query, options)` - Text-only with strategy selection
- `searchAdvanced(params)` - Explicit strategy control
- `searchGlobal(query, options)` - Cross-collection search

**SearchHandler Architecture**:
```typescript
class SearchHandler {
  - QueryAnalyzer: Analyzes query intent
  - StrategyEngine: Selects search strategy
  - ResultProcessor: Processes and ranks results
  - SearchOptimizer: Performance optimization
  - SearchAnalytics: Usage analytics
  - InternalPipeline: Embedding generation
}
```

**Relevance for LLM**: Query enhancement and result summarization would integrate with SearchHandler.

### 2.3 Internal Objects Relevant to LLM Integration

#### 2.3.1 Search Flow Objects

**QueryAnalysis** (from QueryAnalyzer):
```typescript
interface QueryAnalysis {
  originalQuery: string;
  normalizedQuery: string;
  queryType: QueryType;
  confidence: number;
  features: QueryFeatures;
  suggestedStrategy: SearchStrategy;
  alternativeStrategies: SearchStrategy[];
}
```

**SearchResult** (from worker.ts):
```typescript
interface SearchResult {
  id: string;
  title: string;
  content: string;
  metadata?: Record<string, any>;
  score: number;
  ftsScore?: number;
  vecScore?: number;
}
```

**Relevance**: LLM could enhance `QueryAnalysis` and summarize `SearchResult[]`.

#### 2.3.2 Database Schema Objects

**Collections Table** (schema v2):
```sql
CREATE TABLE collections (
  name TEXT PRIMARY KEY,
  dimensions INTEGER,
  embedding_provider TEXT,
  embedding_dimensions INTEGER,
  embedding_status TEXT,
  processing_status TEXT,
  created_at INTEGER,
  updated_at INTEGER
);
```

**Relevance**: Could add `llm_provider`, `llm_config` columns for LLM configuration per collection.

#### 2.3.3 Configuration Objects

**DatabaseConfig** (src/types/database.ts):
```typescript
interface DatabaseConfig {
  filename?: string;
  workerUrl?: string;
  workerConfig?: WorkerConfig;
}
```

**WorkerConfig** (src/types/worker.ts):
```typescript
interface WorkerConfig {
  maxConcurrentOperations?: number;
  operationTimeout?: number;
  enablePerformanceMonitoring?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}
```

**Relevance**: LLM config would be passed through DatabaseConfig or method-level options.

### 2.4 Integration Points Identified

#### 2.4.1 Database Class (src/database/Database.ts)
**Potential LLM Methods**:
```typescript
// Query Enhancement
async enhanceQuery(query: string, options?: LLMOptions): Promise<EnhancedQuery>

// Result Summarization
async summarizeResults(results: SearchResult[], options?: LLMOptions): Promise<Summary>

// Combined Search with LLM
async searchWithLLM(query: string, options?: SearchWithLLMOptions): Promise<LLMSearchResponse>
```

#### 2.4.2 DatabaseWorker Class (src/database/worker/core/DatabaseWorker.ts)
**RPC Handler Registration**:
```typescript
// In setupRPCHandlers()
this.rpcHandler.register('enhanceQuery', this.handleEnhanceQuery.bind(this));
this.rpcHandler.register('summarizeResults', this.handleSummarizeResults.bind(this));
this.rpcHandler.register('searchWithLLM', this.handleSearchWithLLM.bind(this));
```

#### 2.4.3 New LLM Module Structure
**Proposed Structure** (parallel to `/embedding/`):
```
src/llm/
├── providers/
│   ├── BaseLLMProvider.ts
│   ├── OpenAIProvider.ts
│   ├── OpenRouterProvider.ts
│   └── CustomProvider.ts
├── LLMOrchestrator.ts      # Coordinates LLM operations
├── PromptTemplates.ts      # Query/summary prompts
├── types.ts                # LLM-specific types
└── errors.ts               # LLM-specific errors
```

**Worker-side**:
```
src/database/worker/llm/
├── LLMManager.ts           # Manages LLM providers in worker
└── LLMHandler.ts           # RPC handlers for LLM operations
```

### 2.5 Constraints and Considerations

#### 2.5.1 Browser Environment Constraints
- **No native HTTP client in Worker**: Must use `fetch()` API
- **CORS limitations**: LLM API endpoints must support CORS or use proxy
- **No streaming in Worker**: Full response buffering required
- **API key security**: Must be provided by user, not embedded in code

#### 2.5.2 Performance Constraints
- **Network latency**: LLM API calls add 500ms-5s latency
- **No blocking main thread**: All LLM operations must be async
- **Graceful degradation**: Search must work without LLM
- **Timeout handling**: LLM calls need configurable timeouts

#### 2.5.3 Architectural Constraints
- **Modularity**: LLM module must not affect core search
- **sql.js compatibility**: Database interface must remain unchanged
- **Worker RPC**: All LLM operations must use existing RPC pattern
- **Type safety**: Full TypeScript typing required

### 2.6 Reusable Patterns for LLM Integration

#### Pattern 1: Provider Abstraction
**Reuse**: Clone `BaseProvider` → `BaseLLMProvider`
```typescript
abstract class BaseLLMProvider {
  abstract enhance(query: string, context?: any): Promise<EnhancedQuery>;
  abstract summarize(results: any[], context?: any): Promise<Summary>;
  protected validateConfig(config: LLMProviderConfig): void;
  protected handleError(error: Error): never;
}
```

#### Pattern 2: RPC Registration
**Reuse**: Exact same pattern as embedding operations
```typescript
// Database.ts
async enhanceQuery(query: string, options?: LLMOptions) {
  if (!this.workerRPC) throw new DatabaseError('Worker not available');
  return await this.workerRPC.enhanceQuery({ query, options });
}

// DatabaseWorker.ts
private async handleEnhanceQuery(params: EnhanceQueryParams) {
  this.ensureInitialized();
  return this.withContext('enhanceQuery', async () => {
    return await this.llmManager.enhanceQuery(params.query, params.options);
  });
}
```

#### Pattern 3: Error Handling
**Reuse**: `ErrorHandler.withContext()` from `src/database/worker/utils/ErrorHandling.ts`
```typescript
return ErrorHandler.withContext('llmOperation', 'LLMManager', async () => {
  // LLM operation
});
```

#### Pattern 4: Logging
**Reuse**: `Logger` from `src/database/worker/utils/Logger.ts`
```typescript
this.logger.info('Starting LLM query enhancement', { query });
this.logger.error('LLM API call failed', { error, provider });
```

## 3. Enhanced Task Description

### 3.1 Task Overview
Implement LLM provider connections to enable **query enhancement** and **result summarization** features in LocalRetrieve's browser-based hybrid search system. The implementation will follow LocalRetrieve's modular worker architecture, reusing existing RPC patterns and provider abstraction.

### 3.2 Functional Requirements

#### FR1: Query Enhancement
- **Input**: User's raw search query
- **Processing**: LLM expands, clarifies, and suggests alternative phrasings
- **Output**: Enhanced query with suggestions and intent analysis
- **Integration**: Optionally used before executing search

#### FR2: Result Summarization
- **Input**: Array of search results
- **Processing**: LLM generates concise summary of key findings
- **Output**: Executive summary with key points and themes
- **Integration**: Displayed alongside or instead of raw results

#### FR3: Provider Support
- **OpenAI**: GPT-4, GPT-3.5-turbo
- **OpenRouter**: Multi-model support (Claude, Gemini, etc.)
- **Custom Endpoint**: Generic HTTP endpoint for self-hosted models

#### FR4: Configuration Management
- **Per-Collection Configuration**: Each collection can have its own LLM provider
- **Runtime Configuration**: API keys and endpoints configurable at runtime
- **Fallback Strategy**: Graceful degradation when LLM unavailable

### 3.3 Technical Requirements

#### TR1: Architecture Alignment
- Create `/src/llm/` module parallel to `/src/embedding/`
- Create `/src/database/worker/llm/` for worker-side logic
- Use existing RPC patterns from `src/utils/rpc.ts`
- Follow modular worker structure

#### TR2: Type Safety
- Define comprehensive TypeScript interfaces for all LLM operations
- Extend `WorkerMethodName` union type with LLM methods
- Create type guards for LLM parameter validation

#### TR3: Error Handling
- Reuse `ErrorHandler.withContext()` pattern
- Define `LLMError` class extending base error types
- Implement timeout and retry logic

#### TR4: Performance
- Configurable timeouts (default 10s for query enhancement, 30s for summarization)
- No blocking operations on main thread
- Performance monitoring via existing metrics system

#### TR5: Testing
- Unit tests for LLM providers
- Integration tests for RPC communication
- E2E tests in demo application
- Cross-browser compatibility tests

### 3.4 API Design Specification

#### Public API (Database.ts)
```typescript
// Query Enhancement
async enhanceQuery(
  query: string,
  options?: {
    provider?: string;
    model?: string;
    maxSuggestions?: number;
    includeIntent?: boolean;
  }
): Promise<{
  originalQuery: string;
  enhancedQuery: string;
  suggestions: string[];
  intent?: string;
  confidence: number;
}>;

// Result Summarization
async summarizeResults(
  results: SearchResult[],
  options?: {
    provider?: string;
    model?: string;
    maxLength?: number;
    includeKeyPoints?: boolean;
  }
): Promise<{
  summary: string;
  keyPoints: string[];
  themes: string[];
  confidence: number;
}>;

// Combined Search with LLM
async searchWithLLM(
  query: string,
  options?: {
    enhanceQuery?: boolean;
    summarizeResults?: boolean;
    searchOptions?: TextSearchOptions;
    llmOptions?: LLMOptions;
  }
): Promise<{
  results: SearchResult[];
  enhancedQuery?: EnhancedQuery;
  summary?: ResultSummary;
  searchTime: number;
  llmTime: number;
}>;
```

### 3.5 Integration Strategy

#### Phase 1: LLM Provider Foundation (Days 1-2)
- Create `BaseLLMProvider` abstract class
- Implement `OpenAIProvider` with GPT-4/3.5 support
- Implement `OpenRouterProvider` with multi-model support
- Implement `CustomProvider` for generic endpoints
- Create `PromptTemplates` for query enhancement and summarization

#### Phase 2: Worker Integration (Days 3-4)
- Create `LLMManager` in worker context
- Implement RPC handlers in `DatabaseWorker`
- Register LLM methods in `WorkerRPCHandler`
- Add type definitions to `src/types/worker.ts`

#### Phase 3: Public API (Day 5)
- Add LLM methods to `Database` class
- Create RPC client methods in `WorkerRPC`
- Implement error handling and fallbacks
- Add configuration options to `DatabaseConfig`

#### Phase 4: Testing & Demo (Days 6-7)
- Write unit tests for LLM providers
- Create integration tests for RPC flow
- Extend demo application with LLM features
- Cross-browser testing

#### Phase 5: Optimization & Documentation (Days 8-9)
- Performance optimization
- Caching strategy for repeated queries
- API documentation updates
- README examples

### 3.6 Non-Functional Requirements

#### NFR1: Security
- API keys must not be logged or exposed
- Support for environment variable injection
- CORS-aware error messages

#### NFR2: Usability
- Clear error messages for configuration issues
- Helpful warnings for missing API keys
- Progressive enhancement (works without LLM)

#### NFR3: Maintainability
- Consistent code style with existing codebase
- Comprehensive JSDoc comments
- Example usage in demo application

#### NFR4: Performance
- LLM calls must not block core search functionality
- Configurable timeouts with reasonable defaults
- Metrics for monitoring LLM performance

## 4. Dependencies and Prerequisites

### 4.1 Existing Infrastructure
✅ **RPC System**: `src/utils/rpc.ts` - fully functional
✅ **Worker Architecture**: Modular structure in place
✅ **Provider Pattern**: Established in `/embedding/` module
✅ **Error Handling**: `ErrorHandler` utility available
✅ **Logging**: `Logger` utility available
✅ **Type Guards**: Pattern established in `TypeGuards.ts`

### 4.2 External Dependencies
- **No new npm packages required** - use native `fetch()` API
- **Optional**: Type definitions for OpenAI/OpenRouter APIs

### 4.3 Configuration Requirements
- User must provide API keys for LLM providers
- Demo must include configuration UI for API keys
- Environment variable support for CI/CD testing

## 5. Risk Assessment

### Low Risks
- Architecture alignment (reusing proven patterns)
- Type safety (TypeScript throughout)
- Modularity (isolated LLM module)

### Medium Risks
- API key management (security considerations)
- Network latency (unavoidable, mitigated by timeout)
- CORS issues (provider-dependent, documented)

### High Risks
- None identified

## 6. Success Metrics

### Functional Metrics
- ✅ LLM providers configurable and operational
- ✅ Query enhancement returns valid suggestions
- ✅ Result summarization produces coherent text
- ✅ Demo application showcases all features

### Performance Metrics
- ⏱️ Query enhancement < 3 seconds average
- ⏱️ Result summarization < 5 seconds average
- 🚫 Zero impact on core search performance
- 📊 LLM operations tracked in performance metrics

### Quality Metrics
- 🧪 Unit test coverage > 80%
- 🌐 Cross-browser compatibility (Chrome, Firefox, Safari, Edge)
- 📖 API documentation complete
- 🎨 Demo application includes LLM examples

## 7. Next Steps

1. ✅ **Research Phase**: Identify 3 best open-source JS LLM integration solutions
2. 📋 **Design Phase**: Create detailed technical specification
3. 💻 **Implementation Phase**: Follow 5-phase integration strategy
4. 🧪 **Testing Phase**: Comprehensive testing across browsers
5. 📚 **Documentation Phase**: Update README and API docs
6. 🚀 **Demo Phase**: Integrate into demo application

---

**Document Status**: Analysis Complete
**Next Action**: Launch research agent to identify best-practice solutions
**Estimated Research Time**: 2-3 hours
**Estimated Implementation Time**: 6-10 days
