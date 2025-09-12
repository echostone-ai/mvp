// src/lib/services/hybridRetrieval.ts
// Hybrid retrieval infrastructure with BM25 + Vector Search + Smart Expansion

import { FactbookService, FactbookSnippet } from './factbookService';
import { BM25Retriever, BM25Config, BM25Result } from './bm25Retriever';
import { VectorRetriever, VectorConfig, VectorResult } from './vectorRetriever';
import { ResultFuser, FusionConfig, FusedResult } from './resultFuser';
import { EmbeddingCache } from './embeddingCache';
import { QueryExpander, QueryExpansionConfig, ExpansionRequest, ExpansionResponse } from './queryExpander';
import { ResultReranker, RerankConfig, RerankRequest } from './resultReranker';
import { CacheManager } from './cacheManager';
import { PerformanceMonitor } from './performanceMonitor';
import { retrievalLogger, RetrievalLogLevel } from './retrievalLogger';
import { retrievalMetricsCollector } from './retrievalMetrics';
import { retrievalDebugger, RetrievalDecisionPath } from './retrievalDebugger';

/**
 * Configuration interface for hybrid retrieval system
 * Controls all feature flags and behavior settings
 */
export interface HybridRetrievalConfig {
  // Feature flags from environment variables
  enableEmbeddings: boolean;        // RETRIEVAL_EMBEDDINGS: on|off
  enableExpansion: 'auto' | 'off';  // RETRIEVAL_EXPANSION: auto|off  
  enableReranking: boolean;         // RETRIEVAL_RERANK: on|off
  
  // Performance and quality settings
  expansionThreshold: number;       // Default: 0.3 - trigger expansion when confidence < threshold
  maxResults: number;               // Default: 10 - maximum results to return
  fusionK: number;                  // Default: 60 - RRF parameter for result fusion
  timeoutMs: number;                // Default: 500 - total timeout for retrieval
  
  // BM25 parameters
  bm25K1: number;                   // Default: 1.2 - term frequency saturation
  bm25B: number;                    // Default: 0.75 - length normalization
  
  // Vector search parameters
  vectorSimilarityThreshold: number; // Default: 0.3 - minimum similarity for results
  vectorMaxResults: number;         // Default: 20 - max results from vector search
  
  // Fusion weights
  bm25Weight: number;               // Default: 0.6 - weight for BM25 results in fusion
  vectorWeight: number;             // Default: 0.4 - weight for vector results in fusion
  
  // Query expansion parameters
  expansionTimeoutMs: number;       // Default: 200 - timeout for query expansion
  lowConfidenceThreshold: number;   // Default: 0.35 - threshold for triggering expansion
  minResultsThreshold: number;      // Default: 2 - minimum results above similarity threshold
  
  // Reranking parameters
  rerankTimeoutMs: number;          // Default: 150 - timeout for result reranking
}

/**
 * Result from hybrid retrieval with metadata
 */
export interface RetrievalResult {
  snippet: FactbookSnippet;
  score: number;
  source: 'bm25' | 'vector' | 'expanded' | 'both';
  confidence: number;
  metadata?: {
    bm25Score?: number;
    vectorSimilarity?: number;
    fusionScore?: number;
    termMatches?: string[];
    rank?: number;
  };
}

/**
 * Metrics collected during retrieval for monitoring
 */
export interface RetrievalMetrics {
  // Timing metrics
  totalTimeMs: number;
  bm25TimeMs: number;
  vectorTimeMs?: number;
  expansionTimeMs?: number;
  rerankTimeMs?: number;
  fusionTimeMs?: number;
  
  // Cache metrics
  cacheHit: boolean;
  embeddingCacheHits?: number;
  expansionCacheHits?: number;
  
  // Method usage metrics
  methodsUsed: string[];
  fallbackLevel?: 'none' | 'basic_hybrid' | 'bm25_only' | 'empty';
  
  // Quality metrics
  resultCount: number;
  confidenceScore: number;
  topScore?: number;
  averageScore?: number;
  
  // Feature usage metrics
  expansionTriggered: boolean;
  rerankingApplied: boolean;
  fallbackUsed: boolean;
  
  // Component health metrics
  bm25Available: boolean;
  vectorAvailable: boolean;
  expansionAvailable: boolean;
  rerankingAvailable: boolean;
  
  // Error tracking
  errors: string[];
  warnings: string[];
  
  // Performance tracking
  timeoutOccurred?: boolean;
  memoryUsageMB?: number;
}

/**
 * Health status for monitoring dashboard
 */
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  components: {
    bm25: 'healthy' | 'degraded' | 'unhealthy';
    vector: 'healthy' | 'degraded' | 'unhealthy';
    expansion: 'healthy' | 'degraded' | 'unhealthy';
    reranking: 'healthy' | 'degraded' | 'unhealthy';
  };
  lastCheck: number;
  details: string[];
}

/**
 * Parse environment variables into HybridRetrievalConfig with safe defaults
 */
export function parseHybridRetrievalConfig(): HybridRetrievalConfig {
  return {
    // Feature flags with safe defaults
    enableEmbeddings: process.env.RETRIEVAL_EMBEDDINGS?.toLowerCase() !== 'off',
    enableExpansion: (process.env.RETRIEVAL_EXPANSION?.toLowerCase() === 'off') ? 'off' : 'auto',
    enableReranking: process.env.RETRIEVAL_RERANK?.toLowerCase() === 'on',
    
    // Performance settings
    expansionThreshold: parseFloat(process.env.RETRIEVAL_EXPANSION_THRESHOLD || '0.3'),
    maxResults: parseInt(process.env.RETRIEVAL_MAX_RESULTS || '10'),
    fusionK: parseInt(process.env.RETRIEVAL_FUSION_K || '60'),
    timeoutMs: parseInt(process.env.RETRIEVAL_TIMEOUT_MS || '500'),
    
    // BM25 parameters
    bm25K1: parseFloat(process.env.RETRIEVAL_BM25_K1 || '1.2'),
    bm25B: parseFloat(process.env.RETRIEVAL_BM25_B || '0.75'),
    
    // Vector search parameters
    vectorSimilarityThreshold: parseFloat(process.env.RETRIEVAL_VECTOR_THRESHOLD || '0.3'),
    vectorMaxResults: parseInt(process.env.RETRIEVAL_VECTOR_MAX_RESULTS || '20'),
    
    // Fusion weights
    bm25Weight: parseFloat(process.env.RETRIEVAL_BM25_WEIGHT || '0.6'),
    vectorWeight: parseFloat(process.env.RETRIEVAL_VECTOR_WEIGHT || '0.4'),
    
    // Query expansion parameters
    expansionTimeoutMs: parseInt(process.env.RETRIEVAL_EXPANSION_TIMEOUT_MS || '200'),
    lowConfidenceThreshold: parseFloat(process.env.RETRIEVAL_LOW_CONFIDENCE_THRESHOLD || '0.35'),
    minResultsThreshold: parseInt(process.env.RETRIEVAL_MIN_RESULTS_THRESHOLD || '2'),
    
    // Reranking parameters
    rerankTimeoutMs: parseInt(process.env.RETRIEVAL_RERANK_TIMEOUT_MS || '150')
  };
}

/**
 * Main hybrid retrieval class that orchestrates all retrieval components
 */
export class HybridRetriever {
  private config: HybridRetrievalConfig;
  private factbookService: FactbookService;
  private bm25Retriever: BM25Retriever;
  private vectorRetriever: VectorRetriever | null = null;
  private resultFuser: ResultFuser;
  private queryExpander: QueryExpander | null = null;
  private resultReranker: ResultReranker | null = null;
  private embeddingCache: EmbeddingCache | null = null;
  private cacheManager: CacheManager | null = null;
  private performanceMonitor: PerformanceMonitor | null = null;
  private healthStatus: HealthStatus;
  private lastHealthCheck: number = 0;
  
  constructor(
    config: HybridRetrievalConfig, 
    factbookService?: FactbookService, 
    embeddingCache?: EmbeddingCache,
    cacheManager?: CacheManager,
    performanceMonitor?: PerformanceMonitor
  ) {
    this.config = config;
    this.factbookService = factbookService || FactbookService.getInstance();
    this.embeddingCache = embeddingCache || null;
    this.cacheManager = cacheManager || null;
    this.performanceMonitor = performanceMonitor || null;
    
    // Initialize BM25 retriever with config
    const bm25Config: BM25Config = {
      k1: this.config.bm25K1,
      b: this.config.bm25B,
      maxResults: this.config.vectorMaxResults // Use vectorMaxResults for BM25 before fusion
    };
    this.bm25Retriever = new BM25Retriever(this.factbookService, bm25Config);
    
    // Initialize vector retriever if embeddings are enabled
    if (this.config.enableEmbeddings && this.embeddingCache) {
      const vectorConfig: VectorConfig = {
        model: 'text-embedding-3-small',
        dimensions: 1536,
        maxResults: this.config.vectorMaxResults,
        similarityThreshold: this.config.vectorSimilarityThreshold,
        cacheEnabled: true
      };
      this.vectorRetriever = new VectorRetriever(vectorConfig, this.embeddingCache);
    }
    
    // Initialize result fuser
    const fusionConfig: FusionConfig = {
      method: 'reciprocal_rank',
      k: this.config.fusionK,
      bm25Weight: this.config.bm25Weight,
      vectorWeight: this.config.vectorWeight
    };
    this.resultFuser = new ResultFuser(fusionConfig);
    
    // Initialize query expander if expansion is enabled
    if (this.config.enableExpansion === 'auto') {
      try {
        const expansionConfig: Partial<QueryExpansionConfig> = {
          timeoutMs: this.config.expansionTimeoutMs,
          model: 'gpt-4',
          enableCache: true
        };
        this.queryExpander = new QueryExpander(expansionConfig);
      } catch (error) {
        console.warn('query_expander_init_failed', {
          error: error instanceof Error ? error.message : error,
          expansion_disabled: true
        });
        // Continue without expansion
      }
    }
    
    // Initialize result reranker if reranking is enabled
    if (this.config.enableReranking) {
      try {
        const rerankConfig: Partial<RerankConfig> = {
          model: 'gpt-3.5-turbo',
          maxCandidates: 10,
          timeoutMs: this.config.rerankTimeoutMs,
          enableCache: true,
          temperature: 0.1
        };
        this.resultReranker = new ResultReranker(rerankConfig);
      } catch (error) {
        console.warn('result_reranker_init_failed', {
          error: error instanceof Error ? error.message : error,
          reranking_disabled: true
        });
        // Continue without reranking
      }
    }
    
    // Initialize health status
    this.healthStatus = {
      status: 'healthy',
      components: {
        bm25: 'healthy',
        vector: this.config.enableEmbeddings ? 'healthy' : 'degraded',
        expansion: this.config.enableExpansion === 'off' ? 'degraded' : 'healthy',
        reranking: this.config.enableReranking ? 'healthy' : 'degraded'
      },
      lastCheck: Date.now(),
      details: []
    };
    
    console.log('hybrid_retriever_initialized', {
      embeddings_enabled: this.config.enableEmbeddings,
      expansion_mode: this.config.enableExpansion,
      reranking_enabled: this.config.enableReranking,
      timeout_ms: this.config.timeoutMs,
      bm25_config: bm25Config
    });
  }
  
  /**
   * Main retrieval method - orchestrates all retrieval components
   * Implements graceful fallback chain: full hybrid → basic hybrid → BM25-only → empty results
   */
  async retrieve(query: string): Promise<{
    results: RetrievalResult[];
    metrics: RetrievalMetrics;
  }> {
    const startTime = Date.now();
    
    // Start debugging session
    const debugPath = retrievalDebugger.startDebugging(query, this.config);
    
    const metrics: RetrievalMetrics = {
      // Timing metrics
      totalTimeMs: 0,
      bm25TimeMs: 0,
      
      // Cache metrics
      cacheHit: false,
      embeddingCacheHits: 0,
      expansionCacheHits: 0,
      
      // Method usage metrics
      methodsUsed: [],
      fallbackLevel: 'none',
      
      // Quality metrics
      resultCount: 0,
      confidenceScore: 0,
      
      // Feature usage metrics
      expansionTriggered: false,
      rerankingApplied: false,
      fallbackUsed: false,
      
      // Component health metrics
      bm25Available: this.bm25Retriever.isReady(),
      vectorAvailable: this.config.enableEmbeddings && this.vectorRetriever !== null,
      expansionAvailable: this.config.enableExpansion === 'auto' && this.queryExpander !== null,
      rerankingAvailable: this.config.enableReranking && this.resultReranker !== null,
      
      // Error tracking
      errors: [],
      warnings: []
    };

    // Log retrieval start
    retrievalLogger.logComponent('bm25', RetrievalLogLevel.INFO, 'Starting hybrid retrieval', {
      query,
      config: this.config,
      timestamp: startTime
    });

    // Check cache first if cache manager is available
    if (this.cacheManager) {
      const cacheKey = `retrieval_result:${query}`;
      const cachedResult = await this.cacheManager.get<{
        results: RetrievalResult[];
        metrics: RetrievalMetrics;
      }>(cacheKey);

      if (cachedResult) {
        metrics.cacheHit = true;
        metrics.totalTimeMs = Date.now() - startTime;
        
        console.log('retrieval_cache_hit', {
          query,
          result_count: cachedResult.results.length,
          cache_time_ms: metrics.totalTimeMs
        });

        // Record metrics for performance monitoring
        if (this.performanceMonitor) {
          this.performanceMonitor.recordRetrievalMetrics({
            ...metrics,
            cacheHit: true
          });
        }

        return {
          results: cachedResult.results,
          metrics: {
            ...cachedResult.metrics,
            cacheHit: true,
            totalTimeMs: metrics.totalTimeMs
          }
        };
      }
    }
    
    // Implement graceful fallback chain
    const result = await this.executeWithFallback(query, metrics, startTime, debugPath);

    // Cache the result if cache manager is available and result is successful
    if (this.cacheManager && result.results.length > 0 && !result.metrics.fallbackUsed) {
      const cacheKey = `retrieval_result:${query}`;
      const cacheTTL = 30 * 60 * 1000; // 30 minutes
      
      await this.cacheManager.set(cacheKey, result, cacheTTL).catch(error => {
        console.warn('retrieval_cache_set_error', {
          query,
          error: error instanceof Error ? error.message : error
        });
      });
    }

    // Record metrics for performance monitoring
    if (this.performanceMonitor) {
      this.performanceMonitor.recordRetrievalMetrics(result.metrics);
    }

    // Finalize debugging session
    retrievalDebugger.finalize(debugPath, result.results, result.metrics);

    // Log complete retrieval operation
    retrievalLogger.logRetrieval(
      query,
      result.results,
      result.metrics,
      this.config,
      {
        expansionReason: result.metrics.expansionTriggered ? 'low_confidence' : undefined,
        fallbackReason: result.metrics.fallbackUsed ? `Fallback to ${result.metrics.fallbackLevel}` : undefined
      }
    );

    // Record metrics for aggregation
    const logEntry = {
      timestamp: Date.now(),
      query,
      queryHash: this.hashQuery(query),
      totalTimeMs: result.metrics.totalTimeMs,
      bm25TimeMs: result.metrics.bm25TimeMs,
      vectorTimeMs: result.metrics.vectorTimeMs,
      expansionTimeMs: result.metrics.expansionTimeMs,
      rerankTimeMs: result.metrics.rerankTimeMs,
      fusionTimeMs: result.metrics.fusionTimeMs,
      resultCount: result.results.length,
      hitIds: result.results.map(r => r.snippet.id),
      confidenceScores: result.results.map(r => r.confidence),
      topScore: result.results.length > 0 ? result.results[0].score : undefined,
      averageScore: result.results.length > 0 
        ? result.results.reduce((sum, r) => sum + r.score, 0) / result.results.length 
        : undefined,
      methodsUsed: result.metrics.methodsUsed,
      fallbackLevel: result.metrics.fallbackLevel,
      expansionTriggered: result.metrics.expansionTriggered,
      rerankingApplied: result.metrics.rerankingApplied,
      cacheHit: result.metrics.cacheHit,
      embeddingCacheHits: result.metrics.embeddingCacheHits,
      expansionCacheHits: result.metrics.expansionCacheHits,
      componentStatus: {
        bm25: result.metrics.bm25Available ? 'healthy' as const : 'failed' as const,
        vector: !this.config.enableEmbeddings ? 'disabled' as const : 
                result.metrics.vectorAvailable ? 'healthy' as const : 'failed' as const,
        expansion: this.config.enableExpansion === 'off' ? 'disabled' as const :
                  result.metrics.expansionAvailable ? 'healthy' as const : 'failed' as const,
        reranking: !this.config.enableReranking ? 'disabled' as const :
                  result.metrics.rerankingAvailable ? 'healthy' as const : 'failed' as const
      },
      errors: result.metrics.errors,
      warnings: result.metrics.warnings,
      memoryUsageMB: result.metrics.memoryUsageMB,
      timeoutOccurred: result.metrics.timeoutOccurred,
      config: {
        enableEmbeddings: this.config.enableEmbeddings,
        enableExpansion: this.config.enableExpansion,
        enableReranking: this.config.enableReranking,
        expansionThreshold: this.config.expansionThreshold,
        maxResults: this.config.maxResults
      }
    };

    retrievalMetricsCollector.recordRetrieval(logEntry as any);

    return result;
  }

  /**
   * Execute retrieval with comprehensive fallback chain
   * Fallback order: full hybrid → basic hybrid → BM25-only → empty results
   */
  private async executeWithFallback(
    query: string, 
    metrics: RetrievalMetrics, 
    startTime: number,
    debugPath?: RetrievalDecisionPath
  ): Promise<{ results: RetrievalResult[]; metrics: RetrievalMetrics }> {
    
    // Level 1: Full hybrid retrieval (BM25 + Vector + Expansion + Reranking)
    try {
      console.log('hybrid_retrieval_start', { query, config: this.config, level: 'full_hybrid' });
      
      const results = await this.performFullHybridRetrieval(query, metrics, debugPath);
      metrics.totalTimeMs = Date.now() - startTime;
      
      console.log('hybrid_retrieval_complete', {
        query,
        level: 'full_hybrid',
        result_count: results.length,
        methods_used: metrics.methodsUsed,
        total_time_ms: metrics.totalTimeMs
      });
      
      return { results, metrics };
      
    } catch (error) {
      metrics.errors.push(`Full hybrid failed: ${error instanceof Error ? error.message : error}`);
      console.warn('hybrid_retrieval_fallback_to_basic', {
        query,
        error: error instanceof Error ? error.message : error
      });
    }
    
    // Level 2: Basic hybrid retrieval (BM25 + Vector + Fusion only)
    try {
      console.log('hybrid_retrieval_basic_fallback', { query, level: 'basic_hybrid' });
      
      const results = await this.performBasicHybridRetrieval(query, metrics, debugPath);
      metrics.fallbackUsed = true;
      metrics.fallbackLevel = 'basic_hybrid';
      metrics.totalTimeMs = Date.now() - startTime;
      
      console.log('hybrid_retrieval_basic_complete', {
        query,
        level: 'basic_hybrid',
        result_count: results.length,
        methods_used: metrics.methodsUsed,
        total_time_ms: metrics.totalTimeMs
      });
      
      return { results, metrics };
      
    } catch (error) {
      metrics.errors.push(`Basic hybrid failed: ${error instanceof Error ? error.message : error}`);
      console.warn('hybrid_retrieval_fallback_to_bm25', {
        query,
        error: error instanceof Error ? error.message : error
      });
    }
    
    // Level 3: BM25-only retrieval
    try {
      console.log('hybrid_retrieval_bm25_fallback', { query, level: 'bm25_only' });
      
      const results = await this.performBM25OnlyRetrieval(query, metrics, debugPath);
      metrics.fallbackUsed = true;
      metrics.fallbackLevel = 'bm25_only';
      metrics.totalTimeMs = Date.now() - startTime;
      
      console.log('hybrid_retrieval_bm25_complete', {
        query,
        level: 'bm25_only',
        result_count: results.length,
        methods_used: metrics.methodsUsed,
        total_time_ms: metrics.totalTimeMs
      });
      
      return { results, metrics };
      
    } catch (error) {
      metrics.errors.push(`BM25-only failed: ${error instanceof Error ? error.message : error}`);
      console.error('hybrid_retrieval_total_failure', {
        query,
        error: error instanceof Error ? error.message : error
      });
    }
    
    // Level 4: Empty results (total failure)
    metrics.fallbackUsed = true;
    metrics.fallbackLevel = 'empty';
    metrics.totalTimeMs = Date.now() - startTime;
    
    console.error('hybrid_retrieval_empty_fallback', {
      query,
      total_errors: metrics.errors.length,
      total_time_ms: metrics.totalTimeMs
    });
    
    return {
      results: [],
      metrics
    };
  }

  /**
   * Perform full hybrid retrieval with all features enabled
   */
  private async performFullHybridRetrieval(query: string, metrics: RetrievalMetrics, debugPath?: RetrievalDecisionPath): Promise<RetrievalResult[]> {
    // Step 1: BM25 retrieval
    const bm25Results = await this.performBM25Retrieval(query, metrics, debugPath);
    metrics.methodsUsed.push('bm25');
    
    // Step 2: Vector retrieval (if enabled)
    let vectorResults: VectorResult[] = [];
    if (this.config.enableEmbeddings && this.vectorRetriever) {
      vectorResults = await this.performVectorRetrieval(query, metrics);
      metrics.methodsUsed.push('vector');
    }
    
    // Step 3: Fuse results using Reciprocal Rank Fusion
    let results: RetrievalResult[];
    const fusionStartTime = Date.now();
    
    if (vectorResults.length > 0) {
      const fusedResults = this.resultFuser.fuse(bm25Results, vectorResults);
      results = this.convertFusedResults(fusedResults);
      metrics.methodsUsed.push('fusion');
    } else {
      results = this.convertBM25Results(bm25Results);
    }
    
    metrics.fusionTimeMs = Date.now() - fusionStartTime;
    
    // Limit to max results before confidence check
    results = results.slice(0, this.config.maxResults);
    
    // Step 4: Check confidence and potentially expand query
    const confidence = this.calculateOverallConfidence(results);
    metrics.confidenceScore = confidence;
    
    if (this.shouldExpandQuery(results, confidence)) {
      const expandedResults = await this.performQueryExpansion(query, results, metrics);
      metrics.expansionTriggered = true;
      metrics.methodsUsed.push('expansion');
      
      // Use expanded results if they're better
      if (expandedResults.length >= results.length) {
        results = expandedResults;
      }
    }
    
    // Step 5: Optional LLM reranking for final relevance optimization
    if (this.config.enableReranking && this.resultReranker && results.length > 0) {
      const rerankRequest: RerankRequest = {
        query,
        candidates: results,
        maxResults: this.config.maxResults
      };
      
      const rerankStartTime = Date.now();
      const rerankedResults = await this.resultReranker.rerank(rerankRequest);
      metrics.rerankTimeMs = Date.now() - rerankStartTime;
      
      // Check if reranking was actually successful
      if (this.resultReranker.wasLastOperationSuccessful()) {
        results = rerankedResults;
        metrics.rerankingApplied = true;
        metrics.methodsUsed.push('reranking');
      } else {
        // Use fallback results from reranker
        results = rerankedResults;
        metrics.warnings.push('Result reranking failed but fallback results were used');
      }
    }
    
    // Collect final quality metrics
    metrics.resultCount = results.length;
    if (results.length > 0) {
      metrics.topScore = results[0].score;
      metrics.averageScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
    }
    
    return results;
  }

  /**
   * Perform basic hybrid retrieval (BM25 + Vector + Fusion only)
   */
  private async performBasicHybridRetrieval(query: string, metrics: RetrievalMetrics, debugPath?: RetrievalDecisionPath): Promise<RetrievalResult[]> {
    // Step 1: BM25 retrieval
    const bm25Results = await this.performBM25Retrieval(query, metrics, debugPath);
    metrics.methodsUsed.push('bm25');
    
    // Step 2: Vector retrieval (if enabled and available)
    let vectorResults: VectorResult[] = [];
    if (this.config.enableEmbeddings && this.vectorRetriever) {
      try {
        vectorResults = await this.performVectorRetrieval(query, metrics);
        metrics.methodsUsed.push('vector');
      } catch (error) {
        metrics.warnings.push(`Vector retrieval failed in basic hybrid: ${error instanceof Error ? error.message : error}`);
        console.warn('basic_hybrid_vector_fallback', { 
          query, 
          error: error instanceof Error ? error.message : error 
        });
      }
    }
    
    // Step 3: Fuse results using Reciprocal Rank Fusion
    let results: RetrievalResult[];
    const fusionStartTime = Date.now();
    
    if (vectorResults.length > 0) {
      const fusedResults = this.resultFuser.fuse(bm25Results, vectorResults);
      results = this.convertFusedResults(fusedResults);
      metrics.methodsUsed.push('fusion');
    } else {
      results = this.convertBM25Results(bm25Results);
    }
    
    metrics.fusionTimeMs = Date.now() - fusionStartTime;
    
    // Limit to max results
    results = results.slice(0, this.config.maxResults);
    
    const confidence = this.calculateOverallConfidence(results);
    metrics.confidenceScore = confidence;
    metrics.resultCount = results.length;
    
    // Collect quality metrics
    if (results.length > 0) {
      metrics.topScore = results[0].score;
      metrics.averageScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
    }
    
    return results;
  }

  /**
   * Perform BM25-only retrieval (final fallback before empty results)
   */
  private async performBM25OnlyRetrieval(query: string, metrics: RetrievalMetrics, debugPath?: RetrievalDecisionPath): Promise<RetrievalResult[]> {
    // Only BM25 retrieval
    const bm25Results = await this.performBM25Retrieval(query, metrics, debugPath);
    metrics.methodsUsed.push('bm25');
    
    // Convert to RetrievalResult format
    const results = this.convertBM25Results(bm25Results);
    
    // Limit to max results
    const limitedResults = results.slice(0, this.config.maxResults);
    
    const confidence = this.calculateOverallConfidence(limitedResults);
    metrics.confidenceScore = confidence;
    metrics.resultCount = limitedResults.length;
    
    // Collect quality metrics
    if (limitedResults.length > 0) {
      metrics.topScore = limitedResults[0].score;
      metrics.averageScore = limitedResults.reduce((sum, r) => sum + r.score, 0) / limitedResults.length;
    }
    
    return limitedResults;
  }
  
  /**
   * Perform BM25 retrieval using dedicated BM25Retriever
   * Returns BM25Result[] with scores for fusion
   */
  private async performBM25Retrieval(query: string, metrics: RetrievalMetrics, debugPath?: RetrievalDecisionPath): Promise<BM25Result[]> {
    const startTime = Date.now();
    
    try {
      // Ensure BM25 index is built
      if (!this.bm25Retriever.isReady()) {
        throw new Error('BM25 retriever not ready - index not built');
      }
      
      // Log component start
      retrievalLogger.logComponent('bm25', RetrievalLogLevel.INFO, 'Starting BM25 retrieval', {
        query,
        maxResults: this.config.vectorMaxResults
      });
      
      // Perform BM25 search with proper scoring
      const bm25Results = this.bm25Retriever.search(query, this.config.vectorMaxResults);
      
      const endTime = Date.now();
      metrics.bm25TimeMs = endTime - startTime;
      
      // Record debugging step
      if (debugPath) {
        retrievalDebugger.recordBM25Step(debugPath, startTime, endTime, query, bm25Results, true);
      }
      
      // Log component completion
      retrievalLogger.logComponent('bm25', RetrievalLogLevel.INFO, 'BM25 retrieval completed', {
        query,
        result_count: bm25Results.length,
        time_ms: metrics.bm25TimeMs,
        top_scores: bm25Results.slice(0, 3).map(r => ({
          id: r.snippet.id,
          score: r.score.toFixed(3),
          term_matches: r.termMatches
        }))
      });
      
      return bm25Results;
      
    } catch (error) {
      const endTime = Date.now();
      metrics.bm25TimeMs = endTime - startTime;
      metrics.errors.push(`BM25 retrieval failed: ${error instanceof Error ? error.message : error}`);
      
      // Record debugging step with error
      if (debugPath) {
        retrievalDebugger.recordBM25Step(debugPath, startTime, endTime, query, [], false);
      }
      
      // Log component error
      retrievalLogger.logComponent('bm25', RetrievalLogLevel.ERROR, 'BM25 retrieval failed', {
        query,
        error: error instanceof Error ? error.message : error,
        time_ms: metrics.bm25TimeMs
      });
      
      throw error;
    }
  }

  /**
   * Perform vector retrieval using VectorRetriever
   * Returns VectorResult[] with similarity scores for fusion
   */
  private async performVectorRetrieval(query: string, metrics: RetrievalMetrics): Promise<VectorResult[]> {
    const startTime = Date.now();
    
    try {
      if (!this.vectorRetriever) {
        throw new Error('Vector retriever not initialized');
      }
      
      // Perform vector search
      const vectorResults = await this.vectorRetriever.search(query, this.config.vectorMaxResults);
      
      metrics.vectorTimeMs = Date.now() - startTime;
      
      console.log('vector_retrieval_complete', {
        query,
        result_count: vectorResults.length,
        time_ms: metrics.vectorTimeMs,
        top_similarities: vectorResults.slice(0, 3).map(r => ({
          id: r.snippet.id,
          similarity: r.similarity.toFixed(3)
        }))
      });
      
      return vectorResults;
      
    } catch (error) {
      metrics.vectorTimeMs = Date.now() - startTime;
      metrics.errors.push(`Vector retrieval failed: ${error instanceof Error ? error.message : error}`);
      
      console.error('vector_retrieval_error', {
        query,
        error: error instanceof Error ? error.message : error
      });
      
      throw error;
    }
  }

  /**
   * Convert fused results to RetrievalResult format
   */
  private convertFusedResults(fusedResults: FusedResult[]): RetrievalResult[] {
    return fusedResults.map(result => ({
      snippet: result.snippet,
      score: result.score,
      source: result.source,
      confidence: this.calculateConfidence(result.score, fusedResults.length),
      metadata: {
        bm25Score: result.metadata.bm25Score,
        vectorSimilarity: result.metadata.vectorSimilarity,
        fusionScore: result.metadata.fusionScore,
        termMatches: result.metadata.termMatches,
        rank: result.metadata.rank
      }
    }));
  }

  /**
   * Convert BM25-only results to RetrievalResult format (fallback)
   */
  private convertBM25Results(bm25Results: BM25Result[]): RetrievalResult[] {
    return bm25Results.map((result, index) => ({
      snippet: result.snippet,
      score: result.score,
      source: 'bm25' as const,
      confidence: this.calculateConfidence(result.score, bm25Results.length),
      metadata: {
        bm25Score: result.score,
        termMatches: result.termMatches,
        rank: index + 1
      }
    }));
  }

  /**
   * Calculate confidence score based on result score and count
   */
  private calculateConfidence(score: number, resultCount: number): number {
    // Base confidence on score and result count
    const scoreConfidence = Math.min(score * 0.5, 0.8); // Cap at 0.8
    const countConfidence = Math.min(resultCount * 0.1, 0.2); // Cap at 0.2
    return Math.min(scoreConfidence + countConfidence, 1.0);
  }

  /**
   * Calculate overall confidence for a set of results
   * Low confidence = top score < 0.35 OR fewer than 2 results above 0.3 threshold
   */
  private calculateOverallConfidence(results: RetrievalResult[]): number {
    if (results.length === 0) {
      return 0.0;
    }

    const topScore = results[0]?.score || 0;
    const resultsAboveThreshold = results.filter(r => r.score >= this.config.vectorSimilarityThreshold).length;
    
    // Calculate confidence based on top score and result count
    const scoreConfidence = Math.min(topScore, 1.0);
    const countConfidence = Math.min(resultsAboveThreshold * 0.15, 0.4);
    
    return Math.min(scoreConfidence * 0.7 + countConfidence * 0.3, 1.0);
  }

  /**
   * Determine if query expansion should be triggered
   * Triggers when: top score < lowConfidenceThreshold OR fewer than minResultsThreshold results above similarity threshold
   */
  private shouldExpandQuery(results: RetrievalResult[], confidence: number): boolean {
    if (!this.queryExpander || this.config.enableExpansion !== 'auto') {
      return false;
    }

    if (results.length === 0) {
      return true; // Always expand for empty results
    }

    const topScore = results[0]?.score || 0;
    const resultsAboveThreshold = results.filter(r => r.score >= this.config.vectorSimilarityThreshold).length;

    const lowTopScore = topScore < this.config.lowConfidenceThreshold;
    const fewResults = resultsAboveThreshold < this.config.minResultsThreshold;

    console.log('confidence_check', {
      top_score: topScore.toFixed(3),
      results_above_threshold: resultsAboveThreshold,
      low_confidence_threshold: this.config.lowConfidenceThreshold,
      min_results_threshold: this.config.minResultsThreshold,
      should_expand: lowTopScore || fewResults,
      reason: lowTopScore ? 'low_top_score' : fewResults ? 'few_results' : 'none'
    });

    return lowTopScore || fewResults;
  }

  /**
   * Perform query expansion and re-run retrieval with expanded terms
   */
  private async performQueryExpansion(
    originalQuery: string, 
    lowConfidenceResults: RetrievalResult[], 
    metrics: RetrievalMetrics
  ): Promise<RetrievalResult[]> {
    const startTime = Date.now();

    if (!this.queryExpander) {
      throw new Error('Query expander not initialized');
    }

    // Create expansion request
    const expansionRequest: ExpansionRequest = {
      originalQuery,
      lowConfidenceResults,
      context: 'Low confidence retrieval results'
    };

    // Get expansion from LLM
    const expansion = await this.queryExpander.expandQuery(expansionRequest);
    metrics.expansionTimeMs = Date.now() - startTime;

    console.log('query_expansion_result', {
      original_query: originalQuery,
      canonical_query: expansion.canonical_query,
      alternates: expansion.alternates,
      related_concepts: expansion.related_concepts,
      confidence: expansion.confidence.toFixed(3),
      cached: expansion.cached
    });

    // If expansion failed or returned no terms, return original results
    if (expansion.alternates.length === 0 && expansion.related_concepts.length === 0) {
      console.warn('query_expansion_no_terms', { original_query: originalQuery });
      return lowConfidenceResults;
    }

    // Create expanded query by combining all terms
    const expandedTerms = [
      expansion.canonical_query,
      ...expansion.alternates,
      ...expansion.related_concepts
    ].filter(term => term.trim().length > 0);

    const expandedQuery = expandedTerms.join(' ');

    // Re-run retrieval with expanded query
    const expandedBM25Results = await this.performBM25Retrieval(expandedQuery, metrics);
    
    let expandedVectorResults: VectorResult[] = [];
    if (this.config.enableEmbeddings && this.vectorRetriever) {
      try {
        expandedVectorResults = await this.performVectorRetrieval(expandedQuery, metrics);
      } catch (error) {
        console.warn('expanded_vector_retrieval_failed', {
          error: error instanceof Error ? error.message : error
        });
      }
    }

    // Fuse expanded results
    let expandedResults: RetrievalResult[];
    if (expandedVectorResults.length > 0) {
      const fusedResults = this.resultFuser.fuse(expandedBM25Results, expandedVectorResults);
      expandedResults = this.convertFusedResults(fusedResults);
    } else {
      expandedResults = this.convertBM25Results(expandedBM25Results);
    }

    // Mark results as expanded
    expandedResults = expandedResults.map(result => ({
      ...result,
      source: 'expanded' as const
    }));

    // Combine with original results, removing duplicates
    const combinedResults = this.combineAndDeduplicateResults(lowConfidenceResults, expandedResults);
    
    // Limit to max results
    const finalResults = combinedResults.slice(0, this.config.maxResults);

    console.log('query_expansion_complete', {
      original_query: originalQuery,
      expanded_query: expandedQuery,
      original_count: lowConfidenceResults.length,
      expanded_count: expandedResults.length,
      final_count: finalResults.length,
      improvement: finalResults.length > lowConfidenceResults.length
    });

    return finalResults;
  }

  /**
   * Combine and deduplicate results from original and expanded queries
   */
  private combineAndDeduplicateResults(
    originalResults: RetrievalResult[], 
    expandedResults: RetrievalResult[]
  ): RetrievalResult[] {
    const seenIds = new Set<string>();
    const combined: RetrievalResult[] = [];

    // Add original results first (higher priority)
    for (const result of originalResults) {
      if (!seenIds.has(result.snippet.id)) {
        seenIds.add(result.snippet.id);
        combined.push(result);
      }
    }

    // Add expanded results that aren't duplicates
    for (const result of expandedResults) {
      if (!seenIds.has(result.snippet.id)) {
        seenIds.add(result.snippet.id);
        combined.push(result);
      }
    }

    // Sort by score descending
    return combined.sort((a, b) => b.score - a.score);
  }
  

  
  /**
   * Warmup method to initialize all components
   */
  async warmup(): Promise<void> {
    const startTime = Date.now();
    
    try {
      console.log('hybrid_retrieval_warmup_start');
      
      // Ensure factbook is loaded
      if (!this.factbookService.isLoaded()) {
        throw new Error('FactbookService not loaded - cannot warmup hybrid retrieval');
      }
      
      // Validate factbook index
      if (!this.factbookService.validateIndex()) {
        throw new Error('FactbookService index validation failed');
      }
      
      // Build BM25 index
      console.log('hybrid_retrieval_building_bm25_index');
      await this.bm25Retriever.buildIndex();
      
      // Build vector index if enabled
      if (this.vectorRetriever) {
        console.log('hybrid_retrieval_building_vector_index');
        const snippets = this.factbookService.getAllSnippets();
        await this.vectorRetriever.buildIndex(snippets);
      }
      
      // Update health status
      this.updateHealthStatus();
      
      const elapsedMs = Date.now() - startTime;
      const bm25Stats = this.bm25Retriever.getIndexStats();
      const vectorStats = this.vectorRetriever?.getIndexStats();
      
      console.log('hybrid_retrieval_warmup_complete', {
        time_ms: elapsedMs,
        factbook_snippets: this.factbookService.getSnippetCount(),
        bm25_index_stats: bm25Stats,
        vector_index_stats: vectorStats,
        health_status: this.healthStatus.status
      });
      
    } catch (error) {
      console.error('hybrid_retrieval_warmup_error', {
        error: error instanceof Error ? error.message : error
      });
      
      // Update health status to unhealthy
      this.healthStatus.status = 'unhealthy';
      this.healthStatus.details.push(`Warmup failed: ${error instanceof Error ? error.message : error}`);
      
      throw error;
    }
  }
  
  /**
   * Get current health status for monitoring
   */
  getHealthStatus(): HealthStatus {
    // Refresh health status if it's been more than 30 seconds
    if (Date.now() - this.lastHealthCheck > 30000) {
      this.updateHealthStatus();
    }
    
    return { ...this.healthStatus };
  }
  
  /**
   * Update health status by checking all components
   */
  private updateHealthStatus(): void {
    this.lastHealthCheck = Date.now();
    this.healthStatus.lastCheck = this.lastHealthCheck;
    this.healthStatus.details = [];
    
    // Check BM25 component (BM25Retriever)
    if (this.factbookService.isLoaded() && this.factbookService.validateIndex() && this.bm25Retriever.isReady()) {
      this.healthStatus.components.bm25 = 'healthy';
    } else {
      this.healthStatus.components.bm25 = 'unhealthy';
      if (!this.factbookService.isLoaded()) {
        this.healthStatus.details.push('BM25: FactbookService not loaded');
      } else if (!this.factbookService.validateIndex()) {
        this.healthStatus.details.push('BM25: FactbookService index invalid');
      } else if (!this.bm25Retriever.isReady()) {
        this.healthStatus.details.push('BM25: BM25Retriever index not built');
      }
    }
    
    // Check vector component
    if (this.config.enableEmbeddings && this.vectorRetriever) {
      try {
        const vectorStats = this.vectorRetriever.getIndexStats();
        if (vectorStats.size > 0) {
          this.healthStatus.components.vector = 'healthy';
          this.healthStatus.details.push(`Vector: Index built with ${vectorStats.size} embeddings`);
        } else {
          this.healthStatus.components.vector = 'degraded';
          this.healthStatus.details.push('Vector: Index not built');
        }
      } catch (error) {
        this.healthStatus.components.vector = 'unhealthy';
        this.healthStatus.details.push(`Vector: Error checking status - ${error instanceof Error ? error.message : error}`);
      }
    } else if (this.config.enableEmbeddings && !this.vectorRetriever) {
      this.healthStatus.components.vector = 'unhealthy';
      this.healthStatus.details.push('Vector: Enabled but not initialized (missing embedding cache)');
    } else {
      this.healthStatus.components.vector = 'degraded';
      this.healthStatus.details.push('Vector: Disabled by configuration');
    }
    
    // Check expansion component
    if (this.config.enableExpansion === 'auto' && this.queryExpander) {
      try {
        const cacheStats = this.queryExpander.getCacheStats();
        this.healthStatus.components.expansion = 'healthy';
        this.healthStatus.details.push(`Expansion: Ready with ${cacheStats.size} cached expansions`);
      } catch (error) {
        this.healthStatus.components.expansion = 'degraded';
        this.healthStatus.details.push(`Expansion: Error checking status - ${error instanceof Error ? error.message : error}`);
      }
    } else if (this.config.enableExpansion === 'auto' && !this.queryExpander) {
      this.healthStatus.components.expansion = 'unhealthy';
      this.healthStatus.details.push('Expansion: Enabled but not initialized (missing OpenAI API key?)');
    } else {
      this.healthStatus.components.expansion = 'degraded';
      this.healthStatus.details.push('Expansion: Disabled by configuration');
    }
    
    // Check reranking component
    if (this.config.enableReranking && this.resultReranker) {
      try {
        const rerankStats = this.resultReranker.getStats();
        this.healthStatus.components.reranking = 'healthy';
        this.healthStatus.details.push(`Reranking: Ready with ${rerankStats.totalRequests} requests processed`);
      } catch (error) {
        this.healthStatus.components.reranking = 'degraded';
        this.healthStatus.details.push(`Reranking: Error checking status - ${error instanceof Error ? error.message : error}`);
      }
    } else if (this.config.enableReranking && !this.resultReranker) {
      this.healthStatus.components.reranking = 'unhealthy';
      this.healthStatus.details.push('Reranking: Enabled but not initialized (missing OpenAI API key?)');
    } else {
      this.healthStatus.components.reranking = 'degraded';
      this.healthStatus.details.push('Reranking: Disabled by configuration');
    }
    
    // Determine overall status
    const componentStatuses = Object.values(this.healthStatus.components);
    if (componentStatuses.includes('unhealthy')) {
      this.healthStatus.status = 'unhealthy';
    } else if (componentStatuses.includes('degraded')) {
      this.healthStatus.status = 'degraded';
    } else {
      this.healthStatus.status = 'healthy';
    }
  }
  
  /**
   * Get configuration for debugging and monitoring
   */
  getConfig(): HybridRetrievalConfig {
    return { ...this.config };
  }
  
  /**
   * Update configuration at runtime (for A/B testing)
   */
  updateConfig(newConfig: Partial<HybridRetrievalConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update BM25 retriever config if BM25 parameters changed
    if (newConfig.bm25K1 !== undefined || newConfig.bm25B !== undefined || newConfig.vectorMaxResults !== undefined) {
      const bm25Config = {
        k1: this.config.bm25K1,
        b: this.config.bm25B,
        maxResults: this.config.vectorMaxResults
      };
      this.bm25Retriever.updateConfig(bm25Config);
    }
    
    // Update vector retriever config if vector parameters changed
    if (this.vectorRetriever && (newConfig.vectorSimilarityThreshold !== undefined || newConfig.vectorMaxResults !== undefined)) {
      const vectorConfig = {
        similarityThreshold: this.config.vectorSimilarityThreshold,
        maxResults: this.config.vectorMaxResults
      };
      this.vectorRetriever.updateConfig(vectorConfig);
    }
    
    // Update result fuser config if fusion parameters changed
    if (newConfig.fusionK !== undefined || newConfig.bm25Weight !== undefined || newConfig.vectorWeight !== undefined) {
      const fusionConfig = {
        k: this.config.fusionK,
        bm25Weight: this.config.bm25Weight,
        vectorWeight: this.config.vectorWeight
      };
      this.resultFuser.updateConfig(fusionConfig);
    }

    // Update query expander config if expansion parameters changed
    if (this.queryExpander && (newConfig.expansionTimeoutMs !== undefined)) {
      const expansionConfig = {
        timeoutMs: this.config.expansionTimeoutMs
      };
      this.queryExpander.updateConfig(expansionConfig);
    }
    
    this.updateHealthStatus();
    
    console.log('hybrid_retrieval_config_updated', {
      new_config: newConfig,
      full_config: this.config
    });
  }

  /**
   * Set cache manager for comprehensive caching
   */
  setCacheManager(cacheManager: CacheManager): void {
    this.cacheManager = cacheManager;
    console.log('hybrid_retriever_cache_manager_set');
  }

  /**
   * Set performance monitor for metrics collection
   */
  setPerformanceMonitor(performanceMonitor: PerformanceMonitor): void {
    this.performanceMonitor = performanceMonitor;
    console.log('hybrid_retriever_performance_monitor_set');
  }

  /**
   * Get memory usage information
   */
  getMemoryUsage(): { usedMB: number; maxMB: number; utilizationPercent: number } {
    if (this.cacheManager) {
      return this.cacheManager.getMemoryUsage();
    }
    
    // Fallback estimation
    return {
      usedMB: 0,
      maxMB: 100,
      utilizationPercent: 0
    };
  }

  /**
   * Invalidate caches when factbook content changes
   */
  async invalidateOnFactbookChange(version: string): Promise<void> {
    if (this.cacheManager) {
      await this.cacheManager.invalidateOnFactbookChange(version);
    }
    
    // Rebuild indices
    if (this.bm25Retriever) {
      await this.bm25Retriever.buildIndex();
    }
    
    if (this.vectorRetriever) {
      const snippets = this.factbookService.getAllSnippets();
      await this.vectorRetriever.buildIndex(snippets);
    }
    
    console.log('hybrid_retriever_factbook_invalidation_complete', { version });
  }

  /**
   * Invalidate caches when model versions change
   */
  async invalidateOnModelChange(modelVersion: string): Promise<void> {
    if (this.cacheManager) {
      await this.cacheManager.invalidateOnModelChange(modelVersion);
    }
    
    console.log('hybrid_retriever_model_invalidation_complete', { version: modelVersion });
  }

  /**
   * Generate a hash for query identification in logging and caching
   */
  private hashQuery(query: string): string {
    // Simple hash function for query identification
    let hash = 0;
    for (let i = 0; i < query.length; i++) {
      const char = query.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }
}

/**
 * Create a singleton instance with default configuration
 */
export const hybridRetriever = new HybridRetriever(parseHybridRetrievalConfig());