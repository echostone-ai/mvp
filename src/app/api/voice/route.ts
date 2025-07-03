// src/app/api/voice/route.ts
import { NextResponse } from 'next/server'

export const runtime = 'edge'

export async function POST(req: Request) {
  try {
    const { text } = await req.json()

    // wrap SSML around any mention of “Krissy” to bump pitch +10%
    const outgoingText = text.includes('Krissy')
      ? `<speak><prosody pitch="+10%">${text}</prosody></speak>`
      : text

    const apiKey = process.env.ELEVENLABS_API_KEY!
    const voiceId = process.env.ELEVENLABS_VOICE_ID!

    const apiRes = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
        },
        body: JSON.stringify({
          text: outgoingText,
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    )

    if (!apiRes.ok) {
      const err = await apiRes.text().catch(() => 'Unknown error')
      console.error('ElevenLabs error:', err)
      return NextResponse.json({ error: err }, { status: apiRes.status })
    }

    // get raw MP3 bytes
    const buffer = await apiRes.arrayBuffer()

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    console.error('Voice route failed:', e)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
