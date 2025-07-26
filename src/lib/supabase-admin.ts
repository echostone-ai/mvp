// src/lib/supabase-admin.ts
import { createClient } from '@supabase/supabase-js'

// Admin client for server-side API routes only
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)