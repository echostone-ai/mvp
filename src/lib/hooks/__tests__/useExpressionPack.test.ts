/**
 * Tests for useExpressionPack hook
 * 
 * Tests cover:
 * - Feature flag gating
 * - Expression loading and preloading
 * - User interaction triggering
 * - Memory cleanup
 * - Error handling and graceful degradation
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useExpressionPack, useHasExpressions } from '../useExpressionPack';
import { ExpressionClip } from '../../types/expressions';

// Mock the feature flags
vi.mock('../../featureFlags', () => ({
  useFeatureFlag: vi.fn()
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock AudioContext
const mockAudioContext = {
  decodeAudioData: vi.fn(),
  close: vi.fn().mockResolvedValue(undefined),
  state: 'running'
};

const mockAudioContextConstructor = vi.fn(() => mockAudioContext);
global.AudioContext = mockAudioContextConstructor;
(global as any).webkitAudioContext = mockAudioContextConstructor;

// Mock console methods
const consoleSpy = {
  warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
  error: vi.spyOn(console, 'error').mockImplementation(() => {})
};

describe('useExpressionPack', () => {
  const mockExpressions: ExpressionClip[] = [
    {
      id: 'expr-1',
      owner_type: 'user',
      owner_key: 'user-123',
      filename: 'laugh.mp3',
      type: 'laugh',
      tone: 'cheerful',
      placement_hints: ['after_joke'],
      duration_ms: 1500,
      cdn_url: 'https://cdn.example.com/laugh.mp3',
      priority: 1,
      status: 'active',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    },
    {
      id: 'expr-2',
      owner_type: 'user',
      owner_key: 'user-123',
      filename: 'sigh.mp3',
      type: 'sigh',
      duration_ms: 800,
      cdn_url: 'https://cdn.example.com/sigh.mp3',
      priority: 0,
      status: 'active',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z'
    }
  ];

  const mockAudioBuffer = {
    length: 44100,
    sampleRate: 22050,
    numberOfChannels: 1
  } as AudioBuffer;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset feature flag to enabled by default
    const { useFeatureFlag } = require('../../featureFlags');
    useFeatureFlag.mockReturnValue(true);
    
    // Setup default fetch mock
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ expressions: mockExpressions }),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
    });
    
    // Setup default AudioContext mock
    mockAudioContext.decodeAudioData.mockResolvedValue(mockAudioBuffer);
  });

  afterEach(() => {
    consoleSpy.warn.mockClear();
    consoleSpy.error.mockClear();
  });

  describe('Feature Flag Gating', () => {
    it('should return disabled state when feature flag is off', () => {
      const { useFeatureFlag } = require('../../featureFlags');
      useFeatureFlag.mockReturnValue(false);

      const { result } = renderHook(() => 
        useExpressionPack({ ownerId: 'user-123' })
      );

      expect(result.current.pack).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.isReady).toBe(false);
      expect(result.current.getBuffer('expr-1')).toBeNull();
    });

    it('should not make API calls when feature is disabled', () => {
      const { useFeatureFlag } = require('../../featureFlags');
      useFeatureFlag.mockReturnValue(false);

      renderHook(() => 
        useExpressionPack({ ownerId: 'user-123', autoPreload: true })
      );

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Expression Loading', () => {
    it('should load expressions on manual preload', async () => {
      const { result } = renderHook(() => 
        useExpressionPack({ ownerId: 'user-123', autoPreload: false })
      );

      expect(result.current.isLoading).toBe(false);
      expect(result.current.pack).toBeNull();

      await act(async () => {
        await result.current.preload();
      });

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      expect(result.current.pack).not.toBeNull();
      expect(result.current.pack?.clips).toHaveLength(2);
      expect(result.current.pack?.is_loaded).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it('should make correct API call with parameters', async () => {
      const { result } = renderHook(() => 
        useExpressionPack({ 
          ownerId: 'avatar-456', 
          ownerType: 'avatar',
          autoPreload: false 
        })
      );

      await act(async () => {
        await result.current.preload();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/expressions?'),
        expect.objectContaining({
          signal: expect.any(AbortSignal)
        })
      );

      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).toContain('owner_type=avatar');
      expect(callUrl).toContain('owner_key=avatar-456');
      expect(callUrl).toContain('status=active');
      expect(callUrl).toContain('limit=50');
    });

    it('should preload audio buffers for each expression', async () => {
      const { result } = renderHook(() => 
        useExpressionPack({ ownerId: 'user-123', autoPreload: false })
      );

      await act(async () => {
        await result.current.preload();
      });

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      // Should have fetched audio for each expression
      expect(mockFetch).toHaveBeenCalledTimes(3); // 1 for metadata + 2 for audio
      expect(mockFetch).toHaveBeenCalledWith(
        'https://cdn.example.com/laugh.mp3',
        expect.objectContaining({
          cache: 'force-cache',
          priority: 'low'
        })
      );
      expect(mockFetch).toHaveBeenCalledWith(
        'https://cdn.example.com/sigh.mp3',
        expect.objectContaining({
          cache: 'force-cache',
          priority: 'low'
        })
      );

      // Should have decoded audio data
      expect(mockAudioContext.decodeAudioData).toHaveBeenCalledTimes(2);
    });

    it('should handle empty expression list', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ expressions: [] })
      });

      const { result } = renderHook(() => 
        useExpressionPack({ ownerId: 'user-123', autoPreload: false })
      );

      await act(async () => {
        await result.current.preload();
      });

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      expect(result.current.pack?.clips).toHaveLength(0);
      expect(result.current.pack?.preloaded_buffers.size).toBe(0);
      expect(result.current.pack?.is_loaded).toBe(true);
    });
  });

  describe('Auto-preloading on User Interaction', () => {
    it('should trigger preload on first user click when autoPreload is true', async () => {
      const { result } = renderHook(() => 
        useExpressionPack({ ownerId: 'user-123', autoPreload: true })
      );

      expect(result.current.isLoading).toBe(false);

      // Simulate user click
      act(() => {
        document.dispatchEvent(new Event('click'));
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(true);
      });

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      expect(result.current.pack).not.toBeNull();
    });

    it('should not trigger preload on interaction when autoPreload is false', () => {
      const { result } = renderHook(() => 
        useExpressionPack({ ownerId: 'user-123', autoPreload: false })
      );

      // Simulate user click
      act(() => {
        document.dispatchEvent(new Event('click'));
      });

      expect(result.current.isLoading).toBe(false);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should only trigger preload once per hook instance', async () => {
      const { result } = renderHook(() => 
        useExpressionPack({ ownerId: 'user-123', autoPreload: true })
      );

      // First click
      act(() => {
        document.dispatchEvent(new Event('click'));
      });

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      const firstCallCount = mockFetch.mock.calls.length;

      // Second click should not trigger another preload
      act(() => {
        document.dispatchEvent(new Event('click'));
      });

      expect(mockFetch.mock.calls.length).toBe(firstCallCount);
    });
  });

  describe('Buffer Management', () => {
    it('should return correct buffer for expression ID', async () => {
      const { result } = renderHook(() => 
        useExpressionPack({ ownerId: 'user-123', autoPreload: false })
      );

      await act(async () => {
        await result.current.preload();
      });

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      const buffer = result.current.getBuffer('expr-1');
      expect(buffer).toBe(mockAudioBuffer);

      const nonExistentBuffer = result.current.getBuffer('non-existent');
      expect(nonExistentBuffer).toBeNull();
    });

    it('should cleanup buffers and AudioContext on cleanup', async () => {
      const { result, unmount } = renderHook(() => 
        useExpressionPack({ ownerId: 'user-123', autoPreload: false })
      );

      await act(async () => {
        await result.current.preload();
      });

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      // Manual cleanup
      act(() => {
        result.current.cleanup();
      });

      expect(result.current.pack).toBeNull();
      expect(result.current.isReady).toBe(false);
      expect(mockAudioContext.close).toHaveBeenCalled();

      // Unmount should also trigger cleanup
      unmount();
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { result } = renderHook(() => 
        useExpressionPack({ ownerId: 'user-123', autoPreload: false })
      );

      await act(async () => {
        await result.current.preload();
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
      expect(result.current.pack?.clips).toHaveLength(0);
      expect(result.current.pack?.is_loaded).toBe(false);
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('should handle audio loading errors gracefully', async () => {
      // API succeeds but audio loading fails
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ expressions: mockExpressions })
        })
        .mockRejectedValue(new Error('Audio load failed'));

      const { result } = renderHook(() => 
        useExpressionPack({ ownerId: 'user-123', autoPreload: false })
      );

      await act(async () => {
        await result.current.preload();
      });

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      // Should still have clips but no buffers
      expect(result.current.pack?.clips).toHaveLength(2);
      expect(result.current.pack?.preloaded_buffers.size).toBe(0);
      expect(consoleSpy.warn).toHaveBeenCalled();
    });

    it('should handle AudioContext creation failure', async () => {
      mockAudioContextConstructor.mockImplementationOnce(() => {
        throw new Error('AudioContext not supported');
      });

      const { result } = renderHook(() => 
        useExpressionPack({ ownerId: 'user-123', autoPreload: false })
      );

      await act(async () => {
        await result.current.preload();
      });

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      // Should still load metadata but no buffers
      expect(result.current.pack?.clips).toHaveLength(2);
      expect(result.current.pack?.preloaded_buffers.size).toBe(0);
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        'Failed to create AudioContext:',
        expect.any(Error)
      );
    });

    it('should handle request cancellation', async () => {
      let resolvePromise: (value: any) => void;
      const pendingPromise = new Promise(resolve => {
        resolvePromise = resolve;
      });

      mockFetch.mockReturnValueOnce(pendingPromise);

      const { result, unmount } = renderHook(() => 
        useExpressionPack({ ownerId: 'user-123', autoPreload: false })
      );

      // Start preload
      act(() => {
        result.current.preload();
      });

      expect(result.current.isLoading).toBe(true);

      // Unmount before request completes
      unmount();

      // Complete the request (should be ignored due to cancellation)
      resolvePromise!({
        ok: true,
        json: () => Promise.resolve({ expressions: mockExpressions })
      });

      // No errors should be thrown
      expect(consoleSpy.error).not.toHaveBeenCalled();
    });
  });

  describe('Concurrency Control', () => {
    it('should respect maxConcurrentLoads setting', async () => {
      const manyExpressions = Array.from({ length: 10 }, (_, i) => ({
        ...mockExpressions[0],
        id: `expr-${i}`,
        cdn_url: `https://cdn.example.com/expr-${i}.mp3`
      }));

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ expressions: manyExpressions })
        })
        .mockResolvedValue({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
        });

      const { result } = renderHook(() => 
        useExpressionPack({ 
          ownerId: 'user-123', 
          autoPreload: false,
          maxConcurrentLoads: 2
        })
      );

      await act(async () => {
        await result.current.preload();
      });

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      // Should have loaded all expressions
      expect(result.current.pack?.clips).toHaveLength(10);
      // All audio requests should have been made (but in controlled batches)
      expect(mockFetch).toHaveBeenCalledTimes(11); // 1 metadata + 10 audio
    });
  });
});

describe('useHasExpressions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    const { useFeatureFlag } = require('../../featureFlags');
    useFeatureFlag.mockReturnValue(true);
    
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ expressions: mockExpressions }),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
    });
    
    mockAudioContext.decodeAudioData.mockResolvedValue(mockAudioBuffer);
  });

  it('should return true when expressions are available', async () => {
    const { result } = renderHook(() => 
      useHasExpressions('user-123', 'user')
    );

    // Initially false while loading
    expect(result.current).toBe(false);

    // Trigger user interaction to start loading
    act(() => {
      document.dispatchEvent(new Event('click'));
    });

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it('should return false when no expressions are available', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ expressions: [] })
    });

    const { result } = renderHook(() => 
      useHasExpressions('user-123', 'user')
    );

    act(() => {
      document.dispatchEvent(new Event('click'));
    });

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  it('should return false when feature is disabled', () => {
    const { useFeatureFlag } = require('../../featureFlags');
    useFeatureFlag.mockReturnValue(false);

    const { result } = renderHook(() => 
      useHasExpressions('user-123', 'user')
    );

    expect(result.current).toBe(false);
  });
});