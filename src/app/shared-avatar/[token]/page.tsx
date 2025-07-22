'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
// CSS is imported in the layout file

export default function SharedAvatarPage() {
  const params = useParams();
  const router = useRouter();
  const shareToken = params.token as string;
  
  const [sharedAvatar, setSharedAvatar] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch shared avatar details
  useEffect(() => {
    async function fetchSharedAvatarDetails() {
      try {
        const response = await fetch(`/api/avatar-sharing?shareToken=${shareToken}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch shared avatar details');
        }
        
        const data = await response.json();
        
        if (!data.success || !data.sharedAvatar || !data.sharedAvatar.isValid) {
          throw new Error('This sharing link is invalid or has expired');
        }
        
        setSharedAvatar(data.sharedAvatar);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Failed to load shared avatar');
        setLoading(false);
      }
    }

    fetchSharedAvatarDetails();
  }, [shareToken]);

  const handleAcceptInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userEmail.trim()) {
      setError('Please enter your email address');
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const response = await fetch('/api/avatar-sharing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'accept-share',
          shareToken,
          userEmail
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to accept invitation');
      }
      
      // Redirect to chat page
      router.push(`/shared-avatar/${shareToken}/chat`);
    } catch (err: any) {
      setError(err.message || 'An error occurred while accepting the invitation');
      setIsSubmitting(false);
    }
  };

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

  const { avatar, ownerEmail } = sharedAvatar;

  return (
    <div className="hub-container">
      <div className="card">
        <div className="avatar-preview-section">
          <div className="avatar-preview-card">
            <div className="avatar-preview-header">
              <h2>You've been invited to chat with {avatar.name}</h2>
              <span className={avatar.hasVoice ? 'avatar-has-voice' : 'avatar-no-voice'}>
                {avatar.hasVoice ? 'Has Voice' : 'No Voice'}
              </span>
            </div>
            <div className="avatar-preview-content">
              <div className="avatar-preview-image">
                <div className="avatar-placeholder">{avatar.name.charAt(0)}</div>
              </div>
              <div className="avatar-preview-info">
                <h3>{avatar.name}</h3>
                <p>{avatar.description || `${ownerEmail} has shared their avatar with you. Accept this invitation to start chatting!`}</p>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleAcceptInvitation} className="invitation-form">
          <div className="form-group">
            <label htmlFor="userEmail" className="form-label">Your Email Address</label>
            <input
              type="email"
              id="userEmail"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              className="form-input"
              placeholder="Enter your email address"
              required
            />
            <p className="form-help">
              Your email is used to save your private conversations and memories with this avatar.
            </p>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <div className="form-actions">
            <Link href="/" className="btn btn-secondary">
              Cancel
            </Link>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Accepting...' : 'Accept & Start Chatting'}
            </button>
          </div>
        </form>

        <div className="invitation-info">
          <h3>What happens when you accept:</h3>
          <ul>
            <li>You'll be able to chat with {avatar.name}</li>
            <li>Your conversations will be private to you</li>
            <li>You'll form your own memories with this avatar</li>
            <li>The avatar owner won't see your conversations</li>
          </ul>
        </div>
      </div>
    </div>
  );
}