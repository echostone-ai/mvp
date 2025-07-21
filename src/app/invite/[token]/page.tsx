'use client';

import React from 'react';
import Link from 'next/link';
import '@/styles/legacy-hub.css';

export default function InvitationPage() {
  return (
    <div className="invitation-container">
      <h1 className="invitation-title">Invitation to Legacy Hub</h1>

      <div className="card">
        <div className="card-content">
          <p className="invitation-message">
            You've been invited to join the <strong>Family Memories</strong> hub.
            Join to view and contribute memories with friends and family.
          </p>
        </div>

        <div className="invitation-actions">
          <button className="btn btn-primary">Accept Invitation</button>
          <Link href="/" className="btn btn-secondary">
            Return to Home
          </Link>
        </div>
      </div>
    </div>
  );
}