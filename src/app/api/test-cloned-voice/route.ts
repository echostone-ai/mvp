import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { voice_id, text, settings } = await req.json()
    
    if (!voice_id) {
      return NextResponse.json({ error: 'Missing voice_id' }, { status: 400 })
    }

    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing ELEVENLABS_API_KEY env var' }, { status: 500 })
    }

    const defaultText = "Hello! This is your cloned voice speaking. How do I sound?"
    const voiceSettings = settings || {
      stability: 0.75,
      similarity_boost: 0.85,
      style: 0.2,
      use_speaker_boost: true
    }

    // Generate speech with the cloned voice
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text || defaultText,
        model_id: 'eleven_multilingual_v2',
        voice_settings: voiceSettings
      })
    })

    if (!response.ok) {
      let errorBody: any
      try {
        errorBody = await response.json()
      } catch {
        errorBody = await response.text()
      }
      return NextResponse.json({ error: errorBody }, { status: response.status })
    }

    const audioBuffer = await response.arrayBuffer()
    
    // Return the audio file
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': 'attachment; filename="voice_test.mp3"'
      }
    })

  } catch (err: any) {
    console.error('Test cloned voice error:', err)
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}