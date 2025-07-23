/**
 * Avatar Data Service
 * Handles fetching and managing avatar profile data, voice settings, and memories
 */

import { supabase } from '@/lib/supabase';

export interface AvatarProfile {
  id: string;
  name: string;
  description?: string;
  voice_id?: string | null;
  profile_data?: any;
  photo_url?: string;
  created_at: string;
  user_id: string;
}

export interface SharedAvatarData {
  id: string;
  name: string;
  description: string;
  hasVoice: boolean;
  voiceId: string | null;
  profileData: any;
  photo_url?: string;
}

/**
 * Fetch avatar profile from database
 */
export async function getAvatarProfile(avatarId: string): Promise<AvatarProfile | null> {
  try {
    const { data, error } = await supabase
      .from('avatar_profiles')
      .select('*')
      .eq('id', avatarId)
      .single();

    if (error) {
      console.error('Error fetching avatar profile:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getAvatarProfile:', error);
    return null;
  }
}

/**
 * Convert avatar profile to shared avatar data format
 */
export function convertToSharedAvatarData(profile: AvatarProfile): SharedAvatarData {
  return {
    id: profile.id,
    name: profile.name,
    description: profile.description || `Chat with ${profile.name}`,
    hasVoice: !!profile.voice_id,
    voiceId: profile.voice_id || null,
    profileData: profile.profile_data || {
      name: profile.name,
      personality: `I am ${profile.name}, a digital avatar ready to chat with you.`,
      languageStyle: {
        description: 'Friendly and conversational'
      },
      humorStyle: {
        description: 'Light and approachable'
      },
      catchphrases: []
    },
    photo_url: profile.photo_url
  };
}

/**
 * Get avatar data for sharing (with fallback for development)
 */
export async function getAvatarForSharing(avatarId: string): Promise<SharedAvatarData | null> {
  // First try to get from database
  const profile = await getAvatarProfile(avatarId);
  
  if (profile) {
    return convertToSharedAvatarData(profile);
  }

  // Try direct Supabase query as a backup
  try {
    const { data, error } = await supabase
      .from('avatar_profiles')
      .select('*')
      .eq('id', avatarId)
      .single();
      
    if (!error && data) {
      console.log('Found avatar via direct Supabase query:', data.name);
      return convertToSharedAvatarData(data);
    }
  } catch (err) {
    console.error('Error in direct Supabase query:', err);
  }

  // Fallback for development/testing
  console.warn(`Avatar ${avatarId} not found in database, using fallback data`);
  
  // Extract a short ID for naming
  const shortId = avatarId.includes('-') 
    ? avatarId.split('-')[0] 
    : avatarId.substring(0, 6);
  
  // Create fallback data based on avatar ID
  const fallbackData: SharedAvatarData = {
    id: avatarId,
    name: avatarId.includes('boris') ? 'Boris' : 
          avatarId.includes('jonathan') ? 'Jonathan' : 
          avatarId.includes('joss') ? 'Joss' :
          `Avatar ${shortId}`,
    description: `A digital avatar ready to chat with you.`,
    hasVoice: false, // Default to no voice for safety
    voiceId: null,
    profileData: {
      name: avatarId.includes('boris') ? 'Boris' : 
            avatarId.includes('jonathan') ? 'Jonathan' : 
            avatarId.includes('joss') ? 'Joss' :
            `Avatar ${shortId}`,
      personality: `I am a digital avatar. I'm here to chat with you and learn about your interests.`,
      languageStyle: {
        description: 'Friendly and conversational'
      },
      humorStyle: {
        description: 'Light and approachable'
      },
      catchphrases: []
    }
  };

  return fallbackData;
}

/**
 * Create a unique visitor ID for shared avatar sessions
 */
export function createVisitorId(shareToken: string, visitorEmail?: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  
  if (visitorEmail) {
    // Create a consistent ID based on email and share token
    const emailHash = btoa(visitorEmail).replace(/[^a-zA-Z0-9]/g, '').substring(0, 8);
    return `visitor_${shareToken}_${emailHash}`;
  }
  
  // Fallback to timestamp + random for anonymous visitors
  return `visitor_${shareToken}_${timestamp}_${random}`;
}

/**
 * Store visitor information in localStorage for persistence
 */
export function storeVisitorInfo(shareToken: string, visitorEmail: string, visitorName?: string) {
  const visitorInfo = {
    shareToken,
    email: visitorEmail,
    name: visitorName || visitorEmail.split('@')[0],
    firstVisit: new Date().toISOString(),
    lastVisit: new Date().toISOString()
  };
  
  localStorage.setItem(`visitor_${shareToken}`, JSON.stringify(visitorInfo));
  return visitorInfo;
}

/**
 * Get stored visitor information
 */
export function getStoredVisitorInfo(shareToken: string) {
  try {
    const stored = localStorage.getItem(`visitor_${shareToken}`);
    if (stored) {
      const info = JSON.parse(stored);
      // Update last visit
      info.lastVisit = new Date().toISOString();
      localStorage.setItem(`visitor_${shareToken}`, JSON.stringify(info));
      return info;
    }
  } catch (error) {
    console.error('Error getting stored visitor info:', error);
  }
  return null;
}/
**
 * Get shares for a specific avatar
 */
export async function getSharesForAvatar(avatarId: string, ownerEmail: string): Promise<any[]> {
  try {
    // In a real implementation, query database for shares
    // For now, return mock data
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
    
    return mockShares.filter(share => share.avatarId === avatarId && share.ownerEmail === ownerEmail);
  } catch (error) {
    console.error('Error getting shares for avatar:', error);
    return [];
  }
}