import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    // Parse multipart form data
    const formData = await req.formData()
    const audioFile = formData.get('audio') as File | null
    const name = formData.get('name') as string | null
    const accent = formData.get('accent') as string | null
    const script = formData.get('script') as string | null

    if (!audioFile) {
      return NextResponse.json({ error: 'Missing audio file' }, { status: 400 })
    }
    if (!name) {
      return NextResponse.json({ error: 'Missing name' }, { status: 400 })
    }

    const elevenForm = new FormData()
    elevenForm.append('files', audioFile, name)
    elevenForm.append('name', name)
    elevenForm.append(
      'description',
      `Accent: ${accent || 'unknown'} | Script: ${script?.slice(0, 80) || ''}`
    )

    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing ELEVENLABS_API_KEY env var' }, { status: 500 })
    }

    const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
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
    // Return standardized response for your client
    if (data.voice_id) {
      return NextResponse.json({ success: true, voiceId: data.voice_id })
    }
    return NextResponse.json({ success: false, error: 'No voice_id returned', raw: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unknown error' }, { status: 500 })
  }
}