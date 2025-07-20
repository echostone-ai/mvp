import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkHubAccess } from '@/lib/hubAccess';
import crypto from 'crypto';

// Define the params type
type RouteParams = {
  params: {
    hubId: string;
  }
};


// Get invitations for a hub
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = session.user.id;
    const hubId = params.hubId;
    
    // Check if user has access to the hub
    const access = await checkHubAccess(hubId, userId);
    if (!access.hasAccess) {
      return NextResponse.json({ error: access.message }, { status: access.status });
    }
    
    // Only hub owners can view invitations
    if (!access.isOwner) {
      return NextResponse.json({ error: 'Only hub owners can view invitations' }, { status: 403 });
    }
    
    // Get invitations
    const invitations = await prisma.invitation.findMany({
      where: {
        hubId
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return NextResponse.json({ invitations });
  } catch (error) {
    console.error('Error fetching invitations:', error);
    return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
  }
}

// Create a new invitation
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = session.user.id;
    const hubId = params.hubId;
    
    // Check if user has access to the hub
    const access = await checkHubAccess(hubId, userId);
    if (!access.hasAccess) {
      return NextResponse.json({ error: access.message }, { status: access.status });
    }
    
    // Only hub owners can create invitations
    if (!access.isOwner) {
      return NextResponse.json({ error: 'Only hub owners can create invitations' }, { status: 403 });
    }
    
    // Parse request body
    const body = await request.json();
    
    // Generate a secure token
    const token = crypto.randomBytes(32).toString('hex');
    
    // Set expiration date (default: 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (body.expiresInDays || 7));
    
    // Create the invitation
    const invitation = await prisma.invitation.create({
      data: {
        hubId,
        email: body.email || null,
        token,
        expiresAt,
        isUsed: false
      }
    });
    
    // Generate the invitation URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const invitationUrl = `${baseUrl}/invite/${token}`;
    
    // If email is provided, we would send an email here
    // For now, just return the invitation URL
    
    return NextResponse.json({ 
      success: true, 
      invitation: {
        id: invitation.id,
        token: invitation.token,
        expiresAt: invitation.expiresAt,
        url: invitationUrl
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating invitation:', error);
    return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
  }
}