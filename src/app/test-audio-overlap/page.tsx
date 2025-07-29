'use client'

import React, { useState, useRef } from 'react';
import { createStreamingAudioManager, stopAllAudio } from '@/lib/streamingUtils';
import { globalAudioManager } from '@/lib/globalAudioManager';

export default function TestAudioOverlap() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);
  const streamingAudioRef = useRef<any>(null);

  const addTestResult = (result: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
  };

  const testStreamingAudio = async () => {
    addTestResult('Starting streaming audio test...');
    
    if (!process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID) {
      addTestResult('❌ No voice ID configured');
      return;
    }

    try {
      streamingAudioRef.current = createStreamingAudioManager(
        process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID
      );

      // Send multiple sentences rapidly to test overlap prevention
      const sentences = [
        'This is the first sentence.',
        'Here comes the second sentence.',
        'And now the third sentence.',
        'Finally, the fourth sentence.'
      ];

      for (const sentence of sentences) {
        addTestResult(`Sending: "${sentence}"`);
        streamingAudioRef.current.addSentence(sentence);
        await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between sentences
      }

      addTestResult('✅ Streaming audio test completed');
    } catch (error) {
      addTestResult(`❌ Streaming audio test failed: ${error}`);
    }
  };

  const testRegularAudio = async () => {
    addTestResult('Starting regular audio test...');
    
    try {
      const response = await fetch('/api/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: 'This is a regular audio test to check for overlaps.',
          voiceId: process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        
        setIsPlaying(true);
        await globalAudioManager.playAudio(audio);
        setIsPlaying(false);
        
        URL.revokeObjectURL(url);
        addTestResult('✅ Regular audio test completed');
      } else {
        addTestResult('❌ Regular audio test failed - API error');
      }
    } catch (error) {
      addTestResult(`❌ Regular audio test failed: ${error}`);
      setIsPlaying(false);
    }
  };

  const testOverlapPrevention = async () => {
    addTestResult('Testing overlap prevention...');
    
    // Start streaming audio
    testStreamingAudio();
    
    // Wait a bit then try to play regular audio (should stop streaming)
    setTimeout(() => {
      addTestResult('Attempting to play regular audio while streaming...');
      testRegularAudio();
    }, 2000);
  };

  const stopAllAudioTest = async () => {
    addTestResult('Stopping all audio...');
    await stopAllAudio();
    if (streamingAudioRef.current) {
      streamingAudioRef.current.stop();
    }
    setIsPlaying(false);
    addTestResult('✅ All audio stopped');
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Audio Overlap Test Page</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={testStreamingAudio}
          style={{ margin: '5px', padding: '10px 15px', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px' }}
        >
          Test Streaming Audio
        </button>
        
        <button 
          onClick={testRegularAudio}
          disabled={isPlaying}
          style={{ margin: '5px', padding: '10px 15px', backgroundColor: '#2196F3', color: 'white', border: 'none', borderRadius: '5px' }}
        >
          Test Regular Audio
        </button>
        
        <button 
          onClick={testOverlapPrevention}
          style={{ margin: '5px', padding: '10px 15px', backgroundColor: '#FF9800', color: 'white', border: 'none', borderRadius: '5px' }}
        >
          Test Overlap Prevention
        </button>
        
        <button 
          onClick={stopAllAudioTest}
          style={{ margin: '5px', padding: '10px 15px', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '5px' }}
        >
          Stop All Audio
        </button>
        
        <button 
          onClick={clearResults}
          style={{ margin: '5px', padding: '10px 15px', backgroundColor: '#9E9E9E', color: 'white', border: 'none', borderRadius: '5px' }}
        >
          Clear Results
        </button>
      </div>

      <div style={{ 
        backgroundColor: '#f5f5f5', 
        padding: '15px', 
        borderRadius: '5px', 
        maxHeight: '400px', 
        overflowY: 'auto',
        fontFamily: 'monospace',
        fontSize: '14px'
      }}>
        <h3>Test Results:</h3>
        {testResults.length === 0 ? (
          <p>No tests run yet. Click a button above to start testing.</p>
        ) : (
          testResults.map((result, index) => (
            <div key={index} style={{ marginBottom: '5px' }}>
              {result}
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#e3f2fd', borderRadius: '5px' }}>
        <h3>What This Tests:</h3>
        <ul>
          <li><strong>Streaming Audio:</strong> Tests rapid sentence queuing and playback</li>
          <li><strong>Regular Audio:</strong> Tests single audio file playback</li>
          <li><strong>Overlap Prevention:</strong> Tests that new audio stops existing audio</li>
          <li><strong>Stop All:</strong> Tests emergency stop functionality</li>
        </ul>
        
        <h3>Expected Behavior:</h3>
        <ul>
          <li>No audio should overlap or play simultaneously</li>
          <li>New audio should immediately stop any playing audio</li>
          <li>Streaming sentences should queue properly without overlap</li>
          <li>Stop All should immediately silence everything</li>
        </ul>
      </div>
    </div>
  );
}