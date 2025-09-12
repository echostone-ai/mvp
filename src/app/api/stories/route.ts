/**
 * Stories API - Handles story management and retrieval
 * GET /api/stories - Retrieve stories for user/avatar
 * POST /api/stories - Upload and create new story
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureFlag } from '@/lib/featureFlags';
import { createRateLimiter } from '@/lib/rateLimiter';
import { UserStoryService } from '@/lib/services/userStoryService';
import { UserStoryStorageService } from '@/lib/services/userStoryStorageService';
import { getAuthenticatedUser, checkAvatarAccess } from '@/lib/api/auth';
import { UserStory, StoryCategory } from '@/lib/types/stories';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Configure for file uploads
export const config = {
  api: {
    bodyParser: false,
    responseLimit: '10mb',
  },
};

// Rate limiters
const uploadRateLimiter = createRateLimiter({
  interval: 60 * 60 * 1000, // 1 hour
  maxRequests: 10, // 10 uploads per hour per user
});

const retrievalRateLimiter = createRateLimiter({
  interval: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute per user
});



/**
 * Helper function to check per-avatar story limits and feature flags
 */
async function checkAvatarStoryAccess(avatarId: string, userId: string): Promise<{ allowed: boolean; reason?: string }> {
  try {
    console.log('[StoriesAPI] checkAvatarStoryAccess called:', { avatarId, userId });
    
    // Check if avatar belongs to user
    const hasAccess = await checkAvatarAccess(userId, avatarId);
    console.log('[StoriesAPI] checkAvatarAccess result:', hasAccess);
    
    if (!hasAccess) {
      return { allowed: false, reason: 'Access denied: Avatar does not belong to user' };
    }
    
    // Check story count limit (5 stories per avatar)
    const existingStories = await UserStoryService.getStoriesByOwner(avatarId, 'avatar');
    if (existingStories.length >= 5) {
      return { allowed: false, reason: 'Avatar has reached maximum story limit (5 stories)' };
    }

    // TODO: Check per-avatar feature flag toggle
    // This would check if stories are enabled for this specific avatar
    
    return { allowed: true };
  } catch (error) {
    console.error('[StoriesAPI] Error checking avatar access:', error);
    return { allowed: false, reason: 'Error checking avatar permissions' };
  }
}

/**
 * GET /api/stories - Retrieve stories for user/avatar
 */
async function handleGET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const avatarId = searchParams.get('avatarId');
    const ownerType = (searchParams.get('ownerType') || 'avatar') as 'user' | 'avatar';
    const userId = searchParams.get('userId');
    
    // Get client IP for rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';

    // Apply rate limiting
    const rateLimitResult = retrievalRateLimiter.check(clientIP);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)
        },
        { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000).toString(),
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetAt.toString()
          }
        }
      );
    }

    // Validate required parameters
    if (!avatarId) {
      return NextResponse.json(
        { success: false, error: 'avatarId is required' },
        { status: 400 }
      );
    }

    // Check if this is demo mode
    const DEMO_SYSTEM_USER_ID = process.env.DEMO_SYSTEM_USER_ID;
    const isDemoMode = userId === DEMO_SYSTEM_USER_ID && avatarId === 'jonathan-demo';

    // For demo mode, skip authentication
    if (!isDemoMode) {
      // Regular authentication check for non-demo users
      const user = await getAuthenticatedUser(request);
      if (!user) {
        return NextResponse.json(
          { success: false, error: 'Authentication required' },
          { status: 401 }
        );
      }
    }

    console.log(`[StoriesAPI] Fetching stories for ${ownerType}: ${avatarId}${isDemoMode ? ' (demo mode)' : ''}`);

    // Get stories from database
    const stories = await UserStoryService.getStoriesByOwner(avatarId, ownerType);
    
    console.log(`[StoriesAPI] Found ${stories.length} stories for ${avatarId}`);

    // Add rate limit headers
    const response = NextResponse.json({
      success: true,
      stories,
      count: stories.length
    });

    response.headers.set('X-RateLimit-Limit', '100');
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    response.headers.set('X-RateLimit-Reset', rateLimitResult.resetAt.toString());

    return response;

  } catch (error) {
    console.error('[StoriesAPI] Error fetching stories:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stories: [],
      count: 0
    }, { status: 500 });
  }
}

/**
 * POST /api/stories - Upload and create new story
 */
async function handlePOST(request: NextRequest) {
  try {
    // Get client IP for rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || 
                    request.headers.get('x-real-ip') || 
                    'unknown';

    // Apply upload rate limiting
    const rateLimitResult = uploadRateLimiter.check(clientIP);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Upload rate limit exceeded. Please try again later.',
          retryAfter: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)
        },
        { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000).toString(),
            'X-RateLimit-Limit': '10',
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.resetAt.toString()
          }
        }
      );
    }

    // Parse form data first to check for demo mode
    const formData = await request.formData();
    const avatarId = formData.get('avatarId') as string | null;
    const userId = formData.get('userId') as string | null;
    
    // Check if this is demo mode
    const DEMO_SYSTEM_USER_ID = process.env.DEMO_SYSTEM_USER_ID;
    const isDemoMode = userId === DEMO_SYSTEM_USER_ID && avatarId === 'jonathan-demo';

    let user: any = null;
    
    if (isDemoMode) {
      // For demo mode, create a mock user object
      user = { id: DEMO_SYSTEM_USER_ID, email: 'demo@echostone.com' };
      console.log('[StoriesAPI] Demo mode detected:', { userId: DEMO_SYSTEM_USER_ID, avatarId });
    } else {
      // Regular authentication check for non-demo users
      user = await getAuthenticatedUser(request);
      if (!user) {
        return NextResponse.json(
          { success: false, error: 'Authentication required' },
          { status: 401 }
        );
      }
    }

    // Get form data fields
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const category = formData.get('category') as StoryCategory;
    const triggersStr = formData.get('triggers') as string;
    const transcript = formData.get('transcript') as string | null;

    // Validate required fields
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Audio file is required' },
        { status: 400 }
      );
    }

    if (!title || title.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Story title is required' },
        { status: 400 }
      );
    }

    if (!category) {
      return NextResponse.json(
        { success: false, error: 'Story category is required' },
        { status: 400 }
      );
    }

    if (!triggersStr) {
      return NextResponse.json(
        { success: false, error: 'Trigger keywords are required' },
        { status: 400 }
      );
    }

    // Validate category
    const validCategories: StoryCategory[] = ['memory', 'experience', 'advice', 'anecdote'];
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { success: false, error: `Invalid category. Must be one of: ${validCategories.join(', ')}` },
        { status: 400 }
      );
    }

    // Parse and validate triggers
    let triggers: string[];
    try {
      triggers = triggersStr.split(',').map(t => t.trim().toLowerCase()).filter(t => t.length > 0);
      if (triggers.length === 0) {
        throw new Error('At least one trigger keyword is required');
      }
      if (triggers.length > 20) {
        throw new Error('Maximum 20 trigger keywords allowed');
      }
    } catch (error) {
      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : 'Invalid trigger keywords format' },
        { status: 400 }
      );
    }

    // Determine owner
    const ownerType = avatarId ? 'avatar' : 'user';
    const ownerId = avatarId || user.id;

    // Check avatar-specific permissions and limits
    if (avatarId) {
      console.log('[StoriesAPI] Checking avatar access:', { avatarId, userId: user.id, isDemoMode });
      const accessCheck = await checkAvatarStoryAccess(avatarId, user.id);
      console.log('[StoriesAPI] Access check result:', accessCheck);
      if (!accessCheck.allowed) {
        return NextResponse.json(
          { success: false, error: accessCheck.reason || 'Access denied' },
          { status: 403 }
        );
      }
    }

    console.log(`[StoriesAPI] Processing story upload: ${title}, owner: ${ownerType}:${ownerId}`);

    // Upload and process the story
    const story = await UserStoryStorageService.uploadStory(file, {
      ownerId,
      ownerType,
      title: title.trim(),
      category,
      triggers,
      transcript: transcript?.trim() || undefined,
      priority: 50, // Default priority
      status: 'active'
    });

    console.log(`[StoriesAPI] Successfully uploaded story: ${story.id}`);

    // Add rate limit headers
    const response = NextResponse.json({
      success: true,
      data: {
        id: story.id,
        title: story.title,
        category: story.category,
        triggers: story.triggers,
        duration: story.duration,
        audioUrl: story.audioUrl,
        transcript: story.transcript,
        status: story.status,
        createdAt: story.createdAt
      }
    });

    response.headers.set('X-RateLimit-Limit', '10');
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    response.headers.set('X-RateLimit-Reset', rateLimitResult.resetAt.toString());

    return response;

  } catch (error: any) {
    console.error('[StoriesAPI] Upload error:', error);
    
    // Return appropriate error response
    const statusCode = error.message?.includes('exceeds maximum') ? 413 :
                      error.message?.includes('Unsupported') ? 415 :
                      error.message?.includes('Storage upload failed') ? 503 :
                      error.message?.includes('Database') ? 500 : 400;

    return NextResponse.json({
      success: false,
      error: error.message || 'An unexpected error occurred during upload'
    }, { status: statusCode });
  }
}

// Apply feature flag middleware
export const GET = requireFeatureFlag('STORIES_ENABLED')(handleGET);
export const POST = requireFeatureFlag('STORIES_ENABLED')(handlePOST);