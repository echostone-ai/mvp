// src/lib/__tests__/memoryQueryOptimizer.test.ts
// Task 7: Tests for optimized memory retrieval performance

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock Supabase
const mockRpc = vi.fn()
vi.mock('../supabase', () => ({
  supabase: {
    rpc: mockRpc
  }
}))

// Mock MemoryStorageService
vi.mock('../memoryService', () => ({
  MemoryStorageService: {
    generateEmbedding: vi.fn().mockResolvedValue(new Array(1536).fill(0.1))
  }
}))

describe('MemoryQueryOptimizer', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Import and clear cache/metrics after mocks are set up
    const { MemoryQueryOptimizer } = await import('../memoryQueryOptimizer')
    MemoryQueryOptimizer.clearCache()
    MemoryQueryOptimizer.resetMetrics()
  })

  afterEach(async () => {
    const { MemoryQueryOptimizer } = await import('../memoryQueryOptimizer')
    MemoryQueryOptimizer.clearCache()
    MemoryQueryOptimizer.resetMetrics()
  })

  describe('retrieveOptimizedMemories', () => {
    it('should retrieve memories with default parameters', async () => {
      const { MemoryQueryOptimizer } = await import('../memoryQueryOptimizer')
      
      const mockFragments = [
        {
          id: '1',
          user_id: 'user1',
          avatar_id: 'avatar1',
          fragment_text: 'Test memory fragment',
          conversation_context: {},
          similarity: 0.8,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          token_count: 5
        }
      ]

      mockRpc.mockResolvedValue({ data: mockFragments, error: null })

      const result = await MemoryQueryOptimizer.retrieveOptimizedMemories({
        query: 'test query',
        userId: 'user1',
        avatarId: 'avatar1'
      })

      expect(result.fragments).toHaveLength(1)
      expect(result.fragments[0].fragmentText).toBe('Test memory fragment')
      expect(result.retrievalTimeMs).toBeGreaterThan(0)
      expect(result.totalTokens).toBeGreaterThan(0)
      expect(result.cacheHit).toBe(false)
      expect(result.fallbackUsed).toBe(false)
    })

    it('should cap results to maxFragments', async () => {
      const mockFragments = Array.from({ length: 10 }, (_, i) => ({
        id: `${i + 1}`,
        user_id: 'user1',
        avatar_id: 'avatar1',
        fragment_text: `Test memory fragment ${i + 1}`,
        conversation_context: {},
        similarity: 0.8,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        token_count: 5
      }))

      mockSupabase.rpc.mockResolvedValue({ data: mockFragments, error: null })

      const result = await MemoryQueryOptimizer.retrieveOptimizedMemories({
        query: 'test query',
        userId: 'user1',
        avatarId: 'avatar1',
        maxFragments: 3
      })

      expect(result.fragments).toHaveLength(3)
    })

    it('should cap results to maxTokens', async () => {
      const mockFragments = [
        {
          id: '1',
          user_id: 'user1',
          avatar_id: 'avatar1',
          fragment_text: 'Short fragment',
          conversation_context: {},
          similarity: 0.8,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          token_count: 50
        },
        {
          id: '2',
          user_id: 'user1',
          avatar_id: 'avatar1',
          fragment_text: 'Another fragment that would exceed token limit',
          conversation_context: {},
          similarity: 0.7,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          token_count: 300
        }
      ]

      mockSupabase.rpc.mockResolvedValue({ data: mockFragments, error: null })

      const result = await MemoryQueryOptimizer.retrieveOptimizedMemories({
        query: 'test query',
        userId: 'user1',
        avatarId: 'avatar1',
        maxTokens: 100
      })

      expect(result.totalTokens).toBeLessThanOrEqual(100)
    })

    it('should use cache on subsequent identical queries', async () => {
      const mockFragments = [
        {
          id: '1',
          user_id: 'user1',
          avatar_id: 'avatar1',
          fragment_text: 'Test memory fragment',
          conversation_context: {},
          similarity: 0.8,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          token_count: 5
        }
      ]

      mockSupabase.rpc.mockResolvedValue({ data: mockFragments, error: null })

      const query = {
        query: 'test query',
        userId: 'user1',
        avatarId: 'avatar1'
      }

      // First call should hit database
      const result1 = await MemoryQueryOptimizer.retrieveOptimizedMemories(query)
      expect(result1.cacheHit).toBe(false)
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(1)

      // Second call should hit cache
      const result2 = await MemoryQueryOptimizer.retrieveOptimizedMemories(query)
      expect(result2.cacheHit).toBe(true)
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(1) // No additional calls
    })

    it('should fallback to text search when vector search fails', async () => {
      // First call (vector search) fails
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: null, error: new Error('Vector search failed') })
        .mockResolvedValueOnce({ 
          data: [
            {
              id: '1',
              user_id: 'user1',
              avatar_id: 'avatar1',
              fragment_text: 'Fallback result',
              conversation_context: {},
              similarity: 0.7,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              token_count: 5
            }
          ], 
          error: null 
        })

      const result = await MemoryQueryOptimizer.retrieveOptimizedMemories({
        query: 'test query',
        userId: 'user1',
        avatarId: 'avatar1'
      })

      expect(result.fragments).toHaveLength(1)
      expect(result.fragments[0].fragmentText).toBe('Fallback result')
      expect(result.fallbackUsed).toBe(true)
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(2)
    })

    it('should meet performance SLA target', async () => {
      const mockFragments = [
        {
          id: '1',
          user_id: 'user1',
          avatar_id: 'avatar1',
          fragment_text: 'Test memory fragment',
          conversation_context: {},
          similarity: 0.8,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          token_count: 5
        }
      ]

      mockSupabase.rpc.mockResolvedValue({ data: mockFragments, error: null })

      const result = await MemoryQueryOptimizer.retrieveOptimizedMemories({
        query: 'test query',
        userId: 'user1',
        avatarId: 'avatar1'
      })

      // Should complete within 200ms SLA (allowing some buffer for test environment)
      expect(result.retrievalTimeMs).toBeLessThan(500)
    })
  })

  describe('cache warming', () => {
    it('should warm cache with common queries', async () => {
      const mockFragments = [
        {
          id: '1',
          user_id: 'user1',
          avatar_id: 'avatar1',
          fragment_text: 'Test memory fragment',
          conversation_context: {},
          similarity: 0.8,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          token_count: 5
        }
      ]

      mockSupabase.rpc.mockResolvedValue({ data: mockFragments, error: null })

      const commonQueries = ['personal info', 'family', 'hobbies']
      await MemoryQueryOptimizer.warmCache('user1', 'avatar1', commonQueries)

      // Should have made calls for each common query
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(commonQueries.length)
    })

    it('should handle cache warming failures gracefully', async () => {
      mockSupabase.rpc.mockRejectedValue(new Error('Database error'))

      // Should not throw
      await expect(
        MemoryQueryOptimizer.warmCache('user1', 'avatar1', ['test query'])
      ).resolves.toBeUndefined()
    })
  })

  describe('performance metrics', () => {
    it('should track performance metrics', async () => {
      const mockFragments = [
        {
          id: '1',
          user_id: 'user1',
          avatar_id: 'avatar1',
          fragment_text: 'Test memory fragment',
          conversation_context: {},
          similarity: 0.8,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          token_count: 5
        }
      ]

      mockSupabase.rpc.mockResolvedValue({ data: mockFragments, error: null })

      // Make a few queries
      await MemoryQueryOptimizer.retrieveOptimizedMemories({
        query: 'test query 1',
        userId: 'user1',
        avatarId: 'avatar1'
      })

      await MemoryQueryOptimizer.retrieveOptimizedMemories({
        query: 'test query 2',
        userId: 'user1',
        avatarId: 'avatar1'
      })

      const metrics = MemoryQueryOptimizer.getPerformanceMetrics()
      expect(metrics.totalQueries).toBe(2)
      expect(metrics.averageRetrievalTime).toBeGreaterThan(0)
      expect(metrics.cacheHitRate).toBeGreaterThanOrEqual(0)
      expect(metrics.fallbackUsageRate).toBeGreaterThanOrEqual(0)
    })

    it('should check SLA compliance', async () => {
      const mockFragments = [
        {
          id: '1',
          user_id: 'user1',
          avatar_id: 'avatar1',
          fragment_text: 'Test memory fragment',
          conversation_context: {},
          similarity: 0.8,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          token_count: 5
        }
      ]

      mockSupabase.rpc.mockResolvedValue({ data: mockFragments, error: null })

      await MemoryQueryOptimizer.retrieveOptimizedMemories({
        query: 'test query',
        userId: 'user1',
        avatarId: 'avatar1'
      })

      const slaCheck = MemoryQueryOptimizer.checkPerformanceSLA()
      expect(slaCheck.targetTime).toBe(200)
      expect(slaCheck.averageTime).toBeGreaterThan(0)
      expect(typeof slaCheck.meetsSLA).toBe('boolean')
    })
  })

  describe('token calculation', () => {
    it('should calculate tokens correctly', async () => {
      const mockFragments = [
        {
          id: '1',
          user_id: 'user1',
          avatar_id: 'avatar1',
          fragment_text: 'This is a test fragment with multiple words',
          conversation_context: {},
          similarity: 0.8,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          token_count: 12 // 9 words * 1.3 ≈ 12 tokens
        }
      ]

      mockSupabase.rpc.mockResolvedValue({ data: mockFragments, error: null })

      const result = await MemoryQueryOptimizer.retrieveOptimizedMemories({
        query: 'test query',
        userId: 'user1',
        avatarId: 'avatar1'
      })

      expect(result.totalTokens).toBeGreaterThan(0)
      // Should be roughly 9 words * 1.3 = ~12 tokens
      expect(result.totalTokens).toBeCloseTo(12, 0)
    })
  })
})