import StreamingTest from '@/components/StreamingTest';
import SeamlessStreamingTest from '@/components/SeamlessStreamingTest';

export default function TestStreamingPage() {
  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '2rem', color: '#1e40af' }}>
        🎵 Streaming Voice Test Page
      </h1>
      
      <p style={{ marginBottom: '2rem', color: '#374151' }}>
        This page allows you to test the improved streaming voice system. The improvements should fix:
      </p>
      
      <ul style={{ marginBottom: '2rem', color: '#374151' }}>
        <li>✅ Missing first sentence</li>
        <li>✅ Incomplete speech</li>
        <li>✅ Better text processing</li>
        <li>✅ More responsive streaming</li>
      </ul>
      
      <SeamlessStreamingTest />
      
      <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(156, 163, 175, 0.1)', borderRadius: '8px' }}>
        <h3 style={{ marginBottom: '1rem', color: '#374151' }}>Legacy Streaming Test (for comparison)</h3>
        <StreamingTest />
      </div>
      
      <div style={{
        background: 'rgba(34, 197, 94, 0.1)',
        border: '1px solid rgba(34, 197, 94, 0.3)',
        borderRadius: '8px',
        padding: '1rem',
        marginTop: '2rem'
      }}>
        <h3 style={{ margin: '0 0 0.5rem 0', color: '#166534' }}>Test Instructions:</h3>
        <ol style={{ margin: '0', paddingLeft: '1rem', color: '#166534' }}>
          <li>Enter or modify the test text above</li>
          <li>Click "Start Test" to begin streaming</li>
          <li>Listen for the first sentence to start immediately</li>
          <li>Verify all sentences are spoken completely</li>
          <li>Check the browser console for detailed logs</li>
        </ol>
      </div>
    </div>
  );
} 