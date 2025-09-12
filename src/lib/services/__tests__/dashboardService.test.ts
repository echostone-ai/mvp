/**
 * Tests for DashboardService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DashboardService } from '../dashboardService';
import { MonitoringService } from '../monitoringService';
import { AnalyticsService } from '../analyticsService';

describe('DashboardService', () => {
  let dashboardService: DashboardService;
  let monitoringService: MonitoringService;
  let analyticsService: AnalyticsService;

  beforeEach(() => {
    monitoringService = new MonitoringService();
    monitoringService.clearAll();
    analyticsService = new AnalyticsService(monitoringService);
    dashboardService = new DashboardService(monitoringService, analyticsService);
  });

  describe('Dashboard Data', () => {
    it('should generate comprehensive dashboard data', async () => {
      // Mock the monitoring service methods
      const mockGetPerformanceStats = vi.spyOn(monitoringService, 'getPerformanceStats');
      const mockGetAccuracyStats = vi.spyOn(monitoringService, 'getAccuracyStats');
      const mockGetSystemHealthStats = vi.spyOn(monitoringService, 'getSystemHealthStats');
      const mockGetActiveAlerts = vi.spyOn(monitoringService, 'getActiveAlerts');
      
      // Mock the analytics service methods
      const mockGenerateAvatarProfiles = vi.spyOn(analyticsService, 'generateAvatarProfiles');
      const mockAnalyzePerformanceTrends = vi.spyOn(analyticsService, 'analyzePerformanceTrends');
      const mockAnalyzeAccuracyTrends = vi.spyOn(analyticsService, 'analyzeAccuracyTrends');

      mockGetPerformanceStats.mockReturnValue({
        averageResponseTime: 1200,
        p95ResponseTime: 1800,
        p99ResponseTime: 2200,
        totalRequests: 150,
        errorRate: 2
      });

      mockGetAccuracyStats.mockReturnValue({
        averageFactRecall: 88,
        averageContextContinuity: 92,
        averageHallucinationRate: 3,
        totalConversations: 50
      });

      mockGetSystemHealthStats.mockReturnValue({
        averageDatabaseResponseTime: 120,
        averageApiResponseTime: 250,
        averageCacheHitRate: 85,
        averageErrorRate: 1.5,
        currentActiveConnections: 25,
        currentMemoryUsage: 68,
        currentCpuUsage: 42
      });

      mockGetActiveAlerts.mockReturnValue([
        {
          id: 'alert-1',
          type: 'performance',
          severity: 'medium',
          message: 'Response time elevated',
          metrics: {},
          timestamp: new Date(),
          resolved: false
        },
        {
          id: 'alert-2',
          type: 'system',
          severity: 'high',
          message: 'High memory usage',
          metrics: {},
          timestamp: new Date(),
          resolved: false
        }
      ]);

      mockGenerateAvatarProfiles.mockReturnValue([
        {
          avatarId: 'avatar-1',
          averageResponseTime: 1100,
          accuracyScore: 90,
          qualityScore: 88,
          conversationCount: 25,
          userSatisfaction: 4.3,
          strengths: ['Fast response times'],
          weaknesses: []
        },
        {
          avatarId: 'avatar-2',
          averageResponseTime: 1300,
          accuracyScore: 85,
          qualityScore: 92,
          conversationCount: 20,
          userSatisfaction: 4.1,
          strengths: ['High response quality'],
          weaknesses: []
        }
      ]);

      mockAnalyzePerformanceTrends.mockReturnValue([
        { metric: 'Response Time', trend: 'improving', changePercentage: -5, confidence: 0.7, timeframe: '1 days' }
      ]);

      mockAnalyzeAccuracyTrends.mockReturnValue([
        { metric: 'Fact Recall Accuracy', trend: 'stable', changePercentage: 1, confidence: 0.3, timeframe: '1 days' }
      ]);

      const dashboardData = await dashboardService.getDashboardData();

      expect(dashboardData.timestamp).toBeInstanceOf(Date);
      expect(dashboardData.systemStatus).toBe('warning'); // Due to high severity alert
      
      expect(dashboardData.performance.averageResponseTime).toBe(1200);
      expect(dashboardData.performance.p95ResponseTime).toBe(1800);
      expect(dashboardData.performance.trend).toBe('up'); // Improving trend
      
      expect(dashboardData.accuracy.factRecallAccuracy).toBe(88);
      expect(dashboardData.accuracy.contextContinuity).toBe(92);
      expect(dashboardData.accuracy.hallucinationRate).toBe(3);
      
      expect(dashboardData.systemHealth.memoryUsage).toBe(68);
      expect(dashboardData.systemHealth.cpuUsage).toBe(42);
      expect(dashboardData.systemHealth.cacheHitRate).toBe(85);
      
      expect(dashboardData.alerts.high).toBe(1);
      expect(dashboardData.alerts.medium).toBe(1);
      expect(dashboardData.alerts.recent).toHaveLength(2);
      
      expect(dashboardData.topAvatars).toHaveLength(2);
      expect(dashboardData.topAvatars[0].avatarId).toBe('avatar-1');
      
      expect(dashboardData.recentActivity).toBeDefined();
      expect(Array.isArray(dashboardData.recentActivity)).toBe(true);
    });

    it('should determine system status correctly', async () => {
      const mockGetActiveAlerts = vi.spyOn(monitoringService, 'getActiveAlerts');
      const mockGetSystemHealthStats = vi.spyOn(monitoringService, 'getSystemHealthStats');
      
      // Mock other required methods
      vi.spyOn(monitoringService, 'getPerformanceStats').mockReturnValue({
        averageResponseTime: 1000, p95ResponseTime: 1500, p99ResponseTime: 2000, totalRequests: 100, errorRate: 1
      });
      vi.spyOn(monitoringService, 'getAccuracyStats').mockReturnValue({
        averageFactRecall: 90, averageContextContinuity: 95, averageHallucinationRate: 2, totalConversations: 30
      });
      vi.spyOn(analyticsService, 'generateAvatarProfiles').mockReturnValue([]);
      vi.spyOn(analyticsService, 'analyzePerformanceTrends').mockReturnValue([]);
      vi.spyOn(analyticsService, 'analyzeAccuracyTrends').mockReturnValue([]);

      // Test critical status
      mockGetActiveAlerts.mockReturnValue([
        { id: 'alert-1', type: 'system', severity: 'critical', message: 'Critical error', metrics: {}, timestamp: new Date(), resolved: false }
      ]);
      mockGetSystemHealthStats.mockReturnValue({
        averageDatabaseResponseTime: 100, averageApiResponseTime: 200, averageCacheHitRate: 90, averageErrorRate: 1,
        currentActiveConnections: 20, currentMemoryUsage: 70, currentCpuUsage: 40
      });

      let dashboardData = await dashboardService.getDashboardData();
      expect(dashboardData.systemStatus).toBe('critical');

      // Test warning status
      mockGetActiveAlerts.mockReturnValue([
        { id: 'alert-1', type: 'performance', severity: 'high', message: 'High response time', metrics: {}, timestamp: new Date(), resolved: false }
      ]);
      mockGetSystemHealthStats.mockReturnValue({
        averageDatabaseResponseTime: 100, averageApiResponseTime: 200, averageCacheHitRate: 90, averageErrorRate: 3,
        currentActiveConnections: 20, currentMemoryUsage: 70, currentCpuUsage: 40
      });

      dashboardData = await dashboardService.getDashboardData();
      expect(dashboardData.systemStatus).toBe('warning');

      // Test healthy status
      mockGetActiveAlerts.mockReturnValue([]);
      mockGetSystemHealthStats.mockReturnValue({
        averageDatabaseResponseTime: 100, averageApiResponseTime: 200, averageCacheHitRate: 90, averageErrorRate: 1,
        currentActiveConnections: 20, currentMemoryUsage: 70, currentCpuUsage: 40
      });

      dashboardData = await dashboardService.getDashboardData();
      expect(dashboardData.systemStatus).toBe('healthy');
    });
  });

  describe('System Health Checks', () => {
    it('should perform and return health checks', async () => {
      const healthChecks = await dashboardService.getSystemHealthChecks();
      
      expect(healthChecks).toBeDefined();
      expect(Array.isArray(healthChecks)).toBe(true);
      expect(healthChecks.length).toBeGreaterThan(0);
      
      const databaseCheck = healthChecks.find(check => check.component === 'database');
      expect(databaseCheck).toBeDefined();
      expect(databaseCheck?.status).toMatch(/healthy|warning|critical/);
      expect(databaseCheck?.lastCheck).toBeInstanceOf(Date);
      
      const memoryCheck = healthChecks.find(check => check.component === 'memory');
      expect(memoryCheck).toBeDefined();
      expect(memoryCheck?.details).toContain('Memory usage:');
    });
  });

  describe('Performance Chart Data', () => {
    it('should generate performance chart data', () => {
      const mockExportMetrics = vi.spyOn(monitoringService, 'exportMetrics');
      
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      mockExportMetrics.mockReturnValue({
        performance: [
          {
            responseTime: 800, contextRetrievalTime: 200, gpt5ProcessingTime: 500, memoryUpdateTime: 100,
            totalRequestTime: 1200, timestamp: twoHoursAgo, avatarId: 'avatar-1', requestId: 'req-1'
          },
          {
            responseTime: 900, contextRetrievalTime: 250, gpt5ProcessingTime: 600, memoryUpdateTime: 150,
            totalRequestTime: 1400, timestamp: oneHourAgo, avatarId: 'avatar-1', requestId: 'req-2'
          },
          {
            responseTime: 700, contextRetrievalTime: 180, gpt5ProcessingTime: 450, memoryUpdateTime: 80,
            totalRequestTime: 1000, timestamp: now, avatarId: 'avatar-2', requestId: 'req-3'
          }
        ],
        accuracy: [
          {
            factRecallAccuracy: 88, contextContinuityScore: 92, hallucinationRate: 3,
            factExtractionAccuracy: 85, conflictResolutionSuccess: 90,
            timestamp: oneHourAgo, avatarId: 'avatar-1', conversationId: 'conv-1'
          }
        ],
        quality: [],
        systemHealth: []
      });

      const chartData = dashboardService.getPerformanceChartData(24);
      
      expect(chartData.timestamps).toBeDefined();
      expect(chartData.responseTime).toBeDefined();
      expect(chartData.requestVolume).toBeDefined();
      expect(chartData.errorRate).toBeDefined();
      expect(chartData.accuracy).toBeDefined();
      
      expect(chartData.timestamps.length).toBeGreaterThan(0);
      expect(chartData.responseTime.length).toBe(chartData.timestamps.length);
      expect(chartData.requestVolume.length).toBe(chartData.timestamps.length);
    });
  });

  describe('Avatar Comparison Data', () => {
    it('should generate avatar comparison data', () => {
      const mockGenerateAvatarProfiles = vi.spyOn(analyticsService, 'generateAvatarProfiles');
      
      mockGenerateAvatarProfiles.mockReturnValue([
        {
          avatarId: 'avatar-1',
          averageResponseTime: 1100,
          accuracyScore: 90,
          qualityScore: 88,
          conversationCount: 25,
          userSatisfaction: 4.3,
          strengths: [],
          weaknesses: []
        },
        {
          avatarId: 'avatar-2',
          averageResponseTime: 1300,
          accuracyScore: 85,
          qualityScore: 92,
          conversationCount: 20,
          userSatisfaction: 4.1,
          strengths: [],
          weaknesses: []
        }
      ]);

      const comparisonData = dashboardService.getAvatarComparisonData(['avatar-1', 'avatar-2'], 24);
      
      expect(comparisonData).toHaveLength(2);
      
      const avatar1Data = comparisonData.find(d => d.avatarId === 'avatar-1');
      expect(avatar1Data).toBeDefined();
      expect(avatar1Data?.metrics.responseTime).toBe(1100);
      expect(avatar1Data?.metrics.accuracy).toBe(90);
      expect(avatar1Data?.metrics.conversationCount).toBe(25);
      expect(avatar1Data?.metrics.userSatisfaction).toBe(4.3);
      
      const avatar2Data = comparisonData.find(d => d.avatarId === 'avatar-2');
      expect(avatar2Data).toBeDefined();
      expect(avatar2Data?.metrics.responseTime).toBe(1300);
      expect(avatar2Data?.metrics.accuracy).toBe(85);
    });

    it('should handle missing avatar data', () => {
      const mockGenerateAvatarProfiles = vi.spyOn(analyticsService, 'generateAvatarProfiles');
      mockGenerateAvatarProfiles.mockReturnValue([]);

      const comparisonData = dashboardService.getAvatarComparisonData(['non-existent-avatar'], 24);
      
      expect(comparisonData).toHaveLength(1);
      expect(comparisonData[0].avatarId).toBe('non-existent-avatar');
      expect(comparisonData[0].metrics.responseTime).toBe(0);
      expect(comparisonData[0].metrics.accuracy).toBe(0);
      expect(comparisonData[0].metrics.conversationCount).toBe(0);
      expect(comparisonData[0].metrics.userSatisfaction).toBe(0);
    });
  });

  describe('Usage Heatmap Data', () => {
    it('should generate usage heatmap data', () => {
      const mockAnalyzeUsagePatterns = vi.spyOn(analyticsService, 'analyzeUsagePatterns');
      
      mockAnalyzeUsagePatterns.mockReturnValue([
        { timeOfDay: 9, dayOfWeek: 1, requestCount: 50, averageResponseTime: 1100, userSatisfaction: 4.2 },
        { timeOfDay: 14, dayOfWeek: 1, requestCount: 75, averageResponseTime: 1200, userSatisfaction: 4.1 },
        { timeOfDay: 10, dayOfWeek: 2, requestCount: 60, averageResponseTime: 1150, userSatisfaction: 4.3 }
      ]);

      const heatmapData = dashboardService.getUsageHeatmapData(30);
      
      expect(heatmapData).toHaveLength(3);
      
      expect(heatmapData[0]).toEqual({
        hour: 9,
        day: 1,
        value: 50
      });
      
      expect(heatmapData[1]).toEqual({
        hour: 14,
        day: 1,
        value: 75
      });
      
      expect(heatmapData[2]).toEqual({
        hour: 10,
        day: 2,
        value: 60
      });
    });
  });

  describe('Data Export', () => {
    it('should export dashboard data as JSON', async () => {
      // Set up minimal mocks
      vi.spyOn(monitoringService, 'getPerformanceStats').mockReturnValue({
        averageResponseTime: 1000, p95ResponseTime: 1500, p99ResponseTime: 2000, totalRequests: 100, errorRate: 1
      });
      vi.spyOn(monitoringService, 'getAccuracyStats').mockReturnValue({
        averageFactRecall: 90, averageContextContinuity: 95, averageHallucinationRate: 2, totalConversations: 30
      });
      vi.spyOn(monitoringService, 'getSystemHealthStats').mockReturnValue({
        averageDatabaseResponseTime: 100, averageApiResponseTime: 200, averageCacheHitRate: 90, averageErrorRate: 1,
        currentActiveConnections: 20, currentMemoryUsage: 70, currentCpuUsage: 40
      });
      vi.spyOn(monitoringService, 'getActiveAlerts').mockReturnValue([]);
      vi.spyOn(analyticsService, 'generateAvatarProfiles').mockReturnValue([]);
      vi.spyOn(analyticsService, 'analyzePerformanceTrends').mockReturnValue([]);
      vi.spyOn(analyticsService, 'analyzeAccuracyTrends').mockReturnValue([]);

      // Generate dashboard data first
      await dashboardService.getDashboardData();
      
      const jsonExport = dashboardService.exportDashboardData('json');
      
      expect(typeof jsonExport).toBe('string');
      
      const parsedData = JSON.parse(jsonExport);
      expect(parsedData.timestamp).toBeDefined();
      expect(parsedData.systemStatus).toBeDefined();
      expect(parsedData.performance).toBeDefined();
      expect(parsedData.accuracy).toBeDefined();
      expect(parsedData.systemHealth).toBeDefined();
    });

    it('should export dashboard data as CSV', async () => {
      // Set up minimal mocks
      vi.spyOn(monitoringService, 'getPerformanceStats').mockReturnValue({
        averageResponseTime: 1000, p95ResponseTime: 1500, p99ResponseTime: 2000, totalRequests: 100, errorRate: 1
      });
      vi.spyOn(monitoringService, 'getAccuracyStats').mockReturnValue({
        averageFactRecall: 90, averageContextContinuity: 95, averageHallucinationRate: 2, totalConversations: 30
      });
      vi.spyOn(monitoringService, 'getSystemHealthStats').mockReturnValue({
        averageDatabaseResponseTime: 100, averageApiResponseTime: 200, averageCacheHitRate: 90, averageErrorRate: 1,
        currentActiveConnections: 20, currentMemoryUsage: 70, currentCpuUsage: 40
      });
      vi.spyOn(monitoringService, 'getActiveAlerts').mockReturnValue([]);
      vi.spyOn(analyticsService, 'generateAvatarProfiles').mockReturnValue([]);
      vi.spyOn(analyticsService, 'analyzePerformanceTrends').mockReturnValue([]);
      vi.spyOn(analyticsService, 'analyzeAccuracyTrends').mockReturnValue([]);

      // Generate dashboard data first
      await dashboardService.getDashboardData();
      
      const csvExport = dashboardService.exportDashboardData('csv');
      
      expect(typeof csvExport).toBe('string');
      expect(csvExport).toContain('Timestamp,System Status');
      expect(csvExport).toContain('healthy'); // System status
      expect(csvExport.split('\n')).toHaveLength(2); // Header + data row
    });

    it('should throw error when no dashboard data is available', () => {
      expect(() => {
        dashboardService.exportDashboardData('json');
      }).toThrow('No dashboard data available');
    });
  });

  describe('Trend Direction Mapping', () => {
    it('should map trend directions correctly', async () => {
      const mockAnalyzePerformanceTrends = vi.spyOn(analyticsService, 'analyzePerformanceTrends');
      const mockAnalyzeAccuracyTrends = vi.spyOn(analyticsService, 'analyzeAccuracyTrends');
      
      // Set up other required mocks
      vi.spyOn(monitoringService, 'getPerformanceStats').mockReturnValue({
        averageResponseTime: 1000, p95ResponseTime: 1500, p99ResponseTime: 2000, totalRequests: 100, errorRate: 1
      });
      vi.spyOn(monitoringService, 'getAccuracyStats').mockReturnValue({
        averageFactRecall: 90, averageContextContinuity: 95, averageHallucinationRate: 2, totalConversations: 30
      });
      vi.spyOn(monitoringService, 'getSystemHealthStats').mockReturnValue({
        averageDatabaseResponseTime: 100, averageApiResponseTime: 200, averageCacheHitRate: 90, averageErrorRate: 1,
        currentActiveConnections: 20, currentMemoryUsage: 70, currentCpuUsage: 40
      });
      vi.spyOn(monitoringService, 'getActiveAlerts').mockReturnValue([]);
      vi.spyOn(analyticsService, 'generateAvatarProfiles').mockReturnValue([]);

      // Test improving trend
      mockAnalyzePerformanceTrends.mockReturnValue([
        { metric: 'Response Time', trend: 'improving', changePercentage: -10, confidence: 0.8, timeframe: '1 days' }
      ]);
      mockAnalyzeAccuracyTrends.mockReturnValue([
        { metric: 'Fact Recall Accuracy', trend: 'declining', changePercentage: -5, confidence: 0.6, timeframe: '1 days' }
      ]);

      let dashboardData = await dashboardService.getDashboardData();
      expect(dashboardData.performance.trend).toBe('up');
      expect(dashboardData.accuracy.trend).toBe('down');

      // Test stable trend
      mockAnalyzePerformanceTrends.mockReturnValue([
        { metric: 'Response Time', trend: 'stable', changePercentage: 1, confidence: 0.2, timeframe: '1 days' }
      ]);
      mockAnalyzeAccuracyTrends.mockReturnValue([]);

      dashboardData = await dashboardService.getDashboardData();
      expect(dashboardData.performance.trend).toBe('stable');
      expect(dashboardData.accuracy.trend).toBe('stable'); // No trend data
    });
  });
});