import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { sendNotification } from '@/lib/notifications';

// Validation schema for flagging a memory
const flagMemorySchema = z.object({
  reason: z.string().min(1, 'Reason is required').max(500),
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
 * POST /api/hubs/[hubId]/memories/[memoryId]/flag - Flag a memory
 * Accessible to authorized viewers
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { hubId: string; memoryId: string } }
) {
  try {
    const { hubId, memoryId } = params;

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

    // Check if the memory exists
    const memory = await prisma.memory.findUnique({
      where: {
        id: memoryId,
        hubId,
      },
    });

    if (!memory) {
      return NextResponse.json(
        { error: 'Memory not found' },
        { status: 404 }
      );
    }

    // Owners shouldn't flag their own hub's memories
    if (isOwner) {
      return NextResponse.json(
        { error: 'As the owner, you can directly remove memories instead of flagging them' },
        { status: 400 }
      );
    }

    // Check if user is trying to flag their own memory
    if (memory.authorId === user.id) {
      return NextResponse.json(
        { error: 'You cannot flag your own memory' },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = flagMemorySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { reason } = validationResult.data;

    // Check if user has already flagged this memory
    const existingFlag = await prisma.flag.findFirst({
      where: {
        memoryId,
        reporterId: user.id,
        status: 'pending',
      },
    });

    if (existingFlag) {
      return NextResponse.json(
        { error: 'You have already flagged this memory' },
        { status: 400 }
      );
    }

    // Create the flag
    const flag = await prisma.flag.create({
      data: {
        hubId,
        memoryId,
        reporterId: user.id,
        reason,
        status: 'pending',
      },
    });

    // Get reporter information
    const { data: reporter } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();

    const reporterName = reporter?.full_name || 'A viewer';

    // Create a notification for the owner
    await prisma.notification.create({
      data: {
        userId: hub.ownerId,
        type: 'flag',
        content: `${reporterName} flagged a memory in your "${hub.name}" hub.`,
        relatedId: flag.id,
      },
    });

    // Send email notification to owner
    await sendNotification({
      userId: hub.ownerId,
      type: 'flag',
      title: 'Content Flagged in Your Legacy Hub',
      message: `${reporterName} has flagged content in your "${hub.name}" hub. Please review it in your dashboard.`,
      actionUrl: `/dashboard/hubs/${hubId}/flags`,
    });

    return NextResponse.json({ success: true, flag }, { status: 201 });
  } catch (error) {
    console.error('Error flagging memory:', error);
    return NextResponse.json(
      { error: 'Failed to flag memory' },
      { status: 500 }
    );
  }
}