// src/app/api/voice/route.ts
import { NextResponse } from 'next/server'
import { createUnifiedVoiceRequest, getUnifiedVoiceSettings } from '@/lib/unifiedVoiceConfig'
import { normalizeTextForVoice } from '@/lib/voiceConsistency'
import { getNaturalVoiceSettings } from '@/lib/naturalVoiceSettings'

export const runtime = 'edge'

/**
 * Clean text of fake laughs and artificial expressions that sound bad in TTS
 */
// Create a simple audio buffer for fallback

// Create a simple audio buffer for fallback
function createFallbackAudioBuffer(): ArrayBuffer {
  // This creates a minimal valid MP3 file that's essentially silent
  // It's just enough to not cause errors in the audio player
  const buffer = new Uint8Array([
    0xFF, 0xFB, 0x90, 0x44, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
  ]);
  return buffer.buffer;
}

export async function POST(req: Request) {
  try {
    const { text, voiceId, settings, emotionalContext, accent } = await req.json()
    
    console.log('Voice generation:', { 
      textLength: text?.length,
      voiceId: voiceId?.substring(0, 8) + '...',
      hasOptimizedSettings: !!settings
    })
    
    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }
    
    // Use provided voiceId or fallback to environment variable
    const finalVoiceId = voiceId || process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID || process.env.ELEVENLABS_VOICE_ID || 'CO6pxVrMZfyL61ZIglyr'
    
    console.log('Voice ID selection:', {
      provided: voiceId,
      fallback_env_public: process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID,
      fallback_env_private: process.env.ELEVENLABS_VOICE_ID,
      final: finalVoiceId
    });
    
    console.log('API Key check:', {
      has_public_key: !!process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY,
      has_private_key: !!process.env.ELEVENLABS_API_KEY,
      public_key_length: process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY?.length || 0,
      private_key_length: process.env.ELEVENLABS_API_KEY?.length || 0
    });
    
    if (!finalVoiceId) {
      console.warn('No voice ID provided, using fallback audio');
      return new NextResponse(createFallbackAudioBuffer(), {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }
    
    console.log('Using voice ID:', finalVoiceId)
    
    const apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY
    
    if (!apiKey) {
      console.warn('ElevenLabs API key not configured, using fallback audio');
      return new NextResponse(createFallbackAudioBuffer(), {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }
    
    console.log('ElevenLabs API key available:', !!apiKey)
    
    // Use original text with minimal processing for natural voice
    const cleanedText = text.trim();
    
    // Use natural voice settings for authentic voice reproduction
    const naturalSettings = settings || getNaturalVoiceSettings();
    
    const requestBody: any = {
      text: cleanedText,
      model_id: 'eleven_multilingual_v2', // Use multilingual v2 model for high similarity
      voice_settings: naturalSettings,
    };
    
    // Call ElevenLabs API
    console.log('Calling ElevenLabs API with unified settings...');
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${finalVoiceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify(requestBody),
      }
    )
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('ElevenLabs API error:', errorText)
      
      // Return fallback audio instead of an error
      console.warn('ElevenLabs API error, using fallback audio');
      return new NextResponse(createFallbackAudioBuffer(), {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }
    
    // Return the audio stream
    const audioData = await response.arrayBuffer()
    console.log('Received audio data, size:', audioData.byteLength);
    
    return new NextResponse(audioData, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error: any) {
    console.error('Voice generation error:', error)
    
    // Return fallback audio instead of an error
    console.warn('Voice generation error, using fallback audio');
    return new NextResponse(createFallbackAudioBuffer(), {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  }
}