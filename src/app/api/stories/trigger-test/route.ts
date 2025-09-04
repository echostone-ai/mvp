/**
 * Test endpoint for story trigger matching
 */

import { NextRequest, NextResponse } from 'next/server';
import { storyIntegrationService } from '@/lib/services/storyIntegrationService';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, avatarId, userId } = body;

    if (!message || !avatarId) {
      return NextResponse.json(
        { error: 'Missing message or avatarId' },
        { status: 400 }
      );
    }

    console.log('[TriggerTest] Testing message:', message);
    console.log('[TriggerTest] Avatar ID:', avatarId);
    console.log('[TriggerTest] User ID:', userId);

    // Test story trigger matching
    const storyCheck = await storyIntegrationService.checkForStoryTrigger(message, {
      enableStories: true,
      avatarId,
      userId
    });

    console.log('[TriggerTest] Story check result:', storyCheck);

    return NextResponse.json({
      success: true,
      message,
      avatarId,
      userId,
      storyCheck
    });

  } catch (error) {
    console.error('[TriggerTest] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}