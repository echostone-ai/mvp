/**
 * Context Retrieval Engine Tests
 * 
 * Tests for context retrieval, ordered data merging, confidence-based filtering,
 * and performance optimization.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { 
  ContextRetrievalEngine, 
  createContextRetrievalEngine,
  QuickFact,
  MemoryFragment,
  StructuredContext,
  RetrievalOptions
} from '../contextRetrievalEngine';

// Mock the database client
const createMockQuery = (data: any = [], error: any = null) => {
  const mockQuery = {
    select: vi.fn(() => mockQuery),
    eq: vi.fn(() => mockQuery),
    lte: vi.fn(() => mockQuery),
    order: vi.fn(() => mockQuery),
    limit: vi.fn(() => mockQuery),
    or: vi.fn(() => Promise.resolve({ data, error })),
    in: vi.fn(() => mockQuery),
    gte: vi.fn(() => mockQuery)
  };
  return mockQuery;
};

vi.mock('@/lib/data/client', () => ({
  sbAdmin: {
    from: vi.fn(() => createMockQuery())
  }
}));

// Mock schema compatibility layer
vi.mock('../schemaCompatibilityLayer', () => ({
  getSchemaCompatibilityLayer: vi.fn(() => ({
    resolveTableName: vi.fn((name: string) => name === 'avatars' ? 'avatar_profiles' : name),
    validateColumnExists: vi.fn(() => Promise.resolve(true))
  }))
}));

describe('ContextRetrievalEngine', () => {
  let engine: ContextRetrievalEngine;
  const mockAvatarId = 'test-avatar-123';

  beforeEach(() => {
    engine = createContextRetrievalEngine();
    vi.clearAllMocks();
  });

  afterEach(() => {
    engine.clearCache();
  });

  describe('retrieveContext', () => {
    it('should retrieve structured context with all data types', async () => {
      // Mock successful database responses
      const mockQuickFacts: QuickFact[] = [
        {
          id: '1',
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

      const mockMemoryFragments: MemoryFragment[] = [
        {
          id: '1',
          avatarId: mockAvatarId,
          fragmentText: 'User mentioned they love hiking',
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

      // Mock database calls
      const { sbAdmin } = await import('@/lib/data/client');

      vi.mocked(sbAdmin.from).mockImplementation((table: string) => {
        if (table === 'quick_facts') {
          return createMockQuery(mockQuickFacts, null);
        } else if (table === 'memory_fragments') {
          const mockQueryForMemory = createMockQuery(mockMemoryFragments, null);
          mockQueryForMemory.limit = vi.fn(() => Promise.resolve({ data: mockMemoryFragments, error: null }));
          return mockQueryForMemory;
        }
        return createMockQuery([], null);
      });

      const result = await engine.retrieveContext(mockAvatarId, 'test query');

      expect(result).toBeDefined();
      expect(result.quickFacts).toHaveLength(1);
      expect(result.memoryFragments).toHaveLength(1);
      expect(result.conversationHistory).toHaveLength(0); // Empty for now
      expect(result.retrievalMetadata).toBeDefined();
      expect(result.retrievalMetadata.retrievalTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should apply confidence-based filtering', async () => {
      const lowConfidenceFacts: QuickFact[] = [
        {
          id: '1',
          avatarId: mockAvatarId,
          key: 'hobby',
          value: 'painting',
          confidence: 0.2, // Below default threshold
          priority: 5,
          source: 'llm',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        },
        {
          id: '2',
          avatarId: mockAvatarId,
          key: 'name',
          value: 'Jane Doe',
          confidence: 0.8, // Above threshold
          priority: 1,
          source: 'manual',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        }
      ];

      const { sbAdmin } = await import('@/lib/data/client');
      vi.mocked(sbAdmin.from).mockImplementation((table: string) => {
        if (table === 'quick_facts') {
          return createMockQuery(lowConfidenceFacts, null);
        }
        return createMockQuery([], null);
      });

      const result = await engine.retrieveContext(mockAvatarId, 'test query', {
        confidenceThreshold: 0.35
      });

      // Should include both facts: high-confidence name and low-confidence hobby (no alternatives)
      expect(result.quickFacts).toHaveLength(2);
      const nameFact = result.quickFacts.find(f => f.key === 'name');
      const hobbyFact = result.quickFacts.find(f => f.key === 'hobby');
      expect(nameFact).toBeDefined();
      expect(hobbyFact).toBeDefined();
      expect(nameFact!.confidence).toBe(0.8);
      expect(hobbyFact!.confidence).toBe(0.2);
    });

    it('should handle conflicting facts by choosing highest confidence', async () => {
      const conflictingFacts: QuickFact[] = [
        {
          id: '1',
          avatarId: mockAvatarId,
          key: 'age',
          value: '25',
          confidence: 0.6,
          priority: 5,
          source: 'llm',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        },
        {
          id: '2',
          avatarId: mockAvatarId,
          key: 'age',
          value: '30',
          confidence: 0.9,
          priority: 3,
          source: 'manual',
          createdAt: '2024-01-02T00:00:00Z',
          updatedAt: '2024-01-02T00:00:00Z'
        }
      ];

      const { sbAdmin } = await import('@/lib/data/client');
      vi.mocked(sbAdmin.from).mockImplementation((table: string) => {
        if (table === 'quick_facts') {
          return createMockQuery(conflictingFacts, null);
        }
        return createMockQuery([], null);
      });

      const result = await engine.retrieveContext(mockAvatarId, 'test query');

      // Should only include the highest confidence fact
      expect(result.quickFacts).toHaveLength(1);
      expect(result.quickFacts[0].value).toBe('30');
      expect(result.quickFacts[0].confidence).toBe(0.9);
    });

    it('should use lower confidence threshold for place facts', async () => {
      const placeFacts: QuickFact[] = [
        {
          id: '1',
          avatarId: mockAvatarId,
          key: 'favorite_place',
          value: 'Paris',
          confidence: 0.3, // Above place threshold (0.25) but below default (0.35)
          priority: 5,
          source: 'llm',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        }
      ];

      const { sbAdmin } = await import('@/lib/data/client');
      vi.mocked(sbAdmin.from).mockImplementation((table: string) => {
        if (table === 'quick_facts') {
          return createMockQuery(placeFacts, null);
        }
        return createMockQuery([], null);
      });

      const result = await engine.retrieveContext(mockAvatarId, 'test query');

      // Should include place fact despite being below default threshold
      expect(result.quickFacts).toHaveLength(1);
      expect(result.quickFacts[0].key).toBe('favorite_place');
    });

    it('should optimize queries for fast mode', async () => {
      const options: RetrievalOptions = {
        fastMode: true,
        memoryLimit: 5,
        historyLimit: 3
      };

      const optimization = engine.optimizeQuery('simple query', options);

      expect(optimization.skipMemoryFragments).toBe(true);
      expect(optimization.limitQuickFacts).toBe(10);
      expect(optimization.cacheStrategy).toBe('quick_facts');
      expect(optimization.estimatedTimeMs).toBe(200);
    });

    it('should handle database errors gracefully', async () => {
      const { sbAdmin } = await import('@/lib/data/client');
      vi.mocked(sbAdmin.from).mockImplementation(() => 
        createMockQuery(null, { message: 'Database connection failed' })
      );

      await expect(engine.retrieveContext(mockAvatarId, 'test query'))
        .rejects.toThrow('Failed to retrieve context');
    });

    it('should measure retrieval performance', async () => {
      const { sbAdmin } = await import('@/lib/data/client');
      vi.mocked(sbAdmin.from).mockImplementation(() => createMockQuery([], null));

      const result = await engine.retrieveContext(mockAvatarId, 'test query');

      expect(result.retrievalMetadata.retrievalTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.retrievalMetadata.retrievalTimeMs).toBeLessThan(1000); // Should be fast
    });
  });

  describe('caching', () => {
    it('should cache quick facts when enabled', async () => {
      const mockFacts: QuickFact[] = [
        {
          id: '1',
          avatarId: mockAvatarId,
          key: 'name',
          value: 'John',
          confidence: 0.9,
          priority: 1,
          source: 'manual',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        }
      ];

      const { sbAdmin } = await import('@/lib/data/client');
      const mockDbCall = vi.fn(() => Promise.resolve({ data: mockFacts, error: null }));
      
      vi.mocked(sbAdmin.from).mockImplementation(() => {
        const mockQuery = createMockQuery(mockFacts, null);
        mockQuery.or = mockDbCall;
        return mockQuery;
      });

      // First call should hit database
      await engine.retrieveContext(mockAvatarId, 'test', { fastMode: true });
      expect(mockDbCall).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await engine.retrieveContext(mockAvatarId, 'test', { fastMode: true });
      expect(mockDbCall).toHaveBeenCalledTimes(1); // Still 1, not 2
    });

    it('should provide cache statistics', () => {
      const stats = engine.getCacheStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('keys');
      expect(Array.isArray(stats.keys)).toBe(true);
    });

    it('should clear cache when requested', () => {
      engine.clearCache();
      const stats = engine.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('query optimization', () => {
    it('should skip memory fragments for simple queries in fast mode', () => {
      const optimization = engine.optimizeQuery('hi', { fastMode: true });
      expect(optimization.skipMemoryFragments).toBe(true);
    });

    it('should include memory fragments for complex queries', () => {
      const optimization = engine.optimizeQuery('tell me about my childhood memories', { fastMode: true });
      expect(optimization.skipMemoryFragments).toBe(false);
    });

    it('should limit quick facts in fast mode', () => {
      const optimization = engine.optimizeQuery('test', { fastMode: true });
      expect(optimization.limitQuickFacts).toBe(10);
    });

    it('should not limit quick facts in normal mode', () => {
      const optimization = engine.optimizeQuery('test', { fastMode: false });
      expect(optimization.limitQuickFacts).toBe(50);
    });
  });

  describe('confidence filtering', () => {
    it('should include single facts even if below threshold when no alternatives exist', async () => {
      const singleLowConfidenceFact: QuickFact[] = [
        {
          id: '1',
          avatarId: mockAvatarId,
          key: 'unique_hobby',
          value: 'collecting stamps',
          confidence: 0.2, // Below threshold
          priority: 5,
          source: 'llm',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z'
        }
      ];

      const { sbAdmin } = await import('@/lib/data/client');
      vi.mocked(sbAdmin.from).mockImplementation((table: string) => {
        if (table === 'quick_facts') {
          return createMockQuery(singleLowConfidenceFact, null);
        }
        return createMockQuery([], null);
      });

      const result = await engine.retrieveContext(mockAvatarId, 'test query');

      // Should include the fact even though it's below threshold (no alternatives)
      expect(result.quickFacts).toHaveLength(1);
      expect(result.quickFacts[0].key).toBe('unique_hobby');
    });
  });

  describe('error handling', () => {
    it('should handle quick facts query errors', async () => {
      const { sbAdmin } = await import('@/lib/data/client');
      vi.mocked(sbAdmin.from).mockImplementation((table: string) => {
        if (table === 'quick_facts') {
          return createMockQuery(null, { message: 'Quick facts error' });
        }
        return createMockQuery([], null);
      });

      await expect(engine.retrieveContext(mockAvatarId, 'test'))
        .rejects.toThrow('Failed to retrieve context');
    });

    it('should handle memory fragments query errors gracefully', async () => {
      const { sbAdmin } = await import('@/lib/data/client');
      vi.mocked(sbAdmin.from).mockImplementation((table: string) => {
        if (table === 'quick_facts') {
          return createMockQuery([], null);
        } else if (table === 'memory_fragments') {
          const mockQuery = createMockQuery(null, { message: 'Memory fragments error' });
          mockQuery.limit = vi.fn(() => Promise.resolve({ 
            data: null, 
            error: { message: 'Memory fragments error' } 
          }));
          return mockQuery;
        }
        return createMockQuery([], null);
      });

      // Should not throw, but return empty memory fragments
      const result = await engine.retrieveContext(mockAvatarId, 'test');
      expect(result.memoryFragments).toHaveLength(0);
    });
  });
});

describe('createContextRetrievalEngine', () => {
  it('should create a new instance', () => {
    const engine = createContextRetrievalEngine();
    expect(engine).toBeInstanceOf(ContextRetrievalEngine);
  });
});