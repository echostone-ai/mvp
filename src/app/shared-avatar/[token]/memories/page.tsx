'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import SharedAvatarMemories from '@/components/SharedAvatarMemories';
// CSS is imported in the layout file

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
    <div className="hub-container">
      <Link href={`/shared-avatar/${shareToken}/chat`} className="back-link">
        &larr; Back to Chat
      </Link>

      <div className="avatar-header">
        <div className="avatar-title-section">
          <h1 className="avatar-title">Memories with {avatar.name}</h1>
        </div>
        <p className="avatar-description">
          Your private memories with {avatar.name}. These memories help the avatar remember important information from your conversations.
        </p>
      </div>

      <div className="privacy-notice">
        <div className="privacy-card">
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
    </div>
  );
}