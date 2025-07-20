import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

// Validation schema for updating a hub
const updateHubSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100).optional(),
  description: z.string().max(500).optional(),
  isPublished: z.boolean().optional(),
});

/**
 * Helper function to check if user has access to a hub
 */
async function checkHubAccess(hubId: string, userId: string, requireOwner = false) {
  const hub = await prisma.hub.findUnique({
    where: { id: hubId },
  });

  if (!hub) {
    return { error: 'Hub not found', status: 404 };
  }

  // Check if user is the owner
  const isOwner = hub.ownerId === userId;

  // If owner access is required, check that first
  if (requireOwner && !isOwner) {
    return { error: 'Only the owner can perform this action', status: 403 };
  }

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
 * GET /api/hubs/[hubId] - Get a specific hub
 * Accessible to owner and authorized viewers
 */
export async function GET(
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

    // Get hub details with memories
    const hubWithDetails = await prisma.hub.findUnique({
      where: { id: hubId },
      include: {
        memories: {
          orderBy: { createdAt: 'desc' },
          take: 20, // Limit to 20 most recent memories
        },
        _count: {
          select: {
            memories: true,
            flags: {
              where: { status: 'pending' },
            },
          },
        },
      },
    });

    // Get owner profile from Supabase
    const { data: ownerData } = await supabase
      .from('profiles')
      .select('full_name, avatar_url')
      .eq('id', hub.ownerId)
      .single();

    return NextResponse.json({
      hub: hubWithDetails,
      isOwner,
      owner: ownerData || { full_name: 'Unknown', avatar_url: null },
    });
  } catch (error) {
    console.error('Error fetching hub:', error);
    return NextResponse.json(
      { error: 'Failed to fetch hub' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/hubs/[hubId] - Update a hub
 * Owner only endpoint
 */
export async function PUT(
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

    // Check if user is the owner
    const accessCheck = await checkHubAccess(hubId, user.id, true);
    if ('error' in accessCheck) {
      return NextResponse.json(
        { error: accessCheck.error },
        { status: accessCheck.status }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = updateHubSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    // Update the hub
    const updatedHub = await prisma.hub.update({
      where: { id: hubId },
      data: validationResult.data,
    });

    return NextResponse.json({ success: true, hub: updatedHub });
  } catch (error) {
    console.error('Error updating hub:', error);
    return NextResponse.json(
      { error: 'Failed to update hub' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/hubs/[hubId] - Delete a hub
 * Owner only endpoint
 */
export async function DELETE(
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

    // Check if user is the owner
    const accessCheck = await checkHubAccess(hubId, user.id, true);
    if ('error' in accessCheck) {
      return NextResponse.json(
        { error: accessCheck.error },
        { status: accessCheck.status }
      );
    }

    // Delete the hub (cascade will handle related records)
    await prisma.hub.delete({
      where: { id: hubId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting hub:', error);
    return NextResponse.json(
      { error: 'Failed to delete hub' },
      { status: 500 }
    );
  }
}