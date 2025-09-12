// Avatar Creation API - For Onboarding New Avatars
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ProfileOptimizer } from '@/lib/profileOptimization';
import { AvatarOnboardingService, AvatarOnboardingData } from '@/lib/services/avatarOnboardingService';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      profile, 
      heygenConfig, 
      userId = 'demo',
      // New style-related fields
      expressions,
      catchphrases,
      address_terms,
      speaking_style
    } = body;
    
    // Support both legacy and new creation methods
    if (profile && heygenConfig) {
      // Legacy creation method
      return await createLegacyAvatar(profile, heygenConfig, userId);
    }

    // New enhanced creation method
    const { name, core_facts } = body;
    if (!name) {
      return NextResponse.json({ error: 'Avatar name is required' }, { status: 400 });
    }

    const onboardingData: AvatarOnboardingData = {
      name,
      speaking_style,
      expressions,
      catchphrases,
      address_terms,
      core_facts
    };

    const result = await AvatarOnboardingService.createAvatarWithStyle(onboardingData, userId);

    if (result.success) {
      return NextResponse.json({
        success: true,
        avatarId: result.avatarId,
        message: 'Avatar created successfully with enhanced onboarding integration',
        factCount: result.factCount,
        warnings: result.warnings.length > 0 ? result.warnings : undefined,
        errors: result.errors.length > 0 ? result.errors : undefined,
        features: [
          'Immediate fact availability for first conversation',
          'Validated fact categorization and prioritization',
          'Seamless transition from setup to conversation mode',
          'Pre-injected context for GPT-5 processing'
        ]
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Failed to create avatar',
        errors: result.errors,
        warnings: result.warnings.length > 0 ? result.warnings : undefined,
        factCount: result.factCount
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Avatar creation error:', error);
    return NextResponse.json({
      error: 'Failed to create avatar',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Legacy avatar creation function
async function createLegacyAvatar(profile: any, heygenConfig: any, userId: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

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