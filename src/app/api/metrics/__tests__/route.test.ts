/**
 * Tests for Metrics API - Live metrics data endpoint
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET, POST } from '../route';
import { metricsCollector } from '@/lib/services/metricsCollector';
import { factbookService } from '@/lib/services/factbookService';

// Mock the services
vi.mock('@/lib/services/metricsCollector', () => ({
  metricsCollector: {
    getRecentChatMetrics: vi.fn(),
    getFactbookHealth: vi.fn(),
    getSystemMetrics: vi.fn(),
    getSLAMetrics: vi.fn(),
    updateFactbookHealth: vi.fn()
  }
}));

vi.mock('@/lib/services/factbookService', () => ({
  factbookService: {
    getInstance: vi.fn(() => ({
      isLoaded: vi.fn(),
      getSnippetCount: vi.fn(),
      getIndexSizeBytes: vi.fn(),
      rebuildIndex: vi.fn(),
      validateIndex: vi.fn()
    }))
  }
}));

describe('Metrics API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/metrics', () => {
    it('should return complete metrics data', async () => {
      const mockChatMetrics = [
        {
          trace_id: 'test-1',
          timestamp: Date.now(),
          t_hook_ms: 250,
          t_deep_done_ms: 800,
          snippets_selected: ['pets.olive'],
          intent: 'factual'
        }
      ];

      const mockFactbookHealth = {
        timestamp: Date.now(),
        is_loaded: true,
        snippet_count: 25,
        index_size_bytes: 8192,
        validation_errors: [],
        memory_usage_mb: 64,
        corruption_detected: false
      };

      const mockSystemMetrics = {
        timestamp: Date.now(),
        memory_usage_mb: 128,
        heap_used_mb: 64,
        heap_total_mb: 96,
        uptime_seconds: 3600,
        active_connections: 5
      };

      const mockSLAMetrics = {
        hook_sla_compliance: 95,
        deep_sla_compliance: 90,
        avg_hook_ms: 280,
        avg_deep_ms: 850,
        total_requests: 20
      };

      vi.mocked(metricsCollector.getRecentChatMetrics).mockReturnValue(mockChatMetrics);
      vi.mocked(metricsCollector.getFactbookHealth).mockReturnValue(mockFactbookHealth);
      vi.mocked(metricsCollector.getSystemMetrics).mockReturnValue(mockSystemMetrics);
      vi.mocked(metricsCollector.getSLAMetrics).mockReturnValue(mockSLAMetrics);

      const request = new Request('http://localhost/api/metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.chat_metrics).toEqual(mockChatMetrics);
      expect(data.factbook_health).toEqual(mockFactbookHealth);
      expect(data.system_metrics).toEqual(mockSystemMetrics);
      expect(data.sla_metrics).toEqual(mockSLAMetrics);
      expect(data.timestamp).toBeGreaterThan(0);
    });

    it('should handle count parameter', async () => {
      vi.mocked(metricsCollector.getRecentChatMetrics).mockReturnValue([]);
      vi.mocked(metricsCollector.getFactbookHealth).mockReturnValue(null);
      vi.mocked(metricsCollector.getSystemMetrics).mockReturnValue(null);
      vi.mocked(metricsCollector.getSLAMetrics).mockReturnValue({
        hook_sla_compliance: 100,
        deep_sla_compliance: 100,
        avg_hook_ms: 0,
        avg_deep_ms: 0,
        total_requests: 0
      });

      const request = new Request('http://localhost/api/metrics?count=50');
      await GET(request);

      expect(metricsCollector.getRecentChatMetrics).toHaveBeenCalledWith(50);
    });

    it('should create factbook health if not available', async () => {
      const mockFactbook = {
        isLoaded: vi.fn().mockReturnValue(true),
        getSnippetCount: vi.fn().mockReturnValue(30),
        getIndexSizeBytes: vi.fn().mockReturnValue(10240)
      };

      vi.mocked(factbookService.getInstance).mockReturnValue(mockFactbook as any);
      vi.mocked(metricsCollector.getRecentChatMetrics).mockReturnValue([]);
      vi.mocked(metricsCollector.getFactbookHealth).mockReturnValue(null);
      vi.mocked(metricsCollector.getSystemMetrics).mockReturnValue(null);
      vi.mocked(metricsCollector.getSLAMetrics).mockReturnValue({
        hook_sla_compliance: 100,
        deep_sla_compliance: 100,
        avg_hook_ms: 0,
        avg_deep_ms: 0,
        total_requests: 0
      });

      const request = new Request('http://localhost/api/metrics');
      const response = await GET(request);
      const data = await response.json();

      expect(data.factbook_health.is_loaded).toBe(true);
      expect(data.factbook_health.snippet_count).toBe(30);
      expect(data.factbook_health.index_size_bytes).toBe(10240);
      expect(metricsCollector.updateFactbookHealth).toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(metricsCollector.getRecentChatMetrics).mockImplementation(() => {
        throw new Error('Database error');
      });

      const request = new Request('http://localhost/api/metrics');
      const response = await GET(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to fetch metrics');
    });
  });

  describe('POST /api/metrics', () => {
    it('should rebuild index successfully', async () => {
      const mockFactbook = {
        rebuildIndex: vi.fn().mockResolvedValue(true),
        getSnippetCount: vi.fn().mockReturnValue(25),
        getIndexSizeBytes: vi.fn().mockReturnValue(8192)
      };

      vi.mocked(factbookService.getInstance).mockReturnValue(mockFactbook as any);

      const request = new Request('http://localhost/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rebuild_index' })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.snippet_count).toBe(25);
      expect(data.rebuild_time_ms).toBeGreaterThanOrEqual(0);
      expect(mockFactbook.rebuildIndex).toHaveBeenCalled();
      expect(metricsCollector.updateFactbookHealth).toHaveBeenCalled();
    });

    it('should handle rebuild failure', async () => {
      const mockFactbook = {
        rebuildIndex: vi.fn().mockResolvedValue(false)
      };

      vi.mocked(factbookService.getInstance).mockReturnValue(mockFactbook as any);

      const request = new Request('http://localhost/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rebuild_index' })
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Index rebuild failed');
    });

    it('should perform health check', async () => {
      const mockFactbook = {
        isLoaded: vi.fn().mockReturnValue(true),
        getSnippetCount: vi.fn().mockReturnValue(25),
        getIndexSizeBytes: vi.fn().mockReturnValue(8192),
        validateIndex: vi.fn().mockReturnValue(true)
      };

      vi.mocked(factbookService.getInstance).mockReturnValue(mockFactbook as any);

      const request = new Request('http://localhost/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'health_check' })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.corruption_detected).toBe(false);
      expect(mockFactbook.validateIndex).toHaveBeenCalled();
      expect(metricsCollector.updateFactbookHealth).toHaveBeenCalled();
    });

    it('should detect corruption in health check', async () => {
      const mockFactbook = {
        isLoaded: vi.fn().mockReturnValue(true),
        getSnippetCount: vi.fn().mockReturnValue(25),
        getIndexSizeBytes: vi.fn().mockReturnValue(8192),
        validateIndex: vi.fn().mockReturnValue(false)
      };

      vi.mocked(factbookService.getInstance).mockReturnValue(mockFactbook as any);

      const request = new Request('http://localhost/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'health_check' })
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.corruption_detected).toBe(true);
    });

    it('should handle unknown action', async () => {
      const request = new Request('http://localhost/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'unknown_action' })
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe('Unknown action');
    });

    it('should handle POST errors gracefully', async () => {
      vi.mocked(factbookService.getInstance).mockImplementation(() => {
        throw new Error('Service error');
      });

      const request = new Request('http://localhost/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'health_check' })
      });

      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Action failed');
    });
  });
});