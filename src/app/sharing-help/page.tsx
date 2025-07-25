'use client';

import React from 'react';
import Link from 'next/link';

export default function SharingHelpPage() {
  return (
    <div className="container">
      <div className="hub-header">
        <h1 className="hub-title">How to Share Your Avatar</h1>
        <p className="hub-description">
          Learn how to share your avatar with friends and family so they can have private conversations with your digital self.
        </p>
      </div>

      <div className="card">
        <h2>Sharing Process</h2>
        
        <div className="sharing-steps">
          <div className="step">
            <div className="step-number">1</div>
            <div className="step-content">
              <h3>Go to Your Avatar</h3>
              <p>Navigate to your avatars page and click on the avatar you want to share.</p>
            </div>
          </div>
          
          <div className="step">
            <div className="step-number">2</div>
            <div className="step-content">
              <h3>Click "Share Avatar"</h3>
              <p>On your avatar's page, click the "Share Avatar" button to open the sharing form.</p>
            </div>
          </div>
          
          <div className="step">
            <div className="step-number">3</div>
            <div className="step-content">
              <h3>Enter Email & Set Permissions</h3>
              <p>Enter the recipient's email address and choose what they can do (chat, view memories, etc.).</p>
            </div>
          </div>
          
          <div className="step">
            <div className="step-number">4</div>
            <div className="step-content">
              <h3>Share the Link</h3>
              <p>After creating the share, you'll get a unique link. You can:</p>
              <ul>
                <li>Copy the link and send it manually</li>
                <li>Use the "Compose Email" button to create an email with the link</li>
                <li>Share the link through any messaging platform</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Privacy & Security</h2>
        
        <div className="privacy-features">
          <div className="privacy-feature">
            <h3>🔒 Complete Privacy</h3>
            <p>Each person you share with gets their own private conversation space. You can't see their messages, and they can't see yours or other people's conversations.</p>
          </div>
          
          <div className="privacy-feature">
            <h3>🧠 Individual Memories</h3>
            <p>Your avatar builds separate memories with each person. These memories are private and help provide personalized responses.</p>
          </div>
          
          <div className="privacy-feature">
            <h3>⚙️ Permission Control</h3>
            <p>You control what each person can do - chat, view shared memories, or create their own memories with your avatar.</p>
          </div>
          
          <div className="privacy-feature">
            <h3>🚫 Revoke Access</h3>
            <p>You can revoke someone's access at any time from the sharing management page.</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Troubleshooting</h2>
        
        <div className="faq">
          <div className="faq-item">
            <h3>The person didn't receive an email</h3>
            <p>Currently, emails are not sent automatically. Use the "Compose Email" button to create an email with the sharing link, or copy the link and send it through your preferred method.</p>
          </div>
          
          <div className="faq-item">
            <h3>The sharing link doesn't work</h3>
            <p>Make sure the link is complete and hasn't been truncated. The link should start with your domain and include "/shared-avatar/" followed by a unique token.</p>
          </div>
          
          <div className="faq-item">
            <h3>How do I see who has access?</h3>
            <p>Go to your avatar's sharing page to see all active shares, their status, and manage permissions.</p>
          </div>
        </div>
      </div>

      <div className="form-actions">
        <Link href="/profile" className="btn btn-primary">
          Back to Profile
        </Link>
      </div>
    </div>
  );
}