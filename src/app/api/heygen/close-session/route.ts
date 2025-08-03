import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    if (!process.env.HEYGEN_API_KEY) {
      return NextResponse.json({ error: 'HeyGen API key not configured' }, { status: 500 });
    }

    console.log('🔚 Closing HeyGen session:', sessionId);

    const response = await fetch('https://api.heygen.com/v1/streaming.stop', {
      method: 'POST',
      headers: {
        'X-Api-Key': process.env.HEYGEN_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('HeyGen close session error:', errorText);
      // Don't throw error for close - it might already be closed
      return NextResponse.json({ 
        warning: 'Session may already be closed',
        details: errorText 
      });
    }

    const data = await response.json();
    
    return NextResponse.json({
      status: 'closed',
      data: data.data,
    });

  } catch (error) {
    console.error('HeyGen close session error:', error);
    return NextResponse.json({ error: 'Failed to close HeyGen session' }, { status: 500 });
  }
}