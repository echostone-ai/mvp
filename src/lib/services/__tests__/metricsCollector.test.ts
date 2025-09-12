/**
 * Tests for MetricsCollector - Centralized metrics collection and storage
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { metricsCollector, ChatMetrics } from '../metricsCollector';

describe('MetricsCollector', () => {
  beforeEach(() => {
    metricsCollector.clear();
  });

  describe('Chat Metrics', () => {
    it('should record and retrieve chat metrics', () => {
      const metrics: ChatMetrics = {
        trace_id: 'test-123',
        timestamp: Date.now(),
        t_hook_ms: 250,
        t_deep_first_ms: 400,
        t_deep_done_ms: 800,
        snippets_selected: ['pets.olive', 'relationships.tyler'],
        intent: 'factual',
        deep_merge: true
      };

      metricsCollector.recordChatMetrics(metrics);
      const recent = metricsCollector.getRecentChatMetrics(1);

      expect(recent).toHaveLength(1);
      expect(recent[0].trace_id).toBe('test-123');
      expect(recent[0].t_hook_ms).toBe(250);
      expect(recent[0].snippets_selected).toEqual(['pets.olive', 'relationships.tyler']);
    });

    it('should limit chat metrics to MAX_CHAT_METRICS', () => {
      // Record 150 metrics (more than MAX_CHAT_METRICS = 100)
      for (let i = 0; i < 150; i++) {
        metricsCollector.recordChatMetrics({
          trace_id: `test-${i}`,
          timestamp: Date.now(),
          t_hook_ms: 200 + i,
          snippets_selected: []
        });
      }

      const all = metricsCollector.getRecentChatMetrics(200);
      expect(all).toHaveLength(100); // Should be capped at 100
      
      // Should keep the most recent ones
      expect(all[0].trace_id).toBe('test-50'); // First kept metric
      expect(all[99].trace_id).toBe('test-149'); // Last metric
    });

    it('should return requested number of recent metrics', () => {
      // Record 10 metrics
      for (let i = 0; i < 10; i++) {
        metricsCollector.recordChatMetrics({
          trace_id: `test-${i}`,
          timestamp: Date.now(),
          t_hook_ms: 200,
          snippets_selected: []
        });
      }

      const recent5 = metricsCollector.getRecentChatMetrics(5);
      expect(recent5).toHaveLength(5);
      expect(recent5[0].trace_id).toBe('test-5'); // Most recent 5
      expect(recent5[4].trace_id).toBe('test-9');
    });
  });

  describe('SLA Metrics', () => {
    it('should calculate SLA compliance correctly', () => {
      // Record metrics with mixed SLA compliance
      const testMetrics = [
        { t_hook_ms: 250, t_deep_done_ms: 800 }, // Both compliant
        { t_hook_ms: 350, t_deep_done_ms: 1200 }, // Both non-compliant
        { t_hook_ms: 200, t_deep_done_ms: 900 }, // Both compliant
        { t_hook_ms: 280, t_deep_done_ms: undefined }, // Hook compliant, no deep
      ];

      testMetrics.forEach((metrics, i) => {
        metricsCollector.recordChatMetrics({
          trace_id: `test-${i}`,
          timestamp: Date.now(),
          t_hook_ms: metrics.t_hook_ms,
          t_deep_done_ms: metrics.t_deep_done_ms,
          snippets_selected: []
        });
      });

      const sla = metricsCollector.getSLAMetrics();
      
      // Hook SLA: 3/4 = 75%
      expect(sla.hook_sla_compliance).toBe(75);
      
      // Deep SLA: 3/4 = 75% (all metrics are considered, undefined counts as compliant)
      expect(sla.deep_sla_compliance).toBe(75);
      
      // Average hook: (250 + 350 + 200 + 280) / 4 = 270
      expect(sla.avg_hook_ms).toBe(270);
      
      // Average deep: (800 + 1200 + 900) / 3 = 967 (rounded)
      expect(sla.avg_deep_ms).toBe(967);
      
      expect(sla.total_requests).toBe(4);
    });

    it('should handle empty metrics gracefully', () => {
      const sla = metricsCollector.getSLAMetrics();
      
      expect(sla.hook_sla_compliance).toBe(100);
      expect(sla.deep_sla_compliance).toBe(100);
      expect(sla.avg_hook_ms).toBe(0);
      expect(sla.avg_deep_ms).toBe(0);
      expect(sla.total_requests).toBe(0);
    });
  });

  describe('Factbook Health', () => {
    it('should update and retrieve factbook health', () => {
      const health = {
        is_loaded: true,
        snippet_count: 25,
        index_size_bytes: 8192,
        validation_errors: [],
        memory_usage_mb: 64,
        corruption_detected: false
      };

      metricsCollector.updateFactbookHealth(health);
      const retrieved = metricsCollector.getFactbookHealth();

      expect(retrieved).toBeTruthy();
      expect(retrieved!.is_loaded).toBe(true);
      expect(retrieved!.snippet_count).toBe(25);
      expect(retrieved!.index_size_bytes).toBe(8192);
      expect(retrieved!.corruption_detected).toBe(false);
      expect(retrieved!.timestamp).toBeGreaterThan(0);
    });

    it('should handle validation errors', () => {
      const health = {
        is_loaded: false,
        snippet_count: 0,
        index_size_bytes: 0,
        validation_errors: ['Invalid JSON structure', 'Missing required fields'],
        memory_usage_mb: 32,
        corruption_detected: true
      };

      metricsCollector.updateFactbookHealth(health);
      const retrieved = metricsCollector.getFactbookHealth();

      expect(retrieved!.validation_errors).toEqual(['Invalid JSON structure', 'Missing required fields']);
      expect(retrieved!.corruption_detected).toBe(true);
    });
  });

  describe('System Metrics', () => {
    it('should update and retrieve system metrics', () => {
      // Mock process.memoryUsage and process.uptime
      const mockMemoryUsage = vi.spyOn(process, 'memoryUsage').mockReturnValue({
        rss: 128 * 1024 * 1024, // 128MB
        heapUsed: 64 * 1024 * 1024, // 64MB
        heapTotal: 96 * 1024 * 1024, // 96MB
        external: 0,
        arrayBuffers: 0
      });

      const mockUptime = vi.spyOn(process, 'uptime').mockReturnValue(3661); // 1h 1m 1s

      const metrics = metricsCollector.getSystemMetrics();

      expect(metrics).toBeTruthy();
      expect(metrics!.memory_usage_mb).toBe(128);
      expect(metrics!.heap_used_mb).toBe(64);
      expect(metrics!.heap_total_mb).toBe(96);
      expect(metrics!.uptime_seconds).toBe(3661);
      expect(metrics!.timestamp).toBeGreaterThan(0);

      mockMemoryUsage.mockRestore();
      mockUptime.mockRestore();
    });
  });

  describe('Console Logging', () => {
    it('should log chat_metrics in single-line format', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const metrics: ChatMetrics = {
        trace_id: 'test-log',
        timestamp: Date.now(),
        t_hook_ms: 280,
        t_deep_first_ms: 450,
        t_deep_done_ms: 920,
        snippets_selected: ['pets.olive', 'places.austin'],
        overlap_percentage: 15
      };

      metricsCollector.recordChatMetrics(metrics);

      expect(consoleSpy).toHaveBeenCalledWith('chat_metrics', {
        trace_id: 'test-log',
        hook_ms: 280,
        deep_first_ms: 450,
        deep_done_ms: 920,
        snippets: 2,
        overlap: 15
      });

      consoleSpy.mockRestore();
    });

    it('should handle missing optional fields in logging', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const metrics: ChatMetrics = {
        trace_id: 'test-minimal',
        timestamp: Date.now(),
        t_hook_ms: 250,
        snippets_selected: ['pets.olive']
      };

      metricsCollector.recordChatMetrics(metrics);

      expect(consoleSpy).toHaveBeenCalledWith('chat_metrics', {
        trace_id: 'test-minimal',
        hook_ms: 250,
        deep_first_ms: 0,
        deep_done_ms: 0,
        snippets: 1,
        overlap: 0
      });

      consoleSpy.mockRestore();
    });
  });
});