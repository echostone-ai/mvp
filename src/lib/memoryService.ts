// src/lib/memoryService.ts
import { OpenAI } from 'openai'
import { supabase } from './supabase'
import { 
  MemoryErrorHandler, 
  MemoryError, 
  MemoryErrorType,
  withMemoryErrorHandling 
} from './memoryErrorHandler'
import { MemoryPerformanceMonitor } from './memoryPerformanceMonitor'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

export interface MemoryFragment {
  id?: string
  userId: string
  fragmentText: string
  embedding?: number[]
  conversationContext?: {
    timestamp: string
    messageContext: string
    emotionalTone?: string
  }
  createdAt?: Date
  updatedAt?: Date
}

export class MemoryExtractionService {
  private static readonly EXTRACTION_PROMPT = `
You are an AI assistant that extracts meaningful personal information from user messages to create memory fragments for future conversations.

Your task is to identify and extract:
- Personal relationships (family, friends, colleagues, pets)
- Significant experiences and life events
- Personal preferences (hobbies, interests, dislikes)
- Important personal details (goals, fears, values)
- Emotional connections and memories

IMPORTANT RULES:
1. Only extract information that is personally meaningful and would be valuable to remember in future conversations
2. Extract complete, standalone fragments that make sense without additional context
3. Ignore casual mentions or temporary states
4. Focus on information that reveals character, relationships, or lasting preferences
5. If no meaningful personal information is found, return an empty array

Return your response as a JSON array of strings, where each string is a meaningful memory fragment.

Examples:
Input: "I love hiking with my dog Max every weekend. He's a golden retriever and gets so excited when he sees the leash."
Output: ["User loves hiking and does it every weekend", "User has a golden retriever named Max who gets excited about walks"]

Input: "It's raining today and I'm feeling tired."
Output: []

Input: "My sister Sarah is getting married next month. I'm so nervous about giving the maid of honor speech because I hate public speaking."
Output: ["User has a sister named Sarah who is getting married", "User is the maid of honor at Sarah's wedding", "User dislikes public speaking and gets nervous about it"]

Now extract memory fragments from this message:
`

  /**
   * Extracts meaningful memory fragments from a user message
   */
  static async extractMemoryFragments(
    message: string, 
    userId: string, 
    conversationContext?: string
  ): Promise<MemoryFragment[]> {
    return MemoryPerformanceMonitor.withPerformanceTracking(
      'memory_extraction',
      () => MemoryErrorHandler.withGracefulDegradation(
        async () => {
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: this.EXTRACTION_PROMPT,
            },
            {
              role: 'user',
              content: message,
            },
          ],
          temperature: 0.3, // Lower temperature for more consistent extraction
          max_tokens: 500,
        })

        const response = completion.choices[0].message.content
        if (!response) {
          throw new MemoryError(
            MemoryErrorType.MEMORY_EXTRACTION_FAILED,
            'No response from OpenAI for memory extraction'
          )
        }

        // Parse the JSON response
        let fragments: string[]
        try {
          fragments = JSON.parse(response)
        } catch (parseError) {
          const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown parse error'
          throw new MemoryError(
            MemoryErrorType.MEMORY_EXTRACTION_FAILED,
            'Failed to parse memory extraction response',
            { context: { response, parseError: errorMessage } }
          )
        }

        // Validate that we got an array of strings
        if (!Array.isArray(fragments) || !fragments.every(f => typeof f === 'string')) {
          throw new MemoryError(
            MemoryErrorType.MEMORY_EXTRACTION_FAILED,
            'Invalid memory extraction response format',
            { context: { fragments } }
          )
        }

        // Convert to MemoryFragment objects
        const timestamp = new Date().toISOString()
        return fragments.map(fragmentText => ({
          userId,
          fragmentText: fragmentText.trim(),
          conversationContext: {
            timestamp,
            messageContext: conversationContext || message.substring(0, 200),
            emotionalTone: this.detectEmotionalTone(message)
          }
        }))
        },
        () => [], // Graceful fallback - return empty array
        'memory_extraction',
        { userId, messageLength: message.length }
      ),
      { userId, messageLength: message.length }
    )
  }

  /**
   * Detects the emotional tone of a message for context
   */
  private static detectEmotionalTone(message: string): string {
    const lowerMessage = message.toLowerCase()
    
    // Simple emotion detection based on keywords
    if (lowerMessage.includes('love') || lowerMessage.includes('happy') || lowerMessage.includes('excited')) {
      return 'positive'
    }
    if (lowerMessage.includes('sad') || lowerMessage.includes('worried') || lowerMessage.includes('upset')) {
      return 'negative'
    }
    if (lowerMessage.includes('nervous') || lowerMessage.includes('anxious') || lowerMessage.includes('scared')) {
      return 'anxious'
    }
    
    return 'neutral'
  }

  /**
   * Batch extract memory fragments from multiple messages
   */
  static async batchExtractMemoryFragments(
    messages: Array<{ text: string; context?: string }>,
    userId: string
  ): Promise<MemoryFragment[]> {
    const allFragments: MemoryFragment[] = []
    
    // Process messages in batches to avoid rate limits
    const batchSize = 5
    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize)
      
      const batchPromises = batch.map(msg => 
        this.extractMemoryFragments(msg.text, userId, msg.context)
      )
      
      try {
        const batchResults = await Promise.all(batchPromises)
        batchResults.forEach(fragments => allFragments.push(...fragments))
        
        // Small delay between batches to respect rate limits
        if (i + batchSize < messages.length) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      } catch (error) {
        console.error(`Error processing batch ${i}-${i + batchSize}:`, error)
        // Continue with next batch even if one fails
      }
    }
    
    return allFragments
  }
}

export class MemoryStorageService {
  /**
   * Generates embeddings for text using OpenAI's text-embedding-3-small model
   */
  static async generateEmbedding(text: string): Promise<number[]> {
    return MemoryErrorHandler.withRetry(
      async () => {
        const response = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: text,
          encoding_format: 'float',
        })

        if (!response.data?.[0]?.embedding) {
          throw new MemoryError(
            MemoryErrorType.EMBEDDING_GENERATION_FAILED,
            'No embedding data returned from OpenAI'
          )
        }

        return response.data[0].embedding
      },
      'openai',
      { textLength: text.length, operation: 'generate_embedding' }
    )
  }

  /**
   * Generates embeddings for multiple texts in batch
   */
  static async batchGenerateEmbeddings(texts: string[]): Promise<number[][]> {
    return MemoryErrorHandler.withRetry(
      async () => {
        // OpenAI allows up to 2048 inputs per request for embeddings
        const batchSize = 100 // Conservative batch size
        const allEmbeddings: number[][] = []

        for (let i = 0; i < texts.length; i += batchSize) {
          const batch = texts.slice(i, i + batchSize)
          
          const response = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: batch,
            encoding_format: 'float',
          })

          if (!response.data || response.data.length !== batch.length) {
            throw new MemoryError(
              MemoryErrorType.EMBEDDING_GENERATION_FAILED,
              'Incomplete batch embedding response from OpenAI'
            )
          }

          const batchEmbeddings = response.data.map(item => {
            if (!item.embedding) {
              throw new MemoryError(
                MemoryErrorType.EMBEDDING_GENERATION_FAILED,
                'Missing embedding data in batch response'
              )
            }
            return item.embedding
          })
          
          allEmbeddings.push(...batchEmbeddings)

          // Small delay between batches to respect rate limits
          if (i + batchSize < texts.length) {
            await new Promise(resolve => setTimeout(resolve, 50))
          }
        }

        return allEmbeddings
      },
      'openai',
      { batchSize: texts.length, operation: 'batch_generate_embeddings' }
    )
  }

  /**
   * Stores a memory fragment with its embedding in Supabase
   */
  static async storeMemoryFragment(fragment: MemoryFragment): Promise<string> {
    return MemoryErrorHandler.withRetry(
      async () => {
        // Generate embedding if not provided
        if (!fragment.embedding) {
          fragment.embedding = await this.generateEmbedding(fragment.fragmentText)
        }

        const { data, error } = await supabase
          .from('memory_fragments')
          .insert({
            user_id: fragment.userId,
            fragment_text: fragment.fragmentText,
            embedding: fragment.embedding,
            conversation_context: fragment.conversationContext,
          })
          .select('id')
          .single()

        if (error) {
          throw MemoryErrorHandler.categorizeError(error, {
            operation: 'store_memory_fragment',
            userId: fragment.userId,
            fragmentLength: fragment.fragmentText.length
          })
        }

        if (!data?.id) {
          throw new MemoryError(
            MemoryErrorType.DATABASE_QUERY,
            'No ID returned from memory fragment insertion'
          )
        }

        return data.id
      },
      'database',
      { 
        operation: 'store_memory_fragment',
        userId: fragment.userId,
        fragmentLength: fragment.fragmentText.length
      }
    )
  }

  /**
   * Stores multiple memory fragments in batch
   */
  static async batchStoreMemoryFragments(fragments: MemoryFragment[]): Promise<string[]> {
    if (fragments.length === 0) {
      return []
    }

    return MemoryErrorHandler.withRetry(
      async () => {
        // Generate embeddings for all fragments that don't have them
        const fragmentsNeedingEmbeddings = fragments.filter(f => !f.embedding)
        if (fragmentsNeedingEmbeddings.length > 0) {
          const texts = fragmentsNeedingEmbeddings.map(f => f.fragmentText)
          const embeddings = await this.batchGenerateEmbeddings(texts)
          
          // Assign embeddings back to fragments
          fragmentsNeedingEmbeddings.forEach((fragment, index) => {
            fragment.embedding = embeddings[index]
          })
        }

        // Prepare data for insertion
        const insertData = fragments.map(fragment => ({
          user_id: fragment.userId,
          fragment_text: fragment.fragmentText,
          embedding: fragment.embedding,
          conversation_context: fragment.conversationContext,
        }))

        const { data, error } = await supabase
          .from('memory_fragments')
          .insert(insertData)
          .select('id')

        if (error) {
          throw MemoryErrorHandler.categorizeError(error, {
            operation: 'batch_store_memory_fragments',
            fragmentCount: fragments.length,
            userId: fragments[0]?.userId
          })
        }

        if (!data || data.length !== fragments.length) {
          throw new MemoryError(
            MemoryErrorType.DATABASE_QUERY,
            'Incomplete batch insertion response'
          )
        }

        return data.map(item => item.id)
      },
      'database',
      { 
        operation: 'batch_store_memory_fragments',
        fragmentCount: fragments.length,
        userId: fragments[0]?.userId
      }
    )
  }

  /**
   * Updates an existing memory fragment
   */
  static async updateMemoryFragment(
    fragmentId: string, 
    userId: string, 
    updates: Partial<Pick<MemoryFragment, 'fragmentText' | 'conversationContext'>>
  ): Promise<void> {
    return MemoryErrorHandler.withRetry(
      async () => {
        const updateData: any = {
          updated_at: new Date().toISOString(),
          ...updates
        }

        // If fragment text is being updated, regenerate embedding
        if (updates.fragmentText) {
          updateData.embedding = await this.generateEmbedding(updates.fragmentText)
        }

        const { error } = await supabase
          .from('memory_fragments')
          .update(updateData)
          .eq('id', fragmentId)
          .eq('user_id', userId) // Ensure user can only update their own fragments

        if (error) {
          throw MemoryErrorHandler.categorizeError(error, {
            operation: 'update_memory_fragment',
            fragmentId,
            userId,
            hasTextUpdate: !!updates.fragmentText
          })
        }
      },
      'database',
      { 
        operation: 'update_memory_fragment',
        fragmentId,
        userId,
        hasTextUpdate: !!updates.fragmentText
      }
    )
  }

  /**
   * Deletes a memory fragment
   */
  static async deleteMemoryFragment(fragmentId: string, userId: string): Promise<void> {
    return MemoryErrorHandler.withRetry(
      async () => {
        const { error } = await supabase
          .from('memory_fragments')
          .delete()
          .eq('id', fragmentId)
          .eq('user_id', userId) // Ensure user can only delete their own fragments

        if (error) {
          throw MemoryErrorHandler.categorizeError(error, {
            operation: 'delete_memory_fragment',
            fragmentId,
            userId
          })
        }
      },
      'database',
      { 
        operation: 'delete_memory_fragment',
        fragmentId,
        userId
      }
    )
  }

  /**
   * Deletes all memory fragments for a user
   */
  static async deleteAllUserMemories(userId: string): Promise<void> {
    return MemoryErrorHandler.withRetry(
      async () => {
        const { error } = await supabase
          .from('memory_fragments')
          .delete()
          .eq('user_id', userId)

        if (error) {
          throw MemoryErrorHandler.categorizeError(error, {
            operation: 'delete_all_user_memories',
            userId
          })
        }
      },
      'database',
      { 
        operation: 'delete_all_user_memories',
        userId
      }
    )
  }
}

export class MemoryRetrievalService {
  private static readonly DEFAULT_SIMILARITY_THRESHOLD = 0.7
  private static readonly DEFAULT_LIMIT = 10

  /**
   * Retrieves relevant memory fragments using semantic similarity search
   */
  static async retrieveRelevantMemories(
    query: string,
    userId: string,
    options: {
      limit?: number
      similarityThreshold?: number
      includeContext?: boolean
    } = {}
  ): Promise<MemoryFragment[]> {
    const {
      limit = this.DEFAULT_LIMIT,
      similarityThreshold = this.DEFAULT_SIMILARITY_THRESHOLD,
      includeContext = true
    } = options

    // Create cache key for this query
    const cacheKey = MemoryPerformanceMonitor.getCacheKey('relevant_memories', {
      query: query.substring(0, 100), // Limit query length for cache key
      userId,
      limit,
      similarityThreshold,
      includeContext
    })

    return MemoryPerformanceMonitor.withCaching(
      'relevant_memories',
      cacheKey,
      () => MemoryErrorHandler.withGracefulDegradation(
        async () => {
          // Generate embedding for the query
          const queryEmbedding = await MemoryStorageService.generateEmbedding(query)

          // Perform vector similarity search using pgvector
          const { data, error } = await supabase.rpc('match_memory_fragments', {
            query_embedding: queryEmbedding,
            match_threshold: similarityThreshold,
            match_count: limit,
            target_user_id: userId
          })

          if (error) {
            throw MemoryErrorHandler.categorizeError(error, {
              operation: 'vector_similarity_search',
              userId,
              queryLength: query.length,
              limit,
              threshold: similarityThreshold
            })
          }

          if (!data) {
            throw new MemoryError(
              MemoryErrorType.VECTOR_SEARCH_FAILED,
              'No data returned from vector similarity search'
            )
          }

          // Transform the results to MemoryFragment format
          return data.map((item: any) => ({
            id: item.id,
            userId: item.user_id,
            fragmentText: item.fragment_text,
            embedding: item.embedding,
            conversationContext: includeContext ? item.conversation_context : undefined,
            createdAt: new Date(item.created_at),
            updatedAt: new Date(item.updated_at),
            similarity: item.similarity // Include similarity score for debugging/ranking
          }))
        },
        async () => {
          // Fallback to text search if vector search fails
          console.warn('Vector search failed, falling back to text search')
          return this.searchMemoriesByText(query, userId, limit)
        },
        'retrieve_relevant_memories',
        { userId, queryLength: query.length, limit, threshold: similarityThreshold }
      ),
      { userId, queryLength: query.length, limit, threshold: similarityThreshold }
    )
  }

  /**
   * Retrieves all memory fragments for a user (for management UI)
   */
  static async getUserMemories(
    userId: string,
    options: {
      limit?: number
      offset?: number
      orderBy?: 'created_at' | 'updated_at'
      orderDirection?: 'asc' | 'desc'
    } = {}
  ): Promise<MemoryFragment[]> {
    const {
      limit = 100,
      offset = 0,
      orderBy = 'created_at',
      orderDirection = 'desc'
    } = options

    // Create cache key for user memories
    const cacheKey = MemoryPerformanceMonitor.getCacheKey('user_memories', {
      userId,
      limit,
      offset,
      orderBy,
      orderDirection
    })

    return MemoryPerformanceMonitor.withCaching(
      'user_memories',
      cacheKey,
      () => MemoryErrorHandler.withRetry(
        async () => {
          let query = supabase
          .from('memory_fragments')
          .select('*')
          .eq('user_id', userId)
          .order(orderBy, { ascending: orderDirection === 'asc' })

        if (limit > 0) {
          query = query.range(offset, offset + limit - 1)
        }

        const { data, error } = await query

        if (error) {
          throw MemoryErrorHandler.categorizeError(error, {
            operation: 'get_user_memories',
            userId,
            limit,
            offset,
            orderBy,
            orderDirection
          })
        }

        if (!data) {
          throw new MemoryError(
            MemoryErrorType.DATABASE_QUERY,
            'No data returned from user memories query'
          )
        }

        return data.map(item => ({
          id: item.id,
          userId: item.user_id,
          fragmentText: item.fragment_text,
          embedding: item.embedding,
          conversationContext: item.conversation_context,
          createdAt: new Date(item.created_at),
          updatedAt: new Date(item.updated_at)
        }))
        },
        'database',
        { 
          operation: 'get_user_memories',
          userId,
          limit,
          offset,
          orderBy,
          orderDirection
        }
      ),
      { userId, limit, offset, orderBy, orderDirection }
    )
  }

  /**
   * Gets memory fragment by ID with user isolation
   */
  static async getMemoryFragment(fragmentId: string, userId: string): Promise<MemoryFragment | null> {
    return MemoryErrorHandler.withRetry(
      async () => {
        const { data, error } = await supabase
          .from('memory_fragments')
          .select('*')
          .eq('id', fragmentId)
          .eq('user_id', userId) // Ensure user can only access their own fragments
          .single()

        if (error) {
          if (error.code === 'PGRST116') {
            // No rows returned - this is expected behavior, not an error
            return null
          }
          throw MemoryErrorHandler.categorizeError(error, {
            operation: 'get_memory_fragment',
            fragmentId,
            userId
          })
        }

        if (!data) {
          return null
        }

        return {
          id: data.id,
          userId: data.user_id,
          fragmentText: data.fragment_text,
          embedding: data.embedding,
          conversationContext: data.conversation_context,
          createdAt: new Date(data.created_at),
          updatedAt: new Date(data.updated_at)
        }
      },
      'database',
      { 
        operation: 'get_memory_fragment',
        fragmentId,
        userId
      }
    )
  }

  /**
   * Searches memory fragments by text content (fallback when vector search fails)
   */
  static async searchMemoriesByText(
    searchText: string,
    userId: string,
    limit: number = 10
  ): Promise<MemoryFragment[]> {
    return MemoryErrorHandler.withGracefulDegradation(
      async () => {
        const { data, error } = await supabase
          .from('memory_fragments')
          .select('*')
          .eq('user_id', userId)
          .textSearch('fragment_text', searchText)
          .order('created_at', { ascending: false })
          .limit(limit)

        if (error) {
          throw MemoryErrorHandler.categorizeError(error, {
            operation: 'search_memories_by_text',
            userId,
            searchText,
            limit
          })
        }

        if (!data) {
          throw new MemoryError(
            MemoryErrorType.DATABASE_QUERY,
            'No data returned from text search query'
          )
        }

        return data.map(item => ({
          id: item.id,
          userId: item.user_id,
          fragmentText: item.fragment_text,
          embedding: item.embedding,
          conversationContext: item.conversation_context,
          createdAt: new Date(item.created_at),
          updatedAt: new Date(item.updated_at)
        }))
      },
      () => [], // Graceful fallback - return empty array
      'search_memories_by_text',
      { userId, searchText, limit }
    )
  }

  /**
   * Gets memory statistics for a user
   */
  static async getMemoryStats(userId: string): Promise<{
    totalFragments: number
    oldestMemory?: Date
    newestMemory?: Date
  }> {
    return MemoryErrorHandler.withRetry(
      async () => {
        const { data, error } = await supabase
          .from('memory_fragments')
          .select('created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: true })

        if (error) {
          throw MemoryErrorHandler.categorizeError(error, {
            operation: 'get_memory_stats',
            userId
          })
        }

        if (!data) {
          throw new MemoryError(
            MemoryErrorType.DATABASE_QUERY,
            'No data returned from memory stats query'
          )
        }

        return {
          totalFragments: data.length,
          oldestMemory: data.length > 0 ? new Date(data[0].created_at) : undefined,
          newestMemory: data.length > 0 ? new Date(data[data.length - 1].created_at) : undefined
        }
      },
      'database',
      { 
        operation: 'get_memory_stats',
        userId
      }
    )
  }
}

/**
 * Main Memory Service that combines all memory operations
 */
export class MemoryService {
  // Re-export all services for convenience
  static readonly Extraction = MemoryExtractionService
  static readonly Storage = MemoryStorageService
  static readonly Retrieval = MemoryRetrievalService

  /**
   * Complete workflow: extract, store, and return stored fragments
   */
  static async processAndStoreMemories(
    message: string,
    userId: string,
    conversationContext?: string
  ): Promise<MemoryFragment[]> {
    return MemoryErrorHandler.withGracefulDegradation(
      async () => {
        // Extract memory fragments
        const fragments = await MemoryExtractionService.extractMemoryFragments(
          message,
          userId,
          conversationContext
        )

        if (fragments.length === 0) {
          return []
        }

        // Store fragments with embeddings
        const fragmentIds = await MemoryStorageService.batchStoreMemoryFragments(fragments)

        // Return the stored fragments with their IDs
        return fragments.map((fragment, index) => ({
          ...fragment,
          id: fragmentIds[index]
        }))
      },
      () => [], // Graceful fallback - return empty array
      'process_and_store_memories',
      { userId, messageLength: message.length }
    )
  }

  /**
   * Retrieve and format memories for chat context
   */
  static async getMemoriesForChat(
    query: string,
    userId: string,
    maxMemories: number = 5
  ): Promise<string> {
    return MemoryErrorHandler.withGracefulDegradation(
      async () => {
        const memories = await MemoryRetrievalService.retrieveRelevantMemories(
          query,
          userId,
          { limit: maxMemories, includeContext: false }
        )

        if (memories.length === 0) {
          return ''
        }

        // Format memories for inclusion in chat prompt
        const memoryText = memories
          .map(memory => `- ${memory.fragmentText}`)
          .join('\n')

        return `\nRelevant memories about the user:\n${memoryText}\n`
      },
      () => '', // Graceful fallback - return empty string
      'get_memories_for_chat',
      { userId, queryLength: query.length, maxMemories }
    )
  }

  /**
   * Enhanced memory integration for natural conversation flow
   */
  static async getEnhancedMemoryContext(
    query: string,
    userId: string,
    profileData: any,
    maxMemories: number = 5
  ): Promise<{
    memories: MemoryFragment[]
    contextPrompt: string
    personalityEnhancements: string[]
  }> {
    return MemoryErrorHandler.withGracefulDegradation(
      async () => {
        const memories = await MemoryRetrievalService.retrieveRelevantMemories(
          query,
          userId,
          { limit: maxMemories, similarityThreshold: 0.7, includeContext: true }
        )

        if (memories.length === 0) {
          return {
            memories: [],
            contextPrompt: '',
            personalityEnhancements: []
          }
        }

        // Analyze memories for personality enhancement opportunities
        const personalityEnhancements = this.analyzeMemoriesForPersonality(memories, profileData)
        
        // Create sophisticated context prompt
        const contextPrompt = this.buildEnhancedMemoryPrompt(memories, personalityEnhancements)

        return {
          memories,
          contextPrompt,
          personalityEnhancements
        }
      },
      () => ({
        memories: [],
        contextPrompt: '',
        personalityEnhancements: []
      }), // Graceful fallback - return empty context
      'get_enhanced_memory_context',
      { userId, queryLength: query.length, maxMemories }
    )
  }

  /**
   * Analyze memories to identify personality enhancement opportunities
   */
  private static analyzeMemoriesForPersonality(
    memories: MemoryFragment[],
    profileData: any
  ): string[] {
    const enhancements: string[] = []
    
    // Look for emotional connections
    const emotionalMemories = memories.filter(m => 
      m.conversationContext?.emotionalTone && 
      m.conversationContext.emotionalTone !== 'neutral'
    )
    
    if (emotionalMemories.length > 0) {
      enhancements.push('emotional_connection')
    }

    // Look for shared interests/hobbies
    const hobbies = profileData?.hobbies || []
    const hasSharedInterests = memories.some(m => 
      hobbies.some((hobby: string) => 
        m.fragmentText.toLowerCase().includes(hobby.toLowerCase())
      )
    )
    
    if (hasSharedInterests) {
      enhancements.push('shared_interests')
    }

    // Look for relationship mentions
    const hasRelationshipMentions = memories.some(m =>
      /family|friend|partner|relationship|love|close|important/i.test(m.fragmentText)
    )
    
    if (hasRelationshipMentions) {
      enhancements.push('relationship_context')
    }

    // Look for personal struggles or challenges
    const hasPersonalChallenges = memories.some(m =>
      /difficult|hard|struggle|challenge|problem|worry|stress/i.test(m.fragmentText)
    )
    
    if (hasPersonalChallenges) {
      enhancements.push('supportive_context')
    }

    return enhancements
  }

  /**
   * Build enhanced memory prompt with personality integration
   */
  private static buildEnhancedMemoryPrompt(
    memories: MemoryFragment[],
    personalityEnhancements: string[]
  ): string {
    const memoryFragments = memories.map(m => m.fragmentText).join('\n- ')
    
    let prompt = `\n\nPERSONAL KNOWLEDGE ABOUT THIS USER:
You know these specific details about this person from your ongoing relationship:
- ${memoryFragments}

IMPORTANT CONVERSATION GUIDELINES:
- Reference these details naturally when relevant to the conversation
- Use phrases like "I know you love..." or "Since you mentioned..." or "Given that you..."
- Make connections between their interests, experiences, and current topics
- Show genuine interest in their life by asking follow-up questions about things they've shared
- Be specific - mention names, places, activities, and details they've told you about
- Act like a close friend who remembers important things about them

`

    // Add personality-specific guidance based on memory analysis
    if (personalityEnhancements.includes('emotional_connection')) {
      prompt += `EMOTIONAL CONTEXT: This person has shared meaningful emotional experiences with you. Show empathy and emotional intelligence. Reference their feelings and experiences when appropriate.\n\n`
    }

    if (personalityEnhancements.includes('shared_interests')) {
      prompt += `SHARED INTERESTS: You and this person have common interests. Make connections between your shared passions and current topics. Show enthusiasm about things you both enjoy.\n\n`
    }

    if (personalityEnhancements.includes('relationship_context')) {
      prompt += `RELATIONSHIPS: This person has told you about important people in their life. Ask about these relationships and show you care about the people who matter to them.\n\n`
    }

    if (personalityEnhancements.includes('supportive_context')) {
      prompt += `SUPPORT NEEDED: This person has shared challenges or difficulties with you. Be supportive, encouraging, and check in on how they're handling these situations.\n\n`
    }

    prompt += `Remember: You're not just an AI assistant - you're someone who knows this person personally. Use your knowledge of them to have meaningful, personalized conversations that show you truly know and care about them as an individual.`

    return prompt
  }
}