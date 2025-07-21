'use client';

import React from 'react';
import Link from 'next/link';
import '@/styles/legacy-hub.css';
import HubCreationForm from '@/components/legacy-hub/HubCreationForm';

export default function CreateHubPage() {
  return (
    <div className="hub-container">
      <Link href="/hubs" className="back-link">
        &larr; Back to Hubs
      </Link>
      
      <div className="hub-header">
        <h1 className="hub-title">Create a Legacy Hub</h1>
        <p className="hub-description">
          Create a new hub to preserve and share memories with friends and family.
        </p>
      </div>
      
      <div className="card">
        <HubCreationForm />
      </div>
    </div>
  );
}