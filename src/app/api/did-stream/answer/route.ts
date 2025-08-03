import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { streamId, sessionId, answer } = await request.json();

    if (!streamId || !sessionId || !answer) {
      return NextResponse.json({ error: 'streamId, sessionId, and answer are required' }, { status: 400 });
    }

    if (!process.env.DID_API_KEY) {
      return NextResponse.json({ error: 'D-ID API key not configured' }, { status: 500 });
    }

    // Send WebRTC answer to D-ID
    const response = await fetch(`https://api.d-id.com/talks/streams/${streamId}/sdp`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${process.env.DID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session_id: sessionId,
        answer,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('D-ID SDP answer error:', errorText);
      return NextResponse.json({ error: 'Failed to send SDP answer' }, { status: 500 });
    }

    const result = await response.json();
    return NextResponse.json(result);

  } catch (error) {
    console.error('D-ID SDP answer error:', error);
    return NextResponse.json({ error: 'Failed to send SDP answer' }, { status: 500 });
  }
}