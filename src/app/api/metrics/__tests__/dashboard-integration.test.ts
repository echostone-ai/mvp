import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GET, POST } from '../dashboard/route';
import { NextRequest } from 'next/server';

// Mock NextRequest
const createMockRequest = (url: string, options: RequestInit = {}) => {
  return new NextRequest(url, options);
};

describe('Dashboard API Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /api/metrics/dashboard', () => {
    it('should return dashboard metrics successfully', async () => {
      const request = createMockRequest('http://localhost:3000/api/metrics/dashboard');
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.metrics).toBeDefined();
      expect(data.timestamp).toBeDefined();
      expect(data.summary).toBeDefined();
    });

    it('should include all required metrics', async () => {
      const request = createMockRequest('http://localhost:3000/api/metrics/dashboard');
      
      const response = await GET(request);
      const data = await response.json();
      
      const requiredMetrics = [
        'tts_first_byte_avg',
        'memory_fetch_avg',
        'expression_timing_avg',
        'overlay_injections_rate',
        'overlay_dropped_rate',
        'stream_interrupts_rate',
        'error_rate',
        'sla_compliance',
        'uptime_percentage'
      ];

      for (const metric of requiredMetrics) {
        expect(data.metrics[metric]).toBeDefined();
        expect(data.metrics[metric]).toHaveProperty('name');
        expect(data.metrics[metric]).toHaveProperty('value');
        expect(data.metrics[metric]).toHaveProperty('unit');
        expect(data.metrics[metric]).toHaveProperty('status');
      }
    });

    it('should include SLA compliance summary', async () => {
      const request = createMockRequest('http://localhost:3000/api/metrics/dashboard');
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(data.summary).toHaveProperty('total_operations');
      expect(data.summary).toHaveProperty('sla_violations');
      expect(data.summary).toHaveProperty('compliance_percentage');
      expect(data.summary).toHaveProperty('health_status');
      
      expect(typeof data.summary.compliance_percentage).toBe('number');
      expect(['healthy', 'degraded']).toContain(data.summary.health_status);
    });

    it('should handle errors gracefully', async () => {
      // Mock console.error to avoid test output noise
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Force an error by mocking Date.now to throw
      const originalDateNow = Date.now;
      Date.now = vi.fn().mockImplementation(() => {
        throw new Error('Mocked error');
      });
      
      const request = createMockRequest('http://localhost:3000/api/metrics/dashboard');
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to fetch dashboard metrics');
      
      // Restore original Date.now
      Date.now = originalDateNow;
      consoleSpy.mockRestore();
    });
  });

  describe('POST /api/metrics/dashboard', () => {
    it('should accept and store metrics successfully', async () => {
      const metricsData = {
        tts_first_byte_ms: [750, 820, 650],
        memory_fetch_ms: [85, 92, 78],
        expression_timing_ms: [28, 35, 22],
        overlay_injections_count: 5,
        overlay_dropped_count: 1,
        stream_interrupts: 0,
        error_count: 2,
        total_requests: 10
      };

      const request = createMockRequest('http://localhost:3000/api/metrics/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metricsData)
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Metrics recorded successfully');
      expect(data.timestamp).toBeDefined();
    });

    it('should validate required fields', async () => {
      const incompleteData = {
        memory_fetch_ms: [85, 92, 78],
        // Missing tts_first_byte_ms and overlay_injections_count
      };

      const request = createMockRequest('http://localhost:3000/api/metrics/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(incompleteData)
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Missing required field');
    });

    it('should handle single values as arrays', async () => {
      const metricsData = {
        tts_first_byte_ms: 750, // Single value instead of array
        memory_fetch_ms: 85,
        overlay_injections_count: 3
      };

      const request = createMockRequest('http://localhost:3000/api/metrics/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metricsData)
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should handle malformed JSON gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const request = createMockRequest('http://localhost:3000/api/metrics/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      });
      
      const response = await POST(request);
      const data = await response.json();
      
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to record metrics');
      
      consoleSpy.mockRestore();
    });
  });

  describe('Metrics validation', () => {
    it('should generate realistic metric values', async () => {
      const request = createMockRequest('http://localhost:3000/api/metrics/dashboard');
      
      const response = await GET(request);
      const data = await response.json();
      
      // TTS latency should be reasonable (200ms - 3000ms range)
      expect(data.metrics.tts_first_byte_avg.value).toBeGreaterThan(0);
      expect(data.metrics.tts_first_byte_avg.value).toBeLessThan(5000);
      
      // Memory fetch should be fast (< 500ms)
      expect(data.metrics.memory_fetch_avg.value).toBeGreaterThan(0);
      expect(data.metrics.memory_fetch_avg.value).toBeLessThan(500);
      
      // Expression timing should be very fast (< 200ms)
      expect(data.metrics.expression_timing_avg.value).toBeGreaterThan(0);
      expect(data.metrics.expression_timing_avg.value).toBeLessThan(200);
      
      // Rates should be non-negative
      expect(data.metrics.overlay_injections_rate.value).toBeGreaterThanOrEqual(0);
      expect(data.metrics.overlay_dropped_rate.value).toBeGreaterThanOrEqual(0);
      expect(data.metrics.stream_interrupts_rate.value).toBeGreaterThanOrEqual(0);
      
      // Error rate should be a percentage (0-100)
      expect(data.metrics.error_rate.value).toBeGreaterThanOrEqual(0);
      expect(data.metrics.error_rate.value).toBeLessThanOrEqual(100);
      
      // SLA compliance should be a percentage (0-100)
      expect(data.metrics.sla_compliance.value).toBeGreaterThanOrEqual(0);
      expect(data.metrics.sla_compliance.value).toBeLessThanOrEqual(100);
      
      // Uptime should be high (> 90%)
      expect(data.metrics.uptime_percentage.value).toBeGreaterThan(90);
      expect(data.metrics.uptime_percentage.value).toBeLessThanOrEqual(100);
    });

    it('should assign appropriate status values', async () => {
      const request = createMockRequest('http://localhost:3000/api/metrics/dashboard');
      
      const response = await GET(request);
      const data = await response.json();
      
      const validStatuses = ['healthy', 'warning', 'critical'];
      
      Object.values(data.metrics).forEach((metric: any) => {
        expect(validStatuses).toContain(metric.status);
      });
    });

    it('should include threshold information where applicable', async () => {
      const request = createMockRequest('http://localhost:3000/api/metrics/dashboard');
      
      const response = await GET(request);
      const data = await response.json();
      
      // These metrics should have thresholds
      const metricsWithThresholds = [
        'tts_first_byte_avg',
        'memory_fetch_avg',
        'expression_timing_avg',
        'sla_compliance',
        'uptime_percentage'
      ];
      
      metricsWithThresholds.forEach(metricName => {
        expect(data.metrics[metricName].threshold).toBeDefined();
        expect(typeof data.metrics[metricName].threshold).toBe('number');
      });
    });
  });

  describe('Performance characteristics', () => {
    it('should respond within reasonable time', async () => {
      const startTime = Date.now();
      
      const request = createMockRequest('http://localhost:3000/api/metrics/dashboard');
      await GET(request);
      
      const responseTime = Date.now() - startTime;
      
      // Should respond within 1 second
      expect(responseTime).toBeLessThan(1000);
    });

    it('should handle concurrent requests', async () => {
      const requests = Array.from({ length: 5 }, () => 
        createMockRequest('http://localhost:3000/api/metrics/dashboard')
      );
      
      const startTime = Date.now();
      const responses = await Promise.all(requests.map(req => GET(req)));
      const totalTime = Date.now() - startTime;
      
      // All requests should succeed
      for (const response of responses) {
        expect(response.status).toBe(200);
      }
      
      // Should handle 5 concurrent requests within 2 seconds
      expect(totalTime).toBeLessThan(2000);
    });
  });
});