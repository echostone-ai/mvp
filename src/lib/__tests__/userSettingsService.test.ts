/**
 * User Settings Service Tests
 * 
 * Tests for user privacy settings and expression controls.
 * 
 * Requirements: 6.1, 6.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UserSettingsService, ExpressionPrivacySettings } from '../services/userSettingsService';

// Get mocks from the module
const { __mocks } = await import('../supabase') as any;
const { mockSingle, mockEq, mockSelect, mockUpdateEq, mockUpdate, mockFrom } = __mocks;

// Mock Supabase
vi.mock('../supabase', () => {
  const mockSingle = vi.fn();
  const mockEq = vi.fn(() => ({ single: mockSingle }));
  const mockSelect = vi.fn(() => ({ eq: mockEq }));
  const mockUpdateEq = vi.fn();
  const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }));
  const mockFrom = vi.fn(() => ({
    select: mockSelect,
    update: mockUpdate
  }));

  return {
    supabase: {
      from: mockFrom
    },
    // Export mocks for test access
    __mocks: {
      mockSingle,
      mockEq,
      mockSelect,
      mockUpdateEq,
      mockUpdate,
      mockFrom
    }
  };
});

describe('UserSettingsService', () => {
  const testUserId = 'test-user-123';
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getUserSettings', () => {
    it('should return default settings when no profile data exists', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: null
      });

      const settings = await UserSettingsService.getUserSettings(testUserId);

      expect(settings.expressions).toEqual({
        expressionsEnabled: true,
        sessionDisabled: false,
        maxExpressionsPerTurn: 2
      });
    });

    it('should merge existing settings with defaults', async () => {
      const existingData = {
        expressions: {
          expressionsEnabled: false,
          sessionDisabled: true
        },
        otherSetting: 'value'
      };

      mockSingle.mockResolvedValue({
        data: { profile_data: existingData },
        error: null
      });

      const settings = await UserSettingsService.getUserSettings(testUserId);

      expect(settings.expressions).toEqual({
        expressionsEnabled: false,
        sessionDisabled: true,
        maxExpressionsPerTurn: 2 // Default value merged in
      });
      expect(settings.otherSetting).toBe('value');
    });

    it('should handle database errors gracefully', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      const settings = await UserSettingsService.getUserSettings(testUserId);

      expect(settings.expressions).toEqual({
        expressionsEnabled: true,
        sessionDisabled: false,
        maxExpressionsPerTurn: 2
      });
    });
  });

  describe('updateUserSettings', () => {
    it('should merge new settings with existing ones', async () => {
      // Mock getting current settings
      const currentSettings = {
        expressions: {
          expressionsEnabled: true,
          sessionDisabled: false,
          maxExpressionsPerTurn: 2
        }
      };

      mockSingle.mockResolvedValue({
        data: { profile_data: currentSettings },
        error: null
      });

      // Mock update
      mockUpdateEq.mockResolvedValue({
        error: null
      });

      const newSettings = {
        expressions: {
          expressionsEnabled: false
        }
      };

      const success = await UserSettingsService.updateUserSettings(testUserId, newSettings);

      expect(success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith({
        profile_data: {
          expressions: {
            expressionsEnabled: false,
            sessionDisabled: false,
            maxExpressionsPerTurn: 2
          }
        },
        updated_at: expect.any(String)
      });
    });

    it('should handle update errors', async () => {
      mockSingle.mockResolvedValue({
        data: { profile_data: {} },
        error: null
      });

      mockUpdateEq.mockResolvedValue({
        error: { message: 'Update failed' }
      });

      const success = await UserSettingsService.updateUserSettings(testUserId, {});

      expect(success).toBe(false);
    });
  });

  describe('setExpressionsEnabled', () => {
    it('should enable expressions and clear session disable', async () => {
      mockSingle.mockResolvedValue({
        data: { profile_data: {} },
        error: null
      });

      mockUpdateEq.mockResolvedValue({
        error: null
      });

      const success = await UserSettingsService.setExpressionsEnabled(testUserId, true);

      expect(success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith({
        profile_data: {
          expressions: {
            expressionsEnabled: true,
            sessionDisabled: false,
            sessionDisabledAt: undefined,
            maxExpressionsPerTurn: 2
          }
        },
        updated_at: expect.any(String)
      });
    });
  });

  describe('disableExpressionsForSession', () => {
    it('should set session disabled with timestamp', async () => {
      const mockNow = 1234567890;
      vi.spyOn(Date, 'now').mockReturnValue(mockNow);

      mockSingle.mockResolvedValue({
        data: { profile_data: {} },
        error: null
      });

      mockUpdateEq.mockResolvedValue({
        error: null
      });

      const success = await UserSettingsService.disableExpressionsForSession(testUserId);

      expect(success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith({
        profile_data: {
          expressions: {
            expressionsEnabled: true,
            sessionDisabled: true,
            sessionDisabledAt: mockNow,
            maxExpressionsPerTurn: 2
          }
        },
        updated_at: expect.any(String)
      });
    });
  });

  describe('shouldEnableExpressions', () => {
    it('should return false when globally disabled', async () => {
      mockSingle.mockResolvedValue({
        data: {
          profile_data: {
            expressions: {
              expressionsEnabled: false,
              sessionDisabled: false
            }
          }
        },
        error: null
      });

      const result = await UserSettingsService.shouldEnableExpressions(testUserId);

      expect(result).toBe(false);
    });

    it('should return false when session disabled within 24 hours', async () => {
      const now = Date.now();
      const oneHourAgo = now - (60 * 60 * 1000);

      mockSingle.mockResolvedValue({
        data: {
          profile_data: {
            expressions: {
              expressionsEnabled: true,
              sessionDisabled: true,
              sessionDisabledAt: oneHourAgo
            }
          }
        },
        error: null
      });

      const result = await UserSettingsService.shouldEnableExpressions(testUserId);

      expect(result).toBe(false);
    });

    it('should return true and clear expired session disable', async () => {
      const now = Date.now();
      const twentyFiveHoursAgo = now - (25 * 60 * 60 * 1000);

      mockSingle.mockResolvedValue({
        data: {
          profile_data: {
            expressions: {
              expressionsEnabled: true,
              sessionDisabled: true,
              sessionDisabledAt: twentyFiveHoursAgo
            }
          }
        },
        error: null
      });

      mockUpdateEq.mockResolvedValue({
        error: null
      });

      const result = await UserSettingsService.shouldEnableExpressions(testUserId);

      expect(result).toBe(true);
      // Should have called enableExpressionsForSession to clear the expired disable
      expect(mockUpdate).toHaveBeenCalled();
    });

    it('should return true when enabled and not session disabled', async () => {
      mockSingle.mockResolvedValue({
        data: {
          profile_data: {
            expressions: {
              expressionsEnabled: true,
              sessionDisabled: false
            }
          }
        },
        error: null
      });

      const result = await UserSettingsService.shouldEnableExpressions(testUserId);

      expect(result).toBe(true);
    });

    it('should default to enabled on error', async () => {
      mockSingle.mockRejectedValue(new Error('Database error'));

      const result = await UserSettingsService.shouldEnableExpressions(testUserId);

      expect(result).toBe(true);
    });
  });
});