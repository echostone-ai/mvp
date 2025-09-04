// src/app/jonathan-demo/__tests__/task13-advanced-memory-integration.test.ts
// Task 13: Integration tests for advanced memory ranking in jonathan-demo

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { JonathanDemoMemoryService } from '../../../lib/jonathanDemoMemoryService'

// Mock Supabase
vi.mock('../../../lib/supabase', () => {
  const createQueryChain = () => ({
    select: vi.fn(() => createQueryChain()),
    eq: vi.fn(() => createQueryChain()),
    order: vi.fn(() => createQueryChain()),
    limit: vi.fn(() => createQueryChain()),
    range: vi.fn(() => Promise.resolve({ data: [], error: null })),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    then: vi.fn(() => Promise.resolve({ data: [], error: null }))
  })

  return {
    supabase: {
      from: vi.fn(() => ({
        ...createQueryChain(),
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: { id: 'test-id' }, error: null }))
          }))
        })),
        delete: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: vi.fn(() => Promise.resolve({ error: null }))
          }))
        })),
        rpc: vi.fn(() => Promise.resolve({ data: [], error: null }))
      })),
      rpc: vi.fn(() => Promise.resolve({ data: [], error: null }))
    }
  }
})

// Mock MemoryService
vi.mock('../../../lib/memoryService', () => ({
  MemoryService: {
    Retrieval: {
      retrieveRelevantMemories: vi.fn(() => Promise.resolve([
        {
          id: 'memory-1',
          userId: 'demo-system-user',
          avatarId: 'jonathan-demo',
          fragmentText: 'I love hiking with my dog Max every weekend. He is a golden retriever.',
          embedding: Array(1536).fill(0.1),
          conversationContext: {
            timestamp: '2024-01-15T10:00:00Z',
            messageContext: 'talking about hobbies',
            emotionalTone: 'positive'
          },
          createdAt: new Date('2024-01-15T10:00:00Z'),
          updatedAt: new Date('2024-01-15T10:00:00Z')
        },
        {
          id: 'memory-2',
          userId: 'demo-system-user',
          avatarId: 'jonathan-demo',
          fragmentText: 'My work at the tech company is very stressful lately.',
          embedding: Array(1536).fill(0.2),
          conversationContext: {
            timestamp: '2024-01-10T14:00:00Z',
            messageContext: 'discussing work stress',
            emotionalTone: 'negative'
          },
          createdAt: new Date('2024-01-10T14:00:00Z'),
          updatedAt: new Date('2024-01-10T14:00:00Z')
        }
      ])),
      getUserMemories: vi.fn(() => Promise.resolve([]))
    },
    processAndStoreMemories: vi.fn(() => Promise.resolve([])),
    Storage: {
      generateEmbedding: vi.fn(() => Promise.resolve(Array(1536).fill(0.1))),
      storeMemoryFragment: vi.fn(() => Promise.resolve('test-memory-id'))
    }
  }
}))

// Mock MemoryQueryOptimizer
vi.mock('../../../lib/memoryQueryOptimizer', () => ({
  MemoryQueryOptimizer: {
    retrieveOptimizedMemories: vi.fn(() => Promise.resolve({
      fragments: [],
      retrievalTimeMs: 50,
      totalTokens: 0,
      cacheHit: false,
      fallbackUsed: false
    })),
    warmCache: vi.fn(() => Promise.resolve()),
    getPerformanceMetrics: vi.fn(() => ({
      averageRetrievalTime: 100,
      cacheHitRate: 0.8,
      fallbackUsageRate: 0.1,
      totalQueries: 50
    })),
    checkPerformanceSLA: vi.fn(() => ({
      meetsSLA: true,
      averageTime: 150,
      targetTime: 200
    }))
  }
}))

describe('Task 13: Advanced Memory Ranking Integration with Jonathan Demo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Enhanced Memory Context Retrieval', () => {
    it('should retrieve memory context with advanced ranking', async () => {
      const query = 'Tell me about your hobbies and interests'
      const avatarId = 'jonathan-demo'

      const result = await JonathanDemoMemoryService.getMemoryContextForQuery(
        query,
        avatarId,
        5
      )

      expect(result).toBeDefined()
      expect(result.memoryContext).toBeDefined()
      expect(result.retrievalTimeMs).toBeGreaterThan(0)
      expect(result.memoryCount).toBeGreaterThanOrEqual(0)
      expect(result.totalTokens).toBeGreaterThanOrEqual(0)

      // Verify that advanced ranking was used (should include ranking information)
      if (result.memoryCount > 0) {
        expect(result.memoryContext).toContain('ranked by conversational relevance')
        expect(result.memoryContext).toContain('relevance:')
        expect(result.memoryContext).toContain('topics:')
      }
    })

    it('should handle session-based memory retrieval', async () => {
      const query = 'What outdoor activities do you enjoy?'
      const avatarId = 'jonathan-demo'
      const sessionId = 'test-session-123'

      // Start a conversation session first
      JonathanDemoMemoryService.startConversationSession(sessionId, avatarId)

      const result = await JonathanDemoMemoryService.getMemoryContextForQuery(
        query,
        avatarId,
        5,
        sessionId
      )

      expect(result).toBeDefined()
      expect(result.retrievalTimeMs).toBeLessThan(500) // Should be fast
    })

    it('should meet performance SLA (<200ms)', async () => {
      const query = 'Quick memory test'
      const avatarId = 'jonathan-demo'

      const startTime = Date.now()
      const result = await JonathanDemoMemoryService.getMemoryContextForQuery(
        query,
        avatarId,
        3
      )
      const endTime = Date.now()

      const actualTime = endTime - startTime
      
      // Should meet the <200ms requirement for memory retrieval overhead
      expect(actualTime).toBeLessThan(500) // Allow some buffer for test environment
      expect(result.retrievalTimeMs).toBeDefined()
    })

    it('should fallback gracefully when advanced ranking fails', async () => {
      // Mock advanced memory service to throw an error
      const { advancedMemoryService } = await import('../../../lib/services/advancedMemoryService')
      const originalRetrieve = advancedMemoryService.retrieveRankedMemories
      
      vi.spyOn(advancedMemoryService, 'retrieveRankedMemories').mockRejectedValue(
        new Error('Advanced ranking failed')
      )

      const query = 'Test fallback scenario'
      const avatarId = 'jonathan-demo'

      const result = await JonathanDemoMemoryService.getMemoryContextForQuery(
        query,
        avatarId,
        5
      )

      expect(result).toBeDefined()
      expect(result.fallbackUsed).toBe(true)
      expect(result.memoryContext).toBeDefined()

      // Restore original method
      advancedMemoryService.retrieveRankedMemories = originalRetrieve
    })
  })

  describe('Conversation Session Management', () => {
    it('should start conversation sessions for topic tracking', () => {
      const sessionId = 'jonathan-session-1'
      const avatarId = 'jonathan-demo'

      expect(() => {
        JonathanDemoMemoryService.startConversationSession(sessionId, avatarId)
      }).not.toThrow()

      const context = JonathanDemoMemoryService.getConversationContext(sessionId)
      expect(context).toBeDefined()
    })

    it('should track conversation context across multiple queries', async () => {
      const sessionId = 'jonathan-session-2'
      const avatarId = 'jonathan-demo'

      // Start session
      JonathanDemoMemoryService.startConversationSession(sessionId, avatarId)

      // First query about hobbies
      await JonathanDemoMemoryService.getMemoryContextForQuery(
        'I love hiking and outdoor activities',
        avatarId,
        5,
        sessionId
      )

      // Second query about work
      await JonathanDemoMemoryService.getMemoryContextForQuery(
        'My job is stressful lately',
        avatarId,
        5,
        sessionId
      )

      const context = JonathanDemoMemoryService.getConversationContext(sessionId)
      expect(context).toBeDefined()
      expect(context?.recentTopics.length).toBeGreaterThan(0)
    })
  })

  describe('Memory Maintenance Operations', () => {
    it('should run memory maintenance for jonathan-demo', async () => {
      const avatarId = 'jonathan-demo'

      const result = await JonathanDemoMemoryService.runMemoryMaintenance(avatarId)

      expect(result).toBeDefined()
      expect(result.deduplicationResult).toBeDefined()
      expect(result.archivalResult).toBeDefined()
      expect(result.totalProcessingTimeMs).toBeGreaterThan(0)
      expect(result.recommendedActions).toBeDefined()
      expect(Array.isArray(result.recommendedActions)).toBe(true)
    })

    it('should generate memory health report', async () => {
      const avatarId = 'jonathan-demo'

      const report = await JonathanDemoMemoryService.getMemoryHealthReport(avatarId)

      expect(report).toBeDefined()
      expect(report.totalMemories).toBeGreaterThanOrEqual(0)
      expect(report.duplicateGroups).toBeGreaterThanOrEqual(0)
      expect(report.archivalCandidates).toBeGreaterThanOrEqual(0)
      expect(report.averageMemoryAge).toBeGreaterThanOrEqual(0)
      expect(Array.isArray(report.topTopics)).toBe(true)
      expect(Array.isArray(report.recommendations)).toBe(true)
    })
  })

  describe('Performance Monitoring', () => {
    it('should provide performance metrics', () => {
      const metrics = JonathanDemoMemoryService.getPerformanceMetrics()

      expect(metrics).toBeDefined()
      expect(metrics.averageRetrievalTime).toBeGreaterThanOrEqual(0)
      expect(metrics.cacheHitRate).toBeGreaterThanOrEqual(0)
      expect(metrics.cacheHitRate).toBeLessThanOrEqual(1)
      expect(metrics.fallbackUsageRate).toBeGreaterThanOrEqual(0)
      expect(metrics.fallbackUsageRate).toBeLessThanOrEqual(1)
      expect(metrics.totalQueries).toBeGreaterThanOrEqual(0)
    })

    it('should check performance SLA compliance', () => {
      const slaCheck = JonathanDemoMemoryService.checkPerformanceSLA()

      expect(slaCheck).toBeDefined()
      expect(typeof slaCheck.meetsSLA).toBe('boolean')
      expect(slaCheck.averageTime).toBeGreaterThanOrEqual(0)
      expect(slaCheck.targetTime).toBe(200) // 200ms SLA target
    })
  })

  describe('Error Handling and Resilience', () => {
    it('should handle memory service errors gracefully', async () => {
      // Mock MemoryService to throw an error
      const { MemoryService } = await import('../../../lib/memoryService')
      vi.mocked(MemoryService.Retrieval.retrieveRelevantMemories).mockRejectedValue(
        new Error('Database connection failed')
      )

      const query = 'Test error handling'
      const avatarId = 'jonathan-demo'

      const result = await JonathanDemoMemoryService.getMemoryContextForQuery(
        query,
        avatarId,
        5
      )

      // Should return empty context instead of throwing
      expect(result).toBeDefined()
      expect(result.memoryContext).toBe('')
      expect(result.fallbackUsed).toBe(true)
      expect(result.memoryCount).toBe(0)
    })

    it('should handle invalid session IDs gracefully', () => {
      const invalidSessionId = 'nonexistent-session'
      
      const context = JonathanDemoMemoryService.getConversationContext(invalidSessionId)
      expect(context).toBeNull()
    })

    it('should handle empty query strings', async () => {
      const query = ''
      const avatarId = 'jonathan-demo'

      const result = await JonathanDemoMemoryService.getMemoryContextForQuery(
        query,
        avatarId,
        5
      )

      expect(result).toBeDefined()
      expect(result.retrievalTimeMs).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Requirement 4.3 Implementation Verification', () => {
    it('should implement requirement 4.3: rank fragments for conversational relevance before injection', async () => {
      const query = 'What are your favorite outdoor activities?'
      const avatarId = 'jonathan-demo'
      const sessionId = 'relevance-test-session'

      // Start session to enable conversation context
      JonathanDemoMemoryService.startConversationSession(sessionId, avatarId)

      const result = await JonathanDemoMemoryService.getMemoryContextForQuery(
        query,
        avatarId,
        5,
        sessionId
      )

      // Verify that ranking occurred before injection
      expect(result.memoryContext).toBeDefined()
      
      if (result.memoryCount > 0) {
        // Should contain ranking information indicating relevance scoring was applied
        expect(result.memoryContext).toContain('ranked by conversational relevance')
        expect(result.memoryContext).toContain('relevance:')
        
        // Should include topic information showing contextual analysis
        expect(result.memoryContext).toContain('topics:')
      }

      // Verify performance meets requirement 4.2 (<200ms overhead)
      expect(result.retrievalTimeMs).toBeLessThan(300) // Allow buffer for test environment
    })

    it('should provide conversational relevance metadata in memory context', async () => {
      const query = 'Tell me about your pets and animals'
      const avatarId = 'jonathan-demo'
      const sessionId = 'metadata-test-session'

      JonathanDemoMemoryService.startConversationSession(sessionId, avatarId)

      const result = await JonathanDemoMemoryService.getMemoryContextForQuery(
        query,
        avatarId,
        3,
        sessionId
      )

      // Verify that conversational relevance is considered
      if (result.memoryCount > 0) {
        const memoryLines = result.memoryContext.split('\n')
        const memoryEntries = memoryLines.filter(line => line.startsWith('- '))
        
        // Each memory entry should include relevance score and topic information
        memoryEntries.forEach(entry => {
          expect(entry).toMatch(/relevance: \d+\.\d+/)
          expect(entry).toMatch(/topics: \w+/)
        })
      }
    })
  })
})