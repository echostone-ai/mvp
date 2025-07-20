import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkHubAccess } from '@/lib/hubAccess';




// Flag a memory
export async function POST(request: NextRequest, { params }: { params: { hubId: string, memoryId: string } }) {
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
    
    // Owners cannot flag their own hub's memories
    if (access.isOwner) {
      return NextResponse.json({ error: 'Hub owners cannot flag memories in their own hub' }, { status: 400 });
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
    
    // Parse request body
    const body = await request.json();
    
    // Validate reason
    if (!body.reason || body.reason.trim().length === 0) {
      return NextResponse.json({ error: 'Reason is required' }, { status: 400 });
    }
    
    // Check if user has already flagged this memory
    const existingFlag = await prisma.flag.findFirst({
      where: {
        memoryId,
        reporterId: userId,
        status: 'pending'
      }
    });
    
    if (existingFlag) {
      return NextResponse.json({ error: 'You have already flagged this memory' }, { status: 400 });
    }
    
    // Create the flag
    const flag = await prisma.flag.create({
      data: {
        hubId,
        memoryId,
        reporterId: userId,
        reason: body.reason,
        status: 'pending'
      }
    });
    
    // Create notification for the hub owner
    await prisma.notification.create({
      data: {
        userId: access.hub!.ownerId,
        type: 'flag',
        content: `A memory in your hub "${access.hub!.name}" has been flagged`,
        relatedId: flag.id
      }
    });
    
    return NextResponse.json({ 
      success: true, 
      message: 'Memory flagged successfully',
      flag: {
        id: flag.id,
        status: flag.status,
        createdAt: flag.createdAt
      }
    });
  } catch (error) {
    console.error('Error flagging memory:', error);
    return NextResponse.json({ error: 'Failed to flag memory' }, { status: 500 });
  }
}