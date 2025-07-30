'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import PageShell from '@/components/PageShell';
// CSS is imported in the layout file

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
      <PageShell>
        <div className="hub-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading shared avatars...</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="hub-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', justifyContent: 'center' }}>
        <div style={{ maxWidth: 540, width: '100%', margin: '2rem auto', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', borderRadius: 16, padding: '2.5rem 2rem', background: 'rgba(30,30,60,0.95)' }}>
          <h1 className="hub-title" style={{ textAlign: 'center' }}>Shared Avatars</h1>
          <p className="hub-description" style={{ textAlign: 'center', marginBottom: 32 }}>
            Avatars that have been shared with you by other users.
          </p>
          {error && (
            <div className="alert alert-error" style={{ textAlign: 'center' }}>
              {error}
            </div>
          )}
          {sharedAvatars.length === 0 ? (
            <div className="empty-state" style={{ textAlign: 'center' }}>
              <div className="empty-state-icon" style={{ fontSize: 48 }}>
                👤
              </div>
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
                  style={{ display: 'block', margin: '1.5rem auto', maxWidth: 420, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', background: 'rgba(45,37,67,0.7)', padding: 24 }}
                >
                  <div className="hub-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 className="hub-card-title">{sharedAvatar.avatar.name}</h3>
                    <span className={`hub-card-badge ${sharedAvatar.avatar.hasVoice ? 'hub-card-badge-published' : 'hub-card-badge-draft'}`}>
                      {sharedAvatar.avatar.hasVoice ? 'Has Voice' : 'No Voice'}
                    </span>
                  </div>
                  <p className="hub-card-description" style={{ margin: '1rem 0' }}>
                    {sharedAvatar.avatar.description || `Chat with ${sharedAvatar.avatar.name}, shared by ${sharedAvatar.ownerEmail}`}
                  </p>
                  <div className="hub-card-stats" style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#b8b8d9' }}>
                    <span>{sharedAvatar.conversationCount} conversations</span>
                    <span>Shared {new Date(sharedAvatar.sharedAt).toLocaleDateString()}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
          <div style={{ marginTop: 40, textAlign: 'center' }}>
            <div style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: 8 }}>Want your own digital avatar?</div>
            <a
              href="https://app.echostone.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
              style={{ display: 'inline-block', margin: '0 auto', padding: '0.75rem 2rem', fontSize: '1.1rem', borderRadius: 8, background: 'linear-gradient(90deg, #9b7cff 60%, #6a00ff 100%)', color: '#fff', fontWeight: 600, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
            >
              Create Your Own Avatar
            </a>
          </div>
        </div>
      </div>
    </PageShell>
  );
}