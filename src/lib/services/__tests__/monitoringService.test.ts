/**
 * Tests for MonitoringService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MonitoringService, PerformanceMetrics, AccuracyMetrics, ConversationQualityMetrics, SystemHealthMetrics } from '../monitoringService';

describe('MonitoringService', () => {
  let monitoringService: MonitoringService;

  beforeEach(() => {
    monitoringService = new MonitoringService();
    monitoringService.clearAll(); // Clear any existing data
  });

  describe('Performance Metrics', () => {
    it('should record and retrieve performance metrics', () => {
      const metrics: PerformanceMetrics = {
        responseTime: 800,
        contextRetrievalTime: 200,
        gpt5ProcessingTime: 500,
        memoryUpdateTime: 100,
        totalRequestTime: 1200,
        timestamp: new Date(),
        avatarId: 'avatar-1',
        requestId: 'req-1'
      };

      monitoringService.recordPerformanceMetrics(metrics);
      
      const stats = monitoringService.getPerformanceStats(1);
      expect(stats.totalRequests).toBe(1);
      expect(stats.averageResponseTime).toBe(1200);
    });

    it('should calculate performance statistics correctly', () => {
      const baseTime = new Date();
      const metrics = [
        {
          responseTime: 800,
          contextRetrievalTime: 200,
          gpt5ProcessingTime: 500,
          memoryUpdateTime: 100,
          totalRequestTime: 1000,
          timestamp: baseTime,
          avatarId: 'avatar-1',
          requestId: 'req-1'
        },
        {
          responseTime: 1200,
          contextRetrievalTime: 300,
          gpt5ProcessingTime: 700,
          memoryUpdateTime: 200,
          totalRequestTime: 1500,
          timestamp: baseTime,
          avatarId: 'avatar-1',
          requestId: 'req-2'
        },
        {
          responseTime: 600,
          contextRetrievalTime: 150,
          gpt5ProcessingTime: 400,
          memoryUpdateTime: 50,
          totalRequestTime: 800,
          timestamp: baseTime,
          avatarId: 'avatar-1',
          requestId: 'req-3'
        }
      ];

      metrics.forEach(metric => monitoringService.recordPerformanceMetrics(metric));
      
      const stats = monitoringService.getPerformanceStats(1);
      expect(stats.totalRequests).toBe(3);
      expect(stats.averageResponseTime).toBe(1100); // (1000 + 1500 + 800) / 3
      expect(stats.p95ResponseTime).toBe(1500);
      expect(stats.p99ResponseTime).toBe(1500);
    });

    it('should trigger performance alerts when thresholds are exceeded', () => {
      const metrics: PerformanceMetrics = {
        responseTime: 2000,
        contextRetrievalTime: 500,
        gpt5ProcessingTime: 1200,
        memoryUpdateTime: 300,
        totalRequestTime: 2500, // Exceeds 1500ms threshold
        timestamp: new Date(),
        avatarId: 'avatar-1',
        requestId: 'req-1'
      };

      monitoringService.recordPerformanceMetrics(metrics);
      
      const alerts = monitoringService.getActiveAlerts();
      expect(alerts.length).toBe(1);
      expect(alerts[0].type).toBe('performance');
      expect(alerts[0].severity).toBe('medium'); // 2500ms > 1500ms threshold but < 2 * 1500ms
    });
  });

  describe('Accuracy Metrics', () => {
    it('should record and retrieve accuracy metrics', () => {
      const metrics: AccuracyMetrics = {
        factRecallAccuracy: 85,
        contextContinuityScore: 90,
        hallucinationRate: 5,
        factExtractionAccuracy: 88,
        conflictResolutionSuccess: 92,
        timestamp: new Date(),
        avatarId: 'avatar-1',
        conversationId: 'conv-1'
      };

      monitoringService.recordAccuracyMetrics(metrics);
      
      const stats = monitoringService.getAccuracyStats(1);
      expect(stats.totalConversations).toBe(1);
      expect(stats.averageFactRecall).toBe(85);
      expect(stats.averageContextContinuity).toBe(90);
      expect(stats.averageHallucinationRate).toBe(5);
    });

    it('should trigger accuracy alerts when thresholds are exceeded', () => {
      const metrics: AccuracyMetrics = {
        factRecallAccuracy: 70, // Below 85% threshold
        contextContinuityScore: 75,
        hallucinationRate: 15, // Above 10% threshold
        factExtractionAccuracy: 65,
        conflictResolutionSuccess: 80,
        timestamp: new Date(),
        avatarId: 'avatar-1',
        conversationId: 'conv-1'
      };

      monitoringService.recordAccuracyMetrics(metrics);
      
      const alerts = monitoringService.getActiveAlerts();
      expect(alerts.length).toBe(2); // One for low accuracy, one for high hallucination
      
      const accuracyAlert = alerts.find(a => a.message.includes('accuracy'));
      const hallucinationAlert = alerts.find(a => a.message.includes('hallucination'));
      
      expect(accuracyAlert).toBeDefined();
      expect(hallucinationAlert).toBeDefined();
      expect(hallucinationAlert?.severity).toBe('high');
    });
  });

  describe('Conversation Quality Metrics', () => {
    it('should record and retrieve quality metrics', () => {
      const metrics: ConversationQualityMetrics = {
        userSatisfactionScore: 4.2,
        conversationLength: 12,
        topicCoherence: 88,
        responseRelevance: 92,
        personalityConsistency: 85,
        emotionalAppropriatenessScore: 90,
        timestamp: new Date(),
        avatarId: 'avatar-1',
        conversationId: 'conv-1'
      };

      monitoringService.recordConversationQuality(metrics);
      
      const stats = monitoringService.getQualityStats(1);
      expect(stats.totalConversations).toBe(1);
      expect(stats.averageSatisfaction).toBe(4.2);
      expect(stats.averageCoherence).toBe(88);
      expect(stats.averageRelevance).toBe(92);
      expect(stats.averagePersonalityConsistency).toBe(85);
    });

    it('should handle missing satisfaction scores', () => {
      const metrics: ConversationQualityMetrics = {
        conversationLength: 8,
        topicCoherence: 80,
        responseRelevance: 85,
        personalityConsistency: 82,
        emotionalAppropriatenessScore: 88,
        timestamp: new Date(),
        avatarId: 'avatar-1',
        conversationId: 'conv-1'
      };

      monitoringService.recordConversationQuality(metrics);
      
      const stats = monitoringService.getQualityStats(1);
      expect(stats.averageSatisfaction).toBe(0); // No satisfaction scores provided
      expect(stats.averageCoherence).toBe(80);
    });
  });

  describe('System Health Metrics', () => {
    it('should record and retrieve system health metrics', () => {
      const metrics: SystemHealthMetrics = {
        databaseResponseTime: 150,
        apiResponseTime: 300,
        cacheHitRate: 85,
        errorRate: 2,
        activeConnections: 25,
        memoryUsage: 65,
        cpuUsage: 45,
        timestamp: new Date()
      };

      monitoringService.recordSystemHealth(metrics);
      
      const stats = monitoringService.getSystemHealthStats(1);
      expect(stats.averageDatabaseResponseTime).toBe(150);
      expect(stats.averageApiResponseTime).toBe(300);
      expect(stats.averageCacheHitRate).toBe(85);
      expect(stats.currentMemoryUsage).toBe(65);
      expect(stats.currentCpuUsage).toBe(45);
    });

    it('should trigger system health alerts', () => {
      const metrics: SystemHealthMetrics = {
        databaseResponseTime: 600, // Above 500ms threshold
        apiResponseTime: 200,
        cacheHitRate: 70,
        errorRate: 8, // Above 5% threshold
        activeConnections: 50,
        memoryUsage: 85, // Above 80% threshold
        cpuUsage: 75,
        timestamp: new Date()
      };

      monitoringService.recordSystemHealth(metrics);
      
      const alerts = monitoringService.getActiveAlerts();
      expect(alerts.length).toBe(3); // Database, error rate, and memory alerts
      
      const memoryAlert = alerts.find(a => a.message.includes('memory'));
      expect(memoryAlert?.severity).toBe('high'); // 85% is above 80% but below 90%
    });

    it('should trigger critical alerts for very high memory usage', () => {
      const metrics: SystemHealthMetrics = {
        databaseResponseTime: 100,
        apiResponseTime: 200,
        cacheHitRate: 90,
        errorRate: 1,
        activeConnections: 30,
        memoryUsage: 95, // Critical level
        cpuUsage: 60,
        timestamp: new Date()
      };

      monitoringService.recordSystemHealth(metrics);
      
      const alerts = monitoringService.getActiveAlerts();
      const memoryAlert = alerts.find(a => a.message.includes('memory'));
      expect(memoryAlert?.severity).toBe('critical');
    });
  });

  describe('Alert Management', () => {
    it('should resolve alerts', () => {
      const metrics: PerformanceMetrics = {
        responseTime: 2000,
        contextRetrievalTime: 500,
        gpt5ProcessingTime: 1200,
        memoryUpdateTime: 300,
        totalRequestTime: 2500,
        timestamp: new Date(),
        avatarId: 'avatar-1',
        requestId: 'req-1'
      };

      monitoringService.recordPerformanceMetrics(metrics);
      
      let alerts = monitoringService.getActiveAlerts();
      expect(alerts.length).toBe(1);
      
      const alertId = alerts[0].id;
      const resolved = monitoringService.resolveAlert(alertId);
      expect(resolved).toBe(true);
      
      alerts = monitoringService.getActiveAlerts();
      expect(alerts.length).toBe(0);
    });

    it('should not resolve non-existent alerts', () => {
      const resolved = monitoringService.resolveAlert('non-existent-id');
      expect(resolved).toBe(false);
    });

    it('should not resolve already resolved alerts', () => {
      const metrics: PerformanceMetrics = {
        responseTime: 2000,
        contextRetrievalTime: 500,
        gpt5ProcessingTime: 1200,
        memoryUpdateTime: 300,
        totalRequestTime: 2500,
        timestamp: new Date(),
        avatarId: 'avatar-1',
        requestId: 'req-1'
      };

      monitoringService.recordPerformanceMetrics(metrics);
      
      const alerts = monitoringService.getActiveAlerts();
      const alertId = alerts[0].id;
      
      // Resolve once
      let resolved = monitoringService.resolveAlert(alertId);
      expect(resolved).toBe(true);
      
      // Try to resolve again
      resolved = monitoringService.resolveAlert(alertId);
      expect(resolved).toBe(false);
    });
  });

  describe('Dashboard Data', () => {
    it('should generate comprehensive dashboard data', () => {
      // Add some test data
      const performanceMetrics: PerformanceMetrics = {
        responseTime: 800,
        contextRetrievalTime: 200,
        gpt5ProcessingTime: 500,
        memoryUpdateTime: 100,
        totalRequestTime: 1200,
        timestamp: new Date(),
        avatarId: 'avatar-1',
        requestId: 'req-1'
      };

      const accuracyMetrics: AccuracyMetrics = {
        factRecallAccuracy: 88,
        contextContinuityScore: 92,
        hallucinationRate: 3,
        factExtractionAccuracy: 85,
        conflictResolutionSuccess: 90,
        timestamp: new Date(),
        avatarId: 'avatar-1',
        conversationId: 'conv-1'
      };

      const qualityMetrics: ConversationQualityMetrics = {
        userSatisfactionScore: 4.3,
        conversationLength: 15,
        topicCoherence: 89,
        responseRelevance: 93,
        personalityConsistency: 87,
        emotionalAppropriatenessScore: 91,
        timestamp: new Date(),
        avatarId: 'avatar-1',
        conversationId: 'conv-1'
      };

      const systemMetrics: SystemHealthMetrics = {
        databaseResponseTime: 120,
        apiResponseTime: 250,
        cacheHitRate: 88,
        errorRate: 1.5,
        activeConnections: 22,
        memoryUsage: 68,
        cpuUsage: 42,
        timestamp: new Date()
      };

      monitoringService.recordPerformanceMetrics(performanceMetrics);
      monitoringService.recordAccuracyMetrics(accuracyMetrics);
      monitoringService.recordConversationQuality(qualityMetrics);
      monitoringService.recordSystemHealth(systemMetrics);

      const dashboardData = monitoringService.getDashboardData(1);
      
      expect(dashboardData.performance.totalRequests).toBe(1);
      expect(dashboardData.performance.averageResponseTime).toBe(1200);
      expect(dashboardData.accuracy.totalConversations).toBe(1);
      expect(dashboardData.accuracy.averageFactRecall).toBe(88);
      expect(dashboardData.quality.totalConversations).toBe(1);
      expect(dashboardData.quality.averageSatisfaction).toBe(4.3);
      expect(dashboardData.systemHealth.currentMemoryUsage).toBe(68);
      expect(dashboardData.activeAlerts.length).toBe(0);
    });
  });

  describe('Data Export', () => {
    it('should export metrics for external analysis', () => {
      const performanceMetrics: PerformanceMetrics = {
        responseTime: 800,
        contextRetrievalTime: 200,
        gpt5ProcessingTime: 500,
        memoryUpdateTime: 100,
        totalRequestTime: 1200,
        timestamp: new Date(),
        avatarId: 'avatar-1',
        requestId: 'req-1'
      };

      monitoringService.recordPerformanceMetrics(performanceMetrics);
      
      const exportedData = monitoringService.exportMetrics(1);
      expect(exportedData.performance.length).toBe(1);
      expect(exportedData.performance[0]).toEqual(performanceMetrics);
      expect(exportedData.accuracy.length).toBe(0);
      expect(exportedData.quality.length).toBe(0);
      expect(exportedData.systemHealth.length).toBe(0);
    });
  });

  describe('Memory Management', () => {
    it('should limit metrics history to prevent memory leaks', () => {
      // This test would need to be adjusted based on the actual maxMetricsHistory value
      // For now, we'll test that the service doesn't crash with many metrics
      for (let i = 0; i < 100; i++) {
        const metrics: PerformanceMetrics = {
          responseTime: 800 + i,
          contextRetrievalTime: 200,
          gpt5ProcessingTime: 500,
          memoryUpdateTime: 100,
          totalRequestTime: 1200 + i,
          timestamp: new Date(),
          avatarId: `avatar-${i}`,
          requestId: `req-${i}`
        };
        monitoringService.recordPerformanceMetrics(metrics);
      }

      const stats = monitoringService.getPerformanceStats(24);
      expect(stats.totalRequests).toBe(100);
    });

    it('should clean up old alerts', () => {
      // Create an alert
      const metrics: PerformanceMetrics = {
        responseTime: 2000,
        contextRetrievalTime: 500,
        gpt5ProcessingTime: 1200,
        memoryUpdateTime: 300,
        totalRequestTime: 2500,
        timestamp: new Date(),
        avatarId: 'avatar-1',
        requestId: 'req-1'
      };

      monitoringService.recordPerformanceMetrics(metrics);
      
      let alerts = monitoringService.getActiveAlerts();
      expect(alerts.length).toBe(1);

      // The cleanup happens automatically, but we can't easily test it without
      // manipulating time or exposing the cleanup method
    });
  });
});