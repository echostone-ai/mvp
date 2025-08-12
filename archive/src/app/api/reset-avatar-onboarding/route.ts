import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { avatarName } = await request.json();

    if (!avatarName) {
      return NextResponse.json({ error: 'Avatar name required' }, { status: 400 });
    }

    console.log('🔄 Resetting avatar:', avatarName);
    
    // Get the avatar
    const { data: avatar, error: fetchError } = await supabase
      .from('avatar_profiles')
      .select('*')
      .eq('name', avatarName)
      .single();

    if (fetchError) {
      console.error('❌ Failed to find avatar:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    console.log('✅ Found avatar:', avatar.id, 'current voice_id:', avatar.voice_id);

    // Reset the avatar's profile data and voice
    const resetProfileData = {
      name: avatarName,
      personality: `I am ${avatarName}, `,
      personalityTraits: [],
      factualInfo: [`My name is ${avatarName}`],
      languageStyle: { description: 'Natural and conversational, authentic to my own unique voice' },
      humorStyle: { description: 'Friendly with occasional wit, adapting to the conversation naturally' },
      catchphrases: [],
      memories: [],
      influences: [],
      passions: [],
      places: [],
      philosophy: [],
      creativity: []
    };

    // Update the avatar
    console.log('🔄 Updating avatar with reset data...');
    const { error: updateError } = await supabase
      .from('avatar_profiles')
      .update({
        profile_data: resetProfileData,
        voice_id: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', avatar.id);

    if (updateError) {
      console.error('❌ Failed to update avatar:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    console.log('✅ Successfully reset avatar');

    return NextResponse.json({
      success: true,
      message: `Reset ${avatarName}'s onboarding data`,
      avatarId: avatar.id
    });
  } catch (error) {
    console.error('Reset avatar onboarding error:', error);
    return NextResponse.json(
      { error: 'Failed to reset avatar onboarding' },
      { status: 500 }
    );
  }
}