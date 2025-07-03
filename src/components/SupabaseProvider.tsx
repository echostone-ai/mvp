'use client'

import { ReactNode, useState } from 'react'
import {
  createBrowserSupabaseClient
} from '@supabase/auth-helpers-nextjs'
import {
  SessionContextProvider
} from '@supabase/auth-helpers-react'

export default function SupabaseProvider({ children }: { children: ReactNode }) {
  // create supabase client in browser, using cookie for auth
  const [supabase] = useState(() => createBrowserSupabaseClient())

  return (
    <SessionContextProvider supabaseClient={supabase}>
      {children}
    </SessionContextProvider>
  )
}
