// src/app/api/voice/route.ts
import { NextResponse } from 'next/server'

export const runtime = 'edge'

export async function POST(req: Request) {
  try {
    const { text, voiceId, userId } = await req.json()

    if (!text) {
      return NextResponse.json({ error: 'Missing text to synthesize' }, { status: 400 })
    }

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
          text: text,
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
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