import { prisma } from './prisma';

interface AccessResult {
  hasAccess: boolean;
  isOwner: boolean;
  message?: string;
  status?: number;
  hub?: any;
}

/**
 * Check if a user has access to a hub
 * @param hubId The ID of the hub
 * @param userId The ID of the user
 * @returns Access result with access status and details
 */
export async function checkHubAccess(hubId: string, userId: string): Promise<AccessResult> {
  try {
    // Find the hub
    const hub = await prisma.hub.findUnique({
      where: {
        id: hubId
      }
    });
    
    if (!hub) {
      return {
        hasAccess: false,
        isOwner: false,
        message: 'Hub not found',
        status: 404
      };
    }
    
    // Check if user is owner
    const isOwner = hub.ownerId === userId;
    
    if (isOwner) {
      return {
        hasAccess: true,
        isOwner: true,
        hub
      };
    }
    
    // If not owner, check if hub is published
    if (!hub.isPublished) {
      return {
        hasAccess: false,
        isOwner: false,
        message: 'This hub is not published',
        status: 403
      };
    }
    
    // Check if user has viewer access
    const viewerAccess = await prisma.viewerAccess.findUnique({
      where: {
        hubId_userId: {
          hubId,
          userId
        }
      }
    });
    
    if (!viewerAccess) {
      return {
        hasAccess: false,
        isOwner: false,
        message: 'You do not have access to this hub',
        status: 403
      };
    }
    
    // Update last access time
    await prisma.viewerAccess.update({
      where: {
        hubId_userId: {
          hubId,
          userId
        }
      },
      data: {
        lastAccessAt: new Date()
      }
    });
    
    return {
      hasAccess: true,
      isOwner: false,
      hub
    };
  } catch (error) {
    console.error('Error checking hub access:', error);
    return {
      hasAccess: false,
      isOwner: false,
      message: 'Error checking access',
      status: 500
    };
  }
}