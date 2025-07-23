'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import PageShell from '@/components/PageShell'
import VoiceTraining from '@/components/VoiceTraining'
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

export default function AvatarVoicesPage() {
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
        <main className="loading-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading...</p>
        </main>
      </PageShell>
    )
  }

  if (!user) {
    return (
      <PageShell>
        <main className="min-h-screen flex flex-col items-center justify-center text-white p-4 text-center">
          <h1 className="text-2xl mb-4">Authentication Required</h1>
          <p className="mb-6">Please sign in to manage avatar voices.</p>
          <Link href="/login" className="bg-purple-600 px-6 py-2 rounded-lg">
            Sign In
          </Link>
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
        avatar.id === selectedAvatar.id ? { ...avatar, voice_id: voiceId } : avatar
      ))
      
      // Reset training view after a delay
      setTimeout(() => {
        setShowTraining(false)
        setSelectedAvatar(null)
      }, 3000)
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
                href="/avatars" 
                className="voice-back-link"
              >
                ← Back to Avatars
              </Link>
            </div>

            {avatars.length === 0 ? (
              <div className="voice-empty-state">
                <p className="voice-empty-message">No avatars found. Create an avatar first.</p>
                <Link 
                  href="/avatars" 
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
                              href={`/avatars/${avatar.id}`}
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