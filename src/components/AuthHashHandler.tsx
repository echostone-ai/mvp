'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'

/**
 * Handles Supabase magic-link hash tokens (/#access_token=...&refresh_token=...)
 * Sets the session, clears the URL hash, and optionally redirects.
 */
export default function AuthHashHandler() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (typeof window === 'undefined') return
    const hash = window.location.hash || ''
    if (!hash.includes('access_token=')) return

    const params = new URLSearchParams(hash.replace(/^#/, ''))
    const access_token = params.get('access_token') || ''
    const refresh_token = params.get('refresh_token') || ''

    if (!access_token || !refresh_token) return

    ;(async () => {
      try {
        await supabase.auth.setSession({ access_token, refresh_token })
      } catch (e) {
        // swallow errors; UI can still continue
      } finally {
        // Clear hash from URL
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search)
        // Redirect to app entry after login if on root or login
        if (pathname === '/' || pathname === '/login') {
          router.replace('/get-started')
        }
      }
    })()
  }, [router, pathname])

  return null
}


