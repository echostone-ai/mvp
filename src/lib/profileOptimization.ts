// Profile Optimization for Lightning-Fast Avatar Responses
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

interface OptimizedProfile {
  id: string;
  name: string;
  core_personality: string; // 200 chars max - essential traits only
  quick_facts: string; // 300 chars max - key biographical info
  conversation_style: string; // 150 chars max - how they speak
  current_context: string; // 200 chars max - current life situation
  cached_at: string;
}

interface FullProfile {
  id: string;
  full_data: any; // Complete JSON profile
  updated_at: string;
}

export class ProfileOptimizer {
  private static cache = new Map<string, OptimizedProfile>();
  private static fullCache = new Map<string, FullProfile>();

  // Get ultra-fast profile for quick responses (< 50ms)
  static async getQuickProfile(profileId: string): Promise<OptimizedProfile | null> {
    // Check memory cache first
    if (this.cache.has(profileId)) {
      return this.cache.get(profileId)!;
    }

    try {
      const { data, error } = await supabase
        .from('optimized_profiles')
        .select('*')
        .eq('id', profileId)
        .single();

      if (error || !data) return null;

      // Cache in memory for 5 minutes
      this.cache.set(profileId, data);
      setTimeout(() => this.cache.delete(profileId), 5 * 60 * 1000);

      return data;
    } catch (error) {
      console.error('Quick profile fetch error:', error);
      return null;
    }
  }

  // Get full profile for complex queries (fallback)
  static async getFullProfile(profileId: string): Promise<any | null> {
    if (this.fullCache.has(profileId)) {
      return this.fullCache.get(profileId)!.full_data;
    }

    try {
      const { data, error } = await supabase
        .from('full_profiles')
        .select('*')
        .eq('id', profileId)
        .single();

      if (error || !data) return null;

      this.fullCache.set(profileId, data);
      setTimeout(() => this.fullCache.delete(profileId), 10 * 60 * 1000);

      return data.full_data;
    } catch (error) {
      console.error('Full profile fetch error:', error);
      return null;
    }
  }

  // Create optimized profile from full JSON
  static optimizeProfile(fullProfile: any): OptimizedProfile {
    return {
      id: fullProfile.full_name?.toLowerCase().replace(/\s+/g, '_') || 'unknown',
      name: fullProfile.full_name || 'Unknown',
      core_personality: this.extractCorePersonality(fullProfile),
      quick_facts: this.extractQuickFacts(fullProfile),
      conversation_style: this.extractConversationStyle(fullProfile),
      current_context: this.extractCurrentContext(fullProfile),
      cached_at: new Date().toISOString()
    };
  }

  private static extractCorePersonality(profile: any): string {
    const traits = [
      profile.personality?.slice(0, 100),
      profile.summary?.slice(0, 100)
    ].filter(Boolean).join('. ').slice(0, 200);
    
    return traits || 'Friendly and conversational';
  }

  private static extractQuickFacts(profile: any): string {
    const facts = [
      profile.location && `Lives in ${profile.location.split('—')[0].trim()}`,
      profile.partner?.name && `Partner: ${profile.partner.name}`,
      profile.dog && `Dog: ${profile.dog.split(',')[0]}`,
      profile.places_lived?.length > 0 && `Traveled extensively`
    ].filter(Boolean).join('. ').slice(0, 300);
    
    return facts || 'Interesting person with many stories';
  }

  private static extractConversationStyle(profile: any): string {
    const style = [
      profile.humorStyle?.description?.slice(0, 80),
      profile.languageStyle?.description?.slice(0, 80)
    ].filter(Boolean).join('. ').slice(0, 150);
    
    return style || 'Witty and engaging conversationalist';
  }

  private static extractCurrentContext(profile: any): string {
    const context = [
      profile.location?.split('—')[1]?.trim(),
      profile.hobbies?.slice(0, 3).join(', ')
    ].filter(Boolean).join('. ').slice(0, 200);
    
    return context || 'Living life to the fullest';
  }
}

// Database schema for Supabase
export const OPTIMIZED_PROFILE_SCHEMA = `
CREATE TABLE optimized_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  core_personality TEXT NOT NULL,
  quick_facts TEXT NOT NULL,
  conversation_style TEXT NOT NULL,
  current_context TEXT NOT NULL,
  cached_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_cached_at (cached_at)
);

CREATE TABLE full_profiles (
  id TEXT PRIMARY KEY,
  full_data JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW(),
  INDEX idx_updated_at (updated_at)
);
`;