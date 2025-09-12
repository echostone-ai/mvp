/**
 * Runtime kill switch endpoint for factbook feature flags
 * Allows immediate switching between factbook and legacy memory systems
 */

import { NextRequest, NextResponse } from 'next/server';
import { featureFlagManager } from '../../../../lib/config/featureFlags';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Simple authentication check - in production, use proper auth
function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const adminKey = process.env.ADMIN_API_KEY;
  
  if (!adminKey) {
    console.warn('kill_switch_no_admin_key', 'ADMIN_API_KEY not configured');
    return false;
  }
  
  return authHeader === `Bearer ${adminKey}`;
}

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const flags = featureFlagManager.getFeatureFlags();
    const killSwitchStatus = featureFlagManager.getKillSwitchStatus();

    return NextResponse.json({
      success: true,
      current_flags: flags,
      kill_switch_status: killSwitchStatus,
      should_use_factbook: featureFlagManager.shouldUseFactbook(),
      should_use_legacy: featureFlagManager.shouldUseLegacyMemory(),
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('kill_switch_get_error', error);
    return NextResponse.json(
      { error: 'Failed to get kill switch status', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, reason } = body;

    switch (action) {
      case 'disable_factbook':
        featureFlagManager.setKillSwitch({
          disableFactbook: true,
          reason: reason || 'Manual kill switch activation',
        });
        break;

      case 'force_fallback':
        featureFlagManager.setKillSwitch({
          forceFallback: true,
          reason: reason || 'Manual fallback activation',
        });
        break;

      case 'emergency_disable':
        featureFlagManager.setKillSwitch({
          disableFactbook: true,
          forceFallback: true,
          reason: reason || 'Emergency disable - switch to legacy pipeline',
        });
        break;

      case 'clear':
        featureFlagManager.clearKillSwitch();
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: disable_factbook, force_fallback, emergency_disable, clear' },
          { status: 400 }
        );
    }

    const updatedFlags = featureFlagManager.getFeatureFlags();
    const killSwitchStatus = featureFlagManager.getKillSwitchStatus();

    // Log the change for monitoring
    console.log('kill_switch_action_executed', {
      action,
      reason,
      updated_flags: updatedFlags,
      kill_switch_status: killSwitchStatus,
      timestamp: Date.now(),
    });

    return NextResponse.json({
      success: true,
      action_executed: action,
      reason,
      updated_flags: updatedFlags,
      kill_switch_status: killSwitchStatus,
      should_use_factbook: featureFlagManager.shouldUseFactbook(),
      should_use_legacy: featureFlagManager.shouldUseLegacyMemory(),
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('kill_switch_post_error', error);
    return NextResponse.json(
      { error: 'Failed to execute kill switch action', details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { disableFactbook, forceFallback, reason } = body;

    featureFlagManager.setKillSwitch({
      disableFactbook: Boolean(disableFactbook),
      forceFallback: Boolean(forceFallback),
      reason: reason || 'Manual configuration update',
    });

    const updatedFlags = featureFlagManager.getFeatureFlags();
    const killSwitchStatus = featureFlagManager.getKillSwitchStatus();

    console.log('kill_switch_configuration_updated', {
      disable_factbook: disableFactbook,
      force_fallback: forceFallback,
      reason,
      updated_flags: updatedFlags,
      timestamp: Date.now(),
    });

    return NextResponse.json({
      success: true,
      updated_flags: updatedFlags,
      kill_switch_status: killSwitchStatus,
      should_use_factbook: featureFlagManager.shouldUseFactbook(),
      should_use_legacy: featureFlagManager.shouldUseLegacyMemory(),
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error('kill_switch_put_error', error);
    return NextResponse.json(
      { error: 'Failed to update kill switch configuration', details: error.message },
      { status: 500 }
    );
  }
}