/**
 * Extraction Metrics Debug Endpoint
 * 
 * Provides comprehensive performance metrics, health status, and monitoring
 * data for the fact extraction pipeline. Restricted to development environments.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ExtractionPerformanceMonitor } from '../../../../lib/services/extractionPerformanceMonitor';
import { ExtractionErrorHandler } from '../../../../lib/services/extractionErrorHandler';

export async function GET(request: NextRequest) {
  // Restrict to development environments
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Debug endpoints not available in production' },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get('format') || 'dashboard';
    const timeRange = searchParams.get('timeRange') || '1h';

    const monitor = ExtractionPerformanceMonitor.getInstance();

    switch (format) {
      case 'dashboard':
        return NextResponse.json({
          success: true,
          data: monitor.getDashboardMetrics(),
          timestamp: new Date().toISOString()
        });

      case 'pipeline':
        return NextResponse.json({
          success: true,
          data: monitor.getPipelinePerformanceMetrics(),
          timestamp: new Date().toISOString()
        });

      case 'database':
        return NextResponse.json({
          success: true,
          data: monitor.getDatabasePerformanceMetrics(),
          timestamp: new Date().toISOString()
        });

      case 'system':
        return NextResponse.json({
          success: true,
          data: monitor.getSystemResourceMetrics(),
          timestamp: new Date().toISOString()
        });

      case 'extraction':
        return NextResponse.json({
          success: true,
          data: ExtractionErrorHandler.getExtractionMetrics(),
          timestamp: new Date().toISOString()
        });

      case 'health':
        const pipelineHealth = ExtractionErrorHandler.getExtractionHealthReport();
        const dashboardMetrics = monitor.getDashboardMetrics();
        
        return NextResponse.json({
          success: true,
          data: {
            overall_health_score: dashboardMetrics.health_score,
            pipeline_health: pipelineHealth,
            active_alerts: monitor.getActiveAlerts(),
            system_healthy: dashboardMetrics.health_score > 70,
            recommendations: pipelineHealth.recommendations
          },
          timestamp: new Date().toISOString()
        });

      case 'alerts':
        const includeResolved = searchParams.get('includeResolved') === 'true';
        const alerts = includeResolved ? monitor.getAllAlerts() : monitor.getActiveAlerts();
        
        return NextResponse.json({
          success: true,
          data: {
            alerts,
            active_count: monitor.getActiveAlerts().length,
            total_count: monitor.getAllAlerts().length
          },
          timestamp: new Date().toISOString()
        });

      case 'export':
        return NextResponse.json({
          success: true,
          data: monitor.exportMetrics(),
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json(
          { 
            error: 'Invalid format parameter',
            available_formats: ['dashboard', 'pipeline', 'database', 'system', 'extraction', 'health', 'alerts', 'export']
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error fetching extraction metrics:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch extraction metrics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Restrict to development environments
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Debug endpoints not available in production' },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { action, ...params } = body;

    const monitor = ExtractionPerformanceMonitor.getInstance();

    switch (action) {
      case 'start_monitoring':
        const interval = params.intervalMs || 60000;
        monitor.startMonitoring(interval);
        
        return NextResponse.json({
          success: true,
          message: `Monitoring started with ${interval}ms interval`,
          timestamp: new Date().toISOString()
        });

      case 'stop_monitoring':
        monitor.stopMonitoring();
        
        return NextResponse.json({
          success: true,
          message: 'Monitoring stopped',
          timestamp: new Date().toISOString()
        });

      case 'resolve_alert':
        if (!params.alertId) {
          return NextResponse.json(
            { error: 'alertId parameter required' },
            { status: 400 }
          );
        }
        
        const resolved = monitor.resolveAlert(params.alertId);
        
        return NextResponse.json({
          success: resolved,
          message: resolved ? 'Alert resolved' : 'Alert not found or already resolved',
          timestamp: new Date().toISOString()
        });

      case 'update_alert_config':
        if (!params.config) {
          return NextResponse.json(
            { error: 'config parameter required' },
            { status: 400 }
          );
        }
        
        monitor.updateAlertConfig(params.config);
        
        return NextResponse.json({
          success: true,
          message: 'Alert configuration updated',
          config: params.config,
          timestamp: new Date().toISOString()
        });

      case 'reset_metrics':
        monitor.resetMonitoringData();
        ExtractionErrorHandler.resetAllMetrics();
        
        return NextResponse.json({
          success: true,
          message: 'All metrics reset',
          timestamp: new Date().toISOString()
        });

      case 'record_test_data':
        // For testing purposes - record sample performance data
        const stage = params.stage || 'end_to_end';
        const duration = params.duration_ms || Math.random() * 5000 + 1000;
        const success = params.success !== false;
        const metadata = params.metadata || {};
        
        monitor.recordExtractionPerformance(stage, duration, success, metadata);
        
        return NextResponse.json({
          success: true,
          message: 'Test data recorded',
          data: { stage, duration, success, metadata },
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json(
          { 
            error: 'Invalid action parameter',
            available_actions: [
              'start_monitoring', 
              'stop_monitoring', 
              'resolve_alert', 
              'update_alert_config', 
              'reset_metrics',
              'record_test_data'
            ]
          },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error processing extraction metrics request:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to process request',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}