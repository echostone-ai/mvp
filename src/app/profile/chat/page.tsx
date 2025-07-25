'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
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

  // Get avatarId from URL parameters
  const [avatarIdFromUrl, setAvatarIdFromUrl] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      setAvatarIdFromUrl(urlParams.get('avatarId'))
    }
  }, [])

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

      // If avatarId is provided in URL, load that specific avatar
      if (avatarIdFromUrl) {
        try {
          const { data: avatarData, error: avatarError } = await supabase
            .from('avatar_profiles')
            .select('*')
            .eq('id', avatarIdFromUrl)
            .eq('user_id', currentUser.id)
            .single()

          if (avatarError) {
            setError('Failed to load avatar: ' + avatarError.message)
          } else {
            console.log('Loaded avatar data:', avatarData)
            console.log('Avatar voice_id:', avatarData.voice_id)
            setSelectedAvatar(avatarData)
            setProfileData(avatarData.profile_data)
            setVoiceId(avatarData.voice_id)
          }
        } catch (err: any) {
          setError('Failed to load avatar: ' + err.message)
        }
      } else {
        // Load user profile data as fallback
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
      }

      setLoading(false)
      setError(null)
    } catch (err: any) {
      setError('Unexpected error: ' + (err.message || err))
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUserData()
  }, [avatarIdFromUrl]) // Reload when avatarId changes

  // Listen for voice training completion
  useEffect(() => {
    const handleVoiceUpdate = (e: CustomEvent) => {
      if (e.detail.avatarId === avatarIdFromUrl) {
        console.log('Voice training completed, refreshing avatar data...')
        loadUserData()
      }
    }

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === `avatar_voice_updated_${avatarIdFromUrl}`) {
        console.log('Voice training completed (storage), refreshing avatar data...')
        loadUserData()
      }
    }

    window.addEventListener('avatarVoiceUpdated', handleVoiceUpdate as EventListener)
    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('avatarVoiceUpdated', handleVoiceUpdate as EventListener)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [avatarIdFromUrl])

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
        <main className="chat-loading-main">
          <div className="chat-loading-spinner"></div>
          <p className="chat-loading-text">Loading...</p>
        </main>
      ) : !user ? (
        <main className="chat-auth-main">
          <img
            src="/echostone_logo.png"
            alt="EchoStone Logo"
            className="chat-auth-logo"
          />
          <div className="chat-auth-card">
            <h1 className="chat-auth-title">Chat with Your Avatar</h1>
            <p className="chat-auth-subtitle">
              Please sign up or log in to chat with your EchoStone.
            </p>
            <div className="chat-auth-actions">
              <a
                href="/login"
                className="chat-auth-btn primary"
              >
                Log In
              </a>
              <a
                href="/signup"
                className="chat-auth-btn secondary"
              >
                Sign Up
              </a>
            </div>
          </div>
        </main>
      ) : error ? (
        <main className="chat-error-main">
          <p className="chat-error-text">{error}</p>
        </main>
      ) : !profileData ? (
        <main className="chat-error-main">
          <p className="chat-error-text">No profile data found.</p>
        </main>
      ) : !selectedAvatar ? (
        <main className="chat-selector-main">
          <AvatarSelector
            onAvatarSelect={handleAvatarSelect}
            title="Select Avatar to Chat With"
            subtitle="Choose which avatar you'd like to have a conversation with"
            showCreateOption={true}
          />
        </main>
      ) : (
        <main className="chat-main">
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
            profileData={{
              name: selectedAvatar.name,
              personality: selectedAvatar.profile_data?.personality || `I am ${selectedAvatar.name}, a unique digital avatar with my own personality and voice.`,
              languageStyle: selectedAvatar.profile_data?.languageStyle || { description: 'Natural and conversational' },
              humorStyle: selectedAvatar.profile_data?.humorStyle || { description: 'Friendly with occasional wit' },
              catchphrases: selectedAvatar.profile_data?.catchphrases || [],
              ...selectedAvatar.profile_data
            }}
            voiceId={selectedAvatar.voice_id || voiceId}
            userId={user.id}
            avatarId={selectedAvatar.id}
          />
          {/* Debug info */}
          <div style={{ position: 'fixed', bottom: '10px', right: '10px', background: 'rgba(0,0,0,0.8)', color: 'white', padding: '10px', fontSize: '12px', borderRadius: '5px', maxWidth: '300px' }}>
            <div><strong>Avatar:</strong> {selectedAvatar.name}</div>
            <div><strong>Avatar Voice:</strong> {selectedAvatar.voice_id || 'null'}</div>
            <div><strong>Fallback Voice:</strong> {voiceId || 'null'}</div>
            <div><strong>Using:</strong> {selectedAvatar.voice_id || voiceId || 'null'}</div>
            <div style={{ marginTop: '5px', display: 'flex', gap: '5px' }}>
              <button
                onClick={async () => {
                  console.log('Refreshing avatar data...')
                  await loadUserData()
                }}
                style={{ padding: '2px 6px', fontSize: '10px', background: '#0066cc', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
              >
                Refresh
              </button>
              <button
                onClick={async () => {
                  const newVoiceId = prompt('Enter voice ID:')
                  if (newVoiceId && selectedAvatar) {
                    const response = await fetch('/api/update-avatar-voice', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ avatarId: selectedAvatar.id, voiceId: newVoiceId, userId: user.id })
                    })
                    const data = await response.json()
                    console.log('Update result:', data)
                    if (data.success) {
                      await loadUserData()
                    }
                    alert(JSON.stringify(data, null, 2))
                  }
                }}
                style={{ padding: '2px 6px', fontSize: '10px', background: '#cc6600', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
              >
                Set Voice
              </button>
              <button
                onClick={async () => {
                  const response = await fetch('/api/test-train-voice', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ test: 'data', avatarId: selectedAvatar?.id })
                  })
                  const data = await response.json()
                  console.log('Test result:', data)
                  alert(JSON.stringify(data, null, 2))
                }}
                style={{ padding: '2px 6px', fontSize: '10px', background: '#006600', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
              >
                Test API
              </button>
              <button
                onClick={async () => {
                  if (selectedAvatar) {
                    console.log('Selected avatar:', selectedAvatar)
                    console.log('User:', user)
                    console.log('Enhancing personality for:', { avatarId: selectedAvatar.id, userId: user?.id })
                    
                    // First, let's check if the avatar exists by querying it directly
                    try {
                      const { data: testAvatar, error: testError } = await supabase
                        .from('avatar_profiles')
                        .select('*')
                        .eq('id', selectedAvatar.id)
                        .eq('user_id', user.id)
                        .single()
                      
                      console.log('Direct avatar query result:', { testAvatar, testError })
                    } catch (testErr) {
                      console.log('Direct query error:', testErr)
                    }
                    
                    const response = await fetch('/api/enhance-avatar-personality', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ avatarId: selectedAvatar.id, userId: user?.id })
                    })
                    const data = await response.json()
                    console.log('Enhance result:', data)
                    if (data.success) {
                      await loadUserData()
                      alert('Personality enhanced! Try chatting again.')
                    } else {
                      alert(`Error: ${data.error}\nDetails: ${JSON.stringify(data, null, 2)}`)
                    }
                  } else {
                    alert('No avatar selected')
                  }
                }}
                style={{ padding: '2px 6px', fontSize: '10px', background: '#660066', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}
              >
                Enhance Personality
              </button>
            </div>
          </div>
        </main>
      )}
    </PageShell>
  )
}