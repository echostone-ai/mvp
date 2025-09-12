import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// EchoStone architecture: Use service role for server-side operations
const serviceSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

type SearchRow = { 
  id: string; 
  avatar_id: string; 
  fragment_text: string; 
  score: number; 
  conversation_context: any 
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, avatarSlug = 'jonathan_braden', maxMemories = 8 } = await req.json()

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })
    }

    // 1) Get avatar info
    const { data: avatar } = await serviceSupabase
      .from('avatars')
      .select('id, display_name')
      .eq('slug', avatarSlug)
      .single()

    if (!avatar) {
      return NextResponse.json({ error: 'Avatar not found' }, { status: 404 })
    }

    // 2) Get hot data: chat_contexts + quick_facts
    const { data: chatContext } = await serviceSupabase
      .from('chat_contexts')
      .select('context_text')
      .eq('avatar_id', avatar.id)
      .single()

    const { data: quickFacts } = await serviceSupabase
      .from('quick_facts')
      .select('key, value')
      .eq('avatar_id', avatar.id)

    // 3) Get warm data: personality_profiles
    const { data: personality } = await serviceSupabase
      .from('personality_profiles')
      .select('trait, detail')
      .eq('avatar_id', avatar.id)

    // 4) Run memory search
    const { data: memories, error: memErr } = await serviceSupabase
      .rpc('search_memories', { p_slug: avatarSlug, p_query: prompt, p_limit: maxMemories }) as unknown as
      { data: SearchRow[] | null, error: any }

    if (memErr) {
      console.error('[reply] memory search error:', memErr)
    }

    // 5) Assemble system prompt using EchoStone architecture
    const contextParts = []
    
    // Add chat context (spine) - hot data
    if (chatContext?.context_text) {
      contextParts.push(`Identity: ${chatContext.context_text}`)
    }

    // Add quick facts - hot data
    if (quickFacts?.length) {
      const facts = quickFacts.map(f => `${f.key}: ${f.value}`).join(', ')
      contextParts.push(`Quick Facts: ${facts}`)
    }

    // Add personality traits - warm data
    if (personality?.length) {
      const traits = personality.map(p => `${p.trait}: ${p.detail}`).join('; ')
      contextParts.push(`Personality: ${traits}`)
    }

    // Add relevant memories - warm/cold data
    if (memories?.length) {
      const memoryText = memories
        .slice(0, maxMemories)
        .map(m => `• ${m.fragment_text}`)
        .join('\n')
      contextParts.push(`Relevant Memories:\n${memoryText}`)
    }

    const systemPrompt = [
      `You are ${avatar.display_name}, responding as yourself in character.`,
      `Use the context below to inform your responses, but speak naturally.`,
      `Keep responses conversational (2-6 sentences) unless asked for more detail.`,
      `Never mention "memory fragments" or reveal the technical system.`,
      `Respond with authentic personality based on the provided context.`,
      '',
      contextParts.join('\n\n')
    ].join('\n')

    // Debug logging
    console.log(`[reply] Avatar: ${avatar.display_name}`)
    console.log(`[reply] Memories found: ${memories?.length || 0}`)
    console.log(`[reply] System prompt length: ${systemPrompt.length}`)
    console.log(`[reply] System prompt preview: ${systemPrompt.substring(0, 200)}...`)

    // 6) Call OpenAI
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.7,
      max_tokens: 300,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
    })

    const text = completion.choices?.[0]?.message?.content?.trim() || '…'

    return NextResponse.json({ text })
  } catch (err: any) {
    console.error('[reply] error:', err)
    return NextResponse.json({ error: err?.message || 'Reply failed' }, { status: 500 })
  }
}