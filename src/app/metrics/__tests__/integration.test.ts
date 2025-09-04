/**
 * Integration tests for monitoring dashboard
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { metricsCollector } from '@/lib/services/metricsCollector';
import { factbookService } from '@/lib/services/factbookService';

// Mock factbook service
vi.mock('@/lib/services/factbookService', () => ({
  factbookService: {
    getInstance: vi.fn(() => ({
      isLoaded: vi.fn().mockReturnValue(true),
      getSnippetCount: vi.fn().mockReturnValue(25),
      getIndexSizeBytes: vi.fn().mockReturnValue(8192),
      rebuildIndex: vi.fn().mockResolvedValue(true),
      validateIndex: vi.fn().mockReturnValue(true)
    }))
  }
}));

describe('Monitoring Dashboard Integration', () => {
  beforeEach(() => {
    metricsCollector.clear();
    vi.clearAllMocks();
  });

  it('should collect and display complete metrics pipeline', async () => {
    // Simulate chat metrics collection
    const chatMetrics = [
      {
        trace_id: 'test-1',
        timestamp: Date.now(),
        t_hook_ms: 250,
        t_deep_first_ms: 400,
        t_deep_done_ms: 800,
        snippets_selected: ['pets.olive', 'relationships.tyler'],
        intent: 'factual',
        deep_merge: true,
        overlap_percentage: 15
      },
      {
        trace_id: 'test-2',
        timestamp: Date.now(),
        t_hook_ms: 280,
        t_deep_done_ms: 950,
        snippets_selected: ['places.austin'],
        intent: 'story',
        deep_merge: true,
        overlap_percentage: 8
      }
    ];

    // Record metrics
    chatMetrics.forEach(metrics => {
      metricsCollector.recordChatMetrics(metrics);
    });

    // Update factbook health
    metricsCollector.updateFactbookHealth({
      is_loaded: true,
      snippet_count: 25,
      index_size_bytes: 8192,
      validation_errors: [],
      memory_usage_mb: 64,
      corruption_detected: false
    });

    // Verify metrics collection
    const recentMetrics = metricsCollector.getRecentChatMetrics(10);
    expect(recentMetrics).toHaveLength(2);
    expect(recentMetrics[0].trace_id).toBe('test-1');
    expect(recentMetrics[1].trace_id).toBe('test-2');

    // Verify SLA calculations
    const slaMetrics = metricsCollector.getSLAMetrics();
    expect(slaMetrics.hook_sla_compliance).toBe(100); // Both under 300ms
    expect(slaMetrics.deep_sla_compliance).toBe(100); // Both under 1000ms
    expect(slaMetrics.total_requests).toBe(2);

    // Verify factbook health
    const factbookHealth = metricsCollector.getFactbookHealth();
    expect(factbookHealth).toBeTruthy();
    expect(factbookHealth!.is_loaded).toBe(true);
    expect(factbookHealth!.snippet_count).toBe(25);
    expect(factbookHealth!.corruption_detected).toBe(false);

    // Verify system metrics
    const systemMetrics = metricsCollector.getSystemMetrics();
    expect(systemMetrics).toBeTruthy();
    expect(systemMetrics!.memory_usage_mb).toBeGreaterThan(0);
    expect(systemMetrics!.uptime_seconds).toBeGreaterThan(0);
  });

  it('should handle SLA violations correctly', () => {
    // Record metrics with SLA violations
    const violatingMetrics = [
      {
        trace_id: 'slow-1',
        timestamp: Date.now(),
        t_hook_ms: 350, // Violates 300ms SLA
        t_deep_done_ms: 1200, // Violates 1000ms SLA
        snippets_selected: ['pets.olive']
      },
      {
        trace_id: 'fast-1',
        timestamp: Date.now(),
        t_hook_ms: 200, // Compliant
        t_deep_done_ms: 800, // Compliant
        snippets_selected: ['places.austin']
      }
    ];

    violatingMetrics.forEach(metrics => {
      metricsCollector.recordChatMetrics(metrics);
    });

    const slaMetrics = metricsCollector.getSLAMetrics();
    
    // Hook SLA: 1/2 = 50%
    expect(slaMetrics.hook_sla_compliance).toBe(50);
    
    // Deep SLA: 1/2 = 50%
    expect(slaMetrics.deep_sla_compliance).toBe(50);
    
    expect(slaMetrics.total_requests).toBe(2);
  });

  it('should track factbook corruption detection', () => {
    // Simulate corruption detection
    metricsCollector.updateFactbookHealth({
      is_loaded: true,
      snippet_count: 25,
      index_size_bytes: 8192,
      validation_errors: ['Index validation failed', 'Snippet text too long'],
      memory_usage_mb: 64,
      corruption_detected: true
    });

    const factbookHealth = metricsCollector.getFactbookHealth();
    expect(factbookHealth!.corruption_detected).toBe(true);
    expect(factbookHealth!.validation_errors).toHaveLength(2);
    expect(factbookHealth!.validation_errors).toContain('Index validation failed');
  });

  it('should provide memory usage monitoring', () => {
    // Mock process.memoryUsage for consistent testing
    const mockMemoryUsage = vi.spyOn(process, 'memoryUsage').mockReturnValue({
      rss: 256 * 1024 * 1024, // 256MB
      heapUsed: 128 * 1024 * 1024, // 128MB
      heapTotal: 192 * 1024 * 1024, // 192MB
      external: 0,
      arrayBuffers: 0
    });

    const systemMetrics = metricsCollector.getSystemMetrics();
    
    expect(systemMetrics!.memory_usage_mb).toBe(256);
    expect(systemMetrics!.heap_used_mb).toBe(128);
    expect(systemMetrics!.heap_total_mb).toBe(192);

    mockMemoryUsage.mockRestore();
  });

  it('should handle high-volume metrics collection', () => {
    // Simulate high volume of metrics (more than MAX_CHAT_METRICS)
    for (let i = 0; i < 150; i++) {
      metricsCollector.recordChatMetrics({
        trace_id: `bulk-${i}`,
        timestamp: Date.now(),
        t_hook_ms: 200 + (i % 100), // Vary timing
        snippets_selected: [`snippet-${i % 5}`]
      });
    }

    // Should be capped at 100 metrics
    const allMetrics = metricsCollector.getRecentChatMetrics(200);
    expect(allMetrics).toHaveLength(100);
    
    // Should keep the most recent ones
    expect(allMetrics[0].trace_id).toBe('bulk-50'); // First kept
    expect(allMetrics[99].trace_id).toBe('bulk-149'); // Last
    
    // SLA should calculate correctly (uses last 50 metrics)
    const slaMetrics = metricsCollector.getSLAMetrics();
    expect(slaMetrics.total_requests).toBe(50);
  });
});