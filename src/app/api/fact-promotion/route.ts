/**
 * Fact Promotion Management API
 * 
 * Provides endpoints for managing the fact promotion background service,
 * monitoring queue status, and manual processing operations.
 * 
 * Requirements: 9.1, 9.7 - API for service management and monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { factPromotionService } from '@/lib/services/factPromotionService';
import { ensureServicesInitialized } from '@/lib/startup';

export async function GET(request: NextRequest) {
  try {
    // Ensure background services are initialized
    await ensureServicesInitialized();

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'status':
        const status = await factPromotionService.getStatus();
        return NextResponse.json(status);

      case 'health':
        const isHealthy = factPromotionService.isHealthy();
        return NextResponse.json({ 
          healthy: isHealthy,
          timestamp: new Date().toISOString()
        });

      case 'avatar-stats':
        const avatarId = searchParams.get('avatarId');
        if (!avatarId) {
          return NextResponse.json(
            { error: 'avatarId parameter required' },
            { status: 400 }
          );
        }
        
        const avatarStats = await factPromotionService.getAvatarPromotionStats(avatarId);
        return NextResponse.json(avatarStats);

      case 'performance':
        const performanceMetrics = factPromotionService.getPerformanceMetrics();
        return NextResponse.json(performanceMetrics);

      case 'queue-backlog':
        const backlogInfo = await factPromotionService.getQueueBacklog();
        return NextResponse.json(backlogInfo);

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: status, health, avatar-stats, performance, or queue-backlog' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Fact promotion API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Ensure background services are initialized
    await ensureServicesInitialized();

    const { action, ...params } = await request.json();

    switch (action) {
      case 'start':
        factPromotionService.startProcessor(params.config);
        return NextResponse.json({ 
          message: 'Fact promotion processor started',
          timestamp: new Date().toISOString()
        });

      case 'stop':
        await factPromotionService.stopProcessor();
        return NextResponse.json({ 
          message: 'Fact promotion processor stopped',
          timestamp: new Date().toISOString()
        });

      case 'process-fragment':
        const { fragmentId, avatarId, text } = params;
        if (!fragmentId || !avatarId || !text) {
          return NextResponse.json(
            { error: 'fragmentId, avatarId, and text are required' },
            { status: 400 }
          );
        }

        const result = await factPromotionService.processFragmentImmediately(
          fragmentId,
          avatarId,
          text
        );
        return NextResponse.json(result);

      case 'cleanup':
        const olderThanDays = params.olderThanDays || 7;
        const deletedCount = await factPromotionService.cleanupOldJobs(olderThanDays);
        return NextResponse.json({ 
          message: `Cleaned up ${deletedCount} old jobs`,
          deletedCount,
          timestamp: new Date().toISOString()
        });

      case 'reset-stats':
        factPromotionService.resetStats();
        return NextResponse.json({ 
          message: 'Processor statistics reset',
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: start, stop, process-fragment, cleanup, or reset-stats' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Fact promotion API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function HEAD() {
  const isHealthy = factPromotionService.isHealthy();
  return new NextResponse(null, { 
    status: isHealthy ? 200 : 503,
    headers: {
      'X-Service-Health': isHealthy ? 'healthy' : 'unhealthy'
    }
  });
}