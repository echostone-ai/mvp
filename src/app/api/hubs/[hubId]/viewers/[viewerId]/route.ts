import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { checkHubAccess } from '@/lib/hubAccess';

// Delete a viewer's access
export async function DELETE(request: NextRequest, { params }: { params: { hubId: string, viewerId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = session.user.id;
    const { hubId, viewerId } = params;
    
    // Check if user has access to the hub
    const access = await checkHubAccess(hubId, userId);
    if (!access.hasAccess) {
      return NextResponse.json({ error: access.message }, { status: access.status });
    }
    
    // Only hub owners can remove viewers
    if (!access.isOwner) {
      return NextResponse.json({ error: 'Only hub owners can remove viewers' }, { status: 403 });
    }
    
    // Get the viewer access
    const viewerAccess = await prisma.viewerAccess.findUnique({
      where: {
        id: viewerId
      }
    });
    
    if (!viewerAccess) {
      return NextResponse.json({ error: 'Viewer access not found' }, { status: 404 });
    }
    
    // Check if the viewer access belongs to the hub
    if (viewerAccess.hubId !== hubId) {
      return NextResponse.json({ error: 'Viewer access does not belong to this hub' }, { status: 400 });
    }
    
    // Delete the viewer access
    await prisma.viewerAccess.delete({
      where: {
        id: viewerId
      }
    });
    
    return NextResponse.json({ success: true, message: 'Viewer access removed successfully' });
  } catch (error) {
    console.error('Error removing viewer access:', error);
    return NextResponse.json({ error: 'Failed to remove viewer access' }, { status: 500 });
  }
}