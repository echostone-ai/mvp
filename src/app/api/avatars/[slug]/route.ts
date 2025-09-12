import { NextRequest, NextResponse } from 'next/server';
import { getAvatarProfile } from '@/lib/avatarDataService';
import { supabase } from '@/lib/supabase';

/**
 * GET /api/avatars/:slug
 * Note: For compatibility, the dynamic segment accepts either a UUID (id) or a slug (name).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const value = params.slug;

  try {
    // First attempt via service by treating the value as an id
    const svcAvatar = await getAvatarProfile(value);
    if (svcAvatar) {
      const avatarResponse = {
        id: svcAvatar.id,
        name: svcAvatar.name,
        description: svcAvatar.description || 'A digital avatar',
        hasVoice: !!svcAvatar.voice_id,
        voiceId: svcAvatar.voice_id,
        created_at: svcAvatar.created_at,
        photo_url: svcAvatar.photo_url,
        profile_data: svcAvatar.profile_data
      };

      return NextResponse.json({ success: true, avatar: avatarResponse });
    }

    // Fallback: try Supabase by id first
    let data: any = null;
    let error: any = null;

    ({ data, error } = await supabase
      .from('avatar_profiles')
      .select('*')
      .eq('id', value)
      .single());

    // If not found by id, try by slug (name)
    if (error || !data) {
      ({ data, error } = await supabase
        .from('avatar_profiles')
        .select('*')
        .eq('name', value)
        .single());
    }

    if (error || !data) {
      return NextResponse.json({
        success: false,
        error: `Avatar not found: ${value}`
      }, { status: 404 });
    }

    const avatarResponse = {
      id: data.id,
      name: data.name,
      description: data.description || 'A digital avatar',
      hasVoice: !!data.voice_id,
      voiceId: data.voice_id,
      created_at: data.created_at,
      photo_url: data.photo_url,
      profile_data: data.profile_data
    };

    return NextResponse.json({ success: true, avatar: avatarResponse });
  } catch (err) {
    console.error('Error fetching avatar:', err);
    return NextResponse.json({ error: 'Failed to fetch avatar details' }, { status: 500 });
  }
}


