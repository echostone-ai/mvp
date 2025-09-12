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
  const query = searchParams.get('q') || '';
  const limit = parseInt(searchParams.get('limit') || '5');

  if (!avatarSlug) {
    return NextResponse.json(
      { error: 'Missing required parameter: avatar' },
      { status: 400 }
    );
  }

  if (limit < 1 || limit > 20) {
    return NextResponse.json(
      { error: 'Limit must be between 1 and 20' },
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

    const searchStartTime = Date.now();

    // Call the search_memories function
    const { data: searchResults, error: searchError } = await sbAdmin
      .rpc('search_memories', {
        p_slug: avatarSlug,
        p_query: query,
        p_limit: limit
      });

    const searchTime = Date.now() - searchStartTime;

    if (searchError) {
      console.error('Error calling search_memories:', searchError);
      return NextResponse.json(
        { error: 'Failed to search memories', details: searchError.message },
        { status: 500 }
      );
    }

    // Get quick_facts that match the query (simple text matching)
    const factsStartTime = Date.now();
    
    let quickFactsQuery = sbAdmin
      .from('quick_facts')
      .select('key, value, priority, confidence, source')
      .eq('avatar_id', avatar.id);

    // If query is provided, filter facts that contain the query text
    if (query.trim()) {
      quickFactsQuery = quickFactsQuery.or(`key.ilike.%${query}%,value.ilike.%${query}%`);
    }

    quickFactsQuery = quickFactsQuery.order('priority', { ascending: true }).limit(10);

    const { data: matchingFacts, error: factsError } = await quickFactsQuery;

    const factsTime = Date.now() - factsStartTime;

    if (factsError) {
      console.error('Error fetching matching facts:', factsError);
      return NextResponse.json(
        { error: 'Failed to fetch matching facts' },
        { status: 500 }
      );
    }

    // Get memory fragment analysis
    const fragmentsStartTime = Date.now();
    
    const { data: allFragments, error: fragmentsError } = await sbAdmin
      .from('memory_fragments')
      .select('fragment_text, created_at')
      .eq('avatar_id', avatar.id)
      .order('created_at', { ascending: false });

    const fragmentsTime = Date.now() - fragmentsStartTime;

    if (fragmentsError) {
      console.error('Error fetching memory fragments:', fragmentsError);
    }

    // Analyze fragment relevance if query is provided
    let fragmentAnalysis = null;
    if (query.trim() && allFragments) {
      const queryLower = query.toLowerCase();
      const matchingFragments = allFragments.filter(fragment => 
        fragment.fragment_text.toLowerCase().includes(queryLower)
      );

      fragmentAnalysis = {
        total_fragments: allFragments.length,
        matching_fragments: matchingFragments.length,
        match_percentage: allFragments.length > 0 
          ? Math.round((matchingFragments.length / allFragments.length) * 100)
          : 0,
        sample_matches: matchingFragments.slice(0, 3).map(fragment => ({
          text: fragment.fragment_text.substring(0, 150) + (fragment.fragment_text.length > 150 ? '...' : ''),
          created_at: fragment.created_at
        }))
      };
    }

    const totalProcessingTime = Date.now() - startTime;

    // Calculate result quality metrics
    const searchResultsCount = searchResults?.length || 0;
    const quickFactsCount = matchingFacts?.length || 0;
    
    const qualityMetrics = {
      search_results_found: searchResultsCount,
      quick_facts_matched: quickFactsCount,
      total_relevant_items: searchResultsCount + quickFactsCount,
      has_high_priority_facts: matchingFacts?.some(fact => fact.priority <= 2) || false,
      average_fact_confidence: quickFactsCount > 0 
        ? Math.round(matchingFacts.reduce((sum, fact) => sum + fact.confidence, 0) / quickFactsCount * 100) / 100
        : 0
    };

    return NextResponse.json({
      avatar: {
        id: avatar.id,
        slug: avatarSlug,
        display_name: avatar.display_name || avatar.name
      },
      query: {
        text: query,
        limit: limit,
        is_empty: !query.trim()
      },
      search_memories_results: {
        count: searchResultsCount,
        results: searchResults || [],
        processing_time_ms: searchTime
      },
      quick_facts_matching: {
        count: quickFactsCount,
        facts: matchingFacts || [],
        processing_time_ms: factsTime
      },
      memory_fragment_analysis: fragmentAnalysis,
      performance_timing: {
        search_memories_ms: searchTime,
        quick_facts_ms: factsTime,
        fragments_analysis_ms: fragmentsTime,
        total_processing_ms: totalProcessingTime
      },
      result_quality_metrics: qualityMetrics
    });

  } catch (error) {
    console.error('Error in search debug endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}