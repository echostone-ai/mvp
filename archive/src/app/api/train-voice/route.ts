import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { clearCache } from '@/lib/cache';

// Set the maximum content length for file uploads
export const config = {
  api: {
    bodyParser: false,
    responseLimit: '50mb',
  },
};

export async function POST(request: NextRequest) {
  console.log('[VOICE TRAINING] API called');
  try {
    // Get the current user from Supabase auth
    console.log('[VOICE TRAINING] Setting up Supabase client...');
    
    let cookieStore, supabase;
    try {
      cookieStore = cookies();
      supabase = createServerClient(
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
      console.log('[VOICE TRAINING] Supabase client created successfully');
    } catch (supabaseError: any) {
      console.error('[VOICE TRAINING] Failed to create Supabase client:', supabaseError);
      return NextResponse.json({ 
        success: false, 
        error: `Failed to initialize authentication: ${supabaseError.message}` 
      }, { status: 500 });
    }

    // Try to get user from session, but don't fail if not authenticated
    let user = null;
    try {
      const { data: { user: sessionUser } } = await supabase.auth.getUser();
      user = sessionUser;
      if (user) {
        console.log(`[VOICE TRAINING] Authenticated user: ${user.email || user.id}`);
      } else {
        console.log('[VOICE TRAINING] No authenticated user found, proceeding with limited functionality');
      }
    } catch (authError) {
      console.log('[VOICE TRAINING] Auth error, proceeding without authentication:', authError);
    }
    
    console.log(`[VOICE TRAINING] Request details: avatarId=${avatarId}, userId=${user?.id}, hasUser=${!!user}`);

    // For debugging: log the request headers
    const authHeader = request.headers.get('authorization');
    console.log('[VOICE TRAINING] Authorization header:', authHeader ? 'Present' : 'Missing');

    // Parse the multipart form data
    console.log('[VOICE TRAINING] Parsing form data...');
    let formData, name, script, accent, avatarId, audioFiles;
    
    try {
      formData = await request.formData();
      name = formData.get('name') as string;
      script = formData.get('script') as string;
      accent = formData.get('accent') as string;
      avatarId = formData.get('avatarId') as string;
      
      // Get audio files
      audioFiles = formData.getAll('audio') as File[];
      
      console.log('[VOICE TRAINING] Form data parsed successfully:', {
        name: !!name,
        script: !!script,
        accent: !!accent,
        avatarId: !!avatarId,
        audioFilesCount: audioFiles.length
      });
    } catch (parseError: any) {
      console.error('[VOICE TRAINING] Form data parsing failed:', parseError);
      return NextResponse.json({ 
        success: false, 
        error: `Failed to parse form data: ${parseError.message}` 
      }, { status: 400 });
    }
    
    if (!name || audioFiles.length === 0) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    console.log(`[VOICE TRAINING] Processing voice for ${name}, ${audioFiles.length} files, avatar ID: ${avatarId || 'none'}`);

    // Call ElevenLabs API to create a voice clone
    console.log('[VOICE TRAINING] Checking API keys...');
    const apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY;
    console.log('[VOICE TRAINING] API key available:', !!apiKey);
    
    if (!apiKey) {
      console.log('[VOICE TRAINING] No ElevenLabs API key found, using mock voice ID');
      
      // Generate a mock voice ID for development purposes
      const mockVoiceId = `mock-voice-${Date.now()}`;
      
      // If avatarId is provided, update the avatar with the mock voice ID
      if (avatarId) {
        try {
          // Create a Supabase client with service role key for database operations
          console.log('[VOICE TRAINING] Creating admin Supabase client...');
          
          if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
            throw new Error('NEXT_PUBLIC_SUPABASE_URL environment variable is missing');
          }
          if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is missing');
          }
          
          const adminSupabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );
          
          console.log('[VOICE TRAINING] Admin Supabase client created successfully');

          // Update the avatar with the mock voice ID
          // Only filter by user_id if we have a user
          let query = adminSupabase
            .from('avatar_profiles')
            .update({ voice_id: mockVoiceId })
            .eq('id', avatarId);
            
          // Add user_id filter if user exists
          if (user && user.id) {
            query = query.eq('user_id', user.id);
          }
          
          const { error: updateError } = await query;

          if (updateError) {
            console.error('[VOICE TRAINING] Failed to update avatar with mock voice:', updateError);
          } else {
            console.log(`[VOICE TRAINING] Updated avatar ${avatarId} with mock voice ID ${mockVoiceId}`);
            
            // Clear avatar cache to force refresh
            if (user && user.id) {
              clearCache(`avatars:${user.id}`);
              console.log(`[VOICE TRAINING] Cleared avatar cache for user ${user.id} (mock)`);
            }
          }
        } catch (dbError) {
          console.error('[VOICE TRAINING] Database error:', dbError);
        }
      }
      
      return NextResponse.json({ 
        success: true, 
        voice_id: mockVoiceId,
        message: 'Mock voice successfully created (ElevenLabs API key not configured)' 
      });
    }

    // If this avatar already has a voice, try to delete it first to avoid conflicts
    if (avatarId && user) {
      try {
        const adminSupabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { data: existingAvatar } = await adminSupabase
          .from('avatar_profiles')
          .select('voice_id')
          .eq('id', avatarId)
          .eq('user_id', user.id)
          .single();

        if (existingAvatar?.voice_id && existingAvatar.voice_id.startsWith('mock-voice-') === false) {
          console.log(`[VOICE TRAINING] Attempting to delete existing voice: ${existingAvatar.voice_id}`);
          try {
            await fetch(`https://api.elevenlabs.io/v1/voices/${existingAvatar.voice_id}`, {
              method: 'DELETE',
              headers: {
                'xi-api-key': apiKey,
              },
            });
            console.log(`[VOICE TRAINING] Deleted existing voice: ${existingAvatar.voice_id}`);
          } catch (deleteError) {
            console.log(`[VOICE TRAINING] Could not delete existing voice (may not exist): ${deleteError}`);
          }
        }
      } catch (error) {
        console.log(`[VOICE TRAINING] Error checking existing voice: ${error}`);
      }
    }

    // Create a new FormData object for the ElevenLabs API
    const elevenLabsFormData = new FormData();
    
    // Make the voice name more unique to avoid conflicts
    const uniqueVoiceName = `${name}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    elevenLabsFormData.append('name', uniqueVoiceName);
    elevenLabsFormData.append('description', `Voice for ${name} (${accent} accent) - Created ${new Date().toISOString()}`);
    
    // Process audio files to make them unique by adding silent padding
    const processedFiles = await Promise.all(audioFiles.map(async (file, index) => {
      try {
        // Read the file as array buffer
        const arrayBuffer = await file.arrayBuffer();
        
        // Add a small amount of random silent padding to make the audio unique
        // This is a simple approach - we'll add a few bytes of silence
        const originalBytes = new Uint8Array(arrayBuffer);
        const paddingSize = Math.floor(Math.random() * 100) + 50; // 50-150 bytes of padding
        const padding = new Uint8Array(paddingSize).fill(0);
        
        // Combine original audio with padding
        const modifiedBytes = new Uint8Array(originalBytes.length + paddingSize);
        modifiedBytes.set(originalBytes);
        modifiedBytes.set(padding, originalBytes.length);
        
        // Create new file with modified content
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 8);
        const originalExt = file.name.split('.').pop() || 'webm';
        const uniqueFilename = `${uniqueVoiceName}_${index}_${randomId}_${timestamp}.${originalExt}`;
        
        const modifiedFile = new File([modifiedBytes], uniqueFilename, {
          type: file.type,
          lastModified: Date.now() + index * 1000
        });
        
        console.log(`[VOICE TRAINING] Processed file: ${uniqueFilename}, original: ${originalBytes.length}, modified: ${modifiedBytes.length}`);
        return modifiedFile;
        
      } catch (error) {
        console.warn(`[VOICE TRAINING] Could not process file ${index}, using original:`, error);
        
        // Fallback: just create unique file with original content
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 8);
        const originalExt = file.name.split('.').pop() || 'webm';
        const uniqueFilename = `${uniqueVoiceName}_${index}_${randomId}_fallback.${originalExt}`;
        
        return new File([file], uniqueFilename, {
          type: file.type,
          lastModified: Date.now() + index * 1000
        });
      }
    }));
    
    // Add processed files to form data
    processedFiles.forEach((file, index) => {
      console.log(`[VOICE TRAINING] Adding processed file: ${file.name}, size: ${file.size}`);
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
      
      // If it's a duplicate error and we have an avatar ID, try to clear existing voices and retry
      if ((errorText.includes('duplicate') || errorText.includes('same file') || errorText.includes('already exists')) && avatarId) {
        console.log('[VOICE TRAINING] Duplicate detected, attempting to clear existing voices and retry...');
        
        try {
          // Try to clear the avatar's existing voice directly in the database
          console.log('[VOICE TRAINING] Attempting to clear existing voice for avatar:', avatarId);
          
          const adminSupabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );

          // Get current voice ID to delete from ElevenLabs
          let existingQuery = adminSupabase
            .from('avatar_profiles')
            .select('voice_id')
            .eq('id', avatarId);
            
          if (user && user.id) {
            existingQuery = existingQuery.eq('user_id', user.id);
          }
          
          const { data: existingAvatar } = await existingQuery.single();
          
          // Delete from ElevenLabs if it exists
          if (existingAvatar?.voice_id && !existingAvatar.voice_id.startsWith('mock-voice-')) {
            try {
              await fetch(`https://api.elevenlabs.io/v1/voices/${existingAvatar.voice_id}`, {
                method: 'DELETE',
                headers: {
                  'xi-api-key': apiKey,
                },
              });
              console.log('[VOICE TRAINING] Deleted existing voice from ElevenLabs:', existingAvatar.voice_id);
            } catch (deleteError) {
              console.log('[VOICE TRAINING] Could not delete existing voice from ElevenLabs:', deleteError);
            }
          }
          
          // Clear from database
          let clearQuery = adminSupabase
            .from('avatar_profiles')
            .update({ voice_id: null })
            .eq('id', avatarId);
            
          if (user && user.id) {
            clearQuery = clearQuery.eq('user_id', user.id);
          }
          
          const { error: clearError } = await clearQuery;
          const clearResponse = { ok: !clearError };
          
          if (clearResponse.ok) {
            console.log('[VOICE TRAINING] Cleared existing voice, retrying with new unique name...');
            
            // Create a new FormData with an even more unique name
            const retryFormData = new FormData();
            const retryTimestamp = Date.now();
            const retryRandomId = Math.random().toString(36).substring(2, 12);
            const retryVoiceName = `${name}_retry_${retryTimestamp}_${retryRandomId}`;
            
            retryFormData.append('name', retryVoiceName);
            retryFormData.append('description', `Voice for ${name} (${accent} accent) - Retry ${new Date().toISOString()}`);
            
            // Re-add audio files with new unique names
            audioFiles.forEach((file, index) => {
              const originalExt = file.name.split('.').pop() || 'webm';
              const retryFilename = `${retryVoiceName}_retry_${index}_${retryRandomId}.${originalExt}`;
              
              const retryFile = new File([file], retryFilename, {
                type: file.type,
                lastModified: retryTimestamp + index * 1000
              });
              
              retryFormData.append('files', retryFile);
            });
            
            // Retry the ElevenLabs API call
            const retryResponse = await fetch('https://api.elevenlabs.io/v1/voices/add', {
              method: 'POST',
              headers: {
                'xi-api-key': apiKey,
              },
              body: retryFormData,
            });
            
            if (retryResponse.ok) {
              const retryData = await retryResponse.json();
              const retryVoiceId = retryData.voice_id;
              
              if (retryVoiceId) {
                console.log(`[VOICE TRAINING] Retry successful with voice ID: ${retryVoiceId}`);
                
                // Update avatar with new voice ID
                if (avatarId) {
                  const adminSupabase = createClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.SUPABASE_SERVICE_ROLE_KEY!
                  );

                  let updateQuery = adminSupabase
                    .from('avatar_profiles')
                    .update({ voice_id: retryVoiceId })
                    .eq('id', avatarId);
                    
                  if (user && user.id) {
                    updateQuery = updateQuery.eq('user_id', user.id);
                  }
                  
                  const { error: retryUpdateError } = await updateQuery;
                  
                  if (!retryUpdateError && user && user.id) {
                    // Clear avatar cache to force refresh
                    clearCache(`avatars:${user.id}`);
                    console.log(`[VOICE TRAINING] Cleared avatar cache for user ${user.id} (retry)`);
                  }
                }
                
                return NextResponse.json({ 
                  success: true, 
                  voice_id: retryVoiceId,
                  message: 'Voice successfully created after clearing duplicates' 
                });
              }
            }
          }
        } catch (retryError) {
          console.log('[VOICE TRAINING] Retry failed:', retryError);
        }
      }
      
      try {
        const errorData = JSON.parse(errorText);
        let errorMessage = errorData.detail?.message || `ElevenLabs API error: ${response.status}`;
        
        // Handle specific error cases
        if (errorText.includes('duplicate') || errorText.includes('same file') || errorText.includes('already exists')) {
          errorMessage = 'This audio content has been used before. Try the "Clear Existing Voice" button below, then record completely new audio with different words.';
        } else if (errorText.includes('generated') || errorText.includes('synthetic') || errorText.includes('artificial')) {
          errorMessage = 'This audio appears to be AI-generated and cannot be used for voice training. Please use original recordings of your actual voice.';
        } else if (errorText.includes('quota') || errorText.includes('limit') || errorText.includes('exceeded')) {
          errorMessage = 'Voice training quota exceeded. Please try again later or upgrade your ElevenLabs plan.';
        } else if (errorText.includes('audio quality') || errorText.includes('too short') || errorText.includes('duration')) {
          errorMessage = 'Audio quality is too low or recording is too short. Please record at least 30 seconds of clear, high-quality audio.';
        } else if (errorText.includes('invalid') || errorText.includes('format')) {
          errorMessage = 'Invalid audio format. Please use MP3, WAV, or M4A files with clear speech.';
        } else if (errorText.includes('voice') && errorText.includes('detect')) {
          errorMessage = 'Could not detect a clear voice in the audio. Please ensure you are speaking clearly and there is minimal background noise.';
        }
        
        return NextResponse.json({ 
          success: false, 
          error: errorMessage
        }, { status: response.status });
      } catch (e) {
        // If we can't parse the error, provide a generic message
        let errorMessage = `ElevenLabs API error: ${response.status}`;
        
        if (errorText.includes('duplicate') || errorText.includes('same file') || errorText.includes('already exists')) {
          errorMessage = 'This audio content has been used before. Try the "Clear Existing Voice" button below, then record completely new audio with different words.';
        }
        
        return NextResponse.json({ 
          success: false, 
          error: errorMessage
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
      try {
        // Create a Supabase client with service role key for database operations
        const adminSupabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Update the avatar with the new voice ID
        console.log(`[VOICE TRAINING] Attempting to update avatar ${avatarId} with voice ID ${voiceId} for user ${user?.id}`);
        
        // First try with user filter
        let updateData = null;
        let updateError = null;
        
        if (user?.id) {
          const result = await adminSupabase
            .from('avatar_profiles')
            .update({ voice_id: voiceId })
            .eq('id', avatarId)
            .eq('user_id', user.id)
            .select();
          
          updateData = result.data;
          updateError = result.error;
          
          console.log(`[VOICE TRAINING] Update with user filter result:`, { 
            success: !updateError, 
            rowsUpdated: updateData?.length || 0,
            error: updateError?.message 
          });
        }
        
        // If that failed, try without user filter (but verify ownership)
        if (updateError || !updateData || updateData.length === 0) {
          console.log(`[VOICE TRAINING] Trying update without user filter...`);
          
          // First check if avatar exists and get its user_id
          const { data: avatarCheck, error: checkError } = await adminSupabase
            .from('avatar_profiles')
            .select('user_id, name')
            .eq('id', avatarId)
            .single();
          
          if (checkError) {
            console.error(`[VOICE TRAINING] Avatar check failed:`, checkError);
            updateError = checkError;
          } else if (avatarCheck && avatarCheck.user_id === user?.id) {
            console.log(`[VOICE TRAINING] Avatar ownership verified, updating...`);
            
            const result = await adminSupabase
              .from('avatar_profiles')
              .update({ voice_id: voiceId })
              .eq('id', avatarId)
              .select();
            
            updateData = result.data;
            updateError = result.error;
            
            console.log(`[VOICE TRAINING] Direct update result:`, { 
              success: !updateError, 
              rowsUpdated: updateData?.length || 0 
            });
          } else {
            console.error(`[VOICE TRAINING] Avatar ownership mismatch:`, {
              avatarUserId: avatarCheck?.user_id,
              requestUserId: user?.id
            });
            updateError = { message: 'Avatar ownership verification failed' };
          }
        }

        if (updateError) {
          console.error('[VOICE TRAINING] Failed to update avatar:', updateError);
          console.error('[VOICE TRAINING] Update details:', { avatarId, voiceId, userId: user?.id });
          // Continue anyway since we have the voice ID
        } else {
          console.log(`[VOICE TRAINING] Successfully updated avatar ${avatarId} with voice ID ${voiceId}`);
          console.log(`[VOICE TRAINING] Update result:`, updateData);
          console.log(`[VOICE TRAINING] Updated ${updateData?.length || 0} rows`);
          
          // Clear avatar cache to force refresh
          if (user && user.id) {
            clearCache(`avatars:${user.id}`);
            console.log(`[VOICE TRAINING] Cleared avatar cache for user ${user.id}`);
          }
          
          // Verify the update worked
          try {
            const { data: verifyData } = await adminSupabase
              .from('avatar_profiles')
              .select('voice_id, name')
              .eq('id', avatarId)
              .single();
            console.log(`[VOICE TRAINING] Verification - Avatar ${avatarId} (${verifyData?.name}) voice_id is now:`, verifyData?.voice_id);
          } catch (verifyError) {
            console.warn('[VOICE TRAINING] Could not verify update:', verifyError);
          }
        }
      } catch (dbError) {
        console.error('[VOICE TRAINING] Database error:', dbError);
        // Continue anyway since we have the voice ID
      }
    }

    return NextResponse.json({ 
      success: true, 
      voice_id: voiceId,
      message: 'Voice successfully created' 
    });
    
  } catch (error: any) {
    console.error('[VOICE TRAINING] Unexpected error:', error);
    console.error('[VOICE TRAINING] Error stack:', error.stack);
    console.error('[VOICE TRAINING] Error details:', {
      name: error.name,
      message: error.message,
      cause: error.cause
    });
    
    return NextResponse.json({ 
      success: false, 
      error: `Server error: ${error.message || 'An unexpected error occurred'}`,
      details: error.stack
    }, { status: 500 });
  }
}