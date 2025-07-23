'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getStoredVisitorInfo, storeVisitorInfo } from '@/lib/avatarDataService';
// CSS is imported in the layout file

export default function SharedAvatarPage() {
  const params = useParams();
  const router = useRouter();
  const shareToken = params.token as string;
  
  const [sharedAvatar, setSharedAvatar] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReturningVisitor, setIsReturningVisitor] = useState(false);
  const [showWelcomeBack, setShowWelcomeBack] = useState(false);

  // Check for returning visitor and fetch avatar details
  useEffect(() => {
    async function initializePage() {
      try {
        // Check if this is a returning visitor
        const storedVisitor = getStoredVisitorInfo(shareToken);
        
        if (storedVisitor) {
          console.log('Welcome back returning visitor:', storedVisitor.name);
          setIsReturningVisitor(true);
          setUserEmail(storedVisitor.email);
          setUserName(storedVisitor.name);
          setShowWelcomeBack(true);
        }
        
        // Fetch shared avatar details
        const response = await fetch(`/api/avatar-sharing?shareToken=${shareToken}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch shared avatar details');
        }
        
        const data = await response.json();
        
        if (!data.success || !data.sharedAvatar || !data.sharedAvatar.isValid) {
          throw new Error('This sharing link is invalid or has expired');
        }
        
        setSharedAvatar(data.sharedAvatar);
        
        // If returning visitor, automatically redirect to chat after a brief welcome
        if (storedVisitor) {
          setTimeout(() => {
            router.push(`/shared-avatar/${shareToken}/chat?userEmail=${encodeURIComponent(storedVisitor.email)}&userName=${encodeURIComponent(storedVisitor.name)}`);
          }, 2000); // 2 second welcome message
        }
        
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Failed to load shared avatar');
        setLoading(false);
      }
    }

    initializePage();
  }, [shareToken, router]);

  const handleAcceptInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userEmail.trim()) {
      setError('Please enter your email address');
      return;
    }
    
    const finalUserName = userName.trim() || userEmail.split('@')[0];
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      // Store visitor information for future visits
      storeVisitorInfo(shareToken, userEmail.trim(), finalUserName);
      
      const response = await fetch('/api/avatar-sharing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'accept-share',
          shareToken,
          userEmail: userEmail.trim(),
          userName: finalUserName
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to accept invitation');
      }
      
      // Redirect to chat page with user info
      router.push(`/shared-avatar/${shareToken}/chat?userEmail=${encodeURIComponent(userEmail.trim())}&userName=${encodeURIComponent(finalUserName)}`);
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
    // Create a fallback avatar for a better user experience
    const fallbackAvatar = {
      name: 'Digital Avatar',
      description: 'A digital avatar ready to chat with you',
      hasVoice: false
    };
    
    return (
      <div className="hub-container">
        <div className="card">
          <div className="avatar-preview-section">
            <div className="avatar-preview-card">
              <div className="avatar-preview-header">
                <h2>Welcome to Shared Avatar</h2>
                <span className="avatar-no-voice">Digital Avatar</span>
              </div>
              <div className="avatar-preview-content">
                <div className="avatar-preview-image">
                  <div className="avatar-placeholder">A</div>
                </div>
                <div className="avatar-preview-info">
                  <h3>Digital Avatar</h3>
                  <p>Someone has shared their digital avatar with you. Enter your email to start chatting!</p>
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
                This helps the avatar remember you for future conversations.
              </p>
            </div>

            <div className="form-group">
              <label htmlFor="userName" className="form-label">Your Name (Optional)</label>
              <input
                type="text"
                id="userName"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="form-input"
                placeholder="How should the avatar address you?"
              />
            </div>

            <div className="alert alert-info">
              Note: We couldn't load the avatar details, but you can still start chatting.
              <br />
              Error: {error || 'Shared avatar not found'}
            </div>

            <div className="form-actions">
              <Link href="/" className="btn btn-secondary">
                Cancel
              </Link>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Getting Ready...' : 'Start Chatting'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  const { avatar, ownerEmail } = sharedAvatar;

  // Show welcome back message for returning visitors
  if (showWelcomeBack && isReturningVisitor) {
    return (
      <div className="hub-container">
        <div className="card">
          <div className="text-center">
            <div className="avatar-preview-image" style={{ margin: '0 auto 1rem', width: '80px', height: '80px' }}>
              <div className="avatar-placeholder">{avatar.name.charAt(0)}</div>
            </div>
            <h1 className="hub-title">Welcome back, {userName}! 👋</h1>
            <p className="hub-description">
              Great to see you again! {avatar.name} remembers you and is excited to continue your conversation.
            </p>
            <div className="loading-spinner" style={{ margin: '2rem auto' }}></div>
            <p style={{ color: '#9b7cff' }}>Taking you to chat with {avatar.name}...</p>
          </div>
        </div>
      </div>
    );
  }

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
              This helps {avatar.name} remember you for future conversations.
            </p>
          </div>

          <div className="form-group">
            <label htmlFor="userName" className="form-label">Your Name (Optional)</label>
            <input
              type="text"
              id="userName"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              className="form-input"
              placeholder="How should the avatar address you?"
            />
            <p className="form-help">
              If not provided, we'll use the first part of your email address.
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
              {isSubmitting ? 'Getting Ready...' : `Start Chatting with ${avatar.name}`}
            </button>
          </div>
        </form>

        <div className="invitation-info">
          <h3>🔒 Your Privacy is Protected:</h3>
          <ul>
            <li>Your conversations with {avatar.name} are completely private</li>
            <li>{avatar.name} will remember you and your conversations</li>
            <li>The avatar owner cannot see your messages</li>
            <li>You can return anytime using this same link</li>
          </ul>
        </div>
      </div>
    </div>
  );
}