// [AI Assistant] File updated to confirm userId logic and enable git tracking.
'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import ChatInterface from '@/components/ChatInterface';
import { getStoredVisitorInfo, storeVisitorInfo, createVisitorId } from '@/lib/avatarDataService';
import { v4 as uuidv4, validate as uuidValidate } from 'uuid';
import { error } from 'console';
import loading from '@/app/profile/edit/[section]/loading';
// CSS is imported in the layout file

export default function SharedAvatarChatPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const shareToken = params.token as string;
  
  // Get user info from URL params or localStorage
  const userEmailParam = searchParams.get('userEmail');
  const userNameParam = searchParams.get('userName');
  
  const [sharedAvatar, setSharedAvatar] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(userEmailParam);
  const [userName, setUserName] = useState<string | null>(userNameParam);
  const [memories, setMemories] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'chat' | 'memories'>('chat');
  const [showWelcomeMessage, setShowWelcomeMessage] = useState(true);

  // Fetch shared avatar details and user info
  useEffect(() => {
    async function fetchData() {
      try {
        // Check if we have user info from URL params
        let visitorEmail = userEmailParam;
        let visitorName = userNameParam;
        
        // If not, try to get from localStorage
        if (!visitorEmail) {
          const storedVisitor = getStoredVisitorInfo(shareToken);
          if (storedVisitor) {
            visitorEmail = storedVisitor.email;
            visitorName = storedVisitor.name;
            setUserEmail(visitorEmail);
            setUserName(visitorName);
          } else {
            // No stored visitor and no URL params - redirect to the invitation page
            router.push(`/shared-avatar/${shareToken}`);
            return;
          }
        } else {
          // We have URL params - store them for future visits
          storeVisitorInfo(shareToken, visitorEmail, visitorName || undefined);
        }
        
        // Always use a UUID for userId, never an email
        let currentUserId = localStorage.getItem('sharedAvatarUserId');
        // If the stored value is not a valid UUID, clear it
        if (!currentUserId || !uuidValidate(currentUserId)) {
          currentUserId = uuidv4();
          localStorage.setItem('sharedAvatarUserId', currentUserId);
        }
        setUserId(currentUserId);
        
        // Fetch shared avatar details
        const avatarResponse = await fetch(`/api/avatar-sharing?shareToken=${shareToken}`);
        
        if (!avatarResponse.ok) {
          throw new Error('Failed to fetch shared avatar details');
        }
        
        const avatarData = await avatarResponse.json();
        
        if (!avatarData.success || !avatarData.sharedAvatar || !avatarData.sharedAvatar.isValid) {
          throw new Error('This sharing link is invalid or has expired');
        }
        
        setSharedAvatar(avatarData.sharedAvatar);
        
        // Fetch memories using the main memories API
        if (currentUserId) {
          const memoriesResponse = await fetch(`/api/memories?userId=${currentUserId}&avatarId=${avatarData.sharedAvatar.avatar.id}`);
          if (memoriesResponse.ok) {
            const memoriesData = await memoriesResponse.json();
            setMemories(memoriesData.memories || []);
          }
        }
        
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Failed to load shared avatar');
        setLoading(false);
      }
    }

    fetchData();
  }, [shareToken]);

  const handleCreateMemory = async () => {
    if (!userId || !sharedAvatar) return;
    
    const content = prompt('Enter a new memory:');
    if (!content) return;
    
    try {
      // Use the MemoryService to store the memory properly
      const response = await fetch('/api/memories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'create',
          userId,
          avatarId: sharedAvatar.avatar.id,
          content,
          source: 'manual',
          timestamp: new Date().toISOString()
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to create memory');
      }
      
      const data = await response.json();
      
      // Create a properly formatted memory object
      const newMemory = {
        id: data.id || Date.now().toString(),
        fragment_text: content,
        user_id: userId,
        avatar_id: sharedAvatar.avatar.id,
        created_at: new Date().toISOString(),
        source: 'manual'
      };
      
      // Add new memory to the list
      setMemories([newMemory, ...memories]);
    } catch (err) {
      console.error('Failed to create memory:', err);
      alert('Failed to create memory. Please try again.');
    }
  };

  // Auto-hide welcome message after a few seconds
  useEffect(() => {
    if (showWelcomeMessage) {
      const timer = setTimeout(() => {
        setShowWelcomeMessage(false);
      }, 5000); // Hide after 5 seconds
      
      return () => clearTimeout(timer);
    }
  }, [showWelcomeMessage]);

  if (loading) {
    return (
      <div className="hub-container">
        <div className="loading-spinner"></div>
        <p className="loading-text">Loading your conversation with {userName ? `${userName}'s` : ''} avatar...</p>
      </div>
    );
  }

  if (error || !sharedAvatar) {
    return (
      <div className="hub-container">
        <div className="error-message">
          {error || 'Shared avatar not found'}
        </div>
        <Link href="/" className="btn btn-primary">
          Return to Home
        </Link>
      </div>
    );
  }

  const { avatar } = sharedAvatar;

  return (
    <div className="hub-container">
      <div className="content-container">
        {/* Welcome message for returning visitors */}
        {showWelcomeMessage && userName && (
          <div className="welcome-message">
            <div className="welcome-content">
              <h3>Welcome back, {userName}!</h3>
              <p>{avatar.name} is ready to continue your conversation.</p>
            </div>
            <button 
              className="welcome-close" 
              onClick={() => setShowWelcomeMessage(false)}
              aria-label="Close welcome message"
            >
              ×
            </button>
          </div>
        )}

        <div className="avatar-header">
          <div className="avatar-profile-section">
            <div className="avatar-photo-container">
              {avatar.photoUrl ? (
                <img src={avatar.photoUrl} alt={avatar.name} className="avatar-photo" />
              ) : (
                <div className="avatar-photo-placeholder">
                  {avatar.name.charAt(0)}
                </div>
              )}
            </div>
            <div className="avatar-info">
              <h1 className="avatar-title">Chat with {avatar.name}</h1>
              <p className="avatar-description">
                {avatar.description || `Your private conversation with ${avatar.name}. Your chat history will be saved for future visits.`}
              </p>
            </div>
          </div>
        </div>

      <div className="tabs-list">
        <button
          className={`tab-item ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          Chat
        </button>
        <button
          className={`tab-item ${activeTab === 'memories' ? 'active' : ''}`}
          onClick={() => setActiveTab('memories')}
        >
          Your Memories
        </button>
      </div>

      {activeTab === 'chat' && (
        <div className="tab-content">
          <div className="chat-container">
            {userId && (
              <ChatInterface
                profileData={avatar.profileData}
                voiceId={avatar.voiceId}
                accent={avatar.accent}
                userId={userId}
                avatarId={avatar.id}
                initialMessages={[]}
                visitorName={userName || undefined}
                isSharedAvatar={true}
                shareToken={shareToken}
                voiceSettings={avatar.voiceSettings}
              />
            )}
          </div>
        </div>
      )}


      {activeTab === 'memories' && (
        <div className="tab-content">
          <div className="tab-header">
            <h2 className="tab-title">Your Memories with {avatar.name}</h2>
            <button
              onClick={handleCreateMemory}
              className="btn btn-primary"
            >
              Add Memory
            </button>
          </div>

          {memories.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🧠</div>
              <h3 className="empty-state-title">No Memories Yet</h3>
              <p className="empty-state-message">
                As you chat with {avatar.name}, important information will be saved as memories.
                You can also manually add memories.
              </p>
              <button
                onClick={handleCreateMemory}
                className="btn btn-primary"
              >
                Add Your First Memory
              </button>
            </div>
          ) : (
            <div className="memories-list">
              {memories.map((memory) => (
                <div key={memory.id} className="memory-card">
                  <div className="memory-content">
                    {memory.fragment_text || memory.content || 'No content available'}
                  </div>
                  <div className="memory-footer">
                    <span className="memory-source">
                      {memory.source === 'manual' ? 'Manually added' : 'From conversation'}
                    </span>
                    <span className="memory-date">
                      {memory.created_at ? new Date(memory.created_at).toLocaleDateString() : 
                       memory.createdAt ? new Date(memory.createdAt).toLocaleDateString() : 
                       'Unknown date'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}