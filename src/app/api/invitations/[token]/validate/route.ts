import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';




// Validate an invitation token
export async function GET(request: NextRequest, { params }: { params: { token: string } }) {
  try {
    const token = params.token;
    
    // Find the invitation
    const invitation = await prisma.invitation.findUnique({
      where: {
        token
      },
      include: {
        hub: {
          select: {
            id: true,
            name: true,
            description: true,
            ownerId: true,
            isPublished: true
          }
        }
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
    
    return NextResponse.json({ 
      valid: true,
      hub: {
        id: invitation.hub.id,
        name: invitation.hub.name,
        description: invitation.hub.description
      }
    });
  } catch (error) {
    console.error('Error validating invitation:', error);
    return NextResponse.json({ error: 'Failed to validate invitation' }, { status: 500 });
  }
}