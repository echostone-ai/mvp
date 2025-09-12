// src/lib/services/storyAnalyticsIntegration.ts
// Integration layer for story analytics tracking

import { StoryAnalyticsService } from './storyAnalyticsService';
import { UserStory, StoryTriggerMatch } from '../types/stories';

export class StoryAnalyticsIntegration {
  private static instance: StoryAnalyticsIntegration;
  private analyticsService: StoryAnalyticsService;
  
  static getInstance(): StoryAnalyticsIntegration {
    if (!StoryAnalyticsIntegration.instance) {
      StoryAnalyticsIntegration.instance = new StoryAnalyticsIntegration();
    }
    return StoryAnalyticsIntegration.instance;
  }

  constructor() {
    this.analyticsService = StoryAnalyticsService.getInstance();
  }

  /**
   * Record story trigger event
   */
  async recordStoryTrigger(
    story: UserStory,
    sessionId: string,
    triggerText: string,
    matchedKeywords: string[],
    confidenceScore: number,
    playedSuccessfully: boolean,
    playbackDurationMs?: number,
    errorMessage?: string
  ): Promise<void> {
    try {
      await this.analyticsService.recordStoryTrigger({
        storyId: story.id,
        sessionId,
        triggerText,
        matchedKeywords,
        confidenceScore,
        playedSuccessfully,
        playbackDurationMs: playbackDurationMs || null,
        errorMessage: errorMessage || null,
      });
    } catch (error) {
      // Analytics failures should not break story functionality
      console.warn('Failed to record story analytics:', error);
    }
  }

  /**
   * Record story trigger from match result
   */
  async recordStoryTriggerFromMatch(
    match: StoryTriggerMatch,
    sessionId: string,
    triggerText: string,
    playedSuccessfully: boolean,
    playbackDurationMs?: number,
    errorMessage?: string
  ): Promise<void> {
    await this.recordStoryTrigger(
      match.story,
      sessionId,
      triggerText,
      match.matched_keywords,
      match.confidence,
      playedSuccessfully,
      playbackDurationMs,
      errorMessage
    );
  }

  /**
   * Record story playback success
   */
  async recordStoryPlaybackSuccess(
    story: UserStory,
    sessionId: string,
    triggerText: string,
    matchedKeywords: string[],
    confidenceScore: number,
    playbackDurationMs: number
  ): Promise<void> {
    await this.recordStoryTrigger(
      story,
      sessionId,
      triggerText,
      matchedKeywords,
      confidenceScore,
      true,
      playbackDurationMs
    );
  }

  /**
   * Record story playback failure
   */
  async recordStoryPlaybackFailure(
    story: UserStory,
    sessionId: string,
    triggerText: string,
    matchedKeywords: string[],
    confidenceScore: number,
    errorMessage: string
  ): Promise<void> {
    await this.recordStoryTrigger(
      story,
      sessionId,
      triggerText,
      matchedKeywords,
      confidenceScore,
      false,
      undefined,
      errorMessage
    );
  }

  /**
   * Generate session ID for analytics tracking
   */
  generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get analytics for a specific story
   */
  async getStoryAnalytics(storyId: string) {
    try {
      return await this.analyticsService.getStoryUsageReport(storyId);
    } catch (error) {
      console.error('Failed to get story analytics:', error);
      return null;
    }
  }

  /**
   * Get effectiveness metrics for an owner
   */
  async getEffectivenessMetrics(ownerId: string, ownerType: 'user' | 'avatar') {
    try {
      return await this.analyticsService.getStoryEffectivenessMetrics(ownerId, ownerType);
    } catch (error) {
      console.error('Failed to get effectiveness metrics:', error);
      return [];
    }
  }

  /**
   * Get aggregated analytics for an owner
   */
  async getAggregatedAnalytics(ownerId: string, ownerType: 'user' | 'avatar') {
    try {
      return await this.analyticsService.getAggregatedAnalytics(ownerId, ownerType);
    } catch (error) {
      console.error('Failed to get aggregated analytics:', error);
      return null;
    }
  }
}

export default StoryAnalyticsIntegration;