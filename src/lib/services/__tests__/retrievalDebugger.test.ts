// src/lib/services/__tests__/retrievalDebugger.test.ts
// Tests for retrieval debugging infrastructure

import { describe, it, expect, beforeEach } from 'vitest';
import { RetrievalDebugger } from '../retrievalDebugger';
import { HybridRetrievalConfig, RetrievalResult, RetrievalMetrics } from '../hybridRetrieval';
import { BM25Result } from '../bm25Retriever';
import { VectorResult } from '../vectorRetriever';
import { FusedResult } from '../resultFuser';
import { ExpansionResponse } from '../queryExpander';

describe('RetrievalDebugger', () => {
  let retrieverDebugger: RetrievalDebugger;
  let mockConfig: HybridRetrievalConfig;
  let mockResults: RetrievalResult[];
  let mockMetrics: RetrievalMetrics;

  beforeEach(() => {
    retrieverDebugger = new RetrievalDebugger({
      maxHistorySize: 50,
      enableDetailedLogging: false
    });

    mockConfig = {
      enableEmbeddings: true,
      enableExpansion: 'auto',
      enableReranking: false,
      expansionThreshold: 0.3,
      maxResults: 10,
      fusionK: 60,
      timeoutMs: 500,
      bm25K1: 1.2,
      bm25B: 0.75,
      vectorSimilarityThreshold: 0.3,
      vectorMaxResults: 20,
      bm25Weight: 0.6,
      vectorWeight: 0.4,
      expansionTimeoutMs: 200,
      lowConfidenceThreshold: 0.35,
      minResultsThreshold: 2,
      rerankTimeoutMs: 150
    };

    mockResults = [
      {
        snippet: {
          id: 'test1',
          path: 'test/path1',
          text: 'Test snippet 1',
          topics: ['test'],
          keywords: ['test', 'snippet']
        },
        score: 0.85,
        source: 'bm25',
        confidence: 0.8,
        metadata: {
          bm25Score: 0.85,
          termMatches: ['test'],
          rank: 1
        }
      }
    ];

    mockMetrics = {
      totalTimeMs: 150,
      bm25TimeMs: 50,
      vectorTimeMs: 60,
      expansionTimeMs: 30,
      rerankTimeMs: 10,
      fusionTimeMs: 5,
      cacheHit: false,
      embeddingCacheHits: 2,
      expansionCacheHits: 1,
      methodsUsed: ['bm25', 'vector', 'fusion'],
      fallbackLevel: 'none',
      resultCount: 1,
      confidenceScore: 0.8,
      topScore: 0.85,
      averageScore: 0.85,
      expansionTriggered: true,
      rerankingApplied: false,
      fallbackUsed: false,
      bm25Available: true,
      vectorAvailable: true,
      expansionAvailable: true,
      rerankingAvailable: false,
      errors: [],
      warnings: ['Test warning'],
      timeoutOccurred: false,
      memoryUsageMB: 128
    };
  });

  describe('startDebugging', () => {
    it('should create a new debug path', () => {
      const query = 'test query';
      const debugPath = debugger.startDebugging(query, mockConfig);
      
      expect(debugPath.query).toBe(query);
      expect(debugPath.timestamp).toBeCloseTo(Date.now(), -2);
      expect(debugPath.config.enableEmbeddings).toBe(true);
      expect(debugPath.config.enableExpansion).toBe('auto');
      expect(debugPath.steps).toHaveLength(0);
      expect(debugPath.decisions.vectorSearchUsed).toBe(false);
      expect(debugPath.decisions.expansionTriggered).toBe(false);
    });

    it('should add debug path to history', () => {
      const query = 'test query';
      debugger.startDebugging(query, mockConfig);
      
      const history = debugger.getDebugHistory(10);
      expect(history).toHaveLength(1);
      expect(history[0].query).toBe(query);
    });

    it('should maintain history size limit', () => {
      const smallDebugger = new RetrievalDebugger({ maxHistorySize: 2 });
      
      smallDebugger.startDebugging('query1', mockConfig);
      smallDebugger.startDebugging('query2', mockConfig);
      smallDebugger.startDebugging('query3', mockConfig);
      
      const history = smallDebugger.getDebugHistory(10);
      expect(history).toHaveLength(2);
      expect(history[0].query).toBe('query2');
      expect(history[1].query).toBe('query3');
    });
  });

  describe('recordStep', () => {
    let debugPath: any;

    beforeEach(() => {
      debugPath = debugger.startDebugging('test query', mockConfig);
    });

    it('should record a step with timing and context', () => {
      const startTime = Date.now();
      const endTime = startTime + 50;
      
      debugger.recordStep(
        debugPath,
        'test_step',
        startTime,
        endTime,
        true,
        { testData: 'value' },
        'Test rationale'
      );
      
      expect(debugPath.steps).toHaveLength(1);
      const step = debugPath.steps[0];
      
      expect(step.stepName).toBe('test_step');
      expect(step.startTime).toBe(startTime);
      expect(step.endTime).toBe(endTime);
      expect(step.durationMs).toBe(50);
      expect(step.success).toBe(true);
      expect(step.stepData).toEqual({ testData: 'value' });
      expect(step.rationale).toBe('Test rationale');
      expect(step.errors).toHaveLength(0);
      expect(step.warnings).toHaveLength(0);
    });
  });

  describe('recordBM25Step', () => {
    let debugPath: any;
    let mockBM25Results: BM25Result[];

    beforeEach(() => {
      debugPath = debugger.startDebugging('test query', mockConfig);
      mockBM25Results = [
        {
          snippet: mockResults[0].snippet,
          score: 0.85,
          termMatches: ['test']
        }
      ];
    });

    it('should record BM25 step with results', () => {
      const startTime = Date.now();
      const endTime = startTime + 50;
      
      debugger.recordBM25Step(debugPath, startTime, endTime, 'test query', mockBM25Results, true);
      
      expect(debugPath.steps).toHaveLength(1);
      const step = debugPath.steps[0];
      
      expect(step.stepName).toBe('bm25_retrieval');
      expect(step.success).toBe(true);
      expect(step.input?.query).toBe('test query');
      expect(step.output?.resultCount).toBe(1);
      expect(step.output?.topScore).toBe(0.85);
      expect(step.stepData?.bm25Results).toHaveLength(1);
      expect(step.stepData?.bm25Results[0].id).toBe('test1');
      expect(step.stepData?.bm25Results[0].score).toBe(0.85);
      expect(step.stepData?.bm25Results[0].termMatches).toEqual(['test']);
    });

    it('should handle failed BM25 step', () => {
      const startTime = Date.now();
      const endTime = startTime + 50;
      
      debugger.recordBM25Step(debugPath, startTime, endTime, 'test query', [], false);
      
      const step = debugPath.steps[0];
      expect(step.success).toBe(false);
      expect(step.output?.resultCount).toBe(0);
      expect(step.stepData?.bm25Results).toHaveLength(0);
    });
  });

  describe('recordVectorStep', () => {
    let debugPath: any;
    let mockVectorResults: VectorResult[];

    beforeEach(() => {
      debugPath = debugger.startDebugging('test query', mockConfig);
      mockVectorResults = [
        {
          snippet: mockResults[0].snippet,
          similarity: 0.75,
          embedding: [0.1, 0.2, 0.3]
        }
      ];
    });

    it('should record vector step with results', () => {
      const startTime = Date.now();
      const endTime = startTime + 60;
      
      debugger.recordVectorStep(debugPath, startTime, endTime, 'test query', mockVectorResults, true);
      
      expect(debugPath.steps).toHaveLength(1);
      expect(debugPath.decisions.vectorSearchUsed).toBe(true);
      
      const step = debugPath.steps[0];
      expect(step.stepName).toBe('vector_retrieval');
      expect(step.success).toBe(true);
      expect(step.output?.topScore).toBe(0.75);
      expect(step.stepData?.vectorResults).toHaveLength(1);
      expect(step.stepData?.vectorResults[0].similarity).toBe(0.75);
    });
  });

  describe('recordFusionStep', () => {
    let debugPath: any;
    let mockBM25Results: BM25Result[];
    let mockVectorResults: VectorResult[];
    let mockFusedResults: FusedResult[];

    beforeEach(() => {
      debugPath = debugger.startDebugging('test query', mockConfig);
      
      mockBM25Results = [
        {
          snippet: mockResults[0].snippet,
          score: 0.85,
          termMatches: ['test']
        }
      ];
      
      mockVectorResults = [
        {
          snippet: mockResults[0].snippet,
          similarity: 0.75,
          embedding: [0.1, 0.2, 0.3]
        }
      ];
      
      mockFusedResults = [
        {
          snippet: mockResults[0].snippet,
          score: 0.8,
          source: 'both',
          metadata: {
            bm25Score: 0.85,
            vectorSimilarity: 0.75,
            fusionScore: 0.8,
            termMatches: ['test'],
            rank: 1
          }
        }
      ];
    });

    it('should record fusion step with combined results', () => {
      const startTime = Date.now();
      const endTime = startTime + 5;
      
      debugger.recordFusionStep(
        debugPath,
        startTime,
        endTime,
        mockBM25Results,
        mockVectorResults,
        mockFusedResults,
        true
      );
      
      expect(debugPath.steps).toHaveLength(1);
      
      const step = debugPath.steps[0];
      expect(step.stepName).toBe('result_fusion');
      expect(step.success).toBe(true);
      expect(step.input?.candidateCount).toBe(2); // BM25 + Vector
      expect(step.output?.resultCount).toBe(1);
      expect(step.stepData?.fusionResults).toHaveLength(1);
      expect(step.stepData?.fusionResults[0].source).toBe('both');
      expect(step.stepData?.fusionResults[0].bm25Score).toBe(0.85);
      expect(step.stepData?.fusionResults[0].vectorSimilarity).toBe(0.75);
    });
  });

  describe('recordExpansionStep', () => {
    let debugPath: any;
    let mockExpansion: ExpansionResponse;

    beforeEach(() => {
      debugPath = debugger.startDebugging('test query', mockConfig);
      mockExpansion = {
        canonical_query: 'test query',
        alternates: ['test', 'query', 'search'],
        related_concepts: ['testing', 'querying'],
        confidence: 0.8
      };
    });

    it('should record expansion step when triggered', () => {
      const startTime = Date.now();
      const endTime = startTime + 30;
      
      debugger.recordExpansionStep(
        debugPath,
        startTime,
        endTime,
        'test query',
        mockResults,
        true,
        'low_top_score',
        mockExpansion,
        true
      );
      
      expect(debugPath.steps).toHaveLength(1);
      expect(debugPath.decisions.expansionTriggered).toBe(true);
      expect(debugPath.decisions.expansionReason).toBe('low_top_score');
      
      const step = debugPath.steps[0];
      expect(step.stepName).toBe('query_expansion');
      expect(step.success).toBe(true);
      expect(step.stepData?.expansionData?.canonicalQuery).toBe('test query');
      expect(step.stepData?.expansionData?.alternates).toEqual(['test', 'query', 'search']);
      expect(step.stepData?.expansionData?.relatedConcepts).toEqual(['testing', 'querying']);
    });

    it('should record expansion step when skipped', () => {
      const startTime = Date.now();
      const endTime = startTime + 5;
      
      debugger.recordExpansionStep(
        debugPath,
        startTime,
        endTime,
        'test query',
        mockResults,
        false,
        'sufficient_results',
        undefined,
        true
      );
      
      expect(debugPath.decisions.expansionTriggered).toBe(false);
      expect(debugPath.decisions.expansionReason).toBe('sufficient_results');
      
      const step = debugPath.steps[0];
      expect(step.stepData).toBeUndefined();
      expect(step.rationale).toContain('Query expansion skipped');
    });
  });

  describe('recordRerankingStep', () => {
    let debugPath: any;
    let rerankedResults: RetrievalResult[];

    beforeEach(() => {
      debugPath = debugger.startDebugging('test query', mockConfig);
      rerankedResults = [
        {
          ...mockResults[0],
          score: 0.9, // Improved score after reranking
          metadata: {
            ...mockResults[0].metadata,
            fusionScore: 0.9
          }
        }
      ];
    });

    it('should record reranking step with score changes', () => {
      const startTime = Date.now();
      const endTime = startTime + 10;
      
      debugger.recordRerankingStep(
        debugPath,
        startTime,
        endTime,
        mockResults,
        rerankedResults,
        true
      );
      
      expect(debugPath.steps).toHaveLength(1);
      expect(debugPath.decisions.rerankingApplied).toBe(true);
      
      const step = debugPath.steps[0];
      expect(step.stepName).toBe('result_reranking');
      expect(step.success).toBe(true);
      expect(step.stepData?.rerankingData).toHaveLength(1);
      expect(step.stepData?.rerankingData[0].originalScore).toBe(0.85);
      expect(step.stepData?.rerankingData[0].rerankScore).toBe(0.9);
    });
  });

  describe('recordFallback', () => {
    let debugPath: any;

    beforeEach(() => {
      debugPath = debugger.startDebugging('test query', mockConfig);
      // Add a step first
      debugger.recordStep(debugPath, 'test_step', Date.now(), Date.now() + 50, false);
    });

    it('should record fallback with error context', () => {
      const error = new Error('Test error');
      
      debugger.recordFallback(debugPath, 'full_hybrid', 'basic_hybrid', 'Vector search failed', error);
      
      expect(debugPath.decisions.fallbackUsed).toBe(true);
      expect(debugPath.decisions.fallbackReason).toBe('Vector search failed');
      
      const lastStep = debugPath.steps[debugPath.steps.length - 1];
      expect(lastStep.errors).toContain('Test error');
      expect(lastStep.warnings).toContain('Fallback from full_hybrid to basic_hybrid: Vector search failed');
    });
  });

  describe('finalize', () => {
    let debugPath: any;

    beforeEach(() => {
      debugPath = debugger.startDebugging('test query', mockConfig);
    });

    it('should finalize debug path with results and metrics', () => {
      debugger.finalize(debugPath, mockResults, mockMetrics);
      
      expect(debugPath.finalResults).toEqual(mockResults);
      expect(debugPath.finalMetrics).toEqual(mockMetrics);
      
      // Check performance breakdown calculation
      expect(debugPath.performanceBreakdown.bm25Percentage).toBeCloseTo(33.33, 1); // 50/150 * 100
      expect(debugPath.performanceBreakdown.vectorPercentage).toBeCloseTo(40, 1); // 60/150 * 100
      expect(debugPath.performanceBreakdown.expansionPercentage).toBeCloseTo(20, 1); // 30/150 * 100
      expect(debugPath.performanceBreakdown.rerankingPercentage).toBeCloseTo(6.67, 1); // 10/150 * 100
      expect(debugPath.performanceBreakdown.fusionPercentage).toBeCloseTo(3.33, 1); // 5/150 * 100
    });
  });

  describe('analyzeQuery', () => {
    it('should analyze simple queries', () => {
      const analysis = debugger.analyzeQuery('test');
      
      expect(analysis.query).toBe('test');
      expect(analysis.characteristics.length).toBe(4);
      expect(analysis.characteristics.wordCount).toBe(1);
      expect(analysis.characteristics.hasQuestionWords).toBe(false);
      expect(analysis.characteristics.hasSpecificTerms).toBe(true);
      expect(analysis.characteristics.estimatedComplexity).toBe('simple');
      
      expect(analysis.preprocessing.normalizedQuery).toBe('test');
      expect(analysis.preprocessing.extractedTerms).toEqual(['test']);
      expect(analysis.preprocessing.stopWordsRemoved).toEqual(['test']);
    });

    it('should analyze complex queries', () => {
      const analysis = debugger.analyzeQuery('What happened with the snake story in Morocco?');
      
      expect(analysis.characteristics.wordCount).toBe(8);
      expect(analysis.characteristics.hasQuestionWords).toBe(true);
      expect(analysis.characteristics.estimatedComplexity).toBe('medium');
      
      expect(analysis.predictions.expectedBM25Effectiveness).toBe(0.8);
      expect(analysis.predictions.expectedVectorEffectiveness).toBe(0.7);
      expect(analysis.predictions.expansionLikelihood).toBe(0.2);
    });

    it('should analyze long queries', () => {
      const longQuery = 'This is a very long query that contains many words and should be classified as complex';
      const analysis = debugger.analyzeQuery(longQuery);
      
      expect(analysis.characteristics.estimatedComplexity).toBe('complex');
      expect(analysis.characteristics.wordCount).toBeGreaterThan(8);
    });
  });

  describe('generateScoreBreakdown', () => {
    it('should generate detailed score breakdown for results', () => {
      const breakdown = debugger.generateScoreBreakdown(mockResults);
      
      expect(breakdown).toHaveLength(1);
      
      const result = breakdown[0];
      expect(result.snippetId).toBe('test1');
      expect(result.finalScore).toBe(0.85);
      expect(result.bm25Score).toBe(0.85);
      expect(result.termMatches).toEqual(['test']);
      
      expect(result.confidenceFactors.scoreConfidence).toBeCloseTo(0.68, 2); // 0.85 * 0.8
      expect(result.confidenceFactors.rankConfidence).toBe(0.9); // 1 - (1 * 0.1)
      expect(result.confidenceFactors.methodConfidence).toBe(0.6); // BM25 only
      expect(result.confidenceFactors.overallConfidence).toBe(0.8);
      
      expect(result.scoreEvolution).toHaveLength(2); // BM25 + final
      expect(result.scoreEvolution[0].stage).toBe('bm25');
      expect(result.scoreEvolution[1].stage).toBe('final');
    });

    it('should handle results with multiple score sources', () => {
      const fusedResult: RetrievalResult = {
        ...mockResults[0],
        source: 'both',
        metadata: {
          bm25Score: 0.8,
          vectorSimilarity: 0.7,
          fusionScore: 0.75,
          termMatches: ['test'],
          rank: 1
        }
      };
      
      const breakdown = debugger.generateScoreBreakdown([fusedResult]);
      const result = breakdown[0];
      
      expect(result.scoreEvolution).toHaveLength(4); // BM25 + vector + fusion + final
      expect(result.scoreEvolution[0].stage).toBe('bm25');
      expect(result.scoreEvolution[1].stage).toBe('vector');
      expect(result.scoreEvolution[2].stage).toBe('fusion');
      expect(result.scoreEvolution[3].stage).toBe('final');
      
      expect(result.confidenceFactors.methodConfidence).toBe(0.9); // Both sources
    });
  });

  describe('getDebugHistory', () => {
    beforeEach(() => {
      debugger.startDebugging('query1', mockConfig);
      debugger.startDebugging('query2', mockConfig);
      debugger.startDebugging('query3', mockConfig);
    });

    it('should return recent debug history', () => {
      const history = debugger.getDebugHistory(2);
      
      expect(history).toHaveLength(2);
      expect(history[0].query).toBe('query2');
      expect(history[1].query).toBe('query3');
    });

    it('should return all history when count exceeds available', () => {
      const history = debugger.getDebugHistory(10);
      
      expect(history).toHaveLength(3);
    });
  });

  describe('getQueryDebugHistory', () => {
    beforeEach(() => {
      debugger.startDebugging('test query 1', mockConfig);
      debugger.startDebugging('different query', mockConfig);
      debugger.startDebugging('test query 2', mockConfig);
    });

    it('should filter history by query content', () => {
      const history = debugger.getQueryDebugHistory('test');
      
      expect(history).toHaveLength(2);
      expect(history[0].query).toBe('test query 1');
      expect(history[1].query).toBe('test query 2');
    });

    it('should return empty array for non-matching queries', () => {
      const history = debugger.getQueryDebugHistory('nonexistent');
      
      expect(history).toHaveLength(0);
    });
  });

  describe('exportDebugData', () => {
    beforeEach(() => {
      const debugPath = debugger.startDebugging('test query', mockConfig);
      debugger.finalize(debugPath, mockResults, mockMetrics);
    });

    it('should export debug data as JSON', () => {
      const exported = debugger.exportDebugData('json');
      const parsed = JSON.parse(exported);
      
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].query).toBe('test query');
    });

    it('should export debug data as summary', () => {
      const exported = debugger.exportDebugData('summary');
      const parsed = JSON.parse(exported);
      
      expect(parsed.totalQueries).toBe(1);
      expect(parsed.averageLatency).toBe(150);
      expect(parsed.vectorUsage).toBe(0);
      expect(parsed.expansionUsage).toBe(0);
      expect(parsed.rerankingUsage).toBe(0);
      expect(parsed.fallbackUsage).toBe(0);
    });
  });

  describe('clearHistory', () => {
    it('should clear debug history', () => {
      debugger.startDebugging('test query', mockConfig);
      expect(debugger.getDebugHistory(10)).toHaveLength(1);
      
      debugger.clearHistory();
      expect(debugger.getDebugHistory(10)).toHaveLength(0);
    });
  });
});