import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const service = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { kind, id, avatarId, userId, text, key, value, note, priority, archive, context } = body as {
      kind: 'fact' | 'fragment'
      id: string
      avatarId?: string
      userId?: string
      text?: string
      key?: string
      value?: string
      note?: string
      priority?: number
      archive?: boolean
      context?: { gist?: string; tags?: string[]; people?: string[] }
    }

    if (!kind || !id) {
      return NextResponse.json({ error: 'kind and id are required' }, { status: 400 })
    }

    if (kind === 'fragment') {
      // Load existing fragment
      const { data: existing, error: loadErr } = await service
        .from('memory_fragments')
        .select('id, fragment_text, avatar_id, user_id, created_at, conversation_context')
        .eq('id', id)
        .single()
      if (loadErr || !existing) {
        return NextResponse.json({ error: 'Fragment not found' }, { status: 404 })
      }

      if (archive) {
        // Archive to history and delete from active fragments
        await service.from('memory_archive').insert({
          fragment_id: existing.id,
          avatar_id: existing.avatar_id,
          user_id: existing.user_id,
          previous_text: existing.fragment_text,
          new_text: existing.fragment_text,
          original_created_at: existing.created_at,
          change_source: 'archive',
          notes: note || null
        })
        const { error: delErr } = await service
          .from('memory_fragments')
          .delete()
          .eq('id', id)
        if (delErr) throw delErr
        return NextResponse.json({ success: true, archived: true })
      }

      if (!text && !context) {
        return NextResponse.json({ error: 'Provide text or context to update' }, { status: 400 })
      }

      // Archive previous text if text is changing
      if (typeof text === 'string' && text !== existing.fragment_text) {
        await service.from('memory_archive').insert({
          fragment_id: existing.id,
          avatar_id: existing.avatar_id,
          user_id: existing.user_id,
          previous_text: existing.fragment_text,
          new_text: text,
          original_created_at: existing.created_at,
          change_source: 'manual',
          notes: note || null
        })
      }

      // Merge conversation_context updates
      const mergedContext = { ...(existing.conversation_context || {}) } as any
      if (context) {
        if (typeof context.gist === 'string') mergedContext.gist = context.gist
        if (Array.isArray(context.tags)) mergedContext.tags = context.tags
        if (Array.isArray(context.people)) mergedContext.people = context.people
      }

      const { error: upErr } = await service
        .from('memory_fragments')
        .update({ fragment_text: text ?? existing.fragment_text, conversation_context: mergedContext })
        .eq('id', id)
      if (upErr) throw upErr
      return NextResponse.json({ success: true })
    }

    // Fact update or archive
    if (!avatarId) return NextResponse.json({ error: 'avatarId required for fact updates' }, { status: 400 })

    if (archive) {
      const { error: expErr } = await service
        .from('quick_facts')
        .update({ expires_at: new Date().toISOString(), source: 'manual', source_reference: 'ui:archive' })
        .eq('id', id)
      if (expErr) throw expErr
      return NextResponse.json({ success: true, archived: true })
    }

    if (!key && !value && typeof priority !== 'number') {
      return NextResponse.json({ error: 'Provide key or value or priority to update' }, { status: 400 })
    }

    // New fact creation path
    if (id === 'new') {
      if (!key || !value) return NextResponse.json({ error: 'key and value required for new facts' }, { status: 400 })
      const rpcNew = await (service as any).rpc('upsert_quick_fact', {
        in_avatar_id: avatarId,
        in_key: key,
        in_value: value,
        in_confidence: 0.95,
        in_priority: typeof priority === 'number' ? Math.max(1, Math.min(priority, 10)) : 3,
        in_source: 'manual',
        in_source_reference: 'ui:promote'
      })
      if (rpcNew.error) throw rpcNew.error
      return NextResponse.json({ success: true, id: rpcNew.data })
    }

    // Load existing fact to log history (trigger also logs, but we mirror id)
    const { data: fact } = await service
      .from('quick_facts')
      .select('id, key, value')
      .eq('id', id)
      .single()
    if (!fact) return NextResponse.json({ error: 'Fact not found' }, { status: 404 })

    const rpc = await (service as any).rpc('upsert_quick_fact', {
      in_avatar_id: avatarId,
      in_key: key || fact.key,
      in_value: value || fact.value,
      in_confidence: 0.95,
      in_priority: typeof priority === 'number' ? Math.max(1, Math.min(priority, 10)) : 2,
      in_source: 'manual',
      in_source_reference: 'ui:update'
    })
    if (rpc.error) throw rpc.error
    return NextResponse.json({ success: true, id: rpc.data })
  } catch (e: any) {
    console.error('[api/memories/update] error', e)
    return NextResponse.json({ error: e?.message || 'Failed to update' }, { status: 500 })
  }
}


