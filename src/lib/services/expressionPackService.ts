/**
 * Expression Pack Service
 * Handles loading and managing expression packs for avatars
 * Enhanced with Task 6: Expression preloading and buffer management
 */

import { StoredExpression, ExpressionStorageService } from './expressionStorageService';
import { ExpressionBufferManager, getGlobalBufferManager } from '../expressionBufferManager';
import { logger } from '../logger';

export interface ExpressionPack {
  id: string;
  avatarId: string;
  expressions: StoredExpression[];
  buffers: Map<string, AudioBuffer>;
  loadedAt: Date;
}

export interface ExpressionPackLoadOptions {
  avatarId: string;
  includeUserExpressions?: boolean;
  maxExpressionsPerType?: number;
}

/**
 * Service for loading and managing expression packs
 */
export class ExpressionPackService {
  private static cache = new Map<string, ExpressionPack>();
  private static readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Load expression pack for an avatar
   * This loads the expressions but doesn't activate overlays (controlled by feature flag)
   * Task 6: Enhanced with improved buffer preloading and management
   */
  static async loadExpressionPack(options: ExpressionPackLoadOptions): Promise<ExpressionPack | null> {
    const cacheKey = this.getCacheKey(options);
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) {
      logger.debug('Using cached expression pack', { avatarId: options.avatarId });
      return cached;
    }

    try {
      logger.debug('Loading expression pack', { avatarId: options.avatarId });
      
      // Load avatar expressions (admin expressions)
      let avatarExpressions: StoredExpression[] = [];
      try {
        avatarExpressions = await ExpressionStorageService.getExpressionsByOwner(
          options.avatarId,
          'avatar'
        );
      } catch (storageError) {
        console.error('[ExpressionPackService] Failed to load avatar expressions:', {
          avatarId: options.avatarId,
          error: storageError instanceof Error ? storageError.message : String(storageError),
          stack: storageError instanceof Error ? storageError.stack : undefined
        });
        
        // Continue with empty array - will create fallback pack
        avatarExpressions = [];
      }

      // Optionally load user expressions
      let userExpressions: StoredExpression[] = [];
      if (options.includeUserExpressions) {
        try {
          // For now, we'll skip user expressions in jonathan-demo
          // This will be implemented in P1 when user expression upload is added
          userExpressions = [];
        } catch (userError) {
          console.warn('[ExpressionPackService] Failed to load user expressions:', userError);
          userExpressions = [];
        }
      }

      // Combine and filter expressions with validation
      const allExpressions = [...avatarExpressions, ...userExpressions]
        .filter(expr => {
          // Validate expression object
          if (!expr || typeof expr !== 'object') {
            console.warn('[ExpressionPackService] Invalid expression object:', expr);
            return false;
          }
          
          // Check required fields
          if (!expr.id || !expr.type || !expr.cdnUrl) {
            console.warn('[ExpressionPackService] Expression missing required fields:', {
              id: expr.id,
              type: expr.type,
              cdnUrl: expr.cdnUrl
            });
            return false;
          }
          
          return expr.status === 'active';
        })
        .slice(0, options.maxExpressionsPerType ? options.maxExpressionsPerType * 7 : 50); // 7 expression types

      if (allExpressions.length === 0) {
        logger.debug('No active expressions found for avatar, creating fallback pack', { avatarId: options.avatarId });
        
        // Create fallback pack instead of returning null
        const fallbackPack = this.createMockExpressionPack(options.avatarId);
        this.cache.set(cacheKey, fallbackPack);
        return fallbackPack;
      }

      // Task 6: Use enhanced buffer manager for preloading with validation and error handling
      let buffers = new Map<string, AudioBuffer>();
      try {
        const bufferManager = await getGlobalBufferManager({
          maxBuffers: 50,
          maxMemoryBytes: 50 * 1024 * 1024, // 50MB
          enableValidation: true,
          loadTimeoutMs: 10000,
          maxConcurrentLoads: 5
        });

        buffers = await bufferManager.preloadExpressions(allExpressions);
      } catch (bufferError) {
        console.error('[ExpressionPackService] Failed to preload buffers:', {
          avatarId: options.avatarId,
          error: bufferError instanceof Error ? bufferError.message : String(bufferError),
          stack: bufferError instanceof Error ? bufferError.stack : undefined
        });
        
        // Continue with empty buffers - expressions will load on-demand
        buffers = new Map();
      }

      const pack: ExpressionPack = {
        id: cacheKey,
        avatarId: options.avatarId,
        expressions: allExpressions,
        buffers,
        loadedAt: new Date()
      };

      // Cache the pack
      this.cache.set(cacheKey, pack);

      logger.info('Expression pack loaded successfully', {
        avatarId: options.avatarId,
        expressionCount: allExpressions.length,
        bufferCount: buffers.size
      });

      return pack;

    } catch (error) {
      const errorDetails = {
        avatarId: options.avatarId,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : 'Unknown'
      };
      
      console.error('[ExpressionPackService] Failed to load expression pack:', errorDetails);
      
      // Always return a fallback pack to prevent null errors
      try {
        const fallbackPack = this.createMockExpressionPack(options.avatarId);
        console.warn('[ExpressionPackService] Returning mock expression pack due to load failure', {
          avatarId: options.avatarId,
          expressionCount: fallbackPack.expressions.length
        });
        
        this.cache.set(cacheKey, fallbackPack);
        return fallbackPack;
      } catch (fallbackError) {
        console.error('[ExpressionPackService] Failed to create fallback expression pack:', {
          avatarId: options.avatarId,
          error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
        });
        
        // Last resort - return minimal pack
        return {
          id: cacheKey,
          avatarId: options.avatarId,
          expressions: [],
          buffers: new Map(),
          loadedAt: new Date()
        };
      }
    }
  }

  /**
   * Legacy preload method - now delegates to ExpressionBufferManager
   * @deprecated Use ExpressionBufferManager directly for better control
   */
  private static async preloadExpressionBuffers(expressions: StoredExpression[]): Promise<Map<string, AudioBuffer>> {
    try {
      const bufferManager = await getGlobalBufferManager();
      return await bufferManager.preloadExpressions(expressions);
    } catch (error) {
      logger.error('Legacy preload method failed', { error });
      return new Map();
    }
  }

  /**
   * Get default expression pack for jonathan-demo
   * This loads a predefined set of expressions for the demo
   * Always returns a valid pack to prevent null errors
   */
  static async getJonathanDemoExpressionPack(): Promise<ExpressionPack> {
    const cacheKey = 'jonathan-demo-default';
    
    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) {
      logger.debug('Using cached jonathan-demo expression pack');
      return cached;
    }

    try {
      // Try to load from database first
      const pack = await this.loadExpressionPack({
        avatarId: 'jonathan-demo',
        includeUserExpressions: false,
        maxExpressionsPerType: 5
      });
      
      if (pack && pack.expressions.length > 0) {
        logger.debug('Loaded jonathan-demo expressions from database', {
          expressionCount: pack.expressions.length
        });
        return pack;
      }
    } catch (error) {
      console.warn('[ExpressionPackService] Failed to load jonathan-demo from database, using fallback:', {
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Always return mock pack as fallback
    const mockPack = this.createMockExpressionPack('jonathan-demo');
    this.cache.set(cacheKey, mockPack);
    
    logger.debug('Using mock expression pack for jonathan-demo', {
      expressionCount: mockPack.expressions.length
    });
    
    return mockPack;
  }

  /**
   * Clear expression pack cache
   */
  static clearCache(): void {
    this.cache.clear();
    logger.debug('Expression pack cache cleared');
  }

  /**
   * Get cache key for expression pack options
   */
  private static getCacheKey(options: ExpressionPackLoadOptions): string {
    return `${options.avatarId}-${options.includeUserExpressions || false}-${options.maxExpressionsPerType || 'all'}`;
  }

  /**
   * Check if cached pack is still valid
   */
  private static isCacheValid(pack: ExpressionPack): boolean {
    const age = Date.now() - pack.loadedAt.getTime();
    return age < this.CACHE_TTL_MS;
  }

  /**
   * Create a mock expression pack for development/testing
   * This is used when no expressions are available in the database
   */
  static createMockExpressionPack(avatarId: string): ExpressionPack {
    const mockExpressions: StoredExpression[] = [
      {
        id: 'mock-laugh-1',
        ownerId: avatarId,
        ownerType: 'avatar',
        filename: 'laugh.mp3',
        type: 'laugh',
        tone: 'cheerful',
        placementHints: ['funny', 'joke', 'humor'],
        durationMs: 800,
        priority: 75, // Admin priority
        status: 'active',
        cdnUrl: '/snippets/laugh_short.mp3', // Use existing snippet
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'mock-affirmation-1',
        ownerId: avatarId,
        ownerType: 'avatar',
        filename: 'absolutely.mp3',
        type: 'affirmation',
        tone: 'confident',
        placementHints: ['yes', 'absolutely', 'exactly'],
        durationMs: 600,
        priority: 70, // Admin priority
        status: 'active',
        cdnUrl: '/snippets/absolutely.mp3', // Use existing snippet
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'mock-thinking-1',
        ownerId: avatarId,
        ownerType: 'avatar',
        filename: 'hmm.mp3',
        type: 'filler',
        tone: 'thoughtful',
        placementHints: ['thinking', 'considering'],
        durationMs: 500,
        priority: 60, // Admin priority
        status: 'active',
        cdnUrl: '/snippets/hmm.mp3', // Use existing snippet
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    return {
      id: `mock-${avatarId}`,
      avatarId,
      expressions: mockExpressions,
      buffers: new Map(), // Will be populated by the component
      loadedAt: new Date()
    };
  }
}