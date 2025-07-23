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

        if (!avatarId) {
            return NextResponse.json({ success: false, error: 'Avatar ID is required' }, { status: 400 });
        }

        // Get the avatar and its current voice ID
        const adminSupabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Build query with or without user_id filter
        let query = adminSupabase
            .from('avatar_profiles')
            .select('voice_id')
            .eq('id', avatarId);

        if (user && user.id) {
            query = query.eq('user_id', user.id);
        }

        const { data: avatar, error: fetchError } = await query.single();

        if (fetchError || !avatar) {
            return NextResponse.json({ success: false, error: 'Avatar not found' }, { status: 404 });
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
        let updateQuery = adminSupabase
            .from('avatar_profiles')
            .update({ voice_id: null })
            .eq('id', avatarId);

        if (user && user.id) {
            updateQuery = updateQuery.eq('user_id', user.id);
        }

        const { error: updateError } = await updateQuery;

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