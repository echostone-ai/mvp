// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

// Client for browser/public use
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
