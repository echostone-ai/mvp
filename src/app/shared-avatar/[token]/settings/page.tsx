'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import SharedAvatarNavigation from '@/components/SharedAvatarNavigation';
import '@/styles/legacy-hub.css';
import '@/styles/avatar-sharing.css';

export default function SharedAvatarSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const shareToken = params.token as string;
  const userEmail = searchParams.get('userEmail');
  
  const [sharedAvatar, setSharedAvatar] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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

  const handleDeleteAllData = async () => {
    if (!confirm('Are you sure you want to delete all your conversations and memories with this avatar? This cannot be undone.')) {
      return;
    }
    
    setIsDeleting(true);
    setError(null);
    
    try {
      // Delete conversations
      await fetch('/api/private-conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'delete-all',
          userId,
          shareToken
        })
      });
      
      // Delete memories
      await fetch('/api/private-memories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'delete-all',
          userId,
          shareToken
        })
      });
      
      setSuccessMessage('All your data has been deleted successfully.');
    } catch (err: any) {
      setError(err.message || 'Failed to delete data');
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="hub-container">
        <div className="loading-spinner"></div>
        <p className="loading-text">Loading settings...</p>
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

  return (
    <div className="hub-container">
      <Link href={`/shared-avatar/${shareToken}/chat${userEmail ? `?userEmail=${encodeURIComponent(userEmail)}` : ''}`} className="back-link">
        &larr; Back to Chat
      </Link>

      <div className="avatar-header">
        <div className="avatar-title-section">
          <h1 className="avatar-title">Settings</h1>
        </div>
        <p className="avatar-description">
          Manage your settings for {avatar.name}
        </p>
      </div>

      {userId && (
        <SharedAvatarNavigation 
          shareToken={shareToken} 
          userEmail={userEmail || undefined}
          permissions={sharedAvatar.permissions}
        />
      )}

      {error && <div className="alert alert-error">{error}</div>}
      {successMessage && <div className="alert alert-success">{successMessage}</div>}

      <div className="settings-sections">
        <div className="settings-section">
          <h2 className="settings-section-title">Avatar Information</h2>
          <div className="settings-content">
            <div className="info-item">
              <span className="info-label">Name:</span>
              <span className="info-value">{avatar.name}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Shared by:</span>
              <span className="info-value">{sharedAvatar.ownerEmail}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Voice:</span>
              <span className="info-value">{avatar.hasVoice ? 'Available' : 'Not available'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Permissions:</span>
              <span className="info-value">{sharedAvatar.permissions.join(', ')}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Expires:</span>
              <span className="info-value">{new Date(sharedAvatar.expiresAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        <div className="settings-section danger-zone">
          <h2 className="settings-section-title">Danger Zone</h2>
          <div className="settings-content">
            <div className="danger-action">
              <div className="danger-info">
                <h3>Delete All Your Data</h3>
                <p>This will permanently delete all your conversations and memories with this avatar.</p>
              </div>
              <button
                onClick={handleDeleteAllData}
                className="btn btn-danger"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete All Data'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}