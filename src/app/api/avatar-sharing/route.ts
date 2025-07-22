import { NextRequest, NextResponse } from 'next/server';

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

        // In a real app, you would:
        // 1. Save to database
        // 2. Send email notification to recipient
        // 3. Set up proper permissions

        return NextResponse.json({ 
          success: true, 
          share: newShare,
          message: 'Avatar shared successfully! An invitation email will be sent.'
        });

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

  if (shareToken) {
    // Get shared avatar details by token
    // Mock avatar data for shared access
    const sharedAvatar = {
      shareToken,
      avatar: {
        id: 'avatar-jonathan',
        name: 'Jonathan',
        description: 'Travel enthusiast and storyteller from Bulgaria',
        hasVoice: true,
        voiceId: 'CO6pxVrMZfyL61ZIglyr',
        profileData: {
          name: 'Jonathan Braden',
          personality: 'Witty, sarcastic, warm, and adventurous',
          languageStyle: {
            description: 'Casual with occasional profanity, uses humor and storytelling'
          },
          humorStyle: {
            description: 'Dry wit, self-deprecating, observational'
          },
          catchphrases: [
            "Well, that's a story for another time...",
            "Trust me, I've seen worse."
          ]
        }
      },
      ownerEmail: 'jonathan@example.com',
      permissions: ['chat', 'viewMemories', 'createMemories'],
      isValid: true,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };

    return NextResponse.json({ 
      success: true, 
      sharedAvatar 
    });
  } else if (avatarId && ownerEmail) {
    // Get shares for a specific avatar
    // Mock shares data
    const shares = [
      {
        id: 'share-1',
        avatarId,
        ownerEmail,
        shareWithEmail: 'friend@example.com',
        shareToken: 'example-token-1',
        permissions: ['chat', 'viewMemories'],
        status: 'accepted',
        createdAt: '2024-01-15T10:00:00Z',
        expiresAt: '2024-02-15T10:00:00Z'
      },
      {
        id: 'share-2',
        avatarId,
        ownerEmail,
        shareWithEmail: 'family@example.com',
        shareToken: 'example-token-2',
        permissions: ['chat'],
        status: 'pending',
        createdAt: '2024-01-18T15:00:00Z',
        expiresAt: '2024-02-18T15:00:00Z'
      }
    ];

    return NextResponse.json({ 
      success: true, 
      shares 
    });
  } else {
    return NextResponse.json({ 
      error: 'Invalid request parameters' 
    }, { status: 400 });
  }
}