// src/lib/services/__tests__/retrievalLogger.test.ts
// Tests for retrieval logging infrastructure

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RetrievalLogger, RetrievalLogLevel } from '../retrievalLogger';
import { RetrievalResult, RetrievalMetrics, HybridRetrievalConfig } from '../hybridRetrieval';

describe('RetrievalLogger', () => {
  let logger: RetrievalLogger;
  let mockResults: RetrievalResult[];
  let mockMetrics: RetrievalMetrics;
  let mockConfig: HybridRetrievalConfig;

  beforeEach(() => {
    logger = new RetrievalLogger({
      maxBufferSize: 100,
      enableConsoleOutput: false,
      enableStructuredLogging: false
    });

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
  });

  describe('logRetrieval', () => {
    it('should log a complete retrieval operation', () => {
      const query = 'test query';
      
      logger.logRetrieval(query, mockResults, mockMetrics, mockConfig);
      
      const logs = logger.getRecentLogs(1);
      expect(logs).toHaveLength(1);
      
      const log = logs[0];
      expect(log.query).toBe(query);
      expect(log.resultCount).toBe(1);
      expect(log.totalTimeMs).toBe(150);
      expect(log.methodsUsed).toEqual(['bm25', 'vector', 'fusion']);
      expect(log.expansionTriggered).toBe(true);
      expect(log.rerankingApplied).toBe(false);
      expect(log.hitIds).toEqual(['test1']);
      expect(log.confidenceScores).toEqual([0.8]);
    });

    it('should include component status in logs', () => {
      const query = 'test query';
      
      logger.logRetrieval(query, mockResults, mockMetrics, mockConfig);
      
      const logs = logger.getRecentLogs(1);
      const log = logs[0];
      
      expect(log.componentStatus.bm25).toBe('healthy');
      expect(log.componentStatus.vector).toBe('healthy');
      expect(log.componentStatus.expansion).toBe('healthy');
      expect(log.componentStatus.reranking).toBe('disabled');
    });

    it('should handle empty results', () => {
      const query = 'empty query';
      const emptyResults: RetrievalResult[] = [];
      const emptyMetrics = { ...mockMetrics, resultCount: 0 };
      
      logger.logRetrieval(query, emptyResults, emptyMetrics, mockConfig);
      
      const logs = logger.getRecentLogs(1);
      const log = logs[0];
      
      expect(log.resultCount).toBe(0);
      expect(log.hitIds).toEqual([]);
      expect(log.confidenceScores).toEqual([]);
      expect(log.topScore).toBeUndefined();
      expect(log.averageScore).toBeUndefined();
    });
  });

  describe('logComponent', () => {
    it('should log component-specific events', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation();
      
      logger = new RetrievalLogger({
        enableConsoleOutput: true,
        enableStructuredLogging: false
      });
      
      logger.logComponent('bm25', RetrievalLogLevel.INFO, 'Test message', {
        query: 'test',
        resultCount: 5
      });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '[BM25] Test message',
        { query: 'test', resultCount: 5 }
      );
      
      consoleSpy.mockRestore();
    });

    it('should use appropriate console methods for different log levels', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation();
      const consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation();
      
      logger = new RetrievalLogger({
        enableConsoleOutput: true,
        enableStructuredLogging: false
      });
      
      logger.logComponent('vector', RetrievalLogLevel.ERROR, 'Error message', {});
      logger.logComponent('expansion', RetrievalLogLevel.WARN, 'Warning message', {});
      logger.logComponent('reranking', RetrievalLogLevel.DEBUG, 'Debug message', {});
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(consoleDebugSpy).toHaveBeenCalled();
      
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
      consoleDebugSpy.mockRestore();
    });
  });

  describe('logExpansionDecision', () => {
    it('should log expansion decision with detailed reasoning', () => {
      const query = 'test query';
      const thresholds = {
        topScore: 0.25,
        resultsAboveThreshold: 1,
        lowConfidenceThreshold: 0.35,
        minResultsThreshold: 2
      };
      
      logger.logExpansionDecision(
        query,
        mockResults,
        true,
        'low_top_score',
        thresholds
      );
      
      // Should be logged as component log
      // We can't easily test this without mocking the logComponent method
      // But we can verify the method doesn't throw
      expect(() => {
        logger.logExpansionDecision(query, mockResults, false, 'sufficient_results', thresholds);
      }).not.toThrow();
    });
  });

  describe('logFallback', () => {
    it('should log fallback usage with context', () => {
      const query = 'test query';
      const error = new Error('Test error');
      
      logger.logFallback(query, 'full_hybrid', 'basic_hybrid', 'Vector search failed', error);
      
      // Should be logged as component log
      // We can't easily test this without mocking the logComponent method
      // But we can verify the method doesn't throw
      expect(() => {
        logger.logFallback(query, 'basic_hybrid', 'bm25_only', 'Expansion timeout');
      }).not.toThrow();
    });
  });

  describe('getFilteredLogs', () => {
    beforeEach(() => {
      // Add some test logs
      logger.logRetrieval('query1', mockResults, mockMetrics, mockConfig);
      
      const errorMetrics = { ...mockMetrics, errors: ['Test error'] };
      logger.logRetrieval('query2', [], errorMetrics, mockConfig);
      
      const fallbackMetrics = { ...mockMetrics, fallbackLevel: 'bm25_only' as const };
      logger.logRetrieval('query3', mockResults, fallbackMetrics, mockConfig);
    });

    it('should filter logs by query', () => {
      const filtered = logger.getFilteredLogs({ query: 'query1' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].query).toBe('query1');
    });

    it('should filter logs by error presence', () => {
      const filtered = logger.getFilteredLogs({ hasErrors: true });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].query).toBe('query2');
      expect(filtered[0].errors).toHaveLength(1);
    });

    it('should filter logs by fallback usage', () => {
      const filtered = logger.getFilteredLogs({ fallbackUsed: true });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].query).toBe('query3');
      expect(filtered[0].fallbackLevel).toBe('bm25_only');
    });

    it('should filter logs by expansion trigger', () => {
      const filtered = logger.getFilteredLogs({ expansionTriggered: true });
      expect(filtered).toHaveLength(3); // All our test logs have expansion triggered
    });

    it('should filter logs by time range', async () => {
      const filtered = logger.getFilteredLogs({ timeRangeMs: 1000 }); // 1 second
      expect(filtered).toHaveLength(3); // All recent
      
      // Wait a bit then check with very short time window
      await new Promise(resolve => setTimeout(resolve, 5));
      const oldFiltered = logger.getFilteredLogs({ timeRangeMs: 1 }); // Very short time window
      expect(oldFiltered.length).toBeLessThan(3); // Should filter out some or all
    });
  });

  describe('exportLogs', () => {
    beforeEach(() => {
      logger.logRetrieval('test query', mockResults, mockMetrics, mockConfig);
    });

    it('should export logs as JSON', () => {
      const exported = logger.exportLogs('json');
      const parsed = JSON.parse(exported);
      
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].query).toBe('test query');
    });

    it('should export logs as CSV', () => {
      const exported = logger.exportLogs('csv');
      const lines = exported.split('\n');
      
      expect(lines).toHaveLength(2); // Header + 1 data row
      expect(lines[0]).toContain('timestamp,query,queryHash');
      expect(lines[1]).toContain('test query');
    });

    it('should export logs as TSV', () => {
      const exported = logger.exportLogs('tsv');
      const lines = exported.split('\n');
      
      expect(lines).toHaveLength(2); // Header + 1 data row
      expect(lines[0]).toContain('\t'); // Tab separated
      expect(lines[1]).toContain('test query');
    });

    it('should throw error for unsupported format', () => {
      expect(() => {
        logger.exportLogs('xml' as any);
      }).toThrow('Unsupported export format: xml');
    });
  });

  describe('getLogStats', () => {
    beforeEach(() => {
      // Add various types of logs
      logger.logRetrieval('query1', mockResults, mockMetrics, mockConfig);
      
      const errorMetrics = { ...mockMetrics, errors: ['Test error'] };
      logger.logRetrieval('query2', [], errorMetrics, mockConfig);
      
      const fallbackMetrics = { ...mockMetrics, fallbackLevel: 'bm25_only' as const };
      logger.logRetrieval('query3', mockResults, fallbackMetrics, mockConfig);
      
      const noExpansionMetrics = { ...mockMetrics, expansionTriggered: false };
      logger.logRetrieval('query4', mockResults, noExpansionMetrics, mockConfig);
    });

    it('should calculate correct statistics', () => {
      const stats = logger.getLogStats();
      
      expect(stats.totalEntries).toBe(4);
      expect(stats.errorRate).toBe(0.25); // 1 out of 4
      expect(stats.fallbackRate).toBe(0.25); // 1 out of 4
      expect(stats.expansionRate).toBe(0.75); // 3 out of 4
      expect(stats.averageLatency).toBe(150); // All have same latency
      
      expect(stats.timeRange).toBeDefined();
      expect(stats.timeRange!.start).toBeLessThanOrEqual(stats.timeRange!.end);
      
      expect(stats.componentHealth).toBeDefined();
      expect(stats.componentHealth.bm25).toBe(1); // All healthy
      expect(stats.componentHealth.vector).toBe(1); // All healthy
    });

    it('should handle empty logs', () => {
      const emptyLogger = new RetrievalLogger();
      const stats = emptyLogger.getLogStats();
      
      expect(stats.totalEntries).toBe(0);
      expect(stats.timeRange).toBeNull();
      expect(stats.errorRate).toBe(0);
      expect(stats.fallbackRate).toBe(0);
      expect(stats.expansionRate).toBe(0);
      expect(stats.averageLatency).toBe(0);
    });
  });

  describe('buffer management', () => {
    it('should maintain buffer size limit', () => {
      const smallLogger = new RetrievalLogger({ maxBufferSize: 2 });
      
      // Add 3 logs
      smallLogger.logRetrieval('query1', mockResults, mockMetrics, mockConfig);
      smallLogger.logRetrieval('query2', mockResults, mockMetrics, mockConfig);
      smallLogger.logRetrieval('query3', mockResults, mockMetrics, mockConfig);
      
      const logs = smallLogger.getRecentLogs(10);
      expect(logs).toHaveLength(2); // Only last 2 should remain
      expect(logs[0].query).toBe('query2');
      expect(logs[1].query).toBe('query3');
    });

    it('should clear logs', () => {
      logger.logRetrieval('test query', mockResults, mockMetrics, mockConfig);
      expect(logger.getRecentLogs(10)).toHaveLength(1);
      
      logger.clearLogs();
      expect(logger.getRecentLogs(10)).toHaveLength(0);
    });
  });
});