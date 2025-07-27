'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';

interface VoiceIdFixerProps {
  selectedAvatar: any;
}

export default function VoiceIdFixer({ selectedAvatar }: VoiceIdFixerProps) {
  const [isFixing, setIsFixing] = useState(false);
  const [newVoiceId, setNewVoiceId] = useState('');
  const [result, setResult] = useState<string | null>(null);

  const correctVoiceId = 'IdAZHNBrnziWIBFFAn3C'; // The correct voice ID from your debug info

  const fixVoiceId = async () => {
    if (!selectedAvatar?.id) return;
    
    setIsFixing(true);
    setResult(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setResult('❌ Not authenticated');
        return;
      }

      // Update the avatar's voice_id in the database
      const { data, error } = await supabase
        .from('avatar_profiles')
        .update({ voice_id: correctVoiceId })
        .eq('id', selectedAvatar.id)
        .eq('user_id', session.user.id)
        .select();

      if (error) {
        setResult(`❌ Database error: ${error.message}`);
      } else {
        setResult(`✅ Successfully updated voice_id to: ${correctVoiceId}`);
        // Refresh the page to see changes
        setTimeout(() => window.location.reload(), 2000);
      }
    } catch (error) {
      setResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsFixing(false);
    }
  };

  const updateToCustomVoiceId = async () => {
    if (!selectedAvatar?.id || !newVoiceId.trim()) return;
    
    setIsFixing(true);
    setResult(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setResult('❌ Not authenticated');
        return;
      }

      const { data, error } = await supabase
        .from('avatar_profiles')
        .update({ voice_id: newVoiceId.trim() })
        .eq('id', selectedAvatar.id)
        .eq('user_id', session.user.id)
        .select();

      if (error) {
        setResult(`❌ Database error: ${error.message}`);
      } else {
        setResult(`✅ Successfully updated voice_id to: ${newVoiceId.trim()}`);
        setTimeout(() => window.location.reload(), 2000);
      }
    } catch (error) {
      setResult(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsFixing(false);
    }
  };

  if (!selectedAvatar) return null;

  const hasVoiceIdMismatch = selectedAvatar.voice_id !== correctVoiceId;

  return (
    <div style={{
      background: 'rgba(239, 68, 68, 0.1)',
      border: '2px solid rgba(239, 68, 68, 0.3)',
      borderRadius: '12px',
      padding: '1.5rem',
      margin: '1rem 0'
    }}>
      <h3 style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '1.2rem' }}>
        🔧 Voice ID Mismatch Fixer
      </h3>
      
      <div style={{ marginBottom: '1rem', color: '#ffffff' }}>
        <p><strong>Current avatar voice_id:</strong> <code>{selectedAvatar.voice_id || 'null'}</code></p>
        <p><strong>Expected voice_id:</strong> <code>{correctVoiceId}</code></p>
        <p><strong>Status:</strong> {hasVoiceIdMismatch ? '❌ Mismatch' : '✅ Correct'}</p>
      </div>

      {hasVoiceIdMismatch && (
        <div style={{ marginBottom: '1rem' }}>
          <button
            onClick={fixVoiceId}
            disabled={isFixing}
            style={{
              background: '#22c55e',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              padding: '0.75rem 1.5rem',
              cursor: isFixing ? 'not-allowed' : 'pointer',
              fontSize: '1rem',
              fontWeight: '600',
              marginRight: '1rem'
            }}
          >
            {isFixing ? '🔄 Fixing...' : '✅ Fix Voice ID Now'}
          </button>
        </div>
      )}

      <div style={{ marginBottom: '1rem' }}>
        <h4 style={{ color: '#ffffff', marginBottom: '0.5rem' }}>Or set custom voice ID:</h4>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="text"
            value={newVoiceId}
            onChange={(e) => setNewVoiceId(e.target.value)}
            placeholder="Enter voice ID"
            style={{
              padding: '0.5rem',
              borderRadius: '4px',
              border: '1px solid #ccc',
              color: 'black',
              flex: 1
            }}
          />
          <button
            onClick={updateToCustomVoiceId}
            disabled={isFixing || !newVoiceId.trim()}
            style={{
              background: '#9b7cff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              padding: '0.5rem 1rem',
              cursor: (isFixing || !newVoiceId.trim()) ? 'not-allowed' : 'pointer'
            }}
          >
            Update
          </button>
        </div>
      </div>

      {result && (
        <div style={{
          padding: '0.75rem',
          borderRadius: '6px',
          background: result.startsWith('✅') ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${result.startsWith('✅') ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          color: '#ffffff',
          marginTop: '1rem'
        }}>
          {result}
        </div>
      )}

      <div style={{
        marginTop: '1rem',
        padding: '0.75rem',
        background: 'rgba(45, 37, 67, 0.5)',
        borderRadius: '6px',
        fontSize: '0.9rem',
        color: '#b8b8d9'
      }}>
        <strong>Note:</strong> This tool will update the avatar's voice_id in the database to match the expected value. 
        The page will automatically refresh after a successful update.
      </div>
    </div>
  );
}