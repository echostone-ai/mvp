export const runtime = 'nodejs';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { resolveAvatarId } from '@/lib/services/identity';

interface DebugResponse {
  avatar_id: string;
  quick_facts_count: number;
  sample_keys: string[];
  mem_count_last_24h: number;
  last_3_mems: Array<{
    role: 'user' | 'assistant';
    text: string;
    ts: string;
  }>;
}

export async function GET(req: NextRequest) {
  try {
    // Get query parameters first for validation
    const { searchParams } = new URL(req.url);
    const avatarSlug = searchParams.get('avatarSlug');
    const profileName = searchParams.get('profileName');

    if (!avatarSlug && !profileName) {
      return NextResponse.json({ 
        error: 'Either avatarSlug or profileName query parameter is required' 
      }, { status: 400 });
    }

    // Check DEBUG_SECRET header
    const debugSecret = req.headers.get('DEBUG_SECRET');
    if (!debugSecret || debugSecret !== process.env.DEBUG_SECRET) {
      return NextResponse.json({ error: 'Unauthorized - DEBUG_SECRET required' }, { status: 401 });
    }

    // Check if supabaseAdmin is available
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Supabase admin client not initialized' }, { status: 500 });
    }

    // Resolve avatar ID using the identity service
    let avatar_id: string;
    try {
      avatar_id = await resolveAvatarId({ avatarSlug, profileName }, supabaseAdmin);
    } catch (error) {
      return NextResponse.json({ 
        error: `Avatar resolution failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }, { status: 404 });
    }

    // Get quick facts count and sample keys
    const { data: quickFacts, error: factsError } = await supabaseAdmin
      .from('quick_facts')
      .select('fact_key')
      .eq('avatar_id', avatar_id);

    if (factsError) {
      return NextResponse.json({ 
        error: `Failed to fetch quick facts: ${factsError.message}` 
      }, { status: 500 });
    }

    const quick_facts_count = quickFacts?.length || 0;
    const sample_keys = quickFacts
      ?.map(f => f.fact_key)
      .filter((key, index, arr) => arr.indexOf(key) === index) // Remove duplicates
      .slice(0, 12) || [];

    // Get memory count from last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    
    const { count: mem_count_last_24h, error: memCountError } = await supabaseAdmin
      .from('memory_fragments')
      .select('*', { count: 'exact', head: true })
      .eq('avatar_id', avatar_id)
      .gte('created_at', twentyFourHoursAgo);

    if (memCountError) {
      return NextResponse.json({ 
        error: `Failed to fetch memory count: ${memCountError.message}` 
      }, { status: 500 });
    }

    // Get last 3 memories
    const { data: recentMems, error: recentMemsError } = await supabaseAdmin
      .from('memory_fragments')
      .select('role, text, created_at')
      .eq('avatar_id', avatar_id)
      .order('created_at', { ascending: false })
      .limit(3);

    if (recentMemsError) {
      return NextResponse.json({ 
        error: `Failed to fetch recent memories: ${recentMemsError.message}` 
      }, { status: 500 });
    }

    const last_3_mems = recentMems?.map(mem => ({
      role: (mem.role as 'user' | 'assistant') || 'user',
      text: mem.text || '',
      ts: mem.created_at || ''
    })) || [];

    const response: DebugResponse = {
      avatar_id,
      quick_facts_count,
      sample_keys,
      mem_count_last_24h: mem_count_last_24h || 0,
      last_3_mems
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('[DEBUG JD] Unexpected error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}