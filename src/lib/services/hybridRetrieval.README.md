# Hybrid Retrieval System

The hybrid retrieval system enhances the existing jonathan-demo factbook architecture with semantic understanding capabilities. It combines exact term matching (BM25) with semantic vector search, uses LLM-powered query expansion for low-confidence results, and optionally applies LLM reranking for optimal relevance.

## Features

### Phase 1 (Implemented)
- ✅ **Feature Flag Infrastructure**: Complete environment variable configuration system
- ✅ **BM25 Retrieval**: Foundation using existing FactbookService
- ✅ **Health Monitoring**: Comprehensive health checks and status reporting
- ✅ **Configuration Management**: Runtime configuration updates for A/B testing
- ✅ **Metrics Collection**: Detailed performance and quality metrics
- ✅ **Error Handling**: Graceful fallback mechanisms

### Phase 2 (Planned)
- 🔄 **Vector Search**: Semantic search with OpenAI embeddings
- 🔄 **Result Fusion**: Reciprocal Rank Fusion for combining BM25 and vector results
- 🔄 **Query Expansion**: LLM-powered expansion for low-confidence queries
- 🔄 **LLM Reranking**: Final relevance optimization

## Configuration

The system is configured through environment variables with safe defaults:

```bash
# Feature flags
RETRIEVAL_EMBEDDINGS=on          # Enable semantic vector search (default: on)
RETRIEVAL_EXPANSION=auto         # Enable query expansion (auto|off, default: auto)
RETRIEVAL_RERANK=off            # Enable LLM reranking (on|off, default: off)

# Performance settings
RETRIEVAL_EXPANSION_THRESHOLD=0.3    # Trigger expansion when confidence < threshold
RETRIEVAL_MAX_RESULTS=10            # Maximum results to return
RETRIEVAL_TIMEOUT_MS=500            # Total timeout for retrieval

# BM25 parameters
RETRIEVAL_BM25_K1=1.2              # Term frequency saturation
RETRIEVAL_BM25_B=0.75              # Length normalization

# Vector search parameters
RETRIEVAL_VECTOR_THRESHOLD=0.3      # Minimum similarity for results
RETRIEVAL_VECTOR_MAX_RESULTS=20     # Max results from vector search

# Fusion weights
RETRIEVAL_BM25_WEIGHT=0.6          # Weight for BM25 results in fusion
RETRIEVAL_VECTOR_WEIGHT=0.4        # Weight for vector results in fusion
```

## Usage

### Basic Usage

```typescript
import { HybridRetriever, parseHybridRetrievalConfig } from './hybridRetrieval';

// 1. Parse configuration from environment
const config = parseHybridRetrievalConfig();

// 2. Create retriever instance
const retriever = new HybridRetriever(config);

// 3. Warmup (ensures factbook is loaded)
await retriever.warmup();

// 4. Perform retrieval
const result = await retriever.retrieve('olive dog adventures');

console.log('Results:', result.results);
console.log('Metrics:', result.metrics);
```

### Configuration Management

```typescript
// Get current configuration
const currentConfig = retriever.getConfig();

// Update configuration at runtime (for A/B testing)
retriever.updateConfig({
  maxResults: 15,
  enableReranking: true,
  timeoutMs: 1000
});
```

### Health Monitoring

```typescript
// Check system health
const healthStatus = retriever.getHealthStatus();

console.log('Overall Status:', healthStatus.status); // 'healthy' | 'degraded' | 'unhealthy'
console.log('Component Status:', healthStatus.components);
console.log('Details:', healthStatus.details);
```

## API Reference

### HybridRetrievalConfig

Configuration interface for the hybrid retrieval system:

```typescript
interface HybridRetrievalConfig {
  // Feature flags
  enableEmbeddings: boolean;        // RETRIEVAL_EMBEDDINGS
  enableExpansion: 'auto' | 'off';  // RETRIEVAL_EXPANSION
  enableReranking: boolean;         // RETRIEVAL_RERANK
  
  // Performance settings
  expansionThreshold: number;       // Default: 0.3
  maxResults: number;               // Default: 10
  fusionK: number;                  // Default: 60 (RRF parameter)
  timeoutMs: number;                // Default: 500
  
  // BM25 parameters
  bm25K1: number;                   // Default: 1.2
  bm25B: number;                    // Default: 0.75
  
  // Vector search parameters
  vectorSimilarityThreshold: number; // Default: 0.3
  vectorMaxResults: number;         // Default: 20
  
  // Fusion weights
  bm25Weight: number;               // Default: 0.6
  vectorWeight: number;             // Default: 0.4
}
```

### RetrievalResult

Result from hybrid retrieval with metadata:

```typescript
interface RetrievalResult {
  snippet: FactbookSnippet;         // The retrieved factbook snippet
  score: number;                    // Relevance score
  source: 'bm25' | 'vector' | 'expanded'; // Retrieval method used
  confidence: number;               // Confidence in the result
  metadata?: {                      // Additional metadata
    bm25Score?: number;
    vectorSimilarity?: number;
    fusionScore?: number;
    termMatches?: string[];
  };
}
```

### RetrievalMetrics

Comprehensive metrics for monitoring:

```typescript
interface RetrievalMetrics {
  totalTimeMs: number;              // Total retrieval time
  bm25TimeMs: number;               // BM25 component time
  vectorTimeMs?: number;            // Vector search time (when enabled)
  expansionTimeMs?: number;         // Query expansion time (when triggered)
  rerankTimeMs?: number;            // Reranking time (when enabled)
  
  cacheHit: boolean;                // Whether cache was used
  methodsUsed: string[];            // Methods used in retrieval
  resultCount: number;              // Number of results returned
  confidenceScore: number;          // Overall confidence
  
  expansionTriggered: boolean;      // Whether expansion was triggered
  rerankingApplied: boolean;        // Whether reranking was applied
  fallbackUsed: boolean;            // Whether fallback was used
  
  errors: string[];                 // Any errors encountered
  warnings: string[];               // Any warnings
}
```

### HybridRetriever

Main class for hybrid retrieval:

```typescript
class HybridRetriever {
  constructor(config: HybridRetrievalConfig, factbookService?: FactbookService);
  
  // Main retrieval method
  async retrieve(query: string): Promise<{
    results: RetrievalResult[];
    metrics: RetrievalMetrics;
  }>;
  
  // System management
  async warmup(): Promise<void>;
  getHealthStatus(): HealthStatus;
  
  // Configuration management
  getConfig(): HybridRetrievalConfig;
  updateConfig(newConfig: Partial<HybridRetrievalConfig>): void;
}
```

## Architecture

The system follows a modular architecture with clear separation of concerns:

```
HybridRetriever (orchestrator)
├── BM25Retriever (text matching)
├── VectorRetriever (semantic search) [Phase 2]
├── QueryExpander (LLM expansion) [Phase 2]
├── ResultReranker (LLM reranking) [Phase 2]
└── CacheManager (performance optimization) [Phase 2]
```

### Current Implementation (Phase 1)

- **BM25 Retrieval**: Uses existing FactbookService for keyword-based search
- **Feature Flags**: Complete environment variable configuration system
- **Health Monitoring**: Component-level health checks and status reporting
- **Metrics Collection**: Comprehensive performance and quality tracking
- **Error Handling**: Graceful fallback mechanisms with detailed error reporting

### Future Phases

- **Phase 2**: Vector search, result fusion, query expansion, and LLM reranking
- **Phase 3**: Performance optimization with HNSW indexing and Redis caching
- **Phase 4**: Advanced monitoring, alerting, and deployment validation

## Testing

The system includes comprehensive tests covering:

- Configuration parsing and validation
- Basic retrieval functionality
- Error handling and fallbacks
- Health monitoring
- Metrics collection
- Configuration management

Run tests with:

```bash
npm test -- src/lib/services/__tests__/hybridRetrieval.test.ts
```

## Integration

The hybrid retrieval system is designed to be a drop-in replacement for existing factbook retrieval:

```typescript
// Before (existing system)
const results = factbookService.querySnippets(keywords, maxResults);

// After (hybrid system)
const { results } = await hybridRetriever.retrieve(query);
const snippets = results.map(r => r.snippet);
```

The system preserves the existing factbook schema and API contracts, ensuring no breaking changes to current functionality.

## Monitoring

The system provides extensive monitoring capabilities:

- **Performance Metrics**: Latency, throughput, cache hit rates
- **Quality Metrics**: Confidence scores, result counts, method usage
- **Health Monitoring**: Component status, error rates, fallback usage
- **Feature Usage**: A/B testing support, configuration tracking

All metrics are structured for easy integration with monitoring dashboards and alerting systems.

## Examples

See `src/lib/services/examples/hybridRetrievalExample.ts` for complete usage examples including:

- Basic retrieval operations
- Configuration management
- Error handling and fallbacks
- Health monitoring
- Performance metrics

Run examples with:

```bash
npx ts-node src/lib/services/examples/hybridRetrievalExample.ts
```