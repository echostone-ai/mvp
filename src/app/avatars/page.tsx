'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import PageShell from '@/components/PageShell'

interface Avatar {
  id: string
  name: string
  description: string
  voice_id: string | null
  profile_data: any
  created_at: string
}

export default function AvatarsPage() {
  const [user, setUser] = useState<any>(null)
  const [avatars, setAvatars] = useState<Avatar[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newAvatar, setNewAvatar] = useState({
    name: '',
    description: '',
    photo_url: ''
  })
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

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
            .order('created_at', { ascending: false })

          if (error) throw error
          setAvatars(data || [])
        } catch (err: any) {
          setError(`Failed to load avatars: ${err.message}`)
        }
      }

      setLoading(false)
    }

    loadData()
  }, [])

  const handleCreateAvatar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAvatar.name.trim()) return

    setCreating(true)
    setError('')

    try {
      let photoUrl = ''
      
      // Upload photo if selected
      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
        const filePath = `avatar-photos/${fileName}`

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, photoFile)

        if (uploadError) {
          throw new Error(`Failed to upload photo: ${uploadError.message}`)
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath)

        photoUrl = urlData.publicUrl
      }

      const { data, error } = await supabase
        .from('avatar_profiles')
        .insert([
          {
            user_id: user.id,
            name: newAvatar.name.trim(),
            description: newAvatar.description.trim(),
            photo_url: photoUrl
          }
        ])
        .select()
        .single()

      if (error) throw error

      setAvatars([data, ...avatars])
      setNewAvatar({ name: '', description: '', photo_url: '' })
      setPhotoFile(null)
      setPhotoPreview(null)
    } catch (err: any) {
      setError(`Failed to create avatar: ${err.message}`)
    } finally {
      setCreating(false)
    }
  }

  // Handle photo file selection
  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setPhotoFile(file)
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        setPhotoPreview(ev.target?.result as string)
      }
      reader.readAsDataURL(file)
    } else {
      setPhotoPreview(null)
    }
  }

  if (loading) {
    return (
      <PageShell>
        <main className="min-h-screen flex flex-col items-center justify-center text-white">
          <div className="loading-spinner"></div>
          <p className="mt-4 text-xl">Loading...</p>
        </main>
      </PageShell>
    )
  }

  if (!user) {
    return (
      <PageShell>
        <main className="avatars-auth-main">
          <h1 className="avatars-auth-title">Authentication Required</h1>
          <p className="avatars-auth-subtitle">Please sign in to access avatars.</p>
          <Link href="/login" className="avatars-auth-btn">
            Sign In
          </Link>
        </main>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <main className="avatars-main">
        <div className="avatars-header">
          <h1 className="avatars-title">Your Avatars</h1>
          <div className="avatars-actions">
            <Link 
              href="/test-memory-isolation" 
              className="avatars-action-btn test-memory"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="avatars-action-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Test Memory
            </Link>
            <Link 
              href="/avatars/voices" 
              className="avatars-action-btn manage-voices"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="avatars-action-icon" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
              Manage Voices
            </Link>
          </div>
        </div>

        {error && (
          <div className="avatars-error">
            {error}
          </div>
        )}

        <div className="avatar-create-form">
          <h2 className="avatar-create-title">Create New Avatar</h2>
          <form onSubmit={handleCreateAvatar} className="avatar-create-fields">
            <div className="avatar-photo-upload-section">
              <label htmlFor="avatar-photo-upload" className="avatar-photo-label">
                <div className="avatar-photo-preview" style={{ backgroundImage: photoPreview ? `url(${photoPreview})` : newAvatar.photo_url ? `url(${newAvatar.photo_url})` : undefined }}>
                  {!photoPreview && !newAvatar.photo_url && (
                    <svg xmlns="http://www.w3.org/2000/svg" className="avatar-photo-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  )}
                  <span className="avatar-photo-upload-btn">{photoPreview || newAvatar.photo_url ? 'Change Photo' : 'Add Photo'}</span>
                </div>
                <input
                  id="avatar-photo-upload"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handlePhotoChange}
                />
              </label>
            </div>
            <div className="avatar-name-section">
              <label className="avatar-name-label">Name</label>
              <input
                type="text"
                value={newAvatar.name}
                onChange={(e) => setNewAvatar({ ...newAvatar, name: e.target.value })}
                className="avatar-name-input"
                placeholder="Enter avatar name"
                required
              />
            </div>
            <div className="avatar-description-section">
              <label className="avatar-description-label">Description</label>
              <textarea
                value={newAvatar.description}
                onChange={(e) => setNewAvatar({ ...newAvatar, description: e.target.value })}
                className="avatar-description-input"
                placeholder="Enter a brief description of this avatar"
                rows={3}
              />
            </div>
            <button
              type="submit"
              disabled={creating}
              className="avatar-create-submit-btn"
            >
              {creating ? 'Creating...' : 'Create Avatar'}
            </button>
          </form>
        </div>

        <h2 className="avatars-section-title">Your Avatars</h2>

        {avatars.length === 0 ? (
          <div className="avatars-empty">
            <p className="avatars-empty-text">No avatars created yet. Create your first avatar above.</p>
          </div>
        ) : (
          <div className="avatars-grid">
            {avatars.map((avatar) => (
              <div key={avatar.id} className="avatars-card-container">
                <Link
                  href={`/avatars/${avatar.id}`}
                  className="avatars-card"
                >
                  {/* Avatar Header with Gradient Accent */}
                  <div className="avatars-card-header"></div>
                  
                  {/* Avatar Icon and Name */}
                  <div className="avatars-card-body">
                    <div className="avatars-card-icon-section">
                      <div className="avatars-card-icon-bg">
                        <svg xmlns="http://www.w3.org/2000/svg" className="avatars-card-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="avatars-card-name">{avatar.name}</h3>
                        <div className="avatars-card-voice-status">
                          {avatar.voice_id ? (
                            <span className="avatars-card-voice-ready">
                              <span className="avatars-card-voice-dot avatars-card-voice-dot-ready"></span>
                              Voice Ready
                            </span>
                          ) : (
                            <span className="avatars-card-voice-missing">
                              <span className="avatars-card-voice-dot avatars-card-voice-dot-missing"></span>
                              No Voice
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Avatar Description */}
                  <div className="avatars-card-description">
                    {avatar.description ? (
                      <p>{avatar.description}</p>
                    ) : (
                      <p className="avatars-card-description-empty">No description provided</p>
                    )}
                  </div>
                  
                  {/* Avatar Footer */}
                  <div className="avatars-card-footer">
                    <div className="avatars-card-footer-content">
                      <span className="avatars-card-date">
                        Created: {new Date(avatar.created_at).toLocaleDateString()}
                      </span>
                      <span className="avatars-card-chat-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" className="avatars-card-chat-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        Chat Now
                      </span>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>
    </PageShell>
  )
}