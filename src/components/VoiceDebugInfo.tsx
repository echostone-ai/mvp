'use client';

import React from 'react';

interface VoiceDebugInfoProps {
  selectedAvatar: any;
  voiceId: string | null;
}

export default function VoiceDebugInfo({ selectedAvatar, voiceId }: VoiceDebugInfoProps) {
  const [isFixing, setIsFixing] = React.useState(false);
  
  const fixVoiceIdMismatch = async () => {
    if (!selectedAvatar?.id || !selectedAvatar?.voice_id) return;
    
    setIsFixing(true);
    try {
      // For now, let's just log what we would do
      console.log('Would fix voice ID mismatch:', {
        avatarId: selectedAvatar.id,
        currentVoiceId: selectedAvatar.voice_id,
        stateVoiceId: voiceId
      });
      
      // You can implement the actual fix here if needed
      alert(`Debug info logged to console. Avatar voice_id: ${selectedAvatar.voice_id}`);
    } catch (error) {
      console.error('Error fixing voice ID:', error);
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <details style={{
      background: 'rgba(45, 37, 67, 0.5)',
      borderRadius: '8px',
      padding: '1rem',
      marginBottom: '1rem',
      border: '1px solid rgba(155, 124, 255, 0.2)'
    }}>
      <summary style={{
        color: '#9b7cff',
        cursor: 'pointer',
        fontWeight: '600',
        marginBottom: '0.5rem'
      }}>
        🔍 Debug Voice Information
      </summary>
      
      <div style={{ color: '#ffffff', fontSize: '0.9rem' }}>
        <h4 style={{ color: '#9b7cff', marginBottom: '0.5rem' }}>Avatar Information:</h4>
        <ul style={{ marginLeft: '1rem', marginBottom: '1rem' }}>
          <li><strong>Avatar ID:</strong> {selectedAvatar?.id || 'Not set'}</li>
          <li><strong>Avatar Name:</strong> {selectedAvatar?.name || 'Not set'}</li>
          <li><strong>Avatar voice_id:</strong> {selectedAvatar?.voice_id || 'Not set'}</li>
        </ul>
        
        <h4 style={{ color: '#9b7cff', marginBottom: '0.5rem' }}>State Information:</h4>
        <ul style={{ marginLeft: '1rem', marginBottom: '1rem' }}>
          <li><strong>voiceId state:</strong> {voiceId || 'Not set'}</li>
          <li><strong>Should use:</strong> {selectedAvatar?.voice_id || 'No voice available'}</li>
          <li><strong>Match status:</strong> {
            selectedAvatar?.voice_id && voiceId 
              ? (selectedAvatar.voice_id === voiceId ? '✅ Match' : '❌ Mismatch') 
              : '⚠️ Cannot compare'
          }</li>
        </ul>
        
        {selectedAvatar?.voice_id && voiceId && selectedAvatar.voice_id !== voiceId && (
          <div style={{ marginBottom: '1rem' }}>
            <button
              onClick={fixVoiceIdMismatch}
              disabled={isFixing}
              style={{
                background: '#ef4444',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                padding: '0.5rem 1rem',
                cursor: isFixing ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem'
              }}
            >
              {isFixing ? '🔄 Debugging...' : '🔧 Debug Voice ID Issue'}
            </button>
          </div>
        )}

        <h4 style={{ color: '#9b7cff', marginBottom: '0.5rem' }}>Full Avatar Object:</h4>
        <pre style={{
          background: 'rgba(0, 0, 0, 0.3)',
          padding: '0.5rem',
          borderRadius: '4px',
          fontSize: '0.8rem',
          overflow: 'auto',
          maxHeight: '200px'
        }}>
          {JSON.stringify(selectedAvatar, null, 2)}
        </pre>
      </div>
    </details>
  );
}