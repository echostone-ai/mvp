import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const avatarId = searchParams.get('id');
    
    console.log('[DEBUG AVATAR] Checking avatar ID:', avatarId);
    
    if (!avatarId) {
      return NextResponse.json({ error: 'Avatar ID is required' }, { status: 400 });
    }

    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log('[DEBUG AVATAR] Supabase client created, querying avatar_profiles table...');

    // Get avatar without user filter to see if it exists at all
    const { data: avatar, error } = await adminSupabase
      .from('avatar_profiles')
      .select('*')
      .eq('id', avatarId)
      .single();

    console.log('[DEBUG AVATAR] Query result:', { avatar: !!avatar, error: error?.message });

    // Also try to get all avatars to see if the table is accessible
    const { data: allAvatars, error: allError } = await adminSupabase
      .from('avatar_profiles')
      .select('id, name, user_id')
      .limit(10);

    console.log('[DEBUG AVATAR] Sample avatars:', { count: allAvatars?.length, error: allError?.message });

    // Try a different approach - search by partial ID
    const { data: partialMatch, error: partialError } = await adminSupabase
      .from('avatar_profiles')
      .select('id, name, user_id')
      .ilike('id', `%${avatarId.slice(-8)}%`);

    console.log('[DEBUG AVATAR] Partial ID match:', { count: partialMatch?.length, error: partialError?.message });

    return NextResponse.json({
      success: true,
      avatar,
      error: error?.message,
      exists: !!avatar,
      debug: {
        avatarId,
        hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        sampleAvatarsCount: allAvatars?.length || 0,
        sampleAvatarsError: allError?.message,
        sampleAvatars: allAvatars?.map(a => ({ id: a.id, name: a.name })),
        queryError: error?.message,
        partialMatchCount: partialMatch?.length || 0,
        partialMatches: partialMatch?.map(a => ({ id: a.id, name: a.name }))
      }
    });

  } catch (error: any) {
    console.error('[DEBUG AVATAR] Unexpected error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}