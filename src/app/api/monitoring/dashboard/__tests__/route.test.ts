/**
 * Tests for monitoring dashboard API endpoint
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../route';

// Mock the services
vi.mock('@/lib/services/monitoringService', () => ({
  monitoringService: {
    getPerformanceStats: vi.fn(),
    getAccuracyStats: vi.fn(),
    getSystemHealthStats: vi.fn(),
    getActiveAlerts: vi.fn(),
    exportMetrics: vi.fn(),
    recordPerformanceMetrics: vi.fn(),
    recordAccuracyMetrics: vi.fn(),
    recordConversationQuality: vi.fn(),
    recordSystemHealth: vi.fn(),
    resolveAlert: vi.fn(),
    getDashboardData: vi.fn()
  }
}));

vi.mock('@/lib/services/analyticsService', () => ({
  AnalyticsService: vi.fn().mockImplementation(() => ({
    generateAnalyticsReport: vi.fn(),
    generateAvatarProfiles: vi.fn(),
    analyzeUsagePatterns: vi.fn()
  }))
}));

vi.mock('@/lib/services/dashboardService', () => ({
  DashboardService: vi.fn().mockImplementation(() => ({
    getDashboardData: vi.fn(),
    getPerformanceChartData: vi.fn(),
    getSystemHealthChecks: vi.fn(),
    getAvatarComparisonData: vi.fn(),
    getUsageHeatmapData: vi.fn(),
    exportDashboardData: vi.fn()
  }))
}));

describe('Monitoring Dashboard API', () => {
  let mockDashboardService: any;
  let mockAnalyticsService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Get the mocked instances
    const { DashboardService } = require('@/lib/services/dashboardService');
    const { AnalyticsService } = require('@/lib/services/analyticsService');
    
    mockDashboardService = new DashboardService();
    mockAnalyticsService = new AnalyticsService();
  });

  describe('GET /api/monitoring/dashboard', () => {
    it('should return overview dashboard data', async () => {
      const mockDashboardData = {
        timestamp: new Date(),
        systemStatus: 'healthy' as const,
        performance: {
          averageResponseTime: 1200,
          p95ResponseTime: 1800,
          requestsPerMinute: 25,
          errorRate: 1.5,
          trend: 'stable' as const
        },
        accuracy: {
          factRecallAccuracy: 88,
          contextContinuity: 92,
          hallucinationRate: 3,
          trend: 'up' as const
        },
        systemHealth: {
          databaseHealth: 'healthy' as const,
          apiHealth: 'healthy' as const,
          memoryUsage: 68,
          cpuUsage: 42,
          activeConnections: 25,
          cacheHitRate: 85
        },
        alerts: {
          critical: 0,
          high: 1,
          medium: 2,
          low: 1,
          recent: []
        },
        topAvatars: [],
        recentActivity: []
      };

      mockDashboardService.getDashboardData.mockResolvedValue(mockDashboardData);

      const request = new NextRequest('http://localhost:3000/api/monitoring/dashboard?type=overview');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.systemStatus).toBe('healthy');
      expect(data.performance.averageResponseTime).toBe(1200);
      expect(data.accuracy.factRecallAccuracy).toBe(88);
      expect(mockDashboardService.getDashboardData).toHaveBeenCalledTimes(1);
    });

    it('should return performance chart data', async () => {
      const mockChartData = {
        timestamps: [new Date(), new Date()],
        responseTime: [1200, 1300],
        requestVolume: [50, 60],
        errorRate: [1, 2],
        accuracy: [88, 90]
      };

      mockDashboardService.getPerformanceChartData.mockReturnValue(mockChartData);

      const request = new NextRequest('http://localhost:3000/api/monitoring/dashboard?type=performance&hours=24');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.timestamps).toHaveLength(2);
      expect(data.responseTime).toEqual([1200, 1300]);
      expect(mockDashboardService.getPerformanceChartData).toHaveBeenCalledWith(24);
    });

    it('should return system health checks', async () => {
      const mockHealthChecks = [
        {
          component: 'database',
          status: 'healthy' as const,
          responseTime: 120,
          lastCheck: new Date(),
          details: 'All systems operational'
        },
        {
          component: 'api',
          status: 'warning' as const,
          responseTime: 350,
          lastCheck: new Date(),
          details: 'Slightly elevated response times'
        }
      ];

      mockDashboardService.getSystemHealthChecks.mockResolvedValue(mockHealthChecks);

      const request = new NextRequest('http://localhost:3000/api/monitoring/dashboard?type=health');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(data[0].component).toBe('database');
      expect(data[1].status).toBe('warning');
    });

    it('should return analytics report', async () => {
      const mockAnalyticsReport = {
        performanceTrends: [
          { metric: 'Response Time', trend: 'improving' as const, changePercentage: -5, confidence: 0.8, timeframe: '1 days' }
        ],
        accuracyTrends: [
          { metric: 'Fact Recall', trend: 'stable' as const, changePercentage: 1, confidence: 0.3, timeframe: '1 days' }
        ],
        topAvatars: [],
        usagePatterns: [],
        factRecallAnalysis: {
          totalFactsStored: 1000,
          totalFactsRecalled: 850,
          recallAccuracy: 85,
          mostRecalledFactTypes: [],
          leastRecalledFactTypes: [],
          factAgeImpact: []
        },
        conversationFlowAnalysis: {
          averageConversationLength: 12,
          topicSwitchFrequency: 2.5,
          contextLossPoints: [],
          userEngagementScore: 4.1,
          dropOffPoints: []
        },
        recommendations: ['Optimize database queries for better performance']
      };

      mockAnalyticsService.generateAnalyticsReport.mockReturnValue(mockAnalyticsReport);

      const request = new NextRequest('http://localhost:3000/api/monitoring/dashboard?type=analytics&hours=168');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.performanceTrends).toHaveLength(1);
      expect(data.recommendations).toContain('Optimize database queries for better performance');
      expect(mockAnalyticsService.generateAnalyticsReport).toHaveBeenCalledWith(7); // 168 hours / 24
    });

    it('should return avatar comparison data', async () => {
      const mockComparisonData = [
        {
          avatarId: 'avatar-1',
          metrics: {
            responseTime: 1100,
            accuracy: 90,
            conversationCount: 25,
            userSatisfaction: 4.3
          }
        },
        {
          avatarId: 'avatar-2',
          metrics: {
            responseTime: 1300,
            accuracy: 85,
            conversationCount: 20,
            userSatisfaction: 4.1
          }
        }
      ];

      mockDashboardService.getAvatarComparisonData.mockReturnValue(mockComparisonData);

      const request = new NextRequest('http://localhost:3000/api/monitoring/dashboard?type=avatars&avatarIds=avatar-1,avatar-2&hours=24');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(data[0].avatarId).toBe('avatar-1');
      expect(data[1].metrics.accuracy).toBe(85);
      expect(mockDashboardService.getAvatarComparisonData).toHaveBeenCalledWith(['avatar-1', 'avatar-2'], 24);
    });

    it('should return avatar profiles when no specific avatars requested', async () => {
      const mockAvatarProfiles = [
        {
          avatarId: 'avatar-1',
          averageResponseTime: 1100,
          accuracyScore: 90,
          qualityScore: 88,
          conversationCount: 25,
          userSatisfaction: 4.3,
          strengths: ['Fast response times'],
          weaknesses: []
        }
      ];

      mockAnalyticsService.generateAvatarProfiles.mockReturnValue(mockAvatarProfiles);

      const request = new NextRequest('http://localhost:3000/api/monitoring/dashboard?type=avatars&hours=24');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(1);
      expect(data[0].avatarId).toBe('avatar-1');
      expect(data[0].strengths).toContain('Fast response times');
      expect(mockAnalyticsService.generateAvatarProfiles).toHaveBeenCalledWith(24);
    });

    it('should return usage patterns', async () => {
      const mockUsagePatterns = [
        { timeOfDay: 14, dayOfWeek: 1, requestCount: 75, averageResponseTime: 1200, userSatisfaction: 4.1 },
        { timeOfDay: 15, dayOfWeek: 1, requestCount: 60, averageResponseTime: 1150, userSatisfaction: 4.2 }
      ];

      mockAnalyticsService.analyzeUsagePatterns.mockReturnValue(mockUsagePatterns);

      const request = new NextRequest('http://localhost:3000/api/monitoring/dashboard?type=usage&hours=168');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(data[0].timeOfDay).toBe(14);
      expect(data[1].requestCount).toBe(60);
      expect(mockAnalyticsService.analyzeUsagePatterns).toHaveBeenCalledWith(7); // 168 hours / 24
    });

    it('should return heatmap data', async () => {
      const mockHeatmapData = [
        { hour: 9, day: 1, value: 50 },
        { hour: 14, day: 1, value: 75 },
        { hour: 10, day: 2, value: 60 }
      ];

      mockDashboardService.getUsageHeatmapData.mockReturnValue(mockHeatmapData);

      const request = new NextRequest('http://localhost:3000/api/monitoring/dashboard?type=heatmap&hours=720');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveLength(3);
      expect(data[0]).toEqual({ hour: 9, day: 1, value: 50 });
      expect(mockDashboardService.getUsageHeatmapData).toHaveBeenCalledWith(30); // 720 hours / 24
    });

    it('should export data as JSON', async () => {
      const mockExportData = {
        timestamp: new Date().toISOString(),
        systemStatus: 'healthy',
        performance: { averageResponseTime: 1200 }
      };

      mockDashboardService.exportDashboardData.mockReturnValue(JSON.stringify(mockExportData));

      const request = new NextRequest('http://localhost:3000/api/monitoring/dashboard?type=export&format=json');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.systemStatus).toBe('healthy');
      expect(mockDashboardService.exportDashboardData).toHaveBeenCalledWith('json');
    });

    it('should export data as CSV', async () => {
      const mockCsvData = 'Timestamp,System Status,Avg Response Time\n2024-01-01T00:00:00Z,healthy,1200';

      mockDashboardService.exportDashboardData.mockReturnValue(mockCsvData);

      const request = new NextRequest('http://localhost:3000/api/monitoring/dashboard?type=export&format=csv');
      const response = await GET(request);
      const text = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get('Content-Type')).toBe('text/csv');
      expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="dashboard-data.csv"');
      expect(text).toBe(mockCsvData);
      expect(mockDashboardService.exportDashboardData).toHaveBeenCalledWith('csv');
    });

    it('should return 400 for invalid dashboard type', async () => {
      const request = new NextRequest('http://localhost:3000/api/monitoring/dashboard?type=invalid');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid dashboard type');
    });

    it('should handle service errors gracefully', async () => {
      mockDashboardService.getDashboardData.mockRejectedValue(new Error('Service unavailable'));

      const request = new NextRequest('http://localhost:3000/api/monitoring/dashboard?type=overview');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });

  describe('POST /api/monitoring/dashboard', () => {
    it('should record performance metrics', async () => {
      const { monitoringService } = require('@/lib/services/monitoringService');
      monitoringService.recordPerformanceMetrics.mockImplementation(() => {});

      const performanceData = {
        responseTime: 800,
        contextRetrievalTime: 200,
        gpt5ProcessingTime: 500,
        memoryUpdateTime: 100,
        totalRequestTime: 1200,
        timestamp: new Date(),
        avatarId: 'avatar-1',
        requestId: 'req-1'
      };

      const request = new NextRequest('http://localhost:3000/api/monitoring/dashboard', {
        method: 'POST',
        body: JSON.stringify({
          type: 'performance',
          data: performanceData
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(monitoringService.recordPerformanceMetrics).toHaveBeenCalledWith(performanceData);
    });

    it('should record accuracy metrics', async () => {
      const { monitoringService } = require('@/lib/services/monitoringService');
      monitoringService.recordAccuracyMetrics.mockImplementation(() => {});

      const accuracyData = {
        factRecallAccuracy: 88,
        contextContinuityScore: 92,
        hallucinationRate: 3,
        factExtractionAccuracy: 85,
        conflictResolutionSuccess: 90,
        timestamp: new Date(),
        avatarId: 'avatar-1',
        conversationId: 'conv-1'
      };

      const request = new NextRequest('http://localhost:3000/api/monitoring/dashboard', {
        method: 'POST',
        body: JSON.stringify({
          type: 'accuracy',
          data: accuracyData
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(monitoringService.recordAccuracyMetrics).toHaveBeenCalledWith(accuracyData);
    });

    it('should record conversation quality metrics', async () => {
      const { monitoringService } = require('@/lib/services/monitoringService');
      monitoringService.recordConversationQuality.mockImplementation(() => {});

      const qualityData = {
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

      const request = new NextRequest('http://localhost:3000/api/monitoring/dashboard', {
        method: 'POST',
        body: JSON.stringify({
          type: 'quality',
          data: qualityData
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(monitoringService.recordConversationQuality).toHaveBeenCalledWith(qualityData);
    });

    it('should record system health metrics', async () => {
      const { monitoringService } = require('@/lib/services/monitoringService');
      monitoringService.recordSystemHealth.mockImplementation(() => {});

      const systemData = {
        databaseResponseTime: 120,
        apiResponseTime: 250,
        cacheHitRate: 88,
        errorRate: 1.5,
        activeConnections: 22,
        memoryUsage: 68,
        cpuUsage: 42,
        timestamp: new Date()
      };

      const request = new NextRequest('http://localhost:3000/api/monitoring/dashboard', {
        method: 'POST',
        body: JSON.stringify({
          type: 'system',
          data: systemData
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(monitoringService.recordSystemHealth).toHaveBeenCalledWith(systemData);
    });

    it('should resolve alerts', async () => {
      const { monitoringService } = require('@/lib/services/monitoringService');
      monitoringService.resolveAlert.mockReturnValue(true);

      const request = new NextRequest('http://localhost:3000/api/monitoring/dashboard', {
        method: 'POST',
        body: JSON.stringify({
          type: 'alert',
          data: { alertId: 'alert-123' }
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(monitoringService.resolveAlert).toHaveBeenCalledWith('alert-123');
    });

    it('should return false when alert resolution fails', async () => {
      const { monitoringService } = require('@/lib/services/monitoringService');
      monitoringService.resolveAlert.mockReturnValue(false);

      const request = new NextRequest('http://localhost:3000/api/monitoring/dashboard', {
        method: 'POST',
        body: JSON.stringify({
          type: 'alert',
          data: { alertId: 'non-existent-alert' }
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(false);
    });

    it('should return 400 for invalid monitoring type', async () => {
      const request = new NextRequest('http://localhost:3000/api/monitoring/dashboard', {
        method: 'POST',
        body: JSON.stringify({
          type: 'invalid',
          data: {}
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid monitoring type');
    });

    it('should handle POST errors gracefully', async () => {
      const { monitoringService } = require('@/lib/services/monitoringService');
      monitoringService.recordPerformanceMetrics.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const request = new NextRequest('http://localhost:3000/api/monitoring/dashboard', {
        method: 'POST',
        body: JSON.stringify({
          type: 'performance',
          data: { responseTime: 1000 }
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });
  });
});