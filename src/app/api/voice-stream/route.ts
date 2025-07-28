// src/app/api/voice-stream/route.ts
import { NextResponse } from 'next/server'
import { getOptimizedVoiceSettings } from '@/lib/voiceSettings'

export const runtime = 'edge'

/**
 * Clean text of fake laughs and artificial expressions that sound bad in TTS
 */
function cleanTextForVoice(text: string): string {
  return text
    // Remove fake laughs
    .replace(/\bhaha\b/gi, '')
    .replace(/\blol\b/gi, '')
    .replace(/\blmao\b/gi, '')
    .replace(/\brofl\b/gi, '')
    // Remove artificial expressions
    .replace(/\*laughs\*/gi, '')
    .replace(/\*chuckles\*/gi, '')
    .replace(/\*giggles\*/gi, '')
    .replace(/\*nervous laughter\*/gi, '')
    // Remove excessive punctuation that sounds weird
    .replace(/\.{3,}/g, '..') // Limit ellipses to 2 dots max
    .replace(/!{2,}/g, '!') // Limit exclamations to 1
    .replace(/\?{2,}/g, '?') // Limit questions to 1
    // Clean up extra spaces
    .replace(/\s+/g, ' ')
    .trim()
}

// Create a simple audio buffer for fallback
function createFallbackAudioBuffer(): ArrayBuffer {
  // This creates a minimal valid MP3 file that's essentially silent
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
    const { sentence, voiceId, settings, emotionalContext, accent } = await req.json()
    
    console.log('Voice stream generation:', { 
      sentenceLength: sentence?.length,
      voiceId: voiceId?.substring(0, 8) + '...',
      hasOptimizedSettings: !!settings
    })
    
    if (!sentence) {
      return NextResponse.json({ error: 'Sentence is required' }, { status: 400 })
    }
    
    // Use provided voiceId or fallback to environment variable
    const finalVoiceId = voiceId || process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID || process.env.ELEVENLABS_VOICE_ID || 'CO6pxVrMZfyL61ZIglyr'
    
    if (!finalVoiceId) {
      console.warn('No voice ID provided, using fallback audio');
      return new NextResponse(createFallbackAudioBuffer(), {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }
    
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
    
    // Clean the text for better voice quality
    const cleanedText = cleanTextForVoice(sentence)
    
    // Use provided settings or get optimized defaults for voice cloning
    const voiceSettings = getOptimizedVoiceSettings(settings)
    
    // Call ElevenLabs API
    const requestBody: any = {
      text: cleanedText,
      model_id: 'eleven_turbo_v2',
      voice_settings: voiceSettings,
    };
    if (accent) {
      requestBody.accent = accent;
    }
    
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${finalVoiceId}/stream`,
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
      return new NextResponse(createFallbackAudioBuffer(), {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }
    
    // Return the audio stream
    const audioData = await response.arrayBuffer()
    
    return new NextResponse(audioData, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    })
  } catch (error: any) {
    console.error('Voice stream generation error:', error)
    
    // Return fallback audio instead of an error
    return new NextResponse(createFallbackAudioBuffer(), {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  }
}