/**
 * Session Expression Manager Tests
 * 
 * Tests for session-aware expression management and mid-conversation privacy controls.
 * 
 * Requirements: 6.1, 6.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionExpressionManager } from '../sessionExpressionManager';
import { StreamingAudioManager } from '../streamingUtils';

// Mock dependencies
vi.mock('../services/userSettingsService', () => ({
  UserSettingsService: {
    getExpressionSettings: vi.fn(),
    disableExpressionsForSession: vi.fn(),
    enableExpressionsForSession: vi.fn()
  }
}));

vi.mock('../voiceExpressionIntegration', () => ({
  disableExpressions: vi.fn(),
  enableExpressions: vi.fn(),
  gracefullyDisableExpressions: vi.fn()
}));

import { UserSettingsService } from '../services/userSettingsService';
import { 
  disableExpressions, 
  enableExpressions, 
  gracefullyDisableExpressions 
} from '../voiceExpressionIntegration';

describe('SessionExpressionManager', () => {
  let manager: SessionExpressionManager;
  let mockAudioManager: StreamingAudioManager;
  const testUserId = 'test-user-123';

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new SessionExpressionManager();
    mockAudioManager = {} as StreamingAudioManager;
    
    // Clear any existing intervals
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    manager.stop();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('initialize', () => {
    it('should set up session state', () => {
      manager.initialize(testUserId, mockAudioManager);
      
      const state = manager.getState();
      expect(state.userId).toBe(testUserId);
      expect(state.audioManager).toBe(mockAudioManager);
      expect(state.active).toBe(false);
    });
  });

  describe('start', () => {
    beforeEach(() => {
      manager.initialize(testUserId, mockAudioManager);
    });

    it('should start with expressions enabled when settings allow', async () => {
      vi.mocked(UserSettingsService.getExpressionSettings).mockResolvedValue({
        expressionsEnabled: true,
        sessionDisabled: false,
        maxExpressionsPerTurn: 2
      });

      const result = await manager.start();

      expect(result).toBe(true);
      expect(manager.isActive()).toBe(true);
      expect(enableExpressions).toHaveBeenCalledWith(mockAudioManager);
    });

    it('should start with expressions disabled when globally disabled', async () => {
      vi.mocked(UserSettingsService.getExpressionSettings).mockResolvedValue({
        expressionsEnabled: false,
        sessionDisabled: false,
        maxExpressionsPerTurn: 2
      });

      const result = await manager.start();

      expect(result).toBe(false);
      expect(manager.isActive()).toBe(false);
      expect(disableExpressions).toHaveBeenCalledWith(mockAudioManager);
    });

    it('should start with expressions disabled when session disabled', async () => {
      vi.mocked(UserSettingsService.getExpressionSettings).mockResolvedValue({
        expressionsEnabled: true,
        sessionDisabled: true,
        maxExpressionsPerTurn: 2
      });

      const result = await manager.start();

      expect(result).toBe(false);
      expect(manager.isActive()).toBe(false);
      expect(disableExpressions).toHaveBeenCalledWith(mockAudioManager);
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(UserSettingsService.getExpressionSettings).mockRejectedValue(
        new Error('Settings error')
      );

      const result = await manager.start();

      expect(result).toBe(false);
      expect(manager.isActive()).toBe(false);
      expect(disableExpressions).toHaveBeenCalledWith(mockAudioManager);
    });
  });

  describe('disableForSession', () => {
    beforeEach(() => {
      manager.initialize(testUserId, mockAudioManager);
    });

    it('should disable expressions for session', async () => {
      vi.mocked(UserSettingsService.disableExpressionsForSession).mockResolvedValue(true);

      const result = await manager.disableForSession();

      expect(result).toBe(true);
      expect(manager.isActive()).toBe(false);
      expect(UserSettingsService.disableExpressionsForSession).toHaveBeenCalledWith(testUserId);
      expect(gracefullyDisableExpressions).toHaveBeenCalledWith(mockAudioManager);
    });

    it('should handle service errors', async () => {
      vi.mocked(UserSettingsService.disableExpressionsForSession).mockResolvedValue(false);

      const result = await manager.disableForSession();

      expect(result).toBe(false);
    });
  });

  describe('enableForSession', () => {
    beforeEach(() => {
      manager.initialize(testUserId, mockAudioManager);
    });

    it('should enable expressions for session', async () => {
      vi.mocked(UserSettingsService.enableExpressionsForSession).mockResolvedValue(true);

      const result = await manager.enableForSession();

      expect(result).toBe(true);
      expect(manager.isActive()).toBe(true);
      expect(UserSettingsService.enableExpressionsForSession).toHaveBeenCalledWith(testUserId);
      expect(enableExpressions).toHaveBeenCalledWith(mockAudioManager);
    });
  });

  describe('stop', () => {
    it('should cleanup session and disable expressions', () => {
      manager.initialize(testUserId, mockAudioManager);
      manager.stop();

      const state = manager.getState();
      expect(state.active).toBe(false);
      expect(gracefullyDisableExpressions).toHaveBeenCalledWith(mockAudioManager);
    });
  });

  describe('privacy settings monitoring', () => {
    beforeEach(() => {
      manager.initialize(testUserId, mockAudioManager);
    });

    it('should detect settings changes and update session', async () => {
      // Start with expressions enabled
      vi.mocked(UserSettingsService.getExpressionSettings).mockResolvedValue({
        expressionsEnabled: true,
        sessionDisabled: false,
        maxExpressionsPerTurn: 2
      });

      await manager.start();
      expect(manager.isActive()).toBe(true);

      // Change settings to disabled
      vi.mocked(UserSettingsService.getExpressionSettings).mockResolvedValue({
        expressionsEnabled: true,
        sessionDisabled: true,
        maxExpressionsPerTurn: 2
      });

      // Manually trigger privacy check
      await manager.triggerPrivacyCheck();

      expect(manager.isActive()).toBe(false);
      expect(gracefullyDisableExpressions).toHaveBeenCalledWith(mockAudioManager);
    });

    it('should enable expressions when settings change to allow', async () => {
      // Start with expressions disabled
      vi.mocked(UserSettingsService.getExpressionSettings).mockResolvedValue({
        expressionsEnabled: true,
        sessionDisabled: true,
        maxExpressionsPerTurn: 2
      });

      await manager.start();
      expect(manager.isActive()).toBe(false);

      // Change settings to enabled
      vi.mocked(UserSettingsService.getExpressionSettings).mockResolvedValue({
        expressionsEnabled: true,
        sessionDisabled: false,
        maxExpressionsPerTurn: 2
      });

      // Manually trigger privacy check
      await manager.triggerPrivacyCheck();

      expect(manager.isActive()).toBe(true);
      expect(enableExpressions).toHaveBeenCalledWith(mockAudioManager);
    });

    it('should handle privacy check errors gracefully', async () => {
      vi.mocked(UserSettingsService.getExpressionSettings).mockResolvedValue({
        expressionsEnabled: true,
        sessionDisabled: false,
        maxExpressionsPerTurn: 2
      });

      await manager.start();
      const initialState = manager.isActive();

      // Make privacy check fail
      vi.mocked(UserSettingsService.getExpressionSettings).mockRejectedValue(
        new Error('Privacy check failed')
      );

      // Manually trigger privacy check
      await manager.triggerPrivacyCheck();

      // State should remain unchanged on error
      expect(manager.isActive()).toBe(initialState);
    });
  });
});