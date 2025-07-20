'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import AddMemoryForm from '@/components/legacy-hub/AddMemoryForm';
import FlagsDashboard from '@/components/legacy-hub/FlagsDashboard';
import PageShell from '@/components/PageShell';

interface Memory {
  id: string;
  content: string;
  contentType: 'text' | 'image' | 'audio';
  authorId: string;
  isOwnerMemory: boolean;
  createdAt: string;
  author?: {
    full_name: string;
    avatar_url: string | null;
  };
}

interface Hub {
  id: string;
  name: string;
  description: string | null;
  isPublished: boolean;
  createdAt: string;
  ownerId: string;
}

export default function HubDetailPage({ params }: { params: { hubId: string } }) {
  const router = useRouter();
  const { hubId } = params;
  
  const [user, setUser] = useState<any>(null);
  const [hub, setHub] = useState<Hub | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [activeTab, setActiveTab] = useState<'memories' | 'flags' | 'settings'>('memories');
  const [showAddMemory, setShowAddMemory] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push(`/login?redirect=/hubs/${hubId}`);
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
      setIsOwner(hubData.hub.ownerId === userId);

      // Fetch memories
      await loadMemories();
    } catch (err) {
      console.error('Error loading hub:', err);
      setError(err instanceof Error ? err.message : 'Failed to load hub');
    } finally {
      setLoading(false);
    }
  };

  const loadMemories = async () => {
    try {
      const memoriesResponse = await fetch(`/api/hubs/${hubId}/memories`);
      
      if (!memoriesResponse.ok) {
        throw new Error('Failed to load memories');
      }
      
      const memoriesData = await memoriesResponse.json();
      setMemories(memoriesData.memories || []);
    } catch (err) {
      console.error('Error loading memories:', err);
      setError(err instanceof Error ? err.message : 'Failed to load memories');
    }
  };

  const handleMemoryAdded = () => {
    loadMemories();
    setShowAddMemory(false);
  };

  const handleFlagMemory = async (memoryId: string, reason: string) => {
    try {
      const response = await fetch(`/api/hubs/${hubId}/memories/${memoryId}/flag`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        throw new Error('Failed to flag memory');
      }

      alert('Memory has been flagged for review');
    } catch (err) {
      console.error('Error flagging memory:', err);
      alert(err instanceof Error ? err.message : 'Failed to flag memory');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const renderMemoryContent = (memory: Memory) => {
    if (memory.contentType === 'text') {
      return <p className="memory-content">{memory.content}</p>;
    } else if (memory.contentType === 'image') {
      return (
        <div className="memory-image">
          <img 
            src={memory.content} 
            alt="Memory" 
            className="rounded max-h-96 object-contain"
          />
        </div>
      );
    } else if (memory.contentType === 'audio') {
      return (
        <div className="memory-audio">
          <audio controls src={memory.content} className="w-full" />
        </div>
      );
    }
    return <p>Unknown content type</p>;
  };

  if (loading) {
    return (
      <PageShell>
        <main className="container mx-auto px-4 py-8">
          <div className="loading-spinner mx-auto"></div>
          <p className="text-center mt-4">Loading hub...</p>
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
          <Link href="/hubs" className="text-blue-600 hover:underline">
            &larr; Back to Hubs
          </Link>
        </div>

        <div className="hub-header mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold">{hub.name}</h1>
              {hub.description && (
                <p className="text-gray-600 mt-2">{hub.description}</p>
              )}
              <p className="text-sm text-gray-500 mt-2">
                Created on {formatDate(hub.createdAt)}
              </p>
            </div>
            <div className="flex items-center">
              {isOwner && (
                <Link
                  href={`/hubs/${hubId}/settings`}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 mr-2"
                >
                  Settings
                </Link>
              )}
              {!isOwner && (
                <button
                  onClick={() => setShowAddMemory(!showAddMemory)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {showAddMemory ? 'Cancel' : 'Add Memory'}
                </button>
              )}
            </div>
          </div>
        </div>

        {isOwner && (
          <div className="hub-tabs mb-6">
            <div className="flex border-b">
              <button
                onClick={() => setActiveTab('memories')}
                className={`px-4 py-2 ${
                  activeTab === 'memories'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600'
                }`}
              >
                Memories
              </button>
              <button
                onClick={() => setActiveTab('flags')}
                className={`px-4 py-2 ${
                  activeTab === 'flags'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600'
                }`}
              >
                Flagged Content
              </button>
              <button
                onClick={() => setActiveTab('settings')}
                className={`px-4 py-2 ${
                  activeTab === 'settings'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-600'
                }`}
              >
                Settings
              </button>
            </div>
          </div>
        )}

        {activeTab === 'flags' && isOwner ? (
          <FlagsDashboard hubId={hubId} />
        ) : activeTab === 'settings' && isOwner ? (
          <div className="hub-settings">
            <h2 className="text-2xl font-semibold mb-4">Hub Settings</h2>
            <p className="text-gray-600">
              Settings functionality will be implemented soon.
            </p>
          </div>
        ) : (
          <>
            {showAddMemory && !isOwner && (
              <div className="add-memory-section mb-8">
                <AddMemoryForm hubId={hubId} onSuccess={handleMemoryAdded} />
              </div>
            )}

            {isOwner && (
              <div className="owner-actions mb-6">
                <button
                  onClick={() => setShowAddMemory(!showAddMemory)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {showAddMemory ? 'Cancel' : 'Add Memory'}
                </button>
              </div>
            )}

            {showAddMemory && isOwner && (
              <div className="add-memory-section mb-8">
                <AddMemoryForm hubId={hubId} onSuccess={handleMemoryAdded} />
              </div>
            )}

            <div className="memories-section">
              <h2 className="text-2xl font-semibold mb-4">Memories</h2>
              
              {memories.length === 0 ? (
                <div className="empty-state p-8 text-center border rounded bg-gray-50">
                  <p className="text-gray-600">
                    No memories have been added to this hub yet.
                  </p>
                </div>
              ) : (
                <div className="memories-grid grid gap-6">
                  {memories.map((memory) => (
                    <div
                      key={memory.id}
                      className="memory-card p-6 border rounded bg-white"
                    >
                      <div className="memory-header flex justify-between items-start mb-4">
                        <div className="memory-meta">
                          <p className="text-sm text-gray-500">
                            {memory.author?.full_name || 'Anonymous'} • {formatDate(memory.createdAt)}
                          </p>
                        </div>
                        {!isOwner && !memory.isOwnerMemory && (
                          <button
                            onClick={() => {
                              const reason = prompt('Why are you flagging this memory?');
                              if (reason) {
                                handleFlagMemory(memory.id, reason);
                              }
                            }}
                            className="flag-button text-sm text-red-600 hover:underline"
                          >
                            Flag
                          </button>
                        )}
                      </div>
                      
                      <div className="memory-content mb-2">
                        {renderMemoryContent(memory)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </PageShell>
  );
}