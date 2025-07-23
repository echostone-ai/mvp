import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

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

        let user = null;
        try {
            const { data: { user: sessionUser } } = await supabase.auth.getUser();
            user = sessionUser;
            if (!user) {
                console.log('[CLEAR VOICE] No authenticated user found, proceeding with limited functionality');
            }
        } catch (authError) {
            console.log('[CLEAR VOICE] Auth error, proceeding without authentication:', authError);
        }

        const { avatarId } = await request.json();
        console.log('[CLEAR VOICE] Received avatarId:', avatarId);

        if (!avatarId) {
            return NextResponse.json({ success: false, error: 'Avatar ID is required' }, { status: 400 });
        }

        // Get the avatar and its current voice ID
        const adminSupabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // First, try to find the avatar without user filter to see if it exists at all
        const { data: avatarCheck, error: checkError } = await adminSupabase
            .from('avatar_profiles')
            .select('voice_id, user_id')
            .eq('id', avatarId)
            .single();

        console.log('[CLEAR VOICE] Avatar check result:', { avatarCheck, checkError });

        if (checkError || !avatarCheck) {
            console.log('[CLEAR VOICE] Avatar does not exist in database');
            return NextResponse.json({ 
                success: false, 
                error: `Avatar with ID ${avatarId} does not exist in the database` 
            }, { status: 404 });
        }

        // If user is authenticated, verify ownership
        if (user && user.id && avatarCheck.user_id !== user.id) {
            console.log('[CLEAR VOICE] User does not own this avatar');
            return NextResponse.json({ 
                success: false, 
                error: 'You do not have permission to modify this avatar' 
            }, { status: 403 });
        }

        const avatar = avatarCheck;
        console.log('[CLEAR VOICE] Query result:', { avatar, fetchError });

        if (fetchError || !avatar) {
            console.log('[CLEAR VOICE] Avatar not found. Error:', fetchError);
            return NextResponse.json({ 
                success: false, 
                error: `Avatar not found. ID: ${avatarId}, User: ${user?.id || 'none'}, Error: ${fetchError?.message || 'unknown'}` 
            }, { status: 404 });
        }

        if (!avatar.voice_id) {
            return NextResponse.json({ success: true, message: 'Avatar has no voice to clear' });
        }

        // Try to delete the voice from ElevenLabs if it's not a mock voice
        const apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY;
        if (apiKey && !avatar.voice_id.startsWith('mock-voice-')) {
            try {
                const response = await fetch(`https://api.elevenlabs.io/v1/voices/${avatar.voice_id}`, {
                    method: 'DELETE',
                    headers: {
                        'xi-api-key': apiKey,
                    },
                });

                if (response.ok) {
                    console.log(`[CLEAR VOICE] Successfully deleted voice ${avatar.voice_id} from ElevenLabs`);
                } else {
                    console.log(`[CLEAR VOICE] Could not delete voice from ElevenLabs: ${response.status}`);
                }
            } catch (error) {
                console.log(`[CLEAR VOICE] Error deleting voice from ElevenLabs: ${error}`);
            }
        }

        // Clear the voice_id from the avatar
        const { error: updateError } = await adminSupabase
            .from('avatar_profiles')
            .update({ voice_id: null })
            .eq('id', avatarId);

        if (updateError) {
            return NextResponse.json({ success: false, error: 'Failed to clear voice from avatar' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'Avatar voice cleared successfully'
        });

    } catch (error: any) {
        console.error('[CLEAR VOICE] Error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'An unexpected error occurred'
        }, { status: 500 });
    }
}