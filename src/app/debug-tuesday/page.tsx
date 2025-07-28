'use client';

import { useEffect, useState } from 'react';

export default function DebugTuesdayPage() {
  const [debugData, setDebugData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDebugData = async () => {
      try {
        const response = await fetch('/api/debug-avatar-onboarding?avatarName=Tuesday');
        const data = await response.json();
        setDebugData(data);
      } catch (error) {
        console.error('Error fetching debug data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDebugData();
  }, []);

  if (loading) {
    return <div style={{ padding: '20px' }}>Loading debug data...</div>;
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Tuesday Debug Data</h1>
      <pre style={{ background: '#f5f5f5', padding: '20px', overflow: 'auto' }}>
        {JSON.stringify(debugData, null, 2)}
      </pre>
    </div>
  );
}