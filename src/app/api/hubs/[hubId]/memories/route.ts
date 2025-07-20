import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createRateLimiter } from '@/lib/rateLimiter';

// Rate limiter for memory creation (5 memories per minute)
const memoryRateLimiter = createRateLimiter({
  interval: 60 * 1000, // 1 minute
  maxRequests: 5,
});

// Validation schema for creating a memory
const createMemorySchema = z.object({
  content: z.string().min(1, 'Content is required'),
  contentType: z.enum(['text', 'image', 'audio']),
  mediaUrl: z.string().url().optional(), // For image/audio content
});

/**
 * Helper function to check if user has access to a hub
 */
async function checkHubAccess(hubId: string, userId: string) {
  const hub = await prisma.hub.findUnique({
    where: { id: hubId },
  });

  if (!hub) {
    return { error: 'Hub not found', status: 404 };
  }

  // Check if hub is published
  if (!hub.isPublished && hub.ownerId !== userId) {
    return { error: 'This hub is not published', status: 403 };
  }

  // Check if user is the owner
  const isOwner = hub.ownerId === userId;

  // If not owner, check if user has viewer access
  if (!isOwner) {
    const viewerAccess = await prisma.viewerAccess.findUnique({
      where: {
        hubId_userId: {
          hubId,
          userId,
        },
      },
    });

    if (!viewerAccess) {
      return { error: 'You do not have access to this hub', status: 403 };
    }
  }

  return { hub, isOwner };
}

/**
 * GET /api/hubs/[hubId]/memories - Get memories for a hub
 * Accessible to owner and authorized viewers
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { hubId: string } }
) {
  try {
    const hubId = params.hubId;
    const { searchParams } = new URL(request.url);
    
    // Pagination parameters
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50); // Max 50 items per page
    const skip = (page - 1) * limit;
    
    // Filter parameters
    const contentType = searchParams.get('contentType');
    const authorId = searchParams.get('authorId');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    // Get the current user from Supabase auth
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user has access to the hub
    const accessCheck = await checkHubAccess(hubId, user.id);
    if ('error' in accessCheck) {
      return NextResponse.json(
        { error: accessCheck.error },
        { status: accessCheck.status }
      );
    }

    // Build filter conditions
    const where: any = { hubId };
    if (contentType) where.contentType = contentType;
    if (authorId) where.authorId = authorId;

    // Get memories with pagination
    const memories = await prisma.memory.findMany({
      where,
      orderBy: {
        [sortBy]: sortOrder,
      },
      skip,
      take: limit,
    });

    // Get total count for pagination
    const totalCount = await prisma.memory.count({ where });

    // Get author information for each memory
    const authorIds = [...new Set(memories.map(memory => memory.authorId))];
    const { data: authors } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', authorIds);

    const authorsMap = (authors || []).reduce((map, author) => {
      map[author.id] = author;
      return map;
    }, {});

    // Enhance memories with author information
    const enhancedMemories = memories.map(memory => ({
      ...memory,
      author: authorsMap[memory.authorId] || { full_name: 'Unknown', avatar_url: null },
    }));

    return NextResponse.json({
      memories: enhancedMemories,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching memories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch memories' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/hubs/[hubId]/memories - Create a new memory
 * Accessible to owner and authorized viewers
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { hubId: string } }
) {
  try {
    const hubId = params.hubId;

    // Get the current user from Supabase auth
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user has access to the hub
    const accessCheck = await checkHubAccess(hubId, user.id);
    if ('error' in accessCheck) {
      return NextResponse.json(
        { error: accessCheck.error },
        { status: accessCheck.status }
      );
    }

    const { hub, isOwner } = accessCheck;

    // Apply rate limiting (only for non-owners)
    if (!isOwner) {
      const rateLimitResult = memoryRateLimiter.check(user.id);
      if (!rateLimitResult.success) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please try again later.' },
          { status: 429 }
        );
      }
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = createMemorySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { content, contentType, mediaUrl } = validationResult.data;

    // Create the memory
    const memory = await prisma.memory.create({
      data: {
        hubId,
        content: contentType === 'text' ? content : mediaUrl || '',
        contentType,
        authorId: user.id,
        isOwnerMemory: isOwner,
      },
    });

    // If the memory was created by a viewer (not the owner),
    // create a notification for the owner
    if (!isOwner) {
      await prisma.notification.create({
        data: {
          userId: hub.ownerId,
          type: 'new_memory',
          content: `Someone added a new ${contentType} memory to your "${hub.name}" hub.`,
          relatedId: memory.id,
        },
      });
    }

    return NextResponse.json({ success: true, memory }, { status: 201 });
  } catch (error) {
    console.error('Error creating memory:', error);
    return NextResponse.json(
      { error: 'Failed to create memory' },
      { status: 500 }
    );
  }
}