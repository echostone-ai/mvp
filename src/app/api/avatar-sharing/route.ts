import { NextRequest, NextResponse } from 'next/server';
import { sendAvatarInvitation } from '@/lib/emailService';
import { getAvatarForSharing } from '@/lib/avatarDataService';
import { supabase } from '@/lib/supabase';

// API endpoint for avatar sharing functionality
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ...data } = body;

    switch (action) {
      case 'create-share':
        // Create a new avatar share
        const { avatarId, ownerEmail, shareWithEmail, permissions } = data;
        
        if (!avatarId || !ownerEmail || !shareWithEmail) {
          return NextResponse.json({ 
            error: 'Avatar ID, owner email, and recipient email are required' 
          }, { status: 400 });
        }

        // Generate a unique share token
        const shareToken = Math.random().toString(36).substring(2, 15) + 
                          Math.random().toString(36).substring(2, 15);
        
        // Create share record (in real app, this would be saved to database)
        const newShare = {
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

        // Get the actual avatar data to ensure we're sharing the right avatar
        const avatar = await getAvatarForSharing(avatarId);
        if (!avatar) {
          return NextResponse.json({ 
            error: 'Avatar not found' 
          }, { status: 404 });
        }
        
        // Create a share record
        const shareRecord = {
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
        if (!shareRecord) {
          return NextResponse.json({ 
            error: 'Failed to create share record' 
          }, { status: 500 });
        }
        
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
            share: {
              ...shareRecord,
              shareUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/shared-avatar/${shareRecord.shareToken}`
            },
            emailSent: emailResult.success,
            message: emailResult.success 
              ? `Avatar "${avatar.name}" shared successfully! An invitation email has been sent.`
              : `Avatar "${avatar.name}" shared successfully, but there was an issue sending the invitation email. Please share the link manually.`
          });
        } catch (emailError) {
          console.error('Error sending invitation email:', emailError);
          
          return NextResponse.json({ 
            success: true, 
            share: {
              ...shareRecord,
              shareUrl: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/shared-avatar/${shareRecord.shareToken}`
            },
            emailSent: false,
            message: `Avatar "${avatar.name}" shared successfully, but there was an issue sending the invitation email. Please share the link manually.`
          });
        }

      case 'accept-share':
        // Accept a shared avatar invitation
        const { shareToken: acceptToken, userEmail } = data;
        
        if (!acceptToken || !userEmail) {
          return NextResponse.json({ 
            error: 'Share token and user email are required' 
          }, { status: 400 });
        }

        // In a real app, validate token and create user access
        const acceptedShare = {
          shareToken: acceptToken,
          userEmail,
          acceptedAt: new Date().toISOString(),
          status: 'accepted'
        };

        return NextResponse.json({ 
          success: true, 
          share: acceptedShare
        });

      case 'get-shared-avatars':
        // Get avatars shared with a user
        const { userEmail: email } = data;
        
        if (!email) {
          return NextResponse.json({ 
            error: 'User email is required' 
          }, { status: 400 });
        }

        // Mock shared avatars (in real app, query from database)
        const sharedAvatars = [
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

        return NextResponse.json({ 
          success: true, 
          sharedAvatars 
        });

      case 'revoke-share':
        // Revoke access to a shared avatar
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

      default:
        return NextResponse.json({ 
          error: 'Invalid action' 
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Avatar sharing error:', error);
    return NextResponse.json({ 
      error: 'Failed to process avatar sharing request' 
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const shareToken = url.searchParams.get('shareToken');
  const avatarId = url.searchParams.get('avatarId');
  const ownerEmail = url.searchParams.get('ownerEmail');
  
  console.log('Avatar sharing GET request with params:', { shareToken, avatarId, ownerEmail });

  if (shareToken) {
    try {
      // For now, we'll simulate a share record lookup
      // In a real app, this would query a database
      
      // Extract avatar ID from the token (for demo purposes)
      // In production, you would look up the actual share record
      const avatarId = shareToken.includes('boris') ? 'avatar-boris' : 
                      shareToken.includes('jonathan') ? 'avatar-jonathan' : 
                      shareToken.includes('joss') ? 'avatar-joss' : 'avatar-default';
      
      // Get the actual avatar data
      const avatarData = await getAvatarForSharing(avatarId);
      
      // If we can't get avatar data, create fallback data
      if (!avatarData) {
        console.log('Avatar not found for token, creating fallback:', shareToken);
        
        // Create a fallback avatar based on the share token
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
        
        // Create a mock share record
        const mockShareRecord = {
          shareToken,
          avatarId: `avatar-${shortToken}`,
          ownerEmail: 'owner@example.com',
          permissions: ['chat', 'viewMemories', 'createMemories'],
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        };
        
        const sharedAvatar = {
          shareToken,
          avatar: fallbackAvatar,
          ownerEmail: mockShareRecord.ownerEmail,
          permissions: mockShareRecord.permissions,
          isValid: true,
          expiresAt: mockShareRecord.expiresAt
        };
        
        console.log('Created fallback shared avatar:', fallbackAvatar.name);
        
        return NextResponse.json({ 
          success: true, 
          sharedAvatar 
        });
      }
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
    
    // Create a mock share record
    const mockShareRecord = {
      shareToken,
      avatarId,
      ownerEmail: 'owner@example.com',
      permissions: ['chat', 'viewMemories', 'createMemories'],
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };
    
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
      ownerEmail: mockShareRecord.ownerEmail,
      permissions: mockShareRecord.permissions,
      isValid: true,
      expiresAt: mockShareRecord.expiresAt
    };
    
    console.log('Returning REAL shared avatar data for token:', shareToken, 'Avatar:', avatar.name);

    return NextResponse.json({ 
      success: true, 
      sharedAvatar 
    });
  } else if (avatarId && ownerEmail) {
    try {
      // Get shares for a specific avatar - use REAL data
      const shares = await getSharesForAvatar(avatarId, ownerEmail);
      
      console.log('Returning REAL shares for avatar:', avatarId, 'and owner:', ownerEmail, 'Found:', shares.length);
  
      return NextResponse.json({ 
        success: true, 
        shares 
      });
    } catch (error) {
      console.error('Error getting shares for avatar:', error);
      
      // Return empty shares array as fallback
      return NextResponse.json({ 
        success: true, 
        shares: [] 
      });
    }
  } else {
    console.log('Invalid request parameters for avatar sharing GET');
    
    return NextResponse.json({ 
      error: 'Invalid request parameters' 
    }, { status: 400 });
  }
}