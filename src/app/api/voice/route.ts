// src/app/api/voice/route.ts
import { NextResponse } from 'next/server'

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
 * Generate dynamic voice settings based on content and emotional style
 */
function generateVoiceSettings(text: string, emotionalStyle?: string) {
  // Base settings
  let stability = 0.5
  let similarityBoost = 0.75
  let style = 0.2
  
  // Adjust based on emotional context
  if (emotionalStyle) {
    const lowerStyle = emotionalStyle.toLowerCase()
    
    if (lowerStyle.includes('excited') || lowerStyle.includes('happy')) {
      stability = 0.4
      similarityBoost = 0.8
      style = 0.35
    } else if (lowerStyle.includes('sad') || lowerStyle.includes('somber')) {
      stability = 0.7
      similarityBoost = 0.6
      style = 0.15
    } else if (lowerStyle.includes('angry') || lowerStyle.includes('frustrated')) {
      stability = 0.3
      similarityBoost = 0.9
      style = 0.4
    } else if (lowerStyle.includes('calm') || lowerStyle.includes('relaxed')) {
      stability = 0.6
      similarityBoost = 0.7
      style = 0.1
    }
  }
  
  // Adjust based on text content
  if (text.includes('?')) {
    // Questions should have more variation
    stability -= 0.05
    style += 0.05
  }
  
  if (text.includes('!')) {
    // Exclamations should be more expressive
    stability -= 0.1
    style += 0.1
  }
  
  // Ensure values stay within bounds
  stability = Math.max(0.1, Math.min(stability, 0.9))
  similarityBoost = Math.max(0.1, Math.min(similarityBoost, 0.9))
  style = Math.max(0.1, Math.min(style, 0.9))
  
  return {
    stability,
    similarity_boost: similarityBoost,
    style,
    use_speaker_boost: true
  }
}

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
    const { text, voiceId, settings, emotionalContext } = await req.json()
    
    console.log('Voice API request:', { 
      textLength: text?.length,
      voiceIdProvided: !!voiceId,
      actualVoiceId: voiceId,
      settingsProvided: !!settings,
      emotionalContextProvided: !!emotionalContext
    })
    
    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
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
    
    // Clean the text for better voice quality
    const cleanedText = cleanTextForVoice(text)
    
    // Generate voice settings based on content and emotional context
    const voiceSettings = settings || generateVoiceSettings(cleanedText, emotionalContext)
    
    // Call ElevenLabs API
    console.log('Calling ElevenLabs API...');
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${finalVoiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text: cleanedText,
          model_id: 'eleven_turbo_v2',
          voice_settings: voiceSettings,
        }),
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