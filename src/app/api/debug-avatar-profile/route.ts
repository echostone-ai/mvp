import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const avatarId = searchParams.get('avatarId');

    if (!avatarId) {
      return NextResponse.json({ error: 'Avatar ID required' }, { status: 400 });
    }

    // Get avatar profile data
    const { data: avatar, error } = await supabase
      .from('avatar_profiles')
      .select('*')
      .eq('id', avatarId)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get onboarding responses for this avatar
    const { data: sessions, error: sessionError } = await supabase
      .from('onboarding_sessions')
      .select(`
        *,
        onboarding_responses (*)
      `)
      .eq('avatar_id', avatarId);

    return NextResponse.json({
      success: true,
      avatar,
      onboardingSessions: sessions,
      profileDataExists: !!avatar.profile_data,
      voiceIdExists: !!avatar.voice_id,
      profileDataPreview: avatar.profile_data ? 
        JSON.stringify(avatar.profile_data, null, 2).substring(0, 500) + '...' : 
        'No profile data'
    });
  } catch (error) {
    console.error('Debug avatar profile error:', error);
    return NextResponse.json(
      { error: 'Failed to debug avatar profile' },
      { status: 500 }
    );
  }
}