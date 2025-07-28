'use client';

import { useEffect, useState } from 'react';

export default function DebugThursdayPage() {
  const [debugData, setDebugData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDebugData = async () => {
      try {
        const response = await fetch('/api/debug-avatar-onboarding?avatarName=Thursday');
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
      <h1>Thursday Debug Data</h1>
      <pre style={{ background: '#f5f5f5', padding: '20px', overflow: 'auto' }}>
        {JSON.stringify(debugData, null, 2)}
      </pre>
      
      <h2>Analysis</h2>
      <div style={{ background: '#fff3cd', padding: '15px', marginTop: '20px' }}>
        <h3>Issues Found:</h3>
        <ul>
          <li><strong>Voice ID:</strong> {debugData?.debugInfo?.voiceId?.startsWith('voice_') ? '❌ Mock ID' : '✅ Real ElevenLabs ID'}</li>
          <li><strong>Profile Categories:</strong></li>
          <ul>
            <li>Memories: {debugData?.debugInfo?.profileDataSummary?.memories || 0}</li>
            <li>Influences: {debugData?.debugInfo?.profileDataSummary?.influences || 0}</li>
            <li>Passions: {debugData?.debugInfo?.profileDataSummary?.passions || 0}</li>
            <li>Places: {debugData?.debugInfo?.profileDataSummary?.places || 0}</li>
            <li>Philosophy: {debugData?.debugInfo?.profileDataSummary?.philosophy || 0}</li>
            <li>Creativity: {debugData?.debugInfo?.profileDataSummary?.creativity || 0}</li>
          </ul>
        </ul>
      </div>
    </div>
  );
}