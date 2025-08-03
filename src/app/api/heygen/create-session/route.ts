import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    if (!process.env.HEYGEN_API_KEY) {
      return NextResponse.json({ error: 'HeyGen API key not configured' }, { status: 500 });
    }

    console.log('🎭 Creating HeyGen streaming session...');

    const response = await fetch('https://api.heygen.com/v1/streaming.create_token', {
      method: 'POST',
      headers: {
        'X-Api-Key': process.env.HEYGEN_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('HeyGen API error:', errorText);
      return NextResponse.json({ error: 'Failed to create HeyGen session' }, { status: 500 });
    }

    const data = await response.json();
    
    return NextResponse.json({
      token: data.data.token,
      expires_at: data.data.expires_at,
    });

  } catch (error) {
    console.error('HeyGen session error:', error);
    return NextResponse.json({ error: 'Failed to create HeyGen session' }, { status: 500 });
  }
}