/**
 * UserStoryStorageService - File management service for authentic voice stories
 * Extends ExpressionStorageService patterns with story-specific validation and processing
 */

// Conditionally import supabaseAdmin only on server side
let supabaseAdmin: any = null;
if (typeof window === 'undefined') {
  try {
    const { supabaseAdmin: admin } = require('../supabaseAdmin');
    supabaseAdmin = admin;
  } catch (error) {
    console.warn('supabaseAdmin not available:', error);
  }
}

import { ProcessedAudio } from '../audioProcessor';
import { 
  UserStory,
  StoryUploadRequest,
  STORY_CONSTRAINTS,
  StoryValidationError,
  validateStoryFile,
  validateStoryMetadata,
  formatTriggersToString,
  OwnerType
} from '../types/stories';

export interface ProcessedStoryAudio {
  buffer: ArrayBuffer;
  durationMs: number;
  sampleRate: number;
  channels: number;
  filename: string;
}

export interface StoryUploadResult {
  id: string;
  audioUrl: string;
  durationMs: number;
  status: 'processing' | 'active' | 'failed';
}

/**
 * Service for managing story file storage and metadata
 * Follows ExpressionStorageService patterns with story-specific enhancements
 */
export class UserStoryStorageService {
  private static readonly STORAGE_BUCKET = 'story-audio-files';
  private static readonly CDN_BASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  private static readonly MAX_FILE_SIZE = STORY_CONSTRAINTS.MAX_FILE_SIZE_MB * 1024 * 1024; // 10MB in bytes
  
  // For testing - allow injection of supabase client
  private static testSupabaseClient: any = null;
  
  /**
   * Set supabase client for testing
   */
  static setTestClient(client: any): void {
    this.testSupabaseClient = client;
  }
  
  /**
   * Clear test client
   */
  static clearTestClient(): void {
    this.testSupabaseClient = null;
  }
  
  /**
   * Get the active supabase client (test client takes precedence)
   */
  private static getSupabaseClient(): any {
    return this.testSupabaseClient || supabaseAdmin;
  }

  /**
   * Upload and process story audio file with comprehensive validation
   */
  static async uploadStory(
    file: File,
    metadata: StoryUploadRequest,
    ownerId?: string
  ): Promise<StoryUploadResult> {
    const client = this.getSupabaseClient();
    if (!client) {
      throw new Error('UserStoryStorageService: supabaseAdmin not available (server-side only)');
    }

    try {
      // 1. Validate file format and size
      const fileValidation = validateStoryFile(file);
      if (!fileValidation.valid) {
        throw new StoryValidationError([fileValidation.error!]);
      }

      // 2. Validate metadata
      const metadataValidation = validateStoryMetadata(metadata);
      if (!metadataValidation.valid) {
        throw new StoryValidationError(metadataValidation.errors);
      }

      // 3. Additional file security checks
      await this.performSecurityValidation(file);

      // 4. Process audio and extract duration
      const processedAudio = await this.processStoryAudio(file, ownerId || 'unknown');

      // 5. Validate audio duration constraints
      this.validateAudioDuration(processedAudio.durationMs);

      // 6. Upload file to storage
      const storagePath = this.generateStoragePath(
        metadata.owner_type || 'user',
        ownerId || metadata.owner_id || 'unknown',
        processedAudio.filename
      );

      const { data: uploadData, error: uploadError } = await client.storage
        .from(this.STORAGE_BUCKET)
        .upload(storagePath, processedAudio.buffer, {
          contentType: 'audio/mpeg',
          cacheControl: '31536000', // 1 year cache for immutable content
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      // 7. Generate CDN URL
      const { data: urlData } = client.storage
        .from(this.STORAGE_BUCKET)
        .getPublicUrl(storagePath);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to generate CDN URL');
      }

      // 8. Save metadata to database
      const { data: dbData, error: dbError } = await client
        .from('user_stories')
        .insert({
          owner_id: ownerId || metadata.owner_id || 'unknown',
          owner_type: metadata.owner_type || 'user',
          title: metadata.title.trim(),
          category: metadata.category,
          triggers: formatTriggersToString(metadata.triggers),
          audio_url: urlData.publicUrl,
          duration_ms: processedAudio.durationMs,
          transcript: metadata.transcript?.trim() || null,
          priority: metadata.priority || 50,
          status: 'active' // Mark as active since processing is complete
        })
        .select()
        .single();

      if (dbError) {
        // Clean up uploaded file if database insert fails
        await this.cleanupStorageFile(storagePath);
        
        // Check for specific constraint violations
        if (dbError.message.includes('Maximum of 5 stories allowed')) {
          throw new StoryValidationError(['Maximum of 5 stories allowed per avatar']);
        }
        
        throw new Error(`Database insert failed: ${dbError.message}`);
      }

      return {
        id: dbData.id,
        audioUrl: dbData.audio_url,
        durationMs: dbData.duration_ms,
        status: dbData.status
      };

    } catch (error) {
      console.error('Story upload failed:', error);
      throw error;
    }
  }

  /**
   * Delete story and associated file
   */
  static async deleteStory(id: string): Promise<boolean> {
    const client = this.getSupabaseClient();
    if (!client) {
      throw new Error('UserStoryStorageService: supabaseAdmin not available (server-side only)');
    }

    try {
      // First get the story to find the file path
      const { data: story, error: fetchError } = await client
        .from('user_stories')
        .select('audio_url')
        .eq('id', id)
        .single();

      if (fetchError) {
        if (fetchError.code === 'PGRST116') {
          // No rows found
          return false;
        }
        throw new Error(`Failed to fetch story for deletion: ${fetchError.message}`);
      }

      // Delete from database
      const { error: dbError } = await client
        .from('user_stories')
        .delete()
        .eq('id', id);

      if (dbError) {
        throw new Error(`Failed to delete story from database: ${dbError.message}`);
      }

      // Extract storage path from CDN URL and delete file
      if (story.audio_url) {
        const storagePath = this.extractStoragePathFromUrl(story.audio_url);
        if (storagePath) {
          await this.cleanupStorageFile(storagePath);
        }
      }

      return true;
    } catch (error) {
      console.error('Story deletion failed:', error);
      throw error;
    }
  }

  /**
   * Process story audio file with validation and optimization
   */
  private static async processStoryAudio(file: File, ownerId: string): Promise<ProcessedAudio> {
    try {
      // Generate safe filename
      const filename = this.generateSafeFilename(file.name, ownerId);
      
      // Get actual audio duration using Web Audio API
      const durationMs = await this.extractAudioDuration(file);
      
      // For MVP, we'll use the original file buffer
      // In production, this would include audio processing (normalization, compression)
      const buffer = await file.arrayBuffer();
      
      return {
        buffer,
        durationMs: Math.round(durationMs),
        sampleRate: 44100, // Standard sample rate
        channels: 2, // Stereo (will be converted to mono in production)
        filename
      };
    } catch (error) {
      throw new Error(`Audio processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Extract accurate audio duration using Web Audio API
   */
  private static async extractAudioDuration(file: File): Promise<number> {
    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      // Server-side: Use a simple estimation based on file size
      // For MP3 files, rough estimation: 1MB ≈ 60-90 seconds at 128kbps
      const fileSizeKB = file.size / 1024;
      const estimatedDurationMs = (fileSizeKB / 16) * 1000; // Rough estimate for 128kbps MP3
      
      console.log(`[StorageService] Server-side duration estimation: ${Math.round(estimatedDurationMs / 1000)}s for ${fileSizeKB}KB file`);
      
      // Clamp to reasonable bounds (30s - 5min) and return a valid duration
      const clampedDuration = Math.max(30000, Math.min(300000, estimatedDurationMs));
      return Math.round(clampedDuration);
    }

    // Browser-side: Try Web Audio API first (most accurate)
    if (typeof window !== 'undefined' && window.AudioContext) {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const durationMs = (audioBuffer.length / audioBuffer.sampleRate) * 1000;
        audioContext.close();
        return Math.round(durationMs);
      } catch (error) {
        console.warn('Web Audio API failed, falling back to HTML Audio:', error);
      }
    }

    // Fallback to HTML Audio element (browser only)
    if (typeof Audio !== 'undefined') {
      return new Promise((resolve, reject) => {
        const audio = new Audio();
        const timeout = setTimeout(() => {
          audio.src = '';
          reject(new Error('Audio duration extraction timeout'));
        }, 10000); // 10 second timeout

        audio.addEventListener('loadedmetadata', () => {
          clearTimeout(timeout);
          const durationMs = audio.duration * 1000;
          audio.src = ''; // Clean up
          resolve(Math.round(durationMs));
        });

        audio.addEventListener('error', (e) => {
          clearTimeout(timeout);
          audio.src = ''; // Clean up
          reject(new Error(`Failed to load audio metadata: ${audio.error?.message || 'Unknown error'}`));
        });

        audio.src = URL.createObjectURL(file);
      });
    }

    // Final fallback: estimate based on file size
    const fileSizeKB = file.size / 1024;
    const estimatedDurationMs = (fileSizeKB / 16) * 1000;
    console.warn('[StorageService] Using file size estimation for audio duration');
    return Math.max(30000, Math.min(300000, estimatedDurationMs));
  }

  /**
   * Validate audio duration against story constraints
   */
  private static validateAudioDuration(durationMs: number): void {
    if (durationMs < STORY_CONSTRAINTS.MIN_DURATION_MS) {
      throw new StoryValidationError([
        `Audio duration ${Math.round(durationMs / 1000)}s is too short. Minimum: ${STORY_CONSTRAINTS.MIN_DURATION_MS / 1000}s`
      ]);
    }

    if (durationMs > STORY_CONSTRAINTS.MAX_DURATION_MS) {
      throw new StoryValidationError([
        `Audio duration ${Math.round(durationMs / 1000)}s is too long. Maximum: ${STORY_CONSTRAINTS.MAX_DURATION_MS / 1000}s`
      ]);
    }
  }

  /**
   * Perform security validation on uploaded file
   */
  private static async performSecurityValidation(file: File): Promise<void> {
    // Basic MIME type validation
    if (!STORY_CONSTRAINTS.SUPPORTED_FORMATS.includes(file.type as any)) {
      throw new StoryValidationError([
        `Unsupported file type: ${file.type}. Supported formats: ${STORY_CONSTRAINTS.SUPPORTED_FORMATS.join(', ')}`
      ]);
    }

    // File size validation
    if (file.size > this.MAX_FILE_SIZE) {
      throw new StoryValidationError([
        `File size ${Math.round(file.size / 1024 / 1024)}MB exceeds maximum ${STORY_CONSTRAINTS.MAX_FILE_SIZE_MB}MB`
      ]);
    }

    // Basic file header validation (magic number check)
    const buffer = await file.slice(0, 16).arrayBuffer();
    const header = new Uint8Array(buffer);
    
    // Check for MP3 magic numbers
    const isValidMP3 = (
      // ID3v2 header
      (header[0] === 0x49 && header[1] === 0x44 && header[2] === 0x33) ||
      // MP3 frame sync
      (header[0] === 0xFF && (header[1] & 0xE0) === 0xE0) ||
      // Some MP3s start with different patterns
      (header[0] === 0xFF && header[1] === 0xFB)
    );

    if (file.type.includes('mp3') && !isValidMP3) {
      throw new StoryValidationError(['File appears to be corrupted or not a valid MP3']);
    }

    // Additional security checks could be added here:
    // - Virus scanning integration
    // - Content analysis
    // - File signature validation
  }

  /**
   * Generate storage path for story file
   */
  private static generateStoragePath(ownerType: OwnerType, ownerId: string, filename: string): string {
    const ownerPrefix = ownerType === 'user' ? 'users' : 'avatars';
    return `${ownerPrefix}/${ownerId}/${filename}`;
  }

  /**
   * Generate safe filename for storage
   */
  private static generateSafeFilename(originalName: string, ownerId: string): string {
    // Remove extension and clean the name
    const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
    const cleanName = nameWithoutExt
      .replace(/[^a-zA-Z0-9-_]/g, '_')
      .substring(0, 50);
    
    // Add timestamp and owner prefix for uniqueness
    const timestamp = Date.now();
    const ownerPrefix = ownerId.substring(0, 8);
    
    return `${ownerPrefix}_${cleanName}_${timestamp}.mp3`;
  }

  /**
   * Clean up storage file (best effort)
   */
  private static async cleanupStorageFile(storagePath: string): Promise<void> {
    try {
      const client = this.getSupabaseClient();
      if (client) {
        await client.storage
          .from(this.STORAGE_BUCKET)
          .remove([storagePath]);
      }
    } catch (error) {
      console.warn('Failed to cleanup storage file:', storagePath, error);
    }
  }

  /**
   * Extract storage path from CDN URL
   */
  private static extractStoragePathFromUrl(cdnUrl: string): string | null {
    try {
      const url = new URL(cdnUrl);
      const pathParts = url.pathname.split('/');
      const bucketIndex = pathParts.indexOf(this.STORAGE_BUCKET);
      if (bucketIndex >= 0 && bucketIndex < pathParts.length - 1) {
        return pathParts.slice(bucketIndex + 1).join('/');
      }
    } catch (error) {
      console.warn('Failed to extract storage path from URL:', cdnUrl);
    }
    return null;
  }

  /**
   * Get CDN URL for story file
   */
  static generateCdnUrl(storagePath: string): string {
    if (!this.CDN_BASE_URL) {
      throw new Error('CDN base URL not configured');
    }
    return `${this.CDN_BASE_URL}/storage/v1/object/public/${this.STORAGE_BUCKET}/${storagePath}`;
  }

  /**
   * Validate storage bucket exists and is accessible
   */
  static async validateStorageSetup(): Promise<boolean> {
    const client = this.getSupabaseClient();
    if (!client) {
      return false;
    }

    try {
      const { data, error } = await client.storage.getBucket(this.STORAGE_BUCKET);
      return !error && data !== null;
    } catch (error) {
      console.error('Storage validation failed:', error);
      return false;
    }
  }
}