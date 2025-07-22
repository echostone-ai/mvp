'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

interface AvatarSharingFormProps {
  avatarId: string;
  avatarName: string;
  ownerEmail: string;
}

export default function AvatarSharingForm({ avatarId, avatarName, ownerEmail }: AvatarSharingFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [permissions, setPermissions] = useState({
    chat: true,
    viewMemories: true,
    createMemories: true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [shareHistory, setShareHistory] = useState<any[]>([]);

  // Load existing shares when component mounts
  React.useEffect(() => {
    fetchShareHistory();
  }, [avatarId]);

  const fetchShareHistory = async () => {
    try {
      const response = await fetch(`/api/avatar-sharing?avatarId=${avatarId}&ownerEmail=${ownerEmail}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.shares) {
          setShareHistory(data.shares);
        }
      }
    } catch (error) {
      console.error('Failed to fetch share history:', error);
    }
  };

  const handlePermissionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setPermissions(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    if (!email.trim()) {
      setError('Please enter a valid email address');
      setLoading(false);
      return;
    }

    try {
      // Convert permissions object to array of strings
      const permissionsArray = Object.entries(permissions)
        .filter(([_, value]) => value)
        .map(([key, _]) => key);

      const response = await fetch('/api/avatar-sharing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'create-share',
          avatarId,
          ownerEmail,
          shareWithEmail: email,
          permissions: permissionsArray
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to share avatar');
      }

      setSuccessMessage(`Avatar successfully shared with ${email}! An invitation email will be sent.`);
      setEmail('');
      
      // Refresh share history
      fetchShareHistory();
    } catch (error: any) {
      setError(error.message || 'An error occurred while sharing the avatar');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeAccess = async (shareId: string) => {
    if (!confirm('Are you sure you want to revoke access? This cannot be undone.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/avatar-sharing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'revoke-share',
          shareId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to revoke access');
      }

      // Refresh share history
      fetchShareHistory();
      setSuccessMessage('Access successfully revoked');
    } catch (error: any) {
      setError(error.message || 'An error occurred while revoking access');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="avatar-sharing-container">
      <h2 className="section-title">Share {avatarName} with Others</h2>
      <p className="section-description">
        Share your avatar with friends and family. Each person will have their own private conversations and memories with your avatar.
      </p>

      {error && <div className="alert alert-error">{error}</div>}
      {successMessage && <div className="alert alert-success">{successMessage}</div>}

      <form onSubmit={handleSubmit} className="sharing-form">
        <div className="form-group">
          <label htmlFor="email" className="form-label">Email Address</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="form-input"
            placeholder="Enter email address"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Permissions</label>
          <div className="permissions-options">
            <div className="form-checkbox">
              <input
                type="checkbox"
                id="chat"
                name="chat"
                checked={permissions.chat}
                onChange={handlePermissionChange}
              />
              <label htmlFor="chat">
                Chat with Avatar
                <span className="permission-description">Allow this person to have conversations with your avatar</span>
              </label>
            </div>
            
            <div className="form-checkbox">
              <input
                type="checkbox"
                id="viewMemories"
                name="viewMemories"
                checked={permissions.viewMemories}
                onChange={handlePermissionChange}
              />
              <label htmlFor="viewMemories">
                View Shared Memories
                <span className="permission-description">Allow this person to see memories you've explicitly shared</span>
              </label>
            </div>
            
            <div className="form-checkbox">
              <input
                type="checkbox"
                id="createMemories"
                name="createMemories"
                checked={permissions.createMemories}
                onChange={handlePermissionChange}
              />
              <label htmlFor="createMemories">
                Create Private Memories
                <span className="permission-description">Allow this person to create their own private memories with your avatar</span>
              </label>
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
        >
          {loading ? 'Sharing...' : 'Share Avatar'}
        </button>
      </form>

      <div className="share-history-section">
        <h3 className="subsection-title">Shared With</h3>
        
        {shareHistory.length === 0 ? (
          <div className="empty-state small">
            <p>You haven't shared this avatar with anyone yet.</p>
          </div>
        ) : (
          <div className="share-list">
            {shareHistory.map((share) => (
              <div key={share.id} className="share-item">
                <div className="share-info">
                  <div className="share-email">{share.shareWithEmail}</div>
                  <div className="share-status">{share.status}</div>
                  <div className="share-date">Shared on {new Date(share.createdAt).toLocaleDateString()}</div>
                </div>
                <div className="share-actions">
                  <button
                    onClick={() => handleRevokeAccess(share.id)}
                    className="btn btn-danger btn-sm"
                    disabled={loading}
                  >
                    Revoke Access
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}