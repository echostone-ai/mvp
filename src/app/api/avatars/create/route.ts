// Avatar Creation API - For Onboarding New Avatars
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ProfileOptimizer } from '@/lib/profileOptimization';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const { profile, heygenConfig, userId = 'demo' } = await req.json();
    
    if (!profile || !heygenConfig) {
      return NextResponse.json({ error: 'Profile and HeyGen config required' }, { status: 400 });
    }

    // Generate unique avatar ID
    const avatarId = `${profile.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`;
    
    // Create optimized profile
    const optimizedProfile = {
      ...profile,
      id: avatarId
    };

    // Save optimized profile
    const { error: optimizedError } = await supabase
      .from('optimized_profiles')
      .insert(optimizedProfile);

    if (optimizedError) {
      throw new Error(`Failed to save optimized profile: ${optimizedError.message}`);
    }

    // Save avatar configuration
    const { error: configError } = await supabase
      .from('avatar_configs')
      .insert({
        id: avatarId,
        user_id: userId,
        avatar_name: profile.name,
        heygen_avatar_id: heygenConfig.avatarId,
        voice_id: heygenConfig.voiceId,
        personality_prompt: profile.core_personality,
        quick_facts: profile.quick_facts,
        conversation_style: profile.conversation_style,
        is_active: true
      });

    if (configError) {
      throw new Error(`Failed to save avatar config: ${configError.message}`);
    }

    return NextResponse.json({
      success: true,
      avatarId,
      message: 'Avatar created successfully',
      profile: optimizedProfile
    });

  } catch (error) {
    console.error('Avatar creation error:', error);
    return NextResponse.json({
      error: 'Failed to create avatar',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Get user's avatars
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || 'demo';

    const { data, error } = await supabase
      .from('avatar_configs')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch avatars: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      avatars: data || []
    });

  } catch (error) {
    console.error('Avatar fetch error:', error);
    return NextResponse.json({
      error: 'Failed to fetch avatars',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}