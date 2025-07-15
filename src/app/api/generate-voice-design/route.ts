import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { description, name, settings } = await req.json()
    
    if (!description || !name) {
      return NextResponse.json({ error: 'Missing description or name' }, { status: 400 })
    }

    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing ELEVENLABS_API_KEY env var' }, { status: 500 })
    }

    // Use ElevenLabs Voice Design API (Beta)
    const response = await fetch('https://api.elevenlabs.io/v1/voice-generation/generate-voice', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: description,
        voice_description: description,
        gender: 'auto', // Let AI determine gender from description
        accent: 'auto', // Let AI determine accent from description
        age: 'auto', // Let AI determine age from description
        accent_strength: 1.0,
        text_guidance: 1.0,
        voice_guidance: 1.0
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

    const data = await response.json()
    
    if (data.audio_base64) {
      // Now create a voice from the generated audio
      const audioBuffer = Buffer.from(data.audio_base64, 'base64')
      
      const voiceForm = new FormData()
      voiceForm.append('files', new Blob([audioBuffer], { type: 'audio/mpeg' }), `${name}_generated.mp3`)
      voiceForm.append('name', name)
      voiceForm.append('description', `AI-generated voice: ${description}`)
      
      // Apply custom settings if provided
      if (settings) {
        voiceForm.append('settings', JSON.stringify(settings))
      }

      const voiceResponse = await fetch('https://api.elevenlabs.io/v1/voices/add', {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey
        },
        body: voiceForm
      })

      if (!voiceResponse.ok) {
        let errorBody: any
        try {
          errorBody = await voiceResponse.json()
        } catch {
          errorBody = await voiceResponse.text()
        }
        return NextResponse.json({ error: errorBody }, { status: voiceResponse.status })
      }

      const voiceData = await voiceResponse.json()
      
      if (voiceData.voice_id) {
        return NextResponse.json({ 
          voice_id: voiceData.voice_id,
          preview_audio: data.audio_base64 
        })
      }
    }
    
    return NextResponse.json({ error: 'Failed to generate voice', raw: data }, { status: 500 })
  } catch (err: any) {
    console.error('Voice design error:', err)
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}