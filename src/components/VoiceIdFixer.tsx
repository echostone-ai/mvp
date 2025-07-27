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

  const testVoiceInElevenLabs = async () => {
    if (!selectedAvatar?.voice_id) return;
    
    setIsFixing(true);
    setResult(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setResult('❌ Not authenticated');
        return;
      }

      // Test if the voice exists in ElevenLabs
      const response = await fetch('/api/test-voice-exists', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          voiceId: selectedAvatar.voice_id
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        setResult(`✅ Voice exists in ElevenLabs: ${data.name || 'Unknown name'}`);
      } else {
        setResult(`❌ Voice not found in ElevenLabs: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      setResult(`❌ Error testing voice: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsFixing(false);
    }
  };

  const listAllVoices = async () => {
    setIsFixing(true);
    setResult(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setResult('❌ Not authenticated');
        return;
      }

      // Get all voices from ElevenLabs
      const response = await fetch('/api/list-voices', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();
      
      if (response.ok) {
        const voiceList = data.voices.map((voice: any) => 
          `${voice.name} (${voice.voice_id}) - ${voice.category}`
        ).join('\n');
        
        setResult(`✅ Found ${data.voices.length} voices in your ElevenLabs account:\n\n${voiceList}`);
      } else {
        setResult(`❌ Failed to list voices: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      setResult(`❌ Error listing voices: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsFixing(false);
    }
  };

  const checkVoiceSettingsColumn = async () => {
    setIsFixing(true);
    setResult(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setResult('❌ Not authenticated');
        return;
      }

      // Check if voice_settings column exists
      const response = await fetch('/api/check-voice-settings-column', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();
      
      if (response.ok) {
        if (data.columnExists) {
          setResult('✅ voice_settings column exists in the database');
        } else {
          setResult(`❌ voice_settings column does not exist\n\nTo fix this, run this SQL command in Supabase:\n${data.sqlCommand}`);
        }
      } else {
        setResult(`❌ Failed to check column: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      setResult(`❌ Error checking column: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  return (
    <div style={{
      background: 'rgba(59, 130, 246, 0.1)',
      border: '2px solid rgba(59, 130, 246, 0.3)',
      borderRadius: '12px',
      padding: '1.5rem',
      margin: '1rem 0'
    }}>
      <h3 style={{ color: '#3b82f6', marginBottom: '1rem', fontSize: '1.2rem' }}>
        🔧 Voice Diagnostics
      </h3>
      
      <div style={{ marginBottom: '1rem', color: '#ffffff' }}>
        <p><strong>Avatar voice_id:</strong> <code>{selectedAvatar.voice_id || 'null'}</code></p>
        <p><strong>Status:</strong> Voice ID is present in database</p>
      </div>

      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button
          onClick={testVoiceInElevenLabs}
          disabled={isFixing || !selectedAvatar.voice_id}
          style={{
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            padding: '0.75rem 1.5rem',
            cursor: (isFixing || !selectedAvatar.voice_id) ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
            fontWeight: '600'
          }}
        >
          {isFixing ? '🔄 Testing...' : '🔍 Test Voice in ElevenLabs'}
        </button>
        
        <button
          onClick={listAllVoices}
          disabled={isFixing}
          style={{
            background: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            padding: '0.75rem 1.5rem',
            cursor: isFixing ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
            fontWeight: '600'
          }}
        >
          {isFixing ? '🔄 Loading...' : '📋 List All Voices'}
        </button>
        
        <button
          onClick={checkVoiceSettingsColumn}
          disabled={isFixing}
          style={{
            background: '#f59e0b',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            padding: '0.75rem 1.5rem',
            cursor: isFixing ? 'not-allowed' : 'pointer',
            fontSize: '1rem',
            fontWeight: '600'
          }}
        >
          {isFixing ? '🔄 Checking...' : '🔧 Check DB Column'}
        </button>
      </div>

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
          <pre style={{ 
            whiteSpace: 'pre-wrap', 
            wordWrap: 'break-word', 
            margin: 0,
            fontFamily: 'inherit',
            fontSize: '0.9rem'
          }}>
            {result}
          </pre>
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