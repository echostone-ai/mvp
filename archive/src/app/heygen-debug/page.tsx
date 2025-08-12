'use client';

import { useState } from 'react';

export default function HeyGenDebug() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const testConnection = async () => {
    setLoading(true);
    setResult(null);
    
    try {
      // Test token creation
      const tokenResponse = await fetch('/api/heygen/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      const tokenResult = await tokenResponse.json();
      
      setResult({
        tokenTest: {
          success: tokenResponse.ok,
          status: tokenResponse.status,
          data: tokenResult
        }
      });
      
    } catch (error) {
      setResult({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  const closeAllSessions = async () => {
    setLoading(true);
    
    try {
      const response = await fetch('/api/heygen/close-all-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      const result = await response.json();
      setResult({
        cleanup: {
          success: response.ok,
          status: response.status,
          data: result
        }
      });
      
    } catch (error) {
      setResult({
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>HeyGen Debug Tools</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <h2>Current Issue: Concurrent Limit Reached</h2>
        <p>Your HeyGen account has hit the concurrent session limit. This usually means:</p>
        <ul>
          <li>You have sessions that weren't properly closed</li>
          <li>You're on a free/basic plan with limited concurrent sessions</li>
          <li>Multiple browser tabs are trying to connect simultaneously</li>
        </ul>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button 
          onClick={testConnection}
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Testing...' : 'Test HeyGen Connection'}
        </button>
        
        <button 
          onClick={closeAllSessions}
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: '#f56565',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Cleaning...' : 'Close All Sessions'}
        </button>
      </div>

      {result && (
        <div style={{
          padding: '15px',
          backgroundColor: '#f5f5f5',
          borderRadius: '5px',
          marginTop: '20px'
        }}>
          <h3>Result:</h3>
          <pre style={{ 
            whiteSpace: 'pre-wrap', 
            fontSize: '12px',
            overflow: 'auto'
          }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}

      <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#fff3cd', borderRadius: '5px' }}>
        <h3>Solutions:</h3>
        <ol>
          <li><strong>Wait 5-10 minutes</strong> - Sessions may timeout automatically</li>
          <li><strong>Close browser tabs</strong> - Make sure only one tab is using the avatar</li>
          <li><strong>Use the "Close All Sessions" button above</strong></li>
          <li><strong>Check your HeyGen dashboard</strong> - Look for active sessions</li>
          <li><strong>Upgrade your HeyGen plan</strong> - For more concurrent sessions</li>
        </ol>
      </div>
    </div>
  );
}