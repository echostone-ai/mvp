// src/components/StoryPerformanceDashboard.tsx
'use client';

import React, { useState, useEffect } from 'react';
import styles from './StoryPerformanceDashboard.module.css';

interface MetricData {
  name: string;
  help: string;
  type: string;
  values: Array<{
    value: number;
    labels: Record<string, string>;
    timestamp?: number;
  }>;
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

export default function StoryPerformanceDashboard() {
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/admin/story-metrics');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      setMetrics(data.metrics || []);
      setStats(data.stats || null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
      console.error('Failed to fetch story metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const formatLatency = (ms: number): string => {
    return `${ms.toFixed(1)}ms`;
  };

  const formatPercentage = (ratio: number): string => {
    return `${(ratio * 100).toFixed(1)}%`;
  };

  const getLatencyStatus = (p95: number, threshold: number): 'good' | 'warning' | 'error' => {
    if (p95 <= threshold) return 'good';
    if (p95 <= threshold * 1.5) return 'warning';
    return 'error';
  };

  if (loading) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.loading}>Loading story performance metrics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.error}>
          <h3>Error Loading Metrics</h3>
          <p>{error}</p>
          <button onClick={fetchMetrics} className={styles.retryButton}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      <div className={styles.header}>
        <h2>Story Performance Dashboard</h2>
        <div className={styles.controls}>
          <label className={styles.autoRefreshToggle}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh (5s)
          </label>
          <button onClick={fetchMetrics} className={styles.refreshButton}>
            Refresh Now
          </button>
        </div>
      </div>

      {stats && (
        <div className={styles.statsGrid}>
          {/* Latency Metrics */}
          <div className={styles.metricCard}>
            <h3>Story Matching Latency</h3>
            <div className={styles.latencyStats}>
              <div className={styles.stat}>
                <span className={styles.label}>P50:</span>
                <span className={`${styles.value} ${getLatencyStatus(stats.storyMatchLatency.p50, 50)}`}>
                  {formatLatency(stats.storyMatchLatency.p50)}
                </span>
              </div>
              <div className={styles.stat}>
                <span className={styles.label}>P95:</span>
                <span className={`${styles.value} ${getLatencyStatus(stats.storyMatchLatency.p95, 100)}`}>
                  {formatLatency(stats.storyMatchLatency.p95)}
                </span>
              </div>
              <div className={styles.stat}>
                <span className={styles.label}>Count:</span>
                <span className={styles.value}>{stats.storyMatchLatency.count}</span>
              </div>
            </div>
            <div className={styles.requirement}>
              Requirement: P95 ≤ 100ms
            </div>
          </div>

          <div className={styles.metricCard}>
            <h3>Story Start Latency</h3>
            <div className={styles.latencyStats}>
              <div className={styles.stat}>
                <span className={styles.label}>P50:</span>
                <span className={`${styles.value} ${getLatencyStatus(stats.storyStartLatency.p50, 1000)}`}>
                  {formatLatency(stats.storyStartLatency.p50)}
                </span>
              </div>
              <div className={styles.stat}>
                <span className={styles.label}>P95:</span>
                <span className={`${styles.value} ${getLatencyStatus(stats.storyStartLatency.p95, 2000)}`}>
                  {formatLatency(stats.storyStartLatency.p95)}
                </span>
              </div>
              <div className={styles.stat}>
                <span className={styles.label}>SLA Compliance:</span>
                <span className={`${styles.value} ${stats.storyStartLatency.slaCompliance >= 0.95 ? 'good' : 'warning'}`}>
                  {formatPercentage(stats.storyStartLatency.slaCompliance)}
                </span>
              </div>
            </div>
            <div className={styles.requirement}>
              Requirement: P95 ≤ 2000ms, SLA ≥ 95%
            </div>
          </div>

          <div className={styles.metricCard}>
            <h3>TTS First Chunk</h3>
            <div className={styles.latencyStats}>
              <div className={styles.stat}>
                <span className={styles.label}>P50:</span>
                <span className={`${styles.value} ${getLatencyStatus(stats.ttsFirstChunk.p50, 600)}`}>
                  {formatLatency(stats.ttsFirstChunk.p50)}
                </span>
              </div>
              <div className={styles.stat}>
                <span className={styles.label}>P95:</span>
                <span className={`${styles.value} ${getLatencyStatus(stats.ttsFirstChunk.p95, 900)}`}>
                  {formatLatency(stats.ttsFirstChunk.p95)}
                </span>
              </div>
              <div className={styles.stat}>
                <span className={styles.label}>With Stories:</span>
                <span className={styles.value}>
                  {formatLatency(stats.ttsFirstChunk.withStoriesEnabled)}
                </span>
              </div>
            </div>
            <div className={styles.requirement}>
              Requirement: P50 ≤ 600ms, P95 ≤ 900ms
            </div>
          </div>

          {/* Counters */}
          <div className={styles.metricCard}>
            <h3>Story Selection</h3>
            <div className={styles.counterStats}>
              <div className={styles.stat}>
                <span className={styles.label}>Selected:</span>
                <span className={styles.value}>{stats.counters.storySelected}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.label}>No Match:</span>
                <span className={styles.value}>{stats.counters.storySkippedNoMatch}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.label}>Success Rate:</span>
                <span className={styles.value}>
                  {stats.counters.storySelected > 0 
                    ? formatPercentage(stats.counters.storyPlaySuccess / stats.counters.storySelected)
                    : 'N/A'
                  }
                </span>
              </div>
            </div>
          </div>

          <div className={styles.metricCard}>
            <h3>Playback Results</h3>
            <div className={styles.counterStats}>
              <div className={styles.stat}>
                <span className={styles.label}>Success:</span>
                <span className={`${styles.value} good`}>{stats.counters.storyPlaySuccess}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.label}>Failed:</span>
                <span className={`${styles.value} ${stats.counters.storyPlayFailed > 0 ? 'error' : 'good'}`}>
                  {stats.counters.storyPlayFailed}
                </span>
              </div>
              <div className={styles.stat}>
                <span className={styles.label}>TTS Fallback:</span>
                <span className={styles.value}>{stats.counters.storyFallbackTts}</span>
              </div>
            </div>
          </div>

          <div className={styles.metricCard}>
            <h3>SLA Violations</h3>
            <div className={styles.counterStats}>
              <div className={styles.stat}>
                <span className={styles.label}>Timeout Violations:</span>
                <span className={`${styles.value} ${stats.counters.timeoutViolations > 0 ? 'warning' : 'good'}`}>
                  {stats.counters.timeoutViolations}
                </span>
              </div>
              <div className={styles.stat}>
                <span className={styles.label}>Violation Rate:</span>
                <span className={styles.value}>
                  {stats.counters.storySelected > 0 
                    ? formatPercentage(stats.counters.timeoutViolations / stats.counters.storySelected)
                    : 'N/A'
                  }
                </span>
              </div>
            </div>
          </div>

          {/* Task 13: Queue Metrics */}
          <div className={styles.metricCard}>
            <h3>Story Queue</h3>
            <div className={styles.counterStats}>
              <div className={styles.stat}>
                <span className={styles.label}>Queued:</span>
                <span className={styles.value}>{stats.queueMetrics.storyQueued}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.label}>Replaced:</span>
                <span className={`${styles.value} ${stats.queueMetrics.storyReplaced > 0 ? 'warning' : 'good'}`}>
                  {stats.queueMetrics.storyReplaced}
                </span>
              </div>
              <div className={styles.stat}>
                <span className={styles.label}>Expired:</span>
                <span className={`${styles.value} ${stats.queueMetrics.storyExpired > 0 ? 'error' : 'good'}`}>
                  {stats.queueMetrics.storyExpired}
                </span>
              </div>
            </div>
          </div>

          <div className={styles.metricCard}>
            <h3>Queue Performance</h3>
            <div className={styles.latencyStats}>
              <div className={styles.stat}>
                <span className={styles.label}>Avg Queue Age:</span>
                <span className={`${styles.value} ${getLatencyStatus(stats.queueMetrics.avgQueueAge, 2000)}`}>
                  {formatLatency(stats.queueMetrics.avgQueueAge)}
                </span>
              </div>
              <div className={styles.stat}>
                <span className={styles.label}>P95 Queue Age:</span>
                <span className={`${styles.value} ${getLatencyStatus(stats.queueMetrics.p95QueueAge, 5000)}`}>
                  {formatLatency(stats.queueMetrics.p95QueueAge)}
                </span>
              </div>
              <div className={styles.stat}>
                <span className={styles.label}>Queue Efficiency:</span>
                <span className={styles.value}>
                  {stats.queueMetrics.storyQueued > 0 
                    ? formatPercentage((stats.queueMetrics.storyQueued - stats.queueMetrics.storyExpired) / stats.queueMetrics.storyQueued)
                    : 'N/A'
                  }
                </span>
              </div>
            </div>
            <div className={styles.requirement}>
              Target: P95 ≤ 5s, Efficiency ≥ 90%
            </div>
          </div>
        </div>
      )}

      {/* Raw Metrics Table */}
      <div className={styles.rawMetrics}>
        <h3>Raw Metrics</h3>
        <div className={styles.metricsTable}>
          {metrics.length === 0 ? (
            <p>No metrics available</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Type</th>
                  <th>Value</th>
                  <th>Labels</th>
                </tr>
              </thead>
              <tbody>
                {metrics.map((metric, index) => 
                  metric.values.map((value, valueIndex) => (
                    <tr key={`${index}-${valueIndex}`}>
                      <td>{metric.name}</td>
                      <td>{metric.type}</td>
                      <td>{value.value}</td>
                      <td>
                        {Object.entries(value.labels || {}).map(([key, val]) => (
                          <span key={key} className={styles.label}>
                            {key}={val}
                          </span>
                        ))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}