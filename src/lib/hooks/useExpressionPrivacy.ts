/**
 * useExpressionPrivacy Hook
 * 
 * React hook for managing user expression privacy settings.
 * Provides easy access to privacy controls and real-time updates.
 * 
 * Requirements: 6.1, 6.5
 */

import { useState, useEffect, useCallback } from 'react';
import { UserSettingsService, ExpressionPrivacySettings } from '../services/userSettingsService';
import { useAuth } from '../auth';

interface UseExpressionPrivacyReturn {
  /** Current expression privacy settings */
  settings: ExpressionPrivacySettings | null;
  /** Whether settings are currently loading */
  isLoading: boolean;
  /** Any error that occurred */
  error: string | null;
  /** Whether expressions are currently enabled (considering all factors) */
  expressionsEnabled: boolean;
  /** Enable/disable expressions globally */
  setExpressionsEnabled: (enabled: boolean) => Promise<boolean>;
  /** Disable expressions for current session only */
  disableForSession: () => Promise<boolean>;
  /** Re-enable expressions for current session */
  enableForSession: () => Promise<boolean>;
  /** Update specific expression settings */
  updateSettings: (settings: Partial<ExpressionPrivacySettings>) => Promise<boolean>;
  /** Refresh settings from server */
  refresh: () => Promise<void>;
}

/**
 * Hook for managing expression privacy settings
 */
export function useExpressionPrivacy(): UseExpressionPrivacyReturn {
  const { user } = useAuth();
  const [settings, setSettings] = useState<ExpressionPrivacySettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load settings from server
   */
  const loadSettings = useCallback(async () => {
    if (!user?.id) {
      setSettings(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const userSettings = await UserSettingsService.getExpressionSettings(user.id);
      setSettings(userSettings);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load settings';
      setError(errorMessage);
      console.error('Failed to load expression privacy settings:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  /**
   * Update settings on server and local state
   */
  const updateSettingsInternal = useCallback(async (
    newSettings: Partial<ExpressionPrivacySettings>
  ): Promise<boolean> => {
    if (!user?.id || !settings) {
      return false;
    }

    try {
      const success = await UserSettingsService.updateExpressionSettings(user.id, newSettings);
      
      if (success) {
        // Update local state
        setSettings(prev => prev ? { ...prev, ...newSettings } : null);
      }
      
      return success;
    } catch (err) {
      console.error('Failed to update expression settings:', err);
      return false;
    }
  }, [user?.id, settings]);

  /**
   * Enable or disable expressions globally
   */
  const setExpressionsEnabled = useCallback(async (enabled: boolean): Promise<boolean> => {
    if (!user?.id) return false;
    
    try {
      const success = await UserSettingsService.setExpressionsEnabled(user.id, enabled);
      
      if (success) {
        setSettings(prev => prev ? {
          ...prev,
          expressionsEnabled: enabled,
          sessionDisabled: false,
          sessionDisabledAt: undefined
        } : null);
      }
      
      return success;
    } catch (err) {
      console.error('Failed to set expressions enabled:', err);
      return false;
    }
  }, [user?.id]);

  /**
   * Disable expressions for current session only
   */
  const disableForSession = useCallback(async (): Promise<boolean> => {
    if (!user?.id) return false;
    
    try {
      const success = await UserSettingsService.disableExpressionsForSession(user.id);
      
      if (success) {
        setSettings(prev => prev ? {
          ...prev,
          sessionDisabled: true,
          sessionDisabledAt: Date.now()
        } : null);
      }
      
      return success;
    } catch (err) {
      console.error('Failed to disable expressions for session:', err);
      return false;
    }
  }, [user?.id]);

  /**
   * Re-enable expressions for current session
   */
  const enableForSession = useCallback(async (): Promise<boolean> => {
    if (!user?.id) return false;
    
    try {
      const success = await UserSettingsService.enableExpressionsForSession(user.id);
      
      if (success) {
        setSettings(prev => prev ? {
          ...prev,
          sessionDisabled: false,
          sessionDisabledAt: undefined
        } : null);
      }
      
      return success;
    } catch (err) {
      console.error('Failed to enable expressions for session:', err);
      return false;
    }
  }, [user?.id]);

  /**
   * Calculate if expressions should be enabled
   */
  const expressionsEnabled = (() => {
    if (!settings) return false;
    
    // If globally disabled, always false
    if (!settings.expressionsEnabled) return false;
    
    // If session disabled, check if it's still valid
    if (settings.sessionDisabled) {
      const disabledAt = settings.sessionDisabledAt || 0;
      const now = Date.now();
      const twentyFourHours = 24 * 60 * 60 * 1000;
      
      // If session disable is older than 24 hours, it should be cleared
      if (now - disabledAt > twentyFourHours) {
        // Auto-clear expired session disable
        enableForSession();
        return true;
      }
      
      return false;
    }
    
    return true;
  })();

  /**
   * Load settings on mount and when user changes
   */
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  return {
    settings,
    isLoading,
    error,
    expressionsEnabled,
    setExpressionsEnabled,
    disableForSession,
    enableForSession,
    updateSettings: updateSettingsInternal,
    refresh: loadSettings
  };
}

/**
 * Simple hook to just check if expressions are enabled for a user
 */
export function useExpressionsEnabled(): boolean {
  const { expressionsEnabled } = useExpressionPrivacy();
  return expressionsEnabled;
}