'use client'

import React, { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

interface AvatarIdentityProps {
  avatar: {
    id: string
    name: string
    description: string
    photo_url?: string
    voice_id?: string | null
  }
  onUpdate: (updatedAvatar: any) => void
  userId: string
}

export default function AvatarIdentity({ avatar, onUpdate, userId }: AvatarIdentityProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    name: avatar.name,
    description: avatar.description || '',
    photo_url: avatar.photo_url || ''
  })
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5MB')
      return
    }

    setPhotoFile(file)
    setError(null)
    
    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setPhotoPreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleSave = async () => {
    if (!editForm.name.trim()) {
      setError('Avatar name is required')
      return
    }

    setSaving(true)
    setError(null)

    try {
      let photoUrl = editForm.photo_url

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

      // Update avatar in database
      const { data, error } = await supabase
        .from('avatar_profiles')
        .update({
          name: editForm.name.trim(),
          description: editForm.description.trim(),
          photo_url: photoUrl
        })
        .eq('id', avatar.id)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw error

      // Update local state
      onUpdate(data)
      setIsEditing(false)
      setPhotoFile(null)
      setPhotoPreview(null)
      
    } catch (err: any) {
      setError(err.message || 'Failed to update avatar')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setEditForm({
      name: avatar.name,
      description: avatar.description || '',
      photo_url: avatar.photo_url || ''
    })
    setPhotoFile(null)
    setPhotoPreview(null)
    setError(null)
    setIsEditing(false)
  }

  const removePhoto = async () => {
    if (!avatar.photo_url) return

    setSaving(true)
    try {
      // Update database to remove photo URL
      const { data, error } = await supabase
        .from('avatar_profiles')
        .update({ photo_url: null })
        .eq('id', avatar.id)
        .eq('user_id', userId)
        .select()
        .single()

      if (error) throw error

      // Update local state
      setEditForm({ ...editForm, photo_url: '' })
      onUpdate(data)
      
    } catch (err: any) {
      setError(err.message || 'Failed to remove photo')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="avatar-identity-container">
      <div className="avatar-identity-header">
        <h2 className="avatar-identity-title">Avatar Identity</h2>
        <p className="avatar-identity-subtitle">
          Manage your avatar's name, photo, and description. This is how your avatar will introduce itself.
        </p>
      </div>

      <div className="avatar-identity-card">
        {/* Avatar Photo Section */}
        <div className="avatar-photo-section">
          <div className="avatar-photo-container">
            <div className="avatar-photo-display">
              {photoPreview || avatar.photo_url ? (
                <img 
                  src={photoPreview || avatar.photo_url} 
                  alt={avatar.name}
                  className="avatar-photo-img"
                />
              ) : (
                <div className="avatar-photo-placeholder">
                  <span className="avatar-photo-icon">👤</span>
                </div>
              )}
            </div>
            
            {isEditing && (
              <div className="avatar-photo-controls">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="photo-control-btn upload"
                  disabled={saving}
                >
                  📷 {avatar.photo_url ? 'Change Photo' : 'Add Photo'}
                </button>
                
                {(avatar.photo_url || photoPreview) && (
                  <button
                    type="button"
                    onClick={removePhoto}
                    className="photo-control-btn remove"
                    disabled={saving}
                  >
                    🗑️ Remove
                  </button>
                )}
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  style={{ display: 'none' }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Avatar Info Section */}
        <div className="avatar-info-section">
          {!isEditing ? (
            <div className="avatar-info-display">
              <div className="avatar-name-display">
                <h3>{avatar.name}</h3>
                <div className="avatar-status">
                  <div className="status-indicator">
                    <div className={`status-dot ${avatar.voice_id ? 'active' : 'inactive'}`}></div>
                    <span className="status-text">
                      {avatar.voice_id ? 'Voice Trained' : 'No Voice'}
                    </span>
                  </div>
                </div>
              </div>
              
              {avatar.description && (
                <p className="avatar-description-display">{avatar.description}</p>
              )}
              
              <div className="avatar-identity-actions">
                <button
                  onClick={() => setIsEditing(true)}
                  className="btn-secondary"
                >
                  ✏️ Edit Identity
                </button>
              </div>
            </div>
          ) : (
            <div className="avatar-info-edit">
              <div className="edit-form-group">
                <label className="edit-form-label">Avatar Name *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="edit-form-input"
                  placeholder="Enter avatar name"
                  maxLength={50}
                />
                <p className="edit-form-hint">
                  This is how your avatar will introduce itself in conversations
                </p>
              </div>

              <div className="edit-form-group">
                <label className="edit-form-label">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="edit-form-textarea"
                  placeholder="Describe your avatar's personality or role (optional)"
                  rows={3}
                  maxLength={200}
                />
                <p className="edit-form-hint">
                  {editForm.description.length}/200 characters
                </p>
              </div>

              {error && (
                <div className="edit-form-error">
                  {error}
                </div>
              )}

              <div className="edit-form-actions">
                <button
                  onClick={handleCancel}
                  className="btn-secondary"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="btn-primary"
                  disabled={saving || !editForm.name.trim()}
                >
                  {saving ? (
                    <>
                      <span className="spinner"></span>
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Identity Preview */}
      <div className="avatar-identity-preview">
        <h4>How your avatar will introduce itself:</h4>
        <div className="identity-preview-text">
          "Hi! I'm <strong>{editForm.name || avatar.name}</strong>
          {(editForm.description || avatar.description) && (
            <>, {editForm.description || avatar.description}</>
          )}. How can I help you today?"
        </div>
      </div>
    </div>
  )
}