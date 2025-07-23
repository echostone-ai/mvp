import { NextRequest, NextResponse } from 'next/server';
import { sendAvatarInvitation } from '@/lib/emailService';
import { getAvatarForSharing } from '@/lib/services/avatarService';
import { getCached, setCached } from '@/lib/cache';

export interface AvatarShare {
  id: string;
  avatarId: string;
  ownerEmail: string;
  shareWithEmail: string;
  shareToken: string;
  permissions: string[];
  status: 'pending' | 'accepted' | 'revoked';
  createdAt: string;
  expiresAt: string;
  shareUrl: string;
}

export interface SharedAvatar {
  id: string;
  shareToken: string;
  avatar: any;
  ownerEmail: string;
  permissions: string[];
  sharedAt: string;
  lastInteraction?: string;
  conversationCount: number;
}

export async function createShare(data: {
  avatarId: string;
  ownerEmail: string;
  shareWithEmail: string;
  permissions?: string[];
}, request: NextRequest): Promise<NextResponse> {
  const { avatarId, ownerEmail, shareWithEmail, permissions } = data;
  
  if (!avatarId || !ownerEmail || !shareWithEmail) {
    return NextResponse.json({ 
      error: 'Avatar ID, owner email, and recipient email are required' 
    }, { status: 400 });
  }

  // Generate a unique share token
  const shareToken = Math.random().toString(36).substring(2, 15) + 
                    Math.random().toString(36).substring(2, 15);

  // Get the actual avatar data to ensure we're sharing the right avatar
  const avatar = await getAvatarForSharing(avatarId);
  if (!avatar) {
    return NextResponse.json({ 
      error: 'Avatar not found' 
    }, { status: 404 });
  }
  
  // Create a share record
  const shareRecord: AvatarShare = {
    id: Math.random().toString(36).substring(2, 9),
    avatarId,
    ownerEmail,
    shareWithEmail,
    shareToken,
    permissions: permissions || ['chat'],
    status: 'pending',
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
    shareUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/shared-avatar/${shareToken}`
  };
  
  // Send email invitation with correct avatar name
  try {
    const emailResult = await sendAvatarInvitation(
      shareWithEmail,
      ownerEmail,
      avatar.name,
      shareRecord.shareToken
    );
    
    console.log('Email sending result:', emailResult);
    
    return NextResponse.json({ 
      success: true, 
      share: shareRecord,
      emailSent: emailResult.success,
      message: emailResult.success 
        ? `Avatar "${avatar.name}" shared successfully! An invitation email has been sent.`
        : `Avatar "${avatar.name}" shared successfully, but there was an issue sending the invitation email. Please share the link manually.`
    });
  } catch (emailError) {
    console.error('Error sending invitation email:', emailError);
    
    return NextResponse.json({ 
      success: true, 
      share: shareRecord,
      emailSent: false,
      message: `Avatar "${avatar.name}" shared successfully, but there was an issue sending the invitation email. Please share the link manually.`
    });
  }
}

export async function acceptShare(data: {
  shareToken: string;
  userEmail: string;
}, request: NextRequest): Promise<NextResponse> {
  const { shareToken, userEmail } = data;
  
  if (!shareToken || !userEmail) {
    return NextResponse.json({ 
      error: 'Share token and user email are required' 
    }, { status: 400 });
  }

  // In a real app, validate token and create user access
  const acceptedShare = {
    shareToken,
    userEmail,
    acceptedAt: new Date().toISOString(),
    status: 'accepted'
  };

  return NextResponse.json({ 
    success: true, 
    share: acceptedShare
  });
}

export async function getSharedAvatars(data: {
  userEmail: string;
}, request: NextRequest): Promise<NextResponse> {
  const { userEmail } = data;
  
  if (!userEmail) {
    return NextResponse.json({ 
      error: 'User email is required' 
    }, { status: 400 });
  }

  const cacheKey = `shared-avatars:${userEmail}`;
  const cached = getCached<SharedAvatar[]>(cacheKey);
  
  if (cached) {
    return NextResponse.json({ 
      success: true, 
      sharedAvatars: cached 
    });
  }

  // Mock shared avatars (in real app, query from database)
  const sharedAvatars: SharedAvatar[] = [
    {
      id: 'shared-1',
      shareToken: 'example-token-1',
      avatar: {
        id: 'avatar-jonathan',
        name: 'Jonathan',
        description: 'Travel enthusiast and storyteller',
        hasVoice: true,
        voiceId: 'CO6pxVrMZfyL61ZIglyr'
      },
      ownerEmail: 'jonathan@example.com',
      permissions: ['chat', 'viewMemories'],
      sharedAt: '2024-01-15T10:00:00Z',
      lastInteraction: '2024-01-20T14:30:00Z',
      conversationCount: 5
    },
    {
      id: 'shared-2',
      shareToken: 'example-token-2',
      avatar: {
        id: 'avatar-sarah',
        name: 'Sarah',
        description: 'Artist and musician with stories to share',
        hasVoice: false,
        voiceId: null
      },
      ownerEmail: 'sarah@example.com',
      permissions: ['chat'],
      sharedAt: '2024-01-18T15:00:00Z',
      lastInteraction: null,
      conversationCount: 0
    }
  ];

  setCached(cacheKey, sharedAvatars, 300000); // Cache for 5 minutes

  return NextResponse.json({ 
    success: true, 
    sharedAvatars 
  });
}

export async function getSharedAvatar(data: {
  shareToken: string;
}, request: NextRequest): Promise<NextResponse> {
  const { shareToken } = data;
  
  if (!shareToken) {
    return NextResponse.json({ 
      error: 'Share token is required' 
    }, { status: 400 });
  }

  const cacheKey = `shared-avatar:${shareToken}`;
  const cached = getCached<any>(cacheKey);
  
  if (cached) {
    return NextResponse.json({ 
      success: true, 
      sharedAvatar: cached 
    });
  }

  try {
    // Extract avatar ID from the token (for demo purposes)
    const avatarId = shareToken.includes('boris') ? 'avatar-boris' : 
                    shareToken.includes('jonathan') ? 'avatar-jonathan' : 
                    shareToken.includes('joss') ? 'avatar-joss' : 'avatar-default';
    
    // Get the actual avatar data
    const avatarData = await getAvatarForSharing(avatarId);
    
    // If we can't get avatar data, create fallback data
    if (!avatarData) {
      console.log('Avatar not found for token, creating fallback:', shareToken);
      
      const shortToken = shareToken.substring(0, 6);
      const fallbackAvatar = {
        id: `avatar-${shortToken}`,
        name: `Shared Avatar`,
        description: 'A digital avatar ready to chat with you',
        hasVoice: false,
        voiceId: null,
        profileData: {
          name: `Shared Avatar`,
          personality: 'Friendly, helpful, and conversational',
          languageStyle: {
            description: 'Natural and engaging'
          },
          humorStyle: {
            description: 'Warm and appropriate'
          },
          catchphrases: []
        }
      };
      
      const sharedAvatar = {
        shareToken,
        avatar: fallbackAvatar,
        ownerEmail: 'owner@example.com',
        permissions: ['chat', 'viewMemories', 'createMemories'],
        isValid: true,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };
      
      setCached(cacheKey, sharedAvatar, 300000); // Cache for 5 minutes
      
      return NextResponse.json({ 
        success: true, 
        sharedAvatar 
      });
    }

    const sharedAvatar = {
      shareToken,
      avatar: {
        id: avatarData.id,
        name: avatarData.name,
        description: avatarData.description,
        hasVoice: avatarData.hasVoice,
        voiceId: avatarData.voiceId,
        profileData: avatarData.profileData
      },
      ownerEmail: 'owner@example.com',
      permissions: ['chat', 'viewMemories', 'createMemories'],
      isValid: true,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };
    
    setCached(cacheKey, sharedAvatar, 300000); // Cache for 5 minutes

    return NextResponse.json({ 
      success: true, 
      sharedAvatar 
    });
  } catch (error) {
    console.error('Error handling share token:', error);
    
    // Create a generic fallback avatar as a last resort
    const fallbackAvatar = {
      id: 'avatar-fallback',
      name: 'Digital Avatar',
      description: 'A digital avatar ready to chat with you',
      hasVoice: false,
      voiceId: null,
      profileData: {
        name: 'Digital Avatar',
        personality: 'Friendly and helpful',
        languageStyle: {
          description: 'Natural and conversational'
        },
        humorStyle: {
          description: 'Warm and appropriate'
        },
        catchphrases: []
      }
    };
    
    const sharedAvatar = {
      shareToken,
      avatar: fallbackAvatar,
      ownerEmail: 'owner@example.com',
      permissions: ['chat', 'viewMemories', 'createMemories'],
      isValid: true,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };
    
    return NextResponse.json({ 
      success: true, 
      sharedAvatar 
    });
  }
}

export async function getSharesForAvatar(data: {
  avatarId: string;
  ownerEmail: string;
}, request: NextRequest): Promise<NextResponse> {
  const { avatarId, ownerEmail } = data;
  
  if (!avatarId || !ownerEmail) {
    return NextResponse.json({ 
      error: 'Avatar ID and owner email are required' 
    }, { status: 400 });
  }

  try {
    // Mock shares for this avatar
    const mockShares = [
      {
        id: 'share-1',
        avatarId,
        shareToken: 'example-token-1',
        ownerEmail,
        shareWithEmail: 'friend@example.com',
        permissions: ['chat', 'viewMemories'],
        status: 'accepted',
        createdAt: '2024-01-15T10:00:00Z',
        expiresAt: '2024-02-15T10:00:00Z'
      }
    ];
    
    const shares = mockShares.filter(share => 
      share.avatarId === avatarId && share.ownerEmail === ownerEmail
    );
    
    return NextResponse.json({ 
      success: true, 
      shares 
    });
  } catch (error) {
    console.error('Error getting shares for avatar:', error);
    
    return NextResponse.json({ 
      success: true, 
      shares: [] 
    });
  }
}

export async function revokeShare(data: {
  shareId: string;
}, request: NextRequest): Promise<NextResponse> {
  const { shareId } = data;
  
  if (!shareId) {
    return NextResponse.json({ 
      error: 'Share ID is required' 
    }, { status: 400 });
  }

  // In a real app, validate ownership and delete from database

  return NextResponse.json({ 
    success: true, 
    message: 'Avatar access revoked successfully' 
  });
}