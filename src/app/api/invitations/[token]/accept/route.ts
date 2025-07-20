import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/invitations/[token]/accept - Accept an invitation
 * Public endpoint with authentication
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    // Get the current user from Supabase auth
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Find the invitation
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        hub: {
          select: {
            id: true,
            name: true,
            ownerId: true,
            isPublished: true,
          },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'Invalid invitation token' },
        { status: 404 }
      );
    }

    // Check if invitation is expired
    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Invitation has expired' },
        { status: 410 }
      );
    }

    // Check if invitation has already been used
    if (invitation.isUsed) {
      return NextResponse.json(
        { error: 'Invitation has already been used' },
        { status: 410 }
      );
    }

    // Check if hub is published
    if (!invitation.hub.isPublished) {
      return NextResponse.json(
        { error: 'This hub is not currently published' },
        { status: 403 }
      );
    }

    // Check if user is already a viewer
    const existingAccess = await prisma.viewerAccess.findUnique({
      where: {
        hubId_userId: {
          hubId: invitation.hub.id,
          userId: user.id,
        },
      },
    });

    if (existingAccess) {
      // Mark invitation as used
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { isUsed: true },
      });

      return NextResponse.json({
        success: true,
        message: 'You already have access to this hub',
        hubId: invitation.hub.id,
      });
    }

    // Start a transaction to handle invitation acceptance
    await prisma.$transaction(async (tx) => {
      // Mark invitation as used
      await tx.invitation.update({
        where: { id: invitation.id },
        data: { isUsed: true },
      });

      // Create viewer access
      await tx.viewerAccess.create({
        data: {
          hubId: invitation.hub.id,
          userId: user.id,
          accessLevel: 'viewer',
          lastAccessAt: new Date(),
        },
      });

      // Create a notification for the hub owner
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      const userName = userProfile?.full_name || 'Someone';

      await tx.notification.create({
        data: {
          userId: invitation.hub.ownerId,
          type: 'new_viewer',
          content: `${userName} has joined your "${invitation.hub.name}" hub.`,
          relatedId: invitation.hub.id,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Invitation accepted successfully',
      hubId: invitation.hub.id,
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return NextResponse.json(
      { error: 'Failed to accept invitation' },
      { status: 500 }
    );
  }
}