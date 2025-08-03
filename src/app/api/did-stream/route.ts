import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { avatarId } = await request.json();

    if (!process.env.DID_API_KEY) {
      return NextResponse.json({ error: 'D-ID API key not configured' }, { status: 500 });
    }

    console.log('🎭 Creating D-ID streaming session...');

    // Create D-ID streaming session
    const didResponse = await fetch('https://api.d-id.com/talks/streams', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${process.env.DID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source_url: avatarId || 'https://create-images-results.d-id.com/DefaultPresenters/Noelle_f/image.jpeg',
        driver_url: 'bank://lively/',
      }),
    });

    if (!didResponse.ok) {
      const errorText = await didResponse.text();
      console.error('D-ID API error:', errorText);
      return NextResponse.json({ error: 'Failed to create D-ID stream' }, { status: 500 });
    }

    const streamData = await didResponse.json();
    
    return NextResponse.json({
      streamId: streamData.id,
      sessionId: streamData.session_id,
      offer: streamData.offer,
      iceServers: streamData.ice_servers,
    });

  } catch (error) {
    console.error('D-ID stream error:', error);
    return NextResponse.json({ error: 'Failed to create D-ID stream' }, { status: 500 });
  }
}