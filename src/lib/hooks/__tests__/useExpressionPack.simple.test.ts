/**
 * Simple test for useExpressionPack hook to verify basic functionality
 */

import { renderHook } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useExpressionPack } from '../useExpressionPack';

// Mock the feature flags module
vi.mock('../../featureFlags', () => ({
  useFeatureFlag: vi.fn(() => true)
}));

// Mock fetch
global.fetch = vi.fn();

// Mock AudioContext
const mockAudioContext = {
  decodeAudioData: vi.fn(),
  close: vi.fn().mockResolvedValue(undefined),
  state: 'running'
};

global.AudioContext = vi.fn(() => mockAudioContext);
(global as any).webkitAudioContext = global.AudioContext;

describe('useExpressionPack - Basic Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => 
      useExpressionPack({ ownerId: 'test-user' })
    );

    expect(result.current.pack).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.isReady).toBe(false);
    expect(typeof result.current.preload).toBe('function');
    expect(typeof result.current.cleanup).toBe('function');
    expect(typeof result.current.getBuffer).toBe('function');
  });

  it('should return null buffer when no pack is loaded', () => {
    const { result } = renderHook(() => 
      useExpressionPack({ ownerId: 'test-user' })
    );

    expect(result.current.getBuffer('any-id')).toBeNull();
  });

  it('should handle feature flag disabled state', () => {
    // Mock feature flag as disabled
    const { useFeatureFlag } = require('../../featureFlags');
    useFeatureFlag.mockReturnValue(false);

    const { result } = renderHook(() => 
      useExpressionPack({ ownerId: 'test-user' })
    );

    expect(result.current.pack).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.isReady).toBe(false);
    expect(result.current.getBuffer('any-id')).toBeNull();
  });
});