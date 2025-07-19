'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/components/supabaseClient'
import ChatInterface from '@/components/ChatInterface'
import AccountMenu from '@/components/AccountMenu'
import PageShell from '@/components/PageShell'
import AvatarSelector from '@/components/AvatarSelector'

interface Avatar {
  id: string
  name: string
  description: string
  voice_id: string | null
  photo_url?: string
  profile_data: any
  created_at: string
}

const buttonStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '0.9em 2em',
  backgroundColor: 'var(--color-primary)',
  color: '#fff',
  borderRadius: 12,
  fontWeight: 700,
  textDecoration: 'none',
  cursor: 'pointer',
  boxShadow: '0 4px 20px #6a00ffaa',
  transition: 'background-color 0.3s ease',
  userSelect: 'none',
}

export default function ProfileChat() {
  const [user, setUser] = useState<any>(null)
  const [selectedAvatar, setSelectedAvatar] = useState<Avatar | null>(null)
  const [profileData, setProfileData] = useState<any>(null)
  const [voiceId, setVoiceId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadSignal, setReloadSignal] = useState<number>(Date.now())

  async function loadUserData() {
    try {
      setLoading(true)
      const { data: session } = await supabase.auth.getSession()
      const currentUser = session.session?.user ?? null
      if (!currentUser) {
        setUser(null)
        setLoading(false)
        return
      }
      setUser(currentUser)

      const { data, error } = await supabase
        .from('profiles')
        .select('profile_data, voice_id')
        .eq('user_id', currentUser.id)
        .single()

      if (error) {
        setError('Failed to load profile data: ' + error.message)
        setLoading(false)
        return
      }

      setProfileData(data.profile_data)
      setVoiceId(data.voice_id)
      setLoading(false)
      setError(null)
    } catch (err: any) {
      setError('Unexpected error: ' + (err.message || err))
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUserData()
  }, []) // Remove reloadSignal dependency - only load on mount and page refresh

  // Auto-refresh when component mounts or page is revisited
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadUserData()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  const handleAvatarSelect = (avatar: Avatar) => {
    setSelectedAvatar(avatar)
  }

  return (
    <PageShell>
      {loading ? (
        <main className="min-h-screen flex flex-col items-center justify-center text-white">
          <div className="loading-spinner"></div>
          <p className="text-center text-xl mt-4">Loading...</p>
        </main>
      ) : !user ? (
        <main className="min-h-screen flex flex-col items-center justify-center text-white p-4 text-center">
          <img
            src="/echostone_logo.png"
            alt="EchoStone Logo"
            className="logo-pulse w-36 mb-6 select-none"
          />
          <div className="auth-required-card">
            <h1 className="auth-required-title">Chat with Your Avatar</h1>
            <p className="auth-required-subtitle mb-6">
              Please sign up or log in to chat with your EchoStone.
            </p>
            <div className="flex justify-center gap-4">
              <a 
                href="/login" 
                className="auth-submit-btn inline-block px-8 py-4 text-white rounded-xl font-bold no-underline cursor-pointer shadow-lg transition-all"
              >
                Log In
              </a>
              <a 
                href="/signup" 
                className="auth-submit-btn inline-block px-8 py-4 text-white rounded-xl font-bold no-underline cursor-pointer shadow-lg transition-all"
              >
                Sign Up
              </a>
            </div>
          </div>
        </main>
      ) : error ? (
        <main className="min-h-screen flex flex-col items-center justify-center text-white">
          <p className="text-center text-xl text-red-400">{error}</p>
        </main>
      ) : !profileData ? (
        <main className="min-h-screen flex flex-col items-center justify-center text-white">
          <p className="text-center text-xl">No profile data found.</p>
        </main>
      ) : !selectedAvatar ? (
        <main className="min-h-screen text-white">
          <AvatarSelector
            onAvatarSelect={handleAvatarSelect}
            title="Select Avatar to Chat With"
            subtitle="Choose which avatar you'd like to have a conversation with"
            showCreateOption={true}
          />
        </main>
      ) : (
        <main className="min-h-screen text-white flex flex-col items-center p-0 max-w-full">
          {/* Avatar Header Banner */}
          <div className="avatar-header">
            <div className="avatar-header-info">
              <div className="avatar-header-photo">
                {selectedAvatar.photo_url ? (
                  <img 
                    src={selectedAvatar.photo_url} 
                    alt={selectedAvatar.name}
                    className="avatar-photo"
                    onError={(e) => {
                      // Fallback to icon if image fails to load
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                      target.nextElementSibling?.classList.remove('avatar-photo-fallback-hidden')
                    }}
                  />
                ) : null}
                <div className={`avatar-photo-fallback ${selectedAvatar.photo_url ? 'avatar-photo-fallback-hidden' : ''}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="avatar-header-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>
              <div>
                <h2 className="avatar-header-title">Chatting with: {selectedAvatar.name}</h2>
                <p className="avatar-header-desc">{selectedAvatar.description || "No description provided"}</p>
              </div>
            </div>
            <div className="avatar-header-status">
              <button
                onClick={() => setSelectedAvatar(null)}
                className="avatar-header-change-btn"
              >
                Change Avatar
              </button>
              <div className="avatar-header-active">
                <span className="avatar-header-active-dot"></span>
                <span>Active</span>
              </div>
            </div>
          </div>
          <ChatInterface 
            profileData={selectedAvatar.profile_data || profileData} 
            voiceId={selectedAvatar.voice_id || voiceId} 
            userId={user.id}
            avatarId={selectedAvatar.id}
          />
        </main>
      )}
    </PageShell>
  )
}