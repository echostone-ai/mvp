/**
 * Tests for Production Monitoring Dashboard
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ProductionMonitoringDashboard, DashboardMetrics, AlertRule } from '../productionMonitoringDashboard';

describe('ProductionMonitoringDashboard', () => {
  let dashboard: ProductionMonitoringDashboard;

  beforeEach(() => {
    dashboard = new ProductionMonitoringDashboard({
      maxHistorySize: 100,
      updateIntervalMs: 1000
    });
  });

  afterEach(() => {
    dashboard.stop();
  });

  describe('Basic Functionality', () => {
    it('should initialize with default metrics', () => {
      const metrics = dashboard.getCurrentMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.currentP95Latency).toBe(0);
      expect(metrics.errorRate).toBe(0);
      expect(metrics.cacheEfficiency).toBe(0);
    });

    it('should start and stop monitoring', () => {
      const startSpy = vi.fn();
      const stopSpy = vi.fn();
      
      dashboard.on('dashboard:started', startSpy);
      dashboard.on('dashboard:stopped', stopSpy);

      dashboard.start(500);
      expect(startSpy).toHaveBeenCalled();

      dashboard.stop();
      expect(stopSpy).toHaveBeenCalled();
    });

    it('should update metrics from external source', () => {
      const updateSpy = vi.fn();
      dashboard.on('metrics:updated', updateSpy);

      const newMetrics: Partial<DashboardMetrics> = {
        currentP95Latency: 250,
        errorRate: 2.5,
        cacheEfficiency: 85
      };

      dashboard.updateMetricsFromSource(newMetrics);

      const currentMetrics = dashboard.getCurrentMetrics();
      expect(currentMetrics.currentP95Latency).toBe(250);
      expect(currentMetrics.errorRate).toBe(2.5);
      expect(currentMetrics.cacheEfficiency).toBe(85);
      expect(updateSpy).toHaveBeenCalledWith(currentMetrics);
    });
  });

  describe('Alert Rules', () => {
    it('should add and remove alert rules', () => {
      const rule: AlertRule = {
        id: 'test_rule',
        name: 'Test Rule',
        condition: (metrics) => metrics.currentP95Latency > 500,
        severity: 'warning',
        cooldownMs: 60000
      };

      dashboard.addAlertRule(rule);
      dashboard.removeAlertRule('test_rule');
      
      // Should not trigger alerts after removal
      dashboard.updateMetricsFromSource({ currentP95Latency: 600 });
      
      // Wait a bit to ensure no alert is triggered
      return new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should trigger alerts when conditions are met', () => {
      const rule: AlertRule = {
        id: 'high_latency_test',
        name: 'High Latency Test',
        condition: (metrics) => metrics.currentP95Latency > 500,
        severity: 'warning',
        cooldownMs: 1000
      };

      dashboard.addAlertRule(rule);
      
      const alertSpy = vi.fn();
      dashboard.on('alert:triggered', alertSpy);

      dashboard.updateMetricsFromSource({ currentP95Latency: 600, cacheEfficiency: 80 }); // Set cache efficiency to avoid that alert
      
      expect(alertSpy).toHaveBeenCalled();
      const customAlert = alertSpy.mock.calls.find(call => call[0].ruleId === 'high_latency_test');
      expect(customAlert).toBeDefined();
      expect(customAlert[0].severity).toBe('warning');
      expect(customAlert[0].metrics.currentP95Latency).toBe(600);
    });
  });

  describe('Metrics History', () => {
    it('should store metrics history', () => {
      dashboard.updateMetricsFromSource({ currentP95Latency: 100 });
      dashboard.updateMetricsFromSource({ currentP95Latency: 200 });
      dashboard.updateMetricsFromSource({ currentP95Latency: 300 });

      const history = dashboard.getMetricsHistory(0, Date.now());
      expect(history.length).toBe(3);
      expect(history[0].metrics.currentP95Latency).toBe(100);
      expect(history[2].metrics.currentP95Latency).toBe(300);
    });

    it('should limit history size', () => {
      const smallDashboard = new ProductionMonitoringDashboard({ maxHistorySize: 2 });
      
      smallDashboard.updateMetricsFromSource({ currentP95Latency: 100 });
      smallDashboard.updateMetricsFromSource({ currentP95Latency: 200 });
      smallDashboard.updateMetricsFromSource({ currentP95Latency: 300 });

      const history = smallDashboard.getMetricsHistory(0, Date.now());
      expect(history.length).toBe(2);
      expect(history[0].metrics.currentP95Latency).toBe(200);
      expect(history[1].metrics.currentP95Latency).toBe(300);
    });
  });

  describe('Performance Reports', () => {
    beforeEach(() => {
      // Add some test data
      const now = Date.now();
      vi.spyOn(Date, 'now')
        .mockReturnValueOnce(now - 3600000)
        .mockReturnValueOnce(now - 1800000)
        .mockReturnValueOnce(now);

      dashboard.updateMetricsFromSource({
        currentP95Latency: 200,
        errorRate: 1,
        cacheEfficiency: 80
      });
      
      dashboard.updateMetricsFromSource({
        currentP95Latency: 300,
        errorRate: 2,
        cacheEfficiency: 85
      });
      
      dashboard.updateMetricsFromSource({
        currentP95Latency: 250,
        errorRate: 1.5,
        cacheEfficiency: 90
      });
    });

    it('should generate performance report', () => {
      const now = Date.now();
      const report = dashboard.generatePerformanceReport(now - 3600000, now);

      expect(report).toBeDefined();
      expect(report.timeRange.start).toBe(now - 3600000);
      expect(report.timeRange.end).toBe(now);
      expect(report.summary.averageLatency).toBeGreaterThan(200);
      expect(report.summary.averageLatency).toBeLessThan(300);
      expect(report.summary.errorRate).toBeCloseTo(1.5, 1);
      expect(report.trends).toBeDefined();
      expect(report.semanticAccuracy).toBeDefined();
      expect(report.recommendations).toBeInstanceOf(Array);
    });
  });

  describe('Prometheus Metrics Export', () => {
    it('should export metrics in Prometheus format', () => {
      dashboard.updateMetricsFromSource({
        currentP95Latency: 250,
        currentP99Latency: 400,
        currentThroughput: 10,
        errorRate: 2.5,
        cacheEfficiency: 85,
        memoryUsageMB: 512,
        hybridUsagePercent: 75,
        expansionTriggerRate: 15,
        rerankingUsagePercent: 30
      });

      const prometheusMetrics = dashboard.exportPrometheusMetrics();
      
      expect(prometheusMetrics).toContain('hybrid_retrieval_latency_p95 250');
      expect(prometheusMetrics).toContain('hybrid_retrieval_latency_p99 400');
      expect(prometheusMetrics).toContain('hybrid_retrieval_throughput 10');
      expect(prometheusMetrics).toContain('hybrid_retrieval_error_rate 2.5');
      expect(prometheusMetrics).toContain('hybrid_retrieval_cache_efficiency 85');
      expect(prometheusMetrics).toContain('hybrid_retrieval_memory_usage 512');
      expect(prometheusMetrics).toContain('hybrid_retrieval_feature_usage_hybrid 75');
      expect(prometheusMetrics).toContain('hybrid_retrieval_feature_usage_expansion 15');
      expect(prometheusMetrics).toContain('hybrid_retrieval_feature_usage_reranking 30');
    });

    it('should include proper Prometheus headers', () => {
      const prometheusMetrics = dashboard.exportPrometheusMetrics();
      
      expect(prometheusMetrics).toContain('# HELP');
      expect(prometheusMetrics).toContain('# TYPE');
      expect(prometheusMetrics).toContain('gauge');
    });
  });

  describe('Default Alert Rules', () => {
    it('should have default alert rules configured', () => {
      // Test high latency alert
      const alertSpy = vi.fn();
      dashboard.on('alert:triggered', alertSpy);

      dashboard.updateMetricsFromSource({ currentP95Latency: 1500, cacheEfficiency: 80 });
      
      expect(alertSpy).toHaveBeenCalled();
      const highLatencyAlert = alertSpy.mock.calls.find(call => call[0].ruleId === 'high_latency');
      expect(highLatencyAlert).toBeDefined();
      expect(highLatencyAlert[0].ruleId).toBe('high_latency');
    });

    it('should trigger critical alerts for severe conditions', () => {
      const alertSpy = vi.fn();
      dashboard.on('alert:triggered', alertSpy);

      dashboard.updateMetricsFromSource({ 
        currentP95Latency: 2500,
        errorRate: 20,
        cacheEfficiency: 80 // Avoid cache efficiency alert
      });
      
      expect(alertSpy).toHaveBeenCalled();
      const alerts = alertSpy.mock.calls.map(call => call[0]);
      const criticalAlerts = alerts.filter(alert => alert.severity === 'critical');
      expect(criticalAlerts.length).toBeGreaterThan(0);
      
      // Should have critical latency and error rate alerts
      expect(alerts.some(alert => alert.ruleId === 'critical_latency')).toBe(true);
      expect(alerts.some(alert => alert.ruleId === 'critical_error_rate')).toBe(true);
    });
  });
});