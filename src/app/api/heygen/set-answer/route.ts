import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { session_id, sdp } = await request.json();

    if (!session_id || !sdp) {
      console.error('❌ Missing required parameters:', { hasSessionId: !!session_id, hasSdp: !!sdp });
      return NextResponse.json({ error: 'session_id and sdp are required' }, { status: 400 });
    }

    if (!process.env.HEYGEN_API_KEY) {
      console.error('❌ Missing HeyGen API key');
      return NextResponse.json({ error: 'HeyGen API key not configured' }, { status: 500 });
    }

    console.log('🔄 Setting HeyGen session answer...');

    const response = await fetch('https://api.heygen.com/v1/streaming.start', {
      method: 'POST',
      headers: {
        'X-Api-Key': process.env.HEYGEN_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: session_id,
        sdp: sdp,
      }),
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      console.error('❌ HeyGen set answer error:', {
        status: response.status,
        statusText: response.statusText,
        body: responseText
      });
      return NextResponse.json({ 
        error: 'Failed to set HeyGen answer',
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
    
    console.log('✅ HeyGen answer set successfully');
    
    return NextResponse.json({
      success: true,
      data: data
    });

  } catch (error) {
    console.error('❌ HeyGen set answer unexpected error:', error);
    return NextResponse.json({ 
      error: 'Failed to set HeyGen answer',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}