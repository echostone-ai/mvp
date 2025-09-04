// Task 9: Mobile Safari Audio Context Manager Tests
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MobileAudioContextManager, isMobileSafari, createMobileOptimizedAudio } from '../mobileAudioContextManager';

// Mock DOM APIs
const mockAudioContext = {
  state: 'suspended',
  sampleRate: 44100,
  resume: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  createBuffer: vi.fn(),
  createBufferSource: vi.fn(),
  destination: {},
  decodeAudioData: vi.fn()
};

const mockAudio = {
  src: '',
  playsInline: false,
  muted: false,
  preload: 'none',
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
};

// Mock global objects
Object.defineProperty(global, 'window', {
  value: {
    AudioContext: vi.fn(() => mockAudioContext),
    webkitAudioContext: vi.fn(() => mockAudioContext),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    navigator: {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
    }
  },
  writable: true
});

Object.defineProperty(global, 'document', {
  value: {
    hidden: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    createElement: vi.fn(() => ({
      id: '',
      innerHTML: '',
      style: {},
      appendChild: vi.fn(),
      remove: vi.fn(),
      querySelector: vi.fn(() => ({
        addEventListener: vi.fn()
      }))
    })),
    body: {
      appendChild: vi.fn()
    }
  },
  writable: true
});

Object.defineProperty(global, 'Audio', {
  value: vi.fn(() => mockAudio),
  writable: true
});

describe('MobileAudioContextManager', () => {
  let manager: MobileAudioContextManager;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton instance
    (MobileAudioContextManager as any).instance = null;
    try {
      manager = MobileAudioContextManager.getInstance();
    } catch (error) {
      // Handle initialization errors in tests
      console.warn('Manager initialization failed in test:', error);
    }
  });

  afterEach(() => {
    if (manager && typeof manager.destroy === 'function') {
      manager.destroy();
    }
  });

  describe('Mobile Safari Detection', () => {
    it('should detect Mobile Safari correctly', () => {
      expect(isMobileSafari()).toBe(true);
    });

    it('should not detect non-Safari browsers as Mobile Safari', () => {
      // Mock Chrome on iPhone
      Object.defineProperty(window, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/94.0.4606.76 Mobile/15E148 Safari/604.1'
        },
        writable: true
      });

      expect(isMobileSafari()).toBe(false);
    });
  });

  describe('Audio Context Initialization', () => {
    it('should initialize with default configuration', () => {
      const state = manager.getState();
      expect(state.isInitialized).toBe(false);
      expect(state.requiresGesture).toBe(true);
      expect(state.isActive).toBe(false);
    });

    it('should require user gesture for initialization', async () => {
      const isReady = await manager.ensureReady();
      expect(isReady).toBe(false);
      expect(manager.getState().requiresGesture).toBe(true);
    });

    it('should show gesture prompt when needed', async () => {
      const createElementSpy = vi.spyOn(document, 'createElement');
      const appendChildSpy = vi.spyOn(document.body, 'appendChild');

      await manager.ensureReady();

      expect(createElementSpy).toHaveBeenCalledWith('div');
      expect(appendChildSpy).toHaveBeenCalled();
    });
  });

  describe('Audio Context State Management', () => {
    it('should handle backgrounding correctly', () => {
      const state = manager.getState();
      expect(state.backgroundedAt).toBeUndefined();

      // Simulate visibility change to hidden
      const visibilityHandler = vi.mocked(document.addEventListener).mock.calls
        .find(call => call[0] === 'visibilitychange')?.[1] as () => void;

      Object.defineProperty(document, 'hidden', { value: true, writable: true });
      visibilityHandler?.();

      const newState = manager.getState();
      expect(newState.backgroundedAt).toBeDefined();
    });

    it('should handle foregrounding correctly', () => {
      // First background the app
      Object.defineProperty(document, 'hidden', { value: true, writable: true });
      const visibilityHandler = vi.mocked(document.addEventListener).mock.calls
        .find(call => call[0] === 'visibilitychange')?.[1] as () => void;
      visibilityHandler?.();

      // Then foreground it
      Object.defineProperty(document, 'hidden', { value: false, writable: true });
      visibilityHandler?.();

      const state = manager.getState();
      expect(state.resumedAt).toBeDefined();
    });
  });

  describe('Audio Buffer Optimization', () => {
    it('should create optimized audio buffer', async () => {
      // Mock successful audio context initialization
      manager.getState().isInitialized = true;
      (manager as any).audioContext = mockAudioContext;

      const mockBuffer = new ArrayBuffer(1024);
      const mockAudioBuffer = {
        duration: 2.0,
        sampleRate: 44100,
        numberOfChannels: 2,
        length: 88200,
        getChannelData: vi.fn(() => new Float32Array(88200))
      };

      mockAudioContext.decodeAudioData.mockImplementation((data, success) => {
        success(mockAudioBuffer);
      });

      const result = await manager.createOptimizedBuffer(mockBuffer);
      expect(result).toBe(mockAudioBuffer);
      expect(mockAudioContext.decodeAudioData).toHaveBeenCalledWith(
        expect.any(ArrayBuffer),
        expect.any(Function),
        expect.any(Function)
      );
    });

    it('should handle buffer validation errors', async () => {
      manager.getState().isInitialized = true;
      (manager as any).audioContext = mockAudioContext;

      const mockBuffer = new ArrayBuffer(1024);
      mockAudioContext.decodeAudioData.mockImplementation((data, success, error) => {
        error(new Error('Decode failed'));
      });

      await expect(manager.createOptimizedBuffer(mockBuffer)).rejects.toThrow('Decode failed');
    });

    it('should truncate overly long buffers', async () => {
      manager.getState().isInitialized = true;
      (manager as any).audioContext = mockAudioContext;
      
      const mockBuffer = new ArrayBuffer(1024);
      const longAudioBuffer = {
        duration: 35.0, // Longer than 30 second limit
        sampleRate: 44100,
        numberOfChannels: 2,
        length: 44100 * 35, // 35 seconds worth of samples
        getChannelData: vi.fn(() => new Float32Array(44100 * 35))
      };

      const truncatedBuffer = {
        duration: 30.0,
        sampleRate: 44100,
        numberOfChannels: 2,
        length: 44100 * 30,
        getChannelData: vi.fn(() => new Float32Array(44100 * 30))
      };

      mockAudioContext.createBuffer = vi.fn(() => truncatedBuffer);
      mockAudioContext.decodeAudioData.mockImplementation((data, success) => {
        success(longAudioBuffer);
      });

      const result = await manager.createOptimizedBuffer(mockBuffer);
      expect(mockAudioContext.createBuffer).toHaveBeenCalledWith(2, 44100 * 30, 44100);
    });
  });

  describe('Fallback Audio Creation', () => {
    it('should create mobile-optimized audio element', () => {
      const audio = manager.createFallbackAudio('test.mp3');
      expect(audio.src).toBe('test.mp3');
      expect(audio.preload).toBe('auto');
      expect(audio.playsInline).toBe(true);
      expect(audio.muted).toBe(false);
    });

    it('should create standard audio element on non-mobile Safari', () => {
      // Mock non-mobile Safari
      Object.defineProperty(window, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        writable: true
      });

      const audio = createMobileOptimizedAudio('test.mp3');
      expect(audio.src).toBe('test.mp3');
      expect(audio.preload).toBe('auto');
    });
  });

  describe('Cleanup and Destruction', () => {
    it('should clean up resources on destroy', () => {
      const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');
      const removeWindowEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      manager.destroy();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('touchstart', expect.any(Function));
      expect(removeEventListenerSpy).toHaveBeenCalledWith('click', expect.any(Function));
      expect(removeWindowEventListenerSpy).toHaveBeenCalledWith('pagehide', expect.any(Function));
      expect(removeWindowEventListenerSpy).toHaveBeenCalledWith('pageshow', expect.any(Function));

      const state = manager.getState();
      expect(state.isInitialized).toBe(false);
      expect(state.isActive).toBe(false);
      expect(state.requiresGesture).toBe(true);
    });

    it('should close audio context on destroy', () => {
      (manager as any).audioContext = mockAudioContext;
      manager.destroy();
      expect(mockAudioContext.close).toHaveBeenCalled();
    });
  });

  describe('User Gesture Handling', () => {
    it('should handle touch start gesture', () => {
      const touchHandler = vi.mocked(document.addEventListener).mock.calls
        .find(call => call[0] === 'touchstart')?.[1] as () => void;

      const initialTime = manager.getState().lastInteraction;
      touchHandler?.();
      
      const newTime = manager.getState().lastInteraction;
      expect(newTime).toBeGreaterThan(initialTime);
    });

    it('should handle click gesture', () => {
      const clickHandler = vi.mocked(document.addEventListener).mock.calls
        .find(call => call[0] === 'click')?.[1] as () => void;

      const initialTime = manager.getState().lastInteraction;
      clickHandler?.();
      
      const newTime = manager.getState().lastInteraction;
      expect(newTime).toBeGreaterThan(initialTime);
    });
  });
});

describe('Utility Functions', () => {
  describe('isMobileSafari', () => {
    it('should return true for iPhone Safari', () => {
      Object.defineProperty(window, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
        },
        writable: true
      });

      expect(isMobileSafari()).toBe(true);
    });

    it('should return true for iPad Safari', () => {
      Object.defineProperty(window, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (iPad; CPU OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
        },
        writable: true
      });

      expect(isMobileSafari()).toBe(true);
    });

    it('should return false for Chrome on mobile', () => {
      Object.defineProperty(window, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/94.0.4606.76 Mobile/15E148 Safari/604.1'
        },
        writable: true
      });

      expect(isMobileSafari()).toBe(false);
    });

    it('should return false for desktop Safari', () => {
      Object.defineProperty(window, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15'
        },
        writable: true
      });

      expect(isMobileSafari()).toBe(false);
    });
  });

  describe('createMobileOptimizedAudio', () => {
    it('should create optimized audio for mobile Safari', () => {
      Object.defineProperty(window, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
        },
        writable: true
      });

      const audio = createMobileOptimizedAudio('test.mp3');
      expect(audio.src).toBe('test.mp3');
      expect(audio.preload).toBe('auto');
    });

    it('should create standard audio for non-mobile Safari', () => {
      Object.defineProperty(window, 'navigator', {
        value: {
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        writable: true
      });

      const audio = createMobileOptimizedAudio('test.mp3');
      expect(audio.src).toBe('test.mp3');
    });
  });
});