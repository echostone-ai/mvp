import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'
import { PromptBuilder, ConversationTurn } from '@/lib/services/promptBuilder'
import { EnhancedPromptBuilder } from '@/lib/services/enhancedPromptBuilder'
import { injectFactsFromMessage } from '@/lib/services'
import { MemoryExtractionService, MemoryStorageService } from '@/lib/memoryService'
import { v4 as uuidv4 } from 'uuid'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// EchoStone architecture: Use service role for server-side operations
const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const urlDebug = url.searchParams.get('debug') === 'true'
    const { prompt, avatarSlug = 'jonathan-demo', debug } = await req.json()

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })
    }

    // Per-visitor continuity: identify or assign a visitor ID cookie
    const cookiesHeader = req.headers.get('cookie') || '';
    const cookieMap = Object.fromEntries(cookiesHeader.split(/;\s*/).filter(Boolean).map(p => {
      const idx = p.indexOf('=');
      return idx === -1 ? [p, ''] : [decodeURIComponent(p.slice(0, idx)), decodeURIComponent(p.slice(idx + 1))];
    }));
    let visitorId = cookieMap['jd_vid'] || '';
    let setVisitorCookie: string | null = null;
    if (!visitorId) {
      visitorId = uuidv4();
      // 1 year
      setVisitorCookie = `jd_vid=${encodeURIComponent(visitorId)}; Path=/; Max-Age=31536000; SameSite=Lax`;
    }

    // 1) Get avatar info (support both schemas): avatar_profiles.name then avatars.slug
    let avatar: { id: string; name?: string } | null = null
    let avatarError: any = null
    try {
      const { data, error } = await serviceSupabase
        .from('avatars')
        .select('id, name')
        .eq('slug', avatarSlug)
        .single()
      avatar = data as any
      avatarError = error
    } catch (e) {
      avatarError = e
    }

    if (!avatar) {
      // Fallback: avatars by slug
      const { data, error } = await serviceSupabase
        .from('avatars')
        .select('id, slug')
        .eq('slug', avatarSlug)
        .single()
      if (data?.id) {
        avatar = { id: data.id, name: avatarSlug }
      } else {
        // Final fallback: legacy table avatar_profiles by name
        const { data: prof, error: profErr } = await serviceSupabase
          .from('avatar_profiles')
          .select('id, name')
          .eq('name', avatarSlug)
          .single()
        if (prof) {
          avatar = { id: prof.id, name: prof.name }
        } else {
          console.error('[reply] Avatar not found in avatars or avatar_profiles:', avatarError || error || profErr)
          return NextResponse.json({ error: 'Avatar not found' }, { status: 404 })
        }
      }
    }

    // Short-term conversation history for the “jonathan-demo” session
    const conversationId = 'jonathan-demo'

    // Store user question fragment
    try {
      await serviceSupabase.from('memory_fragments').insert({
        avatar_id: avatar.id,
        fragment_text: prompt,
        conversation_context: {
          source: 'chat',
          type: 'user',
          conversation_id: conversationId,
          visitor_id: visitorId,
          tags: ['query']
        }
      })
    } catch (e) {
      console.warn('[reply] failed to insert user fragment:', e)
    }

    // Fetch last 8 turns with superset visitor matching (visitor or legacy null)
    const { data: superset, error: supersetError } = await serviceSupabase
      .from('memory_fragments')
      .select('id, fragment_text, conversation_context, created_at')
      .eq('avatar_id', avatar.id)
      .contains('conversation_context', { conversation_id: conversationId } as any)
      .or(`conversation_context->>visitor_id.eq.${visitorId},conversation_context->>visitor_id.is.null`)
      .order('created_at', { ascending: false })
      .limit(50)

    let supersetRows = superset || []
    if (supersetError) {
      // Fallback: merge exact visitor rows with recent legacy (null visitor)
      const [visitorRes, recentRes] = await Promise.all([
        serviceSupabase
          .from('memory_fragments')
          .select('id, fragment_text, conversation_context, created_at')
          .eq('avatar_id', avatar.id)
          .contains('conversation_context', { conversation_id: conversationId, visitor_id: visitorId } as any)
          .order('created_at', { ascending: false })
          .limit(50),
        serviceSupabase
          .from('memory_fragments')
          .select('id, fragment_text, conversation_context, created_at')
          .eq('avatar_id', avatar.id)
          .order('created_at', { ascending: false })
          .limit(50)
      ])
      const visitorRows = visitorRes.data || []
      const legacyCandidates = (recentRes.data || []).filter(r => !r?.conversation_context?.visitor_id)
      const byId = new Map<string, any>()
      for (const r of [...visitorRows, ...legacyCandidates]) byId.set(r.id, r)
      supersetRows = Array.from(byId.values())
    }

    const ranked = (supersetRows || [])
      .map((m: any) => ({ ...m, __score: m.conversation_context?.visitor_id === visitorId ? 1 : 0 }))
      .sort((a: any, b: any) => (b.__score - a.__score) || (new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
      .slice(0, 16)

    let historyRows = ranked
    if (!historyRows || historyRows.length === 0) {
      const { data: fallback } = await serviceSupabase
        .from('memory_fragments')
        .select('fragment_text, conversation_context, created_at')
        .eq('avatar_id', avatar.id)
        .order('created_at', { ascending: false })
        .limit(16)
      historyRows = fallback || []
    }

    const conversationHistory: ConversationTurn[] = (historyRows || [])
      .reverse()
      .map((row: any) => ({
        role: row.conversation_context?.type === 'assistant' ? 'assistant' : 'user',
        content: row.fragment_text as string,
        timestamp: row.created_at
      }))
      .slice(-8) // Last 8 turns for better context

    // Build enhanced system prompt with consolidated pipeline
    let enhancedPrompt = '';
    let debugInfo: any = undefined;
    try {
      const enhancedBuilder = new EnhancedPromptBuilder(serviceSupabase);
      const result = await enhancedBuilder.buildEnhancedSystemPromptWithStyle(
        avatarSlug,
        prompt,
        conversationHistory,
        { 
          priorityFilter: 6, 
          memoryLimit: 8, 
          trackExpressions: true,
          fastMode: true, // Use fast mode for speed
          debug: debug || urlDebug
        }
      );
      enhancedPrompt = result.prompt;
      debugInfo = result.debug;
    } catch (error) {
      console.warn('Enhanced prompt builder failed:', error);
      enhancedPrompt = `You are a warm, friendly avatar. Be natural and conversational.`;
    }

    const messages = [
      { role: 'system', content: enhancedPrompt },
      { role: 'user', content: prompt }
    ] as const

    // 6) Call OpenAI with low creativity and both strings passed
    if (!process.env.OPENAI_API_KEY) {
      const fallback = `I'm here, but I don't have my full memory or language services configured yet. Could you try again in a bit?`
      return NextResponse.json({ text: fallback })
    }

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: messages as any,
      max_tokens: 300,
      temperature: 0.3,
      top_p: 1,
      presence_penalty: 0,
      frequency_penalty: 0.2,
    })

    const text = completion.choices?.[0]?.message?.content?.trim() || '…'

    // Store assistant reply fragment
    try {
      const gist = (text.split(/\n|(?<=\.)\s+/)[0] || '').slice(0, 200)
      await serviceSupabase.from('memory_fragments').insert({
        avatar_id: avatar.id,
        fragment_text: text,
        conversation_context: {
          source: 'chat',
          type: 'assistant',
          conversation_id: conversationId,
          visitor_id: visitorId,
          gist,
          tags: ['reply']
        }
      })
    } catch (e) {
      console.warn('[reply] failed to insert assistant fragment:', e)
    }

    // Background: inject facts from user's message and extract memory fragments
    ;(async () => {
      try {
        if (avatar?.id) {
          // Inject facts from user message
          await injectFactsFromMessage({
            avatarId: avatar.id,
            text: prompt
          });

          // Also do traditional memory extraction
          const extracted = await MemoryExtractionService.extractMemoryFragments(prompt, 'demo', { source: 'chat', type: 'user' })
          const limited = extracted.slice(0, 3)
          if (limited.length > 0) {
            // Generate embeddings and insert via service role
            for (const frag of limited) {
              const emb = await MemoryStorageService.generateEmbedding(frag.fragmentText)
              await serviceSupabase.from('memory_fragments').insert({
                user_id: 'demo',
                avatar_id: avatar.id,
                fragment_text: frag.fragmentText,
                embedding: emb,
                conversation_context: { 
                  source: 'extraction', 
                  type: 'candidate', 
                  from: 'reply', 
                  original_prompt: prompt,
                  conversation_id: conversationId,
                  visitor_id: visitorId
                }
              })
            }
          }
        }
      } catch (e) {
        console.warn('[reply] background extraction failed', e)
      }
    })()

    const isDev = process.env.NODE_ENV !== 'production'
    const includeDebug = (debug || urlDebug) && isDev
    const debugPayload = includeDebug && debugInfo
      ? {
          ...debugInfo,
          promptPreview: (enhancedPrompt || '').slice(0, 400),
          historyCount: conversationHistory.length
        }
      : includeDebug 
        ? {
            promptPreview: (enhancedPrompt || '').slice(0, 400),
            historyCount: conversationHistory.length
          }
        : undefined
    const response = NextResponse.json({ text, debug: debugPayload })
    if (setVisitorCookie) {
      response.headers.set('Set-Cookie', setVisitorCookie)
    }
    return response
  } catch (err: any) {
    console.error('[reply] error:', err)
    return NextResponse.json({ error: err?.message || 'Reply failed' }, { status: 500 })
  }
}