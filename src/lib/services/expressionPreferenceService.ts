/**
 * Expression Preference Service
 * 
 * Manages user preferences for expression frequency, types, and adaptive learning settings.
 * Integrates with Supabase for persistence and provides real-time preference updates.
 */

import { supabase } from '../supabase';
import { ExpressionType } from './expressionStorageService';
import { logger } from '../logger';

export interface ExpressionPreferences {
  userId: string;
  expressionFrequency: 'low' | 'medium' | 'high';
  preferredTypes: ExpressionType[];
  dislikedTypes: ExpressionType[];
  adaptiveSettings: {
    learningEnabled: boolean;
    feedbackWeight: number; // 0-1, how much to weight user feedback
    contextWeight: number; // 0-1, how much to weight conversation context
    emotionalSensitivity: number; // 0-1, how much to adapt to emotional state
  };
  privacySettings: {
    shareUsageData: boolean;
    allowPersonalization: boolean;
    retainLearningData: boolean;
  };
  lastUpdated: Date;
  version: number; // For optimistic locking
}

export interface PreferenceUpdateRequest {
  expressionFrequency?: 'low' | 'medium' | 'high';
  preferredTypes?: ExpressionType[];
  dislikedTypes?: ExpressionType[];
  adaptiveSettings?: Partial<ExpressionPreferences['adaptiveSettings']>;
  privacySettings?: Partial<ExpressionPreferences['privacySettings']>;
}

export interface PreferenceAnalytics {
  totalUsers: number;
  frequencyDistribution: Record<'low' | 'medium' | 'high', number>;
  popularExpressionTypes: Array<{ type: ExpressionType; count: number }>;
  adaptiveLearningAdoption: number;
  averageCustomization: number;
}

/**
 * Service for managing user expression preferences
 */
export class ExpressionPreferenceService {
  private cache: Map<string, ExpressionPreferences> = new Map();
  private readonly CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
  private cacheTimestamps: Map<string, number> = new Map();

  /**
   * Get user preferences with caching
   */
  async getUserPreferences(userId: string): Promise<ExpressionPreferences> {
    try {
      // Check cache first
      const cached = this.getCachedPreferences(userId);
      if (cached) {
        return cached;
      }

      // Load from database
      const { data, error } = await supabase
        .from('user_profiles')
        .select('expression_preferences')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found is OK
        throw error;
      }

      let preferences: ExpressionPreferences;

      if (data?.expression_preferences) {
        // Parse existing preferences
        preferences = {
          ...data.expression_preferences,
          lastUpdated: new Date(data.expression_preferences.lastUpdated),
          userId
        };
      } else {
        // Create default preferences
        preferences = this.createDefaultPreferences(userId);
        await this.savePreferences(preferences);
      }

      // Cache the result
      this.setCachedPreferences(userId, preferences);

      return preferences;

    } catch (error) {
      logger.error('Error loading user preferences', { error, userId });
      
      // Return defaults on error
      return this.createDefaultPreferences(userId);
    }
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(
    userId: string,
    updates: PreferenceUpdateRequest
  ): Promise<ExpressionPreferences> {
    try {
      // Get current preferences
      const current = await this.getUserPreferences(userId);

      // Apply updates
      const updated: ExpressionPreferences = {
        ...current,
        ...updates,
        adaptiveSettings: {
          ...current.adaptiveSettings,
          ...(updates.adaptiveSettings || {})
        },
        privacySettings: {
          ...current.privacySettings,
          ...(updates.privacySettings || {})
        },
        lastUpdated: new Date(),
        version: current.version + 1
      };

      // Validate preferences
      this.validatePreferences(updated);

      // Save to database
      await this.savePreferences(updated);

      // Update cache
      this.setCachedPreferences(userId, updated);

      logger.info('Updated user expression preferences', {
        userId,
        changes: Object.keys(updates),
        version: updated.version
      });

      return updated;

    } catch (error) {
      logger.error('Error updating user preferences', { error, userId, updates });
      throw error;
    }
  }

  /**
   * Record implicit preference learning from user behavior
   */
  async recordImplicitPreference(
    userId: string,
    expressionType: ExpressionType,
    reaction: 'positive' | 'negative' | 'neutral',
    context: {
      emotionalTone?: string;
      conversationType?: string;
      sessionDuration?: number;
    }
  ): Promise<void> {
    try {
      const preferences = await this.getUserPreferences(userId);

      // Only update if adaptive learning is enabled
      if (!preferences.adaptiveSettings.learningEnabled) {
        return;
      }

      let updated = false;

      if (reaction === 'positive') {
        // Add to preferred types if not already there and not in disliked
        if (!preferences.preferredTypes.includes(expressionType) && 
            !preferences.dislikedTypes.includes(expressionType)) {
          preferences.preferredTypes.push(expressionType);
          updated = true;
        }
        
        // Remove from disliked if it was there
        const dislikedIndex = preferences.dislikedTypes.indexOf(expressionType);
        if (dislikedIndex > -1) {
          preferences.dislikedTypes.splice(dislikedIndex, 1);
          updated = true;
        }

      } else if (reaction === 'negative') {
        // Add to disliked types if not already there
        if (!preferences.dislikedTypes.includes(expressionType)) {
          preferences.dislikedTypes.push(expressionType);
          updated = true;
        }
        
        // Remove from preferred if it was there
        const preferredIndex = preferences.preferredTypes.indexOf(expressionType);
        if (preferredIndex > -1) {
          preferences.preferredTypes.splice(preferredIndex, 1);
          updated = true;
        }
      }

      if (updated) {
        preferences.lastUpdated = new Date();
        preferences.version++;
        
        await this.savePreferences(preferences);
        this.setCachedPreferences(userId, preferences);

        logger.debug('Recorded implicit preference', {
          userId,
          expressionType,
          reaction,
          context
        });
      }

    } catch (error) {
      logger.error('Error recording implicit preference', {
        error,
        userId,
        expressionType,
        reaction
      });
    }
  }

  /**
   * Get preference analytics (aggregated, anonymized data)
   */
  async getPreferenceAnalytics(): Promise<PreferenceAnalytics> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('expression_preferences')
        .not('expression_preferences', 'is', null);

      if (error) throw error;

      const preferences = data
        .map(row => row.expression_preferences)
        .filter(Boolean) as ExpressionPreferences[];

      // Calculate analytics
      const frequencyDistribution = { low: 0, medium: 0, high: 0 };
      const typeCount: Record<string, number> = {};
      let adaptiveLearningCount = 0;
      let totalCustomizations = 0;

      preferences.forEach(pref => {
        // Frequency distribution
        frequencyDistribution[pref.expressionFrequency]++;

        // Expression type popularity
        pref.preferredTypes.forEach(type => {
          typeCount[type] = (typeCount[type] || 0) + 1;
        });

        // Adaptive learning adoption
        if (pref.adaptiveSettings.learningEnabled) {
          adaptiveLearningCount++;
        }

        // Customization level
        const customizations = pref.preferredTypes.length + pref.dislikedTypes.length;
        if (customizations > 0) {
          totalCustomizations++;
        }
      });

      const popularExpressionTypes = Object.entries(typeCount)
        .map(([type, count]) => ({ type: type as ExpressionType, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        totalUsers: preferences.length,
        frequencyDistribution,
        popularExpressionTypes,
        adaptiveLearningAdoption: preferences.length > 0 ? adaptiveLearningCount / preferences.length : 0,
        averageCustomization: preferences.length > 0 ? totalCustomizations / preferences.length : 0
      };

    } catch (error) {
      logger.error('Error getting preference analytics', { error });
      
      // Return empty analytics on error
      return {
        totalUsers: 0,
        frequencyDistribution: { low: 0, medium: 0, high: 0 },
        popularExpressionTypes: [],
        adaptiveLearningAdoption: 0,
        averageCustomization: 0
      };
    }
  }

  /**
   * Reset user preferences to defaults
   */
  async resetUserPreferences(userId: string): Promise<ExpressionPreferences> {
    try {
      const defaultPrefs = this.createDefaultPreferences(userId);
      await this.savePreferences(defaultPrefs);
      
      // Clear cache
      this.cache.delete(userId);
      this.cacheTimestamps.delete(userId);

      logger.info('Reset user preferences to defaults', { userId });

      return defaultPrefs;

    } catch (error) {
      logger.error('Error resetting user preferences', { error, userId });
      throw error;
    }
  }

  /**
   * Delete user preferences (for GDPR compliance)
   */
  async deleteUserPreferences(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ expression_preferences: null })
        .eq('user_id', userId);

      if (error) throw error;

      // Clear cache
      this.cache.delete(userId);
      this.cacheTimestamps.delete(userId);

      logger.info('Deleted user preferences', { userId });

    } catch (error) {
      logger.error('Error deleting user preferences', { error, userId });
      throw error;
    }
  }

  /**
   * Export user preferences (for GDPR compliance)
   */
  async exportUserPreferences(userId: string): Promise<ExpressionPreferences> {
    return await this.getUserPreferences(userId);
  }

  /**
   * Private helper methods
   */

  private createDefaultPreferences(userId: string): ExpressionPreferences {
    return {
      userId,
      expressionFrequency: 'medium',
      preferredTypes: [],
      dislikedTypes: [],
      adaptiveSettings: {
        learningEnabled: true,
        feedbackWeight: 0.7,
        contextWeight: 0.8,
        emotionalSensitivity: 0.6
      },
      privacySettings: {
        shareUsageData: false,
        allowPersonalization: true,
        retainLearningData: true
      },
      lastUpdated: new Date(),
      version: 1
    };
  }

  private async savePreferences(preferences: ExpressionPreferences): Promise<void> {
    const { error } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: preferences.userId,
        expression_preferences: {
          ...preferences,
          lastUpdated: preferences.lastUpdated.toISOString()
        }
      }, {
        onConflict: 'user_id'
      });

    if (error) {
      throw error;
    }
  }

  private validatePreferences(preferences: ExpressionPreferences): void {
    // Validate frequency
    if (!['low', 'medium', 'high'].includes(preferences.expressionFrequency)) {
      throw new Error('Invalid expression frequency');
    }

    // Validate adaptive settings ranges
    const { adaptiveSettings } = preferences;
    if (adaptiveSettings.feedbackWeight < 0 || adaptiveSettings.feedbackWeight > 1) {
      throw new Error('Feedback weight must be between 0 and 1');
    }
    if (adaptiveSettings.contextWeight < 0 || adaptiveSettings.contextWeight > 1) {
      throw new Error('Context weight must be between 0 and 1');
    }
    if (adaptiveSettings.emotionalSensitivity < 0 || adaptiveSettings.emotionalSensitivity > 1) {
      throw new Error('Emotional sensitivity must be between 0 and 1');
    }

    // Validate no overlap between preferred and disliked types
    const overlap = preferences.preferredTypes.filter(type => 
      preferences.dislikedTypes.includes(type)
    );
    if (overlap.length > 0) {
      throw new Error(`Expression types cannot be both preferred and disliked: ${overlap.join(', ')}`);
    }
  }

  private getCachedPreferences(userId: string): ExpressionPreferences | null {
    const cached = this.cache.get(userId);
    const timestamp = this.cacheTimestamps.get(userId);

    if (cached && timestamp && (Date.now() - timestamp) < this.CACHE_TTL_MS) {
      return cached;
    }

    // Clean up expired cache
    this.cache.delete(userId);
    this.cacheTimestamps.delete(userId);
    
    return null;
  }

  private setCachedPreferences(userId: string, preferences: ExpressionPreferences): void {
    this.cache.set(userId, preferences);
    this.cacheTimestamps.set(userId, Date.now());
  }

  /**
   * Clean up expired cache entries
   */
  cleanupCache(): void {
    const now = Date.now();
    const toRemove: string[] = [];

    this.cacheTimestamps.forEach((timestamp, userId) => {
      if (now - timestamp > this.CACHE_TTL_MS) {
        toRemove.push(userId);
      }
    });

    toRemove.forEach(userId => {
      this.cache.delete(userId);
      this.cacheTimestamps.delete(userId);
    });

    if (toRemove.length > 0) {
      logger.debug('Cleaned up expired preference cache entries', { count: toRemove.length });
    }
  }
}

// Export singleton instance
export const expressionPreferenceService = new ExpressionPreferenceService();