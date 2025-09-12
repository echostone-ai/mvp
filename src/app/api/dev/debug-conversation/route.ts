import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { EnhancedPromptBuilder } from '@/lib/services/enhancedPromptBuilder';

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    const { avatarSlug = 'jonathan_braden', visitorId } = await req.json();

    // Get avatar ID
    let avatar: { id: string; name?: string } | null = null;
    try {
      const { data, error } = await serviceSupabase
        .from('avatars')
        .select('id, name')
        .eq('slug', avatarSlug)
        .single();
      avatar = data as any;
    } catch (e) {
      // Fallback to avatar_profiles
      const { data: prof } = await serviceSupabase
        .from('avatar_profiles')
        .select('id, name')
        .eq('name', avatarSlug)
        .single();
      if (prof) {
        avatar = { id: prof.id, name: prof.name };
      }
    }

    if (!avatar) {
      return NextResponse.json({
        error: `Avatar not found: ${avatarSlug}`
      }, { status: 404 });
    }

    const conversationId = 'jonathan-demo';

    // Get all fragments for this avatar and conversation
    const { data: allFragments } = await serviceSupabase
      .from('memory_fragments')
      .select('id, fragment_text, conversation_context, created_at')
      .eq('avatar_id', avatar.id)
      .contains('conversation_context', { conversation_id: conversationId } as any)
      .order('created_at', { ascending: false })
      .limit(20);

    // Get fragments for specific visitor if provided
    let visitorFragments: any[] = [];
    if (visitorId) {
      const { data: vFragments } = await serviceSupabase
        .from('memory_fragments')
        .select('id, fragment_text, conversation_context, created_at')
        .eq('avatar_id', avatar.id)
        .contains('conversation_context', { conversation_id: conversationId, visitor_id: visitorId } as any)
        .order('created_at', { ascending: false })
        .limit(20);
      visitorFragments = vFragments || [];
    }

    // Test the enhanced prompt builder
    const enhancedBuilder = new EnhancedPromptBuilder();
    const conversationHistory = (visitorFragments.length > 0 ? visitorFragments : allFragments || [])
      .reverse()
      .map((row: any) => ({
        role: row.conversation_context?.type === 'assistant' ? 'assistant' : 'user',
        content: row.fragment_text as string,
        timestamp: row.created_at
      }))
      .slice(-8);

    const result = await enhancedBuilder.buildEnhancedSystemPromptWithStyle(
      avatarSlug,
      'test query',
      conversationHistory,
      { priorityFilter: 6, memoryLimit: 8, trackExpressions: true }
    );

    return NextResponse.json({
      success: true,
      avatar_slug: avatarSlug,
      avatar_id: avatar.id,
      conversation_id: conversationId,
      visitor_id: visitorId || 'not provided',
      debug_info: {
        total_fragments: (allFragments || []).length,
        visitor_fragments: visitorFragments.length,
        conversation_history_length: conversationHistory.length,
        fragments_by_type: {
          user: (allFragments || []).filter(f => f.conversation_context?.type === 'user').length,
          assistant: (allFragments || []).filter(f => f.conversation_context?.type === 'assistant').length
        }
      },
      recent_fragments: (allFragments || []).slice(0, 5).map(f => ({
        id: f.id,
        type: f.conversation_context?.type,
        visitor_id: f.conversation_context?.visitor_id,
        text: f.fragment_text.substring(0, 100) + '...',
        created_at: f.created_at
      })),
      conversation_history: conversationHistory.map(h => ({
        role: h.role,
        content: h.content.substring(0, 100) + '...',
        timestamp: h.timestamp
      })),
      prompt_includes_conversation: result.prompt.includes('CONVERSATION SO FAR:'),
      conversation_section_preview: result.prompt.includes('CONVERSATION SO FAR:') 
        ? result.prompt.split('CONVERSATION SO FAR:')[1]?.substring(0, 500) + '...'
        : 'No conversation section found'
    });

  } catch (error) {
    console.error('Conversation debug error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Conversation Debug Endpoint',
    description: 'Debug conversation history and context for avatars',
    usage: 'POST with avatarSlug and optional visitorId',
    example_request: {
      avatarSlug: 'jonathan-demo',
      visitorId: 'optional-visitor-id'
    }
  });
}