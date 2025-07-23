'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import '@/styles/avatar-selector.css'

interface Avatar {
  id: string
  name: string
  description: string
  voice_id: string | null
  profile_data: any
  created_at: string
  photo_url?: string
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
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null)
  const [editingAvatar, setEditingAvatar] = useState<Avatar | null>(null)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    photo_url: ''
  })
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

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
            .eq('user_id', currentUser.id)
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

  const handleEditAvatar = (avatar: Avatar, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingAvatar(avatar)
    setEditForm({
      name: avatar.name,
      description: avatar.description || '',
      photo_url: avatar.photo_url || ''
    })
    setPhotoFile(null)
    setPhotoPreview(null)
    setEditModalOpen(true)
  }

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

  const handleSaveEdit = async () => {
    if (!editingAvatar || !editForm.name.trim()) return

    setSaving(true)
    try {
      let photoUrl = editingAvatar.photo_url || ''
      
      // Upload new photo if selected
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

      if (!user?.id) {
        throw new Error('User not authenticated')
      }

      const { data, error } = await supabase
        .from('avatar_profiles')
        .update({
          name: editForm.name.trim(),
          description: editForm.description.trim(),
          photo_url: photoUrl
        })
        .eq('id', editingAvatar.id)
        .eq('user_id', user.id)
        .select()
        .single()

      if (error) throw error

      // Update local state
      setAvatars(avatars.map(avatar => 
        avatar.id === editingAvatar.id ? { ...avatar, ...data } : avatar
      ))

      setEditModalOpen(false)
      setEditingAvatar(null)
      setEditForm({ name: '', description: '', photo_url: '' })
      setPhotoFile(null)
      setPhotoPreview(null)
    } catch (err: any) {
      setError(`Failed to update avatar: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAvatar = async () => {
    if (!editingAvatar) return

    if (!confirm(`Are you sure you want to delete "${editingAvatar.name}"? This action cannot be undone.`)) {
      return
    }

    if (!user?.id) {
      setError('User not authenticated')
      return
    }

    setSaving(true)
    try {
      const { error } = await supabase
        .from('avatar_profiles')
        .delete()
        .eq('id', editingAvatar.id)
        .eq('user_id', user.id)

      if (error) throw error

      // Update local state
      setAvatars(avatars.filter(avatar => avatar.id !== editingAvatar.id))
      setEditModalOpen(false)
      setEditingAvatar(null)
      setEditForm({ name: '', description: '', photo_url: '' })
      setPhotoFile(null)
      setPhotoPreview(null)
    } catch (err: any) {
      setError(`Failed to delete avatar: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className={`avatar-selector-container ${className}`}>
        <div className="avatar-selector-loading">
          <div className="avatar-selector-loading-spinner"></div>
          <p className="avatar-selector-loading-text">Loading avatars...</p>
        </div>
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
    <>
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
              className="avatar-empty-create-btn"
            >
              Create Your First Avatar
            </Link>
          </div>
        ) : (
          <div className="avatar-selector-grid">
            {avatars.map((avatar) => (
              <div
                key={avatar.id}
                className={`avatar-selector-card ${selectedAvatarId === avatar.id ? 'selected' : ''}`}
                onClick={() => onSelectAvatar(avatar.id)}
              >
                <div className="avatar-card-header">
                  <div className="avatar-card-photo">
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
                      <div className="avatar-card-photo-fallback">
                        👤
                      </div>
                    )}
                  </div>
                  <div className="avatar-card-info">
                    <h3 className="avatar-card-name">{avatar.name}</h3>
                    {avatar.description && (
                      <p className="avatar-card-description">{avatar.description}</p>
                    )}
                    <div className="avatar-card-voice-status">
                      <div className={`avatar-card-voice-dot ${avatar.voice_id ? 'ready' : 'missing'}`}></div>
                      <span className={avatar.voice_id ? 'avatar-card-voice-ready' : 'avatar-card-voice-missing'}>
                        {avatar.voice_id ? 'Voice Ready' : 'No Voice'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="avatar-card-actions">
                  <button className="avatar-card-select-btn">
                    Select Avatar
                  </button>
                  <button
                    className="avatar-card-edit-btn"
                    onClick={(e) => handleEditAvatar(avatar, e)}
                    title="Edit Avatar"
                  >
                    ✏️
                  </button>
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

      {/* Edit Avatar Modal */}
      {editModalOpen && editingAvatar && (
        <div className="avatar-edit-modal-overlay" onClick={() => setEditModalOpen(false)}>
          <div className="avatar-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="avatar-edit-modal-header">
              <h2 className="avatar-edit-modal-title">Edit Avatar</h2>
              <button 
                className="avatar-edit-modal-close"
                onClick={() => setEditModalOpen(false)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="avatar-edit-modal-content">
              <div className="avatar-edit-photo-section">
                <label htmlFor="avatar-edit-photo-upload" className="avatar-edit-photo-label">
                  <div className="avatar-edit-photo-preview" style={{ 
                    backgroundImage: photoPreview ? `url(${photoPreview})` : editForm.photo_url ? `url(${editForm.photo_url})` : undefined 
                  }}>
                    {!photoPreview && !editForm.photo_url && (
                      <svg xmlns="http://www.w3.org/2000/svg" className="avatar-edit-photo-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    )}
                    <span className="avatar-edit-photo-upload-btn">
                      {photoPreview || editForm.photo_url ? 'Change Photo' : 'Add Photo'}
                    </span>
                  </div>
                  <input
                    id="avatar-edit-photo-upload"
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handlePhotoChange}
                  />
                </label>
              </div>

              <div className="avatar-edit-form">
                <div className="avatar-edit-field">
                  <label className="avatar-edit-label">Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="avatar-edit-input"
                    placeholder="Enter avatar name"
                    required
                  />
                </div>

                <div className="avatar-edit-field">
                  <label className="avatar-edit-label">Description</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="avatar-edit-textarea"
                    placeholder="Enter a brief description of this avatar"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            <div className="avatar-edit-modal-actions">
              <button
                onClick={handleDeleteAvatar}
                disabled={saving}
                className="avatar-edit-delete-btn"
              >
                Delete Avatar
              </button>
              <div className="avatar-edit-action-buttons">
                <button
                  onClick={() => setEditModalOpen(false)}
                  disabled={saving}
                  className="avatar-edit-cancel-btn"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={saving || !editForm.name.trim()}
                  className="avatar-edit-save-btn"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
