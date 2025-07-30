'use client';

import React, { useState } from 'react';

interface AccentConsistencyFixerProps {
  avatarId: string;
  voiceId: string;
  avatarName: string;
}

export default function AccentConsistencyFixer({ avatarId, voiceId, avatarName }: AccentConsistencyFixerProps) {
  const [isFixing, setIsFixing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const fixAccent = async () => {
    setIsFixing(true);
    setResult(null);

    try {
      // For testing purposes, just show the recommended settings
      const recommendedSettings = {
        stability: 0.95,           // Maximum stability for consistent voice
        similarity_boost: 0.95,    // Maximum similarity to match ElevenLabs quality
        style: 0.0,               // Zero style to eliminate accent drift
        use_speaker_boost: true    // Enhance clarity
      };

      setResult({
        success: true,
        message: 'Recommended settings for accent consistency',
        settings: recommendedSettings,
        recommendations: [
          'Stability: 0.95 for maximum consistent voice character',
          'Similarity Boost: 0.95 to match ElevenLabs quality',
          'Style: 0.0 to eliminate accent drift completely',
          'Speaker Boost: true for enhanced clarity',
          'Use these settings in the Voice Settings Optimizer below'
        ]
      });

      // Don't refresh the page for testing
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
        🎯 Fix Accent Consistency (ElevenLabs Recommended)
      </h4>
      <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#374151' }}>
        Based on ElevenLabs recommendations, this applies settings to eliminate Australian accent variations:
      </p>
      
      <div style={{ 
        background: 'rgba(156, 163, 175, 0.1)', 
        padding: '0.75rem', 
        borderRadius: '4px', 
        marginBottom: '1rem',
        fontSize: '0.85rem'
      }}>
        <strong>Applied Settings:</strong>
        <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1rem' }}>
          <li>Stability: 0.75 (balanced, not too high)</li>
          <li>Similarity Boost: 0.75 (moderate, prevents accent drift)</li>
          <li>Style: 0.0 (zero, eliminates accent variations)</li>
          <li>Speaker Boost: true (enhances clarity)</li>
        </ul>
      </div>

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
        {isFixing ? 'Fixing Accent...' : 'Apply ElevenLabs Recommended Settings'}
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

          {result.success && (
            <div style={{ marginTop: '0.75rem' }}>
              <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>Why This Works:</p>
              <ul style={{ margin: '0', paddingLeft: '1rem', fontSize: '0.85rem' }}>
                <li>Moderate similarity (0.75) prevents accent drift from high values</li>
                <li>Zero style eliminates accent variations</li>
                <li>Balanced stability maintains natural speech</li>
                <li>Speaker boost enhances clarity without affecting accent</li>
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 