import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Accept an invitation
export async function POST(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = session.user.id;
    const token = params.token;
    
    // Find the invitation
    const invitation = await prisma.invitation.findUnique({
      where: {
        token
      },
      include: {
        hub: true
      }
    });
    
    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }
    
    // Check if invitation is expired
    if (invitation.expiresAt < new Date()) {
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 410 });
    }
    
    // Check if invitation is already used
    if (invitation.isUsed) {
      return NextResponse.json({ error: 'Invitation has already been used' }, { status: 410 });
    }
    
    // Check if hub is published
    if (!invitation.hub.isPublished) {
      return NextResponse.json({ error: 'This hub is not currently available' }, { status: 403 });
    }
    
    // Check if user is already a viewer
    const existingAccess = await prisma.viewerAccess.findUnique({
      where: {
        hubId_userId: {
          hubId: invitation.hubId,
          userId
        }
      }
    });
    
    if (existingAccess) {
      return NextResponse.json({ error: 'You already have access to this hub' }, { status: 400 });
    }
    
    // Create viewer access and mark invitation as used
    await prisma.$transaction([
      prisma.viewerAccess.create({
        data: {
          hubId: invitation.hubId,
          userId,
          accessLevel: 'contributor',
          lastAccessAt: new Date()
        }
      }),
      prisma.invitation.update({
        where: {
          id: invitation.id
        },
        data: {
          isUsed: true
        }
      })
    ]);
    
    // Create notification for the hub owner
    await prisma.notification.create({
      data: {
        userId: invitation.hub.ownerId,
        type: 'invitation',
        content: `Someone has accepted your invitation to "${invitation.hub.name}"`,
        relatedId: invitation.hubId
      }
    });
    
    return NextResponse.json({ 
      success: true, 
      message: 'Invitation accepted successfully',
      hub: {
        id: invitation.hubId,
        name: invitation.hub.name
      }
    });
  } catch (error) {
    console.error('Error accepting invitation:', error);
    return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
  }
}