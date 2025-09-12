import { NextRequest, NextResponse } from 'next/server'
import seedAvatarFromProfile from '@/lib/dev/seedAvatarFromProfile'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const slug = url.searchParams.get('avatar') || 'jonathan_braden'
  const debug = url.searchParams.get('debug') === 'true'

  try {
    const result = await seedAvatarFromProfile(slug)
    console.log('[dev/seed] result:', result)
    const payload: any = {
      ok: true,
      avatar: slug,
      upsertedCount: result.factsUpserted,
      previewKeys: result.factsKeys.slice(0, 10),
      result: debug ? {
        sourceUsed: result.sourceUsed,
        factsAttempted: result.factsAttempted,
        attemptedPreview: result.attemptedPreview
      } : undefined
    }
    return NextResponse.json(payload)
  } catch (e: any) {
    console.error('[dev/seed] failed:', e?.message || e)
    const message: string = e?.message || ''
    const details: string = e?.details || e?.hint || ''
    const code: string | undefined = e?.code
    let constraint = ''
    const find = (txt?: string) => {
      if (!txt) return
      const m = txt.match(/check constraint\s+"([^"]+)"/i)
      if (m && m[1]) constraint = m[1]
    }
    find(message)
    if (!constraint) find(details)
    const suggestedFix = constraint === 'quick_facts_source_check'
      ? "Set quick_facts.source to 'seed' (or another allowed value)."
      : undefined
    return NextResponse.json({ ok: false, error: constraint || code || 'seed_failed', detail: message || String(e), suggestedFix }, { status: 500 })
  }
}


