import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const avatarName = searchParams.get('avatarName');

    if (!avatarName) {
      return NextResponse.json({ error: 'Avatar name required' }, { status: 400 });
    }

    const { data: avatar, error } = await supabase
      .from('avatar_profiles')
      .select('*')
      .eq('name', avatarName)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const debugInfo = {
      avatar,
      profileDataExists: !!avatar.profile_data,
      voiceIdExists: !!avatar.voice_id,
      voiceId: avatar.voice_id,
      profileDataSummary: avatar.profile_data ? {
        memories: avatar.profile_data.memories?.length || 0,
        influences: avatar.profile_data.influences?.length || 0,
        passions: avatar.profile_data.passions?.length || 0,
        places: avatar.profile_data.places?.length || 0,
        philosophy: avatar.profile_data.philosophy?.length || 0,
        creativity: avatar.profile_data.creativity?.length || 0,
        factualInfo: avatar.profile_data.factualInfo?.length || 0,
        personalityTraits: avatar.profile_data.personalityTraits?.length || 0
      } : null,
      fullProfileData: avatar.profile_data
    };

    return NextResponse.json({
      success: true,
      debugInfo
    });
  } catch (error) {
    console.error('Debug avatar onboarding error:', error);
    return NextResponse.json(
      { error: 'Failed to debug avatar onboarding' },
      { status: 500 }
    );
  }
}