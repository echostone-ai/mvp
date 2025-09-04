/**
 * Analytics Service for GPT-5 Avatar Memory System
 * Provides advanced analytics and insights from monitoring data
 */

import { MonitoringService, PerformanceMetrics, AccuracyMetrics, ConversationQualityMetrics } from './monitoringService';

export interface TrendAnalysis {
  metric: string;
  trend: 'improving' | 'declining' | 'stable';
  changePercentage: number;
  confidence: number;
  timeframe: string;
}

export interface AvatarPerformanceProfile {
  avatarId: string;
  averageResponseTime: number;
  accuracyScore: number;
  qualityScore: number;
  conversationCount: number;
  userSatisfaction: number;
  strengths: string[];
  weaknesses: string[];
}

export interface UsagePattern {
  timeOfDay: number; // 0-23
  dayOfWeek: number; // 0-6
  requestCount: number;
  averageResponseTime: number;
  userSatisfaction: number;
}

export interface FactRecallAnalysis {
  totalFactsStored: number;
  totalFactsRecalled: number;
  recallAccuracy: number;
  mostRecalledFactTypes: Array<{ type: string; count: number }>;
  leastRecalledFactTypes: Array<{ type: string; count: number }>;
  factAgeImpact: Array<{ ageRange: string; accuracy: number }>;
}

export interface ConversationFlowAnalysis {
  averageConversationLength: number;
  topicSwitchFrequency: number;
  contextLossPoints: Array<{ turn: number; reason: string }>;
  userEngagementScore: number;
  dropOffPoints: Array<{ turn: number; percentage: number }>;
}

export class AnalyticsService {
  constructor(private monitoringService: MonitoringService) {}

  /**
   * Analyze performance trends over time
   */
  analyzePerformanceTrends(days: number = 7): TrendAnalysis[] {
    const currentPeriod = this.monitoringService.getPerformanceStats(24);
    const previousPeriod = this.monitoringService.getPerformanceStats(48);
    
    const trends: TrendAnalysis[] = [];

    // Response time trend
    const responseTimeTrend = this.calculateTrend(
      previousPeriod.averageResponseTime,
      currentPeriod.averageResponseTime,
      'lower_is_better'
    );
    
    trends.push({
      metric: 'Response Time',
      trend: responseTimeTrend.trend,
      changePercentage: responseTimeTrend.changePercentage,
      confidence: responseTimeTrend.confidence,
      timeframe: `${days} days`
    });

    // Request volume trend
    const volumeTrend = this.calculateTrend(
      previousPeriod.totalRequests,
      currentPeriod.totalRequests,
      'higher_is_better'
    );
    
    trends.push({
      metric: 'Request Volume',
      trend: volumeTrend.trend,
      changePercentage: volumeTrend.changePercentage,
      confidence: volumeTrend.confidence,
      timeframe: `${days} days`
    });

    return trends;
  }

  /**
   * Analyze accuracy trends
   */
  analyzeAccuracyTrends(days: number = 7): TrendAnalysis[] {
    const currentPeriod = this.monitoringService.getAccuracyStats(24);
    const previousPeriod = this.monitoringService.getAccuracyStats(48);
    
    const trends: TrendAnalysis[] = [];

    // Fact recall trend
    const factRecallTrend = this.calculateTrend(
      previousPeriod.averageFactRecall,
      currentPeriod.averageFactRecall,
      'higher_is_better'
    );
    
    trends.push({
      metric: 'Fact Recall Accuracy',
      trend: factRecallTrend.trend,
      changePercentage: factRecallTrend.changePercentage,
      confidence: factRecallTrend.confidence,
      timeframe: `${days} days`
    });

    // Context continuity trend
    const contextTrend = this.calculateTrend(
      previousPeriod.averageContextContinuity,
      currentPeriod.averageContextContinuity,
      'higher_is_better'
    );
    
    trends.push({
      metric: 'Context Continuity',
      trend: contextTrend.trend,
      changePercentage: contextTrend.changePercentage,
      confidence: contextTrend.confidence,
      timeframe: `${days} days`
    });

    // Hallucination rate trend
    const hallucinationTrend = this.calculateTrend(
      previousPeriod.averageHallucinationRate,
      currentPeriod.averageHallucinationRate,
      'lower_is_better'
    );
    
    trends.push({
      metric: 'Hallucination Rate',
      trend: hallucinationTrend.trend,
      changePercentage: hallucinationTrend.changePercentage,
      confidence: hallucinationTrend.confidence,
      timeframe: `${days} days`
    });

    return trends;
  }

  /**
   * Generate avatar performance profiles
   */
  generateAvatarProfiles(hours: number = 168): AvatarPerformanceProfile[] {
    const metrics = this.monitoringService.exportMetrics(hours);
    const avatarMap = new Map<string, {
      responseTimes: number[];
      accuracyScores: number[];
      qualityScores: number[];
      conversationCount: number;
      satisfactionScores: number[];
    }>();

    // Aggregate metrics by avatar
    metrics.performance.forEach(metric => {
      if (!avatarMap.has(metric.avatarId)) {
        avatarMap.set(metric.avatarId, {
          responseTimes: [],
          accuracyScores: [],
          qualityScores: [],
          conversationCount: 0,
          satisfactionScores: []
        });
      }
      const avatar = avatarMap.get(metric.avatarId)!;
      avatar.responseTimes.push(metric.totalRequestTime);
      avatar.conversationCount++;
    });

    metrics.accuracy.forEach(metric => {
      const avatar = avatarMap.get(metric.avatarId);
      if (avatar) {
        avatar.accuracyScores.push(metric.factRecallAccuracy);
      }
    });

    metrics.quality.forEach(metric => {
      const avatar = avatarMap.get(metric.avatarId);
      if (avatar) {
        avatar.qualityScores.push(metric.responseRelevance);
        if (metric.userSatisfactionScore !== undefined) {
          avatar.satisfactionScores.push(metric.userSatisfactionScore);
        }
      }
    });

    // Generate profiles
    const profiles: AvatarPerformanceProfile[] = [];
    
    avatarMap.forEach((data, avatarId) => {
      const averageResponseTime = data.responseTimes.reduce((a, b) => a + b, 0) / data.responseTimes.length;
      const accuracyScore = data.accuracyScores.length > 0 
        ? data.accuracyScores.reduce((a, b) => a + b, 0) / data.accuracyScores.length 
        : 0;
      const qualityScore = data.qualityScores.length > 0 
        ? data.qualityScores.reduce((a, b) => a + b, 0) / data.qualityScores.length 
        : 0;
      const userSatisfaction = data.satisfactionScores.length > 0 
        ? data.satisfactionScores.reduce((a, b) => a + b, 0) / data.satisfactionScores.length 
        : 0;

      const strengths: string[] = [];
      const weaknesses: string[] = [];

      // Analyze strengths and weaknesses
      if (averageResponseTime < 1000) strengths.push('Fast response times');
      if (averageResponseTime > 2000) weaknesses.push('Slow response times');
      
      if (accuracyScore > 90) strengths.push('High fact recall accuracy');
      if (accuracyScore < 70) weaknesses.push('Low fact recall accuracy');
      
      if (qualityScore > 85) strengths.push('High response quality');
      if (qualityScore < 70) weaknesses.push('Low response quality');
      
      if (userSatisfaction > 4.0) strengths.push('High user satisfaction');
      if (userSatisfaction < 3.0) weaknesses.push('Low user satisfaction');

      profiles.push({
        avatarId,
        averageResponseTime,
        accuracyScore,
        qualityScore,
        conversationCount: data.conversationCount,
        userSatisfaction,
        strengths,
        weaknesses
      });
    });

    return profiles.sort((a, b) => b.conversationCount - a.conversationCount);
  }

  /**
   * Analyze usage patterns
   */
  analyzeUsagePatterns(days: number = 30): UsagePattern[] {
    const metrics = this.monitoringService.exportMetrics(days * 24);
    const patternMap = new Map<string, {
      requestCount: number;
      responseTimes: number[];
      satisfactionScores: number[];
    }>();

    metrics.performance.forEach(metric => {
      const hour = metric.timestamp.getHours();
      const dayOfWeek = metric.timestamp.getDay();
      const key = `${dayOfWeek}-${hour}`;

      if (!patternMap.has(key)) {
        patternMap.set(key, {
          requestCount: 0,
          responseTimes: [],
          satisfactionScores: []
        });
      }

      const pattern = patternMap.get(key)!;
      pattern.requestCount++;
      pattern.responseTimes.push(metric.totalRequestTime);
    });

    const patterns: UsagePattern[] = [];
    
    patternMap.forEach((data, key) => {
      const [dayOfWeek, hour] = key.split('-').map(Number);
      const averageResponseTime = data.responseTimes.reduce((a, b) => a + b, 0) / data.responseTimes.length;
      const userSatisfaction = data.satisfactionScores.length > 0 
        ? data.satisfactionScores.reduce((a, b) => a + b, 0) / data.satisfactionScores.length 
        : 0;

      patterns.push({
        timeOfDay: hour,
        dayOfWeek,
        requestCount: data.requestCount,
        averageResponseTime,
        userSatisfaction
      });
    });

    return patterns.sort((a, b) => b.requestCount - a.requestCount);
  }

  /**
   * Analyze fact recall patterns
   */
  analyzeFactRecall(days: number = 30): FactRecallAnalysis {
    const metrics = this.monitoringService.exportMetrics(days * 24);
    
    // This would typically query the database for actual fact data
    // For now, we'll provide a mock analysis structure
    return {
      totalFactsStored: 0, // Would be calculated from database
      totalFactsRecalled: 0, // Would be calculated from conversation logs
      recallAccuracy: metrics.accuracy.length > 0 
        ? metrics.accuracy.reduce((sum, m) => sum + m.factRecallAccuracy, 0) / metrics.accuracy.length 
        : 0,
      mostRecalledFactTypes: [
        { type: 'personal_info', count: 0 },
        { type: 'preferences', count: 0 },
        { type: 'relationships', count: 0 }
      ],
      leastRecalledFactTypes: [
        { type: 'dates', count: 0 },
        { type: 'locations', count: 0 },
        { type: 'activities', count: 0 }
      ],
      factAgeImpact: [
        { ageRange: '0-7 days', accuracy: 95 },
        { ageRange: '8-30 days', accuracy: 88 },
        { ageRange: '31-90 days', accuracy: 82 },
        { ageRange: '90+ days', accuracy: 75 }
      ]
    };
  }

  /**
   * Analyze conversation flow patterns
   */
  analyzeConversationFlow(days: number = 30): ConversationFlowAnalysis {
    const metrics = this.monitoringService.exportMetrics(days * 24);
    
    const conversationLengths = metrics.quality.map(m => m.conversationLength);
    const averageLength = conversationLengths.length > 0 
      ? conversationLengths.reduce((a, b) => a + b, 0) / conversationLengths.length 
      : 0;

    const engagementScores = metrics.quality.map(m => m.responseRelevance);
    const averageEngagement = engagementScores.length > 0 
      ? engagementScores.reduce((a, b) => a + b, 0) / engagementScores.length 
      : 0;

    return {
      averageConversationLength: averageLength,
      topicSwitchFrequency: 0, // Would be calculated from conversation analysis
      contextLossPoints: [], // Would be identified from context continuity drops
      userEngagementScore: averageEngagement,
      dropOffPoints: [] // Would be calculated from conversation termination patterns
    };
  }

  /**
   * Generate comprehensive analytics report
   */
  generateAnalyticsReport(days: number = 7): {
    performanceTrends: TrendAnalysis[];
    accuracyTrends: TrendAnalysis[];
    topAvatars: AvatarPerformanceProfile[];
    usagePatterns: UsagePattern[];
    factRecallAnalysis: FactRecallAnalysis;
    conversationFlowAnalysis: ConversationFlowAnalysis;
    recommendations: string[];
  } {
    const performanceTrends = this.analyzePerformanceTrends(days);
    const accuracyTrends = this.analyzeAccuracyTrends(days);
    const avatarProfiles = this.generateAvatarProfiles(days * 24);
    const usagePatterns = this.analyzeUsagePatterns(days);
    const factRecallAnalysis = this.analyzeFactRecall(days);
    const conversationFlowAnalysis = this.analyzeConversationFlow(days);

    const recommendations = this.generateRecommendations({
      performanceTrends,
      accuracyTrends,
      avatarProfiles,
      usagePatterns,
      factRecallAnalysis,
      conversationFlowAnalysis
    });

    return {
      performanceTrends,
      accuracyTrends,
      topAvatars: avatarProfiles.slice(0, 10),
      usagePatterns: usagePatterns.slice(0, 24), // Top 24 time slots
      factRecallAnalysis,
      conversationFlowAnalysis,
      recommendations
    };
  }

  private calculateTrend(
    previousValue: number, 
    currentValue: number, 
    direction: 'higher_is_better' | 'lower_is_better'
  ): { trend: 'improving' | 'declining' | 'stable'; changePercentage: number; confidence: number } {
    if (previousValue === 0) {
      return { trend: 'stable', changePercentage: 0, confidence: 0 };
    }

    const changePercentage = ((currentValue - previousValue) / previousValue) * 100;
    const absChange = Math.abs(changePercentage);

    let trend: 'improving' | 'declining' | 'stable';
    
    if (absChange < 5) {
      trend = 'stable';
    } else if (direction === 'higher_is_better') {
      trend = changePercentage > 0 ? 'improving' : 'declining';
    } else {
      trend = changePercentage < 0 ? 'improving' : 'declining';
    }

    const confidence = Math.min(absChange / 10, 1); // Higher confidence for larger changes

    return { trend, changePercentage, confidence };
  }

  private generateRecommendations(data: {
    performanceTrends: TrendAnalysis[];
    accuracyTrends: TrendAnalysis[];
    avatarProfiles: AvatarPerformanceProfile[];
    usagePatterns: UsagePattern[];
    factRecallAnalysis: FactRecallAnalysis;
    conversationFlowAnalysis: ConversationFlowAnalysis;
  }): string[] {
    const recommendations: string[] = [];

    // Performance recommendations
    const responseTimeTrend = data.performanceTrends.find(t => t.metric === 'Response Time');
    if (responseTimeTrend?.trend === 'declining') {
      recommendations.push('Consider optimizing database queries or implementing additional caching to improve response times');
    }

    // Accuracy recommendations
    const factRecallTrend = data.accuracyTrends.find(t => t.metric === 'Fact Recall Accuracy');
    if (factRecallTrend?.trend === 'declining') {
      recommendations.push('Review fact extraction and storage processes to improve recall accuracy');
    }

    // Avatar-specific recommendations
    const lowPerformingAvatars = data.avatarProfiles.filter(a => a.accuracyScore < 70);
    if (lowPerformingAvatars.length > 0) {
      recommendations.push(`${lowPerformingAvatars.length} avatars have low accuracy scores and may need memory optimization`);
    }

    // Usage pattern recommendations
    const peakHours = data.usagePatterns.slice(0, 3);
    if (peakHours.length > 0) {
      recommendations.push(`Consider scaling resources during peak hours: ${peakHours.map(p => `${p.timeOfDay}:00`).join(', ')}`);
    }

    // Fact recall recommendations
    if (data.factRecallAnalysis.recallAccuracy < 80) {
      recommendations.push('Fact recall accuracy is below target - consider improving context retrieval algorithms');
    }

    // Conversation flow recommendations
    if (data.conversationFlowAnalysis.averageConversationLength < 5) {
      recommendations.push('Short conversation lengths may indicate engagement issues - review response quality');
    }

    return recommendations;
  }
}