import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createApiHandler } from '@/lib/api/routeHandler';
import { 
  createConversation, 
  addMessage, 
  getConversation, 
  listConversations, 
  deleteConversation 
} from '@/lib/services/conversationService';

// Define action literals for type safety
type ActionType = 'create' | 'add-message' | 'get-conversation' | 'list-conversations' | 'delete';

// Define schemas for validation
const createSchema = z.object({
  action: z.literal('create'),
  userId: z.string(),
  avatarId: z.string(),
  shareToken: z.string().optional(),
  initialMessage: z.string().optional()
});

const addMessageSchema = z.object({
  action: z.literal('add-message'),
  conversationId: z.string(),
  message: z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string()
  })
});

const getConversationSchema = z.object({
  action: z.literal('get-conversation'),
  conversationId: z.string(),
  userId: z.string()
});

const listConversationsSchema = z.object({
  action: z.literal('list-conversations'),
  userId: z.string(),
  avatarId: z.string().optional(),
  shareToken: z.string().optional()
});

const deleteSchema = z.object({
  action: z.literal('delete'),
  conversationId: z.string(),
  userId: z.string()
});

// Create handlers for each action with proper type safety
const handlers: Record<ActionType, (request: NextRequest) => Promise<Response>> = {
  'create': createApiHandler(createSchema, createConversation),
  'add-message': createApiHandler(addMessageSchema, addMessage),
  'get-conversation': createApiHandler(getConversationSchema, getConversation),
  'list-conversations': createApiHandler(listConversationsSchema, listConversations),
  'delete': createApiHandler(deleteSchema, deleteConversation)
};

// API endpoint for managing private conversations with shared avatars
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({
        error: 'Action is required'
      }, { status: 400 });
    }

    // Type-safe check for action
    if (action === 'create' || 
        action === 'add-message' || 
        action === 'get-conversation' || 
        action === 'list-conversations' || 
        action === 'delete') {
      return handlers[action](request);
    }

    return NextResponse.json({
      error: 'Invalid action'
    }, { status: 400 });
  } catch (error) {
    console.error('Private conversation error:', error);
    return NextResponse.json({
      error: 'Failed to process conversation request'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  const avatarId = url.searchParams.get('avatarId');
  const shareToken = url.searchParams.get('shareToken');
  const conversationId = url.searchParams.get('conversationId');

  if (!userId) {
    return NextResponse.json({
      error: 'User ID is required'
    }, { status: 400 });
  }

  try {
    if (conversationId) {
      // Get specific conversation
      return getConversation({
        action: 'get-conversation',
        conversationId,
        userId
      }, request);
    } else {
      // List conversations
      return listConversations({
        action: 'list-conversations',
        userId,
        avatarId: avatarId || undefined,
        shareToken: shareToken || undefined
      }, request);
    }
  } catch (error) {
    console.error('Error in conversations GET:', error);
    return NextResponse.json({
      error: 'Failed to process request'
    }, { status: 500 });
  }
}