// src/lib/services/advancedMemoryRanking.ts
// Task 13: Add advanced memory ranking and relevance scoring

import { MemoryFragment } from '../memoryService'

export interface RankedMemoryFragment extends MemoryFragment {
  relevanceScore: number
  freshnessScore: number
  topicRelevanceScore: number
  conversationalContextScore: number
  finalScore: number
  rankingMetadata: {
    topicTags: string[]
    emotionalContext: string
    conversationType: string
    lastAccessed?: Date
    accessCount: number
    duplicateGroup?: string
  }
}

export interface ConversationContext {
  currentTopic?: string
  emotionalTone?: string
  conversationType: 'greeting' | 'personal' | 'professional' | 'casual' | 'deep' | 'unknown'
  recentTopics: string[]
  userIntent?: string
}

export interface MemoryRankingConfig {
  // Scoring weights (should sum to 1.0)
  relevanceWeight: number      // 0.4 - How relevant to current query
  freshnessWeight: number      // 0.2 - How recent the memory is
  topicWeight: number          // 0.25 - How well it matches conversation topic
  contextWeight: number        // 0.15 - How well it fits conversational context
  
  // Freshness decay parameters
  freshnessDecayDays: number   // 30 - Days after which freshness starts decaying
  maxFreshnessDecay: number    // 0.1 - Minimum freshness score (10% of original)
  
  // Deduplication parameters
  similarityThreshold: number  // 0.85 - Threshold for considering memories duplicates
  maxDuplicatesPerGroup: number // 2 - Max memories to keep per duplicate group
  
  // Archival parameters
  archivalThresholdDays: number // 90 - Days after which low-scored memories are archived
  minScoreForArchival: number   // 0.3 - Minimum score to avoid archival
}

export const DEFAULT_RANKING_CONFIG: MemoryRankingConfig = {
  relevanceWeight: 0.4,
  freshnessWeight: 0.2,
  topicWeight: 0.25,
  contextWeight: 0.15,
  freshnessDecayDays: 30,
  maxFreshnessDecay: 0.1,
  similarityThreshold: 0.85,
  maxDuplicatesPerGroup: 2,
  archivalThresholdDays: 90,
  minScoreForArchival: 0.3
}

/**
 * Advanced memory ranking service that implements sophisticated relevance scoring
 * Addresses requirement 4.3: rank fragments for conversational relevance before injection
 */
export class AdvancedMemoryRanking {
  private config: MemoryRankingConfig

  constructor(config: Partial<MemoryRankingConfig> = {}) {
    this.config = { ...DEFAULT_RANKING_CONFIG, ...config }
  }

  /**
   * Rank memory fragments for conversational relevance
   * Main entry point for requirement 4.3 implementation
   */
  async rankMemoryFragments(
    fragments: MemoryFragment[],
    query: string,
    conversationContext: ConversationContext,
    queryEmbedding?: number[]
  ): Promise<RankedMemoryFragment[]> {
    if (fragments.length === 0) {
      return []
    }

    console.log(`[AdvancedMemoryRanking] Ranking ${fragments.length} memory fragments for query: "${query.substring(0, 50)}..."`)

    // Step 1: Enhance fragments with metadata and initial scoring
    const enhancedFragments = await this.enhanceFragmentsWithMetadata(fragments, conversationContext)

    // Step 2: Calculate individual scores
    const scoredFragments = await Promise.all(
      enhancedFragments.map(fragment => this.calculateFragmentScores(fragment, query, conversationContext, queryEmbedding))
    )

    // Step 3: Apply deduplication
    const deduplicatedFragments = this.deduplicateMemories(scoredFragments)

    // Step 4: Calculate final composite scores and rank
    const rankedFragments = this.calculateFinalScores(deduplicatedFragments)
      .sort((a, b) => b.finalScore - a.finalScore)

    console.log(`[AdvancedMemoryRanking] Ranked fragments: ${rankedFragments.length} after deduplication, top score: ${rankedFragments[0]?.finalScore.toFixed(3)}`)

    return rankedFragments
  }

  /**
   * Enhance memory fragments with metadata for ranking
   */
  private async enhanceFragmentsWithMetadata(
    fragments: MemoryFragment[],
    conversationContext: ConversationContext
  ): Promise<RankedMemoryFragment[]> {
    return fragments.map(fragment => {
      const topicTags = this.extractTopicTags(fragment.fragmentText)
      const emotionalContext = this.detectEmotionalContext(fragment)
      const conversationType = this.classifyConversationType(fragment.fragmentText)

      return {
        ...fragment,
        relevanceScore: 0,
        freshnessScore: 0,
        topicRelevanceScore: 0,
        conversationalContextScore: 0,
        finalScore: 0,
        rankingMetadata: {
          topicTags,
          emotionalContext,
          conversationType,
          lastAccessed: fragment.updatedAt,
          accessCount: 1, // TODO: Track actual access count
          duplicateGroup: undefined
        }
      }
    })
  }

  /**
   * Calculate individual scoring components for a memory fragment
   */
  private async calculateFragmentScores(
    fragment: RankedMemoryFragment,
    query: string,
    conversationContext: ConversationContext,
    queryEmbedding?: number[]
  ): Promise<RankedMemoryFragment> {
    // Calculate relevance score (semantic similarity to query)
    fragment.relevanceScore = await this.calculateRelevanceScore(fragment, query, queryEmbedding)

    // Calculate freshness score (recency and access patterns)
    fragment.freshnessScore = this.calculateFreshnessScore(fragment)

    // Calculate topic relevance score (alignment with conversation topics)
    fragment.topicRelevanceScore = this.calculateTopicRelevanceScore(fragment, conversationContext)

    // Calculate conversational context score (fit with current conversation style/tone)
    fragment.conversationalContextScore = this.calculateConversationalContextScore(fragment, conversationContext)

    return fragment
  }

  /**
   * Calculate semantic relevance score using text similarity
   */
  private async calculateRelevanceScore(
    fragment: RankedMemoryFragment,
    query: string,
    queryEmbedding?: number[]
  ): Promise<number> {
    // If we have embeddings, use cosine similarity
    if (queryEmbedding && fragment.embedding) {
      return this.calculateCosineSimilarity(queryEmbedding, fragment.embedding)
    }

    // Fallback to text-based similarity
    return this.calculateTextSimilarity(query, fragment.fragmentText)
  }

  /**
   * Calculate freshness score based on recency and access patterns
   */
  private calculateFreshnessScore(fragment: RankedMemoryFragment): number {
    const now = new Date()
    const createdAt = fragment.createdAt || now
    const daysSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)

    // Base freshness score (1.0 for recent, decaying over time)
    let freshnessScore = 1.0
    if (daysSinceCreation > this.config.freshnessDecayDays) {
      const decayFactor = Math.exp(-(daysSinceCreation - this.config.freshnessDecayDays) / this.config.freshnessDecayDays)
      freshnessScore = Math.max(this.config.maxFreshnessDecay, decayFactor)
    }

    // Boost score for recently accessed memories
    const lastAccessed = fragment.rankingMetadata.lastAccessed || createdAt
    const daysSinceAccess = (now.getTime() - lastAccessed.getTime()) / (1000 * 60 * 60 * 24)
    if (daysSinceAccess < 7) {
      freshnessScore *= 1.2 // 20% boost for recently accessed
    }

    // Boost score for frequently accessed memories
    const accessCount = fragment.rankingMetadata.accessCount || 1
    if (accessCount > 3) {
      freshnessScore *= Math.min(1.5, 1 + (accessCount - 3) * 0.1)
    }

    return Math.min(1.0, freshnessScore)
  }

  /**
   * Calculate topic relevance score based on topic alignment
   */
  private calculateTopicRelevanceScore(
    fragment: RankedMemoryFragment,
    conversationContext: ConversationContext
  ): number {
    let score = 0.5 // Base score

    // Check alignment with current topic
    if (conversationContext.currentTopic) {
      const topicMatch = this.calculateTopicMatch(
        fragment.rankingMetadata.topicTags,
        [conversationContext.currentTopic]
      )
      score += topicMatch * 0.4
    }

    // Check alignment with recent topics
    if (conversationContext.recentTopics.length > 0) {
      const recentTopicMatch = this.calculateTopicMatch(
        fragment.rankingMetadata.topicTags,
        conversationContext.recentTopics
      )
      score += recentTopicMatch * 0.3
    }

    // Boost for memories that introduce new relevant topics
    const noveltyBoost = this.calculateNoveltyBoost(fragment, conversationContext)
    score += noveltyBoost * 0.2

    return Math.min(1.0, score)
  }

  /**
   * Calculate conversational context score based on tone and style alignment
   */
  private calculateConversationalContextScore(
    fragment: RankedMemoryFragment,
    conversationContext: ConversationContext
  ): number {
    let score = 0.5 // Base score

    // Emotional tone alignment
    if (conversationContext.emotionalTone && fragment.rankingMetadata.emotionalContext) {
      if (this.areEmotionalTonesCompatible(conversationContext.emotionalTone, fragment.rankingMetadata.emotionalContext)) {
        score += 0.3
      }
    }

    // Conversation type alignment
    if (this.areConversationTypesCompatible(conversationContext.conversationType, fragment.rankingMetadata.conversationType)) {
      score += 0.3
    }

    // User intent alignment (if available)
    if (conversationContext.userIntent) {
      const intentMatch = this.calculateIntentMatch(fragment, conversationContext.userIntent)
      score += intentMatch * 0.2
    }

    return Math.min(1.0, score)
  }

  /**
   * Calculate final composite scores using weighted combination
   */
  private calculateFinalScores(fragments: RankedMemoryFragment[]): RankedMemoryFragment[] {
    return fragments.map(fragment => {
      fragment.finalScore = 
        fragment.relevanceScore * this.config.relevanceWeight +
        fragment.freshnessScore * this.config.freshnessWeight +
        fragment.topicRelevanceScore * this.config.topicWeight +
        fragment.conversationalContextScore * this.config.contextWeight

      return fragment
    })
  }

  /**
   * Deduplicate similar memories to avoid redundancy
   */
  private deduplicateMemories(fragments: RankedMemoryFragment[]): RankedMemoryFragment[] {
    const duplicateGroups = new Map<string, RankedMemoryFragment[]>()
    const processed = new Set<string>()

    // Group similar memories
    for (const fragment of fragments) {
      if (processed.has(fragment.id!)) continue

      const groupId = this.generateDuplicateGroupId(fragment)
      if (!duplicateGroups.has(groupId)) {
        duplicateGroups.set(groupId, [])
      }

      // Find similar memories
      const similarMemories = fragments.filter(other => 
        !processed.has(other.id!) && 
        this.areMemoriesSimilar(fragment, other)
      )

      duplicateGroups.get(groupId)!.push(fragment, ...similarMemories)
      
      // Mark all as processed
      similarMemories.forEach(mem => processed.add(mem.id!))
      processed.add(fragment.id!)
    }

    // Keep only the best memories from each group
    const deduplicatedFragments: RankedMemoryFragment[] = []
    
    for (const [groupId, groupMemories] of duplicateGroups) {
      // Sort by preliminary score (sum of individual scores)
      const sortedGroup = groupMemories
        .map(mem => ({
          ...mem,
          preliminaryScore: mem.relevanceScore + mem.freshnessScore + mem.topicRelevanceScore + mem.conversationalContextScore
        }))
        .sort((a, b) => b.preliminaryScore - a.preliminaryScore)
        .slice(0, this.config.maxDuplicatesPerGroup)

      // Mark duplicate group
      sortedGroup.forEach(mem => {
        mem.rankingMetadata.duplicateGroup = groupId
      })

      deduplicatedFragments.push(...sortedGroup)
    }

    return deduplicatedFragments
  }

  // Helper methods for scoring calculations

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

  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/))
    const words2 = new Set(text2.toLowerCase().split(/\s+/))
    
    const intersection = new Set([...words1].filter(word => words2.has(word)))
    const union = new Set([...words1, ...words2])
    
    return union.size > 0 ? intersection.size / union.size : 0
  }

  private extractTopicTags(text: string): string[] {
    const topics: string[] = []
    const lowerText = text.toLowerCase()

    // Define topic categories and their keywords
    const topicKeywords = {
      family: ['family', 'mother', 'father', 'sister', 'brother', 'parent', 'child', 'spouse', 'wife', 'husband'],
      work: ['work', 'job', 'career', 'office', 'colleague', 'boss', 'project', 'meeting', 'business'],
      hobbies: ['hobby', 'interest', 'passion', 'enjoy', 'love', 'like', 'fun', 'play', 'game', 'sport'],
      travel: ['travel', 'trip', 'vacation', 'visit', 'country', 'city', 'place', 'journey', 'adventure'],
      health: ['health', 'doctor', 'medical', 'sick', 'well', 'exercise', 'fitness', 'diet', 'medicine'],
      education: ['school', 'university', 'college', 'study', 'learn', 'education', 'degree', 'course', 'teacher'],
      relationships: ['friend', 'relationship', 'dating', 'love', 'partner', 'social', 'meet', 'connect'],
      personal: ['feel', 'think', 'believe', 'opinion', 'personal', 'private', 'secret', 'important']
    }

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        topics.push(topic)
      }
    }

    return topics.length > 0 ? topics : ['general']
  }

  private detectEmotionalContext(fragment: MemoryFragment): string {
    const text = fragment.fragmentText.toLowerCase()
    const context = fragment.conversationContext as any

    // Check conversation context first
    if (context?.emotionalTone) {
      return context.emotionalTone
    }

    // Detect from text content
    if (text.match(/\b(happy|joy|excited|love|wonderful|great|amazing|fantastic)\b/)) {
      return 'positive'
    }
    if (text.match(/\b(sad|upset|angry|frustrated|worried|anxious|scared|terrible)\b/)) {
      return 'negative'
    }
    if (text.match(/\b(thinking|wondering|curious|interesting|hmm|maybe|perhaps)\b/)) {
      return 'contemplative'
    }
    if (text.match(/\b(excited|thrilled|energetic|passionate|enthusiastic)\b/)) {
      return 'excited'
    }

    return 'neutral'
  }

  private classifyConversationType(text: string): string {
    const lowerText = text.toLowerCase()

    if (lowerText.match(/\b(hello|hi|hey|good morning|good evening|how are you)\b/)) {
      return 'greeting'
    }
    if (lowerText.match(/\b(work|business|professional|career|job|office|meeting)\b/)) {
      return 'professional'
    }
    if (lowerText.match(/\b(feel|emotion|personal|private|important|meaningful|deep)\b/)) {
      return 'deep'
    }
    if (lowerText.match(/\b(family|friend|relationship|love|personal|life|story)\b/)) {
      return 'personal'
    }

    return 'casual'
  }

  private calculateTopicMatch(fragmentTopics: string[], contextTopics: string[]): number {
    if (fragmentTopics.length === 0 || contextTopics.length === 0) return 0

    const matches = fragmentTopics.filter(topic => 
      contextTopics.some(contextTopic => 
        topic === contextTopic || this.areTopicsRelated(topic, contextTopic)
      )
    )

    return matches.length / Math.max(fragmentTopics.length, contextTopics.length)
  }

  private areTopicsRelated(topic1: string, topic2: string): boolean {
    const relatedTopics = {
      family: ['relationships', 'personal'],
      work: ['professional', 'career'],
      hobbies: ['personal', 'interests'],
      travel: ['adventure', 'experiences'],
      health: ['personal', 'wellness'],
      education: ['learning', 'growth']
    }

    return relatedTopics[topic1 as keyof typeof relatedTopics]?.includes(topic2) ||
           relatedTopics[topic2 as keyof typeof relatedTopics]?.includes(topic1) ||
           false
  }

  private calculateNoveltyBoost(fragment: RankedMemoryFragment, context: ConversationContext): number {
    const fragmentTopics = fragment.rankingMetadata.topicTags
    const discussedTopics = [context.currentTopic, ...context.recentTopics].filter(Boolean)

    const novelTopics = fragmentTopics.filter(topic => !discussedTopics.includes(topic))
    return novelTopics.length / Math.max(fragmentTopics.length, 1) * 0.5
  }

  private areEmotionalTonesCompatible(tone1: string, tone2: string): boolean {
    const compatibleTones = {
      positive: ['positive', 'excited', 'neutral'],
      negative: ['negative', 'contemplative', 'neutral'],
      excited: ['positive', 'excited', 'neutral'],
      contemplative: ['contemplative', 'neutral', 'negative'],
      neutral: ['positive', 'negative', 'excited', 'contemplative', 'neutral']
    }

    return compatibleTones[tone1 as keyof typeof compatibleTones]?.includes(tone2) || false
  }

  private areConversationTypesCompatible(type1: string, type2: string): boolean {
    if (type1 === type2) return true

    const compatibleTypes = {
      greeting: ['casual', 'personal'],
      personal: ['deep', 'casual', 'greeting'],
      professional: ['casual'],
      deep: ['personal', 'casual'],
      casual: ['greeting', 'personal', 'professional', 'deep'],
      unknown: ['casual']
    }

    return compatibleTypes[type1 as keyof typeof compatibleTypes]?.includes(type2) || false
  }

  private calculateIntentMatch(fragment: RankedMemoryFragment, userIntent: string): number {
    const intentKeywords = userIntent.toLowerCase().split(/\s+/)
    const fragmentText = fragment.fragmentText.toLowerCase()

    const matches = intentKeywords.filter(keyword => fragmentText.includes(keyword))
    return matches.length / intentKeywords.length
  }

  private areMemoriesSimilar(memory1: RankedMemoryFragment, memory2: RankedMemoryFragment): boolean {
    // Calculate text similarity
    const textSimilarity = this.calculateTextSimilarity(memory1.fragmentText, memory2.fragmentText)
    
    // Check topic overlap
    const topicOverlap = this.calculateTopicMatch(
      memory1.rankingMetadata.topicTags,
      memory2.rankingMetadata.topicTags
    )

    // Consider similar if high text similarity or significant topic overlap
    return textSimilarity > this.config.similarityThreshold || 
           (textSimilarity > 0.6 && topicOverlap > 0.7)
  }

  private generateDuplicateGroupId(fragment: RankedMemoryFragment): string {
    // Generate a group ID based on key characteristics
    const topics = fragment.rankingMetadata.topicTags.sort().join('-')
    const emotional = fragment.rankingMetadata.emotionalContext
    const type = fragment.rankingMetadata.conversationType
    
    return `${topics}-${emotional}-${type}`
  }

  /**
   * Identify memories that should be archived based on age and low scores
   */
  identifyMemoriesForArchival(fragments: RankedMemoryFragment[]): string[] {
    const now = new Date()
    const archivalCandidates: string[] = []

    for (const fragment of fragments) {
      const createdAt = fragment.createdAt || now
      const daysSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)

      // Archive if old and low-scored
      if (daysSinceCreation > this.config.archivalThresholdDays && 
          fragment.finalScore < this.config.minScoreForArchival) {
        archivalCandidates.push(fragment.id!)
      }
    }

    return archivalCandidates
  }

  /**
   * Get ranking configuration
   */
  getConfig(): MemoryRankingConfig {
    return { ...this.config }
  }

  /**
   * Update ranking configuration
   */
  updateConfig(updates: Partial<MemoryRankingConfig>): void {
    this.config = { ...this.config, ...updates }
  }
}