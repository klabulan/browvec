# Phase 6: Hybrid Search Enhancement with Text-Only Input and Internal Embedding

**Phase ID**: TASK-004-Phase-6
**Priority**: High
**Status**: Planning
**Target Sprint**: Next
**Estimated Effort**: 8 story points
**Dependencies**: Phase 5 (✅ COMPLETED)

## Overview

Phase 6 focuses on enhancing LocalRetrieve's hybrid search capabilities to provide seamless text-only search with automatic internal embedding generation, making semantic search more accessible and user-friendly.

## Business Objectives

### Primary Goals
1. **Simplified Search API**: Enable hybrid search using only text input - no manual embedding required
2. **Automatic Embedding Generation**: Generate embeddings on-demand for queries and documents
3. **Intelligent Search Routing**: Automatically determine optimal search strategy (text, semantic, or hybrid)
4. **Enhanced User Experience**: Provide fast, relevant results with minimal configuration

### Success Metrics
- **Query Response Time**: < 500ms for text-only hybrid search
- **Relevance Score**: Improved search results through intelligent weighting
- **Adoption Rate**: 90% of searches use simplified text-only API
- **User Satisfaction**: Reduced configuration complexity by 80%

## Technical Architecture

### 1. Enhanced Hybrid Search API

#### New Search Methods
```typescript
interface HybridSearchAPI {
  /**
   * Primary text-only hybrid search - automatically combines FTS + semantic
   */
  searchText(params: {
    query: string;
    collection?: string;  // Optional - defaults to 'default'
    options?: {
      mode?: 'hybrid' | 'semantic' | 'text' | 'auto';  // 'auto' is default
      limit?: number;
      threshold?: number;
      weights?: { text: number; semantic: number };
    }
  }): Promise<EnhancedSearchResult[]>;

  /**
   * Advanced hybrid search with query expansion
   */
  searchAdvanced(params: {
    query: string;
    collection?: string;
    options?: {
      expandQuery?: boolean;        // Auto-generate related terms
      includeSnippets?: boolean;    // Include highlighted text snippets
      rerank?: boolean;             // Apply ML-based reranking
      diversity?: number;           // Result diversity factor
    }
  }): Promise<AdvancedSearchResult[]>;

  /**
   * Multi-collection search across all collections
   */
  searchGlobal(params: {
    query: string;
    collections?: string[];        // If not specified, search all
    options?: GlobalSearchOptions;
  }): Promise<GlobalSearchResult[]>;
}
```

#### Enhanced Result Types
```typescript
interface EnhancedSearchResult {
  id: string;
  content: string;
  collection: string;
  relevanceScore: number;       // Combined relevance (0-1)
  textScore?: number;          // FTS score component
  semanticScore?: number;      // Vector similarity component
  snippet?: string;            // Highlighted text snippet
  metadata?: Record<string, unknown>;
  searchMode: 'text' | 'semantic' | 'hybrid';
}

interface AdvancedSearchResult extends EnhancedSearchResult {
  expandedTerms?: string[];    // Auto-generated related terms
  rerankScore?: number;        // ML reranking score
  diversityFactor?: number;    // Diversity contribution
}

interface GlobalSearchResult extends EnhancedSearchResult {
  collectionInfo: {
    name: string;
    embeddingProvider: string;
    documentCount: number;
  };
}
```

### 2. Intelligent Search Strategy Engine

#### Auto-Mode Decision Logic
```typescript
interface SearchStrategyEngine {
  /**
   * Automatically determine optimal search strategy
   */
  determineSearchStrategy(query: string, collection: string): Promise<{
    strategy: 'text' | 'semantic' | 'hybrid';
    confidence: number;
    reasoning: string;
    weights?: { text: number; semantic: number };
  }>;

  /**
   * Query analysis and optimization
   */
  analyzeQuery(query: string): Promise<{
    type: 'keyword' | 'conceptual' | 'mixed';
    complexity: number;
    suggestedMode: SearchMode;
    expandedTerms?: string[];
  }>;
}
```

#### Strategy Rules
1. **Text Mode**: Short keyword queries, exact matches, structured data
2. **Semantic Mode**: Conceptual queries, natural language, context-dependent
3. **Hybrid Mode**: Mixed queries, when both modes provide value
4. **Auto Mode**: Machine learning-based decision with fallback rules

### 3. Internal Embedding Pipeline

#### On-Demand Embedding Generation
```typescript
interface InternalEmbeddingPipeline {
  /**
   * Generate embeddings on-demand for queries
   */
  generateQueryEmbedding(params: {
    query: string;
    collection: string;
    cache?: boolean;  // Cache for repeated queries
  }): Promise<Float32Array>;

  /**
   * Background embedding for documents with queue management
   */
  enqueueDocumentEmbedding(params: {
    documentId: string;
    content: string;
    collection: string;
    priority?: 'low' | 'normal' | 'high';
  }): Promise<void>;

  /**
   * Batch embedding generation with progress tracking
   */
  generateBatchEmbeddings(params: {
    items: Array<{ id: string; content: string; collection: string }>;
    onProgress?: (completed: number, total: number) => void;
  }): Promise<BatchEmbeddingResult>;
}
```

#### Smart Caching System
```typescript
interface EmbeddingCacheManager {
  /**
   * Cache query embeddings for repeated searches
   */
  cacheQueryEmbedding(query: string, embedding: Float32Array, ttl?: number): Promise<void>;

  /**
   * Retrieve cached query embedding
   */
  getCachedEmbedding(query: string): Promise<Float32Array | null>;

  /**
   * Cache management and cleanup
   */
  cleanupExpiredCache(): Promise<number>;
  getCacheStats(): Promise<CacheStats>;
}
```

### 4. Enhanced Database Schema (v2.1)

#### Query Cache Table
```sql
CREATE TABLE IF NOT EXISTS query_embedding_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query_hash TEXT UNIQUE NOT NULL,
  query_text TEXT NOT NULL,
  embedding BLOB NOT NULL,
  collection_name TEXT NOT NULL,
  provider TEXT NOT NULL,
  dimensions INTEGER NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  expires_at INTEGER,
  hit_count INTEGER DEFAULT 0,
  last_used INTEGER DEFAULT (strftime('%s', 'now'))
);
```

#### Search Analytics Table
```sql
CREATE TABLE IF NOT EXISTS search_analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query_text TEXT NOT NULL,
  search_mode TEXT NOT NULL,
  collection_name TEXT,
  result_count INTEGER,
  response_time_ms INTEGER,
  relevance_scores TEXT, -- JSON array of scores
  user_feedback INTEGER, -- Optional user rating
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
```

### 5. Performance Optimizations

#### Embedding Model Management
```typescript
interface ModelManager {
  /**
   * Pre-load and warm up embedding models
   */
  preloadModels(providers: string[]): Promise<void>;

  /**
   * Model lifecycle management
   */
  getModelStatus(provider: string): Promise<ModelStatus>;
  unloadModel(provider: string): Promise<void>;

  /**
   * Memory optimization
   */
  optimizeMemoryUsage(): Promise<MemoryStats>;
}
```

#### Search Result Optimization
```typescript
interface SearchOptimizer {
  /**
   * Optimize search results through ML ranking
   */
  rerankResults(results: SearchResult[], query: string): Promise<SearchResult[]>;

  /**
   * Apply result diversity algorithms
   */
  diversifyResults(results: SearchResult[], factor: number): Promise<SearchResult[]>;

  /**
   * Generate contextual snippets
   */
  generateSnippets(results: SearchResult[], query: string): Promise<SearchResult[]>;
}
```

## Implementation Features

### Feature 1: Text-Only Hybrid Search API
**Effort**: 3 story points

#### Implementation Tasks
1. **Enhanced Database API** (`src/database/Database.ts`)
   - Add `searchText()` method with auto-mode detection
   - Implement `searchAdvanced()` with query expansion
   - Add `searchGlobal()` for multi-collection search

2. **Search Strategy Engine** (`src/search/StrategyEngine.ts`)
   - Query analysis and classification logic
   - Automatic search mode determination
   - Weight optimization for hybrid results

3. **Result Enhancement** (`src/search/ResultProcessor.ts`)
   - Score normalization and combination
   - Snippet generation with highlighting
   - Relevance scoring improvements

### Feature 2: Internal Embedding Generation
**Effort**: 2 story points

#### Implementation Tasks
1. **On-Demand Pipeline** (`src/embedding/InternalPipeline.ts`)
   - Query embedding generation with caching
   - Background document processing integration
   - Batch processing with progress tracking

2. **Model Management** (`src/embedding/ModelManager.ts`)
   - Pre-loading and lifecycle management
   - Memory optimization for browser constraints
   - Provider switching and fallback logic

3. **Cache System** (`src/embedding/CacheManager.ts`)
   - Query embedding cache with TTL
   - LRU eviction policy
   - Performance monitoring and analytics

### Feature 3: Advanced Query Processing
**Effort**: 2 story points

#### Implementation Tasks
1. **Query Analyzer** (`src/search/QueryAnalyzer.ts`)
   - Natural language query classification
   - Intent detection and expansion
   - Keyword extraction and weighting

2. **Search Optimizer** (`src/search/SearchOptimizer.ts`)
   - ML-based result reranking
   - Diversity algorithms implementation
   - Contextual snippet generation

3. **Analytics Integration** (`src/analytics/SearchAnalytics.ts`)
   - Search performance tracking
   - User feedback collection
   - Query optimization insights

### Feature 4: Demo Integration and UI
**Effort**: 1 story point

#### Implementation Tasks
1. **Demo Enhancement** (`examples/web-client/`)
   - Text-only search interface
   - Auto-mode demonstration
   - Performance metrics display

2. **API Documentation** (`doc/`)
   - Text-only search guide
   - Integration examples
   - Best practices documentation

## Testing Strategy

### Test Coverage Areas

#### Unit Tests
- Search strategy engine logic
- Query analysis algorithms
- Embedding cache management
- Result processing and scoring

#### Integration Tests (E2E)
- Text-only hybrid search flows
- Auto-mode decision accuracy
- Cross-browser embedding generation
- Performance benchmarks

#### Performance Tests
- Query response time validation
- Memory usage monitoring
- Cache hit rate optimization
- Concurrent search handling

### Acceptance Criteria

#### Feature Acceptance
- [ ] Text-only search returns relevant results in < 500ms
- [ ] Auto-mode selects appropriate search strategy 95% accuracy
- [ ] Embedding cache improves repeated query performance by 80%
- [ ] Global search covers all collections with unified results
- [ ] Memory usage stays under 150MB with multiple models loaded

#### Quality Criteria
- [ ] TypeScript strict mode compliance
- [ ] 95% test coverage for new features
- [ ] Cross-browser compatibility (Chrome, Firefox, Safari, Edge)
- [ ] No breaking changes to existing API
- [ ] Comprehensive error handling and recovery

## Migration Plan

### Phase 6.1: Core Text-Only Search (Week 1)
- Implement `searchText()` API with basic hybrid mode
- Add search strategy engine with rule-based decisions
- Create result enhancement and scoring system

### Phase 6.2: Internal Embedding Pipeline (Week 2)
- Build on-demand embedding generation
- Implement query embedding cache
- Add model management and optimization

### Phase 6.3: Advanced Features (Week 3)
- Add query analysis and expansion
- Implement ML-based reranking
- Create global multi-collection search

### Phase 6.4: Integration and Testing (Week 4)
- Update demo application with new features
- Complete comprehensive test suite
- Performance optimization and tuning

## Risk Assessment

### Technical Risks
- **Model Loading Performance**: Large embedding models may impact initial load time
  - *Mitigation*: Implement progressive loading and model caching
- **Memory Constraints**: Multiple models may exceed browser memory limits
  - *Mitigation*: Smart model lifecycle management and unloading
- **Search Latency**: Complex hybrid scoring may increase response time
  - *Mitigation*: Optimized algorithms and result caching

### Integration Risks
- **Backward Compatibility**: New API may conflict with existing usage
  - *Mitigation*: Maintain existing APIs and add new methods separately
- **Browser Support**: Advanced features may not work on older browsers
  - *Mitigation*: Feature detection and graceful degradation

## Success Criteria

### Performance Metrics
- **Query Response Time**: < 500ms for 95% of text-only searches
- **Cache Hit Rate**: > 70% for repeated queries
- **Memory Efficiency**: < 150MB peak usage with full feature set
- **Search Relevance**: > 85% user satisfaction in blind tests

### Adoption Metrics
- **API Usage**: 90% of new integrations use text-only search
- **Feature Coverage**: All major search patterns supported
- **Developer Experience**: < 10 lines of code for basic implementation
- **Documentation**: Comprehensive guides and examples available

## Next Steps

1. **Create Implementation Branches**
   - `feature/TASK-004-phase6-text-search`
   - `feature/TASK-004-phase6-embedding-pipeline`
   - `feature/TASK-004-phase6-advanced-features`

2. **Update Project Documentation**
   - Extend README.md with text-only search examples
   - Create integration guide for new APIs
   - Update CLAUDE.md with Phase 6 requirements

3. **Coordinate with Existing Work**
   - Build on Phase 5 queue management system
   - Integrate with existing embedding providers
   - Maintain compatibility with current demo

---

**Status**: Ready for implementation planning and sprint allocation
**Estimated Delivery**: 4 weeks (32 story points total across all features)
**Priority**: High - Core user experience enhancement