# Implementation Plan

## MVP Scope (Priority: High)
Core hybrid retrieval with BM25 + Vector Search + Reciprocal Rank Fusion. This provides the essential semantic understanding without expensive LLM operations.

## Phase 2 Scope (Priority: Medium) 
Query expansion and LLM reranking for enhanced accuracy. These features add cost and latency but improve relevance for edge cases.

---

- [x] 1. Set up hybrid retrieval infrastructure and feature flags
  - Create HybridRetrievalConfig interface with all feature flags (RETRIEVAL_EMBEDDINGS, RETRIEVAL_EXPANSION, RETRIEVAL_RERANK)
  - Implement environment variable parsing with safe defaults (embeddings=on, expansion=auto, rerank=off)
  - Create HybridRetriever main class with constructor accepting config and FactbookService
  - Add health check methods and basic logging infrastructure for all retrieval components
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 9.1_

- [x] 2. Implement BM25 text retrieval component
  - Create BM25Retriever class that wraps existing FactbookService with BM25 scoring algorithm
  - Implement buildIndex method that creates term frequency and document frequency maps from factbook snippets
  - Write calculateBM25Score method using standard BM25 formula (k1=1.2, b=0.75) for term relevance scoring
  - Add search method that returns ranked results with BM25 scores and term match information
  - Create unit tests for BM25 scoring accuracy and performance (<50ms for typical queries)
  - _Requirements: 4.2, 2.1, 2.2_

- [x] 3. Create embedding service and vector storage infrastructure
  - Implement EmbeddingService class with pluggable model support (default: OpenAI text-embedding-3-small, 1536 dimensions)
  - Create EmbeddingCache interface with file-based persistence for embedding storage and retrieval
  - Build EmbeddingStore class that saves/loads embeddings to JSON with version tracking for cache invalidation
  - Add embedding generation batch processing for all factbook snippets with progress logging
  - Implement embedding cache warming at server boot with fallback for cache misses
  - _Requirements: 5.3, 5.4, 5.5_

- [x] 4. Build vector search and similarity matching
  - Create VectorRetriever class with cosine similarity calculation for semantic search
  - Implement lightweight vector index using simple linear search (optimize to HNSW later if needed)
  - Add search method that finds top-k most similar snippets above similarity threshold (default 0.3)
  - Create getQueryEmbedding method with caching to avoid redundant OpenAI API calls
  - Write unit tests for semantic similarity accuracy using known related concept pairs
  - _Requirements: 1.1, 1.2, 1.3, 4.2_

- [x] 5. Implement result fusion with Reciprocal Rank Fusion
  - Create ResultFuser class that combines BM25 and vector search results using RRF algorithm
  - Implement reciprocalRankFusion method with configurable k parameter (default 60) for score combination
  - Add configurable fusion weights (default: BM25=0.6, vector=0.4) with environment variable override
  - Create fuse method that merges results, removes duplicates, and maintains snippet metadata
  - Write unit tests for fusion accuracy and deterministic ranking with various input combinations
  - _Requirements: 4.2, 4.3_

- [x] 6. **[Phase 2]** Add low-confidence detection and query expansion triggering
  - Implement confidence scoring: low confidence = top score < 0.35 OR fewer than 2 results above 0.3 threshold
  - Create QueryExpander class with OpenAI GPT-4 integration for semantic query expansion
  - Build expansion prompt template that generates canonical_query, alternates (≤10), and related_concepts (≤10)
  - Add expansion result validation and persistent caching (file-based) by query hash to survive restarts
  - Implement timeout handling (200ms) with graceful fallback to original results when expansion fails
  - _Requirements: 8.1, 8.6, 8.7, 9.1, 9.2_

- [x] 7. **[Phase 2]** Create LLM reranking component for relevance optimization
  - Implement ResultReranker class with GPT-3.5-turbo for final candidate scoring (0-1 relevance scores)
  - Limit reranking to top 10 candidates only to bound cost and latency
  - Build reranking prompt template that presents query and candidate snippets for relevance assessment
  - Add JSON response parsing and validation for reranking scores with error handling
  - Implement reranking timeout (150ms) and fallback to fusion scores when reranking fails
  - _Requirements: 8.1, 9.1, 9.2_

- [x] 8. Integrate hybrid retrieval with existing factbook system
  - Modify existing FactbookService to expose getAllSnippets() method for hybrid indexing
  - Create HybridRetriever.retrieve() method that orchestrates BM25, vector search, fusion, expansion, and reranking
  - Add comprehensive metrics collection for all retrieval components (timing, cache hits, methods used)
  - Implement graceful fallback chain: full hybrid → basic hybrid → BM25-only → empty results
  - Ensure no breaking changes to existing retrieve(userText): Fact[] interface signature
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 9.1, 9.3, 9.4, 9.5_

- [x] 9. Add comprehensive caching and performance optimization
  - Implement in-memory LRU cache for query expansions with configurable size limits and TTL
  - Add Redis integration option for distributed caching of embeddings and expansion results
  - Create cache warming strategies for common queries and embedding precomputation
  - Implement cache invalidation logic when factbook content changes or model versions update
  - Add memory usage monitoring and cache efficiency metrics for performance dashboard
  - _Requirements: 5.1, 5.2, 5.5, 7.3_

- [ ] 10. Build monitoring, logging, and debugging infrastructure
  - Create comprehensive logging for all retrieval stages with timing, hit IDs, confidence scores, and methods used
  - Implement RetrievalMetrics interface with performance, quality, and usage tracking
  - Add structured logging that includes expansion triggers, fallback usage, and error contexts
  - Create metrics aggregation and export functionality for monitoring dashboard integration
  - Build debugging utilities that show retrieval decision paths and score breakdowns
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

- [x] 11. Create comprehensive test suite with golden query set
  - Create golden query set with ~12 real questions ("Where did you grow up?", "What happened with the snake?", "Tell me about your brother")
  - Implement integration tests for all 7 core semantic connection test cases (snake→cobra, SXSW→concerts, Tyler→Cansu, etc.)
  - Build performance regression tests that enforce p95 latency limits (≤600ms with all features, current baseline without)
  - Create golden output tests that validate retrieval accuracy against known query-result pairs using the golden set
  - Add fallback behavior tests that verify graceful degradation when components fail
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 12. Add A/B testing and feature flag management
  - Create A/B testing infrastructure that allows "bm25-only" vs "hybrid" mode comparison
  - Implement feature flag runtime switching without server restarts where possible
  - Add configuration validation and safe defaults for all hybrid retrieval settings
  - Create feature flag monitoring that tracks usage patterns and performance impact
  - Build configuration management utilities for easy deployment and rollback scenarios
  - _Requirements: 6.4, 6.5_

- [x] 13. Optimize vector search with lightweight ANN index
  - Research and implement HNSW (Hierarchical Navigable Small World) index for fast approximate nearest neighbor search
  - Replace linear vector search with HNSW for sub-100ms vector query performance
  - Add index building and persistence for HNSW structures with factbook updates
  - Implement index size monitoring and memory usage optimization for production deployment
  - Create performance comparison tests between linear search and HNSW for various query loads
  - _Requirements: 5.1, 5.4_

- [x] 14. Build production monitoring dashboard and alerting
  - Create real-time dashboard showing hybrid retrieval performance, error rates, and feature usage
  - Implement alerting for performance degradation, high error rates, and cache efficiency drops
  - Add system health monitoring for embedding cache size, vector index size, and memory usage
  - Create automated performance reports with semantic accuracy metrics and latency trends
  - Build deployment validation scripts that verify hybrid retrieval functionality after updates
  - _Requirements: 7.4, 7.5_

- [x] 15. Final integration testing and persona preservation validation
  - Run comprehensive end-to-end tests with all acceptance criteria and performance requirements
  - Validate persona separation: facts injected raw, then rewritten into "Jonathan voice" in separate pass
  - Test semantic connection accuracy with adversarial queries and edge cases using golden query set
  - Verify that no breaking changes affect existing /api/demo-chat or consumer endpoints
  - Conduct final performance validation under production-like load with MVP features (BM25+vector+RRF)
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 3.1, 3.2, 3.3, 3.4, 3.5_