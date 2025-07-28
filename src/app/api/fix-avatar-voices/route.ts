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

    // Get the avatar
    const { data: avatar, error: fetchError } = await supabase
      .from('avatar_profiles')
      .select('*')
      .eq('name', avatarName)
      .single();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // Select a proper ElevenLabs voice ID
    const defaultVoiceIds = [
      'EXAVITQu4vr4xnSDxMaL', // Bella - warm female voice
      'ErXwobaYiN019PkySvjV', // Antoni - professional male voice
      'MF3mGyEYCl7XYWbV9V6O', // Elli - young female voice
      'TxGEqnHWrfWFTfGW9XjX', // Josh - young male voice
      'VR6AewLTigWG4xSOukaG', // Arnold - mature male voice
      'pNInz6obpgDQGcFmaJgB', // Adam - narrative male voice
      'yoZ06aMxZJJ28mfd3POQ', // Sam - narrative male voice
    ];

    // Select voice based on avatar name or randomly
    let selectedVoiceId;
    if (avatarName.toLowerCase().includes('tuesday')) {
      selectedVoiceId = 'EXAVITQu4vr4xnSDxMaL'; // Bella - warm female voice
    } else if (avatarName.toLowerCase().includes('wednesday')) {
      selectedVoiceId = 'MF3mGyEYCl7XYWbV9V6O'; // Elli - energetic female voice
    } else {
      selectedVoiceId = defaultVoiceIds[Math.floor(Math.random() * defaultVoiceIds.length)];
    }

    // Update the avatar with the new voice ID
    const { error: updateError } = await supabase
      .from('avatar_profiles')
      .update({
        voice_id: selectedVoiceId,
        updated_at: new Date().toISOString()
      })
      .eq('id', avatar.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Updated ${avatarName} with voice ID: ${selectedVoiceId}`,
      oldVoiceId: avatar.voice_id,
      newVoiceId: selectedVoiceId
    });
  } catch (error) {
    console.error('Fix avatar voices error:', error);
    return NextResponse.json(
      { error: 'Failed to fix avatar voices' },
      { status: 500 }
    );
  }
}