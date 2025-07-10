'use client'
import { useEffect } from 'react'
import { supabase } from '@/components/supabaseClient'
import { useRouter } from 'next/navigation'

export default function Logout() {
  const router = useRouter()

  useEffect(() => {
    async function doLogout() {
      await supabase.auth.signOut()
      router.replace('/login')
    }
    doLogout()
  }, [router])

  return <p>Logging out...</p>
}