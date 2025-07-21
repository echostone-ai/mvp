'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
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

interface Memory {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  createdBy: string;
}

export default function HubDetailPage() {
  const params = useParams();
  const hubId = params.hubId as string;

  const [hub, setHub] = useState<Hub | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'memories' | 'flagged' | 'settings'>('memories');
  const [newMemory, setNewMemory] = useState({ title: '', content: '' });
  const [isAddingMemory, setIsAddingMemory] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch hub details
  useEffect(() => {
    async function fetchHubDetails() {
      try {
        // In a real app, this would be a fetch to your API
        // For now, we'll simulate it with mock data
        const mockHub: Hub = {
          id: hubId,
          name: hubId === 'example-1' ? 'Family Memories' : 'Travel Adventures',
          description: hubId === 'example-1'
            ? 'A collection of family memories and stories from our adventures together.'
            : 'Memories from my travels around the world.',
          isPublished: hubId === 'example-1',
          createdAt: new Date().toISOString(),
          ownerId: 'user-123',
          _count: {
            memories: hubId === 'example-1' ? 5 : 10,
            viewers: hubId === 'example-1' ? 2 : 0
          }
        };

        setHub(mockHub);

        // Mock memories
        const mockMemories: Memory[] = [];
        if (hubId === 'example-1') {
          mockMemories.push(
            {
              id: '1',
              title: 'Summer Vacation 2023',
              content: 'We had an amazing time at the beach house. The kids loved building sandcastles and swimming in the ocean.',
              createdAt: '2023-07-15T12:00:00Z',
              createdBy: 'John Doe'
            },
            {
              id: '2',
              title: 'Grandma\'s Birthday',
              content: 'We celebrated Grandma\'s 80th birthday with a surprise party. Everyone from the family was there!',
              createdAt: '2023-05-22T14:30:00Z',
              createdBy: 'Jane Smith'
            }
          );
        }

        setMemories(mockMemories);
        setLoading(false);
      } catch (err) {
        setError('Failed to load hub details');
        setLoading(false);
      }
    }

    fetchHubDetails();
  }, [hubId]);

  const handleAddMemory = () => {
    setIsAddingMemory(true);
  };

  const handleCancelAddMemory = () => {
    setIsAddingMemory(false);
    setNewMemory({ title: '', content: '' });
  };

  const handleSubmitMemory = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMemory.title || !newMemory.content) {
      return;
    }

    setIsSubmitting(true);

    try {
      // In a real app, this would be a fetch to your API
      // For now, we'll simulate it

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      const newMemoryItem: Memory = {
        id: Math.random().toString(36).substring(2, 9),
        title: newMemory.title,
        content: newMemory.content,
        createdAt: new Date().toISOString(),
        createdBy: 'Current User'
      };

      setMemories([newMemoryItem, ...memories]);
      setNewMemory({ title: '', content: '' });
      setIsAddingMemory(false);
    } catch (err) {
      setError('Failed to add memory');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePublishToggle = async () => {
    if (!hub) return;

    try {
      // In a real app, this would be a fetch to your API
      // For now, we'll simulate it

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      setHub({
        ...hub,
        isPublished: !hub.isPublished
      });
    } catch (err) {
      setError('Failed to update hub status');
    }
  };

  if (loading) {
    return (
      <div className="hub-container">
        <div className="loading-spinner"></div>
        <p className="loading-text">Loading hub details...</p>
      </div>
    );
  }

  if (error || !hub) {
    return (
      <div className="hub-container">
        <div className="error-message">
          {error || 'Hub not found'}
        </div>
        <Link href="/hubs" className="btn btn-primary">
          Back to Hubs
        </Link>
      </div>
    );
  }

  return (
    <div className="hub-container">
      <Link href="/hubs" className="back-link">
        &larr; Back to Hubs
      </Link>

      <div className="hub-header">
        <div className="hub-title-section">
          <h1 className="hub-title">{hub.name}</h1>
          <span className={`hub-status ${hub.isPublished ? 'hub-status-published' : 'hub-status-draft'}`}>
            {hub.isPublished ? 'Published' : 'Draft'}
          </span>
        </div>
        <p className="hub-description">
          {hub.description}
        </p>
      </div>

      <div className="tabs-list">
        <button
          className={`tab-item ${activeTab === 'memories' ? 'active' : ''}`}
          onClick={() => setActiveTab('memories')}
        >
          Memories
        </button>
        <button
          className={`tab-item ${activeTab === 'flagged' ? 'active' : ''}`}
          onClick={() => setActiveTab('flagged')}
        >
          Flagged Content
        </button>
        <button
          className={`tab-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          Settings
        </button>
      </div>

      {activeTab === 'memories' && (
        <div className="tab-content">
          <div className="tab-header">
            <h2 className="tab-title">Memories</h2>
            {!isAddingMemory && (
              <button className="btn btn-primary" onClick={handleAddMemory}>
                Add Memory
              </button>
            )}
          </div>

          {isAddingMemory && (
            <div className="memory-form-container">
              <h3 className="memory-form-title">Add New Memory</h3>
              <form onSubmit={handleSubmitMemory} className="memory-form">
                <div className="form-group">
                  <label htmlFor="memory-title" className="form-label">Title</label>
                  <input
                    type="text"
                    id="memory-title"
                    value={newMemory.title}
                    onChange={(e) => setNewMemory({ ...newMemory, title: e.target.value })}
                    className="form-input"
                    placeholder="Enter a title for this memory"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="memory-content" className="form-label">Content</label>
                  <textarea
                    id="memory-content"
                    value={newMemory.content}
                    onChange={(e) => setNewMemory({ ...newMemory, content: e.target.value })}
                    className="form-textarea"
                    placeholder="Describe this memory..."
                    rows={5}
                    required
                  />
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleCancelAddMemory}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Saving...' : 'Save Memory'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {!isAddingMemory && memories.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">📝</div>
              <h3 className="empty-state-title">No Memories Yet</h3>
              <p className="empty-state-message">
                Start adding memories to your hub to see them here.
              </p>
              <button className="btn btn-primary" onClick={handleAddMemory}>
                Add Memory
              </button>
            </div>
          )}

          {!isAddingMemory && memories.length > 0 && (
            <div className="memories-list">
              {memories.map((memory) => (
                <div key={memory.id} className="memory-card">
                  <h3 className="memory-title">{memory.title}</h3>
                  <p className="memory-content">{memory.content}</p>
                  <div className="memory-meta">
                    <span className="memory-author">Added by {memory.createdBy}</span>
                    <span className="memory-date">
                      {new Date(memory.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'flagged' && (
        <div className="tab-content">
          <h2 className="tab-title">Flagged Content</h2>
          <div className="empty-state">
            <div className="empty-state-icon">🚩</div>
            <h3 className="empty-state-title">No Flagged Content</h3>
            <p className="empty-state-message">
              Content that gets flagged for review will appear here.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="tab-content">
          <h2 className="tab-title">Hub Settings</h2>

          <div className="settings-section">
            <h3 className="settings-section-title">General Settings</h3>

            <div className="form-group">
              <label htmlFor="hub-name" className="form-label">Hub Name</label>
              <input
                type="text"
                id="hub-name"
                value={hub.name}
                className="form-input"
                readOnly
              />
              <p className="form-help">To change the hub name, please contact support.</p>
            </div>

            <div className="form-group">
              <label htmlFor="hub-description" className="form-label">Description</label>
              <textarea
                id="hub-description"
                value={hub.description}
                className="form-textarea"
                rows={3}
                readOnly
              />
              <p className="form-help">To change the description, please contact support.</p>
            </div>

            <div className="form-group form-checkbox">
              <input
                type="checkbox"
                id="hub-published"
                checked={hub.isPublished}
                onChange={handlePublishToggle}
              />
              <label htmlFor="hub-published">
                Published
              </label>
              <p className="form-help">
                When published, people with invitations can view and contribute to your hub.
              </p>
            </div>
          </div>

          <div className="settings-section">
            <h3 className="settings-section-title">Manage Access</h3>
            <p className="settings-description">
              Invite people to view and contribute to your hub.
            </p>

            <div className="invite-form">
              <input
                type="email"
                className="form-input"
                placeholder="Enter email address"
              />
              <button className="btn btn-primary">
                Send Invite
              </button>
            </div>

            <div className="empty-state small">
              <h3 className="empty-state-title">No Invitations Sent</h3>
              <p className="empty-state-message">
                Invite people to collaborate on your hub.
              </p>
            </div>
          </div>

          <div className="settings-section danger-zone">
            <h3 className="settings-section-title">Danger Zone</h3>
            <p className="settings-description">
              These actions cannot be undone.
            </p>

            <div className="danger-actions">
              <button className="btn btn-danger">
                Delete Hub
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}