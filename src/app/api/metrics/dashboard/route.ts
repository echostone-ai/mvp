import { NextRequest, NextResponse } from 'next/server';
import { SLA_THRESHOLDS } from '../../../../lib/services/metricsService';

// Mock data store for demonstration - in production this would come from your metrics backend
interface MetricSnapshot {
  timestamp: number;
  tts_first_byte_ms: number[];
  memory_fetch_ms: number[];
  expression_timing_ms: number[];
  overlay_injections_count: number;
  overlay_dropped_count: number;
  stream_interrupts: number;
  error_count: number;
  total_requests: number;
}

// In-memory storage for demo purposes
let metricsHistory: MetricSnapshot[] = [];

// Helper function to calculate percentile
function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index % 1;
  
  if (upper >= sorted.length) return sorted[sorted.length - 1];
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

// Helper function to determine status based on value and threshold
function getMetricStatus(value: number, threshold: number, isInverse = false): 'healthy' | 'warning' | 'critical' {
  const ratio = isInverse ? threshold / value : value / threshold;
  
  if (isInverse) {
    if (value <= threshold) return 'healthy';
    if (value <= threshold * 1.5) return 'warning';
    return 'critical';
  } else {
    if (ratio >= 0.95) return 'healthy';
    if (ratio >= 0.8) return 'warning';
    return 'critical';
  }
}

// Generate mock metrics for demonstration
function generateMockMetrics(): MetricSnapshot {
  const now = Date.now();
  
  // Generate realistic mock data with some variance
  const tts_times = Array.from({ length: 50 }, () => 
    Math.max(200, Math.random() * 1200 + (Math.random() > 0.9 ? 2000 : 0))
  );
  
  const memory_times = Array.from({ length: 30 }, () => 
    Math.max(10, Math.random() * 180 + (Math.random() > 0.95 ? 300 : 0))
  );
  
  const expression_times = Array.from({ length: 20 }, () => 
    Math.max(5, Math.random() * 45 + (Math.random() > 0.9 ? 80 : 0))
  );

  return {
    timestamp: now,
    tts_first_byte_ms: tts_times,
    memory_fetch_ms: memory_times,
    expression_timing_ms: expression_times,
    overlay_injections_count: Math.floor(Math.random() * 100) + 50,
    overlay_dropped_count: Math.floor(Math.random() * 10),
    stream_interrupts: Math.floor(Math.random() * 5),
    error_count: Math.floor(Math.random() * 8),
    total_requests: Math.floor(Math.random() * 200) + 100,
  };
}

export async function GET(request: NextRequest) {
  try {
    // In production, this would fetch from your metrics backend (Prometheus, etc.)
    // For demo purposes, we'll generate mock data
    const currentMetrics = generateMockMetrics();
    metricsHistory.push(currentMetrics);
    
    // Keep only last 100 snapshots
    if (metricsHistory.length > 100) {
      metricsHistory = metricsHistory.slice(-100);
    }

    // Calculate averages and rates
    const tts_avg = currentMetrics.tts_first_byte_ms.length > 0 
      ? currentMetrics.tts_first_byte_ms.reduce((a, b) => a + b, 0) / currentMetrics.tts_first_byte_ms.length 
      : 0;
    
    const memory_avg = currentMetrics.memory_fetch_ms.length > 0
      ? currentMetrics.memory_fetch_ms.reduce((a, b) => a + b, 0) / currentMetrics.memory_fetch_ms.length
      : 0;
    
    const expression_avg = currentMetrics.expression_timing_ms.length > 0
      ? currentMetrics.expression_timing_ms.reduce((a, b) => a + b, 0) / currentMetrics.expression_timing_ms.length
      : 0;

    // Calculate rates (per minute)
    const timeWindowMinutes = 5;
    const overlay_injection_rate = (currentMetrics.overlay_injections_count / timeWindowMinutes);
    const overlay_dropped_rate = (currentMetrics.overlay_dropped_count / timeWindowMinutes);
    const stream_interrupt_rate = (currentMetrics.stream_interrupts / timeWindowMinutes);
    const error_rate = (currentMetrics.error_count / Math.max(currentMetrics.total_requests, 1)) * 100;

    // Calculate SLA compliance
    const tts_sla_violations = currentMetrics.tts_first_byte_ms.filter(t => t > SLA_THRESHOLDS.TTS_FIRST_BYTE_MAX_MS).length;
    const memory_sla_violations = currentMetrics.memory_fetch_ms.filter(t => t > SLA_THRESHOLDS.MEMORY_FETCH_MAX_MS).length;
    const expression_sla_violations = currentMetrics.expression_timing_ms.filter(t => t > SLA_THRESHOLDS.EXPRESSION_TIMING_MAX_MS).length;
    
    const total_operations = currentMetrics.tts_first_byte_ms.length + currentMetrics.memory_fetch_ms.length + currentMetrics.expression_timing_ms.length;
    const total_violations = tts_sla_violations + memory_sla_violations + expression_sla_violations;
    const sla_compliance = total_operations > 0 ? ((total_operations - total_violations) / total_operations) * 100 : 100;

    // Mock uptime (in production this would come from your monitoring system)
    const uptime_percentage = Math.max(95, 100 - (currentMetrics.error_count / Math.max(currentMetrics.total_requests, 1)) * 100);

    // Determine trends (simplified - in production you'd analyze historical data)
    const getTrend = (current: number, threshold: number) => {
      const variance = Math.random() * 0.2 - 0.1; // ±10% variance
      if (Math.abs(variance) < 0.03) return 'stable';
      return variance > 0 ? 'up' : 'down';
    };

    const dashboardMetrics = {
      tts_first_byte_avg: {
        name: 'TTS First Byte',
        value: tts_avg,
        unit: 'ms',
        threshold: SLA_THRESHOLDS.TTS_FIRST_BYTE_MAX_MS,
        status: getMetricStatus(tts_avg, SLA_THRESHOLDS.TTS_FIRST_BYTE_MAX_MS, true),
        trend: getTrend(tts_avg, SLA_THRESHOLDS.TTS_FIRST_BYTE_MAX_MS),
      },
      memory_fetch_avg: {
        name: 'Memory Fetch',
        value: memory_avg,
        unit: 'ms',
        threshold: SLA_THRESHOLDS.MEMORY_FETCH_MAX_MS,
        status: getMetricStatus(memory_avg, SLA_THRESHOLDS.MEMORY_FETCH_MAX_MS, true),
        trend: getTrend(memory_avg, SLA_THRESHOLDS.MEMORY_FETCH_MAX_MS),
      },
      expression_timing_avg: {
        name: 'Expression Timing',
        value: expression_avg,
        unit: 'ms',
        threshold: SLA_THRESHOLDS.EXPRESSION_TIMING_MAX_MS,
        status: getMetricStatus(expression_avg, SLA_THRESHOLDS.EXPRESSION_TIMING_MAX_MS, true),
        trend: getTrend(expression_avg, SLA_THRESHOLDS.EXPRESSION_TIMING_MAX_MS),
      },
      overlay_injections_rate: {
        name: 'Overlay Injections',
        value: overlay_injection_rate,
        unit: 'rate',
        status: 'healthy' as const,
        trend: 'stable' as const,
      },
      overlay_dropped_rate: {
        name: 'Overlay Dropped',
        value: overlay_dropped_rate,
        unit: 'rate',
        threshold: 2, // Max 2 drops per minute
        status: getMetricStatus(overlay_dropped_rate, 2, true),
        trend: getTrend(overlay_dropped_rate, 2),
      },
      stream_interrupts_rate: {
        name: 'Stream Interrupts',
        value: stream_interrupt_rate,
        unit: 'rate',
        threshold: 1, // Max 1 interrupt per minute
        status: getMetricStatus(stream_interrupt_rate, 1, true),
        trend: getTrend(stream_interrupt_rate, 1),
      },
      error_rate: {
        name: 'Error Rate',
        value: error_rate,
        unit: '%',
        threshold: 1, // Max 1% error rate
        status: getMetricStatus(error_rate, 1, true),
        trend: getTrend(error_rate, 1),
      },
      sla_compliance: {
        name: 'SLA Compliance',
        value: sla_compliance,
        unit: '%',
        threshold: SLA_THRESHOLDS.UPTIME_MIN_PERCENTAGE,
        status: getMetricStatus(sla_compliance, SLA_THRESHOLDS.UPTIME_MIN_PERCENTAGE),
        trend: getTrend(sla_compliance, SLA_THRESHOLDS.UPTIME_MIN_PERCENTAGE),
      },
      uptime_percentage: {
        name: 'System Uptime',
        value: uptime_percentage,
        unit: '%',
        threshold: SLA_THRESHOLDS.UPTIME_MIN_PERCENTAGE,
        status: getMetricStatus(uptime_percentage, SLA_THRESHOLDS.UPTIME_MIN_PERCENTAGE),
        trend: 'stable' as const,
      },
    };

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      metrics: dashboardMetrics,
      summary: {
        total_operations,
        sla_violations: total_violations,
        compliance_percentage: sla_compliance,
        health_status: sla_compliance >= SLA_THRESHOLDS.UPTIME_MIN_PERCENTAGE ? 'healthy' : 'degraded',
      },
    });

  } catch (error) {
    console.error('Dashboard metrics API error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch dashboard metrics',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// POST endpoint to receive metrics from the application
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate the incoming metrics
    const requiredFields = ['tts_first_byte_ms', 'memory_fetch_ms', 'overlay_injections_count'];
    for (const field of requiredFields) {
      if (!(field in body)) {
        return NextResponse.json({
          success: false,
          error: `Missing required field: ${field}`,
        }, { status: 400 });
      }
    }

    // Store the metrics (in production, this would go to your metrics backend)
    const snapshot: MetricSnapshot = {
      timestamp: Date.now(),
      tts_first_byte_ms: Array.isArray(body.tts_first_byte_ms) ? body.tts_first_byte_ms : [body.tts_first_byte_ms],
      memory_fetch_ms: Array.isArray(body.memory_fetch_ms) ? body.memory_fetch_ms : [body.memory_fetch_ms],
      expression_timing_ms: Array.isArray(body.expression_timing_ms) ? body.expression_timing_ms : [body.expression_timing_ms || 0],
      overlay_injections_count: body.overlay_injections_count || 0,
      overlay_dropped_count: body.overlay_dropped_count || 0,
      stream_interrupts: body.stream_interrupts || 0,
      error_count: body.error_count || 0,
      total_requests: body.total_requests || 1,
    };

    metricsHistory.push(snapshot);
    
    // Keep only last 100 snapshots
    if (metricsHistory.length > 100) {
      metricsHistory = metricsHistory.slice(-100);
    }

    return NextResponse.json({
      success: true,
      message: 'Metrics recorded successfully',
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Metrics recording error:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to record metrics',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}