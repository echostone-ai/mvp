/**
 * UserStoryService - Core service for managing authentic voice stories
 * Provides CRUD operations with validation and API-level enforcement of constraints
 */

import { createClient } from '@supabase/supabase-js';
import { 
  UserStory, 
  StoryUploadRequest, 
  StoryListRequest, 
  StoryUpdateRequest,
  StoryListResponse,
  StoryUploadResponse,
  STORY_CONSTRAINTS,
  StoryValidationError,
  StoryLimitExceededError,
  validateStoryFile,
  validateStoryMetadata,
  formatTriggersToString,
  parseTriggersFromString,
  OwnerType,
  StoryStatus
} from '../types/stories';

export class UserStoryService {
  private supabase;

  constructor(supabaseUrl?: string, supabaseKey?: string) {
    // Use provided credentials or fall back to environment variables
    this.supabase = createClient(
      supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseKey || process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Create a new story with validation and limit enforcement
   */
  async createStory(request: StoryUploadRequest, currentUserId?: string): Promise<StoryUploadResponse> {
    // Validate file
    const fileValidation = validateStoryFile(request.file);
    if (!fileValidation.valid) {
      throw new StoryValidationError([fileValidation.error!]);
    }

    // Validate metadata
    const metadataValidation = validateStoryMetadata(request);
    if (!metadataValidation.valid) {
      throw new StoryValidationError(metadataValidation.errors);
    }

    // Determine owner (use provided or current user)
    const ownerId = request.owner_id || currentUserId || 'current_user';
    const ownerType = request.owner_type || 'user';

    // API-level enforcement of 5-story limit (defense in depth)
    await this.enforceStoryLimit(ownerId, ownerType);

    // TODO: In next task, implement file upload to storage
    // For now, we'll create a placeholder audio_url
    const audio_url = `https://placeholder.cdn/stories/${Date.now()}.mp3`;
    
    // TODO: In next task, extract actual duration from audio file
    // For now, estimate based on file size (rough approximation)
    const estimated_duration_ms = Math.min(
      Math.max(request.file.size / 1000, STORY_CONSTRAINTS.MIN_DURATION_MS),
      STORY_CONSTRAINTS.MAX_DURATION_MS
    );

    // Insert story into database
    const { data, error } = await this.supabase
      .from('user_stories')
      .insert({
        owner_id: ownerId,
        owner_type: ownerType,
        title: request.title.trim(),
        category: request.category,
        triggers: formatTriggersToString(request.triggers),
        audio_url,
        duration_ms: estimated_duration_ms,
        transcript: request.transcript?.trim() || null,
        priority: request.priority || 50,
        status: 'processing' as StoryStatus // Will be updated after file processing
      })
      .select()
      .single();

    if (error) {
      // Check if it's a story limit error from database trigger
      if (error.message.includes('Maximum of 5 stories allowed')) {
        throw new StoryLimitExceededError(5);
      }
      throw new Error(`Failed to create story: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to create story: No data returned');
    }

    return {
      id: data.id,
      audio_url: data.audio_url,
      duration_ms: data.duration_ms,
      status: data.status
    };
  }

  /**
   * Get stories by owner with filtering and pagination
   * Authorization: Users can only access their own stories or public active stories
   */
  async getStories(request: StoryListRequest = {}, currentUserId?: string): Promise<StoryListResponse> {
    let query = this.supabase
      .from('user_stories')
      .select('*', { count: 'exact' });

    // Authorization: If no specific owner requested, default to current user's stories
    if (!request.owner_id && currentUserId) {
      query = query.eq('owner_id', currentUserId);
    }

    // Apply filters
    if (request.owner_type) {
      query = query.eq('owner_type', request.owner_type);
    }
    if (request.owner_id) {
      // Authorization check: Users can only access their own stories unless it's public
      if (currentUserId && request.owner_id !== currentUserId) {
        // Only allow access to active stories from other users (public access)
        query = query.eq('owner_id', request.owner_id).eq('status', 'active');
      } else {
        query = query.eq('owner_id', request.owner_id);
      }
    }
    if (request.category) {
      query = query.eq('category', request.category);
    }
    if (request.status) {
      query = query.eq('status', request.status);
    }

    // Apply pagination
    const limit = Math.min(request.limit || 50, 100); // Max 100 per request
    const offset = request.offset || 0;
    
    query = query
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch stories: ${error.message}`);
    }

    return {
      stories: data || [],
      total: count || 0,
      limit,
      offset
    };
  }

  /**
   * Update an existing story
   * Authorization: Users can only update their own stories
   */
  async updateStory(id: string, updates: StoryUpdateRequest, currentUserId?: string): Promise<UserStory> {
    // First, verify ownership if currentUserId is provided
    if (currentUserId) {
      await this.verifyStoryOwnership(id, currentUserId);
    }

    // Validate individual fields if provided (partial validation for updates)
    const errors: string[] = [];
    
    if (updates.title !== undefined) {
      if (!updates.title || updates.title.trim().length === 0) {
        errors.push('Title cannot be empty');
      } else if (updates.title.length > STORY_CONSTRAINTS.MAX_TITLE_LENGTH) {
        errors.push(`Title must be less than ${STORY_CONSTRAINTS.MAX_TITLE_LENGTH} characters`);
      }
    }
    
    if (updates.category !== undefined) {
      if (!['memory', 'experience', 'advice', 'anecdote'].includes(updates.category)) {
        errors.push('Invalid category');
      }
    }
    
    if (updates.triggers !== undefined) {
      if (updates.triggers.length === 0) {
        errors.push('At least one trigger keyword is required');
      } else if (updates.triggers.length > STORY_CONSTRAINTS.MAX_TRIGGERS) {
        errors.push(`Maximum ${STORY_CONSTRAINTS.MAX_TRIGGERS} trigger keywords allowed`);
      }
    }
    
    if (updates.priority !== undefined) {
      if (updates.priority < STORY_CONSTRAINTS.MIN_PRIORITY || updates.priority > STORY_CONSTRAINTS.MAX_PRIORITY) {
        errors.push(`Priority must be between ${STORY_CONSTRAINTS.MIN_PRIORITY} and ${STORY_CONSTRAINTS.MAX_PRIORITY}`);
      }
    }

    if (updates.transcript !== undefined && updates.transcript) {
      if (updates.transcript.length > STORY_CONSTRAINTS.MAX_TRANSCRIPT_LENGTH) {
        errors.push(`Transcript must be less than ${STORY_CONSTRAINTS.MAX_TRANSCRIPT_LENGTH} characters`);
      }
    }
    
    if (errors.length > 0) {
      throw new StoryValidationError(errors);
    }

    // Prepare update object
    const updateData: any = {};
    
    if (updates.title !== undefined) {
      updateData.title = updates.title.trim();
    }
    if (updates.category !== undefined) {
      updateData.category = updates.category;
    }
    if (updates.triggers !== undefined) {
      updateData.triggers = formatTriggersToString(updates.triggers);
    }
    if (updates.transcript !== undefined) {
      updateData.transcript = updates.transcript?.trim() || null;
    }
    if (updates.priority !== undefined) {
      updateData.priority = updates.priority;
    }
    if (updates.status !== undefined) {
      updateData.status = updates.status;
    }

    // Add updated_at timestamp (will be handled by database trigger, but explicit is better)
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('user_stories')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error(`Story not found or access denied: ${id}`);
      }
      throw new Error(`Failed to update story: ${error.message}`);
    }

    if (!data) {
      throw new Error(`Story not found: ${id}`);
    }

    return data;
  }

  /**
   * Delete a story
   * Authorization: Users can only delete their own stories
   */
  async deleteStory(id: string, currentUserId?: string): Promise<boolean> {
    // First, verify ownership if currentUserId is provided
    if (currentUserId) {
      await this.verifyStoryOwnership(id, currentUserId);
    }

    const { error } = await this.supabase
      .from('user_stories')
      .delete()
      .eq('id', id);

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error(`Story not found or access denied: ${id}`);
      }
      throw new Error(`Failed to delete story: ${error.message}`);
    }

    return true;
  }

  /**
   * Get story count for an owner (used for limit enforcement)
   */
  async getStoryCount(ownerId: string, ownerType: OwnerType): Promise<number> {
    const { count, error } = await this.supabase
      .from('user_stories')
      .select('*', { count: 'exact', head: true })
      .eq('owner_id', ownerId)
      .eq('owner_type', ownerType)
      .in('status', ['active', 'inactive', 'processing']); // Don't count failed stories

    if (error) {
      throw new Error(`Failed to get story count: ${error.message}`);
    }

    return count || 0;
  }

  /**
   * Get a single story by ID
   * Authorization: Users can only access their own stories or public active stories
   */
  async getStoryById(id: string, currentUserId?: string): Promise<UserStory | null> {
    const { data, error } = await this.supabase
      .from('user_stories')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null; // Story not found
      }
      throw new Error(`Failed to fetch story: ${error.message}`);
    }

    // Authorization check: Users can only access their own stories unless it's active
    if (currentUserId && data.owner_id !== currentUserId && data.status !== 'active') {
      throw new Error('Access denied: You can only access your own stories or public active stories');
    }

    return data;
  }

  /**
   * Verify story ownership for authorization
   */
  private async verifyStoryOwnership(storyId: string, currentUserId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('user_stories')
      .select('owner_id, owner_type')
      .eq('id', storyId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new Error(`Story not found: ${storyId}`);
      }
      throw new Error(`Failed to verify story ownership: ${error.message}`);
    }

    if (data.owner_id !== currentUserId) {
      throw new Error('Access denied: You can only modify your own stories');
    }
  }

  /**
   * API-level enforcement of story limit (defense in depth)
   */
  private async enforceStoryLimit(ownerId: string, ownerType: OwnerType): Promise<void> {
    const currentCount = await this.getStoryCount(ownerId, ownerType);
    
    if (currentCount >= STORY_CONSTRAINTS.MAX_STORIES_PER_AVATAR) {
      throw new StoryLimitExceededError(currentCount, STORY_CONSTRAINTS.MAX_STORIES_PER_AVATAR);
    }
  }

  /**
   * Find stories matching trigger keywords (for conversation integration)
   * Uses the new StoryTriggerMatcher for improved accuracy and performance
   */
  async findMatchingStories(
    text: string, 
    ownerId: string, 
    ownerType: OwnerType = 'avatar'
  ): Promise<UserStory[]> {
    // Get active stories for the owner
    const { stories } = await this.getStories({
      owner_id: ownerId,
      owner_type: ownerType,
      status: 'active'
    });

    if (stories.length === 0) {
      return [];
    }

    // Use the default trigger matcher for improved matching
    const { defaultTriggerMatcher } = await import('./storyTriggerMatcher');
    
    // Find matching stories with the new system
    const matches = await defaultTriggerMatcher.findMatchingStories(text, stories, ownerId);
    
    // Return just the stories (not the full match objects)
    return matches.map(match => match.story);
  }

  /**
   * Find stories with trigger matching and cooldown support
   * Returns full match information including confidence scores
   */
  async findMatchingStoriesWithDetails(
    text: string,
    ownerId: string,
    ownerType: OwnerType = 'avatar'
  ): Promise<any[]> { // Using any[] to avoid circular import issues
    // Get active stories for the owner
    const { stories } = await this.getStories({
      owner_id: ownerId,
      owner_type: ownerType,
      status: 'active'
    });

    if (stories.length === 0) {
      return [];
    }

    // Use the default trigger matcher
    const { defaultTriggerMatcher } = await import('./storyTriggerMatcher');
    
    return await defaultTriggerMatcher.findMatchingStories(text, stories, ownerId);
  }

  /**
   * Select the best story from trigger matches
   * Uses the trigger matcher's selection logic (upload order for MVP)
   */
  async selectBestMatchingStory(
    text: string,
    ownerId: string,
    ownerType: OwnerType = 'avatar'
  ): Promise<UserStory | null> {
    const matches = await this.findMatchingStoriesWithDetails(text, ownerId, ownerType);
    
    if (matches.length === 0) {
      return null;
    }

    // Use the default trigger matcher's selection logic
    const { defaultTriggerMatcher } = await import('./storyTriggerMatcher');
    
    return await defaultTriggerMatcher.selectBestStory(matches);
  }

  /**
   * Check if an avatar is in cooldown period
   */
  async isAvatarInCooldown(avatarId: string): Promise<boolean> {
    const { defaultTriggerMatcher } = await import('./storyTriggerMatcher');
    
    return defaultTriggerMatcher.isInCooldown(avatarId);
  }

  /**
   * Record that a story was triggered (starts cooldown)
   */
  async recordStoryTrigger(avatarId: string): Promise<void> {
    const { defaultTriggerMatcher } = await import('./storyTriggerMatcher');
    
    defaultTriggerMatcher.recordTrigger(avatarId);
  }

  /**
   * Fallback client-side matching when database search fails
   * @deprecated Use findMatchingStories instead
   */
  private async findMatchingStoriesClientSide(
    normalizedText: string,
    ownerId: string,
    ownerType: OwnerType
  ): Promise<UserStory[]> {
    // Get active stories for the owner
    const { stories } = await this.getStories({
      owner_id: ownerId,
      owner_type: ownerType,
      status: 'active'
    });

    // Simple keyword matching (legacy implementation)
    const matchingStories = stories.filter(story => {
      const triggers = parseTriggersFromString(story.triggers);
      return triggers.some(trigger => 
        normalizedText.includes(trigger.toLowerCase())
      );
    });

    // Sort by priority (highest first) - legacy behavior
    return matchingStories.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Get stories by owner (static method for API compatibility)
   */
  static async getStoriesByOwner(ownerId: string, ownerType: OwnerType): Promise<UserStory[]> {
    const service = new UserStoryService();
    const response = await service.getStories({
      ownerId,
      ownerType,
      status: 'active'
    });
    return response.stories;
  }

  /**
   * Record story usage analytics
   */
  async recordUsage(analytics: {
    story_id: string;
    session_id?: string;
    trigger_text?: string;
    matched_keywords?: string[];
    confidence_score?: number;
    played_successfully: boolean;
    playback_duration_ms?: number;
    error_message?: string;
  }): Promise<void> {
    const { error } = await this.supabase
      .from('story_usage_analytics')
      .insert(analytics);

    if (error) {
      // Don't throw on analytics errors - log and continue
      console.error('Failed to record story usage analytics:', error);
    }
  }

  /**
   * Get usage analytics for stories
   */
  async getUsageAnalytics(
    storyId?: string,
    sessionId?: string,
    limit: number = 100
  ): Promise<any[]> {
    let query = this.supabase
      .from('story_usage_analytics')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (storyId) {
      query = query.eq('story_id', storyId);
    }
    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch usage analytics: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Batch update multiple stories (for admin operations)
   */
  async batchUpdateStories(
    storyIds: string[],
    updates: Partial<StoryUpdateRequest>,
    currentUserId?: string
  ): Promise<UserStory[]> {
    if (storyIds.length === 0) {
      return [];
    }

    // Verify ownership for all stories if currentUserId provided
    if (currentUserId) {
      for (const storyId of storyIds) {
        await this.verifyStoryOwnership(storyId, currentUserId);
      }
    }

    // Validate updates
    if (Object.keys(updates).length === 0) {
      throw new Error('No updates provided');
    }

    // Prepare update data
    const updateData: any = {};
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.priority !== undefined) updateData.priority = updates.priority;
    if (updates.category !== undefined) updateData.category = updates.category;
    
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('user_stories')
      .update(updateData)
      .in('id', storyIds)
      .select();

    if (error) {
      throw new Error(`Failed to batch update stories: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Batch delete multiple stories (for admin operations)
   */
  async batchDeleteStories(storyIds: string[], currentUserId?: string): Promise<boolean> {
    if (storyIds.length === 0) {
      return true;
    }

    // Verify ownership for all stories if currentUserId provided
    if (currentUserId) {
      for (const storyId of storyIds) {
        await this.verifyStoryOwnership(storyId, currentUserId);
      }
    }

    const { error } = await this.supabase
      .from('user_stories')
      .delete()
      .in('id', storyIds);

    if (error) {
      throw new Error(`Failed to batch delete stories: ${error.message}`);
    }

    return true;
  }

  /**
   * Get stories with advanced filtering and search
   */
  async searchStories(
    searchQuery: string,
    filters: {
      ownerId?: string;
      ownerType?: OwnerType;
      category?: string;
      status?: string;
      minPriority?: number;
      maxPriority?: number;
    } = {},
    pagination: { limit?: number; offset?: number } = {},
    currentUserId?: string
  ): Promise<StoryListResponse> {
    let query = this.supabase
      .from('user_stories')
      .select('*', { count: 'exact' });

    // Authorization: Default to current user's stories if no owner specified
    if (!filters.ownerId && currentUserId) {
      query = query.eq('owner_id', currentUserId);
    }

    // Apply filters
    if (filters.ownerId) {
      // Authorization check for accessing other users' stories
      if (currentUserId && filters.ownerId !== currentUserId) {
        query = query.eq('owner_id', filters.ownerId).eq('status', 'active');
      } else {
        query = query.eq('owner_id', filters.ownerId);
      }
    }
    if (filters.ownerType) query = query.eq('owner_type', filters.ownerType);
    if (filters.category) query = query.eq('category', filters.category);
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.minPriority !== undefined) query = query.gte('priority', filters.minPriority);
    if (filters.maxPriority !== undefined) query = query.lte('priority', filters.maxPriority);

    // Apply text search if query provided
    if (searchQuery && searchQuery.trim()) {
      const normalizedQuery = searchQuery.trim();
      query = query.or(`title.ilike.%${normalizedQuery}%,triggers.ilike.%${normalizedQuery}%,transcript.ilike.%${normalizedQuery}%`);
    }

    // Apply pagination
    const limit = Math.min(pagination.limit || 50, 100);
    const offset = pagination.offset || 0;
    
    query = query
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to search stories: ${error.message}`);
    }

    return {
      stories: data || [],
      total: count || 0,
      limit,
      offset
    };
  }
}