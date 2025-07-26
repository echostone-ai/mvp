import { NextRequest, NextResponse } from 'next/server';
import { MemoryService } from '@/lib/memoryService';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const avatarId = url.searchParams.get('avatarId');
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    
    console.log('[api/memories] Fetching memories for user:', userId, 'avatar:', avatarId);
    
    // Build query
    let query = supabase
      .from('memory_fragments')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    // Add avatar filter if provided
    if (avatarId) {
      query = query.eq('avatar_id', avatarId);
    }
    
    const { data: memories, error } = await query;
    
    if (error) {
      console.error('[api/memories] Database error:', error);
      return NextResponse.json({ error: 'Failed to fetch memories' }, { status: 500 });
    }
    
    console.log(`[api/memories] Found ${memories.length} memories`);
    
    return NextResponse.json({ 
      success: true, 
      memories: memories || [] 
    });
    
  } catch (error) {
    console.error('[api/memories] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, userId, avatarId, content, source, timestamp } = body;
    
    if (!userId || !content) {
      return NextResponse.json({ error: 'User ID and content are required' }, { status: 400 });
    }
    
    console.log('[api/memories] Creating memory for user:', userId, 'avatar:', avatarId);
    
    if (action === 'create') {
      // Store the memory using MemoryService
      const memoryId = await MemoryService.storeSimpleMemory(userId, content, avatarId);
      
      console.log('[api/memories] Created memory with ID:', memoryId);
      
      return NextResponse.json({ 
        success: true, 
        id: memoryId,
        message: 'Memory created successfully' 
      });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    
  } catch (error) {
    console.error('[api/memories] Error creating memory:', error);
    return NextResponse.json({ error: 'Failed to create memory' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const memoryId = url.searchParams.get('memoryId');
    const userId = url.searchParams.get('userId');
    
    if (!memoryId || !userId) {
      return NextResponse.json({ error: 'Memory ID and User ID are required' }, { status: 400 });
    }
    
    console.log('[api/memories] Deleting memory:', memoryId, 'for user:', userId);
    
    const { error } = await supabase
      .from('memory_fragments')
      .delete()
      .eq('id', memoryId)
      .eq('user_id', userId);
    
    if (error) {
      console.error('[api/memories] Delete error:', error);
      return NextResponse.json({ error: 'Failed to delete memory' }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Memory deleted successfully' 
    });
    
  } catch (error) {
    console.error('[api/memories] Error deleting memory:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}