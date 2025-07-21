'use client';

import React from 'react';
import Link from 'next/link';
import '@/styles/legacy-hub.css';

export default function HubsPage() {
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
        
        <div className="hub-list">
          <Link href="/hubs/example-1" className="hub-card">
            <div className="hub-card-header">
              <h3 className="hub-card-title">Family Memories</h3>
              <span className="hub-card-badge hub-card-badge-published">Published</span>
            </div>
            <p className="hub-card-description">
              A collection of family memories and stories from our adventures together.
            </p>
            <div className="hub-card-stats">
              <span>5 memories</span>
              <span>2 viewers</span>
            </div>
          </Link>
          
          <Link href="/hubs/example-2" className="hub-card">
            <div className="hub-card-header">
              <h3 className="hub-card-title">Travel Adventures</h3>
              <span className="hub-card-badge hub-card-badge-draft">Draft</span>
            </div>
            <p className="hub-card-description">
              Memories from my travels around the world.
            </p>
            <div className="hub-card-stats">
              <span>10 memories</span>
              <span>0 viewers</span>
            </div>
          </Link>
        </div>
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