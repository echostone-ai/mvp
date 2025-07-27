'use client';

import React, { useState } from 'react';

interface VoiceImprovementToolProps {
  avatarId: string;
  voiceId: string;
  avatarName: string;
}

interface ImprovementResult {
  success: boolean;
  message: string;
  settings?: any;
  testResult?: any;
  recommendations?: string[];
  error?: string;
}

export default function VoiceImprovementTool({ avatarId, voiceId, avatarName }: VoiceImprovementToolProps) {
  const [isImproving, setIsImproving] = useState(false);
  const [result, setResult] = useState<ImprovementResult | null>(null);
  const [selectedImprovementType, setSelectedImprovementType] = useState('accent_consistency');

  const improvementTypes = {
    accent_consistency: {
      title: 'Fix Accent Consistency',
      description: 'Reduces accent variation and makes voice more consistent',
      icon: '🎯'
    },
    voice_similarity: {
      title: 'Improve Voice Similarity',
      description: 'Makes the cloned voice sound more like your original voice',
      icon: '👤'
    },
    natural_expression: {
      title: 'Natural Expression',
      description: 'Balances consistency with natural emotional expression',
      icon: '😊'
    }
  };

  const improveVoice = async () => {
    setIsImproving(true);
    setResult(null);

    try {
      const response = await fetch('/api/improve-voice-consistency', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          avatarId,
          voiceId,
          improvementType: selectedImprovementType
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          success: true,
          message: data.message,
          settings: data.settings,
          testResult: data.testResult,
          recommendations: data.recommendations
        });
      } else {
        setResult({
          success: false,
          message: 'Failed to improve voice',
          error: data.error || 'Unknown error occurred'
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: 'Network error occurred',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsImproving(false);
    }
  };

  return (
    <div className="voice-improvement-tool" style={{
      background: 'rgba(30,30,60,0.95)',
      borderRadius: '16px',
      padding: '2rem',
      margin: '1rem 0',
      border: '1px solid rgba(155, 124, 255, 0.2)'
    }}>
      <div className="tool-header" style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ color: '#ffffff', fontSize: '1.5rem', marginBottom: '0.5rem' }}>
          🔧 Improve {avatarName}'s Voice
        </h3>
        <p style={{ color: '#b8b8d9', fontSize: '1rem', lineHeight: '1.5' }}>
          If your cloned voice has varying accents or doesn't sound like you, try these optimization options:
        </p>
      </div>

      <div className="improvement-options" style={{ marginBottom: '1.5rem' }}>
        <h4 style={{ color: '#ffffff', marginBottom: '1rem' }}>Choose Improvement Type:</h4>
        
        {Object.entries(improvementTypes).map(([key, type]) => (
          <label
            key={key}
            className="improvement-option"
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '1rem',
              marginBottom: '0.5rem',
              background: selectedImprovementType === key ? 'rgba(155, 124, 255, 0.2)' : 'rgba(45, 37, 67, 0.5)',
              borderRadius: '8px',
              border: selectedImprovementType === key ? '2px solid #9b7cff' : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <input
              type="radio"
              name="improvementType"
              value={key}
              checked={selectedImprovementType === key}
              onChange={(e) => setSelectedImprovementType(e.target.value)}
              style={{ marginRight: '1rem' }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '1.2rem', marginRight: '0.5rem' }}>{type.icon}</span>
                <span style={{ color: '#ffffff', fontWeight: '600' }}>{type.title}</span>
              </div>
              <p style={{ color: '#b8b8d9', fontSize: '0.9rem', margin: 0 }}>
                {type.description}
              </p>
            </div>
          </label>
        ))}
      </div>

      <div className="tool-actions" style={{ marginBottom: '1.5rem' }}>
        <button
          onClick={improveVoice}
          disabled={isImproving}
          style={{
            background: isImproving ? '#666' : 'linear-gradient(135deg, #9b7cff 0%, #7c5dff 100%)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            padding: '0.75rem 1.5rem',
            fontSize: '1rem',
            fontWeight: '600',
            cursor: isImproving ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            width: '100%'
          }}
        >
          {isImproving ? '🔄 Optimizing Voice...' : '✨ Improve Voice Now'}
        </button>
      </div>

      {result && (
        <div className="improvement-result" style={{
          padding: '1rem',
          borderRadius: '8px',
          background: result.success ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${result.success ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '0.5rem'
          }}>
            <span style={{ fontSize: '1.2rem', marginRight: '0.5rem' }}>
              {result.success ? '✅' : '❌'}
            </span>
            <h4 style={{
              color: result.success ? '#22c55e' : '#ef4444',
              margin: 0
            }}>
              {result.success ? 'Voice Improved!' : 'Improvement Failed'}
            </h4>
          </div>
          
          <p style={{ color: '#ffffff', marginBottom: '1rem' }}>
            {result.message}
          </p>

          {result.error && (
            <p style={{ color: '#ef4444', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Error: {result.error}
            </p>
          )}

          {result.testResult && (
            <div style={{ marginBottom: '1rem' }}>
              <h5 style={{ color: '#ffffff', marginBottom: '0.5rem' }}>Voice Test Results:</h5>
              <p style={{ color: '#b8b8d9', fontSize: '0.9rem' }}>
                Consistency Score: {result.testResult.consistencyScore}% 
                ({result.testResult.successfulTests}/{result.testResult.totalTests} tests passed)
              </p>
            </div>
          )}

          {result.recommendations && (
            <div>
              <h5 style={{ color: '#ffffff', marginBottom: '0.5rem' }}>Recommendations:</h5>
              <ul style={{ color: '#b8b8d9', fontSize: '0.9rem', paddingLeft: '1.5rem' }}>
                {result.recommendations.map((rec, index) => (
                  <li key={index} style={{ marginBottom: '0.25rem' }}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="additional-tips" style={{
        marginTop: '1.5rem',
        padding: '1rem',
        background: 'rgba(45, 37, 67, 0.5)',
        borderRadius: '8px',
        borderLeft: '4px solid #9b7cff'
      }}>
        <h5 style={{ color: '#ffffff', marginBottom: '0.5rem' }}>💡 Additional Tips:</h5>
        <ul style={{ color: '#b8b8d9', fontSize: '0.9rem', paddingLeft: '1.5rem', margin: 0 }}>
          <li>If problems persist, consider re-training with 5-7 new audio samples</li>
          <li>Record in the same quiet environment for all samples</li>
          <li>Speak naturally and consistently across all recordings</li>
          <li>Test the voice with different types of content after improvement</li>
        </ul>
      </div>
    </div>
  );
}