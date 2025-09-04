// Task 9: Mobile Safari Integration Tests for Jonathan Demo
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { mobileAudioContextManager, isMobileSafari } from '@/lib/mobileAudioContextManager';
import { globalAudioManager } from '@/lib/globalAudioManager';

// Mock the mobile audio context manager
vi.mock('@/lib/mobileAudioContextManager', () => ({
  mobileAudioContextManager: {
    ensureReady: vi.fn(),
    getState: vi.fn(),
    createOptimizedBuffer: vi.fn(),
    createFallbackAudio: vi.fn(),
    destroy: vi.fn()
  },
  isMobileSafari: vi.fn(),
  createMobileOptimizedAudio: vi.fn()
}));

// Mock global audio manager
vi.mock('@/lib/globalAudioManager', () => ({
  globalAudioManager: {
    playAudio: vi.fn(),
    stopAll: vi.fn(),
    createOptimizedAudio: vi.fn(),
    getIsPlaying: vi.fn(),
    getCurrentAudio: vi.fn()
  }
}));

// Mock other dependencies
vi.mock('@/lib/streamingUtils', () => ({
  stopAllAudio: vi.fn(),
  createStreamingAudioManager: vi.fn(),
  splitIntoSentences: vi.fn()
}));

vi.mock('@/lib/enhancedVoiceConfig', () => ({
  getEnhancedVoiceConfig: vi.fn()
}));

vi.mock('@/lib/services/expressionPackService', () => ({
  ExpressionPackService: {
    getJonathanDemoExpressionPack: vi.fn(),
    createMockExpressionPack: vi.fn()
  }
}));

vi.mock('@/lib/jonathanDemoMemoryService', () => ({
  JonathanDemoMemoryService: {
    getComprehensiveMemoryContext: vi.fn(),
    warmMemoryCache: vi.fn(),
    storeConversationMemory: vi.fn()
  }
}));

vi.mock('@/lib/services/jonathanDemoConversationState', () => ({
  jonathanConversationState: {
    generateSessionId: vi.fn(),
    getOrCreateConversation: vi.fn(),
    getConversationHistory: vi.fn(),
    endConversation: vi.fn()
  }
}));

// Mock Next.js dynamic import
vi.mock('next/dynamic', () => ({
  default: (fn: any) => {
    const Component = fn();
    return Component;
  }
}));

// Mock profile data
vi.mock('@/data/jonathan_profile.json', () => ({
  default: {
    name: 'Jonathan',
    voice_id: 'test-voice-id'
  }
}));

describe('Task 9: Mobile Safari Audio Context Integration', () => {
  const mockMobileAudioManager = vi.mocked(mobileAudioContextManager);
  const mockIsMobileSafari = vi.mocked(isMobileSafari);
  const mockGlobalAudioManager = vi.mocked(globalAudioManager);

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default to non-mobile Safari
    mockIsMobileSafari.mockReturnValue(false);
    mockMobileAudioManager.ensureReady.mockResolvedValue(true);
    mockMobileAudioManager.getState.mockReturnValue({
      isInitialized: true,
      isActive: true,
      requiresGesture: false,
      lastInteraction: Date.now()
    });
    
    // Mock fetch for voice resolution
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ voiceId: 'test-voice-id' })
    });

    // Mock Audio constructor
    global.Audio = vi.fn().mockImplementation(() => ({
      src: '',
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      onended: null,
      onerror: null,
      currentTime: 0,
      volume: 1.0,
      playbackRate: 1.0,
      playsInline: false,
      muted: false,
      preload: 'none'
    }));

    // Mock URL.createObjectURL
    global.URL = {
      createObjectURL: vi.fn().mockReturnValue('blob:test-url'),
      revokeObjectURL: vi.fn()
    } as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Mobile Safari Detection and Initialization', () => {
    it('should initialize mobile audio context manager on Mobile Safari', async () => {
      mockIsMobileSafari.mockReturnValue(true);
      
      // Dynamic import to avoid SSR issues
      const JonathanDemoPage = (await import('../page')).default;
      render(<JonathanDemoPage />);

      await waitFor(() => {
        expect(mockMobileAudioManager.ensureReady).toHaveBeenCalled();
      });
    });

    it('should not initialize mobile audio context manager on non-Mobile Safari', async () => {
      mockIsMobileSafari.mockReturnValue(false);
      
      const JonathanDemoPage = (await import('../page')).default;
      render(<JonathanDemoPage />);

      // Wait a bit to ensure initialization would have happened
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockMobileAudioManager.ensureReady).not.toHaveBeenCalled();
    });

    it('should handle mobile audio context initialization failure gracefully', async () => {
      mockIsMobileSafari.mockReturnValue(true);
      mockMobileAudioManager.ensureReady.mockRejectedValue(new Error('Audio context failed'));
      
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const JonathanDemoPage = (await import('../page')).default;
      render(<JonathanDemoPage />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Failed to initialize mobile Safari audio context')
        );
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe('Audio Context State Management', () => {
    it('should check audio context readiness before playing audio on Mobile Safari', async () => {
      mockIsMobileSafari.mockReturnValue(true);
      mockMobileAudioManager.ensureReady.mockResolvedValue(true);
      
      const JonathanDemoPage = (await import('../page')).default;
      render(<JonathanDemoPage />);

      // Find and click a quick question button
      const questionButton = await screen.findByText(/Tell me something funny/i);
      fireEvent.click(questionButton);

      await waitFor(() => {
        expect(mockMobileAudioManager.ensureReady).toHaveBeenCalledTimes(2); // Once on init, once on question
      });
    });

    it('should abort audio playback if audio context is not ready', async () => {
      mockIsMobileSafari.mockReturnValue(true);
      mockMobileAudioManager.ensureReady.mockResolvedValue(false);
      
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const JonathanDemoPage = (await import('../page')).default;
      render(<JonathanDemoPage />);

      // Find and click a quick question button
      const questionButton = await screen.findByText(/Tell me something funny/i);
      fireEvent.click(questionButton);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Mobile Safari audio context not ready')
        );
      });
      
      consoleSpy.mockRestore();
    });

    it('should handle audio context errors gracefully', async () => {
      mockIsMobileSafari.mockReturnValue(true);
      mockMobileAudioManager.ensureReady.mockRejectedValue(new Error('Context error'));
      
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const JonathanDemoPage = (await import('../page')).default;
      render(<JonathanDemoPage />);

      // Find and click a quick question button
      const questionButton = await screen.findByText(/Tell me something funny/i);
      fireEvent.click(questionButton);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Failed to ensure mobile Safari audio context')
        );
      });
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Gesture Prompt Integration', () => {
    it('should show gesture prompt when audio context requires user gesture', async () => {
      mockIsMobileSafari.mockReturnValue(true);
      mockMobileAudioManager.ensureReady.mockResolvedValue(false);
      mockMobileAudioManager.getState.mockReturnValue({
        isInitialized: false,
        isActive: false,
        requiresGesture: true,
        lastInteraction: 0
      });
      
      const JonathanDemoPage = (await import('../page')).default;
      render(<JonathanDemoPage />);

      // Try to ask a question
      const questionButton = await screen.findByText(/Tell me something funny/i);
      fireEvent.click(questionButton);

      await waitFor(() => {
        expect(mockMobileAudioManager.ensureReady).toHaveBeenCalled();
      });
    });

    it('should proceed with audio playback after gesture is provided', async () => {
      mockIsMobileSafari.mockReturnValue(true);
      
      // First call returns false (needs gesture), second call returns true (ready)
      mockMobileAudioManager.ensureReady
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);
      
      const JonathanDemoPage = (await import('../page')).default;
      render(<JonathanDemoPage />);

      // First attempt should fail
      const questionButton = await screen.findByText(/Tell me something funny/i);
      fireEvent.click(questionButton);

      await waitFor(() => {
        expect(mockMobileAudioManager.ensureReady).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Audio Buffer Management', () => {
    it('should use mobile-optimized audio creation on Mobile Safari', async () => {
      mockIsMobileSafari.mockReturnValue(true);
      mockGlobalAudioManager.createOptimizedAudio.mockReturnValue({
        src: '',
        play: vi.fn().mockResolvedValue(undefined),
        pause: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        playsInline: true,
        muted: false,
        preload: 'auto'
      } as any);
      
      const JonathanDemoPage = (await import('../page')).default;
      render(<JonathanDemoPage />);

      // Trigger audio playback
      const questionButton = await screen.findByText(/Tell me something funny/i);
      fireEvent.click(questionButton);

      await waitFor(() => {
        expect(mockMobileAudioManager.ensureReady).toHaveBeenCalled();
      });
    });

    it('should handle audio buffer optimization errors', async () => {
      mockIsMobileSafari.mockReturnValue(true);
      mockMobileAudioManager.createOptimizedBuffer.mockRejectedValue(new Error('Buffer error'));
      
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const JonathanDemoPage = (await import('../page')).default;
      render(<JonathanDemoPage />);

      // The error should be handled gracefully without crashing the component
      expect(screen.getByText(/Tell me something funny/i)).toBeInTheDocument();
      
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Background/Foreground Transitions', () => {
    it('should handle page visibility changes', async () => {
      mockIsMobileSafari.mockReturnValue(true);
      
      const JonathanDemoPage = (await import('../page')).default;
      render(<JonathanDemoPage />);

      // Simulate page going to background
      Object.defineProperty(document, 'hidden', { value: true, writable: true });
      fireEvent(document, new Event('visibilitychange'));

      // Simulate page coming to foreground
      Object.defineProperty(document, 'hidden', { value: false, writable: true });
      fireEvent(document, new Event('visibilitychange'));

      // The component should handle these events without errors
      expect(screen.getByText(/Tell me something funny/i)).toBeInTheDocument();
    });

    it('should handle page hide/show events', async () => {
      mockIsMobileSafari.mockReturnValue(true);
      
      const JonathanDemoPage = (await import('../page')).default;
      render(<JonathanDemoPage />);

      // Simulate page hide
      fireEvent(window, new Event('pagehide'));

      // Simulate page show
      fireEvent(window, new Event('pageshow'));

      // The component should handle these events without errors
      expect(screen.getByText(/Tell me something funny/i)).toBeInTheDocument();
    });
  });

  describe('Cleanup and Resource Management', () => {
    it('should not destroy mobile audio context manager on component unmount', async () => {
      mockIsMobileSafari.mockReturnValue(true);
      
      const JonathanDemoPage = (await import('../page')).default;
      const { unmount } = render(<JonathanDemoPage />);

      unmount();

      // Should not destroy the singleton instance
      expect(mockMobileAudioManager.destroy).not.toHaveBeenCalled();
    });

    it('should log cleanup message on Mobile Safari', async () => {
      mockIsMobileSafari.mockReturnValue(true);
      
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      const JonathanDemoPage = (await import('../page')).default;
      const { unmount } = render(<JonathanDemoPage />);

      unmount();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cleaning up mobile Safari audio context manager')
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('Fallback Behavior', () => {
    it('should work normally on non-Mobile Safari browsers', async () => {
      mockIsMobileSafari.mockReturnValue(false);
      
      const JonathanDemoPage = (await import('../page')).default;
      render(<JonathanDemoPage />);

      // Should render normally without mobile-specific initialization
      expect(screen.getByText(/Tell me something funny/i)).toBeInTheDocument();
      expect(mockMobileAudioManager.ensureReady).not.toHaveBeenCalled();
    });

    it('should handle mixed mobile/desktop usage', async () => {
      // Start as non-mobile
      mockIsMobileSafari.mockReturnValue(false);
      
      const JonathanDemoPage = (await import('../page')).default;
      const { rerender } = render(<JonathanDemoPage />);

      // Switch to mobile Safari (simulating user agent change)
      mockIsMobileSafari.mockReturnValue(true);
      rerender(<JonathanDemoPage />);

      // Should handle the transition gracefully
      expect(screen.getByText(/Tell me something funny/i)).toBeInTheDocument();
    });
  });
});