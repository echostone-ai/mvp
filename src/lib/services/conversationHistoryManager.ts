/**
 * Conversation History Management System
 * 
 * Provides comprehensive conversation session tracking, history storage and retrieval,
 * visitor ID handling, and automatic cleanup of old conversation data.
 * 
 * Implements requirements 2.1, 2.3, 2.4 from the GPT-5 Avatar Memory Upgrade spec.
 */

import { createClient } from '@supabase/supabase-js';

export interface ConversationTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: {
    confidence?: number;
    extractedEntities?: string[];
    emotionalTone?: string;
    processingTimeMs?: number;
    factsExtracted?: number;
  };
}

export interface ConversationSession {
  sessionId: string;
  avatarId: string;
  visitorId?: string;
  userId?: string;
  startTime: string;
  lastActivity: string;
  turns: ConversationTurn[];
  entityBindings: Map<string, any>;
  context: Record<string, any>;
  fastMode: boolean;
  isPersisted: boolean;
}

export interface ConversationHistoryOptions {
  maxTurnsPerSession?: number;
  sessionTimeoutMs?: number;
  autoCleanupIntervalMs?: number;
  persistToDatabase?: boolean;
}

export interface ConversationContinuity {
  turnCount: number;
  entityBindings: number;
  sessionDurationMs: number;
  lastActivity: string;
  contextSize: number;
}

export interface ConversationHistoryStats {
  activeSessions: number;
  totalTurns: number;
  averageSessionDuration: number;
  oldestSession: string | null;
  newestSession: string | null;
}

/**
 * Comprehensive conversation history management system
 * Handles session tracking, persistence, and cleanup
 */
export class ConversationHistoryManager {
  private sessions: Map<string, ConversationSession> = new Map();
  private supabaseClient: any;
  private options: Required<ConversationHistoryOptions>;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    supabaseUrl?: string,
    supabaseKey?: string,
    options: ConversationHistoryOptions = {}
  ) {
    this.options = {
      maxTurnsPerSession: options.maxTurnsPerSession ?? 100,
      sessionTimeoutMs: options.sessionTimeoutMs ?? 24 * 60 * 60 * 1000, // 24 hours
      autoCleanupIntervalMs: options.autoCleanupIntervalMs ?? 60 * 60 * 1000, // 1 hour
      persistToDatabase: options.persistToDatabase ?? true
    };

    if (this.options.persistToDatabase && supabaseUrl && supabaseKey) {
      this.supabaseClient = createClient(supabaseUrl, supabaseKey);
    }

    // Start automatic cleanup if enabled
    if (this.options.autoCleanupIntervalMs > 0) {
      this.startAutoCleanup();
    }
  }

  /**
   * Get or create a conversation session
   * Implements requirement 2.1 for conversation history access
   */
  async getOrCreateSession(
    sessionId: string,
    avatarId: string,
    visitorId?: string,
    userId?: string,
    fastMode: boolean = false
  ): Promise<ConversationSession> {
    let session = this.sessions.get(sessionId);

    if (!session) {
      // Try to load from database first
      if (this.options.persistToDatabase && this.supabaseClient) {
        session = await this.loadSessionFromDatabase(sessionId, avatarId, visitorId, userId);
      }

      // Create new session if not found
      if (!session) {
        session = {
          sessionId,
          avatarId,
          visitorId,
          userId,
          startTime: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
          turns: [],
          entityBindings: new Map(),
          context: {},
          fastMode,
          isPersisted: false
        };
      }

      this.sessions.set(sessionId, session);
    }

    // Update last activity
    session.lastActivity = new Date().toISOString();
    return session;
  }

  /**
   * Add a turn to a conversation session
   * Implements requirement 2.3 for conversation continuity
   */
  async addTurn(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
    metadata?: ConversationTurn['metadata']
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const turn: ConversationTurn = {
      id: `${sessionId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      role,
      content,
      timestamp: new Date().toISOString(),
      metadata
    };

    session.turns.push(turn);
    session.lastActivity = new Date().toISOString();

    // Trim turns if exceeding max limit
    if (session.turns.length > this.options.maxTurnsPerSession) {
      session.turns = session.turns.slice(-this.options.maxTurnsPerSession);
    }

    // Persist to database if enabled
    if (this.options.persistToDatabase && this.supabaseClient) {
      await this.persistSessionToDatabase(session);
    }
  }

  /**
   * Get conversation history for a session
   * Implements requirement 2.1 for conversation history retrieval
   */
  getConversationHistory(
    sessionId: string,
    limit?: number
  ): ConversationTurn[] {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return [];
    }

    const turns = session.turns;
    return limit ? turns.slice(-limit) : turns;
  }

  /**
   * Update session entity bindings
   * Implements requirement 2.4 for session state persistence
   */
  updateEntityBindings(
    sessionId: string,
    entityKey: string,
    entityValue: any
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.entityBindings.set(entityKey, entityValue);
    session.lastActivity = new Date().toISOString();
  }

  /**
   * Update session context
   * Implements requirement 2.4 for session state persistence
   */
  updateSessionContext(
    sessionId: string,
    contextKey: string,
    contextValue: any
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    session.context[contextKey] = contextValue;
    session.lastActivity = new Date().toISOString();
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): ConversationSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all sessions for a specific avatar
   */
  getSessionsForAvatar(avatarId: string): ConversationSession[] {
    return Array.from(this.sessions.values()).filter(
      session => session.avatarId === avatarId
    );
  }

  /**
   * Get all sessions for a specific visitor
   */
  getSessionsForVisitor(visitorId: string): ConversationSession[] {
    return Array.from(this.sessions.values()).filter(
      session => session.visitorId === visitorId
    );
  }

  /**
   * Get conversation continuity metrics
   * Implements requirement 2.3 for conversation continuity tracking
   */
  getConversationContinuity(sessionId: string): ConversationContinuity | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const startTime = new Date(session.startTime).getTime();
    const lastActivity = new Date(session.lastActivity).getTime();

    return {
      turnCount: session.turns.length,
      entityBindings: session.entityBindings.size,
      sessionDurationMs: lastActivity - startTime,
      lastActivity: session.lastActivity,
      contextSize: Object.keys(session.context).length
    };
  }

  /**
   * Clear expired sessions
   * Implements automatic cleanup requirement
   */
  clearExpiredSessions(maxAgeMs?: number): number {
    const threshold = maxAgeMs ?? this.options.sessionTimeoutMs;
    const now = Date.now();
    let cleared = 0;

    this.sessions.forEach((session, sessionId) => {
      const lastActivity = new Date(session.lastActivity).getTime();
      if (now - lastActivity > threshold) {
        this.sessions.delete(sessionId);
        cleared++;
      }
    });

    return cleared;
  }

  /**
   * Clear all sessions for a specific avatar
   */
  clearSessionsForAvatar(avatarId: string): number {
    let cleared = 0;
    this.sessions.forEach((session, sessionId) => {
      if (session.avatarId === avatarId) {
        this.sessions.delete(sessionId);
        cleared++;
      }
    });
    return cleared;
  }

  /**
   * Clear all sessions for a specific visitor
   */
  clearSessionsForVisitor(visitorId: string): number {
    let cleared = 0;
    this.sessions.forEach((session, sessionId) => {
      if (session.visitorId === visitorId) {
        this.sessions.delete(sessionId);
        cleared++;
      }
    });
    return cleared;
  }

  /**
   * Get conversation history statistics
   */
  getHistoryStats(): ConversationHistoryStats {
    const sessions = Array.from(this.sessions.values());
    const totalTurns = sessions.reduce((sum, session) => sum + session.turns.length, 0);
    
    let totalDuration = 0;
    let oldestTime = Date.now();
    let newestTime = 0;
    let oldestSession: string | null = null;
    let newestSession: string | null = null;

    sessions.forEach(session => {
      const startTime = new Date(session.startTime).getTime();
      const lastActivity = new Date(session.lastActivity).getTime();
      
      totalDuration += lastActivity - startTime;
      
      if (startTime < oldestTime) {
        oldestTime = startTime;
        oldestSession = session.sessionId;
      }
      
      if (lastActivity > newestTime) {
        newestTime = lastActivity;
        newestSession = session.sessionId;
      }
    });

    return {
      activeSessions: sessions.length,
      totalTurns,
      averageSessionDuration: sessions.length > 0 ? totalDuration / sessions.length : 0,
      oldestSession,
      newestSession
    };
  }

  /**
   * Start automatic cleanup of expired sessions
   */
  private startAutoCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const cleared = this.clearExpiredSessions();
      if (cleared > 0 && process.env.NODE_ENV !== 'test') {
        console.log(`Conversation cleanup: removed ${cleared} expired sessions`);
      }
    }, this.options.autoCleanupIntervalMs);
  }

  /**
   * Stop automatic cleanup
   */
  stopAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  /**
   * Load session from database
   */
  private async loadSessionFromDatabase(
    sessionId: string,
    avatarId: string,
    visitorId?: string,
    userId?: string
  ): Promise<ConversationSession | null> {
    if (!this.supabaseClient) return null;

    try {
      const { data, error } = await this.supabaseClient
        .from('conversations')
        .select('*')
        .eq('id', sessionId)
        .eq('avatar_id', avatarId)
        .single();

      if (error || !data) return null;

      // Parse messages from JSONB
      const turns: ConversationTurn[] = data.messages || [];

      return {
        sessionId,
        avatarId,
        visitorId,
        userId: data.user_id,
        startTime: data.created_at,
        lastActivity: data.last_active,
        turns,
        entityBindings: new Map(),
        context: {},
        fastMode: false,
        isPersisted: true
      };
    } catch (error) {
      console.error('Error loading session from database:', error);
      return null;
    }
  }

  /**
   * Persist session to database
   */
  private async persistSessionToDatabase(session: ConversationSession): Promise<void> {
    if (!this.supabaseClient || !session.userId) return;

    try {
      const { error } = await this.supabaseClient
        .from('conversations')
        .upsert({
          id: session.sessionId,
          user_id: session.userId,
          avatar_id: session.avatarId,
          messages: session.turns,
          last_active: session.lastActivity,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error persisting session to database:', error);
      } else {
        session.isPersisted = true;
      }
    } catch (error) {
      console.error('Error persisting session to database:', error);
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopAutoCleanup();
    this.sessions.clear();
  }
}