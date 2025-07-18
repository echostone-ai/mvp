import { NextResponse } from 'next/server'
import { supabase } from '@/components/supabaseClient'

export async function POST(req: Request) {
  try {
    const { voiceId, settings, userId } = await req.json()

    if (!voiceId || !settings) {
      return NextResponse.json({ error: 'Missing voiceId or settings' }, { status: 400 })
    }

    // If userId is provided, save to user's profile
    if (userId) {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          voice_settings: settings,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

      if (error) {
        console.error('Error saving voice settings to profile:', error)
        return NextResponse.json({ error: 'Failed to save settings to profile' }, { status: 500 })
      }
    }

    // For now, we'll just return success since the settings are being used immediately
    // In the future, you might want to store these in a voice_profiles table
    return NextResponse.json({ 
      success: true, 
      message: 'Voice settings saved successfully',
      settings 
    })

  } catch (error) {
    console.error('Save voice settings error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}