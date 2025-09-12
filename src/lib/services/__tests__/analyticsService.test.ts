/**
 * Tests for AnalyticsService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnalyticsService } from '../analyticsService';
import { MonitoringService, PerformanceMetrics, AccuracyMetrics, ConversationQualityMetrics } from '../monitoringService';

describe('AnalyticsService', () => {
  let analyticsService: AnalyticsService;
  let monitoringService: MonitoringService;

  beforeEach(() => {
    monitoringService = new MonitoringService();
    monitoringService.clearAll();
    analyticsService = new AnalyticsService(monitoringService);
  });

  describe('Performance Trends', () => {
    it('should analyze performance trends correctly', () => {
      // Mock the getPerformanceStats method to return different values for different time periods
      const mockGetPerformanceStats = vi.spyOn(monitoringService, 'getPerformanceStats');
      
      // Current period (last 24 hours)
      mockGetPerformanceStats.mockReturnValueOnce({
        averageResponseTime: 1200,
        p95ResponseTime: 1800,
        p99ResponseTime: 2200,
        totalRequests: 150,
        errorRate: 2
      });
      
      // Previous period (24-48 hours ago)
      mockGetPerformanceStats.mockReturnValueOnce({
        averageResponseTime: 1400,
        p95ResponseTime: 2000,
        p99ResponseTime: 2400,
        totalRequests: 120,
        errorRate: 3
      });

      const trends = analyticsService.analyzePerformanceTrends(7);
      
      expect(trends).toHaveLength(2);
      
      const responseTimeTrend = trends.find(t => t.metric === 'Response Time');
      expect(responseTimeTrend?.trend).toBe('improving'); // 1200 < 1400, so improving
      expect(responseTimeTrend?.changePercentage).toBeCloseTo(-14.29, 1); // (1200-1400)/1400 * 100
      
      const volumeTrend = trends.find(t => t.metric === 'Request Volume');
      expect(volumeTrend?.trend).toBe('improving'); // 150 > 120, so improving
      expect(volumeTrend?.changePercentage).toBe(25); // (150-120)/120 * 100
    });

    it('should handle zero previous values', () => {
      const mockGetPerformanceStats = vi.spyOn(monitoringService, 'getPerformanceStats');
      
      mockGetPerformanceStats.mockReturnValueOnce({
        averageResponseTime: 1200,
        p95ResponseTime: 1800,
        p99ResponseTime: 2200,
        totalRequests: 150,
        errorRate: 2
      });
      
      mockGetPerformanceStats.mockReturnValueOnce({
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        totalRequests: 0,
        errorRate: 0
      });

      const trends = analyticsService.analyzePerformanceTrends(7);
      
      const responseTimeTrend = trends.find(t => t.metric === 'Response Time');
      expect(responseTimeTrend?.trend).toBe('stable');
      expect(responseTimeTrend?.changePercentage).toBe(0);
      expect(responseTimeTrend?.confidence).toBe(0);
    });
  });

  describe('Accuracy Trends', () => {
    it('should analyze accuracy trends correctly', () => {
      const mockGetAccuracyStats = vi.spyOn(monitoringService, 'getAccuracyStats');
      
      // Current period
      mockGetAccuracyStats.mockReturnValueOnce({
        averageFactRecall: 88,
        averageContextContinuity: 92,
        averageHallucinationRate: 3,
        totalConversations: 50
      });
      
      // Previous period
      mockGetAccuracyStats.mockReturnValueOnce({
        averageFactRecall: 85,
        averageContextContinuity: 89,
        averageHallucinationRate: 5,
        totalConversations: 45
      });

      const trends = analyticsService.analyzeAccuracyTrends(7);
      
      expect(trends).toHaveLength(3);
      
      const factRecallTrend = trends.find(t => t.metric === 'Fact Recall Accuracy');
      expect(factRecallTrend?.trend).toBe('stable'); // Small change, likely considered stable
      
      const contextTrend = trends.find(t => t.metric === 'Context Continuity');
      expect(contextTrend?.trend).toBe('stable'); // Small change, likely considered stable
      
      const hallucinationTrend = trends.find(t => t.metric === 'Hallucination Rate');
      expect(hallucinationTrend?.trend).toBe('improving'); // 3 < 5 (lower is better)
    });
  });

  describe('Avatar Profiles', () => {
    it('should generate avatar performance profiles', () => {
      // Add test data
      const performanceMetrics: PerformanceMetrics[] = [
        {
          responseTime: 800,
          contextRetrievalTime: 200,
          gpt5ProcessingTime: 500,
          memoryUpdateTime: 100,
          totalRequestTime: 1200,
          timestamp: new Date(),
          avatarId: 'avatar-1',
          requestId: 'req-1'
        },
        {
          responseTime: 900,
          contextRetrievalTime: 250,
          gpt5ProcessingTime: 600,
          memoryUpdateTime: 150,
          totalRequestTime: 1400,
          timestamp: new Date(),
          avatarId: 'avatar-1',
          requestId: 'req-2'
        },
        {
          responseTime: 700,
          contextRetrievalTime: 180,
          gpt5ProcessingTime: 450,
          memoryUpdateTime: 80,
          totalRequestTime: 1000,
          timestamp: new Date(),
          avatarId: 'avatar-2',
          requestId: 'req-3'
        }
      ];

      const accuracyMetrics: AccuracyMetrics[] = [
        {
          factRecallAccuracy: 88,
          contextContinuityScore: 92,
          hallucinationRate: 3,
          factExtractionAccuracy: 85,
          conflictResolutionSuccess: 90,
          timestamp: new Date(),
          avatarId: 'avatar-1',
          conversationId: 'conv-1'
        },
        {
          factRecallAccuracy: 92,
          contextContinuityScore: 95,
          hallucinationRate: 2,
          factExtractionAccuracy: 89,
          conflictResolutionSuccess: 93,
          timestamp: new Date(),
          avatarId: 'avatar-2',
          conversationId: 'conv-2'
        }
      ];

      const qualityMetrics: ConversationQualityMetrics[] = [
        {
          userSatisfactionScore: 4.2,
          conversationLength: 12,
          topicCoherence: 88,
          responseRelevance: 92,
          personalityConsistency: 85,
          emotionalAppropriatenessScore: 90,
          timestamp: new Date(),
          avatarId: 'avatar-1',
          conversationId: 'conv-1'
        },
        {
          userSatisfactionScore: 4.5,
          conversationLength: 15,
          topicCoherence: 91,
          responseRelevance: 94,
          personalityConsistency: 88,
          emotionalAppropriatenessScore: 92,
          timestamp: new Date(),
          avatarId: 'avatar-2',
          conversationId: 'conv-2'
        }
      ];

      // Mock the exportMetrics method
      const mockExportMetrics = vi.spyOn(monitoringService, 'exportMetrics');
      mockExportMetrics.mockReturnValue({
        performance: performanceMetrics,
        accuracy: accuracyMetrics,
        quality: qualityMetrics,
        systemHealth: []
      });

      const profiles = analyticsService.generateAvatarProfiles(168);
      
      expect(profiles).toHaveLength(2);
      
      // Check avatar-1 profile
      const avatar1Profile = profiles.find(p => p.avatarId === 'avatar-1');
      expect(avatar1Profile).toBeDefined();
      expect(avatar1Profile?.conversationCount).toBe(2);
      expect(avatar1Profile?.averageResponseTime).toBe(1300); // (1200 + 1400) / 2
      expect(avatar1Profile?.accuracyScore).toBe(88);
      expect(avatar1Profile?.qualityScore).toBe(92);
      expect(avatar1Profile?.userSatisfaction).toBe(4.2);
      
      // Check avatar-2 profile
      const avatar2Profile = profiles.find(p => p.avatarId === 'avatar-2');
      expect(avatar2Profile).toBeDefined();
      expect(avatar2Profile?.conversationCount).toBe(1);
      expect(avatar2Profile?.averageResponseTime).toBe(1000);
      expect(avatar2Profile?.accuracyScore).toBe(92);
      expect(avatar2Profile?.qualityScore).toBe(94);
      expect(avatar2Profile?.userSatisfaction).toBe(4.5);
    });

    it('should identify strengths and weaknesses correctly', () => {
      const performanceMetrics: PerformanceMetrics[] = [
        {
          responseTime: 2500, // Slow
          contextRetrievalTime: 500,
          gpt5ProcessingTime: 1500,
          memoryUpdateTime: 500,
          totalRequestTime: 2500,
          timestamp: new Date(),
          avatarId: 'slow-avatar',
          requestId: 'req-1'
        }
      ];

      const accuracyMetrics: AccuracyMetrics[] = [
        {
          factRecallAccuracy: 65, // Low accuracy
          contextContinuityScore: 70,
          hallucinationRate: 8,
          factExtractionAccuracy: 60,
          conflictResolutionSuccess: 68,
          timestamp: new Date(),
          avatarId: 'slow-avatar',
          conversationId: 'conv-1'
        }
      ];

      const qualityMetrics: ConversationQualityMetrics[] = [
        {
          userSatisfactionScore: 2.5, // Low satisfaction
          conversationLength: 8,
          topicCoherence: 65,
          responseRelevance: 68, // Low quality
          personalityConsistency: 70,
          emotionalAppropriatenessScore: 72,
          timestamp: new Date(),
          avatarId: 'slow-avatar',
          conversationId: 'conv-1'
        }
      ];

      const mockExportMetrics = vi.spyOn(monitoringService, 'exportMetrics');
      mockExportMetrics.mockReturnValue({
        performance: performanceMetrics,
        accuracy: accuracyMetrics,
        quality: qualityMetrics,
        systemHealth: []
      });

      const profiles = analyticsService.generateAvatarProfiles(168);
      const profile = profiles[0];
      
      expect(profile.weaknesses).toContain('Slow response times');
      expect(profile.weaknesses).toContain('Low fact recall accuracy');
      expect(profile.weaknesses).toContain('Low response quality');
      expect(profile.weaknesses).toContain('Low user satisfaction');
      expect(profile.strengths).toHaveLength(0);
    });
  });

  describe('Usage Patterns', () => {
    it('should analyze usage patterns by time and day', () => {
      const performanceMetrics: PerformanceMetrics[] = [
        {
          responseTime: 800,
          contextRetrievalTime: 200,
          gpt5ProcessingTime: 500,
          memoryUpdateTime: 100,
          totalRequestTime: 1200,
          timestamp: new Date('2024-01-15T14:30:00Z'), // Monday 2:30 PM
          avatarId: 'avatar-1',
          requestId: 'req-1'
        },
        {
          responseTime: 900,
          contextRetrievalTime: 250,
          gpt5ProcessingTime: 600,
          memoryUpdateTime: 150,
          totalRequestTime: 1400,
          timestamp: new Date('2024-01-15T14:45:00Z'), // Monday 2:45 PM (same hour)
          avatarId: 'avatar-1',
          requestId: 'req-2'
        },
        {
          responseTime: 700,
          contextRetrievalTime: 180,
          gpt5ProcessingTime: 450,
          memoryUpdateTime: 80,
          totalRequestTime: 1000,
          timestamp: new Date('2024-01-16T09:15:00Z'), // Tuesday 9:15 AM
          avatarId: 'avatar-2',
          requestId: 'req-3'
        }
      ];

      const mockExportMetrics = vi.spyOn(monitoringService, 'exportMetrics');
      mockExportMetrics.mockReturnValue({
        performance: performanceMetrics,
        accuracy: [],
        quality: [],
        systemHealth: []
      });

      const patterns = analyticsService.analyzeUsagePatterns(30);
      
      expect(patterns).toHaveLength(2); // Two different time slots
      
      // Check Monday 2 PM slot (should have 2 requests)
      const mondayAfternoon = patterns.find(p => p.dayOfWeek === 1 && p.timeOfDay === 14);
      expect(mondayAfternoon).toBeDefined();
      if (mondayAfternoon) {
        expect(mondayAfternoon.requestCount).toBe(2);
        expect(mondayAfternoon.averageResponseTime).toBe(1300); // (1200 + 1400) / 2
      }
      
      // Check Tuesday 9 AM slot (should have 1 request)
      const tuesdayMorning = patterns.find(p => p.dayOfWeek === 2 && p.timeOfDay === 9);
      expect(tuesdayMorning).toBeDefined();
      if (tuesdayMorning) {
        expect(tuesdayMorning.requestCount).toBe(1);
        expect(tuesdayMorning.averageResponseTime).toBe(1000);
      }
    });
  });

  describe('Fact Recall Analysis', () => {
    it('should provide fact recall analysis structure', () => {
      const mockExportMetrics = vi.spyOn(monitoringService, 'exportMetrics');
      mockExportMetrics.mockReturnValue({
        performance: [],
        accuracy: [
          {
            factRecallAccuracy: 88,
            contextContinuityScore: 92,
            hallucinationRate: 3,
            factExtractionAccuracy: 85,
            conflictResolutionSuccess: 90,
            timestamp: new Date(),
            avatarId: 'avatar-1',
            conversationId: 'conv-1'
          },
          {
            factRecallAccuracy: 92,
            contextContinuityScore: 95,
            hallucinationRate: 2,
            factExtractionAccuracy: 89,
            conflictResolutionSuccess: 93,
            timestamp: new Date(),
            avatarId: 'avatar-2',
            conversationId: 'conv-2'
          }
        ],
        quality: [],
        systemHealth: []
      });

      const analysis = analyticsService.analyzeFactRecall(30);
      
      expect(analysis.recallAccuracy).toBe(90); // (88 + 92) / 2
      expect(analysis.mostRecalledFactTypes).toBeDefined();
      expect(analysis.leastRecalledFactTypes).toBeDefined();
      expect(analysis.factAgeImpact).toBeDefined();
      expect(analysis.factAgeImpact).toHaveLength(4);
    });
  });

  describe('Conversation Flow Analysis', () => {
    it('should analyze conversation flow patterns', () => {
      const mockExportMetrics = vi.spyOn(monitoringService, 'exportMetrics');
      mockExportMetrics.mockReturnValue({
        performance: [],
        accuracy: [],
        quality: [
          {
            conversationLength: 12,
            topicCoherence: 88,
            responseRelevance: 92,
            personalityConsistency: 85,
            emotionalAppropriatenessScore: 90,
            timestamp: new Date(),
            avatarId: 'avatar-1',
            conversationId: 'conv-1'
          },
          {
            conversationLength: 8,
            topicCoherence: 82,
            responseRelevance: 87,
            personalityConsistency: 80,
            emotionalAppropriatenessScore: 85,
            timestamp: new Date(),
            avatarId: 'avatar-2',
            conversationId: 'conv-2'
          }
        ],
        systemHealth: []
      });

      const analysis = analyticsService.analyzeConversationFlow(30);
      
      expect(analysis.averageConversationLength).toBe(10); // (12 + 8) / 2
      expect(analysis.userEngagementScore).toBe(89.5); // (92 + 87) / 2
      expect(analysis.topicSwitchFrequency).toBeDefined();
      expect(analysis.contextLossPoints).toBeDefined();
      expect(analysis.dropOffPoints).toBeDefined();
    });
  });

  describe('Analytics Report', () => {
    it('should generate comprehensive analytics report', () => {
      // Mock all the required methods
      const mockAnalyzePerformanceTrends = vi.spyOn(analyticsService, 'analyzePerformanceTrends');
      const mockAnalyzeAccuracyTrends = vi.spyOn(analyticsService, 'analyzeAccuracyTrends');
      const mockGenerateAvatarProfiles = vi.spyOn(analyticsService, 'generateAvatarProfiles');
      const mockAnalyzeUsagePatterns = vi.spyOn(analyticsService, 'analyzeUsagePatterns');
      const mockAnalyzeFactRecall = vi.spyOn(analyticsService, 'analyzeFactRecall');
      const mockAnalyzeConversationFlow = vi.spyOn(analyticsService, 'analyzeConversationFlow');

      mockAnalyzePerformanceTrends.mockReturnValue([
        { metric: 'Response Time', trend: 'improving', changePercentage: -10, confidence: 0.8, timeframe: '7 days' }
      ]);
      
      mockAnalyzeAccuracyTrends.mockReturnValue([
        { metric: 'Fact Recall', trend: 'stable', changePercentage: 2, confidence: 0.3, timeframe: '7 days' }
      ]);
      
      mockGenerateAvatarProfiles.mockReturnValue([
        {
          avatarId: 'avatar-1',
          averageResponseTime: 1200,
          accuracyScore: 88,
          qualityScore: 92,
          conversationCount: 50,
          userSatisfaction: 4.2,
          strengths: ['Fast response times'],
          weaknesses: []
        }
      ]);
      
      mockAnalyzeUsagePatterns.mockReturnValue([
        { timeOfDay: 14, dayOfWeek: 1, requestCount: 25, averageResponseTime: 1100, userSatisfaction: 4.1 }
      ]);
      
      mockAnalyzeFactRecall.mockReturnValue({
        totalFactsStored: 1000,
        totalFactsRecalled: 850,
        recallAccuracy: 85,
        mostRecalledFactTypes: [{ type: 'personal_info', count: 200 }],
        leastRecalledFactTypes: [{ type: 'dates', count: 50 }],
        factAgeImpact: [{ ageRange: '0-7 days', accuracy: 95 }]
      });
      
      mockAnalyzeConversationFlow.mockReturnValue({
        averageConversationLength: 12,
        topicSwitchFrequency: 2.5,
        contextLossPoints: [],
        userEngagementScore: 4.1,
        dropOffPoints: []
      });

      const report = analyticsService.generateAnalyticsReport(7);
      
      expect(report.performanceTrends).toHaveLength(1);
      expect(report.accuracyTrends).toHaveLength(1);
      expect(report.topAvatars).toHaveLength(1);
      expect(report.usagePatterns).toHaveLength(1);
      expect(report.factRecallAnalysis).toBeDefined();
      expect(report.conversationFlowAnalysis).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(Array.isArray(report.recommendations)).toBe(true);
    });
  });

  describe('Recommendations', () => {
    it('should generate appropriate recommendations based on data', () => {
      // This tests the private generateRecommendations method indirectly through generateAnalyticsReport
      const mockAnalyzePerformanceTrends = vi.spyOn(analyticsService, 'analyzePerformanceTrends');
      const mockAnalyzeAccuracyTrends = vi.spyOn(analyticsService, 'analyzeAccuracyTrends');
      const mockGenerateAvatarProfiles = vi.spyOn(analyticsService, 'generateAvatarProfiles');
      const mockAnalyzeUsagePatterns = vi.spyOn(analyticsService, 'analyzeUsagePatterns');
      const mockAnalyzeFactRecall = vi.spyOn(analyticsService, 'analyzeFactRecall');
      const mockAnalyzeConversationFlow = vi.spyOn(analyticsService, 'analyzeConversationFlow');

      // Set up data that should trigger recommendations
      mockAnalyzePerformanceTrends.mockReturnValue([
        { metric: 'Response Time', trend: 'declining', changePercentage: 15, confidence: 0.9, timeframe: '7 days' }
      ]);
      
      mockAnalyzeAccuracyTrends.mockReturnValue([
        { metric: 'Fact Recall Accuracy', trend: 'declining', changePercentage: -8, confidence: 0.7, timeframe: '7 days' }
      ]);
      
      mockGenerateAvatarProfiles.mockReturnValue([
        {
          avatarId: 'avatar-1',
          averageResponseTime: 1200,
          accuracyScore: 65, // Low accuracy
          qualityScore: 92,
          conversationCount: 50,
          userSatisfaction: 4.2,
          strengths: [],
          weaknesses: ['Low fact recall accuracy']
        }
      ]);
      
      mockAnalyzeUsagePatterns.mockReturnValue([
        { timeOfDay: 14, dayOfWeek: 1, requestCount: 100, averageResponseTime: 1100, userSatisfaction: 4.1 },
        { timeOfDay: 15, dayOfWeek: 1, requestCount: 95, averageResponseTime: 1150, userSatisfaction: 4.0 },
        { timeOfDay: 16, dayOfWeek: 1, requestCount: 90, averageResponseTime: 1200, userSatisfaction: 3.9 }
      ]);
      
      mockAnalyzeFactRecall.mockReturnValue({
        totalFactsStored: 1000,
        totalFactsRecalled: 750,
        recallAccuracy: 75, // Below 80% threshold
        mostRecalledFactTypes: [{ type: 'personal_info', count: 200 }],
        leastRecalledFactTypes: [{ type: 'dates', count: 50 }],
        factAgeImpact: [{ ageRange: '0-7 days', accuracy: 95 }]
      });
      
      mockAnalyzeConversationFlow.mockReturnValue({
        averageConversationLength: 4, // Short conversations
        topicSwitchFrequency: 2.5,
        contextLossPoints: [],
        userEngagementScore: 4.1,
        dropOffPoints: []
      });

      const report = analyticsService.generateAnalyticsReport(7);
      
      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.recommendations.some(r => r.includes('response times'))).toBe(true);
      expect(report.recommendations.some(r => r.includes('recall accuracy'))).toBe(true);
      expect(report.recommendations.some(r => r.includes('low accuracy scores'))).toBe(true);
      expect(report.recommendations.some(r => r.includes('peak hours'))).toBe(true);
      expect(report.recommendations.some(r => r.includes('context retrieval'))).toBe(true);
      expect(report.recommendations.some(r => r.includes('conversation lengths'))).toBe(true);
    });
  });
});