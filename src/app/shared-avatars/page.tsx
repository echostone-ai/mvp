'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import '@/styles/legacy-hub.css';

interface SharedAvatar {
  id: string;
  shareToken: string;
  avatar: {
    id: string;
    name: string;
    description: string;
    hasVoice: boolean;
    voiceId: string | null;
  };
  ownerEmail: string;
  permissions: string[];
  sharedAt: string;
  lastInteraction: string;
  conversationCount: number;
}

export default function SharedAvatarsPage() {
  const [sharedAvatars, setSharedAvatars] = useState<SharedAvatar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch shared avatars
  useEffect(() => {
    async function fetchSharedAvatars() {
      try {
        // In a real app, get the current user's email from auth
        const userEmail = 'current-user@example.com';
        
        const response = await fetch('/api/avatar-sharing', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'get-shared-avatars',
            userEmail
          })
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch shared avatars');
        }
        
        const data = await response.json();
        setSharedAvatars(data.sharedAvatars || []);
        setLoading(false);
      } catch (err) {
        setError('Failed to load shared avatars');
        setLoading(false);
      }
    }

    fetchSharedAvatars();
  }, []);

  if (loading) {
    return (
      <div className="hub-container">
        <div className="loading-spinner"></div>
        <p className="loading-text">Loading shared avatars...</p>
      </div>
    );
  }

  return (
    <div className="hub-container">
      <h1 className="hub-title">Shared Avatars</h1>
      <p className="hub-description">
        Avatars that have been shared with you by other users.
      </p>

      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {sharedAvatars.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">👤</div>
          <h3 className="empty-state-title">No Shared Avatars</h3>
          <p className="empty-state-message">
            You don't have any avatars shared with you yet. When someone shares their avatar with you, it will appear here.
          </p>
        </div>
      ) : (
        <div className="hub-list">
          {sharedAvatars.map((sharedAvatar) => (
            <Link 
              href={`/shared-avatar/${sharedAvatar.shareToken}`} 
              key={sharedAvatar.id} 
              className="hub-card"
            >
              <div className="hub-card-header">
                <h3 className="hub-card-title">{sharedAvatar.avatar.name}</h3>
                <span className={`hub-card-badge ${sharedAvatar.avatar.hasVoice ? 'hub-card-badge-published' : 'hub-card-badge-draft'}`}>
                  {sharedAvatar.avatar.hasVoice ? 'Has Voice' : 'No Voice'}
                </span>
              </div>
              
              <p className="hub-card-description">
                {sharedAvatar.avatar.description || `Chat with ${sharedAvatar.avatar.name}, shared by ${sharedAvatar.ownerEmail}`}
              </p>
              
              <div className="hub-card-stats">
                <span>{sharedAvatar.conversationCount} conversations</span>
                <span>Shared {new Date(sharedAvatar.sharedAt).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}