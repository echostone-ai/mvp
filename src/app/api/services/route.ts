/**
 * Background Services Management API
 * 
 * Provides endpoints for managing background services including
 * fact promotion processing, health monitoring, and configuration.
 * 
 * Requirements: 9.1, 9.7 - Service management and monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { backgroundServiceManager } from '@/lib/services/backgroundServiceManager';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'health':
        const health = await backgroundServiceManager.getHealthStatus();
        return NextResponse.json(health);

      case 'config':
        const config = backgroundServiceManager.getConfig();
        return NextResponse.json(config);

      case 'ready':
        const isReady = backgroundServiceManager.isReady();
        return NextResponse.json({ 
          ready: isReady,
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: health, config, or ready' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Services API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, ...params } = await request.json();

    switch (action) {
      case 'initialize':
        if (backgroundServiceManager.isReady()) {
          return NextResponse.json({ 
            message: 'Services already initialized',
            timestamp: new Date().toISOString()
          });
        }

        await backgroundServiceManager.initialize(params.config);
        return NextResponse.json({ 
          message: 'Background services initialized',
          timestamp: new Date().toISOString()
        });

      case 'shutdown':
        await backgroundServiceManager.shutdown();
        return NextResponse.json({ 
          message: 'Background services shut down',
          timestamp: new Date().toISOString()
        });

      case 'restart':
        await backgroundServiceManager.shutdown();
        await backgroundServiceManager.initialize(params.config);
        return NextResponse.json({ 
          message: 'Background services restarted',
          timestamp: new Date().toISOString()
        });

      case 'update-config':
        backgroundServiceManager.updateConfig(params.config);
        return NextResponse.json({ 
          message: 'Configuration updated. Restart required for changes to take effect.',
          timestamp: new Date().toISOString()
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: initialize, shutdown, restart, or update-config' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Services API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function HEAD() {
  const health = await backgroundServiceManager.getHealthStatus();
  const isHealthy = health.initialized && health.services.factPromotion.healthy;
  
  return new NextResponse(null, { 
    status: isHealthy ? 200 : 503,
    headers: {
      'X-Service-Health': isHealthy ? 'healthy' : 'unhealthy',
      'X-Service-Initialized': health.initialized ? 'true' : 'false'
    }
  });
}