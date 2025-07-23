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

// Define schemas for validation
const createConversationSchema = z.object({
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

const deleteConversationSchema = z.object({
  action: z.literal('delete'),
  conversationId: z.string(),
  userId: z.string()
});

// Create handlers for each action
const handlers = {
  'create': createApiHandler(createConversationSchema, createConversation),
  'add-message': createApiHandler(addMessageSchema, addMessage),
  'get-conversation': createApiHandler(getConversationSchema, getConversation),
  'list-conversations': createApiHandler(listConversationsSchema, listConversations),
  'delete': createApiHandler(deleteConversationSchema, deleteConversation)
};

// POST handler for all conversation operations
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    const handler = handlers[action];
    if (!handler) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return handler(request);
  } catch (error) {
    console.error('Private conversation error:', error);
    return NextResponse.json({ error: 'Failed to process conversation request' }, { status: 500 });
  }
}

// GET handler for retrieving conversations
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const avatarId = url.searchParams.get('avatarId');
    const shareToken = url.searchParams.get('shareToken');
    const conversationId = url.searchParams.get('conversationId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (conversationId) {
      // Get specific conversation
      return getConversation({ conversationId, userId }, request);
    } else {
      // List conversations
      return listConversations({ userId, avatarId, shareToken }, request);
    }
  } catch (error) {
    console.error('Error in conversations GET API:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}