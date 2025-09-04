/**
 * Task 14 Verification Tests
 * Tests for conversation analytics and optimization functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConversationAnalyticsService } from '../services/conversationAnalytics';
import { ABTestingFramework } from '../services/abTestingFramework';
import { UserEngagementTracker } from '../services/userEngagementTracker';
import { ConversationExportService } from '../services/conversationExportService';
import { ConversationOptimizationService } from '../services/conversationOptimizationService';

describe('Task 14: Conversation Analytics and Optimization', () => {
  let analyticsService: ConversationAnalyticsService;
  let abTestingFramework: ABTestingFramework;
  let engagementTracker: UserEngagementTracker;
  let exportService: ConversationExportService;
  let optimizationService: ConversationOptimizationService;

  beforeEach(() => {
    analyticsService = ConversationAnalyticsService.getInstance();
    abTestingFramework = ABTestingFramework.getInstance();
    engagementTracker = UserEngagementTracker.getInstance();
    exportService = ConversationExportService.getInstance();
    optimizationService = ConversationOptimizationService.getInstance();
  });

  describe('Conversation Flow Analysis', () => {
    it('should analyze conversation flow and generate optimization suggestions', () => {
      const conversationId = 'test-conversation-1';
      
      // Record some conversation turns
      analyticsService.recordConversationTurn(conversationId, {
        id: 'turn-1',
        userMessage: 'Hello, how are you?',
        assistantResponse: 'I\'m doing well, thank you for asking!',
        timestamp: new Date(),
        audioLatency: 800,
        expressionsUsed: ['greeting'],
        memoryFragmentsReferenced: [],
        responseTime: 1200
      });

      analyticsService.recordConversationTurn(conversationId, {
        id: 'turn-2',
        userMessage: 'Can you tell me about your work?',
        assistantResponse: 'I work in software development, focusing on AI and machine learning projects.',
        timestamp: new Date(),
        audioLatency: 900,
        expressionsUsed: ['thinking', 'confident'],
        memoryFragmentsReferenced: ['work-experience-1'],
        responseTime: 1500
      });

      const analysis = analyticsService.analyzeConversationFlow(conversationId);

      expect(analysis).toBeDefined();
      expect(analysis.conversationId).toBe(conversationId);
      expect(analysis.totalTurns).toBe(2);
      expect(analysis.qualityMetrics).toBeDefined();
      expect(analysis.optimizationSuggestions).toBeDefined();
      expect(analysis.engagementTrends).toBeDefined();
      expect(analysis.topicProgression).toBeDefined();

      // Verify quality metrics are calculated
      expect(analysis.qualityMetrics.averageResponseTime).toBeGreaterThan(0);
      expect(analysis.qualityMetrics.averageAudioLatency).toBeGreaterThan(0);
      expect(analysis.qualityMetrics.expressionUsageRate).toBeGreaterThan(0);
    });

    it('should generate appropriate optimization suggestions based on metrics', () => {
      const conversationId = 'test-conversation-high-latency';
      
      // Record conversation with high latency
      analyticsService.recordConversationTurn(conversationId, {
        id: 'turn-1',
        userMessage: 'Test message',
        assistantResponse: 'Test response',
        timestamp: new Date(),
        audioLatency: 1500, // High latency
        expressionsUsed: [],
        memoryFragmentsReferenced: [],
        responseTime: 2000
      });

      const analysis = analyticsService.analyzeConversationFlow(conversationId);
      const suggestions = analysis.optimizationSuggestions;

      expect(suggestions).toBeDefined();
      expect(suggestions.length).toBeGreaterThan(0);

      // Should suggest voice settings optimization for high latency
      const voiceSuggestion = suggestions.find(s => s.type === 'voice_settings');
      expect(voiceSuggestion).toBeDefined();
      expect(voiceSuggestion?.priority).toBe('high');
    });
  });

  describe('User Engagement Tracking', () => {
    it('should track user engagement events and calculate metrics', () => {
      const userId = 'test-user-1';
      const sessionId = 'test-session-1';
      const conversationId = 'test-conversation-1';

      // Start tracking
      engagementTracker.startTracking(userId, sessionId, conversationId);

      // Record some engagement events
      engagementTracker.recordEvent({
        userId,
        sessionId,
        conversationId,
        eventType: 'message_sent',
        data: { message: 'Hello there!' },
        context: {
          deviceType: 'desktop',
          browserType: 'Chrome',
          networkQuality: 'good',
          audioContext: 'active',
          backgroundActivity: false,
          timeOfDay: 'afternoon'
        }
      });

      engagementTracker.recordEvent({
        userId,
        sessionId,
        conversationId,
        eventType: 'audio_started',
        data: {},
        context: {
          deviceType: 'desktop',
          browserType: 'Chrome',
          networkQuality: 'good',
          audioContext: 'active',
          backgroundActivity: false,
          timeOfDay: 'afternoon'
        }
      });

      // Calculate metrics
      const metrics = engagementTracker.calculateEngagementMetrics(userId, sessionId, conversationId);

      expect(metrics).toBeDefined();
      expect(metrics.userId).toBe(userId);
      expect(metrics.sessionId).toBe(sessionId);
      expect(metrics.conversationId).toBe(conversationId);
      expect(metrics.messagesExchanged).toBeGreaterThan(0);
      expect(metrics.attentionScore).toBeGreaterThan(0);
      expect(metrics.engagementTrend).toBeDefined();

      // Stop tracking
      const finalMetrics = engagementTracker.stopTracking(userId, sessionId, conversationId);
      expect(finalMetrics).toBeDefined();
    });

    it('should calculate conversation quality metrics', () => {
      const conversationId = 'test-conversation-quality';

      // Record events for quality calculation
      engagementTracker.recordEvent({
        userId: 'user-1',
        sessionId: 'session-1',
        conversationId,
        eventType: 'message_sent',
        data: { message: 'Quality test message' },
        context: {
          deviceType: 'desktop',
          browserType: 'Chrome',
          networkQuality: 'excellent',
          audioContext: 'active',
          backgroundActivity: false,
          timeOfDay: 'morning'
        }
      });

      const qualityMetrics = engagementTracker.calculateQualityMetrics(conversationId);

      expect(qualityMetrics).toBeDefined();
      expect(qualityMetrics.conversationId).toBe(conversationId);
      expect(qualityMetrics.naturalFlowScore).toBeGreaterThan(0);
      expect(qualityMetrics.userSatisfactionScore).toBeGreaterThan(0);
      expect(qualityMetrics.engagementScore).toBeGreaterThan(0);
    });
  });

  describe('A/B Testing Framework', () => {
    it('should create and manage A/B tests', () => {
      const testConfig = {
        name: 'Voice Quality Test',
        description: 'Test different voice quality settings',
        type: 'voice_settings' as const,
        startDate: new Date(),
        targetSampleSize: 100,
        variants: [
          {
            id: 'control',
            name: 'Current Settings',
            description: 'Existing configuration',
            weight: 0.5,
            configuration: { quality: 'standard' },
            sampleSize: 0,
            metrics: {
              averageResponseTime: 0,
              averageAudioLatency: 0,
              userEngagementScore: 0,
              conversationCompletionRate: 0,
              expressionEffectivenessScore: 0,
              userSatisfactionScore: 0,
              technicalErrorRate: 0,
              memoryRetrievalSuccessRate: 0
            }
          },
          {
            id: 'enhanced',
            name: 'Enhanced Quality',
            description: 'High-quality configuration',
            weight: 0.5,
            configuration: { quality: 'high' },
            sampleSize: 0,
            metrics: {
              averageResponseTime: 0,
              averageAudioLatency: 0,
              userEngagementScore: 0,
              conversationCompletionRate: 0,
              expressionEffectivenessScore: 0,
              userSatisfactionScore: 0,
              technicalErrorRate: 0,
              memoryRetrievalSuccessRate: 0
            }
          }
        ],
        successMetrics: ['userSatisfactionScore', 'averageAudioLatency'],
        createdBy: 'test-user'
      };

      const testId = abTestingFramework.createTest(testConfig);
      expect(testId).toBeDefined();
      expect(typeof testId).toBe('string');

      const started = abTestingFramework.startTest(testId);
      expect(started).toBe(true);

      const activeTests = abTestingFramework.getActiveTests();
      expect(activeTests.length).toBeGreaterThan(0);
      expect(activeTests.some(test => test.id === testId)).toBe(true);
    });

    it('should assign users to test variants and track metrics', () => {
      const testId = abTestingFramework.createVoiceSettingsTest();
      abTestingFramework.startTest(testId);

      const userId = 'test-user-1';
      const assignment = abTestingFramework.assignUserToTest(userId, testId);

      expect(assignment).toBeDefined();
      expect(assignment?.userId).toBe(userId);
      expect(assignment?.testId).toBe(testId);
      expect(assignment?.variantId).toBeDefined();

      // Record test metrics
      abTestingFramework.recordTestMetrics(userId, testId, {
        averageAudioLatency: 800,
        userSatisfactionScore: 0.85,
        technicalErrorRate: 0.02
      });

      // Get test configuration
      const config = abTestingFramework.getTestConfiguration(userId, testId);
      expect(config).toBeDefined();
    });

    it('should analyze test results and provide recommendations', () => {
      const testId = abTestingFramework.createExpressionTimingTest();
      abTestingFramework.startTest(testId);

      // Simulate test data by assigning users and recording metrics
      for (let i = 0; i < 10; i++) {
        const userId = `test-user-${i}`;
        const assignment = abTestingFramework.assignUserToTest(userId, testId);
        
        if (assignment) {
          abTestingFramework.recordTestMetrics(userId, testId, {
            expressionEffectivenessScore: 0.7 + Math.random() * 0.3,
            userEngagementScore: 0.6 + Math.random() * 0.4,
            conversationCompletionRate: 0.8 + Math.random() * 0.2
          });
        }
      }

      const results = abTestingFramework.analyzeTestResults(testId);
      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);

      results.forEach(result => {
        expect(result.testId).toBe(testId);
        expect(result.variant).toBeDefined();
        expect(result.metrics).toBeDefined();
        expect(result.recommendedAction).toBeDefined();
      });
    });
  });

  describe('Conversation Export and Sharing', () => {
    it('should export conversations in different formats', async () => {
      const conversationId = 'test-conversation-export';
      const userId = 'test-user-1';

      const exportOptions = {
        includeAudio: false,
        includeAnalytics: true,
        includePersonalData: false,
        anonymize: true,
        format: 'json' as const
      };

      const exportResult = await exportService.exportConversation(conversationId, userId, exportOptions);

      expect(exportResult).toBeDefined();
      expect(exportResult.conversationId).toBe(conversationId);
      expect(exportResult.userId).toBe(userId);
      expect(exportResult.format).toBe('json');
      expect(exportResult.downloadUrl).toBeDefined();
      expect(exportResult.metadata).toBeDefined();
    });

    it('should share conversations with analytics', async () => {
      const conversationId = 'test-conversation-share';
      const userId = 'test-user-1';

      const shareOptions = {
        isPublic: true,
        allowComments: false,
        anonymize: true,
        includeAnalytics: true
      };

      const shareResult = await exportService.shareConversation(conversationId, userId, shareOptions);

      expect(shareResult).toBeDefined();
      expect(shareResult.conversationId).toBe(conversationId);
      expect(shareResult.isPublic).toBe(true);
      expect(shareResult.analytics).toBeDefined();
      expect(shareResult.insights).toBeDefined();

      // Test retrieving shared conversation
      const retrieved = exportService.getSharedConversation(shareResult.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(shareResult.id);
      expect(retrieved?.viewCount).toBe(1); // Should increment on access
    });

    it('should generate conversation summaries', () => {
      const conversationId = 'test-conversation-summary';
      const summary = exportService.generateConversationSummary(conversationId);

      expect(summary).toBeDefined();
      expect(summary.id).toBe(conversationId);
      expect(summary.totalTurns).toBeDefined();
      expect(summary.keyTopics).toBeDefined();
      expect(summary.highlights).toBeDefined();
      expect(summary.qualityScore).toBeDefined();
      expect(summary.recommendations).toBeDefined();
    });
  });

  describe('Conversation Optimization Service', () => {
    it('should generate comprehensive optimization reports', () => {
      const conversationId = 'test-conversation-optimization';
      const userId = 'test-user-1';
      const sessionId = 'test-session-1';

      // Set up some test data
      analyticsService.recordConversationTurn(conversationId, {
        id: 'turn-1',
        userMessage: 'Test optimization',
        assistantResponse: 'This is a test response for optimization analysis',
        timestamp: new Date(),
        audioLatency: 1200,
        expressionsUsed: ['thinking'],
        memoryFragmentsReferenced: ['memory-1'],
        responseTime: 1800
      });

      engagementTracker.startTracking(userId, sessionId, conversationId);
      engagementTracker.recordEvent({
        userId,
        sessionId,
        conversationId,
        eventType: 'message_sent',
        data: { message: 'Test message' },
        context: {
          deviceType: 'desktop',
          browserType: 'Chrome',
          networkQuality: 'good',
          audioContext: 'active',
          backgroundActivity: false,
          timeOfDay: 'afternoon'
        }
      });

      const report = optimizationService.generateOptimizationReport(conversationId, userId, sessionId);

      expect(report).toBeDefined();
      expect(report.conversationId).toBe(conversationId);
      expect(report.flowAnalysis).toBeDefined();
      expect(report.engagementMetrics).toBeDefined();
      expect(report.qualityMetrics).toBeDefined();
      expect(report.prioritizedSuggestions).toBeDefined();
      expect(report.performanceScore).toBeGreaterThanOrEqual(0);
      expect(report.performanceScore).toBeLessThanOrEqual(1);
      expect(report.improvementPotential).toBeGreaterThanOrEqual(0);
      expect(report.recommendedTests).toBeDefined();
      expect(report.immediateActions).toBeDefined();
      expect(report.longTermRecommendations).toBeDefined();
    });

    it('should provide optimization dashboard with overview and trends', () => {
      const dashboard = optimizationService.getOptimizationDashboard();

      expect(dashboard).toBeDefined();
      expect(dashboard.overview).toBeDefined();
      expect(dashboard.activeOptimizations).toBeDefined();
      expect(dashboard.performanceTrends).toBeDefined();
      expect(dashboard.alerts).toBeDefined();
      expect(dashboard.recommendations).toBeDefined();

      // Verify overview metrics
      expect(dashboard.overview.totalConversations).toBeGreaterThanOrEqual(0);
      expect(dashboard.overview.averageQualityScore).toBeGreaterThanOrEqual(0);
      expect(dashboard.overview.averageEngagementScore).toBeGreaterThanOrEqual(0);
      expect(dashboard.overview.performanceImprovement).toBeDefined();

      // Verify trends have proper structure
      dashboard.performanceTrends.forEach(trend => {
        expect(trend.metric).toBeDefined();
        expect(trend.timeframe).toBeDefined();
        expect(trend.dataPoints).toBeDefined();
        expect(trend.trend).toMatch(/improving|declining|stable/);
        expect(typeof trend.changePercentage).toBe('number');
      });
    });

    it('should start and manage optimizations', () => {
      const optimizationConfig = {
        name: 'Test Voice Optimization',
        type: 'voice_settings',
        estimatedDuration: 7
      };

      const optimizationId = optimizationService.startOptimization('ab_test', optimizationConfig);

      expect(optimizationId).toBeDefined();
      expect(typeof optimizationId).toBe('string');

      const dashboard = optimizationService.getOptimizationDashboard();
      const activeOptimization = dashboard.activeOptimizations.find(opt => opt.id === optimizationId);

      expect(activeOptimization).toBeDefined();
      expect(activeOptimization?.type).toBe('ab_test');
      expect(activeOptimization?.status).toBe('running');
    });

    it('should export and share optimization reports', async () => {
      const conversationId = 'test-conversation-export-optimization';
      const userId = 'test-user-1';
      const sessionId = 'test-session-1';

      // Generate a report first
      optimizationService.generateOptimizationReport(conversationId, userId, sessionId);

      // Test export
      const exportResult = await optimizationService.exportOptimizationReport(conversationId, 'json');
      expect(exportResult).toBeDefined();
      expect(exportResult.conversationId).toBe(conversationId);

      // Test sharing
      const shareResult = await optimizationService.shareOptimizationInsights(conversationId, {
        isPublic: true,
        includeAnalytics: true
      });
      expect(shareResult).toBeDefined();
      expect(shareResult.isPublic).toBe(true);
    });
  });

  describe('Integration Tests', () => {
    it('should integrate all analytics components for end-to-end workflow', async () => {
      const conversationId = 'integration-test-conversation';
      const userId = 'integration-test-user';
      const sessionId = 'integration-test-session';

      // 1. Start engagement tracking
      engagementTracker.startTracking(userId, sessionId, conversationId);

      // 2. Record conversation turns
      analyticsService.recordConversationTurn(conversationId, {
        id: 'integration-turn-1',
        userMessage: 'Hello, can you help me with something?',
        assistantResponse: 'Of course! I\'d be happy to help you with whatever you need.',
        timestamp: new Date(),
        audioLatency: 750,
        expressionsUsed: ['friendly', 'helpful'],
        memoryFragmentsReferenced: [],
        responseTime: 1100
      });

      // 3. Record engagement events
      engagementTracker.recordEvent({
        userId,
        sessionId,
        conversationId,
        eventType: 'message_sent',
        data: { message: 'Hello, can you help me with something?' },
        context: {
          deviceType: 'desktop',
          browserType: 'Chrome',
          networkQuality: 'excellent',
          audioContext: 'active',
          backgroundActivity: false,
          timeOfDay: 'morning'
        }
      });

      // 4. Create and run A/B test
      const testId = abTestingFramework.createVoiceSettingsTest();
      abTestingFramework.startTest(testId);
      const assignment = abTestingFramework.assignUserToTest(userId, testId);
      expect(assignment).toBeDefined();

      // 5. Generate optimization report
      const report = optimizationService.generateOptimizationReport(conversationId, userId, sessionId);
      expect(report).toBeDefined();
      expect(report.flowAnalysis.totalTurns).toBe(1);

      // 6. Export conversation
      const exportResult = await exportService.exportConversation(conversationId, userId, {
        includeAudio: false,
        includeAnalytics: true,
        includePersonalData: false,
        anonymize: true,
        format: 'json'
      });
      expect(exportResult).toBeDefined();

      // 7. Stop tracking and get final metrics
      const finalMetrics = engagementTracker.stopTracking(userId, sessionId, conversationId);
      expect(finalMetrics).toBeDefined();
      expect(finalMetrics.messagesExchanged).toBeGreaterThan(0);

      // 8. Verify dashboard shows all data
      const dashboard = optimizationService.getOptimizationDashboard();
      expect(dashboard.overview.totalConversations).toBeGreaterThan(0);
      expect(dashboard.overview.activeTests).toBeGreaterThan(0);
    });
  });
});