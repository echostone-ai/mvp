import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    if (!process.env.HEYGEN_API_KEY) {
      return NextResponse.json({ error: 'HeyGen API key not configured' }, { status: 500 });
    }

    console.log('🧹 Attempting to close all HeyGen sessions...');

    // List all active sessions first
    const response = await fetch('https://api.heygen.com/v1/streaming.list', {
      method: 'GET',
      headers: {
        'X-Api-Key': process.env.HEYGEN_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to list sessions:', errorText);
      return NextResponse.json({ 
        error: 'Failed to list sessions',
        details: errorText 
      }, { status: response.status });
    }

    const data = await response.json();
    console.log('Active sessions:', data);

    // Try to close any active sessions
    if (data.data && data.data.sessions && Array.isArray(data.data.sessions)) {
      const closedSessions = [];
      for (const session of data.data.sessions) {
        if (session.session_id) {
          try {
            const closeResponse = await fetch('https://api.heygen.com/v1/streaming.stop', {
              method: 'POST',
              headers: {
                'X-Api-Key': process.env.HEYGEN_API_KEY,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                session_id: session.session_id,
              }),
            });
            
            if (closeResponse.ok) {
              closedSessions.push(session.session_id);
              console.log('✅ Closed session:', session.session_id);
            }
          } catch (error) {
            console.warn('Failed to close session:', session.session_id, error);
          }
        }
      }
      
      return NextResponse.json({
        message: 'Session cleanup completed',
        closedSessions,
        totalSessions: data.data.sessions.length
      });
    }

    return NextResponse.json({
      message: 'No active sessions found',
      sessions: data
    });

  } catch (error) {
    console.error('Session cleanup error:', error);
    return NextResponse.json({ 
      error: 'Failed to cleanup sessions',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}