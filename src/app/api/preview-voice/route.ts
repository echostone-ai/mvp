import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const text = formData.get('text') as string || "Hello! This is a preview of your cloned voice."
    const settingsStr = formData.get('settings') as string
    const settings = settingsStr ? JSON.parse(settingsStr) : {
      stability: 0.75,
      similarity_boost: 0.85,
      style: 0.2,
      use_speaker_boost: true
    }

    // Collect audio files
    const audioFiles: File[] = []
    const recordedAudio = formData.get('audio') as File | null
    if (recordedAudio) audioFiles.push(recordedAudio)
    
    // Get uploaded files
    let i = 0
    while (true) {
      const file = formData.get(`audio_${i}`) as File | null
      if (!file) break
      audioFiles.push(file)
      i++
    }

    if (audioFiles.length === 0) {
      return NextResponse.json({ error: 'No audio files provided' }, { status: 400 })
    }

    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing ELEVENLABS_API_KEY env var' }, { status: 500 })
    }

    // First, create a temporary voice for preview
    const voiceForm = new FormData()
    audioFiles.forEach((file, index) => {
      voiceForm.append('files', file, `preview_${index}`)
    })
    voiceForm.append('name', `Preview_${Date.now()}`)
    voiceForm.append('description', 'Temporary voice for preview')

    const voiceResponse = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey
      },
      body: voiceForm
    })

    if (!voiceResponse.ok) {
      const error = await voiceResponse.json()
      return NextResponse.json({ error }, { status: voiceResponse.status })
    }

    const voiceData = await voiceResponse.json()
    const tempVoiceId = voiceData.voice_id

    try {
      // Generate speech with the temporary voice
      const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${tempVoiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: settings
        })
      })

      if (!ttsResponse.ok) {
        throw new Error('Failed to generate preview audio')
      }

      const audioBuffer = await ttsResponse.arrayBuffer()
      
      // Clean up temporary voice
      await fetch(`https://api.elevenlabs.io/v1/voices/${tempVoiceId}`, {
        method: 'DELETE',
        headers: {
          'xi-api-key': apiKey
        }
      }).catch(console.error) // Don't fail if cleanup fails

      // Return the audio
      return new NextResponse(audioBuffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Disposition': 'attachment; filename="voice_preview.mp3"'
        }
      })

    } catch (error) {
      // Clean up temporary voice on error
      await fetch(`https://api.elevenlabs.io/v1/voices/${tempVoiceId}`, {
        method: 'DELETE',
        headers: {
          'xi-api-key': apiKey
        }
      }).catch(console.error)
      
      throw error
    }

  } catch (err: any) {
    console.error('Preview error:', err)
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}