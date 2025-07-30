'use client';

import React, { useState } from 'react';

interface VoiceAccentFixerProps {
  avatarId: string;
  voiceId: string;
  avatarName: string;
}

export default function VoiceAccentFixer({ avatarId, voiceId, avatarName }: VoiceAccentFixerProps) {
  const [isFixing, setIsFixing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const fixAccent = async () => {
    setIsFixing(true);
    setResult(null);

    try {
      const response = await fetch('/api/fix-avatar-voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          avatarId,
          voiceId
        })
      });

      const data = await response.json();
      setResult(data);

      if (data.success) {
        // Refresh the page to apply new settings
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (error) {
      setResult({
        success: false,
        error: 'Failed to fix accent issue'
      });
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <div style={{
      background: 'rgba(59, 130, 246, 0.1)',
      border: '1px solid rgba(59, 130, 246, 0.3)',
      borderRadius: '8px',
      padding: '1rem',
      margin: '1rem 0'
    }}>
      <h4 style={{ margin: '0 0 0.5rem 0', color: '#1e40af' }}>
        🎯 Fix Accent Consistency
      </h4>
      <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#374151' }}>
        If your voice has an Australian accent or accent variations, this will apply optimized settings to make it sound more like your original voice.
      </p>
      
      <button
        onClick={fixAccent}
        disabled={isFixing}
        style={{
          background: isFixing ? '#9ca3af' : '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          padding: '0.5rem 1rem',
          cursor: isFixing ? 'not-allowed' : 'pointer',
          fontSize: '0.9rem'
        }}
      >
        {isFixing ? 'Fixing Accent...' : 'Fix Accent Issue'}
      </button>

      {result && (
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem',
          borderRadius: '6px',
          background: result.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${result.success ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          color: result.success ? '#166534' : '#dc2626'
        }}>
          <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>
            {result.success ? '✅ Success!' : '❌ Error'}
          </p>
          <p style={{ margin: '0', fontSize: '0.9rem' }}>
            {result.message || result.error}
          </p>
          
          {result.success && result.recommendations && (
            <div style={{ marginTop: '0.75rem' }}>
              <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>Recommendations:</p>
              <ul style={{ margin: '0', paddingLeft: '1rem', fontSize: '0.85rem' }}>
                {result.recommendations.map((rec: string, index: number) => (
                  <li key={index}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 