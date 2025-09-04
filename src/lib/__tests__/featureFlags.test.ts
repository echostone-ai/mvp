/**
 * Tests for feature flag functionality
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { getFeatureFlags, isFeatureEnabled, requireFeatureFlag } from '../featureFlags';

describe('Feature Flags', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getFeatureFlags', () => {
    it('should return false for VOICE_OVERLAYS when env var is not set', () => {
      delete process.env.FEATURE_VOICE_OVERLAYS;
      const flags = getFeatureFlags();
      expect(flags.VOICE_OVERLAYS).toBe(false);
    });

    it('should return false for VOICE_OVERLAYS when env var is false', () => {
      process.env.FEATURE_VOICE_OVERLAYS = 'false';
      const flags = getFeatureFlags();
      expect(flags.VOICE_OVERLAYS).toBe(false);
    });

    it('should return true for VOICE_OVERLAYS when env var is true', () => {
      process.env.FEATURE_VOICE_OVERLAYS = 'true';
      const flags = getFeatureFlags();
      expect(flags.VOICE_OVERLAYS).toBe(true);
    });
  });

  describe('isFeatureEnabled', () => {
    it('should return correct value for VOICE_OVERLAYS flag', () => {
      process.env.FEATURE_VOICE_OVERLAYS = 'true';
      expect(isFeatureEnabled('VOICE_OVERLAYS')).toBe(true);

      process.env.FEATURE_VOICE_OVERLAYS = 'false';
      expect(isFeatureEnabled('VOICE_OVERLAYS')).toBe(false);
    });
  });

  describe('requireFeatureFlag', () => {
    it('should call handler when feature is enabled', async () => {
      process.env.FEATURE_VOICE_OVERLAYS = 'true';
      const mockHandler = vi.fn().mockResolvedValue(new Response('success'));
      const wrappedHandler = requireFeatureFlag('VOICE_OVERLAYS')(mockHandler);
      
      const request = new Request('http://localhost/test');
      const response = await wrappedHandler(request);
      
      expect(mockHandler).toHaveBeenCalledWith(request);
      expect(await response.text()).toBe('success');
    });

    it('should return 404 when feature is disabled', async () => {
      process.env.FEATURE_VOICE_OVERLAYS = 'false';
      const mockHandler = vi.fn();
      const wrappedHandler = requireFeatureFlag('VOICE_OVERLAYS')(mockHandler);
      
      const request = new Request('http://localhost/test');
      const response = await wrappedHandler(request);
      
      expect(mockHandler).not.toHaveBeenCalled();
      expect(response.status).toBe(404);
      expect(await response.text()).toBe('Feature not available');
    });
  });
});