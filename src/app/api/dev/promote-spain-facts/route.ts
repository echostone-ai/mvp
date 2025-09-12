import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const { avatar = 'jonathan_braden' } = await req.json();

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

    // Find Spain/Valencia fragments
    const { data: spainFragments, error: fragmentError } = await serviceSupabase
      .from('memory_fragments')
      .select('id, fragment_text, created_at')
      .eq('avatar_id', profile.id)
      .or('fragment_text.ilike.%spain%,fragment_text.ilike.%valencia%,fragment_text.ilike.%lived%')
      .order('created_at', { ascending: false })
      .limit(20);

    if (fragmentError) {
      return NextResponse.json({
        error: 'Failed to query fragments',
        details: fragmentError.message
      }, { status: 500 });
    }

    const promotions: any[] = [];
    const spainMentions = (spainFragments || []).filter(f => 
      f.fragment_text.toLowerCase().includes('spain') || 
      f.fragment_text.toLowerCase().includes('valencia')
    );

    // Check if we already have Spain facts
    const { data: existingFacts } = await serviceSupabase
      .from('quick_facts')
      .select('key, value')
      .eq('avatar_id', profile.id)
      .or('value.ilike.%spain%,value.ilike.%valencia%');

    const hasSpainFacts = (existingFacts || []).length > 0;

    if (!hasSpainFacts && spainMentions.length > 0) {
      // Find the most detailed Spain mention
      const bestSpainFragment = spainMentions
        .sort((a, b) => b.fragment_text.length - a.fragment_text.length)[0];

      // Extract place info
      let placeValue = 'Valencia, Spain';
      if (bestSpainFragment.fragment_text.toLowerCase().includes('valencia')) {
        placeValue = 'Valencia, Spain';
      } else if (bestSpainFragment.fragment_text.toLowerCase().includes('spain')) {
        placeValue = 'Spain';
      }

      // Get next places_lived index
      const { data: existingPlaces } = await serviceSupabase
        .from('quick_facts')
        .select('key')
        .eq('avatar_id', profile.id)
        .like('key', 'places_lived_%');

      const placeIndices = (existingPlaces || [])
        .map(f => f.key)
        .filter(k => /^places_lived_\d+$/.test(k))
        .map(k => parseInt(k.split('_').pop() || '0', 10));
      
      const nextIndex = placeIndices.length > 0 ? Math.max(...placeIndices) + 1 : 1;

      // Promote to quick_facts
      const { error: insertError } = await serviceSupabase
        .from('quick_facts')
        .insert({
          avatar_id: profile.id,
          key: `places_lived_${nextIndex}`,
          value: placeValue,
          confidence: 0.85,
          priority: 3,
          source: 'extraction',
          source_reference: `Promoted from fragment: ${bestSpainFragment.id}`
        });

      if (!insertError) {
        promotions.push({
          key: `places_lived_${nextIndex}`,
          value: placeValue,
          source_fragment: bestSpainFragment.id,
          fragment_text: bestSpainFragment.fragment_text.substring(0, 200)
        });
      }
    }

    return NextResponse.json({
      success: true,
      avatar_name: avatar,
      avatar_id: profile.id,
      spain_fragments_found: spainMentions.length,
      existing_spain_facts: hasSpainFacts,
      promotions_made: promotions.length,
      promotions,
      message: promotions.length > 0 
        ? `Promoted ${promotions.length} Spain facts to quick_facts`
        : hasSpainFacts 
          ? 'Spain facts already exist in quick_facts'
          : 'No Spain fragments found to promote'
    });

  } catch (error) {
    console.error('Spain facts promotion error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}