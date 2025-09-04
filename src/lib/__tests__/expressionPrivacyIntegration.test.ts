/**
 * Expression Privacy Integration Tests
 * 
 * End-to-end tests for expression privacy controls and graceful degradation.
 * 
 * Requirements: 6.1, 6.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  integrateExpressionsWithVoice,
  setupUserExpressions,
  checkExpressionsEnabledForUser,
  disableExpressionsForUserSession,
  enableExpressionsForUserSession
} from '../voiceExpressionIntegration';
import { StreamingAudioManager } from '../streamingUtils';

// Mock dependencies
vi.mock('../featureFlags', () => ({
  isFeatureEnabled: vi.fn(() => true)
}));

vi.mock('../services/userSettingsService', () => ({
  UserSettingsService: {
    shouldEnableExpressions: vi.fn(),
    disableExpressionsForSession: vi.fn(),
    enableExpressionsForSession: vi.fn()
  }
}));

vi.mock('../services/expressionStorageService', () => ({
  ExpressionStorageService: {
    listExpressions: vi.fn(),
    countExpressions: vi.fn()
  }
}));

import { UserSettingsService } from '../services/userSettingsService';
import { ExpressionStorageService } from '../services/expressionStorageService';

describe('Expression Privacy Integration', () => {
  let mockAudioManager: StreamingAudioManager;
  const testUserId = 'test-user-123';

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create mock audio manager
    mockAudioManager = {
      enableExpressions: vi.fn(),
      setExpressionPack: vi.fn()
    } as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('integrateExpressionsWithVoice with privacy settings', () => {
    it('should respect user privacy settings and disable expressions', async () => {
      // User has disabled expressions
      vi.mocked(UserSettingsService.shouldEnableExpressions).mockResolvedValue(false);

      const result = await integrateExpressionsWithVoice(mockAudioManager, {
        ownerId: testUserId,
        ownerType: 'user',
        userId: testUserId,
        respectPrivacySettings: true
      });

      expect(result.success).toBe(true);
      expect(result.expressionCount).toBe(0);
      expect(result.error).toBe('Expressions disabled by user privacy settings');
      expect(mockAudioManager.enableExpressions).toHaveBeenCalledWith(false);
    });

    it('should proceed with expressions when privacy settings allow', async () => {
      // User allows expressions
      vi.mocked(UserSettingsService.shouldEnableExpressions).mockResolvedValue(true);
      vi.mocked(ExpressionStorageService.listExpressions).mockResolvedValue([]);

      const result = await integrateExpressionsWithVoice(mockAudioManager, {
        ownerId: testUserId,
        ownerType: 'user',
        userId: testUserId,
        respectPrivacySettings: true
      });

      expect(result.success).toBe(true);
      expect(UserSettingsService.shouldEnableExpressions).toHaveBeenCalledWith(testUserId);
    });

    it('should skip privacy check when respectPrivacySettings is false', async () => {
      vi.mocked(ExpressionStorageService.listExpressions).mockResolvedValue([]);

      const result = await integrateExpressionsWithVoice(mockAudioManager, {
        ownerId: testUserId,
        ownerType: 'user',
        respectPrivacySettings: false
      });

      expect(result.success).toBe(true);
      expect(UserSettingsService.shouldEnableExpressions).not.toHaveBeenCalled();
    });

    it('should continue with expressions on privacy check failure', async () => {
      // Privacy check fails
      vi.mocked(UserSettingsService.shouldEnableExpressions).mockRejectedValue(
        new Error('Privacy check failed')
      );
      vi.mocked(ExpressionStorageService.listExpressions).mockResolvedValue([]);

      const result = await integrateExpressionsWithVoice(mockAudioManager, {
        ownerId: testUserId,
        ownerType: 'user',
        userId: testUserId,
        respectPrivacySettings: true
      });

      expect(result.success).toBe(true);
      // Should continue with expressions despite privacy check failure
    });

    it('should not check privacy for avatar expressions without userId', async () => {
      vi.mocked(ExpressionStorageService.listExpressions).mockResolvedValue([]);

      const result = await integrateExpressionsWithVoice(mockAudioManager, {
        ownerId: 'jonathan-demo',
        ownerType: 'avatar',
        respectPrivacySettings: true
        // No userId provided
      });

      expect(result.success).toBe(true);
      expect(UserSettingsService.shouldEnableExpressions).not.toHaveBeenCalled();
    });
  });

  describe('setupUserExpressions', () => {
    it('should automatically respect privacy settings', async () => {
      vi.mocked(UserSettingsService.shouldEnableExpressions).mockResolvedValue(false);

      const result = await setupUserExpressions(mockAudioManager, testUserId);

      expect(result.success).toBe(true);
      expect(result.expressionCount).toBe(0);
      expect(UserSettingsService.shouldEnableExpressions).toHaveBeenCalledWith(testUserId);
      expect(mockAudioManager.enableExpressions).toHaveBeenCalledWith(false);
    });
  });

  describe('checkExpressionsEnabledForUser', () => {
    it('should return user privacy setting', async () => {
      vi.mocked(UserSettingsService.shouldEnableExpressions).mockResolvedValue(true);

      const result = await checkExpressionsEnabledForUser(testUserId);

      expect(result).toBe(true);
      expect(UserSettingsService.shouldEnableExpressions).toHaveBeenCalledWith(testUserId);
    });

    it('should default to enabled on error', async () => {
      vi.mocked(UserSettingsService.shouldEnableExpressions).mockRejectedValue(
        new Error('Settings error')
      );

      const result = await checkExpressionsEnabledForUser(testUserId);

      expect(result).toBe(true);
    });
  });

  describe('session privacy controls', () => {
    it('should disable expressions for user session', async () => {
      vi.mocked(UserSettingsService.disableExpressionsForSession).mockResolvedValue(true);

      const result = await disableExpressionsForUserSession(mockAudioManager, testUserId);

      expect(result).toBe(true);
      expect(mockAudioManager.enableExpressions).toHaveBeenCalledWith(false);
      expect(UserSettingsService.disableExpressionsForSession).toHaveBeenCalledWith(testUserId);
    });

    it('should enable expressions for user session', async () => {
      vi.mocked(UserSettingsService.enableExpressionsForSession).mockResolvedValue(true);

      const result = await enableExpressionsForUserSession(mockAudioManager, testUserId);

      expect(result).toBe(true);
      expect(mockAudioManager.enableExpressions).toHaveBeenCalledWith(true);
      expect(UserSettingsService.enableExpressionsForSession).toHaveBeenCalledWith(testUserId);
    });

    it('should handle session control errors gracefully', async () => {
      vi.mocked(UserSettingsService.disableExpressionsForSession).mockRejectedValue(
        new Error('Session error')
      );

      const result = await disableExpressionsForUserSession(mockAudioManager, testUserId);

      expect(result).toBe(false);
      // Should still disable in audio manager immediately
      expect(mockAudioManager.enableExpressions).toHaveBeenCalledWith(false);
    });
  });

  describe('graceful degradation scenarios', () => {
    it('should handle mid-conversation privacy changes', async () => {
      // Start with expressions enabled
      vi.mocked(UserSettingsService.shouldEnableExpressions).mockResolvedValue(true);
      vi.mocked(ExpressionStorageService.listExpressions).mockResolvedValue([
        {
          id: 'expr-1',
          type: 'laugh',
          cdnUrl: 'https://cdn.example.com/laugh.mp3',
          durationMs: 1000,
          priority: 1
        } as any
      ]);

      // Initial setup
      const result = await integrateExpressionsWithVoice(mockAudioManager, {
        ownerId: testUserId,
        ownerType: 'user',
        userId: testUserId
      });

      expect(result.success).toBe(true);
      expect(result.expressionCount).toBe(1);

      // Mock the disable session call
      vi.mocked(UserSettingsService.disableExpressionsForSession).mockResolvedValue(true);

      // Mid-conversation disable
      const disableResult = await disableExpressionsForUserSession(mockAudioManager, testUserId);
      expect(disableResult).toBe(true);
      expect(mockAudioManager.enableExpressions).toHaveBeenLastCalledWith(false);
    });

    it('should maintain TTS functionality when expressions fail', async () => {
      // Expression loading fails
      vi.mocked(UserSettingsService.shouldEnableExpressions).mockResolvedValue(true);
      vi.mocked(ExpressionStorageService.listExpressions).mockRejectedValue(
        new Error('Expression loading failed')
      );

      const result = await integrateExpressionsWithVoice(mockAudioManager, {
        ownerId: testUserId,
        ownerType: 'user',
        userId: testUserId
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Expression loading failed');
      // Should disable expressions but not break the audio manager
      expect(mockAudioManager.enableExpressions).toHaveBeenCalledWith(false);
    });
  });
});