import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createApiHandler } from '@/lib/api/routeHandler';
import { 
  createMemory, 
  updateMemory, 
  getMemory, 
  listMemories, 
  deleteMemory 
} from '@/lib/services/memoryService';

// Define action literals for type safety
type ActionType = 'create' | 'update' | 'get' | 'list' | 'delete';

// Define schemas for validation
const createMemorySchema = z.object({
  action: z.literal('create'),
  userId: z.string(),
  avatarId: z.string(),
  shareToken: z.string().optional(),
  content: z.string(),
  source: z.string().optional()
});

const updateMemorySchema = z.object({
  action: z.literal('update'),
  memoryId: z.string(),
  userId: z.string(),
  content: z.string()
});

const getMemorySchema = z.object({
  action: z.literal('get'),
  memoryId: z.string(),
  userId: z.string()
});

const listMemoriesSchema = z.object({
  action: z.literal('list'),
  userId: z.string(),
  avatarId: z.string().optional(),
  shareToken: z.string().optional()
});

const deleteMemorySchema = z.object({
  action: z.literal('delete'),
  memoryId: z.string(),
  userId: z.string()
});

// Create handlers for each action with proper type safety
const handlers: Record<ActionType, (request: NextRequest) => Promise<Response>> = {
  'create': createApiHandler(createMemorySchema, createMemory),
  'update': createApiHandler(updateMemorySchema, updateMemory),
  'get': createApiHandler(getMemorySchema, getMemory),
  'list': createApiHandler(listMemoriesSchema, listMemories),
  'delete': createApiHandler(deleteMemorySchema, deleteMemory)
};

// POST handler for all memory operations
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    if (action in handlers) {
      // Pass the request to the correct handler (handler will parse the body again if needed)
      return handlers[action](request);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Private memory error:', error);
    return NextResponse.json({ error: 'Failed to process memory request' }, { status: 500 });
  }
}

// GET handler for retrieving memories
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const avatarId = url.searchParams.get('avatarId');
    const shareToken = url.searchParams.get('shareToken');
    const memoryId = url.searchParams.get('memoryId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (memoryId) {
      // Get specific memory
      return getMemory({ 
        action: 'get',
        memoryId, 
        userId 
      }, request);
    } else {
      // List memories
      return listMemories({ 
        action: 'list',
        userId, 
        avatarId, 
        shareToken 
      }, request);
    }
  } catch (error) {
    console.error('Error in memories GET API:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}