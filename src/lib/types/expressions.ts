/**
 * TypeScript type definitions for the Authentic Expressions Pipeline
 * These types match the database schema defined in the migration
 */

export type ExpressionType = 
  | 'laugh'
  | 'sigh' 
  | 'breath'
  | 'affirmation'
  | 'greeting'
  | 'catchphrase'
  | 'filler';

export type ExpressionStatus = 
  | 'active'
  | 'inactive'
  | 'processing'
  | 'failed';

export type OwnerType = 'user' | 'avatar';

export interface ExpressionClip {
  id: string;
  owner_type: OwnerType;
  owner_key: string;
  filename: string;
  type: ExpressionType;
  tone?: string;
  placement_hints?: string[];
  duration_ms: number;
  cdn_url: string;
  priority: number;
  status: ExpressionStatus;
  created_at: string;
  updated_at: string;
}

export interface ExpressionUploadRequest {
  file: File;
  type: ExpressionType;
  tone?: string;
  placement_hints?: string[];
  avatar_id?: string; // For admin uploads
}

export interface ExpressionUploadResponse {
  id: string;
  cdn_url: string;
  duration_ms: number;
  status: ExpressionStatus;
}

export interface ExpressionListRequest {
  owner_type?: OwnerType;
  owner_key?: string;
  type?: ExpressionType;
  status?: ExpressionStatus;
  limit?: number;
  offset?: number;
}

export interface ExpressionUpdateRequest {
  status?: ExpressionStatus;
  priority?: number;
  tone?: string;
  placement_hints?: string[];
}

export interface ExpressionListResponse {
  expressions: ExpressionClip[];
  total: number;
  limit: number;
  offset: number;
}

// Runtime types for client-side usage
export interface ExpressionPack {
  clips: ExpressionClip[];
  preloaded_buffers: Map<string, AudioBuffer>;
  is_loaded: boolean;
}

export interface OverlaySchedule {
  clip: ExpressionClip;
  start_time_ms: number;
  ducking_level: number; // 0-1, amount to reduce TTS volume
}

export interface ScheduleOverlaysOptions {
  max_overlays?: number; // Default: 2
  min_spacing_ms?: number; // Default: 4000
  ducking_amount?: number; // Default: 0.4 (3-6dB reduction)
}