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
        // In a real app, fetch from your API
        const response = await fetch(`/api/avatars/${avatarId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch avatar details');
        }
        
        const data = await response.json();
        setAvatar(data.avatar);
        setLoading(false);
      } catch (err) {
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
    return (
      <div className="container">
        <div className="error-message">
          {error || 'Avatar not found'}
        </div>
        <Link href="/avatars" className="btn btn-primary">
          Back to Avatars
        </Link>
      </div>
    );
  }

  return (
    <div className="container">
      <Link href={`/avatars/${avatarId}`} className="back-link">
        &larr; Back to Avatar
      </Link>

      <div className="avatar-header">
        <div className="avatar-title-section">
          <h1 className="avatar-title">Share {avatar.name}</h1>
        </div>
        <p className="avatar-description">
          Share your avatar with friends and family. Each person will have their own private conversations and memories.
        </p>
      </div>
      
      <div className="card">
        <AvatarSharingForm 
          avatarId={avatarId} 
          avatarName={avatar.name} 
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