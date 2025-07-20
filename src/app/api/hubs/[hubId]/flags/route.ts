import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/hubs/[hubId]/flags - Get flags for a hub
 * Owner only endpoint
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { hubId: string } }
) {
  try {
    const hubId = params.hubId;
    const { searchParams } = new URL(request.url);
    
    // Filter parameters
    const status = searchParams.get('status') || 'pending';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50); // Max 50 items per page
    const skip = (page - 1) * limit;

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
        { error: 'Only the owner can view flags' },
        { status: 403 }
      );
    }

    // Get flags with pagination
    const flags = await prisma.flag.findMany({
      where: {
        hubId,
        status: status as string,
      },
      include: {
        memory: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    });

    // Get total count for pagination
    const totalCount = await prisma.flag.count({
      where: {
        hubId,
        status: status as string,
      },
    });

    // Get reporter information for each flag
    const reporterIds = [...new Set(flags.map(flag => flag.reporterId))];
    const { data: reporters } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', reporterIds);

    const reportersMap = (reporters || []).reduce((map, reporter) => {
      map[reporter.id] = reporter;
      return map;
    }, {});

    // Enhance flags with reporter information
    const enhancedFlags = flags.map(flag => ({
      ...flag,
      reporter: reportersMap[flag.reporterId] || { full_name: 'Unknown', avatar_url: null },
    }));

    return NextResponse.json({
      flags: enhancedFlags,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching flags:', error);
    return NextResponse.json(
      { error: 'Failed to fetch flags' },
      { status: 500 }
    );
  }
}