import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

// Validation schema for resolving a flag
const resolveFlagSchema = z.object({
  action: z.enum(['approve', 'remove']),
  message: z.string().max(500).optional(),
});

/**
 * POST /api/hubs/[hubId]/flags/[flagId]/resolve - Resolve a flag
 * Owner only endpoint
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { hubId: string; flagId: string } }
) {
  try {
    const { hubId, flagId } = params;

    // Get the current user from Supabase auth
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Check if user is the owner of the hub
    const hub = await prisma.hub.findUnique({
      where: { id: hubId },
    });

    if (!hub) {
      return NextResponse.json(
        { error: 'Hub not found' },
        { status: 404 }
      );
    }

    if (hub.ownerId !== user.id) {
      return NextResponse.json(
        { error: 'Only the owner can resolve flags' },
        { status: 403 }
      );
    }

    // Check if the flag exists
    const flag = await prisma.flag.findUnique({
      where: {
        id: flagId,
        hubId,
      },
      include: {
        memory: true,
      },
    });

    if (!flag) {
      return NextResponse.json(
        { error: 'Flag not found' },
        { status: 404 }
      );
    }

    if (flag.status !== 'pending') {
      return NextResponse.json(
        { error: 'This flag has already been resolved' },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = resolveFlagSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { action, message } = validationResult.data;

    // Start a transaction to handle flag resolution
    await prisma.$transaction(async (tx) => {
      // Update the flag status
      await tx.flag.update({
        where: { id: flagId },
        data: {
          status: action === 'approve' ? 'rejected' : 'approved',
          resolvedAt: new Date(),
        },
      });

      // If action is 'remove', delete the memory
      if (action === 'remove') {
        await tx.memory.delete({
          where: { id: flag.memoryId },
        });
      }

      // Create a notification for the reporter
      await tx.notification.create({
        data: {
          userId: flag.reporterId,
          type: 'flag_resolved',
          content: action === 'approve' 
            ? `Your flag in "${hub.name}" was reviewed, but the content was kept.`
            : `Your flag in "${hub.name}" was approved and the content was removed.`,
          relatedId: flagId,
        },
      });
    });

    return NextResponse.json({
      success: true,
      action,
      message: action === 'approve' 
        ? 'Flag rejected, memory kept' 
        : 'Flag approved, memory removed',
    });
  } catch (error) {
    console.error('Error resolving flag:', error);
    return NextResponse.json(
      { error: 'Failed to resolve flag' },
      { status: 500 }
    );
  }
}