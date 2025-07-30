'use client';

import React, { useState, useRef } from 'react';
import { createSeamlessStreamingManager, stopAllSeamlessAudio } from '@/lib/seamlessStreamingUtils';

export default function SeamlessStreamingTest() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [testText, setTestText] = useState('Hello! This is a test of the seamless streaming voice system. The first sentence should start immediately, and all sentences should be spoken completely without cutting off. This is the third sentence to verify everything works properly.');
  const streamingRef = useRef<any>(null);

  const testStreaming = async () => {
    if (isPlaying) {
      if (streamingRef.current) {
        streamingRef.current.stop();
      }
      await stopAllSeamlessAudio();
      setIsPlaying(false);
      return;
    }

    setIsPlaying(true);

    // Initialize seamless streaming manager
    const voiceId = 'CO6pxVrMZfyL61ZIglyr';
    const settings = {
      stability: 0.90,
      similarity_boost: 0.90,
      style: 0.10,
      use_speaker_boost: true
    };
    
    streamingRef.current = createSeamlessStreamingManager(
      voiceId,
      settings,
      { conversationId: 'seamless-test' }
    );

    // Add text in chunks to simulate streaming
    const sentences = testText.split(/(?<=[.!?])\s+/);
    
    console.log(`[SeamlessTest] Testing with ${sentences.length} sentences`);
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      if (sentence) {
        console.log(`[SeamlessTest] Adding sentence ${i + 1}: "${sentence.substring(0, 30)}..."`);
        await streamingRef.current.addText(sentence);
        
        // Small delay to simulate streaming
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Complete the streaming
    await streamingRef.current.complete();
    
    setIsPlaying(false);
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
        🚀 Test Seamless Streaming Voice
      </h4>
      <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#374151' }}>
        Test the new seamless streaming voice system. This should provide fast, consistent voice with no cutting off.
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
        placeholder="Enter text to test seamless streaming..."
      />
      
      <button
        onClick={testStreaming}
        style={{
          background: isPlaying ? '#ef4444' : '#22c55e',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          padding: '0.5rem 1rem',
          cursor: 'pointer',
          fontSize: '0.9rem'
        }}
      >
        {isPlaying ? 'Stop Test' : 'Start Seamless Test'}
      </button>
      
      {isPlaying && (
        <div style={{
          marginTop: '0.5rem',
          fontSize: '0.8rem',
          color: '#059669'
        }}>
          🔊 Playing seamless audio...
        </div>
      )}
    </div>
  );
} 