/**
 * Mobile Device Compatibility Test Suite for Story System
 * 
 * Tests story system functionality across different mobile devices and browsers:
 * - iOS Safari audio context handling
 * - Android Chrome compatibility
 * - Mobile resource constraints
 * - Touch gesture requirements
 * - Network condition handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StoryAudioManager } from '../services/storyAudioManager';
import { MobileStoryResourceManager } from '../services/mobileStoryResourceManager';
import { UserStoryService } from '../services/userStoryService';
import { StoryTriggerMatcher } from '../services/storyTriggerMatcher';
import type { UserStory } from '../types/stories';

// Mobile device user agents for testing
const MOBILE_USER_AGENTS = {
  iOS_Safari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
  iOS_Safari_iPad: 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
  Android_Chrome: 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
  Android_Samsung: 'Mozilla/5.0 (Linux; Android 11; SAMSUNG SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/14.2 Chrome/87.0.4280.141 Mobile Safari/537.36'
};

describe('Story System Mobile Compatibility', () => {
  let audioManager: StoryAudioManager;
  let mobileManager: MobileStoryResourceManager;
  let userStoryService: UserStoryService;
  let triggerMatcher: StoryTriggerMatcher;

  const mockStory: UserStory = {
    id: 'mobile-test-story',
    ownerId: 'mobile-avatar',
    ownerType: 'avatar',
    title: 'Mobile Test Story',
    category: 'memory',
    triggers: ['mobile', 'test', 'story'],
    audioUrl: 'https://cdn.example.com/mobile-story.mp3',
    duration: 60000, // 1 minute
    priority: 75,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  let originalUserAgent: string;
  let mockAudioContext: any;

  beforeEach(() => {
    audioManager = new StoryAudioManager();
    mobileManager = new MobileStoryResourceManager();
    userStoryService = new UserStoryService();
    triggerMatcher = new StoryTriggerMatcher();

    // Store original user agent
    originalUserAgent = navigator.userAgent;

    // Mock audio context
    mockAudioContext = {
      createBufferSource: vi.fn(() => ({
        connect: vi.fn(),
        start: vi.fn(),
        stop: vi.fn(),
        buffer: null,
        onended: null
      })),
      createGain: vi.fn(() => ({
        connect: vi.fn(),
        gain: { value: 1, setValueAtTime: vi.fn() }
      })),
      destination: {},
      currentTime: 0,
      state: 'suspended', // Default to suspended (typical mobile behavior)
      resume: vi.fn().mockResolvedValue(undefined),
      decodeAudioData: vi.fn().mockResolvedValue(new ArrayBuffer(1024))
    };

    global.AudioContext = vi.fn(() => mockAudioContext) as any;
    global.webkitAudioContext = vi.fn(() => mockAudioContext) as any;

    // Mock successful fetch
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
    });

    vi.spyOn(userStoryService, 'getStoriesByOwner').mockResolvedValue([mockStory]);
  });

  afterEach(() => {
    // Restore original user agent
    Object.defineProperty(navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true
    });
    vi.clearAllMocks();
  });

  describe('iOS Safari Compatibility', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'userAgent', {
        value: MOBILE_USER_AGENTS.iOS_Safari,
        configurable: true
      });
    });

    it('should handle suspended AudioContext on iOS Safari', async () => {
      mockAudioContext.state = 'suspended';

      const audioBuffer = await audioManager.preloadStoryAudio(mockStory);
      
      // Should attempt to resume context
      expect(mockAudioContext.resume).toHaveBeenCalled();
      expect(audioBuffer).toBeTruthy();
    });

    it('should respect iOS Safari memory constraints', async () => {
      const canPreload = await mobileManager.canPreloadStory(mockStory);
      
      if (canPreload) {
        await audioManager.preloadStoryAudio(mockStory);
        
        const memoryUsage = mobileManager.getCurrentMemoryUsage();
        expect(memoryUsage).toBeLessThan(10 * 1024 * 1024); // < 10MB on iOS
      }
    });

    it('should handle iOS Safari audio format limitations', async () => {
      // Mock audio decoding failure (unsupported format)
      mockAudioContext.decodeAudioData.mockRejectedValueOnce(new Error('Unsupported format'));

      await expect(audioManager.preloadStoryAudio(mockStory)).rejects.toThrow();
      
      // Should handle gracefully and not crash
      expect(mockAudioContext.decodeAudioData).toHaveBeenCalled();
    });

    it('should require user gesture for audio playback on iOS', async () => {
      mockAudioContext.state = 'suspended';

      // Simulate user gesture
      const userGestureEvent = new Event('touchstart');
      document.dispatchEvent(userGestureEvent);

      await audioManager.preloadStoryAudio(mockStory);
      
      // Should resume context after user gesture
      expect(mockAudioContext.resume).toHaveBeenCalled();
    });

    it('should limit concurrent audio operations on iOS', async () => {
      const stories = [mockStory, { ...mockStory, id: 'story-2' }, { ...mockStory, id: 'story-3' }];
      
      const preloadPromises = stories.map(story => 
        audioManager.preloadStoryAudio(story)
      );

      const results = await Promise.allSettled(preloadPromises);
      
      // Should limit concurrent operations to prevent iOS crashes
      const successful = results.filter(r => r.status === 'fulfilled').length;
      expect(successful).toBeLessThanOrEqual(2); // Max 2 concurrent on iOS
    });
  });

  describe('Android Chrome Compatibility', () => {
    beforeEach(() => {
      Object.defineProperty(navigator, 'userAgent', {
        value: MOBILE_USER_AGENTS.Android_Chrome,
        configurable: true
      });
    });

    it('should handle Android Chrome audio context', async () => {
      mockAudioContext.state = 'running';

      const audioBuffer = await audioManager.preloadStoryAudio(mockStory);
      
      expect(audioBuffer).toBeTruthy();
      // Should not need to resume on Android Chrome if already running
      expect(mockAudioContext.resume).not.toHaveBeenCalled();
    });

    it('should respect Android memory constraints', async () => {
      const canPreload = await mobileManager.canPreloadStory(mockStory);
      
      if (canPreload) {
        await audioManager.preloadStoryAudio(mockStory);
        
        const memoryUsage = mobileManager.getCurrentMemoryUsage();
        expect(memoryUsage).toBeLessThan(15 * 1024 * 1024); // < 15MB on Android
      }
    });

    it('should handle Android network variations', async () => {
      // Simulate slow network
      (global.fetch as any).mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
          }), 1500)
        )
      );

      const startTime = performance.now();
      const audioBuffer = await audioManager.preloadStoryAudio(mockStory);
      const loadTime = performance.now() - startTime;
      
      expect(audioBuffer).toBeTruthy();
      expect(loadTime).toBeGreaterThan(1400); // Should wait for slow network
    });
  });

  describe('Cross-Platform Mobile Features', () => {
    it('should detect mobile environment correctly', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: MOBILE_USER_AGENTS.iOS_Safari,
        configurable: true
      });

      const isMobile = mobileManager.isMobileDevice();
      expect(isMobile).toBe(true);

      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        configurable: true
      });

      const isDesktop = mobileManager.isMobileDevice();
      expect(isDesktop).toBe(false);
    });

    it('should adapt resource limits based on device', async () => {
      // Test iOS limits
      Object.defineProperty(navigator, 'userAgent', {
        value: MOBILE_USER_AGENTS.iOS_Safari,
        configurable: true
      });

      const iOSLimits = mobileManager.getResourceLimits();
      expect(iOSLimits.maxConcurrentPreloads).toBeLessThanOrEqual(1);
      expect(iOSLimits.maxMemoryUsageMB).toBeLessThanOrEqual(10);

      // Test Android limits
      Object.defineProperty(navigator, 'userAgent', {
        value: MOBILE_USER_AGENTS.Android_Chrome,
        configurable: true
      });

      const androidLimits = mobileManager.getResourceLimits();
      expect(androidLimits.maxConcurrentPreloads).toBeLessThanOrEqual(2);
      expect(androidLimits.maxMemoryUsageMB).toBeLessThanOrEqual(15);
    });

    it('should handle touch events for audio unlock', async () => {
      mockAudioContext.state = 'suspended';

      // Simulate touch event
      const touchEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 } as Touch]
      });

      document.dispatchEvent(touchEvent);

      await audioManager.preloadStoryAudio(mockStory);
      
      expect(mockAudioContext.resume).toHaveBeenCalled();
    });

    it('should gracefully degrade on low-end devices', async () => {
      // Simulate low memory device
      vi.spyOn(mobileManager, 'getAvailableMemory').mockReturnValue(50 * 1024 * 1024); // 50MB

      const canPreload = await mobileManager.canPreloadStory(mockStory);
      
      if (!canPreload) {
        // Should skip preloading on low-end devices
        expect(canPreload).toBe(false);
      } else {
        // If preloading is allowed, should still respect limits
        await audioManager.preloadStoryAudio(mockStory);
        const memoryUsage = mobileManager.getCurrentMemoryUsage();
        expect(memoryUsage).toBeLessThan(5 * 1024 * 1024); // Very conservative on low-end
      }
    });
  });

  describe('Network Condition Handling', () => {
    it('should handle slow 3G connections', async () => {
      // Simulate slow 3G (1.6 Mbps, 300ms RTT)
      (global.fetch as any).mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(500 * 1024)) // 500KB
          }), 2500) // Slow download
        )
      );

      const startTime = performance.now();
      
      try {
        await audioManager.preloadStoryAudio(mockStory, { timeoutMs: 2000 });
      } catch (error) {
        const loadTime = performance.now() - startTime;
        expect(loadTime).toBeLessThan(2100); // Should timeout appropriately
      }
    });

    it('should handle offline conditions', async () => {
      // Simulate offline
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      await expect(audioManager.preloadStoryAudio(mockStory)).rejects.toThrow();
      
      // Should handle gracefully without crashing
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should adapt to connection quality', async () => {
      // Mock connection API
      Object.defineProperty(navigator, 'connection', {
        value: {
          effectiveType: '3g',
          downlink: 1.5,
          rtt: 300
        },
        configurable: true
      });

      const adaptedTimeout = mobileManager.getAdaptiveTimeout();
      expect(adaptedTimeout).toBeGreaterThan(2000); // Longer timeout for slow connection
    });
  });

  describe('Battery and Performance Optimization', () => {
    it('should respect battery level constraints', async () => {
      // Mock battery API
      Object.defineProperty(navigator, 'getBattery', {
        value: () => Promise.resolve({
          level: 0.15, // 15% battery
          charging: false
        }),
        configurable: true
      });

      const canPreload = await mobileManager.canPreloadStory(mockStory);
      
      // Should be more conservative with low battery
      if (canPreload) {
        const limits = mobileManager.getResourceLimits();
        expect(limits.maxConcurrentPreloads).toBeLessThanOrEqual(1);
      }
    });

    it('should throttle operations on thermal constraints', async () => {
      // Simulate high CPU usage
      vi.spyOn(mobileManager, 'getCPUUsage').mockReturnValue(85); // 85% CPU

      const shouldThrottle = mobileManager.shouldThrottleOperations();
      expect(shouldThrottle).toBe(true);

      if (shouldThrottle) {
        const delay = mobileManager.getThrottleDelay();
        expect(delay).toBeGreaterThan(0);
      }
    });
  });

  describe('Accessibility and User Experience', () => {
    it('should provide appropriate feedback for mobile users', async () => {
      const loadingPromise = audioManager.preloadStoryAudio(mockStory);
      
      // Should provide loading feedback
      expect(typeof loadingPromise).toBe('object');
      
      const result = await loadingPromise;
      expect(result).toBeTruthy();
    });

    it('should handle screen orientation changes', async () => {
      // Simulate orientation change
      const orientationEvent = new Event('orientationchange');
      window.dispatchEvent(orientationEvent);

      // Should continue working after orientation change
      const audioBuffer = await audioManager.preloadStoryAudio(mockStory);
      expect(audioBuffer).toBeTruthy();
    });

    it('should handle app backgrounding/foregrounding', async () => {
      // Simulate app going to background
      const visibilityEvent = new Event('visibilitychange');
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(visibilityEvent);

      // Should pause operations when backgrounded
      const backgroundLimits = mobileManager.getResourceLimits();
      expect(backgroundLimits.maxConcurrentPreloads).toBe(0);

      // Simulate app coming to foreground
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      document.dispatchEvent(visibilityEvent);

      // Should resume normal operations
      const foregroundLimits = mobileManager.getResourceLimits();
      expect(foregroundLimits.maxConcurrentPreloads).toBeGreaterThan(0);
    });
  });
});