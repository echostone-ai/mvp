'use client';

import React, { useState, useEffect } from 'react';
import { SLA_THRESHOLDS } from '../lib/services/metricsService';

interface MetricData {
  name: string;
  value: number;
  unit: string;
  threshold?: number;
  status: 'healthy' | 'warning' | 'critical';
  trend?: 'up' | 'down' | 'stable';
}

interface DashboardMetrics {
  tts_first_byte_avg: MetricData;
  memory_fetch_avg: MetricData;
  expression_timing_avg: MetricData;
  overlay_injections_rate: MetricData;
  overlay_dropped_rate: MetricData;
  stream_interrupts_rate: MetricData;
  error_rate: MetricData;
  sla_compliance: MetricData;
  uptime_percentage: MetricData;
}

export default function PerformanceDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Fetch metrics from API
  const fetchMetrics = async () => {
    try {
      const response = await fetch('/api/metrics/dashboard');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setMetrics(data.metrics);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch metrics');
      console.error('Dashboard metrics fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-50 border-green-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getTrendIcon = (trend?: string): string => {
    switch (trend) {
      case 'up': return '↗️';
      case 'down': return '↘️';
      case 'stable': return '→';
      default: return '';
    }
  };

  const formatValue = (value: number, unit: string): string => {
    if (unit === 'ms') {
      return `${value.toFixed(1)}ms`;
    } else if (unit === '%') {
      return `${value.toFixed(2)}%`;
    } else if (unit === 'rate') {
      return `${value.toFixed(2)}/min`;
    }
    return `${value.toFixed(2)}`;
  };

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-sm border">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-sm border">
        <div className="text-center">
          <div className="text-red-600 mb-2">⚠️ Dashboard Error</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchMetrics}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="p-6 bg-white rounded-lg shadow-sm border">
        <div className="text-center text-gray-600">No metrics data available</div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-sm border">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">EchoStone Performance Dashboard</h2>
        <div className="text-sm text-gray-500">
          Last updated: {lastUpdated?.toLocaleTimeString()}
        </div>
      </div>

      {/* SLA Overview */}
      <div className="mb-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">SLA Compliance</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-blue-700 font-medium">TTS Latency</div>
            <div className="text-blue-600">&lt; {SLA_THRESHOLDS.TTS_FIRST_BYTE_MAX_MS}ms</div>
          </div>
          <div>
            <div className="text-blue-700 font-medium">Memory Fetch</div>
            <div className="text-blue-600">&lt; {SLA_THRESHOLDS.MEMORY_FETCH_MAX_MS}ms</div>
          </div>
          <div>
            <div className="text-blue-700 font-medium">Expression Timing</div>
            <div className="text-blue-600">&lt; {SLA_THRESHOLDS.EXPRESSION_TIMING_MAX_MS}ms</div>
          </div>
          <div>
            <div className="text-blue-700 font-medium">Uptime</div>
            <div className="text-blue-600">&gt; {SLA_THRESHOLDS.UPTIME_MIN_PERCENTAGE}%</div>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(metrics).map(([key, metric]) => (
          <div
            key={key}
            className={`p-4 rounded-lg border-2 ${getStatusColor(metric.status)}`}
          >
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-medium text-sm uppercase tracking-wide">
                {metric.name}
              </h4>
              <span className="text-lg">{getTrendIcon(metric.trend)}</span>
            </div>
            
            <div className="text-2xl font-bold mb-1">
              {formatValue(metric.value, metric.unit)}
            </div>
            
            {metric.threshold && (
              <div className="text-xs opacity-75">
                Threshold: {formatValue(metric.threshold, metric.unit)}
              </div>
            )}
            
            <div className="mt-2">
              <div className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                metric.status === 'healthy' ? 'bg-green-100 text-green-800' :
                metric.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {metric.status.toUpperCase()}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mt-8 flex gap-4">
        <button
          onClick={fetchMetrics}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Refresh Metrics
        </button>
        <button
          onClick={() => window.open('/api/metrics/export', '_blank')}
          className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
        >
          Export Data
        </button>
        <a
          href={process.env.NEXT_PUBLIC_GRAFANA_URL || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
        >
          View Grafana
        </a>
      </div>

      {/* System Status Indicators */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">System Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${
              metrics.sla_compliance.status === 'healthy' ? 'bg-green-500' : 
              metrics.sla_compliance.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
            }`}></div>
            <span className="text-sm">SLA Compliance</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${
              metrics.tts_first_byte_avg.status === 'healthy' ? 'bg-green-500' : 
              metrics.tts_first_byte_avg.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
            }`}></div>
            <span className="text-sm">TTS Performance</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${
              metrics.memory_fetch_avg.status === 'healthy' ? 'bg-green-500' : 
              metrics.memory_fetch_avg.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
            }`}></div>
            <span className="text-sm">Memory Service</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${
              metrics.error_rate.status === 'healthy' ? 'bg-green-500' : 
              metrics.error_rate.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
            }`}></div>
            <span className="text-sm">Error Rate</span>
          </div>
        </div>
      </div>
    </div>
  );
}