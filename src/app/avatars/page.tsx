'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AvatarsRedirect() {
  const router = useRouter()
  
  useEffect(() => {
    // Redirect to profile page
    router.replace('/profile')
  }, [router])

  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      color: 'white'
    }}>
      <p>Redirecting to Profile...</p>
    </div>
  )
}