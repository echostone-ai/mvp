// src/app/api/chat/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the memory service
vi.mock('@/lib/memoryService', () => ({
  MemoryService: {
    processAndStoreMemories: vi.fn().mockResolvedValue([]),
    getMemoriesForChat: vi.fn().mockResolvedValue('')
  }
}))

// Mock the expressive helpers
vi.mock('@/lib/expressiveHelpersEnhanced', () => ({
  pickExpressiveStyle: vi.fn(() => 'default'),
  buildSystemPrompt: vi.fn(() => 'Test system prompt'),
  addEmotionalNuance: vi.fn((answer) => answer),
  adaptToContext: vi.fn(() => ({}))
}))

// Mock OpenAI
vi.mock('openai', () => ({
  OpenAI: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{
            message: {
              content: 'Test response from AI'
            }
          }]
        })
      }
    }
  }))
}))

// Import after mocking
import { POST } from '../route'
import { MemoryService } from '@/lib/memoryService'

describe('/api/chat', () => {
  let mockProcessAndStoreMemories: any
  let mockGetMemoriesForChat: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Get references to mocked functions
    mockProcessAndStoreMemories = vi.mocked(MemoryService.processAndStoreMemories)
    mockGetMemoriesForChat = vi.mocked(MemoryService.getMemoriesForChat)
    
    // Setup default mock response for memory processing
    mockProcessAndStoreMemories.mockResolvedValue([
      {
        id: 'test-fragment-1',
        userId: 'test-user-id',
        fragmentText: 'User loves hiking',
        conversationContext: {
          timestamp: '2024-01-01T00:00:00.000Z',
          messageContext: 'Test conversation context',
          emotionalTone: 'positive'
        }
      }
    ])

    // Setup default mock response for memory retrieval
    mockGetMemoriesForChat.mockResolvedValue('')
  })

  describe('Memory Integration', () => {
    it('should capture memories in background when userId is provided', async () => {
      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'I love hiking with my dog Max every weekend',
          userId: 'test-user-id'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      // Response should be returned immediately
      expect(response.status).toBe(200)
      expect(data.answer).toBe('Test response from AI')

      // Wait a bit for background processing
      await new Promise(resolve => setTimeout(resolve, 100))

      // Memory processing should have been called
      expect(mockProcessAndStoreMemories).toHaveBeenCalledWith(
        'I love hiking with my dog Max every weekend',
        'test-user-id',
        expect.stringContaining('Chat conversation at')
      )
    })

    it('should not capture memories when userId is not provided', async () => {
      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'I love hiking with my dog Max every weekend'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.answer).toBe('Test response from AI')

      // Memory processing should not have been called
      expect(mockProcessAndStoreMemories).not.toHaveBeenCalled()
    })

    it('should handle memory processing failures gracefully', async () => {
      // Mock memory service to throw an error
      mockProcessAndStoreMemories.mockRejectedValue(
        new Error('Memory processing failed')
      )

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'I love hiking with my dog Max every weekend',
          userId: 'test-user-id'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      // Response should still be successful
      expect(response.status).toBe(200)
      expect(data.answer).toBe('Test response from AI')

      // Wait for background processing to complete
      await new Promise(resolve => setTimeout(resolve, 100))

      // Error should be logged but not affect response
      expect(consoleSpy).toHaveBeenCalledWith(
        'Background memory processing failed for user',
        'test-user-id',
        ':',
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })

    it('should validate userId format', async () => {
      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Test message',
          userId: 123 // Invalid format
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.answer).toBe('Invalid userId format.')
    })

    it('should log successful memory storage', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'I love hiking with my dog Max every weekend',
          userId: 'test-user-id'
        })
      })

      await POST(request)

      // Wait for background processing
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(consoleSpy).toHaveBeenCalledWith(
        'Successfully stored 1 memory fragments for user test-user-id'
      )

      consoleSpy.mockRestore()
    })

    it('should not log when no memories are extracted', async () => {
      // Mock no memories extracted
      mockProcessAndStoreMemories.mockResolvedValue([])

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Hello',
          userId: 'test-user-id'
        })
      })

      await POST(request)

      // Wait for background processing
      await new Promise(resolve => setTimeout(resolve, 100))

      // Should not log success message when no fragments stored
      expect(consoleSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Stored')
      )

      consoleSpy.mockRestore()
    })

    it('should retrieve relevant memories when userId is provided', async () => {
      // Mock memory retrieval to return relevant memories
      mockGetMemoriesForChat.mockResolvedValue('\nRelevant memories about the user:\n- User loves hiking with their dog Max\n- User goes hiking every weekend\n')

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Tell me about outdoor activities',
          userId: 'test-user-id'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.answer).toBe('Test response from AI')

      // Memory retrieval should have been called
      expect(mockGetMemoriesForChat).toHaveBeenCalledWith(
        'Tell me about outdoor activities',
        'test-user-id',
        5
      )
    })

    it('should not retrieve memories when userId is not provided', async () => {
      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Tell me about outdoor activities'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.answer).toBe('Test response from AI')

      // Memory retrieval should not have been called
      expect(mockGetMemoriesForChat).not.toHaveBeenCalled()
    })

    it('should handle memory retrieval failures gracefully', async () => {
      // Mock memory retrieval to throw an error
      mockGetMemoriesForChat.mockRejectedValue(new Error('Memory retrieval failed'))

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Tell me about outdoor activities',
          userId: 'test-user-id'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      // Response should still be successful
      expect(response.status).toBe(200)
      expect(data.answer).toBe('Test response from AI')

      // Error should be logged but not affect response
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to retrieve memories for chat:',
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })

    it('should integrate memories into system prompt when available', async () => {
      // Mock memory retrieval to return relevant memories
      const memoryContext = '\nRelevant memories about the user:\n- User loves hiking with their dog Max\n- User goes hiking every weekend\n'
      mockGetMemoriesForChat.mockResolvedValue(memoryContext)

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Tell me about outdoor activities',
          userId: 'test-user-id'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.answer).toBe('Test response from AI')

      // Memory retrieval should have been called
      expect(mockGetMemoriesForChat).toHaveBeenCalledWith(
        'Tell me about outdoor activities',
        'test-user-id',
        5
      )
    })

    it('should pass correct conversation context to memory processing', async () => {
      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'I just adopted a new puppy named Luna',
          userId: 'test-user-id'
        })
      })

      await POST(request)

      // Wait for background processing
      await new Promise(resolve => setTimeout(resolve, 100))

      // Verify the conversation context includes timestamp
      expect(mockProcessAndStoreMemories).toHaveBeenCalledWith(
        'I just adopted a new puppy named Luna',
        'test-user-id',
        expect.stringMatching(/^Chat conversation at \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      )
    })

    it('should handle concurrent memory operations without blocking responses', async () => {
      // Create multiple concurrent requests
      const requests = Array.from({ length: 3 }, (_, i) => 
        new NextRequest('http://localhost:3000/api/chat', {
          method: 'POST',
          body: JSON.stringify({
            prompt: `Message ${i + 1}: I love spending time with my family`,
            userId: `test-user-${i + 1}`
          })
        })
      )

      // Execute all requests concurrently
      const responses = await Promise.all(requests.map(req => POST(req)))
      const data = await Promise.all(responses.map(res => res.json()))

      // All responses should be successful
      responses.forEach(response => {
        expect(response.status).toBe(200)
      })

      data.forEach(responseData => {
        expect(responseData.answer).toBe('Test response from AI')
      })

      // Wait for all background processing to complete
      await new Promise(resolve => setTimeout(resolve, 200))

      // All memory processing calls should have been made
      expect(mockProcessAndStoreMemories).toHaveBeenCalledTimes(3)
    })
  })

  describe('Existing Functionality', () => {
    it('should handle missing prompt', async () => {
      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({})
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.answer).toBe('Missing prompt.')
    })

    it('should process request with all parameters', async () => {
      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Test message',
          voiceId: 'test-voice-id',
          systemPrompt: 'Custom system prompt',
          profileData: { name: 'Test User' },
          userId: 'test-user-id'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.answer).toBe('Test response from AI')
      expect(data.voiceId).toBe('test-voice-id')
    })
  })

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          prompt: 'Test message'
        })
      })

      const response = await POST(request)
      const data = await response.json()

      // Should return a response (mocked OpenAI will return success)
      expect(response.status).toBe(200)
      expect(data.answer).toBe('Test response from AI')
    })
  })
})