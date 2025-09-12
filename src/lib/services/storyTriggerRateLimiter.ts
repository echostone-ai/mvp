/**
 * Story Trigger Rate Limiter
 * Implements rate limiting for story triggers: 5 triggers per session per 10 minutes
 * Prevents story spam while maintaining natural conversation flow
 */

interface TriggerRecord {
  count: number;
  resetAt: number;
  triggers: number[]; // Timestamps of individual triggers
}

// In-memory storage for trigger records
// In production, this would use Redis or similar distributed cache
const triggerRecords: Record<string, TriggerRecord> = {};

export interface StoryTriggerRateLimiterConfig {
  maxTriggersPerWindow: number; // Default: 5
  windowMs: number; // Default: 10 minutes (600,000ms)
  cleanupIntervalMs: number; // How often to clean expired records
}

export interface TriggerRateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  windowMs: number;
  reason?: string;
}

export class StoryTriggerRateLimiter {
  private config: StoryTriggerRateLimiterConfig;
  private lastCleanup: number = 0;

  constructor(config: Partial<StoryTriggerRateLimiterConfig> = {}) {
    this.config = {
      maxTriggersPerWindow: config.maxTriggersPerWindow || 5,
      windowMs: config.windowMs || 10 * 60 * 1000, // 10 minutes
      cleanupIntervalMs: config.cleanupIntervalMs || 60 * 1000, // 1 minute
    };
  }

  /**
   * Check if a story trigger is allowed for the given session
   * @param sessionId Unique session identifier (could be user ID, session token, etc.)
   * @returns Result indicating if trigger is allowed and remaining quota
   */
  checkTrigger(sessionId: string): TriggerRateLimitResult {
    const now = Date.now();
    
    // Periodic cleanup of expired records
    this.cleanupExpiredRecords(now);

    // Get or create record for this session
    if (!triggerRecords[sessionId]) {
      triggerRecords[sessionId] = {
        count: 0,
        resetAt: now + this.config.windowMs,
        triggers: []
      };
    }

    const record = triggerRecords[sessionId];

    // Check if window has expired and reset if needed
    if (now >= record.resetAt) {
      record.count = 0;
      record.resetAt = now + this.config.windowMs;
      record.triggers = [];
    }

    // Remove triggers outside the current window
    const windowStart = now - this.config.windowMs;
    record.triggers = record.triggers.filter(timestamp => timestamp > windowStart);
    record.count = record.triggers.length;

    // Check if limit is exceeded
    if (record.count >= this.config.maxTriggersPerWindow) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: record.resetAt,
        windowMs: this.config.windowMs,
        reason: `Story trigger limit exceeded. Maximum ${this.config.maxTriggersPerWindow} triggers per ${this.config.windowMs / 60000} minutes.`
      };
    }

    return {
      allowed: true,
      remaining: this.config.maxTriggersPerWindow - record.count,
      resetAt: record.resetAt,
      windowMs: this.config.windowMs
    };
  }

  /**
   * Record a story trigger for the given session
   * Should be called after a story is successfully triggered
   * @param sessionId Unique session identifier
   * @returns Updated rate limit status
   */
  recordTrigger(sessionId: string): TriggerRateLimitResult {
    const now = Date.now();
    
    // Check current status first
    const currentStatus = this.checkTrigger(sessionId);
    
    if (!currentStatus.allowed) {
      return currentStatus;
    }

    // Record the trigger
    const record = triggerRecords[sessionId];
    record.triggers.push(now);
    record.count = record.triggers.length;

    return {
      allowed: true,
      remaining: this.config.maxTriggersPerWindow - record.count,
      resetAt: record.resetAt,
      windowMs: this.config.windowMs
    };
  }

  /**
   * Get current rate limit status for a session without recording a trigger
   * @param sessionId Unique session identifier
   * @returns Current rate limit status
   */
  getStatus(sessionId: string): TriggerRateLimitResult {
    return this.checkTrigger(sessionId);
  }

  /**
   * Reset rate limit for a specific session (admin function)
   * @param sessionId Session to reset
   */
  resetSession(sessionId: string): void {
    delete triggerRecords[sessionId];
  }

  /**
   * Get all active sessions and their status (admin function)
   * @returns Array of session statuses
   */
  getAllSessions(): Array<{ sessionId: string; status: TriggerRateLimitResult }> {
    const now = Date.now();
    this.cleanupExpiredRecords(now);

    return Object.keys(triggerRecords).map(sessionId => ({
      sessionId,
      status: this.getStatus(sessionId)
    }));
  }

  /**
   * Clean up expired records to prevent memory leaks
   * @param now Current timestamp
   */
  private cleanupExpiredRecords(now: number): void {
    // Only cleanup periodically to avoid performance impact
    if (now - this.lastCleanup < this.config.cleanupIntervalMs) {
      return;
    }

    this.lastCleanup = now;
    
    // Remove records that are fully expired
    Object.keys(triggerRecords).forEach(sessionId => {
      const record = triggerRecords[sessionId];
      
      // If reset time has passed and no recent triggers, remove the record
      if (now >= record.resetAt && record.triggers.length === 0) {
        delete triggerRecords[sessionId];
        return;
      }

      // Clean up old triggers within the record
      const windowStart = now - this.config.windowMs;
      record.triggers = record.triggers.filter(timestamp => timestamp > windowStart);
      record.count = record.triggers.length;

      // If no triggers remain and window expired, remove record
      if (record.triggers.length === 0 && now >= record.resetAt) {
        delete triggerRecords[sessionId];
      }
    });
  }

  /**
   * Get configuration for debugging/monitoring
   */
  getConfig(): StoryTriggerRateLimiterConfig {
    return { ...this.config };
  }

  /**
   * Update configuration (for testing or dynamic adjustment)
   */
  updateConfig(newConfig: Partial<StoryTriggerRateLimiterConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Clear all records (for testing)
   */
  clearAll(): void {
    Object.keys(triggerRecords).forEach(key => delete triggerRecords[key]);
  }
}

// Default instance for application use
export const defaultStoryTriggerRateLimiter = new StoryTriggerRateLimiter();

/**
 * Convenience function for checking story trigger rate limits
 * @param sessionId Session identifier
 * @returns Whether the trigger is allowed
 */
export function isStoryTriggerAllowed(sessionId: string): TriggerRateLimitResult {
  return defaultStoryTriggerRateLimiter.checkTrigger(sessionId);
}

/**
 * Convenience function for recording story triggers
 * @param sessionId Session identifier
 * @returns Updated rate limit status
 */
export function recordStoryTrigger(sessionId: string): TriggerRateLimitResult {
  return defaultStoryTriggerRateLimiter.recordTrigger(sessionId);
}

/**
 * Convenience function for getting trigger rate limit status
 * @param sessionId Session identifier
 * @returns Current rate limit status
 */
export function getStoryTriggerStatus(sessionId: string): TriggerRateLimitResult {
  return defaultStoryTriggerRateLimiter.getStatus(sessionId);
}