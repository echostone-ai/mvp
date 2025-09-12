// src/lib/services/conversationTopicTracker.ts
// Task 13: Add conversation topic tracking and memory categorization

import { ConversationContext } from './advancedMemoryRanking'

export interface TopicTransition {
  fromTopic: string
  toTopic: string
  timestamp: Date
  confidence: number
}

export interface ConversationSession {
  sessionId: string
  userId: string
  avatarId: string
  startTime: Date
  lastActivity: Date
  topics: string[]
  topicTransitions: TopicTransition[]
  emotionalJourney: Array<{
    emotion: string
    timestamp: Date
    confidence: number
  }>
  conversationStyle: string
  userIntent?: string
}

/**
 * Tracks conversation topics and context for improved memory ranking
 * Implements topic tracking component of Task 13
 */
export class ConversationTopicTracker {
  private sessions = new Map<string, ConversationSession>()
  private readonly SESSION_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes
  private readonly MAX_RECENT_TOPICS = 5

  /**
   * Start or resume a conversation session
   */
  startSession(sessionId: string, userId: string, avatarId: string): ConversationSession {
    const existingSession = this.sessions.get(sessionId)
    
    if (existingSession && this.isSessionActive(existingSession)) {
      // Resume existing session
      existingSession.lastActivity = new Date()
      return existingSession
    }

    // Create new session
    const session: ConversationSession = {
      sessionId,
      userId,
      avatarId,
      startTime: new Date(),
      lastActivity: new Date(),
      topics: [],
      topicTransitions: [],
      emotionalJourney: [],
      conversationStyle: 'unknown'
    }

    this.sessions.set(sessionId, session)
    console.log(`[ConversationTopicTracker] Started new session: ${sessionId}`)
    
    return session
  }

  /**
   * Update conversation context based on new message
   */
  updateConversationContext(
    sessionId: string,
    userMessage: string,
    assistantResponse?: string
  ): ConversationContext {
    const session = this.sessions.get(sessionId)
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`)
    }

    // Update last activity
    session.lastActivity = new Date()

    // Analyze current message for topics and context
    const currentTopic = this.extractPrimaryTopic(userMessage)
    const emotionalTone = this.detectEmotionalTone(userMessage)
    const conversationType = this.classifyConversationType(userMessage, assistantResponse)
    const userIntent = this.extractUserIntent(userMessage)

    // Update session with new information
    this.updateSessionTopics(session, currentTopic)
    this.updateEmotionalJourney(session, emotionalTone)
    this.updateConversationStyle(session, conversationType)
    
    if (userIntent) {
      session.userIntent = userIntent
    }

    // Build conversation context
    const context: ConversationContext = {
      currentTopic,
      emotionalTone,
      conversationType,
      recentTopics: this.getRecentTopics(session),
      userIntent
    }

    console.log(`[ConversationTopicTracker] Updated context for session ${sessionId}:`, {
      currentTopic,
      emotionalTone,
      conversationType,
      recentTopicsCount: context.recentTopics.length
    })

    return context
  }

  /**
   * Get current conversation context for a session
   */
  getConversationContext(sessionId: string): ConversationContext | null {
    const session = this.sessions.get(sessionId)
    if (!session || !this.isSessionActive(session)) {
      return null
    }

    const recentTopics = this.getRecentTopics(session)
    const currentTopic = recentTopics[0] || 'general'
    const latestEmotion = session.emotionalJourney[session.emotionalJourney.length - 1]

    return {
      currentTopic,
      emotionalTone: latestEmotion?.emotion || 'neutral',
      conversationType: this.mapConversationStyle(session.conversationStyle),
      recentTopics: recentTopics.slice(1), // Exclude current topic
      userIntent: session.userIntent
    }
  }

  /**
   * Get conversation session statistics
   */
  getSessionStats(sessionId: string): {
    duration: number
    topicCount: number
    topicTransitions: number
    emotionalVariability: number
    dominantTopic: string
    conversationStyle: string
  } | null {
    const session = this.sessions.get(sessionId)
    if (!session) return null

    const duration = session.lastActivity.getTime() - session.startTime.getTime()
    const uniqueTopics = new Set(session.topics)
    const emotionalVariability = this.calculateEmotionalVariability(session)
    const dominantTopic = this.getDominantTopic(session)

    return {
      duration,
      topicCount: uniqueTopics.size,
      topicTransitions: session.topicTransitions.length,
      emotionalVariability,
      dominantTopic,
      conversationStyle: session.conversationStyle
    }
  }

  /**
   * Clean up inactive sessions
   */
  cleanupInactiveSessions(): number {
    const now = new Date()
    let cleanedCount = 0

    for (const [sessionId, session] of this.sessions) {
      if (now.getTime() - session.lastActivity.getTime() > this.SESSION_TIMEOUT_MS) {
        this.sessions.delete(sessionId)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      console.log(`[ConversationTopicTracker] Cleaned up ${cleanedCount} inactive sessions`)
    }

    return cleanedCount
  }

  // Private helper methods

  private isSessionActive(session: ConversationSession): boolean {
    const now = new Date()
    return now.getTime() - session.lastActivity.getTime() < this.SESSION_TIMEOUT_MS
  }

  private extractPrimaryTopic(message: string): string {
    const lowerMessage = message.toLowerCase()
    
    // Define topic patterns with priority (more specific first)
    const topicPatterns = [
      { pattern: /\b(family|mother|father|sister|brother|parent|child|spouse|wife|husband|kids|children)\b/, topic: 'family' },
      { pattern: /\b(work|job|career|office|colleague|boss|project|meeting|business|professional|company)\b/, topic: 'work' },
      { pattern: /\b(travel|trip|vacation|visit|country|city|place|journey|adventure|flight|hotel)\b/, topic: 'travel' },
      { pattern: /\b(health|doctor|medical|sick|well|exercise|fitness|diet|medicine|hospital|therapy)\b/, topic: 'health' },
      { pattern: /\b(school|university|college|study|learn|education|degree|course|teacher|student)\b/, topic: 'education' },
      { pattern: /\b(friend|relationship|dating|love|partner|social|meet|connect|friendship)\b/, topic: 'relationships' },
      { pattern: /\b(hobby|interest|passion|enjoy|love|like|fun|play|game|sport|music|art|reading)\b/, topic: 'hobbies' },
      { pattern: /\b(money|finance|budget|expensive|cheap|cost|price|salary|income|investment)\b/, topic: 'finance' },
      { pattern: /\b(food|eat|restaurant|cook|recipe|meal|dinner|lunch|breakfast|hungry)\b/, topic: 'food' },
      { pattern: /\b(weather|rain|sunny|cold|hot|snow|storm|climate|temperature)\b/, topic: 'weather' },
      { pattern: /\b(movie|film|book|show|tv|music|song|artist|entertainment|watch|read)\b/, topic: 'entertainment' },
      { pattern: /\b(technology|computer|phone|internet|app|software|digital|tech|online)\b/, topic: 'technology' }
    ]

    for (const { pattern, topic } of topicPatterns) {
      if (pattern.test(lowerMessage)) {
        return topic
      }
    }

    return 'general'
  }

  private detectEmotionalTone(message: string): string {
    const lowerMessage = message.toLowerCase()

    // Emotional indicators with confidence scoring
    const emotionalPatterns = [
      { pattern: /\b(excited|thrilled|amazing|fantastic|wonderful|incredible|awesome|great|excellent)\b/, emotion: 'excited', weight: 2 },
      { pattern: /\b(happy|joy|pleased|glad|cheerful|delighted|content|satisfied)\b/, emotion: 'positive', weight: 2 },
      { pattern: /\b(sad|upset|disappointed|hurt|heartbroken|depressed|down|blue)\b/, emotion: 'negative', weight: 2 },
      { pattern: /\b(angry|mad|furious|irritated|annoyed|frustrated|outraged)\b/, emotion: 'negative', weight: 2 },
      { pattern: /\b(worried|anxious|nervous|scared|afraid|concerned|stressed|panic)\b/, emotion: 'anxious', weight: 2 },
      { pattern: /\b(thinking|wondering|curious|interesting|hmm|maybe|perhaps|consider)\b/, emotion: 'contemplative', weight: 1 },
      { pattern: /[!]{2,}/, emotion: 'excited', weight: 1 },
      { pattern: /[?]{2,}/, emotion: 'contemplative', weight: 1 },
      { pattern: /\b(love|adore|passion|passionate)\b/, emotion: 'positive', weight: 1.5 }
    ]

    let emotionScores: { [key: string]: number } = {}

    for (const { pattern, emotion, weight } of emotionalPatterns) {
      const matches = lowerMessage.match(pattern)
      if (matches) {
        emotionScores[emotion] = (emotionScores[emotion] || 0) + weight * matches.length
      }
    }

    // Return emotion with highest score
    const topEmotion = Object.entries(emotionScores)
      .sort(([, a], [, b]) => b - a)[0]

    return topEmotion ? topEmotion[0] : 'neutral'
  }

  private classifyConversationType(userMessage: string, assistantResponse?: string): 'greeting' | 'personal' | 'professional' | 'casual' | 'deep' | 'unknown' {
    const lowerMessage = userMessage.toLowerCase()

    // Greeting patterns
    if (lowerMessage.match(/\b(hello|hi|hey|good morning|good evening|how are you|what's up|greetings)\b/)) {
      return 'greeting'
    }

    // Professional patterns
    if (lowerMessage.match(/\b(work|business|professional|career|job|office|meeting|project|deadline|client)\b/)) {
      return 'professional'
    }

    // Deep conversation patterns
    if (lowerMessage.match(/\b(feel|emotion|personal|private|important|meaningful|deep|soul|heart|life|purpose|meaning)\b/)) {
      return 'deep'
    }

    // Personal patterns
    if (lowerMessage.match(/\b(family|friend|relationship|love|personal|life|story|experience|memory)\b/)) {
      return 'personal'
    }

    // Default to casual
    return 'casual'
  }

  private extractUserIntent(message: string): string | undefined {
    const lowerMessage = message.toLowerCase()

    // Intent patterns
    const intentPatterns = [
      { pattern: /\b(tell me about|what about|explain|describe|share)\b/, intent: 'information_seeking' },
      { pattern: /\b(help|assist|support|advice|suggest|recommend)\b/, intent: 'help_seeking' },
      { pattern: /\b(remember|recall|do you know|did I tell you)\b/, intent: 'memory_query' },
      { pattern: /\b(feel|think|opinion|believe|what do you)\b/, intent: 'opinion_seeking' },
      { pattern: /\b(story|experience|happened|time when)\b/, intent: 'story_sharing' },
      { pattern: /\b(plan|future|going to|will|want to)\b/, intent: 'planning' },
      { pattern: /\b(problem|issue|trouble|difficult|challenge)\b/, intent: 'problem_solving' }
    ]

    for (const { pattern, intent } of intentPatterns) {
      if (pattern.test(lowerMessage)) {
        return intent
      }
    }

    return undefined
  }

  private updateSessionTopics(session: ConversationSession, newTopic: string): void {
    const currentTopic = session.topics[session.topics.length - 1]
    
    if (currentTopic !== newTopic) {
      // Record topic transition
      if (currentTopic) {
        session.topicTransitions.push({
          fromTopic: currentTopic,
          toTopic: newTopic,
          timestamp: new Date(),
          confidence: 0.8 // TODO: Implement confidence scoring
        })
      }

      session.topics.push(newTopic)
      
      // Keep only recent topics to prevent memory bloat
      if (session.topics.length > 20) {
        session.topics = session.topics.slice(-20)
      }
    }
  }

  private updateEmotionalJourney(session: ConversationSession, emotion: string): void {
    const lastEmotion = session.emotionalJourney[session.emotionalJourney.length - 1]
    
    if (!lastEmotion || lastEmotion.emotion !== emotion) {
      session.emotionalJourney.push({
        emotion,
        timestamp: new Date(),
        confidence: 0.7 // TODO: Implement confidence scoring
      })

      // Keep only recent emotions
      if (session.emotionalJourney.length > 10) {
        session.emotionalJourney = session.emotionalJourney.slice(-10)
      }
    }
  }

  private updateConversationStyle(session: ConversationSession, newStyle: string): void {
    // Update conversation style based on patterns
    const styleHistory = session.conversationStyle.split(',').filter(Boolean)
    styleHistory.push(newStyle)
    
    // Keep last 5 style indicators
    const recentStyles = styleHistory.slice(-5)
    
    // Determine dominant style
    const styleCounts: { [key: string]: number } = {}
    recentStyles.forEach(style => {
      styleCounts[style] = (styleCounts[style] || 0) + 1
    })

    const dominantStyle = Object.entries(styleCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'casual'

    session.conversationStyle = dominantStyle
  }

  private getRecentTopics(session: ConversationSession): string[] {
    return session.topics.slice(-this.MAX_RECENT_TOPICS)
  }

  private mapConversationStyle(style: string): 'greeting' | 'personal' | 'professional' | 'casual' | 'deep' | 'unknown' {
    const styleMap: { [key: string]: 'greeting' | 'personal' | 'professional' | 'casual' | 'deep' | 'unknown' } = {
      greeting: 'greeting',
      personal: 'personal',
      professional: 'professional',
      casual: 'casual',
      deep: 'deep'
    }

    return styleMap[style] || 'unknown'
  }

  private calculateEmotionalVariability(session: ConversationSession): number {
    if (session.emotionalJourney.length < 2) return 0

    const uniqueEmotions = new Set(session.emotionalJourney.map(e => e.emotion))
    return uniqueEmotions.size / session.emotionalJourney.length
  }

  private getDominantTopic(session: ConversationSession): string {
    if (session.topics.length === 0) return 'general'

    const topicCounts: { [key: string]: number } = {}
    session.topics.forEach(topic => {
      topicCounts[topic] = (topicCounts[topic] || 0) + 1
    })

    return Object.entries(topicCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'general'
  }

  /**
   * Get all active sessions (for monitoring/debugging)
   */
  getActiveSessions(): ConversationSession[] {
    return Array.from(this.sessions.values()).filter(session => this.isSessionActive(session))
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): ConversationSession | undefined {
    return this.sessions.get(sessionId)
  }
}