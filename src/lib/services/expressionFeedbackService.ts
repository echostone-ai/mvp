/**
 * Expression Feedback Service
 * 
 * Collects and processes user feedback on expression usage for learning and adaptation.
 * Supports both explicit feedback (user ratings) and implicit feedback (interaction patterns).
 */

import { supabase } from '../supabase';
import { ExpressionType } from './expressionStorageService';
import { EmotionalTone } from './advancedExpressionScheduler';
import { logger } from '../logger';

export interface ExpressionFeedback {
  id: string;
  userId: string;
  sessionId: string;
  expressionId: string;
  expressionType: ExpressionType;
  feedbackType: 'explicit' | 'implicit';
  rating: number; // 0-1 scale
  context: FeedbackContext;
  timestamp: Date;
  processed: boolean;
}

export interface FeedbackContext {
  conversationTurn: number;
  emotionalTone: EmotionalTone;
  conversationType: 'casual' | 'formal' | 'intimate' | 'professional';
  textContent: string; // Truncated for privacy
  expressionTiming: number; // When in the response the expression played
  userReaction?: UserReaction;
}

export interface UserReaction {
  type: 'skip' | 'replay' | 'pause' | 'continue' | 'rate';
  value?: number; // For explicit ratings
  timestamp: Date;
  interactionDelay: number; // Time between expression and reaction
}

export interface FeedbackAnalytics {
  totalFeedback: number;
  averageRating: number;
  feedbackByType: Record<ExpressionType, {
    count: number;
    averageRating: number;
    trend: 'improving' | 'declining' | 'stable';
  }>;
  contextualPerformance: Record<EmotionalTone, {
    count: number;
    averageRating: number;
  }>;
  learningMetrics: {
    adaptationRate: number;
    userSatisfactionTrend: number[];
    predictionAccuracy: number;
  };
}

export interface FeedbackPattern {
  userId: string;
  patterns: {
    preferredTimings: number[]; // Preferred expression timing in responses
    emotionalPreferences: Record<EmotionalTone, number>; // Preference scores by emotion
    contextualPreferences: Record<string, number>; // Preference scores by context
    frequencyPreference: number; // Preferred expression frequency (0-1)
  };
  confidence: number; // How confident we are in these patterns
  lastUpdated: Date;
}

/**
 * Service for collecting and analyzing expression feedback
 */
export class ExpressionFeedbackService {
  private feedbackBuffer: ExpressionFeedback[] = [];
  private readonly BUFFER_SIZE = 100;
  private readonly BATCH_PROCESS_INTERVAL = 30000; // 30 seconds
  private processingTimer?: NodeJS.Timeout;

  constructor() {
    this.startBatchProcessing();
  }

  /**
   * Record explicit user feedback (ratings, likes/dislikes)
   */
  async recordExplicitFeedback(
    userId: string,
    sessionId: string,
    expressionId: string,
    expressionType: ExpressionType,
    rating: number,
    context: FeedbackContext
  ): Promise<void> {
    try {
      const feedback: ExpressionFeedback = {
        id: this.generateFeedbackId(),
        userId,
        sessionId,
        expressionId,
        expressionType,
        feedbackType: 'explicit',
        rating: Math.max(0, Math.min(1, rating)), // Clamp to 0-1
        context,
        timestamp: new Date(),
        processed: false
      };

      // Add to buffer for batch processing
      this.feedbackBuffer.push(feedback);

      // Process immediately if buffer is full
      if (this.feedbackBuffer.length >= this.BUFFER_SIZE) {
        await this.processFeedbackBatch();
      }

      logger.debug('Recorded explicit feedback', {
        userId,
        expressionType,
        rating,
        emotionalTone: context.emotionalTone
      });

    } catch (error) {
      logger.error('Error recording explicit feedback', {
        error,
        userId,
        expressionId,
        rating
      });
    }
  }

  /**
   * Record implicit feedback from user interactions
   */
  async recordImplicitFeedback(
    userId: string,
    sessionId: string,
    expressionId: string,
    expressionType: ExpressionType,
    reaction: UserReaction,
    context: FeedbackContext
  ): Promise<void> {
    try {
      // Convert reaction to rating
      const rating = this.convertReactionToRating(reaction);

      const feedback: ExpressionFeedback = {
        id: this.generateFeedbackId(),
        userId,
        sessionId,
        expressionId,
        expressionType,
        feedbackType: 'implicit',
        rating,
        context: {
          ...context,
          userReaction: reaction
        },
        timestamp: new Date(),
        processed: false
      };

      this.feedbackBuffer.push(feedback);

      logger.debug('Recorded implicit feedback', {
        userId,
        expressionType,
        reactionType: reaction.type,
        rating,
        interactionDelay: reaction.interactionDelay
      });

    } catch (error) {
      logger.error('Error recording implicit feedback', {
        error,
        userId,
        expressionId,
        reactionType: reaction.type
      });
    }
  }

  /**
   * Get feedback analytics for a user
   */
  async getUserFeedbackAnalytics(userId: string): Promise<FeedbackAnalytics> {
    try {
      const { data, error } = await supabase
        .from('expression_feedback')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(1000); // Last 1000 feedback entries

      if (error) throw error;

      const feedback = data as ExpressionFeedback[];
      
      return this.calculateAnalytics(feedback);

    } catch (error) {
      logger.error('Error getting user feedback analytics', { error, userId });
      
      return this.getEmptyAnalytics();
    }
  }

  /**
   * Get aggregated feedback analytics (anonymized)
   */
  async getAggregatedAnalytics(): Promise<FeedbackAnalytics> {
    try {
      const { data, error } = await supabase
        .from('expression_feedback')
        .select('expression_type, rating, context, timestamp')
        .gte('timestamp', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
        .limit(10000);

      if (error) throw error;

      return this.calculateAnalytics(data as ExpressionFeedback[]);

    } catch (error) {
      logger.error('Error getting aggregated analytics', { error });
      
      return this.getEmptyAnalytics();
    }
  }

  /**
   * Detect user feedback patterns for personalization
   */
  async detectUserPatterns(userId: string): Promise<FeedbackPattern | null> {
    try {
      const { data, error } = await supabase
        .from('expression_feedback')
        .select('*')
        .eq('user_id', userId)
        .gte('timestamp', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()) // Last 14 days
        .order('timestamp', { ascending: false });

      if (error) throw error;

      const feedback = data as ExpressionFeedback[];
      
      if (feedback.length < 10) {
        // Not enough data for pattern detection
        return null;
      }

      return this.analyzeUserPatterns(userId, feedback);

    } catch (error) {
      logger.error('Error detecting user patterns', { error, userId });
      return null;
    }
  }

  /**
   * Get learning recommendations based on feedback
   */
  async getLearningRecommendations(userId: string): Promise<{
    recommendedTypes: ExpressionType[];
    avoidTypes: ExpressionType[];
    timingAdjustments: Record<EmotionalTone, number>;
    frequencyAdjustment: number;
  }> {
    try {
      const patterns = await this.detectUserPatterns(userId);
      
      if (!patterns) {
        return {
          recommendedTypes: [],
          avoidTypes: [],
          timingAdjustments: {},
          frequencyAdjustment: 0
        };
      }

      // Analyze patterns to generate recommendations
      const analytics = await this.getUserFeedbackAnalytics(userId);
      
      const recommendedTypes: ExpressionType[] = [];
      const avoidTypes: ExpressionType[] = [];
      
      Object.entries(analytics.feedbackByType).forEach(([type, stats]) => {
        if (stats.averageRating > 0.7 && stats.count >= 3) {
          recommendedTypes.push(type as ExpressionType);
        } else if (stats.averageRating < 0.3 && stats.count >= 3) {
          avoidTypes.push(type as ExpressionType);
        }
      });

      // Calculate timing adjustments
      const timingAdjustments: Record<EmotionalTone, number> = {};
      Object.entries(patterns.patterns.emotionalPreferences).forEach(([emotion, score]) => {
        if (score > 0.7) {
          timingAdjustments[emotion as EmotionalTone] = -0.2; // Earlier timing for preferred emotions
        } else if (score < 0.3) {
          timingAdjustments[emotion as EmotionalTone] = 0.3; // Later timing for less preferred emotions
        }
      });

      return {
        recommendedTypes,
        avoidTypes,
        timingAdjustments,
        frequencyAdjustment: patterns.patterns.frequencyPreference - 0.5 // -0.5 to +0.5 adjustment
      };

    } catch (error) {
      logger.error('Error getting learning recommendations', { error, userId });
      
      return {
        recommendedTypes: [],
        avoidTypes: [],
        timingAdjustments: {},
        frequencyAdjustment: 0
      };
    }
  }

  /**
   * Clean up old feedback data
   */
  async cleanupOldFeedback(retentionDays: number = 90): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      
      const { error } = await supabase
        .from('expression_feedback')
        .delete()
        .lt('timestamp', cutoffDate.toISOString());

      if (error) throw error;

      logger.info('Cleaned up old feedback data', { retentionDays, cutoffDate });

    } catch (error) {
      logger.error('Error cleaning up old feedback', { error, retentionDays });
    }
  }

  /**
   * Private helper methods
   */

  private startBatchProcessing(): void {
    this.processingTimer = setInterval(async () => {
      if (this.feedbackBuffer.length > 0) {
        await this.processFeedbackBatch();
      }
    }, this.BATCH_PROCESS_INTERVAL);
  }

  private async processFeedbackBatch(): Promise<void> {
    if (this.feedbackBuffer.length === 0) return;

    try {
      const batch = this.feedbackBuffer.splice(0, this.BUFFER_SIZE);
      
      // Convert to database format
      const dbRecords = batch.map(feedback => ({
        id: feedback.id,
        user_id: feedback.userId,
        session_id: feedback.sessionId,
        expression_id: feedback.expressionId,
        expression_type: feedback.expressionType,
        feedback_type: feedback.feedbackType,
        rating: feedback.rating,
        context: feedback.context,
        timestamp: feedback.timestamp.toISOString(),
        processed: false
      }));

      const { error } = await supabase
        .from('expression_feedback')
        .insert(dbRecords);

      if (error) throw error;

      logger.debug('Processed feedback batch', { count: batch.length });

    } catch (error) {
      logger.error('Error processing feedback batch', { error, batchSize: this.feedbackBuffer.length });
      
      // Re-add failed items to buffer for retry
      // In production, you might want to implement a dead letter queue
    }
  }

  private convertReactionToRating(reaction: UserReaction): number {
    switch (reaction.type) {
      case 'skip':
        return 0.1; // Very negative
      case 'pause':
        return 0.3; // Negative
      case 'continue':
        return 0.7; // Positive
      case 'replay':
        return 0.9; // Very positive
      case 'rate':
        return reaction.value || 0.5; // Explicit rating
      default:
        return 0.5; // Neutral
    }
  }

  private calculateAnalytics(feedback: ExpressionFeedback[]): FeedbackAnalytics {
    if (feedback.length === 0) {
      return this.getEmptyAnalytics();
    }

    const totalFeedback = feedback.length;
    const averageRating = feedback.reduce((sum, f) => sum + f.rating, 0) / totalFeedback;

    // Feedback by type
    const feedbackByType: Record<string, { count: number; averageRating: number; ratings: number[] }> = {};
    
    feedback.forEach(f => {
      if (!feedbackByType[f.expressionType]) {
        feedbackByType[f.expressionType] = { count: 0, averageRating: 0, ratings: [] };
      }
      feedbackByType[f.expressionType].count++;
      feedbackByType[f.expressionType].ratings.push(f.rating);
    });

    // Calculate averages and trends
    const processedFeedbackByType: Record<ExpressionType, any> = {};
    Object.entries(feedbackByType).forEach(([type, data]) => {
      const avgRating = data.ratings.reduce((sum, r) => sum + r, 0) / data.count;
      
      // Simple trend calculation (compare first half vs second half)
      const midpoint = Math.floor(data.ratings.length / 2);
      const firstHalf = data.ratings.slice(0, midpoint);
      const secondHalf = data.ratings.slice(midpoint);
      
      let trend: 'improving' | 'declining' | 'stable' = 'stable';
      if (firstHalf.length > 0 && secondHalf.length > 0) {
        const firstAvg = firstHalf.reduce((sum, r) => sum + r, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, r) => sum + r, 0) / secondHalf.length;
        
        if (secondAvg > firstAvg + 0.1) trend = 'improving';
        else if (secondAvg < firstAvg - 0.1) trend = 'declining';
      }

      processedFeedbackByType[type as ExpressionType] = {
        count: data.count,
        averageRating: avgRating,
        trend
      };
    });

    // Contextual performance
    const contextualPerformance: Record<EmotionalTone, { count: number; averageRating: number }> = {};
    feedback.forEach(f => {
      const emotion = f.context.emotionalTone;
      if (!contextualPerformance[emotion]) {
        contextualPerformance[emotion] = { count: 0, averageRating: 0 };
      }
      contextualPerformance[emotion].count++;
    });

    Object.keys(contextualPerformance).forEach(emotion => {
      const emotionFeedback = feedback.filter(f => f.context.emotionalTone === emotion);
      const avgRating = emotionFeedback.reduce((sum, f) => sum + f.rating, 0) / emotionFeedback.length;
      contextualPerformance[emotion as EmotionalTone].averageRating = avgRating;
    });

    // Learning metrics (simplified)
    const recentFeedback = feedback.slice(0, Math.min(100, feedback.length));
    const adaptationRate = recentFeedback.length > 10 ? 
      recentFeedback.filter(f => f.rating > 0.6).length / recentFeedback.length : 0;

    return {
      totalFeedback,
      averageRating,
      feedbackByType: processedFeedbackByType,
      contextualPerformance,
      learningMetrics: {
        adaptationRate,
        userSatisfactionTrend: [averageRating], // Simplified
        predictionAccuracy: adaptationRate // Simplified
      }
    };
  }

  private analyzeUserPatterns(userId: string, feedback: ExpressionFeedback[]): FeedbackPattern {
    // Analyze preferred timings
    const timings = feedback
      .filter(f => f.rating > 0.6)
      .map(f => f.context.expressionTiming);
    
    // Analyze emotional preferences
    const emotionalPreferences: Record<EmotionalTone, number> = {} as any;
    const emotionCounts: Record<EmotionalTone, { total: number; positive: number }> = {} as any;
    
    feedback.forEach(f => {
      const emotion = f.context.emotionalTone;
      if (!emotionCounts[emotion]) {
        emotionCounts[emotion] = { total: 0, positive: 0 };
      }
      emotionCounts[emotion].total++;
      if (f.rating > 0.6) {
        emotionCounts[emotion].positive++;
      }
    });

    Object.entries(emotionCounts).forEach(([emotion, counts]) => {
      emotionalPreferences[emotion as EmotionalTone] = counts.positive / counts.total;
    });

    // Calculate frequency preference
    const avgRating = feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length;
    const frequencyPreference = Math.max(0, Math.min(1, avgRating));

    // Calculate confidence based on data quantity and consistency
    const confidence = Math.min(1, feedback.length / 50) * 
      (1 - this.calculateVariance(feedback.map(f => f.rating)));

    return {
      userId,
      patterns: {
        preferredTimings: timings,
        emotionalPreferences,
        contextualPreferences: {}, // Could be expanded
        frequencyPreference
      },
      confidence,
      lastUpdated: new Date()
    };
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 1;
    
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    
    return Math.sqrt(variance);
  }

  private getEmptyAnalytics(): FeedbackAnalytics {
    return {
      totalFeedback: 0,
      averageRating: 0.5,
      feedbackByType: {} as any,
      contextualPerformance: {} as any,
      learningMetrics: {
        adaptationRate: 0,
        userSatisfactionTrend: [],
        predictionAccuracy: 0
      }
    };
  }

  private generateFeedbackId(): string {
    return `feedback_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Cleanup method for graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.processingTimer) {
      clearInterval(this.processingTimer);
    }
    
    // Process any remaining feedback
    if (this.feedbackBuffer.length > 0) {
      await this.processFeedbackBatch();
    }
  }
}

// Export singleton instance
export const expressionFeedbackService = new ExpressionFeedbackService();