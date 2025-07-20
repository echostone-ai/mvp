import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Get all hubs for the current user
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = session.user.id;
    
    // Get hubs owned by the user
    const ownedHubs = await prisma.hub.findMany({
      where: {
        ownerId: userId
      },
      include: {
        _count: {
          select: {
            memories: true,
            viewers: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    // Get hubs where the user has viewer access
    const viewerHubs = await prisma.viewerAccess.findMany({
      where: {
        userId: userId
      },
      include: {
        hub: {
          include: {
            _count: {
              select: {
                memories: true,
                viewers: true
              }
            }
          }
        }
      }
    });
    
    // Combine and format the results
    const hubs = [
      ...ownedHubs,
      ...viewerHubs.map(access => ({
        ...access.hub,
        accessLevel: access.accessLevel
      }))
    ];
    
    return NextResponse.json({ hubs });
  } catch (error) {
    console.error('Error fetching hubs:', error);
    return NextResponse.json({ error: 'Failed to fetch hubs' }, { status: 500 });
  }
}

// Create a new hub
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = session.user.id;
    const body = await request.json();
    
    // Validate required fields
    if (!body.name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    
    // Create the hub
    const hub = await prisma.hub.create({
      data: {
        name: body.name,
        description: body.description || null,
        ownerId: userId,
        isPublished: body.isPublished || false
      }
    });
    
    return NextResponse.json({ success: true, hub }, { status: 201 });
  } catch (error) {
    console.error('Error creating hub:', error);
    return NextResponse.json({ error: 'Failed to create hub' }, { status: 500 });
  }
}