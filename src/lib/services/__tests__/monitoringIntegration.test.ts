/**
 * Integration tests for monitoring system
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MonitoringService, PerformanceMetrics, AccuracyMetrics, ConversationQualityMetrics, SystemHealthMetrics } from '../monitoringService';
import { AnalyticsService } from '../analyticsService';
import { DashboardService } from '../dashboardService';

describe('Monitoring System Integration', () => {
  let monitoringService: MonitoringService;
  let analyticsService: AnalyticsService;
  let dashboardService: DashboardService;

  beforeEach(() => {
    monitoringService = new MonitoringService();
    monitoringService.clearAll();
    analyticsService = new AnalyticsService(monitoringService);
    dashboardService = new DashboardService(monitoringService, analyticsService);
  });

  describe('End-to-End Monitoring Flow', () => {
    it('should handle complete monitoring workflow', async () => {
      const timestamp = new Date();
      
      // Step 1: Record performance metrics
      const performanceMetrics: PerformanceMetrics = {
        responseTime: 800,
        contextRetrievalTime: 200,
        gpt5ProcessingTime: 500,
        memoryUpdateTime: 100,
        totalRequestTime: 1200,
        timestamp,
        avatarId: 'avatar-1',
        requestId: 'req-1'
      };
      
      monitoringService.recordPerformanceMetrics(performanceMetrics);

      // Step 2: Record accuracy metrics
      const accuracyMetrics: AccuracyMetrics = {
        factRecallAccuracy: 88,
        contextContinuityScore: 92,
        hallucinationRate: 3,
        factExtractionAccuracy: 85,
        conflictResolutionSuccess: 90,
        timestamp,
        avatarId: 'avatar-1',
        conversationId: 'conv-1'
      };
      
      monitoringService.recordAccuracyMetrics(accuracyMetrics);

      // Step 3: Record quality metrics
      const qualityMetrics: ConversationQualityMetrics = {
        userSatisfactionScore: 4.2,
        conversationLength: 12,
        topicCoherence: 88,
        responseRelevance: 92,
        personalityConsistency: 85,
        emotionalAppropriatenessScore: 90,
        timestamp,
        avatarId: 'avatar-1',
        conversationId: 'conv-1'
      };
      
      monitoringService.recordConversationQuality(qualityMetrics);

      // Step 4: Record system health metrics
      const systemMetrics: SystemHealthMetrics = {
        databaseResponseTime: 120,
        apiResponseTime: 250,
        cacheHitRate: 88,
        errorRate: 1.5,
        activeConnections: 22,
        memoryUsage: 68,
        cpuUsage: 42,
        timestamp
      };
      
      monitoringService.recordSystemHealth(systemMetrics);

      // Step 5: Verify monitoring service aggregation
      const performanceStats = monitoringService.getPerformanceStats(1);
      expect(performanceStats.totalRequests).toBe(1);
      expect(performanceStats.averageResponseTime).toBe(1200);

      const accuracyStats = monitoringService.getAccuracyStats(1);
      expect(accuracyStats.totalConversations).toBe(1);
      expect(accuracyStats.averageFactRecall).toBe(88);

      const qualityStats = monitoringService.getQualityStats(1);
      expect(qualityStats.totalConversations).toBe(1);
      expect(qualityStats.averageSatisfaction).toBe(4.2);

      const systemHealthStats = monitoringService.getSystemHealthStats(1);
      expect(systemHealthStats.currentMemoryUsage).toBe(68);

      // Step 6: Verify analytics service processing
      const avatarProfiles = analyticsService.generateAvatarProfiles(1);
      expect(avatarProfiles).toHaveLength(1);
      expect(avatarProfiles[0].avatarId).toBe('avatar-1');
      expect(avatarProfiles[0].averageResponseTime).toBe(1200);
      expect(avatarProfiles[0].accuracyScore).toBe(88);

      // Step 7: Verify dashboard service integration
      const dashboardData = await dashboardService.getDashboardData();
      expect(dashboardData.performance.averageResponseTime).toBe(1200);
      expect(dashboardData.accuracy.factRecallAccuracy).toBe(88);
      expect(dashboardData.quality.averageSatisfaction).toBe(4.2);
      expect(dashboardData.systemHealth.currentMemoryUsage).toBe(68);
      expect(dashboardData.topAvatars).toHaveLength(1);
      expect(dashboardData.topAvatars[0].avatarId).toBe('avatar-1');
    });

    it('should handle multiple avatars and conversations', async () => {
      const baseTime = new Date();
      
      // Add metrics for multiple avatars
      const avatars = ['avatar-1', 'avatar-2', 'avatar-3'];
      const conversations = ['conv-1', 'conv-2', 'conv-3', 'conv-4'];
      
      avatars.forEach((avatarId, avatarIndex) => {
        conversations.forEach((conversationId, convIndex) => {
          const timestamp = new Date(baseTime.getTime() + (avatarIndex * 1000 + convIndex * 100));
          
          // Performance metrics
          monitoringService.recordPerformanceMetrics({
            responseTime: 800 + avatarIndex * 100 + convIndex * 50,
            contextRetrievalTime: 200 + convIndex * 10,
            gpt5ProcessingTime: 500 + avatarIndex * 50,
            memoryUpdateTime: 100 + convIndex * 5,
            totalRequestTime: 1200 + avatarIndex * 150 + convIndex * 65,
            timestamp,
            avatarId,
            requestId: `req-${avatarId}-${conversationId}`
          });

          // Accuracy metrics
          monitoringService.recordAccuracyMetrics({
            factRecallAccuracy: 85 + avatarIndex * 2 + convIndex,
            contextContinuityScore: 90 + avatarIndex + convIndex * 0.5,
            hallucinationRate: 2 + avatarIndex * 0.5 + convIndex * 0.2,
            factExtractionAccuracy: 82 + avatarIndex * 1.5 + convIndex * 0.8,
            conflictResolutionSuccess: 88 + avatarIndex * 1.2 + convIndex * 0.6,
            timestamp,
            avatarId,
            conversationId
          });

          // Quality metrics
          monitoringService.recordConversationQuality({
            userSatisfactionScore: 4.0 + avatarIndex * 0.1 + convIndex * 0.05,
            conversationLength: 10 + avatarIndex * 2 + convIndex,
            topicCoherence: 85 + avatarIndex * 1.5 + convIndex * 0.7,
            responseRelevance: 88 + avatarIndex * 1.8 + convIndex * 0.9,
            personalityConsistency: 82 + avatarIndex * 1.3 + convIndex * 0.5,
            emotionalAppropriatenessScore: 86 + avatarIndex * 1.6 + convIndex * 0.8,
            timestamp,
            avatarId,
            conversationId
          });
        });
      });

      // Verify aggregated statistics
      const performanceStats = monitoringService.getPerformanceStats(1);
      expect(performanceStats.totalRequests).toBe(12); // 3 avatars * 4 conversations

      const accuracyStats = monitoringService.getAccuracyStats(1);
      expect(accuracyStats.totalConversations).toBe(12);

      const qualityStats = monitoringService.getQualityStats(1);
      expect(qualityStats.totalConversations).toBe(12);

      // Verify avatar profiles
      const avatarProfiles = analyticsService.generateAvatarProfiles(1);
      expect(avatarProfiles).toHaveLength(3);
      
      // Profiles should be sorted by conversation count (all equal in this case)
      avatarProfiles.forEach(profile => {
        expect(profile.conversationCount).toBe(4);
        expect(avatars).toContain(profile.avatarId);
      });

      // Verify dashboard integration
      const dashboardData = await dashboardService.getDashboardData();
      expect(dashboardData.topAvatars).toHaveLength(3);
      expect(dashboardData.performance.totalRequests).toBe(12);
    });
  });

  describe('Alert System Integration', () => {
    it('should trigger and manage alerts across the system', async () => {
      // Record metrics that should trigger alerts
      const highResponseTimeMetrics: PerformanceMetrics = {
        responseTime: 2000,
        contextRetrievalTime: 500,
        gpt5ProcessingTime: 1200,
        memoryUpdateTime: 300,
        totalRequestTime: 2500, // Exceeds threshold
        timestamp: new Date(),
        avatarId: 'slow-avatar',
        requestId: 'req-slow'
      };

      const lowAccuracyMetrics: AccuracyMetrics = {
        factRecallAccuracy: 70, // Below threshold
        contextContinuityScore: 75,
        hallucinationRate: 15, // Above threshold
        factExtractionAccuracy: 65,
        conflictResolutionSuccess: 72,
        timestamp: new Date(),
        avatarId: 'inaccurate-avatar',
        conversationId: 'conv-inaccurate'
      };

      const highMemorySystemMetrics: SystemHealthMetrics = {
        databaseResponseTime: 600, // Above threshold
        apiResponseTime: 300,
        cacheHitRate: 70,
        errorRate: 8, // Above threshold
        activeConnections: 50,
        memoryUsage: 92, // Critical level
        cpuUsage: 85,
        timestamp: new Date()
      };

      // Record the metrics
      monitoringService.recordPerformanceMetrics(highResponseTimeMetrics);
      monitoringService.recordAccuracyMetrics(lowAccuracyMetrics);
      monitoringService.recordSystemHealth(highMemorySystemMetrics);

      // Verify alerts were created
      const activeAlerts = monitoringService.getActiveAlerts();
      expect(activeAlerts.length).toBeGreaterThan(0);

      // Check for specific alert types
      const performanceAlert = activeAlerts.find(a => a.type === 'performance');
      const accuracyAlert = activeAlerts.find(a => a.type === 'accuracy');
      const systemAlert = activeAlerts.find(a => a.type === 'system');
      const errorAlert = activeAlerts.find(a => a.type === 'error');

      expect(performanceAlert).toBeDefined();
      expect(accuracyAlert).toBeDefined();
      expect(systemAlert).toBeDefined();
      expect(errorAlert).toBeDefined();

      // Verify critical alert for memory
      const criticalAlert = activeAlerts.find(a => a.severity === 'critical');
      expect(criticalAlert).toBeDefined();
      expect(criticalAlert?.message).toContain('memory');

      // Verify dashboard reflects alerts
      const dashboardData = await dashboardService.getDashboardData();
      expect(dashboardData.systemStatus).toBe('critical');
      expect(dashboardData.alerts.critical).toBeGreaterThan(0);
      expect(dashboardData.alerts.recent.length).toBeGreaterThan(0);

      // Test alert resolution
      const alertToResolve = activeAlerts[0];
      const resolved = monitoringService.resolveAlert(alertToResolve.id);
      expect(resolved).toBe(true);

      const remainingAlerts = monitoringService.getActiveAlerts();
      expect(remainingAlerts.length).toBe(activeAlerts.length - 1);
    });
  });

  describe('Performance Optimization', () => {
    it('should handle high-volume metrics efficiently', () => {
      const startTime = Date.now();
      const metricsCount = 1000;

      // Generate and record many metrics
      for (let i = 0; i < metricsCount; i++) {
        const timestamp = new Date(Date.now() + i * 1000);
        
        monitoringService.recordPerformanceMetrics({
          responseTime: 800 + Math.random() * 400,
          contextRetrievalTime: 200 + Math.random() * 100,
          gpt5ProcessingTime: 500 + Math.random() * 200,
          memoryUpdateTime: 100 + Math.random() * 50,
          totalRequestTime: 1200 + Math.random() * 600,
          timestamp,
          avatarId: `avatar-${i % 10}`,
          requestId: `req-${i}`
        });

        if (i % 10 === 0) {
          monitoringService.recordAccuracyMetrics({
            factRecallAccuracy: 80 + Math.random() * 20,
            contextContinuityScore: 85 + Math.random() * 15,
            hallucinationRate: Math.random() * 10,
            factExtractionAccuracy: 75 + Math.random() * 25,
            conflictResolutionSuccess: 80 + Math.random() * 20,
            timestamp,
            avatarId: `avatar-${i % 10}`,
            conversationId: `conv-${i}`
          });
        }
      }

      const processingTime = Date.now() - startTime;
      
      // Should process 1000 metrics in reasonable time (< 1 second)
      expect(processingTime).toBeLessThan(1000);

      // Verify data integrity
      const performanceStats = monitoringService.getPerformanceStats(24);
      expect(performanceStats.totalRequests).toBe(metricsCount);

      const accuracyStats = monitoringService.getAccuracyStats(24);
      expect(accuracyStats.totalConversations).toBe(100); // Every 10th metric

      // Verify analytics can handle the data
      const avatarProfiles = analyticsService.generateAvatarProfiles(24);
      expect(avatarProfiles.length).toBeLessThanOrEqual(10); // 10 unique avatars
    });
  });

  describe('Data Consistency', () => {
    it('should maintain data consistency across services', async () => {
      const timestamp = new Date();
      const avatarId = 'test-avatar';
      const conversationId = 'test-conversation';

      // Record comprehensive metrics
      const performanceMetrics: PerformanceMetrics = {
        responseTime: 950,
        contextRetrievalTime: 220,
        gpt5ProcessingTime: 580,
        memoryUpdateTime: 150,
        totalRequestTime: 1350,
        timestamp,
        avatarId,
        requestId: 'test-req'
      };

      const accuracyMetrics: AccuracyMetrics = {
        factRecallAccuracy: 87,
        contextContinuityScore: 91,
        hallucinationRate: 4,
        factExtractionAccuracy: 84,
        conflictResolutionSuccess: 89,
        timestamp,
        avatarId,
        conversationId
      };

      const qualityMetrics: ConversationQualityMetrics = {
        userSatisfactionScore: 4.1,
        conversationLength: 14,
        topicCoherence: 86,
        responseRelevance: 90,
        personalityConsistency: 83,
        emotionalAppropriatenessScore: 88,
        timestamp,
        avatarId,
        conversationId
      };

      // Record all metrics
      monitoringService.recordPerformanceMetrics(performanceMetrics);
      monitoringService.recordAccuracyMetrics(accuracyMetrics);
      monitoringService.recordConversationQuality(qualityMetrics);

      // Verify consistency across all services
      
      // Monitoring service
      const performanceStats = monitoringService.getPerformanceStats(1);
      const accuracyStats = monitoringService.getAccuracyStats(1);
      const qualityStats = monitoringService.getQualityStats(1);

      expect(performanceStats.averageResponseTime).toBe(1350);
      expect(accuracyStats.averageFactRecall).toBe(87);
      expect(qualityStats.averageSatisfaction).toBe(4.1);

      // Analytics service
      const avatarProfiles = analyticsService.generateAvatarProfiles(1);
      const profile = avatarProfiles.find(p => p.avatarId === avatarId);

      expect(profile).toBeDefined();
      expect(profile?.averageResponseTime).toBe(1350);
      expect(profile?.accuracyScore).toBe(87);
      expect(profile?.qualityScore).toBe(90); // responseRelevance
      expect(profile?.userSatisfaction).toBe(4.1);

      // Dashboard service
      const dashboardData = await dashboardService.getDashboardData();
      
      expect(dashboardData.performance.averageResponseTime).toBe(1350);
      expect(dashboardData.accuracy.factRecallAccuracy).toBe(87);
      expect(dashboardData.quality.averageSatisfaction).toBe(4.1);

      const topAvatar = dashboardData.topAvatars.find(a => a.avatarId === avatarId);
      expect(topAvatar).toBeDefined();
      expect(topAvatar?.averageResponseTime).toBe(1350);
      expect(topAvatar?.accuracyScore).toBe(87);
      expect(topAvatar?.userSatisfaction).toBe(4.1);
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      // Test with invalid data
      expect(() => {
        monitoringService.recordPerformanceMetrics({
          responseTime: -100, // Invalid negative time
          contextRetrievalTime: 200,
          gpt5ProcessingTime: 500,
          memoryUpdateTime: 100,
          totalRequestTime: 1200,
          timestamp: new Date(),
          avatarId: '',
          requestId: ''
        });
      }).not.toThrow();

      // Dashboard should still work even with no data
      const dashboardData = await dashboardService.getDashboardData();
      expect(dashboardData).toBeDefined();
      expect(dashboardData.systemStatus).toBeDefined();

      // Analytics should handle empty data
      const report = analyticsService.generateAnalyticsReport(1);
      expect(report).toBeDefined();
      expect(report.recommendations).toBeDefined();
    });
  });

  describe('Time-based Filtering', () => {
    it('should correctly filter metrics by time periods', () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

      // Record metrics at different times
      [twoDaysAgo, oneDayAgo, oneHourAgo, now].forEach((timestamp, index) => {
        monitoringService.recordPerformanceMetrics({
          responseTime: 800 + index * 100,
          contextRetrievalTime: 200,
          gpt5ProcessingTime: 500,
          memoryUpdateTime: 100,
          totalRequestTime: 1200 + index * 100,
          timestamp,
          avatarId: 'time-test-avatar',
          requestId: `req-${index}`
        });
      });

      // Test different time periods
      const last1Hour = monitoringService.getPerformanceStats(1);
      expect(last1Hour.totalRequests).toBe(2); // oneHourAgo and now

      const last24Hours = monitoringService.getPerformanceStats(24);
      expect(last24Hours.totalRequests).toBe(3); // oneDayAgo, oneHourAgo, and now

      const last48Hours = monitoringService.getPerformanceStats(48);
      expect(last48Hours.totalRequests).toBe(4); // All metrics

      // Verify average calculations are correct for filtered data
      expect(last1Hour.averageResponseTime).toBe(1350); // (1300 + 1400) / 2
      expect(last24Hours.averageResponseTime).toBe(1300); // (1300 + 1400 + 1500) / 3
    });
  });
});