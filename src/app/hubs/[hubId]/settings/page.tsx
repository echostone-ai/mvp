'use client';

import React from 'react';
import Link from 'next/link';
import '@/styles/legacy-hub.css';

export default function HubSettingsPage() {
  return (
    <div className="hub-container">
      <Link href="/hubs" className="back-link">
        &larr; Back to Hub
      </Link>
      
      <div className="hub-header">
        <h1 className="hub-title">Hub Settings</h1>
        <p className="hub-description">
          Manage your hub settings here.
        </p>
      </div>
      
      <div className="tabs-list">
        <div className="tab-item active">General</div>
        <div className="tab-item">Invitations</div>
        <div className="tab-item">Viewers</div>
      </div>
      
      <div className="settings-section">
        <h2 className="settings-title">General Settings</h2>
        
        <form>
          <div className="form-group">
            <label className="form-label">Hub Name</label>
            <input type="text" className="form-input" placeholder="My Legacy Hub" />
          </div>
          
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" placeholder="A place to share memories and stories..."></textarea>
          </div>
          
          <div className="form-group form-checkbox">
            <input type="checkbox" id="isPublished" />
            <label htmlFor="isPublished">Publish Hub</label>
          </div>
          <p className="form-help">When published, people with invitations can view and contribute to your hub.</p>
          
          <button type="submit" className="btn btn-primary">Save Changes</button>
        </form>
      </div>
    </div>
  );
}