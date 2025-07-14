import { NextResponse } from 'next/server'

export const runtime = 'edge'  // or 'nodejs' if you prefer server-side

export async function POST(request: Request) {
  try {
    const body = await request.json()
    let { text, voiceId, userId } = body

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    // Use default Jonathan voiceId if none provided
    if (!voiceId) {
      if (userId === 'bucky') {
        // Use different voice for Bucky if needed, else fallback to default
        voiceId = 'DEFAULT_BUCKY_VOICE_ID' // Replace with actual voice ID for Bucky or remove this line to fallback to Jonathan voice
      } else {
        voiceId = 'CO6pxVrMZfyL61ZIglyr' // Jonathan's cloned voice ID
      }
    }

    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
    }

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text: text,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75
        }
      })
    })

    if (!response.ok) {
      const errorDetails = await response.text()
      return NextResponse.json({ error: `ElevenLabs API error: ${errorDetails}` }, { status: response.status })
    }

    const audioBuffer = await response.arrayBuffer()

    return new Response(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': 'inline; filename="voice.mp3"',
      }
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 })
  }
}