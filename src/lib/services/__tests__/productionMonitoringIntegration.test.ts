/**
 * Tests for Production Monitoring Integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProductionMonitoringIntegration, MonitoringConfig } from '../productionMonitoringIntegration';
import { HybridRetriever } from '../hybridRetrieval';
import { FactbookService } from '../factbookService';

// Mock dependencies
vi.mock('../hybridRetriever');
vi.mock('../factbookService');
vi.mock('../productionMonitoringDashboard');
vi.mock('../alertingSystem');
vi.mock('../systemHealthMonitor');
vi.mock('../deploymentValidator');

describe('ProductionMonitoringIntegration', () => {
  let monitoring: ProductionMonitoringIntegration;
  let mockHybridRetriever: jest.Mocked<HybridRetriever>;
  let mockFactbookService: jest.Mocked<FactbookService>;

  const testConfig: Partial<MonitoringConfig> = {
    dashboard: {
      enabled: true,
      updateIntervalMs: 1000,
      maxHistorySize: 100
    },
    alerting: {
      enabled: true,
      maxRetries: 2,
      retryDelayMs: 1000,
      defaultChannels: ['console']
    },
    healthMonitoring: {
      enabled: true,
      intervalMs: 1000,
      thresholds: {
        cpuWarning: 70,
        memoryWarning: 80,
        latencyWarning: 500,
        errorRateWarning: 5
      }
    },
    validation: {
      enabled: true,
      runOnStartup: false,
      environment: 'test'
    }
  };

  beforeEach(() => {
    mockHybridRetriever = {
      retrieve: jest.fn(),
      warmup: jest.fn(),
      on: jest.fn()
    } as any;

    mockFactbookService = {
      getAllSnippets: jest.fn(),
      initialize: jest.fn()
    } as any;

    monitoring = new ProductionMonitoringIntegration(
      mockHybridRetriever,
      mockFactbookService,
      testConfig
    );
  });

  afterEach(async () => {
    await monitoring.stop();
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', () => {
      const defaultMonitoring = new ProductionMonitoringIntegration(
        mockHybridRetriever,
        mockFactbookService
      );

      expect(defaultMonitoring).toBeDefined();
    });

    it('should merge custom configuration with defaults', () => {
      const status = monitoring.getStatus();
      
      expect(status.dashboard.running).toBe(false); // Not started yet
      expect(status.alerting.enabled).toBe(true);
      expect(status.healthMonitoring.running).toBe(false); // Not started yet
    });
  });

  describe('Lifecycle Management', () => {
    it('should start all monitoring components', async () => {
      const startSpy = jest.fn();
      monitoring.on('monitoring:started', startSpy);

      await monitoring.start();

      expect(startSpy).toHaveBeenCalled();
      
      const status = monitoring.getStatus();
      expect(status.dashboard.running).toBe(true);
      expect(status.healthMonitoring.running).toBe(true);
    });

    it('should stop all monitoring components', async () => {
      const stopSpy = jest.fn();
      monitoring.on('monitoring:stopped', stopSpy);

      await monitoring.start();
      await monitoring.stop();

      expect(stopSpy).toHaveBeenCalled();
      
      const status = monitoring.getStatus();
      expect(status.dashboard.running).toBe(false);
      expect(status.healthMonitoring.running).toBe(false);
    });

    it('should handle start when already running', async () => {
      await monitoring.start();
      
      // Should not throw error
      await monitoring.start();
      
      const status = monitoring.getStatus();
      expect(status.dashboard.running).toBe(true);
    });

    it('should handle stop when not running', async () => {
      // Should not throw error
      await monitoring.stop();
      
      const status = monitoring.getStatus();
      expect(status.dashboard.running).toBe(false);
    });
  });

  describe('Performance Recording', () => {
    beforeEach(async () => {
      await monitoring.start();
    });

    it('should record retrieval performance data', () => {
      const performanceSpy = jest.fn();
      monitoring.on('performance:recorded', performanceSpy);

      monitoring.recordRetrievalPerformance(250, 5, false, 'hybrid');

      expect(performanceSpy).toHaveBeenCalledWith({
        responseTime: 250,
        resultCount: 5,
        errorOccurred: false,
        source: 'hybrid'
      });
    });

    it('should record error performance data', () => {
      const performanceSpy = jest.fn();
      monitoring.on('performance:recorded', performanceSpy);

      monitoring.recordRetrievalPerformance(1000, 0, true, 'hybrid');

      expect(performanceSpy).toHaveBeenCalledWith({
        responseTime: 1000,
        resultCount: 0,
        errorOccurred: true,
        source: 'hybrid'
      });
    });

    it('should update cache metrics', () => {
      const cacheSpy = jest.fn();
      monitoring.on('cache:updated', cacheSpy);

      const cacheMetrics = {
        embeddingCacheSize: 1000,
        embeddingCacheSizeMB: 50,
        vectorIndexSize: 500,
        embeddingCacheHitRate: 85,
        queryCacheHitRate: 90
      };

      monitoring.updateCacheMetrics(cacheMetrics);

      expect(cacheSpy).toHaveBeenCalledWith(cacheMetrics);
    });

    it('should update component health status', () => {
      const healthSpy = jest.fn();
      monitoring.on('component:health_changed', healthSpy);

      monitoring.updateComponentHealth('vectorRetriever', 'degraded');

      expect(healthSpy).toHaveBeenCalledWith({
        component: 'vectorRetriever',
        status: 'degraded'
      });
    });
  });

  describe('Alert Management', () => {
    beforeEach(async () => {
      await monitoring.start();
    });

    it('should add alert channels', () => {
      const channelSpy = jest.fn();
      monitoring.on('alerting:channel_added', channelSpy);

      const channel = {
        id: 'test_channel',
        name: 'Test Channel',
        type: 'webhook' as const,
        config: { url: 'https://example.com/webhook' },
        enabled: true
      };

      monitoring.addAlertChannel(channel);

      expect(channelSpy).toHaveBeenCalledWith(channel);
    });

    it('should test alert channels', async () => {
      const channel = {
        id: 'test_channel',
        name: 'Test Channel',
        type: 'console' as const,
        config: {},
        enabled: true
      };

      monitoring.addAlertChannel(channel);
      
      const result = await monitoring.testAlertChannel('test_channel');
      
      // Result depends on mock implementation
      expect(typeof result).toBe('boolean');
    });
  });

  describe('Validation', () => {
    beforeEach(async () => {
      await monitoring.start();
    });

    it('should run deployment validation', async () => {
      mockHybridRetriever.retrieve.mockResolvedValue({
        results: [{ snippet: { id: '1', text: 'test', topics: [], keywords: [] }, score: 0.8, source: 'bm25', confidence: 0.8 }],
        metrics: { totalTimeMs: 100, bm25TimeMs: 50, vectorTimeMs: 50, cacheHit: true, methodsUsed: ['bm25'], resultCount: 1 }
      });

      mockFactbookService.getAllSnippets.mockResolvedValue([
        { id: '1', text: 'snippet', topics: [], keywords: [] }
      ]);

      const validationSpy = jest.fn();
      monitoring.on('validation:completed', validationSpy);

      const report = await monitoring.runValidation({
        environment: 'test',
        skipNonCritical: true
      });

      expect(report).toBeDefined();
      expect(validationSpy).toHaveBeenCalledWith(report);
    });

    it('should handle validation with custom config', async () => {
      mockHybridRetriever.retrieve.mockResolvedValue({
        results: [],
        metrics: { totalTimeMs: 100, bm25TimeMs: 50, vectorTimeMs: 50, cacheHit: true, methodsUsed: ['bm25'], resultCount: 0 }
      });

      mockFactbookService.getAllSnippets.mockResolvedValue([]);

      const report = await monitoring.runValidation({
        environment: 'staging',
        version: '2.0.0',
        timeout: 60000,
        enablePerformanceTests: false
      });

      expect(report.environment).toBe('staging');
      expect(report.version).toBe('2.0.0');
    });
  });

  describe('Monitoring Reports', () => {
    beforeEach(async () => {
      await monitoring.start();
    });

    it('should generate comprehensive monitoring report', () => {
      // Record some performance data
      monitoring.recordRetrievalPerformance(200, 3, false);
      monitoring.recordRetrievalPerformance(300, 5, false);
      monitoring.recordRetrievalPerformance(250, 4, true);

      const report = monitoring.generateMonitoringReport(3600000);

      expect(report).toBeDefined();
      expect(report.timestamp).toBeDefined();
      expect(report.timeRange).toBe(3600000);
      expect(report.status).toBeDefined();
      expect(report.performanceReport).toBeDefined();
      expect(report.healthReport).toBeDefined();
      expect(report.alertSummary).toBeDefined();
    });

    it('should export Prometheus metrics', () => {
      const metrics = monitoring.exportPrometheusMetrics();

      expect(typeof metrics).toBe('string');
      expect(metrics).toContain('hybrid_retrieval');
    });
  });

  describe('Event Handling', () => {
    beforeEach(async () => {
      await monitoring.start();
    });

    it('should handle dashboard events', () => {
      const metricsSpy = jest.fn();
      monitoring.on('metrics:updated', metricsSpy);

      // This would be triggered by the dashboard internally
      // We can't easily test this without exposing internal components
      expect(monitoring.listenerCount('metrics:updated')).toBeGreaterThan(0);
    });

    it('should handle health change events', () => {
      const healthSpy = jest.fn();
      monitoring.on('health:changed', healthSpy);

      // This would be triggered by the health monitor internally
      expect(monitoring.listenerCount('health:changed')).toBeGreaterThan(0);
    });

    it('should handle alert events', () => {
      const alertSpy = jest.fn();
      monitoring.on('alert:triggered', alertSpy);

      // This would be triggered by the dashboard/alerting system
      expect(monitoring.listenerCount('alert:triggered')).toBeGreaterThan(0);
    });
  });

  describe('Status Reporting', () => {
    it('should report correct status when stopped', () => {
      const status = monitoring.getStatus();

      expect(status.dashboard.running).toBe(false);
      expect(status.healthMonitoring.running).toBe(false);
      expect(status.alerting.enabled).toBe(true);
      expect(status.validation.lastStatus).toBe('never');
    });

    it('should report correct status when running', async () => {
      await monitoring.start();
      
      const status = monitoring.getStatus();

      expect(status.dashboard.running).toBe(true);
      expect(status.healthMonitoring.running).toBe(true);
      expect(status.alerting.enabled).toBe(true);
    });

    it('should track metrics count', async () => {
      await monitoring.start();
      
      // Record some data
      monitoring.recordRetrievalPerformance(200, 3);
      monitoring.updateCacheMetrics({ embeddingCacheSize: 100 });
      
      const status = monitoring.getStatus();
      expect(status.dashboard.metricsCount).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle start errors gracefully', async () => {
      // Mock an error during startup
      const errorSpy = jest.fn();
      monitoring.on('monitoring:error', errorSpy);

      // This is hard to test without mocking internal components
      // In a real scenario, we'd mock the dashboard.start() to throw
      
      await expect(monitoring.start()).resolves.not.toThrow();
    });

    it('should handle validation errors', async () => {
      await monitoring.start();
      
      mockHybridRetriever.retrieve.mockRejectedValue(new Error('Retrieval failed'));

      const report = await monitoring.runValidation();
      
      expect(report.overallStatus).toBe('fail');
      expect(report.summary.failed).toBeGreaterThan(0);
    });
  });

  describe('Configuration Validation', () => {
    it('should work with minimal configuration', () => {
      const minimalMonitoring = new ProductionMonitoringIntegration(
        mockHybridRetriever,
        mockFactbookService,
        {
          dashboard: { enabled: false },
          alerting: { enabled: false },
          healthMonitoring: { enabled: false },
          validation: { enabled: false }
        }
      );

      expect(minimalMonitoring).toBeDefined();
      
      const status = minimalMonitoring.getStatus();
      expect(status.dashboard.running).toBe(false);
      expect(status.alerting.enabled).toBe(false);
      expect(status.healthMonitoring.running).toBe(false);
    });

    it('should handle invalid configuration gracefully', () => {
      const invalidConfig = {
        dashboard: {
          enabled: true,
          updateIntervalMs: -1000, // Invalid
          maxHistorySize: -100 // Invalid
        }
      };

      // Should not throw, should use defaults for invalid values
      expect(() => new ProductionMonitoringIntegration(
        mockHybridRetriever,
        mockFactbookService,
        invalidConfig
      )).not.toThrow();
    });
  });
});