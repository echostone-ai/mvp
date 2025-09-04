/**
 * Jonathan Demo Conversation State Management
 * 
 * Implements conversation state tracking, persistence, and cleanup for jonathan-demo sessions.
 * Provides conversation ID generation, browser session persistence, and memory fragment association.
 * 
 * Task 8 Requirements:
 * - Create conversation state tracking for jonathan-demo sessions
 * - Implement conversation ID generation and persistence across browser sessions
 * - Add conversation history management with proper memory fragment association
 * - Implement conversation cleanup and archival for long-running sessions
 */

import { createClient } from '@supabase/supabase-js';

export interface JonathanConversationTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  audioLatency?: number;
  expressionsUsed?: string[];
  memoryFragmentsReferenced?: string[];
  metadata?: {
    confidence?: number;
    processingTimeMs?: number;
    voiceSettings?: any;
  };
}

export interface JonathanConversationState {
  id: string;
  sessionId: string; // Browser session identifier
  avatarId: string;
  userId?: string;
  visitorId?: string;
  startTime: string;
  lastActivity: string;
  turns: JonathanConversationTurn[];
  memoryContext: string;
  voiceSettings?: any;
  expressionPackId?: string;
  isActive: boolean;
  isPersisted: boolean;
}

export interface ConversationStateOptions {
  maxTurnsPerConversation?: number;
  conversationTimeoutMs?: number;
  autoCleanupIntervalMs?: number;
  persistToDatabase?: boolean;
  enableMemoryAssociation?: boolean;
}

export interface ConversationMetrics {
  totalConversations: number;
  activeConversations: number;
  averageTurnsPerConversation: number;
  averageConversationDuration: number;
  totalTurns: number;
}

/**
 * Jonathan Demo Conversation State Manager
 * Handles conversation lifecycle, persistence, and cleanup
 */
export class JonathanDemoConversationState {
  private conversations: Map<string, JonathanConversationState> = new Map();
  private sessionConversations: Map<string, string> = new Map(); // sessionId -> conversationId
  private supabaseClient: any;
  private options: Required<ConversationStateOptions>;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(options: ConversationStateOptions = {}) {
    this.options = {
      maxTurnsPerConversation: options.maxTurnsPerConversation ?? 50,
      conversationTimeoutMs: options.conversationTimeoutMs ?? 2 * 60 * 60 * 1000, // 2 hours
      autoCleanupIntervalMs: options.autoCleanupIntervalMs ?? 30 * 60 * 1000, // 30 minutes
      persistToDatabase: options.persistToDatabase ?? true,
      enableMemoryAssociation: options.enableMemoryAssociation ?? true
    };

    // Initialize Supabase client if persistence is enabled
    if (this.options.persistToDatabase) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseKey) {
        this.supabaseClient = createClient(supabaseUrl, supabaseKey);
      }
    }

    // Start automatic cleanup
    if (this.options.autoCleanupIntervalMs > 0) {
      this.startAutoCleanup();
    }

    // Load persisted conversations on initialization
    this.loadPersistedConversations().catch(error => {
      console.warn('[JonathanConversationState] Failed to load persisted conversations:', error);
    });
  }

  /**
   * Generate a unique conversation ID
   * Format: jonathan-demo-{timestamp}-{random}
   */
  generateConversationId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `jonathan-demo-${timestamp}-${random}`;
  }

  /**
   * Generate a browser session ID for persistence across page reloads
   */
  generateSessionId(): string {
    // Try to get existing session ID from localStorage
    if (typeof window !== 'undefined') {
      const existingSessionId = localStorage.getItem('jonathan-demo-session-id');
      if (existingSessionId) {
        return existingSessionId;
      }

      // Generate new session ID and store it
      const newSessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      localStorage.setItem('jonathan-demo-session-id', newSessionId);
      return newSessionId;
    }

    // Fallback for server-side
    return `session-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Get or create a conversation for the current browser session
   * Implements conversation ID generation and persistence across browser sessions
   */
  async getOrCreateConversation(
    avatarId: string = 'jonathan-demo',
    sessionId?: string,
    userId?: string,
    visitorId?: string
  ): Promise<JonathanConversationState> {
    const actualSessionId = sessionId || this.generateSessionId();

    // Check if we have an active conversation for this session
    const existingConversationId = this.sessionConversations.get(actualSessionId);
    if (existingConversationId) {
      const existingConversation = this.conversations.get(existingConversationId);
      if (existingConversation && existingConversation.isActive) {
        // Update last activity
        existingConversation.lastActivity = new Date().toISOString();
        return existingConversation;
      }
    }

    // Create new conversation
    const conversationId = this.generateConversationId();
    const now = new Date().toISOString();

    const conversation: JonathanConversationState = {
      id: conversationId,
      sessionId: actualSessionId,
      avatarId,
      userId,
      visitorId,
      startTime: now,
      lastActivity: now,
      turns: [],
      memoryContext: '',
      isActive: true,
      isPersisted: false
    };

    // Store conversation
    this.conversations.set(conversationId, conversation);
    this.sessionConversations.set(actualSessionId, conversationId);

    console.log(`[JonathanConversationState] Created new conversation: ${conversationId} for session: ${actualSessionId}`);

    // Persist to database if enabled
    if (this.options.persistToDatabase) {
      await this.persistConversation(conversation);
    }

    return conversation;
  }

  /**
   * Add a conversation turn with proper memory fragment association
   */
  async addConversationTurn(
    conversationId: string,
    role: 'user' | 'assistant',
    content: string,
    metadata?: {
      audioLatency?: number;
      expressionsUsed?: string[];
      memoryFragmentsReferenced?: string[];
      confidence?: number;
      processingTimeMs?: number;
      voiceSettings?: any;
    }
  ): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    const turnId = `turn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const turn: JonathanConversationTurn = {
      id: turnId,
      role,
      content,
      timestamp: new Date().toISOString(),
      audioLatency: metadata?.audioLatency,
      expressionsUsed: metadata?.expressionsUsed || [],
      memoryFragmentsReferenced: metadata?.memoryFragmentsReferenced || [],
      metadata: {
        confidence: metadata?.confidence,
        processingTimeMs: metadata?.processingTimeMs,
        voiceSettings: metadata?.voiceSettings
      }
    };

    // Add turn to conversation
    conversation.turns.push(turn);
    conversation.lastActivity = turn.timestamp;

    // Enforce max turns limit
    if (conversation.turns.length > this.options.maxTurnsPerConversation) {
      const removedTurns = conversation.turns.splice(0, conversation.turns.length - this.options.maxTurnsPerConversation);
      console.log(`[JonathanConversationState] Archived ${removedTurns.length} old turns for conversation: ${conversationId}`);
    }

    console.log(`[JonathanConversationState] Added ${role} turn to conversation: ${conversationId}`);

    // Persist turn to database if enabled
    if (this.options.persistToDatabase) {
      await this.persistConversationTurn(conversation, turn);
    }

    // Background: Extract meaningful memories from user messages
    if (role === 'user' && content.trim().length > 10) {
      this.extractMemoriesFromTurn(conversation, turn).catch(error => {
        console.error('[JonathanConversationState] Failed to extract memories from turn:', {
          error: error instanceof Error ? error.message : String(error),
          conversationId,
          turnId: turn.id
        });
      });
    }
  }

  /**
   * Get conversation history for a session
   */
  getConversationHistory(sessionId: string, limit?: number): JonathanConversationTurn[] {
    const conversationId = this.sessionConversations.get(sessionId);
    if (!conversationId) {
      return [];
    }

    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return [];
    }

    const turns = conversation.turns;
    return limit ? turns.slice(-limit) : turns;
  }

  /**
   * Get current conversation for a session
   */
  getCurrentConversation(sessionId: string): JonathanConversationState | null {
    const conversationId = this.sessionConversations.get(sessionId);
    if (!conversationId) {
      return null;
    }

    return this.conversations.get(conversationId) || null;
  }

  /**
   * Update conversation memory context
   */
  updateMemoryContext(conversationId: string, memoryContext: string): void {
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      conversation.memoryContext = memoryContext;
      conversation.lastActivity = new Date().toISOString();
    }
  }

  /**
   * Update conversation voice settings
   */
  updateVoiceSettings(conversationId: string, voiceSettings: any): void {
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      conversation.voiceSettings = voiceSettings;
      conversation.lastActivity = new Date().toISOString();
    }
  }

  /**
   * Update conversation expression pack
   */
  updateExpressionPack(conversationId: string, expressionPackId: string): void {
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      conversation.expressionPackId = expressionPackId;
      conversation.lastActivity = new Date().toISOString();
    }
  }

  /**
   * End a conversation (mark as inactive)
   */
  async endConversation(conversationId: string): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      conversation.isActive = false;
      conversation.lastActivity = new Date().toISOString();

      console.log(`[JonathanConversationState] Ended conversation: ${conversationId}`);

      // Archive to database if enabled
      if (this.options.persistToDatabase) {
        await this.archiveConversation(conversation);
      }
    }
  }

  /**
   * Clean up old and inactive conversations
   */
  async cleanupConversations(): Promise<void> {
    const now = Date.now();
    const timeoutMs = this.options.conversationTimeoutMs;
    const conversationsToCleanup: string[] = [];

    for (const [conversationId, conversation] of this.conversations) {
      const lastActivity = new Date(conversation.lastActivity).getTime();
      const isExpired = (now - lastActivity) > timeoutMs;

      if (isExpired || !conversation.isActive) {
        conversationsToCleanup.push(conversationId);
      }
    }

    for (const conversationId of conversationsToCleanup) {
      const conversation = this.conversations.get(conversationId);
      if (conversation) {
        // Archive before cleanup if not already archived
        if (this.options.persistToDatabase && conversation.isActive) {
          await this.archiveConversation(conversation);
        }

        // Remove from memory
        this.conversations.delete(conversationId);

        // Remove session mapping
        for (const [sessionId, mappedConversationId] of this.sessionConversations) {
          if (mappedConversationId === conversationId) {
            this.sessionConversations.delete(sessionId);
            break;
          }
        }

        console.log(`[JonathanConversationState] Cleaned up conversation: ${conversationId}`);
      }
    }

    if (conversationsToCleanup.length > 0) {
      console.log(`[JonathanConversationState] Cleaned up ${conversationsToCleanup.length} conversations`);
    }
  }

  /**
   * Get conversation metrics
   */
  getConversationMetrics(): ConversationMetrics {
    const conversations = Array.from(this.conversations.values());
    const activeConversations = conversations.filter(c => c.isActive);

    const totalTurns = conversations.reduce((sum, c) => sum + c.turns.length, 0);
    const averageTurnsPerConversation = conversations.length > 0 ? totalTurns / conversations.length : 0;

    const totalDuration = conversations.reduce((sum, c) => {
      const start = new Date(c.startTime).getTime();
      const end = new Date(c.lastActivity).getTime();
      return sum + (end - start);
    }, 0);
    const averageConversationDuration = conversations.length > 0 ? totalDuration / conversations.length : 0;

    return {
      totalConversations: conversations.length,
      activeConversations: activeConversations.length,
      averageTurnsPerConversation,
      averageConversationDuration,
      totalTurns
    };
  }

  /**
   * Persist conversation to database
   */
  private async persistConversation(conversation: JonathanConversationState): Promise<void> {
    if (!this.supabaseClient) {
      console.warn('[JonathanConversationState] Supabase client not initialized - skipping persistence');
      return;
    }

    try {
      const { error } = await this.supabaseClient
        .from('jonathan_conversations')
        .upsert({
          id: conversation.id,
          session_id: conversation.sessionId,
          avatar_id: conversation.avatarId,
          user_id: conversation.userId,
          visitor_id: conversation.visitorId,
          start_time: conversation.startTime,
          last_activity: conversation.lastActivity,
          memory_context: conversation.memoryContext,
          voice_settings: conversation.voiceSettings,
          expression_pack_id: conversation.expressionPackId,
          is_active: conversation.isActive,
          turn_count: conversation.turns.length,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('[JonathanConversationState] Failed to persist conversation:', {
          conversationId: conversation.id,
          error: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });

        // Check for common issues
        if (error.code === 'PGRST116') {
          console.error('[JonathanConversationState] Table does not exist. Please run database migrations.');
        } else if (error.code === '42501') {
          console.error('[JonathanConversationState] Permission denied. Check RLS policies and authentication.');
        }
      } else {
        conversation.isPersisted = true;
        console.log(`[JonathanConversationState] Successfully persisted conversation: ${conversation.id}`);
      }
    } catch (error) {
      const errorDetails = {
        conversationId: conversation.id,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'Unknown',
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'configured' : 'missing',
        supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'configured' : 'missing'
      };

      console.error('[JonathanConversationState] Error persisting conversation:', errorDetails);

      // Provide actionable guidance
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        console.error('[JonathanConversationState] Missing Supabase environment variables. Check .env file.');
      }
    }
  }

  /**
   * Persist conversation turn to database
   */
  private async persistConversationTurn(
    conversation: JonathanConversationState,
    turn: JonathanConversationTurn
  ): Promise<void> {
    if (!this.supabaseClient) {
      console.warn('[JonathanConversationState] Supabase client not initialized - skipping turn persistence');
      return;
    }

    try {
      const { error } = await this.supabaseClient
        .from('jonathan_conversation_turns')
        .insert({
          id: turn.id,
          conversation_id: conversation.id,
          role: turn.role,
          content: turn.content,
          timestamp: turn.timestamp,
          audio_latency: turn.audioLatency,
          expressions_used: turn.expressionsUsed,
          memory_fragments_referenced: turn.memoryFragmentsReferenced,
          metadata: turn.metadata,
          created_at: new Date().toISOString()
        });

      if (error) {
        console.error('[JonathanConversationState] Failed to persist turn:', {
          turnId: turn.id,
          conversationId: conversation.id,
          role: turn.role,
          error: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });

        // Check for common issues
        if (error.code === 'PGRST116') {
          console.error('[JonathanConversationState] Turns table does not exist. Please run database migrations.');
        } else if (error.code === '42501') {
          console.error('[JonathanConversationState] Permission denied on turns table. Check RLS policies.');
        } else if (error.code === '23503') {
          console.error('[JonathanConversationState] Foreign key constraint failed. Conversation may not exist in database.');
        }
      } else {
        console.log(`[JonathanConversationState] Successfully persisted turn: ${turn.id} for conversation: ${conversation.id}`);
      }

      // Update conversation record
      await this.persistConversation(conversation);
    } catch (error) {
      const errorDetails = {
        turnId: turn.id,
        conversationId: conversation.id,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'Unknown'
      };

      console.error('[JonathanConversationState] Error persisting turn:', errorDetails);
    }
  }

  /**
   * Archive conversation to database
   */
  private async archiveConversation(conversation: JonathanConversationState): Promise<void> {
    if (!this.supabaseClient) {
      console.warn('[JonathanConversationState] Supabase client not initialized - skipping archive');
      return;
    }

    try {
      // Mark conversation as archived
      const { error } = await this.supabaseClient
        .from('jonathan_conversations')
        .update({
          is_active: false,
          archived_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', conversation.id);

      if (error) {
        console.error('[JonathanConversationState] Failed to archive conversation:', {
          conversationId: conversation.id,
          error: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
      } else {
        console.log(`[JonathanConversationState] Archived conversation: ${conversation.id}`);
      }
    } catch (error) {
      const errorDetails = {
        conversationId: conversation.id,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'Unknown'
      };

      console.error('[JonathanConversationState] Error archiving conversation:', errorDetails);
    }
  }

  /**
   * Load persisted conversations from database
   */
  private async loadPersistedConversations(): Promise<void> {
    if (!this.supabaseClient) return;

    try {
      // Load active conversations from the last 24 hours
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data: conversations, error } = await this.supabaseClient
        .from('jonathan_conversations')
        .select('*')
        .eq('is_active', true)
        .gte('last_activity', twentyFourHoursAgo)
        .order('last_activity', { ascending: false });

      if (error) {
        console.error('[JonathanConversationState] Failed to load conversations:', error);
        return;
      }

      if (conversations && conversations.length > 0) {
        for (const conv of conversations) {
          // Load conversation turns
          const { data: turns, error: turnsError } = await this.supabaseClient
            .from('jonathan_conversation_turns')
            .select('*')
            .eq('conversation_id', conv.id)
            .order('timestamp', { ascending: true });

          if (turnsError) {
            console.error('[JonathanConversationState] Failed to load turns:', turnsError);
            continue;
          }

          const conversationState: JonathanConversationState = {
            id: conv.id,
            sessionId: conv.session_id,
            avatarId: conv.avatar_id,
            userId: conv.user_id,
            visitorId: conv.visitor_id,
            startTime: conv.start_time,
            lastActivity: conv.last_activity,
            turns: (turns || []).map(turn => ({
              id: turn.id,
              role: turn.role,
              content: turn.content,
              timestamp: turn.timestamp,
              audioLatency: turn.audio_latency,
              expressionsUsed: turn.expressions_used || [],
              memoryFragmentsReferenced: turn.memory_fragments_referenced || [],
              metadata: turn.metadata || {}
            })),
            memoryContext: conv.memory_context || '',
            voiceSettings: conv.voice_settings,
            expressionPackId: conv.expression_pack_id,
            isActive: conv.is_active,
            isPersisted: true
          };

          this.conversations.set(conv.id, conversationState);
          this.sessionConversations.set(conv.session_id, conv.id);
        }

        console.log(`[JonathanConversationState] Loaded ${conversations.length} persisted conversations`);
      }
    } catch (error) {
      console.error('[JonathanConversationState] Error loading persisted conversations:', error);
    }
  }

  /**
   * Start automatic cleanup interval
   */
  private startAutoCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupConversations().catch(error => {
        console.error('[JonathanConversationState] Auto cleanup failed:', error);
      });
    }, this.options.autoCleanupIntervalMs);

    console.log(`[JonathanConversationState] Started auto cleanup with ${this.options.autoCleanupIntervalMs}ms interval`);
  }

  /**
   * Stop automatic cleanup
   */
  stopAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
      console.log('[JonathanConversationState] Stopped auto cleanup');
    }
  }

  /**
   * Extract meaningful memories from a conversation turn
   * Server-side only operation
   */
  private async extractMemoriesFromTurn(
    conversation: JonathanConversationState,
    turn: JonathanConversationTurn
  ): Promise<void> {
    // Skip memory extraction on client-side
    if (typeof window !== 'undefined') {
      console.log(`[JonathanConversationState] Skipping memory extraction on client-side for turn: ${turn.id}`);
      return;
    }

    try {
      console.log(`[JonathanConversationState] Extracting memories from ${turn.role} turn: ${turn.id}`);

      // Import MemoryService dynamically to avoid circular dependencies
      const { MemoryService } = await import('@/lib/memoryService');

      // Extract meaningful memories from the turn content
      const extractedMemories = await MemoryService.Extraction.extractMemoryFragments(
        turn.content,
        conversation.userId || conversation.visitorId || 'demo-user',
        {
          source: 'conversation_turn',
          conversation_id: conversation.id,
          session_id: conversation.sessionId,
          avatar_id: conversation.avatarId,
          turn_id: turn.id,
          timestamp: turn.timestamp
        }
      );

      if (extractedMemories.length > 0) {
        console.log(`[JonathanConversationState] Extracted ${extractedMemories.length} meaningful memories from turn`);

        // Store extracted memories with proper avatar association
        if (this.supabaseClient) {
          const memoryInserts = extractedMemories.map(memory => ({
            user_id: conversation.userId || conversation.visitorId || 'demo-user',
            avatar_id: conversation.avatarId,
            fragment_text: memory.fragmentText,
            conversation_context: {
              ...memory.conversationContext,
              source: 'conversation_extraction',
              conversation_id: conversation.id,
              session_id: conversation.sessionId,
              turn_id: turn.id,
              tags: ['extracted_memory', 'personal_info', 'conversation_turn']
            }
          }));

          const { error } = await this.supabaseClient
            .from('memory_fragments')
            .insert(memoryInserts);

          if (error) {
            console.error('[JonathanConversationState] Failed to store extracted memories:', {
              error: error.message,
              details: error.details,
              conversationId: conversation.id,
              turnId: turn.id
            });
          } else {
            console.log(`[JonathanConversationState] Successfully stored ${memoryInserts.length} extracted memories`);

            // Update turn metadata to track memory extraction
            turn.memoryFragmentsReferenced = turn.memoryFragmentsReferenced || [];
            turn.memoryFragmentsReferenced.push(...memoryInserts.map((_, index) => `extracted-${turn.id}-${index}`));
          }
        }
      } else {
        console.log(`[JonathanConversationState] No meaningful memories extracted from turn: ${turn.id}`);
      }
    } catch (error) {
      console.error('[JonathanConversationState] Error extracting memories from turn:', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        conversationId: conversation.id,
        turnId: turn.id
      });
    }
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    this.stopAutoCleanup();

    // Archive all active conversations
    const activeConversations = Array.from(this.conversations.values()).filter(c => c.isActive);
    for (const conversation of activeConversations) {
      await this.archiveConversation(conversation);
    }

    this.conversations.clear();
    this.sessionConversations.clear();

    console.log('[JonathanConversationState] Destroyed conversation state manager');
  }
}

// Singleton instance for jonathan-demo
export const jonathanConversationState = new JonathanDemoConversationState({
  maxTurnsPerConversation: 50,
  conversationTimeoutMs: 2 * 60 * 60 * 1000, // 2 hours
  autoCleanupIntervalMs: 30 * 60 * 1000, // 30 minutes
  persistToDatabase: true,
  enableMemoryAssociation: true
});