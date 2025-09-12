import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const avatar = searchParams.get('avatar') || 'jonathan_braden';

    // Get the canonical avatar_profiles.id
    const { data: profile, error: profileError } = await serviceSupabase
      .from('avatar_profiles')
      .select('id, name')
      .eq('name', avatar)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({
        error: `Avatar profile not found: ${avatar}`,
        details: profileError?.message
      }, { status: 404 });
    }

    // Count fragments by avatar_id
    const { data: fragmentCounts, error: fragmentError } = await serviceSupabase
      .from('memory_fragments')
      .select('avatar_id')
      .or(`avatar_id.eq.${profile.id},fragment_text.ilike.%${avatar}%,conversation_context->>avatar_name.ilike.%${avatar}%`);

    if (fragmentError) {
      return NextResponse.json({
        error: 'Failed to query fragments',
        details: fragmentError.message
      }, { status: 500 });
    }

    // Group by avatar_id
    const grouped = (fragmentCounts || []).reduce((acc: any, row: any) => {
      const avatarId = row.avatar_id;
      acc[avatarId] = (acc[avatarId] || 0) + 1;
      return acc;
    }, {});

    // Also check quick_facts
    const { data: factCounts, error: factError } = await serviceSupabase
      .from('quick_facts')
      .select('avatar_id')
      .or(`avatar_id.eq.${profile.id}`);

    const factGrouped = (factCounts || []).reduce((acc: any, row: any) => {
      const avatarId = row.avatar_id;
      acc[avatarId] = (acc[avatarId] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      avatar_name: avatar,
      canonical_avatar_id: profile.id,
      fragment_ownership: grouped,
      quick_facts_ownership: factGrouped,
      total_fragments: Object.values(grouped).reduce((sum: number, count: any) => sum + count, 0),
      total_facts: Object.values(factGrouped).reduce((sum: number, count: any) => sum + count, 0),
      is_consolidated: Object.keys(grouped).length <= 1 && Object.keys(factGrouped).length <= 1,
      recommendation: Object.keys(grouped).length > 1 || Object.keys(factGrouped).length > 1 
        ? 'Data is split across multiple avatar_ids - needs consolidation'
        : 'Data is properly consolidated'
    });

  } catch (error) {
    console.error('Fragment ownership check error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}