/**
 * Task 14 Simple Integration Tests
 * Basic tests for analytics integration without complex React rendering
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Test the analytics services integration
describe('Task 14: Analytics Services Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should import analytics services without errors', async () => {
    const { ConversationAnalyticsService } = await import('@/lib/services/conversationAnalytics');
    const { ABTestingFramework } = await import('@/lib/services/abTestingFramework');
    const { UserEngagementTracker } = await import('@/lib/services/userEngagementTracker');
    const { ConversationExportService } = await import('@/lib/services/conversationExportService');
    const { ConversationOptimizationService } = await import('@/lib/services/conversationOptimizationService');

    expect(ConversationAnalyticsService).toBeDefined();
    expect(ABTestingFramework).toBeDefined();
    expect(UserEngagementTracker).toBeDefined();
    expect(ConversationExportService).toBeDefined();
    expect(ConversationOptimizationService).toBeDefined();
  });

  it('should import analytics dashboard component without errors', async () => {
    const ConversationAnalyticsDashboard = await import('@/components/ConversationAnalyticsDashboard');
    expect(ConversationAnalyticsDashboard.default).toBeDefined();
  });

  it('should have analytics API endpoints available', async () => {
    // Test that the API route files exist and export the required functions
    const conversationAPI = await import('@/app/api/analytics/conversation/route');
    const abTestingAPI = await import('@/app/api/analytics/ab-testing/route');
    const exportAPI = await import('@/app/api/analytics/export/route');

    expect(conversationAPI.GET).toBeDefined();
    expect(conversationAPI.POST).toBeDefined();
    expect(abTestingAPI.GET).toBeDefined();
    expect(abTestingAPI.POST).toBeDefined();
    expect(exportAPI.GET).toBeDefined();
    expect(exportAPI.POST).toBeDefined();
  });

  it('should create analytics services instances', () => {
    const { ConversationAnalyticsService } = require('@/lib/services/conversationAnalytics');
    const { ABTestingFramework } = require('@/lib/services/abTestingFramework');
    const { UserEngagementTracker } = require('@/lib/services/userEngagementTracker');
    const { ConversationExportService } = require('@/lib/services/conversationExportService');
    const { ConversationOptimizationService } = require('@/lib/services/conversationOptimizationService');

    const analyticsService = ConversationAnalyticsService.getInstance();
    const abTestingFramework = ABTestingFramework.getInstance();
    const engagementTracker = UserEngagementTracker.getInstance();
    const exportService = ConversationExportService.getInstance();
    const optimizationService = ConversationOptimizationService.getInstance();

    expect(analyticsService).toBeDefined();
    expect(abTestingFramework).toBeDefined();
    expect(engagementTracker).toBeDefined();
    expect(exportService).toBeDefined();
    expect(optimizationService).toBeDefined();
  });

  it('should have proper service method signatures', () => {
    const { ConversationAnalyticsService } = require('@/lib/services/conversationAnalytics');
    const analyticsService = ConversationAnalyticsService.getInstance();

    expect(typeof analyticsService.recordConversationTurn).toBe('function');
    expect(typeof analyticsService.analyzeConversationFlow).toBe('function');
    expect(typeof analyticsService.getConversationData).toBe('function');
  });

  it('should integrate services for end-to-end analytics workflow', () => {
    const { ConversationAnalyticsService } = require('@/lib/services/conversationAnalytics');
    const { UserEngagementTracker } = require('@/lib/services/userEngagementTracker');
    const { ConversationOptimizationService } = require('@/lib/services/conversationOptimizationService');

    const analyticsService = ConversationAnalyticsService.getInstance();
    const engagementTracker = UserEngagementTracker.getInstance();
    const optimizationService = ConversationOptimizationService.getInstance();

    const conversationId = 'test-integration-conversation';
    const userId = 'test-integration-user';
    const sessionId = 'test-integration-session';

    // Record conversation turn
    analyticsService.recordConversationTurn(conversationId, {
      id: 'turn-1',
      userMessage: 'Hello',
      assistantResponse: 'Hi there!',
      timestamp: new Date(),
      audioLatency: 800,
      expressionsUsed: ['greeting'],
      memoryFragmentsReferenced: [],
      responseTime: 1200
    });

    // Start engagement tracking
    engagementTracker.startTracking(userId, sessionId, conversationId);

    // Record engagement event
    engagementTracker.recordEvent({
      userId,
      sessionId,
      conversationId,
      eventType: 'message_sent',
      data: { message: 'Hello' },
      context: {
        deviceType: 'desktop',
        browserType: 'Chrome',
        networkQuality: 'good',
        audioContext: 'active',
        backgroundActivity: false,
        timeOfDay: 'afternoon'
      }
    });

    // Generate optimization report
    const report = optimizationService.generateOptimizationReport(conversationId, userId, sessionId);

    expect(report).toBeDefined();
    expect(report.conversationId).toBe(conversationId);
    expect(report.flowAnalysis).toBeDefined();
    expect(report.engagementMetrics).toBeDefined();
    expect(report.performanceScore).toBeGreaterThanOrEqual(0);
    expect(report.performanceScore).toBeLessThanOrEqual(1);
  });

  it('should handle A/B testing workflow', () => {
    const { ABTestingFramework } = require('@/lib/services/abTestingFramework');
    const abTestingFramework = ABTestingFramework.getInstance();

    // Create a test
    const testId = abTestingFramework.createVoiceSettingsTest();
    expect(testId).toBeDefined();

    // Start the test
    const started = abTestingFramework.startTest(testId);
    expect(started).toBe(true);

    // Assign user to test
    const userId = 'test-ab-user';
    const assignment = abTestingFramework.assignUserToTest(userId, testId);
    expect(assignment).toBeDefined();
    expect(assignment?.userId).toBe(userId);
    expect(assignment?.testId).toBe(testId);

    // Record metrics
    abTestingFramework.recordTestMetrics(userId, testId, {
      averageAudioLatency: 750,
      userSatisfactionScore: 0.85
    });

    // Get configuration
    const config = abTestingFramework.getTestConfiguration(userId, testId);
    expect(config).toBeDefined();
  });

  it('should handle conversation export workflow', async () => {
    const { ConversationExportService } = require('@/lib/services/conversationExportService');
    const exportService = ConversationExportService.getInstance();

    const conversationId = 'test-export-conversation';
    const userId = 'test-export-user';

    // Export conversation
    const exportResult = await exportService.exportConversation(conversationId, userId, {
      includeAudio: false,
      includeAnalytics: true,
      includePersonalData: false,
      anonymize: true,
      format: 'json'
    });

    expect(exportResult).toBeDefined();
    expect(exportResult.conversationId).toBe(conversationId);
    expect(exportResult.format).toBe('json');

    // Share conversation
    const shareResult = await exportService.shareConversation(conversationId, userId, {
      isPublic: true,
      allowComments: false,
      anonymize: true,
      includeAnalytics: true
    });

    expect(shareResult).toBeDefined();
    expect(shareResult.conversationId).toBe(conversationId);
    expect(shareResult.isPublic).toBe(true);
  });

  it('should provide optimization dashboard data', () => {
    const { ConversationOptimizationService } = require('@/lib/services/conversationOptimizationService');
    const optimizationService = ConversationOptimizationService.getInstance();

    const dashboard = optimizationService.getOptimizationDashboard();

    expect(dashboard).toBeDefined();
    expect(dashboard.overview).toBeDefined();
    expect(dashboard.activeOptimizations).toBeDefined();
    expect(dashboard.performanceTrends).toBeDefined();
    expect(dashboard.alerts).toBeDefined();
    expect(dashboard.recommendations).toBeDefined();

    // Verify structure
    expect(typeof dashboard.overview.totalConversations).toBe('number');
    expect(typeof dashboard.overview.averageQualityScore).toBe('number');
    expect(typeof dashboard.overview.averageEngagementScore).toBe('number');
    expect(Array.isArray(dashboard.performanceTrends)).toBe(true);
    expect(Array.isArray(dashboard.alerts)).toBe(true);
    expect(Array.isArray(dashboard.recommendations)).toBe(true);
  });
});