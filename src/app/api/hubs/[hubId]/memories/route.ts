import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkHubAccess } from '@/lib/hubAccess';

// Get memories for a hub
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
    
    // Check if user has access to the hub
    const access = await checkHubAccess(hubId, userId);
    if (!access.hasAccess) {
      return NextResponse.json({ error: access.message }, { status: access.status });
    }
    
    // Parse query parameters
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const contentType = url.searchParams.get('contentType');
    const sortBy = url.searchParams.get('sortBy') || 'createdAt';
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';
    
    // Build query filters
    const filters: any = {
      hubId
    };
    
    if (contentType) {
      filters.contentType = contentType;
    }
    
    // Get memories with pagination
    const memories = await prisma.memory.findMany({
      where: filters,
      orderBy: {
        [sortBy]: sortOrder
      },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        _count: {
          select: {
            flags: true
          }
        }
      }
    });
    
    // Get total count for pagination
    const totalCount = await prisma.memory.count({
      where: filters
    });
    
    // Format the response
    const formattedMemories = memories.map(memory => {
      // In a real app, you would fetch author details from your user service
      // For now, we'll use mock author data
      const authorName = memory.isOwnerMemory ? 'Hub Owner' : 'Contributor';
      
      return {
        ...memory,
        author: {
          full_name: authorName,
          avatar_url: null
        }
      };
    });
    
    return NextResponse.json({
      memories: formattedMemories,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching memories:', error);
    return NextResponse.json({ error: 'Failed to fetch memories' }, { status: 500 });
  }
}

// Create a new memory
export async function POST(
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
    
    // Check if user has access to the hub
    const access = await checkHubAccess(hubId, userId);
    if (!access.hasAccess) {
      return NextResponse.json({ error: access.message }, { status: access.status });
    }
    
    const body = await request.json();
    
    // Validate required fields
    if (!body.content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }
    
    if (!body.contentType || !['text', 'image', 'audio'].includes(body.contentType)) {
      return NextResponse.json({ error: 'Valid contentType is required (text, image, or audio)' }, { status: 400 });
    }
    
    // Check if the user is the hub owner
    const isOwnerMemory = access.isOwner;
    
    // Create the memory
    const memory = await prisma.memory.create({
      data: {
        content: body.content,
        contentType: body.contentType,
        hubId,
        authorId: userId,
        isOwnerMemory
      }
    });
    
    // If the user is not the owner, create a notification for the owner
    if (!isOwnerMemory) {
      const hub = await prisma.hub.findUnique({
        where: { id: hubId },
        select: { ownerId: true }
      });
      
      if (hub) {
        await prisma.notification.create({
          data: {
            userId: hub.ownerId,
            type: 'new_memory',
            content: `A new memory was added to your hub "${access.hub?.name}"`,
            relatedId: memory.id
          }
        });
      }
    }
    
    return NextResponse.json({ success: true, memory }, { status: 201 });
  } catch (error) {
    console.error('Error creating memory:', error);
    return NextResponse.json({ error: 'Failed to create memory' }, { status: 500 });
  }
}