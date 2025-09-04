/**
 * Individual Story API - Handles operations on specific stories
 * PUT /api/stories/[id] - Update story details and status
 * DELETE /api/stories/[id] - Delete a specific story
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireFeatureFlag } from '@/lib/featureFlags';
import { createRateLimiter } from '@/lib/rateLimiter';
import { UserStoryService } from '@/lib/services/userStoryService';
import { getAuthenticatedUser } from '@/lib/api/auth';
import { StoryCategory, StoryStatus } from '@/lib/types/stories';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Rate limiters for individual story operations
const updateRateLimiter = createRateLimiter({
  interval: 60 * 1000, // 1 minute
  maxRequests: 30, // 30 updates per minute per user
});

const deleteRateLimiter = createRateLimiter({
  interval: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 deletes per minute per user
});

/**
 * Helper function to validate story ID parameter
 */
function validateStoryId(id: string): { valid: boolean; error?: string } {
  if (!id || typeof id !== 'string') {
    return { valid: false, error: 'Story ID is required' };
  }
  
  // Basic UUID validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return { valid: false, error: 'Invalid story ID format' };
  }
  
  return { valid: true };
}

/**
 * Helper function to apply rate limiting
 */
function applyRateLimit(
  request: NextRequest, 
  limiter: ReturnType<typeof createRateLimiter>,
  limitName: string,
  maxRequests: number
): NextResponse | null {
  const clientIP = request.headers.get('x-forwarded-for') || 
                  request.headers.get('x-real-ip') || 
                  'unknown';

  const rateLimitResult = limiter.check(clientIP);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { 
        success: false, 
        error: `${limitName} rate limit exceeded. Please try again later.`,
        retryAfter: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)
      },
      { 
        status: 429,
        headers: {
          'Retry-After': Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000).toString(),
          'X-RateLimit-Limit': maxRequests.toString(),
          'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
          'X-RateLimit-Reset': rateLimitResult.resetAt.toString()
        }
      }
    );
  }
  
  return null;
}

/**
 * PUT /api/stories/[id] - Update story details and status
 */
async function handlePUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Validate story ID
    const idValidation = validateStoryId(params.id);
    if (!idValidation.valid) {
      return NextResponse.json(
        { success: false, error: idValidation.error },
        { status: 400 }
      );
    }

    // Apply rate limiting
    const rateLimitResponse = applyRateLimit(request, updateRateLimiter, 'Update', 30);
    if (rateLimitResponse) return rateLimitResponse;

    // Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { title, category, triggers, transcript, priority, status } = body;

    // Validate update fields
    const updates: any = {};
    const errors: string[] = [];

    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim().length === 0) {
        errors.push('Title must be a non-empty string');
      } else if (title.length > 255) {
        errors.push('Title must be less than 255 characters');
      } else {
        updates.title = title.trim();
      }
    }

    if (category !== undefined) {
      const validCategories: StoryCategory[] = ['memory', 'experience', 'advice', 'anecdote'];
      if (!validCategories.includes(category)) {
        errors.push(`Invalid category. Must be one of: ${validCategories.join(', ')}`);
      } else {
        updates.category = category;
      }
    }

    if (triggers !== undefined) {
      if (!Array.isArray(triggers)) {
        errors.push('Triggers must be an array of strings');
      } else {
        const processedTriggers = triggers
          .map(t => typeof t === 'string' ? t.trim().toLowerCase() : '')
          .filter(t => t.length > 0);
        
        if (processedTriggers.length === 0) {
          errors.push('At least one trigger keyword is required');
        } else if (processedTriggers.length > 20) {
          errors.push('Maximum 20 trigger keywords allowed');
        } else {
          updates.triggers = processedTriggers;
        }
      }
    }

    if (transcript !== undefined) {
      if (transcript !== null && typeof transcript !== 'string') {
        errors.push('Transcript must be a string or null');
      } else if (transcript && transcript.length > 10000) {
        errors.push('Transcript must be less than 10,000 characters');
      } else {
        updates.transcript = transcript;
      }
    }

    if (priority !== undefined) {
      if (typeof priority !== 'number' || priority < 0 || priority > 100) {
        errors.push('Priority must be a number between 0 and 100');
      } else {
        updates.priority = priority;
      }
    }

    if (status !== undefined) {
      const validStatuses: StoryStatus[] = ['active', 'inactive', 'processing', 'failed'];
      if (!validStatuses.includes(status)) {
        errors.push(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
      } else {
        updates.status = status;
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: errors },
        { status: 400 }
      );
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid updates provided' },
        { status: 400 }
      );
    }

    console.log(`[StoriesAPI] Updating story ${params.id} for user ${user.id}`);

    // Update the story using UserStoryService
    const storyService = new UserStoryService();
    const updatedStory = await storyService.updateStory(params.id, updates, user.id);

    console.log(`[StoriesAPI] Successfully updated story: ${updatedStory.id}`);

    // Add rate limit headers to response
    const response = NextResponse.json({
      success: true,
      data: {
        id: updatedStory.id,
        title: updatedStory.title,
        category: updatedStory.category,
        triggers: updatedStory.triggers,
        transcript: updatedStory.transcript,
        priority: updatedStory.priority,
        status: updatedStory.status,
        updatedAt: updatedStory.updated_at
      }
    });

    const rateLimitResult = updateRateLimiter.check(
      request.headers.get('x-forwarded-for') || 'unknown'
    );
    response.headers.set('X-RateLimit-Limit', '30');
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    response.headers.set('X-RateLimit-Reset', rateLimitResult.resetAt.toString());

    return response;

  } catch (error: any) {
    console.error('[StoriesAPI] Update error:', error);
    
    // Handle specific error types
    if (error.message?.includes('Story not found') || error.message?.includes('access denied')) {
      return NextResponse.json({
        success: false,
        error: 'Story not found or access denied'
      }, { status: 404 });
    }
    
    if (error.message?.includes('Access denied')) {
      return NextResponse.json({
        success: false,
        error: 'You can only update your own stories'
      }, { status: 403 });
    }
    
    if (error.message?.includes('Validation')) {
      return NextResponse.json({
        success: false,
        error: error.message
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: 'An unexpected error occurred while updating the story'
    }, { status: 500 });
  }
}

/**
 * DELETE /api/stories/[id] - Delete a specific story
 */
async function handleDELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Validate story ID
    const idValidation = validateStoryId(params.id);
    if (!idValidation.valid) {
      return NextResponse.json(
        { success: false, error: idValidation.error },
        { status: 400 }
      );
    }

    // Apply rate limiting
    const rateLimitResponse = applyRateLimit(request, deleteRateLimiter, 'Delete', 10);
    if (rateLimitResponse) return rateLimitResponse;

    // Authenticate user
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    console.log(`[StoriesAPI] Deleting story ${params.id} for user ${user.id}`);

    // Delete the story using UserStoryService
    const storyService = new UserStoryService();
    const success = await storyService.deleteStory(params.id, user.id);

    if (!success) {
      return NextResponse.json({
        success: false,
        error: 'Failed to delete story'
      }, { status: 500 });
    }

    console.log(`[StoriesAPI] Successfully deleted story: ${params.id}`);

    // Add rate limit headers to response
    const response = NextResponse.json({
      success: true,
      message: 'Story deleted successfully'
    });

    const rateLimitResult = deleteRateLimiter.check(
      request.headers.get('x-forwarded-for') || 'unknown'
    );
    response.headers.set('X-RateLimit-Limit', '10');
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    response.headers.set('X-RateLimit-Reset', rateLimitResult.resetAt.toString());

    return response;

  } catch (error: any) {
    console.error('[StoriesAPI] Delete error:', error);
    
    // Handle specific error types
    if (error.message?.includes('Story not found') || error.message?.includes('access denied')) {
      return NextResponse.json({
        success: false,
        error: 'Story not found or access denied'
      }, { status: 404 });
    }
    
    if (error.message?.includes('Access denied')) {
      return NextResponse.json({
        success: false,
        error: 'You can only delete your own stories'
      }, { status: 403 });
    }

    return NextResponse.json({
      success: false,
      error: 'An unexpected error occurred while deleting the story'
    }, { status: 500 });
  }
}

// Apply feature flag middleware
export const PUT = requireFeatureFlag('STORIES_ENABLED')(handlePUT);
export const DELETE = requireFeatureFlag('STORIES_ENABLED')(handleDELETE);