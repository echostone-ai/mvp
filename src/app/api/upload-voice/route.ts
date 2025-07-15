import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    // Parse multipart form data
    const formData = await req.formData()
    const name = formData.get('name') as string | null
    const script = formData.get('script') as string | null
    const fileCount = parseInt(formData.get('file_count') as string || '0')
    
    // Collect all audio files
    const audioFiles: File[] = []
    
    // Get uploaded files
    for (let i = 0; i < fileCount; i++) {
      const file = formData.get(`audio_${i}`) as File | null
      if (file) audioFiles.push(file)
    }
    
    // Get recorded audio if present
    const recordedAudio = formData.get('recorded_audio') as File | null
    if (recordedAudio) audioFiles.push(recordedAudio)
    
    // Fallback for single file upload (backward compatibility)
    const singleAudio = formData.get('audio') as File | null
    if (singleAudio && audioFiles.length === 0) audioFiles.push(singleAudio)
    
    if (audioFiles.length === 0) {
      return NextResponse.json({ error: 'No audio files provided' }, { status: 400 })
    }
    if (!name) {
      return NextResponse.json({ error: 'Missing name' }, { status: 400 })
    }

    console.log(`Processing ${audioFiles.length} audio files for voice training`)

    const elevenForm = new FormData()
    
    // Add all audio files to ElevenLabs
    audioFiles.forEach((file, index) => {
      elevenForm.append('files', file, `${name}_${index}`)
    })
    
    elevenForm.append('name', name)
    elevenForm.append(
      'description',
      `Enhanced voice clone for ${name} using ${audioFiles.length} audio samples. Script: ${script?.slice(0, 80) || 'No script provided'}`
    )

    // Add enhanced settings if provided
    const settingsStr = formData.get('settings') as string
    const isEnhanced = formData.get('enhanced') === 'true'
    
    if (settingsStr && isEnhanced) {
      try {
        const settings = JSON.parse(settingsStr)
        // ElevenLabs voice creation with enhanced settings
        elevenForm.append('voice_settings', JSON.stringify(settings))
      } catch (e) {
        console.log('Invalid settings JSON, using defaults')
      }
    }

    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing ELEVENLABS_API_KEY env var' }, { status: 500 })
    }

    // Use enhanced voice creation endpoint if available
    const endpoint = isEnhanced 
      ? 'https://api.elevenlabs.io/v1/voices/add'  // Professional voice cloning
      : 'https://api.elevenlabs.io/v1/voices/add'

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey
      },
      body: elevenForm
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
    console.log('ElevenLabs response:', data)
    
    // Return consistent response format
    if (data.voice_id) {
      return NextResponse.json({ voice_id: data.voice_id })
    }
    return NextResponse.json({ error: 'No voice_id returned from ElevenLabs', raw: data }, { status: 500 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}