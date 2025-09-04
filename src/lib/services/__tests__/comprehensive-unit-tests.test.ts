/**
 * Comprehensive Unit Tests for GPT-5 Avatar Memory Upgrade
 * 
 * This file contains unit tests for all service classes and their methods,
 * ensuring each component works correctly in isolation.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Import all service classes
import { GPT5Service } from '../gpt5Service';
import { ContextRetrievalEngine } from '../contextRetrievalEngine';
import { MemoryInjectionService } from '../memoryInjectionService';
import { MemoryUpdatePipeline } from '../memoryUpdatePipeline';
import { ConversationService } from '../conversationService';
import { FactScoringService } from '../factScoringService';
import { ConversationHistoryManager } from '../conversationHistoryManager';
import { FastModeOptimizer } from '../fastModeOptimizer';
import { SchemaCompatibilityLayer } from '../schemaCompatibilityLayer';
import { ErrorHandlingService } from '../errorHandlingService';

// Mock external dependencies
vi.mock('@/lib/data/client');
vi.mock('@/lib/supabase');
vi.mock('openai');

describe('GPT-5 Avatar Memory Upgrade - Unit Tests', () => {
  
  describe('GPT5Service', () => {
    let gpt5Service: GPT5Service;

    beforeEach(() => {
      gpt5Service = new GPT5Service();
      vi.clearAllMocks();
    });

    it('should initialize with correct configuration', () => {
      expect(gpt5Service).toBeDefined();
      expect(gpt5Service.getModelName()).toBe('gpt-4o'); // Fallback model
    });

    it('should generate response with structured context', async () => {
      const mockContext = {
        quickFacts: [
          {
            id: '1',
            avatarId: 'avatar-123',
            key: 'name',
            value: 'John',
            confidence: 0.9,
            priority: 1,
            source: 'manual' as const,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
          }
        ],
        memoryFragments: [],
        conversationHistory: [],
        retrievalMetadata: {
          totalQuickFacts: 1,
          totalMemoryFragments: 0,
          totalConversationTurns: 0,
          retrievalTimeMs: 100,
          confidenceThreshold: 0.35,
          queryOptimizations: [],
          cacheHits: []
        }
      };

      const response = await gpt5Service.generateResponse(
        mockContext,
        'What is my name?',
        'You are John. Your name is John.'
      );

      expect(response).toMatchObject({
        text: expect.any(String),
        confidence: expect.any(Number),
        extractedFacts: expect.any(Array),
        modelUsed: expect.any(String),
        processingTime: expect.any(Number)
      });

      expect(response.confidence).toBeGreaterThan(0);
      expect(response.processingTime).toBeGreaterThan(0);
    });

    it('should validate response against context', () => {
      const mockContext = {
        quickFacts: [
          {
            id: '1',
            avatarId: 'avatar-123',
            key: 'pet_name',
            value: 'Buddy',
            confidence: 0.9,
            priority: 1,
            source: 'manual' as const,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
          }
        ],
        memoryFragments: [],
        conversationHistory: [],
        retrievalMetadata: {
          totalQuickFacts: 1,
          totalMemoryFragments: 0,
          totalConversationTurns: 0,
          retrievalTimeMs: 100,
          confidenceThreshold: 0.35,
          queryOptimizations: [],
          cacheHits: []
        }
      };

      const validResponse = 'Yes, my pet Buddy is doing great!';
      const invalidResponse = 'I don\'t have any pets.';

      expect(gpt5Service.validateResponse(validResponse, mockContext)).toBe(true);
      expect(gpt5Service.validateResponse(invalidResponse, mockContext)).toBe(false);
    });

    it('should handle API failures with fallback', async () => {
      // Mock API failure
      const mockOpenAI = await import('openai');
      vi.mocked(mockOpenAI.default).mockImplementation(() => ({
        chat: {
          completions: {
            create: vi.fn().mockRejectedValue(new Error('API Error'))
          }
        }
      } as any));

      const mockContext = {
        quickFacts: [],
        memoryFragments: [],
        conversationHistory: [],
        retrievalMetadata: {
          totalQuickFacts: 0,
          totalMemoryFragments: 0,
          totalConversationTurns: 0,
          retrievalTimeMs: 100,
          confidenceThreshold: 0.35,
          queryOptimizations: [],
          cacheHits: []
        }
      };

      await expect(gpt5Service.generateResponse(mockContext, 'test', 'template'))
        .rejects.toThrow('GPT-5 API failed');
    });
  });

  describe('ContextRetrievalEngine', () => {
    let contextEngine: ContextRetrievalEngine;

    beforeEach(() => {
      contextEngine = new ContextRetrievalEngine();
      vi.clearAllMocks();
    });

    it('should retrieve context with proper ordering', async () => {
      const result = await contextEngine.retrieveContext('avatar-123', 'test query');

      expect(result).toMatchObject({
        quickFacts: expect.any(Array),
        memoryFragments: expect.any(Array),
        conversationHistory: expect.any(Array),
        retrievalMetadata: expect.objectContaining({
          retrievalTimeMs: expect.any(Number),
          confidenceThreshold: expect.any(Number)
        })
      });
    });

    it('should apply confidence-based filtering correctly', async () => {
      const options = {
        confidenceThreshold: 0.5,
        fastMode: false
      };

      const result = await contextEngine.retrieveContext('avatar-123', 'test', options);
      
      // All returned facts should meet confidence threshold or be unique
      result.quickFacts.forEach(fact => {
        const isUnique = result.quickFacts.filter(f => f.key === fact.key).length === 1;
        expect(fact.confidence >= 0.5 || isUnique).toBe(true);
      });
    });

    it('should optimize queries for performance', () => {
      const optimization = contextEngine.optimizeQuery('simple query', { fastMode: true });

      expect(optimization).toMatchObject({
        skipMemoryFragments: expect.any(Boolean),
        limitQuickFacts: expect.any(Number),
        cacheStrategy: expect.any(String),
        estimatedTimeMs: expect.any(Number)
      });
    });

    it('should handle cache operations correctly', () => {
      contextEngine.clearCache();
      const stats = contextEngine.getCacheStats();
      
      expect(stats).toMatchObject({
        size: 0,
        keys: expect.any(Array)
      });
    });
  });

  describe('MemoryInjectionService', () => {
    let memoryInjection: MemoryInjectionService;

    beforeEach(() => {
      memoryInjection = new MemoryInjectionService();
    });

    it('should format context into structured template', () => {
      const mockContext = {
        quickFacts: [
          {
            id: '1',
            avatarId: 'avatar-123',
            key: 'name',
            value: 'Alice',
            confidence: 0.9,
            priority: 1,
            source: 'manual' as const,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z'
          }
        ],
        memoryFragments: [],
        conversationHistory: [],
        retrievalMetadata: {
          totalQuickFacts: 1,
          totalMemoryFragments: 0,
          totalConversationTurns: 0,
          retrievalTimeMs: 100,
          confidenceThreshold: 0.35,
          queryOptimizations: [],
          cacheHits: []
        }
      };

      const template = memoryInjection.formatContext(mockContext);

      expect(template).toContain('Alice');
      expect(template).toContain('Core Identity');
      expect(typeof template).toBe('string');
      expect(template.length).toBeGreaterThan(50);
    });

    it('should validate template structure', () => {
      const validTemplate = `
        ## Core Identity
        - Name: John
        
        ## Contextual Facts
        - Occupation: Engineer
        
        ## Conversation History
        (No recent conversation)
      `;

      const invalidTemplate = 'Just some random text';

      expect(memoryInjection.validateTemplate(validTemplate)).toBe(true);
      expect(memoryInjection.validateTemplate(invalidTemplate)).toBe(false);
    });

    it('should optimize template for different models', () => {
      const baseTemplate = 'Basic template content';
      
      const gpt5Optimized = memoryInjection.optimizeForModel(baseTemplate, 'gpt-5');
      const gpt4Optimized = memoryInjection.optimizeForModel(baseTemplate, 'gpt-4');

      expect(gpt5Optimized).toBeDefined();
      expect(gpt4Optimized).toBeDefined();
      expect(typeof gpt5Optimized).toBe('string');
      expect(typeof gpt4Optimized).toBe('string');
    });
  });

  describe('MemoryUpdatePipeline', () => {
    let memoryPipeline: MemoryUpdatePipeline;

    beforeEach(() => {
      memoryPipeline = new MemoryUpdatePipeline();
      vi.clearAllMocks();
    });

    it('should extract facts from conversation', async () => {
      const userInput = 'My dog Max loves to play fetch in the park';
      const assistantResponse = 'That sounds wonderful! Max must be very energetic.';

      const extractedFacts = await memoryPipeline.extractNewFacts(userInput, assistantResponse);

      expect(Array.isArray(extractedFacts)).toBe(true);
      expect(extractedFacts.length).toBeGreaterThanOrEqual(0);
      
      if (extractedFacts.length > 0) {
        expect(extractedFacts[0]).toMatchObject({
          key: expect.any(String),
          value: expect.any(String),
          confidence: expect.any(Number),
          priority: expect.any(Number),
          source: expect.any(String)
        });
      }
    });

    it('should resolve conflicts between facts', () => {
      const existingFact = {
        id: '1',
        avatarId: 'avatar-123',
        key: 'age',
        value: '25',
        confidence: 0.7,
        priority: 3,
        source: 'llm' as const,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };

      const newFact = {
        key: 'age',
        value: '26',
        confidence: 0.9,
        priority: 2,
        source: 'manual' as const,
        sourceReference: 'user-input-123'
      };

      const resolved = memoryPipeline.resolveConflicts(existingFact, newFact);

      expect(resolved.value).toBe('26'); // Higher confidence wins
      expect(resolved.confidence).toBe(0.9);
      expect(resolved.source).toBe('manual');
    });

    it('should process conversation turns completely', async () => {
      const result = await memoryPipeline.processConversationTurn('avatar-123', {
        conversationId: 'conv-123',
        userInput: 'I just got a new job as a teacher',
        assistantResponse: 'Congratulations on your new teaching position!'
      });

      expect(result).toMatchObject({
        factsExtracted: expect.any(Number),
        factsUpdated: expect.any(Number),
        memoriesCreated: expect.any(Number),
        conflicts: expect.any(Array),
        errors: expect.any(Array),
        processingTimeMs: expect.any(Number)
      });
    });
  });

  describe('FactScoringService', () => {
    let factScoring: FactScoringService;

    beforeEach(() => {
      factScoring = new FactScoringService();
    });

    it('should assign confidence scores based on source reliability', () => {
      const manualFact = { source: 'manual', content: 'John is 30 years old' };
      const llmFact = { source: 'llm', content: 'User might be around 25' };
      const heuristicFact = { source: 'heuristic', content: 'Estimated age: 28' };

      const manualScore = factScoring.calculateConfidence(manualFact);
      const llmScore = factScoring.calculateConfidence(llmFact);
      const heuristicScore = factScoring.calculateConfidence(heuristicFact);

      expect(manualScore).toBeGreaterThan(llmScore);
      expect(llmScore).toBeGreaterThan(heuristicScore);
      expect(manualScore).toBeGreaterThan(0.8);
      expect(heuristicScore).toBeLessThan(0.6);
    });

    it('should assign priority values correctly', () => {
      const coreFact = { key: 'name', value: 'John' };
      const contextualFact = { key: 'hobby', value: 'reading' };
      const temporaryFact = { key: 'current_mood', value: 'happy' };

      const corePriority = factScoring.calculatePriority(coreFact);
      const contextualPriority = factScoring.calculatePriority(contextualFact);
      const temporaryPriority = factScoring.calculatePriority(temporaryFact);

      expect(corePriority).toBeLessThan(contextualPriority); // Lower number = higher priority
      expect(contextualPriority).toBeLessThan(temporaryPriority);
      expect(corePriority).toBeLessThanOrEqual(3);
    });

    it('should apply recency bonus correctly', () => {
      const recentFact = {
        createdAt: new Date().toISOString(),
        confidence: 0.7
      };

      const oldFact = {
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
        confidence: 0.7
      };

      const recentScore = factScoring.applyRecencyBonus(recentFact);
      const oldScore = factScoring.applyRecencyBonus(oldFact);

      expect(recentScore).toBeGreaterThan(oldScore);
    });

    it('should enforce confidence thresholds', () => {
      const highConfidenceFact = { confidence: 0.8, key: 'name' };
      const lowConfidenceFact = { confidence: 0.2, key: 'hobby' };
      const lowConfidencePlace = { confidence: 0.3, key: 'favorite_place' };

      expect(factScoring.meetsThreshold(highConfidenceFact)).toBe(true);
      expect(factScoring.meetsThreshold(lowConfidenceFact)).toBe(false);
      expect(factScoring.meetsThreshold(lowConfidencePlace)).toBe(true); // Place facts have lower threshold
    });
  });

  describe('ConversationHistoryManager', () => {
    let historyManager: ConversationHistoryManager;

    beforeEach(() => {
      historyManager = new ConversationHistoryManager();
    });

    it('should create new conversation sessions', () => {
      const session = historyManager.createSession('avatar-123', 'visitor-456');

      expect(session).toMatchObject({
        sessionId: expect.any(String),
        avatarId: 'avatar-123',
        visitorId: 'visitor-456',
        turns: [],
        startTime: expect.any(String),
        lastActivity: expect.any(String),
        entityBindings: expect.any(Map)
      });
    });

    it('should add turns to conversation sessions', () => {
      const session = historyManager.createSession('avatar-123', 'visitor-456');
      
      historyManager.addTurn(session.sessionId, {
        role: 'user',
        content: 'Hello there!',
        timestamp: new Date().toISOString()
      });

      historyManager.addTurn(session.sessionId, {
        role: 'assistant',
        content: 'Hello! How can I help you?',
        timestamp: new Date().toISOString()
      });

      const updatedSession = historyManager.getSession(session.sessionId);
      expect(updatedSession?.turns).toHaveLength(2);
      expect(updatedSession?.turns[0].role).toBe('user');
      expect(updatedSession?.turns[1].role).toBe('assistant');
    });

    it('should manage entity bindings', () => {
      const session = historyManager.createSession('avatar-123', 'visitor-456');
      
      historyManager.bindEntity(session.sessionId, 'pet_name', {
        value: 'Buddy',
        confidence: 0.9,
        boundAt: new Date().toISOString()
      });

      const updatedSession = historyManager.getSession(session.sessionId);
      expect(updatedSession?.entityBindings.has('pet_name')).toBe(true);
      expect(updatedSession?.entityBindings.get('pet_name')?.value).toBe('Buddy');
    });

    it('should clean up expired sessions', () => {
      const session1 = historyManager.createSession('avatar-123', 'visitor-1');
      const session2 = historyManager.createSession('avatar-456', 'visitor-2');

      // Manually set one session as expired
      const expiredSession = historyManager.getSession(session1.sessionId);
      if (expiredSession) {
        expiredSession.lastActivity = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
      }

      const cleanedCount = historyManager.cleanupExpiredSessions(24 * 60 * 60 * 1000);

      expect(cleanedCount).toBe(1);
      expect(historyManager.getSession(session1.sessionId)).toBeUndefined();
      expect(historyManager.getSession(session2.sessionId)).toBeDefined();
    });
  });

  describe('FastModeOptimizer', () => {
    let optimizer: FastModeOptimizer;

    beforeEach(() => {
      optimizer = new FastModeOptimizer();
    });

    it('should optimize retrieval options for fast mode', () => {
      const options = optimizer.optimizeRetrievalOptions('simple query', true);

      expect(options).toMatchObject({
        fastMode: true,
        memoryLimit: expect.any(Number),
        historyLimit: expect.any(Number),
        confidenceThreshold: expect.any(Number)
      });

      expect(options.memoryLimit).toBeLessThanOrEqual(10);
      expect(options.historyLimit).toBeLessThanOrEqual(5);
    });

    it('should determine if memory fragments should be skipped', () => {
      const simpleQuery = 'hi';
      const complexQuery = 'tell me about my childhood memories';

      expect(optimizer.shouldSkipMemoryFragments(simpleQuery, true)).toBe(true);
      expect(optimizer.shouldSkipMemoryFragments(complexQuery, true)).toBe(false);
      expect(optimizer.shouldSkipMemoryFragments(simpleQuery, false)).toBe(false);
    });

    it('should provide performance estimates', () => {
      const estimate = optimizer.estimatePerformance({
        fastMode: true,
        memoryLimit: 5,
        historyLimit: 3,
        skipMemoryFragments: true
      });

      expect(estimate).toMatchObject({
        estimatedTimeMs: expect.any(Number),
        cacheStrategy: expect.any(String),
        parallelQueries: expect.any(Boolean)
      });

      expect(estimate.estimatedTimeMs).toBeLessThan(500);
    });
  });

  describe('SchemaCompatibilityLayer', () => {
    let schemaLayer: SchemaCompatibilityLayer;

    beforeEach(() => {
      schemaLayer = new SchemaCompatibilityLayer();
    });

    it('should resolve legacy table names', () => {
      expect(schemaLayer.resolveTableName('avatars')).toBe('avatar_profiles');
      expect(schemaLayer.resolveTableName('quick_facts')).toBe('quick_facts');
      expect(schemaLayer.resolveTableName('memory_fragments')).toBe('memory_fragments');
    });

    it('should validate column existence', async () => {
      const validColumn = await schemaLayer.validateColumnExists('avatar_profiles', 'id');
      const invalidColumn = await schemaLayer.validateColumnExists('avatar_profiles', 'nonexistent_column');

      expect(validColumn).toBe(true);
      expect(invalidColumn).toBe(false);
    });

    it('should qualify join columns', () => {
      const query = 'SELECT * FROM avatar_profiles JOIN quick_facts ON id = avatar_id';
      const qualified = schemaLayer.qualifyJoinColumns(query);

      expect(qualified).toContain('avatar_profiles.id');
      expect(qualified).toContain('quick_facts.avatar_id');
    });

    it('should validate constraints', () => {
      const validData = {
        change_source: 'manual',
        confidence: 0.8,
        priority: 1
      };

      const invalidData = {
        change_source: 'invalid_source',
        confidence: 1.5,
        priority: 0
      };

      const validResult = schemaLayer.validateConstraints('fact_history', validData);
      const invalidResult = schemaLayer.validateConstraints('fact_history', invalidData);

      expect(validResult.isValid).toBe(true);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
    });
  });

  describe('ErrorHandlingService', () => {
    let errorHandler: ErrorHandlingService;

    beforeEach(() => {
      errorHandler = new ErrorHandlingService();
    });

    it('should handle context retrieval failures', async () => {
      const mockError = new Error('Database connection failed');
      
      const fallback = await errorHandler.handleContextRetrievalError(mockError, 'avatar-123');

      expect(fallback).toMatchObject({
        quickFacts: expect.any(Array),
        memoryFragments: expect.any(Array),
        conversationHistory: expect.any(Array),
        retrievalMetadata: expect.objectContaining({
          fallbackUsed: true,
          originalError: 'Database connection failed'
        })
      });
    });

    it('should implement retry logic with exponential backoff', async () => {
      let attemptCount = 0;
      const mockOperation = vi.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Temporary failure');
        }
        return Promise.resolve('Success');
      });

      const result = await errorHandler.retryWithBackoff(mockOperation, 3, 100);

      expect(result).toBe('Success');
      expect(attemptCount).toBe(3);
    });

    it('should queue failed memory updates', () => {
      const failedUpdate = {
        avatarId: 'avatar-123',
        operation: 'updateQuickFact',
        data: { key: 'name', value: 'John' },
        error: 'Database timeout'
      };

      errorHandler.queueFailedUpdate(failedUpdate);
      
      const queueSize = errorHandler.getQueueSize();
      expect(queueSize).toBe(1);
    });

    it('should process queued updates', async () => {
      const update1 = {
        avatarId: 'avatar-123',
        operation: 'updateQuickFact',
        data: { key: 'name', value: 'John' },
        error: 'Timeout'
      };

      const update2 = {
        avatarId: 'avatar-456',
        operation: 'createMemoryFragment',
        data: { text: 'User loves hiking' },
        error: 'Connection lost'
      };

      errorHandler.queueFailedUpdate(update1);
      errorHandler.queueFailedUpdate(update2);

      const processed = await errorHandler.processQueuedUpdates();

      expect(processed.attempted).toBe(2);
      expect(processed.successful).toBeGreaterThanOrEqual(0);
      expect(processed.failed).toBeGreaterThanOrEqual(0);
    });
  });
});