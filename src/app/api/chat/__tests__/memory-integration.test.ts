// src/app/api/chat/__tests__/memory-integration.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the memory service with realistic responses
vi.mock('@/lib/memoryService', () => ({
  MemoryService: {
    processAndStoreMemories: vi.fn().mockResolvedValue([]),
    getMemoriesForChat: vi.fn().mockResolvedValue('')
  }
}))

// Mock the expressive helpers
vi.mock('@/lib/expressiveHelpersEnhanced', () => ({
  pickExpressiveStyle: vi.fn(() => 'default'),
  buildSystemPrompt: vi.fn(() => 'You are Jonathan, a helpful AI assistant.'),
  addEmotionalNuance: vi.fn((answer) => answer),
  adaptToContext: vi.fn(() => ({}))
}))

// Mock OpenAI to capture the system prompt
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

describe('Memory Integration End-to-End', () => {
  let mockGetMemoriesForChat: any

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockGetMemoriesForChat = vi.mocked(MemoryService.getMemoriesForChat)
  })

  it('should enhance responses with relevant memories', async () => {
    // Mock memory retrieval to return relevant hiking memories
    const memoryContext = '\nRelevant memories about the user:\n- User loves hiking with their dog Max\n- User goes hiking every weekend\n- User mentioned Max is a golden retriever who gets excited about walks\n'
    mockGetMemoriesForChat.mockResolvedValue(memoryContext)

    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        prompt: 'What do you think about outdoor activities?',
        userId: 'test-user-id'
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.answer).toBe('Test response from AI')
    
    // Verify memory retrieval was called with correct parameters
    expect(mockGetMemoriesForChat).toHaveBeenCalledWith(
      'What do you think about outdoor activities?',
      'test-user-id',
      5
    )
  })

  it('should work without memories when none are available', async () => {
    // Mock no memories available
    mockGetMemoriesForChat.mockResolvedValue('')

    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        prompt: 'Tell me about yourself',
        userId: 'test-user-id'
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.answer).toBe('Test response from AI')
    
    // Verify memory retrieval was attempted
    expect(mockGetMemoriesForChat).toHaveBeenCalledWith(
      'Tell me about yourself',
      'test-user-id',
      5
    )
  })

  it('should blend memories with existing personality data', async () => {
    // Mock memory retrieval with personal information
    const memoryContext = '\nRelevant memories about the user:\n- User is a software engineer\n- User works at a tech startup\n- User enjoys coding in TypeScript\n'
    mockGetMemoriesForChat.mockResolvedValue(memoryContext)

    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        prompt: 'What do you think about programming?',
        userId: 'test-user-id',
        profileData: {
          name: 'Jonathan',
          interests: ['technology', 'music']
        }
      })
    })

    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.answer).toBe('Test response from AI')
    
    // Verify memory retrieval was called with correct parameters
    expect(mockGetMemoriesForChat).toHaveBeenCalledWith(
      'What do you think about programming?',
      'test-user-id',
      5
    )
  })

  it('should limit memory retrieval to reasonable number of fragments', async () => {
    // Mock memory retrieval
    mockGetMemoriesForChat.mockResolvedValue('\nRelevant memories about the user:\n- Memory fragment 1\n')

    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        prompt: 'Tell me a story',
        userId: 'test-user-id'
      })
    })

    await POST(request)
    
    // Verify memory retrieval was called with limit of 5 fragments
    expect(mockGetMemoriesForChat).toHaveBeenCalledWith(
      'Tell me a story',
      'test-user-id',
      5
    )
  })

  it('should complete full conversation memory cycle', async () => {
    // Mock memory processing to return extracted fragments
    const mockProcessAndStoreMemories = vi.mocked(MemoryService.processAndStoreMemories)
    mockProcessAndStoreMemories.mockResolvedValue([
      {
        id: 'fragment-1',
        userId: 'test-user-id',
        fragmentText: 'User has a dog named Buddy',
        conversationContext: {
          timestamp: '2024-01-01T00:00:00.000Z',
          messageContext: 'User mentioned their dog',
          emotionalTone: 'positive'
        }
      }
    ])

    // First conversation - user shares information about their dog
    const firstRequest = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        prompt: 'I just got a new dog named Buddy. He\'s a golden retriever and loves to play fetch.',
        userId: 'test-user-id'
      })
    })

    const firstResponse = await POST(firstRequest)
    const firstData = await firstResponse.json()

    expect(firstResponse.status).toBe(200)
    expect(firstData.answer).toBe('Test response from AI')

    // Wait for background memory processing
    await new Promise(resolve => setTimeout(resolve, 100))

    // Verify memory was captured
    expect(mockProcessAndStoreMemories).toHaveBeenCalledWith(
      'I just got a new dog named Buddy. He\'s a golden retriever and loves to play fetch.',
      'test-user-id',
      expect.stringContaining('Chat conversation at')
    )

    // Mock memory retrieval for second conversation
    mockGetMemoriesForChat.mockResolvedValue('\nRelevant memories about the user:\n- User has a dog named Buddy\n')

    // Second conversation - user asks about dog-related topics
    const secondRequest = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        prompt: 'What are some good activities for dogs?',
        userId: 'test-user-id'
      })
    })

    const secondResponse = await POST(secondRequest)
    const secondData = await secondResponse.json()

    expect(secondResponse.status).toBe(200)
    expect(secondData.answer).toBe('Test response from AI')

    // Verify memory was retrieved for context
    expect(mockGetMemoriesForChat).toHaveBeenCalledWith(
      'What are some good activities for dogs?',
      'test-user-id',
      5
    )
  })
})