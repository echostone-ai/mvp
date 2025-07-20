'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface Flag {
  id: string;
  memoryId: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  memory: {
    id: string;
    content: string;
    contentType: string;
    authorId: string;
    isOwnerMemory: boolean;
    createdAt: string;
  };
  reporter: {
    full_name: string;
    avatar_url: string | null;
  };
}

interface FlagsDashboardProps {
  hubId: string;
}

export default function FlagsDashboard({ hubId }: FlagsDashboardProps) {
  const router = useRouter();
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFlag, setActiveFlag] = useState<Flag | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  useEffect(() => {
    loadFlags();
  }, [hubId]);

  const loadFlags = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/hubs/${hubId}/flags?status=pending`);
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load flags');
      }

      const data = await response.json();
      setFlags(data.flags || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleResolveFlag = async (flagId: string, action: 'approve' | 'remove') => {
    setIsResolving(true);
    
    try {
      const response = await fetch(`/api/hubs/${hubId}/flags/${flagId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to resolve flag');
      }

      // Remove the resolved flag from the list
      setFlags(prev => prev.filter(flag => flag.id !== flagId));
      setActiveFlag(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsResolving(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMemoryContent = (memory: Flag['memory']) => {
    if (memory.contentType === 'text') {
      return <p className="memory-content">{memory.content}</p>;
    } else if (memory.contentType === 'image') {
      return (
        <div className="memory-image">
          <Image 
            src={memory.content} 
            alt="Flagged image" 
            width={300} 
            height={200} 
            className="rounded"
            objectFit="cover"
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

  if (loading && flags.length === 0) {
    return (
      <div className="flags-dashboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading flags...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flags-dashboard-error">
        <p className="error-message">{error}</p>
        <button onClick={loadFlags} className="retry-button">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="flags-dashboard">
      <div className="flags-header">
        <h2 className="text-2xl font-bold">Flagged Content</h2>
        <p className="text-gray-600">
          {flags.length === 0
            ? 'No flagged content to review'
            : `${flags.length} item${flags.length === 1 ? '' : 's'} flagged for review`}
        </p>
      </div>

      {flags.length === 0 ? (
        <div className="empty-state p-8 text-center">
          <div className="empty-icon text-4xl mb-4">🏆</div>
          <h3 className="text-xl font-medium mb-2">All Clear!</h3>
          <p className="text-gray-600">
            There are no flagged items that need your attention.
          </p>
        </div>
      ) : (
        <div className="flags-list">
          {flags.map((flag) => (
            <div
              key={flag.id}
              className={`flag-item p-4 border rounded mb-4 ${
                activeFlag?.id === flag.id ? 'border-blue-500 bg-blue-50' : ''
              }`}
            >
              <div className="flag-header flex justify-between items-center mb-3">
                <div className="flag-meta">
                  <span className="flag-date text-sm text-gray-500">
                    {formatDate(flag.createdAt)}
                  </span>
                  <span className="flag-reporter ml-2 text-sm">
                    Flagged by {flag.reporter.full_name}
                  </span>
                </div>
                <div className="flag-actions">
                  {activeFlag?.id !== flag.id ? (
                    <button
                      onClick={() => setActiveFlag(flag)}
                      className="review-button px-3 py-1 bg-blue-600 text-white rounded text-sm"
                    >
                      Review
                    </button>
                  ) : (
                    <button
                      onClick={() => setActiveFlag(null)}
                      className="cancel-button px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              <div className="flag-reason mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                <strong>Reason:</strong> {flag.reason}
              </div>

              {activeFlag?.id === flag.id && (
                <div className="flag-details">
                  <div className="memory-preview mb-4 p-3 bg-white border rounded">
                    <h4 className="text-sm font-medium mb-2">Flagged Content:</h4>
                    {renderMemoryContent(flag.memory)}
                  </div>

                  <div className="resolution-actions flex space-x-3">
                    <button
                      onClick={() => handleResolveFlag(flag.id, 'approve')}
                      disabled={isResolving}
                      className="keep-button flex-1 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-green-300"
                    >
                      {isResolving ? 'Processing...' : 'Keep Memory'}
                    </button>
                    <button
                      onClick={() => handleResolveFlag(flag.id, 'remove')}
                      disabled={isResolving}
                      className="remove-button flex-1 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-red-300"
                    >
                      {isResolving ? 'Processing...' : 'Remove Memory'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}