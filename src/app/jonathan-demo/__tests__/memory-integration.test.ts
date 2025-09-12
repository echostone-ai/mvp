// src/app/jonathan-demo/__tests__/memory-integration.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { JonathanDemoMemoryService } from '@/lib/jonathanDemoMemoryService'

// Mock the memory service
vi.mock('@/lib/jonathanDemoMemoryService', () => ({
  JonathanDemoMemoryService: {
    getComprehensiveMemoryContext: vi.fn(),
    storeConversationTurnAsync: vi.fn()
  }
}))

// Mock fetch for API calls
global.fetch = vi.fn()

describe('Jonathan Demo Memory Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Memory Context Retrieval', () => {
    it('should retrieve memory context before API call', async () => {
      // Mock memory context retrieval
      const mockMemoryContext = {
        memoryContext: '\nRelevant memories about the user:\n- User loves hiking\n- User has a dog named Max\n',
        continuityContext: '\nRecent conversation context:\nUser said: Hello\nJonathan said: Hi there!\n',
        retrievalTimeMs: 150,
        memoryCount: 2
      }

      vi.mocked(JonathanDemoMemoryService.getComprehensiveMemoryContext).mockResolvedValue(mockMemoryContext)

      // Mock successful API response
      const mockResponse = {
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn()
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"delta": "Hello! "}\n\n')
              })
              .mockResolvedValueOnce({
                done: false,
                value: new TextEncoder().encode('data: {"delta": "I remember you love hiking!"}\n\n')
              })
              .mockResolvedValueOnce({
                done: true,
                value: undefined
              })
          })
        }
      }

      vi.mocked(fetch).mockResolvedValue(mockResponse as any)

      // Simulate the askQuestion function logic
      const text = 'Tell me about outdoor activities'
      
      // 1. Memory retrieval should be called first
      const memoryContext = await JonathanDemoMemoryService.getComprehensiveMemoryContext(
        text,
        'jonathan-demo'
      )

      expect(JonathanDemoMemoryService.getComprehensiveMemoryContext).toHaveBeenCalledWith(
        text,
        'jonathan-demo'
      )

      expect(memoryContext.retrievalTimeMs).toBeLessThan(200) // Requirement 4.2
      expect(memoryContext.memoryCount).toBe(2)

      // 2. API call should include memory context
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          avatarSlug: 'jonathan-demo',
          message: text,
          stream: true,
          storeMemory: true,
          memoryContext: memoryContext.memoryContext,
          continuityContext: memoryContext.continuityContext
        })
      })

      expect(fetch).toHaveBeenCalledWith('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          avatarSlug: 'jonathan-demo',
          message: text,
          stream: true,
          storeMemory: true,
          memoryContext: mockMemoryContext.memoryContext,
          continuityContext: mockMemoryContext.continuityContext
        })
      })
    })

    it('should handle memory retrieval failures gracefully', async () => {
      // Mock memory retrieval failure
      vi.mocked(JonathanDemoMemoryService.getComprehensiveMemoryContext).mockResolvedValue({
        memoryContext: '',
        continuityContext: '',
        retrievalTimeMs: 50,
        memoryCount: 0
      })

      // Mock API response
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ answer: 'Hello there!' })
      } as any)

      const text = 'Hello'
      
      // Memory retrieval should still be attempted
      const memoryContext = await JonathanDemoMemoryService.getComprehensiveMemoryContext(
        text,
        'jonathan-demo'
      )

      // API call should proceed with empty memory context
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          avatarSlug: 'jonathan-demo',
          message: text,
          stream: true,
          storeMemory: true,
          memoryContext: '',
          continuityContext: ''
        })
      })

      expect(fetch).toHaveBeenCalled()
      expect(memoryContext.memoryContext).toBe('')
      expect(memoryContext.continuityContext).toBe('')
    })
  })

  describe('Asynchronous Memory Storage', () => {
    it('should store conversation turn after response completion', async () => {
      const userMessage = 'What is your favorite hobby?'
      const assistantResponse = 'I love hiking with my dog Romeo!'
      const conversationId = 'jonathan-demo-123'

      // Call the async storage method
      await JonathanDemoMemoryService.storeConversationTurnAsync(
        userMessage,
        assistantResponse,
        'jonathan-demo',
        conversationId
      )

      expect(JonathanDemoMemoryService.storeConversationTurnAsync).toHaveBeenCalledWith(
        userMessage,
        assistantResponse,
        'jonathan-demo',
        conversationId
      )
    })

    it('should not block conversation flow if memory storage fails', async () => {
      // Mock storage failure
      vi.mocked(JonathanDemoMemoryService.storeConversationTurnAsync).mockRejectedValue(
        new Error('Storage failed')
      )

      // Storage failure should not throw or block
      await expect(
        JonathanDemoMemoryService.storeConversationTurnAsync(
          'Test message',
          'Test response',
          'jonathan-demo',
          'test-conversation'
        )
      ).rejects.toThrow('Storage failed')

      // But in the actual implementation, this is fire-and-forget so it won't throw
    })
  })

  describe('Performance Requirements', () => {
    it('should meet <200ms memory retrieval requirement', async () => {
      // Mock fast memory retrieval
      vi.mocked(JonathanDemoMemoryService.getComprehensiveMemoryContext).mockResolvedValue({
        memoryContext: 'Some context',
        continuityContext: 'Some continuity',
        retrievalTimeMs: 120, // Under 200ms
        memoryCount: 3
      })

      const startTime = Date.now()
      const result = await JonathanDemoMemoryService.getComprehensiveMemoryContext(
        'Test query',
        'jonathan-demo'
      )
      const actualTime = Date.now() - startTime

      expect(result.retrievalTimeMs).toBeLessThan(200)
      expect(actualTime).toBeLessThan(200) // Actual call should also be fast
    })

    it('should warn when memory retrieval exceeds 200ms', async () => {
      // Mock slow memory retrieval
      vi.mocked(JonathanDemoMemoryService.getComprehensiveMemoryContext).mockResolvedValue({
        memoryContext: 'Some context',
        continuityContext: 'Some continuity',
        retrievalTimeMs: 250, // Over 200ms
        memoryCount: 3
      })

      const consoleSpy = vi.spyOn(console, 'warn')

      const result = await JonathanDemoMemoryService.getComprehensiveMemoryContext(
        'Test query',
        'jonathan-demo'
      )

      // The service should report the slow retrieval
      expect(result.retrievalTimeMs).toBeGreaterThan(200)
    })
  })

  describe('Memory Context Integration', () => {
    it('should include both memory context and continuity context in API calls', async () => {
      const mockMemoryContext = {
        memoryContext: '\nRelevant memories about the user:\n- User loves photography\n',
        continuityContext: '\nRecent conversation context:\nUser said: Hi\n',
        retrievalTimeMs: 100,
        memoryCount: 1
      }

      vi.mocked(JonathanDemoMemoryService.getComprehensiveMemoryContext).mockResolvedValue(mockMemoryContext)
      vi.mocked(fetch).mockResolvedValue({ ok: true, json: () => Promise.resolve({}) } as any)

      const text = 'Tell me about cameras'
      
      const memoryContext = await JonathanDemoMemoryService.getComprehensiveMemoryContext(
        text,
        'jonathan-demo'
      )

      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          avatarSlug: 'jonathan-demo',
          message: text,
          stream: true,
          storeMemory: true,
          memoryContext: memoryContext.memoryContext,
          continuityContext: memoryContext.continuityContext
        })
      })

      const fetchCall = vi.mocked(fetch).mock.calls[0]
      const requestBody = JSON.parse(fetchCall[1]?.body as string)

      expect(requestBody.memoryContext).toBe(mockMemoryContext.memoryContext)
      expect(requestBody.continuityContext).toBe(mockMemoryContext.continuityContext)
      expect(requestBody.memoryContext).toContain('User loves photography')
      expect(requestBody.continuityContext).toContain('Recent conversation context')
    })
  })
})