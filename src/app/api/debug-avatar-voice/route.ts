import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const avatarId = searchParams.get('avatarId');
        const userId = searchParams.get('userId');

        if (!avatarId) {
            return NextResponse.json({ error: 'avatarId is required' }, { status: 400 });
        }

        // Create admin client to check database
        const adminSupabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // Get avatar data
        let query = adminSupabase
            .from('avatar_profiles')
            .select('*')
            .eq('id', avatarId);

        if (userId) {
            query = query.eq('user_id', userId);
        }

        const { data: avatar, error } = await query.single();

        if (error) {
            return NextResponse.json({
                error: 'Avatar not found',
                details: error.message,
                avatarId,
                userId
            }, { status: 404 });
        }

        // Check if voice exists in ElevenLabs
        let elevenLabsStatus = 'not_checked';
        if (avatar.voice_id && !avatar.voice_id.startsWith('mock-voice-')) {
            try {
                const apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY;
                if (apiKey) {
                    const response = await fetch(`https://api.elevenlabs.io/v1/voices/${avatar.voice_id}`, {
                        headers: {
                            'xi-api-key': apiKey,
                        },
                    });
                    elevenLabsStatus = response.ok ? 'exists' : 'not_found';
                } else {
                    elevenLabsStatus = 'no_api_key';
                }
            } catch (error) {
                elevenLabsStatus = 'error_checking';
            }
        } else if (avatar.voice_id?.startsWith('mock-voice-')) {
            elevenLabsStatus = 'mock_voice';
        }

        return NextResponse.json({
            success: true,
            avatar: {
                id: avatar.id,
                name: avatar.name,
                voice_id: avatar.voice_id,
                user_id: avatar.user_id,
                created_at: avatar.created_at,
                updated_at: avatar.updated_at
            },
            voice_status: {
                has_voice_id: !!avatar.voice_id,
                voice_id_type: avatar.voice_id?.startsWith('mock-voice-') ? 'mock' : 'real',
                elevenlabs_status: elevenLabsStatus
            },
            debug_info: {
                requested_avatar_id: avatarId,
                requested_user_id: userId,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error: any) {
        console.error('[DEBUG AVATAR VOICE] Error:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: error.message
        }, { status: 500 });
    }
}