import { NextRequest, NextResponse } from 'next/server';
import { EnhancedPromptBuilder } from '@/lib/services/enhancedPromptBuilder';
import { createClient } from '@supabase/supabase-js';

/**
 * Dev endpoint for debugging prompts and entity resolution
 * Returns the final composed prompt + resolved entity for debugging
 */
export async function POST(req: NextRequest) {
  try {
    const { 
      avatarSlug = 'jonathan-demo',
      query = 'who\'s romeo?',
      history = []
    } = await req.json();

    if (!avatarSlug || !query) {
      return NextResponse.json({
        error: 'avatarSlug and query are required',
        example: {
          avatarSlug: 'jonathan-demo',
          query: 'who\'s romeo?',
          history: [
            { role: 'user', content: 'Hi there!', timestamp: '2024-01-01T00:00:00Z' },
            { role: 'assistant', content: 'Hey! What\'s up?!', timestamp: '2024-01-01T00:01:00Z' }
          ]
        }
      }, { status: 400 });
    }

    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
    const enhancedBuilder = new EnhancedPromptBuilder(serviceSupabase);
    
    // Get avatar ID first
    const avatarId = await enhancedBuilder.getAvatarIdFromSlug(avatarSlug);
    if (!avatarId) {
      return NextResponse.json({
        error: `Avatar not found: ${avatarSlug}`
      }, { status: 404 });
    }

    // Fetch facts and memories for entity resolution
    const [quickFacts, relevantMemories] = await Promise.all([
      enhancedBuilder.fetchQuickFacts(avatarId, 6),
      enhancedBuilder.fetchRelevantMemories(avatarId, query, 8)
    ]);

    // Resolve entity
    const resolvedEntity = await enhancedBuilder.resolveEntityFromName(
      query, 
      quickFacts, 
      relevantMemories, 
      history
    );

    // Build full prompt
    const result = await enhancedBuilder.buildEnhancedSystemPromptWithStyle(
      avatarSlug,
      query,
      history,
      { priorityFilter: 6, memoryLimit: 8, trackExpressions: true }
    );

    return NextResponse.json({
      success: true,
      debug_info: {
        avatar_slug: avatarSlug,
        avatar_id: avatarId,
        query,
        history_turns: history.length,
        resolved_entity: resolvedEntity ? {
          name: resolvedEntity.name,
          type: resolvedEntity.type,
          context: resolvedEntity.context,
          facts_count: resolvedEntity.facts.length,
          aliases: resolvedEntity.aliases,
          facts: resolvedEntity.facts.map(f => ({ key: f.key, value: f.value }))
        } : null,
        facts_available: quickFacts.length,
        memories_available: relevantMemories.length
      },
      final_prompt: result.prompt,
      metadata: result.metadata
    });

  } catch (error) {
    console.error('Prompt debug error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Prompt Debug Endpoint',
    description: 'Debug prompts and entity resolution for avatars',
    usage: 'POST with avatarSlug, query, and optional history',
    example_request: {
      avatarSlug: 'jonathan-demo',
      query: 'how\'s romeo?',
      history: [
        { role: 'user', content: 'do you have pets?', timestamp: '2024-01-01T00:00:00Z' },
        { role: 'assistant', content: 'Yes! I have a toy poodle named Romeo.', timestamp: '2024-01-01T00:01:00Z' }
      ]
    },
    what_it_shows: [
      'Final composed system prompt',
      'Resolved entity information',
      'Available facts and memories',
      'Expression tracking metadata'
    ]
  });
}