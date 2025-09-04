import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const service = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const userId = url.searchParams.get('userId') || undefined
    const avatarId = url.searchParams.get('avatarId') || undefined
    const pageParam = parseInt(url.searchParams.get('page') || '1', 10)
    const pageSizeParam = parseInt(url.searchParams.get('pageSize') || '20', 10)
    const type = url.searchParams.get('type') || undefined // 'fact' | 'fragment'
    const keyword = url.searchParams.get('q') || undefined
    const startDate = url.searchParams.get('start') || undefined
    const endDate = url.searchParams.get('end') || undefined

    const page = Math.max(1, pageParam)
    const pageSize = Math.min(100, Math.max(1, pageSizeParam))
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    // Facts (quick_facts)
    let factsQuery = service
      .from('quick_facts')
      .select('id, key, value, confidence, priority, source, source_reference, created_at, updated_at, avatar_id')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })

    if (avatarId) factsQuery = factsQuery.eq('avatar_id', avatarId)
    if (keyword) factsQuery = factsQuery.or(`key.ilike.%${keyword}%,value.ilike.%${keyword}%`)
    if (startDate) factsQuery = factsQuery.gte('created_at', startDate)
    if (endDate) factsQuery = factsQuery.lte('created_at', endDate)

    // Fragments (memory_fragments)
    let fragsQuery = service
      .from('memory_fragments')
      .select('id, fragment_text, conversation_context, created_at, updated_at, avatar_id, user_id')
      .order('created_at', { ascending: false })

    if (avatarId) fragsQuery = fragsQuery.eq('avatar_id', avatarId)
    if (userId) fragsQuery = fragsQuery.eq('user_id', userId)
    if (keyword) fragsQuery = fragsQuery.or(`fragment_text.ilike.%${keyword}%,conversation_context->>gist.ilike.%${keyword}%`)
    if (startDate) fragsQuery = fragsQuery.gte('created_at', startDate)
    if (endDate) fragsQuery = fragsQuery.lte('created_at', endDate)
    fragsQuery = fragsQuery.range(from, to)

    // If filtering by type, skip the other query to save time
    let facts: any[] = []
    let fragments: any[] = []
    if (type === 'fact') {
      const { data: factsData, error } = await factsQuery.range(from, to)
      if (error) throw error
      facts = factsData || []
    } else if (type === 'fragment') {
      const { data: fragsData, error } = await fragsQuery
      if (error) throw error
      fragments = fragsData || []
    } else {
      const [factsRes, fragsRes] = await Promise.all([
        factsQuery.range(from, to),
        fragsQuery
      ])
      if (factsRes.error) throw factsRes.error
      if (fragsRes.error) throw fragsRes.error
      facts = factsRes.data || []
      fragments = fragsRes.data || []
    }

    return NextResponse.json({ success: true, page, pageSize, facts, fragments })
  } catch (e: any) {
    console.error('[api/memories/list] error', e)
    return NextResponse.json({ error: e?.message || 'Failed to list memories' }, { status: 500 })
  }
}


