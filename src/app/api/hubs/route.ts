import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

// Validation schema for creating a hub
const createHubSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().max(500).optional(),
  isPublished: z.boolean().optional().default(false),
});

/**
 * POST /api/hubs - Create a new Legacy Hub
 * Owner only endpoint
 */
export async function POST(request: NextRequest) {
  try {
    // Get the current user from Supabase auth
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = createHubSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validationResult.error.format() },
        { status: 400 }
      );
    }

    const { name, description, isPublished } = validationResult.data;

    // Create the hub in the database
    const hub = await prisma.hub.create({
      data: {
        name,
        description,
        ownerId: user.id,
        isPublished,
      },
    });

    return NextResponse.json({ success: true, hub }, { status: 201 });
  } catch (error) {
    console.error('Error creating hub:', error);
    return NextResponse.json(
      { error: 'Failed to create hub' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/hubs - Get all hubs owned by the current user
 */
export async function GET(request: NextRequest) {
  try {
    // Get the current user from Supabase auth
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get all hubs owned by the user
    const hubs = await prisma.hub.findMany({
      where: {
        ownerId: user.id,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return NextResponse.json({ hubs });
  } catch (error) {
    console.error('Error fetching hubs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch hubs' },
      { status: 500 }
    );
  }
}