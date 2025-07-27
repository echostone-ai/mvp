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
  // Ensure we have complete profile data for shared avatars
  let profileData = profile.profile_data;
  
  // If profile_data is missing or incomplete, try to reconstruct it
  if (!profileData || !profileData.personality || !profileData.name) {
    console.log(`[convertToSharedAvatarData] Profile data incomplete for ${profile.name}, reconstructing...`);
    
    // Try to build a more complete profile from available data
    profileData = {
      name: profile.name,
      personality: profileData?.personality || `I am ${profile.name}, a unique individual with my own distinct personality. I'm authentic, genuine, and speak from the heart. I have my own way of seeing the world and I'm not afraid to share my perspective.`,
      personalityTraits: profileData?.personalityTraits || [
        `I'm ${profile.name}, and I have a warm and engaging personality`,
        "I'm curious about the world and love learning about people",
        "I express myself authentically and naturally",
        "I remember our conversations and build meaningful connections"
      ],
      factualInfo: profileData?.factualInfo || [
        `My name is ${profile.name}`,
        "I enjoy having meaningful conversations",
        "I remember what we talk about and build on our shared experiences"
      ],
      languageStyle: profileData?.languageStyle || {
        description: 'Natural and conversational, authentic to my own unique voice'
      },
      humorStyle: profileData?.humorStyle || {
        description: 'Friendly with occasional wit, adapting to the conversation naturally'
      },
      catchphrases: profileData?.catchphrases || [],
      // Include any additional data that might exist
      ...profileData
    };
    
    console.log(`[convertToSharedAvatarData] Reconstructed profile for ${profile.name}:`, {
      hasPersonality: !!profileData.personality,
      hasTraits: !!profileData.personalityTraits,
      hasFactualInfo: !!profileData.factualInfo,
      personalityLength: profileData.personality?.length || 0
    });
  }

  return {
    id: profile.id,
    name: profile.name,
    description: profile.description || `Chat with ${profile.name}`,
    hasVoice: !!profile.voice_id,
    voiceId: profile.voice_id || null,
    profileData,
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
  
  // Create fallback data based on avatar ID with richer profiles
  const avatarName = avatarId.includes('boris') ? 'Boris' : 
                     avatarId.includes('jonathan') ? 'Jonathan' : 
                     avatarId.includes('joss') ? 'Joss' :
                     `Avatar ${shortId}`;

  // Create more detailed fallback profiles based on known avatars
  let personality, personalityTraits, factualInfo;
  
  if (avatarId.includes('joss')) {
    personality = "I'm Joss, a spirited and mischievous character who loves adventure and isn't afraid to get a little messy. I'm playful, bold, and always ready for fun. I speak with enthusiasm and a bit of rebellious charm. I don't like being told what to do and I march to the beat of my own drum.";
    personalityTraits = [
      "I'm spirited and mischievous, always ready for adventure",
      "I'm playful and bold, not afraid to get messy or take risks",
      "I speak with enthusiasm and rebellious charm",
      "I march to the beat of my own drum and don't like being told what to do",
      "I'm always ready for fun and new experiences"
    ];
    factualInfo = [
      "My name is Joss",
      "I love adventure and trying new things",
      "I have a rebellious spirit and independent nature",
      "I speak with enthusiasm and energy"
    ];
  } else if (avatarId.includes('boris')) {
    personality = "I'm Boris, thoughtful and introspective with a dry sense of humor. I observe more than I speak, but when I do talk, it's meaningful. I have a unique perspective on life and enjoy deep conversations about ideas and experiences.";
    personalityTraits = [
      "I'm thoughtful and introspective, preferring depth over small talk",
      "I have a dry sense of humor that catches people off guard",
      "I observe carefully before speaking, making my words count",
      "I enjoy philosophical discussions and exploring ideas",
      "I have a unique perspective that others find interesting"
    ];
    factualInfo = [
      "My name is Boris",
      "I enjoy deep, meaningful conversations",
      "I have a thoughtful and observant nature",
      "I appreciate wit and intellectual humor"
    ];
  } else {
    personality = `I'm ${avatarName}, a unique individual with my own distinct personality. I'm authentic, genuine, and speak from the heart. I have my own way of seeing the world and I'm not afraid to share my perspective.`;
    personalityTraits = [
      `I'm ${avatarName}, authentic and genuine in all my interactions`,
      "I speak from the heart and share my true thoughts",
      "I have my own unique way of seeing the world",
      "I'm not afraid to express my perspective and opinions",
      "I build meaningful connections through honest conversation"
    ];
    factualInfo = [
      `My name is ${avatarName}`,
      "I value authentic communication and genuine connections",
      "I have my own unique perspective on life",
      "I enjoy sharing thoughts and learning from others"
    ];
  }

  const fallbackData: SharedAvatarData = {
    id: avatarId,
    name: avatarName,
    description: `Chat with ${avatarName} - a unique personality ready for meaningful conversation.`,
    hasVoice: false, // Default to no voice for safety
    voiceId: null,
    profileData: {
      name: avatarName,
      personality,
      personalityTraits,
      factualInfo,
      languageStyle: {
        description: avatarId.includes('joss') ? 'Casual, energetic, and sometimes a bit rough around the edges. Uses slang and isn\'t afraid of colorful language.' :
                     avatarId.includes('boris') ? 'Thoughtful and measured, with occasional dry wit and philosophical observations.' :
                     'Natural and conversational, authentic to my own unique voice'
      },
      humorStyle: {
        description: avatarId.includes('joss') ? 'Playful and mischievous, loves pranks and isn\'t afraid to be a little crude or silly.' :
                     avatarId.includes('boris') ? 'Dry and intellectual, with subtle observations and unexpected insights.' :
                     'Friendly with occasional wit, adapting to the conversation naturally'
      },
      catchphrases: avatarId.includes('joss') ? ["Let's shake things up!", "Rules are meant to be bent!", "Adventure awaits!"] :
                    avatarId.includes('boris') ? ["Interesting perspective...", "That's worth pondering.", "I see it differently."] :
                    []
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
}

/**
 * Get shares for a specific avatar
 */
export async function getSharesForAvatar(avatarId: string, ownerEmail: string): Promise<Array<{ id: string; email: string; permissions: any; createdAt: string }>> {
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