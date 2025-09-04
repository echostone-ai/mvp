// src/lib/jonathanDemoMemoryService.ts
import { MemoryService } from './memoryService'
import { MemoryQueryOptimizer, OptimizedMemoryQuery } from './memoryQueryOptimizer'
import { advancedMemoryService } from './services/advancedMemoryService'

const DEMO_SYSTEM_USER_ID = process.env.DEMO_SYSTEM_USER_ID || process.env.SYSTEM_USER_ID || 'demo-system-user'
const AVATAR_SLUG = 'jonathan-demo'

export interface ConversationMemoryContext {
  memoryContext: string
  retrievalTimeMs: number
  memoryCount: number
  totalTokens?: number
  cacheHit?: boolean
  fallbackUsed?: boolean
}

export class JonathanDemoMemoryService {
  /**
   * Get demo personal information based on query keywords
   */
  private static getDemoPersonalInfo(query: string): string {
    const lowerQuery = query.toLowerCase()
    let personalInfo = []
    
    // Political/Trump related
    if (lowerQuery.includes('trump') || lowerQuery.includes('politic') || lowerQuery.includes('america') || lowerQuery.includes('leave') || lowerQuery.includes('move')) {
      personalInfo.push('- I left America in 2016 because of Trump and the political climate - it was just too much negativity and division for me')
      personalInfo.push('- Moving to Sofia, Bulgaria was one of the best decisions I ever made - much more peaceful here')
    }
    
    // Family/relationship
    if (lowerQuery.includes('krissy') || lowerQuery.includes('partner') || lowerQuery.includes('girlfriend') || lowerQuery.includes('relationship')) {
      personalInfo.push('- Krissy is my amazing partner - we moved to Sofia together and she makes everything better')
      personalInfo.push('- We love exploring Bulgaria together and have found such a great community here')
    }
    
    // Romeo/pet
    if (lowerQuery.includes('romeo') || lowerQuery.includes('dog') || lowerQuery.includes('pet') || lowerQuery.includes('poodle')) {
      personalInfo.push('- Romeo is my toy poodle and absolute best friend - he has so much personality')
      personalInfo.push('- Romeo thinks he runs the house and honestly, he probably does')
    }
    
    // Location/travel
    if (lowerQuery.includes('sofia') || lowerQuery.includes('bulgaria') || lowerQuery.includes('live') || lowerQuery.includes('travel')) {
      personalInfo.push('- I currently live in Sofia, Bulgaria - moved here from Austin, Texas')
      personalInfo.push('- Sofia has this amazing mix of history and modern life, plus the cost of living is incredible')
    }
    
    // Writing/work
    if (lowerQuery.includes('writing') || lowerQuery.includes('work') || lowerQuery.includes('job') || lowerQuery.includes('career')) {
      personalInfo.push('- I work as a freelance writer and love the flexibility it gives me')
      personalInfo.push('- Living in Bulgaria lets me stretch my income much further than in the US')
    }
    
    // If no specific matches, provide general info
    if (personalInfo.length === 0) {
      personalInfo.push('- I moved from Austin, Texas to Sofia, Bulgaria with my partner Krissy and our toy poodle Romeo')
      personalInfo.push('- I left the US in 2016 due to the political climate and have been much happier in Europe')
    }
    
    return personalInfo.length > 0 
      ? `Personal information about Jonathan:\n${personalInfo.join('\n')}`
      : ''
  }

  /**
   * Retrieves relevant memories for jonathan-demo conversations with advanced ranking
   * Ensures <200ms overhead as per requirement 4.2
   * Implements requirement 4.3: rank fragments for conversational relevance before injection
   */
  static async getMemoryContextForQuery(
    query: string,
    avatarId: string,
    maxMemories: number = 6,
    sessionId?: string
  ): Promise<ConversationMemoryContext> {
    try {
      console.log('[JonathanDemoMemory] Retrieving memories with advanced ranking for query:', query.substring(0, 50) + '...')
      
      // Use advanced memory service for ranking and relevance scoring
      const result = await advancedMemoryService.retrieveRankedMemories({
        query,
        userId: DEMO_SYSTEM_USER_ID,
        avatarId,
        maxMemories,
        sessionId
      })
      
      // Format memories for chat context with ranking information
      let memoryContext = ''
      if (result.memories.length > 0) {
        const memoryLines = result.memories.map((memory, index) => {
          const score = memory.finalScore.toFixed(2)
          const topics = memory.rankingMetadata.topicTags.slice(0, 2).join(', ')
          return `- ${memory.fragmentText} [relevance: ${score}, topics: ${topics}]`
        })
        memoryContext = `Relevant memories about the user (ranked by conversational relevance):\n${memoryLines.join('\n')}`
      }
      
      console.log(`[JonathanDemoMemory] Retrieved ${result.memories.length} ranked memories in ${result.retrievalTimeMs}ms`)
      
      // If no memories found, add demo personal information
      if (result.memories.length === 0) {
        console.log(`[JonathanDemoMemory] No memories found, using demo personal information`)
        memoryContext = this.getDemoPersonalInfo(query)
      } else {
        console.log(`[JonathanDemoMemory] Ranking metadata:`, {
          avgRelevance: result.rankingMetadata.averageRelevanceScore.toFixed(3),
          avgFreshness: result.rankingMetadata.averageFreshnessScore.toFixed(3),
          topTopics: result.rankingMetadata.topTopics.slice(0, 3),
          emotionalTone: result.rankingMetadata.dominantEmotionalTone
        })
      }
      
      // Ensure we meet the <200ms requirement
      if (result.retrievalTimeMs > 200) {
        console.warn(`[JonathanDemoMemory] Memory retrieval took ${result.retrievalTimeMs}ms, exceeding 200ms target`)
      }
      
      // Calculate total tokens (rough estimation)
      const totalTokens = result.memories.length > 0 
        ? result.memories.reduce((sum, memory) => {
            const words = memory.fragmentText.split(' ').length
            return sum + Math.ceil(words * 1.3)
          }, 0)
        : Math.ceil(memoryContext.split(' ').length * 1.3)
      
      return {
        memoryContext,
        retrievalTimeMs: result.retrievalTimeMs,
        memoryCount: Math.max(result.memories.length, memoryContext ? 1 : 0),
        totalTokens,
        cacheHit: false, // Advanced ranking doesn't use simple caching
        fallbackUsed: result.memories.length === 0
      }
    } catch (error) {
      console.error('[JonathanDemoMemory] Advanced memory retrieval failed, falling back to basic retrieval:', error)
      
      // Fallback to basic memory retrieval
      try {
        const result = await MemoryQueryOptimizer.retrieveOptimizedMemories({
          query,
          userId: DEMO_SYSTEM_USER_ID,
          avatarId,
          maxFragments: maxMemories,
          maxTokens: 300,
          similarityThreshold: 0.7
        })
        
        let memoryContext = ''
        if (result.fragments.length > 0) {
          const memoryLines = result.fragments.map(fragment => `- ${fragment.fragmentText}`)
          memoryContext = `Relevant memories about the user:\n${memoryLines.join('\n')}`
        }
        
        return {
          memoryContext,
          retrievalTimeMs: result.retrievalTimeMs,
          memoryCount: result.fragments.length,
          totalTokens: result.totalTokens,
          cacheHit: result.cacheHit,
          fallbackUsed: true
        }
      } catch (fallbackError) {
        console.error('[JonathanDemoMemory] Fallback memory retrieval also failed:', fallbackError)
        
        // Final graceful fallback - return empty context
        return {
          memoryContext: '',
          retrievalTimeMs: 0,
          memoryCount: 0,
          totalTokens: 0,
          cacheHit: false,
          fallbackUsed: true
        }
      }
    }
  }

  /**
   * Stores conversation turn asynchronously after response generation
   * Implements requirement 4.3 for asynchronous memory storage
   */
  static async storeConversationTurnAsync(
    userMessage: string,
    assistantResponse: string,
    avatarId: string,
    conversationId: string
  ): Promise<void> {
    // Fire-and-forget async storage to not block the conversation
    setImmediate(async () => {
      try {
        console.log('[JonathanDemoMemory] Storing conversation turn asynchronously...')
        
        // Store both user message and assistant response as separate memory fragments
        await Promise.all([
          MemoryService.processAndStoreMemories(
            userMessage,
            DEMO_SYSTEM_USER_ID,
            {
              source: 'jonathan-demo',
              conversationId,
              type: 'user_message',
              timestamp: new Date().toISOString()
            },
            undefined, // extractionThreshold
            avatarId
          ),
          MemoryService.processAndStoreMemories(
            assistantResponse,
            DEMO_SYSTEM_USER_ID,
            {
              source: 'jonathan-demo',
              conversationId,
              type: 'assistant_response',
              timestamp: new Date().toISOString()
            },
            undefined, // extractionThreshold
            avatarId
          )
        ])
        
        console.log('[JonathanDemoMemory] Conversation turn stored successfully')
      } catch (error) {
        console.error('[JonathanDemoMemory] Failed to store conversation turn:', error)
        // Don't throw - this is fire-and-forget
      }
    })
  }

  /**
   * Gets conversation continuity context from recent memories
   * Helps maintain conversation flow across sessions
   */
  static async getConversationContinuityContext(
    avatarId: string,
    maxRecentMemories: number = 3
  ): Promise<string> {
    try {
      console.log('[JonathanDemoMemory] Getting conversation continuity context...')
      
      // Get recent memories to understand conversation flow
      const recentMemories = await MemoryService.Retrieval.getUserMemories(
        DEMO_SYSTEM_USER_ID,
        {
          limit: maxRecentMemories,
          orderBy: 'created_at',
          orderDirection: 'desc',
          avatarId
        }
      )
      
      if (recentMemories.length === 0) {
        return ''
      }
      
      // Format recent conversation context
      const contextLines = recentMemories
        .reverse() // Show chronological order
        .map(memory => {
          const context = memory.conversationContext as any
          const type = context?.type || 'unknown'
          const prefix = type === 'user_message' ? 'User said:' : 'Jonathan said:'
          return `${prefix} ${memory.fragmentText}`
        })
        .slice(-6) // Last 6 exchanges max
      
      if (contextLines.length > 0) {
        return `\nRecent conversation context:\n${contextLines.join('\n')}\n`
      }
      
      return ''
    } catch (error) {
      console.error('[JonathanDemoMemory] Failed to get continuity context:', error)
      return ''
    }
  }

  /**
   * Combines memory context and continuity context for comprehensive conversation context
   */
  static async getComprehensiveMemoryContext(
    query: string,
    avatarId: string
  ): Promise<ConversationMemoryContext & { continuityContext: string }> {
    const startTime = Date.now()
    
    try {
      // Run memory retrieval and continuity context in parallel
      const [memoryResult, continuityContext] = await Promise.all([
        this.getMemoryContextForQuery(query, avatarId),
        this.getConversationContinuityContext(avatarId)
      ])
      
      const totalTimeMs = Date.now() - startTime
      
      console.log(`[JonathanDemoMemory] Comprehensive context retrieved in ${totalTimeMs}ms`)
      
      return {
        ...memoryResult,
        continuityContext,
        retrievalTimeMs: totalTimeMs
      }
    } catch (error) {
      console.error('[JonathanDemoMemory] Failed to get comprehensive context:', error)
      
      return {
        memoryContext: '',
        continuityContext: '',
        retrievalTimeMs: Date.now() - startTime,
        memoryCount: 0,
        totalTokens: 0,
        cacheHit: false,
        fallbackUsed: true
      }
    }
  }

  /**
   * Warm memory cache on first conversation turn
   * Implements requirement for memory cache warming
   */
  static async warmMemoryCache(avatarId: string): Promise<void> {
    try {
      console.log('[JonathanDemoMemory] Warming memory cache for avatar:', avatarId)
      
      // Define common conversation starters and topics for Jonathan demo
      const commonQueries = [
        'personal information about the user',
        'family and relationships',
        'hobbies and interests',
        'work and career',
        'recent conversations',
        'user preferences',
        'life experiences',
        'goals and aspirations'
      ]
      
      await MemoryQueryOptimizer.warmCache(DEMO_SYSTEM_USER_ID, avatarId, commonQueries)
      
      console.log('[JonathanDemoMemory] Memory cache warming completed')
    } catch (error) {
      console.error('[JonathanDemoMemory] Failed to warm memory cache:', error)
      // Don't throw - cache warming is optional optimization
    }
  }

  /**
   * Get memory performance metrics for monitoring
   */
  static getPerformanceMetrics() {
    return MemoryQueryOptimizer.getPerformanceMetrics()
  }

  /**
   * Check if memory retrieval meets performance SLA
   */
  static checkPerformanceSLA() {
    return MemoryQueryOptimizer.checkPerformanceSLA()
  }

  /**
   * Start a conversation session for topic tracking and advanced ranking
   * Enables conversation context awareness for better memory relevance
   */
  static startConversationSession(sessionId: string, avatarId: string): void {
    advancedMemoryService.startConversationSession(sessionId, DEMO_SYSTEM_USER_ID, avatarId)
  }

  /**
   * Get conversation context for a session
   */
  static getConversationContext(sessionId: string) {
    return advancedMemoryService.getConversationContext(sessionId)
  }

  /**
   * Run memory maintenance (deduplication and archival) for jonathan-demo
   */
  static async runMemoryMaintenance(avatarId: string) {
    return advancedMemoryService.runMemoryMaintenance(DEMO_SYSTEM_USER_ID, avatarId)
  }

  /**
   * Get memory health report for jonathan-demo
   */
  static async getMemoryHealthReport(avatarId: string) {
    return advancedMemoryService.getMemoryHealthReport(DEMO_SYSTEM_USER_ID, avatarId)
  }
}