'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function TestVoiceAuth() {
  const [authInfo, setAuthInfo] = useState<any>(null);
  const [testResult, setTestResult] = useState<any>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      setAuthInfo({
        hasSession: !!session,
        hasUser: !!session?.user,
        userId: session?.user?.id,
        email: session?.user?.email,
        error: error?.message
      });
    } catch (err) {
      setAuthInfo({
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  };

  const testAPI = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch('/api/improve-voice-consistency', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token && { 'Authorization': `Bearer ${session.access_token}` })
        },
        body: JSON.stringify({
          avatarId: 'test-avatar-id',
          voiceId: 'test-voice-id',
          improvementType: 'accent_consistency'
        }),
      });

      const data = await response.json();
      setTestResult({
        status: response.status,
        ok: response.ok,
        data
      });
    } catch (error) {
      setTestResult({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Voice Authentication Test</h1>
      
      <div style={{ marginBottom: '2rem' }}>
        <h2>Authentication Status</h2>
        <pre style={{ background: '#f5f5f5', padding: '1rem', borderRadius: '4px' }}>
          {JSON.stringify(authInfo, null, 2)}
        </pre>
        <button onClick={checkAuth} style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>
          Refresh Auth Status
        </button>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h2>API Test</h2>
        <button onClick={testAPI} style={{ padding: '0.5rem 1rem', marginBottom: '1rem' }}>
          Test Voice Improvement API
        </button>
        {testResult && (
          <pre style={{ background: '#f5f5f5', padding: '1rem', borderRadius: '4px' }}>
            {JSON.stringify(testResult, null, 2)}
          </pre>
        )}
      </div>

      <div>
        <h2>Instructions</h2>
        <ol>
          <li>Make sure you're signed in</li>
          <li>Check that "Authentication Status" shows a valid session</li>
          <li>Click "Test Voice Improvement API" to see if authentication works</li>
          <li>If it fails, try refreshing the page and testing again</li>
        </ol>
      </div>
    </div>
  );
}