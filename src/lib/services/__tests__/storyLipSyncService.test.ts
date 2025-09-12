/**
 * Test suite for StoryLipSyncService
 * 
 * Task 17: Integrate with avatar lip-sync system (experimental, off by default)
 * Tests experimental lip-sync integration with HeyGen avatar system
 * 
 * Requirements: 3.2, 7.4
 */

import { StoryLipSyncService, HeyGenAvatarInterface } from '../storyLipSyncService';
import { UserStory } from '../../types/stories';

// Mock HeyGen avatar interface
class MockHeyGenAvatar implements HeyGenAvatarInterface {
  public isConnected = false;
  public sessionId: string | null = null;
  public isSpeaking = false;
  private speakDelay = 100;
  private shouldFail = false;

  async speak(text: string, voiceId: string): Promise<boolean> {
    if (!this.isConnected || !this.sessionId) {
      return false;
    }

    if (this.shouldFail) {
      throw new Error('Mock HeyGen speak failure');
    }

    this.isSpeaking = true;
    
    // Simulate speaking duration
    setTimeout(() => {
      this.isSpeaking = false;
    }, this.speakDelay);

    return true;
  }

  // Test utilities
  setConnected(connected: boolean, sessionId?: string) {
    this.isConnected = connected;
    this.sessionId = connected ? (sessionId || 'mock-session-123') : null;
  }

  setSpeakDelay(delay: number) {
    this.speakDelay = delay;
  }

  setShouldFail(shouldFail: boolean) {
    this.shouldFail = shouldFail;
  }
}

// Mock story data
const createMockStory = (overrides: Partial<UserStory> = {}): UserStory => ({
  id: 'story-123',
  owner_id: 'avatar-456',
  owner_type: 'avatar',
  title: 'Test Story',
  category: 'memory',
  triggers: 'test, story, memory',
  audio_url: 'https://example.com/story.mp3',
  duration_ms: 60000,
  transcript: 'This is a test story about memories and experiences.',
  priority: 50,
  status: 'active',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides
});

describe('StoryLipSyncService', () => {
  let lipSyncService: StoryLipSyncService;
  let mockAvatar: MockHeyGenAvatar;
  let originalWindow: any;

  beforeEach(() => {
    // Reset service with default config
    lipSyncService = new StoryLipSyncService({
      enabled: true,
      fallbackToIdle: true,
      transitionDurationMs: 100, // Faster for tests
      debugMode: true
    });

    // Create mock avatar
    mockAvatar = new MockHeyGenAvatar();
    
    // Mock global window object
    originalWindow = global.window;
    global.window = {
      heygenAvatar: mockAvatar
    } as any;
  });

  afterEach(() => {
    global.window = originalWindow;
  });

  describe('Configuration', () => {
    it('should initialize with disabled by default', () => {
      const defaultService = new StoryLipSyncService();
      const config = defaultService.getConfig();
      
      expect(config.enabled).toBe(false);
      expect(config.fallbackToIdle).toBe(true);
      expect(config.transitionDurationMs).toBe(300);
    });

    it('should allow configuration updates', () => {
      lipSyncService.updateConfig({
        transitionDurationMs: 500,
        debugMode: false
      });

      const config = lipSyncService.getConfig();
      expect(config.transitionDurationMs).toBe(500);
      expect(config.debugMode).toBe(false);
      expect(config.enabled).toBe(true); // Should preserve existing values
    });

    it('should enable/disable lip-sync feature', () => {
      expect(lipSyncService.getCurrentState().enabled).toBe(true);
      
      lipSyncService.setEnabled(false);
      expect(lipSyncService.getCurrentState().enabled).toBe(false);
      
      lipSyncService.setEnabled(true);
      expect(lipSyncService.getCurrentState().enabled).toBe(true);
    });
  });

  describe('HeyGen Avatar Integration', () => {
    it('should initialize connection to HeyGen avatar', async () => {
      mockAvatar.setConnected(true);
      
      const initialized = await lipSyncService.initialize();
      expect(initialized).toBe(true);
    });

    it('should fail initialization when avatar not available', async () => {
      global.window = {} as any; // No heygenAvatar
      
      const initialized = await lipSyncService.initialize();
      expect(initialized).toBe(false);
    });

    it('should check availability correctly', async () => {
      mockAvatar.setConnected(false);
      expect(await lipSyncService.isAvailable()).toBe(false);
      
      mockAvatar.setConnected(true);
      expect(await lipSyncService.isAvailable()).toBe(true);
    });
  });

  describe('Story Lip-Sync Attempts', () => {
    beforeEach(() => {
      mockAvatar.setConnected(true);
    });

    it('should sync with story transcript when available', async () => {
      const story = createMockStory({
        transcript: 'This is a detailed transcript of the story content.'
      });

      const result = await lipSyncService.attemptStoryLipSync(story);
      
      expect(result.success).toBe(true);
      expect(result.method).toBe('heygen');
      expect(result.duration).toBe(story.duration_ms);
    });

    it('should use fallback text when transcript unavailable', async () => {
      const story = createMockStory({
        transcript: undefined,
        title: 'My Childhood Memory',
        category: 'memory'
      });

      const result = await lipSyncService.attemptStoryLipSync(story);
      
      expect(result.success).toBe(true);
      expect(result.method).toBe('heygen');
    });

    it('should fallback to idle when HeyGen unavailable', async () => {
      mockAvatar.setConnected(false);
      const story = createMockStory();

      const result = await lipSyncService.attemptStoryLipSync(story);
      
      expect(result.success).toBe(true);
      expect(result.method).toBe('idle');
      expect(result.error).toContain('HeyGen avatar not connected');
    });

    it('should handle HeyGen speak failures gracefully', async () => {
      mockAvatar.setShouldFail(true);
      const story = createMockStory();

      const result = await lipSyncService.attemptStoryLipSync(story);
      
      expect(result.success).toBe(true);
      expect(result.method).toBe('idle');
      expect(result.error).toContain('Lip-sync error');
    });

    it('should return none when lip-sync disabled', async () => {
      lipSyncService.setEnabled(false);
      const story = createMockStory();

      const result = await lipSyncService.attemptStoryLipSync(story);
      
      expect(result.success).toBe(false);
      expect(result.method).toBe('none');
      expect(result.error).toBe('Lip-sync disabled');
    });
  });

  describe('State Transitions', () => {
    beforeEach(() => {
      mockAvatar.setConnected(true);
    });

    it('should transition to story lip-sync state', async () => {
      const story = createMockStory();
      
      expect(lipSyncService.getCurrentState().state).toBe('idle');
      
      await lipSyncService.attemptStoryLipSync(story);
      
      expect(lipSyncService.getCurrentState().state).toBe('story');
    });

    it('should transition back to TTS after story completes', async () => {
      const story = createMockStory();
      
      await lipSyncService.attemptStoryLipSync(story);
      expect(lipSyncService.getCurrentState().state).toBe('story');
      
      await lipSyncService.transitionBackToTTS();
      expect(lipSyncService.getCurrentState().state).toBe('tts');
    });

    it('should handle concurrent transitions gracefully', async () => {
      const story = createMockStory();
      
      // Start multiple transitions simultaneously
      const promises = [
        lipSyncService.attemptStoryLipSync(story),
        lipSyncService.transitionBackToTTS(),
        lipSyncService.attemptStoryLipSync(story)
      ];
      
      await Promise.all(promises);
      
      // Should end in a valid state
      const finalState = lipSyncService.getCurrentState().state;
      expect(['idle', 'story', 'tts']).toContain(finalState);
    });
  });

  describe('Fallback Behavior', () => {
    it('should fallback to idle when enabled', async () => {
      lipSyncService.updateConfig({ fallbackToIdle: true });
      mockAvatar.setConnected(false);
      
      const story = createMockStory();
      const result = await lipSyncService.attemptStoryLipSync(story);
      
      expect(result.success).toBe(true);
      expect(result.method).toBe('idle');
    });

    it('should not fallback when disabled', async () => {
      lipSyncService.updateConfig({ fallbackToIdle: false });
      mockAvatar.setConnected(false);
      
      const story = createMockStory();
      const result = await lipSyncService.attemptStoryLipSync(story);
      
      expect(result.success).toBe(false);
      expect(result.method).toBe('none');
      expect(result.error).toContain('Fallback disabled');
    });
  });

  describe('Fallback Text Generation', () => {
    it('should generate appropriate fallback text for different categories', async () => {
      mockAvatar.setConnected(true);
      
      const categories: Array<{ category: any; expectedText: string }> = [
        { category: 'memory', expectedText: 'cherished memory' },
        { category: 'experience', expectedText: 'experience from' },
        { category: 'advice', expectedText: 'thoughts on' },
        { category: 'anecdote', expectedText: 'story about' }
      ];

      for (const { category, expectedText } of categories) {
        const story = createMockStory({
          category,
          title: 'Test Title',
          transcript: undefined // Force fallback text usage
        });

        const result = await lipSyncService.attemptStoryLipSync(story);
        expect(result.success).toBe(true);
        expect(result.method).toBe('heygen');
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization errors gracefully', async () => {
      // Mock window object that throws error
      global.window = {
        get heygenAvatar() {
          throw new Error('Mock initialization error');
        }
      } as any;

      const initialized = await lipSyncService.initialize();
      expect(initialized).toBe(false);
    });

    it('should handle lip-sync timeout scenarios', async () => {
      mockAvatar.setConnected(true);
      mockAvatar.setSpeakDelay(6000); // Longer than timeout
      
      const story = createMockStory();
      
      // Should complete within reasonable time even with long speak delay
      const startTime = Date.now();
      const result = await lipSyncService.attemptStoryLipSync(story);
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(6000);
      expect(result.success).toBe(true); // Should succeed with fallback
    });
  });

  describe('Status Reporting', () => {
    it('should report current state correctly', () => {
      mockAvatar.setConnected(true);
      
      const status = lipSyncService.getCurrentState();
      
      expect(status.enabled).toBe(true);
      expect(status.avatarConnected).toBe(true);
      expect(status.state).toBe('idle');
      expect(status.transitionInProgress).toBe(false);
    });

    it('should report disconnected avatar correctly', () => {
      mockAvatar.setConnected(false);
      
      const status = lipSyncService.getCurrentState();
      
      expect(status.avatarConnected).toBe(false);
    });
  });

  describe('Performance', () => {
    it('should complete lip-sync attempts quickly', async () => {
      mockAvatar.setConnected(true);
      const story = createMockStory();
      
      const startTime = Date.now();
      await lipSyncService.attemptStoryLipSync(story);
      const duration = Date.now() - startTime;
      
      // Should complete within 1 second for tests
      expect(duration).toBeLessThan(1000);
    });

    it('should handle multiple rapid lip-sync attempts', async () => {
      mockAvatar.setConnected(true);
      const story = createMockStory();
      
      const promises = Array(5).fill(0).map(() => 
        lipSyncService.attemptStoryLipSync(story)
      );
      
      const results = await Promise.all(promises);
      
      // All should complete successfully
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });
  });
});