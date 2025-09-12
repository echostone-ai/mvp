/**
 * Dashboard API endpoint for GPT-5 Avatar Memory System monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { monitoringService } from '@/lib/services/monitoringService';
import { AnalyticsService } from '@/lib/services/analyticsService';
import { DashboardService } from '@/lib/services/dashboardService';

const analyticsService = new AnalyticsService(monitoringService);
const dashboardService = new DashboardService(monitoringService, analyticsService);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'overview';
    const hours = parseInt(searchParams.get('hours') || '24');
    const format = searchParams.get('format') || 'json';

    switch (type) {
      case 'overview':
        const dashboardData = await dashboardService.getDashboardData();
        return NextResponse.json(dashboardData);

      case 'performance':
        const performanceData = dashboardService.getPerformanceChartData(hours);
        return NextResponse.json(performanceData);

      case 'health':
        const healthChecks = await dashboardService.getSystemHealthChecks();
        return NextResponse.json(healthChecks);

      case 'analytics':
        const analyticsReport = analyticsService.generateAnalyticsReport(Math.floor(hours / 24) || 1);
        return NextResponse.json(analyticsReport);

      case 'avatars':
        const avatarIds = searchParams.get('avatarIds')?.split(',') || [];
        if (avatarIds.length > 0) {
          const comparisonData = dashboardService.getAvatarComparisonData(avatarIds, hours);
          return NextResponse.json(comparisonData);
        } else {
          const avatarProfiles = analyticsService.generateAvatarProfiles(hours);
          return NextResponse.json(avatarProfiles);
        }

      case 'usage':
        const days = Math.floor(hours / 24) || 1;
        const usagePatterns = analyticsService.analyzeUsagePatterns(days);
        return NextResponse.json(usagePatterns);

      case 'heatmap':
        const heatmapDays = Math.floor(hours / 24) || 30;
        const heatmapData = dashboardService.getUsageHeatmapData(heatmapDays);
        return NextResponse.json(heatmapData);

      case 'export':
        const exportData = dashboardService.exportDashboardData(format as 'json' | 'csv');
        
        if (format === 'csv') {
          return new NextResponse(exportData, {
            headers: {
              'Content-Type': 'text/csv',
              'Content-Disposition': 'attachment; filename="dashboard-data.csv"'
            }
          });
        }
        
        return NextResponse.json(JSON.parse(exportData));

      default:
        return NextResponse.json(
          { error: 'Invalid dashboard type' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data } = body;

    switch (type) {
      case 'performance':
        monitoringService.recordPerformanceMetrics(data);
        return NextResponse.json({ success: true });

      case 'accuracy':
        monitoringService.recordAccuracyMetrics(data);
        return NextResponse.json({ success: true });

      case 'quality':
        monitoringService.recordConversationQuality(data);
        return NextResponse.json({ success: true });

      case 'system':
        monitoringService.recordSystemHealth(data);
        return NextResponse.json({ success: true });

      case 'alert':
        const { alertId } = data;
        const resolved = monitoringService.resolveAlert(alertId);
        return NextResponse.json({ success: resolved });

      default:
        return NextResponse.json(
          { error: 'Invalid monitoring type' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Dashboard POST API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}