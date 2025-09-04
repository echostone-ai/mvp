// src/app/api/stories/analytics/route.ts
// API endpoints for story analytics and usage insights

import { NextRequest, NextResponse } from 'next/server';
import { StoryAnalyticsService } from '@/lib/services/storyAnalyticsService';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ownerId = searchParams.get('ownerId');
    const ownerType = searchParams.get('ownerType') as 'user' | 'avatar';
    const storyId = searchParams.get('storyId');
    const type = searchParams.get('type') || 'aggregated';

    if (!ownerId || !ownerType) {
      return NextResponse.json({
        error: 'Missing required parameters: ownerId and ownerType',
      }, { status: 400 });
    }

    const analyticsService = StoryAnalyticsService.getInstance();

    switch (type) {
      case 'story':
        if (!storyId) {
          return NextResponse.json({
            error: 'storyId required for story analytics',
          }, { status: 400 });
        }
        
        const storyReport = await analyticsService.getStoryUsageReport(storyId);
        return NextResponse.json({ report: storyReport });

      case 'effectiveness':
        const effectivenessMetrics = await analyticsService.getStoryEffectivenessMetrics(ownerId, ownerType);
        return NextResponse.json({ metrics: effectivenessMetrics });

      case 'aggregated':
      default:
        const aggregatedAnalytics = await analyticsService.getAggregatedAnalytics(ownerId, ownerType);
        return NextResponse.json({ analytics: aggregatedAnalytics });
    }
  } catch (error) {
    console.error('Error fetching story analytics:', error);
    return NextResponse.json({
      error: 'Failed to fetch analytics',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      storyId,
      sessionId,
      triggerText,
      matchedKeywords,
      confidenceScore,
      playedSuccessfully,
      playbackDurationMs,
      errorMessage,
    } = body;

    if (!storyId || !sessionId || !triggerText) {
      return NextResponse.json({
        error: 'Missing required fields: storyId, sessionId, triggerText',
      }, { status: 400 });
    }

    const analyticsService = StoryAnalyticsService.getInstance();
    
    await analyticsService.recordStoryTrigger({
      storyId,
      sessionId,
      triggerText,
      matchedKeywords: matchedKeywords || [],
      confidenceScore: confidenceScore || 0,
      playedSuccessfully: playedSuccessfully || false,
      playbackDurationMs: playbackDurationMs || null,
      errorMessage: errorMessage || null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error recording story analytics:', error);
    return NextResponse.json({
      error: 'Failed to record analytics',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}