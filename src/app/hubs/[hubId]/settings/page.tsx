'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import PageShell from '@/components/PageShell';
import { z } from 'zod';

interface Hub {
  id: string;
  name: string;
  description: string | null;
  isPublished: boolean;
  createdAt: string;
  ownerId: string;
}

interface Invitation {
  id: string;
  email: string | null;
  token: string;
  expiresAt: string;
  isUsed: boolean;
  createdAt: string;
  url: string;
  isExpired: boolean;
}

interface Viewer {
  id: string;
  userId: string;
  accessLevel: 'viewer' | 'contributor' | 'moderator';
  createdAt: string;
  lastAccessAt: string | null;
  user: {
    full_name: string;
    email: string;
    avatar_url: string | null;
  };
}

// Validation schema
const invitationSchema = z.object({
  email: z.string().email('Valid email is required').optional(),
  expiresInDays: z.number().int().min(1).max(30).default(7),
});

export default function HubSettingsPage({ params }: { params: { hubId: string } }) {
  const router = useRouter();
  const { hubId } = params;
  
  const [user, setUser] = useState<any>(null);
  const [hub, setHub] = useState<Hub | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'invitations' | 'viewers'>('general');
  
  const [email, setEmail] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push(`/login?redirect=/hubs/${hubId}/settings`);
          return;
        }
        setUser(session.user);
        await loadHub(session.user.id);
      } catch (err) {
        console.error('Auth error:', err);
        setError('Authentication failed. Please try again.');
      }
    };

    checkAuth();
  }, [hubId, router]);

  const loadHub = async (userId: string) => {
    try {
      setLoading(true);
      setError(null);

      // Fetch hub details
      const hubResponse = await fetch(`/api/hubs/${hubId}`);
      
      if (!hubResponse.ok) {
        if (hubResponse.status === 404) {
          throw new Error('Hub not found');
        } else if (hubResponse.status === 403) {
          throw new Error('You do not have access to this hub');
        }
        throw new Error('Failed to load hub details');
      }
      
      const hubData = await hubResponse.json();
      setHub(hubData.hub);
      
      // Check if user is owner
      if (hubData.hub.ownerId !== userId) {
        router.push(`/hubs/${hubId}`);
        return;
      }

      // Load invitations and viewers
      await Promise.all([
        loadInvitations(),
        loadViewers()
      ]);
    } catch (err) {
      console.error('Error loading hub:', err);
      setError(err instanceof Error ? err.message : 'Failed to load hub');
    } finally {
      setLoading(false);
    }
  };

  const loadInvitations = async () => {
    try {
      const response = await fetch(`/api/hubs/${hubId}/invitations`);
      
      if (!response.ok) {
        throw new Error('Failed to load invitations');
      }
      
      const data = await response.json();
      setInvitations(data.invitations || []);
    } catch (err) {
      console.error('Error loading invitations:', err);
    }
  };

  const loadViewers = async () => {
    try {
      const response = await fetch(`/api/hubs/${hubId}/viewers`);
      
      if (!response.ok) {
        throw new Error('Failed to load viewers');
      }
      
      const data = await response.json();
      setViewers(data.viewers || []);
    } catch (err) {
      console.error('Error loading viewers:', err);
    }
  };

  const handleUpdateHub = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);
    
    if (!hub) return;
    
    setIsSubmitting(true);
    
    try {
      const response = await fetch(`/api/hubs/${hubId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: hub.name,
          description: hub.description,
          isPublished: hub.isPublished,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update hub');
      }
      
      setSubmitSuccess('Hub updated successfully');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to update hub');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(null);
    
    try {
      // Validate input
      invitationSchema.parse({ email: email || undefined, expiresInDays });
      
      setIsSubmitting(true);
      
      const response = await fetch(`/api/hubs/${hubId}/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email || undefined,
          expiresInDays,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create invitation');
      }
      
      const data = await response.json();
      
      // Add new invitation to the list
      setInvitations([data.invitation, ...invitations]);
      
      // Reset form
      setEmail('');
      setExpiresInDays(7);
      
      setSubmitSuccess('Invitation created successfully');
    } catch (err) {
      if (err instanceof z.ZodError) {
        setSubmitError(err.errors[0].message);
      } else {
        setSubmitError(err instanceof Error ? err.message : 'Failed to create invitation');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveViewer = async (viewerId: string) => {
    if (!confirm('Are you sure you want to remove this viewer?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/hubs/${hubId}/viewers/${viewerId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to remove viewer');
      }
      
      // Remove viewer from the list
      setViewers(viewers.filter(viewer => viewer.id !== viewerId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to remove viewer');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <PageShell>
        <main className="container mx-auto px-4 py-8">
          <div className="loading-spinner mx-auto"></div>
          <p className="text-center mt-4">Loading settings...</p>
        </main>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell>
        <main className="container mx-auto px-4 py-8">
          <div className="error-message p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            <p>{error}</p>
            <Link href="/hubs" className="text-blue-600 hover:underline mt-2 inline-block">
              Return to Hubs
            </Link>
          </div>
        </main>
      </PageShell>
    );
  }

  if (!hub) {
    return (
      <PageShell>
        <main className="container mx-auto px-4 py-8">
          <div className="error-message p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            <p>Hub not found</p>
            <Link href="/hubs" className="text-blue-600 hover:underline mt-2 inline-block">
              Return to Hubs
            </Link>
          </div>
        </main>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link href={`/hubs/${hubId}`} className="text-blue-600 hover:underline">
            &larr; Back to Hub
          </Link>
        </div>

        <h1 className="text-3xl font-bold mb-6">Hub Settings</h1>

        <div className="settings-tabs mb-6">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('general')}
              className={`px-4 py-2 ${
                activeTab === 'general'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600'
              }`}
            >
              General
            </button>
            <button
              onClick={() => setActiveTab('invitations')}
              className={`px-4 py-2 ${
                activeTab === 'invitations'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600'
              }`}
            >
              Invitations
            </button>
            <button
              onClick={() => setActiveTab('viewers')}
              className={`px-4 py-2 ${
                activeTab === 'viewers'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600'
              }`}
            >
              Viewers
            </button>
          </div>
        </div>

        {submitError && (
          <div className="error-message mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {submitError}
          </div>
        )}

        {submitSuccess && (
          <div className="success-message mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
            {submitSuccess}
          </div>
        )}

        {activeTab === 'general' && (
          <div className="general-settings max-w-2xl">
            <form onSubmit={handleUpdateHub}>
              <div className="form-group mb-4">
                <label htmlFor="name" className="block text-sm font-medium mb-1">
                  Hub Name*
                </label>
                <input
                  type="text"
                  id="name"
                  value={hub.name}
                  onChange={(e) => setHub({ ...hub, name: e.target.value })}
                  className="w-full p-2 border rounded"
                  required
                />
              </div>

              <div className="form-group mb-4">
                <label htmlFor="description" className="block text-sm font-medium mb-1">
                  Description
                </label>
                <textarea
                  id="description"
                  value={hub.description || ''}
                  onChange={(e) => setHub({ ...hub, description: e.target.value })}
                  rows={4}
                  className="w-full p-2 border rounded"
                />
              </div>

              <div className="form-group mb-6">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isPublished"
                    checked={hub.isPublished}
                    onChange={(e) => setHub({ ...hub, isPublished: e.target.checked })}
                    className="mr-2"
                  />
                  <label htmlFor="isPublished" className="text-sm font-medium">
                    Published
                  </label>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  When published, people with invitations can view and contribute to your hub.
                </p>
              </div>

              <div className="form-actions">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'invitations' && (
          <div className="invitations-settings">
            <div className="create-invitation mb-8">
              <h2 className="text-xl font-semibold mb-4">Create New Invitation</h2>
              <form onSubmit={handleCreateInvitation} className="max-w-2xl">
                <div className="form-group mb-4">
                  <label htmlFor="email" className="block text-sm font-medium mb-1">
                    Email (optional)
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-2 border rounded"
                    placeholder="recipient@example.com"
                  />
                  <p className="text-sm text-gray-500 mt-1">
                    If provided, an invitation email will be sent to this address.
                  </p>
                </div>

                <div className="form-group mb-4">
                  <label htmlFor="expiresInDays" className="block text-sm font-medium mb-1">
                    Expires In (days)
                  </label>
                  <input
                    type="number"
                    id="expiresInDays"
                    value={expiresInDays}
                    onChange={(e) => setExpiresInDays(parseInt(e.target.value))}
                    min="1"
                    max="30"
                    className="w-full p-2 border rounded"
                  />
                </div>

                <div className="form-actions">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300"
                  >
                    {isSubmitting ? 'Creating...' : 'Create Invitation'}
                  </button>
                </div>
              </form>
            </div>

            <div className="invitations-list">
              <h2 className="text-xl font-semibold mb-4">Active Invitations</h2>
              
              {invitations.length === 0 ? (
                <div className="empty-state p-6 text-center border rounded bg-gray-50">
                  <p className="text-gray-600">
                    No active invitations found.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full bg-white border">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="py-2 px-4 border text-left">Email</th>
                        <th className="py-2 px-4 border text-left">Created</th>
                        <th className="py-2 px-4 border text-left">Expires</th>
                        <th className="py-2 px-4 border text-left">Status</th>
                        <th className="py-2 px-4 border text-left">Link</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invitations.map((invitation) => (
                        <tr key={invitation.id}>
                          <td className="py-2 px-4 border">
                            {invitation.email || 'No email'}
                          </td>
                          <td className="py-2 px-4 border">
                            {formatDate(invitation.createdAt)}
                          </td>
                          <td className="py-2 px-4 border">
                            {formatDate(invitation.expiresAt)}
                          </td>
                          <td className="py-2 px-4 border">
                            {invitation.isUsed ? (
                              <span className="text-green-600">Used</span>
                            ) : invitation.isExpired ? (
                              <span className="text-red-600">Expired</span>
                            ) : (
                              <span className="text-blue-600">Active</span>
                            )}
                          </td>
                          <td className="py-2 px-4 border">
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(invitation.url);
                                alert('Invitation link copied to clipboard');
                              }}
                              className="text-blue-600 hover:underline"
                            >
                              Copy Link
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'viewers' && (
          <div className="viewers-settings">
            <h2 className="text-xl font-semibold mb-4">Hub Viewers</h2>
            
            {viewers.length === 0 ? (
              <div className="empty-state p-6 text-center border rounded bg-gray-50">
                <p className="text-gray-600">
                  No viewers have accessed this hub yet.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full bg-white border">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="py-2 px-4 border text-left">Name</th>
                      <th className="py-2 px-4 border text-left">Email</th>
                      <th className="py-2 px-4 border text-left">Access Level</th>
                      <th className="py-2 px-4 border text-left">Last Access</th>
                      <th className="py-2 px-4 border text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewers.map((viewer) => (
                      <tr key={viewer.id}>
                        <td className="py-2 px-4 border">
                          {viewer.user.full_name || 'Unknown'}
                        </td>
                        <td className="py-2 px-4 border">
                          {viewer.user.email}
                        </td>
                        <td className="py-2 px-4 border capitalize">
                          {viewer.accessLevel}
                        </td>
                        <td className="py-2 px-4 border">
                          {viewer.lastAccessAt ? formatDate(viewer.lastAccessAt) : 'Never'}
                        </td>
                        <td className="py-2 px-4 border">
                          <button
                            onClick={() => handleRemoveViewer(viewer.id)}
                            className="text-red-600 hover:underline"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </PageShell>
  );
}