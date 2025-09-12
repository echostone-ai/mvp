/**
 * Context-Aware Expression Service
 * 
 * Integrates advanced expression scheduling with conversation context,
 * user preferences, and learning algorithms.
 */

import { 
  AdvancedExpressionScheduler, 
  ConversationContext, 
  UserFeedback,
  EmotionalTone 
} from './advancedExpressionScheduler';
import { ExpressionClip, OverlaySchedule, ScheduleOverlaysOptions } from '../expressionScheduler';
import { StoredExpression } from './expressionStorageService';
import { logger } from '../logger';

export interface ConversationSession {
  id: string;
  userId: string;
  avatarId: string;
  startTime: Date;
  lastActivity: Date;
  turnCount: number;
  currentTopic?: string;
  emotionalHistory: EmotionalTone[];
}

export interface ExpressionAnalytics {
  sessionId: string;
  expressionsUsed: number;
  userSatisfaction?: number;
  emotionalTones: EmotionalTone[];
  adaptationMetrics: {
    learningRate: number;
    preferenceAccuracy: number;
    contextRelevance: number;
  };
}

/**
 * Main service for context-aware expression scheduling
 */
export class ContextAwareExpressionService {
  private scheduler: AdvancedExpressionScheduler;
  private activeSessions: Map<string, ConversationSession> = new Map();
  private sessionAnalytics: Map<string, ExpressionAnalytics> = new Map();

  constructor(scheduler?: AdvancedExpressionScheduler) {
    this.scheduler = scheduler || new AdvancedExpressionScheduler();
  }

  /**
   * Initialize or resume a conversation session
   */
  async initializeSession(
    userId: string,
    avatarId: string,
    sessionId?: string
  ): Promise<ConversationSession> {
    const id = sessionId || this.generateSessionId(userId, avatarId);
    
    let session = this.activeSessions.get(id);
    
    if (!session) {
      session = {
        id,
        userId,
        avatarId,
        startTime: new Date(),
        lastActivity: new Date(),
        turnCount: 0,
        emotionalHistory: []
      };
      
      this.activeSessions.set(id, session);
      
      // Initialize analytics
      this.sessionAnalytics.set(id, {
        sessionId: id,
        expressionsUsed: 0,
        emotionalTones: [],
        adaptationMetrics: {
          learningRate: 0,
          preferenceAccuracy: 0,
          contextRelevance: 0
        }
      });
      
      logger.debug('Initialized new conversation session', { sessionId: id, userId, avatarId });
    } else {
      // Resume existing session
      session.lastActivity = new Date();
      logger.debug('Resumed conversation session', { sessionId: id, turnCount: session.turnCount });
    }
    
    return session;
  }

  /**
   * Schedule expressions for a conversation turn with full context awareness
   */
  async scheduleContextAwareExpressions(
    text: string,
    expressions: StoredExpression[],
    sessionId: string,
    conversationTopic?: string,
    options: ScheduleOverlaysOptions = {}
  ): Promise<OverlaySchedule[]> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      // Update session
      session.turnCount++;
      session.lastActivity = new Date();
      if (conversationTopic) {
        session.currentTopic = conversationTopic;
      }

      // Convert stored expressions to clips
      const clips: ExpressionClip[] = expressions
        .filter(expr => expr.status === 'active')
        .map(expr => ({
          id: expr.id,
          type: expr.type,
          tone: expr.tone,
          placementHints: expr.placementHints,
          cdnUrl: expr.cdnUrl,
          durationMs: expr.durationMs,
          priority: expr.priority || 0
        }));

      // Build conversation context
      const context: ConversationContext = {
        userId: session.userId,
        avatarId: session.avatarId,
        conversationId: sessionId,
        currentTopic: session.currentTopic,
        emotionalTone: this.inferCurrentEmotionalTone(session, text),
        conversationType: this.inferConversationType(text, session),
        recentTopics: this.getRecentTopics(session),
        turnCount: session.turnCount,
        sessionDurationMs: Date.now() - session.startTime.getTime()
      };

      // Schedule expressions using advanced algorithms
      const schedule = await this.scheduler.scheduleAdvancedOverlays(
        text,
        clips,
        context,
        options
      );

      // Update session emotional history
      session.emotionalHistory.push(context.emotionalTone);
      if (session.emotionalHistory.length > 20) {
        session.emotionalHistory.shift(); // Keep last 20 emotional states
      }

      // Update analytics
      await this.updateSessionAnalytics(sessionId, schedule, context);

      logger.debug('Scheduled context-aware expressions', {
        sessionId,
        turnCount: session.turnCount,
        emotionalTone: context.emotionalTone,
        scheduledCount: schedule.length
      });

      return schedule;

    } catch (error) {
      logger.error('Error scheduling context-aware expressions', {
        error,
        sessionId,
        textLength: text?.length || 0
      });
      return [];
    }
  }

  /**
   * Record user feedback for expression learning
   */
  async recordExpressionFeedback(
    sessionId: string,
    feedback: UserFeedback
  ): Promise<void> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        logger.warn('Cannot record feedback for unknown session', { sessionId });
        return;
      }

      await this.scheduler.recordUserFeedback(session.userId, feedback);

      // Update session analytics
      const analytics = this.sessionAnalytics.get(sessionId);
      if (analytics) {
        if (feedback.type === 'positive') {
          analytics.userSatisfaction = (analytics.userSatisfaction || 0.5) * 0.8 + 0.2;
        } else if (feedback.type === 'negative') {
          analytics.userSatisfaction = (analytics.userSatisfaction || 0.5) * 0.8;
        }
      }

      logger.debug('Recorded expression feedback', {
        sessionId,
        feedbackType: feedback.type,
        expressionCount: feedback.specificExpressions?.length || 0
      });

    } catch (error) {
      logger.error('Error recording expression feedback', { error, sessionId });
    }
  }

  /**
   * Get learning analytics for a user
   */
  async getUserLearningAnalytics(userId: string): Promise<any> {
    return await this.scheduler.getLearningAnalytics(userId);
  }

  /**
   * Get session analytics
   */
  getSessionAnalytics(sessionId: string): ExpressionAnalytics | undefined {
    return this.sessionAnalytics.get(sessionId);
  }

  /**
   * End a conversation session
   */
  async endSession(sessionId: string): Promise<ExpressionAnalytics | undefined> {
    const session = this.activeSessions.get(sessionId);
    const analytics = this.sessionAnalytics.get(sessionId);

    if (session && analytics) {
      // Calculate final metrics
      analytics.adaptationMetrics = await this.calculateFinalAdaptationMetrics(session);
      
      logger.info('Ended conversation session', {
        sessionId,
        duration: Date.now() - session.startTime.getTime(),
        turnCount: session.turnCount,
        expressionsUsed: analytics.expressionsUsed,
        userSatisfaction: analytics.userSatisfaction
      });
    }

    // Clean up
    this.activeSessions.delete(sessionId);
    
    return analytics;
  }

  /**
   * Clean up inactive sessions
   */
  cleanupInactiveSessions(maxAgeMs: number = 30 * 60 * 1000): void {
    const now = Date.now();
    const toRemove: string[] = [];

    this.activeSessions.forEach((session, sessionId) => {
      if (now - session.lastActivity.getTime() > maxAgeMs) {
        toRemove.push(sessionId);
      }
    });

    toRemove.forEach(sessionId => {
      this.activeSessions.delete(sessionId);
      this.sessionAnalytics.delete(sessionId);
    });

    if (toRemove.length > 0) {
      logger.debug('Cleaned up inactive sessions', { count: toRemove.length });
    }
  }

  /**
   * Private helper methods
   */

  private generateSessionId(userId: string, avatarId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `session_${userId}_${avatarId}_${timestamp}_${random}`;
  }

  private inferCurrentEmotionalTone(session: ConversationSession, text: string): EmotionalTone {
    // Simple heuristic: use recent emotional history and text analysis
    const recentEmotions = session.emotionalHistory.slice(-3);
    
    // If we have recent emotional context, bias towards it
    if (recentEmotions.length > 0) {
      const lastEmotion = recentEmotions[recentEmotions.length - 1];
      
      // Check if current text suggests a different emotion
      const textEmotion = this.analyzeTextEmotion(text);
      
      // If text suggests strong emotion, use it; otherwise continue recent trend
      if (this.isStrongEmotionalSignal(text)) {
        return textEmotion;
      } else {
        return lastEmotion;
      }
    }
    
    // Fallback to text analysis
    return this.analyzeTextEmotion(text);
  }

  private analyzeTextEmotion(text: string): EmotionalTone {
    const lowerText = text.toLowerCase();
    
    // Simple pattern matching (could be enhanced with ML)
    if (/\b(happy|joy|excited|wonderful|amazing|great|fantastic)\b/.test(lowerText)) {
      return 'positive';
    } else if (/\b(sad|disappointed|upset|frustrated|angry)\b/.test(lowerText)) {
      return 'negative';
    } else if (/\b(funny|hilarious|joke|laugh|haha|lol)\b/.test(lowerText)) {
      return 'humorous';
    } else if (/\b(think|consider|ponder|reflect|wonder)\b/.test(lowerText)) {
      return 'contemplative';
    } else if (/\b(understand|feel|sorry|sympathy|care)\b/.test(lowerText)) {
      return 'empathetic';
    } else if (/\b(what|how|why|when|where|tell me)\b/.test(lowerText)) {
      return 'curious';
    } else if (/\b(remember|memory|past|childhood|used to)\b/.test(lowerText)) {
      return 'nostalgic';
    } else if (/\b(wow|amazing|incredible|surprise|shocked)\b/.test(lowerText)) {
      return 'surprised';
    } else if (/\b(wow|amazing|incredible|fantastic|awesome)\b/.test(lowerText)) {
      return 'excited';
    }
    
    return 'neutral';
  }

  private isStrongEmotionalSignal(text: string): boolean {
    // Check for strong emotional indicators
    return /[!]{2,}|[A-Z]{3,}|\b(very|extremely|incredibly|absolutely)\b/.test(text);
  }

  private inferConversationType(text: string, session: ConversationSession): 'casual' | 'formal' | 'intimate' | 'professional' {
    const lowerText = text.toLowerCase();
    
    // Simple heuristics
    if (/\b(sir|madam|please|thank you|regards|sincerely)\b/.test(lowerText)) {
      return 'formal';
    } else if (/\b(love|heart|personal|private|secret|intimate)\b/.test(lowerText)) {
      return 'intimate';
    } else if (/\b(business|work|project|meeting|deadline|professional)\b/.test(lowerText)) {
      return 'professional';
    }
    
    return 'casual';
  }

  private getRecentTopics(session: ConversationSession): string[] {
    // In a real implementation, this would track conversation topics
    // For now, return empty array or use current topic
    return session.currentTopic ? [session.currentTopic] : [];
  }

  private async updateSessionAnalytics(
    sessionId: string,
    schedule: OverlaySchedule[],
    context: ConversationContext
  ): Promise<void> {
    const analytics = this.sessionAnalytics.get(sessionId);
    if (!analytics) return;

    analytics.expressionsUsed += schedule.length;
    analytics.emotionalTones.push(context.emotionalTone);

    // Update adaptation metrics (simplified)
    const userAnalytics = await this.scheduler.getLearningAnalytics(context.userId);
    analytics.adaptationMetrics = {
      learningRate: userAnalytics.adaptationScore,
      preferenceAccuracy: userAnalytics.positiveFeedbackRate,
      contextRelevance: schedule.length > 0 ? 0.8 : 0.3 // Simple heuristic
    };
  }

  private async calculateFinalAdaptationMetrics(session: ConversationSession): Promise<{
    learningRate: number;
    preferenceAccuracy: number;
    contextRelevance: number;
  }> {
    const userAnalytics = await this.scheduler.getLearningAnalytics(session.userId);
    
    return {
      learningRate: userAnalytics.adaptationScore,
      preferenceAccuracy: userAnalytics.positiveFeedbackRate,
      contextRelevance: session.emotionalHistory.length > 0 ? 0.7 : 0.5
    };
  }
}

// Export singleton instance
export const contextAwareExpressionService = new ContextAwareExpressionService();