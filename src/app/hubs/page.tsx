'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import '@/styles/legacy-hub.css';

interface Hub {
  id: string;
  name: string;
  description: string;
  isPublished: boolean;
  createdAt: string;
  ownerId: string;
  _count: {
    memories: number;
    viewers: number;
  };
}

export default function HubsPage() {
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch hubs
  useEffect(() => {
    async function fetchHubs() {
      try {
        // Fetch hubs from the API
        const response = await fetch('/api/hubs');
        if (!response.ok) {
          throw new Error('Failed to fetch hubs');
        }
        const data = await response.json();
        setHubs(data.hubs || []);
        setLoading(false);
      } catch (err) {
        setError('Failed to load hubs');
        setLoading(false);
      }
    }

    fetchHubs();
  }, []);

  if (loading) {
    return (
      <div className="hub-container">
        <div className="loading-spinner"></div>
        <p className="loading-text">Loading hubs...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="hub-container">
        <div className="error-message">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="hub-container">
      <div className="hub-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 className="hub-title">Legacy Hubs</h1>
          <Link href="/hubs/create" className="btn btn-primary">
            Create New Hub
          </Link>
        </div>
      </div>
      
      <div className="hub-section">
        <h2 className="hub-section-title">Your Hubs</h2>
        
        {hubs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📝</div>
            <h3 className="empty-state-title">No Hubs Yet</h3>
            <p className="empty-state-message">
              Create your first hub to start preserving and sharing memories.
            </p>
            <Link href="/hubs/create" className="btn btn-primary">
              Create New Hub
            </Link>
          </div>
        ) : (
          <div className="hub-list">
            {hubs.map((hub) => (
              <Link key={hub.id} href={`/hubs/${hub.id}`} className="hub-card">
                <div className="hub-card-header">
                  <h3 className="hub-card-title">{hub.name}</h3>
                  <span className={`hub-card-badge ${hub.isPublished ? 'hub-card-badge-published' : 'hub-card-badge-draft'}`}>
                    {hub.isPublished ? 'Published' : 'Draft'}
                  </span>
                </div>
                <p className="hub-card-description">
                  {hub.description || 'No description provided.'}
                </p>
                <div className="hub-card-stats">
                  <span>{hub._count.memories} memories</span>
                  <span>{hub._count.viewers} viewers</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      
      <div className="hub-section">
        <h2 className="hub-section-title">Shared With You</h2>
        
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <h3 className="empty-state-title">No Shared Hubs</h3>
          <p className="empty-state-message">
            When someone shares a hub with you, it will appear here.
          </p>
        </div>
      </div>
    </div>
  );
}