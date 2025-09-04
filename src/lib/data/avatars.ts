// src/lib/data/avatars.ts
import { sbAdmin, hasSupabaseAdmin } from './supabaseAdmin'

type AvatarRow = {
  id: string
  name: string | null
  voice_id: string | null
  profile_data: any | null
  user_id: string | null
}

export type ResolvedAvatar = {
  id: string
  name: string
  voiceId: string | null
}

const CACHE_TTL_MS = 60_000
const cache = new Map<string, { value: ResolvedAvatar | null; exp: number }>()

function keyOf(input: { avatarId?: string; avatarSlug?: string }) {
  return input.avatarId ? `id:${input.avatarId}` : `slug:${input.avatarSlug}`
}

export async function resolveAvatar(input: { avatarId?: string; avatarSlug?: string }): Promise<ResolvedAvatar | null> {
  const k = keyOf(input)
  const now = Date.now()
  const hit = cache.get(k)
  if (hit && hit.exp > now) return hit.value

  if (!hasSupabaseAdmin || !sbAdmin) {
    cache.set(k, { value: null, exp: now + CACHE_TTL_MS })
    return null
  }

  try {
    let row: AvatarRow | null = null
    if (input.avatarId) {
      const { data, error } = await sbAdmin
        .from('avatar_profiles')
        .select('id,name,voice_id,profile_data,user_id')
        .eq('id', input.avatarId)
        .maybeSingle()
      if (error) throw error
      row = data as AvatarRow | null
    } else if (input.avatarSlug) {
      // TODO: change 'name' to 'slug' if you have a dedicated slug column
      const { data, error } = await sbAdmin
        .from('avatar_profiles')
        .select('id,name,voice_id,profile_data,user_id')
        .eq('name', input.avatarSlug)
        .maybeSingle()
      if (error) throw error
      row = data as AvatarRow | null
    }

    if (!row) {
      cache.set(k, { value: null, exp: now + CACHE_TTL_MS })
      return null
    }

    const voiceId =
      row.voice_id ||
      (row.profile_data && (row.profile_data.voice_id as string | undefined)) ||
      null

    const value: ResolvedAvatar = { id: row.id, name: row.name ?? 'Unknown Avatar', voiceId }
    cache.set(k, { value, exp: now + CACHE_TTL_MS })
    return value
  } catch (e: any) {
    console.warn('[resolveAvatar] failed:', e?.message || e)
    cache.set(k, { value: null, exp: now + CACHE_TTL_MS })
    return null
  }
}
