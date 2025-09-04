import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const service = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export const runtime = 'nodejs'

// POST /api/onboarding/ingest
// body: { userId: string, avatarSlug: string, story: string, debug?: boolean }
export async function POST(req: NextRequest) {
  const t0 = Date.now()
  try {
    const { userId, avatarSlug, story, debug } = await req.json()
    if (!userId || !avatarSlug || !story) {
      return NextResponse.json({ error: 'userId, avatarSlug, and story are required' }, { status: 400 })
    }

    // Resolve avatar id by slug/name
    const { data: avatar, error: avatarErr } = await service
      .from('avatar_profiles')
      .select('id, name')
      .eq('name', avatarSlug)
      .single()
    if (avatarErr || !avatar) {
      return NextResponse.json({ error: 'Avatar not found' }, { status: 404 })
    }

    // Insert as a single memory fragment
    const gist = (story.split(/\n|(?<=\.)\s+/)[0] || '').slice(0, 180)
    const { error: insErr } = await service.from('memory_fragments').insert({
      user_id: userId,
      avatar_id: avatar.id,
      fragment_text: story,
      conversation_context: { source: 'onboarding', type: 'story', gist, tags: ['onboarding','story'] }
    })
    if (insErr) throw insErr

    // Best-effort: seed a couple of P1/P2 quick facts from simple regexes for instant readback
    const quickFacts: Array<any> = []
    const push = (key: string, value?: string|null, priority = 2, confidence = 0.85, source='onboarding') => {
      if (value && String(value).trim()) quickFacts.push({ avatar_id: avatar.id, key, value: String(value).trim(), confidence, priority, source, source_reference: 'ui:ingest' })
    }
    // naive patterns
    const birthPlaceMatch = story.match(/born in ([^.\n,]+)/i)
    const birthDateMatch = story.match(/born on\s+([A-Za-z]+\s+\d{1,2},\s*\d{4}|\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})/i)
    if (birthPlaceMatch) push('birthplace', birthPlaceMatch[1], 1, 0.8)
    if (birthDateMatch) push('birth_date', birthDateMatch[1], 1, 0.8)
    const petNameMatch = story.match(/my (dog|cat|pet) (?:named|is) ([^,\.\n]+)/i)
    if (petNameMatch) {
      push('pet_type', petNameMatch[1], 3, 0.8)
      push('pet_name', petNameMatch[2], 2, 0.85)
    }
    const serviceMatch = story.match(/(served|service|unit|squadron|platoon|air force|army|navy|marines)/i)
    if (serviceMatch) push('service_context', serviceMatch[0], 3, 0.7)
    if (quickFacts.length > 0) {
      await service.from('quick_facts').insert(quickFacts)
    }

    const dt = Date.now() - t0
    const readbackFacts = quickFacts
      .filter(f => f.priority <= 2)
      .slice(0, 6)
      .map(({ key, value, confidence }: any) => ({ key, value, confidence }))

    const resp: any = {
      success: true,
      avatarId: avatar.id,
      seeded_facts_count: quickFacts.length,
      readback_facts: readbackFacts,
      seeding_time_ms: dt
    }
    if (debug || new URL(req.url).searchParams.get('debug') === 'true') {
      resp.top_keys = quickFacts.map((q: any) => q.key).slice(0, 8)
    }
    // SLA: return in <=1.5s
    return NextResponse.json(resp)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to ingest story' }, { status: 500 })
  }
}


