'use client';

import React, { useState, useRef } from 'react';
import { createImprovedStreamingAudioManager, stopAllImprovedAudio } from '@/lib/improvedStreamingUtils';
import { getNaturalVoiceSettings } from '@/lib/naturalVoiceSettings';

export default function StreamingTest() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [testText, setTestText] = useState('Hello! This is a test of the improved streaming voice system. The first sentence should not be missing, and all sentences should be spoken clearly. This is the third sentence to verify everything works properly.');
  const streamingRef = useRef<any>(null);

  const testStreaming = async () => {
    if (isPlaying) {
      if (streamingRef.current) {
        streamingRef.current.stop();
      }
      await stopAllImprovedAudio();
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);

    // Initialize improved streaming manager
    const voiceId = 'CO6pxVrMZfyL61ZIglyr'; // Use the same voice ID
    const settings = getNaturalVoiceSettings();
    
    streamingRef.current = createImprovedStreamingAudioManager(
      voiceId,
      settings,
      undefined,
      { conversationId: 'streaming-test' }
    );

    // Split text into sentences and add them
    const sentences = testText.split(/(?<=[.!?])\s+/);
    
    console.log(`[StreamingTest] Testing with ${sentences.length} sentences`);
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      if (sentence) {
        console.log(`[StreamingTest] Adding sentence ${i + 1}: "${sentence.substring(0, 30)}..."`);
        await streamingRef.current.addText(sentence, i === sentences.length - 1);
        
        // Small delay between sentences for testing
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Flush any remaining text
    await streamingRef.current.flush();
    
    setIsPlaying(false);
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
        🎵 Test Improved Streaming Voice
      </h4>
      <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#374151' }}>
        Test the improved streaming voice system. This should fix the missing first sentence and ensure all sentences are spoken.
      </p>
      
      <textarea
        value={testText}
        onChange={(e) => setTestText(e.target.value)}
        style={{
          width: '100%',
          minHeight: '100px',
          padding: '0.5rem',
          borderRadius: '4px',
          border: '1px solid #d1d5db',
          marginBottom: '1rem',
          fontSize: '0.9rem'
        }}
        placeholder="Enter text to test streaming..."
      />
      
      <button
        onClick={testStreaming}
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
        {isPlaying ? 'Stop Test' : 'Start Test'}
      </button>
      
      {isPlaying && (
        <div style={{
          marginTop: '0.5rem',
          fontSize: '0.8rem',
          color: '#059669'
        }}>
          🔊 Playing audio...
        </div>
      )}
    </div>
  );
} 