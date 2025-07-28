'use client';

import { useState } from 'react';

export default function FixAvatarsPage() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fixAvatar = async (avatarName: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/fix-avatar-voices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarName })
      });
      
      const data = await response.json();
      setResults(prev => [...prev, { avatarName, ...data }]);
    } catch (error) {
      console.error('Error fixing avatar:', error);
      setResults(prev => [...prev, { avatarName, error: error.message }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Fix Avatar Voices</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <button 
          onClick={() => fixAvatar('Tuesday')}
          disabled={loading}
          style={{ 
            padding: '10px 20px', 
            marginRight: '10px',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px'
          }}
        >
          Fix Tuesday
        </button>
        
        <button 
          onClick={() => fixAvatar('Wednesday')}
          disabled={loading}
          style={{ 
            padding: '10px 20px',
            background: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px'
          }}
        >
          Fix Wednesday
        </button>
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