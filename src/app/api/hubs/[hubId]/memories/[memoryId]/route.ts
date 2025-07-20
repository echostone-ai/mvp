import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkHubAccess } from '@/lib/hubAccess';




// Get a specific memory
export async function GET(request: NextRequest, { params }: { params: { hubId: string, memoryId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = session.user.id;
    const { hubId, memoryId  } = params;
    
    // Check if user has access to the hub
    const access = await checkHubAccess(hubId, userId);
    if (!access.hasAccess) {
      return NextResponse.json({ error: access.message }, { status: access.status });
    }
    
    // Get the memory
    const memory = await prisma.memory.findUnique({
      where: {
        id: memoryId,
        hubId
      },
      include: {
        flags: {
          where: {
            status: 'pending'
          },
          select: {
            id: true,
            reason: true,
            createdAt: true
          }
        }
      }
    });
    
    if (!memory) {
      return NextResponse.json({ error: 'Memory not found' }, { status: 404 });
    }
    
    // Format the response
    // In a real app, you would fetch author details from your user service
    const authorName = memory.isOwnerMemory ? 'Hub Owner' : 'Contributor';
    
    const formattedMemory = {
      ...memory,
      author: {
        full_name: authorName,
        avatar_url: null
      },
      // Only include flags if user is the owner
      flags: access.isOwner ? memory.flags : undefined
    };
    
    return NextResponse.json({ memory: formattedMemory });
  } catch (error) {
    console.error('Error fetching memory:', error);
    return NextResponse.json({ error: 'Failed to fetch memory' }, { status: 500 });
  }
}

// Delete a memory
export async function DELETE(request: NextRequest, { params }: { params: { hubId: string, memoryId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = session.user.id;
    const { hubId, memoryId  } = params;
    
    // Check if user has access to the hub
    const access = await checkHubAccess(hubId, userId);
    if (!access.hasAccess) {
      return NextResponse.json({ error: access.message }, { status: access.status });
    }
    
    // Get the memory
    const memory = await prisma.memory.findUnique({
      where: {
        id: memoryId,
        hubId
      }
    });
    
    if (!memory) {
      return NextResponse.json({ error: 'Memory not found' }, { status: 404 });
    }
    
    // Only the hub owner or the memory author can delete the memory
    if (!access.isOwner && memory.authorId !== userId) {
      return NextResponse.json({ error: 'You do not have permission to delete this memory' }, { status: 403 });
    }
    
    // Delete the memory
    await prisma.memory.delete({
      where: {
        id: memoryId
      }
    });
    
    return NextResponse.json({ success: true, message: 'Memory deleted successfully' });
  } catch (error) {
    console.error('Error deleting memory:', error);
    return NextResponse.json({ error: 'Failed to delete memory' }, { status: 500 });
  }
}