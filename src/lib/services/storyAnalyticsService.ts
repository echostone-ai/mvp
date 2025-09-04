// src/lib/services/storyAnalyticsService.ts
// Comprehensive analytics service for authentic voice stories

import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export interface StoryAnalytics {
  storyId: string;
  sessionId: string;
  triggerText: string;
  matchedKeywords: string[];
  confidenceScore: number;
  playedSuccessfully: boolean;
  playbackDurationMs: number | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface StoryUsageReport {
  storyId: string;
  title: string;
  category: string;
  totalTriggers: number;
  successfulPlays: number;
  failedPlays: number;
  successRate: number;
  avgPlaybackDuration: number;
  avgConfidenceScore: number;
  topTriggerKeywords: Array<{ keyword: string; count: number }>;
  lastTriggered: string | null;
  createdAt: string;
}

export interface StoryEffectivenessMetrics {
  storyId: string;
  title: string;
  category: string;
  triggerFrequency: number; // triggers per day
  engagementScore: number; // 0-100 based on completion rate and confidence
  userSatisfactionScore: number; // 0-100 based on playback completion
  recommendedActions: string[];
}

export interface AggregatedAnalytics {
  totalStories: number;
  totalTriggers: number;
  totalSuccessfulPlays: number;
  overallSuccessRate: number;
  avgStoryDuration: number;
  topCategories: Array<{ category: string; count: number; successRate: number }>;
  triggerTrends: Array<{ date: string; triggers: number; successes: number }>;
  performanceMetrics: {
    avgMatchLatency: number;
    avgStartLatency: number;
    slaCompliance: number;
  };
}

export class StoryAnalyticsService {
  private static instance: StoryAnalyticsService;
  
  static getInstance(): StoryAnalyticsService {
    if (!StoryAnalyticsService.instance) {
      StoryAnalyticsService.instance = new StoryAnalyticsService();
    }
    return StoryAnalyticsService.instance;
  }

  /**
   * Record a story trigger event for analytics
   */
  async recordStoryTrigger(analytics: Omit<StoryAnalytics, 'createdAt'>): Promise<void> {
    try {
      const { error } = await supabase
        .from('story_usage_analytics')
        .insert({
          story_id: analytics.storyId,
          session_id: analytics.sessionId,
          trigger_text: analytics.triggerText,
          matched_keywords: analytics.matchedKeywords,
          confidence_score: analytics.confidenceScore,
          played_successfully: analytics.playedSuccessfully,
          playback_duration_ms: analytics.playbackDurationMs,
          error_message: analytics.errorMessage,
        });

      if (error) {
        console.error('Failed to record story analytics:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error recording story trigger:', error);
      // Don't throw - analytics failures shouldn't break story playback
    }
  }

  /**
   * Get usage report for a specific story
   */
  async getStoryUsageReport(storyId: string): Promise<StoryUsageReport | null> {
    try {
      // Get story details
      const { data: story, error: storyError } = await supabase
        .from('user_stories')
        .select('title, category, created_at')
        .eq('id', storyId)
        .single();

      if (storyError || !story) {
        throw new Error(`Story not found: ${storyId}`);
      }

      // Get analytics data
      const { data: analytics, error: analyticsError } = await supabase
        .from('story_usage_analytics')
        .select('*')
        .eq('story_id', storyId);

      if (analyticsError) {
        throw analyticsError;
      }

      if (!analytics || analytics.length === 0) {
        return {
          storyId,
          title: story.title,
          category: story.category,
          totalTriggers: 0,
          successfulPlays: 0,
          failedPlays: 0,
          successRate: 0,
          avgPlaybackDuration: 0,
          avgConfidenceScore: 0,
          topTriggerKeywords: [],
          lastTriggered: null,
          createdAt: story.created_at,
        };
      }

      // Calculate metrics
      const totalTriggers = analytics.length;
      const successfulPlays = analytics.filter(a => a.played_successfully).length;
      const failedPlays = totalTriggers - successfulPlays;
      const successRate = totalTriggers > 0 ? (successfulPlays / totalTriggers) * 100 : 0;

      const avgPlaybackDuration = analytics
        .filter(a => a.playback_duration_ms !== null)
        .reduce((sum, a) => sum + (a.playback_duration_ms || 0), 0) / 
        Math.max(1, analytics.filter(a => a.playback_duration_ms !== null).length);

      const avgConfidenceScore = analytics
        .reduce((sum, a) => sum + (a.confidence_score || 0), 0) / totalTriggers;

      // Calculate top trigger keywords
      const keywordCounts = new Map<string, number>();
      analytics.forEach(a => {
        if (a.matched_keywords) {
          a.matched_keywords.forEach((keyword: string) => {
            keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
          });
        }
      });

      const topTriggerKeywords = Array.from(keywordCounts.entries())
        .map(([keyword, count]) => ({ keyword, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const lastTriggered = analytics.length > 0 
        ? analytics.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at
        : null;

      return {
        storyId,
        title: story.title,
        category: story.category,
        totalTriggers,
        successfulPlays,
        failedPlays,
        successRate,
        avgPlaybackDuration,
        avgConfidenceScore,
        topTriggerKeywords,
        lastTriggered,
        createdAt: story.created_at,
      };
    } catch (error) {
      console.error('Error getting story usage report:', error);
      throw error;
    }
  }

  /**
   * Get effectiveness metrics for stories
   */
  async getStoryEffectivenessMetrics(ownerId: string, ownerType: 'user' | 'avatar'): Promise<StoryEffectivenessMetrics[]> {
    try {
      // Get stories for the owner
      const { data: stories, error: storiesError } = await supabase
        .from('user_stories')
        .select('id, title, category, created_at')
        .eq('owner_id', ownerId)
        .eq('owner_type', ownerType)
        .eq('status', 'active');

      if (storiesError) {
        throw storiesError;
      }

      if (!stories || stories.length === 0) {
        return [];
      }

      const metrics: StoryEffectivenessMetrics[] = [];

      for (const story of stories) {
        // Get analytics for the last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data: analytics, error: analyticsError } = await supabase
          .from('story_usage_analytics')
          .select('*')
          .eq('story_id', story.id)
          .gte('created_at', thirtyDaysAgo.toISOString());

        if (analyticsError) {
          console.error(`Error getting analytics for story ${story.id}:`, analyticsError);
          continue;
        }

        const totalTriggers = analytics?.length || 0;
        const successfulPlays = analytics?.filter(a => a.played_successfully).length || 0;
        const completedPlays = analytics?.filter(a => 
          a.played_successfully && a.playback_duration_ms && a.playback_duration_ms > 0
        ).length || 0;

        // Calculate metrics
        const triggerFrequency = totalTriggers / 30; // per day
        const successRate = totalTriggers > 0 ? (successfulPlays / totalTriggers) : 0;
        const completionRate = successfulPlays > 0 ? (completedPlays / successfulPlays) : 0;
        
        // Engagement score: weighted combination of success rate and completion rate
        const engagementScore = Math.round((successRate * 0.6 + completionRate * 0.4) * 100);
        
        // User satisfaction: based on playback completion and confidence scores
        const avgConfidence = analytics?.length > 0 
          ? analytics.reduce((sum, a) => sum + (a.confidence_score || 0), 0) / analytics.length
          : 0;
        const userSatisfactionScore = Math.round((completionRate * 0.7 + avgConfidence * 0.3) * 100);

        // Generate recommendations
        const recommendedActions: string[] = [];
        if (triggerFrequency < 0.1) {
          recommendedActions.push('Consider adding more trigger keywords to increase discoverability');
        }
        if (successRate < 0.8) {
          recommendedActions.push('Review audio quality and file format for better playback reliability');
        }
        if (completionRate < 0.7) {
          recommendedActions.push('Consider shortening story duration or improving content engagement');
        }
        if (avgConfidence < 0.6) {
          recommendedActions.push('Refine trigger keywords for better conversation matching');
        }
        if (recommendedActions.length === 0) {
          recommendedActions.push('Story is performing well - no immediate actions needed');
        }

        metrics.push({
          storyId: story.id,
          title: story.title,
          category: story.category,
          triggerFrequency,
          engagementScore,
          userSatisfactionScore,
          recommendedActions,
        });
      }

      return metrics.sort((a, b) => b.engagementScore - a.engagementScore);
    } catch (error) {
      console.error('Error getting story effectiveness metrics:', error);
      throw error;
    }
  }

  /**
   * Get aggregated analytics across all stories for an owner
   */
  async getAggregatedAnalytics(ownerId: string, ownerType: 'user' | 'avatar'): Promise<AggregatedAnalytics> {
    try {
      // Get all stories for the owner
      const { data: stories, error: storiesError } = await supabase
        .from('user_stories')
        .select('id, category, duration_ms, created_at')
        .eq('owner_id', ownerId)
        .eq('owner_type', ownerType);

      if (storiesError) {
        throw storiesError;
      }

      const totalStories = stories?.length || 0;

      if (totalStories === 0) {
        return {
          totalStories: 0,
          totalTriggers: 0,
          totalSuccessfulPlays: 0,
          overallSuccessRate: 0,
          avgStoryDuration: 0,
          topCategories: [],
          triggerTrends: [],
          performanceMetrics: {
            avgMatchLatency: 0,
            avgStartLatency: 0,
            slaCompliance: 0,
          },
        };
      }

      // Get all analytics for these stories
      const storyIds = stories!.map(s => s.id);
      const { data: analytics, error: analyticsError } = await supabase
        .from('story_usage_analytics')
        .select('*')
        .in('story_id', storyIds);

      if (analyticsError) {
        throw analyticsError;
      }

      const totalTriggers = analytics?.length || 0;
      const totalSuccessfulPlays = analytics?.filter(a => a.played_successfully).length || 0;
      const overallSuccessRate = totalTriggers > 0 ? (totalSuccessfulPlays / totalTriggers) * 100 : 0;

      // Calculate average story duration
      const avgStoryDuration = stories!.length > 0 
        ? stories!.reduce((sum, s) => sum + s.duration_ms, 0) / stories!.length
        : 0;

      // Calculate top categories
      const categoryStats = new Map<string, { count: number; successes: number; triggers: number }>();
      
      stories!.forEach(story => {
        const storyAnalytics = analytics?.filter(a => a.story_id === story.id) || [];
        const successes = storyAnalytics.filter(a => a.played_successfully).length;
        
        const existing = categoryStats.get(story.category) || { count: 0, successes: 0, triggers: 0 };
        categoryStats.set(story.category, {
          count: existing.count + 1,
          successes: existing.successes + successes,
          triggers: existing.triggers + storyAnalytics.length,
        });
      });

      const topCategories = Array.from(categoryStats.entries())
        .map(([category, stats]) => ({
          category,
          count: stats.count,
          successRate: stats.triggers > 0 ? (stats.successes / stats.triggers) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count);

      // Calculate trigger trends (last 30 days)
      const triggerTrends: Array<{ date: string; triggers: number; successes: number }> = [];
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      for (let i = 0; i < 30; i++) {
        const date = new Date(thirtyDaysAgo);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];

        const dayAnalytics = analytics?.filter(a => 
          a.created_at.startsWith(dateStr)
        ) || [];

        triggerTrends.push({
          date: dateStr,
          triggers: dayAnalytics.length,
          successes: dayAnalytics.filter(a => a.played_successfully).length,
        });
      }

      // Performance metrics (simplified - would integrate with existing metrics service)
      const performanceMetrics = {
        avgMatchLatency: 0, // Would be calculated from prometheus metrics
        avgStartLatency: 0, // Would be calculated from prometheus metrics  
        slaCompliance: overallSuccessRate / 100, // Approximation
      };

      return {
        totalStories,
        totalTriggers,
        totalSuccessfulPlays,
        overallSuccessRate,
        avgStoryDuration,
        topCategories,
        triggerTrends,
        performanceMetrics,
      };
    } catch (error) {
      console.error('Error getting aggregated analytics:', error);
      throw error;
    }
  }

  /**
   * Get admin-level analytics across all users and avatars
   */
  async getAdminAnalytics(): Promise<{
    totalUsers: number;
    totalAvatars: number;
    totalStories: number;
    totalTriggers: number;
    globalSuccessRate: number;
    topPerformingStories: Array<{
      storyId: string;
      title: string;
      ownerType: string;
      ownerId: string;
      successRate: number;
      totalTriggers: number;
    }>;
    categoryBreakdown: Array<{
      category: string;
      storyCount: number;
      triggerCount: number;
      successRate: number;
    }>;
  }> {
    try {
      // Get all stories
      const { data: stories, error: storiesError } = await supabase
        .from('user_stories')
        .select('id, title, category, owner_id, owner_type, status');

      if (storiesError) {
        throw storiesError;
      }

      // Get all analytics
      const { data: analytics, error: analyticsError } = await supabase
        .from('story_usage_analytics')
        .select('story_id, played_successfully');

      if (analyticsError) {
        throw analyticsError;
      }

      const totalStories = stories?.length || 0;
      const totalTriggers = analytics?.length || 0;
      const totalSuccesses = analytics?.filter(a => a.played_successfully).length || 0;
      const globalSuccessRate = totalTriggers > 0 ? (totalSuccesses / totalTriggers) * 100 : 0;

      // Count unique users and avatars
      const uniqueUsers = new Set(stories?.filter(s => s.owner_type === 'user').map(s => s.owner_id) || []);
      const uniqueAvatars = new Set(stories?.filter(s => s.owner_type === 'avatar').map(s => s.owner_id) || []);

      // Calculate top performing stories
      const storyPerformance = new Map<string, { 
        story: any; 
        triggers: number; 
        successes: number; 
      }>();

      stories?.forEach(story => {
        const storyAnalytics = analytics?.filter(a => a.story_id === story.id) || [];
        storyPerformance.set(story.id, {
          story,
          triggers: storyAnalytics.length,
          successes: storyAnalytics.filter(a => a.played_successfully).length,
        });
      });

      const topPerformingStories = Array.from(storyPerformance.values())
        .filter(p => p.triggers > 0)
        .map(p => ({
          storyId: p.story.id,
          title: p.story.title,
          ownerType: p.story.owner_type,
          ownerId: p.story.owner_id,
          successRate: (p.successes / p.triggers) * 100,
          totalTriggers: p.triggers,
        }))
        .sort((a, b) => b.successRate - a.successRate)
        .slice(0, 10);

      // Category breakdown
      const categoryStats = new Map<string, { stories: number; triggers: number; successes: number }>();
      
      stories?.forEach(story => {
        const storyAnalytics = analytics?.filter(a => a.story_id === story.id) || [];
        const existing = categoryStats.get(story.category) || { stories: 0, triggers: 0, successes: 0 };
        
        categoryStats.set(story.category, {
          stories: existing.stories + 1,
          triggers: existing.triggers + storyAnalytics.length,
          successes: existing.successes + storyAnalytics.filter(a => a.played_successfully).length,
        });
      });

      const categoryBreakdown = Array.from(categoryStats.entries())
        .map(([category, stats]) => ({
          category,
          storyCount: stats.stories,
          triggerCount: stats.triggers,
          successRate: stats.triggers > 0 ? (stats.successes / stats.triggers) * 100 : 0,
        }))
        .sort((a, b) => b.storyCount - a.storyCount);

      return {
        totalUsers: uniqueUsers.size,
        totalAvatars: uniqueAvatars.size,
        totalStories,
        totalTriggers,
        globalSuccessRate,
        topPerformingStories,
        categoryBreakdown,
      };
    } catch (error) {
      console.error('Error getting admin analytics:', error);
      throw error;
    }
  }
}

export default StoryAnalyticsService;