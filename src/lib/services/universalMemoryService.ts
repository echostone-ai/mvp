/**
 * Universal Memory Service
 * Provides memory context for all avatars with graceful fallbacks
 * System-wide improvements that benefit all users
 */

import { MemoryService } from '../memoryService'
import { MemoryQueryOptimizer } from '../memoryQueryOptimizer'
import { advancedMemoryService } from './advancedMemoryService'

export interface UniversalMemoryContext {
  memoryContext: string
  retrievalTimeMs: number
  memoryCount: number
  totalTokens?: number
  cacheHit?: boolean
  fallbackUsed?: boolean
  continuityContext?: string
}

export class UniversalMemoryService {
  /**
   * Retrieve memory context for any avatar with intelligent fallbacks
   * System-wide memory retrieval that works for all users
   */
  static async getMemoryContext(
    query: string,
    userId: string,
    avatarId: string,
    options: {
      maxMemories?: number
      sessionId?: string
      includePersonalFallback?: boolean
      avatarName?: string
    } = {}
  ): Promise<UniversalMemoryContext> {
    const startTime = Date.now()
    const { maxMemories = 6, sessionId, includePersonalFallback = false, avatarName } = options

    try {
      console.log(`[UniversalMemory] Retrieving memories for avatar ${avatarId}, user ${userId}`)
      
      // Try advanced memory service first
      const result = await advancedMemoryService.retrieveRankedMemories({
        query,
        userId,
        avatarId,
        maxMemories,
        sessionId
      })
      
      let memoryContext = ''
      if (result.memories.length > 0) {
        const memoryLines = result.memories.map((memory) => {
          const score = memory.finalScore.toFixed(2)
          const topics = memory.rankingMetadata.topicTags.slice(0, 2).join(', ')
          return `- ${memory.fragmentText} [relevance: ${score}, topics: ${topics}]`
        })
        memoryContext = `Relevant memories:\n${memoryLines.join('\n')}`
      }
      
      // If no memories found and fallback is enabled, provide contextual guidance
      if (result.memories.length === 0 && includePersonalFallback) {
        memoryContext = this.generateContextualFallback(query, avatarName || 'Assistant')
      }
      
      const totalTokens = result.memories.length > 0 
        ? result.memories.reduce((sum, memory) => {
            const words = memory.fragmentText.split(' ').length
            return sum + Math.ceil(words * 1.3)
          }, 0)
        : Math.ceil(memoryContext.split(' ').length * 1.3)
      
      console.log(`[UniversalMemory] Retrieved ${result.memories.length} memories in ${result.retrievalTimeMs}ms`)
      
      return {
        memoryContext,
        retrievalTimeMs: result.retrievalTimeMs,
        memoryCount: Math.max(result.memories.length, memoryContext ? 1 : 0),
        totalTokens,
        cacheHit: false,
        fallbackUsed: result.memories.length === 0 && includePersonalFallback
      }
      
    } catch (error) {
      console.error('[UniversalMemory] Advanced memory retrieval failed, trying basic retrieval:', error)
      
      // Fallback to basic memory retrieval
      try {
        const result = await MemoryQueryOptimizer.retrieveOptimizedMemories({
          query,
          userId,
          avatarId,
          maxFragments: maxMemories,
          maxTokens: 300,
          similarityThreshold: 0.7
        })
        
        let memoryContext = ''
        if (result.fragments.length > 0) {
          const memoryLines = result.fragments.map(fragment => `- ${fragment.fragmentText}`)
          memoryContext = `Relevant memories:\n${memoryLines.join('\n')}`
        } else if (includePersonalFallback) {
          memoryContext = this.generateContextualFallback(query, avatarName || 'Assistant')
        }
        
        return {
          memoryContext,
          retrievalTimeMs: result.retrievalTimeMs,
          memoryCount: Math.max(result.fragments.length, memoryContext ? 1 : 0),
          totalTokens: result.totalTokens || Math.ceil(memoryContext.split(' ').length * 1.3),
          cacheHit: result.cacheHit,
          fallbackUsed: true
        }
        
      } catch (fallbackError) {
        console.error('[UniversalMemory] All memory retrieval methods failed:', fallbackError)
        
        // Final graceful fallback
        const fallbackContext = includePersonalFallback 
          ? this.generateContextualFallback(query, avatarName || 'Assistant')
          : ''
        
        return {
          memoryContext: fallbackContext,
          retrievalTimeMs: Date.now() - startTime,
          memoryCount: fallbackContext ? 1 : 0,
          totalTokens: Math.ceil(fallbackContext.split(' ').length * 1.3),
          cacheHit: false,
          fallbackUsed: true
        }
      }
    }
  }

  /**
   * Generate contextual fallback when no memories exist
   * Provides helpful context based on query patterns
   */
  private static generateContextualFallback(query: string, avatarName: string): string {
    const lowerQuery = query.toLowerCase()
    
    // Personal/relationship queries
    if (lowerQuery.includes('family') || lowerQuery.includes('relationship') || lowerQuery.includes('partner') || lowerQuery.includes('spouse')) {
      return `Context: This appears to be a personal question about relationships or family. ${avatarName} should respond authentically based on their character background.`
    }
    
    // Location/travel queries
    if (lowerQuery.includes('live') || lowerQuery.includes('location') || lowerQuery.includes('travel') || lowerQuery.includes('move') || lowerQuery.includes('city')) {
      return `Context: This is a question about location or travel. ${avatarName} should reference their current location and any relevant background about where they've lived.`
    }
    
    // Work/career queries
    if (lowerQuery.includes('work') || lowerQuery.includes('job') || lowerQuery.includes('career') || lowerQuery.includes('profession')) {
      return `Context: This is a work-related question. ${avatarName} should discuss their professional background and current work situation.`
    }
    
    // Political/opinion queries
    if (lowerQuery.includes('politic') || lowerQuery.includes('trump') || lowerQuery.includes('election') || lowerQuery.includes('government')) {
      return `Context: This is a political question. ${avatarName} should respond with their authentic perspective while being respectful of different viewpoints.`
    }
    
    // Hobby/interest queries
    if (lowerQuery.includes('hobby') || lowerQuery.includes('interest') || lowerQuery.includes('like') || lowerQuery.includes('enjoy')) {
      return `Context: This is about personal interests or hobbies. ${avatarName} should share their authentic interests and passions.`
    }
    
    // Default contextual guidance
    return `Context: This appears to be a personal question. ${avatarName} should respond authentically based on their character and background, sharing relevant personal experiences or perspectives.`
  }

  /**
   * Get comprehensive memory context including conversation continuity
   * System-wide method for all avatars
   */
  static async getComprehensiveMemoryContext(
    query: string,
    userId: string,
    avatarId: string,
    options: {
      maxMemories?: number
      sessionId?: string
      includePersonalFallback?: boolean
      avatarName?: string
    } = {}
  ): Promise<UniversalMemoryContext> {
    const startTime = Date.now()
    
    try {
      // Run memory retrieval and continuity context in parallel
      const [memoryResult, continuityContext] = await Promise.all([
        this.getMemoryContext(query, userId, avatarId, options),
        this.getConversationContinuityContext(userId, avatarId)
      ])
      
      const totalTimeMs = Date.now() - startTime
      
      return {
        ...memoryResult,
        continuityContext,
        retrievalTimeMs: totalTimeMs
      }
    } catch (error) {
      console.error('[UniversalMemory] Failed to get comprehensive context:', error)
      
      return {
        memoryContext: options.includePersonalFallback 
          ? this.generateContextualFallback(query, options.avatarName || 'Assistant')
          : '',
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
   * Get conversation continuity context for any user/avatar
   */
  private static async getConversationContinuityContext(
    userId: string,
    avatarId: string,
    maxRecentMemories: number = 3
  ): Promise<string> {
    try {
      // Get recent memories to understand conversation flow
      const recentMemories = await MemoryService.Retrieval.getUserMemories(
        userId,
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
          const prefix = type === 'user_message' ? 'User said:' : 'Assistant said:'
          return `${prefix} ${memory.fragmentText}`
        })
        .slice(-6) // Last 6 exchanges max
      
      if (contextLines.length > 0) {
        return `\nRecent conversation:\n${contextLines.join('\n')}\n`
      }
      
      return ''
    } catch (error) {
      console.error('[UniversalMemory] Failed to get continuity context:', error)
      return ''
    }
  }

  /**
   * Store conversation turn for any user/avatar
   */
  static async storeConversationTurn(
    userMessage: string,
    assistantResponse: string,
    userId: string,
    avatarId: string,
    conversationId: string,
    source: string = 'chat'
  ): Promise<void> {
    // Fire-and-forget async storage
    setImmediate(async () => {
      try {
        console.log(`[UniversalMemory] Storing conversation turn for user ${userId}, avatar ${avatarId}`)
        
        // Store both user message and assistant response as separate memory fragments
        await Promise.all([
          MemoryService.processAndStoreMemories(
            userMessage,
            userId,
            {
              source,
              conversationId,
              type: 'user_message',
              timestamp: new Date().toISOString()
            },
            undefined, // extractionThreshold
            avatarId
          ),
          MemoryService.processAndStoreMemories(
            assistantResponse,
            userId,
            {
              source,
              conversationId,
              type: 'assistant_response',
              timestamp: new Date().toISOString()
            },
            undefined, // extractionThreshold
            avatarId
          )
        ])
        
        console.log('[UniversalMemory] Conversation turn stored successfully')
      } catch (error) {
        console.error('[UniversalMemory] Failed to store conversation turn:', error)
        // Don't throw - this is fire-and-forget
      }
    })
  }

  /**
   * Warm memory cache for any avatar
   */
  static async warmMemoryCache(userId: string, avatarId: string): Promise<void> {
    try {
      console.log(`[UniversalMemory] Warming memory cache for user ${userId}, avatar ${avatarId}`)
      
      // Define common conversation topics that apply to any avatar
      const commonQueries = [
        'personal information',
        'background and history',
        'interests and hobbies',
        'work and career',
        'relationships and family',
        'recent conversations',
        'preferences and opinions',
        'life experiences',
        'goals and aspirations',
        'current situation'
      ]
      
      await MemoryQueryOptimizer.warmCache(userId, avatarId, commonQueries)
      
      console.log('[UniversalMemory] Memory cache warming completed')
    } catch (error) {
      console.error('[UniversalMemory] Failed to warm memory cache:', error)
      // Don't throw - cache warming is optional optimization
    }
  }
}