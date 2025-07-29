// src/app/api/voice-stream/route.ts
import { NextResponse } from 'next/server'
import { getOptimizedVoiceSettings, getStreamingConsistencySettings } from '@/lib/voiceSettings'

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

/**
 * Normalize text for consistent voice generation across sentences
 */
function normalizeTextForConsistency(text: string, previousContext?: string): string {
  let normalized = cleanTextForVoice(text);
  
  // Normalize punctuation for consistent prosody
  normalized = normalized
    // Standardize ellipses
    .replace(/\.{2,}/g, '...')
    // Ensure consistent spacing after punctuation
    .replace(/([.!?])\s+/g, '$1 ')
    // Normalize quotation marks
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    // Remove multiple spaces
    .replace(/\s+/g, ' ')
    .trim();
  
  // Add context-aware normalization
  if (previousContext) {
    // If previous context ended with certain punctuation, adjust current text tone
    const lastChar = previousContext.trim().slice(-1);
    if (lastChar === '.' && !normalized.match(/^[A-Z]/)) {
      // Capitalize first letter if previous sentence ended with period
      normalized = normalized.charAt(0).toUpperCase() + normalized.slice(1);
    }
  }
  
  return normalized;
}

/**
 * Generate a consistent seed for voice generation based on conversation context
 */
function generateConsistentSeed(conversationId?: string, voiceId?: string): number {
  if (!conversationId || !voiceId) {
    // Use a fixed seed for consistency when no context available
    return 42;
  }
  
  // Create a simple hash from conversation and voice ID
  let hash = 0;
  const str = `${conversationId}-${voiceId}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Ensure positive number within reasonable range
  return Math.abs(hash) % 1000000;
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
    
    // Clean and normalize the text for consistent voice generation
    const cleanedText = normalizeTextForConsistency(sentence, previousContext)
    
    // Use streaming-optimized settings for maximum consistency
    const voiceSettings = settings || getStreamingConsistencySettings()
    
    // Generate a consistent seed based on conversation context
    const seed = generateConsistentSeed(conversationId, finalVoiceId)
    
    // Call ElevenLabs API with consistency optimizations
    const requestBody: any = {
      text: cleanedText,
      model_id: 'eleven_turbo_v2_5', // Use latest model for better consistency
      voice_settings: voiceSettings,
      seed: seed, // Consistent seed for similar voice characteristics
    };
    
    // Add previous context for better continuity (if supported)
    if (previousContext && previousContext.length > 0) {
      requestBody.previous_text = previousContext.substring(-100); // Last 100 chars for context
    }
    
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