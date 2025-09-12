/**
 * Advanced Expression Scheduling Service
 * 
 * Implements context-aware expression selection, emotional state tracking,
 * adaptive frequency control, and learning from user feedback patterns.
 * 
 * Requirements: 3.1, 3.2 - Intelligent Expression Overlay System
 */

import { StoredExpression, ExpressionType } from './expressionStorageService';
import { ExpressionClip, OverlaySchedule, ScheduleOverlaysOptions } from '../expressionScheduler';
import { logger } from '../logger';

export interface ConversationContext {
  userId: string;
  avatarId: string;
  conversationId: string;
  currentTopic?: string;
  emotionalTone: EmotionalTone;
  conversationType: 'casual' | 'formal' | 'intimate' | 'professional';
  recentTopics: string[];
  turnCount: number;
  sessionDurationMs: number;
}

export interface ConversationTurn {
  id: string;
  userMessage: string;
  assistantResponse: string;
  timestamp: Date;
  emotionalTone: EmotionalTone;
  expressionsUsed: string[];
  userFeedback?: UserFeedback;
}

export interface UserFeedback {
  type: 'positive' | 'negative' | 'neutral';
  specificExpressions?: string[]; // Expression IDs that were liked/disliked
  timestamp: Date;
  context: string; // What the feedback was about
}

export interface UserPreferences {
  userId: string;
  expressionFrequency: 'low' | 'medium' | 'high';
  preferredTypes: ExpressionType[];
  dislikedTypes: ExpressionType[];
  adaptiveSettings: {
    learningEnabled: boolean;
    feedbackWeight: number; // 0-1, how much to weight user feedback
    contextWeight: number; // 0-1, how much to weight conversation context
  };
  lastUpdated: Date;
}

export interface EmotionalState {
  primary: EmotionalTone;
  intensity: number; // 0-1
  confidence: number; // 0-1
  context: string;
  timestamp: Date;
}

export type EmotionalTone = 
  | 'positive' 
  | 'negative' 
  | 'neutral' 
  | 'excited' 
  | 'contemplative'
  | 'humorous'
  | 'empathetic'
  | 'curious'
  | 'nostalgic'
  | 'surprised';

export interface ExpressionLearningData {
  expressionId: string;
  type: ExpressionType;
  usageCount: number;
  positiveReactions: number;
  negativeReactions: number;
  contextSuccess: Map<string, number>; // context -> success rate
  emotionalSuccess: Map<EmotionalTone, number>; // emotion -> success rate
  lastUsed: Date;
  averageRating: number;
}

/**
 * Advanced Expression Scheduler with context awareness and learning
 */
export class AdvancedExpressionScheduler {
  private conversationHistory: Map<string, ConversationTurn[]> = new Map();
  private userPreferences: Map<string, UserPreferences> = new Map();
  private emotionalStates: Map<string, EmotionalState[]> = new Map();
  private learningData: Map<string, ExpressionLearningData> = new Map();
  
  // Cache for performance
  private contextCache: Map<string, ConversationContext> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Schedule expressions using advanced algorithms
   */
  async scheduleAdvancedOverlays(
    text: string,
    clips: ExpressionClip[],
    context: ConversationContext,
    options: ScheduleOverlaysOptions = {}
  ): Promise<OverlaySchedule[]> {
    const startTime = performance.now();
    
    try {
      // Check feature flag
      if (process.env.EXPRESSION_OVERLAYS_ENABLED !== 'true') {
        logger.debug('Expression overlays disabled by feature flag');
        return [];
      }

      // Get user preferences
      const userPrefs = await this.getUserPreferences(context.userId);
      
      // Analyze emotional state from text and context
      const emotionalState = this.analyzeEmotionalState(text, context);
      
      // Update conversation context with emotional state
      const updatedContext = {
        ...context,
        emotionalTone: emotionalState.primary
      };

      // Filter clips based on context and preferences
      const contextualClips = this.filterClipsByContext(clips, updatedContext, userPrefs);
      
      // Apply learning-based scoring
      const scoredClips = await this.scoreClipsWithLearning(contextualClips, updatedContext, userPrefs);
      
      // Select optimal expressions
      const selectedClips = this.selectOptimalExpressions(scoredClips, updatedContext, userPrefs, options);
      
      // Schedule with adaptive timing
      const schedule = this.scheduleWithAdaptiveTiming(selectedClips, text, updatedContext, options);
      
      // Store context for learning
      await this.updateConversationContext(updatedContext, text, schedule);
      
      const processingTime = performance.now() - startTime;
      
      logger.debug('Advanced expression scheduling completed', {
        textLength: text.length,
        availableClips: clips.length,
        contextualClips: contextualClips.length,
        selectedClips: selectedClips.length,
        scheduledOverlays: schedule.length,
        emotionalTone: emotionalState.primary,
        processingTimeMs: processingTime
      });

      return schedule;

    } catch (error) {
      logger.error('Error in advanced expression scheduling', {
        error,
        contextUserId: context.userId,
        contextAvatarId: context.avatarId
      });
      
      // Fallback to basic scheduling
      return [];
    }
  }

  /**
   * Analyze emotional state from text and conversation context
   */
  private analyzeEmotionalState(text: string, context: ConversationContext): EmotionalState {
    const lowerText = text.toLowerCase();
    
    // Simple emotion detection patterns
    const emotionPatterns: Record<EmotionalTone, RegExp[]> = {
      positive: [
        /\b(happy|joy|excited|wonderful|amazing|great|fantastic|love|perfect)\b/,
        /\b(smile|laugh|celebrate|thrilled|delighted|pleased)\b/
      ],
      negative: [
        /\b(sad|disappointed|upset|frustrated|angry|terrible|awful|hate)\b/,
        /\b(cry|worry|stress|anxious|depressed|hurt|pain)\b/
      ],
      excited: [
        /\b(wow|amazing|incredible|fantastic|awesome|unbelievable)\b/,
        /[!]{2,}|[A-Z]{3,}/
      ],
      humorous: [
        /\b(funny|hilarious|joke|laugh|haha|lol|amusing|comedy|witty)\b/,
        /\b(silly|ridiculous|absurd|comical)\b/
      ],
      contemplative: [
        /\b(think|consider|ponder|reflect|wonder|curious|interesting)\b/,
        /\b(hmm|well|perhaps|maybe|possibly|might)\b/
      ],
      empathetic: [
        /\b(understand|feel|sorry|sympathy|care|support|comfort)\b/,
        /\b(there for you|here to help|i hear you)\b/
      ],
      curious: [
        /\b(what|how|why|when|where|tell me|explain|describe)\b/,
        /\?/
      ],
      nostalgic: [
        /\b(remember|memory|past|childhood|used to|back then|those days)\b/,
        /\b(miss|nostalgia|reminds me|brings back)\b/
      ],
      surprised: [
        /\b(surprise|shocked|unexpected|didn't know|really|no way)\b/,
        /\b(wow|oh my|incredible|can't believe)\b/
      ],
      neutral: [] // Default fallback
    };

    // Score each emotion
    const emotionScores: Record<EmotionalTone, number> = {
      positive: 0, negative: 0, neutral: 0, excited: 0, contemplative: 0,
      humorous: 0, empathetic: 0, curious: 0, nostalgic: 0, surprised: 0
    };

    // Calculate scores based on pattern matches
    Object.entries(emotionPatterns).forEach(([emotion, patterns]) => {
      patterns.forEach(pattern => {
        const matches = (lowerText.match(pattern) || []).length;
        emotionScores[emotion as EmotionalTone] += matches;
      });
    });

    // Consider conversation context
    if (context.emotionalTone && context.emotionalTone !== 'neutral') {
      emotionScores[context.emotionalTone] += 0.5; // Boost current emotional tone
    }

    // Find dominant emotion
    const sortedEmotions = Object.entries(emotionScores)
      .sort(([, a], [, b]) => b - a);
    
    const [primaryEmotion, primaryScore] = sortedEmotions[0];
    const totalScore = Object.values(emotionScores).reduce((sum, score) => sum + score, 0);
    
    const intensity = totalScore > 0 ? Math.min(primaryScore / totalScore, 1) : 0.3;
    const confidence = totalScore > 0 ? Math.min(totalScore / 5, 1) : 0.5; // Normalize confidence

    return {
      primary: primaryEmotion as EmotionalTone,
      intensity,
      confidence,
      context: `Text analysis: ${text.substring(0, 50)}...`,
      timestamp: new Date()
    };
  }

  /**
   * Filter clips based on conversation context and user preferences
   */
  private filterClipsByContext(
    clips: ExpressionClip[],
    context: ConversationContext,
    preferences: UserPreferences
  ): ExpressionClip[] {
    return clips.filter(clip => {
      // Filter out disliked types
      if (preferences.dislikedTypes.includes(clip.type)) {
        return false;
      }

      // Context-based filtering
      switch (context.emotionalTone) {
        case 'positive':
        case 'excited':
          return ['laugh', 'affirmation', 'greeting'].includes(clip.type);
        
        case 'negative':
          return ['sigh', 'breath', 'filler'].includes(clip.type);
        
        case 'contemplative':
          return ['breath', 'filler', 'sigh'].includes(clip.type);
        
        case 'humorous':
          return ['laugh', 'affirmation', 'catchphrase'].includes(clip.type);
        
        case 'empathetic':
          return ['sigh', 'breath', 'affirmation'].includes(clip.type);
        
        default:
          return true; // Allow all for neutral/unknown emotions
      }
    });
  }

  /**
   * Score clips using learning data and context
   */
  private async scoreClipsWithLearning(
    clips: ExpressionClip[],
    context: ConversationContext,
    preferences: UserPreferences
  ): Promise<Array<ExpressionClip & { score: number }>> {
    return clips.map(clip => {
      let score = 0.5; // Base score

      // Learning-based scoring
      const learningData = this.learningData.get(clip.id);
      if (learningData && preferences.adaptiveSettings.learningEnabled) {
        // Success rate in similar emotional contexts
        const emotionalSuccess = learningData.emotionalSuccess.get(context.emotionalTone) || 0.5;
        score += (emotionalSuccess - 0.5) * preferences.adaptiveSettings.feedbackWeight;

        // Overall rating
        score += (learningData.averageRating - 0.5) * 0.3;

        // Recency bonus (prefer recently successful expressions)
        const daysSinceLastUse = (Date.now() - learningData.lastUsed.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceLastUse < 7 && learningData.averageRating > 0.6) {
          score += 0.1;
        }
      }

      // Preference-based scoring
      if (preferences.preferredTypes.includes(clip.type)) {
        score += 0.2;
      }

      // Context-based scoring
      score += this.getContextualScore(clip, context) * preferences.adaptiveSettings.contextWeight;

      // Frequency adjustment
      score *= this.getFrequencyMultiplier(preferences.expressionFrequency);

      return {
        ...clip,
        score: Math.max(0, Math.min(1, score)) // Clamp to 0-1
      };
    });
  }

  /**
   * Get contextual score for a clip based on conversation context
   */
  private getContextualScore(clip: ExpressionClip, context: ConversationContext): number {
    let score = 0;

    // Emotional tone matching
    const emotionTypeMap: Record<EmotionalTone, ExpressionType[]> = {
      positive: ['laugh', 'affirmation', 'greeting'],
      excited: ['laugh', 'affirmation', 'catchphrase'],
      humorous: ['laugh', 'catchphrase'],
      empathetic: ['sigh', 'breath', 'affirmation'],
      contemplative: ['breath', 'filler', 'sigh'],
      curious: ['filler', 'breath'],
      nostalgic: ['sigh', 'breath'],
      surprised: ['breath', 'affirmation'],
      negative: ['sigh', 'breath'],
      neutral: ['filler', 'breath']
    };

    if (emotionTypeMap[context.emotionalTone]?.includes(clip.type)) {
      score += 0.3;
    }

    // Conversation type matching
    if (context.conversationType === 'formal' && ['catchphrase', 'laugh'].includes(clip.type)) {
      score -= 0.2; // Reduce informal expressions in formal contexts
    }

    // Session duration consideration
    if (context.sessionDurationMs > 10 * 60 * 1000) { // 10+ minutes
      if (['breath', 'filler'].includes(clip.type)) {
        score += 0.1; // Add more natural pauses in longer conversations
      }
    }

    return score;
  }

  /**
   * Get frequency multiplier based on user preference
   */
  private getFrequencyMultiplier(frequency: 'low' | 'medium' | 'high'): number {
    switch (frequency) {
      case 'low': return 0.5;
      case 'medium': return 1.0;
      case 'high': return 1.5;
      default: return 1.0;
    }
  }

  /**
   * Select optimal expressions based on scores and constraints
   */
  private selectOptimalExpressions(
    scoredClips: Array<ExpressionClip & { score: number }>,
    context: ConversationContext,
    preferences: UserPreferences,
    options: ScheduleOverlaysOptions
  ): ExpressionClip[] {
    const maxOverlays = options.maxOverlays || 2;
    
    // Sort by score (highest first)
    const sortedClips = scoredClips.sort((a, b) => b.score - a.score);
    
    // Select top clips while avoiding duplicates and respecting constraints
    const selected: ExpressionClip[] = [];
    const usedTypes = new Set<ExpressionType>();
    
    for (const clip of sortedClips) {
      if (selected.length >= maxOverlays) break;
      
      // Avoid duplicate types in the same turn
      if (usedTypes.has(clip.type)) continue;
      
      // Score threshold (only select reasonably good matches)
      if (clip.score < 0.3) continue;
      
      selected.push(clip);
      usedTypes.add(clip.type);
    }
    
    return selected;
  }

  /**
   * Schedule expressions with adaptive timing based on context
   */
  private scheduleWithAdaptiveTiming(
    clips: ExpressionClip[],
    text: string,
    context: ConversationContext,
    options: ScheduleOverlaysOptions
  ): OverlaySchedule[] {
    if (clips.length === 0) return [];
    
    const minSpacingMs = options.minSpacingMs || 4000;
    const duckingAmount = options.duckingAmount || 0.4;
    
    // Estimate TTS duration
    const estimatedDurationMs = text.length * 50;
    
    const schedules: OverlaySchedule[] = [];
    let lastScheduledTime = 0;
    
    clips.forEach((clip, index) => {
      // Adaptive timing based on emotional tone
      let timingMultiplier = 1.0;
      
      switch (context.emotionalTone) {
        case 'excited':
          timingMultiplier = 0.8; // Faster pacing for excitement
          break;
        case 'contemplative':
          timingMultiplier = 1.3; // Slower pacing for contemplation
          break;
        case 'empathetic':
          timingMultiplier = 1.2; // Slightly slower for empathy
          break;
        case 'humorous':
          timingMultiplier = 0.9; // Slightly faster for humor
          break;
      }
      
      // Base timing calculation
      const baseStartTime = (estimatedDurationMs / (clips.length + 1)) * (index + 1) * timingMultiplier;
      
      // Ensure minimum spacing
      const minStartTime = lastScheduledTime + (minSpacingMs * timingMultiplier);
      let startTime = Math.max(baseStartTime, minStartTime);
      
      // Add contextual jitter
      const jitterRange = context.conversationType === 'formal' ? 200 : 400;
      const jitter = (Math.random() - 0.5) * jitterRange;
      const jitteredTime = startTime + jitter;
      
      const finalStartTime = Math.max(0, Math.max(jitteredTime, minStartTime));
      
      schedules.push({
        clip,
        startTimeMs: finalStartTime,
        duckingLevel: duckingAmount
      });
      
      lastScheduledTime = finalStartTime;
    });
    
    return schedules.sort((a, b) => a.startTimeMs - b.startTimeMs);
  }

  /**
   * Get user preferences with defaults
   */
  private async getUserPreferences(userId: string): Promise<UserPreferences> {
    let preferences = this.userPreferences.get(userId);
    
    if (!preferences) {
      // Load from storage or create defaults
      preferences = {
        userId,
        expressionFrequency: 'medium',
        preferredTypes: [],
        dislikedTypes: [],
        adaptiveSettings: {
          learningEnabled: true,
          feedbackWeight: 0.7,
          contextWeight: 0.8
        },
        lastUpdated: new Date()
      };
      
      this.userPreferences.set(userId, preferences);
    }
    
    return preferences;
  }

  /**
   * Update conversation context for learning
   */
  private async updateConversationContext(
    context: ConversationContext,
    text: string,
    schedule: OverlaySchedule[]
  ): Promise<void> {
    try {
      // Store emotional state
      const states = this.emotionalStates.get(context.userId) || [];
      states.push({
        primary: context.emotionalTone,
        intensity: 0.5, // Would be calculated from text analysis
        confidence: 0.7,
        context: text.substring(0, 100),
        timestamp: new Date()
      });
      
      // Keep only recent states (last 50)
      if (states.length > 50) {
        states.splice(0, states.length - 50);
      }
      
      this.emotionalStates.set(context.userId, states);
      
      // Update usage counts for scheduled expressions
      schedule.forEach(overlay => {
        const learningData = this.learningData.get(overlay.clip.id) || {
          expressionId: overlay.clip.id,
          type: overlay.clip.type,
          usageCount: 0,
          positiveReactions: 0,
          negativeReactions: 0,
          contextSuccess: new Map(),
          emotionalSuccess: new Map(),
          lastUsed: new Date(),
          averageRating: 0.5
        };
        
        learningData.usageCount++;
        learningData.lastUsed = new Date();
        
        this.learningData.set(overlay.clip.id, learningData);
      });
      
    } catch (error) {
      logger.error('Error updating conversation context', { error, userId: context.userId });
    }
  }

  /**
   * Record user feedback for learning
   */
  async recordUserFeedback(
    userId: string,
    feedback: UserFeedback
  ): Promise<void> {
    try {
      // Update learning data for specific expressions
      if (feedback.specificExpressions) {
        feedback.specificExpressions.forEach(expressionId => {
          const learningData = this.learningData.get(expressionId);
          if (learningData) {
            if (feedback.type === 'positive') {
              learningData.positiveReactions++;
            } else if (feedback.type === 'negative') {
              learningData.negativeReactions++;
            }
            
            // Recalculate average rating
            const totalReactions = learningData.positiveReactions + learningData.negativeReactions;
            if (totalReactions > 0) {
              learningData.averageRating = learningData.positiveReactions / totalReactions;
            }
            
            this.learningData.set(expressionId, learningData);
          }
        });
      }
      
      // Update user preferences based on feedback patterns
      await this.updateUserPreferencesFromFeedback(userId, feedback);
      
    } catch (error) {
      logger.error('Error recording user feedback', { error, userId, feedback });
    }
  }

  /**
   * Update user preferences based on feedback patterns
   */
  private async updateUserPreferencesFromFeedback(
    userId: string,
    feedback: UserFeedback
  ): Promise<void> {
    const preferences = await this.getUserPreferences(userId);
    
    if (feedback.specificExpressions && feedback.specificExpressions.length > 0) {
      // Get expression types from IDs (would need to look up actual expressions)
      // For now, we'll simulate this
      const expressionTypes = feedback.specificExpressions.map(id => {
        const learningData = this.learningData.get(id);
        return learningData?.type;
      }).filter(Boolean) as ExpressionType[];
      
      if (feedback.type === 'positive') {
        // Add to preferred types if not already there
        expressionTypes.forEach(type => {
          if (!preferences.preferredTypes.includes(type)) {
            preferences.preferredTypes.push(type);
          }
          // Remove from disliked if it was there
          const dislikedIndex = preferences.dislikedTypes.indexOf(type);
          if (dislikedIndex > -1) {
            preferences.dislikedTypes.splice(dislikedIndex, 1);
          }
        });
      } else if (feedback.type === 'negative') {
        // Add to disliked types if not already there
        expressionTypes.forEach(type => {
          if (!preferences.dislikedTypes.includes(type)) {
            preferences.dislikedTypes.push(type);
          }
          // Remove from preferred if it was there
          const preferredIndex = preferences.preferredTypes.indexOf(type);
          if (preferredIndex > -1) {
            preferences.preferredTypes.splice(preferredIndex, 1);
          }
        });
      }
    }
    
    preferences.lastUpdated = new Date();
    this.userPreferences.set(userId, preferences);
  }

  /**
   * Get learning analytics for a user
   */
  async getLearningAnalytics(userId: string): Promise<{
    totalFeedback: number;
    positiveFeedbackRate: number;
    preferredExpressionTypes: ExpressionType[];
    emotionalPatterns: Record<EmotionalTone, number>;
    adaptationScore: number;
  }> {
    const preferences = await this.getUserPreferences(userId);
    const emotionalStates = this.emotionalStates.get(userId) || [];
    
    // Calculate emotional patterns
    const emotionalCounts: Record<EmotionalTone, number> = {
      positive: 0, negative: 0, neutral: 0, excited: 0, contemplative: 0,
      humorous: 0, empathetic: 0, curious: 0, nostalgic: 0, surprised: 0
    };
    
    emotionalStates.forEach(state => {
      emotionalCounts[state.primary]++;
    });
    
    // Calculate feedback metrics
    const userLearningData = Array.from(this.learningData.values());
    const totalFeedback = userLearningData.reduce((sum, data) => 
      sum + data.positiveReactions + data.negativeReactions, 0);
    const positiveFeedback = userLearningData.reduce((sum, data) => 
      sum + data.positiveReactions, 0);
    
    const positiveFeedbackRate = totalFeedback > 0 ? positiveFeedback / totalFeedback : 0;
    
    // Calculate adaptation score (how well the system is learning)
    const adaptationScore = Math.min(1, (positiveFeedbackRate * 0.7) + (preferences.preferredTypes.length * 0.1));
    
    return {
      totalFeedback,
      positiveFeedbackRate,
      preferredExpressionTypes: preferences.preferredTypes,
      emotionalPatterns: emotionalCounts,
      adaptationScore
    };
  }

  /**
   * Reset learning data for a user (for privacy/GDPR compliance)
   */
  async resetUserLearningData(userId: string): Promise<void> {
    this.userPreferences.delete(userId);
    this.emotionalStates.delete(userId);
    this.conversationHistory.delete(userId);
    
    // Remove user-specific learning data
    for (const [key, data] of this.learningData.entries()) {
      // In a real implementation, we'd need to track which learning data belongs to which user
      // For now, we'll just reset the data
      data.positiveReactions = 0;
      data.negativeReactions = 0;
      data.averageRating = 0.5;
      data.contextSuccess.clear();
      data.emotionalSuccess.clear();
    }
    
    logger.info('Reset learning data for user', { userId });
  }
}

// Export singleton instance
export const advancedExpressionScheduler = new AdvancedExpressionScheduler();