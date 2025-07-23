import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

// Set the maximum content length for file uploads
export const config = {
  api: {
    bodyParser: false,
    responseLimit: '50mb',
  },
};

export async function POST(request: NextRequest) {
  try {
    // Get the current user from Supabase auth
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options });
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('[VOICE TRAINING] No authenticated user found, proceeding with limited functionality');
      // Continue without authentication for now, but with limited functionality
      // In a production environment, you would want to enforce authentication
    }

    // Parse the multipart form data
    const formData = await request.formData();
    const name = formData.get('name') as string;
    const script = formData.get('script') as string;
    const accent = formData.get('accent') as string;
    const avatarId = formData.get('avatarId') as string;
    
    // Get audio files
    const audioFiles = formData.getAll('audio') as File[];
    
    if (!name || audioFiles.length === 0) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    console.log(`[VOICE TRAINING] Processing voice for ${name}, ${audioFiles.length} files, avatar ID: ${avatarId || 'none'}`);

    // Call ElevenLabs API to create a voice clone
    const apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: 'ElevenLabs API key not configured' }, { status: 500 });
    }

    // Create a new FormData object for the ElevenLabs API
    const elevenLabsFormData = new FormData();
    elevenLabsFormData.append('name', name);
    elevenLabsFormData.append('description', `Voice for ${name} with ${accent} accent`);
    
    // Add all audio files
    audioFiles.forEach((file) => {
      elevenLabsFormData.append('files', file);
    });

    // Call ElevenLabs API to create a voice clone
    console.log('[VOICE TRAINING] Calling ElevenLabs API...');
    const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
      },
      body: elevenLabsFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[VOICE TRAINING ERROR] Status:', response.status, 'Response:', errorText);
      
      try {
        const errorData = JSON.parse(errorText);
        return NextResponse.json({ 
          success: false, 
          error: errorData.detail?.message || `ElevenLabs API error: ${response.status}` 
        }, { status: response.status });
      } catch (e) {
        return NextResponse.json({ 
          success: false, 
          error: `ElevenLabs API error: ${response.status}` 
        }, { status: response.status });
      }
    }

    const responseData = await response.json();
    const voiceId = responseData.voice_id;
    
    if (!voiceId) {
      return NextResponse.json({ success: false, error: 'No voice ID returned from ElevenLabs' }, { status: 500 });
    }

    console.log(`[VOICE TRAINING] Voice created with ID: ${voiceId}`);

    // If avatarId is provided, update the avatar with the new voice ID
    if (avatarId) {
      // Create a Supabase client with service role key for database operations
      const adminSupabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Update the avatar with the new voice ID
      const { error: updateError } = await adminSupabase
        .from('avatar_profiles')
        .update({ voice_id: voiceId })
        .eq('id', avatarId)
        .eq('user_id', user.id);

      if (updateError) {
        console.error('[VOICE TRAINING] Failed to update avatar:', updateError);
        // Continue anyway since we have the voice ID
      } else {
        console.log(`[VOICE TRAINING] Updated avatar ${avatarId} with voice ID ${voiceId}`);
      }
    }

    return NextResponse.json({ 
      success: true, 
      voice_id: voiceId,
      message: 'Voice successfully created' 
    });
    
  } catch (error: any) {
    console.error('[VOICE TRAINING] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'An unexpected error occurred' 
    }, { status: 500 });
  }
}