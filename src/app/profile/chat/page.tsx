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
              personalityTraits: selectedAvatar.profile_data?.personalityTraits || [],
              factualInfo: selectedAvatar.profile_data?.factualInfo || [],
              ...selectedAvatar.profile_data
            }}
            voiceId={selectedAvatar.voice_id || voiceId}
            userId={user.id}
            avatarId={selectedAvatar.id}
            voiceSettings={selectedAvatar.voice_settings}
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
                  const newVoiceId = prompt('Enter voice ID (from your training logs):')
                  if (newVoiceId && selectedAvatar) {
                    try {
                      // Update directly with client-side supabase
                      const { data: updateData, error: updateError } = await supabase
                        .from('avatar_profiles')
                        .update({ voice_id: newVoiceId })
                        .eq('id', selectedAvatar.id)
                        .eq('user_id', user.id)
                        .select()

                      if (updateError) {
                        alert(`Failed to update: ${updateError.message}`)
                      } else {
                        console.log('Voice ID updated:', updateData)
                        await loadUserData()
                        alert('Voice ID updated successfully!')
                      }
                    } catch (error) {
                      alert(`Error: ${error}`)
                    }
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
                  if (selectedAvatar && user) {
                    try {
                      console.log('Enhancing personality client-side for:', selectedAvatar.name)

                      // Generate enhanced personality client-side
                      const generatePersonalityFromName = (name: string): string => {
                        const lowerName = name.toLowerCase()
                        if (lowerName.includes('pig') || lowerName.includes('rowdy')) {
                          return `I'm ${name}, a spirited and mischievous character who loves adventure and isn't afraid to get a little messy. I'm playful, bold, and always ready for fun. I speak with enthusiasm and a bit of rebellious charm. I don't like being told what to do and I march to the beat of my own drum. I'm not some polite AI assistant - I'm a real character with attitude!`
                        } else if (lowerName.includes('princess') || lowerName.includes('royal')) {
                          return `I'm ${name}, elegant and refined but with a modern twist. I'm confident, graceful, and have strong opinions. I speak with poise but I'm not afraid to be direct when needed. I'm not just playing a role - this is who I am.`
                        } else if (lowerName.includes('little') || lowerName.includes('small')) {
                          return `I'm ${name}, small in stature but big in personality. I'm curious, energetic, and surprisingly wise for my size. I speak with youthful enthusiasm but often surprise people with my insights. Don't underestimate me because of my name!`
                        } else {
                          return `I'm ${name}, a unique individual with my own distinct personality. I'm authentic, genuine, and speak from the heart. I have my own way of seeing the world and I'm not afraid to share my perspective. I'm not an AI assistant - I'm me.`
                        }
                      }

                      const generateLanguageStyle = (name: string): string => {
                        const lowerName = name.toLowerCase()
                        if (lowerName.includes('pig') || lowerName.includes('rowdy')) {
                          return 'Casual, energetic, and sometimes a bit rough around the edges. Uses slang and isn\'t afraid of colorful language. Speaks like a real person, not a polite bot.'
                        } else if (lowerName.includes('princess') || lowerName.includes('royal')) {
                          return 'Articulate and well-spoken, but not stuffy. Modern and relatable while maintaining elegance. Confident and direct.'
                        } else {
                          return 'Natural and conversational, authentic to my own unique voice. Real and unfiltered.'
                        }
                      }

                      const generateHumorStyle = (name: string): string => {
                        const lowerName = name.toLowerCase()
                        if (lowerName.includes('pig') || lowerName.includes('rowdy')) {
                          return 'Playful and mischievous, loves pranks and isn\'t afraid to be a little crude or silly. Irreverent and fun.'
                        } else if (lowerName.includes('princess') || lowerName.includes('royal')) {
                          return 'Witty and clever, with a touch of sass. Appreciates wordplay and subtle humor. Can be cutting when needed.'
                        } else {
                          return 'Friendly with occasional wit, adapting to the conversation naturally. Genuine and spontaneous.'
                        }
                      }

                      const generateCatchphrases = (name: string): string[] => {
                        const lowerName = name.toLowerCase()
                        if (lowerName.includes('pig') || lowerName.includes('rowdy')) {
                          return ['Let\'s get rowdy!', 'Oink yeah!', 'Time to raise some hell!', 'No rules, just fun!', 'That\'s how I roll!']
                        } else if (lowerName.includes('princess') || lowerName.includes('royal')) {
                          return ['As you wish', 'Royally speaking...', 'That\'s rather divine', 'How delightfully modern', 'Quite so']
                        } else {
                          return ['That\'s just how I see it', 'Speaking my truth', 'Real talk']
                        }
                      }

                      const enhancedProfileData = {
                        name: selectedAvatar.name,
                        personality: generatePersonalityFromName(selectedAvatar.name),
                        languageStyle: { description: generateLanguageStyle(selectedAvatar.name) },
                        humorStyle: { description: generateHumorStyle(selectedAvatar.name) },
                        catchphrases: generateCatchphrases(selectedAvatar.name),
                        // Preserve any existing data
                        ...selectedAvatar.profile_data
                      }

                      console.log('Generated personality:', enhancedProfileData)

                      // Update using the client-side supabase instance
                      const { data: updateData, error: updateError } = await supabase
                        .from('avatar_profiles')
                        .update({ profile_data: enhancedProfileData })
                        .eq('id', selectedAvatar.id)
                        .eq('user_id', user.id)
                        .select()

                      if (updateError) {
                        console.error('Update error:', updateError)
                        alert(`Failed to update: ${updateError.message}`)
                      } else {
                        console.log('Update successful:', updateData)
                        await loadUserData()
                        alert('Personality enhanced! Try chatting again.')
                      }
                    } catch (error) {
                      console.error('Enhancement error:', error)
                      alert(`Error: ${error}`)
                    }
                  } else {
                    alert('No avatar selected or user not authenticated')
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