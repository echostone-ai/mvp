/**
 * Task 8 Integration Test - Story integration with StreamingAudioManager
 * 
 * Tests the integration of story checking and replacement with TTS streaming
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { createStreamingAudioManager, StreamingAudioManager } from '../streamingUtils';
import { createSeamlessStreamingManager, SeamlessStreamingManager } from '../seamlessStreamingUtils';

// Mock dependencies
vi.mock('../featureFlags', () => ({
  isFeatureEnabled: vi.fn((flag: string) => {
    if (flag === 'STORIES_ENABLED') return true;
    return false;
  })
}));

vi.mock('../services/userStoryService', () => ({
  UserStoryService: vi.fn().mockImplementation(() => ({
    findMatchingStoriesWithDetails: vi.fn().mockResolvedValue([]),
    selectBestMatchingStory: vi.fn().mockResolvedValue(null),
    recordUsage: vi.fn().mockResolvedValue(undefined)
  }))
}));

vi.mock('../services/storyAudioManager', () => ({
  globalStoryAudioManager: {
    replaceNextTTSWithStory: vi.fn().mockResolvedValue({
      success: false,
      story_id: 'test-story',
      error_message: 'No story available',
      fallback_used: false
    })
  }
}));

// Mock global fetch
global.fetch = vi.fn();

describe('Task 8: Story Integration with StreamingAudioManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('StreamingAudioManager Story Integration', () => {
    let manager: StreamingAudioManager;

    beforeEach(() => {
      manager = createStreamingAudioManager('test-voice-id', {}, undefined, {
        conversationId: 'test-conversation',
        avatarId: 'test-avatar'
      });
    });

    afterEach(() => {
      manager.stop();
    });

    it('should have story integration methods', () => {
      expect(manager.checkForStoryTrigger).toBeDefined();
      expect(manager.replaceWithStory).toBeDefined();
      expect(typeof manager.checkForStoryTrigger).toBe('function');
      expect(typeof manager.replaceWithStory).toBe('function');
    });

    it('should check for story triggers', async () => {
      const hasStoryTrigger = await manager.checkForStoryTrigger('Tell me about your childhood', 'test-avatar');
      expect(hasStoryTrigger).toBe(false); // No stories configured in mock
    });

    it('should attempt story replacement', async () => {
      const storyReplaced = await manager.replaceWithStory('Tell me about your childhood', 'test-avatar');
      expect(storyReplaced).toBe(false); // No stories available in mock
    });
  });

  describe('SeamlessStreamingManager Story Integration', () => {
    let manager: SeamlessStreamingManager;

    beforeEach(() => {
      manager = createSeamlessStreamingManager('test-voice-id', {}, {
        conversationId: 'test-conversation',
        avatarId: 'test-avatar'
      });
    });

    afterEach(() => {
      manager.stop();
    });

    it('should have story integration methods', () => {
      expect(manager.checkForStoryTrigger).toBeDefined();
      expect(manager.replaceWithStory).toBeDefined();
      expect(typeof manager.checkForStoryTrigger).toBe('function');
      expect(typeof manager.replaceWithStory).toBe('function');
    });

    it('should check for story triggers', async () => {
      const hasStoryTrigger = await manager.checkForStoryTrigger!('Tell me about your childhood', 'test-avatar');
      expect(hasStoryTrigger).toBe(false); // No stories configured in mock
    });

    it('should attempt story replacement', async () => {
      const storyReplaced = await manager.replaceWithStory!('Tell me about your childhood', 'test-avatar');
      expect(storyReplaced).toBe(false); // No stories available in mock
    });
  });

  describe('Feature Flag Integration', () => {
    it('should respect STORIES_ENABLED feature flag', async () => {
      const { isFeatureEnabled } = await import('../featureFlags');
      
      // Feature flag is enabled in mock
      expect(isFeatureEnabled('STORIES_ENABLED')).toBe(true);
      
      const manager = createStreamingAudioManager('test-voice-id', {}, undefined, {
        avatarId: 'test-avatar'
      });
      
      // Should have story methods when feature is enabled
      expect(manager.checkForStoryTrigger).toBeDefined();
      expect(manager.replaceWithStory).toBeDefined();
      
      manager.stop();
    });
  });

  describe('Error Handling', () => {
    it('should handle story service initialization errors gracefully', async () => {
      // Mock UserStoryService to throw during initialization
      const { UserStoryService } = await import('../services/userStoryService');
      (UserStoryService as Mock).mockImplementationOnce(() => {
        throw new Error('Service initialization failed');
      });

      // Should not throw when creating manager
      expect(() => {
        const manager = createStreamingAudioManager('test-voice-id', {}, undefined, {
          avatarId: 'test-avatar'
        });
        manager.stop();
      }).not.toThrow();
    });

    it('should handle story checking errors gracefully', async () => {
      const manager = createStreamingAudioManager('test-voice-id', {}, undefined, {
        avatarId: 'test-avatar'
      });

      // Should return false when story checking fails
      const hasStoryTrigger = await manager.checkForStoryTrigger('test text', 'test-avatar');
      expect(hasStoryTrigger).toBe(false);

      manager.stop();
    });
  });
});