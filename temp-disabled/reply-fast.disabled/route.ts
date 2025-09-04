import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { convoLatency } from '@/lib/metrics';
import { pickModel } from '@/lib/modelRouter';
import { logger } from '@/lib/logger';
import { createClient } from '@supabase/supabase-js';
import { EnhancedPromptBuilder } from '@/lib/services/enhancedPromptBuilder';
import { ConversationService } from '@/lib/services/conversationService';
import { ConversationTurn } from '@/lib/services/promptBuilder';
import { v4 as uuidv4 } from 'uuid';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: NextRequest) {
  const requestStart = Date.now();
  
  try {
    const { prompt, avatarSlug = 'jonathan-demo', debug } = await req.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
    }

    // Fast visitor ID extraction
    const cookiesHeader = req.headers.get('cookie') || '';
    const visitorId = cookiesHeader.match(/jd_vid=([^;]+)/)?.[1] || uuidv4();
    const setVisitorCookie = cookiesHeader.includes('jd_vid=') ? null : 
      `jd_vid=${encodeURIComponent(visitorId)}; Path=/; Max-Age=31536000; SameSite=Lax`;

    // Get avatar ID quickly (try avatar_profiles then avatars)
    let avatar: { id: string } | null = null;
    try {
      const { data } = await serviceSupabase
        .from('avatar_profiles')
        .select('id')
        .eq('name', avatarSlug)
        .single();
      avatar = data as any;
    } catch {}

    if (!avatar) {
      const { data } = await serviceSupabase
        .from('avatars')
        .select('id')
        .eq('slug', avatarSlug)
        .single();
      avatar = data as any;
    }

    if (!avatar) {
      return NextResponse.json({ error: 'Avatar not found' }, { status: 404 });
    }

    const conversationId = 'jonathan-demo';

    // Parallel operations for speed
    const [conversationHistory] = await Promise.all([
      // Get conversation history
      serviceSupabase
        .from('memory_fragments')
        .select('fragment_text, conversation_context, created_at')
        .eq('avatar_id', avatar.id)
        .contains('conversation_context', { conversation_id: conversationId, visitor_id: visitorId } as any)
        .order('created_at', { ascending: false })
        .limit(8)
        .then(({ data }) => 
          (data || [])
            .reverse()
            .map((row: any) => ({
              role: row.conversation_context?.type === 'assistant' ? 'assistant' : 'user',
              content: row.fragment_text,
              timestamp: row.created_at
            } as ConversationTurn))
            .slice(-6)
        ),
      
      // Store user message (fire and forget for speed)
      serviceSupabase.from('memory_fragments').insert({
        avatar_id: avatar.id,
        fragment_text: prompt,
        conversation_context: {
          source: 'chat',
          type: 'user',
          conversation_id: conversationId,
          visitor_id: visitorId,
          tags: ['query']
        }
      }).then(() => {}).catch(() => {}) // Ignore errors for speed
    ]);

    const historyFetchTime = Date.now();

    // Build prompt with unified enhanced builder in fast mode
    const enhancedBuilder = new EnhancedPromptBuilder(serviceSupabase);
    const result = await enhancedBuilder.buildEnhancedSystemPromptWithStyle(
      avatarSlug,
      prompt,
      conversationHistory,
      {
        priorityFilter: 4, // More aggressive filtering for speed
        memoryLimit: 4,
        trackExpressions: false, // Skip expressions for speed
        fastMode: true,
        debug: debug
      }
    );
    const systemPrompt = result.prompt;

    const promptBuildTime = Date.now();

    const useSvc = process.env.FEATURE_GPT5_ENABLED === 'true';
    const modelToUse = useSvc ? pickModel() : (result.metadata.model_recommendation || 'gpt-4o-mini');
    let text: string;
    let openaiTime: number;
    if (useSvc) {
      const svc = new ConversationService();
      const run = await svc.processConversation({
        avatarId: avatarSlug,
        userInput: prompt,
        sessionId: conversationId,
        visitorId,
        fastMode: true,
      });
      text = run.text;
      openaiTime = Date.now();
    } else {
      const completion = await openai.chat.completions.create({
        model: modelToUse,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        max_tokens: 200, // Shorter for speed
        temperature: 0.7,
        top_p: 0.9,
        frequency_penalty: 0.1,
        presence_penalty: 0
      });
      openaiTime = Date.now();
      text = completion.choices?.[0]?.message?.content?.trim() || '…';
    }

    // Store assistant reply (fire and forget)
    serviceSupabase.from('memory_fragments').insert({
      avatar_id: avatar.id,
      fragment_text: text,
      conversation_context: {
        source: 'chat',
        type: 'assistant',
        conversation_id: conversationId,
        visitor_id: visitorId,
        gist: text.split('.')[0] || text.substring(0, 100),
        tags: ['reply']
      }
    }).then(() => {}).catch(() => {}); // Fire and forget

    const totalTime = Date.now() - requestStart;
    try { convoLatency.observe({ route: 'reply-fast', model: modelToUse, mode: 'fast' }, totalTime); } catch {}
    try { logger.info({ route: 'reply-fast', model: modelToUse, latencyMs: totalTime, fastMode: true }, 'reply-fast-turn'); } catch {}

    const response = NextResponse.json({ 
      text,
      debug: debug ? {
        timing: {
          total_ms: totalTime,
          history_fetch_ms: historyFetchTime - requestStart,
          prompt_build_ms: promptBuildTime - historyFetchTime,
          openai_ms: openaiTime - promptBuildTime,
          storage_ms: Date.now() - openaiTime
        },
        conversation_turns: conversationHistory.length,
        visitor_id: visitorId,
        prompt_preview: systemPrompt.substring(0, 300) + '...',
        enhanced_metadata: result.metadata,
        model_used: modelToUse
      } : undefined
    });

    if (setVisitorCookie) {
      response.headers.set('Set-Cookie', setVisitorCookie);
    }

    return response;

  } catch (error: any) {
    console.error('[reply-fast] error:', error);
    return NextResponse.json({ 
      error: error?.message || 'Reply failed',
      timing: { total_ms: Date.now() - requestStart }
    }, { status: 500 });
  }
}