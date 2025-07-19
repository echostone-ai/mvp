import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const name = formData.get('name') as string
    const script = formData.get('script') as string
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

    // For now, we'll simulate the voice training process
    // In a real implementation, you would:
    // 1. Upload audio files to storage (Supabase Storage, AWS S3, etc.)
    // 2. Send files to a voice cloning service (ElevenLabs, etc.)
    // 3. Store the resulting voice_id in the database

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Generate a mock voice_id (in real implementation, this would come from the voice service)
    const voice_id = `voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Save the voice_id to the avatar profile if avatarId is provided
    if (avatarId) {
      const { error: updateError } = await supabase
        .from('avatar_profiles')
        .update({ voice_id })
        .eq('id', avatarId)
      
      if (updateError) {
        console.error('Failed to update avatar voice_id:', updateError)
        return NextResponse.json(
          { success: false, error: 'Failed to save voice to avatar profile' },
          { status: 500 }
        )
      }
    }
    
    return NextResponse.json({
      success: true,
      voice_id,
      message: `Successfully trained voice for ${name}`,
      files_processed: audioFiles.length
    })

  } catch (error) {
    console.error('Voice training error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error during voice training' },
      { status: 500 }
    )
  }
}