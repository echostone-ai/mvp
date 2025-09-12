/**
 * User Settings Service
 * 
 * Manages user privacy settings and preferences for expression overlays.
 * Stores settings in the user's profile data JSONB column.
 * 
 * Requirements: 6.1, 6.5
 */

import { supabase } from '../supabase';

export interface ExpressionPrivacySettings {
  /** Whether expression overlays are enabled globally for the user */
  expressionsEnabled: boolean;
  /** Whether to disable expressions for the current session only */
  sessionDisabled: boolean;
  /** Timestamp when session disable was set (for cleanup) */
  sessionDisabledAt?: number;
  /** User preference for expression types to disable */
  disabledTypes?: string[];
  /** Maximum number of expressions per conversation turn */
  maxExpressionsPerTurn?: number;
}

export interface UserSettings {
  /** Expression privacy and overlay settings */
  expressions?: ExpressionPrivacySettings;
  /** Other user settings can be added here */
  [key: string]: any;
}

const DEFAULT_EXPRESSION_SETTINGS: ExpressionPrivacySettings = {
  expressionsEnabled: true,
  sessionDisabled: false,
  maxExpressionsPerTurn: 2
};

export class UserSettingsService {
  /**
   * Get user settings from their profile
   */
  static async getUserSettings(userId: string): Promise<UserSettings> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('profile_data')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.warn('Failed to load user settings:', error);
        return { expressions: DEFAULT_EXPRESSION_SETTINGS };
      }

      const profileData = data?.profile_data || {};
      
      // Ensure expressions settings exist with defaults
      const settings: UserSettings = {
        ...profileData,
        expressions: {
          ...DEFAULT_EXPRESSION_SETTINGS,
          ...profileData.expressions
        }
      };

      return settings;
    } catch (error) {
      console.warn('Error loading user settings:', error);
      return { expressions: DEFAULT_EXPRESSION_SETTINGS };
    }
  }

  /**
   * Update user settings in their profile
   */
  static async updateUserSettings(userId: string, settings: Partial<UserSettings>): Promise<boolean> {
    try {
      // Get current settings first
      const currentSettings = await this.getUserSettings(userId);
      
      // Merge with new settings
      const updatedSettings = {
        ...currentSettings,
        ...settings,
        expressions: {
          ...currentSettings.expressions,
          ...settings.expressions
        }
      };

      const { error } = await supabase
        .from('profiles')
        .update({ 
          profile_data: updatedSettings,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (error) {
        console.error('Failed to update user settings:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error updating user settings:', error);
      return false;
    }
  }

  /**
   * Get expression privacy settings for a user
   */
  static async getExpressionSettings(userId: string): Promise<ExpressionPrivacySettings> {
    const settings = await this.getUserSettings(userId);
    return settings.expressions || DEFAULT_EXPRESSION_SETTINGS;
  }

  /**
   * Update expression privacy settings for a user
   */
  static async updateExpressionSettings(
    userId: string, 
    expressionSettings: Partial<ExpressionPrivacySettings>
  ): Promise<boolean> {
    return this.updateUserSettings(userId, { expressions: expressionSettings });
  }

  /**
   * Enable or disable expressions globally for a user
   */
  static async setExpressionsEnabled(userId: string, enabled: boolean): Promise<boolean> {
    return this.updateExpressionSettings(userId, { 
      expressionsEnabled: enabled,
      // Clear session disable when globally enabling/disabling
      sessionDisabled: false,
      sessionDisabledAt: undefined
    });
  }

  /**
   * Disable expressions for the current session only
   */
  static async disableExpressionsForSession(userId: string): Promise<boolean> {
    return this.updateExpressionSettings(userId, {
      sessionDisabled: true,
      sessionDisabledAt: Date.now()
    });
  }

  /**
   * Re-enable expressions for the current session
   */
  static async enableExpressionsForSession(userId: string): Promise<boolean> {
    return this.updateExpressionSettings(userId, {
      sessionDisabled: false,
      sessionDisabledAt: undefined
    });
  }

  /**
   * Check if expressions should be enabled for a user
   * Takes into account both global and session settings
   */
  static async shouldEnableExpressions(userId: string): Promise<boolean> {
    try {
      const settings = await this.getExpressionSettings(userId);
      
      // If globally disabled, always return false
      if (!settings.expressionsEnabled) {
        return false;
      }

      // If session disabled, check if it's still valid (within 24 hours)
      if (settings.sessionDisabled) {
        const disabledAt = settings.sessionDisabledAt || 0;
        const now = Date.now();
        const twentyFourHours = 24 * 60 * 60 * 1000;
        
        // If session disable is older than 24 hours, clear it
        if (now - disabledAt > twentyFourHours) {
          await this.enableExpressionsForSession(userId);
          return true;
        }
        
        return false;
      }

      return true;
    } catch (error) {
      console.warn('Error checking expression settings, defaulting to enabled:', error);
      return true; // Default to enabled on error for graceful degradation
    }
  }

  /**
   * Clear expired session disables for cleanup
   * Should be called periodically or on app startup
   */
  static async cleanupExpiredSessionDisables(): Promise<void> {
    try {
      // This would need to be implemented as a database function or batch job
      // For now, we handle it in shouldEnableExpressions
      console.log('Session disable cleanup would run here');
    } catch (error) {
      console.warn('Error during session disable cleanup:', error);
    }
  }
}