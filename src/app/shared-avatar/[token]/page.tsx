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
      <div className="invitation-container">
        <div className="invitation-card">
          {/* Header Section */}
          <div className="invitation-header">
            <div className="avatar-circle">
              <div className="avatar-initial">A</div>
              <div className="voice-indicator no-voice">💬</div>
            </div>
            
            <h1 className="invitation-title">
              Meet <span className="avatar-name">Digital Avatar</span>
            </h1>
            
            <p className="invitation-subtitle">
              Someone has shared their digital avatar with you. Enter your email to start chatting!
            </p>
          </div>

          {/* Quick Start Form */}
          <form onSubmit={handleAcceptInvitation} className="quick-start-form">
            <div className="input-group">
              <div className="input-wrapper">
                <input
                  type="email"
                  id="userEmail"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="main-input"
                  placeholder="Enter your email to start chatting"
                  required
                />
                <div className="input-icon">✉️</div>
              </div>
            </div>

            <div className="input-group optional-group">
              <div className="input-wrapper">
                <input
                  type="text"
                  id="userName"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="main-input"
                  placeholder="Your name (optional)"
                />
                <div className="input-icon">👋</div>
              </div>
            </div>

            {error && (
              <div className="error-message">
                <span className="error-icon">⚠️</span>
                We couldn't load the avatar details, but you can still start chatting. {error}
              </div>
            )}

            <button
              type="submit"
              className="start-chat-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <div className="btn-spinner"></div>
                  Getting Ready...
                </>
              ) : (
                <>
                  <span className="btn-icon">💬</span>
                  Start Chatting
                </>
              )}
            </button>
          </form>

          {/* Features Section */}
          <div className="features-grid">
            <div className="feature-item">
              <div className="feature-icon">🔒</div>
              <div className="feature-text">Private & Secure</div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">🧠</div>
              <div className="feature-text">Remembers You</div>
            </div>
            <div className="feature-item">
              <div className="feature-icon">💾</div>
              <div className="feature-text">Saves History</div>
            </div>
          </div>

          {/* CTA Section */}
          <div className="cta-section">
            <p className="cta-text">Want to create your own AI avatar?</p>
            <a
              href="https://app.echostone.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="cta-btn"
            >
              <span className="cta-icon">✨</span>
              Create Your Avatar
            </a>
          </div>
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
    <div className="invitation-container">
      <div className="invitation-card">
        {/* Header Section */}
        <div className="invitation-header">
          <div className="avatar-circle">
            {avatar.photoUrl ? (
              <img src={avatar.photoUrl} alt={avatar.name} className="avatar-image" />
            ) : (
              <div className="avatar-initial">{avatar.name.charAt(0)}</div>
            )}
            <div className={`voice-indicator ${avatar.hasVoice ? 'has-voice' : 'no-voice'}`}>
              {avatar.hasVoice ? '🎤' : '💬'}
            </div>
          </div>
          
          <h1 className="invitation-title">
            Meet <span className="avatar-name">{avatar.name}</span>
          </h1>
          
          <p className="invitation-subtitle">
            {avatar.description || `You've been invited to have a private conversation with ${avatar.name}`}
          </p>
        </div>

        {/* Quick Start Form */}
        <form onSubmit={handleAcceptInvitation} className="quick-start-form">
          <div className="input-group">
            <div className="input-wrapper">
              <input
                type="email"
                id="userEmail"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                className="main-input"
                placeholder="Enter your email to start chatting"
                required
              />
              <div className="input-icon">✉️</div>
            </div>
          </div>

          <div className="input-group optional-group">
            <div className="input-wrapper">
              <input
                type="text"
                id="userName"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="main-input"
                placeholder="Your name (optional)"
              />
              <div className="input-icon">👋</div>
            </div>
          </div>

          {error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="start-chat-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <div className="btn-spinner"></div>
                Getting Ready...
              </>
            ) : (
              <>
                <span className="btn-icon">💬</span>
                Start Chatting with {avatar.name}
              </>
            )}
          </button>
        </form>

        {/* Features Section */}
        <div className="features-grid">
          <div className="feature-item">
            <div className="feature-icon">🔒</div>
            <div className="feature-text">Private & Secure</div>
          </div>
          <div className="feature-item">
            <div className="feature-icon">🧠</div>
            <div className="feature-text">Remembers You</div>
          </div>
          <div className="feature-item">
            <div className="feature-icon">💾</div>
            <div className="feature-text">Saves History</div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="cta-section">
          <p className="cta-text">Want to create your own AI avatar?</p>
          <a
            href="https://app.echostone.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="cta-btn"
          >
            <span className="cta-icon">✨</span>
            Create Your Avatar
          </a>
        </div>
      </div>
    </div>
  );
}