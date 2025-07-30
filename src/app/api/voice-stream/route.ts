// src/app/api/voice-stream/route.ts
import { NextResponse } from 'next/server'
import { createUnifiedVoiceRequest, getUnifiedVoiceSettings } from '@/lib/unifiedVoiceConfig'
import { normalizeTextForVoice } from '@/lib/voiceConsistency'
import { getNaturalVoiceSettings } from '@/lib/naturalVoiceSettings'

export const runtime = 'edge'

// Removed duplicate text normalization functions - using imported normalizeTextForVoice instead

/**
 * Generate a consistent seed for voice generation based on conversation context
 * This ensures all segments of a conversation use the same voice characteristics
 */
function generateConsistentSeed(conversationId?: string, voiceId?: string): number {
  // Use a completely fixed seed for maximum voice consistency
  // This ensures the same voice characteristics across all requests
  return 123456789; // Fixed seed for consistent voice
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
    const { sentence, voiceId, settings, emotionalContext, accent, conversationId, previousContext } = await req.json()
    
    console.log('Voice stream generation:', { 
      sentenceLength: sentence?.length,
      voiceId: voiceId?.substring(0, 8) + '...',
      hasOptimizedSettings: !!settings,
      hasContext: !!previousContext
    })
    
    console.log('Voice stream API Key check:', {
      has_public_key: !!process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY,
      has_private_key: !!process.env.ELEVENLABS_API_KEY,
      public_key_length: process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY?.length || 0,
      private_key_length: process.env.ELEVENLABS_API_KEY?.length || 0
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
    
    // TEMPORARILY DISABLE TEXT NORMALIZATION - use original text
    // const cleanedText = normalizeTextForVoice(sentence);
    
    // Use natural voice settings for more authentic voice reproduction
    const naturalSettings = settings || getNaturalVoiceSettings();
    const seed = generateConsistentSeed(conversationId || 'default', finalVoiceId);
    
    console.log('Voice stream request:', {
      voiceId: finalVoiceId,
      settings: naturalSettings,
      seed: seed,
      conversationId: conversationId || 'default'
    });
    
    const requestBody: any = {
      text: sentence, // Use original text without processing to preserve natural speech
      model_id: 'eleven_turbo_v2_5', // Use Turbo model for better voice consistency
      voice_settings: {
        ...naturalSettings,
        // Add speed parameter to match ElevenLabs interface
        speed: 1.0 // Fast speed (matches ElevenLabs "Faster" setting)
      },
      seed: seed, // Consistent seed for similar voice characteristics
      optimize_streaming_latency: 0, // Prioritize quality over speed for better voice consistency
      output_format: 'mp3_44100_128'
    };
    
    // Add previous context for better continuity (if supported)
    if (previousContext && previousContext.length > 0) {
      (requestBody as any).previous_text = previousContext.substring(-100); // Last 100 chars for context
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