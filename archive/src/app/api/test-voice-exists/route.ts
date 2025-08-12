import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

/**
 * API endpoint to test if a voice exists in ElevenLabs
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Try to get session from cookies first
    let session = null;
    let user = null;
    
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      session = sessionData.session;
      user = session?.user;
    } catch (sessionErr) {
      console.error('Session error:', sessionErr);
    }
    
    // If no session from cookies, try Authorization header
    if (!user) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const { data: userData, error: userError } = await supabase.auth.getUser(token);
          user = userData.user;
        } catch (tokenErr) {
          console.error('Token error:', tokenErr);
        }
      }
    }
    
    if (!user) {
      return NextResponse.json({ 
        error: 'Authentication required. Please sign in and refresh the page.',
        details: 'No valid session or token found'
      }, { status: 401 });
    }

    // Get request body
    const { voiceId } = await request.json();
    
    if (!voiceId) {
      return NextResponse.json({ 
        error: 'Voice ID is required'
      }, { status: 400 });
    }

    // Get ElevenLabs API key
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY || process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
    if (!elevenLabsApiKey) {
      return NextResponse.json({ 
        error: 'ElevenLabs API key not configured'
      }, { status: 500 });
    }

    try {
      console.log(`Testing if voice ${voiceId} exists in ElevenLabs...`);
      
      // Get specific voice from ElevenLabs
      const voiceResponse = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'xi-api-key': elevenLabsApiKey
        }
      });

      if (!voiceResponse.ok) {
        const errorText = await voiceResponse.text();
        console.error('Voice test failed:', {
          status: voiceResponse.status,
          statusText: voiceResponse.statusText,
          error: errorText
        });
        
        return NextResponse.json({ 
          error: 'Voice not found in ElevenLabs',
          details: `HTTP ${voiceResponse.status}: ${errorText}`
        }, { status: voiceResponse.status });
      }

      const voiceData = await voiceResponse.json();
      console.log(`Voice ${voiceId} found: ${voiceData.name}`);

      return NextResponse.json({
        success: true,
        voice_id: voiceData.voice_id,
        name: voiceData.name,
        category: voiceData.category,
        available_for_tiers: voiceData.available_for_tiers
      });

    } catch (elevenLabsError) {
      console.error('ElevenLabs API error:', elevenLabsError);
      return NextResponse.json({ 
        error: 'Failed to communicate with ElevenLabs',
        details: elevenLabsError instanceof Error ? elevenLabsError.message : 'Unknown error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Test voice exists error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 