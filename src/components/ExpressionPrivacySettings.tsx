/**
 * Expression Privacy Settings Component
 * 
 * Provides user interface for managing expression privacy and overlay preferences.
 * Allows users to disable expressions globally or for the current session.
 * 
 * Requirements: 6.1, 6.5
 */

'use client';

import React, { useState } from 'react';
import { useExpressionPrivacy } from '../lib/hooks/useExpressionPrivacy';
import { useFeatureFlag } from '../lib/featureFlags';
import styles from './ExpressionPrivacySettings.module.css';

interface ExpressionPrivacySettingsProps {
  /** Whether to show as a compact inline control */
  compact?: boolean;
  /** Callback when settings change */
  onSettingsChange?: (enabled: boolean) => void;
}

export function ExpressionPrivacySettings({ 
  compact = false, 
  onSettingsChange 
}: ExpressionPrivacySettingsProps) {
  const isFeatureEnabled = useFeatureFlag('VOICE_OVERLAYS');
  const {
    settings,
    isLoading,
    error,
    expressionsEnabled,
    setExpressionsEnabled,
    disableForSession,
    enableForSession,
    updateSettings
  } = useExpressionPrivacy();

  const [isUpdating, setIsUpdating] = useState(false);

  // Don't render if feature is disabled
  if (!isFeatureEnabled) {
    return null;
  }

  const handleGlobalToggle = async (enabled: boolean) => {
    setIsUpdating(true);
    try {
      const success = await setExpressionsEnabled(enabled);
      if (success && onSettingsChange) {
        onSettingsChange(enabled);
      }
    } catch (error) {
      console.error('Failed to update global expression setting:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSessionToggle = async () => {
    setIsUpdating(true);
    try {
      let success: boolean;
      if (settings?.sessionDisabled) {
        success = await enableForSession();
      } else {
        success = await disableForSession();
      }
      
      if (success && onSettingsChange) {
        onSettingsChange(!settings?.sessionDisabled);
      }
    } catch (error) {
      console.error('Failed to update session expression setting:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleMaxExpressionsChange = async (maxExpressions: number) => {
    if (!settings) return;
    
    setIsUpdating(true);
    try {
      await updateSettings({ maxExpressionsPerTurn: maxExpressions });
    } catch (error) {
      console.error('Failed to update max expressions setting:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className={compact ? styles.compactContainer : styles.container}>
        <div className={styles.loading}>Loading privacy settings...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={compact ? styles.compactContainer : styles.container}>
        <div className={styles.error}>Failed to load privacy settings: {error}</div>
      </div>
    );
  }

  if (!settings) {
    return null;
  }

  if (compact) {
    return (
      <div className={styles.compactContainer}>
        <label className={styles.compactToggle}>
          <input
            type="checkbox"
            checked={expressionsEnabled}
            onChange={(e) => {
              if (settings.expressionsEnabled) {
                // If globally enabled, toggle session setting
                handleSessionToggle();
              } else {
                // If globally disabled, enable globally
                handleGlobalToggle(true);
              }
            }}
            disabled={isUpdating}
          />
          <span className={styles.compactLabel}>
            Voice expressions {expressionsEnabled ? 'on' : 'off'}
          </span>
        </label>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Expression Privacy Settings</h3>
        <p className={styles.description}>
          Control when authentic voice expressions (laughs, sighs, etc.) are played during conversations.
        </p>
      </div>

      <div className={styles.settingGroup}>
        <div className={styles.setting}>
          <label className={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={settings.expressionsEnabled}
              onChange={(e) => handleGlobalToggle(e.target.checked)}
              disabled={isUpdating}
              className={styles.toggle}
            />
            <span className={styles.toggleSlider}></span>
            <div className={styles.settingInfo}>
              <div className={styles.settingTitle}>Enable Voice Expressions</div>
              <div className={styles.settingDescription}>
                Allow authentic voice expressions to be played during conversations
              </div>
            </div>
          </label>
        </div>

        {settings.expressionsEnabled && (
          <>
            <div className={styles.setting}>
              <label className={styles.toggleLabel}>
                <input
                  type="checkbox"
                  checked={!settings.sessionDisabled}
                  onChange={handleSessionToggle}
                  disabled={isUpdating}
                  className={styles.toggle}
                />
                <span className={styles.toggleSlider}></span>
                <div className={styles.settingInfo}>
                  <div className={styles.settingTitle}>Enable for This Session</div>
                  <div className={styles.settingDescription}>
                    Temporarily disable expressions for this session only
                  </div>
                </div>
              </label>
            </div>

            <div className={styles.setting}>
              <div className={styles.settingInfo}>
                <div className={styles.settingTitle}>Maximum Expressions per Turn</div>
                <div className={styles.settingDescription}>
                  Limit how many expressions can play during each conversation turn
                </div>
              </div>
              <select
                value={settings.maxExpressionsPerTurn || 2}
                onChange={(e) => handleMaxExpressionsChange(parseInt(e.target.value))}
                disabled={isUpdating}
                className={styles.select}
              >
                <option value={0}>None</option>
                <option value={1}>1 expression</option>
                <option value={2}>2 expressions</option>
                <option value={3}>3 expressions</option>
              </select>
            </div>
          </>
        )}
      </div>

      {settings.sessionDisabled && settings.sessionDisabledAt && (
        <div className={styles.sessionInfo}>
          <div className={styles.sessionStatus}>
            Expressions disabled for this session
          </div>
          <div className={styles.sessionTime}>
            Disabled {new Date(settings.sessionDisabledAt).toLocaleTimeString()}
          </div>
        </div>
      )}

      <div className={styles.footer}>
        <div className={styles.footerText}>
          Current status: <strong>{expressionsEnabled ? 'Enabled' : 'Disabled'}</strong>
        </div>
      </div>
    </div>
  );
}