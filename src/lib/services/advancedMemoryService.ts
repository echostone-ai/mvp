// src/lib/services/advancedMemoryService.ts
// Task 13: Integrated advanced memory ranking and relevance scoring service

import { MemoryFragment } from '../memoryService'
import { AdvancedMemoryRanking, RankedMemoryFragment, ConversationContext } from './advancedMemoryRanking'
import { ConversationTopicTracker } from './conversationTopicTracker'
import { MemoryArchivalService, ArchivalResult } from './memoryArchivalService'
import { MemoryDeduplicationService, DeduplicationResult } from './memoryDeduplicationService'

export interface AdvancedMemoryQuery {
  query: string
  userId: string
  avatarId?: string
  sessionId?: string
  maxMemories?: number
  includeArchived?: boolean
  rankingConfig?: {
    relevanceWeight?: number
    freshnessWeight?: number
    topicWeight?: number
    contextWeight?: number
  }
}

export interface AdvancedMemoryResult {
  memories: RankedMemoryFragment[]
  conversationContext: ConversationContext
  retrievalTimeMs: number
  totalMemoriesAnalyzed: number
  rankingMetadata: {
    averageRelevanceScore: number
    averageFreshnessScore: number
    averageTopicScore: number
    averageContextScore: number
    topTopics: string[]
    dominantEmotionalTone: string
  }
}

export interface MemoryMaintenanceResult {
  deduplicationResult: DeduplicationResult
  archivalResult: ArchivalResult
  totalProcessingTimeMs: number
  recommendedActions: string[]
}

/**
 * Integrated service that provides advanced memory ranking, topic tracking,
 * deduplication, and archival capabilities for Task 13
 */
export class AdvancedMemoryService {
  private memoryRanking: AdvancedMemoryRanking
  private topicTracker: ConversationTopicTracker
  private archivalService: MemoryArchivalService
  private deduplicationService: MemoryDeduplicationService

  constructor() {
    this.memoryRanking = new AdvancedMemoryRanking()
    this.topicTracker = new ConversationTopicTracker()
    this.archivalService = new MemoryArchivalService()
    this.deduplicationService = new MemoryDeduplicationService()
  }

  /**
   * Retrieve and rank memories with advanced relevance scoring
   * Main implementation of requirement 4.3: rank fragments for conversational relevance
   */
  async retrieveRankedMemories(request: AdvancedMemoryQuery): Promise<AdvancedMemoryResult> {
    const startTime = Date.now()
    console.log(`[AdvancedMemoryService] Retrieving ranked memories for query: "${request.query.substring(0, 50)}..."`)

    try {
      // Get or create conversation context
      let conversationContext: ConversationContext
      
      if (request.sessionId) {
        // Update conversation context with current query
        conversationContext = this.topicTracker.updateConversationContext(
          request.sessionId,
          request.query
        )
      } else {
        // Create basic context for one-off queries
        conversationContext = {
          currentTopic: 'general',
          emotionalTone: 'neutral',
          conversationType: 'casual',
          recentTopics: []
        }
      }

      // Get raw memories from existing memory service
      const { MemoryService } = await import('../memoryService')
      const rawMemories = await MemoryService.Retrieval.retrieveRelevantMemories(
        request.query,
        request.userId,
        {
          limit: (request.maxMemories || 10) * 2, // Get more to allow for better ranking
          avatarId: request.avatarId,
          includeContext: true
        }
      )

      console.log(`[AdvancedMemoryService] Retrieved ${rawMemories.length} raw memories for ranking`)

      // Apply advanced ranking
      const rankedMemories = await this.memoryRanking.rankMemoryFragments(
        rawMemories,
        request.query,
        conversationContext
      )

      // Limit to requested number
      const finalMemories = rankedMemories.slice(0, request.maxMemories || 10)

      // Calculate ranking metadata
      const rankingMetadata = this.calculateRankingMetadata(rankedMemories)

      const retrievalTimeMs = Date.now() - startTime
      
      console.log(`[AdvancedMemoryService] Completed ranking in ${retrievalTimeMs}ms, returned ${finalMemories.length} memories`)

      return {
        memories: finalMemories,
        conversationContext,
        retrievalTimeMs,
        totalMemoriesAnalyzed: rawMemories.length,
        rankingMetadata
      }
    } catch (error) {
      console.error('[AdvancedMemoryService] Failed to retrieve ranked memories:', error)
      throw error
    }
  }

  /**
   * Start or resume a conversation session for topic tracking
   */
  startConversationSession(sessionId: string, userId: string, avatarId: string): void {
    this.topicTracker.startSession(sessionId, userId, avatarId)
    console.log(`[AdvancedMemoryService] Started conversation session: ${sessionId}`)
  }

  /**
   * Get current conversation context for a session
   */
  getConversationContext(sessionId: string): ConversationContext | null {
    return this.topicTracker.getConversationContext(sessionId)
  }

  /**
   * Get conversation session statistics
   */
  getSessionStats(sessionId: string) {
    return this.topicTracker.getSessionStats(sessionId)
  }

  /**
   * Run comprehensive memory maintenance (deduplication + archival)
   */
  async runMemoryMaintenance(userId: string, avatarId?: string): Promise<MemoryMaintenanceResult> {
    const startTime = Date.now()
    console.log(`[AdvancedMemoryService] Running memory maintenance for user ${userId}, avatar ${avatarId}`)

    try {
      // Run deduplication first
      console.log('[AdvancedMemoryService] Starting deduplication...')
      const deduplicationResult = await this.deduplicationService.deduplicateUserMemories(userId, avatarId)
      
      // Then run archival
      console.log('[AdvancedMemoryService] Starting archival...')
      const archivalResult = await this.archivalService.archiveUserMemories(userId, avatarId)
      
      const totalProcessingTimeMs = Date.now() - startTime
      
      // Generate recommendations based on results
      const recommendedActions = this.generateMaintenanceRecommendations(deduplicationResult, archivalResult)
      
      console.log(`[AdvancedMemoryService] Memory maintenance completed in ${totalProcessingTimeMs}ms`)
      console.log(`[AdvancedMemoryService] Deduplication: ${deduplicationResult.memoriesConsolidated} consolidated, ${deduplicationResult.memoriesRemoved} removed`)
      console.log(`[AdvancedMemoryService] Archival: ${archivalResult.archivedCount} archived, ${archivalResult.preservedCount} preserved`)

      return {
        deduplicationResult,
        archivalResult,
        totalProcessingTimeMs,
        recommendedActions
      }
    } catch (error) {
      console.error('[AdvancedMemoryService] Memory maintenance failed:', error)
      throw error
    }
  }

  /**
   * Get duplicate memory groups for manual review
   */
  async getDuplicateGroupsForReview(userId: string, avatarId?: string) {
    return this.deduplicationService.getDuplicateGroupsForReview(userId, avatarId)
  }

  /**
   * Approve consolidation of a duplicate group
   */
  async approveConsolidation(groupId: string, userId: string, avatarId?: string) {
    return this.deduplicationService.approveConsolidation(groupId, userId, avatarId)
  }

  /**
   * Get archived memories for a user
   */
  async getArchivedMemories(userId: string, avatarId?: string, limit?: number, offset?: number) {
    return this.archivalService.getArchivedMemories(userId, avatarId, limit, offset)
  }

  /**
   * Restore an archived memory
   */
  async restoreArchivedMemory(archiveId: string, userId: string) {
    return this.archivalService.restoreArchivedMemory(archiveId, userId)
  }

  /**
   * Get archival statistics
   */
  async getArchivalStats(userId?: string, avatarId?: string) {
    return this.archivalService.getArchivalStats(userId, avatarId)
  }

  /**
   * Clean up inactive conversation sessions
   */
  cleanupInactiveSessions(): number {
    return this.topicTracker.cleanupInactiveSessions()
  }

  /**
   * Get all active conversation sessions (for monitoring)
   */
  getActiveSessions() {
    return this.topicTracker.getActiveSessions()
  }

  /**
   * Update ranking configuration
   */
  updateRankingConfig(config: {
    relevanceWeight?: number
    freshnessWeight?: number
    topicWeight?: number
    contextWeight?: number
    freshnessDecayDays?: number
    maxFreshnessDecay?: number
    similarityThreshold?: number
    maxDuplicatesPerGroup?: number
  }): void {
    this.memoryRanking.updateConfig(config)
  }

  /**
   * Update archival policy
   */
  updateArchivalPolicy(policy: {
    maxAge?: number
    minScore?: number
    maxMemoriesPerUser?: number
    archivalBatchSize?: number
    preserveHighValue?: boolean
    preserveRecent?: number
  }): void {
    this.archivalService.updatePolicy(policy)
  }

  /**
   * Update deduplication configuration
   */
  updateDeduplicationConfig(config: {
    textSimilarityThreshold?: number
    semanticSimilarityThreshold?: number
    temporalWindowDays?: number
    minGroupSize?: number
    maxGroupSize?: number
    preserveMetadata?: boolean
    autoConsolidate?: boolean
  }): void {
    this.deduplicationService.updateConfig(config)
  }

  // Private helper methods

  private calculateRankingMetadata(rankedMemories: RankedMemoryFragment[]) {
    if (rankedMemories.length === 0) {
      return {
        averageRelevanceScore: 0,
        averageFreshnessScore: 0,
        averageTopicScore: 0,
        averageContextScore: 0,
        topTopics: [],
        dominantEmotionalTone: 'neutral'
      }
    }

    // Calculate average scores
    const averageRelevanceScore = rankedMemories.reduce((sum, m) => sum + m.relevanceScore, 0) / rankedMemories.length
    const averageFreshnessScore = rankedMemories.reduce((sum, m) => sum + m.freshnessScore, 0) / rankedMemories.length
    const averageTopicScore = rankedMemories.reduce((sum, m) => sum + m.topicRelevanceScore, 0) / rankedMemories.length
    const averageContextScore = rankedMemories.reduce((sum, m) => sum + m.conversationalContextScore, 0) / rankedMemories.length

    // Find top topics
    const topicCounts: { [key: string]: number } = {}
    rankedMemories.forEach(memory => {
      memory.rankingMetadata.topicTags.forEach(topic => {
        topicCounts[topic] = (topicCounts[topic] || 0) + 1
      })
    })

    const topTopics = Object.entries(topicCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([topic]) => topic)

    // Find dominant emotional tone
    const emotionCounts: { [key: string]: number } = {}
    rankedMemories.forEach(memory => {
      const emotion = memory.rankingMetadata.emotionalContext
      emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1
    })

    const dominantEmotionalTone = Object.entries(emotionCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'neutral'

    return {
      averageRelevanceScore,
      averageFreshnessScore,
      averageTopicScore,
      averageContextScore,
      topTopics,
      dominantEmotionalTone
    }
  }

  private generateMaintenanceRecommendations(
    deduplicationResult: DeduplicationResult,
    archivalResult: ArchivalResult
  ): string[] {
    const recommendations: string[] = []

    // Deduplication recommendations
    if (deduplicationResult.duplicateGroupsFound > 0) {
      if (deduplicationResult.memoriesConsolidated === 0) {
        recommendations.push('Consider reviewing duplicate memory groups for manual consolidation')
      } else {
        recommendations.push(`Successfully consolidated ${deduplicationResult.memoriesConsolidated} duplicate memories`)
      }
    }

    if (deduplicationResult.errors.length > 0) {
      recommendations.push(`${deduplicationResult.errors.length} deduplication errors occurred - review logs`)
    }

    // Archival recommendations
    if (archivalResult.archivedCount > 0) {
      recommendations.push(`Archived ${archivalResult.archivedCount} old or low-relevance memories`)
    }

    if (archivalResult.preservedCount > 1000) {
      recommendations.push('Consider adjusting archival policy - memory count is still high after archival')
    }

    if (archivalResult.errorCount > 0) {
      recommendations.push(`${archivalResult.errorCount} archival errors occurred - review logs`)
    }

    // Performance recommendations
    const totalProcessingTime = deduplicationResult.processingTimeMs + archivalResult.processingTimeMs
    if (totalProcessingTime > 30000) { // 30 seconds
      recommendations.push('Memory maintenance took longer than expected - consider running more frequently')
    }

    if (recommendations.length === 0) {
      recommendations.push('Memory maintenance completed successfully with no issues')
    }

    return recommendations
  }

  /**
   * Get comprehensive memory health report
   */
  async getMemoryHealthReport(userId: string, avatarId?: string): Promise<{
    totalMemories: number
    duplicateGroups: number
    archivalCandidates: number
    averageMemoryAge: number
    topTopics: string[]
    memoryDistribution: { [key: string]: number }
    recommendations: string[]
  }> {
    try {
      // Get all memories for analysis
      const { MemoryService } = await import('../memoryService')
      const allMemories = await MemoryService.Retrieval.getUserMemories(userId, {
        limit: 0, // Get all memories
        avatarId
      })

      // Analyze for duplicates
      const duplicateGroups = await this.deduplicationService.findDuplicateGroups(allMemories)

      // Analyze for archival candidates
      const rankedMemories = await this.memoryRanking.rankMemoryFragments(
        allMemories,
        'general analysis',
        {
          currentTopic: 'general',
          emotionalTone: 'neutral',
          conversationType: 'casual',
          recentTopics: []
        }
      )

      const archivalCandidates = this.memoryRanking.identifyMemoriesForArchival(rankedMemories)

      // Calculate statistics
      const now = new Date()
      const totalAge = allMemories.reduce((sum, memory) => {
        const age = memory.createdAt ? now.getTime() - memory.createdAt.getTime() : 0
        return sum + age
      }, 0)
      const averageMemoryAge = allMemories.length > 0 ? totalAge / allMemories.length / (1000 * 60 * 60 * 24) : 0

      // Topic analysis
      const topicCounts: { [key: string]: number } = {}
      rankedMemories.forEach(memory => {
        memory.rankingMetadata.topicTags.forEach(topic => {
          topicCounts[topic] = (topicCounts[topic] || 0) + 1
        })
      })

      const topTopics = Object.entries(topicCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([topic]) => topic)

      // Memory distribution by age
      const memoryDistribution: { [key: string]: number } = {
        'last_week': 0,
        'last_month': 0,
        'last_3_months': 0,
        'older': 0
      }

      const oneWeek = 7 * 24 * 60 * 60 * 1000
      const oneMonth = 30 * 24 * 60 * 60 * 1000
      const threeMonths = 90 * 24 * 60 * 60 * 1000

      allMemories.forEach(memory => {
        if (!memory.createdAt) return
        
        const age = now.getTime() - memory.createdAt.getTime()
        if (age < oneWeek) {
          memoryDistribution.last_week++
        } else if (age < oneMonth) {
          memoryDistribution.last_month++
        } else if (age < threeMonths) {
          memoryDistribution.last_3_months++
        } else {
          memoryDistribution.older++
        }
      })

      // Generate recommendations
      const recommendations: string[] = []
      
      if (duplicateGroups.length > 0) {
        recommendations.push(`Found ${duplicateGroups.length} duplicate groups - consider running deduplication`)
      }
      
      if (archivalCandidates.length > 0) {
        recommendations.push(`${archivalCandidates.length} memories are candidates for archival`)
      }
      
      if (allMemories.length > 1000) {
        recommendations.push('Memory count is high - consider more aggressive archival policy')
      }
      
      if (averageMemoryAge > 60) {
        recommendations.push('Average memory age is high - consider refreshing with recent conversations')
      }

      return {
        totalMemories: allMemories.length,
        duplicateGroups: duplicateGroups.length,
        archivalCandidates: archivalCandidates.length,
        averageMemoryAge,
        topTopics,
        memoryDistribution,
        recommendations
      }
    } catch (error) {
      console.error('[AdvancedMemoryService] Failed to generate memory health report:', error)
      throw error
    }
  }
}

// Export singleton instance
export const advancedMemoryService = new AdvancedMemoryService()