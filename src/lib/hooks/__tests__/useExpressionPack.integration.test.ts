/**
 * Integration test for useExpressionPack hook
 * Tests the hook with actual feature flag implementation
 */

import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useExpressionPack } from '../useExpressionPack';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock AudioContext
const mockAudioContext = {
  decodeAudioData: vi.fn(),
  close: vi.fn().mockResolvedValue(undefined),
  state: 'running'
};

global.AudioContext = vi.fn(() => mockAudioContext);
(global as any).webkitAudioContext = global.AudioContext;

// Mock console methods
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('useExpressionPack - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up environment variable for feature flag
    process.env.FEATURE_VOICE_OVERLAYS = 'true';
    
    // Setup default fetch mock
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ expressions: [] }),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
    });
    
    mockAudioContext.decodeAudioData.mockResolvedValue({
      length: 44100,
      sampleRate: 22050,
      numberOfChannels: 1
    } as AudioBuffer);
  });

  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => 
      useExpressionPack({ ownerId: 'test-user', autoPreload: false })
    );

    expect(result.current.pack).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.isReady).toBe(false);
    expect(typeof result.current.preload).toBe('function');
    expect(typeof result.current.cleanup).toBe('function');
    expect(typeof result.current.getBuffer).toBe('function');
  });

  it('should handle feature flag disabled', () => {
    // Disable feature flag
    process.env.FEATURE_VOICE_OVERLAYS = 'false';

    const { result } = renderHook(() => 
      useExpressionPack({ ownerId: 'test-user' })
    );

    expect(result.current.pack).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.isReady).toBe(false);
    expect(result.current.getBuffer('any-id')).toBeNull();
    
    // Should not make any API calls
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should load empty expression pack successfully', async () => {
    const { result } = renderHook(() => 
      useExpressionPack({ ownerId: 'test-user', autoPreload: false })
    );

    await act(async () => {
      await result.current.preload();
    });

    expect(result.current.pack).not.toBeNull();
    expect(result.current.pack?.clips).toHaveLength(0);
    expect(result.current.pack?.is_loaded).toBe(true);
    expect(result.current.isReady).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('should make correct API call', async () => {
    const { result } = renderHook(() => 
      useExpressionPack({ 
        ownerId: 'avatar-123', 
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
    expect(callUrl).toContain('owner_key=avatar-123');
    expect(callUrl).toContain('status=active');
    expect(callUrl).toContain('limit=50');
  });

  it('should handle API errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => 
      useExpressionPack({ ownerId: 'test-user', autoPreload: false })
    );

    await act(async () => {
      await result.current.preload();
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.pack?.clips).toHaveLength(0);
    expect(result.current.pack?.is_loaded).toBe(false);
    expect(result.current.isReady).toBe(false);
  });

  it('should cleanup resources properly', async () => {
    const { result, unmount } = renderHook(() => 
      useExpressionPack({ ownerId: 'test-user', autoPreload: false })
    );

    await act(async () => {
      await result.current.preload();
    });

    expect(result.current.isReady).toBe(true);

    // Manual cleanup
    act(() => {
      result.current.cleanup();
    });

    expect(result.current.pack).toBeNull();
    expect(result.current.isReady).toBe(false);
    
    // AudioContext.close is only called if AudioContext was created
    // In this test with empty expressions, it might not be created
    // So we just verify cleanup worked without checking AudioContext

    // Unmount should also work without errors
    unmount();
  });

  it('should not preload multiple times', async () => {
    const { result } = renderHook(() => 
      useExpressionPack({ ownerId: 'test-user', autoPreload: false })
    );

    // First preload
    await act(async () => {
      await result.current.preload();
    });

    const firstCallCount = mockFetch.mock.calls.length;

    // Second preload should not make additional calls
    await act(async () => {
      await result.current.preload();
    });

    expect(mockFetch.mock.calls.length).toBe(firstCallCount);
  });
});