import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createApiHandler } from '@/lib/api/routeHandler';
import { 
  createShare, 
  acceptShare, 
  getSharedAvatars, 
  getSharedAvatar,
  getSharesForAvatar,
  revokeShare 
} from '@/lib/services/avatarSharingService';

// Define schemas for validation
const createShareSchema = z.object({
  action: z.literal('create-share'),
  avatarId: z.string(),
  ownerEmail: z.string().email(),
  shareWithEmail: z.string().email(),
  permissions: z.array(z.string()).optional()
});

const acceptShareSchema = z.object({
  action: z.literal('accept-share'),
  shareToken: z.string(),
  userEmail: z.string().email()
});

const getSharedAvatarsSchema = z.object({
  action: z.literal('get-shared-avatars'),
  userEmail: z.string().email()
});

const revokeShareSchema = z.object({
  action: z.literal('revoke-share'),
  shareId: z.string()
});

// Create handlers for each action
const handlers = {
  'create-share': createApiHandler(createShareSchema, createShare),
  'accept-share': createApiHandler(acceptShareSchema, acceptShare),
  'get-shared-avatars': createApiHandler(getSharedAvatarsSchema, getSharedAvatars),
  'revoke-share': createApiHandler(revokeShareSchema, revokeShare)
};

// POST handler for all avatar sharing operations
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
    console.error('Avatar sharing error:', error);
    return NextResponse.json({ error: 'Failed to process avatar sharing request' }, { status: 500 });
  }
}

// GET handler for retrieving shared avatars
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const shareToken = url.searchParams.get('shareToken');
    const avatarId = url.searchParams.get('avatarId');
    const ownerEmail = url.searchParams.get('ownerEmail');
    
    console.log('Avatar sharing GET request with params:', { shareToken, avatarId, ownerEmail });

    if (shareToken) {
      // Get shared avatar by token
      return getSharedAvatar({ shareToken }, request);
    } else if (avatarId && ownerEmail) {
      // Get shares for a specific avatar
      return getSharesForAvatar({ avatarId, ownerEmail }, request);
    } else {
      console.log('Invalid request parameters for avatar sharing GET');
      
      return NextResponse.json({ 
        error: 'Invalid request parameters' 
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in avatar sharing GET API:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}