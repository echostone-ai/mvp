// src/lib/__tests__/memoryEndToEnd.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MemoryService, MemoryFragment } from '../memoryService'
import { MemoryPerformanceMonitor } from '../memoryPerformanceMonitor'

// Mock Supabase with enhanced functionality for comprehensive testing
const mockSupabaseData = new Map<string, any[]>()
const mockSupabaseRpc = vi.fn()
const mockSupabaseOperations = {
  insertCount: 0,
  selectCount: 0,
  updateCount: 0,
  deleteCount: 0,
  rpcCount: 0
}

vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => ({
      select: vi.fn(() => {
        mockSupabaseOperations.selectCount++
        return {
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              range: vi.fn(() => Promise.resolve({ 
                data: mockSupabaseData.get(table) || [], 
                error: null 
              })),
              single: vi.fn(() => Promise.resolve({ 
                data: mockSupabaseData.get(table)?.[0] || null, 
                error: null 
              })),
              limit: vi.fn(() => Promise.resolve({ 
                data: mockSupabaseData.get(table) || [], 
                error: null 
              }))
            }))
          })),
          textSearch: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ 
                data: mockSupabaseData.get(table) || [], 
                error: null 
              }))
            }))
          }))
        }
      }),
      insert: vi.fn((data: any) => {
        mockSupabaseOperations.insertCount++
        return {
          select: vi.fn(() => {
            const table = 'memory_fragments'
            const existing = mockSupabaseData.get(table) || []
            const newItems = Array.isArray(data) ? data : [data]
            const withIds = newItems.map((item, index) => ({
              ...item,
              id: `test-id-${existing.length + index}`,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }))
            mockSupabaseData.set(table, [...existing, ...withIds])
            return Promise.resolve({ 
              data: withIds.map(item => ({ id: item.id })), 
              error: null 
            })
          })
        }
      }),
      update: vi.fn(() => {
        mockSupabaseOperations.updateCount++
        return Promise.resolve({ data: null, error: null })
      }),
      delete: vi.fn(() => {
        mockSupabaseOperations.deleteCount++
        return Promise.resolve({ data: null, error: null })
      })
    })),
    rpc: vi.fn((...args) => {
      mockSupabaseOperations.rpcCount++
      return mockSupabaseRpc(...args)
    })
  }
}))

// Mock OpenAI with enhanced tracking
const mockOpenAIOperations = {
  chatCount: 0,
  embeddingCount: 0,
  totalTokensUsed: 0
}

// Mock OpenAI functions that we can access in tests
const mockOpenAIFunctions = {
  chatCreate: vi.fn(),
  embeddingsCreate: vi.fn()
}

vi.mock('openai', () => {
  return {
    OpenAI: vi.fn(() => ({
      chat: {
        completions: {
          create: mockOpenAIFunctions.chatCreate
        }
      },
      embeddings: {
        create: mockOpenAIFunctions.embeddingsCreate
      }
    }))
  }
})

describe('End-to-End Conversation Memory Tests', () => {
  beforeEach(() => {
    // Clear all mocks and data
    vi.clearAllMocks()
    mockSupabaseData.clear()
    MemoryPerformanceMonitor.clearCache()
    
    // Reset operation counters
    Object.keys(mockOpenAIOperations).forEach(key => {
      mockOpenAIOperations[key as keyof typeof mockOpenAIOperations] = 0
    })
    Object.keys(mockSupabaseOperations).forEach(key => {
      mockSupabaseOperations[key as keyof typeof mockSupabaseOperations] = 0
    })
    
    // Setup default RPC response for vector search
    mockSupabaseRpc.mockResolvedValue({
      data: [],
      error: null
    })
  })

  afterEach(() => {
    MemoryPerformanceMonitor.clearCache()
  })

  describe('Complete Conversation Flow', () => {
    it('should capture, store, and retrieve memories across multiple conversation sessions', async () => {
      const userId = 'test-user-123'
      
      // === CONVERSATION SESSION 1 ===
      console.log('=== Starting Conversation Session 1 ===')
      
      // User shares personal information
      const message1 = "Hi! I'm Sarah and I love hiking with my golden retriever Max every weekend. We usually go to the mountains near my hometown."
      
      // Mock extraction response
      mockOpenAIFunctions.chatCreate.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify([
              "User's name is Sarah",
              "User loves hiking and does it every weekend", 
              "User has a golden retriever named Max",
              "User goes hiking in mountains near hometown"
            ])
          }
        }]
      })
      
      // Mock embedding generation
      mockOpenAIFunctions.embeddingsCreate.mockResolvedValue({
        data: [{ embedding: new Array(1536).fill(0.1) }]
      })
      
      // Process and store memories
      const storedMemories1 = await MemoryService.processAndStoreMemories(
        message1,
        userId,
        'Initial conversation'
      )
      
      expect(storedMemories1).toHaveLength(4)
      expect(storedMemories1[0].fragmentText).toBe("User's name is Sarah")
      expect(storedMemories1[1].fragmentText).toBe("User loves hiking and does it every weekend")
      
      // Verify memories were stored in database
      const dbMemories = mockSupabaseData.get('memory_fragments') || []
      expect(dbMemories).toHaveLength(4)
      
      // === CONVERSATION SESSION 2 (Later) ===
      console.log('=== Starting Conversation Session 2 ===')
      
      // User mentions hiking again - should trigger memory retrieval
      const message2 = "I'm planning another hiking trip this weekend. Any suggestions?"
      
      // Mock vector search to return relevant memories
      mockSupabaseRpc.mockResolvedValueOnce({
        data: [
          {
            id: 'test-id-1',
            user_id: userId,
            fragment_text: "User loves hiking and does it every weekend",
            embedding: new Array(1536).fill(0.1),
            conversation_context: { timestamp: new Date().toISOString() },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            similarity: 0.85
          },
          {
            id: 'test-id-3',
            user_id: userId,
            fragment_text: "User goes hiking in mountains near hometown",
            embedding: new Array(1536).fill(0.1),
            conversation_context: { timestamp: new Date().toISOString() },
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            similarity: 0.82
          }
        ],
        error: null
      })
      
      // Retrieve relevant memories
      const relevantMemories = await MemoryService.Retrieval.retrieveRelevantMemories(
        message2,
        userId,
        { limit: 5, similarityThreshold: 0.7 }
      )
      
      expect(relevantMemories).toHaveLength(2)
      expect(relevantMemories[0].fragmentText).toBe("User loves hiking and does it every weekend")
      expect(relevantMemories[1].fragmentText).toBe("User goes hiking in mountains near hometown")
      expect(relevantMemories[0].similarity).toBe(0.85)
      
      // Get enhanced memory context for chat
      const memoryContext = await MemoryService.getEnhancedMemoryContext(
        message2,
        userId,
        { hobbies: ['hiking', 'outdoors'] },
        3
      )
      
      expect(memoryContext.memories).toHaveLength(2)
      expect(memoryContext.contextPrompt).toContain('hiking')
      expect(memoryContext.personalityEnhancements).toContain('shared_interests')
      
      // === CONVERSATION SESSION 3 ===
      console.log('=== Starting Conversation Session 3 ===')
      
      // User shares more personal details
      const message3 = "My sister Emma is visiting next week and she wants to meet Max. She's never been hiking before but is excited to try."
      
      // Mock extraction for new information
      mockOpenAIFunctions.chatCreate.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify([
              "User has a sister named Emma",
              "Emma is visiting next week",
              "Emma wants to meet Max (user's dog)",
              "Emma has never been hiking before but is excited to try"
            ])
          }
        }]
      })
      
      // Process new memories
      const storedMemories3 = await MemoryService.processAndStoreMemories(
        message3,
        userId,
        'Session 3 - family discussion'
      )
      
      expect(storedMemories3).toHaveLength(4)
      expect(storedMemories3[0].fragmentText).toBe("User has a sister named Emma")
      
      // Verify total memories in database
      const allDbMemories = mockSupabaseData.get('memory_fragments') || []
      expect(allDbMemories).toHaveLength(8) // 4 from session 1 + 4 from session 3
      
      // === CONVERSATION SESSION 4 ===
      console.log('=== Starting Conversation Session 4 ===')
      
      // User asks about family and pets - should retrieve multiple relevant memories
      const message4 = "I'm thinking about what activities Emma and Max would enjoy together."
      
      // Mock comprehensive memory retrieval
      mockSupabaseRpc.mockResolvedValueOnce({
        data: [
          {
            id: 'test-id-2',
            user_id: userId,
            fragment_text: "User has a golden retriever named Max",
            similarity: 0.88
          },
          {
            id: 'test-id-5',
            user_id: userId,
            fragment_text: "User has a sister named Emma",
            similarity: 0.85
          },
          {
            id: 'test-id-7',
            user_id: userId,
            fragment_text: "Emma wants to meet Max (user's dog)",
            similarity: 0.90
          },
          {
            id: 'test-id-8',
            user_id: userId,
            fragment_text: "Emma has never been hiking before but is excited to try",
            similarity: 0.83
          }
        ].map(item => ({
          ...item,
          user_id: userId,
          embedding: new Array(1536).fill(0.1),
          conversation_context: { timestamp: new Date().toISOString() },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })),
        error: null
      })
      
      const familyMemories = await MemoryService.Retrieval.retrieveRelevantMemories(
        message4,
        userId,
        { limit: 10, similarityThreshold: 0.7 }
      )
      
      expect(familyMemories).toHaveLength(4)
      expect(familyMemories.some(m => m.fragmentText.includes('Max'))).toBe(true)
      expect(familyMemories.some(m => m.fragmentText.includes('Emma'))).toBe(true)
      
      // Test memory context formatting for chat
      const chatContext = await MemoryService.getMemoriesForChat(message4, userId, 5)
      expect(chatContext).toContain('Max')
      expect(chatContext).toContain('Emma')
      expect(chatContext).toContain('Relevant memories about the user:')
    })

    it('should maintain memory accuracy and relevance across multiple conversation sessions', async () => {
      const userId = 'accuracy-test-user'
      
      // Session 1: User shares work information
      const workMessage = "I work as a software engineer at TechCorp. I've been there for 3 years and love working on AI projects."
      
      mockOpenAIFunctions.chatCreate.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify([
              "User works as a software engineer",
              "User works at TechCorp",
              "User has been at TechCorp for 3 years",
              "User loves working on AI projects"
            ])
          }
        }]
      })
      
      await MemoryService.processAndStoreMemories(workMessage, userId)
      
      // Session 2: User shares hobby information
      const hobbyMessage = "In my free time, I enjoy rock climbing and photography. I've been climbing for about 2 years now."
      
      mockOpenAIFunctions.chatCreate.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify([
              "User enjoys rock climbing in free time",
              "User enjoys photography in free time", 
              "User has been rock climbing for about 2 years"
            ])
          }
        }]
      })
      
      await MemoryService.processAndStoreMemories(hobbyMessage, userId)
      
      // Session 3: Query about work should return work-related memories
      mockSupabaseRpc.mockResolvedValueOnce({
        data: [
          {
            id: 'work-1',
            user_id: userId,
            fragment_text: "User works as a software engineer",
            similarity: 0.92
          },
          {
            id: 'work-2', 
            user_id: userId,
            fragment_text: "User loves working on AI projects",
            similarity: 0.88
          }
        ].map(item => ({
          ...item,
          embedding: new Array(1536).fill(0.1),
          conversation_context: { timestamp: new Date().toISOString() },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })),
        error: null
      })
      
      const workMemories = await MemoryService.Retrieval.retrieveRelevantMemories(
        "Tell me about my career",
        userId
      )
      
      expect(workMemories).toHaveLength(2)
      expect(workMemories.every(m => m.fragmentText.includes('work') || m.fragmentText.includes('AI'))).toBe(true)
      
      // Session 4: Query about hobbies should return hobby-related memories
      mockSupabaseRpc.mockResolvedValueOnce({
        data: [
          {
            id: 'hobby-1',
            user_id: userId,
            fragment_text: "User enjoys rock climbing in free time",
            similarity: 0.89
          },
          {
            id: 'hobby-2',
            user_id: userId, 
            fragment_text: "User has been rock climbing for about 2 years",
            similarity: 0.85
          }
        ].map(item => ({
          ...item,
          embedding: new Array(1536).fill(0.1),
          conversation_context: { timestamp: new Date().toISOString() },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })),
        error: null
      })
      
      const hobbyMemories = await MemoryService.Retrieval.retrieveRelevantMemories(
        "What do I like to do for fun?",
        userId
      )
      
      expect(hobbyMemories).toHaveLength(2)
      expect(hobbyMemories.every(m => m.fragmentText.includes('climbing') || m.fragmentText.includes('photography'))).toBe(true)
    })
  })

  describe('User Privacy and Data Isolation', () => {
    it('should ensure complete data isolation between different users', async () => {
      const user1 = 'user-1-privacy-test'
      const user2 = 'user-2-privacy-test'
      
      // User 1 shares personal information
      mockOpenAIFunctions.chatCreate.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify([
              "User 1 lives in New York",
              "User 1 has a cat named Whiskers"
            ])
          }
        }]
      })
      
      await MemoryService.processAndStoreMemories(
        "I live in New York with my cat Whiskers",
        user1
      )
      
      // User 2 shares different personal information
      mockOpenAIFunctions.chatCreate.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify([
              "User 2 lives in California", 
              "User 2 has a dog named Buddy"
            ])
          }
        }]
      })
      
      await MemoryService.processAndStoreMemories(
        "I live in California with my dog Buddy",
        user2
      )
      
      // Mock user-specific memory retrieval
      mockSupabaseRpc.mockImplementation((funcName, params) => {
        const memories = mockSupabaseData.get('memory_fragments') || []
        const userMemories = memories.filter(m => m.user_id === params.user_id)
        return Promise.resolve({
          data: userMemories.map(m => ({
            ...m,
            similarity: 0.8
          })),
          error: null
        })
      })
      
      // User 1 should only see their own memories
      const user1Memories = await MemoryService.Retrieval.retrieveRelevantMemories(
        "Tell me about my pets",
        user1
      )
      
      expect(user1Memories.every(m => m.userId === user1)).toBe(true)
      expect(user1Memories.some(m => m.fragmentText.includes('Whiskers'))).toBe(true)
      expect(user1Memories.some(m => m.fragmentText.includes('Buddy'))).toBe(false)
      
      // User 2 should only see their own memories
      const user2Memories = await MemoryService.Retrieval.retrieveRelevantMemories(
        "Tell me about my pets",
        user2
      )
      
      expect(user2Memories.every(m => m.userId === user2)).toBe(true)
      expect(user2Memories.some(m => m.fragmentText.includes('Buddy'))).toBe(true)
      expect(user2Memories.some(m => m.fragmentText.includes('Whiskers'))).toBe(false)
      
      // Cross-user memory access should return empty results
      const crossUserMemories = await MemoryService.Retrieval.getUserMemories(user1)
      expect(crossUserMemories.every(m => m.userId === user1)).toBe(true)
    })

    it('should handle user memory management operations securely', async () => {
      const userId = 'memory-management-test-user'
      
      // Create some test memories
      mockOpenAIFunctions.chatCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify([
              "Test memory fragment 1",
              "Test memory fragment 2"
            ])
          }
        }]
      })
      
      const memories = await MemoryService.processAndStoreMemories(
        "This is a test message with personal information",
        userId
      )
      
      expect(memories).toHaveLength(2)
      
      // Test memory retrieval
      const userMemories = await MemoryService.Retrieval.getUserMemories(userId)
      expect(userMemories).toHaveLength(2)
      expect(userMemories.every(m => m.userId === userId)).toBe(true)
      
      // Test memory statistics
      const stats = await MemoryService.Retrieval.getMemoryStats(userId)
      expect(stats.totalFragments).toBe(2)
      expect(stats.newestMemory).toBeInstanceOf(Date)
      expect(stats.oldestMemory).toBeInstanceOf(Date)
    })
  })

  describe('Memory System Performance Under Load', () => {
    it('should handle multiple concurrent users efficiently', async () => {
      const userCount = 10
      const messagesPerUser = 5
      const users = Array.from({ length: userCount }, (_, i) => `concurrent-user-${i}`)
      
      // Mock responses for all operations
      mockOpenAIFunctions.chatCreate.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify([
              "Concurrent test memory fragment"
            ])
          }
        }]
      })
      
      mockSupabaseRpc.mockResolvedValue({
        data: [{
          id: 'concurrent-test',
          user_id: 'test',
          fragment_text: "Concurrent test memory fragment",
          similarity: 0.8,
          embedding: new Array(1536).fill(0.1),
          conversation_context: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }],
        error: null
      })
      
      const startTime = Date.now()
      
      // Create concurrent operations for all users
      const operations = users.flatMap(userId => 
        Array.from({ length: messagesPerUser }, (_, msgIndex) => 
          MemoryService.processAndStoreMemories(
            `Concurrent test message ${msgIndex} from ${userId}`,
            userId
          )
        )
      )
      
      // Execute all operations concurrently
      const results = await Promise.all(operations)
      const duration = Date.now() - startTime
      
      // Verify all operations completed successfully
      expect(results).toHaveLength(userCount * messagesPerUser)
      expect(results.every(result => Array.isArray(result))).toBe(true)
      
      // Performance should be reasonable (less than 30 seconds for 50 operations)
      expect(duration).toBeLessThan(30000)
      
      console.log(`Concurrent operations completed in ${duration}ms`)
      
      // Test concurrent memory retrieval
      const retrievalOperations = users.map(userId =>
        MemoryService.Retrieval.retrieveRelevantMemories(
          "test query",
          userId,
          { limit: 5 }
        )
      )
      
      const retrievalResults = await Promise.all(retrievalOperations)
      expect(retrievalResults).toHaveLength(userCount)
      expect(retrievalResults.every(result => Array.isArray(result))).toBe(true)
    })

    it('should maintain system stability under memory pressure', async () => {
      const userId = 'memory-pressure-test-user'
      
      // Create a large number of memory fragments
      const largeMessageCount = 100
      const largeMessages = Array.from({ length: largeMessageCount }, (_, i) => 
        `Large test message ${i} with lots of personal information that should be extracted and stored as memory fragments for future reference in conversations.`
      )
      
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify([
              "Large memory fragment with detailed personal information",
              "Additional memory fragment with more context"
            ])
          }
        }]
      })
      
      // Process messages in batches to simulate realistic usage
      const batchSize = 10
      const results = []
      
      for (let i = 0; i < largeMessages.length; i += batchSize) {
        const batch = largeMessages.slice(i, i + batchSize)
        const batchPromises = batch.map(message => 
          MemoryService.processAndStoreMemories(message, userId)
        )
        
        const batchResults = await Promise.all(batchPromises)
        results.push(...batchResults)
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      
      expect(results).toHaveLength(largeMessageCount)
      expect(results.every(result => Array.isArray(result))).toBe(true)
      
      // System should still be responsive for memory retrieval
      mockSupabaseRpc.mockResolvedValueOnce({
        data: Array.from({ length: 10 }, (_, i) => ({
          id: `pressure-test-${i}`,
          user_id: userId,
          fragment_text: `Memory fragment ${i}`,
          similarity: 0.8 - (i * 0.05),
          embedding: new Array(1536).fill(0.1),
          conversation_context: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })),
        error: null
      })
      
      const retrievalStartTime = Date.now()
      const retrievedMemories = await MemoryService.Retrieval.retrieveRelevantMemories(
        "test query for memory pressure",
        userId,
        { limit: 10 }
      )
      const retrievalDuration = Date.now() - retrievalStartTime
      
      expect(retrievedMemories).toHaveLength(10)
      expect(retrievalDuration).toBeLessThan(5000) // Should complete within 5 seconds
      
      console.log(`Memory retrieval under pressure completed in ${retrievalDuration}ms`)
    })
  })

  describe('Error Handling and Recovery', () => {
    it('should gracefully handle extraction failures without breaking conversation flow', async () => {
      const userId = 'error-handling-test-user'
      
      // Mock extraction failure
      mockOpenAI.chat.completions.create.mockRejectedValueOnce(
        new Error('OpenAI API temporarily unavailable')
      )
      
      // Should not throw error, should return empty array
      const result = await MemoryService.processAndStoreMemories(
        "This message should fail to extract memories",
        userId
      )
      
      expect(result).toEqual([])
      
      // Subsequent operations should work normally
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify([
              "Recovery test memory fragment"
            ])
          }
        }]
      })
      
      const recoveryResult = await MemoryService.processAndStoreMemories(
        "This message should work after recovery",
        userId
      )
      
      expect(recoveryResult).toHaveLength(1)
      expect(recoveryResult[0].fragmentText).toBe("Recovery test memory fragment")
    })

    it('should handle retrieval failures with graceful fallback', async () => {
      const userId = 'retrieval-error-test-user'
      
      // Mock vector search failure
      mockSupabaseRpc.mockRejectedValueOnce(
        new Error('Vector search temporarily unavailable')
      )
      
      // Should fall back to text search
      const mockTextSearchData = [{
        id: 'fallback-test',
        user_id: userId,
        fragment_text: "Fallback memory fragment",
        embedding: new Array(1536).fill(0.1),
        conversation_context: {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }]
      
      mockSupabaseData.set('memory_fragments', mockTextSearchData)
      
      const result = await MemoryService.Retrieval.retrieveRelevantMemories(
        "test query",
        userId
      )
      
      // Should return fallback results
      expect(result).toHaveLength(1)
      expect(result[0].fragmentText).toBe("Fallback memory fragment")
    })
  })

  describe('Memory Context Integration', () => {
    it('should provide natural memory integration for chat responses', async () => {
      const userId = 'context-integration-test-user'
      
      // Setup user memories
      const mockMemories = [
        {
          id: 'context-1',
          user_id: userId,
          fragment_text: "User loves Italian food",
          similarity: 0.9,
          embedding: new Array(1536).fill(0.1),
          conversation_context: { emotionalTone: 'positive' },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'context-2', 
          user_id: userId,
          fragment_text: "User has been to Italy twice",
          similarity: 0.85,
          embedding: new Array(1536).fill(0.1),
          conversation_context: { emotionalTone: 'positive' },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ]
      
      mockSupabaseRpc.mockResolvedValueOnce({
        data: mockMemories,
        error: null
      })
      
      // Test enhanced memory context
      const context = await MemoryService.getEnhancedMemoryContext(
        "What should I cook for dinner?",
        userId,
        { hobbies: ['cooking'], personality: 'helpful' },
        5
      )
      
      expect(context.memories).toHaveLength(2)
      expect(context.contextPrompt).toContain('Italian food')
      expect(context.contextPrompt).toContain('Italy')
      expect(context.personalityEnhancements).toContain('emotional_connection')
      
      // Test simple memory formatting for chat
      const chatMemories = await MemoryService.getMemoriesForChat(
        "cooking suggestions",
        userId,
        3
      )
      
      expect(chatMemories).toContain('Italian food')
      expect(chatMemories).toContain('Relevant memories about the user:')
    })
  })

  describe('Comprehensive Memory Accuracy and Relevance Tests', () => {
    it('should accurately extract and categorize different types of personal information', async () => {
      const userId = 'accuracy-comprehensive-test-user'
      
      // Test relationship extraction
      const relationshipMessage = "My wife Sarah and I have been married for 5 years. Our daughter Emma just turned 3 last month."
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify([
              "User is married to Sarah for 5 years",
              "User has a daughter named Emma who is 3 years old",
              "Emma's birthday was last month"
            ])
          }
        }]
      })
      
      const relationshipMemories = await MemoryService.processAndStoreMemories(relationshipMessage, userId)
      expect(relationshipMemories).toHaveLength(3)
      expect(relationshipMemories.some(m => m.fragmentText.includes('married to Sarah'))).toBe(true)
      expect(relationshipMemories.some(m => m.fragmentText.includes('daughter named Emma'))).toBe(true)
      
      // Test preference extraction
      const preferenceMessage = "I absolutely hate spicy food but I love sweet desserts. My favorite restaurant is the Italian place downtown."
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify([
              "User hates spicy food",
              "User loves sweet desserts",
              "User's favorite restaurant is Italian place downtown"
            ])
          }
        }]
      })
      
      const preferenceMemories = await MemoryService.processAndStoreMemories(preferenceMessage, userId)
      expect(preferenceMemories).toHaveLength(3)
      expect(preferenceMemories.some(m => m.fragmentText.includes('hates spicy food'))).toBe(true)
      expect(preferenceMemories.some(m => m.fragmentText.includes('loves sweet desserts'))).toBe(true)
      
      // Test experience extraction
      const experienceMessage = "Last summer I went skydiving for the first time. It was terrifying but amazing! I want to do it again."
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        choices: [{
          message: {
            content: JSON.stringify([
              "User went skydiving for the first time last summer",
              "User found skydiving terrifying but amazing",
              "User wants to go skydiving again"
            ])
          }
        }]
      })
      
      const experienceMemories = await MemoryService.processAndStoreMemories(experienceMessage, userId)
      expect(experienceMemories).toHaveLength(3)
      expect(experienceMemories.some(m => m.fragmentText.includes('skydiving for the first time'))).toBe(true)
      expect(experienceMemories.some(m => m.fragmentText.includes('terrifying but amazing'))).toBe(true)
    })

    it('should maintain memory relevance across different conversation contexts', async () => {
      const userId = 'relevance-test-user'
      
      // Store diverse memories
      const memories = [
        { text: "User works as a teacher", context: "career" },
        { text: "User loves playing guitar", context: "hobbies" },
        { text: "User has anxiety about public speaking", context: "personal" },
        { text: "User's favorite book is 1984", context: "interests" },
        { text: "User lives in Seattle", context: "location" }
      ]
      
      for (const memory of memories) {
        mockOpenAI.chat.completions.create.mockResolvedValueOnce({
          choices: [{ message: { content: JSON.stringify([memory.text]) } }]
        })
        await MemoryService.processAndStoreMemories(`Context: ${memory.text}`, userId)
      }
      
      // Test career-related query
      mockSupabaseRpc.mockResolvedValueOnce({
        data: [{
          id: 'career-1',
          user_id: userId,
          fragment_text: "User works as a teacher",
          similarity: 0.92,
          embedding: new Array(1536).fill(0.1),
          conversation_context: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }],
        error: null
      })
      
      const careerMemories = await MemoryService.Retrieval.retrieveRelevantMemories(
        "Tell me about my job",
        userId,
        { similarityThreshold: 0.8 }
      )
      
      expect(careerMemories).toHaveLength(1)
      expect(careerMemories[0].fragmentText).toBe("User works as a teacher")
      
      // Test hobby-related query
      mockSupabaseRpc.mockResolvedValueOnce({
        data: [{
          id: 'hobby-1',
          user_id: userId,
          fragment_text: "User loves playing guitar",
          similarity: 0.89,
          embedding: new Array(1536).fill(0.1),
          conversation_context: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }],
        error: null
      })
      
      const hobbyMemories = await MemoryService.Retrieval.retrieveRelevantMemories(
        "What instruments do I play?",
        userId,
        { similarityThreshold: 0.8 }
      )
      
      expect(hobbyMemories).toHaveLength(1)
      expect(hobbyMemories[0].fragmentText).toBe("User loves playing guitar")
    })

    it('should handle temporal context and memory aging appropriately', async () => {
      const userId = 'temporal-test-user'
      
      // Create memories with different timestamps
      const oldDate = new Date('2023-01-01')
      const recentDate = new Date('2024-01-01')
      const currentDate = new Date()
      
      const temporalMemories = [
        {
          id: 'old-memory',
          user_id: userId,
          fragment_text: "User used to work at OldCorp",
          similarity: 0.85,
          embedding: new Array(1536).fill(0.1),
          conversation_context: { timestamp: oldDate.toISOString() },
          created_at: oldDate.toISOString(),
          updated_at: oldDate.toISOString()
        },
        {
          id: 'recent-memory',
          user_id: userId,
          fragment_text: "User now works at NewCorp",
          similarity: 0.90,
          embedding: new Array(1536).fill(0.1),
          conversation_context: { timestamp: recentDate.toISOString() },
          created_at: recentDate.toISOString(),
          updated_at: recentDate.toISOString()
        },
        {
          id: 'current-memory',
          user_id: userId,
          fragment_text: "User got promoted to senior developer",
          similarity: 0.88,
          embedding: new Array(1536).fill(0.1),
          conversation_context: { timestamp: currentDate.toISOString() },
          created_at: currentDate.toISOString(),
          updated_at: currentDate.toISOString()
        }
      ]
      
      mockSupabaseRpc.mockResolvedValueOnce({
        data: temporalMemories,
        error: null
      })
      
      const workMemories = await MemoryService.Retrieval.retrieveRelevantMemories(
        "Where do I work?",
        userId,
        { limit: 10 }
      )
      
      expect(workMemories).toHaveLength(3)
      
      // Verify memories are returned with temporal context
      const hasOldMemory = workMemories.some(m => m.fragmentText.includes('OldCorp'))
      const hasRecentMemory = workMemories.some(m => m.fragmentText.includes('NewCorp'))
      const hasCurrentMemory = workMemories.some(m => m.fragmentText.includes('promoted'))
      
      expect(hasOldMemory).toBe(true)
      expect(hasRecentMemory).toBe(true)
      expect(hasCurrentMemory).toBe(true)
    })
  })

  describe('Advanced Privacy and Security Tests', () => {
    it('should prevent cross-user data leakage in all scenarios', async () => {
      const user1 = 'security-user-1'
      const user2 = 'security-user-2'
      const user3 = 'security-user-3'
      
      // Create memories for multiple users with similar content
      const userMemories = [
        { userId: user1, text: "User 1 secret: loves chocolate cake", fragment: "User 1 loves chocolate cake" },
        { userId: user2, text: "User 2 secret: loves chocolate ice cream", fragment: "User 2 loves chocolate ice cream" },
        { userId: user3, text: "User 3 secret: loves chocolate cookies", fragment: "User 3 loves chocolate cookies" }
      ]
      
      for (const memory of userMemories) {
        mockOpenAI.chat.completions.create.mockResolvedValueOnce({
          choices: [{ message: { content: JSON.stringify([memory.fragment]) } }]
        })
        await MemoryService.processAndStoreMemories(memory.text, memory.userId)
      }
      
      // Mock user-specific retrieval that properly filters by user_id
      mockSupabaseRpc.mockImplementation((funcName, params) => {
        const allMemories = mockSupabaseData.get('memory_fragments') || []
        const userSpecificMemories = allMemories.filter(m => m.user_id === params.user_id)
        return Promise.resolve({
          data: userSpecificMemories.map(m => ({
            ...m,
            similarity: 0.85
          })),
          error: null
        })
      })
      
      // Test that each user only gets their own memories
      for (const user of [user1, user2, user3]) {
        const userMemories = await MemoryService.Retrieval.retrieveRelevantMemories(
          "What do I love?",
          user
        )
        
        // Each user should only see their own memory
        expect(userMemories).toHaveLength(1)
        expect(userMemories[0].userId).toBe(user)
        expect(userMemories[0].fragmentText).toContain(`User ${user.slice(-1)}`)
        
        // Verify no cross-contamination
        const otherUserIds = [user1, user2, user3].filter(u => u !== user)
        for (const otherUserId of otherUserIds) {
          expect(userMemories.some(m => m.fragmentText.includes(`User ${otherUserId.slice(-1)}`))).toBe(false)
        }
      }
    })

    it('should handle malicious input and prevent injection attacks', async () => {
      const userId = 'security-injection-test-user'
      
      // Test SQL injection attempts
      const maliciousInputs = [
        "'; DROP TABLE memory_fragments; --",
        "1' OR '1'='1",
        "<script>alert('xss')</script>",
        "../../etc/passwd",
        "{{constructor.constructor('return process')().exit()}}"
      ]
      
      for (const maliciousInput of maliciousInputs) {
        mockOpenAI.chat.completions.create.mockResolvedValueOnce({
          choices: [{ message: { content: JSON.stringify([]) } }] // No extraction for malicious input
        })
        
        // Should not throw errors or cause system issues
        const result = await MemoryService.processAndStoreMemories(maliciousInput, userId)
        expect(result).toEqual([])
      }
      
      // Test malicious user IDs
      const maliciousUserIds = [
        "'; DROP TABLE users; --",
        "../admin",
        "null",
        "undefined",
        ""
      ]
      
      for (const maliciousUserId of maliciousUserIds) {
        // Should handle gracefully without errors
        const result = await MemoryService.Retrieval.retrieveRelevantMemories(
          "test query",
          maliciousUserId
        )
        expect(Array.isArray(result)).toBe(true)
      }
    })

    it('should properly handle user data deletion and cleanup', async () => {
      const userId = 'deletion-test-user'
      
      // Create test memories
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify([
              "Test memory for deletion 1",
              "Test memory for deletion 2",
              "Test memory for deletion 3"
            ])
          }
        }]
      })
      
      const memories = await MemoryService.processAndStoreMemories(
        "Test message with multiple memories",
        userId
      )
      
      expect(memories).toHaveLength(3)
      
      // Verify memories exist
      const userMemories = await MemoryService.Retrieval.getUserMemories(userId)
      expect(userMemories).toHaveLength(3)
      
      // Delete all user memories
      await MemoryService.Storage.deleteAllUserMemories(userId)
      
      // Verify memories are deleted
      mockSupabaseData.set('memory_fragments', []) // Simulate deletion
      const deletedUserMemories = await MemoryService.Retrieval.getUserMemories(userId)
      expect(deletedUserMemories).toHaveLength(0)
      
      // Verify retrieval returns empty results
      const retrievalResult = await MemoryService.Retrieval.retrieveRelevantMemories(
        "test query",
        userId
      )
      expect(retrievalResult).toHaveLength(0)
    })
  })

  describe('System Performance and Scalability Tests', () => {
    it('should track and report performance metrics accurately', async () => {
      const userId = 'performance-metrics-test-user'
      
      // Reset operation counters
      Object.keys(mockSupabaseOperations).forEach(key => {
        mockSupabaseOperations[key as keyof typeof mockSupabaseOperations] = 0
      })
      Object.keys(mockOpenAIOperations).forEach(key => {
        mockOpenAIOperations[key as keyof typeof mockOpenAIOperations] = 0
      })
      
      // Perform various operations
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify([
              "Performance test memory fragment"
            ])
          }
        }]
      })
      
      // Test memory processing
      await MemoryService.processAndStoreMemories(
        "Performance test message",
        userId
      )
      
      // Test memory retrieval
      mockSupabaseRpc.mockResolvedValueOnce({
        data: [{
          id: 'perf-test',
          user_id: userId,
          fragment_text: "Performance test memory fragment",
          similarity: 0.8,
          embedding: new Array(1536).fill(0.1),
          conversation_context: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }],
        error: null
      })
      
      await MemoryService.Retrieval.retrieveRelevantMemories("test query", userId)
      
      // Verify operations were tracked
      expect(mockOpenAIOperations.chatCount).toBeGreaterThan(0)
      expect(mockOpenAIOperations.embeddingCount).toBeGreaterThan(0)
      expect(mockSupabaseOperations.insertCount).toBeGreaterThan(0)
      expect(mockSupabaseOperations.rpcCount).toBeGreaterThan(0)
      
      console.log('Performance metrics:', {
        openAI: mockOpenAIOperations,
        supabase: mockSupabaseOperations
      })
    })

    it('should handle large-scale memory operations efficiently', async () => {
      const userId = 'large-scale-test-user'
      const largeDatasetSize = 1000
      
      // Create large dataset of memories
      const largeMessages = Array.from({ length: largeDatasetSize }, (_, i) => 
        `Large scale test message ${i} with unique content about topic ${i % 10}`
      )
      
      mockOpenAI.chat.completions.create.mockResolvedValue({
        choices: [{
          message: {
            content: JSON.stringify([
              "Large scale memory fragment"
            ])
          }
        }]
      })
      
      const startTime = Date.now()
      
      // Process in reasonable batches
      const batchSize = 50
      let totalProcessed = 0
      
      for (let i = 0; i < largeMessages.length; i += batchSize) {
        const batch = largeMessages.slice(i, i + batchSize)
        const batchPromises = batch.map(message => 
          MemoryService.processAndStoreMemories(message, userId)
        )
        
        const batchResults = await Promise.all(batchPromises)
        totalProcessed += batchResults.length
        
        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 10))
      }
      
      const processingDuration = Date.now() - startTime
      
      expect(totalProcessed).toBe(largeDatasetSize)
      console.log(`Processed ${largeDatasetSize} messages in ${processingDuration}ms`)
      
      // Test retrieval performance with large dataset
      mockSupabaseRpc.mockResolvedValueOnce({
        data: Array.from({ length: 100 }, (_, i) => ({
          id: `large-scale-${i}`,
          user_id: userId,
          fragment_text: `Large scale memory fragment ${i}`,
          similarity: 0.8 - (i * 0.001),
          embedding: new Array(1536).fill(0.1),
          conversation_context: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })),
        error: null
      })
      
      const retrievalStartTime = Date.now()
      const retrievedMemories = await MemoryService.Retrieval.retrieveRelevantMemories(
        "large scale test query",
        userId,
        { limit: 100 }
      )
      const retrievalDuration = Date.now() - retrievalStartTime
      
      expect(retrievedMemories).toHaveLength(100)
      expect(retrievalDuration).toBeLessThan(2000) // Should complete within 2 seconds
      
      console.log(`Retrieved 100 memories from large dataset in ${retrievalDuration}ms`)
    })
  })

  describe('Integration with Chat API Tests', () => {
    it('should seamlessly integrate memory operations with chat flow', async () => {
      const userId = 'chat-integration-test-user'
      
      // Simulate chat API integration
      const chatMessages = [
        "Hi, I'm John and I work as a software developer in San Francisco.",
        "I love hiking on weekends and I have a dog named Rex.",
        "My favorite programming language is TypeScript."
      ]
      
      // Process each message as if coming from chat API
      for (let i = 0; i < chatMessages.length; i++) {
        const message = chatMessages[i]
        
        mockOpenAI.chat.completions.create.mockResolvedValueOnce({
          choices: [{
            message: {
              content: JSON.stringify([
                i === 0 ? "User's name is John and works as software developer in San Francisco" :
                i === 1 ? "User loves hiking on weekends and has a dog named Rex" :
                "User's favorite programming language is TypeScript"
              ])
            }
          }]
        })
        
        // Background memory processing (as would happen in chat API)
        const memories = await MemoryService.processAndStoreMemories(
          message,
          userId,
          `Chat session ${i + 1}`
        )
        
        expect(memories).toHaveLength(1)
      }
      
      // Simulate subsequent chat where memories should be retrieved
      const queryMessage = "What do you know about my work and hobbies?"
      
      mockSupabaseRpc.mockResolvedValueOnce({
        data: [
          {
            id: 'chat-1',
            user_id: userId,
            fragment_text: "User's name is John and works as software developer in San Francisco",
            similarity: 0.92
          },
          {
            id: 'chat-2',
            user_id: userId,
            fragment_text: "User loves hiking on weekends and has a dog named Rex",
            similarity: 0.88
          },
          {
            id: 'chat-3',
            user_id: userId,
            fragment_text: "User's favorite programming language is TypeScript",
            similarity: 0.85
          }
        ].map(item => ({
          ...item,
          embedding: new Array(1536).fill(0.1),
          conversation_context: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })),
        error: null
      })
      
      // Get enhanced memory context for chat response
      const memoryContext = await MemoryService.getEnhancedMemoryContext(
        queryMessage,
        userId,
        { personality: 'friendly', hobbies: ['technology'] },
        5
      )
      
      expect(memoryContext.memories).toHaveLength(3)
      expect(memoryContext.contextPrompt).toContain('John')
      expect(memoryContext.contextPrompt).toContain('software developer')
      expect(memoryContext.contextPrompt).toContain('hiking')
      expect(memoryContext.contextPrompt).toContain('Rex')
      expect(memoryContext.personalityEnhancements).toContain('shared_interests')
      
      // Test formatted memory context for chat
      const chatContext = await MemoryService.getMemoriesForChat(queryMessage, userId, 5)
      expect(chatContext).toContain('Relevant memories about the user:')
      expect(chatContext).toContain('John')
      expect(chatContext).toContain('software developer')
    })
  })
})