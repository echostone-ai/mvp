// src/lib/services/memoryDeduplicationService.ts
// Task 13: Implement memory deduplication and consolidation

import { supabase } from '../supabase'
import { MemoryFragment } from '../memoryService'
import { MemoryErrorHandler, MemoryError, MemoryErrorType } from '../memoryErrorHandler'

export interface DuplicateGroup {
  groupId: string
  memories: MemoryFragment[]
  similarity: number
  consolidationStrategy: 'merge' | 'keep_best' | 'keep_newest' | 'keep_oldest'
  recommendedAction: 'consolidate' | 'keep_separate' | 'manual_review'
}

export interface ConsolidationResult {
  originalMemoryIds: string[]
  consolidatedMemoryId: string
  consolidatedText: string
  preservedMetadata: any
  consolidationReason: string
}

export interface DeduplicationResult {
  totalProcessed: number
  duplicateGroupsFound: number
  memoriesConsolidated: number
  memoriesRemoved: number
  processingTimeMs: number
  consolidationResults: ConsolidationResult[]
  errors: Array<{ memoryId: string, error: string }>
}

export interface DeduplicationConfig {
  textSimilarityThreshold: number    // 0.85 - Threshold for text similarity
  semanticSimilarityThreshold: number // 0.90 - Threshold for semantic similarity
  temporalWindowDays: number         // 7 - Only dedupe memories within this time window
  minGroupSize: number              // 2 - Minimum memories needed to form a duplicate group
  maxGroupSize: number              // 5 - Maximum memories to consolidate in one group
  preserveMetadata: boolean         // true - Preserve conversation context and timestamps
  autoConsolidate: boolean          // false - Automatically consolidate or require manual approval
}

export const DEFAULT_DEDUPLICATION_CONFIG: DeduplicationConfig = {
  textSimilarityThreshold: 0.85,
  semanticSimilarityThreshold: 0.90,
  temporalWindowDays: 7,
  minGroupSize: 2,
  maxGroupSize: 5,
  preserveMetadata: true,
  autoConsolidate: false
}

/**
 * Service for detecting and consolidating duplicate memory fragments
 * Implements memory deduplication and consolidation for Task 13
 */
export class MemoryDeduplicationService {
  private config: DeduplicationConfig

  constructor(config: Partial<DeduplicationConfig> = {}) {
    this.config = { ...DEFAULT_DEDUPLICATION_CONFIG, ...config }
  }

  /**
   * Run deduplication process for a specific user/avatar
   */
  async deduplicateUserMemories(userId: string, avatarId?: string): Promise<DeduplicationResult> {
    const startTime = Date.now()
    console.log(`[MemoryDeduplicationService] Starting deduplication for user ${userId}, avatar ${avatarId}`)

    let totalProcessed = 0
    let duplicateGroupsFound = 0
    let memoriesConsolidated = 0
    let memoriesRemoved = 0
    const consolidationResults: ConsolidationResult[] = []
    const errors: Array<{ memoryId: string, error: string }> = []

    try {
      // Get all memories for this user/avatar
      const memories = await this.getUserMemories(userId, avatarId)
      totalProcessed = memories.length

      if (memories.length < this.config.minGroupSize) {
        console.log(`[MemoryDeduplicationService] Not enough memories (${memories.length}) for deduplication`)
        return {
          totalProcessed,
          duplicateGroupsFound: 0,
          memoriesConsolidated: 0,
          memoriesRemoved: 0,
          processingTimeMs: Date.now() - startTime,
          consolidationResults: [],
          errors: []
        }
      }

      console.log(`[MemoryDeduplicationService] Analyzing ${memories.length} memories for duplicates`)

      // Find duplicate groups
      const duplicateGroups = await this.findDuplicateGroups(memories)
      duplicateGroupsFound = duplicateGroups.length

      console.log(`[MemoryDeduplicationService] Found ${duplicateGroupsFound} duplicate groups`)

      // Process each duplicate group
      for (const group of duplicateGroups) {
        try {
          if (group.recommendedAction === 'consolidate' && 
              (this.config.autoConsolidate || group.similarity > 0.95)) {
            
            const result = await this.consolidateMemoryGroup(group)
            consolidationResults.push(result)
            memoriesConsolidated++
            memoriesRemoved += group.memories.length - 1 // All but the consolidated one
            
            console.log(`[MemoryDeduplicationService] Consolidated group ${group.groupId}: ${group.memories.length} → 1`)
          }
        } catch (error) {
          console.error(`[MemoryDeduplicationService] Failed to consolidate group ${group.groupId}:`, error)
          group.memories.forEach(memory => {
            errors.push({
              memoryId: memory.id!,
              error: error instanceof Error ? error.message : 'Unknown consolidation error'
            })
          })
        }
      }

      const processingTimeMs = Date.now() - startTime
      console.log(`[MemoryDeduplicationService] Deduplication complete: ${duplicateGroupsFound} groups, ${memoriesConsolidated} consolidated, ${memoriesRemoved} removed in ${processingTimeMs}ms`)

      return {
        totalProcessed,
        duplicateGroupsFound,
        memoriesConsolidated,
        memoriesRemoved,
        processingTimeMs,
        consolidationResults,
        errors
      }
    } catch (error) {
      console.error(`[MemoryDeduplicationService] Deduplication failed for user ${userId}:`, error)
      throw error
    }
  }

  /**
   * Find potential duplicate groups in a set of memories
   */
  async findDuplicateGroups(memories: MemoryFragment[]): Promise<DuplicateGroup[]> {
    const duplicateGroups: DuplicateGroup[] = []
    const processedMemories = new Set<string>()

    // Sort memories by creation date for temporal analysis
    const sortedMemories = memories
      .filter(m => m.id && m.createdAt)
      .sort((a, b) => a.createdAt!.getTime() - b.createdAt!.getTime())

    for (let i = 0; i < sortedMemories.length; i++) {
      const memory = sortedMemories[i]
      
      if (processedMemories.has(memory.id!)) {
        continue
      }

      // Find similar memories within temporal window
      const similarMemories = await this.findSimilarMemories(memory, sortedMemories.slice(i + 1))
      
      if (similarMemories.length >= this.config.minGroupSize - 1) { // -1 because we don't include the original
        const groupMemories = [memory, ...similarMemories].slice(0, this.config.maxGroupSize)
        
        // Calculate group similarity
        const groupSimilarity = await this.calculateGroupSimilarity(groupMemories)
        
        // Determine consolidation strategy
        const strategy = this.determineConsolidationStrategy(groupMemories)
        const recommendedAction = this.determineRecommendedAction(groupMemories, groupSimilarity)
        
        const group: DuplicateGroup = {
          groupId: `group_${Date.now()}_${i}`,
          memories: groupMemories,
          similarity: groupSimilarity,
          consolidationStrategy: strategy,
          recommendedAction
        }
        
        duplicateGroups.push(group)
        
        // Mark all memories in this group as processed
        groupMemories.forEach(mem => processedMemories.add(mem.id!))
        
        console.log(`[MemoryDeduplicationService] Found duplicate group: ${groupMemories.length} memories, similarity: ${groupSimilarity.toFixed(3)}`)
      }
    }

    return duplicateGroups
  }

  /**
   * Consolidate a group of duplicate memories into a single memory
   */
  async consolidateMemoryGroup(group: DuplicateGroup): Promise<ConsolidationResult> {
    return MemoryErrorHandler.withRetry(
      async () => {
        console.log(`[MemoryDeduplicationService] Consolidating group ${group.groupId} with ${group.memories.length} memories`)

        // Create consolidated memory based on strategy
        const consolidatedMemory = await this.createConsolidatedMemory(group)
        
        // Store the consolidated memory
        const { MemoryStorageService } = await import('../memoryService')
        const consolidatedMemoryId = await MemoryStorageService.storeMemoryFragment(consolidatedMemory)
        
        // Remove original memories
        const originalIds = group.memories.map(m => m.id!).filter(Boolean)
        await this.removeOriginalMemories(originalIds, group.memories[0].userId)
        
        const result: ConsolidationResult = {
          originalMemoryIds: originalIds,
          consolidatedMemoryId,
          consolidatedText: consolidatedMemory.fragmentText,
          preservedMetadata: consolidatedMemory.conversationContext,
          consolidationReason: `${group.consolidationStrategy}_strategy`
        }
        
        console.log(`[MemoryDeduplicationService] Successfully consolidated group ${group.groupId}`)
        return result
      },
      'database',
      { 
        operation: 'consolidate_memory_group',
        groupId: group.groupId,
        memoryCount: group.memories.length
      }
    )
  }

  /**
   * Get duplicate groups for manual review
   */
  async getDuplicateGroupsForReview(userId: string, avatarId?: string): Promise<DuplicateGroup[]> {
    const memories = await this.getUserMemories(userId, avatarId)
    const allGroups = await this.findDuplicateGroups(memories)
    
    // Return only groups that need manual review
    return allGroups.filter(group => 
      group.recommendedAction === 'manual_review' || 
      (!this.config.autoConsolidate && group.recommendedAction === 'consolidate')
    )
  }

  /**
   * Manually approve consolidation of a duplicate group
   */
  async approveConsolidation(groupId: string, userId: string, avatarId?: string): Promise<ConsolidationResult> {
    // Re-find the group to ensure it still exists
    const memories = await this.getUserMemories(userId, avatarId)
    const groups = await this.findDuplicateGroups(memories)
    const group = groups.find(g => g.groupId === groupId)
    
    if (!group) {
      throw new MemoryError(
        MemoryErrorType.MEMORY_NOT_FOUND,
        `Duplicate group ${groupId} not found`
      )
    }
    
    return this.consolidateMemoryGroup(group)
  }

  // Private helper methods

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
        operation: 'get_user_memories_for_deduplication',
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

  private async findSimilarMemories(targetMemory: MemoryFragment, candidateMemories: MemoryFragment[]): Promise<MemoryFragment[]> {
    const similarMemories: MemoryFragment[] = []
    const targetCreatedAt = targetMemory.createdAt!
    const windowStart = new Date(targetCreatedAt.getTime() - this.config.temporalWindowDays * 24 * 60 * 60 * 1000)
    const windowEnd = new Date(targetCreatedAt.getTime() + this.config.temporalWindowDays * 24 * 60 * 60 * 1000)

    for (const candidate of candidateMemories) {
      const candidateCreatedAt = candidate.createdAt!
      
      // Check if within temporal window
      if (candidateCreatedAt < windowStart || candidateCreatedAt > windowEnd) {
        continue
      }

      // Calculate similarity
      const textSimilarity = this.calculateTextSimilarity(targetMemory.fragmentText, candidate.fragmentText)
      let semanticSimilarity = 0

      // Calculate semantic similarity if embeddings are available
      if (targetMemory.embedding && candidate.embedding) {
        semanticSimilarity = this.calculateCosineSimilarity(targetMemory.embedding, candidate.embedding)
      }

      // Use the higher of text or semantic similarity
      const overallSimilarity = Math.max(textSimilarity, semanticSimilarity)

      // Check if similar enough
      const textThresholdMet = textSimilarity >= this.config.textSimilarityThreshold
      const semanticThresholdMet = semanticSimilarity >= this.config.semanticSimilarityThreshold

      if (textThresholdMet || semanticThresholdMet || overallSimilarity >= this.config.textSimilarityThreshold) {
        similarMemories.push(candidate)
      }
    }

    return similarMemories
  }

  private calculateTextSimilarity(text1: string, text2: string): number {
    // Normalize texts
    const normalize = (text: string) => text.toLowerCase().replace(/[^\w\s]/g, '').trim()
    const normalized1 = normalize(text1)
    const normalized2 = normalize(text2)

    // Check for exact match
    if (normalized1 === normalized2) {
      return 1.0
    }

    // Calculate Jaccard similarity
    const words1 = new Set(normalized1.split(/\s+/))
    const words2 = new Set(normalized2.split(/\s+/))
    
    const intersection = new Set([...words1].filter(word => words2.has(word)))
    const union = new Set([...words1, ...words2])
    
    const jaccardSimilarity = union.size > 0 ? intersection.size / union.size : 0

    // Calculate character-level similarity for short texts
    const charSimilarity = this.calculateLevenshteinSimilarity(normalized1, normalized2)

    // Return the higher of the two similarities
    return Math.max(jaccardSimilarity, charSimilarity)
  }

  private calculateLevenshteinSimilarity(str1: string, str2: string): number {
    const maxLength = Math.max(str1.length, str2.length)
    if (maxLength === 0) return 1.0

    const distance = this.levenshteinDistance(str1, str2)
    return 1 - (distance / maxLength)
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null))

    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j

    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        )
      }
    }

    return matrix[str2.length][str1.length]
  }

  private calculateCosineSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) return 0

    let dotProduct = 0
    let norm1 = 0
    let norm2 = 0

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i]
      norm1 += embedding1[i] * embedding1[i]
      norm2 += embedding2[i] * embedding2[i]
    }

    if (norm1 === 0 || norm2 === 0) return 0
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2))
  }

  private async calculateGroupSimilarity(memories: MemoryFragment[]): Promise<number> {
    if (memories.length < 2) return 1.0

    let totalSimilarity = 0
    let comparisons = 0

    // Calculate pairwise similarities
    for (let i = 0; i < memories.length; i++) {
      for (let j = i + 1; j < memories.length; j++) {
        const textSim = this.calculateTextSimilarity(memories[i].fragmentText, memories[j].fragmentText)
        let semanticSim = 0

        if (memories[i].embedding && memories[j].embedding) {
          semanticSim = this.calculateCosineSimilarity(memories[i].embedding, memories[j].embedding)
        }

        totalSimilarity += Math.max(textSim, semanticSim)
        comparisons++
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 0
  }

  private determineConsolidationStrategy(memories: MemoryFragment[]): 'merge' | 'keep_best' | 'keep_newest' | 'keep_oldest' {
    // Analyze the memories to determine the best consolidation strategy
    const hasRichContext = memories.some(m => m.conversationContext && Object.keys(m.conversationContext).length > 2)
    const hasSignificantLengthDifference = this.hasSignificantLengthDifference(memories)
    const hasTemporalSpread = this.hasTemporalSpread(memories)

    if (hasRichContext && hasSignificantLengthDifference) {
      return 'merge' // Combine information from multiple memories
    }
    
    if (hasTemporalSpread) {
      return 'keep_newest' // Prefer more recent information
    }
    
    if (hasSignificantLengthDifference) {
      return 'keep_best' // Keep the most detailed memory
    }
    
    return 'keep_newest' // Default to newest
  }

  private determineRecommendedAction(memories: MemoryFragment[], similarity: number): 'consolidate' | 'keep_separate' | 'manual_review' {
    // Very high similarity - safe to auto-consolidate
    if (similarity >= 0.95) {
      return 'consolidate'
    }
    
    // High similarity but some differences - consolidate if configured
    if (similarity >= 0.85) {
      return 'consolidate'
    }
    
    // Moderate similarity - needs manual review
    if (similarity >= 0.75) {
      return 'manual_review'
    }
    
    // Low similarity - keep separate
    return 'keep_separate'
  }

  private async createConsolidatedMemory(group: DuplicateGroup): Promise<MemoryFragment> {
    const memories = group.memories
    const strategy = group.consolidationStrategy

    let consolidatedText: string
    let consolidatedContext: any

    switch (strategy) {
      case 'merge':
        consolidatedText = this.mergeMemoryTexts(memories)
        consolidatedContext = this.mergeConversationContexts(memories)
        break
        
      case 'keep_best':
        const bestMemory = this.selectBestMemory(memories)
        consolidatedText = bestMemory.fragmentText
        consolidatedContext = bestMemory.conversationContext
        break
        
      case 'keep_newest':
        const newestMemory = memories.reduce((newest, current) => 
          (current.createdAt! > newest.createdAt!) ? current : newest
        )
        consolidatedText = newestMemory.fragmentText
        consolidatedContext = newestMemory.conversationContext
        break
        
      case 'keep_oldest':
        const oldestMemory = memories.reduce((oldest, current) => 
          (current.createdAt! < oldest.createdAt!) ? current : oldest
        )
        consolidatedText = oldestMemory.fragmentText
        consolidatedContext = oldestMemory.conversationContext
        break
        
      default:
        consolidatedText = memories[0].fragmentText
        consolidatedContext = memories[0].conversationContext
    }

    // Add consolidation metadata
    const enhancedContext = {
      ...consolidatedContext,
      consolidation: {
        strategy,
        originalMemoryIds: memories.map(m => m.id),
        consolidatedAt: new Date().toISOString(),
        originalCount: memories.length
      }
    }

    return {
      userId: memories[0].userId,
      avatarId: memories[0].avatarId,
      fragmentText: consolidatedText,
      conversationContext: enhancedContext
    }
  }

  private mergeMemoryTexts(memories: MemoryFragment[]): string {
    // Remove duplicates and combine unique information
    const uniqueTexts = new Set<string>()
    const sentences: string[] = []

    for (const memory of memories) {
      const memorySentences = memory.fragmentText.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0)
      
      for (const sentence of memorySentences) {
        const normalized = sentence.toLowerCase().replace(/[^\w\s]/g, '')
        if (!uniqueTexts.has(normalized) && sentence.length > 10) {
          uniqueTexts.add(normalized)
          sentences.push(sentence)
        }
      }
    }

    return sentences.join('. ') + (sentences.length > 0 ? '.' : '')
  }

  private mergeConversationContexts(memories: MemoryFragment[]): any {
    const mergedContext: any = {}
    
    // Collect all unique keys and merge values
    for (const memory of memories) {
      if (memory.conversationContext) {
        Object.entries(memory.conversationContext).forEach(([key, value]) => {
          if (!mergedContext[key]) {
            mergedContext[key] = value
          } else if (Array.isArray(mergedContext[key]) && Array.isArray(value)) {
            mergedContext[key] = [...new Set([...mergedContext[key], ...value])]
          }
        })
      }
    }

    return mergedContext
  }

  private selectBestMemory(memories: MemoryFragment[]): MemoryFragment {
    // Score memories based on length, context richness, and recency
    return memories.reduce((best, current) => {
      const bestScore = this.scoreMemoryQuality(best)
      const currentScore = this.scoreMemoryQuality(current)
      return currentScore > bestScore ? current : best
    })
  }

  private scoreMemoryQuality(memory: MemoryFragment): number {
    let score = 0
    
    // Length score (longer is generally better, up to a point)
    const length = memory.fragmentText.length
    score += Math.min(length / 200, 1) * 0.4
    
    // Context richness score
    const contextKeys = memory.conversationContext ? Object.keys(memory.conversationContext).length : 0
    score += Math.min(contextKeys / 5, 1) * 0.3
    
    // Recency score (newer is better)
    const daysSinceCreation = memory.createdAt ? 
      (Date.now() - memory.createdAt.getTime()) / (1000 * 60 * 60 * 24) : 365
    score += Math.max(0, 1 - daysSinceCreation / 30) * 0.3
    
    return score
  }

  private hasSignificantLengthDifference(memories: MemoryFragment[]): boolean {
    const lengths = memories.map(m => m.fragmentText.length)
    const maxLength = Math.max(...lengths)
    const minLength = Math.min(...lengths)
    return (maxLength - minLength) > 50 // 50 character difference threshold
  }

  private hasTemporalSpread(memories: MemoryFragment[]): boolean {
    if (memories.length < 2) return false
    
    const timestamps = memories.map(m => m.createdAt!.getTime()).sort()
    const timeSpread = timestamps[timestamps.length - 1] - timestamps[0]
    const daySpread = timeSpread / (1000 * 60 * 60 * 24)
    
    return daySpread > 1 // More than 1 day apart
  }

  private async removeOriginalMemories(memoryIds: string[], userId: string): Promise<void> {
    const { error } = await supabase
      .from('memory_fragments')
      .delete()
      .in('id', memoryIds)
      .eq('user_id', userId)

    if (error) {
      throw MemoryErrorHandler.categorizeError(error, {
        operation: 'remove_original_memories',
        memoryIds,
        userId
      })
    }
  }

  /**
   * Update deduplication configuration
   */
  updateConfig(updates: Partial<DeduplicationConfig>): void {
    this.config = { ...this.config, ...updates }
  }

  /**
   * Get current deduplication configuration
   */
  getConfig(): DeduplicationConfig {
    return { ...this.config }
  }
}