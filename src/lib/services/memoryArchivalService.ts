// src/lib/services/memoryArchivalService.ts
// Task 13: Create memory freshness scoring and automatic archival

import { supabase } from '../supabase'
import { MemoryFragment } from '../memoryService'
import { RankedMemoryFragment, AdvancedMemoryRanking, DEFAULT_RANKING_CONFIG } from './advancedMemoryRanking'
import { MemoryErrorHandler, MemoryError, MemoryErrorType } from '../memoryErrorHandler'

export interface ArchivalPolicy {
  maxAge: number              // Days after which memories become candidates for archival
  minScore: number           // Minimum relevance score to avoid archival
  maxMemoriesPerUser: number // Maximum memories to keep per user/avatar
  archivalBatchSize: number  // Number of memories to process in each archival run
  preserveHighValue: boolean // Always preserve memories with high access counts
  preserveRecent: number     // Always preserve memories from last N days
}

export interface ArchivalResult {
  totalProcessed: number
  archivedCount: number
  preservedCount: number
  errorCount: number
  processingTimeMs: number
  archivedMemoryIds: string[]
  errors: Array<{ memoryId: string, error: string }>
}

export interface MemoryArchive {
  id: string
  originalMemoryId: string
  userId: string
  avatarId?: string
  fragmentText: string
  originalScore: number
  archivalReason: string
  archivedAt: Date
  originalCreatedAt: Date
  conversationContext?: any
}

export const DEFAULT_ARCHIVAL_POLICY: ArchivalPolicy = {
  maxAge: 90,              // 90 days
  minScore: 0.3,           // 30% minimum score
  maxMemoriesPerUser: 1000, // 1000 memories per user/avatar
  archivalBatchSize: 100,   // Process 100 at a time
  preserveHighValue: true,  // Preserve frequently accessed memories
  preserveRecent: 7         // Always preserve last 7 days
}

/**
 * Service for automatic memory archival based on freshness and relevance scores
 * Implements memory freshness scoring and automatic archival for Task 13
 */
export class MemoryArchivalService {
  private policy: ArchivalPolicy
  private memoryRanking: AdvancedMemoryRanking

  constructor(policy: Partial<ArchivalPolicy> = {}) {
    this.policy = { ...DEFAULT_ARCHIVAL_POLICY, ...policy }
    this.memoryRanking = new AdvancedMemoryRanking()
  }

  /**
   * Run automatic archival process for all users
   * Should be called periodically (e.g., daily via cron job)
   */
  async runAutomaticArchival(): Promise<ArchivalResult> {
    const startTime = Date.now()
    console.log('[MemoryArchivalService] Starting automatic archival process...')

    let totalProcessed = 0
    let archivedCount = 0
    let preservedCount = 0
    let errorCount = 0
    const archivedMemoryIds: string[] = []
    const errors: Array<{ memoryId: string, error: string }> = []

    try {
      // Get all users with memories
      const usersWithMemories = await this.getUsersWithMemories()
      console.log(`[MemoryArchivalService] Found ${usersWithMemories.length} users with memories`)

      // Process each user's memories
      for (const { userId, avatarId } of usersWithMemories) {
        try {
          const userResult = await this.archiveUserMemories(userId, avatarId)
          totalProcessed += userResult.totalProcessed
          archivedCount += userResult.archivedCount
          preservedCount += userResult.preservedCount
          errorCount += userResult.errorCount
          archivedMemoryIds.push(...userResult.archivedMemoryIds)
          errors.push(...userResult.errors)
        } catch (error) {
          console.error(`[MemoryArchivalService] Failed to process user ${userId}:`, error)
          errorCount++
          errors.push({
            memoryId: `user-${userId}`,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }

      const processingTimeMs = Date.now() - startTime
      console.log(`[MemoryArchivalService] Archival complete: ${archivedCount} archived, ${preservedCount} preserved, ${errorCount} errors in ${processingTimeMs}ms`)

      return {
        totalProcessed,
        archivedCount,
        preservedCount,
        errorCount,
        processingTimeMs,
        archivedMemoryIds,
        errors
      }
    } catch (error) {
      console.error('[MemoryArchivalService] Archival process failed:', error)
      throw error
    }
  }

  /**
   * Archive memories for a specific user/avatar
   */
  async archiveUserMemories(userId: string, avatarId?: string): Promise<ArchivalResult> {
    const startTime = Date.now()
    console.log(`[MemoryArchivalService] Processing memories for user ${userId}, avatar ${avatarId}`)

    let totalProcessed = 0
    let archivedCount = 0
    let preservedCount = 0
    let errorCount = 0
    const archivedMemoryIds: string[] = []
    const errors: Array<{ memoryId: string, error: string }> = []

    try {
      // Get all memories for this user/avatar
      const memories = await this.getUserMemories(userId, avatarId)
      totalProcessed = memories.length

      if (memories.length === 0) {
        return {
          totalProcessed: 0,
          archivedCount: 0,
          preservedCount: 0,
          errorCount: 0,
          processingTimeMs: Date.now() - startTime,
          archivedMemoryIds: [],
          errors: []
        }
      }

      console.log(`[MemoryArchivalService] Found ${memories.length} memories for user ${userId}`)

      // Check if user has too many memories
      const shouldArchiveByCount = memories.length > this.policy.maxMemoriesPerUser

      // Rank memories for archival decision
      const rankedMemories = await this.rankMemoriesForArchival(memories)

      // Determine which memories to archive
      const { toArchive, toPreserve } = this.selectMemoriesForArchival(rankedMemories, shouldArchiveByCount)

      console.log(`[MemoryArchivalService] Selected ${toArchive.length} memories for archival, ${toPreserve.length} to preserve`)

      // Archive selected memories
      for (const memory of toArchive) {
        try {
          await this.archiveMemory(memory, this.determineArchivalReason(memory, shouldArchiveByCount))
          archivedMemoryIds.push(memory.id!)
          archivedCount++
        } catch (error) {
          console.error(`[MemoryArchivalService] Failed to archive memory ${memory.id}:`, error)
          errorCount++
          errors.push({
            memoryId: memory.id!,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }

      preservedCount = toPreserve.length

      const processingTimeMs = Date.now() - startTime
      console.log(`[MemoryArchivalService] User ${userId} processing complete: ${archivedCount} archived, ${preservedCount} preserved in ${processingTimeMs}ms`)

      return {
        totalProcessed,
        archivedCount,
        preservedCount,
        errorCount,
        processingTimeMs,
        archivedMemoryIds,
        errors
      }
    } catch (error) {
      console.error(`[MemoryArchivalService] Failed to process user ${userId}:`, error)
      throw error
    }
  }

  /**
   * Restore archived memory back to active memories
   */
  async restoreArchivedMemory(archiveId: string, userId: string): Promise<string> {
    return MemoryErrorHandler.withRetry(
      async () => {
        // Get archived memory
        const { data: archivedMemory, error: fetchError } = await supabase
          .from('memory_archive')
          .select('*')
          .eq('id', archiveId)
          .eq('user_id', userId)
          .single()

        if (fetchError) {
          throw MemoryErrorHandler.categorizeError(fetchError, {
            operation: 'fetch_archived_memory',
            archiveId,
            userId
          })
        }

        if (!archivedMemory) {
          throw new MemoryError(
            MemoryErrorType.MEMORY_NOT_FOUND,
            'Archived memory not found'
          )
        }

        // Generate new embedding for the restored memory
        const { MemoryStorageService } = await import('../memoryService')
        const embedding = await MemoryStorageService.generateEmbedding(archivedMemory.fragment_text)

        // Restore to active memories
        const { data: restoredMemory, error: insertError } = await supabase
          .from('memory_fragments')
          .insert({
            user_id: archivedMemory.user_id,
            avatar_id: archivedMemory.avatar_id,
            fragment_text: archivedMemory.fragment_text,
            embedding,
            conversation_context: archivedMemory.conversation_context,
            created_at: archivedMemory.original_created_at
          })
          .select('id')
          .single()

        if (insertError) {
          throw MemoryErrorHandler.categorizeError(insertError, {
            operation: 'restore_memory',
            archiveId,
            userId
          })
        }

        // Remove from archive
        const { error: deleteError } = await supabase
          .from('memory_archive')
          .delete()
          .eq('id', archiveId)
          .eq('user_id', userId)

        if (deleteError) {
          console.warn(`[MemoryArchivalService] Failed to remove from archive after restore:`, deleteError)
          // Don't throw - memory was successfully restored
        }

        console.log(`[MemoryArchivalService] Restored memory ${archiveId} as ${restoredMemory.id}`)
        return restoredMemory.id
      },
      'database',
      { operation: 'restore_archived_memory', archiveId, userId }
    )
  }

  /**
   * Get archived memories for a user
   */
  async getArchivedMemories(
    userId: string,
    avatarId?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<MemoryArchive[]> {
    return MemoryErrorHandler.withRetry(
      async () => {
        let query = supabase
          .from('memory_archive')
          .select('*')
          .eq('user_id', userId)

        if (avatarId) {
          query = query.eq('avatar_id', avatarId)
        }

        const { data, error } = await query
          .order('archived_at', { ascending: false })
          .range(offset, offset + limit - 1)

        if (error) {
          throw MemoryErrorHandler.categorizeError(error, {
            operation: 'get_archived_memories',
            userId,
            avatarId,
            limit,
            offset
          })
        }

        return (data || []).map(item => ({
          id: item.id,
          originalMemoryId: item.original_memory_id,
          userId: item.user_id,
          avatarId: item.avatar_id,
          fragmentText: item.fragment_text,
          originalScore: item.original_score,
          archivalReason: item.archival_reason,
          archivedAt: new Date(item.archived_at),
          originalCreatedAt: new Date(item.original_created_at),
          conversationContext: item.conversation_context
        }))
      },
      'database',
      { operation: 'get_archived_memories', userId, avatarId, limit, offset }
    )
  }

  /**
   * Get archival statistics
   */
  async getArchivalStats(userId?: string, avatarId?: string): Promise<{
    totalArchived: number
    archivedThisWeek: number
    archivedThisMonth: number
    averageScoreArchived: number
    topArchivalReasons: Array<{ reason: string, count: number }>
  }> {
    return MemoryErrorHandler.withRetry(
      async () => {
        let query = supabase.from('memory_archive').select('*')

        if (userId) {
          query = query.eq('user_id', userId)
        }
        if (avatarId) {
          query = query.eq('avatar_id', avatarId)
        }

        const { data, error } = await query

        if (error) {
          throw MemoryErrorHandler.categorizeError(error, {
            operation: 'get_archival_stats',
            userId,
            avatarId
          })
        }

        if (!data || data.length === 0) {
          return {
            totalArchived: 0,
            archivedThisWeek: 0,
            archivedThisMonth: 0,
            averageScoreArchived: 0,
            topArchivalReasons: []
          }
        }

        const now = new Date()
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

        const archivedThisWeek = data.filter(item => new Date(item.archived_at) > oneWeekAgo).length
        const archivedThisMonth = data.filter(item => new Date(item.archived_at) > oneMonthAgo).length
        const averageScoreArchived = data.reduce((sum, item) => sum + (item.original_score || 0), 0) / data.length

        // Count archival reasons
        const reasonCounts: { [key: string]: number } = {}
        data.forEach(item => {
          const reason = item.archival_reason || 'unknown'
          reasonCounts[reason] = (reasonCounts[reason] || 0) + 1
        })

        const topArchivalReasons = Object.entries(reasonCounts)
          .map(([reason, count]) => ({ reason, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)

        return {
          totalArchived: data.length,
          archivedThisWeek,
          archivedThisMonth,
          averageScoreArchived,
          topArchivalReasons
        }
      },
      'database',
      { operation: 'get_archival_stats', userId, avatarId }
    )
  }

  // Private helper methods

  private async getUsersWithMemories(): Promise<Array<{ userId: string, avatarId?: string }>> {
    const { data, error } = await supabase
      .from('memory_fragments')
      .select('user_id, avatar_id')
      .limit(1000) // Reasonable limit for batch processing

    if (error) {
      throw MemoryErrorHandler.categorizeError(error, {
        operation: 'get_users_with_memories'
      })
    }

    // Group by user_id and avatar_id combination
    const userAvatarPairs = new Set<string>()
    const result: Array<{ userId: string, avatarId?: string }> = []

    for (const row of data || []) {
      const key = `${row.user_id}:${row.avatar_id || 'null'}`
      if (!userAvatarPairs.has(key)) {
        userAvatarPairs.add(key)
        result.push({
          userId: row.user_id,
          avatarId: row.avatar_id || undefined
        })
      }
    }

    return result
  }

  private async getUserMemories(userId: string, avatarId?: string): Promise<MemoryFragment[]> {
    let query = supabase
      .from('memory_fragments')
      .select('*')
      .eq('user_id', userId)

    if (avatarId) {
      query = query.eq('avatar_id', avatarId)
    }

    const { data, error } = await query.order('created_at', { ascending: true })

    if (error) {
      throw MemoryErrorHandler.categorizeError(error, {
        operation: 'get_user_memories_for_archival',
        userId,
        avatarId
      })
    }

    return (data || []).map(item => ({
      id: item.id,
      userId: item.user_id,
      avatarId: item.avatar_id,
      fragmentText: item.fragment_text,
      embedding: item.embedding,
      conversationContext: item.conversation_context,
      createdAt: new Date(item.created_at),
      updatedAt: new Date(item.updated_at)
    }))
  }

  private async rankMemoriesForArchival(memories: MemoryFragment[]): Promise<RankedMemoryFragment[]> {
    // Use a generic query for ranking since we're evaluating for archival
    const genericQuery = 'general conversation context'
    const genericContext = {
      currentTopic: 'general',
      emotionalTone: 'neutral',
      conversationType: 'casual' as const,
      recentTopics: []
    }

    return this.memoryRanking.rankMemoryFragments(memories, genericQuery, genericContext)
  }

  private selectMemoriesForArchival(
    rankedMemories: RankedMemoryFragment[],
    forceArchivalByCount: boolean
  ): { toArchive: RankedMemoryFragment[], toPreserve: RankedMemoryFragment[] } {
    const now = new Date()
    const preserveAfterDate = new Date(now.getTime() - this.policy.preserveRecent * 24 * 60 * 60 * 1000)
    const archivalCandidateDate = new Date(now.getTime() - this.policy.maxAge * 24 * 60 * 60 * 1000)

    const toArchive: RankedMemoryFragment[] = []
    const toPreserve: RankedMemoryFragment[] = []

    for (const memory of rankedMemories) {
      const createdAt = memory.createdAt || now
      const shouldPreserveRecent = createdAt > preserveAfterDate
      const isOldEnough = createdAt < archivalCandidateDate
      const hasLowScore = memory.finalScore < this.policy.minScore
      const isHighValue = this.policy.preserveHighValue && (memory.rankingMetadata.accessCount > 5)

      // Always preserve recent memories
      if (shouldPreserveRecent) {
        toPreserve.push(memory)
        continue
      }

      // Always preserve high-value memories
      if (isHighValue) {
        toPreserve.push(memory)
        continue
      }

      // Archive if old and low-scored
      if (isOldEnough && hasLowScore) {
        toArchive.push(memory)
        continue
      }

      // If we need to archive by count, archive lowest-scored memories
      if (forceArchivalByCount && toPreserve.length >= this.policy.maxMemoriesPerUser) {
        toArchive.push(memory)
        continue
      }

      // Default to preserve
      toPreserve.push(memory)
    }

    // If still over limit after initial selection, archive more low-scored memories
    if (forceArchivalByCount && toPreserve.length > this.policy.maxMemoriesPerUser) {
      const sortedPreserved = toPreserve.sort((a, b) => a.finalScore - b.finalScore)
      const excessCount = toPreserve.length - this.policy.maxMemoriesPerUser
      const additionalArchival = sortedPreserved.slice(0, excessCount)
      const finalPreserved = sortedPreserved.slice(excessCount)

      toArchive.push(...additionalArchival)
      return { toArchive, toPreserve: finalPreserved }
    }

    return { toArchive, toPreserve }
  }

  private async archiveMemory(memory: RankedMemoryFragment, reason: string): Promise<void> {
    return MemoryErrorHandler.withRetry(
      async () => {
        // Insert into archive
        const { error: insertError } = await supabase
          .from('memory_archive')
          .insert({
            original_memory_id: memory.id,
            user_id: memory.userId,
            avatar_id: memory.avatarId,
            fragment_text: memory.fragmentText,
            original_score: memory.finalScore,
            archival_reason: reason,
            original_created_at: memory.createdAt,
            conversation_context: memory.conversationContext
          })

        if (insertError) {
          throw MemoryErrorHandler.categorizeError(insertError, {
            operation: 'archive_memory_insert',
            memoryId: memory.id,
            userId: memory.userId
          })
        }

        // Remove from active memories
        const { error: deleteError } = await supabase
          .from('memory_fragments')
          .delete()
          .eq('id', memory.id)
          .eq('user_id', memory.userId)

        if (deleteError) {
          throw MemoryErrorHandler.categorizeError(deleteError, {
            operation: 'archive_memory_delete',
            memoryId: memory.id,
            userId: memory.userId
          })
        }
      },
      'database',
      { operation: 'archive_memory', memoryId: memory.id, userId: memory.userId }
    )
  }

  private determineArchivalReason(memory: RankedMemoryFragment, forceByCount: boolean): string {
    const now = new Date()
    const createdAt = memory.createdAt || now
    const daysSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)

    if (forceByCount) {
      return 'memory_limit_exceeded'
    }
    if (daysSinceCreation > this.policy.maxAge) {
      return 'age_threshold_exceeded'
    }
    if (memory.finalScore < this.policy.minScore) {
      return 'low_relevance_score'
    }
    return 'automatic_archival'
  }

  /**
   * Update archival policy
   */
  updatePolicy(updates: Partial<ArchivalPolicy>): void {
    this.policy = { ...this.policy, ...updates }
  }

  /**
   * Get current archival policy
   */
  getPolicy(): ArchivalPolicy {
    return { ...this.policy }
  }
}