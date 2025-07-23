import { NextRequest, NextResponse } from 'next/server';
import { getCached, setCached } from '@/lib/cache';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface Conversation {
  id: string;
  userId: string;
  avatarId: string;
  shareToken?: string | null;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  messageCount: number;
  lastMessage?: string;
  lastResponse?: string;
}

export async function createConversation(data: {
  userId: string;
  avatarId: string;
  shareToken?: string;
  initialMessage?: string;
}, request: NextRequest): Promise<NextResponse> {
  const { userId, avatarId, shareToken, initialMessage } = data;

  if (!userId || !avatarId) {
    return NextResponse.json({
      error: 'User ID and Avatar ID are required'
    }, { status: 400 });
  }

  const conversationId = Math.random().toString(36).substring(2, 15);

  const newConversation: Conversation = {
    id: conversationId,
    userId,
    avatarId,
    shareToken: shareToken || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: initialMessage ? [
      {
        id: Math.random().toString(36).substring(2, 15),
        role: 'user',
        content: initialMessage,
        timestamp: new Date().toISOString()
      }
    ] : [],
    messageCount: initialMessage ? 1 : 0
  };

  // Clear cache for this user's conversations
  const cacheKey = `conversations:${userId}:${avatarId}:${shareToken || 'none'}`;
  setCached(cacheKey, null, 0); // Invalidate cache

  return NextResponse.json({
    success: true,
    conversation: newConversation
  });
}

export async function addMessage(data: {
  conversationId: string;
  message: {
    role: 'user' | 'assistant';
    content: string;
  };
}, request: NextRequest): Promise<NextResponse> {
  const { conversationId, message } = data;

  if (!conversationId || !message || !message.content || !message.role) {
    return NextResponse.json({
      error: 'Conversation ID and valid message are required'
    }, { status: 400 });
  }

  const newMessage: Message = {
    id: Math.random().toString(36).substring(2, 15),
    ...message,
    timestamp: new Date().toISOString()
  };

  return NextResponse.json({
    success: true,
    message: newMessage,
    conversationId
  });
}

export async function getConversation(data: {
  conversationId: string;
  userId: string;
}, request: NextRequest): Promise<NextResponse> {
  const { conversationId, userId } = data;

  if (!conversationId || !userId) {
    return NextResponse.json({
      error: 'Conversation ID and User ID are required'
    }, { status: 400 });
  }

  const cacheKey = `conversation:${conversationId}`;
  const cached = getCached<Conversation>(cacheKey);
  
  if (cached) {
    return NextResponse.json({
      success: true,
      conversation: cached
    });
  }

  // Mock conversation data (in real app, fetch from database)
  const conversation: Conversation = {
    id: conversationId,
    userId,
    avatarId: 'avatar-jonathan',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:30:00Z',
    messages: [
      {
        id: '1',
        role: 'user',
        content: 'Hi Jonathan, tell me about your travels.',
        timestamp: '2024-01-15T10:00:00Z'
      },
      {
        id: '2',
        role: 'assistant',
        content: 'I\'ve been to over 30 countries! My favorites include Bulgaria, Japan, and New Zealand. Each place has its own unique charm and stories.',
        timestamp: '2024-01-15T10:00:30Z'
      },
      {
        id: '3',
        role: 'user',
        content: 'Tell me more about Bulgaria.',
        timestamp: '2024-01-15T10:15:00Z'
      },
      {
        id: '4',
        role: 'assistant',
        content: 'Bulgaria is amazing! Sofia has this incredible mix of ancient history and modern city life. The food is fantastic - banitsa for breakfast became my daily ritual. And the people are so welcoming!',
        timestamp: '2024-01-15T10:15:30Z'
      }
    ],
    messageCount: 4
  };

  setCached(cacheKey, conversation, 300000); // Cache for 5 minutes

  return NextResponse.json({
    success: true,
    conversation
  });
}

export async function listConversations(data: {
  userId: string;
  avatarId?: string;
  shareToken?: string;
}, request: NextRequest): Promise<NextResponse> {
  const { userId, avatarId, shareToken } = data;

  if (!userId) {
    return NextResponse.json({
      error: 'User ID is required'
    }, { status: 400 });
  }

  const cacheKey = `conversations:${userId}:${avatarId || 'all'}:${shareToken || 'none'}`;
  const cached = getCached<Conversation[]>(cacheKey);
  
  if (cached) {
    return NextResponse.json({
      success: true,
      conversations: cached
    });
  }

  // Mock conversation list (in real app, query from database)
  const conversations: Conversation[] = [
    {
      id: 'conv-1',
      userId,
      avatarId: avatarId || 'avatar-jonathan',
      shareToken: shareToken || null,
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:30:00Z',
      lastMessage: 'Tell me more about Bulgaria.',
      lastResponse: 'Bulgaria is amazing! Sofia has this incredible mix of ancient history and modern city life...',
      messageCount: 4,
      messages: []
    },
    {
      id: 'conv-2',
      userId,
      avatarId: avatarId || 'avatar-jonathan',
      shareToken: shareToken || null,
      createdAt: '2024-01-10T14:00:00Z',
      updatedAt: '2024-01-10T14:45:00Z',
      lastMessage: 'What foods do you recommend in Japan?',
      lastResponse: 'Oh, Japanese cuisine is incredible! Beyond just sushi, you should try okonomiyaki in Osaka...',
      messageCount: 8,
      messages: []
    }
  ];

  setCached(cacheKey, conversations, 300000); // Cache for 5 minutes

  return NextResponse.json({
    success: true,
    conversations
  });
}

export async function deleteConversation(data: {
  conversationId: string;
  userId: string;
}, request: NextRequest): Promise<NextResponse> {
  const { conversationId, userId } = data;

  if (!conversationId || !userId) {
    return NextResponse.json({
      error: 'Conversation ID and User ID are required'
    }, { status: 400 });
  }

  // In a real app, validate ownership and delete from database

  return NextResponse.json({
    success: true,
    message: 'Conversation deleted successfully'
  });
}