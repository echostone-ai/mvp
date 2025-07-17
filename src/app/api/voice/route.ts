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
  
  // Analyze text content for emotional cues
  const textLower = text.toLowerCase()
  const isQuestion = text.includes('?')
  const isExclamation = text.includes('!')
  const isLong = text.length > 100
  
  // Adjust based on emotional style
  switch (emotionalStyle) {
    case 'excited':
      stability = 0.3 + Math.random() * 0.2 // 0.3-0.5 (less stable = more energetic)
      style = 0.4 + Math.random() * 0.3 // 0.4-0.7 (higher style = more expressive)
      break
    case 'sad':
      stability = 0.7 + Math.random() * 0.2 // 0.7-0.9 (more stable = calmer)
      style = 0.1 + Math.random() * 0.2 // 0.1-0.3 (lower style = more subdued)
      break
    case 'angry':
      stability = 0.2 + Math.random() * 0.3 // 0.2-0.5 (less stable = more intense)
      style = 0.5 + Math.random() * 0.3 // 0.5-0.8 (higher style = more passionate)
      break
    case 'nervous':
      stability = 0.3 + Math.random() * 0.3 // 0.3-0.6 (variable stability)
      style = 0.2 + Math.random() * 0.3 // 0.2-0.5 (moderate style)
      break
    case 'playful':
      stability = 0.4 + Math.random() * 0.3 // 0.4-0.7 (moderate variation)
      style = 0.3 + Math.random() * 0.4 // 0.3-0.7 (varied expression)
      break
    case 'reflective':
      stability = 0.6 + Math.random() * 0.2 // 0.6-0.8 (more stable = thoughtful)
      style = 0.2 + Math.random() * 0.2 // 0.2-0.4 (moderate style)
      break
    default:
      // Add natural variation even for default
      stability = 0.4 + Math.random() * 0.3 // 0.4-0.7
      style = 0.2 + Math.random() * 0.3 // 0.2-0.5
  }
  
  // Content-based adjustments
  if (isQuestion) {
    style += 0.1 // Questions get slightly more expressive
  }
  
  if (isExclamation) {
    stability -= 0.1 // Exclamations get less stable (more energetic)
    style += 0.1 // More expressive
  }
  
  if (isLong) {
    stability += 0.1 // Longer text gets more stable for consistency
  }
  
  // Emotional content detection
  if (textLower.includes('love') || textLower.includes('amazing') || textLower.includes('wonderful')) {
    style += 0.1 // Positive emotions get more expressive
  }
  
  if (textLower.includes('sorry') || textLower.includes('sad') || textLower.includes('difficult')) {
    stability += 0.1 // Sad content gets more stable
    style -= 0.1 // Less expressive
  }
  
  // Clamp values to valid ranges
  stability = Math.max(0.1, Math.min(0.9, stability))
  similarityBoost = Math.max(0.1, Math.min(1.0, similarityBoost))
  style = Math.max(0.1, Math.min(1.0, style))
  
  return {
    stability: Math.round(stability * 100) / 100, // Round to 2 decimal places
    similarity_boost: Math.round(similarityBoost * 100) / 100,
    style: Math.round(style * 100) / 100,
    use_speaker_boost: true
  }
}

export async function POST(req: Request) {
  try {
    const { text, voiceId, userId, emotionalStyle } = await req.json()

    if (!text) {
      return NextResponse.json({ error: 'Missing text to synthesize' }, { status: 400 })
    }

    // Clean text of fake laughs and artificial expressions
    const cleanedText = cleanTextForVoice(text)

    // Default voiceId logic
    let resolvedVoiceId = voiceId
    if (!resolvedVoiceId) {
      if (userId === 'bucky') {
        // Replace with Bucky's voice ID if available
        // resolvedVoiceId = 'BUCKY_VOICE_ID'
      } else {
        resolvedVoiceId = 'CO6pxVrMZfyL61ZIglyr' // Jonathan's cloned voice ID
      }
    }

    // Generate dynamic voice settings based on emotional style and content
    const voiceSettings = generateVoiceSettings(cleanedText, emotionalStyle)

    const apiKey = process.env.ELEVENLABS_API_KEY!

    // Call ElevenLabs TTS API with resolved voiceId
    const apiRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${resolvedVoiceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text: cleanedText,
          voice_settings: voiceSettings,
        }),
      }
    )

    if (!apiRes.ok) {
      const errText = await apiRes.text().catch(() => 'Unknown error')
      console.error('ElevenLabs TTS API error:', errText)
      return NextResponse.json({ error: errText }, { status: apiRes.status })
    }

    const buffer = await apiRes.arrayBuffer()

    // Return raw mp3 audio bytes as response
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    console.error('Voice route failed:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}