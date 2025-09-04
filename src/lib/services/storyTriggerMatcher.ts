/**
 * StoryTriggerMatcher - Simplified trigger matching system for authentic voice stories
 * 
 * MVP Implementation:
 * - Exact case-insensitive keyword matching (no fuzzy matching)
 * - Simple text normalization and tokenization
 * - Upload order for story selection (no priority scoring)
 * - 30-second cooldown mechanism per avatar
 */

import { UserStory, StoryTriggerMatch, parseTriggersFromString, STORY_CONSTRAINTS } from '../types/stories';
import { storyErrorHandler } from './storyErrorHandler';
import StoryMetricsCollector from './storyMetrics';

export interface TriggerMatchingOptions {
  enableCooldown?: boolean;
  cooldownMs?: number;
  maxMatches?: number;
  minKeywordLength?: number;
}

export interface CooldownEntry {
  avatarId: string;
  lastTriggerTime: number;
}

export class StoryTriggerMatcher {
  private cooldownCache = new Map<string, number>(); // avatarId -> lastTriggerTime
  private readonly defaultOptions: Required<TriggerMatchingOptions> = {
    enableCooldown: true,
    cooldownMs: STORY_CONSTRAINTS.COOLDOWN_MS, // 30 seconds
    maxMatches: 10,
    minKeywordLength: 3
  };
  private metricsCollector = StoryMetricsCollector.getInstance();

  constructor(private options: TriggerMatchingOptions = {}) {
    this.options = { ...this.defaultOptions, ...options };
  }

  /**
   * Analyze input text and extract normalized keywords
   * Simple tokenization: split on whitespace, normalize case, filter short words
   */
  analyzeText(text: string): string[] {
    if (!text || typeof text !== 'string') {
      return [];
    }

    // Normalize text: lowercase, trim, remove extra whitespace
    const normalized = text.toLowerCase().trim().replace(/\s+/g, ' ');
    
    // Simple tokenization: split on whitespace and punctuation
    const tokens = normalized
      .split(/[\s\.,!?;:()[\]{}'"]+/)
      .map(token => token.trim())
      .filter(token => 
        token.length >= this.options.minKeywordLength! && 
        /^[a-z0-9]+$/i.test(token) // Only alphanumeric tokens
      );

    // Remove duplicates and limit to reasonable number for performance
    return [...new Set(tokens)].slice(0, 20);
  }

  /**
   * Find stories that match the input keywords with error handling
   * Uses exact case-insensitive matching (no fuzzy matching for MVP)
   */
  async matchTriggers(
    inputKeywords: string[], 
    stories: UserStory[]
  ): Promise<StoryTriggerMatch[]> {
    try {
      if (!inputKeywords.length || !stories.length) {
        return [];
      }

      const matches: StoryTriggerMatch[] = [];

      for (const story of stories) {
        // Skip inactive stories
        if (story.status !== 'active') {
          continue;
        }

        // Parse story triggers with error handling
        let storyTriggers: string[];
        try {
          storyTriggers = parseTriggersFromString(story.triggers);
          if (!storyTriggers.length) {
            continue;
          }
        } catch (parseError) {
          console.warn(`[StoryTriggerMatcher] Failed to parse triggers for story ${story.id}:`, parseError);
          continue; // Skip this story and continue with others
        }

        // Find exact matches (case-insensitive)
        const matchedKeywords: string[] = [];
        for (const trigger of storyTriggers) {
          const normalizedTrigger = trigger.toLowerCase().trim();
          if (inputKeywords.some(keyword => keyword.toLowerCase() === normalizedTrigger)) {
            matchedKeywords.push(trigger);
          }
        }

        // If we found matches, create a match entry
        if (matchedKeywords.length > 0) {
          // Simple confidence calculation: ratio of matched triggers to total triggers
          const confidence = matchedKeywords.length / storyTriggers.length;
          
          // For MVP, context relevance is just the confidence score
          const contextRelevance = confidence;

          matches.push({
            story,
            confidence,
            matched_keywords: matchedKeywords,
            context_relevance: contextRelevance
          });
        }
      }

      // Sort by upload order (created_at ascending) for MVP
      // Later versions will use priority scoring
      matches.sort((a, b) => {
        const dateA = new Date(a.story.created_at).getTime();
        const dateB = new Date(b.story.created_at).getTime();
        return dateA - dateB; // Older stories first (upload order)
      });

      return matches.slice(0, this.options.maxMatches!);
      
    } catch (error) {
      // Handle critical matching errors
      console.error('[StoryTriggerMatcher] Critical error in trigger matching:', error);
      
      // Use error handler for trigger matching failures
      const fallbackCallback = async () => {
        // No-op fallback for trigger matching - just continue without stories
        console.log('[StoryTriggerMatcher] Continuing without story matching due to error');
      };
      
      await storyErrorHandler.handleTriggerMatchingError(
        error instanceof Error ? error : new Error('Unknown trigger matching error'),
        'Trigger matching failed',
        fallbackCallback
      );
      
      return []; // Return empty matches on error
    }
  }

  /**
   * Select the best story from matches
   * For MVP: simply return the first match (oldest uploaded story)
   */
  async selectBestStory(matches: StoryTriggerMatch[]): Promise<UserStory | null> {
    if (!matches.length) {
      return null;
    }

    // For MVP: return the first match (oldest story due to sorting)
    return matches[0].story;
  }

  /**
   * Check if avatar is in cooldown period
   */
  isInCooldown(avatarId: string): boolean {
    if (!this.options.enableCooldown) {
      return false;
    }

    const lastTriggerTime = this.cooldownCache.get(avatarId);
    if (!lastTriggerTime) {
      return false;
    }

    const now = Date.now();
    const timeSinceLastTrigger = now - lastTriggerTime;
    return timeSinceLastTrigger < this.options.cooldownMs!;
  }

  /**
   * Get remaining cooldown time in milliseconds
   */
  getRemainingCooldown(avatarId: string): number {
    if (!this.options.enableCooldown) {
      return 0;
    }

    const lastTriggerTime = this.cooldownCache.get(avatarId);
    if (!lastTriggerTime) {
      return 0;
    }

    const now = Date.now();
    const timeSinceLastTrigger = now - lastTriggerTime;
    const remaining = this.options.cooldownMs! - timeSinceLastTrigger;
    
    return Math.max(0, remaining);
  }

  /**
   * Record that a story was triggered for an avatar (starts cooldown)
   */
  recordTrigger(avatarId: string): void {
    if (this.options.enableCooldown) {
      this.cooldownCache.set(avatarId, Date.now());
    }
  }

  /**
   * Apply cooldown throttling to matches
   * Filters out matches if avatar is in cooldown period
   */
  async applyThrottling(
    matches: StoryTriggerMatch[], 
    avatarId: string
  ): Promise<StoryTriggerMatch[]> {
    if (!this.options.enableCooldown || !this.isInCooldown(avatarId)) {
      return matches;
    }

    // Avatar is in cooldown, return empty matches
    return [];
  }

  /**
   * Complete trigger matching workflow with comprehensive error handling
   * Combines text analysis, trigger matching, and throttling
   */
  async findMatchingStories(
    inputText: string,
    stories: UserStory[],
    avatarId: string
  ): Promise<StoryTriggerMatch[]> {
    const startTime = Date.now();
    
    try {
      // Track system overhead
      const overheadStartTime = Date.now();
      
      // Step 1: Analyze input text
      const keywords = this.analyzeText(inputText);
      if (!keywords.length) {
        this.metricsCollector.trackStoryMatching(avatarId, startTime, false);
        return [];
      }

      // Step 2: Find matching stories (with built-in error handling)
      const matches = await this.matchTriggers(keywords, stories);
      if (!matches.length) {
        this.metricsCollector.trackStoryMatching(avatarId, startTime, false);
        return [];
      }

      // Step 3: Apply throttling (cooldown check)
      const throttledMatches = await this.applyThrottling(matches, avatarId);

      // Track metrics
      const matchFound = throttledMatches.length > 0;
      this.metricsCollector.trackStoryMatching(avatarId, startTime, matchFound);
      this.metricsCollector.trackSystemOverhead('trigger_matching', overheadStartTime);

      return throttledMatches;
      
    } catch (error) {
      // Track failed matching
      this.metricsCollector.trackStoryMatching(avatarId, startTime, false);
      
      // Handle any unexpected errors in the workflow
      console.error('[StoryTriggerMatcher] Error in findMatchingStories workflow:', error);
      
      // Use error handler for workflow failures
      const fallbackCallback = async () => {
        console.log('[StoryTriggerMatcher] Continuing conversation without story matching');
      };
      
      await storyErrorHandler.handleTriggerMatchingError(
        error instanceof Error ? error : new Error('Story matching workflow failed'),
        'Story matching workflow error',
        fallbackCallback
      );
      
      return []; // Return empty matches to continue conversation normally
    }
  }

  /**
   * Clear cooldown for an avatar (for testing or admin purposes)
   */
  clearCooldown(avatarId: string): void {
    this.cooldownCache.delete(avatarId);
  }

  /**
   * Clear all cooldowns (for testing purposes)
   */
  clearAllCooldowns(): void {
    this.cooldownCache.clear();
  }

  /**
   * Get current cooldown status for debugging
   */
  getCooldownStatus(): CooldownEntry[] {
    const now = Date.now();
    return Array.from(this.cooldownCache.entries()).map(([avatarId, lastTriggerTime]) => ({
      avatarId,
      lastTriggerTime
    }));
  }

  /**
   * Update cooldown settings at runtime
   */
  updateOptions(newOptions: Partial<TriggerMatchingOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }

  /**
   * Get current matching options
   */
  getOptions(): Required<TriggerMatchingOptions> {
    return { ...this.options } as Required<TriggerMatchingOptions>;
  }
}

// Export a default instance for convenience
export const defaultTriggerMatcher = new StoryTriggerMatcher();

// Helper functions for common use cases

/**
 * Quick text analysis without instantiating a matcher
 */
export function analyzeTextQuick(text: string, minLength = 3): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const normalized = text.toLowerCase().trim().replace(/\s+/g, ' ');
  const tokens = normalized
    .split(/[\s\.,!?;:()[\]{}'"]+/)
    .map(token => token.trim())
    .filter(token => 
      token.length >= minLength && 
      /^[a-z0-9]+$/i.test(token)
    );

  return [...new Set(tokens)].slice(0, 20);
}

/**
 * Simple exact match check without full matching logic
 */
export function hasExactMatch(inputKeywords: string[], storyTriggers: string[]): boolean {
  if (!inputKeywords.length || !storyTriggers.length) {
    return false;
  }

  const normalizedInput = inputKeywords.map(k => k.toLowerCase());
  const normalizedTriggers = storyTriggers.map(t => t.toLowerCase().trim());

  return normalizedTriggers.some(trigger => 
    normalizedInput.includes(trigger)
  );
}

/**
 * Calculate simple confidence score
 */
export function calculateConfidence(matchedCount: number, totalTriggers: number): number {
  if (totalTriggers === 0) return 0;
  return Math.min(1, matchedCount / totalTriggers);
}