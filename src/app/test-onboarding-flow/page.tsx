'use client';

import { useState } from 'react';

export default function TestOnboardingFlowPage() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const resetAvatar = async (avatarName: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/reset-avatar-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarName })
      });
      
      const data = await response.json();
      setResults(prev => [...prev, { action: 'reset', avatarName, ...data }]);
    } catch (error) {
      console.error('Error resetting avatar:', error);
      setResults(prev => [...prev, { action: 'reset', avatarName, error: error.message }]);
    } finally {
      setLoading(false);
    }
  };

  const checkAvatar = async (avatarName: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/debug-avatar-onboarding?avatarName=${avatarName}`);
      const data = await response.json();
      setResults(prev => [...prev, { 
        action: 'check', 
        avatarName, 
        summary: {
          voiceId: data.debugInfo?.voiceId,
          isRealVoice: !data.debugInfo?.voiceId?.startsWith('voice_'),
          totalResponses: (data.debugInfo?.profileDataSummary?.factualInfo || 1) - 1,
          categories: data.debugInfo?.profileDataSummary
        }
      }]);
    } catch (error) {
      console.error('Error checking avatar:', error);
      setResults(prev => [...prev, { action: 'check', avatarName, error: error.message }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Test Onboarding Flow</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <h3>Step 1: Reset Avatar</h3>
        <button 
          onClick={() => resetAvatar('Friday')}
          disabled={loading}
          style={{ 
            padding: '10px 20px',
            marginRight: '10px',
            background: '#ffc107',
            color: 'black',
            border: 'none',
            borderRadius: '4px'
          }}
        >
          Reset Friday
        </button>
        
        <h3>Step 2: Check Avatar Status</h3>
        <button 
          onClick={() => checkAvatar('Friday')}
          disabled={loading}
          style={{ 
            padding: '10px 20px',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px'
          }}
        >
          Check Friday
        </button>
      </div>

      <div style={{ background: '#e7f3ff', padding: '15px', marginBottom: '20px' }}>
        <h3>Testing Instructions:</h3>
        <ol>
          <li>Click "Reset Friday" to clear all data</li>
          <li>Go to the onboarding flow and create Friday again</li>
          <li>Watch the console logs carefully during onboarding</li>
          <li>Answer multiple questions (don't click "Save and Continue Later" after just one)</li>
          <li>Come back here and click "Check Friday" to see the results</li>
        </ol>
        
        <p><strong>Expected Results:</strong></p>
        <ul>
          <li>Multiple responses (not just 1)</li>
          <li>Correct categorization (travel → places, philosophy → philosophy)</li>
          <li>Real ElevenLabs voice ID</li>
          <li>No repeated questions</li>
        </ul>
      </div>

      {results.length > 0 && (
        <div>
          <h2>Results:</h2>
          <pre style={{ background: '#f5f5f5', padding: '20px', overflow: 'auto' }}>
            {JSON.stringify(results, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}