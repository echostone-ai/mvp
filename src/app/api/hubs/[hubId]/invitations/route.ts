import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { generateSecureToken } from '@/lib/security';
import { sendNotification } from '@/lib/notifications';

// Validation schema for creating an invitation
const createInvitationSchema = z.object({
  email: z.string().email().optional(),
  expiresInDays: z.number().int().min(1).max(30).default(7),
});

/**
 * POST /api/hubs/[hubId]/invitations - Create a new invitation
 * Owner only endpoint
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
        { error: 'Only the owner can create invitations' },
        { status: 403 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = createInvitationSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { email, expiresInDays } = validationResult.data;

    // Generate a secure token
    const token = await generateSecureToken();

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Create the invitation
    const invitation = await prisma.invitation.create({
      data: {
        hubId,
        email,
        token,
        expiresAt,
      },
    });

    // Generate invitation URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const invitationUrl = `${baseUrl}/invite/${token}`;

    // If email is provided, send invitation email
    if (email) {
      // Get owner information
      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();

      const ownerName = ownerProfile?.full_name || 'Someone';

      await sendNotification({
        email,
        type: 'invitation',
        title: `You've been invited to ${hub.name}`,
        message: `${ownerName} has invited you to view and contribute to their Legacy Hub "${hub.name}". Click the link below to accept the invitation.`,
        actionUrl: invitationUrl,
      });
    }

    return NextResponse.json({
      success: true,
      invitation: {
        ...invitation,
        url: invitationUrl,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating invitation:', error);
    return NextResponse.json(
      { error: 'Failed to create invitation' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/hubs/[hubId]/invitations - Get invitations for a hub
 * Owner only endpoint
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
        { error: 'Only the owner can view invitations' },
        { status: 403 }
      );
    }

    // Get invitations
    const invitations = await prisma.invitation.findMany({
      where: {
        hubId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Generate invitation URLs
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const enhancedInvitations = invitations.map(invitation => ({
      ...invitation,
      url: `${baseUrl}/invite/${invitation.token}`,
      isExpired: invitation.expiresAt < new Date(),
    }));

    return NextResponse.json({ invitations: enhancedInvitations });
  } catch (error) {
    console.error('Error fetching invitations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invitations' },
      { status: 500 }
    );
  }
}