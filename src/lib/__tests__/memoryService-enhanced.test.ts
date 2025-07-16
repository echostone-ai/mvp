// src/lib/__tests__/memoryService-enhanced.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { MemoryService, MemoryFragment } from '../memoryService'

// Mock OpenAI
vi.mock('openai', () => ({
  OpenAI: vi.fn().mockImplementation(() => ({
    embeddings: {
      create: vi.fn().mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.1) }]
      })
    }
  }))
}))

// Mock Supabase
vi.mock('../supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn()
  }
}))

describe('Enhanced Memory Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getEnhancedMemoryContext', () => {
    it('should return enhanced memory context with personality analysis', async () => {
      const mockMemories: MemoryFragment[] = [
        {
          id: '1',
          userId: 'user123',
          fragmentText: 'User loves hiking and does it every weekend',
          conversationContext: {
            timestamp: '2024-01-01T00:00:00Z',
            messageContext: 'User mentioned hiking',
            emotionalTone: 'positive'
          }
        },
        {
          id: '2',
          userId: 'user123',
          fragmentText: 'User is worried about their relationship with their partner',
          conversationContext: {
            timestamp: '2024-01-01T00:00:00Z',
            messageContext: 'User shared concerns',
            emotionalTone: 'anxious'
          }
        }
      ]

      const profileData = {
        hobbies: ['hiking', 'photography'],
        name: 'Test User'
      }

      // Mock the retrieval service
      vi.spyOn(MemoryService.Retrieval, 'retrieveRelevantMemories').mockResolvedValue(mockMemories)

      const result = await MemoryService.getEnhancedMemoryContext(
        'Tell me about outdoor activities',
        'user123',
        profileData,
        5
      )

      expect(result.memories).toHaveLength(2)
      expect(result.personalityEnhancements).toContain('emotional_connection')
      expect(result.personalityEnhancements).toContain('shared_interests')
      expect(result.personalityEnhancements).toContain('relationship_context')
      expect(result.contextPrompt).toContain('RELEVANT PERSONAL CONTEXT')
      expect(result.contextPrompt).toContain('shared interests')
      expect(result.contextPrompt).toContain('important relationships')
    })

    it('should handle empty memory results', async () => {
      vi.spyOn(MemoryService.Retrieval, 'retrieveRelevantMemories').mockResolvedValue([])

      const result = await MemoryService.getEnhancedMemoryContext(
        'Random question',
        'user123',
        {},
        5
      )

      expect(result.memories).toHaveLength(0)
      expect(result.personalityEnhancements).toHaveLength(0)
      expect(result.contextPrompt).toBe('')
    })

    it('should handle retrieval service errors gracefully', async () => {
      vi.spyOn(MemoryService.Retrieval, 'retrieveRelevantMemories').mockRejectedValue(new Error('Database error'))

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = await MemoryService.getEnhancedMemoryContext(
        'Test query',
        'user123',
        {},
        5
      )

      expect(result.memories).toHaveLength(0)
      expect(result.personalityEnhancements).toHaveLength(0)
      expect(result.contextPrompt).toBe('')
      expect(consoleSpy).toHaveBeenCalledWith('Error in getEnhancedMemoryContext:', expect.any(Error))

      consoleSpy.mockRestore()
    })
  })

  describe('analyzeMemoriesForPersonality', () => {
    it('should identify emotional connections', () => {
      const memories: MemoryFragment[] = [
        {
          userId: 'user123',
          fragmentText: 'User is excited about their new job',
          conversationContext: {
            timestamp: '2024-01-01T00:00:00Z',
            messageContext: 'Job discussion',
            emotionalTone: 'positive'
          }
        }
      ]

      // Access private method through any casting
      const enhancements = (MemoryService as any).analyzeMemoriesForPersonality(memories, {})

      expect(enhancements).toContain('emotional_connection')
    })

    it('should identify shared interests', () => {
      const memories: MemoryFragment[] = [
        {
          userId: 'user123',
          fragmentText: 'User loves photography and takes pictures every day',
          conversationContext: {
            timestamp: '2024-01-01T00:00:00Z',
            messageContext: 'Hobby discussion',
            emotionalTone: 'neutral'
          }
        }
      ]

      const profileData = {
        hobbies: ['photography', 'hiking']
      }

      const enhancements = (MemoryService as any).analyzeMemoriesForPersonality(memories, profileData)

      expect(enhancements).toContain('shared_interests')
    })

    it('should identify relationship context', () => {
      const memories: MemoryFragment[] = [
        {
          userId: 'user123',
          fragmentText: 'User has a close relationship with their sister Sarah',
          conversationContext: {
            timestamp: '2024-01-01T00:00:00Z',
            messageContext: 'Family discussion',
            emotionalTone: 'neutral'
          }
        }
      ]

      const enhancements = (MemoryService as any).analyzeMemoriesForPersonality(memories, {})

      expect(enhancements).toContain('relationship_context')
    })

    it('should identify supportive context needs', () => {
      const memories: MemoryFragment[] = [
        {
          userId: 'user123',
          fragmentText: 'User is struggling with anxiety and stress at work',
          conversationContext: {
            timestamp: '2024-01-01T00:00:00Z',
            messageContext: 'Personal challenges',
            emotionalTone: 'negative'
          }
        }
      ]

      const enhancements = (MemoryService as any).analyzeMemoriesForPersonality(memories, {})

      expect(enhancements).toContain('supportive_context')
    })

    it('should handle memories with no special characteristics', () => {
      const memories: MemoryFragment[] = [
        {
          userId: 'user123',
          fragmentText: 'User mentioned they had lunch today',
          conversationContext: {
            timestamp: '2024-01-01T00:00:00Z',
            messageContext: 'Casual conversation',
            emotionalTone: 'neutral'
          }
        }
      ]

      const enhancements = (MemoryService as any).analyzeMemoriesForPersonality(memories, {})

      expect(enhancements).toHaveLength(0)
    })
  })

  describe('buildEnhancedMemoryPrompt', () => {
    it('should build comprehensive prompt with all enhancements', () => {
      const memories: MemoryFragment[] = [
        {
          userId: 'user123',
          fragmentText: 'User loves hiking with their dog Max',
          conversationContext: {
            timestamp: '2024-01-01T00:00:00Z',
            messageContext: 'Pet and hobby discussion',
            emotionalTone: 'positive'
          }
        }
      ]

      const enhancements = ['emotional_connection', 'shared_interests', 'relationship_context', 'supportive_context']

      const prompt = (MemoryService as any).buildEnhancedMemoryPrompt(memories, enhancements)

      expect(prompt).toContain('RELEVANT PERSONAL CONTEXT')
      expect(prompt).toContain('User loves hiking with their dog Max')
      expect(prompt).toContain('emotional intelligence and empathy')
      expect(prompt).toContain('shared interests')
      expect(prompt).toContain('important relationships')
      expect(prompt).toContain('Be supportive and understanding')
      expect(prompt).toContain('Use this context naturally')
    })

    it('should build basic prompt without enhancements', () => {
      const memories: MemoryFragment[] = [
        {
          userId: 'user123',
          fragmentText: 'User mentioned they like coffee',
          conversationContext: {
            timestamp: '2024-01-01T00:00:00Z',
            messageContext: 'Casual mention',
            emotionalTone: 'neutral'
          }
        }
      ]

      const enhancements: string[] = []

      const prompt = (MemoryService as any).buildEnhancedMemoryPrompt(memories, enhancements)

      expect(prompt).toContain('RELEVANT PERSONAL CONTEXT')
      expect(prompt).toContain('User mentioned they like coffee')
      expect(prompt).toContain('Use this context naturally')
      expect(prompt).not.toContain('emotional intelligence')
      expect(prompt).not.toContain('shared interests')
    })

    it('should handle empty memories', () => {
      const memories: MemoryFragment[] = []
      const enhancements: string[] = []

      const prompt = (MemoryService as any).buildEnhancedMemoryPrompt(memories, enhancements)

      expect(prompt).toContain('RELEVANT PERSONAL CONTEXT')
      expect(prompt).toContain('Use this context naturally')
    })
  })

  describe('Memory Integration Quality Tests', () => {
    it('should prioritize memories with higher emotional relevance', async () => {
      const mockMemories: MemoryFragment[] = [
        {
          id: '1',
          userId: 'user123',
          fragmentText: 'User is passionate about environmental conservation',
          conversationContext: {
            timestamp: '2024-01-01T00:00:00Z',
            messageContext: 'Deep discussion about values',
            emotionalTone: 'passionate'
          }
        },
        {
          id: '2',
          userId: 'user123',
          fragmentText: 'User mentioned they had coffee this morning',
          conversationContext: {
            timestamp: '2024-01-01T00:00:00Z',
            messageContext: 'Casual mention',
            emotionalTone: 'neutral'
          }
        }
      ]

      vi.spyOn(MemoryService.Retrieval, 'retrieveRelevantMemories').mockResolvedValue(mockMemories)

      const result = await MemoryService.getEnhancedMemoryContext(
        'What do you care about?',
        'user123',
        {},
        5
      )

      expect(result.memories).toHaveLength(2)
      expect(result.personalityEnhancements).toContain('emotional_connection')
      expect(result.contextPrompt).toContain('emotional intelligence')
    })

    it('should adapt context based on memory emotional tone', async () => {
      const mockMemories: MemoryFragment[] = [
        {
          id: '1',
          userId: 'user123',
          fragmentText: 'User is struggling with anxiety and stress at work',
          conversationContext: {
            timestamp: '2024-01-01T00:00:00Z',
            messageContext: 'User shared difficult news',
            emotionalTone: 'negative'
          }
        }
      ]

      vi.spyOn(MemoryService.Retrieval, 'retrieveRelevantMemories').mockResolvedValue(mockMemories)

      const result = await MemoryService.getEnhancedMemoryContext(
        'How are things going?',
        'user123',
        {},
        5
      )

      expect(result.personalityEnhancements).toContain('supportive_context')
      expect(result.personalityEnhancements).toContain('emotional_connection')
      expect(result.contextPrompt).toContain('Be supportive and understanding')
    })

    it('should blend memories with profile data effectively', async () => {
      const mockMemories: MemoryFragment[] = [
        {
          id: '1',
          userId: 'user123',
          fragmentText: 'User loves rock climbing and goes every weekend',
          conversationContext: {
            timestamp: '2024-01-01T00:00:00Z',
            messageContext: 'Hobby discussion',
            emotionalTone: 'excited'
          }
        }
      ]

      const profileData = {
        hobbies: ['rock climbing', 'mountaineering'],
        name: 'Adventure Enthusiast'
      }

      vi.spyOn(MemoryService.Retrieval, 'retrieveRelevantMemories').mockResolvedValue(mockMemories)

      const result = await MemoryService.getEnhancedMemoryContext(
        'What outdoor activities do you recommend?',
        'user123',
        profileData,
        5
      )

      expect(result.personalityEnhancements).toContain('shared_interests')
      expect(result.personalityEnhancements).toContain('emotional_connection')
      expect(result.contextPrompt).toContain('shared interests')
    })
  })
})