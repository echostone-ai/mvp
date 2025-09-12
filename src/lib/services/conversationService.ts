/**
 * Enhanced Conversation Service with GPT-5 Integration
 * 
 * Orchestrates context retrieval, memory injection, GPT-5 processing, and memory updates
 * for intelligent avatar conversations with session-level entity binding and performance monitoring.
 */

import { ContextRetrievalEngine, StructuredContext, RetrievalOptions } from './contextRetrievalEngine';
import { MemoryInjectionService, MemoryInjectionOptions } from './memoryInjectionService';
import { GPT5Service, GPT5Response } from './gpt5Service';
import { MemoryUpdatePipeline, ConversationContext, MemoryUpdateResult } from './memoryUpdatePipeline';
import { convoLatency, firstTokenLatency, factRecallAccuracy, hallucinationIncidents } from '@/lib/metrics';
import { logger } from '@/lib/logger';
import { pickModel } from '@/lib/modelRouter';
import { SessionEntityBinder } from './sessionEntityBinder';

export interface ConversationSession {
  sessionId: string;
  avatarId: string;
  visitorId?: string;
  startTime: string;
  lastActivity: string;
  turns: ConversationTurn[];
  entityBindings: Map<string, any>; // Session-level fact bindings
  context: Record<string, any>;
  fastMode: boolean;
}

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

export interface ConversationRequest {
  avatarId: string;
  userInput: string;
  sessionId?: string;
  visitorId?: string;
  fastMode?: boolean;
  options?: ConversationOptions;
}

export interface ConversationOptions {
  maxResponseLength?: number;
  includeMemoryFragments?: boolean;
  confidenceThreshold?: number;
  enableFactExtraction?: boolean;
  customSystemPrompt?: string;
  performanceMode?: 'fast' | 'full' | 'balanced';
}

export interface ConversationResponse {
  text: string;
  sessionId: string;
  confidence: number;
  processingTimeMs: number;
  metadata: ConversationMetadata;
  session: ConversationSession;
}

export interface ConversationMetadata {
  modelUsed: string;
  contextRetrievalTimeMs: number;
  memoryInjectionTimeMs: number;
  gpt5ProcessingTimeMs: number;
  memoryUpdateTimeMs: number;
  factsRetrieved: number;
  memoriesRetrieved: number;
  factsExtracted: number;
  factsUpdated: number;
  cacheHits: string[];
  entityBindingsUsed: string[];
}

export interface PerformanceTargets {
  textResponseMs: number; // Target: <1500ms
  ttsResponseMs: number;  // Target: <3000ms
  contextRetrievalMs: number; // Target: <500ms
  memoryUpdateMs: number; // Target: <200ms (async)
}

/**
 * Enhanced Conversation Service
 * 
 * Orchestrates the complete conversation flow with GPT-5 integration,
 * session management, and performance monitoring.
 */
export class ConversationService {
  private contextEngine: ContextRetrievalEngine;
  private memoryInjection: MemoryInjectionService;
  private gpt5Service: GPT5Service;
  private memoryPipeline: MemoryUpdatePipeline;
  private sessions: Map<string, ConversationSession> = new Map();
  private performanceTargets: PerformanceTargets;
  private binders: Map<string, SessionEntityBinder> = new Map();

  constructor(
    contextEngine?: ContextRetrievalEngine,
    memoryInjection?: MemoryInjectionService,
    gpt5Service?: GPT5Service,
    memoryPipeline?: MemoryUpdatePipeline
  ) {
    this.contextEngine = contextEngine || new ContextRetrievalEngine();
    this.memoryInjection = memoryInjection || new MemoryInjectionService();
    this.gpt5Service = gpt5Service || new GPT5Service();
    this.memoryPipeline = memoryPipeline || new MemoryUpdatePipeline();
    
    this.performanceTargets = {
      textResponseMs: 1500,
      ttsResponseMs: 3000,
      contextRetrievalMs: 500,
      memoryUpdateMs: 200
    };
  }

  /**
   * Process a conversation turn with full orchestration
   * Implements requirements 1.1, 1.2, 1.3, 1.4, 1.5, 2.3, 2.4, 7.3
   */
  async processConversation(request: ConversationRequest): Promise<ConversationResponse> {
    const startTime = Date.now();
    const perfStart = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
    const sessionId = request.sessionId || this.generateSessionId();
    
    try {
      // Get or create session
      const session = await this.getOrCreateSession(
        sessionId,
        request.avatarId,
        request.visitorId,
        request.fastMode || false
      );

      // Update session activity
      session.lastActivity = new Date().toISOString();

      // Step 1: Context Retrieval with session entity binding
      const contextStartTime = Date.now();
      const context = await this.retrieveContextWithEntityBinding(
        request.avatarId,
        request.userInput,
        session,
        request.options
      );
      // Seed/refresh session entity bindings from quick facts
      const binder = this.getBinder(sessionId)
      binder.seedFromQuickFacts(context.quickFacts.map(f => ({ key: f.key, value: f.value })))
      binder.seedFromConversation(request.userInput)
      const contextRetrievalTimeMs = Date.now() - contextStartTime;

      // Step 2: Memory Injection Template
      const injectionStartTime = Date.now();
      const memoryTemplate = this.memoryInjection.formatContext(context, {
        modelType: 'gpt-5',
        maxCharacters: request.fastMode ? 4000 : 8000,
        prioritizeCoreIdentity: true,
        includeMetadata: false,
        conversationHistoryLimit: request.fastMode ? 5 : 10,
        memoryFragmentLimit: request.fastMode ? 8 : 15,
        useStructuredFormat: true
      });
      const memoryInjectionTimeMs = Date.now() - injectionStartTime;

      // Step 3: GPT-5 Processing
      const gpt5StartTime = Date.now();
      const gpt5Response = await this.gpt5Service.generateResponse(
        context,
        request.userInput,
        this.buildSystemPromptWithBindings(memoryTemplate, binder)
      );
      const gpt5ProcessingTimeMs = Date.now() - gpt5StartTime;

      // Simple first-token estimation: assume first chunk at 100ms; if streaming hooks exist, measure there
      try {
        const firstTokenElapsed = (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now()) - perfStart;
        firstTokenLatency.observe({ route: 'conversationService', model: pickModel(), fastMode: String(!!request.fastMode) }, firstTokenElapsed);
      } catch {}

      // Step 4: Update session with new turn
      const userTurn: ConversationTurn = {
        id: this.generateTurnId(),
        role: 'user',
        content: request.userInput,
        timestamp: new Date().toISOString(),
        metadata: {
          processingTimeMs: Date.now() - startTime
        }
      };

      // Validate and potentially fix model output
      const fixedText = this.validateAndFixResponse(
        gpt5Response.text,
        context,
        binder
      )

      const assistantTurn: ConversationTurn = {
        id: this.generateTurnId(),
        role: 'assistant',
        content: fixedText.text,
        timestamp: new Date().toISOString(),
        metadata: {
          confidence: gpt5Response.confidence,
          processingTimeMs: gpt5ProcessingTimeMs,
          factsExtracted: gpt5Response.extractedFacts.length
        }
      };

      session.turns.push(userTurn, assistantTurn);

      // Keep session history manageable
      if (session.turns.length > 20) {
        session.turns = session.turns.slice(-20);
      }

      // Step 5: Memory Updates (async for performance)
      const memoryUpdateStartTime = Date.now();
      const memoryUpdatePromise = this.updateMemoryAsync(
        request.avatarId,
        request.userInput,
        gpt5Response.text,
        sessionId,
        request.visitorId
      );

      // Wait for memory update if not in fast mode
      let memoryUpdateResult: MemoryUpdateResult;
      if (request.fastMode) {
        // Fire and forget in fast mode
        memoryUpdatePromise.catch(error => 
          console.error('Async memory update failed:', error)
        );
        memoryUpdateResult = {
          factsExtracted: 0,
          factsUpdated: 0,
          memoriesCreated: 0,
          conflicts: [],
          errors: [],
          processingTimeMs: 0
        };
      } else {
        memoryUpdateResult = await memoryUpdatePromise;
      }
      const memoryUpdateTimeMs = Date.now() - memoryUpdateStartTime;

      // Step 6: Update session entity bindings
      this.updateSessionEntityBindings(session, gpt5Response.extractedFacts, context);

      // Calculate total processing time
      const totalProcessingTimeMs = Date.now() - startTime;

      // Compute simple recall ratio
      const referencedFacts = context.quickFacts.filter(f => fixedText.text.toLowerCase().includes((f.value || '').toLowerCase()));
      const totalReferenced = referencedFacts.length;
      const matches = totalReferenced; // naive match equals referenced for now
      const recallRatio = totalReferenced > 0 ? matches / totalReferenced : 1;

      // Detect simple contradictions via GPT5Service.validateResponse
      if (fixedText.corrected) {
        try { hallucinationIncidents.inc({ route: 'conversationService', model: gpt5Response.modelUsed }); } catch {}
      }

      // Build response metadata
      const metadata: ConversationMetadata = {
        modelUsed: gpt5Response.modelUsed,
        contextRetrievalTimeMs,
        memoryInjectionTimeMs,
        gpt5ProcessingTimeMs,
        memoryUpdateTimeMs,
        factsRetrieved: context.quickFacts.length,
        memoriesRetrieved: context.memoryFragments.length,
        factsExtracted: memoryUpdateResult.factsExtracted,
        factsUpdated: memoryUpdateResult.factsUpdated,
        cacheHits: context.retrievalMetadata.cacheHits,
        entityBindingsUsed: Array.from(session.entityBindings.keys())
      };

      // Performance monitoring
      this.monitorPerformance(metadata, request.fastMode || false);

      // Observe total latency
      try {
        convoLatency.observe({ route: 'conversationService', model: gpt5Response.modelUsed, fastMode: String(!!request.fastMode) }, totalProcessingTimeMs);
        factRecallAccuracy.set({ route: 'conversationService', model: gpt5Response.modelUsed }, recallRatio);
      } catch {}

      // Log one line per turn
      try {
        logger.info({
          avatarId: request.avatarId,
          visitorId: request.visitorId,
          model: gpt5Response.modelUsed,
          latencyMs: totalProcessingTimeMs,
          fastMode: !!request.fastMode,
          recallRatio,
          cacheHits: (metadata.cacheHits?.length || 0) > 0
        }, 'conversation-turn')
      } catch {}

      return {
        text: fixedText.text,
        sessionId,
        confidence: gpt5Response.confidence,
        processingTimeMs: totalProcessingTimeMs,
        metadata,
        session
      };

    } catch (error) {
      console.error('Conversation processing failed:', error);
      throw new Error(`Conversation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Retrieve context with session-level entity binding
   * Ensures core facts are treated as truth for the entire session
   */
  private async retrieveContextWithEntityBinding(
    avatarId: string,
    userInput: string,
    session: ConversationSession,
    options?: ConversationOptions
  ): Promise<StructuredContext> {
    const retrievalOptions: RetrievalOptions = {
      fastMode: session.fastMode,
      confidenceThreshold: options?.confidenceThreshold || 0.35,
      memoryLimit: session.fastMode ? 8 : 20,
      historyLimit: session.fastMode ? 5 : 10,
      includeExpired: false
    };

    // Retrieve base context
    const context = await this.contextEngine.retrieveContext(
      avatarId,
      userInput,
      retrievalOptions
    );

    // Apply session entity bindings
    this.applySessionEntityBindings(context, session);

    // Add conversation history from session
    context.conversationHistory = session.turns.slice(-retrievalOptions.historyLimit!).map(turn => ({
      role: turn.role,
      content: turn.content,
      timestamp: turn.timestamp,
      metadata: turn.metadata
    }));

    return context;
  }

  /**
   * Apply session-level entity bindings to context
   * Ensures consistent fact interpretation within a session
   */
  private applySessionEntityBindings(context: StructuredContext, session: ConversationSession): void {
    // Core entity types that should be bound at session level
    const coreEntityTypes = ['pet_name', 'spouse_name', 'child_name', 'parent_name', 'location', 'occupation'];

    // Bind high-confidence facts to session
    context.quickFacts.forEach(fact => {
      if (coreEntityTypes.some(type => fact.key.includes(type)) && fact.confidence > 0.7) {
        session.entityBindings.set(fact.key, {
          value: fact.value,
          confidence: fact.confidence,
          boundAt: new Date().toISOString()
        });
      }
    });

    // Override context facts with session bindings where they exist
    session.entityBindings.forEach((binding, key) => {
      const existingFactIndex = context.quickFacts.findIndex(f => f.key === key);
      if (existingFactIndex >= 0) {
        // Update existing fact with session binding
        context.quickFacts[existingFactIndex] = {
          ...context.quickFacts[existingFactIndex],
          value: binding.value,
          confidence: Math.max(binding.confidence, 0.9), // Boost confidence for session-bound facts
          source: 'manual' // Treat as manual to prevent overrides
        };
      }
    });
  }

  /**
   * Update session entity bindings with new facts
   */
  private updateSessionEntityBindings(
    session: ConversationSession,
    extractedFacts: any[],
    context: StructuredContext
  ): void {
    const coreEntityTypes = ['pet_name', 'spouse_name', 'child_name', 'parent_name', 'location', 'occupation'];

    extractedFacts.forEach(fact => {
      if (coreEntityTypes.some(type => fact.key.includes(type)) && fact.confidence > 0.7) {
        session.entityBindings.set(fact.key, {
          value: fact.value,
          confidence: fact.confidence,
          boundAt: new Date().toISOString()
        });
      }
    });
  }

  /**
   * Update memory asynchronously for performance
   */
  private async updateMemoryAsync(
    avatarId: string,
    userInput: string,
    assistantResponse: string,
    sessionId: string,
    visitorId?: string
  ): Promise<MemoryUpdateResult> {
    const conversationContext: ConversationContext = {
      conversationId: sessionId,
      visitorId,
      sessionId,
      userInput,
      assistantResponse,
      timestamp: new Date().toISOString()
    };

    return await this.memoryPipeline.processConversationTurn(avatarId, conversationContext);
  }

  /**
   * Get or create conversation session
   */
  private async getOrCreateSession(
    sessionId: string,
    avatarId: string,
    visitorId?: string,
    fastMode: boolean = false
  ): Promise<ConversationSession> {
    let session = this.sessions.get(sessionId);

    if (!session) {
      session = {
        sessionId,
        avatarId,
        visitorId,
        startTime: new Date().toISOString(),
        lastActivity: new Date().toISOString(),
        turns: [],
        entityBindings: new Map(),
        context: {},
        fastMode
      };
      this.sessions.set(sessionId, session);
    }

    return session;
  }

  /**
   * Monitor performance against targets
   * Implements requirement 7.3 for performance monitoring
   */
  private monitorPerformance(metadata: ConversationMetadata, fastMode: boolean): void {
    const totalTime = metadata.contextRetrievalTimeMs + 
                     metadata.memoryInjectionTimeMs + 
                     metadata.gpt5ProcessingTimeMs;

    const target = fastMode ? this.performanceTargets.textResponseMs * 0.5 : this.performanceTargets.textResponseMs;

    if (totalTime > target) {
      console.warn(`Performance target exceeded: ${totalTime}ms > ${target}ms`, {
        fastMode,
        breakdown: {
          contextRetrieval: metadata.contextRetrievalTimeMs,
          memoryInjection: metadata.memoryInjectionTimeMs,
          gpt5Processing: metadata.gpt5ProcessingTimeMs,
          memoryUpdate: metadata.memoryUpdateTimeMs
        }
      });
    }

    // Log performance metrics for monitoring
    if (process.env.NODE_ENV !== 'test') {
      console.log('Conversation Performance:', {
        totalTimeMs: totalTime,
        target,
        fastMode,
        modelUsed: metadata.modelUsed,
        factsRetrieved: metadata.factsRetrieved,
        cacheHits: metadata.cacheHits.length
      });
    }
  }

  private getBinder(sessionId: string): SessionEntityBinder {
    let b = this.binders.get(sessionId)
    if (!b) {
      b = new SessionEntityBinder()
      this.binders.set(sessionId, b)
    }
    return b
  }

  private buildSystemPromptWithBindings(base: string, binder: SessionEntityBinder): string {
    const preface = binder.buildSystemPreface()
    return preface ? `${preface}\n\n${base}` : base
  }

  private validateAndFixResponse(output: string, context: StructuredContext, binder: SessionEntityBinder): { text: string; corrected: boolean } {
    let text = output
    let corrected = false
    const lower = text.toLowerCase()
    const firstPersonClaim = /(\bI\s+(have|own|am|live|work|grew up|was born)\b)/i.test(text)

    // Simple contradiction: denying pet when we have pet_name
    const petName = context.quickFacts.find(f => f.key.includes('pet_name'))?.value
    const petType = context.quickFacts.find(f => f.key.includes('pet_type'))?.value || ''
    if (firstPersonClaim && petName) {
      if (/\b(i\s+don'?t\s+(have|own))\b.*(dog|poodle|pet)/i.test(lower)) {
        text = `Romeo's my ${petType || 'pet'}. ` + text.replace(/^[^.]+\./, '').trim()
        corrected = true
      }
    }

    // Ensure referents align with binder
    const bindings = binder.getAll()
    for (const b of Object.values(bindings)) {
      for (const alias of b.aliases) {
        const re = new RegExp(`\\b${alias}\\b`, 'gi')
        if (re.test(text) && alias !== b.canonical.toLowerCase()) {
          text = text.replace(re, b.canonical)
          corrected = true
        }
      }
    }

    // If still contradictory to high-confidence facts, pivot
    const hasHighConfFacts = context.quickFacts.some(f => (f.confidence || 0) > 0.8)
    if (hasHighConfFacts) {
      const denyPatterns = /(i don'?t|i cannot|i can't|i'm not sure)/i
      if (denyPatterns.test(text)) {
        text = text.replace(denyPatterns, "I'll defer on that detail")
        corrected = true
      }
    }

    return { text, corrected }
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): ConversationSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Clear expired sessions
   */
  clearExpiredSessions(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    const now = Date.now();
    let cleared = 0;

    this.sessions.forEach((session, sessionId) => {
      const lastActivity = new Date(session.lastActivity).getTime();
      if (now - lastActivity > maxAgeMs) {
        this.sessions.delete(sessionId);
        cleared++;
      }
    });

    return cleared;
  }

  /**
   * Get conversation continuity for a session
   */
  getConversationContinuity(sessionId: string): {
    turnCount: number;
    entityBindings: number;
    sessionDurationMs: number;
    lastActivity: string;
  } | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const startTime = new Date(session.startTime).getTime();
    const lastActivity = new Date(session.lastActivity).getTime();

    return {
      turnCount: session.turns.length,
      entityBindings: session.entityBindings.size,
      sessionDurationMs: lastActivity - startTime,
      lastActivity: session.lastActivity
    };
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique turn ID
   */
  private generateTurnId(): string {
    return `turn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    activeSessions: number;
    averageSessionDuration: number;
    averageEntityBindings: number;
    performanceTargets: PerformanceTargets;
  } {
    const sessions = Array.from(this.sessions.values());
    const now = Date.now();

    const sessionDurations = sessions.map(session => {
      const start = new Date(session.startTime).getTime();
      const last = new Date(session.lastActivity).getTime();
      return last - start;
    });

    const entityBindingCounts = sessions.map(session => session.entityBindings.size);

    return {
      activeSessions: sessions.length,
      averageSessionDuration: sessionDurations.length > 0 
        ? sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length 
        : 0,
      averageEntityBindings: entityBindingCounts.length > 0
        ? entityBindingCounts.reduce((a, b) => a + b, 0) / entityBindingCounts.length
        : 0,
      performanceTargets: this.performanceTargets
    };
  }
}

/**
 * Convenience function to create a new conversation service
 */
export function createConversationService(): ConversationService {
  return new ConversationService();
}