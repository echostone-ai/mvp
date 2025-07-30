'use client';

import React, { useState } from 'react';
import { getNaturalVoiceSettings } from '@/lib/naturalVoiceSettings';

interface VoiceSettingsOptimizerProps {
  voiceId: string;
  onSettingsChange: (settings: any) => void;
}

export default function VoiceSettingsOptimizer({ voiceId, onSettingsChange }: VoiceSettingsOptimizerProps) {
  const [settings, setSettings] = useState(getNaturalVoiceSettings());
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string>('');

  const testSettings = async () => {
    setIsTesting(true);
    setTestResult('Testing voice with current settings...');
    
    try {
      const response = await fetch('/api/voice-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sentence: "This is a test of the voice settings. How does it sound?",
          voiceId: voiceId,
          settings: settings,
          conversationId: 'settings-test'
        }),
      });

      if (response.ok) {
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          setTestResult('✅ Test completed. Listen to the audio above.');
        };
        
        audio.play();
      } else {
        setTestResult('❌ Test failed. Check console for details.');
      }
    } catch (error) {
      setTestResult('❌ Test failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsTesting(false);
    }
  };

  const applySettings = () => {
    onSettingsChange(settings);
  };

  const presetSettings = {
    'ElevenLabs Default': {
      stability: 0.75,
      similarity_boost: 0.75,
      style: 0.0,
      use_speaker_boost: true
    },
    'High Consistency': {
      stability: 0.90,
      similarity_boost: 0.90,
      style: 0.10,
      use_speaker_boost: true
    },
    'Natural Variation': {
      stability: 0.70,
      similarity_boost: 0.85,
      style: 0.25,
      use_speaker_boost: true
    },
    'Balanced': {
      stability: 0.90,
      similarity_boost: 0.90,
      style: 0.10,
      use_speaker_boost: true
    }
  };

  return (
    <div style={{
      background: 'rgba(34, 197, 94, 0.1)',
      border: '1px solid rgba(34, 197, 94, 0.3)',
      borderRadius: '8px',
      padding: '1rem',
      margin: '1rem 0'
    }}>
      <h4 style={{ margin: '0 0 0.5rem 0', color: '#166534' }}>
        ⚙️ Voice Settings Optimizer
      </h4>
      <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#374151' }}>
        Fine-tune voice settings for better consistency and natural sound.
      </p>
      
      <div style={{ marginBottom: '1rem' }}>
        <strong>Preset Settings:</strong>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '0.5rem' }}>
          {Object.entries(presetSettings).map(([name, preset]) => (
            <button
              key={name}
              onClick={() => setSettings(preset)}
              style={{
                background: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: '4px',
                padding: '0.5rem',
                cursor: 'pointer',
                fontSize: '0.8rem',
                textAlign: 'left'
              }}
            >
              <div style={{ fontWeight: 'bold' }}>{name}</div>
              <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>
                S: {preset.stability} | SB: {preset.similarity_boost} | Style: {preset.style}
              </div>
            </button>
          ))}
        </div>
      </div>
      
      <div style={{ marginBottom: '1rem' }}>
        <strong>Custom Settings:</strong>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
              Stability: {settings.stability}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.stability}
              onChange={(e) => setSettings({...settings, stability: parseFloat(e.target.value)})}
              style={{ width: '100%' }}
            />
            <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>
              Higher = more consistent, Lower = more natural
            </div>
          </div>
          
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
              Similarity Boost: {settings.similarity_boost}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.similarity_boost}
              onChange={(e) => setSettings({...settings, similarity_boost: parseFloat(e.target.value)})}
              style={{ width: '100%' }}
            />
            <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>
              Higher = closer to original voice
            </div>
          </div>
          
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
              Style: {settings.style}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.style}
              onChange={(e) => setSettings({...settings, style: parseFloat(e.target.value)})}
              style={{ width: '100%' }}
            />
            <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>
              Higher = more expressive variation
            </div>
          </div>
          
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.25rem' }}>
              Speaker Boost
            </label>
            <input
              type="checkbox"
              checked={settings.use_speaker_boost}
              onChange={(e) => setSettings({...settings, use_speaker_boost: e.target.checked})}
            />
            <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>
              Enhances clarity and presence
            </div>
          </div>
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <button
          onClick={testSettings}
          disabled={isTesting}
          style={{
            background: isTesting ? '#9ca3af' : '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            padding: '0.5rem 1rem',
            cursor: isTesting ? 'not-allowed' : 'pointer',
            fontSize: '0.9rem'
          }}
        >
          {isTesting ? 'Testing...' : 'Test Settings'}
        </button>
        
        <button
          onClick={applySettings}
          style={{
            background: '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            padding: '0.5rem 1rem',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          Apply Settings
        </button>
      </div>
      
      {testResult && (
        <div style={{
          padding: '0.5rem',
          background: 'rgba(0,0,0,0.05)',
          borderRadius: '4px',
          fontSize: '0.8rem'
        }}>
          {testResult}
        </div>
      )}
      
      <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#6b7280' }}>
        <strong>Recommended for your voice:</strong>
        <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1rem' }}>
          <li>Start with "Balanced" preset</li>
          <li>Increase stability if voice varies too much</li>
          <li>Increase similarity boost if it doesn't sound like the original</li>
          <li>Add style for more natural variation</li>
        </ul>
      </div>
    </div>
  );
} 