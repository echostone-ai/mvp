'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import AvatarSharingForm from '@/components/AvatarSharingForm';

export default function AvatarSharingPage() {
  const params = useParams();
  const router = useRouter();
  const avatarId = params.avatarId as string;
  
  const [avatar, setAvatar] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch avatar details
  useEffect(() => {
    async function fetchAvatarDetails() {
      try {
        console.log('Fetching avatar details for ID:', avatarId);
        
        // In a real app, fetch from your API
        const response = await fetch(`/api/avatars/${avatarId}`);
        
        console.log('Avatar API response status:', response.status);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch avatar details: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Avatar data received:', data);
        
        if (!data.avatar) {
          throw new Error('Invalid response format: missing avatar data');
        }
        
        setAvatar(data.avatar);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching avatar details:', err);
        setError('Failed to load avatar details');
        setLoading(false);
      }
    }

    fetchAvatarDetails();
  }, [avatarId]);

  if (loading) {
    return (
      <div className="container">
        <div className="loading-spinner"></div>
        <p className="loading-text">Loading avatar details...</p>
      </div>
    );
  }

  if (error || !avatar) {
    // Create a fallback avatar automatically
    const fallbackAvatar = {
      id: avatarId,
      name: `Avatar ${avatarId.substring(0, 4)}`,
      description: 'A digital avatar',
      hasVoice: false,
      voiceId: null
    };
    
    return (
      <div className="container">
        <Link href="/profile" className="back-link">
          &larr; Back to Profile
        </Link>
        
        <div className="hub-header">
          <h1 className="hub-title">Share Your Avatar</h1>
          <p className="hub-description">
            Share your digital avatar with friends and family. Each person will have their own private conversations and memories with your avatar.
          </p>
        </div>
        
        <div className="card">
          <AvatarSharingForm 
            avatarId={avatarId} 
            avatarName={fallbackAvatar.name} 
            ownerEmail="current-user@example.com" // In a real app, get from auth
          />
        </div>
        
        <div className="info-section">
          <h3>Note: Using Fallback Data</h3>
          <p>We couldn't load the complete avatar data, but you can still share this avatar.</p>
          <p>Original error: {error || 'Avatar not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <Link href={`/profile/chat?avatarId=${avatarId}`} className="back-link">
        &larr; Back to Avatar
      </Link>

      <div className="avatar-header">
        <div className="avatar-title-section">
          <h1 className="avatar-title">Share Your Avatar</h1>
        </div>
        <p className="avatar-description">
          Share your digital avatar with friends and family. Each person will have their own private conversations and memories with your avatar.
        </p>
      </div>
      
      <div className="card">
        <AvatarSharingForm 
          avatarId={avatarId} 
          avatarName={avatar.name || 'Avatar'} 
          ownerEmail="current-user@example.com" // In a real app, get from auth
        />
      </div>
      
      <div className="info-section">
        <h3>About Avatar Sharing</h3>
        <ul className="info-list">
          <li>Each person you share with will have their own private conversations with your avatar</li>
          <li>Their memories and conversations won't affect your avatar's memories</li>
          <li>You can revoke access at any time</li>
          <li>People you share with cannot share your avatar with others</li>
        </ul>
      </div>
    </div>
  );
}