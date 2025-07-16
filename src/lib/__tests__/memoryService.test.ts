// src/lib/__tests__/memoryService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock OpenAI
vi.mock('openai', () => {
  return {
    OpenAI: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn()
        }
      },
      embeddings: {
        create: vi.fn()
      }
    }))
  }
})

// Mock Supabase
vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn()
  }
}))

// Import after mocking
import { 
  MemoryExtractionService, 
  MemoryStorageService, 
  MemoryRetrievalService,
  MemoryService,
  type MemoryFragment 
} from '../memoryService'
import { OpenAI } from 'openai'
import { supabase } from '../supabase'

// Get references to the mocked functions
const mockSupabaseFrom = supabase.from as any
const mockSupabaseRpc = supabase.rpc as any

// Get mock functions from the OpenAI instance
let mockChatCreate: any
let mockEmbeddingsCreate: any

beforeEach(() => {
  vi.clearAllMocks()
  
  // Get fresh references to the mocked functions
  const openaiInstance = new OpenAI() as any
  mockChatCreate = openaiInstance.chat.completions.create
  mockEmbeddingsCreate = openaiInstance.embeddings.create
})

describe('MemoryExtractionService', () => {
  describe('extractMemoryFragments', () => {
    it('should extract meaningful memory fragments from user message', async () => {
      const mockResponse = '["User has a dog named Max", "User enjoys hiking on weekends"]'
      
      mockChatCreate.mockResolvedValue({
        choices: [{ message: { content: mockResponse } }]
      })

      const result = await MemoryExtractionService.extractMemoryFragments(
        "I love hiking with my dog Max every weekend",
        "user-123"
      )

      expect(result).toHaveLength(2)
      expect(result[0].fragmentText).toBe("User has a dog named Max")
      expect(result[1].fragmentText).toBe("User enjoys hiking on weekends")
      expect(result[0].userId).toBe("user-123")
      expect(result[0].conversationContext?.emotionalTone).toBe("positive")
    })

    it('should return empty array when no meaningful information found', async () => {
      const mockResponse = '[]'
      mockChatCreate.mockResolvedValue({
        choices: [{ message: { content: mockResponse } }]
      })

      const result = await MemoryExtractionService.extractMemoryFragments(
        "It's raining today",
        "user-123"
      )

      expect(result).toHaveLength(0)
    })

    it('should handle OpenAI API failures gracefully', async () => {
      mockChatCreate.mockRejectedValue(new Error('API Error'))

      const result = await MemoryExtractionService.extractMemoryFragments(
        "Test message",
        "user-123"
      )

      expect(result).toHaveLength(0)
    })

    it('should handle invalid JSON response gracefully', async () => {
      mockChatCreate.mockResolvedValue({
        choices: [{ message: { content: 'invalid json' } }]
      })

      const result = await MemoryExtractionService.extractMemoryFragments(
        "Test message",
        "user-123"
      )

      expect(result).toHaveLength(0)
    })

    it('should detect emotional tone correctly', async () => {
      const mockResponse = '["User is sad about something"]'
      mockChatCreate.mockResolvedValue({
        choices: [{ message: { content: mockResponse } }]
      })

      const result = await MemoryExtractionService.extractMemoryFragments(
        "I'm feeling really sad today",
        "user-123"
      )

      expect(result).toHaveLength(1)
      expect(result[0].conversationContext?.emotionalTone).toBe("negative")
    })
  })

  describe('batchExtractMemoryFragments', () => {
    it('should process multiple messages in batches', async () => {
      mockChatCreate
        .mockResolvedValueOnce({
          choices: [{ message: { content: '["Fragment 1"]' } }]
        })
        .mockResolvedValueOnce({
          choices: [{ message: { content: '["Fragment 2"]' } }]
        })

      const messages = [
        { text: "Message 1", context: "Context 1" },
        { text: "Message 2", context: "Context 2" }
      ]

      const result = await MemoryExtractionService.batchExtractMemoryFragments(
        messages,
        "user-123"
      )

      expect(result).toHaveLength(2)
      expect(result[0].fragmentText).toBe("Fragment 1")
      expect(result[1].fragmentText).toBe("Fragment 2")
    })
  })
})

describe('MemoryStorageService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateEmbedding', () => {
    it('should generate embedding for text', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3]
      mockEmbeddingsCreate.mockResolvedValue({
        data: [{ embedding: mockEmbedding }]
      })

      const result = await MemoryStorageService.generateEmbedding("test text")

      expect(result).toEqual(mockEmbedding)
      expect(mockEmbeddingsCreate).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: 'test text',
        encoding_format: 'float'
      })
    })

    it('should handle embedding generation failures', async () => {
      mockEmbeddingsCreate.mockRejectedValue(new Error('API Error'))

      await expect(MemoryStorageService.generateEmbedding("test text"))
        .rejects.toThrow('Failed to generate embedding')
    })
  })

  describe('storeMemoryFragment', () => {
    it('should store memory fragment with embedding', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3]
      const mockId = 'fragment-123'
      
      mockEmbeddingsCreate.mockResolvedValue({
        data: [{ embedding: mockEmbedding }]
      })
      
      const mockSingle = vi.fn().mockResolvedValue({
        data: { id: mockId },
        error: null
      })
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect })
      mockSupabaseFrom.mockReturnValue({ insert: mockInsert })

      const fragment: MemoryFragment = {
        userId: 'user-123',
        fragmentText: 'Test fragment'
      }

      const result = await MemoryStorageService.storeMemoryFragment(fragment)

      expect(result).toBe(mockId)
      expect(mockSupabaseFrom).toHaveBeenCalledWith('memory_fragments')
    })

    it('should handle storage failures', async () => {
      mockEmbeddingsCreate.mockResolvedValue({
        data: [{ embedding: [0.1, 0.2, 0.3] }]
      })
      
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Storage error' }
      })
      const mockSelect = vi.fn().mockReturnValue({ single: mockSingle })
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect })
      mockSupabaseFrom.mockReturnValue({ insert: mockInsert })

      const fragment: MemoryFragment = {
        userId: 'user-123',
        fragmentText: 'Test fragment'
      }

      await expect(MemoryStorageService.storeMemoryFragment(fragment))
        .rejects.toThrow('Failed to store memory fragment: Storage error')
    })
  })

  describe('batchStoreMemoryFragments', () => {
    it('should store multiple fragments in batch', async () => {
      const mockEmbeddings = [[0.1, 0.2], [0.3, 0.4]]
      const mockIds = ['id1', 'id2']
      
      mockEmbeddingsCreate.mockResolvedValue({
        data: mockEmbeddings.map(embedding => ({ embedding }))
      })
      
      const mockSelect = vi.fn().mockResolvedValue({
        data: mockIds.map(id => ({ id })),
        error: null
      })
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect })
      mockSupabaseFrom.mockReturnValue({ insert: mockInsert })

      const fragments: MemoryFragment[] = [
        { userId: 'user-123', fragmentText: 'Fragment 1' },
        { userId: 'user-123', fragmentText: 'Fragment 2' }
      ]

      const result = await MemoryStorageService.batchStoreMemoryFragments(fragments)

      expect(result).toEqual(mockIds)
    })

    it('should return empty array for empty input', async () => {
      const result = await MemoryStorageService.batchStoreMemoryFragments([])
      expect(result).toEqual([])
    })
  })
})

describe('MemoryRetrievalService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('retrieveRelevantMemories', () => {
    it('should retrieve relevant memories using vector search', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3]
      const mockMemories = [
        {
          id: 'mem-1',
          user_id: 'user-123',
          fragment_text: 'Test memory',
          conversation_context: { timestamp: '2023-01-01' },
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
          similarity: 0.8
        }
      ]

      mockEmbeddingsCreate.mockResolvedValue({
        data: [{ embedding: mockEmbedding }]
      })

      mockSupabaseRpc.mockResolvedValue({
        data: mockMemories,
        error: null
      })

      const result = await MemoryRetrievalService.retrieveRelevantMemories(
        "test query",
        "user-123"
      )

      expect(result).toHaveLength(1)
      expect(result[0].fragmentText).toBe('Test memory')
      expect(result[0].userId).toBe('user-123')
      expect(mockSupabaseRpc).toHaveBeenCalledWith('match_memory_fragments', {
        query_embedding: mockEmbedding,
        match_threshold: 0.7,
        match_count: 10,
        user_id: 'user-123'
      })
    })

    it('should handle retrieval failures gracefully', async () => {
      mockEmbeddingsCreate.mockRejectedValue(new Error('API Error'))

      const result = await MemoryRetrievalService.retrieveRelevantMemories(
        "test query",
        "user-123"
      )

      expect(result).toEqual([])
    })

    it('should enforce user isolation in vector search', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3]
      
      mockEmbeddingsCreate.mockResolvedValue({
        data: [{ embedding: mockEmbedding }]
      })

      mockSupabaseRpc.mockResolvedValue({
        data: [],
        error: null
      })

      await MemoryRetrievalService.retrieveRelevantMemories(
        "test query",
        "user-456"
      )

      expect(mockSupabaseRpc).toHaveBeenCalledWith('match_memory_fragments', {
        query_embedding: mockEmbedding,
        match_threshold: 0.7,
        match_count: 10,
        user_id: 'user-456'
      })
    })

    it('should apply similarity threshold filtering', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3]
      
      mockEmbeddingsCreate.mockResolvedValue({
        data: [{ embedding: mockEmbedding }]
      })

      mockSupabaseRpc.mockResolvedValue({
        data: [],
        error: null
      })

      await MemoryRetrievalService.retrieveRelevantMemories(
        "test query",
        "user-123",
        { similarityThreshold: 0.9 }
      )

      expect(mockSupabaseRpc).toHaveBeenCalledWith('match_memory_fragments', {
        query_embedding: mockEmbedding,
        match_threshold: 0.9,
        match_count: 10,
        user_id: 'user-123'
      })
    })
  })

  describe('getUserMemories', () => {
    it('should retrieve all user memories with pagination', async () => {
      const mockMemories = [
        {
          id: 'mem-1',
          user_id: 'user-123',
          fragment_text: 'Memory 1',
          conversation_context: {},
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z'
        }
      ]

      const mockRange = vi.fn().mockResolvedValue({
        data: mockMemories,
        error: null
      })
      const mockOrder = vi.fn().mockReturnValue({ range: mockRange })
      const mockEq = vi.fn().mockReturnValue({ order: mockOrder })
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq })
      mockSupabaseFrom.mockReturnValue({ select: mockSelect })

      const result = await MemoryRetrievalService.getUserMemories('user-123', {
        limit: 10,
        offset: 0
      })

      expect(result).toHaveLength(1)
      expect(result[0].fragmentText).toBe('Memory 1')
      expect(mockEq).toHaveBeenCalledWith('user_id', 'user-123')
    })
  })

  describe('getMemoryFragment', () => {
    it('should retrieve memory fragment with user isolation', async () => {
      const mockMemory = {
        id: 'mem-1',
        user_id: 'user-123',
        fragment_text: 'Test memory',
        conversation_context: {},
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      }

      const mockSingle = vi.fn().mockResolvedValue({
        data: mockMemory,
        error: null
      })
      const mockEq2 = vi.fn().mockReturnValue({ single: mockSingle })
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 })
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 })
      mockSupabaseFrom.mockReturnValue({ select: mockSelect })

      const result = await MemoryRetrievalService.getMemoryFragment('mem-1', 'user-123')

      expect(result).not.toBeNull()
      expect(result?.fragmentText).toBe('Test memory')
      expect(mockEq1).toHaveBeenCalledWith('id', 'mem-1')
      expect(mockEq2).toHaveBeenCalledWith('user_id', 'user-123')
    })

    it('should return null for non-existent fragment', async () => {
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }
      })
      const mockEq2 = vi.fn().mockReturnValue({ single: mockSingle })
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 })
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 })
      mockSupabaseFrom.mockReturnValue({ select: mockSelect })

      const result = await MemoryRetrievalService.getMemoryFragment('non-existent', 'user-123')

      expect(result).toBeNull()
    })
  })
})

describe('MemoryService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('processAndStoreMemories', () => {
    it('should extract and store memories in one operation', async () => {
      // Mock extraction
      mockChatCreate.mockResolvedValue({
        choices: [{ message: { content: '["Test memory"]' } }]
      })

      // Mock embedding generation
      mockEmbeddingsCreate.mockResolvedValue({
        data: [{ embedding: [0.1, 0.2, 0.3] }]
      })

      // Mock storage
      const mockSelect = vi.fn().mockResolvedValue({
        data: [{ id: 'mem-123' }],
        error: null
      })
      const mockInsert = vi.fn().mockReturnValue({ select: mockSelect })
      mockSupabaseFrom.mockReturnValue({ insert: mockInsert })

      const result = await MemoryService.processAndStoreMemories(
        "I love hiking with my dog",
        "user-123"
      )

      expect(result).toHaveLength(1)
      expect(result[0].fragmentText).toBe("Test memory")
      expect(result[0].id).toBe("mem-123")
    })

    it('should handle complete workflow failures gracefully', async () => {
      mockChatCreate.mockRejectedValue(new Error('API Error'))

      const result = await MemoryService.processAndStoreMemories(
        "Test message",
        "user-123"
      )

      expect(result).toEqual([])
    })
  })

  describe('getMemoriesForChat', () => {
    it('should format memories for chat context', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3]
      const mockMemories = [
        {
          id: 'mem-1',
          user_id: 'user-123',
          fragment_text: 'User loves hiking',
          created_at: '2023-01-01T00:00:00Z',
          updated_at: '2023-01-01T00:00:00Z',
          similarity: 0.8
        }
      ]

      mockEmbeddingsCreate.mockResolvedValue({
        data: [{ embedding: mockEmbedding }]
      })

      mockSupabaseRpc.mockResolvedValue({
        data: mockMemories,
        error: null
      })

      const result = await MemoryService.getMemoriesForChat(
        "hiking",
        "user-123"
      )

      expect(result).toContain("Relevant memories about the user:")
      expect(result).toContain("- User loves hiking")
    })

    it('should return empty string when no memories found', async () => {
      mockEmbeddingsCreate.mockResolvedValue({
        data: [{ embedding: [0.1, 0.2, 0.3] }]
      })

      mockSupabaseRpc.mockResolvedValue({
        data: [],
        error: null
      })

      const result = await MemoryService.getMemoriesForChat(
        "test query",
        "user-123"
      )

      expect(result).toBe("")
    })
  })
})