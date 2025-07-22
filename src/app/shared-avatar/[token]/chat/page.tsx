'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import ChatInterface from '@/components/ChatInterface';
import '@/styles/legacy-hub.css';

export default function SharedAvatarChatPage() {
  const params = useParams();
  const router = useRouter();
  const shareToken = params.token as string;
  
  const [sharedAvatar, setSharedAvatar] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [memories, setMemories] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'chat' | 'conversations' | 'memories'>('chat');

  // Fetch shared avatar details and user info
  useEffect(() => {
    async function fetchData() {
      try {
        // In a real app, get the current user's ID from auth
        // For now, we'll use a mock user ID based on localStorage
        let currentUserId = localStorage.getItem('sharedAvatarUserId');
        if (!currentUserId) {
          currentUserId = `user-${Math.random().toString(36).substring(2, 9)}`;
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
        
        // Fetch conversations
        if (currentUserId) {
          const conversationsResponse = await fetch(`/api/private-conversations?userId=${currentUserId}&shareToken=${shareToken}`);
          if (conversationsResponse.ok) {
            const conversationsData = await conversationsResponse.json();
            setConversations(conversationsData.conversations || []);
          }
          
          // Fetch memories
          const memoriesResponse = await fetch(`/api/private-memories?userId=${currentUserId}&shareToken=${shareToken}`);
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
      const response = await fetch('/api/private-memories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'create',
          userId,
          avatarId: sharedAvatar.avatar.id,
          shareToken,
          content,
          source: 'manual'
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to create memory');
      }
      
      const data = await response.json();
      
      // Add new memory to the list
      setMemories([data.memory, ...memories]);
    } catch (err) {
      alert('Failed to create memory. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="hub-container">
        <div className="loading-spinner"></div>
        <p className="loading-text">Loading shared avatar...</p>
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
      <Link href="/shared-avatars" className="back-link">
        &larr; Back to Shared Avatars
      </Link>

      <div className="avatar-header">
        <div className="avatar-title-section">
          <h1 className="avatar-title">{avatar.name}</h1>
          <span className={avatar.hasVoice ? 'avatar-has-voice' : 'avatar-no-voice'}>
            {avatar.hasVoice ? 'Has Voice' : 'No Voice'}
          </span>
        </div>
        <p className="avatar-description">
          {avatar.description || 'Chat with this shared avatar and create your own private memories.'}
        </p>
      </div>

      <div className="tabs-list">
        <button
          className={`tab-item ${activeTab === 'chat' ? 'active' : ''}`}
          onClick={() => setActiveTab('chat')}
        >
          Chat
        </button>
        <button
          className={`tab-item ${activeTab === 'conversations' ? 'active' : ''}`}
          onClick={() => setActiveTab('conversations')}
        >
          Past Conversations
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
                userId={userId}
                avatarId={avatar.id}
                initialMessages={[]}
              />
            )}
          </div>
        </div>
      )}

      {activeTab === 'conversations' && (
        <div className="tab-content">
          <div className="tab-header">
            <h2 className="tab-title">Your Past Conversations</h2>
            <button
              onClick={() => setActiveTab('chat')}
              className="btn btn-primary"
            >
              Start New Conversation
            </button>
          </div>

          {conversations.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">💬</div>
              <h3 className="empty-state-title">No Conversations Yet</h3>
              <p className="empty-state-message">
                Start chatting with {avatar.name} to create your first conversation.
              </p>
              <button
                onClick={() => setActiveTab('chat')}
                className="btn btn-primary"
              >
                Start Chatting
              </button>
            </div>
          ) : (
            <div className="conversations-list">
              {conversations.map((conversation) => (
                <div key={conversation.id} className="conversation-card">
                  <div className="conversation-header">
                    <h3 className="conversation-title">Conversation on {new Date(conversation.createdAt).toLocaleDateString()}</h3>
                    <span className="conversation-date">
                      {new Date(conversation.updatedAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="conversation-preview">
                    <p className="visitor-message"><strong>You:</strong> {conversation.lastMessage}</p>
                    <p className="avatar-response"><strong>{avatar.name}:</strong> {conversation.lastResponse}</p>
                  </div>
                  <div className="conversation-footer">
                    <span className="message-count">{conversation.messageCount} messages</span>
                    <button
                      onClick={() => {
                        // In a real app, load this conversation
                        setActiveTab('chat');
                      }}
                      className="btn btn-secondary btn-sm"
                    >
                      Continue Conversation
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
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
                    {memory.content}
                  </div>
                  <div className="memory-footer">
                    <span className="memory-source">
                      {memory.source === 'conversation' ? 'From conversation' : 'Manually added'}
                    </span>
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
    </div>
  );
}