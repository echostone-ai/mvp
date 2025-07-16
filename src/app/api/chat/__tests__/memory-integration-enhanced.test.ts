// src/app/api/chat/__tests__/memory-integration-enhanced.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { POST } from '../route'
import { NextRequest } from 'next/server'

// Mock the memory service
const mockMemoryService = {
  processAndStoreMemories: vi.fn(),
  getEnhancedMemoryContext: vi.fn(),
  getMemoriesForChat: vi.fn()
}

vi.mock('../../../lib/memoryService', () => ({
  MemoryService: mockMemoryService
}))

// Mock Supabase
const mockSupabase = {
  auth: {
    getUser: vi.fn()
  }
}

vi.mock('../../../lib/supabase', () => ({
  supabase: mockSupabase
}))

// Mock OpenAI
const mockOpenAI = {
  chat: {
    completions: {
      create: vi.fn()
    }
  }
}

vi.mock('openai', () => ({
  OpenAI: vi.fn(() => mockOpenAI)
}))

describe('Enhanced Chat API Memory Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Default auth mock
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'test-user-123' } },
      error: null
    })
    
    // Default memory service mocks
    mockMemoryService.processAndStoreMemories.mockResolvedValue([])
    mockMemoryService.getEnhancedMemoryContext.mockResolvedValue({
      memories: [],
      contextPrompt: '',
      personalityEnhancements: []
    })
    mockMemoryService.getMemoriesForChat.mockResolvedValue('')
    
    // Default OpenAI mock
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [{
        message: {
          content: 'Hello! How can I help you today?'
        }
      }]
    })
  })

  describe('Memory-Enhanced Chat Flow', () => {
    it('should integrate memory capture and retrieval in complete chat flow', async () => {
      const userId = 'test-user-123'
      
      // Mock memory retrieval for context
      mockMemoryService.getEnhancedMemoryContext.mockResolvedValueOnce({
        memories: [
          {
            id: 'mem-1',
            userId,
            fragmentText: 'User loves hiking',
            similarity: 0.9
          }
        ],
        contextPrompt: '\n\nRELEVANT PERSONAL CONTEXT:\nBased on our previous conversations:\n- User loves hiking\n\nUse this context naturally in your response.',
        personalityEnhancements: ['shared_interests']
      })
      
      // Mock memory storage after processing
      mockMemoryService.processAndStoreMemories.mockResolvedValueOnce([
        {
          id: 'new-mem-1',
          userId,
          fragmentText: 'User is planning a weekend hiking trip',
          conversationContext: {
            timestamp: new Date().toISOString(),
            messageContext: 'User discussing weekend plans',
            emotionalTone: 'positive'
          }
        }
      ])
      
      // Mock enhanced OpenAI response that uses memory context
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'That sounds like a great hiking plan! Since you love hiking, I bet you\'re excited about exploring new trails this weekend. Have you picked a specific location yet?'
          }
        }]
      })
      
      // Create request
      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          prompt: 'I\'m planning a hiking trip this weekend',
          includeMemories: true,
          profileData: {
            name: 'Test User',
            hobbies: ['hiking', 'photography']
          }
        })
      })
      
      const response = await POST(request)
      const responseData = await response.json()
      
      // Verify memory retrieval was called
      expect(mockMemoryService.getEnhancedMemoryContext).toHaveBeenCalledWith(
        'I\'m planning a hiking trip this weekend',
        userId,
        expect.objectContaining({
          name: 'Test User',
          hobbies: ['hiking', 'photography']
        }),
        5
      )
      
      // Verify OpenAI was called with memory context
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: 'system',
              content: expect.stringContaining('User loves hiking')
            })
          ])
        })
      )
      
      // Verify memory storage was called
      expect(mockMemoryService.processAndStoreMemories).toHaveBeenCalledWith(
        'I\'m planning a hiking trip this weekend',
        userId,
        expect.any(String)
      )
      
      // Verify response
      expect(response.status).toBe(200)
      expect(responseData.answer).toContain('hiking')
      expect(responseData.memoriesUsed).toHaveLength(1)
    })

    it('should handle memory-enhanced conversations with emotional context', async () => {
      const userId = 'emotional-test-user'
      
      // Mock memories with emotional context
      mockMemoryService.getEnhancedMemoryContext.mockResolvedValueOnce({
        memories: [
          {
            id: 'emotional-mem-1',
            userId,
            fragmentText: 'User recently lost their job and is feeling stressed',
            conversationContext: {
              emotionalTone: 'negative',
              timestamp: new Date().toISOString()
            },
            similarity: 0.85
          }
        ],
        contextPrompt: '\n\nRELEVANT PERSONAL CONTEXT:\nBased on our previous conversations:\n- User recently lost their job and is feeling stressed\n\nThis user has shared personal challenges with you. Be supportive and understanding in your response.',
        personalityEnhancements: ['supportive_context', 'emotional_connection']
      })
      
      // Mock supportive response
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'I understand this is a challenging time for you. It\'s completely normal to feel overwhelmed when dealing with job loss. Remember that this is temporary, and you have the strength to get through this. Would you like to talk about what steps you\'re taking or how you\'re coping?'
          }
        }]
      })
      
      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          prompt: 'I\'m feeling really anxious about my future',
          includeMemories: true
        })
      })
      
      // Update auth mock for this user
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: userId } },
        error: null
      })
      
      const response = await POST(request)
      const responseData = await response.json()
      
      // Verify emotional context was used
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('supportive and understanding')
            })
          ])
        })
      )
      
      expect(responseData.answer).toContain('understand')
      expect(responseData.answer).toContain('challenging')
    })

    it('should handle conversations without relevant memories gracefully', async () => {
      const userId = 'no-memories-user'
      
      // Mock no relevant memories found
      mockMemoryService.getEnhancedMemoryContext.mockResolvedValueOnce({
        memories: [],
        contextPrompt: '',
        personalityEnhancements: []
      })
      
      // Mock standard response without memory context
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'Hello! I\'d be happy to help you with that. What specific information are you looking for?'
          }
        }]
      })
      
      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          prompt: 'What is the weather like?',
          includeMemories: true
        })
      })
      
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: userId } },
        error: null
      })
      
      const response = await POST(request)
      const responseData = await response.json()
      
      // Should still work without memories
      expect(response.status).toBe(200)
      expect(responseData.answer).toBeTruthy()
      expect(responseData.memoriesUsed).toEqual([])
      
      // Should still attempt to store new memories
      expect(mockMemoryService.processAndStoreMemories).toHaveBeenCalled()
    })
  })

  describe('Memory System Error Handling in Chat', () => {
    it('should continue chat flow when memory extraction fails', async () => {
      const userId = 'extraction-error-user'
      
      // Mock memory extraction failure
      mockMemoryService.processAndStoreMemories.mockRejectedValueOnce(
        new Error('Memory extraction service unavailable')
      )
      
      // Mock successful memory retrieval
      mockMemoryService.getEnhancedMemoryContext.mockResolvedValueOnce({
        memories: [],
        contextPrompt: '',
        personalityEnhancements: []
      })
      
      // Mock normal chat response
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'I can help you with that! What would you like to know?'
          }
        }]
      })
      
      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          prompt: 'Tell me about machine learning',
          includeMemories: true
        })
      })
      
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: userId } },
        error: null
      })
      
      const response = await POST(request)
      const responseData = await response.json()
      
      // Chat should continue normally despite memory extraction failure
      expect(response.status).toBe(200)
      expect(responseData.answer).toBeTruthy()
      expect(responseData.memoriesUsed).toEqual([])
    })

    it('should continue chat flow when memory retrieval fails', async () => {
      const userId = 'retrieval-error-user'
      
      // Mock memory retrieval failure
      mockMemoryService.getEnhancedMemoryContext.mockRejectedValueOnce(
        new Error('Memory retrieval service unavailable')
      )
      
      // Mock successful memory storage
      mockMemoryService.processAndStoreMemories.mockResolvedValueOnce([])
      
      // Mock normal chat response
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'I\'m here to help! What can I assist you with today?'
          }
        }]
      })
      
      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          prompt: 'How are you doing today?',
          includeMemories: true
        })
      })
      
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: userId } },
        error: null
      })
      
      const response = await POST(request)
      const responseData = await response.json()
      
      // Chat should continue normally despite memory retrieval failure
      expect(response.status).toBe(200)
      expect(responseData.answer).toBeTruthy()
      expect(responseData.memoriesUsed).toEqual([])
    })
  })

  describe('Memory-Driven Personality Enhancement', () => {
    it('should adapt personality based on user relationship history', async () => {
      const userId = 'personality-test-user'
      
      // Mock memories indicating close relationship
      mockMemoryService.getEnhancedMemoryContext.mockResolvedValueOnce({
        memories: [
          {
            id: 'relationship-1',
            userId,
            fragmentText: 'User shared that their grandmother passed away last month',
            conversationContext: { emotionalTone: 'sad' },
            similarity: 0.88
          },
          {
            id: 'relationship-2', 
            userId,
            fragmentText: 'User mentioned feeling lonely since moving to new city',
            conversationContext: { emotionalTone: 'negative' },
            similarity: 0.82
          }
        ],
        contextPrompt: '\n\nRELEVANT PERSONAL CONTEXT:\nBased on our previous conversations:\n- User shared that their grandmother passed away last month\n- User mentioned feeling lonely since moving to new city\n\nThis user has shared emotional moments with you. Respond with appropriate emotional intelligence and empathy.\nThis user has shared personal challenges with you. Be supportive and understanding in your response.',
        personalityEnhancements: ['emotional_connection', 'supportive_context']
      })
      
      // Mock empathetic response
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'I can hear that you\'re going through a lot right now. Moving to a new place while grieving is incredibly difficult. It\'s okay to feel overwhelmed. Have you been able to find any small moments of comfort or connection in your new city? Sometimes even tiny steps can help when everything feels heavy.'
          }
        }]
      })
      
      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          prompt: 'I\'ve been having a really hard time lately',
          includeMemories: true,
          profileData: {
            personality: 'empathetic',
            communicationStyle: 'supportive'
          }
        })
      })
      
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: userId } },
        error: null
      })
      
      const response = await POST(request)
      const responseData = await response.json()
      
      // Verify personality enhancement was applied
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('emotional intelligence and empathy')
            })
          ])
        })
      )
      
      expect(responseData.answer).toContain('understand')
      expect(responseData.memoriesUsed).toHaveLength(2)
    })

    it('should enhance responses based on shared interests', async () => {
      const userId = 'interests-test-user'
      
      // Mock memories with shared interests
      mockMemoryService.getEnhancedMemoryContext.mockResolvedValueOnce({
        memories: [
          {
            id: 'interest-1',
            userId,
            fragmentText: 'User loves photography and takes nature photos',
            similarity: 0.91
          },
          {
            id: 'interest-2',
            userId, 
            fragmentText: 'User recently bought a new camera lens',
            similarity: 0.87
          }
        ],
        contextPrompt: '\n\nRELEVANT PERSONAL CONTEXT:\nBased on our previous conversations:\n- User loves photography and takes nature photos\n- User recently bought a new camera lens\n\nYou and this user have discussed shared interests. Reference these connections naturally when relevant.',
        personalityEnhancements: ['shared_interests']
      })
      
      // Mock photography-aware response
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'That\'s exciting! With your new lens, you\'ll probably be able to capture some amazing nature shots. Have you had a chance to test it out on any interesting subjects yet? I bet you\'re seeing the world through a whole new perspective with that upgrade!'
          }
        }]
      })
      
      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          prompt: 'I\'m excited to try out some new equipment I got',
          includeMemories: true,
          profileData: {
            hobbies: ['photography', 'hiking']
          }
        })
      })
      
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: userId } },
        error: null
      })
      
      const response = await POST(request)
      const responseData = await response.json()
      
      expect(responseData.answer).toContain('lens')
      expect(responseData.answer).toContain('photography')
      expect(responseData.memoriesUsed).toHaveLength(2)
    })
  })

  describe('Long-term Memory Consistency', () => {
    it('should maintain consistent memory references across multiple chat sessions', async () => {
      const userId = 'consistency-test-user'
      
      // Session 1: Initial conversation
      mockMemoryService.getEnhancedMemoryContext.mockResolvedValueOnce({
        memories: [],
        contextPrompt: '',
        personalityEnhancements: []
      })
      
      mockMemoryService.processAndStoreMemories.mockResolvedValueOnce([
        {
          id: 'consistency-1',
          userId,
          fragmentText: 'User is training for a marathon',
          conversationContext: {
            timestamp: new Date().toISOString(),
            emotionalTone: 'positive'
          }
        }
      ])
      
      const session1Request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          prompt: 'I\'m training for my first marathon and it\'s really challenging',
          includeMemories: true
        })
      })
      
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: userId } },
        error: null
      })
      
      await POST(session1Request)
      
      // Session 2: Follow-up conversation should reference previous memory
      mockMemoryService.getEnhancedMemoryContext.mockResolvedValueOnce({
        memories: [
          {
            id: 'consistency-1',
            userId,
            fragmentText: 'User is training for a marathon',
            similarity: 0.93
          }
        ],
        contextPrompt: '\n\nRELEVANT PERSONAL CONTEXT:\nBased on our previous conversations:\n- User is training for a marathon\n\nUse this context naturally in your response.',
        personalityEnhancements: ['shared_interests']
      })
      
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: 'How\'s your marathon training going? I remember you mentioned it was challenging. Have you been able to stick to your training schedule?'
          }
        }]
      })
      
      const session2Request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token'
        },
        body: JSON.stringify({
          prompt: 'I need some motivation for my running',
          includeMemories: true
        })
      })
      
      const session2Response = await POST(session2Request)
      const session2Data = await session2Response.json()
      
      // Should reference previous marathon training
      expect(session2Data.answer).toContain('marathon')
      expect(session2Data.answer).toContain('training')
      expect(session2Data.memoriesUsed).toHaveLength(1)
    })
  })
})