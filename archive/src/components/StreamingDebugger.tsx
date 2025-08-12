'use client';

import React, { useState, useEffect } from 'react';

interface StreamingDebuggerProps {
  isStreaming: boolean;
  currentText: string;
  segments: string[];
}

export default function StreamingDebugger({ isStreaming, currentText, segments }: StreamingDebuggerProps) {
  const [debugInfo, setDebugInfo] = useState<any>({});

  useEffect(() => {
    if (isStreaming) {
      setDebugInfo({
        timestamp: new Date().toISOString(),
        textLength: currentText.length,
        segmentCount: segments.length,
        lastSegment: segments[segments.length - 1] || 'None',
        hasIncompleteSentences: segments.some(s => !s.endsWith('.') && !s.endsWith('!') && !s.endsWith('?')),
        hasEllipsis: segments.some(s => s.includes('...')),
        hasShortSegments: segments.some(s => s.length < 8),
        hasSingleWordSegments: segments.some(s => s.split(' ').length <= 2)
      });
    }
  }, [isStreaming, currentText, segments]);

  if (!isStreaming) return null;

  return (
    <div style={{
      background: 'rgba(239, 68, 68, 0.1)',
      border: '1px solid rgba(239, 68, 68, 0.3)',
      borderRadius: '8px',
      padding: '1rem',
      margin: '1rem 0',
      fontSize: '0.8rem'
    }}>
      <h4 style={{ margin: '0 0 0.5rem 0', color: '#dc2626' }}>
        🔍 Streaming Debug Info
      </h4>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
        <div>
          <strong>Text Length:</strong> {debugInfo.textLength}
        </div>
        <div>
          <strong>Segments:</strong> {debugInfo.segmentCount}
        </div>
        <div>
          <strong>Last Segment:</strong> {debugInfo.lastSegment?.substring(0, 30)}...
        </div>
        <div>
          <strong>Timestamp:</strong> {debugInfo.timestamp}
        </div>
      </div>

      <div style={{ marginTop: '0.5rem' }}>
        <strong>Issues Detected:</strong>
        <ul style={{ margin: '0.25rem 0 0 0', paddingLeft: '1rem' }}>
          {debugInfo.hasIncompleteSentences && (
            <li style={{ color: '#dc2626' }}>❌ Incomplete sentences (missing punctuation)</li>
          )}
          {debugInfo.hasEllipsis && (
            <li style={{ color: '#dc2626' }}>❌ Ellipsis fragments detected</li>
          )}
          {debugInfo.hasShortSegments && (
            <li style={{ color: '#dc2626' }}>❌ Short segments (&lt;8 chars)</li>
          )}
          {debugInfo.hasSingleWordSegments && (
            <li style={{ color: '#dc2626' }}>❌ Single word segments</li>
          )}
          {!debugInfo.hasIncompleteSentences && !debugInfo.hasEllipsis && !debugInfo.hasShortSegments && !debugInfo.hasSingleWordSegments && (
            <li style={{ color: '#059669' }}>✅ No issues detected</li>
          )}
        </ul>
      </div>

      <div style={{ marginTop: '0.5rem' }}>
        <strong>Recent Segments:</strong>
        <div style={{ 
          maxHeight: '100px', 
          overflowY: 'auto', 
          background: 'rgba(0,0,0,0.05)', 
          padding: '0.25rem',
          borderRadius: '4px',
          fontSize: '0.75rem'
        }}>
          {segments.slice(-5).map((segment, index) => (
            <div key={index} style={{ 
              marginBottom: '0.25rem',
              padding: '0.25rem',
              background: 'white',
              borderRadius: '2px',
              border: segment.length < 8 ? '1px solid #dc2626' : '1px solid #d1d5db'
            }}>
              {segment.substring(0, 50)}...
              {segment.length < 8 && <span style={{ color: '#dc2626', marginLeft: '0.5rem' }}>(Too short)</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 