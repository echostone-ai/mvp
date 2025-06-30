import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()
    console.log("🗣 Received text to speak:", text)

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`, {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      })
    })

    console.log("🎧 ElevenLabs response status:", response.status)

    const audio = await response.arrayBuffer()

    return new NextResponse(Buffer.from(audio), {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg'
      }
    })
  } catch (err) {
    console.error("🔥 ElevenLabs error:", err)
    return NextResponse.json({ error: "Voice generation failed." })
  }
}
