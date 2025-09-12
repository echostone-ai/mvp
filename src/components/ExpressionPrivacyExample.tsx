/**
 * Expression Privacy Example Component
 * 
 * Example component demonstrating how to integrate expression privacy controls
 * with voice conversations and respect user settings.
 * 
 * Requirements: 6.1, 6.5
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useExpressionPrivacy } from '../lib/hooks/useExpressionPrivacy';
import { ExpressionPrivacySettings } from './ExpressionPrivacySettings';
import { globalSessionExpressionManager } from '../lib/sessionExpressionManager';
import { StreamingAudioManager } from '../lib/streamingUtils';
import { setupUserExpressions } from '../lib/voiceExpressionIntegration';

interface ExpressionPrivacyExampleProps {
  userId: string;
  voiceId: string;
}

export function ExpressionPrivacyExample({ userId, voiceId }: ExpressionPrivacyExampleProps) {
  const { expressionsEnabled, settings, isLoading } = useExpressionPrivacy();
  const [audioManager, setAudioManager] = useState<StreamingAudioManager | null>(null);
  const [conversationActive, setConversationActive] = useState(false);

  // Initialize audio manager and session manager
  useEffect(() => {
    if (!userId || !voiceId) return;

    const manager = new (StreamingAudioManager as any)(voiceId);
    setAudioManager(manager);

    // Initialize session expression manager
    globalSessionExpressionManager.initialize(userId, manager);

    return () => {
      globalSessionExpressionManager.stop();
    };
  }, [userId, voiceId]);

  // Start conversation with expressions
  const startConversation = async () => {
    if (!audioManager || !userId) return;

    try {
      // Set up user expressions with privacy settings respected
      const result = await setupUserExpressions(audioManager, userId);
      
      // Start session manager
      await globalSessionExpressionManager.start();
      
      setConversationActive(true);
      
      console.log('Conversation started with expressions:', result.success);
      console.log('Expression count:', result.expressionCount);
    } catch (error) {
      console.error('Failed to start conversation:', error);
    }
  };

  // Stop conversation
  const stopConversation = () => {
    globalSessionExpressionManager.stop();
    setConversationActive(false);
  };

  // Handle privacy settings change
  const handlePrivacyChange = (enabled: boolean) => {
    console.log('Expression privacy changed:', enabled);
    
    if (conversationActive) {
      // Privacy settings will be automatically picked up by session manager
      console.log('Privacy change will take effect during conversation');
    }
  };

  // Quick session controls
  const disableForSession = async () => {
    const success = await globalSessionExpressionManager.disableForSession();
    console.log('Session disable result:', success);
  };

  const enableForSession = async () => {
    const success = await globalSessionExpressionManager.enableForSession();
    console.log('Session enable result:', success);
  };

  if (isLoading) {
    return <div>Loading privacy settings...</div>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px' }}>
      <h2>Expression Privacy Example</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <h3>Current Status</h3>
        <p>Expressions Enabled: <strong>{expressionsEnabled ? 'Yes' : 'No'}</strong></p>
        <p>Conversation Active: <strong>{conversationActive ? 'Yes' : 'No'}</strong></p>
        {settings?.sessionDisabled && (
          <p style={{ color: 'orange' }}>
            Session temporarily disabled since {new Date(settings.sessionDisabledAt || 0).toLocaleTimeString()}
          </p>
        )}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>Conversation Controls</h3>
        <button 
          onClick={startConversation} 
          disabled={conversationActive}
          style={{ marginRight: '10px' }}
        >
          Start Conversation
        </button>
        <button 
          onClick={stopConversation} 
          disabled={!conversationActive}
        >
          Stop Conversation
        </button>
      </div>

      {conversationActive && (
        <div style={{ marginBottom: '20px' }}>
          <h3>Session Controls</h3>
          <p>These controls work during active conversations:</p>
          <button 
            onClick={disableForSession}
            style={{ marginRight: '10px' }}
          >
            Disable for This Session
          </button>
          <button 
            onClick={enableForSession}
          >
            Enable for This Session
          </button>
        </div>
      )}

      <div style={{ marginBottom: '20px' }}>
        <h3>Privacy Settings</h3>
        <ExpressionPrivacySettings 
          onSettingsChange={handlePrivacyChange}
        />
      </div>

      <div style={{ marginTop: '30px', padding: '15px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
        <h4>How It Works</h4>
        <ul>
          <li><strong>Global Settings:</strong> Control whether expressions are enabled for your account</li>
          <li><strong>Session Controls:</strong> Temporarily disable expressions for the current conversation</li>
          <li><strong>Automatic Monitoring:</strong> Changes to privacy settings are detected and applied during conversations</li>
          <li><strong>Graceful Degradation:</strong> TTS continues working normally when expressions are disabled</li>
        </ul>
      </div>
    </div>
  );
}