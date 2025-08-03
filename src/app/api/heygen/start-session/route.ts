import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, sdp } = await request.json();

    if (!sessionId || !sdp) {
      return NextResponse.json({ error: 'sessionId and sdp are required' }, { status: 400 });
    }

    if (!process.env.HEYGEN_API_KEY || !process.env.HEYGEN_AVATAR_ID) {
      return NextResponse.json({ error: 'HeyGen configuration not complete' }, { status: 500 });
    }

    console.log('🚀 Starting HeyGen session with avatar...');

    const response = await fetch('https://api.heygen.com/v1/streaming.start', {
      method: 'POST',
      headers: {
        'X-Api-Key': process.env.HEYGEN_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId,
        avatar_id: process.env.HEYGEN_AVATAR_ID,
        sdp: sdp,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('HeyGen start session error:', errorText);
      return NextResponse.json({ error: 'Failed to start HeyGen session' }, { status: 500 });
    }

    const data = await response.json();
    
    return NextResponse.json({
      sdp: data.data.sdp,
      session_id: data.data.session_id,
    });

  } catch (error) {
    console.error('HeyGen start session error:', error);
    return NextResponse.json({ error: 'Failed to start HeyGen session' }, { status: 500 });
  }
}