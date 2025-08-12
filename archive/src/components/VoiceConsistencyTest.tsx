'use client';

import React, { useState, useRef } from 'react';

interface VoiceConsistencyTestProps {
  voiceId: string;
  voiceSettings?: any;
}

export default function VoiceConsistencyTest({ voiceId, voiceSettings }: VoiceConsistencyTestProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [testResults, setTestResults] = useState<any[]>([]);
  const [currentTest, setCurrentTest] = useState<string>('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const testPhrases = [
    "Hello, this is a test of voice consistency.",
    "I'm speaking with natural variation and tone.",
    "The voice should sound consistent across all sentences.",
    "This is a longer sentence to test how the voice handles different text lengths.",
    "Let me demonstrate some emotional variation in my speech."
  ];

  const testVoiceConsistency = async () => {
    setIsPlaying(true);
    setTestResults([]);
    
    // Use ElevenLabs-matched settings for natural voice
    const consistentSettings = {
      stability: 0.75,           // High stability (75% to "More stable" in ElevenLabs)
      similarity_boost: 1.0,     // Maximum similarity (all the way to "High" in ElevenLabs)
      style: 0.25,              // Low style (25% from "None" in ElevenLabs)
      use_speaker_boost: true    // Enhance clarity
    };
    
    console.log('[VoiceConsistencyTest] Using settings:', consistentSettings);
    console.log('[VoiceConsistencyTest] Voice ID:', voiceId);
    
    for (let i = 0; i < testPhrases.length; i++) {
      const phrase = testPhrases[i];
      setCurrentTest(`Testing phrase ${i + 1}: "${phrase.substring(0, 30)}..."`);
      
      try {
        const response = await fetch('/api/voice-stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sentence: phrase,
            voiceId: voiceId,
            settings: consistentSettings, // Use consistent settings
            conversationId: 'voice-consistency-test'
          }),
        });

        if (response.ok) {
          const audioBlob = await response.blob();
          const audioUrl = URL.createObjectURL(audioBlob);
          
          // Play the audio
          if (audioRef.current) {
            audioRef.current.pause();
          }
          
          const audio = new Audio(audioUrl);
          audioRef.current = audio;
          
          await new Promise((resolve) => {
            audio.onended = () => {
              URL.revokeObjectURL(audioUrl);
              resolve(true);
            };
            audio.play();
          });
          
          setTestResults(prev => [...prev, {
            phrase,
            success: true,
            timestamp: new Date().toISOString()
          }]);
          
          // Wait between phrases
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          setTestResults(prev => [...prev, {
            phrase,
            success: false,
            error: `HTTP ${response.status}`,
            timestamp: new Date().toISOString()
          }]);
        }
      } catch (error) {
        setTestResults(prev => [...prev, {
          phrase,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }]);
      }
    }
    
    setCurrentTest('');
    setIsPlaying(false);
  };

  const stopTest = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsPlaying(false);
    setCurrentTest('');
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
        🎤 Voice Consistency Test
      </h4>
      <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#374151' }}>
        Test voice consistency across different phrases to identify variations.
      </p>
      
      <div style={{ marginBottom: '1rem' }}>
        <strong>Current Settings:</strong>
        <pre style={{ 
          background: 'rgba(0,0,0,0.05)', 
          padding: '0.5rem', 
          borderRadius: '4px',
          fontSize: '0.8rem',
          margin: '0.5rem 0'
        }}>
          {JSON.stringify(voiceSettings, null, 2)}
        </pre>
      </div>
      
      <button
        onClick={isPlaying ? stopTest : testVoiceConsistency}
        style={{
          background: isPlaying ? '#ef4444' : '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          padding: '0.5rem 1rem',
          cursor: 'pointer',
          fontSize: '0.9rem'
        }}
      >
        {isPlaying ? 'Stop Test' : 'Start Voice Consistency Test'}
      </button>
      
      {currentTest && (
        <div style={{
          marginTop: '0.5rem',
          fontSize: '0.8rem',
          color: '#059669'
        }}>
          🔄 {currentTest}
        </div>
      )}
      
      {testResults.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <strong>Test Results:</strong>
          <div style={{ 
            maxHeight: '200px', 
            overflowY: 'auto',
            background: 'rgba(0,0,0,0.05)',
            padding: '0.5rem',
            borderRadius: '4px',
            marginTop: '0.5rem'
          }}>
            {testResults.map((result, index) => (
              <div key={index} style={{
                marginBottom: '0.5rem',
                padding: '0.5rem',
                background: 'white',
                borderRadius: '4px',
                border: result.success ? '1px solid #10b981' : '1px solid #ef4444'
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                  {result.success ? '✅' : '❌'} Phrase {index + 1}
                </div>
                <div style={{ fontSize: '0.8rem', marginBottom: '0.25rem' }}>
                  "{result.phrase}"
                </div>
                <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>
                  {result.timestamp}
                </div>
                {result.error && (
                  <div style={{ fontSize: '0.7rem', color: '#ef4444', marginTop: '0.25rem' }}>
                    Error: {result.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#6b7280' }}>
        <strong>Tips for better voice consistency:</strong>
        <ul style={{ margin: '0.5rem 0 0 0', paddingLeft: '1rem' }}>
          <li>Use consistent voice settings across all requests</li>
          <li>Maintain the same conversation ID for related audio</li>
          <li>Use the same model (eleven_turbo_v2_5) for all requests</li>
          <li>Avoid changing settings mid-conversation</li>
        </ul>
      </div>
    </div>
  );
} 