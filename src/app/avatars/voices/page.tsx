'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import PageShell from '@/components/PageShell'
import VoiceTraining from '@/components/VoiceTraining'
import VoiceImprovementTool from '@/components/VoiceImprovementTool'
import '@/styles/voice-training.css'
import '@/styles/voice-management.css'

interface Avatar {
  id: string
  name: string
  description: string
  voice_id: string | null
  profile_data: any
  created_at: string
}

function AvatarVoicesContent() {
  const [user, setUser] = useState<any>(null)
  const [avatars, setAvatars] = useState<Avatar[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)
  const [selectedAvatar, setSelectedAvatar] = useState<Avatar | null>(null)
  const [showTraining, setShowTraining] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    async function loadData() {
      // Load current user
      const { data: session } = await supabase.auth.getSession()
      const currentUser = session.session?.user ?? null
      setUser(currentUser)

      // Load avatars
      if (currentUser) {
        try {
          const { data, error } = await supabase
            .from('avatar_profiles')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false })

          if (error) throw error
          setAvatars(data || [])
          
          // Check if there's an avatarId in the URL params
          const avatarIdParam = searchParams.get('avatarId')
          if (avatarIdParam && data) {
            const avatar = data.find(a => a.id === avatarIdParam)
            if (avatar) {
              setSelectedAvatar(avatar)
              setShowTraining(true)
            }
          }
        } catch (err: any) {
          setError(`Failed to load avatars: ${err.message}`)
        }
      }

      setLoading(false)
    }

    loadData()
  }, [searchParams])

  const clearVoice = async (avatarId: string) => {
    if (!confirm('Are you sure you want to clear this avatar\'s voice? This action cannot be undone.')) {
      return
    }

    if (!user?.id) {
      setError('User not authenticated')
      return
    }

    setUpdating(avatarId)
    try {
      const { error } = await supabase
        .from('avatar_profiles')
        .update({ voice_id: null })
        .eq('id', avatarId)
        .eq('user_id', user.id)

      if (error) throw error

      // Update local state
      setAvatars(avatars.map(avatar => 
        avatar.id === avatarId ? { ...avatar, voice_id: null } : avatar
      ))
    } catch (err: any) {
      setError(`Failed to clear voice: ${err.message}`)
    } finally {
      setUpdating(null)
    }
  }

  if (loading) {
    return (
      <PageShell>
        <main className="voice-management-container">
          <div className="voice-management-header">
            <h1 className="voice-management-title">Loading Avatar Voices...</h1>
            <div className="loading-spinner"></div>
          </div>
        </main>
      </PageShell>
    )
  }

  if (!user) {
    return (
      <PageShell>
        <main className="voice-management-container">
          <div className="voice-auth-required">
            <div className="voice-auth-icon">🔐</div>
            <h1 className="voice-auth-title">Authentication Required</h1>
            <p className="voice-auth-message">Please sign in to manage avatar voices and train new voice models.</p>
            <Link href="/login" className="voice-auth-button">
              Sign In to Continue
            </Link>
          </div>
        </main>
      </PageShell>
    )
  }

  const handleTrainVoice = (avatar: Avatar) => {
    setSelectedAvatar(avatar)
    setShowTraining(true)
  }
  
  const handleVoiceUploaded = async (voiceId: string) => {
    if (!selectedAvatar) return
    
    try {
      // Update local state
      setAvatars(avatars.map(avatar => 
        avatar.id === selectedAvatar.id ? { ...avatar, voice_id: voiceId, hasVoice: true } : avatar
      ))
      
      // Force refresh avatars from server to clear cache
      setTimeout(async () => {
        try {
          const response = await fetch('/api/avatars', {
            method: 'GET',
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          })
          if (response.ok) {
            const data = await response.json()
            if (data.success && data.avatars) {
              setAvatars(data.avatars)
            }
          }
        } catch (refreshError) {
          console.warn('Failed to refresh avatars:', refreshError)
        }
        
        setShowTraining(false)
        setSelectedAvatar(null)
      }, 2000)
    } catch (err: any) {
      setError(`Failed to update avatar: ${err.message}`)
    }
  }

  return (
    <PageShell>
      <main className="voice-management-container">
        {showTraining && selectedAvatar ? (
          <div className="voice-training-wrapper">
            <div className="voice-training-header-nav">
              <button 
                onClick={() => setShowTraining(false)}
                className="voice-back-button"
              >
                ← Back to Voice Management
              </button>
            </div>
            <VoiceTraining 
              avatarName={selectedAvatar.name}
              avatarId={selectedAvatar.id}
              onVoiceUploaded={handleVoiceUploaded}
            />
          </div>
        ) : (
          <>
            <div className="voice-management-header">
              <h1 className="voice-management-title">Manage Avatar Voices</h1>
              <p className="voice-management-subtitle">
                Each avatar can have its own unique voice. Train a new voice or clear an existing one.
              </p>
            </div>

            {error && (
              <div className="voice-management-error">
                {error}
              </div>
            )}

            <div className="voice-management-actions">
              <Link 
                href="/profile" 
                className="voice-back-link"
              >
                ← Back to Profile
              </Link>
            </div>

            {avatars.length === 0 ? (
              <div className="voice-empty-state">
                <p className="voice-empty-message">No avatars found. Create an avatar first.</p>
                <Link 
                  href="/profile" 
                  className="voice-create-button"
                >
                  Create Avatar
                </Link>
              </div>
            ) : (
              <div className="voice-management-table-container">
                <table className="voice-management-table">
                  <thead>
                    <tr>
                      <th>Avatar</th>
                      <th>Voice Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {avatars.map((avatar) => (
                      <tr key={avatar.id}>
                        <td className="avatar-info-cell">
                          <div className="avatar-info">
                            <div className="avatar-photo">
                              {avatar.photo_url ? (
                                <img 
                                  src={avatar.photo_url} 
                                  alt={avatar.name}
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement
                                    target.style.display = 'none'
                                    target.nextElementSibling?.classList.remove('hidden')
                                  }}
                                />
                              ) : (
                                <div className="avatar-photo-fallback">
                                  👤
                                </div>
                              )}
                            </div>
                            <div>
                              <div className="avatar-name">{avatar.name}</div>
                              {avatar.description && (
                                <div className="avatar-description">{avatar.description}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          {avatar.voice_id ? (
                            <span className="voice-status voice-ready">
                              Voice Ready
                            </span>
                          ) : (
                            <span className="voice-status voice-missing">
                              No Voice
                            </span>
                          )}
                        </td>
                        <td className="voice-actions-cell">
                          <div className="voice-actions">
                            <button
                              onClick={() => handleTrainVoice(avatar)}
                              className="voice-train-button"
                            >
                              {avatar.voice_id ? 'Retrain Voice' : 'Train Voice'}
                            </button>
                            <Link
                              href={`/profile/chat?avatarId=${avatar.id}`}
                              className="voice-chat-button"
                            >
                              Chat
                            </Link>
                            {avatar.voice_id && (
                              <button
                                onClick={() => clearVoice(avatar.id)}
                                disabled={updating === avatar.id}
                                className="voice-clear-button"
                              >
                                {updating === avatar.id ? 'Clearing...' : 'Clear Voice'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Voice Improvement Tools for avatars with existing voices */}
            {avatars.filter(avatar => avatar.voice_id).map((avatar) => (
              <VoiceImprovementTool
                key={`improvement-${avatar.id}`}
                avatarId={avatar.id}
                voiceId={avatar.voice_id!}
                avatarName={avatar.name}
              />
            ))}
            
            <div className="voice-help-section">
              <h2>How to Train an Avatar Voice</h2>
              <ol>
                <li>Click the "Train Voice" button next to your avatar</li>
                <li>Choose to record audio directly or upload audio files</li>
                <li>Follow the prompts to complete the voice training process</li>
                <li>Once trained, your avatar will use this voice when chatting</li>
              </ol>
            </div>
          </>
        )}
      </main>
    </PageShell>
  )
}

export default function AvatarVoicesPage() {
  return (
    <Suspense fallback={
      <PageShell>
        <main className="voice-management-container">
          <div className="voice-management-header">
            <h1 className="voice-management-title">Loading...</h1>
          </div>
        </main>
      </PageShell>
    }>
      <AvatarVoicesContent />
    </Suspense>
  )
}