/**
 * Tests for Deployment Validator
 */

import { describe, it, expect, beforeEach, jest, vi } from 'vitest';
import { DeploymentValidator, ValidationConfig } from '../deploymentValidator';
import { HybridRetriever } from '../hybridRetrieval';
import { FactbookService } from '../factbookService';

// Mock dependencies
vi.mock('../hybridRetrieval');
vi.mock('../factbookService');

describe('DeploymentValidator', () => {
  let validator: DeploymentValidator;
  let mockHybridRetriever: jest.Mocked<HybridRetriever>;
  let mockFactbookService: jest.Mocked<FactbookService>;

  beforeEach(() => {
    mockHybridRetriever = {
      retrieve: vi.fn(),
    } as any;

    mockFactbookService = {
      getAllSnippets: vi.fn(),
    } as any;

    validator = new DeploymentValidator(mockHybridRetriever, mockFactbookService);
  });

  describe('Health Check', () => {
    it('should pass health check with normal response time', async () => {
      mockHybridRetriever.retrieve.mockResolvedValue({
        results: [{ snippet: { id: '1', text: 'test', topics: [], keywords: [] }, score: 0.8, source: 'bm25', confidence: 0.8 }],
        metrics: { totalTimeMs: 100, bm25TimeMs: 50, vectorTimeMs: 50, cacheHit: true, methodsUsed: ['bm25'], resultCount: 1 }
      });

      const result = await validator.runHealthCheck();
      
      expect(result.healthy).toBe(true);
      expect(result.message).toContain('Health check passed');
      expect(result.details.duration).toBeLessThan(5000);
    });

    it('should fail health check with slow response time', async () => {
      mockHybridRetriever.retrieve.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          results: [],
          metrics: { totalTimeMs: 6000, bm25TimeMs: 3000, vectorTimeMs: 3000, cacheHit: false, methodsUsed: ['bm25'], resultCount: 0 }
        }), 6000))
      );

      const result = await validator.runHealthCheck();
      
      expect(result.healthy).toBe(false);
      expect(result.message).toContain('took too long');
    });

    it('should fail health check on error', async () => {
      mockHybridRetriever.retrieve.mockRejectedValue(new Error('Retrieval failed'));

      const result = await validator.runHealthCheck();
      
      expect(result.healthy).toBe(false);
      expect(result.message).toContain('Health check failed');
      expect(result.details.error).toBeDefined();
    });
  });

  describe('Component Validation', () => {
    it('should validate specific component', async () => {
      mockHybridRetriever.retrieve.mockResolvedValue({
        results: [{ snippet: { id: '1', text: 'test', topics: [], keywords: [] }, score: 0.8, source: 'vector', confidence: 0.8 }],
        metrics: { totalTimeMs: 100, bm25TimeMs: 0, vectorTimeMs: 100, cacheHit: true, methodsUsed: ['vector'], resultCount: 1 }
      });

      const result = await validator.validateComponent('embedding_service');
      
      expect(result.testId).toBe('component_embedding_service');
      expect(result.status).toBe('pass');
    });

    it('should skip validation for unknown component', async () => {
      const result = await validator.validateComponent('unknown_component');
      
      expect(result.status).toBe('skip');
      expect(result.message).toContain('No validation test found');
    });
  });

  describe('Full Validation', () => {
    const mockConfig: ValidationConfig = {
      environment: 'test',
      version: '1.0.0',
      timeout: 30000,
      skipNonCritical: false,
      enablePerformanceTests: true,
      enableSemanticTests: true
    };

    beforeEach(() => {
      // Setup default mocks for successful validation
      mockHybridRetriever.retrieve.mockResolvedValue({
        results: [
          { snippet: { id: '1', text: 'jonathan test', topics: [], keywords: [] }, score: 0.8, source: 'bm25', confidence: 0.8 },
          { snippet: { id: '2', text: 'cobra morocco', topics: [], keywords: [] }, score: 0.7, source: 'vector', confidence: 0.7 }
        ],
        metrics: { totalTimeMs: 200, bm25TimeMs: 100, vectorTimeMs: 100, cacheHit: true, methodsUsed: ['bm25', 'vector'], resultCount: 2 }
      });

      mockFactbookService.getAllSnippets.mockResolvedValue([
        { id: '1', text: 'test snippet', topics: [], keywords: [] },
        { id: '2', text: 'another snippet', topics: [], keywords: [] }
      ]);
    });

    it('should run full validation successfully', async () => {
      const report = await validator.runValidation(mockConfig);
      
      expect(report).toBeDefined();
      expect(report.environment).toBe('test');
      expect(report.version).toBe('1.0.0');
      expect(report.overallStatus).toBe('pass');
      expect(report.summary.total).toBeGreaterThan(0);
      expect(report.summary.passed).toBeGreaterThan(0);
      expect(report.criticalFailures).toHaveLength(0);
    });

    it('should skip non-critical tests when configured', async () => {
      const configWithSkip = { ...mockConfig, skipNonCritical: true };
      const report = await validator.runValidation(configWithSkip);
      
      expect(report.summary.total).toBeLessThan(15); // Should skip some tests
      expect(report.overallStatus).toBe('pass');
    });

    it('should handle test failures gracefully', async () => {
      // Make one test fail
      mockHybridRetriever.retrieve.mockRejectedValueOnce(new Error('Test failure'));

      const report = await validator.runValidation(mockConfig);
      
      expect(report.overallStatus).toBe('fail');
      expect(report.summary.failed).toBeGreaterThan(0);
      expect(report.criticalFailures.length).toBeGreaterThan(0);
    });

    it('should handle test timeouts', async () => {
      // Make a test timeout
      mockHybridRetriever.retrieve.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 35000)) // Longer than test timeout
      );

      const report = await validator.runValidation(mockConfig);
      
      expect(report.summary.timeouts).toBeGreaterThan(0);
      expect(report.overallStatus).toBe('fail');
    });

    it('should generate appropriate recommendations', async () => {
      const report = await validator.runValidation(mockConfig);
      
      expect(report.recommendations).toBeInstanceOf(Array);
      expect(report.recommendations.length).toBeGreaterThan(0);
      
      if (report.overallStatus === 'pass') {
        expect(report.recommendations[0]).toContain('successful');
      }
    });
  });

  describe('Semantic Connection Tests', () => {
    it('should test snake story semantic connection', async () => {
      mockHybridRetriever.retrieve.mockResolvedValue({
        results: [
          { snippet: { id: '1', text: 'morocco cobra encounter story', topics: [], keywords: [] }, score: 0.9, source: 'vector', confidence: 0.9 }
        ],
        metrics: { totalTimeMs: 150, bm25TimeMs: 50, vectorTimeMs: 100, cacheHit: true, methodsUsed: ['vector'], resultCount: 1 }
      });

      const result = await validator.validateComponent('semantic_snake_story');
      
      expect(result.status).toBe('pass');
      expect(result.message).toContain('Semantic connection successful');
    });

    it('should test SXSW meetings semantic connection', async () => {
      mockHybridRetriever.retrieve.mockResolvedValue({
        results: [
          { snippet: { id: '1', text: 'bill murray concert at sxsw', topics: [], keywords: [] }, score: 0.8, source: 'vector', confidence: 0.8 },
          { snippet: { id: '2', text: 'gza performance music festival', topics: [], keywords: [] }, score: 0.7, source: 'vector', confidence: 0.7 }
        ],
        metrics: { totalTimeMs: 200, bm25TimeMs: 100, vectorTimeMs: 100, cacheHit: true, methodsUsed: ['vector'], resultCount: 2 }
      });

      const result = await validator.validateComponent('semantic_sxsw_meetings');
      
      expect(result.status).toBe('pass');
      expect(result.details.foundTerms).toContain('bill murray');
    });

    it('should fail semantic test when no connections found', async () => {
      mockHybridRetriever.retrieve.mockResolvedValue({
        results: [
          { snippet: { id: '1', text: 'unrelated content', topics: [], keywords: [] }, score: 0.5, source: 'bm25', confidence: 0.5 }
        ],
        metrics: { totalTimeMs: 100, bm25TimeMs: 100, vectorTimeMs: 0, cacheHit: true, methodsUsed: ['bm25'], resultCount: 1 }
      });

      const result = await validator.validateComponent('semantic_snake_story');
      
      expect(result.status).toBe('fail');
      expect(result.message).toContain('No expected terms found');
    });
  });

  describe('Performance Tests', () => {
    it('should test latency performance', async () => {
      // Mock consistent fast responses
      mockHybridRetriever.retrieve.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          results: [{ snippet: { id: '1', text: 'test', topics: [], keywords: [] }, score: 0.8, source: 'bm25', confidence: 0.8 }],
          metrics: { totalTimeMs: 100, bm25TimeMs: 50, vectorTimeMs: 50, cacheHit: true, methodsUsed: ['bm25'], resultCount: 1 }
        }), 100))
      );

      const result = await validator.validateComponent('performance_latency');
      
      expect(result.status).toBe('pass');
      expect(result.details.p95Latency).toBeLessThan(1000);
    });

    it('should fail latency test for slow responses', async () => {
      // Mock slow responses
      mockHybridRetriever.retrieve.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          results: [],
          metrics: { totalTimeMs: 1500, bm25TimeMs: 750, vectorTimeMs: 750, cacheHit: false, methodsUsed: ['bm25'], resultCount: 0 }
        }), 1500))
      );

      const result = await validator.validateComponent('performance_latency');
      
      expect(result.status).toBe('fail');
      expect(result.message).toContain('P95 latency too high');
    });

    it('should test throughput performance', async () => {
      // Mock fast responses for throughput test
      mockHybridRetriever.retrieve.mockResolvedValue({
        results: [{ snippet: { id: '1', text: 'test', topics: [], keywords: [] }, score: 0.8, source: 'bm25', confidence: 0.8 }],
        metrics: { totalTimeMs: 50, bm25TimeMs: 25, vectorTimeMs: 25, cacheHit: true, methodsUsed: ['bm25'], resultCount: 1 }
      });

      const result = await validator.validateComponent('performance_throughput');
      
      expect(result.status).toBe('pass');
      expect(result.details.throughput).toBeGreaterThan(1);
    });
  });

  describe('Integration Tests', () => {
    it('should test factbook integration', async () => {
      mockFactbookService.getAllSnippets.mockResolvedValue([
        { id: '1', text: 'snippet 1', topics: [], keywords: [] },
        { id: '2', text: 'snippet 2', topics: [], keywords: [] }
      ]);

      const result = await validator.validateComponent('integration_factbook');
      
      expect(result.status).toBe('pass');
      expect(result.details.snippetCount).toBe(2);
    });

    it('should fail factbook integration with no snippets', async () => {
      mockFactbookService.getAllSnippets.mockResolvedValue([]);

      const result = await validator.validateComponent('integration_factbook');
      
      expect(result.status).toBe('fail');
      expect(result.message).toContain('no snippets');
    });

    it('should test caching integration', async () => {
      let callCount = 0;
      mockHybridRetriever.retrieve.mockImplementation(() => {
        callCount++;
        const delay = callCount === 1 ? 200 : 50; // Second call should be faster (cached)
        return new Promise(resolve => setTimeout(() => resolve({
          results: [{ snippet: { id: '1', text: 'test', topics: [], keywords: [] }, score: 0.8, source: 'bm25', confidence: 0.8 }],
          metrics: { totalTimeMs: delay, bm25TimeMs: delay/2, vectorTimeMs: delay/2, cacheHit: callCount > 1, methodsUsed: ['bm25'], resultCount: 1 }
        }), delay));
      });

      const result = await validator.validateComponent('integration_caching');
      
      expect(result.status).toBe('pass');
      expect(result.details.speedup).toBeGreaterThan(1);
    });
  });

  describe('Report Generation', () => {
    it('should generate comprehensive report', async () => {
      mockHybridRetriever.retrieve.mockResolvedValue({
        results: [{ snippet: { id: '1', text: 'test', topics: [], keywords: [] }, score: 0.8, source: 'bm25', confidence: 0.8 }],
        metrics: { totalTimeMs: 100, bm25TimeMs: 50, vectorTimeMs: 50, cacheHit: true, methodsUsed: ['bm25'], resultCount: 1 }
      });

      mockFactbookService.getAllSnippets.mockResolvedValue([
        { id: '1', text: 'snippet', topics: [], keywords: [] }
      ]);

      const report = await validator.runValidation(mockConfig);
      
      expect(report.timestamp).toBeDefined();
      expect(report.environment).toBe('test');
      expect(report.version).toBe('1.0.0');
      expect(report.summary).toBeDefined();
      expect(report.results).toBeInstanceOf(Array);
      expect(report.recommendations).toBeInstanceOf(Array);
    });

    it('should categorize test results correctly', async () => {
      // Mix of success and failure
      let callCount = 0;
      mockHybridRetriever.retrieve.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.resolve({
            results: [{ snippet: { id: '1', text: 'test', topics: [], keywords: [] }, score: 0.8, source: 'bm25', confidence: 0.8 }],
            metrics: { totalTimeMs: 100, bm25TimeMs: 50, vectorTimeMs: 50, cacheHit: true, methodsUsed: ['bm25'], resultCount: 1 }
          });
        } else {
          return Promise.reject(new Error('Test failure'));
        }
      });

      mockFactbookService.getAllSnippets.mockResolvedValue([
        { id: '1', text: 'snippet', topics: [], keywords: [] }
      ]);

      const report = await validator.runValidation(mockConfig);
      
      expect(report.summary.passed).toBeGreaterThan(0);
      expect(report.summary.failed).toBeGreaterThan(0);
      expect(report.overallStatus).toBe('fail'); // Should fail due to critical test failures
    });
  });
});