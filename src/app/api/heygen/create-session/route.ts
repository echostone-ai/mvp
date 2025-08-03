import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    if (!process.env.HEYGEN_API_KEY) {
      return NextResponse.json({ error: 'HeyGen API key not configured' }, { status: 500 });
    }

    console.log('🎭 Creating HeyGen streaming token...');

    const response = await fetch('https://api.heygen.com/v1/streaming.create_token', {
      method: 'POST',
      headers: {
        'X-Api-Key': process.env.HEYGEN_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // Optional: Add any token creation parameters here
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('HeyGen create token error:', errorText);
      return NextResponse.json({ 
        error: 'Failed to create HeyGen token',
        details: errorText 
      }, { status: response.status });
    }

    const data = await response.json();
    
    if (!data.data || !data.data.token) {
      console.error('Invalid HeyGen token response:', data);
      return NextResponse.json({ error: 'Invalid token response from HeyGen' }, { status: 500 });
    }
    
    return NextResponse.json({
      token: data.data.token,
      expires_at: data.data.expires_at,
    });

  } catch (error) {
    console.error('HeyGen token creation error:', error);
    return NextResponse.json({ error: 'Failed to create HeyGen token' }, { status: 500 });
  }
}