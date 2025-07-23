import { NextRequest, NextResponse } from 'next/server';
import { getCached, setCached } from '@/lib/cache';

export interface Memory {
  id: string;
  userId: string;
  avatarId: string;
  shareToken?: string | null;
  content: string;
  source: string;
  createdAt: string;
  updatedAt: string;
  isPrivate: boolean;
}

export async function createMemory(data: {
  userId: string;
  avatarId: string;
  shareToken?: string;
  content: string;
  source?: string;
}, request: NextRequest): Promise<NextResponse> {
  const { userId, avatarId, shareToken, content, source } = data;
  
  if (!userId || !avatarId || !content) {
    return NextResponse.json({ 
      error: 'User ID, Avatar ID, and content are required' 
    }, { status: 400 });
  }

  const newMemory: Memory = {
    id: Math.random().toString(36).substring(2, 15),
    userId,
    avatarId,
    shareToken: shareToken || null,
    content,
    source: source || 'manual',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isPrivate: true
  };

  // Clear cache for this user's memories
  const cacheKey = `memories:${userId}:${avatarId}:${shareToken || 'none'}`;
  setCached(cacheKey, null, 0); // Invalidate cache

  return NextResponse.json({ 
    success: true, 
    memory: newMemory
  });
}

export async function updateMemory(data: {
  memoryId: string;
  content: string;
  userId: string;
}, request: NextRequest): Promise<NextResponse> {
  const { memoryId, content, userId } = data;
  
  if (!memoryId || !content || !userId) {
    return NextResponse.json({ 
      error: 'Memory ID, content, and User ID are required' 
    }, { status: 400 });
  }

  const updatedMemory = {
    id: memoryId,
    content,
    updatedAt: new Date().toISOString()
  };

  return NextResponse.json({ 
    success: true, 
    memory: updatedMemory
  });
}

export async function getMemory(data: {
  memoryId: string;
  userId: string;
}, request: NextRequest): Promise<NextResponse> {
  const { memoryId, userId } = data;
  
  if (!memoryId || !userId) {
    return NextResponse.json({ 
      error: 'Memory ID and User ID are required' 
    }, { status: 400 });
  }

  // Mock memory data (in real app, fetch from database)
  const memory: Memory = {
    id: memoryId,
    userId,
    avatarId: 'avatar-jonathan',
    content: 'Jonathan mentioned he lived in Bulgaria for 6 months and loved the local cuisine.',
    source: 'conversation',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
    isPrivate: true
  };

  return NextResponse.json({ 
    success: true, 
    memory
  });
}

export async function listMemories(data: {
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

  const cacheKey = `memories:${userId}:${avatarId || 'all'}:${shareToken || 'none'}`;
  const cached = getCached<Memory[]>(cacheKey);
  
  if (cached) {
    return NextResponse.json({ 
      success: true, 
      memories: cached
    });
  }

  // Mock memory list (in real app, query from database)
  const memories: Memory[] = [
    {
      id: 'mem-1',
      userId,
      avatarId: avatarId || 'avatar-jonathan',
      shareToken: shareToken || null,
      content: 'Jonathan mentioned he lived in Bulgaria for 6 months and loved the local cuisine.',
      source: 'conversation',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
      isPrivate: true
    },
    {
      id: 'mem-2',
      userId,
      avatarId: avatarId || 'avatar-jonathan',
      shareToken: shareToken || null,
      content: 'Jonathan\'s favorite travel destination is Japan, particularly Kyoto.',
      source: 'conversation',
      createdAt: '2024-01-10T14:00:00Z',
      updatedAt: '2024-01-10T14:00:00Z',
      isPrivate: true
    }
  ];

  setCached(cacheKey, memories, 300000); // Cache for 5 minutes

  return NextResponse.json({ 
    success: true, 
    memories
  });
}

export async function deleteMemory(data: {
  memoryId: string;
  userId: string;
}, request: NextRequest): Promise<NextResponse> {
  const { memoryId, userId } = data;
  
  if (!memoryId || !userId) {
    return NextResponse.json({ 
      error: 'Memory ID and User ID are required' 
    }, { status: 400 });
  }

  // In a real app, validate ownership and delete from database

  return NextResponse.json({ 
    success: true, 
    message: 'Memory deleted successfully'
  });
}