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
  
  // Enhanced emotional style mapping with more nuanced parameters
  switch (emotionalStyle) {
    // Core Positive Emotions
    case 'happy':
      stability = 0.30 + Math.random() * 0.15 // 0.30-0.45 (energetic but controlled)
      style = 0.70 + Math.random() * 0.20 // 0.70-0.90 (highly expressive)
      similarityBoost = 0.70 + Math.random() * 0.10 // 0.70-0.80
      break
    case 'excited':
      stability = 0.15 + Math.random() * 0.20 // 0.15-0.35 (very dynamic)
      style = 0.80 + Math.random() * 0.15 // 0.80-0.95 (maximum expression)
      similarityBoost = 0.60 + Math.random() * 0.15 // 0.60-0.75
      break
    case 'playful':
      stability = 0.25 + Math.random() * 0.25 // 0.25-0.50 (varied and fun)
      style = 0.75 + Math.random() * 0.20 // 0.75-0.95 (very expressive)
      similarityBoost = 0.65 + Math.random() * 0.15 // 0.65-0.80
      break
    case 'confident':
      stability = 0.55 + Math.random() * 0.20 // 0.55-0.75 (steady and strong)
      style = 0.50 + Math.random() * 0.20 // 0.50-0.70 (moderately expressive)
      similarityBoost = 0.80 + Math.random() * 0.10 // 0.80-0.90
      break
    case 'romantic':
      stability = 0.45 + Math.random() * 0.20 // 0.45-0.65 (warm and flowing)
      style = 0.60 + Math.random() * 0.20 // 0.60-0.80 (expressive but controlled)
      similarityBoost = 0.75 + Math.random() * 0.10 // 0.75-0.85
      break
    
    // Calm & Reflective
    case 'calm':
      stability = 0.75 + Math.random() * 0.15 // 0.75-0.90 (very stable)
      style = 0.15 + Math.random() * 0.20 // 0.15-0.35 (subtle expression)
      similarityBoost = 0.85 + Math.random() * 0.10 // 0.85-0.95
      break
    case 'serious':
      stability = 0.70 + Math.random() * 0.20 // 0.70-0.90 (controlled and focused)
      style = 0.10 + Math.random() * 0.20 // 0.10-0.30 (minimal expression)
      similarityBoost = 0.90 + Math.random() * 0.05 // 0.90-0.95
      break
    case 'nostalgic':
      stability = 0.60 + Math.random() * 0.20 // 0.60-0.80 (gentle and reflective)
      style = 0.35 + Math.random() * 0.20 // 0.35-0.55 (moderate expression)
      similarityBoost = 0.80 + Math.random() * 0.10 // 0.80-0.90
      break
    case 'mysterious':
      stability = 0.65 + Math.random() * 0.20 // 0.65-0.85 (controlled intrigue)
      style = 0.45 + Math.random() * 0.20 // 0.45-0.65 (subtle expression)
      similarityBoost = 0.75 + Math.random() * 0.15 // 0.75-0.90
      break
    
    // Intense Emotions
    case 'sad':
      stability = 0.80 + Math.random() * 0.15 // 0.80-0.95 (very controlled)
      style = 0.20 + Math.random() * 0.20 // 0.20-0.40 (subdued expression)
      similarityBoost = 0.80 + Math.random() * 0.10 // 0.80-0.90
      break
    case 'angry':
      stability = 0.15 + Math.random() * 0.25 // 0.15-0.40 (highly variable)
      style = 0.70 + Math.random() * 0.25 // 0.70-0.95 (intense expression)
      similarityBoost = 0.55 + Math.random() * 0.15 // 0.55-0.70
      break
    case 'surprised':
      stability = 0.20 + Math.random() * 0.25 // 0.20-0.45 (dynamic reaction)
      style = 0.65 + Math.random() * 0.25 // 0.65-0.90 (high expression)
      similarityBoost = 0.65 + Math.random() * 0.15 // 0.65-0.80
      break
    case 'determined':
      stability = 0.50 + Math.random() * 0.20 // 0.50-0.70 (focused energy)
      style = 0.55 + Math.random() * 0.20 // 0.55-0.75 (strong expression)
      similarityBoost = 0.80 + Math.random() * 0.10 // 0.80-0.90
      break
    
    // Creative & Unique
    case 'whimsical':
      stability = 0.30 + Math.random() * 0.25 // 0.30-0.55 (playfully variable)
      style = 0.60 + Math.random() * 0.25 // 0.60-0.85 (creative expression)
      similarityBoost = 0.70 + Math.random() * 0.15 // 0.70-0.85
      break
    case 'sarcastic':
      stability = 0.40 + Math.random() * 0.25 // 0.40-0.65 (controlled wit)
      style = 0.55 + Math.random() * 0.25 // 0.55-0.80 (expressive delivery)
      similarityBoost = 0.75 + Math.random() * 0.10 // 0.75-0.85
      break
    
    // Legacy support
    case 'nervous':
      stability = 0.25 + Math.random() * 0.30 // 0.25-0.55 (variable)
      style = 0.40 + Math.random() * 0.30 // 0.40-0.70 (moderate expression)
      similarityBoost = 0.70 + Math.random() * 0.15 // 0.70-0.85
      break
    case 'reflective':
      stability = 0.65 + Math.random() * 0.20 // 0.65-0.85 (thoughtful)
      style = 0.25 + Math.random() * 0.25 // 0.25-0.50 (moderate expression)
      similarityBoost = 0.80 + Math.random() * 0.10 // 0.80-0.90
      break
    
    default:
      // Enhanced natural variation for neutral/default
      stability = 0.45 + Math.random() * 0.30 // 0.45-0.75
      style = 0.25 + Math.random() * 0.35 // 0.25-0.60
      similarityBoost = 0.75 + Math.random() * 0.15 // 0.75-0.90
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
    const { text, voiceId, userId, emotionalStyle, settings } = await req.json()

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

    // Use passed settings if available, otherwise generate dynamic settings
    let voiceSettings
    if (settings && Object.keys(settings).length > 0) {
      // Use the specific settings passed from the frontend (for voice tuning)
      voiceSettings = {
        stability: settings.stability || 0.5,
        similarity_boost: settings.similarity_boost || 0.75,
        style: settings.style || 0.2,
        use_speaker_boost: settings.use_speaker_boost !== undefined ? settings.use_speaker_boost : true
      }
    } else {
      // Generate dynamic voice settings based on emotional style and content
      voiceSettings = generateVoiceSettings(cleanedText, emotionalStyle)
    }

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