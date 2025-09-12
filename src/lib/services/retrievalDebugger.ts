// src/lib/services/retrievalDebugger.ts
// Debugging utilities for hybrid retrieval system with decision path tracking

import { RetrievalResult, RetrievalMetrics, HybridRetrievalConfig } from './hybridRetrieval';
import { BM25Result } from './bm25Retriever';
import { VectorResult } from './vectorRetriever';
import { FusedResult } from './resultFuser';
import { ExpansionResponse } from './queryExpander';

/**
 * Detailed decision path for debugging retrieval logic
 */
export interface RetrievalDecisionPath {
  query: string;
  timestamp: number;
  
  // Configuration context
  config: {
    enableEmbeddings: boolean;
    enableExpansion: string;
    enableReranking: boolean;
    expansionThreshold: number;
    lowConfidenceThreshold: number;
    minResultsThreshold: number;
  };
  
  // Step-by-step execution path
  steps: RetrievalStep[];
  
  // Final results and metrics
  finalResults: RetrievalResult[];
  finalMetrics: RetrievalMetrics;
  
  // Decision points
  decisions: {
    vectorSearchUsed: boolean;
    expansionTriggered: boolean;
    expansionReason?: string;
    rerankingApplied: boolean;
    fallbackUsed: boolean;
    fallbackReason?: string;
  };
  
  // Performance breakdown
  performanceBreakdown: {
    bm25Percentage: number;
    vectorPercentage: number;
    expansionPercentage: number;
    rerankingPercentage: number;
    fusionPercentage: number;
    overheadPercentage: number;
  };
}

/**
 * Individual step in the retrieval process
 */
export interface RetrievalStep {
  stepName: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  success: boolean;
  
  // Input context
  input?: {
    query?: string;
    candidateCount?: number;
    confidence?: number;
  };
  
  // Output results
  output?: {
    resultCount?: number;
    topScore?: number;
    averageScore?: number;
    confidence?: number;
  };
  
  // Step-specific data
  stepData?: {
    // BM25 step data
    bm25Results?: Array<{
      id: string;
      score: number;
      termMatches: string[];
    }>;
    
    // Vector step data
    vectorResults?: Array<{
      id: string;
      similarity: number;
    }>;
    
    // Fusion step data
    fusionResults?: Array<{
      id: string;
      score: number;
      source: string;
      bm25Score?: number;
      vectorSimilarity?: number;
    }>;
    
    // Expansion step data
    expansionData?: {
      originalQuery: string;
      canonicalQuery: string;
      alternates: string[];
      relatedConcepts: string[];
      confidence: number;
    };
    
    // Reranking step data
    rerankingData?: Array<{
      id: string;
      originalScore: number;
      rerankScore: number;
      relevanceScore: number;
    }>;
  };
  
  // Errors and warnings
  errors: string[];
  warnings: string[];
  
  // Decision rationale
  rationale?: string;
}

/**
 * Score breakdown for individual results
 */
export interface ResultScoreBreakdown {
  snippetId: string;
  finalScore: number;
  
  // Component scores
  bm25Score?: number;
  vectorSimilarity?: number;
  fusionScore?: number;
  rerankScore?: number;
  
  // Score evolution through pipeline
  scoreEvolution: Array<{
    stage: string;
    score: number;
    rank: number;
  }>;
  
  // Matching details
  termMatches?: string[];
  semanticMatches?: string[];
  
  // Confidence factors
  confidenceFactors: {
    scoreConfidence: number;
    rankConfidence: number;
    methodConfidence: number;
    overallConfidence: number;
  };
}

/**
 * Query analysis for debugging
 */
export interface QueryAnalysis {
  query: string;
  
  // Query characteristics
  characteristics: {
    length: number;
    wordCount: number;
    hasQuestionWords: boolean;
    hasSpecificTerms: boolean;
    estimatedComplexity: 'simple' | 'medium' | 'complex';
  };
  
  // Preprocessing results
  preprocessing: {
    normalizedQuery: string;
    extractedTerms: string[];
    stopWordsRemoved: string[];
    stemmedTerms?: string[];
  };
  
  // Predicted performance
  predictions: {
    expectedBM25Effectiveness: number;
    expectedVectorEffectiveness: number;
    expansionLikelihood: number;
    estimatedResultCount: number;
  };
}

/**
 * Comprehensive debugging utility for hybrid retrieval system
 */
export class RetrievalDebugger {
  private debugHistory: RetrievalDecisionPath[] = [];
  private maxHistorySize: number = 100;
  private enableDetailedLogging: boolean = false;
  
  constructor(options?: {
    maxHistorySize?: number;
    enableDetailedLogging?: boolean;
  }) {
    this.maxHistorySize = options?.maxHistorySize || 100;
    this.enableDetailedLogging = options?.enableDetailedLogging || false;
  }
  
  /**
   * Start debugging a retrieval operation
   */
  startDebugging(query: string, config: HybridRetrievalConfig): RetrievalDecisionPath {
    const debugPath: RetrievalDecisionPath = {
      query,
      timestamp: Date.now(),
      config: {
        enableEmbeddings: config.enableEmbeddings,
        enableExpansion: config.enableExpansion,
        enableReranking: config.enableReranking,
        expansionThreshold: config.expansionThreshold,
        lowConfidenceThreshold: config.lowConfidenceThreshold,
        minResultsThreshold: config.minResultsThreshold
      },
      steps: [],
      finalResults: [],
      finalMetrics: {} as RetrievalMetrics,
      decisions: {
        vectorSearchUsed: false,
        expansionTriggered: false,
        rerankingApplied: false,
        fallbackUsed: false
      },
      performanceBreakdown: {
        bm25Percentage: 0,
        vectorPercentage: 0,
        expansionPercentage: 0,
        rerankingPercentage: 0,
        fusionPercentage: 0,
        overheadPercentage: 0
      }
    };
    
    // Add to history
    this.debugHistory.push(debugPath);
    
    // Maintain history size
    if (this.debugHistory.length > this.maxHistorySize) {
      this.debugHistory = this.debugHistory.slice(-this.maxHistorySize);
    }
    
    if (this.enableDetailedLogging) {
      console.log('retrieval_debug_start', {
        query,
        config: debugPath.config,
        timestamp: debugPath.timestamp
      });
    }
    
    return debugPath;
  }
  
  /**
   * Record a step in the retrieval process
   */
  recordStep(
    debugPath: RetrievalDecisionPath,
    stepName: string,
    startTime: number,
    endTime: number,
    success: boolean,
    stepData?: any,
    rationale?: string
  ): void {
    const step: RetrievalStep = {
      stepName,
      startTime,
      endTime,
      durationMs: endTime - startTime,
      success,
      stepData,
      errors: [],
      warnings: [],
      rationale
    };
    
    debugPath.steps.push(step);
    
    if (this.enableDetailedLogging) {
      console.log('retrieval_debug_step', {
        query: debugPath.query,
        step: stepName,
        duration_ms: step.durationMs,
        success,
        rationale
      });
    }
  }
  
  /**
   * Record BM25 retrieval step
   */
  recordBM25Step(
    debugPath: RetrievalDecisionPath,
    startTime: number,
    endTime: number,
    query: string,
    results: BM25Result[],
    success: boolean = true
  ): void {
    const stepData = {
      bm25Results: results.slice(0, 10).map(r => ({
        id: r.snippet.id,
        score: r.score,
        termMatches: r.termMatches
      }))
    };
    
    this.recordStep(
      debugPath,
      'bm25_retrieval',
      startTime,
      endTime,
      success,
      stepData,
      `BM25 search found ${results.length} results with term matching`
    );
    
    // Update input/output
    const step = debugPath.steps[debugPath.steps.length - 1];
    step.input = { query };
    step.output = {
      resultCount: results.length,
      topScore: results.length > 0 ? results[0].score : 0,
      averageScore: results.length > 0 
        ? results.reduce((sum, r) => sum + r.score, 0) / results.length 
        : 0
    };
  }
  
  /**
   * Record vector retrieval step
   */
  recordVectorStep(
    debugPath: RetrievalDecisionPath,
    startTime: number,
    endTime: number,
    query: string,
    results: VectorResult[],
    success: boolean = true
  ): void {
    const stepData = {
      vectorResults: results.slice(0, 10).map(r => ({
        id: r.snippet.id,
        similarity: r.similarity
      }))
    };
    
    this.recordStep(
      debugPath,
      'vector_retrieval',
      startTime,
      endTime,
      success,
      stepData,
      `Vector search found ${results.length} results with semantic similarity`
    );
    
    debugPath.decisions.vectorSearchUsed = success;
    
    // Update input/output
    const step = debugPath.steps[debugPath.steps.length - 1];
    step.input = { query };
    step.output = {
      resultCount: results.length,
      topScore: results.length > 0 ? results[0].similarity : 0,
      averageScore: results.length > 0 
        ? results.reduce((sum, r) => sum + r.similarity, 0) / results.length 
        : 0
    };
  }
  
  /**
   * Record fusion step
   */
  recordFusionStep(
    debugPath: RetrievalDecisionPath,
    startTime: number,
    endTime: number,
    bm25Results: BM25Result[],
    vectorResults: VectorResult[],
    fusedResults: FusedResult[],
    success: boolean = true
  ): void {
    const stepData = {
      fusionResults: fusedResults.slice(0, 10).map(r => ({
        id: r.snippet.id,
        score: r.score,
        source: r.source,
        bm25Score: r.metadata.bm25Score,
        vectorSimilarity: r.metadata.vectorSimilarity
      }))
    };
    
    this.recordStep(
      debugPath,
      'result_fusion',
      startTime,
      endTime,
      success,
      stepData,
      `Fused ${bm25Results.length} BM25 and ${vectorResults.length} vector results into ${fusedResults.length} combined results`
    );
    
    // Update input/output
    const step = debugPath.steps[debugPath.steps.length - 1];
    step.input = { 
      candidateCount: bm25Results.length + vectorResults.length 
    };
    step.output = {
      resultCount: fusedResults.length,
      topScore: fusedResults.length > 0 ? fusedResults[0].score : 0,
      averageScore: fusedResults.length > 0 
        ? fusedResults.reduce((sum, r) => sum + r.score, 0) / fusedResults.length 
        : 0
    };
  }
  
  /**
   * Record expansion decision and execution
   */
  recordExpansionStep(
    debugPath: RetrievalDecisionPath,
    startTime: number,
    endTime: number,
    originalQuery: string,
    results: RetrievalResult[],
    shouldExpand: boolean,
    reason: string,
    expansion?: ExpansionResponse,
    success: boolean = true
  ): void {
    const stepData = expansion ? {
      expansionData: {
        originalQuery,
        canonicalQuery: expansion.canonical_query,
        alternates: expansion.alternates,
        relatedConcepts: expansion.related_concepts,
        confidence: expansion.confidence
      }
    } : undefined;
    
    this.recordStep(
      debugPath,
      'query_expansion',
      startTime,
      endTime,
      success,
      stepData,
      shouldExpand 
        ? `Query expanded due to ${reason}. Generated ${expansion?.alternates.length || 0} alternates and ${expansion?.related_concepts.length || 0} concepts`
        : `Query expansion skipped: ${reason}`
    );
    
    debugPath.decisions.expansionTriggered = shouldExpand && success;
    debugPath.decisions.expansionReason = reason;
    
    // Update input/output
    const step = debugPath.steps[debugPath.steps.length - 1];
    step.input = { 
      query: originalQuery,
      candidateCount: results.length,
      confidence: results.length > 0 ? results[0].confidence : 0
    };
  }
  
  /**
   * Record reranking step
   */
  recordRerankingStep(
    debugPath: RetrievalDecisionPath,
    startTime: number,
    endTime: number,
    originalResults: RetrievalResult[],
    rerankedResults: RetrievalResult[],
    success: boolean = true
  ): void {
    const stepData = {
      rerankingData: originalResults.slice(0, 10).map((original, index) => {
        const reranked = rerankedResults.find(r => r.snippet.id === original.snippet.id);
        return {
          id: original.snippet.id,
          originalScore: original.score,
          rerankScore: reranked?.score || 0,
          relevanceScore: reranked?.metadata?.fusionScore || 0
        };
      })
    };
    
    this.recordStep(
      debugPath,
      'result_reranking',
      startTime,
      endTime,
      success,
      stepData,
      `Reranked ${originalResults.length} results using LLM relevance scoring`
    );
    
    debugPath.decisions.rerankingApplied = success;
    
    // Update input/output
    const step = debugPath.steps[debugPath.steps.length - 1];
    step.input = { 
      candidateCount: originalResults.length,
      confidence: originalResults.length > 0 ? originalResults[0].confidence : 0
    };
    step.output = {
      resultCount: rerankedResults.length,
      topScore: rerankedResults.length > 0 ? rerankedResults[0].score : 0,
      averageScore: rerankedResults.length > 0 
        ? rerankedResults.reduce((sum, r) => sum + r.score, 0) / rerankedResults.length 
        : 0
    };
  }
  
  /**
   * Record fallback usage
   */
  recordFallback(
    debugPath: RetrievalDecisionPath,
    fromLevel: string,
    toLevel: string,
    reason: string,
    error?: Error
  ): void {
    debugPath.decisions.fallbackUsed = true;
    debugPath.decisions.fallbackReason = reason;
    
    // Add error to the last step if available
    if (debugPath.steps.length > 0) {
      const lastStep = debugPath.steps[debugPath.steps.length - 1];
      if (error) {
        lastStep.errors.push(error.message);
      }
      lastStep.warnings.push(`Fallback from ${fromLevel} to ${toLevel}: ${reason}`);
    }
    
    if (this.enableDetailedLogging) {
      console.log('retrieval_debug_fallback', {
        query: debugPath.query,
        from_level: fromLevel,
        to_level: toLevel,
        reason,
        error: error?.message
      });
    }
  }
  
  /**
   * Finalize debugging with results and metrics
   */
  finalize(
    debugPath: RetrievalDecisionPath,
    results: RetrievalResult[],
    metrics: RetrievalMetrics
  ): void {
    debugPath.finalResults = results;
    debugPath.finalMetrics = metrics;
    
    // Calculate performance breakdown
    const totalTime = metrics.totalTimeMs;
    if (totalTime > 0) {
      debugPath.performanceBreakdown = {
        bm25Percentage: (metrics.bm25TimeMs / totalTime) * 100,
        vectorPercentage: ((metrics.vectorTimeMs || 0) / totalTime) * 100,
        expansionPercentage: ((metrics.expansionTimeMs || 0) / totalTime) * 100,
        rerankingPercentage: ((metrics.rerankTimeMs || 0) / totalTime) * 100,
        fusionPercentage: ((metrics.fusionTimeMs || 0) / totalTime) * 100,
        overheadPercentage: Math.max(0, 100 - (
          (metrics.bm25TimeMs + (metrics.vectorTimeMs || 0) + 
           (metrics.expansionTimeMs || 0) + (metrics.rerankTimeMs || 0) + 
           (metrics.fusionTimeMs || 0)) / totalTime) * 100)
      };
    }
    
    if (this.enableDetailedLogging) {
      console.log('retrieval_debug_complete', {
        query: debugPath.query,
        total_steps: debugPath.steps.length,
        final_result_count: results.length,
        total_time_ms: totalTime,
        performance_breakdown: debugPath.performanceBreakdown,
        decisions: debugPath.decisions
      });
    }
  }
  
  /**
   * Analyze query characteristics for debugging
   */
  analyzeQuery(query: string): QueryAnalysis {
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 0);
    const questionWords = ['what', 'where', 'when', 'who', 'why', 'how', 'which'];
    const specificTerms = words.filter(w => w.length > 3 && !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'man', 'men', 'put', 'say', 'she', 'too', 'use'].includes(w));
    
    return {
      query,
      characteristics: {
        length: query.length,
        wordCount: words.length,
        hasQuestionWords: questionWords.some(qw => words.includes(qw)),
        hasSpecificTerms: specificTerms.length > 0,
        estimatedComplexity: words.length <= 3 ? 'simple' : 
                           words.length <= 8 ? 'medium' : 'complex'
      },
      preprocessing: {
        normalizedQuery: query.toLowerCase().trim(),
        extractedTerms: words,
        stopWordsRemoved: specificTerms
      },
      predictions: {
        expectedBM25Effectiveness: specificTerms.length > 0 ? 0.8 : 0.4,
        expectedVectorEffectiveness: words.length > 2 ? 0.7 : 0.3,
        expansionLikelihood: specificTerms.length < 2 ? 0.6 : 0.2,
        estimatedResultCount: specificTerms.length * 3
      }
    };
  }
  
  /**
   * Generate detailed score breakdown for results
   */
  generateScoreBreakdown(results: RetrievalResult[]): ResultScoreBreakdown[] {
    return results.map(result => {
      const breakdown: ResultScoreBreakdown = {
        snippetId: result.snippet.id,
        finalScore: result.score,
        bm25Score: result.metadata?.bm25Score,
        vectorSimilarity: result.metadata?.vectorSimilarity,
        fusionScore: result.metadata?.fusionScore,
        scoreEvolution: [],
        termMatches: result.metadata?.termMatches,
        confidenceFactors: {
          scoreConfidence: Math.min(result.score * 0.8, 1.0),
          rankConfidence: result.metadata?.rank ? Math.max(0, 1 - (result.metadata.rank * 0.1)) : 0.5,
          methodConfidence: result.source === 'both' ? 0.9 : 
                           result.source === 'vector' ? 0.7 : 0.6,
          overallConfidence: result.confidence
        }
      };
      
      // Build score evolution
      if (result.metadata?.bm25Score) {
        breakdown.scoreEvolution.push({
          stage: 'bm25',
          score: result.metadata.bm25Score,
          rank: result.metadata.rank || 0
        });
      }
      
      if (result.metadata?.vectorSimilarity) {
        breakdown.scoreEvolution.push({
          stage: 'vector',
          score: result.metadata.vectorSimilarity,
          rank: result.metadata.rank || 0
        });
      }
      
      if (result.metadata?.fusionScore) {
        breakdown.scoreEvolution.push({
          stage: 'fusion',
          score: result.metadata.fusionScore,
          rank: result.metadata.rank || 0
        });
      }
      
      breakdown.scoreEvolution.push({
        stage: 'final',
        score: result.score,
        rank: result.metadata?.rank || 0
      });
      
      return breakdown;
    });
  }
  
  /**
   * Get recent debugging history
   */
  getDebugHistory(count: number = 20): RetrievalDecisionPath[] {
    return this.debugHistory.slice(-count);
  }
  
  /**
   * Get debugging history for specific query
   */
  getQueryDebugHistory(query: string): RetrievalDecisionPath[] {
    return this.debugHistory.filter(path => 
      path.query.toLowerCase().includes(query.toLowerCase())
    );
  }
  
  /**
   * Export debug data for analysis
   */
  exportDebugData(format: 'json' | 'summary' = 'json'): string {
    if (format === 'summary') {
      return this.generateDebugSummary();
    }
    
    return JSON.stringify(this.debugHistory, null, 2);
  }
  
  /**
   * Clear debug history
   */
  clearHistory(): void {
    this.debugHistory = [];
  }
  
  // Private helper methods
  
  private generateDebugSummary(): string {
    const summary = {
      totalQueries: this.debugHistory.length,
      timeRange: this.debugHistory.length > 0 ? {
        start: this.debugHistory[0].timestamp,
        end: this.debugHistory[this.debugHistory.length - 1].timestamp
      } : null,
      
      // Performance summary
      averageLatency: this.debugHistory.reduce((sum, path) => 
        sum + path.finalMetrics.totalTimeMs, 0) / this.debugHistory.length,
      
      // Feature usage
      vectorUsage: this.debugHistory.filter(p => p.decisions.vectorSearchUsed).length,
      expansionUsage: this.debugHistory.filter(p => p.decisions.expansionTriggered).length,
      rerankingUsage: this.debugHistory.filter(p => p.decisions.rerankingApplied).length,
      fallbackUsage: this.debugHistory.filter(p => p.decisions.fallbackUsed).length,
      
      // Common patterns
      commonQueries: this.getCommonQueryPatterns(),
      commonErrors: this.getCommonErrors(),
      performanceBottlenecks: this.getPerformanceBottlenecks()
    };
    
    return JSON.stringify(summary, null, 2);
  }
  
  private getCommonQueryPatterns(): Array<{ pattern: string; count: number }> {
    const patterns = new Map<string, number>();
    
    this.debugHistory.forEach(path => {
      const analysis = this.analyzeQuery(path.query);
      const pattern = `${analysis.characteristics.estimatedComplexity}_${analysis.characteristics.wordCount}words`;
      patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
    });
    
    return Array.from(patterns.entries())
      .map(([pattern, count]) => ({ pattern, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }
  
  private getCommonErrors(): Array<{ error: string; count: number }> {
    const errors = new Map<string, number>();
    
    this.debugHistory.forEach(path => {
      path.steps.forEach(step => {
        step.errors.forEach(error => {
          errors.set(error, (errors.get(error) || 0) + 1);
        });
      });
    });
    
    return Array.from(errors.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }
  
  private getPerformanceBottlenecks(): Array<{ component: string; avgLatency: number }> {
    const componentTimes = {
      bm25: [] as number[],
      vector: [] as number[],
      expansion: [] as number[],
      reranking: [] as number[],
      fusion: [] as number[]
    };
    
    this.debugHistory.forEach(path => {
      path.steps.forEach(step => {
        if (step.stepName === 'bm25_retrieval') {
          componentTimes.bm25.push(step.durationMs);
        } else if (step.stepName === 'vector_retrieval') {
          componentTimes.vector.push(step.durationMs);
        } else if (step.stepName === 'query_expansion') {
          componentTimes.expansion.push(step.durationMs);
        } else if (step.stepName === 'result_reranking') {
          componentTimes.reranking.push(step.durationMs);
        } else if (step.stepName === 'result_fusion') {
          componentTimes.fusion.push(step.durationMs);
        }
      });
    });
    
    return Object.entries(componentTimes)
      .map(([component, times]) => ({
        component,
        avgLatency: times.length > 0 ? times.reduce((sum, t) => sum + t, 0) / times.length : 0
      }))
      .sort((a, b) => b.avgLatency - a.avgLatency);
  }
}

/**
 * Global retrieval debugger instance
 */
export const retrievalDebugger = new RetrievalDebugger({
  maxHistorySize: parseInt(process.env.RETRIEVAL_DEBUG_HISTORY_SIZE || '100'),
  enableDetailedLogging: process.env.RETRIEVAL_DEBUG_DETAILED === 'true'
});