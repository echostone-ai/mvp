/**
 * Example component demonstrating useExpressionPack hook usage
 * This shows how to integrate the hook into a React component
 */

import React from 'react';
import { useExpressionPack } from '@/lib/hooks/useExpressionPack';

interface ExpressionPackExampleProps {
  userId: string;
  avatarId?: string;
}

export default function ExpressionPackExample({ userId, avatarId }: ExpressionPackExampleProps) {
  const { 
    pack, 
    isLoading, 
    error, 
    isReady, 
    preload, 
    cleanup, 
    getBuffer 
  } = useExpressionPack({
    ownerId: avatarId || userId,
    ownerType: avatarId ? 'avatar' : 'user',
    autoPreload: true, // Automatically preload on first user interaction
    maxConcurrentLoads: 3
  });

  const handleManualPreload = () => {
    preload();
  };

  const handleCleanup = () => {
    cleanup();
  };

  const handleTestBuffer = () => {
    if (pack && pack.clips.length > 0) {
      const firstClip = pack.clips[0];
      const buffer = getBuffer(firstClip.id);
      console.log('Buffer for', firstClip.filename, ':', buffer);
    }
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', margin: '10px' }}>
      <h3>Expression Pack Status</h3>
      
      <div>
        <strong>Owner:</strong> {avatarId ? `Avatar ${avatarId}` : `User ${userId}`}
      </div>
      
      <div>
        <strong>Loading:</strong> {isLoading ? 'Yes' : 'No'}
      </div>
      
      <div>
        <strong>Ready:</strong> {isReady ? 'Yes' : 'No'}
      </div>
      
      <div>
        <strong>Error:</strong> {error || 'None'}
      </div>
      
      <div>
        <strong>Expressions Loaded:</strong> {pack?.clips.length || 0}
      </div>
      
      <div>
        <strong>Buffers Preloaded:</strong> {pack?.preloaded_buffers.size || 0}
      </div>

      {pack && pack.clips.length > 0 && (
        <div>
          <h4>Available Expressions:</h4>
          <ul>
            {pack.clips.map(clip => (
              <li key={clip.id}>
                {clip.filename} ({clip.type}) - {clip.duration_ms}ms
                {pack.preloaded_buffers.has(clip.id) ? ' ✓' : ' ⏳'}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ marginTop: '10px' }}>
        <button onClick={handleManualPreload} disabled={isLoading}>
          Manual Preload
        </button>
        
        <button onClick={handleTestBuffer} disabled={!isReady || !pack?.clips.length}>
          Test First Buffer
        </button>
        
        <button onClick={handleCleanup}>
          Cleanup
        </button>
      </div>
    </div>
  );
}