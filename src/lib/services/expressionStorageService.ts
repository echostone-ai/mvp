/**
 * Expression Storage Service
 * Handles file uploads to Supabase storage and database operations for expressions
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

export interface ExpressionMetadata {
  id?: string;
  ownerId: string;
  ownerType: 'user' | 'avatar';
  filename: string;
  type: ExpressionType;
  tone?: string;
  placementHints?: string[];
  durationMs: number;
  priority?: number;
  status?: ExpressionStatus;
}

export type ExpressionType = 
  | 'laugh' 
  | 'sigh' 
  | 'breath' 
  | 'affirmation' 
  | 'greeting' 
  | 'catchphrase' 
  | 'filler';

export type ExpressionStatus = 'active' | 'inactive' | 'processing' | 'failed';

export interface StoredExpression extends ExpressionMetadata {
  id: string;
  cdnUrl: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Service for managing expression file storage and metadata
 */
export class ExpressionStorageService {
  private static readonly STORAGE_BUCKET = 'expressions';
  private static readonly CDN_BASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

  /**
   * Upload processed audio to storage and save metadata to database
   */
  static async uploadExpression(
    processedAudio: ProcessedAudio,
    metadata: ExpressionMetadata
  ): Promise<StoredExpression> {
    if (!supabaseAdmin) {
      throw new Error('ExpressionStorageService: supabaseAdmin not available (server-side only)');
    }
    
    try {
      // 1. Upload file to Supabase storage
      const storagePath = this.generateStoragePath(metadata);
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
        .from(this.STORAGE_BUCKET)
        .upload(storagePath, processedAudio.buffer, {
          contentType: 'audio/mpeg',
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      // 2. Generate CDN URL
      const { data: urlData } = supabaseAdmin.storage
        .from(this.STORAGE_BUCKET)
        .getPublicUrl(storagePath);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to generate CDN URL');
      }

      // 3. Save metadata to database
      const { data: dbData, error: dbError } = await supabaseAdmin
        .from('expression_clips')
        .insert({
          owner_type: metadata.ownerType,
          owner_key: metadata.ownerId,
          filename: metadata.filename,
          type: metadata.type,
          tone: metadata.tone,
          placement_hints: metadata.placementHints || [],
          duration_ms: metadata.durationMs,
          cdn_url: urlData.publicUrl,
          priority: metadata.priority || 0,
          status: metadata.status || 'active'
        })
        .select()
        .single();

      if (dbError) {
        // Clean up uploaded file if database insert fails
        await this.cleanupStorageFile(storagePath);
        throw new Error(`Database insert failed: ${dbError.message}`);
      }

      return this.mapDbRowToExpression(dbData);
    } catch (error) {
      console.error('Expression upload failed:', error);
      throw error;
    }
  }

  /**
   * Get expressions by owner
   */
  static async getExpressionsByOwner(
    ownerId: string, 
    ownerType: 'user' | 'avatar' = 'user'
  ): Promise<StoredExpression[]> {
    const { data, error } = await supabaseAdmin
      .from('expression_clips')
      .select('*')
      .eq('owner_type', ownerType)
      .eq('owner_key', ownerId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch expressions: ${error.message}`);
    }

    return data.map(this.mapDbRowToExpression);
  }

  /**
   * List expressions with filtering and pagination
   */
  static async listExpressions(options: {
    ownerType: 'user' | 'avatar';
    ownerKey: string;
    type?: ExpressionType;
    status?: ExpressionStatus;
    limit?: number;
    offset?: number;
  }): Promise<StoredExpression[]> {
    let query = supabaseAdmin
      .from('expression_clips')
      .select('*')
      .eq('owner_type', options.ownerType)
      .eq('owner_key', options.ownerKey);

    if (options.type) {
      query = query.eq('type', options.type);
    }

    if (options.status) {
      query = query.eq('status', options.status);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(options.offset || 0, (options.offset || 0) + (options.limit || 50) - 1);

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list expressions: ${error.message}`);
    }

    return data.map(this.mapDbRowToExpression);
  }

  /**
   * Count expressions with filtering
   */
  static async countExpressions(options: {
    ownerType: 'user' | 'avatar';
    ownerKey: string;
    type?: ExpressionType;
    status?: ExpressionStatus;
  }): Promise<number> {
    let query = supabaseAdmin
      .from('expression_clips')
      .select('*', { count: 'exact', head: true })
      .eq('owner_type', options.ownerType)
      .eq('owner_key', options.ownerKey);

    if (options.type) {
      query = query.eq('type', options.type);
    }

    if (options.status) {
      query = query.eq('status', options.status);
    }

    const { count, error } = await query;

    if (error) {
      throw new Error(`Failed to count expressions: ${error.message}`);
    }

    return count || 0;
  }

  /**
   * Update expression metadata
   */
  static async updateExpression(
    id: string, 
    updates: Partial<Pick<ExpressionMetadata, 'status' | 'priority' | 'tone' | 'placementHints'>>
  ): Promise<StoredExpression | null> {
    const { data, error } = await supabaseAdmin
      .from('expression_clips')
      .update({
        ...(updates.status && { status: updates.status }),
        ...(updates.priority !== undefined && { priority: updates.priority }),
        ...(updates.tone && { tone: updates.tone }),
        ...(updates.placementHints && { placement_hints: updates.placementHints }),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows found
        return null;
      }
      throw new Error(`Failed to update expression: ${error.message}`);
    }

    return this.mapDbRowToExpression(data);
  }

  /**
   * Delete expression and associated file
   */
  static async deleteExpression(id: string): Promise<boolean> {
    // First get the expression to find the file path
    const { data: expression, error: fetchError } = await supabaseAdmin
      .from('expression_clips')
      .select('cdn_url')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        // No rows found
        return false;
      }
      throw new Error(`Failed to fetch expression for deletion: ${fetchError.message}`);
    }

    // Delete from database
    const { error: dbError } = await supabaseAdmin
      .from('expression_clips')
      .delete()
      .eq('id', id);

    if (dbError) {
      throw new Error(`Failed to delete expression from database: ${dbError.message}`);
    }

    // Extract storage path from CDN URL and delete file
    if (expression.cdn_url) {
      const storagePath = this.extractStoragePathFromUrl(expression.cdn_url);
      if (storagePath) {
        await this.cleanupStorageFile(storagePath);
      }
    }

    return true;
  }

  /**
   * Generate storage path for expression file
   */
  private static generateStoragePath(metadata: ExpressionMetadata): string {
    const ownerPrefix = metadata.ownerType === 'user' ? 'users' : 'avatars';
    return `${ownerPrefix}/${metadata.ownerId}/${metadata.filename}`;
  }

  /**
   * Clean up storage file (best effort)
   */
  private static async cleanupStorageFile(storagePath: string): Promise<void> {
    try {
      await supabaseAdmin.storage
        .from(this.STORAGE_BUCKET)
        .remove([storagePath]);
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
   * Map database row to StoredExpression interface
   */
  private static mapDbRowToExpression(row: any): StoredExpression {
    return {
      id: row.id,
      ownerId: row.owner_key,
      ownerType: row.owner_type,
      filename: row.filename,
      type: row.type,
      tone: row.tone,
      placementHints: row.placement_hints || [],
      durationMs: row.duration_ms,
      priority: row.priority,
      status: row.status,
      cdnUrl: row.cdn_url,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}