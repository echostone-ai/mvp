import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

/**
 * API endpoint to test if a voice exists in ElevenLabs
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get user session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ 
        error: 'Authentication required'
      }, { status: 401 });
    }

    const { voiceId } = await request.json();

    if (!voiceId) {
      return NextResponse.json({ error: 'Voice ID is required' }, { status: 400 });
    }

    // Get ElevenLabs API key
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY || process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
    if (!elevenLabsApiKey) {
      return NextResponse.json({ 
        error: 'ElevenLabs API key not configured'
      }, { status: 500 });
    }

    try {
      console.log(`Testing voice existence for voice ID: ${voiceId}`);
      
      // Check if the voice exists in ElevenLabs
      const voiceResponse = await fetch(`https://api.elevenlabs.io/v1/voices/${voiceId}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'xi-api-key': elevenLabsApiKey
        }
      });

      if (!voiceResponse.ok) {
        const errorText = await voiceResponse.text();
        console.error('Voice check failed:', {
          status: voiceResponse.status,
          statusText: voiceResponse.statusText,
          error: errorText,
          voiceId
        });
        
        let errorMessage = 'Voice not found';
        if (voiceResponse.status === 404) {
          errorMessage = 'Voice does not exist in ElevenLabs';
        } else if (voiceResponse.status === 401) {
          errorMessage = 'Invalid ElevenLabs API key';
        } else if (voiceResponse.status === 403) {
          errorMessage = 'Access denied to this voice';
        }
        
        return NextResponse.json({ 
          error: errorMessage,
          details: `HTTP ${voiceResponse.status}: ${errorText}`,
          voiceId
        }, { status: voiceResponse.status });
      }

      const voiceData = await voiceResponse.json();
      console.log('Voice found:', {
        name: voiceData.name,
        voice_id: voiceData.voice_id,
        category: voiceData.category
      });

      return NextResponse.json({
        success: true,
        name: voiceData.name,
        voice_id: voiceData.voice_id,
        category: voiceData.category,
        available_for_tiers: voiceData.available_for_tiers,
        settings: voiceData.settings
      });

    } catch (elevenLabsError) {
      console.error('ElevenLabs API error:', elevenLabsError);
      return NextResponse.json({ 
        error: 'Failed to communicate with ElevenLabs',
        details: elevenLabsError instanceof Error ? elevenLabsError.message : 'Unknown error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Voice test error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}