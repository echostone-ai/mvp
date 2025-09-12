# Requirements Document

## Introduction

The hybrid retrieval and smart expansion feature transforms the jonathan-demo avatar's factbook retrieval system to intelligently connect concepts through semantic understanding rather than hard-coded synonyms. The system combines exact term matching (BM25) with semantic vector search, uses LLM-powered query expansion for low-confidence results, and optionally applies LLM reranking for optimal relevance. This enables natural concept connections like "snake story" → Morocco "cobra" memory while preserving the existing factbook schema, maintaining voice consistency, and keeping performance within acceptable latency bounds.

## Requirements

### Requirement 1 (Priority: High)

**User Story:** As a user asking about concepts using different terminology, I want the system to intelligently connect related ideas without requiring exact keyword matches, so that conversations feel natural and comprehensive.

#### Acceptance Criteria

1. WHEN a user asks about "snake story" THEN the system SHALL return Morocco cobra memory without requiring hard-coded synonym mappings
2. WHEN a user asks about "meetings at SXSW" THEN the system SHALL find Bill Murray & GZA concert entries through semantic understanding
3. WHEN a user asks "Who is Tyler?" THEN the system SHALL return Tyler facts, and "Tyler partner" SHALL return Cansu information
4. WHEN a user asks about "Olive" or "George" THEN the system SHALL return precise pet memories with high relevance
5. WHEN processing queries THEN the system SHALL NOT rely on hard-coded synonym lists or manual concept mappings

### Requirement 2 (Priority: High)

**User Story:** As a user interacting with the jonathan-demo, I want the hybrid retrieval system to maintain fast response times while providing more intelligent results, so that the conversation flow remains smooth and natural.

#### Acceptance Criteria

1. WHEN hybrid retrieval is disabled THEN p95 route latency SHALL remain at current acceptable levels
2. WHEN hybrid retrieval is enabled THEN p95 added latency for expansion and reranking SHALL be under 300-600ms
3. WHEN LLM calls timeout or fail THEN the system SHALL gracefully fall back to BM25-only results without breaking the response
4. WHEN query expansion is triggered THEN it SHALL complete within the latency budget or timeout gracefully
5. WHEN the system is under load THEN performance SHALL degrade gracefully with feature flags controlling expensive operations

### Requirement 3 (Priority: High)

**User Story:** As a developer maintaining the system, I want the hybrid retrieval to preserve all existing factbook schemas and API routes, so that no breaking changes are introduced to current functionality.

#### Acceptance Criteria

1. WHEN implementing hybrid retrieval THEN the factbook schema SHALL remain { id, text, topics, keywords } unchanged
2. WHEN the system is deployed THEN /api/demo-chat and all consumer endpoints SHALL have no breaking changes
3. WHEN factbook data is processed THEN existing JSON structure SHALL be preserved without modifications
4. WHEN retrieval is called THEN the interface SHALL remain retrieve(userText): Fact[] with no signature changes
5. WHEN the system boots THEN existing factbook loading and validation SHALL continue to work unchanged

### Requirement 4 (Priority: Medium)

**User Story:** As a developer implementing the hybrid system, I want a clean modular architecture with proper separation of concerns, so that each retrieval method can be developed, tested, and maintained independently.

#### Acceptance Criteria

1. WHEN the system initializes THEN it SHALL load and warm both BM25 and vector indices on boot
2. WHEN processing queries THEN BM25 and semantic search SHALL run independently and be fused using Reciprocal Rank Fusion
3. WHEN query expansion is needed THEN it SHALL be triggered only on low-confidence results with configurable thresholds
4. WHEN reranking is enabled THEN it SHALL operate on the final candidate set without affecting earlier retrieval stages
5. WHEN any component fails THEN other components SHALL continue to function with graceful degradation

### Requirement 5 (Priority: Medium)

**User Story:** As a developer optimizing system performance, I want intelligent caching and efficient indexing, so that repeated queries and expensive operations are optimized without sacrificing accuracy.

#### Acceptance Criteria

1. WHEN embeddings are generated THEN they SHALL be cached and reused across server restarts via persistent storage
2. WHEN query expansions are performed THEN results SHALL be cached in-memory or Redis by query hash for reuse
3. WHEN building vector indices THEN the system SHALL use an efficient embedding model with appropriate dimensions for the factbook size
4. WHEN performing vector search THEN it SHALL use a lightweight ANN index (e.g., HNSW) for fast top-k retrieval
5. WHEN caching is full THEN the system SHALL use LRU eviction and continue functioning without cache misses causing failures

### Requirement 6 (Priority: High)

**User Story:** As a developer configuring the system, I want comprehensive feature flags and configuration options, so that I can control system behavior and perform A/B testing safely.

#### Acceptance Criteria

1. WHEN configuring retrieval THEN RETRIEVAL_EMBEDDINGS environment variable SHALL control semantic search (on|off)
2. WHEN configuring expansion THEN RETRIEVAL_EXPANSION environment variable SHALL control LLM query expansion (auto|off)
3. WHEN configuring reranking THEN RETRIEVAL_RERANK environment variable SHALL control LLM reranking (on|off)
4. WHEN A/B testing THEN the system SHALL support a toggle to compare "bm25-only" vs "hybrid" modes
5. WHEN feature flags change THEN the system SHALL adapt behavior without requiring restarts where possible

### Requirement 7 (Priority: Medium)

**User Story:** As a developer monitoring system performance, I want comprehensive metrics and logging, so that I can track retrieval performance, debug issues, and optimize the system.

#### Acceptance Criteria

1. WHEN processing queries THEN the system SHALL log retrieval timings for each component (BM25, vector, expansion, rerank)
2. WHEN retrieval paths are used THEN logs SHALL indicate which methods were used (bm25, vector, expanded) for each query
3. WHEN results are returned THEN logs SHALL include hit IDs and confidence scores for debugging
4. WHEN performance degrades THEN metrics SHALL provide sufficient data to identify bottlenecks in each retrieval stage
5. WHEN errors occur THEN logs SHALL include context about which retrieval components failed and fallback behavior
6. WHEN expansion or reranking is triggered THEN logs SHALL include the reason (e.g., low-confidence BM25 results)

### Requirement 8 (Priority: Medium)

**User Story:** As a developer implementing LLM-powered features, I want smart query expansion that enhances retrieval without introducing hallucination or irrelevant results, so that expanded queries remain focused and accurate.

#### Acceptance Criteria

1. WHEN query expansion is triggered THEN the LLM SHALL return structured JSON with canonical_query, alternates (≤10), and related_concepts (≤10)
2. WHEN expansion terms are generated THEN they SHALL be noun-heavy, lowercase, and tightly focused on the original query intent
3. WHEN expansion is applied THEN it SHALL NOT paraphrase answers or introduce content not in the factbook
4. WHEN expansion results are poor THEN the system SHALL fall back to original query results rather than return irrelevant content
5. WHEN expansion is disabled THEN the system SHALL function normally with BM25 and semantic search only
6. WHEN low-confidence is detected THEN it SHALL be defined as fewer than 3 hits above a similarity threshold of 0.3
7. WHEN the expansion service is implemented THEN it SHALL be model-agnostic, allowing upgrades to newer GPT APIs without schema changes

### Requirement 9 (Priority: High)

**User Story:** As a developer ensuring system reliability, I want robust error handling and fallback mechanisms, so that the system remains functional even when advanced features fail.

#### Acceptance Criteria

1. WHEN LLM calls timeout THEN the system SHALL fall back to hybrid results without expansion within the timeout window
2. WHEN vector search fails THEN the system SHALL fall back to BM25-only results and log the failure
3. WHEN embedding generation fails THEN the system SHALL continue with text-based retrieval methods
4. WHEN cache systems fail THEN the system SHALL continue without caching and log performance impact
5. WHEN any retrieval component fails THEN the system SHALL never return empty results if any component succeeded

### Requirement 10 (Priority: High)

**User Story:** As a user interacting with the jonathan-demo, I want the enhanced retrieval to maintain Jonathan's authentic voice and persona integration, so that improved factbook retrieval doesn't change the conversational experience.

#### Acceptance Criteria

1. WHEN facts are retrieved THEN they SHALL be injected as bullet points and rewritten into first-person as necessary
2. WHEN system persona is applied THEN it SHALL remain stable regardless of retrieval method used
3. WHEN responses are generated THEN logit_bias hacks SHALL be removed and not used for token biasing
4. WHEN personality is applied THEN it SHALL be a style layer over retrieved facts, not influencing fact selection
5. WHEN no relevant facts are found THEN the system SHALL gracefully redirect to open-ended conversation rather than abrupt fallback text
## Integr
ation Testing Requirements

### Core Functionality Tests

1. **Semantic Connection Tests**
   - Query "snake story" → SHALL retrieve Morocco cobra memory
   - Query "meetings at SXSW" → SHALL retrieve Bill Murray & GZA concert entries
   - Query "SXSW concert" → SHALL retrieve Bill Murray & GZA entries
   - Query "Who is Tyler?" → SHALL retrieve Tyler facts
   - Query "Tyler partner" → SHALL retrieve Cansu information
   - Query "Olive" → SHALL retrieve precise pet memories
   - Query "George" → SHALL retrieve precise pet memories

2. **Fallback and Error Handling Tests**
   - Query with no semantic matches → SHALL fall back to BM25 results gracefully
   - LLM expansion timeout → SHALL return hybrid results without expansion
   - Vector search failure → SHALL return BM25-only results
   - Cache failure → SHALL continue without caching

3. **Performance Tests**
   - Hybrid retrieval disabled → SHALL maintain current p95 latency
   - Hybrid retrieval enabled → SHALL add ≤300-600ms to p95 latency
   - Query expansion → SHALL complete within timeout or fail gracefully
   - System under load → SHALL degrade gracefully with feature flags

## Evaluation Metrics

### Relevance Metrics
- **Precision@k ≥ 0.8** for benchmark queries against golden dataset
- **Recall improvement ≥ 20%** compared to BM25-only baseline
- **Mean Reciprocal Rank (MRR) ≥ 0.85** for known fact queries

### Performance Metrics
- **p95 latency increase ≤ 300-600ms** with all features enabled
- **BM25 component latency ≤ 50ms** for baseline performance
- **Vector search latency ≤ 100ms** for semantic component
- **Query expansion latency ≤ 200ms** when triggered
- **LLM reranking latency ≤ 150ms** when enabled

### System Health Metrics
- **Cache hit rate ≥ 70%** for repeated queries
- **Fallback rate ≤ 5%** for component failures
- **Memory usage increase ≤ 200MB** for embeddings and indices
- **Embedding generation time ≤ 2s** for factbook indexing

## Acceptance Validation

The system SHALL be considered complete when:

1. All 7 core semantic connection tests pass consistently
2. Performance metrics are met under normal and load conditions
3. All feature flags function correctly for A/B testing
4. Comprehensive logging provides debugging visibility
5. Fallback mechanisms handle all failure scenarios gracefully
6. No breaking changes to existing factbook schema or API routes
7. Jonathan's voice and persona remain consistent across retrieval methods