'use client';

import React, { useState } from 'react';
import VoiceImprovementTool from './VoiceImprovementTool';

interface Avatar {
  id: string;
  name: string;
  description: string;
  voice_id: string | null;
  profile_data: any;
  created_at: string;
}

interface ImprovedVoiceManagementProps {
  avatars: Avatar[];
  onTrainVoice: (avatar: Avatar) => void;
  onClearVoice: (avatarId: string) => void;
  updating: string | null;
}

export default function ImprovedVoiceManagement({ 
  avatars, 
  onTrainVoice, 
  onClearVoice, 
  updating 
}: ImprovedVoiceManagementProps) {
  const [selectedAvatarId, setSelectedAvatarId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'manage' | 'improve'>('manage');

  const selectedAvatar = avatars.find(avatar => avatar.id === selectedAvatarId);

  return (
    <div className="improved-voice-management">
      {/* Avatar Selection */}
      <div className="avatar-selection-section" style={{
        background: 'rgba(30,30,60,0.95)',
        borderRadius: '16px',
        padding: '1.5rem',
        marginBottom: '1.5rem',
        border: '1px solid rgba(155, 124, 255, 0.2)'
      }}>
        <h2 style={{ color: '#ffffff', fontSize: '1.5rem', marginBottom: '1rem' }}>
          Select an Avatar
        </h2>
        <div className="avatar-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1rem'
        }}>
          {avatars.map((avatar) => (
            <button
              key={avatar.id}
              onClick={() => setSelectedAvatarId(avatar.id)}
              className="avatar-card"
              style={{
                background: selectedAvatarId === avatar.id 
                  ? 'rgba(155, 124, 255, 0.2)' 
                  : 'rgba(45, 37, 67, 0.5)',
                border: selectedAvatarId === avatar.id 
                  ? '2px solid #9b7cff' 
                  : '2px solid transparent',
                borderRadius: '12px',
                padding: '1rem',
                textAlign: 'left',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                width: '100%'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #9b7cff 0%, #7c5dff 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '0.75rem',
                  fontSize: '1.2rem'
                }}>
                  👤
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ color: '#ffffff', fontSize: '1.1rem', margin: 0 }}>
                    {avatar.name}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', marginTop: '0.25rem' }}>
                    <span style={{
                      display: 'inline-block',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: avatar.voice_id ? '#22c55e' : '#ef4444',
                      marginRight: '0.5rem'
                    }}></span>
                    <span style={{ 
                      color: avatar.voice_id ? '#22c55e' : '#ef4444',
                      fontSize: '0.9rem',
                      fontWeight: '500'
                    }}>
                      {avatar.voice_id ? 'Voice Ready' : 'No Voice'}
                    </span>
                  </div>
                </div>
              </div>
              {avatar.description && (
                <p style={{ 
                  color: '#b8b8d9', 
                  fontSize: '0.9rem', 
                  margin: 0,
                  lineHeight: '1.4'
                }}>
                  {avatar.description}
                </p>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Selected Avatar Tools */}
      {selectedAvatar && (
        <div className="selected-avatar-tools" style={{
          background: 'rgba(30,30,60,0.95)',
          borderRadius: '16px',
          padding: '1.5rem',
          border: '1px solid rgba(155, 124, 255, 0.2)'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            marginBottom: '1.5rem'
          }}>
            <h2 style={{ color: '#ffffff', fontSize: '1.5rem', margin: 0 }}>
              {selectedAvatar.name} - Voice Tools
            </h2>
            <div className="tab-buttons" style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setActiveTab('manage')}
                style={{
                  background: activeTab === 'manage' ? '#9b7cff' : 'rgba(45, 37, 67, 0.5)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.5rem 1rem',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Manage
              </button>
              {selectedAvatar.voice_id && (
                <button
                  onClick={() => setActiveTab('improve')}
                  style={{
                    background: activeTab === 'improve' ? '#9b7cff' : 'rgba(45, 37, 67, 0.5)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.5rem 1rem',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  Improve
                </button>
              )}
            </div>
          </div>

          {activeTab === 'manage' && (
            <div className="manage-tab">
              <div className="voice-status" style={{
                background: 'rgba(45, 37, 67, 0.5)',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '1.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{
                    display: 'inline-block',
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: selectedAvatar.voice_id ? '#22c55e' : '#ef4444',
                    marginRight: '0.75rem'
                  }}></span>
                  <h3 style={{ color: '#ffffff', margin: 0 }}>
                    Voice Status: {selectedAvatar.voice_id ? 'Ready' : 'Not Trained'}
                  </h3>
                </div>
                <p style={{ color: '#b8b8d9', fontSize: '0.9rem', margin: 0 }}>
                  {selectedAvatar.voice_id 
                    ? 'This avatar has a trained voice and can speak in conversations.'
                    : 'This avatar needs voice training to speak in conversations.'
                  }
                </p>
              </div>

              <div className="voice-actions" style={{
                display: 'flex',
                gap: '1rem',
                flexWrap: 'wrap'
              }}>
                <button
                  onClick={() => onTrainVoice(selectedAvatar)}
                  style={{
                    background: 'linear-gradient(135deg, #9b7cff 0%, #7c5dff 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '0.75rem 1.5rem',
                    fontSize: '1rem',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    flex: '1',
                    minWidth: '150px'
                  }}
                >
                  {selectedAvatar.voice_id ? '🔄 Retrain Voice' : '🎤 Train Voice'}
                </button>

                {selectedAvatar.voice_id && (
                  <button
                    onClick={() => onClearVoice(selectedAvatar.id)}
                    disabled={updating === selectedAvatar.id}
                    style={{
                      background: updating === selectedAvatar.id ? '#666' : '#ef4444',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '0.75rem 1.5rem',
                      fontSize: '1rem',
                      fontWeight: '600',
                      cursor: updating === selectedAvatar.id ? 'not-allowed' : 'pointer',
                      transition: 'all 0.2s ease',
                      flex: '1',
                      minWidth: '150px'
                    }}
                  >
                    {updating === selectedAvatar.id ? '🔄 Clearing...' : '🗑️ Clear Voice'}
                  </button>
                )}
              </div>
            </div>
          )}

          {activeTab === 'improve' && selectedAvatar.voice_id && (
            <div className="improve-tab">
              <VoiceImprovementTool
                avatarId={selectedAvatar.id}
                voiceId={selectedAvatar.voice_id}
                avatarName={selectedAvatar.name}
              />
            </div>
          )}
        </div>
      )}

      {!selectedAvatar && (
        <div className="no-selection" style={{
          background: 'rgba(30,30,60,0.95)',
          borderRadius: '16px',
          padding: '2rem',
          textAlign: 'center',
          border: '1px solid rgba(155, 124, 255, 0.2)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👆</div>
          <h3 style={{ color: '#ffffff', marginBottom: '0.5rem' }}>
            Select an Avatar Above
          </h3>
          <p style={{ color: '#b8b8d9', margin: 0 }}>
            Choose an avatar to manage its voice settings and training options.
          </p>
        </div>
      )}
    </div>
  );
}