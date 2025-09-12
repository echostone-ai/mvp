/**
 * Metrics API - Provides live metrics data for monitoring dashboard
 */

import { NextResponse } from 'next/server';
import { metricsCollector } from '@/lib/services/metricsCollector';
import { factbookService } from '@/lib/services/factbookService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const count = parseInt(url.searchParams.get('count') || '20');
    
    // Get recent chat metrics
    const chatMetrics = metricsCollector.getRecentChatMetrics(count);
    
    // Get factbook health
    let factbookHealth = metricsCollector.getFactbookHealth();
    
    // If no factbook health recorded yet, get current status
    if (!factbookHealth) {
      const factbook = factbookService.getInstance();
      const isLoaded = factbook.isLoaded();
      const snippetCount = isLoaded ? factbook.getSnippetCount() : 0;
      const indexSizeBytes = isLoaded ? factbook.getIndexSizeBytes() : 0;
      
      factbookHealth = {
        timestamp: Date.now(),
        is_loaded: isLoaded,
        snippet_count: snippetCount,
        index_size_bytes: indexSizeBytes,
        validation_errors: [],
        memory_usage_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        corruption_detected: false
      };
      
      metricsCollector.updateFactbookHealth(factbookHealth);
    }
    
    // Get system metrics
    const systemMetrics = metricsCollector.getSystemMetrics();
    
    // Get SLA metrics
    const slaMetrics = metricsCollector.getSLAMetrics();
    
    return NextResponse.json({
      chat_metrics: chatMetrics,
      factbook_health: factbookHealth,
      system_metrics: systemMetrics,
      sla_metrics: slaMetrics,
      timestamp: Date.now()
    });
    
  } catch (error) {
    console.error('metrics_api_error', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint for triggering factbook health check and atomic rebuild
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;
    
    if (action === 'rebuild_index') {
      const factbook = factbookService.getInstance();
      
      // Attempt atomic index rebuild
      const startTime = Date.now();
      const success = await factbook.rebuildIndex();
      const rebuildTime = Date.now() - startTime;
      
      if (success) {
        // Update health metrics after successful rebuild
        metricsCollector.updateFactbookHealth({
          is_loaded: true,
          snippet_count: factbook.getSnippetCount(),
          index_size_bytes: factbook.getIndexSizeBytes(),
          last_reload_ms: rebuildTime,
          validation_errors: [],
          memory_usage_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
          corruption_detected: false
        });
        
        return NextResponse.json({
          success: true,
          rebuild_time_ms: rebuildTime,
          snippet_count: factbook.getSnippetCount()
        });
      } else {
        return NextResponse.json(
          { error: 'Index rebuild failed' },
          { status: 500 }
        );
      }
    }
    
    if (action === 'health_check') {
      const factbook = factbookService.getInstance();
      const corruptionDetected = !factbook.validateIndex();
      
      metricsCollector.updateFactbookHealth({
        is_loaded: factbook.isLoaded(),
        snippet_count: factbook.getSnippetCount(),
        index_size_bytes: factbook.getIndexSizeBytes(),
        validation_errors: corruptionDetected ? ['Index validation failed'] : [],
        memory_usage_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        corruption_detected: corruptionDetected
      });
      
      return NextResponse.json({
        success: true,
        corruption_detected: corruptionDetected
      });
    }
    
    return NextResponse.json(
      { error: 'Unknown action' },
      { status: 400 }
    );
    
  } catch (error) {
    console.error('metrics_action_error', error);
    return NextResponse.json(
      { error: 'Action failed' },
      { status: 500 }
    );
  }
}