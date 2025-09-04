/**
 * Conversation Analytics Service
 * Provides conversation flow analysis, optimization suggestions, and quality metrics
 */

export interface ConversationTurn {
  id: string;
  userMessage: string;
  assistantResponse: string;
  timestamp: Date;
  audioLatency: number;
  expressionsUsed: string[];
  memoryFragmentsReferenced: string[];
  responseTime: number;
  userEngagement?: EngagementMetrics;
}

export interface EngagementMetrics {
  messageLength: number;
  responseDelay: number;
  emotionalTone: 'positive' | 'negative' | 'neutral' | 'excited' | 'frustrated';
  topicContinuity: number; // 0-1 score
  questionAsked: boolean;
  followUpGenerated: boolean;
}

export interface ConversationQualityMetrics {
  averageResponseTime: number;
  averageAudioLatency: number;
  expressionUsageRate: number;
  memoryRetrievalSuccessRate: number;
  userEngagementScore: number;
  conversationLength: number;
  topicDiversity: number;
  naturalFlowScore: number;
}

export interface OptimizationSuggestion {
  type: 'voice_settings' | 'expression_timing' | 'memory_usage' | 'conversation_flow';
  priority: 'high' | 'medium' | 'low';
  description: string;
  suggestedAction: string;
  expectedImprovement: string;
  confidence: number; // 0-1
}

export interface ConversationFlowAnalysis {
  conversationId: string;
  totalTurns: number;
  qualityMetrics: ConversationQualityMetrics;
  optimizationSuggestions: OptimizationSuggestion[];
  engagementTrends: EngagementTrend[];
  topicProgression: TopicProgression[];
}

export interface EngagementTrend {
  turnNumber: number;
  engagementScore: number;
  responseTime: number;
  audioLatency: number;
  expressionsUsed: number;
}

export interface TopicProgression {
  turnRange: [number, number];
  topic: string;
  coherenceScore: number;
  userInterest: number;
}

export class ConversationAnalyticsService {
  private static instance: ConversationAnalyticsService;
  private conversationData: Map<string, ConversationTurn[]> = new Map();

  static getInstance(): ConversationAnalyticsService {
    if (!ConversationAnalyticsService.instance) {
      ConversationAnalyticsService.instance = new ConversationAnalyticsService();
    }
    return ConversationAnalyticsService.instance;
  }

  /**
   * Record a conversation turn for analytics
   */
  recordConversationTurn(conversationId: string, turn: ConversationTurn): void {
    if (!this.conversationData.has(conversationId)) {
      this.conversationData.set(conversationId, []);
    }
    
    const turns = this.conversationData.get(conversationId)!;
    turns.push(turn);
    
    // Keep only last 100 turns per conversation for memory management
    if (turns.length > 100) {
      turns.splice(0, turns.length - 100);
    }
  }

  /**
   * Analyze conversation flow and generate optimization suggestions
   */
  analyzeConversationFlow(conversationId: string): ConversationFlowAnalysis {
    const turns = this.conversationData.get(conversationId) || [];
    
    if (turns.length === 0) {
      return this.getEmptyAnalysis(conversationId);
    }

    const qualityMetrics = this.calculateQualityMetrics(turns);
    const optimizationSuggestions = this.generateOptimizationSuggestions(turns, qualityMetrics);
    const engagementTrends = this.calculateEngagementTrends(turns);
    const topicProgression = this.analyzeTopicProgression(turns);

    return {
      conversationId,
      totalTurns: turns.length,
      qualityMetrics,
      optimizationSuggestions,
      engagementTrends,
      topicProgression
    };
  }

  /**
   * Calculate conversation quality metrics
   */
  private calculateQualityMetrics(turns: ConversationTurn[]): ConversationQualityMetrics {
    const totalTurns = turns.length;
    
    const averageResponseTime = turns.reduce((sum, turn) => sum + turn.responseTime, 0) / totalTurns;
    const averageAudioLatency = turns.reduce((sum, turn) => sum + turn.audioLatency, 0) / totalTurns;
    
    const turnsWithExpressions = turns.filter(turn => turn.expressionsUsed.length > 0).length;
    const expressionUsageRate = turnsWithExpressions / totalTurns;
    
    const turnsWithMemory = turns.filter(turn => turn.memoryFragmentsReferenced.length > 0).length;
    const memoryRetrievalSuccessRate = turnsWithMemory / totalTurns;
    
    const userEngagementScore = this.calculateAverageEngagement(turns);
    const topicDiversity = this.calculateTopicDiversity(turns);
    const naturalFlowScore = this.calculateNaturalFlowScore(turns);

    return {
      averageResponseTime,
      averageAudioLatency,
      expressionUsageRate,
      memoryRetrievalSuccessRate,
      userEngagementScore,
      conversationLength: totalTurns,
      topicDiversity,
      naturalFlowScore
    };
  }

  /**
   * Generate optimization suggestions based on conversation analysis
   */
  private generateOptimizationSuggestions(
    turns: ConversationTurn[], 
    metrics: ConversationQualityMetrics
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // Audio latency optimization
    if (metrics.averageAudioLatency > 1000) {
      suggestions.push({
        type: 'voice_settings',
        priority: 'high',
        description: 'Audio latency is above optimal threshold',
        suggestedAction: 'Consider reducing voice quality or enabling aggressive streaming',
        expectedImprovement: 'Reduce latency by 200-400ms',
        confidence: 0.85
      });
    }

    // Expression usage optimization
    if (metrics.expressionUsageRate < 0.3) {
      suggestions.push({
        type: 'expression_timing',
        priority: 'medium',
        description: 'Low expression usage may reduce conversation naturalness',
        suggestedAction: 'Increase expression frequency or improve keyword detection',
        expectedImprovement: 'Improve naturalness score by 15-25%',
        confidence: 0.70
      });
    }

    // Memory usage optimization
    if (metrics.memoryRetrievalSuccessRate < 0.5) {
      suggestions.push({
        type: 'memory_usage',
        priority: 'medium',
        description: 'Memory retrieval rate is below optimal for continuity',
        suggestedAction: 'Improve memory indexing or expand memory context window',
        expectedImprovement: 'Increase conversation continuity by 20-30%',
        confidence: 0.75
      });
    }

    // Conversation flow optimization
    if (metrics.naturalFlowScore < 0.6) {
      suggestions.push({
        type: 'conversation_flow',
        priority: 'high',
        description: 'Conversation flow feels unnatural or disjointed',
        suggestedAction: 'Review response generation and topic transitions',
        expectedImprovement: 'Improve user satisfaction by 25-40%',
        confidence: 0.80
      });
    }

    return suggestions.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Calculate engagement trends over conversation turns
   */
  private calculateEngagementTrends(turns: ConversationTurn[]): EngagementTrend[] {
    return turns.map((turn, index) => ({
      turnNumber: index + 1,
      engagementScore: this.calculateTurnEngagement(turn),
      responseTime: turn.responseTime,
      audioLatency: turn.audioLatency,
      expressionsUsed: turn.expressionsUsed.length
    }));
  }

  /**
   * Analyze topic progression throughout conversation
   */
  private analyzeTopicProgression(turns: ConversationTurn[]): TopicProgression[] {
    const topics: TopicProgression[] = [];
    let currentTopic = '';
    let topicStart = 0;

    for (let i = 0; i < turns.length; i++) {
      const turn = turns[i];
      const detectedTopic = this.extractTopic(turn.userMessage);
      
      if (detectedTopic !== currentTopic) {
        if (currentTopic) {
          topics.push({
            turnRange: [topicStart + 1, i],
            topic: currentTopic,
            coherenceScore: this.calculateTopicCoherence(turns.slice(topicStart, i)),
            userInterest: this.calculateUserInterest(turns.slice(topicStart, i))
          });
        }
        currentTopic = detectedTopic;
        topicStart = i;
      }
    }

    // Add final topic
    if (currentTopic && topicStart < turns.length) {
      topics.push({
        turnRange: [topicStart + 1, turns.length],
        topic: currentTopic,
        coherenceScore: this.calculateTopicCoherence(turns.slice(topicStart)),
        userInterest: this.calculateUserInterest(turns.slice(topicStart))
      });
    }

    return topics;
  }

  /**
   * Calculate average user engagement across turns
   */
  private calculateAverageEngagement(turns: ConversationTurn[]): number {
    const engagementScores = turns
      .filter(turn => turn.userEngagement)
      .map(turn => this.calculateTurnEngagement(turn));
    
    return engagementScores.length > 0 
      ? engagementScores.reduce((sum, score) => sum + score, 0) / engagementScores.length
      : 0.5; // Default neutral engagement
  }

  /**
   * Calculate engagement score for a single turn
   */
  private calculateTurnEngagement(turn: ConversationTurn): number {
    if (!turn.userEngagement) return 0.5;

    const engagement = turn.userEngagement;
    let score = 0.5; // Base neutral score

    // Message length factor (longer messages = higher engagement)
    score += Math.min(engagement.messageLength / 100, 0.2);

    // Response delay factor (quick responses = higher engagement)
    score += Math.max(0, 0.2 - engagement.responseDelay / 10000);

    // Emotional tone factor
    const toneScores = {
      excited: 0.3,
      positive: 0.2,
      neutral: 0,
      negative: -0.1,
      frustrated: -0.3
    };
    score += toneScores[engagement.emotionalTone];

    // Topic continuity factor
    score += engagement.topicContinuity * 0.2;

    // Question/follow-up factors
    if (engagement.questionAsked) score += 0.1;
    if (engagement.followUpGenerated) score += 0.1;

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Calculate topic diversity in conversation
   */
  private calculateTopicDiversity(turns: ConversationTurn[]): number {
    const topics = new Set(turns.map(turn => this.extractTopic(turn.userMessage)));
    return Math.min(topics.size / Math.max(turns.length / 5, 1), 1);
  }

  /**
   * Calculate natural flow score
   */
  private calculateNaturalFlowScore(turns: ConversationTurn[]): number {
    if (turns.length < 2) return 1;

    let flowScore = 0;
    for (let i = 1; i < turns.length; i++) {
      const prevTurn = turns[i - 1];
      const currentTurn = turns[i];
      
      // Check response time consistency
      const responseTimeConsistency = 1 - Math.abs(currentTurn.responseTime - prevTurn.responseTime) / 5000;
      
      // Check expression usage consistency
      const expressionConsistency = Math.abs(currentTurn.expressionsUsed.length - prevTurn.expressionsUsed.length) <= 1 ? 1 : 0.5;
      
      // Check topic continuity
      const topicContinuity = this.calculateTopicContinuity(prevTurn, currentTurn);
      
      flowScore += (responseTimeConsistency + expressionConsistency + topicContinuity) / 3;
    }

    return flowScore / (turns.length - 1);
  }

  /**
   * Extract topic from user message (simplified implementation)
   */
  private extractTopic(message: string): string {
    const keywords = message.toLowerCase().split(' ');
    
    // Simple topic detection based on keywords
    if (keywords.some(word => ['work', 'job', 'career', 'office'].includes(word))) return 'work';
    if (keywords.some(word => ['family', 'parent', 'child', 'sibling'].includes(word))) return 'family';
    if (keywords.some(word => ['travel', 'vacation', 'trip', 'visit'].includes(word))) return 'travel';
    if (keywords.some(word => ['hobby', 'interest', 'enjoy', 'fun'].includes(word))) return 'hobbies';
    if (keywords.some(word => ['health', 'doctor', 'exercise', 'fitness'].includes(word))) return 'health';
    
    return 'general';
  }

  /**
   * Calculate topic coherence for a sequence of turns
   */
  private calculateTopicCoherence(turns: ConversationTurn[]): number {
    if (turns.length <= 1) return 1;

    const topics = turns.map(turn => this.extractTopic(turn.userMessage));
    const uniqueTopics = new Set(topics);
    
    // Higher coherence = fewer topic changes
    return 1 - (uniqueTopics.size - 1) / turns.length;
  }

  /**
   * Calculate user interest level for a topic sequence
   */
  private calculateUserInterest(turns: ConversationTurn[]): number {
    const avgMessageLength = turns.reduce((sum, turn) => sum + turn.userMessage.length, 0) / turns.length;
    const avgResponseTime = turns.reduce((sum, turn) => sum + (turn.userEngagement?.responseDelay || 5000), 0) / turns.length;
    
    // Longer messages and quicker responses indicate higher interest
    const lengthScore = Math.min(avgMessageLength / 50, 1);
    const speedScore = Math.max(0, 1 - avgResponseTime / 10000);
    
    return (lengthScore + speedScore) / 2;
  }

  /**
   * Calculate topic continuity between two turns
   */
  private calculateTopicContinuity(prevTurn: ConversationTurn, currentTurn: ConversationTurn): number {
    const prevTopic = this.extractTopic(prevTurn.userMessage);
    const currentTopic = this.extractTopic(currentTurn.userMessage);
    
    return prevTopic === currentTopic ? 1 : 0.3; // Some continuity even with topic change
  }

  /**
   * Get empty analysis for new conversations
   */
  private getEmptyAnalysis(conversationId: string): ConversationFlowAnalysis {
    return {
      conversationId,
      totalTurns: 0,
      qualityMetrics: {
        averageResponseTime: 0,
        averageAudioLatency: 0,
        expressionUsageRate: 0,
        memoryRetrievalSuccessRate: 0,
        userEngagementScore: 0.5,
        conversationLength: 0,
        topicDiversity: 0,
        naturalFlowScore: 1
      },
      optimizationSuggestions: [],
      engagementTrends: [],
      topicProgression: []
    };
  }

  /**
   * Get conversation data for export
   */
  getConversationData(conversationId: string): ConversationTurn[] {
    return this.conversationData.get(conversationId) || [];
  }

  /**
   * Clear conversation data (for privacy/cleanup)
   */
  clearConversationData(conversationId: string): void {
    this.conversationData.delete(conversationId);
  }
}