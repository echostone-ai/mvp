import { SupabaseClient } from '@supabase/supabase-js';

export interface AvatarIdentifier {
  profileName?: string;
  avatarSlug?: string;
}

/**
 * Resolves avatar ID by trying avatar_profiles.name first, then fallback to avatars.slug
 * @param identifier - Object containing profileName and/or avatarSlug
 * @param supabaseService - Supabase client instance
 * @returns Promise<string> - The resolved avatar_id
 * @throws Error if no avatar found or multiple matches
 */
export async function resolveAvatarId(
  identifier: AvatarIdentifier,
  supabaseService: SupabaseClient
): Promise<string> {
  const { profileName, avatarSlug } = identifier;

  if (!profileName && !avatarSlug) {
    throw new Error('Either profileName or avatarSlug must be provided');
  }

  // Handle mock avatars for development/demo mode
  if (avatarSlug === 'jonathan-demo') {
    // Always return the real Jonathan Braden UUID for demo mode
    return '0585f43b-4b49-4e16-b2a7-91c8e1e3850c';
  }

  // First try: avatar_profiles.name
  if (profileName) {
    const { data: profileData, error: profileError } = await supabaseService
      .from('avatar_profiles')
      .select('id')
      .eq('name', profileName)
      .single();

    if (!profileError && profileData?.id) {
      return profileData.id;
    }
  }

  // Second try: avatar_profiles.name with avatarSlug
  if (avatarSlug) {
    const { data: profileData, error: profileError } = await supabaseService
      .from('avatar_profiles')
      .select('id')
      .eq('name', avatarSlug)
      .single();

    if (!profileError && profileData?.id) {
      return profileData.id;
    }
  }

  // Third try: Check for common avatar mappings
  const avatarMappings: Record<string, string> = {
    'jonathan-demo': '0585f43b-4b49-4e16-b2a7-91c8e1e3850c',
    'jonathan_braden': '0585f43b-4b49-4e16-b2a7-91c8e1e3850c',
    'jonathan': '0585f43b-4b49-4e16-b2a7-91c8e1e3850c'
  };
  
  if (avatarSlug && avatarMappings[avatarSlug]) {
    return avatarMappings[avatarSlug];
  }

  // Fallback: avatars.slug (if table exists)
  if (avatarSlug) {
    try {
      const { data: avatarData, error: avatarError } = await supabaseService
        .from('avatars')
        .select('id')
        .eq('slug', avatarSlug)
        .single();

      if (!avatarError && avatarData?.id) {
        return avatarData.id;
      }
    } catch (error) {
      // avatars table might not exist, continue to error
    }
  }

  // No matches found
  const searchTerms = [
    profileName && `profileName: ${profileName}`,
    avatarSlug && `avatarSlug: ${avatarSlug}`
  ].filter(Boolean).join(', ');

  throw new Error(`No avatar found for ${searchTerms}`);
}