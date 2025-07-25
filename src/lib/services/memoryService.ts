import { NextRequest, NextResponse } from 'next/server';
import { getCached, setCached } from '@/lib/cache';
import { supabase } from '@/lib/supabase';

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

  // Insert the new memory into the database
  const { data: memory, error } = await supabase
    .from('memory_fragments')
    .insert({
      user_id: userId,
      avatar_id: avatarId,
      fragment_text: content,
      conversation_context: {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Clear cache for this user's memories
  const cacheKey = `memories:${userId}:${avatarId}:${shareToken || 'none'}`;
  setCached(cacheKey, null, 0); // Invalidate cache

  return NextResponse.json({ 
    success: true, 
    memory
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

  // Query the database for real memories
  let query = supabase
    .from('memory_fragments')
    .select('*')
    .eq('user_id', userId);

  if (avatarId) {
    query = query.eq('avatar_id', avatarId);
  }

  const { data: memories, error } = await query.order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Map DB fields to frontend fields
  const mappedMemories = (memories || []).map((m: any) => ({
    id: m.id,
    userId: m.user_id,
    avatarId: m.avatar_id,
    content: m.fragment_text,
    source: m.conversation_context?.source || 'manual',
    createdAt: m.created_at,
    updatedAt: m.updated_at,
    isPrivate: true
  }));

  return NextResponse.json({ 
    success: true, 
    memories: mappedMemories
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