'use client';

/**
 * Monitoring Dashboard - Live metrics viewer for factbook system
 * 
 * Displays last 20 chat_metrics log lines, factbook health, memory usage,
 * and live SLA proof showing hook timing and deep lane performance.
 */

import { useState, useEffect } from 'react';
import styles from './metrics.module.css';

interface ChatMetrics {
  trace_id: string;
  timestamp: number;
  t_hook_ms: number;
  t_deep_first_ms?: number;
  t_deep_done_ms?: number;
  snippets_selected: string[];
  keyword_extraction_ms?: number;
  index_query_ms?: number;
  jaccard_similarity?: number;
  overlap_percentage?: number;
  should_regenerate?: boolean;
  intent?: string;
  deep_merge?: boolean;
  pinned_count?: number;
  voice_warming_ms?: number;
  error?: string;
}

interface FactbookHealthMetrics {
  timestamp: number;
  is_loaded: boolean;
  snippet_count: number;
  index_size_bytes: number;
  last_reload_ms?: number;
  validation_errors: string[];
  memory_usage_mb: number;
  corruption_detected: boolean;
}

interface SystemMetrics {
  timestamp: number;
  memory_usage_mb: number;
  heap_used_mb: number;
  heap_total_mb: number;
  uptime_seconds: number;
  active_connections: number;
}

interface SLAMetrics {
  hook_sla_compliance: number;
  deep_sla_compliance: number;
  avg_hook_ms: number;
  avg_deep_ms: number;
  total_requests: number;
}

interface MetricsData {
  chat_metrics: ChatMetrics[];
  factbook_health: FactbookHealthMetrics;
  system_metrics: SystemMetrics;
  sla_metrics: SLAMetrics;
  timestamp: number;
}

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [rebuildingIndex, setRebuildingIndex] = useState(false);

  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/metrics');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setMetrics(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
    } finally {
      setLoading(false);
    }
  };

  const triggerHealthCheck = async () => {
    try {
      const response = await fetch('/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'health_check' })
      });
      
      if (response.ok) {
        await fetchMetrics();
      }
    } catch (err) {
      console.error('Health check failed:', err);
    }
  };

  const rebuildIndex = async () => {
    setRebuildingIndex(true);
    try {
      const response = await fetch('/api/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rebuild_index' })
      });
      
      if (response.ok) {
        await fetchMetrics();
      }
    } catch (err) {
      console.error('Index rebuild failed:', err);
    } finally {
      setRebuildingIndex(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchMetrics, 2000); // Refresh every 2 seconds
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading metrics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>Error: {error}</div>
        <button onClick={fetchMetrics} className={styles.button}>
          Retry
        </button>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>No metrics data available</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Factbook System Monitoring Dashboard</h1>
        <div className={styles.controls}>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            Auto-refresh (2s)
          </label>
          <button onClick={fetchMetrics} className={styles.button}>
            Refresh Now
          </button>
          <button onClick={triggerHealthCheck} className={styles.button}>
            Health Check
          </button>
          <button 
            onClick={rebuildIndex} 
            className={styles.button}
            disabled={rebuildingIndex}
          >
            {rebuildingIndex ? 'Rebuilding...' : 'Rebuild Index'}
          </button>
        </div>
      </header>

      {/* SLA Metrics - Live Proof */}
      <section className={styles.section}>
        <h2>SLA Performance (Live Proof)</h2>
        <div className={styles.slaGrid}>
          <div className={styles.slaCard}>
            <div className={styles.slaValue}>
              <span className={metrics.sla_metrics.hook_sla_compliance >= 95 ? styles.good : styles.warning}>
                {metrics.sla_metrics.hook_sla_compliance}%
              </span>
            </div>
            <div className={styles.slaLabel}>Hook SLA (&lt;300ms)</div>
            <div className={styles.slaDetail}>Avg: {metrics.sla_metrics.avg_hook_ms}ms</div>
          </div>
          
          <div className={styles.slaCard}>
            <div className={styles.slaValue}>
              <span className={metrics.sla_metrics.deep_sla_compliance >= 95 ? styles.good : styles.warning}>
                {metrics.sla_metrics.deep_sla_compliance}%
              </span>
            </div>
            <div className={styles.slaLabel}>Deep SLA (&lt;1000ms)</div>
            <div className={styles.slaDetail}>Avg: {metrics.sla_metrics.avg_deep_ms}ms</div>
          </div>
          
          <div className={styles.slaCard}>
            <div className={styles.slaValue}>{metrics.sla_metrics.total_requests}</div>
            <div className={styles.slaLabel}>Total Requests</div>
            <div className={styles.slaDetail}>Last 50 samples</div>
          </div>
        </div>
      </section>

      {/* Factbook Health */}
      <section className={styles.section}>
        <h2>Factbook Health</h2>
        <div className={styles.healthGrid}>
          <div className={styles.healthCard}>
            <div className={styles.healthStatus}>
              <span className={metrics.factbook_health.is_loaded ? styles.good : styles.error}>
                {metrics.factbook_health.is_loaded ? '✓ Loaded' : '✗ Not Loaded'}
              </span>
            </div>
            <div className={styles.healthDetail}>
              {metrics.factbook_health.snippet_count} snippets
            </div>
          </div>
          
          <div className={styles.healthCard}>
            <div className={styles.healthStatus}>
              <span className={metrics.factbook_health.corruption_detected ? styles.error : styles.good}>
                {metrics.factbook_health.corruption_detected ? '✗ Corrupted' : '✓ Valid'}
              </span>
            </div>
            <div className={styles.healthDetail}>
              Index: {Math.round(metrics.factbook_health.index_size_bytes / 1024)}KB
            </div>
          </div>
          
          <div className={styles.healthCard}>
            <div className={styles.healthStatus}>
              {metrics.factbook_health.memory_usage_mb}MB
            </div>
            <div className={styles.healthDetail}>Memory Usage</div>
          </div>
          
          {metrics.factbook_health.last_reload_ms && (
            <div className={styles.healthCard}>
              <div className={styles.healthStatus}>
                {metrics.factbook_health.last_reload_ms}ms
              </div>
              <div className={styles.healthDetail}>Last Reload</div>
            </div>
          )}
        </div>
        
        {metrics.factbook_health.validation_errors.length > 0 && (
          <div className={styles.errors}>
            <h3>Validation Errors:</h3>
            <ul>
              {metrics.factbook_health.validation_errors.map((error, i) => (
                <li key={i} className={styles.error}>{error}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* System Metrics */}
      <section className={styles.section}>
        <h2>System Metrics</h2>
        <div className={styles.systemGrid}>
          <div className={styles.systemCard}>
            <div className={styles.systemValue}>{metrics.system_metrics.memory_usage_mb}MB</div>
            <div className={styles.systemLabel}>Total Memory</div>
          </div>
          
          <div className={styles.systemCard}>
            <div className={styles.systemValue}>{metrics.system_metrics.heap_used_mb}MB</div>
            <div className={styles.systemLabel}>Heap Used</div>
          </div>
          
          <div className={styles.systemCard}>
            <div className={styles.systemValue}>{formatUptime(metrics.system_metrics.uptime_seconds)}</div>
            <div className={styles.systemLabel}>Uptime</div>
          </div>
        </div>
      </section>

      {/* Chat Metrics Table */}
      <section className={styles.section}>
        <h2>Recent Chat Metrics (Last 20)</h2>
        <div className={styles.tableContainer}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Time</th>
                <th>Trace ID</th>
                <th>Hook (ms)</th>
                <th>Deep First (ms)</th>
                <th>Deep Done (ms)</th>
                <th>Snippets</th>
                <th>Overlap %</th>
                <th>Intent</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {metrics.chat_metrics.map((metric) => (
                <tr key={metric.trace_id}>
                  <td>{formatTimestamp(metric.timestamp)}</td>
                  <td className={styles.traceId}>{metric.trace_id}</td>
                  <td className={metric.t_hook_ms > 300 ? styles.warning : styles.good}>
                    {metric.t_hook_ms}
                  </td>
                  <td>{metric.t_deep_first_ms || '-'}</td>
                  <td className={metric.t_deep_done_ms && metric.t_deep_done_ms > 1000 ? styles.warning : styles.good}>
                    {metric.t_deep_done_ms || '-'}
                  </td>
                  <td>{metric.snippets_selected.length}</td>
                  <td>{metric.overlap_percentage || '-'}</td>
                  <td>{metric.intent || '-'}</td>
                  <td>
                    {metric.error ? (
                      <span className={styles.error}>Error</span>
                    ) : (
                      <span className={styles.good}>OK</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <footer className={styles.footer}>
        <p>Last updated: {formatTimestamp(metrics.timestamp)}</p>
      </footer>
    </div>
  );
}