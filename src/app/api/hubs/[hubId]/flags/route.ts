import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkHubAccess } from '@/lib/hubAccess';

// Get flags for a hub
export async function GET(request: NextRequest, { params }: { params: { hubId: string } }) {
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
    
    // Only hub owners can view flags
    if (!access.isOwner) {
      return NextResponse.json({ error: 'Only hub owners can view flags' }, { status: 403 });
    }
    
    // Parse query parameters
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'pending';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    
    // Get flags with pagination
    const flags = await prisma.flag.findMany({
      where: {
        hubId,
        status: status as string
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        memory: true
      }
    });
    
    // Get total count for pagination
    const totalCount = await prisma.flag.count({
      where: {
        hubId,
        status: status as string
      }
    });
    
    // Format the response
    const formattedFlags = await Promise.all(flags.map(async (flag) => {
      // In a real app, you would fetch reporter details from your user service
      // For now, we'll use mock reporter data
      const reporter = {
        full_name: 'Hub Viewer',
        avatar_url: null
      };
      
      return {
        ...flag,
        reporter
      };
    }));
    
    return NextResponse.json({
      flags: formattedFlags,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching flags:', error);
    return NextResponse.json({ error: 'Failed to fetch flags' }, { status: 500 });
  }
}