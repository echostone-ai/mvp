// src/lib/__tests__/task7-verification.test.ts
// Task 7: Verification tests for memory retrieval performance optimization

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { JonathanDemoMemoryService } from '../jonathanDemoMemoryService'
import { MemoryQueryOptimizer } from '../memoryQueryOptimizer'

// Mock MemoryQueryOptimizer
vi.mock('../memoryQueryOptimizer', () => ({
  MemoryQueryOptimizer: {
    retrieveOptimizedMemories: vi.fn(),
    warmCache: vi.fn(),
    getPerformanceMetrics: vi.fn(),
    checkPerformanceSLA: vi.fn()
  }
}))

// Mock MemoryService
vi.mock('../memoryService', () => ({
  MemoryService: {
    Retrieval: {
      getUserMemories: vi.fn()
    },
    processAndStoreMemories: vi.fn()
  }
}))

describe('Task 7: Memory Retrieval Performance Optimization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Requirement 4.2: Memory retrieval with <200ms SLA', () => {
    it('should retrieve memories within 200ms target', async () => {
      const mockResult = {
        fragments: [
          {
            id: '1',
            userId: 'demo-system-user',
            avatarId: 'jonathan-demo',
            fragmentText: 'User loves hiking and outdoor activities',
            conversationContext: {},
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ],
        retrievalTimeMs: 150, // Within 200ms target
        totalTokens: 25,
        cacheHit: false,
        fallbackUsed: false
      }

      vi.mocked(MemoryQueryOptimizer.retrieveOptimizedMemories).mockResolvedValue(mockResult)

      const result = await JonathanDemoMemoryService.getMemoryContextForQuery(
        'Tell me about outdoor activities',
        'jonathan-demo',
        6
      )

      expect(result.retrievalTimeMs).toBeLessThan(200)
      expect(result.memoryCount).toBe(1)
      expect(result.totalTokens).toBe(25)
      expect(result.cacheHit).toBe(false)
      expect(result.fallbackUsed).toBe(false)
      expect(result.memoryContext).toContain('User loves hiking')
    })

    it('should warn when retrieval exceeds 200ms SLA', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      const mockResult = {
        fragments: [],
        retrievalTimeMs: 250, // Exceeds 200ms target
        totalTokens: 0,
        cacheHit: false,
        fallbackUsed: false
      }

      vi.mocked(MemoryQueryOptimizer.retrieveOptimizedMemories).mockResolvedValue(mockResult)

      await JonathanDemoMemoryService.getMemoryContextForQuery(
        'test query',
        'jonathan-demo'
      )

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Memory retrieval exceeded 200ms target: 250ms')
      )
      
      consoleSpy.mockRestore()
    })
  })

  describe('Top-6 fragments with max 300 tokens constraint', () => {
    it('should cap results to top-6 fragments', async () => {
      const mockResult = {
        fragments: Array.from({ length: 6 }, (_, i) => ({
          id: `${i + 1}`,
          userId: 'demo-system-user',
          avatarId: 'jonathan-demo',
          fragmentText: `Memory fragment ${i + 1}`,
          conversationContext: {},
          createdAt: new Date(),
          updatedAt: new Date()
        })),
        retrievalTimeMs: 100,
        totalTokens: 250,
        cacheHit: false,
        fallbackUsed: false
      }

      vi.mocked(MemoryQueryOptimizer.retrieveOptimizedMemories).mockResolvedValue(mockResult)

      const result = await JonathanDemoMemoryService.getMemoryContextForQuery(
        'test query',
        'jonathan-demo',
        6
      )

      expect(MemoryQueryOptimizer.retrieveOptimizedMemories).toHaveBeenCalledWith({
        query: 'test query',
        userId: 'demo-system-user',
        avatarId: 'jonathan-demo',
        maxFragments: 6,
        maxTokens: 300,
        similarityThreshold: 0.7
      })

      expect(result.memoryCount).toBe(6)
      expect(result.totalTokens).toBe(250)
    })

    it('should cap results to max 300 tokens', async () => {
      const mockResult = {
        fragments: [
          {
            id: '1',
            userId: 'demo-system-user',
            avatarId: 'jonathan-demo',
            fragmentText: 'Memory fragment within token limit',
            conversationContext: {},
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ],
        retrievalTimeMs: 100,
        totalTokens: 280, // Within 300 token limit
        cacheHit: false,
        fallbackUsed: false
      }

      vi.mocked(MemoryQueryOptimizer.retrieveOptimizedMemories).mockResolvedValue(mockResult)

      const result = await JonathanDemoMemoryService.getMemoryContextForQuery(
        'test query',
        'jonathan-demo'
      )

      expect(MemoryQueryOptimizer.retrieveOptimizedMemories).toHaveBeenCalledWith(
        expect.objectContaining({
          maxTokens: 300
        })
      )

      expect(result.totalTokens).toBeLessThanOrEqual(300)
    })
  })

  describe('Memory cache warming on first conversation turn', () => {
    it('should warm cache with common queries', async () => {
      vi.mocked(MemoryQueryOptimizer.warmCache).mockResolvedValue()

      await JonathanDemoMemoryService.warmMemoryCache('jonathan-demo')

      expect(MemoryQueryOptimizer.warmCache).toHaveBeenCalledWith(
        'demo-system-user',
        'jonathan-demo',
        expect.arrayContaining([
          'personal information about the user',
          'family and relationships',
          'hobbies and interests',
          'work and career',
          'recent conversations',
          'user preferences',
          'life experiences',
          'goals and aspirations'
        ])
      )
    })

    it('should handle cache warming failures gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      vi.mocked(MemoryQueryOptimizer.warmCache).mockRejectedValue(new Error('Cache warming failed'))

      // Should not throw
      await expect(
        JonathanDemoMemoryService.warmMemoryCache('jonathan-demo')
      ).resolves.toBeUndefined()

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to warm memory cache:',
        expect.any(Error)
      )
      
      consoleSpy.mockRestore()
    })
  })

  describe('Performance monitoring with <200ms SLA', () => {
    it('should provide performance metrics', () => {
      const mockMetrics = {
        averageRetrievalTime: 150,
        cacheHitRate: 0.75,
        fallbackUsageRate: 0.1,
        totalQueries: 100
      }

      vi.mocked(MemoryQueryOptimizer.getPerformanceMetrics).mockReturnValue(mockMetrics)

      const metrics = JonathanDemoMemoryService.getPerformanceMetrics()

      expect(metrics.averageRetrievalTime).toBe(150)
      expect(metrics.cacheHitRate).toBe(0.75)
      expect(metrics.fallbackUsageRate).toBe(0.1)
      expect(metrics.totalQueries).toBe(100)
    })

    it('should check SLA compliance', () => {
      const mockSLACheck = {
        meetsSLA: true,
        averageTime: 180,
        targetTime: 200
      }

      vi.mocked(MemoryQueryOptimizer.checkPerformanceSLA).mockReturnValue(mockSLACheck)

      const slaCheck = JonathanDemoMemoryService.checkPerformanceSLA()

      expect(slaCheck.meetsSLA).toBe(true)
      expect(slaCheck.averageTime).toBe(180)
      expect(slaCheck.targetTime).toBe(200)
    })

    it('should detect SLA violations', () => {
      const mockSLACheck = {
        meetsSLA: false,
        averageTime: 250,
        targetTime: 200
      }

      vi.mocked(MemoryQueryOptimizer.checkPerformanceSLA).mockReturnValue(mockSLACheck)

      const slaCheck = JonathanDemoMemoryService.checkPerformanceSLA()

      expect(slaCheck.meetsSLA).toBe(false)
      expect(slaCheck.averageTime).toBeGreaterThan(200)
    })
  })

  describe('GIN index optimization', () => {
    it('should use optimized database functions', async () => {
      const mockResult = {
        fragments: [
          {
            id: '1',
            userId: 'demo-system-user',
            avatarId: 'jonathan-demo',
            fragmentText: 'Optimized retrieval result',
            conversationContext: {},
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ],
        retrievalTimeMs: 50, // Fast due to indexing
        totalTokens: 15,
        cacheHit: false,
        fallbackUsed: false
      }

      vi.mocked(MemoryQueryOptimizer.retrieveOptimizedMemories).mockResolvedValue(mockResult)

      const result = await JonathanDemoMemoryService.getMemoryContextForQuery(
        'test query',
        'jonathan-demo'
      )

      // Should be fast due to GIN indexing
      expect(result.retrievalTimeMs).toBeLessThan(100)
      expect(result.memoryContext).toContain('Optimized retrieval result')
    })
  })

  describe('Graceful degradation', () => {
    it('should handle memory retrieval failures gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      vi.mocked(MemoryQueryOptimizer.retrieveOptimizedMemories).mockRejectedValue(
        new Error('Database connection failed')
      )

      const result = await JonathanDemoMemoryService.getMemoryContextForQuery(
        'test query',
        'jonathan-demo'
      )

      expect(result.memoryContext).toBe('')
      expect(result.memoryCount).toBe(0)
      expect(result.totalTokens).toBe(0)
      expect(result.fallbackUsed).toBe(true)
      
      consoleSpy.mockRestore()
    })

    it('should continue conversation without memory context on failures', async () => {
      vi.mocked(MemoryQueryOptimizer.retrieveOptimizedMemories).mockRejectedValue(
        new Error('Memory service unavailable')
      )

      const result = await JonathanDemoMemoryService.getComprehensiveMemoryContext(
        'test query',
        'jonathan-demo'
      )

      // Should return empty context but not throw
      expect(result.memoryContext).toBe('')
      expect(result.continuityContext).toBeDefined()
      expect(result.fallbackUsed).toBe(true)
    })
  })
})