// src/lib/data/index.ts
// Small DAL with hot / warm reads + memory search (stubs you can flesh out)

import { sbAdmin } from './client'

export type OptimizedProfile = {
  id: string
  name: string
  core_personality: string
  quick_facts: string
  conversation_style: string
  current_context: string
  cached_at: string
}

export async function getOptimizedProfile(id: string) {
  const { data, error } = await sbAdmin
    .from('optimized_profiles')
    .select('*')
    .eq('id', id)
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data as OptimizedProfile | null
}

export async function upsertOptimizedProfile(row: OptimizedProfile) {
  const { error } = await sbAdmin.from('optimized_profiles').upsert(row, { onConflict: 'id' })
  if (error) throw error
}

export async function getFullProfile(id: string) {
  const { data, error } = await sbAdmin
    .from('full_profiles')
    .select('*')
    .eq('id', id)
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data as { id: string; data: any; updated_at: string } | null
}

export async function getActiveAvatarConfig(userId: string) {
  const { data, error } = await sbAdmin
    .from('avatar_configs')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

// NOTE: Replace this with a Postgres function using pgvector for speed.
export async function searchMemory(userId: string, avatarId: string | null, queryEmbedding: number[], limit = 6) {
  // Example call to an RPC you'll add in the migration (below)
  const { data, error } = await sbAdmin.rpc('search_memory_fragments', {
    in_user_id: userId,
    in_avatar_id: avatarId,
    in_query_embedding: queryEmbedding,
    in_limit: limit
  })
  if (error) throw error
  return data as Array<{ id: string; fragment_text: string; created_at: string }>
}
