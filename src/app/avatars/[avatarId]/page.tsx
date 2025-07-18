'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/components/supabaseClient'
import ChatInterface from '@/components/ChatInterface'
import PageShell from '@/components/PageShell'
import Link from 'next/link'

export default function AvatarChatPage() {
  const params = useParams() as { avatarId: string }
  const avatarId = params.avatarId
  
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
          .eq('id', avatarId)
          .single()

        if (error) throw error
        setAvatarProfile(data)
      } catch (err: any) {
        setError(`Failed to load avatar: ${err.message}`)
      }

      setLoading(false)
    }

    loadData()
  }, [avatarId])

  if (loading) {
    return (
      <PageShell>
        <main className="min-h-screen flex flex-col items-center justify-center text-white">
          <div className="loading-spinner"></div>
          <p className="mt-4 text-xl">Loading avatar...</p>
        </main>
      </PageShell>
    )
  }
  
  if (error) {
    return (
      <PageShell>
        <main className="min-h-screen flex flex-col items-center justify-center text-white p-6">
          <div className="bg-red-900/30 border border-red-500/50 rounded-xl p-8 max-w-lg w-full text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-red-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-2xl font-bold text-white mb-2">Error Loading Avatar</h2>
            <p className="text-red-200 mb-6">{error}</p>
            <Link href="/avatars" className="bg-purple-700 hover:bg-purple-600 text-white px-6 py-2 rounded-lg transition-colors">
              Return to Avatars
            </Link>
          </div>
        </main>
      </PageShell>
    )
  }
  
  if (!avatarProfile) {
    return (
      <PageShell>
        <main className="min-h-screen flex flex-col items-center justify-center text-white p-6">
          <div className="bg-yellow-900/30 border border-yellow-500/50 rounded-xl p-8 max-w-lg w-full text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-yellow-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="text-2xl font-bold text-white mb-2">Avatar Not Found</h2>
            <p className="text-yellow-200 mb-6">The avatar you're looking for doesn't exist or has been deleted.</p>
            <Link href="/avatars" className="bg-purple-700 hover:bg-purple-600 text-white px-6 py-2 rounded-lg transition-colors">
              Return to Avatars
            </Link>
          </div>
        </main>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <main className="min-h-screen text-white flex flex-col items-center p-0 max-w-full">
        {/* Avatar Header Banner */}
        <div className="w-full bg-gradient-to-r from-purple-900 to-indigo-900 py-6 px-8 mb-6 shadow-lg">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between">
            <div className="flex items-center mb-4 md:mb-0">
              <div className="bg-purple-700 rounded-full p-3 mr-4 shadow-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">{avatarProfile.name}</h1>
                <p className="text-purple-200">{avatarProfile.description || "No description provided"}</p>
              </div>
            </div>
            
            <div className="flex items-center">
              <Link href="/avatars" className="bg-purple-700 hover:bg-purple-600 text-white px-4 py-2 rounded-lg mr-3 transition-colors">
                Back to Avatars
              </Link>
              <div className="bg-indigo-800/70 text-white px-4 py-2 rounded-lg flex items-center">
                <span className="mr-2">Status:</span>
                <span className="inline-block w-3 h-3 bg-green-400 rounded-full mr-1"></span>
                <span>Active</span>
              </div>
            </div>
          </div>
        </div>
        
        {/* Avatar Training Notice */}
        <div className="max-w-5xl w-full mx-auto px-4 mb-8">
          <div className="bg-blue-900/30 border border-blue-500/30 rounded-lg p-4 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-blue-200 font-medium">
                You are currently chatting with and training <span className="font-bold text-white">{avatarProfile.name}</span>. 
                All memories created in this conversation will be specific to this avatar.
              </p>
            </div>
          </div>
        </div>
        
        <ChatInterface 
          profileData={avatarProfile.profile_data || {}}
          voiceId={avatarProfile.voice_id}
          userId={user?.id} // Current user's ID for memory operations
          avatarId={avatarId} // Avatar ID to identify which avatar they're talking to
        />
      </main>
    </PageShell>
  )
}