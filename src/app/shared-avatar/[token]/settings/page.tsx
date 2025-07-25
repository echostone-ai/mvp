'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import SharedAvatarNavigation from '@/components/SharedAvatarNavigation';
// CSS is imported in the layout file

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
    <div className="hub-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', justifyContent: 'center' }}>
      <div style={{ maxWidth: 540, width: '100%', margin: '2rem auto', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', borderRadius: 16, padding: '2.5rem 2rem', background: 'rgba(30,30,60,0.95)' }}>
        <Link href={`/shared-avatar/${shareToken}/chat${userEmail ? `?userEmail=${encodeURIComponent(userEmail)}` : ''}`} className="back-link" style={{ display: 'block', textAlign: 'center', marginBottom: 24, color: '#9b7cff', fontWeight: 500 }}>
          &larr; Back to Chat
        </Link>
        <div className="avatar-header" style={{ textAlign: 'center' }}>
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