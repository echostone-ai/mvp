/**
 * StoryIntegrationService - Integrates authentic voice stories into chat flow
 * 
 * This service acts as the bridge between the chat system and story system,
 * checking for story triggers before TTS generation and seamlessly replacing
 * TTS with authentic voice stories when appropriate.
 */

import { UserStoryService } from './userStoryService';
import { StoryAudioManager } from './storyAudioManager';
import { defaultTriggerMatcher } from './storyTriggerMatcher';
import { UserStory, StoryTriggerMatch } from '../types/stories';

export interface StoryCheckResult {
  hasStory: boolean;
  story?: UserStory;
  match?: StoryTriggerMatch;
  shouldPlayStory: boolean;
  reason?: string;
}

export interface StoryIntegrationOptions {
  enableStories?: boolean;
  avatarId: string;
  userId?: string;
  maxStoryDuration?: number;
}

export class StoryIntegrationService {
  private audioManager: StoryAudioManager;

  constructor() {
    this.audioManager = new StoryAudioManager();
  }

  /**
   * Check if user input should trigger a story instead of TTS
   * This is called before TTS generation in the chat flow
   */
  async checkForStoryTrigger(
    userMessage: string,
    options: StoryIntegrationOptions
  ): Promise<StoryCheckResult> {
    try {
      // Check if stories are enabled
      if (!options.enableStories || process.env.STORIES_ENABLED === 'false') {
        return {
          hasStory: false,
          shouldPlayStory: false,
          reason: 'Stories feature disabled'
        };
      }

      // Check cooldown to prevent story spam
      const storyService = new UserStoryService();
      const isInCooldown = await storyService.isAvatarInCooldown(options.avatarId);
      if (isInCooldown) {
        return {
          hasStory: false,
          shouldPlayStory: false,
          reason: 'Avatar in cooldown period (30s between stories)'
        };
      }

      // Get stories for this avatar
      const stories = await UserStoryService.getStoriesByOwner(options.avatarId, 'avatar');
      console.log('[StoryIntegration] Found stories:', stories.length);
      console.log('[StoryIntegration] First story:', stories[0] ? {
        id: stories[0].id,
        title: stories[0].title,
        triggers: stories[0].triggers,
        triggersType: typeof stories[0].triggers
      } : 'none');
      
      if (!stories.length) {
        return {
          hasStory: false,
          shouldPlayStory: false,
          reason: 'No stories available for avatar'
        };
      }

      // Find matching stories using the direct approach that works
      console.log('[StoryIntegration] Checking message for triggers:', userMessage);
      
      // Step 1: Analyze text
      const keywords = defaultTriggerMatcher.analyzeText(userMessage);
      console.log('[StoryIntegration] Extracted keywords:', keywords);
      
      // Step 2: Match triggers
      const matches = await defaultTriggerMatcher.matchTriggers(keywords, stories);
      console.log('[StoryIntegration] Found matches:', matches.length);

      if (!matches.length) {
        return {
          hasStory: false,
          shouldPlayStory: false,
          reason: 'No matching story triggers found'
        };
      }

      // Step 3: Select best story (first match for MVP)
      const bestMatch = matches[0];
      console.log('[StoryIntegration] Selected story:', bestMatch.story.title);

      return {
        hasStory: true,
        story: bestMatch.story,
        match: bestMatch,
        shouldPlayStory: true,
        reason: `Story triggered by keywords: ${bestMatch.matched_keywords.join(', ')}`
      };

    } catch (error) {
      console.error('[StoryIntegration] Error checking for story trigger:', error);
      return {
        hasStory: false,
        shouldPlayStory: false,
        reason: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Play a story instead of TTS
   * Returns story audio data that can be streamed to the client
   */
  async playStoryInsteadOfTTS(
    story: UserStory,
    options: StoryIntegrationOptions
  ): Promise<{
    success: boolean;
    audioUrl?: string;
    duration?: number;
    error?: string;
  }> {
    try {
      // Record the trigger for cooldown tracking
      const storyService = new UserStoryService();
      await storyService.recordStoryTrigger(options.avatarId);

      // Return story audio information
      return {
        success: true,
        audioUrl: story.audio_url,
        duration: story.duration_ms,
      };

    } catch (error) {
      console.error('[StoryIntegration] Error playing story:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get story metadata for client-side playback
   * Used when the client needs to handle story playback directly
   */
  async getStoryPlaybackData(story: UserStory): Promise<{
    audioUrl: string;
    duration: number;
    title: string;
    transcript?: string;
  }> {
    return {
      audioUrl: story.audio_url,
      duration: story.duration_ms,
      title: story.title,
      transcript: story.transcript || undefined
    };
  }
}

// Export singleton instance
export const storyIntegrationService = new StoryIntegrationService();