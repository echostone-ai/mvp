/**
 * Conversation Analytics API
 * Provides endpoints for conversation analysis and optimization
 */

import { NextRequest, NextResponse } from 'next/server';
import { ConversationAnalyticsService } from '@/lib/services/conversationAnalytics';
import { ConversationOptimizationService } from '@/lib/services/conversationOptimizationService';
import { UserEngagementTracker } from '@/lib/services/userEngagementTracker';

const analyticsService = ConversationAnalyticsService.getInstance();
const optimizationService = ConversationOptimizationService.getInstance();
const engagementTracker = UserEngagementTracker.getInstance();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');
    const userId = searchParams.get('userId');
    const sessionId = searchParams.get('sessionId');
    const type = searchParams.get('type') || 'analysis';

    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 }
      );
    }

    switch (type) {
      case 'analysis':
        const analysis = analyticsService.analyzeConversationFlow(conversationId);
        return NextResponse.json({ analysis });

      case 'engagement':
        if (!userId || !sessionId) {
          return NextResponse.json(
            { error: 'userId and sessionId are required for engagement metrics' },
            { status: 400 }
          );
        }
        const engagementMetrics = engagementTracker.getEngagementMetrics(userId, sessionId, conversationId);
        return NextResponse.json({ engagementMetrics });

      case 'quality':
        const qualityMetrics = engagementTracker.getQualityMetrics(conversationId);
        return NextResponse.json({ qualityMetrics });

      case 'optimization':
        if (!userId || !sessionId) {
          return NextResponse.json(
            { error: 'userId and sessionId are required for optimization report' },
            { status: 400 }
          );
        }
        const optimizationReport = optimizationService.generateOptimizationReport(conversationId, userId, sessionId);
        return NextResponse.json({ optimizationReport });

      case 'dashboard':
        const dashboard = optimizationService.getOptimizationDashboard();
        return NextResponse.json({ dashboard });

      default:
        return NextResponse.json(
          { error: 'Invalid type parameter' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, conversationId, userId, sessionId, data } = body;

    switch (action) {
      case 'record_turn':
        if (!conversationId || !data) {
          return NextResponse.json(
            { error: 'conversationId and turn data are required' },
            { status: 400 }
          );
        }
        analyticsService.recordConversationTurn(conversationId, data);
        return NextResponse.json({ success: true });

      case 'record_event':
        if (!userId || !sessionId || !conversationId || !data) {
          return NextResponse.json(
            { error: 'userId, sessionId, conversationId, and event data are required' },
            { status: 400 }
          );
        }
        engagementTracker.recordEvent({
          userId,
          sessionId,
          conversationId,
          eventType: data.eventType,
          data: data.eventData,
          context: data.context
        });
        return NextResponse.json({ success: true });

      case 'start_tracking':
        if (!userId || !sessionId || !conversationId) {
          return NextResponse.json(
            { error: 'userId, sessionId, and conversationId are required' },
            { status: 400 }
          );
        }
        engagementTracker.startTracking(userId, sessionId, conversationId);
        return NextResponse.json({ success: true });

      case 'stop_tracking':
        if (!userId || !sessionId || !conversationId) {
          return NextResponse.json(
            { error: 'userId, sessionId, and conversationId are required' },
            { status: 400 }
          );
        }
        const finalMetrics = engagementTracker.stopTracking(userId, sessionId, conversationId);
        return NextResponse.json({ finalMetrics });

      case 'apply_optimizations':
        if (!conversationId || !data?.suggestions) {
          return NextResponse.json(
            { error: 'conversationId and suggestions are required' },
            { status: 400 }
          );
        }
        const appliedOptimizations = optimizationService.applyOptimizationSuggestions(conversationId, data.suggestions);
        return NextResponse.json({ appliedOptimizations });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Analytics API POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}