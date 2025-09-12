import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  // Restrict access to development environments only
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Debug endpoints are not available in production' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const avatarSlug = searchParams.get('avatar');

  if (!avatarSlug) {
    return NextResponse.json(
      { error: 'Missing required parameter: avatar' },
      { status: 400 }
    );
  }

  const startTime = Date.now();

  try {
    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: 'Missing Supabase configuration' },
        { status: 500 }
      );
    }

    const sbAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });
    // Get avatar ID from slug
    const { data: avatar, error: avatarError } = await sbAdmin
      .from('avatar_profiles')
      .select('id, name, display_name')
      .eq('name', avatarSlug)
      .single();

    if (avatarError || !avatar) {
      return NextResponse.json(
        { error: `Avatar not found: ${avatarSlug}` },
        { status: 404 }
      );
    }

    // Get quick facts count and breakdown by priority
    const { data: quickFactsData, error: factsError } = await sbAdmin
      .from('quick_facts')
      .select('priority, confidence, source')
      .eq('avatar_id', avatar.id);

    if (factsError) {
      console.error('Error fetching quick facts:', factsError);
      return NextResponse.json(
        { error: 'Failed to fetch quick facts' },
        { status: 500 }
      );
    }

    // Calculate quick facts statistics
    const quickFactsCount = quickFactsData?.length || 0;
    const factsByPriority = quickFactsData?.reduce((acc, fact) => {
      acc[fact.priority] = (acc[fact.priority] || 0) + 1;
      return acc;
    }, {} as Record<number, number>) || {};

    const factsBySource = quickFactsData?.reduce((acc, fact) => {
      acc[fact.source] = (acc[fact.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    const averageConfidence = quickFactsData?.length > 0 
      ? quickFactsData.reduce((sum, fact) => sum + fact.confidence, 0) / quickFactsData.length
      : 0;

    // Get memory fragments count and top memories preview
    const { data: memoryData, error: memoryError } = await sbAdmin
      .from('memory_fragments')
      .select('fragment_text, created_at')
      .eq('avatar_id', avatar.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (memoryError) {
      console.error('Error fetching memory fragments:', memoryError);
      return NextResponse.json(
        { error: 'Failed to fetch memory fragments' },
        { status: 500 }
      );
    }

    const memoriesCount = memoryData?.length || 0;
    const topMemories = memoryData?.map(memory => ({
      text: memory.fragment_text.substring(0, 100) + (memory.fragment_text.length > 100 ? '...' : ''),
      created_at: memory.created_at
    })) || [];

    // Get traits count (personality profile data)
    const { data: profileData, error: profileError } = await sbAdmin
      .from('avatar_profiles')
      .select('personality, speaking_style, background_story')
      .eq('id', avatar.id)
      .single();

    if (profileError) {
      console.error('Error fetching avatar profile:', profileError);
    }

    // Count traits from profile data
    let traitsCount = 0;
    if (profileData?.personality) traitsCount++;
    if (profileData?.speaking_style) traitsCount++;
    if (profileData?.background_story) traitsCount++;

    const processingTime = Date.now() - startTime;

    return NextResponse.json({
      avatar: {
        id: avatar.id,
        slug: avatarSlug,
        display_name: avatar.display_name || avatar.name
      },
      quick_facts: {
        count: quickFactsCount,
        by_priority: factsByPriority,
        by_source: factsBySource,
        average_confidence: Math.round(averageConfidence * 100) / 100
      },
      traits: {
        count: traitsCount,
        has_personality: !!profileData?.personality,
        has_speaking_style: !!profileData?.speaking_style,
        has_background_story: !!profileData?.background_story
      },
      memories: {
        count: memoriesCount,
        top_memories_preview: topMemories
      },
      processing_time_ms: processingTime,
      extraction_statistics: {
        facts_per_memory: memoriesCount > 0 ? Math.round((quickFactsCount / memoriesCount) * 100) / 100 : 0,
        high_priority_facts: factsByPriority[1] || 0,
        medium_priority_facts: (factsByPriority[2] || 0) + (factsByPriority[3] || 0),
        low_priority_facts: Object.keys(factsByPriority)
          .filter(p => parseInt(p) >= 4)
          .reduce((sum, p) => sum + factsByPriority[parseInt(p)], 0)
      }
    });

  } catch (error) {
    console.error('Error in persona debug endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}