import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

/**
 * API endpoint to list all voices in ElevenLabs account
 */
export async function GET(request: NextRequest) {
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

    // Get ElevenLabs API key
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY || process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
    if (!elevenLabsApiKey) {
      return NextResponse.json({ 
        error: 'ElevenLabs API key not configured'
      }, { status: 500 });
    }

    try {
      console.log('Listing all voices in ElevenLabs account...');
      
      // Get all voices from ElevenLabs
      const voicesResponse = await fetch('https://api.elevenlabs.io/v1/voices', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'xi-api-key': elevenLabsApiKey
        }
      });

      if (!voicesResponse.ok) {
        const errorText = await voicesResponse.text();
        console.error('Voices list failed:', {
          status: voicesResponse.status,
          statusText: voicesResponse.statusText,
          error: errorText
        });
        
        return NextResponse.json({ 
          error: 'Failed to list voices',
          details: `HTTP ${voicesResponse.status}: ${errorText}`
        }, { status: voicesResponse.status });
      }

      const voicesData = await voicesResponse.json();
      console.log(`Found ${voicesData.voices?.length || 0} voices in account`);

      return NextResponse.json({
        success: true,
        voices: voicesData.voices?.map((voice: any) => ({
          voice_id: voice.voice_id,
          name: voice.name,
          category: voice.category,
          available_for_tiers: voice.available_for_tiers
        })) || []
      });

    } catch (elevenLabsError) {
      console.error('ElevenLabs API error:', elevenLabsError);
      return NextResponse.json({ 
        error: 'Failed to communicate with ElevenLabs',
        details: elevenLabsError instanceof Error ? elevenLabsError.message : 'Unknown error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('List voices error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}