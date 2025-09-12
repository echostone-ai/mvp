// src/app/api/admin/story-analytics/route.ts
// Admin-level story analytics API endpoint

import { NextRequest, NextResponse } from 'next/server';
import { StoryAnalyticsService } from '@/lib/services/storyAnalyticsService';

export async function GET(request: NextRequest) {
  try {
    // TODO: Add admin authentication check
    // For now, we'll assume this is behind proper authentication middleware
    
    const analyticsService = StoryAnalyticsService.getInstance();
    const adminAnalytics = await analyticsService.getAdminAnalytics();
    
    return NextResponse.json({
      analytics: adminAnalytics,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Error fetching admin story analytics:', error);
    return NextResponse.json({
      error: 'Failed to fetch admin analytics',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// Health check endpoint
export async function HEAD(request: NextRequest) {
  return new NextResponse(null, { status: 200 });
}