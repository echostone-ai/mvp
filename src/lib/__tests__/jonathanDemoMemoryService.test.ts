// src/lib/__tests__/jonathanDemoMemoryService.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { JonathanDemoMemoryService } from '../jonathanDemoMemoryService'
import { MemoryService } from '../memoryService'

// Mock the MemoryService
vi.mock('../memoryService', () => ({
  MemoryService: {
    getMemoriesForChat: vi.fn(),
    processAndStoreMemories: vi.fn(),
    Retrieval: {
      getUserMemories: vi.fn()
    }
  }
}))

describe('JonathanDemoMemoryService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock console methods to avoid noise in tests
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getMemoryContextForQuery', () => {
    it('should retrieve memory context within 200ms requirement', async () => {
      // Mock successful memory retrieval
      const mockMemoryContext = '\nRelevant memories about the user:\n- User loves hiking\n- User has a dog named Max\n'
      vi.mocked(MemoryService.getMemoriesForChat).mockResolvedValue(mockMemoryContext)

      const result = await JonathanDemoMemoryService.getMemoryContextForQuery(
        'Tell me about hiking',
        'jonathan-demo'
      )

      expect(result.memoryContext).toBe(mockMemoryContext)
      expect(result.retrievalTimeMs).toBeLessThan(200)
      expect(result.memoryCount).toBe(2) // Two memory fragments
      expect(MemoryService.getMemoriesForChat).toHaveBeenCalledWith(
        'Tell me about hiking',
        expect.any(String), // DEMO_SYSTEM_USER_ID
        6,
        'jonathan-demo'
      )
    })

    it('should handle memory retrieval failures gracefully', async () => {
      // Mock memory service failure
      vi.mocked(MemoryService.getMemoriesForChat).mockRejectedValue(new Error('Database error'))

      const result = await JonathanDemoMemoryService.getMemoryContextForQuery(
        'Tell me about hiking',
        'jonathan-demo'
      )

      expect(result.memoryContext).toBe('')
      expect(result.memoryCount).toBe(0)
      expect(result.retrievalTimeMs).toBeGreaterThanOrEqual(0)
    })

    it('should warn when retrieval exceeds 200ms', async () => {
      // Mock slow memory retrieval
      vi.mocked(MemoryService.getMemoriesForChat).mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 250))
        return 'Some memory context'
      })

      const consoleSpy = vi.spyOn(console, 'warn')
      
      await JonathanDemoMemoryService.getMemoryContextForQuery(
        'Tell me about hiking',
        'jonathan-demo'
      )

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[JonathanDemoMemory] Memory retrieval took')
      )
    })
  })

  describe('storeConversationTurnAsync', () => {
    it('should store conversation turn asynchronously', async () => {
      // Mock successful storage
      vi.mocked(MemoryService.processAndStoreMemories).mockResolvedValue([])

      // Call the async storage method
      await JonathanDemoMemoryService.storeConversationTurnAsync(
        'What is your favorite hobby?',
        'I love hiking with my dog Romeo!',
        'jonathan-demo',
        'test-conversation-123'
      )

      // Wait a bit for the async operation
      await new Promise(resolve => setTimeout(resolve, 10))

      expect(MemoryService.processAndStoreMemories).toHaveBeenCalledTimes(2)
      
      // Check user message storage
      expect(MemoryService.processAndStoreMemories).toHaveBeenCalledWith(
        'What is your favorite hobby?',
        expect.any(String), // DEMO_SYSTEM_USER_ID
        expect.objectContaining({
          source: 'jonathan-demo',
          conversationId: 'test-conversation-123',
          type: 'user_message'
        }),
        undefined,
        'jonathan-demo'
      )

      // Check assistant response storage
      expect(MemoryService.processAndStoreMemories).toHaveBeenCalledWith(
        'I love hiking with my dog Romeo!',
        expect.any(String), // DEMO_SYSTEM_USER_ID
        expect.objectContaining({
          source: 'jonathan-demo',
          conversationId: 'test-conversation-123',
          type: 'assistant_response'
        }),
        undefined,
        'jonathan-demo'
      )
    })

    it('should handle storage failures gracefully without throwing', async () => {
      // Mock storage failure
      vi.mocked(MemoryService.processAndStoreMemories).mockRejectedValue(new Error('Storage failed'))

      // This should not throw even if storage fails
      await expect(
        JonathanDemoMemoryService.storeConversationTurnAsync(
          'Test message',
          'Test response',
          'jonathan-demo',
          'test-conversation'
        )
      ).resolves.toBeUndefined()
    })
  })

  describe('getConversationContinuityContext', () => {
    it('should retrieve and format recent conversation context', async () => {
      // Mock recent memories
      const mockMemories = [
        {
          id: '1',
          userId: 'demo-user',
          fragmentText: 'What is your favorite color?',
          conversationContext: { type: 'user_message' },
          createdAt: new Date('2024-01-01T10:00:00Z'),
          updatedAt: new Date('2024-01-01T10:00:00Z')
        },
        {
          id: '2',
          userId: 'demo-user',
          fragmentText: 'My favorite color is blue, like the ocean!',
          conversationContext: { type: 'assistant_response' },
          createdAt: new Date('2024-01-01T10:01:00Z'),
          updatedAt: new Date('2024-01-01T10:01:00Z')
        }
      ]

      vi.mocked(MemoryService.Retrieval.getUserMemories).mockResolvedValue(mockMemories)

      const result = await JonathanDemoMemoryService.getConversationContinuityContext('jonathan-demo')

      expect(result).toContain('Recent conversation context:')
      expect(result).toContain('User said: What is your favorite color?')
      expect(result).toContain('Jonathan said: My favorite color is blue, like the ocean!')
      
      expect(MemoryService.Retrieval.getUserMemories).toHaveBeenCalledWith(
        expect.any(String), // DEMO_SYSTEM_USER_ID
        {
          limit: 3,
          orderBy: 'created_at',
          orderDirection: 'desc',
          avatarId: 'jonathan-demo'
        }
      )
    })

    it('should return empty string when no recent memories exist', async () => {
      vi.mocked(MemoryService.Retrieval.getUserMemories).mockResolvedValue([])

      const result = await JonathanDemoMemoryService.getConversationContinuityContext('jonathan-demo')

      expect(result).toBe('')
    })
  })

  describe('getComprehensiveMemoryContext', () => {
    it('should combine memory context and continuity context', async () => {
      // Mock memory context
      vi.mocked(MemoryService.getMemoriesForChat).mockResolvedValue(
        '\nRelevant memories about the user:\n- User loves hiking\n'
      )

      // Mock continuity context
      vi.mocked(MemoryService.Retrieval.getUserMemories).mockResolvedValue([
        {
          id: '1',
          userId: 'demo-user',
          fragmentText: 'Previous question about hobbies',
          conversationContext: { type: 'user_message' },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ])

      const result = await JonathanDemoMemoryService.getComprehensiveMemoryContext(
        'Tell me more about hiking',
        'jonathan-demo'
      )

      expect(result.memoryContext).toContain('User loves hiking')
      expect(result.continuityContext).toContain('Recent conversation context:')
      expect(result.memoryCount).toBe(1)
      expect(result.retrievalTimeMs).toBeGreaterThanOrEqual(0)
    })

    it('should handle failures gracefully and return empty contexts', async () => {
      // Mock failures
      vi.mocked(MemoryService.getMemoriesForChat).mockRejectedValue(new Error('Memory error'))
      vi.mocked(MemoryService.Retrieval.getUserMemories).mockRejectedValue(new Error('Continuity error'))

      const result = await JonathanDemoMemoryService.getComprehensiveMemoryContext(
        'Test query',
        'jonathan-demo'
      )

      expect(result.memoryContext).toBe('')
      expect(result.continuityContext).toBe('')
      expect(result.memoryCount).toBe(0)
      expect(result.retrievalTimeMs).toBeGreaterThanOrEqual(0)
    })
  })
})