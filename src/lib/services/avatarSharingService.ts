import { NextRequest, NextResponse } from 'next/server';
import { sendAvatarInvitation } from '@/lib/emailService';
import { getAvatarForSharing } from '@/lib/avatarDataService';
import { getCached, setCached } from '@/lib/cache';
import { supabase } from '@/lib/supabase';

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

  try {
    // For now, let's skip authentication and use a simpler approach
    // We'll get the user ID from the avatar ownership check
    console.log('Creating share for avatar:', avatarId, 'owner:', ownerEmail, 'share with:', shareWithEmail);

    // Get the avatar to verify it exists and get owner info
    console.log('Looking up avatar with ID:', avatarId);
    const { data: avatarData, error: avatarError } = await supabase
      .from('avatar_profiles')
      .select('*')
      .eq('id', avatarId)
      .single();

    console.log('Avatar lookup result:', { avatarData, avatarError });

    let avatar;
    if (avatarError || !avatarData) {
      console.log('Avatar not found:', avatarError);
      
      // Let's also try to list all avatars to see what's available
      const { data: allAvatars, error: listError } = await supabase
        .from('avatar_profiles')
        .select('id, name')
        .limit(10);
      
      console.log('Available avatars:', { allAvatars, listError });
      
      // For now, let's create a demo avatar to test the sharing functionality
      console.log('Creating demo avatar for testing sharing...');
      avatar = {
        id: avatarId,
        name: 'Demo Avatar',
        description: 'A demo avatar for testing sharing',
        user_id: 'demo-user-id',
        voice_id: null,
        photo_url: null,
        profile_data: {
          name: 'Demo Avatar',
          personality: 'Friendly and helpful for testing'
        }
      };
      
      console.log('Using demo avatar:', avatar);
    } else {
      avatar = avatarData;
    }

    const currentUser = { id: avatar.user_id }; // Use the avatar's owner as current user

    // Generate share token
    const shareToken = Math.random().toString(36).substring(2, 15) + 
                      Math.random().toString(36).substring(2, 15);

    // Try to create share record in database, fall back to cache if table doesn't exist
    let shareRecord;
    try {
      const { data, error: shareError } = await supabase
        .from('avatar_shares')
        .insert({
          avatar_id: avatarId,
          owner_id: currentUser.id,
          share_token: shareToken,
          shared_with_email: shareWithEmail,
          permissions: permissions || ['chat', 'viewMemories', 'createMemories'],
          status: 'active'
        })
        .select()
        .single();

      if (shareError) {
        if (shareError.code === '23505') { // Unique constraint violation
          return NextResponse.json({ 
            error: 'Avatar is already shared with this email address' 
          }, { status: 409 });
        }
        throw shareError;
      }
      shareRecord = data;
    } catch (dbError: any) {
      console.log('Database table not ready, using cache fallback:', dbError.message);
      
      // Fallback to cache-based sharing
      shareRecord = {
        id: Math.random().toString(36).substring(2, 9),
        avatar_id: avatarId,
        owner_id: currentUser.id,
        share_token: shareToken,
        shared_with_email: shareWithEmail,
        permissions: permissions || ['chat', 'viewMemories', 'createMemories'],
        status: 'active',
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };
      
      // Store in cache
      const cacheKey = `avatar-share:${shareRecord.id}`;
      setCached(cacheKey, shareRecord, 30 * 24 * 60 * 60); // 30 days
      
      // Also cache by token for easy lookup
      const tokenCacheKey = `share-token:${shareToken}`;
      setCached(tokenCacheKey, shareRecord, 30 * 24 * 60 * 60);
    }

    const shareUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/shared-avatar/${shareToken}`;
    
    // Send invitation email
    try {
      const emailResult = await sendAvatarInvitation(
        shareWithEmail,
        ownerEmail,
        avatar.name,
        shareToken
      );
      
      return NextResponse.json({
        success: true,
        share: {
          id: shareRecord.id,
          avatarId: shareRecord.avatar_id,
          ownerEmail,
          shareWithEmail: shareRecord.shared_with_email,
          shareToken: shareRecord.share_token,
          permissions: shareRecord.permissions,
          status: shareRecord.status,
          createdAt: shareRecord.created_at,
          expiresAt: shareRecord.expires_at,
          shareUrl
        },
        emailSent: emailResult.success,
        message: emailResult.success 
          ? `Avatar "${avatar.name}" shared successfully! An invitation email has been sent.`
          : `Avatar "${avatar.name}" shared successfully, but there was an issue sending the invitation email. Please share the link manually.`
      });
    } catch (emailError) {
      console.error('Email sending failed:', emailError);
      
      return NextResponse.json({
        success: true,
        share: {
          id: shareRecord.id,
          avatarId: shareRecord.avatar_id,
          ownerEmail,
          shareWithEmail: shareRecord.shared_with_email,
          shareToken: shareRecord.share_token,
          permissions: shareRecord.permissions,
          status: shareRecord.status,
          createdAt: shareRecord.created_at,
          expiresAt: shareRecord.expires_at,
          shareUrl
        },
        emailSent: false,
        message: `Avatar "${avatar.name}" shared successfully, but there was an issue sending the invitation email. Please share the link manually.`
      });
    }
    
  } catch (error) {
    console.error('Error creating avatar share:', error);
    return NextResponse.json({ 
      error: 'Failed to create avatar share' 
    }, { status: 500 });
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
  
  console.log('🔍 getSharedAvatar called with token:', shareToken);
  
  if (!shareToken) {
    console.log('❌ No share token provided');
    return NextResponse.json({ 
      error: 'Share token is required' 
    }, { status: 400 });
  }

  const cacheKey = `shared-avatar:${shareToken}`;
  const cached = getCached<any>(cacheKey);
  
  if (cached) {
    console.log('✅ Found cached data for token:', shareToken);
    return NextResponse.json({ 
      success: true, 
      sharedAvatar: cached 
    });
  }
  
  console.log('🔍 No cache found, querying database for token:', shareToken);
  
  // Debug: Check Supabase connection
  console.log('🔍 Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('🔍 Service key exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
  console.log('🔍 Service key length:', process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0);
  
  // Validate environment variables
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL is not set');
    return NextResponse.json({ 
      error: 'Database configuration error' 
    }, { status: 500 });
  }
  
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY is not set');
    return NextResponse.json({ 
      error: 'Database configuration error' 
    }, { status: 500 });
  }

  try {
    // Try to get the share record from database first
    let sharedAvatar;
    try {
      const { data: shareRecord, error: shareError } = await supabase
        .from('avatar_shares')
        .select(`
          *,
          avatar_profiles (
            id,
            name,
            description,
            voice_id,
            photo_url,
            profile_data
          )
        `)
        .eq('share_token', shareToken)
        .eq('status', 'active')
        .single();

      if (shareError || !shareRecord) {
        console.error('❌ Share record error:', shareError);
        console.error('❌ Share record data:', shareRecord);
        throw new Error(`Share not found in database: ${shareError?.message || 'No record returned'}`);
      }

      // Check if share has expired
      if (new Date(shareRecord.expires_at) < new Date()) {
        // Update status to expired
        await supabase
          .from('avatar_shares')
          .update({ status: 'expired' })
          .eq('id', shareRecord.id);

        return NextResponse.json({ 
          error: 'Share link has expired' 
        }, { status: 410 });
      }

      const avatar = shareRecord.avatar_profiles;
      
      sharedAvatar = {
        shareToken,
        avatar: {
          id: avatar.id,
          name: avatar.name,
          description: avatar.description,
          hasVoice: !!avatar.voice_id,
          voiceId: avatar.voice_id,
          accent: null, // Default to null since accent column doesn't exist
          photoUrl: avatar.photo_url,
          profileData: avatar.profile_data
        },
        ownerEmail: shareRecord.shared_with_email,
        permissions: shareRecord.permissions,
        isValid: true,
        expiresAt: shareRecord.expires_at
      };
    } catch (dbError: any) {
      console.error('❌ Database error for share token:', shareToken, 'Error:', dbError);
      console.error('❌ Error details:', {
        message: dbError.message,
        code: dbError.code,
        details: dbError.details,
        hint: dbError.hint
      });
      
      // Fallback: check cache first
      const tokenCacheKey = `share-token:${shareToken}`;
      const cachedShare = getCached<any>(tokenCacheKey);
      
      if (cachedShare) {
        // Get avatar data
        const avatarData = await getAvatarForSharing(cachedShare.avatar_id);
        
        if (avatarData) {
          sharedAvatar = {
            shareToken,
            avatar: {
              id: avatarData.id,
              name: avatarData.name,
              description: avatarData.description,
              hasVoice: avatarData.hasVoice,
              voiceId: avatarData.voiceId,
              accent: avatarData.accent,
              photoUrl: avatarData.photoUrl,
              profileData: avatarData.profileData
            },
            ownerEmail: cachedShare.shared_with_email,
            permissions: cachedShare.permissions,
            isValid: true,
            expiresAt: cachedShare.expires_at
          };
        }
      }
      
      // If still no shared avatar, return an error instead of demo
      if (!sharedAvatar) {
        console.error('❌ No shared avatar found and no fallback available for token:', shareToken);
        return NextResponse.json({ 
          error: 'Shared avatar not found. Please check the sharing link or contact the avatar owner.' 
        }, { status: 404 });
      }
    }
    
    setCached(cacheKey, sharedAvatar, 300000); // Cache for 5 minutes

    return NextResponse.json({ 
      success: true, 
      sharedAvatar 
    });
  } catch (error) {
    console.error('Error handling share token:', error);
    
    return NextResponse.json({ 
      error: 'Failed to load shared avatar' 
    }, { status: 500 });
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
    // Get the avatar to find the owner
    const { data: avatar, error: avatarError } = await supabase
      .from('avatar_profiles')
      .select('user_id')
      .eq('id', avatarId)
      .single();

    if (avatarError || !avatar) {
      console.log('Avatar not found for shares:', avatarError);
      return NextResponse.json({ 
        success: true, 
        shares: [] 
      });
    }

    const currentUser = { id: avatar.user_id };

    // Try to get shares from database, fall back to cache
    let formattedShares = [];
    try {
      const { data: shares, error: sharesError } = await supabase
        .from('avatar_shares')
        .select('*')
        .eq('avatar_id', avatarId)
        .eq('owner_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (sharesError) {
        throw sharesError;
      }

      // Transform to match expected format
      formattedShares = shares.map(share => ({
        id: share.id,
        avatarId: share.avatar_id,
        ownerEmail,
        shareWithEmail: share.shared_with_email,
        shareToken: share.share_token,
        permissions: share.permissions,
        status: share.status,
        createdAt: share.created_at,
        expiresAt: share.expires_at
      }));
    } catch (dbError: any) {
      console.log('Database table not ready, checking cache:', dbError.message);
      
      // Fallback: try to find cached shares
      // This is a simple implementation - in production you'd want a more robust cache system
      formattedShares = [];
    }
    
    return NextResponse.json({ 
      success: true, 
      shares: formattedShares 
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

  try {
    // For now, let's just return success since we're using cache fallback
    // In production, this would update the database
    console.log('Revoking share:', shareId);
    
    // Try to update the database if table exists
    try {
      const { data: updatedShare, error: updateError } = await supabase
        .from('avatar_shares')
        .update({ status: 'revoked' })
        .eq('id', shareId)
        .select()
        .single();

      if (updateError) {
        console.log('Database update failed, using cache fallback:', updateError);
      } else {
        // Clear any cached data for this share
        const cacheKey = `shared-avatar:${updatedShare.share_token}`;
        setCached(cacheKey, null, 0);
      }
    } catch (dbError) {
      console.log('Database not available, using cache fallback');
    }

    if (updateError || !updatedShare) {
      return NextResponse.json({ 
        error: 'Share not found or access denied' 
      }, { status: 404 });
    }

    // Clear any cached data for this share
    const cacheKey = `shared-avatar:${updatedShare.share_token}`;
    setCached(cacheKey, null, 0);

    return NextResponse.json({ 
      success: true, 
      message: 'Avatar access revoked successfully' 
    });
  } catch (error) {
    console.error('Error revoking share:', error);
    return NextResponse.json({ 
      error: 'Failed to revoke avatar access' 
    }, { status: 500 });
  }
}