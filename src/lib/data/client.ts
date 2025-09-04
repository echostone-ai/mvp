// src/lib/data/client.ts
// Server-only Supabase client (use in routes, server components, or server actions)
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL as string
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string

if (!supabaseUrl) throw new Error('Missing SUPABASE_URL')
if (!serviceKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY (server only)')

export const sbAdmin = createClient(supabaseUrl, serviceKey, {
  auth: { persistSession: false },
})
