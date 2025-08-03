import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { taskId } = await request.json();

    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
    }

    if (!process.env.HEYGEN_API_KEY) {
      return NextResponse.json({ error: 'HeyGen API key not configured' }, { status: 500 });
    }

    const response = await fetch(`https://api.heygen.com/v1/streaming.task/${taskId}`, {
      method: 'GET',
      headers: {
        'X-Api-Key': process.env.HEYGEN_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('HeyGen task status error:', errorText);
      return NextResponse.json({ 
        error: 'Failed to get task status',
        details: errorText 
      }, { status: response.status });
    }

    const data = await response.json();
    
    return NextResponse.json({
      status: data.data.status,
      result: data.data.result,
    });

  } catch (error) {
    console.error('HeyGen task status error:', error);
    return NextResponse.json({ error: 'Failed to get task status' }, { status: 500 });
  }
}