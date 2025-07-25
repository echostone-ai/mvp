'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ChatInterface from '@/components/ChatInterface'
import PageShell from '@/components/PageShell'
import Link from 'next/link'
import dynamic from 'next/dynamic'

// Dynamically import VoiceTrainingDebug component
const VoiceTrainingDebug = dynamic(() => import('@/components/VoiceTrainingDebug'), {
  ssr: false,
  loading: () => <div className="text-center p-4">Loading debug tools...</div>
})

// Wrapper component to handle the dynamic import
function VoiceTrainingDebugWrapper({ avatarId }: { avatarId: string }) {
  return <VoiceTrainingDebug avatarId={avatarId} />
}

export default function AvatarChatPage() {
  const params = useParams() as { avatarId: string }
  const avatarId = params.avatarId
  
  const [user, setUser] = useState<any>(null)
  const [avatarProfile, setAvatarProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Function to refresh avatar data
  const refreshAvatarData = async (currentUser: any) => {
    if (!currentUser) return
    
    try {
      const { data, error } = await supabase
        .from('avatar_profiles')
        .select('*')
        .eq('id', avatarId)
        .eq('user_id', currentUser.id)
        .single()

      if (error) throw error
      setAvatarProfile(data)
    } catch (err: any) {
      setError(`Failed to load avatar: ${err.message}`)
    }
  }

  useEffect(() => {
    async function loadData() {
      // Load current user
      const { data: session } = await supabase.auth.getSession()
      const currentUser = session.session?.user ?? null
      setUser(currentUser)

      // Load avatar profile
      if (currentUser) {
        await refreshAvatarData(currentUser)
      } else {
        setError('User not authenticated')
      }

      setLoading(false)
    }

    loadData()
  }, [avatarId])
  
  // Listen for storage events to refresh data when voice is updated
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `avatar_voice_updated_${avatarId}`) {
        // Refresh avatar data when voice is updated
        if (user) {
          refreshAvatarData(user)
        }
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [avatarId, user])

  if (loading) {
    return (
      <PageShell>
        <main className="loading-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading avatar...</p>
        </main>
      </PageShell>
    )
  }
  
  if (error) {
    return (
      <PageShell>
        <main className="error-container">
          <div className="error-card">
            <svg xmlns="http://www.w3.org/2000/svg" className="error-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="error-title">Error Loading Avatar</h2>
            <p className="error-message">{error}</p>
            <Link href="/avatars" className="error-button">
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
        <main className="warning-container">
          <div className="warning-card">
            <svg xmlns="http://www.w3.org/2000/svg" className="warning-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="warning-title">Avatar Not Found</h2>
            <p className="warning-message">The avatar you're looking for doesn't exist or has been deleted.</p>
            <Link href="/avatars" className="error-button">
              Return to Avatars
            </Link>
          </div>
        </main>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <main className="avatar-detail-container">
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
        
        {/* Voice Training Section (if no voice is set) */}
        {!avatarProfile.voice_id && (
          <div className="max-w-5xl w-full mx-auto px-4 mb-8">
            <div className="bg-purple-900/40 border border-purple-500/30 rounded-lg p-6">
              <h2 className="text-xl font-bold mb-3 text-white">Train {avatarProfile.name}'s Voice</h2>
              <p className="text-gray-300 mb-4">
                This avatar doesn't have a voice yet. Record a voice sample to give it a unique voice.
              </p>
              
              <div className="flex flex-col items-center">
                <Link 
                  href={`/avatars/voices?avatarId=${avatarId}`}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 mb-4"
                >
                  Train Voice
                </Link>
                
                {/* Voice Training Debug Component */}
                <div className="w-full mt-6">
                  <details className="text-sm opacity-70">
                    <summary className="cursor-pointer hover:text-purple-300">Advanced Options</summary>
                    <div className="pt-4">
                      <div className="bg-gray-900/50 p-4 rounded-lg">
                        <h4 className="text-purple-300 mb-2 font-medium">Voice Training Troubleshooting</h4>
                        <p className="text-gray-400 mb-4 text-sm">
                          If you're having trouble training your avatar's voice, you can use the debug tools below to diagnose the issue.
                        </p>
                        <div className="mt-4">
                          {/* Import VoiceTrainingDebug component */}
                          {typeof window !== 'undefined' && (
                            <VoiceTrainingDebugWrapper avatarId={avatarId} />
                          )}
                        </div>
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            </div>
          </div>
        )}
        
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