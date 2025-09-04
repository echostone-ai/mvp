// src/lib/supabaseAdmin.ts
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Never log the key. Only expose errors/booleans if needed.
if (!url || !serviceKey) {
  throw new Error('supabaseAdmin: Missing envs (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)')
}

export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false },
})


