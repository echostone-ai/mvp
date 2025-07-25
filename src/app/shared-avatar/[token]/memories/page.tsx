'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import SharedAvatarMemories from '@/components/SharedAvatarMemories';
import '@/styles/memories.css';

export default function SharedAvatarMemoriesPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const shareToken = params.token as string;
  const userEmail = searchParams.get('userEmail');
  
  const [sharedAvatar, setSharedAvatar] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Fetch shared avatar details and user info
  useEffect(() => {
    async function fetchData() {
      try {
        // In a real app, get the current user's ID from auth
        // For now, we'll use a mock user ID based on userEmail or localStorage
        let currentUserId = userEmail || localStorage.getItem('sharedAvatarUserId');
        if (!currentUserId) {
          currentUserId = `user-${Math.random().toString(36).substring(2, 9)}`;
          localStorage.setItem('sharedAvatarUserId', currentUserId);
        }
        setUserId(currentUserId);
        
        // Fetch shared avatar details
        const avatarResponse = await fetch(`/api/avatar-sharing?shareToken=${shareToken}`);
        
        if (!avatarResponse.ok) {
          throw new Error('Failed to fetch shared avatar details');
        }
        
        const avatarData = await avatarResponse.json();
        
        if (!avatarData.success || !avatarData.sharedAvatar || !avatarData.sharedAvatar.isValid) {
          throw new Error('This sharing link is invalid or has expired');
        }
        
        setSharedAvatar(avatarData.sharedAvatar);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Failed to load shared avatar');
        setLoading(false);
      }
    }

    fetchData();
  }, [shareToken, userEmail]);

  if (loading) {
    return (
      <div className="hub-container">
        <div className="loading-spinner"></div>
        <p className="loading-text">Loading shared avatar...</p>
      </div>
    );
  }

  if (error || !sharedAvatar) {
    return (
      <div className="hub-container">
        <div className="error-message">
          {error || 'Shared avatar not found'}
        </div>
        <Link href="/" className="btn btn-primary">
          Return to Home
        </Link>
      </div>
    );
  }

  const { avatar } = sharedAvatar;
  const canViewMemories = sharedAvatar.permissions.includes('viewMemories') || 
                         sharedAvatar.permissions.includes('createMemories');

  if (!canViewMemories) {
    return (
      <div className="hub-container">
        <Link href={`/shared-avatar/${shareToken}/chat`} className="back-link">
          &larr; Back to Chat
        </Link>

        <div className="error-message">
          You don't have permission to view or create memories for this avatar.
        </div>
      </div>
    );
  }

  return (
    <div className="hub-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', justifyContent: 'center' }}>
      <div style={{ maxWidth: 540, width: '100%', margin: '2rem auto', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', borderRadius: 16, padding: '2.5rem 2rem', background: 'rgba(30,30,60,0.95)' }}>
        <Link href={`/shared-avatar/${shareToken}/chat`} className="back-link" style={{ display: 'block', textAlign: 'center', marginBottom: 24, color: '#9b7cff', fontWeight: 500 }}>
          &larr; Back to Chat
        </Link>
        <div className="avatar-header" style={{ textAlign: 'center' }}>
          <div className="avatar-title-section">
            <h1 className="avatar-title">Memories with {avatar.name}</h1>
          </div>
          <p className="avatar-description">
            Your private memories with {avatar.name}. These memories help the avatar remember important information from your conversations.
          </p>
        </div>
        <div className="privacy-notice" style={{ margin: '1.5rem 0' }}>
          <div className="privacy-card" style={{ background: 'rgba(45,37,67,0.7)', borderRadius: 10, padding: 16 }}>
            <h3>🔒 Your Privacy</h3>
            <ul>
              <li>These memories are completely private to you</li>
              <li>The avatar owner cannot see your memories</li>
              <li>Memories help the avatar remember important details from your conversations</li>
            </ul>
          </div>
        </div>
        {userId && (
          <SharedAvatarMemories
            userId={userId}
            avatarId={avatar.id}
            shareToken={shareToken}
            avatarName={avatar.name}
          />
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
  );
}