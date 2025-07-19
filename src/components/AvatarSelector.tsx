'use client'

import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Link from 'next/link'

interface Avatar {
  id: string
  name: string
  description: string
  voice_id: string | null
  profile_data: any
  created_at: string
  photo_url?: string // Added photo_url to the interface
}

interface AvatarSelectorProps {
  onAvatarSelect: (avatar: Avatar) => void
  title?: string
  subtitle?: string
  showCreateOption?: boolean
  className?: string
}

export default function AvatarSelector({
  onAvatarSelect,
  title = "Select an Avatar",
  subtitle = "Choose which avatar you'd like to work with",
  showCreateOption = true,
  className = ""
}: AvatarSelectorProps) {
  const [user, setUser] = useState<any>(null)
  const [avatars, setAvatars] = useState<Avatar[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null) // Added state for selected avatar

  useEffect(() => {
    async function loadData() {
      const { data: session } = await supabase.auth.getSession()
      const currentUser = session.session?.user ?? null
      setUser(currentUser)
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

  if (loading) {
    return (
      <div className={`avatar-selector-container ${className}`}>
        <div className="avatar-loading-spinner"></div>
        <p className="avatar-loading-text">Loading avatars...</p>
      </div>
    )
  }

  if (!user) {
    return (
      <div className={`avatar-selector-container ${className}`}>
        <div className="avatar-error-card">
          <h2 className="avatar-error-title">Authentication Required</h2>
          <p className="avatar-error-message">Please sign in to access avatars.</p>
          <Link href="/login" className="avatar-signin-btn">
            Sign In
          </Link>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`avatar-selector-container ${className}`}>
        <div className="avatar-error-card">
          <h2 className="avatar-error-title">Error Loading Avatars</h2>
          <p className="avatar-error-message">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="avatar-retry-btn"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  const onSelectAvatar = (avatarId: string) => {
    const selectedAvatar = avatars.find(avatar => avatar.id === avatarId);
    if (selectedAvatar) {
      setSelectedAvatarId(avatarId);
      onAvatarSelect(selectedAvatar);
    }
  };

  return (
    <div className={`avatar-selector-container ${className}`}>
      <div className="avatar-selector-header">
        <h1 className="avatar-selector-title">{title}</h1>
        <p className="avatar-selector-subtitle">{subtitle}</p>
      </div>
      {avatars.length === 0 ? (
        <div className="avatar-empty-card">
          <div className="avatar-empty-icon">🎭</div>
          <h2 className="avatar-empty-title">No Avatars Found</h2>
          <p className="avatar-empty-message">
            You haven't created any avatars yet. Create your first avatar to get started.
          </p>
          <Link 
            href="/avatars" 
            className="avatar-create-btn"
          >
            Create Your First Avatar
          </Link>
        </div>
      ) : (
        <div className="avatar-selector-grid">
          {avatars.map((avatar) => (
            <div
              key={avatar.id}
              className={`avatar-selector-card ${selectedAvatarId === avatar.id ? 'avatar-selector-card-selected' : ''}`}
              onClick={() => onSelectAvatar(avatar.id)}
            >
              <div className="avatar-selector-photo">
                {avatar.photo_url ? (
                  <img 
                    src={avatar.photo_url} 
                    alt={avatar.name}
                    className="avatar-photo"
                    onError={(e) => {
                      // Fallback to icon if image fails to load
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                      target.nextElementSibling?.classList.remove('avatar-photo-fallback-hidden')
                    }}
                  />
                ) : null}
                <div className={`avatar-photo-fallback ${avatar.photo_url ? 'avatar-photo-fallback-hidden' : ''}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>
              <div className="avatar-selector-info">
                <h3 className="avatar-selector-name">{avatar.name}</h3>
                {avatar.description && (
                  <p className="avatar-selector-description">{avatar.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {showCreateOption && avatars.length > 0 && (
        <div className="avatar-create-section">
          <p className="avatar-create-message">Don't see the avatar you want?</p>
          <Link 
            href="/avatars" 
            className="avatar-create-btn-secondary"
          >
            Create New Avatar
          </Link>
        </div>
      )}
    </div>
  )
}
