import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { checkHubAccess } from '@/lib/hubAccess';

// Resolve a flag
export async function POST(
  request: NextRequest,
  { params }: { params: { hubId: string; flagId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const userId = session.user.id;
    const { hubId, flagId } = params;
    
    // Check if user has access to the hub
    const access = await checkHubAccess(hubId, userId);
    if (!access.hasAccess) {
      return NextResponse.json({ error: access.message }, { status: access.status });
    }
    
    // Only hub owners can resolve flags
    if (!access.isOwner) {
      return NextResponse.json({ error: 'Only hub owners can resolve flags' }, { status: 403 });
    }
    
    // Get the flag
    const flag = await prisma.flag.findUnique({
      where: {
        id: flagId,
        hubId
      },
      include: {
        memory: true
      }
    });
    
    if (!flag) {
      return NextResponse.json({ error: 'Flag not found' }, { status: 404 });
    }
    
    // Check if flag is already resolved
    if (flag.status !== 'pending') {
      return NextResponse.json({ error: 'Flag is already resolved' }, { status: 400 });
    }
    
    // Parse request body
    const body = await request.json();
    
    // Validate action
    if (!body.action || !['approve', 'remove'].includes(body.action)) {
      return NextResponse.json({ error: 'Valid action is required (approve or remove)' }, { status: 400 });
    }
    
    // Process based on action
    if (body.action === 'approve') {
      // Keep the memory but mark the flag as resolved
      await prisma.flag.update({
        where: {
          id: flagId
        },
        data: {
          status: 'approved',
          resolvedAt: new Date()
        }
      });
      
      // Create notification for the reporter
      await prisma.notification.create({
        data: {
          userId: flag.reporterId,
          type: 'flag',
          content: `Your flag on a memory in "${access.hub!.name}" has been reviewed, but the content will remain`,
          relatedId: flagId
        }
      });
    } else {
      // Remove the memory and mark the flag as resolved
      await prisma.$transaction([
        prisma.memory.delete({
          where: {
            id: flag.memoryId
          }
        }),
        prisma.flag.update({
          where: {
            id: flagId
          },
          data: {
            status: 'rejected',
            resolvedAt: new Date()
          }
        })
      ]);
      
      // Create notification for the reporter
      await prisma.notification.create({
        data: {
          userId: flag.reporterId,
          type: 'flag',
          content: `Your flag on a memory in "${access.hub!.name}" has been reviewed and the content has been removed`,
          relatedId: flagId
        }
      });
      
      // Create notification for the memory author if not the owner
      if (flag.memory.authorId !== access.hub!.ownerId) {
        await prisma.notification.create({
          data: {
            userId: flag.memory.authorId,
            type: 'flag',
            content: `Your memory in "${access.hub!.name}" has been removed by the hub owner`,
            relatedId: flagId
          }
        });
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Flag resolved with action: ${body.action}` 
    });
  } catch (error) {
    console.error('Error resolving flag:', error);
    return NextResponse.json({ error: 'Failed to resolve flag' }, { status: 500 });
  }
}