// src/app/api/admin/story-metrics/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { registry } from '@/lib/metrics';

interface MetricValue {
  value: number;
  labels: Record<string, string>;
  timestamp?: number;
}

interface MetricData {
  name: string;
  help: string;
  type: string;
  values: MetricValue[];
}

interface PerformanceStats {
  storyMatchLatency: {
    p50: number;
    p95: number;
    count: number;
  };
  storyStartLatency: {
    p50: number;
    p95: number;
    slaCompliance: number;
  };
  ttsFirstChunk: {
    p50: number;
    p95: number;
    withStoriesEnabled: number;
  };
  counters: {
    storySelected: number;
    storySkippedNoMatch: number;
    storyPlaySuccess: number;
    storyPlayFailed: number;
    storyFallbackTts: number;
    timeoutViolations: number;
  };
  // Task 13: Queue metrics
  queueMetrics: {
    storyQueued: number;
    storyReplaced: number;
    storyExpired: number;
    avgQueueAge: number;
    p95QueueAge: number;
  };
}

function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)] || 0;
}

function parseMetrics(metricsText: string): MetricData[] {
  const metrics: MetricData[] = [];
  const lines = metricsText.split('\n');
  
  let currentMetric: Partial<MetricData> | null = null;
  
  for (const line of lines) {
    if (line.startsWith('# HELP ')) {
      const parts = line.substring(7).split(' ');
      const name = parts[0];
      const help = parts.slice(1).join(' ');
      
      currentMetric = { name, help, values: [] };
    } else if (line.startsWith('# TYPE ')) {
      const parts = line.substring(7).split(' ');
      const type = parts[1];
      
      if (currentMetric) {
        currentMetric.type = type;
      }
    } else if (line && !line.startsWith('#') && currentMetric) {
      // Parse metric value line
      const match = line.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*(?:\{[^}]*\})?) (.+)$/);
      if (match) {
        const [, metricWithLabels, valueStr] = match;
        const value = parseFloat(valueStr);
        
        // Extract labels if present
        const labelsMatch = metricWithLabels.match(/\{([^}]*)\}/);
        const labels: Record<string, string> = {};
        
        if (labelsMatch) {
          const labelsStr = labelsMatch[1];
          const labelPairs = labelsStr.split(',');
          
          for (const pair of labelPairs) {
            const [key, val] = pair.split('=');
            if (key && val) {
              labels[key.trim()] = val.trim().replace(/"/g, '');
            }
          }
        }
        
        currentMetric.values!.push({ value, labels });
      }
      
      // If this is the last line for this metric or we hit a new metric
      if (!lines[lines.indexOf(line) + 1]?.startsWith(currentMetric.name!)) {
        if (currentMetric.name && currentMetric.type && currentMetric.values) {
          metrics.push(currentMetric as MetricData);
        }
        currentMetric = null;
      }
    }
  }
  
  return metrics;
}

function calculateStats(metrics: MetricData[]): PerformanceStats {
  const stats: PerformanceStats = {
    storyMatchLatency: { p50: 0, p95: 0, count: 0 },
    storyStartLatency: { p50: 0, p95: 0, slaCompliance: 0 },
    ttsFirstChunk: { p50: 0, p95: 0, withStoriesEnabled: 0 },
    counters: {
      storySelected: 0,
      storySkippedNoMatch: 0,
      storyPlaySuccess: 0,
      storyPlayFailed: 0,
      storyFallbackTts: 0,
      timeoutViolations: 0,
    },
    // Task 13: Initialize queue metrics
    queueMetrics: {
      storyQueued: 0,
      storyReplaced: 0,
      storyExpired: 0,
      avgQueueAge: 0,
      p95QueueAge: 0,
    },
  };

  for (const metric of metrics) {
    switch (metric.name) {
      case 'story_match_latency_ms':
        if (metric.type === 'histogram') {
          const bucketValues: number[] = [];
          let totalCount = 0;
          
          for (const value of metric.values) {
            if (value.labels.le && value.labels.le !== '+Inf') {
              const bucketLimit = parseFloat(value.labels.le);
              const bucketCount = value.value;
              
              // Add values for this bucket
              for (let i = 0; i < bucketCount; i++) {
                bucketValues.push(bucketLimit);
              }
              totalCount += bucketCount;
            }
          }
          
          stats.storyMatchLatency.p50 = calculatePercentile(bucketValues, 50);
          stats.storyMatchLatency.p95 = calculatePercentile(bucketValues, 95);
          stats.storyMatchLatency.count = totalCount;
        }
        break;
        
      case 'story_start_latency_ms':
        if (metric.type === 'histogram') {
          const bucketValues: number[] = [];
          let withinSlaCount = 0;
          let totalCount = 0;
          
          for (const value of metric.values) {
            if (value.labels.le && value.labels.le !== '+Inf') {
              const bucketLimit = parseFloat(value.labels.le);
              const bucketCount = value.value;
              
              for (let i = 0; i < bucketCount; i++) {
                bucketValues.push(bucketLimit);
                if (bucketLimit <= 2000) withinSlaCount++;
              }
              totalCount += bucketCount;
            }
          }
          
          stats.storyStartLatency.p50 = calculatePercentile(bucketValues, 50);
          stats.storyStartLatency.p95 = calculatePercentile(bucketValues, 95);
          stats.storyStartLatency.slaCompliance = totalCount > 0 ? withinSlaCount / totalCount : 0;
        }
        break;
        
      case 'tts_time_to_first_chunk_ms':
        if (metric.type === 'histogram') {
          const bucketValues: number[] = [];
          let withStoriesSum = 0;
          let withStoriesCount = 0;
          
          for (const value of metric.values) {
            if (value.labels.le && value.labels.le !== '+Inf') {
              const bucketLimit = parseFloat(value.labels.le);
              const bucketCount = value.value;
              
              for (let i = 0; i < bucketCount; i++) {
                bucketValues.push(bucketLimit);
              }
              
              if (value.labels.story_system_enabled === 'true') {
                withStoriesSum += bucketLimit * bucketCount;
                withStoriesCount += bucketCount;
              }
            }
          }
          
          stats.ttsFirstChunk.p50 = calculatePercentile(bucketValues, 50);
          stats.ttsFirstChunk.p95 = calculatePercentile(bucketValues, 95);
          stats.ttsFirstChunk.withStoriesEnabled = withStoriesCount > 0 ? withStoriesSum / withStoriesCount : 0;
        }
        break;
        
      case 'story_selected_total':
        stats.counters.storySelected = metric.values.reduce((sum, v) => sum + v.value, 0);
        break;
        
      case 'story_skipped_no_match_total':
        stats.counters.storySkippedNoMatch = metric.values.reduce((sum, v) => sum + v.value, 0);
        break;
        
      case 'story_play_success_total':
        stats.counters.storyPlaySuccess = metric.values.reduce((sum, v) => sum + v.value, 0);
        break;
        
      case 'story_play_failed_total':
        stats.counters.storyPlayFailed = metric.values.reduce((sum, v) => sum + v.value, 0);
        break;
        
      case 'story_fallback_tts_total':
        stats.counters.storyFallbackTts = metric.values.reduce((sum, v) => sum + v.value, 0);
        break;
        
      case 'story_timeout_violations_total':
        stats.counters.timeoutViolations = metric.values.reduce((sum, v) => sum + v.value, 0);
        break;
        
      // Task 13: Queue metrics
      case 'story_queued_total':
        stats.queueMetrics.storyQueued = metric.values.reduce((sum, v) => sum + v.value, 0);
        break;
        
      case 'story_replaced_total':
        stats.queueMetrics.storyReplaced = metric.values.reduce((sum, v) => sum + v.value, 0);
        break;
        
      case 'story_expired_total':
        stats.queueMetrics.storyExpired = metric.values.reduce((sum, v) => sum + v.value, 0);
        break;
        
      case 'story_queue_age_ms':
        if (metric.type === 'histogram') {
          const bucketValues: number[] = [];
          let totalSum = 0;
          let totalCount = 0;
          
          for (const value of metric.values) {
            if (value.labels.le && value.labels.le !== '+Inf') {
              const bucketLimit = parseFloat(value.labels.le);
              const bucketCount = value.value;
              
              for (let i = 0; i < bucketCount; i++) {
                bucketValues.push(bucketLimit);
              }
              
              totalSum += bucketLimit * bucketCount;
              totalCount += bucketCount;
            }
          }
          
          stats.queueMetrics.avgQueueAge = totalCount > 0 ? totalSum / totalCount : 0;
          stats.queueMetrics.p95QueueAge = calculatePercentile(bucketValues, 95);
        }
        break;
    }
  }
  
  return stats;
}

export async function GET(request: NextRequest) {
  try {
    // Check if metrics are available (server-side only)
    if (!registry || typeof registry.metrics !== 'function') {
      return NextResponse.json({
        error: 'Metrics not available',
        metrics: [],
        stats: null,
      });
    }

    // Get raw metrics
    const metricsText = registry.metrics();
    const metrics = parseMetrics(metricsText);
    
    // Filter for story-related metrics
    const storyMetrics = metrics.filter(m => 
      m.name.startsWith('story_') || 
      m.name.startsWith('tts_time_to_first_chunk')
    );
    
    // Calculate performance statistics
    const stats = calculateStats(storyMetrics);
    
    return NextResponse.json({
      metrics: storyMetrics,
      stats,
      timestamp: Date.now(),
    });
    
  } catch (error) {
    console.error('Error fetching story metrics:', error);
    
    return NextResponse.json({
      error: 'Failed to fetch metrics',
      message: error instanceof Error ? error.message : 'Unknown error',
      metrics: [],
      stats: null,
    }, { status: 500 });
  }
}

// Health check endpoint
export async function HEAD(request: NextRequest) {
  return new NextResponse(null, { status: 200 });
}