import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createApiHandler } from '@/lib/api/routeHandler';
import { testAvatarIsolation, testUserIsolation } from '@/lib/services/memoryIsolationService';

/**
 * Test Memory Isolation API
 * 
 * This API tests whether memory isolation is working correctly between different avatars
 * and different users of the same shared avatar.
 */

// Define action literals for type safety
type ActionType = 'test-avatar-isolation' | 'test-user-isolation';

// Define schemas for validation
const avatarIsolationSchema = z.object({
  action: z.literal('test-avatar-isolation'),
  avatarId: z.string(),
  userId: z.string(),
  message: z.string().optional()
});

const userIsolationSchema = z.object({
  action: z.literal('test-user-isolation'),
  shareToken: z.string(),
  userId: z.string(),
  message: z.string().optional()
});

// Create handlers for each action with proper type safety
const handlers: Record<ActionType, (request: NextRequest) => Promise<Response>> = {
  'test-avatar-isolation': createApiHandler(avatarIsolationSchema, testAvatarIsolation),
  'test-user-isolation': createApiHandler(userIsolationSchema, testUserIsolation)
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    // Type-safe check for action
    if (action === 'test-avatar-isolation' || action === 'test-user-isolation') {
      return handlers[action](request);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Error in test-memory-isolation:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}