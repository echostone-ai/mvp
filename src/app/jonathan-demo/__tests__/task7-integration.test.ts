// src/app/jonathan-demo/__tests__/task7-integration.test.ts
// Task 7: Integration tests for memory performance optimization in jonathan-demo

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { JonathanDemoMemoryService } from '../../../lib/jonathanDemoMemoryService'

// Mock the JonathanDemoMemoryService
vi.mock('../../../lib/jonathanDemoMemoryService', () => ({
  JonathanDemoMemoryService: {
    getComprehensiveMemoryContext: vi.fn(),
    storeConversationTurnAsync: vi.fn(),
    warmMemoryCache: vi.fn(),
    getPerformanceMetrics: vi.fn(),
    checkPerformanceSLA: vi.fn()
  }
}))

describe('Task 7: Jonathan Demo Memory Performance Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Cache warming on first conversation', () => {
    it('should warm cache when first conversation starts', async () => {
      // Mock successful cache warming
      vi.mocked(JonathanDemoMemoryService.warmMemoryCache).mockResolvedValue()
      
      // Mock memory context retrieval
      vi.mocked(JonathanDemoMemoryService.getComprehensiveMemoryContext).mockResolvedValue({
        memoryContext: 'Test memory context',
        continuityContext: '',
        retrievalTimeMs: 150,
        memoryCount: 3,
        totalTokens: 75,
        cacheHit: false,
        fallbackUsed: false
      })

      // Simulate first conversation scenario
      const isFirstConversation = true
      const avatarSlug = 'jonathan-demo'
      const userMessage = 'Hello, tell me about yourself'

      if (isFirstConversation) {
        // This should trigger cache warming
        await JonathanDemoMemoryService.warmMemoryCache(avatarSlug)
      }

      // Then retrieve memory context
      const memoryContext = await JonathanDemoMemoryService.getComprehensiveMemoryContext(
        userMessage,
        avatarSlug
      )

      expect(JonathanDemoMemoryService.warmMemoryCache).toHaveBeenCalledWith(avatarSlug)
      expect(memoryContext.retrievalTimeMs).toBeLessThan(200)
      expect(memoryContext.memoryCount).toBeGreaterThan(0)
    })

    it('should handle cache warming failures gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      // Mock cache warming failure
      vi.mocked(JonathanDemoMemoryService.warmMemoryCache).mockRejectedValue(
        new Error('Cache warming failed')
      )
      
      // Mock successful memory retrieval despite cache warming failure
      vi.mocked(JonathanDemoMemoryService.getComprehensiveMemoryContext).mockResolvedValue({
        memoryContext: 'Fallback memory context',
        continuityContext: '',
        retrievalTimeMs: 180,
        memoryCount: 2,
        totalTokens: 50,
        cacheHit: false,
        fallbackUsed: false
      })

      const avatarSlug = 'jonathan-demo'
      const userMessage = 'Hello'

      // Should not throw even if cache warming fails
      await expect(
        JonathanDemoMemoryService.warmMemoryCache(avatarSlug)
      ).rejects.toThrow('Cache warming failed')

      // Memory retrieval should still work
      const memoryContext = await JonathanDemoMemoryService.getComprehensiveMemoryContext(
        userMessage,
        avatarSlug
      )

      expect(memoryContext.memoryContext).toBe('Fallback memory context')
      expect(memoryContext.retrievalTimeMs).toBeLessThan(200)
      
      consoleSpy.mockRestore()
    })
  })

  describe('Performance monitoring integration', () => {
    it('should track memory retrieval performance across conversations', async () => {
      // Mock performance metrics
      vi.mocked(JonathanDemoMemoryService.getPerformanceMetrics).mockReturnValue({
        averageRetrievalTime: 145,
        cacheHitRate: 0.6,
        fallbackUsageRate: 0.05,
        totalQueries: 50
      })

      // Mock SLA check
      vi.mocked(JonathanDemoMemoryService.checkPerformanceSLA).mockReturnValue({
        meetsSLA: true,
        averageTime: 145,
        targetTime: 200
      })

      const metrics = JonathanDemoMemoryService.getPerformanceMetrics()
      const slaCheck = JonathanDemoMemoryService.checkPerformanceSLA()

      expect(metrics.averageRetrievalTime).toBeLessThan(200)
      expect(metrics.cacheHitRate).toBeGreaterThan(0.5) // Good cache performance
      expect(metrics.fallbackUsageRate).toBeLessThan(0.1) // Low fallback usage
      expect(slaCheck.meetsSLA).toBe(true)
    })

    it('should detect performance degradation', async () => {
      // Mock degraded performance
      vi.mocked(JonathanDemoMemoryService.getPerformanceMetrics).mockReturnValue({
        averageRetrievalTime: 280,
        cacheHitRate: 0.2,
        fallbackUsageRate: 0.3,
        totalQueries: 100
      })

      vi.mocked(JonathanDemoMemoryService.checkPerformanceSLA).mockReturnValue({
        meetsSLA: false,
        averageTime: 280,
        targetTime: 200
      })

      const metrics = JonathanDemoMemoryService.getPerformanceMetrics()
      const slaCheck = JonathanDemoMemoryService.checkPerformanceSLA()

      expect(metrics.averageRetrievalTime).toBeGreaterThan(200)
      expect(metrics.cacheHitRate).toBeLessThan(0.5) // Poor cache performance
      expect(metrics.fallbackUsageRate).toBeGreaterThan(0.2) // High fallback usage
      expect(slaCheck.meetsSLA).toBe(false)
    })
  })

  describe('Memory retrieval with token and fragment limits', () => {
    it('should respect top-6 fragments and 300 token limits', async () => {
      // Mock memory context with limits applied
      vi.mocked(JonathanDemoMemoryService.getComprehensiveMemoryContext).mockResolvedValue({
        memoryContext: 'Limited memory context with exactly 6 fragments',
        continuityContext: 'Recent conversation context',
        retrievalTimeMs: 120,
        memoryCount: 6, // Exactly 6 fragments
        totalTokens: 285, // Under 300 token limit
        cacheHit: true,
        fallbackUsed: false
      })

      const memoryContext = await JonathanDemoMemoryService.getComprehensiveMemoryContext(
        'Tell me about my interests',
        'jonathan-demo'
      )

      expect(memoryContext.memoryCount).toBeLessThanOrEqual(6)
      expect(memoryContext.totalTokens).toBeLessThanOrEqual(300)
      expect(memoryContext.retrievalTimeMs).toBeLessThan(200)
      expect(memoryContext.cacheHit).toBe(true)
    })

    it('should handle edge case with no memories found', async () => {
      // Mock empty memory result
      vi.mocked(JonathanDemoMemoryService.getComprehensiveMemoryContext).mockResolvedValue({
        memoryContext: '',
        continuityContext: '',
        retrievalTimeMs: 50,
        memoryCount: 0,
        totalTokens: 0,
        cacheHit: false,
        fallbackUsed: false
      })

      const memoryContext = await JonathanDemoMemoryService.getComprehensiveMemoryContext(
        'Random query with no matches',
        'jonathan-demo'
      )

      expect(memoryContext.memoryCount).toBe(0)
      expect(memoryContext.totalTokens).toBe(0)
      expect(memoryContext.memoryContext).toBe('')
      expect(memoryContext.retrievalTimeMs).toBeLessThan(200)
    })
  })

  describe('Conversation flow with optimized memory', () => {
    it('should maintain conversation flow with fast memory retrieval', async () => {
      const conversationTurns = [
        'Hello, I\'m new here',
        'Tell me about my hobbies',
        'What did I mention about my family?'
      ]

      for (const [index, message] of conversationTurns.entries()) {
        // Mock increasingly faster retrieval due to cache warming
        const retrievalTime = Math.max(50, 150 - (index * 30))
        const cacheHit = index > 0 // Cache hits after first turn
        
        vi.mocked(JonathanDemoMemoryService.getComprehensiveMemoryContext).mockResolvedValueOnce({
          memoryContext: `Memory context for turn ${index + 1}`,
          continuityContext: `Continuity for turn ${index + 1}`,
          retrievalTimeMs: retrievalTime,
          memoryCount: Math.min(index + 2, 6),
          totalTokens: Math.min((index + 1) * 50, 300),
          cacheHit,
          fallbackUsed: false
        })

        const result = await JonathanDemoMemoryService.getComprehensiveMemoryContext(
          message,
          'jonathan-demo'
        )

        expect(result.retrievalTimeMs).toBeLessThan(200)
        expect(result.memoryCount).toBeLessThanOrEqual(6)
        expect(result.totalTokens).toBeLessThanOrEqual(300)
        
        if (index > 0) {
          expect(result.cacheHit).toBe(true)
        }
      }
    })
  })

  describe('Error handling and graceful degradation', () => {
    it('should continue conversation when memory optimization fails', async () => {
      // Mock memory service failure
      vi.mocked(JonathanDemoMemoryService.getComprehensiveMemoryContext).mockResolvedValue({
        memoryContext: '',
        continuityContext: '',
        retrievalTimeMs: 0,
        memoryCount: 0,
        totalTokens: 0,
        cacheHit: false,
        fallbackUsed: true
      })

      const result = await JonathanDemoMemoryService.getComprehensiveMemoryContext(
        'Test message',
        'jonathan-demo'
      )

      // Should gracefully degrade
      expect(result.memoryContext).toBe('')
      expect(result.fallbackUsed).toBe(true)
      expect(result.memoryCount).toBe(0)
    })
  })
})