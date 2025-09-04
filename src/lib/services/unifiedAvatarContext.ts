/**
 * Unified Avatar Context Service
 * Single RPC call to fetch all avatar context (facts, memories, style)
 */

import { supabase } from '@/lib/supabase';
import { resolveAvatarId } from './resolveAvatar';
import { filterDemoMemories } from '@/lib/demoScope';
import { Result, ok, err, wrapResult } from '@/lib/utils/result';

export interface AvatarContext {
  facts: any[];
  memories: any[];
  style: any;
  metadata: {
    avatarId: string;
    query: string;
    retrievalTimeMs: number;
    factsCount: number;
    memoriesCount: number;
    cacheHit: boolean;
  };
}

export interface AvatarContextOptions {
  query?: string;
  memoryLimit?: number;
  similarityThreshold?: number;
  priorityFilter?: number;
  demoMode?: {
    isDemo: boolean;
    visitorId?: string;
    conversationId?: string;
  };
}

class UnifiedAvatarContextService {
  private cache = new Map<string, { data: AvatarContext; timestamp: number }>();
  private readonly CACHE_TTL = 30 * 1000; // 30 seconds

  /**
   * Get complete avatar context in a single RPC call
   */
  async getAvatarContext(
    avatarSlug: string,
    options: AvatarContextOptions = {}
  ): Promise<Result<AvatarContext>> {
    const startTime = Date.now();
    const {
      query = '',
      memoryLimit = 64,
      similarityThreshold = 0.6,
      priorityFilter = 6,
      demoMode
    } = options;

    // Create cache key
    const cacheKey = `${avatarSlug}:${query.substring(0, 50)}:${memoryLimit}:${similarityThreshold}:${priorityFilter}:${demoMode?.isDemo ? 'demo' : 'normal'}`;
    
    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log(`[UnifiedAvatarContext] Cache hit for ${avatarSlug}`);
      return ok({
        ...cached.data,
        metadata: {
          ...cached.data.metadata,
          cacheHit: true
        }
      });
    }

    return wrapResult(this.fetchAvatarContext(avatarSlug, options, startTime, cacheKey), 'avatar_context_fetch');
  }

  private async fetchAvatarContext(
    avatarSlug: string,
    options: AvatarContextOptions,
    startTime: number,
    cacheKey: string
  ): Promise<AvatarContext> {
    const {
      query = '',
      memoryLimit = 64,
      similarityThreshold = 0.6,
      priorityFilter = 6,
      demoMode
    } = options;

    // Resolve avatar ID
    const avatarId = await resolveAvatarId(avatarSlug);
    if (!avatarId) {
      throw new Error(`Avatar not found: ${avatarSlug}`);
    }

    console.log(`[UnifiedAvatarContext] Fetching context for ${avatarSlug} (${avatarId})`);

    // Use existing get_enhanced_memories function since get_avatar_context doesn't exist
    const { data: memoriesData, error: memoriesError } = await supabase.rpc('get_enhanced_memories', {
      target_user_id: null,
      target_avatar_id: avatarId,
      search_query: query,
      match_count: memoryLimit,
      similarity_threshold: similarityThreshold,
      include_bio_facts: true
    });

    // Get quick facts separately
    const { data: factsData, error: factsError } = await supabase
      .from('quick_facts')
      .select('id,key,value,confidence,priority,source,source_reference,date_context,created_at,updated_at')
      .eq('avatar_id', avatarId)
      .lte('priority', priorityFilter)
      .gte('confidence', 0.3)
      .order('priority')
      .order('confidence', { ascending: false })
      .limit(25);

    // Get style profile from quick facts
    const { data: styleData, error: styleError } = await supabase
      .from('quick_facts')
      .select('key,value')
      .eq('avatar_id', avatarId)
      .in('key', ['speaking_style', 'humor_style', 'emotional_expression', 'signature_phrases', 'address_male_friend']);

    const error = memoriesError || factsError || styleError;

    if (error) {
      console.error('Unified avatar context fetch failed:', error);
      throw new Error(`Failed to fetch avatar context: ${error.message}`);
    }

    let facts = factsData || [];
    let memories = memoriesData || [];
    
    // Build style object from style data
    const style: any = {};
    if (styleData) {
      styleData.forEach((item: any) => {
        style[item.key] = item.value;
      });
    }

    // Apply demo mode filtering to memories if needed
    if (demoMode?.isDemo && memories.length > 0) {
      memories = filterDemoMemories(memories, {
        avatarId,
        visitorId: demoMode.visitorId,
        isDemo: true
      });
      
      console.log(`[UnifiedAvatarContext] Demo filtering: ${memories.length} memories after filtering`);
    }

    const retrievalTimeMs = Date.now() - startTime;
    
    const context: AvatarContext = {
      facts,
      memories,
      style,
      metadata: {
        avatarId,
        query,
        retrievalTimeMs,
        factsCount: facts.length,
        memoriesCount: memories.length,
        cacheHit: false
      }
    };

    // Cache the result
    this.cache.set(cacheKey, {
      data: context,
      timestamp: Date.now()
    });

    console.log(`[UnifiedAvatarContext] Retrieved context in ${retrievalTimeMs}ms: ${facts.length} facts, ${memories.length} memories`);

    return context;
  }

  /**
   * Clear cache for specific avatar
   */
  clearCache(avatarSlug?: string): void {
    if (avatarSlug) {
      // Clear entries that start with the avatar slug
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${avatarSlug}:`)) {
          this.cache.delete(key);
        }
      }
    } else {
      // Clear all cache
      this.cache.clear();
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Singleton instance
export const unifiedAvatarContextService = new UnifiedAvatarContextService();

/**
 * Convenience function for getting avatar context
 */
export async function getAvatarContext(
  avatarSlug: string,
  options: AvatarContextOptions = {}
): Promise<Result<AvatarContext>> {
  return unifiedAvatarContextService.getAvatarContext(avatarSlug, options);
}