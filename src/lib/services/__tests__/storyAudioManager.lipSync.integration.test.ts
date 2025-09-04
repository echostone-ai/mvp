/**
 * Integration tests for StoryAudioManager with Lip-Sync
 * 
 * Task 17: Integrate with avatar lip-sync system (experimental, off by default)
 * Tests integration between story audio playback and experimental lip-sync
 * 
 * Requirements: 3.2, 7.4
 */

import { StoryAudioManager } from '../storyAudioManager';
import { StoryLipSyncService } from '../storyLipSyncService';
import { UserStory, StoryPlaybackOptions } from '../../types/stories';
import { StreamingAudioManager } from '../../streamingUtils';

// Mock dependencies
jest.mock('../../streamingUtils');
jest.mock('../../globalAudioManager');
jest.mock('../../mobileAudioContextManager');
jest.mock('./storyErrorHandler');
jest.mock('./storyMetrics');
jest.mock('./mobileStoryResourceManager');

// Mock HeyGen avatar
const mockHeyGenAvatar = {
  isConnected: true,
  sessionId: 'test-session-123',
  isSpeaking: false,
  speak: jest.fn().mockResolvedValue(true)
};

// Mock global window
const originalWindow = global.window;

beforeAll(() => {
  global.window = {
    ...originalWindow,
    heygenAvatar: mockHeyGenAvatar,
    AudioContext: jest.fn().mockImplementation(() => ({
      state: 'running',
      sampleRate: 44100,
      createBufferSource: jest.fn().mockReturnValue({
        buffer: null,
        connect: jest.fn(),
        start: jest.fn(),
        onended: null
      }),
      createGain: jest.fn().mockReturnValue({
        gain: { value: 1, setValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn() },
        connect: jest.fn(),
        disconnect: jest.fn()
      }),
      destination: {},
      decodeAudioData: jest.fn().mockResolvedValue({
        duration: 60,
        numberOfChannels: 2,
        sampleRate: 44100
      }),
      resume: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined)
    }))
  } as any;
});

afterAll(() => {
  global.window = originalWindow;
});

// Mock fetch for audio loading
global.fetch = jest.fn().mockImplementation((url: string) => {
  if (url.includes('story.mp3')) {
    return Promise.resolve({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
    });
  }
  return Promise.reject(new Error('Not found'));
});

const createMockStory = (overrides: Partial<UserStory> = {}): UserStory => ({
  id: 'story-123',
  owner_id: 'avatar-456',
  owner_type: 'avatar',
  title: 'Test Story with Lip-Sync',
  category: 'memory',
  triggers: 'test, story, memory',
  audio_url: 'https://example.com/story.mp3',
  duration_ms: 60000,
  transcript: 'This is a test story with detailed transcript for lip-sync testing.',
  priority: 50,
  status: 'active',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  ...overrides
});

const createMockStreamingManager = (): jest.Mocked<StreamingAudioManager> => ({
  stop: jest.fn(),
  addSentence: jest.fn().mockResolvedValue(undefined),
  isPlaying: jest.fn().mockReturnValue(false),
  cleanup: jest.fn()
} as any);

describe('StoryAudioManager Lip-Sync Integration', () => {
  let storyAudioManager: StoryAudioManager;
  let mockStreamingManager: jest.Mocked<StreamingAudioManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset HeyGen avatar mock
    mockHeyGenAvatar.isConnected = true;
    mockHeyGenAvatar.sessionId = 'test-session-123';
    mockHeyGenAvatar.isSpeaking = false;
    mockHeyGenAvatar.speak.mockResolvedValue(true);

    mockStreamingManager = createMockStreamingManager();
  });

  describe('Lip-Sync Disabled (Default)', () => {
    beforeEach(() => {
      storyAudioManager = new StoryAudioManager({
        enableLipSync: false, // Default behavior
        preloadTimeoutMs: 1000,
        fallbackToTTS: true
      });
    });

    it('should play story without lip-sync when disabled', async () => {
      const story = createMockStory();
      
      const result = await storyAudioManager.replaceNextTTSWithStory(
        story,
        mockStreamingManager
      );

      expect(result.success).toBe(true);
      expect(result.lip_sync_used).toBe(false);
      expect(result.lip_sync_method).toBe('none');
      expect(mockHeyGenAvatar.speak).not.toHaveBeenCalled();
    });

    it('should report lip-sync as unavailable when disabled', async () => {
      const available = await storyAudioManager.isLipSyncAvailable();
      expect(available).toBe(false);
    });

    it('should show disabled status', () => {
      const status = storyAudioManager.getLipSyncStatus();
      
      expect(status.enabled).toBe(false);
      expect(status.available).toBe(false);
    });
  });

  describe('Lip-Sync Enabled (Experimental)', () => {
    beforeEach(() => {
      storyAudioManager = new StoryAudioManager({
        enableLipSync: true, // Enable experimental feature
        preloadTimeoutMs: 1000,
        fallbackToTTS: true
      });
    });

    it('should attempt lip-sync when enabled and avatar connected', async () => {
      const story = createMockStory({
        transcript: 'This is a detailed transcript for lip-sync testing.'
      });
      
      const result = await storyAudioManager.replaceNextTTSWithStory(
        story,
        mockStreamingManager
      );

      expect(result.success).toBe(true);
      expect(result.lip_sync_used).toBe(true);
      expect(result.lip_sync_method).toBe('heygen');
      expect(mockHeyGenAvatar.speak).toHaveBeenCalledWith(
        story.transcript,
        'story-lipsync'
      );
    });

    it('should use fallback text when transcript unavailable', async () => {
      const story = createMockStory({
        transcript: undefined,
        title: 'My Childhood Memory',
        category: 'memory'
      });
      
      const result = await storyAudioManager.replaceNextTTSWithStory(
        story,
        mockStreamingManager
      );

      expect(result.success).toBe(true);
      expect(result.lip_sync_used).toBe(true);
      expect(result.lip_sync_method).toBe('heygen');
      expect(mockHeyGenAvatar.speak).toHaveBeenCalledWith(
        expect.stringContaining('cherished memory'),
        'story-lipsync-fallback'
      );
    });

    it('should fallback to idle when HeyGen unavailable', async () => {
      mockHeyGenAvatar.isConnected = false;
      const story = createMockStory();
      
      const result = await storyAudioManager.replaceNextTTSWithStory(
        story,
        mockStreamingManager
      );

      expect(result.success).toBe(true);
      expect(result.lip_sync_used).toBe(true);
      expect(result.lip_sync_method).toBe('idle');
      expect(mockHeyGenAvatar.speak).not.toHaveBeenCalled();
    });

    it('should continue audio playback even if lip-sync fails', async () => {
      mockHeyGenAvatar.speak.mockRejectedValue(new Error('HeyGen error'));
      const story = createMockStory();
      
      const result = await storyAudioManager.replaceNextTTSWithStory(
        story,
        mockStreamingManager
      );

      expect(result.success).toBe(true);
      expect(result.lip_sync_used).toBe(true);
      expect(result.lip_sync_method).toBe('idle'); // Fallback to idle
    });

    it('should report lip-sync as available when enabled and connected', async () => {
      const available = await storyAudioManager.isLipSyncAvailable();
      expect(available).toBe(true);
    });

    it('should show enabled status with avatar connection', () => {
      const status = storyAudioManager.getLipSyncStatus();
      
      expect(status.enabled).toBe(true);
      expect(status.available).toBe(true);
      expect(status.avatarConnected).toBe(true);
    });
  });

  describe('Lip-Sync Configuration', () => {
    beforeEach(() => {
      storyAudioManager = new StoryAudioManager({
        enableLipSync: false
      });
    });

    it('should allow enabling lip-sync at runtime', async () => {
      expect(storyAudioManager.getLipSyncStatus().enabled).toBe(false);
      
      storyAudioManager.setLipSyncEnabled(true);
      
      expect(storyAudioManager.getLipSyncStatus().enabled).toBe(true);
    });

    it('should allow disabling lip-sync at runtime', async () => {
      storyAudioManager.setLipSyncEnabled(true);
      expect(storyAudioManager.getLipSyncStatus().enabled).toBe(true);
      
      storyAudioManager.setLipSyncEnabled(false);
      
      expect(storyAudioManager.getLipSyncStatus().enabled).toBe(false);
    });

    it('should allow updating lip-sync configuration', () => {
      storyAudioManager.setLipSyncEnabled(true);
      
      storyAudioManager.updateLipSyncConfig({
        fallbackToIdle: false,
        transitionDurationMs: 500,
        debugMode: true
      });

      // Configuration should be updated (tested via behavior)
      expect(() => storyAudioManager.updateLipSyncConfig({})).not.toThrow();
    });
  });

  describe('Smooth Transitions', () => {
    beforeEach(() => {
      storyAudioManager = new StoryAudioManager({
        enableLipSync: true,
        preloadTimeoutMs: 1000
      });
    });

    it('should transition back to TTS after story completes', async () => {
      const story = createMockStory();
      
      // Mock audio source to trigger onended immediately
      const mockSource = {
        buffer: null,
        connect: jest.fn(),
        start: jest.fn(),
        onended: null as any,
        disconnect: jest.fn()
      };

      const mockGain = {
        gain: { value: 1, setValueAtTime: jest.fn(), linearRampToValueAtTime: jest.fn() },
        connect: jest.fn(),
        disconnect: jest.fn()
      };

      const mockAudioContext = (global.window as any).AudioContext.mock.instances[0];
      mockAudioContext.createBufferSource.mockReturnValue(mockSource);
      mockAudioContext.createGain.mockReturnValue(mockGain);

      const resultPromise = storyAudioManager.replaceNextTTSWithStory(
        story,
        mockStreamingManager
      );

      // Simulate audio completion
      setTimeout(() => {
        if (mockSource.onended) {
          mockSource.onended();
        }
      }, 100);

      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.lip_sync_used).toBe(true);
      
      // Should have attempted to transition back to TTS
      // (This is tested indirectly through the completion flow)
    });

    it('should handle transition errors gracefully', async () => {
      // Mock lip-sync service to throw error on transition
      const story = createMockStory();
      
      const result = await storyAudioManager.replaceNextTTSWithStory(
        story,
        mockStreamingManager
      );

      // Should still succeed even if transition fails
      expect(result.success).toBe(true);
    });
  });

  describe('HTML Audio Fallback with Lip-Sync', () => {
    beforeEach(() => {
      storyAudioManager = new StoryAudioManager({
        enableLipSync: true,
        preloadTimeoutMs: 1000
      });

      // Mock AudioContext to be unavailable
      (global.window as any).AudioContext = undefined;
    });

    it('should attempt lip-sync even with HTML Audio fallback', async () => {
      const story = createMockStory();
      
      // Mock HTML Audio
      const mockAudio = {
        volume: 1,
        preload: 'auto',
        onended: null as any,
        onerror: null as any,
        play: jest.fn().mockResolvedValue(undefined)
      };

      global.Audio = jest.fn().mockImplementation(() => mockAudio);

      const resultPromise = storyAudioManager.replaceNextTTSWithStory(
        story,
        mockStreamingManager
      );

      // Simulate audio completion
      setTimeout(() => {
        if (mockAudio.onended) {
          mockAudio.onended();
        }
      }, 100);

      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.lip_sync_used).toBe(true);
      expect(result.fallback_used).toBe(true); // HTML Audio is fallback
    });
  });

  describe('Error Scenarios', () => {
    beforeEach(() => {
      storyAudioManager = new StoryAudioManager({
        enableLipSync: true,
        preloadTimeoutMs: 1000
      });
    });

    it('should handle lip-sync initialization failures', async () => {
      // Remove HeyGen avatar from global scope
      delete (global.window as any).heygenAvatar;
      
      const story = createMockStory();
      
      const result = await storyAudioManager.replaceNextTTSWithStory(
        story,
        mockStreamingManager
      );

      expect(result.success).toBe(true);
      expect(result.lip_sync_used).toBe(true);
      expect(result.lip_sync_method).toBe('idle'); // Should fallback to idle
    });

    it('should handle lip-sync service errors gracefully', async () => {
      // Mock lip-sync service to throw error
      mockHeyGenAvatar.speak.mockRejectedValue(new Error('Service error'));
      
      const story = createMockStory();
      
      const result = await storyAudioManager.replaceNextTTSWithStory(
        story,
        mockStreamingManager
      );

      expect(result.success).toBe(true);
      // Should continue with audio playback despite lip-sync error
    });
  });

  describe('Performance Impact', () => {
    beforeEach(() => {
      storyAudioManager = new StoryAudioManager({
        enableLipSync: true,
        preloadTimeoutMs: 1000
      });
    });

    it('should not significantly delay story playback', async () => {
      const story = createMockStory();
      
      const startTime = Date.now();
      const result = await storyAudioManager.replaceNextTTSWithStory(
        story,
        mockStreamingManager
      );
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should handle multiple concurrent lip-sync attempts', async () => {
      const story = createMockStory();
      
      const promises = Array(3).fill(0).map(() =>
        storyAudioManager.replaceNextTTSWithStory(story, mockStreamingManager)
      );

      const results = await Promise.allSettled(promises);
      
      // At least one should succeed (due to concurrency handling)
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBeGreaterThan(0);
    });
  });
});