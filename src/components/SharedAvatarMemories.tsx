'use client';

import React, { useState, useEffect } from 'react';
// CSS is imported in the layout file

interface Memory {
  id: string;
  userId: string;
  avatarId: string;
  shareToken?: string;
  content: string;
  source: string;
  createdAt: string;
  updatedAt: string;
  isPrivate: boolean;
}

interface SharedAvatarMemoriesProps {
  userId: string;
  avatarId: string;
  shareToken?: string;
  avatarName: string;
}

export default function SharedAvatarMemories({ userId, avatarId, shareToken, avatarName }: SharedAvatarMemoriesProps) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newMemoryContent, setNewMemoryContent] = useState('');
  const [isAddingMemory, setIsAddingMemory] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch memories
  useEffect(() => {
    async function fetchMemories() {
      try {
        const response = await fetch('/api/private-memories', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'list',
            userId,
            avatarId,
            shareToken
          })
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch memories');
        }
        
        const data = await response.json();
        setMemories(data.memories || []);
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Failed to load memories');
        setLoading(false);
      }
    }

    fetchMemories();
  }, [userId, avatarId, shareToken]);

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMemoryContent.trim()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/private-memories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'create',
          userId,
          avatarId,
          shareToken,
          content: newMemoryContent.trim(),
          source: 'manual'
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to create memory');
      }
      
      const data = await response.json();
      
      // Add new memory to the list
      setMemories([data.memory, ...memories]);
      setNewMemoryContent('');
      setIsAddingMemory(false);
    } catch (err: any) {
      setError(err.message || 'Failed to create memory');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMemory = async (memoryId: string) => {
    if (!confirm('Are you sure you want to delete this memory?')) {
      return;
    }
    
    try {
      const response = await fetch('/api/private-memories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'delete',
          memoryId,
          userId
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete memory');
      }
      
      // Remove memory from the list
      setMemories(memories.filter(memory => memory.id !== memoryId));
    } catch (err: any) {
      setError(err.message || 'Failed to delete memory');
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p className="loading-text">Loading memories...</p>
      </div>
    );
  }

  return (
    <div className="memories-container">
      <div className="memories-header">
        <h2 className="memories-title">Your Memories with {avatarName}</h2>
        <button
          className="btn btn-primary"
          onClick={() => setIsAddingMemory(true)}
        >
          Add New Memory
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {isAddingMemory && (
        <form onSubmit={handleAddMemory} className="memory-form">
          <div className="form-group">
            <label htmlFor="memory-content" className="form-label">Memory Content</label>
            <textarea
              id="memory-content"
              value={newMemoryContent}
              onChange={(e) => setNewMemoryContent(e.target.value)}
              className="form-textarea"
              placeholder="Enter something you want to remember about this avatar..."
              rows={3}
              required
            />
          </div>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsAddingMemory(false)}
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
      )}

      {memories.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🧠</div>
          <h3 className="empty-state-title">No Memories Yet</h3>
          <p className="empty-state-message">
            As you chat with {avatarName}, important information will be saved as memories.
            You can also manually add memories that you want to remember.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => setIsAddingMemory(true)}
          >
            Add Your First Memory
          </button>
        </div>
      ) : (
        <div className="memories-list">
          {memories.map((memory) => (
            <div key={memory.id} className="memory-card">
              <div className="memory-content">
                {memory.content}
              </div>
              <div className="memory-footer">
                <div className="memory-meta">
                  <span className="memory-source">
                    {memory.source === 'conversation' ? 'From conversation' : 'Manually added'}
                  </span>
                  <span className="memory-date">
                    {new Date(memory.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteMemory(memory.id)}
                  className="btn btn-danger btn-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}