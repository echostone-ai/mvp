import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { checkHubAccess } from '@/lib/hubAccess';

// Get viewers for a hub
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
    
    // Only hub owners can view viewers
    if (!access.isOwner) {
      return NextResponse.json({ error: 'Only hub owners can view viewers' }, { status: 403 });
    }
    
    // Get viewers
    const viewers = await prisma.viewerAccess.findMany({
      where: {
        hubId
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    // Format the response
    // In a real app, you would fetch user details from your user service
    const formattedViewers = viewers.map(viewer => ({
      ...viewer,
      user: {
        full_name: 'Hub Viewer',
        email: 'viewer@example.com',
        avatar_url: null
      }
    }));
    
    return NextResponse.json({ viewers: formattedViewers });
  } catch (error) {
    console.error('Error fetching viewers:', error);
    return NextResponse.json({ error: 'Failed to fetch viewers' }, { status: 500 });
  }
}