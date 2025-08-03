import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { token, sdp } = await request.json();

    if (!token || !sdp) {
      return NextResponse.json({ error: 'token and sdp are required' }, { status: 400 });
    }

    if (!process.env.HEYGEN_API_KEY || !process.env.HEYGEN_AVATAR_ID) {
      return NextResponse.json({ error: 'HeyGen configuration not complete' }, { status: 500 });
    }

    console.log('🚀 Starting HeyGen streaming session...');

    const response = await fetch('https://api.heygen.com/v1/streaming.start', {
      method: 'POST',
      headers: {
        'X-Api-Key': process.env.HEYGEN_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_token: token,
        avatar_id: process.env.HEYGEN_AVATAR_ID,
        sdp: sdp,
        quality: 'high', // Options: low, medium, high
        voice: {
          voice_id: process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID || 'CO6pxVrMZfyL61ZIglyr',
          provider: 'elevenlabs'
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('HeyGen start session error:', errorText);
      return NextResponse.json({ 
        error: 'Failed to start HeyGen session',
        details: errorText 
      }, { status: response.status });
    }

    const data = await response.json();
    
    if (!data.data) {
      console.error('Invalid HeyGen start response:', data);
      return NextResponse.json({ error: 'Invalid response from HeyGen' }, { status: 500 });
    }
    
    return NextResponse.json({
      sdp: data.data.sdp,
      session_id: data.data.session_id,
      ice_servers: data.data.ice_servers || [],
    });

  } catch (error) {
    console.error('HeyGen start session error:', error);
    return NextResponse.json({ error: 'Failed to start HeyGen session' }, { status: 500 });
  }
}