/**
 * TypeScript type definitions for the Authentic Voice Stories feature
 * These types match the database schema defined in migration 025
 */

export type StoryCategory = 
  | 'memory'
  | 'experience' 
  | 'advice'
  | 'anecdote';

export type StoryStatus = 
  | 'active'
  | 'inactive'
  | 'processing'
  | 'failed';

export type OwnerType = 'user' | 'avatar';

export interface UserStory {
  id: string;
  owner_id: string;
  owner_type: OwnerType;
  title: string;
  category: StoryCategory;
  triggers: string; // Comma-separated keywords, stored as text in DB
  audio_url: string;
  duration_ms: number;
  transcript?: string;
  priority: number; // 0-100
  status: StoryStatus;
  created_at: string;
  updated_at: string;
}

export interface StoryUsageAnalytics {
  id: string;
  story_id: string;
  session_id?: string;
  trigger_text?: string;
  matched_keywords?: string[];
  confidence_score?: number; // 0.00-1.00
  played_successfully: boolean;
  playback_duration_ms?: number;
  error_message?: string;
  created_at: string;
}

// Request/Response interfaces for API operations
export interface StoryUploadRequest {
  file: File;
  title: string;
  category: StoryCategory;
  triggers: string[]; // Array that gets converted to comma-separated string
  transcript?: string;
  priority?: number;
  owner_id?: string; // For admin uploads to specific avatars
  owner_type?: OwnerType;
}

export interface StoryUploadResponse {
  id: string;
  audio_url: string;
  duration_ms: number;
  status: StoryStatus;
}

export interface StoryListRequest {
  owner_type?: OwnerType;
  owner_id?: string;
  category?: StoryCategory;
  status?: StoryStatus;
  limit?: number;
  offset?: number;
}

export interface StoryUpdateRequest {
  title?: string;
  category?: StoryCategory;
  triggers?: string[];
  transcript?: string;
  priority?: number;
  status?: StoryStatus;
}

export interface StoryListResponse {
  stories: UserStory[];
  total: number;
  limit: number;
  offset: number;
}

// Runtime interfaces for story matching and playback
export interface StoryTriggerMatch {
  story: UserStory;
  confidence: number; // 0-1, how well the trigger matches
  matched_keywords: string[];
  context_relevance: number; // 0-1, relevance to conversation context
}

export interface StoryPlaybackOptions {
  fade_in_ms?: number;
  fade_out_ms?: number;
  volume_level?: number; // 0-1
  enable_lip_sync?: boolean;
  fallback_to_tts?: boolean;
}

export interface StoryPlaybackResult {
  success: boolean;
  story_id: string;
  playback_duration_ms?: number;
  error_message?: string;
  fallback_used: boolean;
  // Task 17: Experimental lip-sync integration
  lip_sync_used?: boolean;
  lip_sync_method?: 'heygen' | 'idle' | 'none';
}

// Validation schemas and constraints
export const STORY_CONSTRAINTS = {
  MAX_STORIES_PER_AVATAR: 5,
  MAX_FILE_SIZE_MB: 10,
  MIN_DURATION_MS: 30000, // 30 seconds
  MAX_DURATION_MS: 300000, // 5 minutes
  MAX_TITLE_LENGTH: 255,
  MAX_TRIGGERS: 20,
  MAX_TRIGGER_LENGTH: 100,
  MAX_TRANSCRIPT_LENGTH: 10000,
  MIN_PRIORITY: 0,
  MAX_PRIORITY: 100,
  SUPPORTED_FORMATS: ['audio/mpeg', 'audio/mp3'] as const,
  COOLDOWN_MS: 30000, // 30 seconds between story triggers
} as const;

// Helper functions for working with story data
export function parseTriggersFromString(triggers: string): string[] {
  return triggers
    .split(',')
    .map(t => t.trim().toLowerCase())
    .filter(t => t.length > 0);
}

export function formatTriggersToString(triggers: string[]): string {
  return triggers
    .map(t => t.trim().toLowerCase())
    .filter(t => t.length > 0)
    .slice(0, STORY_CONSTRAINTS.MAX_TRIGGERS)
    .join(', ');
}

export function validateStoryFile(file: File): { valid: boolean; error?: string } {
  // Check file size
  if (file.size > STORY_CONSTRAINTS.MAX_FILE_SIZE_MB * 1024 * 1024) {
    return {
      valid: false,
      error: `File size must be less than ${STORY_CONSTRAINTS.MAX_FILE_SIZE_MB}MB`
    };
  }

  // Check file type
  if (!STORY_CONSTRAINTS.SUPPORTED_FORMATS.includes(file.type as any)) {
    return {
      valid: false,
      error: `File must be MP3 format. Received: ${file.type}`
    };
  }

  return { valid: true };
}

export function validateStoryMetadata(metadata: Partial<StoryUploadRequest>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate title
  if (!metadata.title || metadata.title.trim().length === 0) {
    errors.push('Title is required');
  } else if (metadata.title.length > STORY_CONSTRAINTS.MAX_TITLE_LENGTH) {
    errors.push(`Title must be less than ${STORY_CONSTRAINTS.MAX_TITLE_LENGTH} characters`);
  }

  // Validate category
  if (!metadata.category) {
    errors.push('Category is required');
  } else if (!['memory', 'experience', 'advice', 'anecdote'].includes(metadata.category)) {
    errors.push('Invalid category');
  }

  // Validate triggers
  if (!metadata.triggers || metadata.triggers.length === 0) {
    errors.push('At least one trigger keyword is required');
  } else if (metadata.triggers.length > STORY_CONSTRAINTS.MAX_TRIGGERS) {
    errors.push(`Maximum ${STORY_CONSTRAINTS.MAX_TRIGGERS} trigger keywords allowed`);
  } else {
    for (const trigger of metadata.triggers) {
      if (trigger.length > STORY_CONSTRAINTS.MAX_TRIGGER_LENGTH) {
        errors.push(`Trigger keyword "${trigger}" is too long (max ${STORY_CONSTRAINTS.MAX_TRIGGER_LENGTH} characters)`);
      }
    }
  }

  // Validate priority
  if (metadata.priority !== undefined) {
    if (metadata.priority < STORY_CONSTRAINTS.MIN_PRIORITY || metadata.priority > STORY_CONSTRAINTS.MAX_PRIORITY) {
      errors.push(`Priority must be between ${STORY_CONSTRAINTS.MIN_PRIORITY} and ${STORY_CONSTRAINTS.MAX_PRIORITY}`);
    }
  }

  // Validate transcript
  if (metadata.transcript && metadata.transcript.length > STORY_CONSTRAINTS.MAX_TRANSCRIPT_LENGTH) {
    errors.push(`Transcript must be less than ${STORY_CONSTRAINTS.MAX_TRANSCRIPT_LENGTH} characters`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

// Error types for story operations
export class StoryValidationError extends Error {
  constructor(public errors: string[]) {
    super(`Story validation failed: ${errors.join(', ')}`);
    this.name = 'StoryValidationError';
  }
}

export class StoryLimitExceededError extends Error {
  constructor(currentCount: number, limit: number = STORY_CONSTRAINTS.MAX_STORIES_PER_AVATAR) {
    super(`Story limit exceeded. Current: ${currentCount}, Limit: ${limit}`);
    this.name = 'StoryLimitExceededError';
  }
}

export class StoryPlaybackError extends Error {
  constructor(message: string, public storyId?: string) {
    super(message);
    this.name = 'StoryPlaybackError';
  }
}