import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { token, sdp } = await request.json();

    if (!token || !sdp) {
      console.error('❌ Missing required parameters:', { hasToken: !!token, hasSdp: !!sdp });
      return NextResponse.json({ error: 'token and sdp are required' }, { status: 400 });
    }

    if (!process.env.HEYGEN_API_KEY || !process.env.HEYGEN_AVATAR_ID) {
      console.error('❌ Missing HeyGen configuration:', {
        hasApiKey: !!process.env.HEYGEN_API_KEY,
        hasAvatarId: !!process.env.HEYGEN_AVATAR_ID
      });
      return NextResponse.json({ error: 'HeyGen configuration not complete' }, { status: 500 });
    }

    console.log('🚀 Starting HeyGen streaming session...');
    console.log('📋 Configuration:', {
      avatarId: process.env.HEYGEN_AVATAR_ID,
      voiceId: process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID || 'CO6pxVrMZfyL61ZIglyr',
      quality: 'high'
    });

    const requestBody = {
      session_token: token,
      avatar_id: process.env.HEYGEN_AVATAR_ID,
      sdp: sdp,
      quality: 'high',
      voice: {
        voice_id: process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID || 'CO6pxVrMZfyL61ZIglyr',
        provider: 'elevenlabs'
      }
    };

    const response = await fetch('https://api.heygen.com/v1/streaming.start', {
      method: 'POST',
      headers: {
        'X-Api-Key': process.env.HEYGEN_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      console.error('❌ HeyGen start session error:', {
        status: response.status,
        statusText: response.statusText,
        body: responseText
      });
      return NextResponse.json({ 
        error: 'Failed to start HeyGen session',
        details: responseText,
        status: response.status
      }, { status: response.status });
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('❌ Failed to parse HeyGen response:', responseText);
      return NextResponse.json({ error: 'Invalid JSON response from HeyGen' }, { status: 500 });
    }
    
    if (!data.data) {
      console.error('❌ Invalid HeyGen start response structure:', data);
      return NextResponse.json({ error: 'Invalid response structure from HeyGen' }, { status: 500 });
    }

    console.log('✅ HeyGen session started successfully:', {
      sessionId: data.data.session_id,
      hasIceServers: !!(data.data.ice_servers && data.data.ice_servers.length > 0)
    });
    
    return NextResponse.json({
      sdp: data.data.sdp,
      session_id: data.data.session_id,
      ice_servers: data.data.ice_servers || [],
    });

  } catch (error) {
    console.error('❌ HeyGen start session unexpected error:', error);
    return NextResponse.json({ 
      error: 'Failed to start HeyGen session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}