import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Get hub details
export async function GET(
  request: NextRequest,
  { params }: { params: { hubId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = session.user.id;
    const hubId = params.hubId;
    
    // Find the hub
    const hub = await prisma.hub.findUnique({
      where: {
        id: hubId
      },
      include: {
        _count: {
          select: {
            memories: true,
            viewers: true,
            flags: {
              where: {
                status: 'pending'
              }
            }
          }
        }
      }
    });
    
    if (!hub) {
      return NextResponse.json({ error: 'Hub not found' }, { status: 404 });
    }
    
    // Check if user is owner or has access
    const isOwner = hub.ownerId === userId;
    
    if (!isOwner) {
      // Check if user has viewer access
      const viewerAccess = await prisma.viewerAccess.findUnique({
        where: {
          hubId_userId: {
            hubId: hubId,
            userId: userId
          }
        }
      });
      
      // If not owner and no viewer access, or hub is not published
      if (!viewerAccess || !hub.isPublished) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      
      // Update last access time for viewer
      await prisma.viewerAccess.update({
        where: {
          hubId_userId: {
            hubId: hubId,
            userId: userId
          }
        },
        data: {
          lastAccessAt: new Date()
        }
      });
    }
    
    return NextResponse.json({ 
      hub,
      isOwner
    });
  } catch (error) {
    console.error('Error fetching hub:', error);
    return NextResponse.json({ error: 'Failed to fetch hub details' }, { status: 500 });
  }
}

// Update hub details
export async function PUT(
  request: NextRequest,
  { params }: { params: { hubId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = session.user.id;
    const hubId = params.hubId;
    const body = await request.json();
    
    // Find the hub
    const hub = await prisma.hub.findUnique({
      where: {
        id: hubId
      }
    });
    
    if (!hub) {
      return NextResponse.json({ error: 'Hub not found' }, { status: 404 });
    }
    
    // Check if user is owner
    if (hub.ownerId !== userId) {
      return NextResponse.json({ error: 'Only the owner can update the hub' }, { status: 403 });
    }
    
    // Update the hub
    const updatedHub = await prisma.hub.update({
      where: {
        id: hubId
      },
      data: {
        name: body.name || hub.name,
        description: body.description !== undefined ? body.description : hub.description,
        isPublished: body.isPublished !== undefined ? body.isPublished : hub.isPublished
      }
    });
    
    return NextResponse.json({ success: true, hub: updatedHub });
  } catch (error) {
    console.error('Error updating hub:', error);
    return NextResponse.json({ error: 'Failed to update hub' }, { status: 500 });
  }
}

// Delete hub
export async function DELETE(
  request: NextRequest,
  { params }: { params: { hubId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = session.user.id;
    const hubId = params.hubId;
    
    // Find the hub
    const hub = await prisma.hub.findUnique({
      where: {
        id: hubId
      }
    });
    
    if (!hub) {
      return NextResponse.json({ error: 'Hub not found' }, { status: 404 });
    }
    
    // Check if user is owner
    if (hub.ownerId !== userId) {
      return NextResponse.json({ error: 'Only the owner can delete the hub' }, { status: 403 });
    }
    
    // Delete the hub (cascade will delete related records)
    await prisma.hub.delete({
      where: {
        id: hubId
      }
    });
    
    return NextResponse.json({ success: true, message: `Hub deleted successfully` });
  } catch (error) {
    console.error('Error deleting hub:', error);
    return NextResponse.json({ error: 'Failed to delete hub' }, { status: 500 });
  }
}