// src/lib/data/supabaseAdmin.ts
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

export const hasSupabaseAdmin = Boolean(url && key)

export const sbAdmin: SupabaseClient | null = hasSupabaseAdmin
  ? createClient(url as string, key as string, { auth: { persistSession: false } })
  : null

if (!hasSupabaseAdmin) {
  console.warn('[supabaseAdmin] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — avatar lookup will be skipped')
}
