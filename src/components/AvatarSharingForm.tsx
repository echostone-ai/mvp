'use client';

import React, { useState } from 'react';
// import { useRouter } from 'next/navigation';

interface AvatarSharingFormProps {
  avatarId: string;
  avatarName: string;
  ownerEmail: string;
}

export default function AvatarSharingForm({ avatarId, avatarName, ownerEmail }: AvatarSharingFormProps) {
  // const router = useRouter();
  const [email, setEmail] = useState('');
  const [permissions, setPermissions] = useState({
    chat: true,
    viewMemories: true,
    createMemories: true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [shareHistory, setShareHistory] = useState<Array<{ id: string; email: string; permissions: any; createdAt: string }>>([]);
  const [lastCreatedShare, setLastCreatedShare] = useState<{ id: string; email: string; permissions: any; createdAt: string } | null>(null);

  // Load existing shares when component mounts
  React.useEffect(() => {
    fetchShareHistory();
  }, [avatarId]);

  const fetchShareHistory = async () => {
    try {
      // Make sure we have the required parameters
      if (!avatarId || !ownerEmail) {
        console.error('Missing required parameters for fetching share history');
        return;
      }
      
      const response = await fetch(`/api/avatar-sharing?avatarId=${encodeURIComponent(avatarId)}&ownerEmail=${encodeURIComponent(ownerEmail)}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.shares) {
          setShareHistory(data.shares);
        } else {
          console.log('No shares found or invalid response format:', data);
          setShareHistory([]);
        }
      } else {
        console.log('Failed to fetch share history, status:', response.status, '- this is expected if database table is not set up yet');
        setShareHistory([]);
      }
    } catch (error) {
      console.log('Failed to fetch share history:', error, '- this is expected if database table is not set up yet');
      setShareHistory([]);
    }
  };

  const handlePermissionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setPermissions(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    if (!email.trim()) {
      setError('Please enter a valid email address');
      setLoading(false);
      return;
    }

    try {
      // Convert permissions object to array of strings
      const permissionsArray = Object.entries(permissions)
        .filter(([_, value]) => value)
        .map(([key, _]) => key);

      const requestData = {
        action: 'create-share',
        avatarId,
        ownerEmail,
        shareWithEmail: email,
        permissions: permissionsArray
      };
      
      console.log('Sending avatar sharing request:', requestData);

      const response = await fetch('/api/avatar-sharing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      const data = await response.json();
      console.log('Avatar sharing response:', { status: response.status, data });

      if (!response.ok) {
        console.error('Avatar sharing failed:', data);
        throw new Error(data.error || 'Failed to share avatar');
      }

      // Store the created share for display
      const shareUrl = data.share?.shareUrl || `${window.location.origin}/shared-avatar/${data.share?.shareToken}`;
      
      setLastCreatedShare({
        ...data.share,
        shareWithEmail: email,
        shareUrl
      });
      
      setSuccessMessage(`Avatar successfully shared with ${email}!`);
      setEmail('');
      
      // Optionally send email notification
      try {
        const emailResponse = await fetch('/api/send-invitation-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            recipientEmail: email,
            avatarName,
            ownerEmail,
            shareUrl,
            personalMessage: '' // Could add a field for this in the form
          })
        });
        
        if (emailResponse.ok) {
          const emailData = await emailResponse.json();
          console.log('Email notification sent:', emailData);
          
          // In development, show what the email would contain
          if (emailData.emailContent && process.env.NODE_ENV === 'development') {
            console.log('Email content that would be sent:', emailData.emailContent);
          }
        } else {
          console.warn('Failed to send email notification, but share was created successfully');
        }
      } catch (emailError) {
        console.warn('Email notification failed, but share was created successfully:', emailError);
      }
      
      // Refresh share history
      fetchShareHistory();
    } catch (error: any) {
      setError(error.message || 'An error occurred while sharing the avatar');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeAccess = async (shareId: string) => {
    if (!confirm('Are you sure you want to revoke access? This cannot be undone.')) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/avatar-sharing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'revoke-share',
          shareId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to revoke access');
      }

      // Refresh share history
      fetchShareHistory();
      setSuccessMessage('Access successfully revoked');
    } catch (error: any) {
      setError(error.message || 'An error occurred while revoking access');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="avatar-sharing-container">
      <h2 className="section-title">Share {avatarName} with Others</h2>
      <p className="section-description">
        Share your avatar with friends and family. Each person will have their own private conversations and memories with your avatar.
        <br />
        <strong>Note:</strong> The sharing feature is being restored. Database setup may be required for full functionality.
        <br />
        <a href="/sharing-help" target="_blank" style={{ color: '#9b7cff', textDecoration: 'underline' }}>
          Need help with sharing? Click here for detailed instructions.
        </a>
      </p>

      {error && <div className="alert alert-error">{error}</div>}
      {successMessage && <div className="alert alert-success">{successMessage}</div>}
      
      {lastCreatedShare && (
        <div className="share-link-display">
          <h4>Share Link Created</h4>
          <p>Send this link to {lastCreatedShare.shareWithEmail} to give them access to your avatar:</p>
          <div className="share-link-container">
            <input
              type="text"
              value={lastCreatedShare.shareUrl}
              readOnly
              className="form-input"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(lastCreatedShare.shareUrl);
                alert('Share link copied to clipboard!');
              }}
              className="btn btn-secondary btn-sm"
            >
              Copy Link
            </button>
          </div>
          <div className="share-actions">
            <button
              onClick={() => {
                const subject = encodeURIComponent(`You've been invited to chat with ${avatarName}!`);
                const body = encodeURIComponent(`Hi there!

I'd like to share my avatar "${avatarName}" with you. This is a digital version of me that you can chat with privately.

Click this link to start chatting:
${lastCreatedShare.shareUrl}

Your conversations will be completely private - only you will be able to see them. The avatar will remember things from your conversations and build memories specific to your relationship.

Hope you enjoy chatting with ${avatarName}!

Best regards`);
                window.open(`mailto:${lastCreatedShare.shareWithEmail}?subject=${subject}&body=${body}`);
              }}
              className="btn btn-primary btn-sm"
            >
              📧 Compose Email
            </button>
            <button
              onClick={() => setLastCreatedShare(null)}
              className="btn btn-secondary btn-sm"
            >
              Done
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="sharing-form">
        <div className="form-group">
          <label htmlFor="email" className="form-label">Email Address</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="form-input"
            placeholder="Enter email address"
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Permissions</label>
          <div className="permissions-options">
            <div className="form-checkbox">
              <input
                type="checkbox"
                id="chat"
                name="chat"
                checked={permissions.chat}
                onChange={handlePermissionChange}
              />
              <label htmlFor="chat">
                Chat with Avatar
                <span className="permission-description">Allow this person to have conversations with your avatar</span>
              </label>
            </div>
            
            <div className="form-checkbox">
              <input
                type="checkbox"
                id="viewMemories"
                name="viewMemories"
                checked={permissions.viewMemories}
                onChange={handlePermissionChange}
              />
              <label htmlFor="viewMemories">
                View Shared Memories
                <span className="permission-description">Allow this person to see memories you've explicitly shared</span>
              </label>
            </div>
            
            <div className="form-checkbox">
              <input
                type="checkbox"
                id="createMemories"
                name="createMemories"
                checked={permissions.createMemories}
                onChange={handlePermissionChange}
              />
              <label htmlFor="createMemories">
                Create Private Memories
                <span className="permission-description">Allow this person to create their own private memories with your avatar</span>
              </label>
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
        >
          {loading ? 'Sharing...' : 'Share Avatar'}
        </button>
        
        <button
          type="button"
          onClick={async () => {
            const testData = {
              action: 'create-share',
              avatarId,
              ownerEmail,
              shareWithEmail: email || 'test@example.com',
              permissions: ['chat']
            };
            
            console.log('Testing with data:', testData);
            
            try {
              const response = await fetch('/api/test-avatar-sharing', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(testData)
              });
              
              const result = await response.json();
              console.log('Test result:', result);
              alert('Test result: ' + JSON.stringify(result, null, 2));
            } catch (error) {
              console.error('Test error:', error);
              alert('Test error: ' + error);
            }
          }}
          className="btn btn-secondary"
          style={{ marginLeft: '10px' }}
        >
          Test Validation
        </button>
      </form>

      <div className="share-history-section">
        <h3 className="subsection-title">Shared With</h3>
        
        {shareHistory.length === 0 ? (
          <div className="empty-state small">
            <p>You haven't shared this avatar with anyone yet.</p>
          </div>
        ) : (
          <div className="share-list">
            {shareHistory.map((share) => (
              <div key={share.id} className="share-item">
                <div className="share-info">
                  <div className="share-email">{share.shareWithEmail}</div>
                  <div className="share-status">{share.status}</div>
                  <div className="share-date">Shared on {new Date(share.createdAt).toLocaleDateString()}</div>
                </div>
                <div className="share-actions">
                  <button
                    onClick={() => handleRevokeAccess(share.id)}
                    className="btn btn-danger btn-sm"
                    disabled={loading}
                  >
                    Revoke Access
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}