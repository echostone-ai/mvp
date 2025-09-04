import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateClarifiers } from '@/lib/services/clarifier'

const service = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export const runtime = 'nodejs'

// GET /api/onboarding/clarifiers?avatar=:slug
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const slug = url.searchParams.get('avatar')
    if (!slug) return NextResponse.json({ error: 'avatar is required' }, { status: 400 })

    const { data: avatar, error: avatarErr } = await service
      .from('avatar_profiles')
      .select('id')
      .eq('name', slug)
      .single()
    if (avatarErr || !avatar) return NextResponse.json({ error: 'Avatar not found' }, { status: 404 })

    // Fetch top quick facts (P1/P2)
    const { data: facts, error: factsErr } = await service
      .from('quick_facts')
      .select('key, value, confidence, priority')
      .eq('avatar_id', avatar.id)
      .lte('priority', 3)
      .order('priority', { ascending: true })
      .limit(50)
    if (factsErr) throw factsErr

    const clarifiers = generateClarifiers({ facts: (facts || []).map(f => ({ key: f.key, value: f.value, confidence: f.confidence })) })
    return NextResponse.json({ success: true, clarifiers })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to generate clarifiers' }, { status: 500 })
  }
}


