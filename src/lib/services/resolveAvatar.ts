/**
 * Unified Avatar Resolution Service
 * Centralized avatar ID resolution with caching
 */

import { supabase } from '@/lib/supabase';

interface AvatarCache {
  id: string;
  timestamp: number;
}

class AvatarResolver {
  private cache = new Map<string, AvatarCache>();
  private readonly TTL = 10 * 60 * 1000; // 10 minutes

  /**
   * Resolve avatar ID from name or slug with caching
   */
  async resolveAvatarId(nameOrSlug: string): Promise<string | null> {
    // Check cache first
    const cached = this.cache.get(nameOrSlug);
    if (cached && Date.now() - cached.timestamp < this.TTL) {
      return cached.id;
    }

    try {
      // Use the database RPC for consistent resolution
      const { data, error } = await supabase.rpc('resolve_avatar_id', {
        profile_name: nameOrSlug,
        avatar_slug: nameOrSlug
      });

      if (error) {
        console.warn(`Avatar resolution failed for "${nameOrSlug}":`, error);
        return null;
      }

      const avatarId = data as string;
      
      // Cache the result
      this.cache.set(nameOrSlug, {
        id: avatarId,
        timestamp: Date.now()
      });

      return avatarId;
    } catch (error) {
      console.error(`Avatar resolution error for "${nameOrSlug}":`, error);
      return null;
    }
  }

  /**
   * Clear cache entry
   */
  clearCache(nameOrSlug: string): void {
    this.cache.delete(nameOrSlug);
  }

  /**
   * Clear all cache entries
   */
  clearAllCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats for debugging
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
}

// Singleton instance
export const avatarResolver = new AvatarResolver();

/**
 * Convenience function for resolving avatar ID
 */
export async function resolveAvatarId(nameOrSlug: string): Promise<string | null> {
  return avatarResolver.resolveAvatarId(nameOrSlug);
}