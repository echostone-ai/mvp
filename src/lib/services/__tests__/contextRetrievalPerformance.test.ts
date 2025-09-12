/**
 * Context Retrieval Engine Performance Tests
 * 
 * Tests to verify the <500ms retrieval time requirement and other performance metrics.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createContextRetrievalEngine, QuickFact, MemoryFragment } from '../contextRetrievalEngine';

// Mock the database client with realistic response times
const createMockQueryWithDelay = (data: any = [], error: any = null, delayMs: number = 50) => {
  const mockQuery = {
    select: vi.fn(() => mockQuery),
    eq: vi.fn(() => mockQuery),
    lte: vi.fn(() => mockQuery),
    order: vi.fn(() => mockQuery),
    limit: vi.fn(() => mockQuery),
    or: vi.fn(() => new Promise(resolve => 
      setTimeout(() => resolve({ data, error }), delayMs)
    )),
    in: vi.fn(() => mockQuery),
    gte: vi.fn(() => mockQuery)
  };
  return mockQuery;
};

vi.mock('@/lib/data/client', () => ({
  sbAdmin: {
    from: vi.fn(() => createMockQueryWithDelay())
  }
}));

vi.mock('../schemaCompatibilityLayer', () => ({
  getSchemaCompatibilityLayer: vi.fn(() => ({
    resolveTableName: vi.fn((name: string) => name === 'avatars' ? 'avatar_profiles' : name),
    validateColumnExists: vi.fn(() => Promise.resolve(true))
  }))
}));

describe('ContextRetrievalEngine Performance Tests', () => {
  let engine: ReturnType<typeof createContextRetrievalEngine>;
  const mockAvatarId = 'perf-test-avatar';

  beforeEach(() => {
    engine = createContextRetrievalEngine();
    vi.clearAllMocks();
  });

  afterEach(() => {
    engine.clearCache();
  });

  describe('retrieval time requirements', () => {
    it('should retrieve context in under 500ms for normal mode', async () => {
      // Mock realistic data
      const mockQuickFacts: QuickFact[] = Array.from({ length: 20 }, (_, i) => ({
        id: `fact-${i}`,
        avatarId: mockAvatarId,
        key: `key-${i}`,
        value: `value-${i}`,
        confidence: 0.8,
        priority: i % 5 + 1,
        source: 'manual' as const,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }));

      const mockMemoryFragments: MemoryFragment[] = Array.from({ length: 15 }, (_, i) => ({
        id: `memory-${i}`,
        avatarId: mockAvatarId,
        fragmentText: `Memory fragment ${i} with some content`,
        conversationContext: {
          source: 'chat',
          type: 'user' as const,
          conversationId: `conv-${i}`
        },
        similarity: 0.7,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }));

      const { sbAdmin } = await import('@/lib/data/client');
      vi.mocked(sbAdmin.from).mockImplementation((table: string) => {
        if (table === 'quick_facts') {
          return createMockQueryWithDelay(mockQuickFacts, null, 100); // 100ms delay
        } else if (table === 'memory_fragments') {
          const mockQuery = createMockQueryWithDelay(mockMemoryFragments, null, 150); // 150ms delay
          mockQuery.limit = vi.fn(() => new Promise(resolve => 
            setTimeout(() => resolve({ data: mockMemoryFragments, error: null }), 150)
          ));
          return mockQuery;
        }
        return createMockQueryWithDelay([], null, 50);
      });

      const startTime = Date.now();
      const result = await engine.retrieveContext(mockAvatarId, 'complex query about memories');
      const totalTime = Date.now() - startTime;

      expect(result.retrievalMetadata.retrievalTimeMs).toBeLessThan(500);
      expect(totalTime).toBeLessThan(600); // Allow some overhead for test execution
      expect(result.quickFacts.length).toBeGreaterThan(0);
      expect(result.memoryFragments.length).toBeGreaterThan(0);
    });

    it('should retrieve context in under 200ms for fast mode', async () => {
      const mockQuickFacts: QuickFact[] = Array.from({ length: 5 }, (_, i) => ({
        id: `fact-${i}`,
        avatarId: mockAvatarId,
        key: `key-${i}`,
        value: `value-${i}`,
        confidence: 0.9,
        priority: 1,
        source: 'manual' as const,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }));

      const { sbAdmin } = await import('@/lib/data/client');
      vi.mocked(sbAdmin.from).mockImplementation((table: string) => {
        if (table === 'quick_facts') {
          return createMockQueryWithDelay(mockQuickFacts, null, 30); // Fast response
        }
        return createMockQueryWithDelay([], null, 10);
      });

      const startTime = Date.now();
      const result = await engine.retrieveContext(mockAvatarId, 'simple query', { 
        fastMode: true 
      });
      const totalTime = Date.now() - startTime;

      expect(result.retrievalMetadata.retrievalTimeMs).toBeLessThan(200);
      expect(totalTime).toBeLessThan(300); // Allow some overhead
      expect(result.retrievalMetadata.queryOptimizations).toContain('skip_memory_fragments');
    });

    it('should benefit from caching on repeated requests', async () => {
      const mockQuickFacts: QuickFact[] = [
        {
          id: 'cached-fact',
          avatarId: mockAvatarId,
          key: 'name',
          value: 'John Doe',
          confidence: 0.9,
          priority: 1,
          source: 'manual',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        }
      ];

      const { sbAdmin } = await import('@/lib/data/client');
      const mockDbCall = vi.fn(() => new Promise(resolve => 
        setTimeout(() => resolve({ data: mockQuickFacts, error: null }), 100)
      ));

      vi.mocked(sbAdmin.from).mockImplementation(() => {
        const mockQuery = createMockQueryWithDelay(mockQuickFacts, null, 100);
        mockQuery.or = mockDbCall;
        return mockQuery;
      });

      // First request - should hit database
      const startTime1 = Date.now();
      const result1 = await engine.retrieveContext(mockAvatarId, 'test', { fastMode: true });
      const time1 = Date.now() - startTime1;

      expect(mockDbCall).toHaveBeenCalledTimes(1);
      expect(time1).toBeGreaterThan(80); // Should take time for DB call

      // Second request - should use cache
      const startTime2 = Date.now();
      const result2 = await engine.retrieveContext(mockAvatarId, 'test', { fastMode: true });
      const time2 = Date.now() - startTime2;

      expect(mockDbCall).toHaveBeenCalledTimes(1); // Still only 1 call
      expect(time2).toBeLessThan(50); // Should be much faster
      expect(result2.retrievalMetadata.cacheHits).toContain('quick_facts');
    });
  });

  describe('parallel query execution', () => {
    it('should execute queries in parallel for better performance', async () => {
      const mockQuickFacts: QuickFact[] = [
        {
          id: 'fact-1',
          avatarId: mockAvatarId,
          key: 'name',
          value: 'Jane Doe',
          confidence: 0.9,
          priority: 1,
          source: 'manual',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        }
      ];

      const mockMemoryFragments: MemoryFragment[] = [
        {
          id: 'memory-1',
          avatarId: mockAvatarId,
          fragmentText: 'User loves hiking',
          conversationContext: {
            source: 'chat',
            type: 'user',
            conversationId: 'conv-1'
          },
          similarity: 0.8,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        }
      ];

      const { sbAdmin } = await import('@/lib/data/client');
      vi.mocked(sbAdmin.from).mockImplementation((table: string) => {
        if (table === 'quick_facts') {
          return createMockQueryWithDelay(mockQuickFacts, null, 200); // 200ms delay
        } else if (table === 'memory_fragments') {
          const mockQuery = createMockQueryWithDelay(mockMemoryFragments, null, 200); // 200ms delay
          mockQuery.limit = vi.fn(() => new Promise(resolve => 
            setTimeout(() => resolve({ data: mockMemoryFragments, error: null }), 200)
          ));
          return mockQuery;
        }
        return createMockQueryWithDelay([], null, 50);
      });

      const startTime = Date.now();
      const result = await engine.retrieveContext(mockAvatarId, 'complex query');
      const totalTime = Date.now() - startTime;

      // If queries were sequential, it would take 400ms+ (200ms + 200ms)
      // With parallel execution, it should be closer to 200ms
      expect(totalTime).toBeLessThan(350); // Allow some overhead but verify parallelism
      expect(result.quickFacts.length).toBe(1);
      expect(result.memoryFragments.length).toBe(1);
      expect(result.retrievalMetadata.queryOptimizations).toContain('parallel_queries');
    });
  });

  describe('query optimization', () => {
    it('should optimize queries based on query complexity', async () => {
      const simpleOptimization = engine.optimizeQuery('hi', { fastMode: true });
      const complexOptimization = engine.optimizeQuery('tell me about my childhood memories', { fastMode: false });

      expect(simpleOptimization.skipMemoryFragments).toBe(true);
      expect(simpleOptimization.limitQuickFacts).toBe(10);
      expect(simpleOptimization.estimatedTimeMs).toBe(200);

      expect(complexOptimization.skipMemoryFragments).toBe(false);
      expect(complexOptimization.limitQuickFacts).toBe(50);
      expect(complexOptimization.estimatedTimeMs).toBe(400);
    });

    it('should provide accurate performance estimates', async () => {
      const mockQuickFacts: QuickFact[] = Array.from({ length: 10 }, (_, i) => ({
        id: `fact-${i}`,
        avatarId: mockAvatarId,
        key: `key-${i}`,
        value: `value-${i}`,
        confidence: 0.8,
        priority: 1,
        source: 'manual' as const,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }));

      const { sbAdmin } = await import('@/lib/data/client');
      vi.mocked(sbAdmin.from).mockImplementation(() => 
        createMockQueryWithDelay(mockQuickFacts, null, 50)
      );

      const optimization = engine.optimizeQuery('test query', { fastMode: true });
      const result = await engine.retrieveContext(mockAvatarId, 'test query', { fastMode: true });

      // Actual time should be reasonably close to estimate
      const timeDifference = Math.abs(result.retrievalMetadata.retrievalTimeMs - optimization.estimatedTimeMs);
      expect(timeDifference).toBeLessThan(150); // Allow reasonable variance
    });
  });

  describe('memory usage and efficiency', () => {
    it('should limit data retrieval based on options', async () => {
      const mockQuickFacts: QuickFact[] = Array.from({ length: 100 }, (_, i) => ({
        id: `fact-${i}`,
        avatarId: mockAvatarId,
        key: `key-${i}`,
        value: `value-${i}`,
        confidence: 0.8,
        priority: i % 10 + 1,
        source: 'manual' as const,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }));

      const { sbAdmin } = await import('@/lib/data/client');
      vi.mocked(sbAdmin.from).mockImplementation(() => {
        // Simulate database limit by returning only first 10 facts for fast mode
        const limitedFacts = mockQuickFacts.slice(0, 10);
        return createMockQueryWithDelay(limitedFacts, null, 30);
      });

      const result = await engine.retrieveContext(mockAvatarId, 'test', {
        fastMode: true,
        memoryLimit: 5,
        historyLimit: 3
      });

      // Should respect limits even if more data is available
      expect(result.quickFacts.length).toBeLessThanOrEqual(10); // Fast mode limit
      expect(result.memoryFragments.length).toBeLessThanOrEqual(5); // Memory limit
      expect(result.conversationHistory.length).toBeLessThanOrEqual(3); // History limit
    });
  });
});

describe('Performance Benchmarks', () => {
  it('should meet performance targets consistently', async () => {
    const engine = createContextRetrievalEngine();
    const mockAvatarId = 'benchmark-avatar';

    // Mock realistic data sizes
    const mockQuickFacts: QuickFact[] = Array.from({ length: 30 }, (_, i) => ({
      id: `fact-${i}`,
      avatarId: mockAvatarId,
      key: `key-${i}`,
      value: `value-${i}`,
      confidence: Math.random() * 0.5 + 0.5, // 0.5 to 1.0
      priority: Math.floor(Math.random() * 5) + 1,
      source: 'manual' as const,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    }));

    const { sbAdmin } = await import('@/lib/data/client');
    vi.mocked(sbAdmin.from).mockImplementation(() => 
      createMockQueryWithDelay(mockQuickFacts, null, 80)
    );

    const iterations = 5;
    const results = [];

    for (let i = 0; i < iterations; i++) {
      const result = await engine.retrieveContext(mockAvatarId, `test query ${i}`);
      results.push(result.retrievalMetadata.retrievalTimeMs);
    }

    const averageTime = results.reduce((sum, time) => sum + time, 0) / results.length;
    const maxTime = Math.max(...results);

    expect(averageTime).toBeLessThan(500);
    expect(maxTime).toBeLessThan(600);
    
    console.log(`Performance Benchmark Results:`);
    console.log(`Average retrieval time: ${averageTime.toFixed(2)}ms`);
    console.log(`Max retrieval time: ${maxTime}ms`);
    console.log(`All times: ${results.join(', ')}ms`);
  });
});