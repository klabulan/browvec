# TASK-004: Embedding Generation Support

## Task Overview
**Task ID**: TASK-004-embedding-generation
**Priority**: High
**Status**: Planning
**Target Sprint**: Current
**Estimated Effort**: 13 story points

## Business Requirements

### Core Functionality
1. **Collection-Level Embedding Configuration**: Define embedding dimensions and provider at collection creation time
2. **Automatic Embedding Generation**: Generate embeddings for documents during indexing without requiring manual vector input
3. **Query Embedding**: Automatically generate embeddings for search queries to enable semantic search
4. **Multiple Provider Support**: Support both local (Transformers.js) and external (OpenAI, Cohere, etc.) embedding providers
5. **Per-Collection Dimensions**: Each collection can have different embedding dimensions (384, 768, 1536) based on its requirements
6. **Backward Compatibility**: Maintain existing manual vector input functionality while adding automatic generation

### User Experience Goals
- **Zero-configuration**: Basic embedding generation should work out-of-the-box with minimal setup
- **Performance**: Embedding generation should not block the main thread or significantly impact user experience
- **Flexibility**: Allow users to choose between local and external embedding providers based on their needs
- **Transparency**: Provide clear feedback on embedding generation progress and status

### Success Criteria
- Users can index documents without providing vectors and still get semantic search capabilities
- Search queries automatically generate embeddings for semantic matching
- Demo application showcases both local and external embedding providers
- Performance remains acceptable (< 2s for embedding generation of typical documents)
- Browser compatibility maintained across target browsers

## Technical Requirements

### Functional Requirements

#### FR-1: Collection-Level Embedding Configuration
- **Given** a user creates a new collection
- **When** specifying collection configuration
- **Then** the user can define embedding provider and dimensions for that collection
- **And** all documents in that collection use the same embedding configuration

#### FR-2: Document Embedding Generation
- **Given** a user inserts a document into a collection with embedding configuration
- **When** the document is indexed into the database
- **Then** the system automatically generates embeddings using the collection's configured dimensions
- **And** stores the embeddings in the collection's vector table

#### FR-3: Query Embedding Generation
- **Given** a user performs a semantic search on a specific collection
- **When** the search is executed
- **Then** the system automatically generates embeddings using the collection's configured provider and dimensions
- **And** uses the embeddings for vector similarity search within that collection

#### FR-4: Local Embedding Provider (Transformers.js)
- **Given** the system is configured for local embedding generation
- **When** embedding generation is requested
- **Then** use Transformers.js models running in Web Worker
- **And** ensure non-blocking operation on the main thread

#### FR-5: External Embedding Provider Support
- **Given** the system is configured with external API credentials
- **When** embedding generation is requested
- **Then** make HTTP requests to external embedding services (OpenAI, Cohere, etc.)
- **And** handle rate limiting and error scenarios gracefully

#### FR-6: Collection Embedding Configuration
- **Given** a user wants to customize embedding behavior for a collection
- **When** creating or configuring a collection
- **Then** allow specification of embedding provider, model, and dimensions for that collection
- **And** create collection-specific vector tables with appropriate dimensions
- **And** provide sensible defaults for collections without explicit embedding configuration

#### FR-7: Batch Processing
- **Given** multiple documents need embedding generation
- **When** batch operations are performed
- **Then** process embeddings efficiently in batches
- **And** provide progress feedback for large operations

#### FR-8: Multi-Collection Embedding Support
- **Given** a database with multiple collections having different embedding configurations
- **When** performing operations across collections
- **Then** the system correctly handles different embedding dimensions and providers per collection
- **And** maintains isolation between collection embedding configurations

### Non-Functional Requirements

#### NFR-1: Performance
- Local embedding generation: < 500ms per document (typical 200-word document)
- External API embedding: < 2s per document (network dependent)
- Batch processing: Utilize concurrency limits appropriately
- Memory usage: < 100MB additional for local models in Web Worker

#### NFR-2: Browser Compatibility
- Support same browser targets as core LocalRetrieve (Chrome 86+, Firefox 79+, Safari 15+)
- Graceful degradation when Web Workers or required APIs unavailable
- Handle different browser security policies for external API requests

#### NFR-3: Reliability
- Automatic retry logic for failed embedding requests
- Fallback mechanisms when embedding generation fails
- Proper error handling and user feedback
- Offline capability for local embeddings

#### NFR-4: Security
- Secure handling of external API keys (no storage in localStorage)
- HTTPS requirements for external API calls
- Input sanitization for embedding text
- Rate limiting protection for external APIs

### Integration Requirements

#### Database Integration
- Extend existing schema initialization to support embedding generation metadata
- Integrate with current OPFS persistence strategy
- Maintain compatibility with existing vector table structure
- Support both manual and automatic vector population

#### Worker Architecture Integration
- Utilize existing Web Worker infrastructure for non-blocking operations
- Extend RPC communication for embedding generation commands
- Integrate with current error handling and progress reporting systems
- Maintain 3-tier architecture pattern

#### API Compatibility
- Maintain sql.js compatibility for core database operations
- Extend Database class with embedding-aware methods
- Preserve existing manual vector input APIs
- Add optional embedding configuration to initialization

### Dependencies and Constraints

#### External Dependencies
- **Transformers.js**: For local embedding generation (browser-compatible)
- **External APIs**: OpenAI Embeddings API, Cohere Embed API (optional)
- **Web Workers**: Required for non-blocking local embedding processing
- **Fetch API**: For external embedding service integration

#### Technical Constraints
- Must work within existing WASM + Worker architecture
- Cannot break existing sql.js compatibility
- Must handle different dimensional vectors per collection (384, 768, 1536, etc.)
- Limited by browser security policies for external requests

#### Resource Constraints
- Local embedding models must fit in browser memory constraints
- External API usage subject to rate limits and costs
- Processing time must remain acceptable for user experience
- Bundle size impact should be minimized

### Error Scenarios

1. **Local Model Loading Failure**: Graceful fallback or clear error messaging
2. **External API Unavailable**: Retry logic and fallback to cached/manual vectors
3. **Unsupported Text Input**: Proper validation and error handling
4. **Memory Constraints**: Efficient memory management and cleanup
5. **Network Issues**: Offline handling and request queuing
6. **Invalid API Keys**: Clear authentication error messages

### Success Metrics

- **Adoption**: % of documents indexed using automatic embedding generation
- **Performance**: Average embedding generation time per document
- **Reliability**: Error rate for embedding generation operations
- **User Experience**: Time from document input to searchable state
- **Compatibility**: Browser support coverage maintained
- **Collection Flexibility**: Support for different embedding configurations per collection
- **Dimension Isolation**: Proper isolation of embedding dimensions between collections