'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect } from 'react'
import { QUESTIONS } from '@/data/questions'
import { supabase } from '@/lib/supabase'
import VoiceRecorder from '@/components/VoiceRecorder'
import VoiceTraining from '@/components/VoiceTraining'
import AvatarIdentity from '@/components/AvatarIdentity'
import StoriesSection from '@/components/StoriesSection'
import MemoryManagement from '@/components/MemoryManagement'
import AccountMenu from '@/components/AccountMenu'
import PageShell from '@/components/PageShell'
import VoicePreview from '@/components/VoicePreview'
import VoicePreviewTesting from '@/components/VoicePreviewTesting'
import AvatarSelector from '@/components/AvatarSelector'

type Progress = { total: number; answered: number; isComplete: boolean }

interface Avatar {
  id: string
  name: string
  description: string
  voice_id: string | null
  photo_url?: string
  profile_data: any
  created_at: string
}

async function ensureProfileExists(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) {
    const { error: insertError } = await supabase
      .from('profiles')
      .insert([{ user_id: userId }])
    if (insertError) throw insertError
  }
}

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [loadingUser, setLoadingUser] = useState(true)
  const [selectedAvatar, setSelectedAvatar] = useState<Avatar | null>(null)
  const [activeTab, setActiveTab] = useState<'identity' | 'voice' | 'stories' | 'personality' | 'memories' | 'voicetuning'>('identity')
  const [progress, setProgress] = useState<Record<string, Progress>>({})
  const [voiceId, setVoiceId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [userName, setUserName] = useState('')
  // Add state for savedVoiceSettings
  const [savedVoiceSettings, setSavedVoiceSettings] = useState(null as any)

  useEffect(() => {
    let mounted = true
    async function load() {
      setError(null)
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
        if (sessionError) {
          setError("Failed to get session: " + sessionError.message)
          setLoadingUser(false)
          return
        }
        const me = sessionData.session?.user ?? null
        if (mounted) setUser(me)
        if (me) {
          try {
            await ensureProfileExists(me.id)
          } catch (e: any) {
            setError('Could not ensure profile exists: ' + e.message)
          }
          // Fetch profile including voice_settings
          const { data, error } = await supabase
            .from('profiles')
            .select('profile_data, voice_id, voice_settings')
            .eq('user_id', me.id)
            .maybeSingle()
          if (error) {
            setError("Failed to load profile: " + error.message)
            setLoadingUser(false)
            return
          }
          if (data?.voice_settings) {
            setSavedVoiceSettings(data.voice_settings)
          }
          if (data && mounted) {
            const prog: Record<string, Progress> = {}
            Object.entries(QUESTIONS || {}).forEach(([section, qs]) => {
              const answers = data.profile_data?.[section] || {}
              const cnt = qs.filter(q => answers[q.key]?.trim()).length
              prog[section] = { total: qs.length, answered: cnt, isComplete: cnt === qs.length && qs.length > 0 }
            })
            setProgress(prog)
            setVoiceId(data.voice_id)

            // Extract first name from profile data for voice naming
            const profileData = data.profile_data
            let firstName = ''
            if (profileData?.personal_snapshot?.full_legal_name) {
              firstName = profileData.personal_snapshot.full_legal_name.split(' ')[0]
            } else if (profileData?.full_legal_name) {
              firstName = profileData.full_legal_name.split(' ')[0]
            } else if (profileData?.name) {
              firstName = profileData.name.split(' ')[0]
            } else if (me?.user_metadata?.full_name) {
              firstName = me.user_metadata.full_name.split(' ')[0]
            } else if (me?.email) {
              // Fallback to email username
              firstName = me.email.split('@')[0]
            } else {
              firstName = 'User'
            }
            setUserName(firstName)
          }
        }
        setLoadingUser(false)
      } catch (e: any) {
        setError("Unexpected error: " + (e?.message || e))
        setLoadingUser(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const handleAvatarSelect = (avatar: Avatar) => {
    setSelectedAvatar(avatar)
  }

  // Show loading state
  if (loadingUser) {
    return (
      <PageShell>
        <main className="min-h-screen flex flex-col items-center justify-center text-white">
          <div className="loading-spinner"></div>
          <p className="mt-4 text-xl">Loading...</p>
        </main>
      </PageShell>
    )
  }

  // Show login prompt if not authenticated
  if (!user) {
    return (
      <PageShell>
        <main className="min-h-screen flex flex-col items-center justify-center text-white p-4 text-center">
          <a href="/" className="inline-block">
            <img
              src="/echostone_logo.png"
              alt="EchoStone Logo"
              className="logo-pulse w-36 mb-8 select-none cursor-pointer hover:scale-110 transition-transform duration-300"
            />
          </a>
          <div className="auth-required-card">
            <h1 className="auth-required-title">
              Authentication Required
            </h1>
            <p className="auth-required-subtitle">
              Please sign in to access your profile and build your digital voice.
            </p>
            <div className="auth-required-actions">
              <a
                href="/login"
                className="auth-btn primary"
              >
                Sign In
              </a>
              <a
                href="/login"
                className="auth-btn secondary"
              >
                Create Account
              </a>
            </div>
            <div className="auth-required-features">
              <h3>With your profile, you can:</h3>
              <ul>
                <li>🎤 Train your personal voice</li>
                <li>📝 Build your personality profile</li>
                <li>💬 Chat with your digital twin</li>
                <li>🔒 Keep your data secure and private</li>
              </ul>
            </div>
          </div>
        </main>
      </PageShell>
    )
  }

  // Show avatar selector if no avatar is selected
  if (!selectedAvatar) {
    return (
      <PageShell>
        <main className="min-h-screen text-white">
          <AvatarSelector
            onAvatarSelect={handleAvatarSelect}
            title="Select Avatar for Profile"
            subtitle="Choose which avatar you'd like to configure and train"
            showCreateOption={true}
          />
        </main>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <main className="profile-main">
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
              <h2 className="avatar-header-title">Working with: {selectedAvatar.name}</h2>
              <p className="avatar-header-desc">{selectedAvatar.description || "No description provided"}</p>
            </div>
          </div>
          <div className="avatar-header-status">
            <Link
              href={`/profile/chat?avatarId=${selectedAvatar.id}`}
              className="avatar-header-chat-btn"
            >
              💬 Chat with {selectedAvatar.name}
            </Link>
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

        <div className="profile-header">
          <a href="/" className="profile-logo-link">
            <Image
              className="profile-logo"
              src="/echostone_logo.png"
              width={160}
              height={160}
              alt="EchoStone Logo"
            />
          </a>
          <h1 className="profile-title">
            {selectedAvatar.name}'s Profile
          </h1>

          {/* Tab navigation */}
          <div className="profile-tabs-container">
            {[
              { id: 'identity', label: 'Identity', icon: '👤' },
              { id: 'voice', label: 'Voice Training', icon: '🎤' },
              { id: 'voicetuning', label: 'Voice Tuning', icon: '🎛️' },
              { id: 'personality', label: 'Personality', icon: '🧠' },
              { id: 'stories', label: 'Your Stories', icon: '📚' },
              { id: 'memories', label: 'Memories', icon: '💭' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`profile-tab ${activeTab === tab.id ? 'active' : ''}`}
              >
                <span className="tab-icon">{tab.icon}</span>
                <span className="tab-label">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="profile-content">
          {error && (
            <div className="profile-error">
              {error}
            </div>
          )}

          {activeTab === 'identity' && (
            <div className="profile-tab-panel">
              <AvatarIdentity
                avatar={selectedAvatar}
                onUpdate={(updatedAvatar) => {
                  setSelectedAvatar(updatedAvatar)
                }}
                userId={user?.id || ''}
              />
            </div>
          )}

          {activeTab === 'voice' && (
            <div className="profile-tab-panel">
              <VoiceTraining
                avatarName={selectedAvatar.name}
                avatarId={selectedAvatar.id}
                onVoiceUploaded={async (voiceId) => {
                  console.log('Voice uploaded with ID:', voiceId)
                  setVoiceId(voiceId)
                  // Update local state
                  setSelectedAvatar(prev => prev ? { ...prev, voice_id: voiceId } : null)
                  
                  // Refresh avatar data from database to ensure consistency
                  if (user?.id) {
                    try {
                      const { data: refreshedAvatar, error } = await supabase
                        .from('avatar_profiles')
                        .select('*')
                        .eq('id', selectedAvatar.id)
                        .eq('user_id', user.id)
                        .single()
                      
                      if (!error && refreshedAvatar) {
                        console.log('Refreshed avatar data:', refreshedAvatar)
                        setSelectedAvatar(refreshedAvatar)
                        setVoiceId(refreshedAvatar.voice_id)
                      }
                    } catch (err) {
                      console.error('Failed to refresh avatar data:', err)
                    }
                  }
                }}
              />
              {(voiceId || selectedAvatar.voice_id) && (
                <div className="voice-preview-section">
                  <h2 className="voice-preview-title">Test {selectedAvatar.name}'s Voice</h2>
                  <VoicePreview
                    voiceId={voiceId || selectedAvatar.voice_id || ''}
                    userName={selectedAvatar.name}
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === 'voicetuning' && (voiceId || selectedAvatar.voice_id) && (
            <div className="profile-tab-panel">
              <h2 className="voice-tuning-title">Voice Tuning</h2>
              <p className="voice-tuning-description">
                Fine-tune {selectedAvatar.name}'s digital voice with advanced controls, emotional previews, and parameter adjustments.
              </p>
              <VoicePreviewTesting
                voiceId={voiceId || selectedAvatar.voice_id || ''}
                userName={selectedAvatar.name}
                userId={user?.id}
                initialSettings={savedVoiceSettings}
              />
            </div>
          )}

          {activeTab === 'stories' && (
            <div className="profile-tab-panel">
              <StoriesSection userId={user?.id} />
            </div>
          )}

          {activeTab === 'personality' && (
            <div className="profile-tab-panel">
              <div className="personality-grid">
                {Object.entries(QUESTIONS || {}).map(([section, qs]) => {
                  const prog = progress[section] || { total: qs.length, answered: 0, isComplete: false }
                  return (
                    <Link
                      key={section}
                      href={`/profile/edit/${section}?avatarId=${selectedAvatar.id}`}
                      className="personality-card"
                    >
                      <div className="personality-card-header">
                        <h3 className="personality-card-title">{section.replace(/_/g, ' ')}</h3>
                        <div className="personality-card-progress">
                          <div className="progress-bar">
                            <div 
                              className="progress-fill" 
                              style={{ width: `${(prog.answered / prog.total) * 100}%` }}
                            ></div>
                          </div>
                          <span className="progress-text">{prog.answered}/{prog.total}</span>
                        </div>
                      </div>
                      <div className="personality-card-status">
                        {prog.isComplete ? (
                          <span className="status-complete">✓ Complete</span>
                        ) : (
                          <span className="status-incomplete">Continue</span>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {activeTab === 'memories' && (
            <div className="profile-tab-panel">
              <MemoryManagement userId={user?.id} />
            </div>
          )}
        </div>
      </main>
    </PageShell>
  )
}