'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/components/supabaseClient'
import ChatInterface from '@/components/ChatInterface'
import PageShell from '@/components/PageShell'

interface AvatarChatPageProps {
  params: {
    avatarId: string;
  };
}

export default function AvatarChatPage({ params }: AvatarChatPageProps) {
  const [user, setUser] = useState<any>(null)
  const [avatarProfile, setAvatarProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadData() {
      // Load current user
      const { data: session } = await supabase.auth.getSession()
      const currentUser = session.session?.user ?? null
      setUser(currentUser)

      // Load avatar profile
      try {
        const { data, error } = await supabase
          .from('avatar_profiles')
          .select('*')
          .eq('id', params.avatarId)
          .single()

        if (error) throw error
        setAvatarProfile(data)
      } catch (err: any) {
        setError(`Failed to load avatar: ${err.message}`)
      }

      setLoading(false)
    }

    loadData()
  }, [params.avatarId])

  if (loading) return <div>Loading avatar...</div>
  if (error) return <div>Error: {error}</div>
  if (!avatarProfile) return <div>Avatar not found</div>

  return (
    <PageShell>
      <main>
        <h1>{avatarProfile.name}</h1>
        <p>{avatarProfile.description}</p>
        <ChatInterface 
          profileData={avatarProfile.profile_data}
          voiceId={avatarProfile.voice_id}
          userId={user?.id} // Current user's ID for memory operations
          avatarId={params.avatarId} // Avatar ID to identify which avatar they're talking to
        />
      </main>
    </PageShell>
  )
}