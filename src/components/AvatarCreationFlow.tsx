'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface AvatarCreationFlowProps {
  onComplete: (avatarData: { name: string; photo: File | null; avatarId: string }) => void;
  onBack: () => void;
}

export default function AvatarCreationFlow({ onComplete, onBack }: AvatarCreationFlowProps) {
  const [step, setStep] = useState<'name' | 'photo' | 'creating'>('name');
  const [avatarName, setAvatarName] = useState('');
  const [avatarPhoto, setAvatarPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (avatarName.trim()) {
      setStep('photo');
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarPhoto(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreateAvatar = async () => {
    setIsCreating(true);
    setStep('creating');

    try {
      const { data: session } = await supabase.auth.getSession();
      const user = session.session?.user;
      
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Create the avatar in the database
      const { data: newAvatar, error } = await supabase
        .from('avatar_profiles')
        .insert([{
          user_id: user.id,
          name: avatarName,
          description: `Meet ${avatarName} - a unique personality ready to connect with you.`,
          profile_data: {
            name: avatarName,
            created_via: 'voice_onboarding',
            creation_date: new Date().toISOString()
          }
        }])
        .select()
        .single();

      if (error) throw error;

      // TODO: Upload photo to storage if provided
      // For now, we'll pass the photo file to be handled later

      onComplete({
        name: avatarName,
        photo: avatarPhoto,
        avatarId: newAvatar.id
      });
    } catch (error) {
      console.error('Error creating avatar:', error);
      alert('Error creating avatar. Please try again.');
      setStep('photo');
    } finally {
      setIsCreating(false);
    }
  };

  if (step === 'creating') {
    return (
      <div className="avatar-creation-container">
        <div className="creation-progress">
          <div className="creation-spinner">
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
            <div className="spinner-ring"></div>
          </div>
          <h2 className="creation-title">Creating {avatarName}...</h2>
          <p className="creation-subtitle">
            Bringing your avatar to life with personality and charm
          </p>
          <div className="creation-steps">
            <div className="creation-step active">
              <span className="step-icon">✨</span>
              <span>Setting up personality framework</span>
            </div>
            <div className="creation-step active">
              <span className="step-icon">🧠</span>
              <span>Preparing memory systems</span>
            </div>
            <div className="creation-step active">
              <span className="step-icon">🎭</span>
              <span>Crafting unique character traits</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="avatar-creation-container">
      <div className="creation-header">
        <button onClick={onBack} className="back-button">
          ← Back to Options
        </button>
        <div className="creation-progress-bar">
          <div className="progress-step completed">
            <div className="step-circle">1</div>
            <span>Choose Path</span>
          </div>
          <div className={`progress-step ${step !== 'name' ? 'completed' : 'active'}`}>
            <div className="step-circle">2</div>
            <span>Name</span>
          </div>
          <div className={`progress-step ${step === 'photo' ? 'active' : ''}`}>
            <div className="step-circle">3</div>
            <span>Photo</span>
          </div>
          <div className="progress-step">
            <div className="step-circle">4</div>
            <span>Voice</span>
          </div>
        </div>
      </div>

      {step === 'name' && (
        <div className="creation-step-container">
          <div className="step-content">
            <div className="step-icon-large">🎭</div>
            <h2 className="step-title">What should we call your avatar?</h2>
            <p className="step-description">
              Choose a name that feels right. This will be how your avatar introduces themselves 
              and how others will know them. Make it personal and meaningful to you.
            </p>
            
            <form onSubmit={handleNameSubmit} className="name-form">
              <div className="name-input-container">
                <input
                  type="text"
                  value={avatarName}
                  onChange={(e) => setAvatarName(e.target.value)}
                  placeholder="Enter your avatar's name..."
                  className="name-input"
                  autoFocus
                  maxLength={50}
                />
                <div className="input-underline"></div>
              </div>
              
              <div className="name-suggestions">
                <p className="suggestions-label">Need inspiration?</p>
                <div className="suggestion-tags">
                  {['Alex', 'Jordan', 'Riley', 'Casey', 'Morgan', 'Sage'].map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setAvatarName(name)}
                      className="suggestion-tag"
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={!avatarName.trim()}
                className="continue-button"
              >
                Continue to Photo
                <span className="button-arrow">→</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {step === 'photo' && (
        <div className="creation-step-container">
          <div className="step-content">
            <div className="step-icon-large">📸</div>
            <h2 className="step-title">Give {avatarName} a face</h2>
            <p className="step-description">
              Upload a photo that represents {avatarName}. This could be a portrait, an artistic image, 
              or anything that captures their essence. You can always change this later.
            </p>

            <div className="photo-upload-section">
              <div className="photo-preview-container">
                {photoPreview ? (
                  <div className="photo-preview">
                    <img src={photoPreview} alt="Avatar preview" />
                    <button
                      onClick={() => {
                        setAvatarPhoto(null);
                        setPhotoPreview(null);
                        if (fileInputRef.current) {
                          fileInputRef.current.value = '';
                        }
                      }}
                      className="photo-remove"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <div className="photo-placeholder">
                    <div className="placeholder-icon">🎭</div>
                    <p>No photo yet</p>
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="photo-input"
                id="avatar-photo"
              />
              
              <label htmlFor="avatar-photo" className="photo-upload-button">
                <span className="upload-icon">📁</span>
                {photoPreview ? 'Change Photo' : 'Choose Photo'}
              </label>

              <p className="photo-note">
                Optional - you can skip this step and add a photo later
              </p>
            </div>

            <div className="step-actions">
              <button
                onClick={() => setStep('name')}
                className="back-step-button"
              >
                ← Back to Name
              </button>
              
              <button
                onClick={handleCreateAvatar}
                className="create-avatar-button"
              >
                Create {avatarName}
                <span className="button-sparkle">✨</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}