/**
 * A/B Testing API
 * Provides endpoints for managing A/B tests and experiments
 */

import { NextRequest, NextResponse } from 'next/server';
import { ABTestingFramework } from '@/lib/services/abTestingFramework';

const abTestingFramework = ABTestingFramework.getInstance();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const testId = searchParams.get('testId');
    const userId = searchParams.get('userId');

    switch (action) {
      case 'list_tests':
        const activeTests = abTestingFramework.getActiveTests();
        return NextResponse.json({ tests: activeTests });

      case 'get_assignment':
        if (!userId || !testId) {
          return NextResponse.json(
            { error: 'userId and testId are required' },
            { status: 400 }
          );
        }
        const assignment = abTestingFramework.getUserTestAssignment(userId, testId);
        return NextResponse.json({ assignment });

      case 'get_configuration':
        if (!userId || !testId) {
          return NextResponse.json(
            { error: 'userId and testId are required' },
            { status: 400 }
          );
        }
        const configuration = abTestingFramework.getTestConfiguration(userId, testId);
        return NextResponse.json({ configuration });

      case 'analyze_results':
        if (!testId) {
          return NextResponse.json(
            { error: 'testId is required' },
            { status: 400 }
          );
        }
        const results = abTestingFramework.analyzeTestResults(testId);
        return NextResponse.json({ results });

      default:
        return NextResponse.json(
          { error: 'Invalid action parameter' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('A/B Testing API GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'create_test':
        const { config } = body;
        if (!config) {
          return NextResponse.json(
            { error: 'Test configuration is required' },
            { status: 400 }
          );
        }
        const testId = abTestingFramework.createTest(config);
        return NextResponse.json({ testId });

      case 'start_test':
        const { testId: startTestId } = body;
        if (!startTestId) {
          return NextResponse.json(
            { error: 'testId is required' },
            { status: 400 }
          );
        }
        const started = abTestingFramework.startTest(startTestId);
        return NextResponse.json({ success: started });

      case 'assign_user':
        const { userId, testId: assignTestId, sessionId } = body;
        if (!userId || !assignTestId) {
          return NextResponse.json(
            { error: 'userId and testId are required' },
            { status: 400 }
          );
        }
        const assignment = abTestingFramework.assignUserToTest(userId, assignTestId, sessionId);
        return NextResponse.json({ assignment });

      case 'record_metrics':
        const { userId: metricsUserId, testId: metricsTestId, metrics } = body;
        if (!metricsUserId || !metricsTestId || !metrics) {
          return NextResponse.json(
            { error: 'userId, testId, and metrics are required' },
            { status: 400 }
          );
        }
        abTestingFramework.recordTestMetrics(metricsUserId, metricsTestId, metrics);
        return NextResponse.json({ success: true });

      case 'complete_test':
        const { testId: completeTestId } = body;
        if (!completeTestId) {
          return NextResponse.json(
            { error: 'testId is required' },
            { status: 400 }
          );
        }
        const results = abTestingFramework.completeTest(completeTestId);
        return NextResponse.json({ results });

      case 'create_voice_test':
        const voiceTestId = abTestingFramework.createVoiceSettingsTest();
        const voiceStarted = abTestingFramework.startTest(voiceTestId);
        return NextResponse.json({ testId: voiceTestId, started: voiceStarted });

      case 'create_expression_test':
        const expressionTestId = abTestingFramework.createExpressionTimingTest();
        const expressionStarted = abTestingFramework.startTest(expressionTestId);
        return NextResponse.json({ testId: expressionTestId, started: expressionStarted });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('A/B Testing API POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}