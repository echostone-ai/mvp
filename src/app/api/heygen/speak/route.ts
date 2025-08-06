import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, text, voiceId } = await request.json();

    if (!sessionId || !text) {
      console.error('❌ Missing required parameters:', { hasSessionId: !!sessionId, hasText: !!text });
      return NextResponse.json({ error: 'sessionId and text are required' }, { status: 400 });
    }

    if (!process.env.HEYGEN_API_KEY) {
      console.error('❌ HeyGen API key not configured');
      return NextResponse.json({ error: 'HeyGen API key not configured' }, { status: 500 });
    }

    const textPreview = text.length > 100 ? text.substring(0, 100) + '...' : text;
    console.log('🎤 Sending EXACT text to HeyGen avatar to REPEAT:', textPreview);
    console.log('📋 Task details:', {
      sessionId: sessionId,
      textLength: text.length,
      taskType: 'repeat',
      taskMode: 'sync'
    });
    console.log('📝 FULL TEXT being sent:', text);

    const requestBody = {
      session_id: sessionId,
      text: text,
      task_type: 'repeat'
    };

    const heygenResponse = await fetch('https://api.heygen.com/v1/streaming.task', {
      method: 'POST',
      headers: {
        'X-Api-Key': process.env.HEYGEN_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await heygenResponse.text();

    if (!heygenResponse.ok) {
      console.error('❌ HeyGen task error:', {
        status: heygenResponse.status,
        statusText: heygenResponse.statusText,
        body: responseText
      });
      return NextResponse.json({ 
        error: 'Failed to send task to HeyGen',
        details: responseText,
        status: heygenResponse.status
      }, { status: heygenResponse.status });
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Failed to parse HeyGen task response:', responseText);
      return NextResponse.json({ error: 'Invalid JSON response from HeyGen' }, { status: 500 });
    }
    
    if (!result.data) {
      console.error('❌ Invalid HeyGen task response structure:', result);
      return NextResponse.json({ error: 'Invalid response structure from HeyGen' }, { status: 500 });
    }

    console.log('✅ HeyGen task submitted successfully:', {
      taskId: result.data.task_id,
      status: result.data.status,
      textLength: text.length,
      fullResponse: result
    });
    
    // Check if the task was actually accepted
    if (result.data.status === 'failed' || result.data.status === 'error') {
      console.error('❌ HeyGen task failed:', result.data);
      return NextResponse.json({ 
        error: 'HeyGen task failed',
        details: result.data
      }, { status: 400 });
    }
    
    return NextResponse.json({
      task_id: result.data.task_id,
      status: result.data.status,
      message: result.data.message || 'Task submitted successfully'
    });

  } catch (error) {
    console.error('❌ HeyGen speak unexpected error:', error);
    return NextResponse.json({ 
      error: 'Failed to make avatar speak',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}