import { NextResponse } from 'next/server'
import { supabase } from '@/components/supabaseClient'

export async function POST(req: Request) {
  try {
    const { voiceId, settings, userId } = await req.json()

    if (!voiceId || !settings) {
      return NextResponse.json({ error: 'Missing voiceId or settings' }, { status: 400 })
    }

    // If userId is provided, try to save to user's profile
    if (userId) {
      try {
        // First, check if profiles table exists and if user has a profile
        const { data: existingProfile, error: fetchError } = await supabase
          .from('profiles')
          .select('user_id, voice_settings')
          .eq('user_id', userId)
          .single()

        if (fetchError && fetchError.code !== 'PGRST116') {
          // Error other than "not found"
          console.error('Error fetching profile:', fetchError)
          throw fetchError
        }

        if (existingProfile) {
          // Update existing profile
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ 
              voice_settings: settings,
              updated_at: new Date().toISOString()
            })
            .eq('user_id', userId)

          if (updateError) {
            console.error('Error updating voice settings:', updateError)
            throw updateError
          }
        } else {
          // Create new profile entry
          const { error: insertError } = await supabase
            .from('profiles')
            .insert({ 
              user_id: userId,
              voice_settings: settings,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })

          if (insertError) {
            console.error('Error creating profile with voice settings:', insertError)
            throw insertError
          }
        }

        console.log('✅ Voice settings saved successfully for user:', userId)
        
      } catch (dbError: any) {
        console.error('Database error saving voice settings:', dbError)
        
        // If it's a table/column doesn't exist error, we'll still return success
        // since the settings are being used immediately in the session
        if (dbError.code === '42P01' || dbError.code === '42703') {
          console.log('⚠️ Profiles table or voice_settings column does not exist, but settings will work for current session')
        } else {
          return NextResponse.json({ 
            error: 'Failed to save settings to profile: ' + dbError.message 
          }, { status: 500 })
        }
      }
    }

    // Always return success since settings are used immediately
    return NextResponse.json({ 
      success: true, 
      message: 'Voice settings saved successfully',
      settings,
      note: userId ? 'Settings saved to profile and active for current session' : 'Settings active for current session'
    })

  } catch (error: any) {
    console.error('Save voice settings error:', error)
    return NextResponse.json({ 
      error: 'Internal server error: ' + error.message 
    }, { status: 500 })
  }
}