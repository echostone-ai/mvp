import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function GET(req: NextRequest) {
  try {
    // Check what's in the database for jonathan-demo
    const { data: profiles } = await serviceSupabase
      .from('avatar_profiles')
      .select('id, name')
      .ilike('name', '%jonathan%');

    const { data: avatars } = await serviceSupabase
      .from('avatars')
      .select('id, slug')
      .ilike('slug', '%jonathan%');

    // Get recent memory fragments
    const profileId = profiles?.[0]?.id;
    let recentFragments: any[] = [];
    if (profileId) {
      const { data: fragments } = await serviceSupabase
        .from('memory_fragments')
        .select('id, fragment_text, conversation_context, created_at')
        .eq('avatar_id', profileId)
        .order('created_at', { ascending: false })
        .limit(10);
      recentFragments = fragments || [];
    }

    return NextResponse.json({
      success: true,
      database_check: {
        avatar_profiles: profiles?.map(p => ({ id: p.id, name: p.name })) || [],
        avatars: avatars?.map(a => ({ id: a.id, slug: a.slug })) || [],
        using_profile_id: profileId,
        recent_fragments_count: recentFragments.length,
        recent_fragments: recentFragments.slice(0, 5).map(f => ({
          type: f.conversation_context?.type,
          visitor_id: f.conversation_context?.visitor_id,
          conversation_id: f.conversation_context?.conversation_id,
          text: f.fragment_text.substring(0, 100) + '...',
          created_at: f.created_at
        }))
      },
      recommendations: [
        profiles?.length === 0 ? 'No jonathan avatar found in avatar_profiles' : null,
        recentFragments.length === 0 ? 'No memory fragments found - conversation history will be empty' : null,
        recentFragments.filter(f => f.conversation_context?.visitor_id).length === 0 ? 'No fragments have visitor_id - session tracking not working' : null
      ].filter(Boolean)
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}