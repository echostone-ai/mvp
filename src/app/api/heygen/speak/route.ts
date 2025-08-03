import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, text, voiceId } = await request.json();

    if (!sessionId || !text) {
      return NextResponse.json({ error: 'sessionId and text are required' }, { status: 400 });
    }

    if (!process.env.HEYGEN_API_KEY) {
      return NextResponse.json({ error: 'HeyGen API key not configured' }, { status: 500 });
    }

    console.log('🎤 Sending text to HeyGen avatar:', text.substring(0, 50) + '...');

    // Send text directly to HeyGen - it will handle TTS with the configured voice
    const heygenResponse = await fetch('https://api.heygen.com/v1/streaming.task', {
      method: 'POST',
      headers: {
        'X-Api-Key': process.env.HEYGEN_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId,
        text: text,
        task_type: 'talk', // Specify task type
        task_mode: 'sync', // Use sync mode for immediate response
      }),
    });

    if (!heygenResponse.ok) {
      const errorText = await heygenResponse.text();
      console.error('HeyGen task error:', errorText);
      return NextResponse.json({ 
        error: 'Failed to send task to HeyGen',
        details: errorText 
      }, { status: heygenResponse.status });
    }

    const result = await heygenResponse.json();
    
    if (!result.data) {
      console.error('Invalid HeyGen task response:', result);
      return NextResponse.json({ error: 'Invalid response from HeyGen' }, { status: 500 });
    }
    
    return NextResponse.json({
      task_id: result.data.task_id,
      status: result.data.status,
    });

  } catch (error) {
    console.error('HeyGen speak error:', error);
    return NextResponse.json({ error: 'Failed to make avatar speak' }, { status: 500 });
  }
}