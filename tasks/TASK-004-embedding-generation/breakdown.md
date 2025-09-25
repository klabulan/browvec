# TASK-004: Embedding Generation Support - Implementation Breakdown

## Sprint Planning

**Total Effort**: 10 story points
**Estimated Duration**: 1.5-2 weeks
**Sprint Assignment**: Current sprint
**Dependencies**: Core LocalRetrieve architecture (completed)
**Scope**: MVP with collection-level embedding configuration

## Work Breakdown Structure

### Phase 1: Foundation and Infrastructure (3 story points)

#### Task 1.1: Collection-Level Embedding Foundation
**Effort**: 1.5 story points
**Duration**: 1-2 days

**Implementation Steps**:
1. Create `src/embedding/` directory structure
2. Define `EmbeddingProvider` interface with fixed dimensions per instance
3. Create `CollectionEmbeddingConfig` and collection management types
4. Implement `EmbeddingError` class hierarchy
5. Add collection-specific embedding configuration schema

**Files to Create/Modify**:
- `src/embedding/providers/BaseProvider.ts`
- `src/embedding/types.ts`
- `src/embedding/errors.ts`
- `src/types/index.ts` (extend exports)

**Acceptance Criteria**:
- [ ] EmbeddingProvider interface supports fixed dimensions per instance
- [ ] Collection-level embedding configuration defined
- [ ] Type definitions are complete and exported
- [ ] Error classes handle all failure scenarios
- [ ] Code follows TypeScript strict mode requirements

#### Task 1.2: Text Processing and Utilities
**Effort**: 1 story point
**Duration**: 1 day

**Implementation Steps**:
1. Implement `TextProcessor` class for text normalization
2. Create hashing utilities for cache keys
3. Implement text truncation and preprocessing
4. Add text cleaning for different document formats

**Files to Create/Modify**:
- `src/embedding/TextProcessor.ts`
- `src/embedding/utils.ts`

**Acceptance Criteria**:
- [ ] Text preprocessing handles HTML/markdown removal
- [ ] Consistent hashing for cache keys
- [ ] Proper text truncation to model limits
- [ ] Unit tests for all text processing functions

#### Task 1.3: Simple Embedding Cache
**Effort**: 0.5 story points
**Duration**: 0.5 day

**Implementation Steps**:
1. Implement basic in-memory LRU cache
2. Simple cache key generation (text hash + collection config)
3. Basic cache metrics

**Files to Create/Modify**:
- `src/embedding/cache/MemoryCache.ts`

**Acceptance Criteria**:
- [ ] Simple LRU cache with configurable size limits
- [ ] Cache key includes collection configuration
- [ ] Basic cache hit/miss tracking
- [ ] Proper memory cleanup

### Phase 2: Local Embedding Provider (2 story points)

#### Task 2.1: Transformers.js Integration (MVP)
**Effort**: 1.5 story points
**Duration**: 1-2 days

**Implementation Steps**:
1. Focus on single model: all-MiniLM-L6-v2 (384-dim)
2. Implement `TransformersProvider` class for 384-dim embeddings
3. Set up Web Worker for model loading and inference
4. Handle model downloading and caching
5. Basic batch processing (simple implementation)

**Files to Create/Modify**:
- `src/embedding/providers/TransformersProvider.ts`
- `src/embedding/workers/transformers-worker.ts`
- Package.json (add @xenova/transformers dependency)

**Technical Considerations**:
- Model loading time optimization
- Memory usage management
- Progressive loading indicators
- Offline capability

**Acceptance Criteria**:
- [ ] Transformers.js all-MiniLM-L6-v2 model loads successfully in Web Worker
- [ ] Generates 384-dimensional embeddings
- [ ] Basic batch processing works
- [ ] Memory usage stays within reasonable limits
- [ ] Error handling for model loading failures

#### Task 2.2: Basic Performance Optimization
**Effort**: 0.5 story points
**Duration**: 0.5 day

**Implementation Steps**:
1. Implement lazy loading for embedding model
2. Basic memory cleanup
3. Simple performance metrics

**Files to Modify**:
- `src/embedding/providers/TransformersProvider.ts`
- `src/embedding/workers/transformers-worker.ts`

**Acceptance Criteria**:
- [ ] Model loads only when first embedding requested
- [ ] Basic memory cleanup when provider disposed
- [ ] Simple performance metrics tracked

### Phase 3: External API Provider (1.5 story points)

#### Task 3.1: OpenAI Provider Implementation (MVP)
**Effort**: 1 story point
**Duration**: 1 day

**Implementation Steps**:
1. Implement `OpenAIProvider` class for fixed dimensions
2. Support text-embedding-3-small with configurable dimensions (384, 768, 1536)
3. Handle API authentication and requests
4. Basic rate limiting and retry logic
5. Error handling for API failures

**Files to Create/Modify**:
- `src/embedding/providers/OpenAIProvider.ts`
- `src/embedding/providers/ExternalProvider.ts` (base class)

**Acceptance Criteria**:
- [ ] Successfully generates embeddings via OpenAI API
- [ ] Supports text-embedding-3-small with dimension configuration
- [ ] Basic rate limiting and retry logic
- [ ] Secure API key handling (no storage)
- [ ] Error handling for authentication and network issues

#### Task 3.2: Provider Factory (Simple)
**Effort**: 0.5 story points
**Duration**: 0.5 day

**Implementation Steps**:
1. Create simple provider factory for Transformers.js and OpenAI
2. Basic configuration validation
3. Document provider setup

**Files to Create/Modify**:
- `src/embedding/ProviderFactory.ts`

**Acceptance Criteria**:
- [ ] Provider factory supports Transformers.js and OpenAI
- [ ] Basic configuration validation
- [ ] Clear documentation for provider setup

### Phase 4: Collection Integration (2 story points)

#### Task 4.1: Collection-Based Database Extensions
**Effort**: 1.5 story points
**Duration**: 1-2 days

**Implementation Steps**:
1. Add collection management to Database class
2. Implement collection-specific vector table creation
3. Add collection-aware embedding methods
4. Implement `createCollection` with embedding config
5. Add `insertDocumentWithEmbedding` for collections
6. Add `searchSemantic` with optional embedding inclusion

**Files to Modify**:
- `src/database/Database.ts`
- `src/index.ts` (exports)
- `src/types/index.ts` (type definitions)

**Acceptance Criteria**:
- [ ] Collection-specific vector table creation
- [ ] Search results can optionally include embedding vectors
- [ ] New methods maintain sql.js compatibility
- [ ] Embedding generation is optional and backward compatible
- [ ] Proper error handling for embedding failures
- [ ] TypeScript types updated for new methods

#### Task 4.2: Worker RPC Integration
**Effort**: 0.5 story points
**Duration**: 0.5 day

**Implementation Steps**:
1. Extend RPC command interface for collection-based embedding operations
2. Update worker to handle collection-specific embedding requests
3. Basic progress reporting for batch operations

**Files to Modify**:
- `src/utils/rpc.ts`
- `src/database/worker.ts`

**Acceptance Criteria**:
- [ ] RPC commands support collection-based embedding operations
- [ ] Worker handles embedding requests without blocking SQL operations
- [ ] Basic progress reporting works for batch operations
- [ ] Proper error propagation through RPC layer

### Phase 5: Collection Schema (1 story point)

#### Task 5.1: Collection Schema Implementation
**Effort**: 1 story point
**Duration**: 1 day

**Implementation Steps**:
1. Add collections table for embedding configurations
2. Extend schema initialization for collection support
3. Add embedding queue table

**Files to Modify**:
- `src/database/worker.ts` (schema initialization)
- Database schema definitions

**Acceptance Criteria**:
- [x] Collections table supports embedding configurations
- [x] Schema supports collection-based embedding metadata
- [x] No breaking changes to existing functionality
- [x] Embedding queue table implemented for background processing
- [x] Schema migration system (v1 → v2) implemented
- [x] Modular worker architecture refactoring completed
- [x] Comprehensive E2E tests created (91 test scenarios)
- [x] RPC interface extended for queue management
- [x] TypeScript strict mode compliance maintained

### Phase 6: Demo and Documentation (0.5 story points)

#### Task 6.1: Demo Application Updates (MVP)
**Effort**: 0.5 story points
**Duration**: 0.5 day

**Implementation Steps**:
1. Add collection creation with embedding provider selection
2. Show embedding generation progress
3. Demonstrate semantic search capabilities
4. Basic performance metrics display

**Files to Modify**:
- `examples/web-client/demo.js`
- `examples/web-client/index.html`

**Acceptance Criteria**:
- [ ] Demo showcases collection creation with embedding config
- [ ] Both local (Transformers.js) and external (OpenAI) providers work
- [ ] Clear indication of embedding generation status
- [ ] Basic performance metrics visible
- [ ] Error states handled gracefully in UI

## Implementation Priority and Dependencies

### Critical Path (MVP)
1. **Foundation** (Task 1.1-1.3) → **Local Provider** (Task 2.1-2.2) → **Collection Integration** (Task 4.1-4.2)
2. **External Providers** (Task 3.1-3.2) can be developed in parallel with local provider
3. **Schema** (Task 5.1) depends on integration completion
4. **Demo** (Task 6.1) final phase after all features complete

### Dependency Graph
```mermaid
graph TD
    A[1.1 Collection Foundation] --> B[1.2 Text Processing]
    A --> C[1.3 Simple Cache]
    A --> D[2.1 Transformers Provider]
    A --> E[3.1 OpenAI Provider]

    B --> D
    C --> D
    C --> E

    D --> F[2.2 Basic Optimization]
    E --> G[3.2 Provider Factory]

    F --> H[4.1 Collection Database Extensions]
    G --> H

    H --> I[4.2 Worker RPC]
    I --> J[5.1 Collection Schema]

    J --> K[6.1 Demo Updates]
```

## Risk Assessment and Mitigation

### High-Risk Items

#### Risk 1: Transformers.js Model Size and Loading Time
**Impact**: High - Poor user experience if model takes too long to load
**Probability**: Medium
**Mitigation**:
- Use optimized all-MiniLM-L6-v2 model (384-dim, smaller)
- Implement progressive loading with clear user feedback
- Cache model files using browser cache APIs
- Provide fallback to external APIs if local loading fails

#### Risk 2: Collection Migration Complexity
**Impact**: Medium - Could break existing databases
**Probability**: Low
**Mitigation**:
- Simple migration strategy (create default collection)
- Thorough testing with existing demo data
- Backward compatibility maintained
- Clear error messages for migration issues

### Medium-Risk Items

#### Risk 3: Browser Compatibility for Local Models
**Impact**: Medium - Some browsers may not support Transformers.js
**Probability**: Low
**Mitigation**:
- Test across all target browsers
- Graceful fallback to external providers
- Clear error messages for unsupported environments

## Testing Strategy Integration

### Unit Testing
- Each provider class with mocked dependencies
- Text processing functions with various inputs
- Cache management with different scenarios
- Collection configuration validation

### Integration Testing
- Full embedding generation pipeline
- Collection-based database operations
- Worker communication for embedding operations
- Cross-browser compatibility testing

### Performance Testing
- Embedding generation speed benchmarks
- Memory usage monitoring
- Collection-specific performance metrics

### Demo Testing
- End-to-end user workflows
- Error scenario handling
- Performance under various loads
- Cross-browser compatibility

## Definition of Done (MVP)

### Code Requirements
- [ ] All TypeScript strict mode compliance
- [ ] Unit tests with >80% coverage for new code
- [ ] Integration tests for all major workflows
- [ ] Basic performance benchmarks meet requirements
- [ ] Cross-browser testing completed

### Functionality Requirements
- [ ] Collections can be created with embedding configuration
- [ ] Local embeddings work with Transformers.js (384-dim)
- [ ] External embeddings work with OpenAI API
- [ ] Search results can optionally include embedding vectors
- [ ] Demo showcases all basic functionality

### Quality Gates
- [ ] No breaking changes to existing APIs
- [ ] Backward compatibility maintained
- [ ] Security review completed for API key handling
- [ ] Basic performance impact assessment completed
- [ ] Memory usage stays within reasonable limits