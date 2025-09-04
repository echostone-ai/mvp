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
    let profile: any = null;
    let profileError: any = null;
    try {
      const { data } = await serviceSupabase
        .from('avatar_profiles')
        .select('id, name')
        .eq('name', avatar)
        .single();
      profile = data;
    } catch (e) {
      profileError = e;
    }

    if (!profile) {
      const { data } = await serviceSupabase
        .from('avatars')
        .select('id, slug')
        .eq('slug', avatar)
        .single();
      if (data?.id) profile = { id: data.id, name: avatar };
    }

    if (profileError || !profile) {
      return NextResponse.json({
        error: `Avatar profile not found: ${avatar}`,
        details: profileError?.message
      }, { status: 404 });
    }

    // Get all quick facts
    const { data: facts, error: factsError } = await serviceSupabase
      .from('quick_facts')
      .select('key, value, priority, confidence, source, created_at')
      .eq('avatar_id', profile.id)
      .order('priority')
      .order('confidence', { ascending: false });
    // Check pet facts
    const petFacts = (facts || []).filter(f => f.key.startsWith('pet_') || f.value.toLowerCase().includes('romeo'));

    if (factsError) {
      return NextResponse.json({
        error: 'Failed to query facts',
        details: factsError.message
      }, { status: 500 });
    }

    // Categorize facts
    const categorized = {
      identity: facts?.filter(f => f.priority <= 2) || [],
      places: facts?.filter(f => 
        f.key.includes('place') || 
        f.key.includes('location') || 
        f.key.includes('birth') ||
        f.key.startsWith('places_lived_') ||
        f.key === 'moved_to' ||
        f.key === 'current_city' ||
        f.key === 'hometown'
      ) || [],
      all_facts: facts || []
    };

    // Check for Spain-related content
    const spainFacts = facts?.filter(f => 
      f.value.toLowerCase().includes('spain') || 
      f.value.toLowerCase().includes('valencia')
    ) || [];

    // Check memory fragments for Spain content
    const { data: spainFragments, error: fragmentError } = await serviceSupabase
      .from('memory_fragments')
      .select('id, fragment_text, created_at, conversation_context')
      .eq('avatar_id', profile.id)
      .or('fragment_text.ilike.%spain%,fragment_text.ilike.%valencia%')
      .order('created_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      success: true,
      avatar_name: avatar,
      avatar_id: profile.id,
      facts_summary: {
        total_facts: facts?.length || 0,
        identity_facts: categorized.identity.length,
        place_facts: categorized.places.length,
        spain_facts: spainFacts.length,
        pet_facts: petFacts.length
      },
      pets: petFacts,
      place_facts: categorized.places.map(f => ({
        key: f.key,
        value: f.value,
        priority: f.priority,
        confidence: f.confidence
      })),
      spain_content: {
        facts: spainFacts.map(f => ({
          key: f.key,
          value: f.value,
          priority: f.priority
        })),
        fragments: (spainFragments || []).map(f => ({
          id: f.id,
          text: f.fragment_text.substring(0, 200),
          created_at: f.created_at
        }))
      },
      recommendations: [
        spainFacts.length === 0 && (spainFragments?.length || 0) > 0 
          ? 'Spain mentioned in fragments but no quick_facts - consider promoting'
          : null,
        categorized.places.length === 0 
          ? 'No place facts found - may need to add places_lived_* facts'
          : null
      ].filter(Boolean)
    });

  } catch (error) {
    console.error('Facts check error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}