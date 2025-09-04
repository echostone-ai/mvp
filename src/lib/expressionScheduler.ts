/**
 * Expression Overlay Scheduler
 * Analyzes text and schedules appropriate expression overlays for TTS playback
 * 
 * Enhanced with advanced scheduling algorithms for context-aware expression selection
 */

import { StoredExpression, ExpressionType } from './services/expressionStorageService';
import { expressionMetrics, expressionMetricsRecorder } from './expressionMetrics';
import { expressionPerformanceMonitor } from './expressionPerformanceMonitor';
import { 
  advancedExpressionScheduler, 
  ConversationContext 
} from './services/advancedExpressionScheduler';
import { 
  contextAwareExpressionService,
  ConversationSession 
} from './services/contextAwareExpressionService';
import { logger } from './logger';

export interface ExpressionClip {
  id: string;
  type: ExpressionType;
  tone?: string;
  placementHints?: string[];
  cdnUrl: string;
  durationMs: number;
  priority: number;
}

export interface OverlaySchedule {
  clip: ExpressionClip;
  startTimeMs: number;
  duckingLevel: number; // 0-1, amount to reduce TTS volume
}

export interface ScheduleOverlaysOptions {
  maxOverlays?: number; // Default: 2 (as per task requirement)
  minSpacingMs?: number; // Default: 4000 (as per task requirement)
  duckingAmount?: number; // Default: 0.4 (3-6dB reduction)
}

/**
 * Main function to schedule expression overlays for a given text
 * Analyzes text content and selects appropriate expressions without delaying TTS start
 * 
 * Enhanced version that can use advanced scheduling when context is available
 */
export function scheduleOverlays(
  text: string,
  clips: ExpressionClip[],
  options: ScheduleOverlaysOptions = {},
  ownerType: 'user' | 'avatar' = 'user'
): OverlaySchedule[] {
  // Check feature flag first - Task 5: Enable EXPRESSION_OVERLAYS_ENABLED
  if (process.env.EXPRESSION_OVERLAYS_ENABLED !== 'true') {
    logger.debug('Expression overlays disabled by feature flag');
    return [];
  }
  
  const startTime = performance.now();
  
  try {
    const maxOverlays = options.maxOverlays || 2;
    const minSpacingMs = options.minSpacingMs || 4000;
    const duckingAmount = options.duckingAmount || 0.4;

    // Validate input parameters
    if (!text || text.trim().length === 0) {
      logger.debug('Empty text provided to scheduleOverlays');
      return [];
    }

    if (!clips || clips.length === 0) {
      logger.debug('No expression clips available for scheduling');
      return [];
    }

    // Filter out expressions that exceed duration limit
    const validClips = clips.filter(clip => {
      const isValid = expressionPerformanceMonitor.measureExpressionDuration(
        clip.id,
        clip.durationMs,
        clip.type,
        ownerType,
        { priority: clip.priority }
      );
      
      if (!isValid) {
        logger.warn(`Expression ${clip.id} exceeds duration limit, excluding from scheduling`);
      }
      
      return isValid;
    });

    if (validClips.length === 0) {
      logger.debug('No valid expression clips after duration filtering');
      return [];
    }

    // Simple text-based matching (no NLP)
    const candidates = findSimpleCandidates(text, validClips);
    const selected = prioritizeAndLimit(candidates, maxOverlays);
    const scheduled = scheduleWithSpacing(selected, text, minSpacingMs, duckingAmount);

    // Record scheduling metrics
    const schedulingDuration = performance.now() - startTime;
    
    logger.debug('Expression scheduling completed', {
      textLength: text.length,
      availableClips: clips.length,
      validClips: validClips.length,
      candidates: candidates.length,
      selected: selected.length,
      scheduled: scheduled.length,
      schedulingTime: schedulingDuration
    });

    // Record usage metrics for selected expressions
    scheduled.forEach(schedule => {
      expressionMetricsRecorder.recordExpressionUsage(
        schedule.clip.type,
        ownerType,
        schedule.clip.priority >= 50 ? 'admin' : 'keyword'
      );
    });

    return scheduled;

  } catch (error) {
    const schedulingDuration = performance.now() - startTime;
    
    logger.error('Error in expression scheduling', {
      error,
      textLength: text?.length || 0,
      clipCount: clips?.length || 0,
      schedulingTime: schedulingDuration
    });

    // Record error metrics
    expressionMetrics.errorCount.inc({
      error_type: 'UNKNOWN_ERROR',
      error_stage: 'SCHEDULING',
      owner_type: ownerType
    });

    // Return empty array for graceful degradation
    return [];
  }
}

/**
 * Find expression candidates based on simple keyword matching
 */
function findSimpleCandidates(text: string, clips: ExpressionClip[]): ExpressionClip[] {
  const lowerText = text.toLowerCase();
  
  return clips.filter(clip => {
    // Simple keyword/pattern matching for each expression type
    switch (clip.type) {
      case 'laugh':
        return /\b(funny|hilarious|laugh|haha|lol|amusing|joke|humor|comedy)\b/.test(lowerText);
      
      case 'sigh':
        return /\b(unfortunately|sadly|sigh|oh well|disappointing|regret|tough)\b/.test(lowerText);
      
      case 'breath':
        // Long responses get breathing room (over 100 characters)
        return text.length > 100;
      
      case 'affirmation':
        return /\b(exactly|absolutely|definitely|yes|correct|right|agreed|precisely)\b/.test(lowerText);
      
      case 'greeting':
        return /\b(hello|hi|hey|welcome|good morning|good afternoon|good evening)\b/.test(lowerText);
      
      case 'catchphrase':
        // Catchphrases can appear randomly with low probability
        return Math.random() < 0.1; // 10% chance
      
      case 'filler':
        // Fillers for natural pauses, also low probability
        return Math.random() < 0.08; // 8% chance
      
      default:
        return false;
    }
  });
}

/**
 * Prioritize candidates and limit to maximum overlays
 * Admin expressions (priority >= 50) are strongly preferred over user expressions
 */
function prioritizeAndLimit(candidates: ExpressionClip[], maxOverlays: number): ExpressionClip[] {
  if (candidates.length === 0) return [];
  
  // Separate admin expressions (priority >= 50) from user expressions
  const adminExpressions = candidates.filter(clip => clip.priority >= 50);
  const userExpressions = candidates.filter(clip => clip.priority < 50);
  
  // Sort admin expressions by priority (higher first)
  const sortedAdmin = adminExpressions.sort((a, b) => {
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }
    // Then by type preference for admin expressions
    const typeOrder: Record<ExpressionType, number> = {
      'laugh': 1,
      'affirmation': 2,
      'sigh': 3,
      'greeting': 4,
      'breath': 5,
      'catchphrase': 6,
      'filler': 7
    };
    return typeOrder[a.type] - typeOrder[b.type];
  });
  
  // Sort user expressions by priority (higher first)
  const sortedUser = userExpressions.sort((a, b) => {
    if (a.priority !== b.priority) {
      return b.priority - a.priority;
    }
    const typeOrder: Record<ExpressionType, number> = {
      'laugh': 1,
      'affirmation': 2,
      'sigh': 3,
      'greeting': 4,
      'breath': 5,
      'catchphrase': 6,
      'filler': 7
    };
    return typeOrder[a.type] - typeOrder[b.type];
  });
  
  // Prefer admin expressions first, then user expressions
  const allSorted = [...sortedAdmin, ...sortedUser];
  
  // Limit to maxOverlays and ensure no duplicate types
  const selected: ExpressionClip[] = [];
  const usedTypes = new Set<ExpressionType>();
  
  for (const clip of allSorted) {
    if (selected.length >= maxOverlays) break;
    
    // Avoid duplicate types in the same turn
    if (!usedTypes.has(clip.type)) {
      selected.push(clip);
      usedTypes.add(clip.type);
    }
  }
  
  return selected;
}

/**
 * Schedule expressions with proper timing and spacing
 */
function scheduleWithSpacing(
  clips: ExpressionClip[],
  text: string,
  minSpacingMs: number,
  duckingAmount: number
): OverlaySchedule[] {
  if (clips.length === 0) return [];
  
  // Estimate total TTS duration (rough approximation: ~50ms per character)
  const estimatedDurationMs = text.length * 50;
  
  const schedules: OverlaySchedule[] = [];
  let lastScheduledTime = 0;
  
  clips.forEach((clip, index) => {
    // Distribute expressions evenly across the estimated duration
    // Start after some initial delay to let TTS establish
    const baseStartTime = (estimatedDurationMs / (clips.length + 1)) * (index + 1);
    
    // Ensure minimum spacing from the last scheduled expression
    const minStartTime = lastScheduledTime + minSpacingMs;
    
    // Use the later of the two timing constraints
    let startTime = Math.max(baseStartTime, minStartTime);
    
    // Add some randomness to make it feel more natural (±300ms)
    // But ensure we don't violate minimum spacing
    const jitter = (Math.random() - 0.5) * 600;
    const jitteredTime = startTime + jitter;
    
    // Final start time must respect minimum spacing and be non-negative
    const finalStartTime = Math.max(0, Math.max(jitteredTime, minStartTime));
    
    schedules.push({
      clip,
      startTimeMs: finalStartTime,
      duckingLevel: duckingAmount
    });
    
    // Update last scheduled time for next iteration
    lastScheduledTime = finalStartTime;
  });
  
  // Sort by start time to ensure proper ordering (should already be sorted, but just in case)
  return schedules.sort((a, b) => a.startTimeMs - b.startTimeMs);
}

/**
 * Convert StoredExpression to ExpressionClip for scheduling
 */
export function convertStoredExpressionToClip(stored: StoredExpression): ExpressionClip {
  return {
    id: stored.id,
    type: stored.type,
    tone: stored.tone,
    placementHints: stored.placementHints,
    cdnUrl: stored.cdnUrl,
    durationMs: stored.durationMs,
    priority: stored.priority || 0
  };
}

/**
 * Utility function to convert multiple stored expressions to clips
 */
export function convertStoredExpressionsToClips(stored: StoredExpression[]): ExpressionClip[] {
  return stored
    .filter(expr => expr.status === 'active') // Only include active expressions
    .map(convertStoredExpressionToClip);
}

/**
 * Advanced expression scheduling with context awareness and learning
 * Uses the advanced scheduler when session context is available
 */
export async function scheduleAdvancedOverlays(
  text: string,
  clips: ExpressionClip[],
  sessionId: string,
  conversationTopic?: string,
  options: ScheduleOverlaysOptions = {}
): Promise<OverlaySchedule[]> {
  try {
    // Use context-aware service for advanced scheduling
    const storedExpressions: StoredExpression[] = clips.map(clip => ({
      id: clip.id,
      userId: '', // Will be filled by the service
      avatarId: '', // Will be filled by the service
      type: clip.type,
      tone: clip.tone,
      placementHints: clip.placementHints,
      cdnUrl: clip.cdnUrl,
      durationMs: clip.durationMs,
      priority: clip.priority,
      status: 'active' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));

    return await contextAwareExpressionService.scheduleContextAwareExpressions(
      text,
      storedExpressions,
      sessionId,
      conversationTopic,
      options
    );

  } catch (error) {
    logger.error('Error in advanced expression scheduling, falling back to basic', {
      error,
      sessionId,
      textLength: text?.length || 0
    });

    // Fallback to basic scheduling
    return scheduleOverlays(text, clips, options);
  }
}

/**
 * Initialize a conversation session for advanced expression scheduling
 */
export async function initializeExpressionSession(
  userId: string,
  avatarId: string,
  sessionId?: string
): Promise<ConversationSession> {
  return await contextAwareExpressionService.initializeSession(userId, avatarId, sessionId);
}

/**
 * Record user feedback for expression learning
 */
export async function recordExpressionFeedback(
  sessionId: string,
  feedback: {
    type: 'positive' | 'negative' | 'neutral';
    specificExpressions?: string[];
    context: string;
  }
): Promise<void> {
  return await contextAwareExpressionService.recordExpressionFeedback(sessionId, {
    type: feedback.type,
    specificExpressions: feedback.specificExpressions,
    timestamp: new Date(),
    context: feedback.context
  });
}