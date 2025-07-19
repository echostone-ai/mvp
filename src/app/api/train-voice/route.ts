import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Helper to hash a File/Blob
async function hashBlob(blob: Blob): Promise<string> {
  const arrayBuffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: 'Authorization required' },
        { status: 401 }
      )
    }

    // Create supabase client with the user's session
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    )

    // Verify the user session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Invalid authentication' },
        { status: 401 }
      )
    }

    const formData = await request.formData()
    const name = formData.get('name') as string
    const script = formData.get('script') as string
    const accent = formData.get('accent') as string || 'american'
    const avatarId = formData.get('avatarId') as string
    const audioFiles = formData.getAll('audio') as File[]

    if (!name || audioFiles.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Name and audio files are required' },
        { status: 400 }
      )
    }

    // Validate audio files
    const maxFileSize = 50 * 1024 * 1024 // 50MB
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/webm', 'audio/ogg', 'audio/m4a']
    
    for (const file of audioFiles) {
      if (file.size > maxFileSize) {
        return NextResponse.json(
          { success: false, error: `File ${file.name} is too large. Maximum size is 50MB.` },
          { status: 400 }
        )
      }
      
      if (!allowedTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|m4a|webm|ogg)$/i)) {
        return NextResponse.json(
          { success: false, error: `File ${file.name} is not a supported audio format.` },
          { status: 400 }
        )
      }
    }

    // --- DEDUPLICATE AUDIO FILES BY CONTENT HASH ---
    const fileHashes = new Set<string>();
    const dedupedAudioFiles: File[] = [];
    for (const file of audioFiles) {
      const hash = await hashBlob(file);
      if (!fileHashes.has(hash)) {
        fileHashes.add(hash);
        dedupedAudioFiles.push(file);
      }
    }

    if (dedupedAudioFiles.length === 0) {
      return NextResponse.json(
        { success: false, error: 'All uploaded audio files are duplicates. Please upload different files.' },
        { status: 400 }
      )
    }

    // Create voice clone using ElevenLabs API
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY
    if (!elevenLabsApiKey) {
      return NextResponse.json(
        { success: false, error: 'ElevenLabs API key not configured' },
        { status: 500 }
      )
    }

    let voice_id: string

    try {
      // Create FormData for ElevenLabs API
      const elevenLabsFormData = new FormData()
      elevenLabsFormData.append('name', name)
      elevenLabsFormData.append('description', `Voice clone for ${name}`)
      
      // Add unique audio files to the form data
      dedupedAudioFiles.forEach((file, index) => {
        elevenLabsFormData.append('files', file, file.name)
      })

      console.log('Creating voice clone with ElevenLabs...')
      // ... (rest of your ElevenLabs API logic remains unchanged)
      // For brevity, not shown

      // After success/failure, return as before
      // Example:
      // return NextResponse.json({ success: true, voice_id })

    } catch (err: any) {
      return NextResponse.json(
        { success: false, error: err.message || 'Failed to create voice clone.' },
        { status: 500 }
      )
    }

    // If you reach here, fallback error
    return NextResponse.json(
      { success: false, error: 'Unknown error occurred.' },
      { status: 500 }
    )
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unexpected error.' },
      { status: 500 }
    )
  }
}