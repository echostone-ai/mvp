import { StructuredContext, QuickFact, MemoryFragment, ConversationTurn } from './types';
import { ErrorHandlingService } from './errorHandlingService';

export interface FallbackContext {
  quickFacts: QuickFact[];
  memoryFragments: MemoryFragment[];
  conversationHistory: ConversationTurn[];
  fallbackLevel: 'none' | 'partial' | 'minimal' | 'emergency';
  source: string;
}

export class ContextFallbackService {
  constructor(private errorHandler: ErrorHandlingService) {}

  /**
   * Provide fallback context when primary retrieval fails
   */
  async getFallbackContext(
    avatarId: string,
    query: string,
    originalError: Error
  ): Promise<StructuredContext> {
    console.warn(`Context retrieval failed for avatar ${avatarId}, attempting fallback:`, originalError.message);

    // Try cached data first
    const cachedContext = this.errorHandler.getCachedContext(avatarId);
    if (cachedContext) {
      console.log('Using cached context as fallback');
      return {
        ...cachedContext,
        retrievalMetadata: {
          ...cachedContext.retrievalMetadata,
          source: 'cache_fallback',
          fallbackReason: originalError.message
        }
      };
    }

    // Try partial context from individual cached components
    const partialContext = await this.getPartialContext(avatarId);
    if (partialContext.quickFacts.length > 0 || partialContext.memoryFragments.length > 0) {
      console.log('Using partial cached context as fallback');
      return {
        quickFacts: partialContext.quickFacts,
        memoryFragments: partialContext.memoryFragments,
        conversationHistory: partialContext.conversationHistory,
        retrievalMetadata: {
          source: 'partial_cache_fallback',
          timestamp: new Date().toISOString(),
          totalFacts: partialContext.quickFacts.length,
          totalMemories: partialContext.memoryFragments.length,
          totalHistory: partialContext.conversationHistory.length,
          cacheHit: true,
          fallbackReason: originalError.message
        }
      };
    }

    // Use minimal emergency context
    console.log('Using minimal emergency context as fallback');
    return this.getEmergencyContext(avatarId, originalError.message);
  }

  /**
   * Get partial context from individual cached components
   */
  private async getPartialContext(avatarId: string): Promise<FallbackContext> {
    const quickFacts = this.errorHandler.getCachedData<QuickFact[]>(`quickfacts:${avatarId}`) || [];
    const memoryFragments = this.errorHandler.getCachedData<MemoryFragment[]>(`memories:${avatarId}`) || [];
    const conversationHistory = this.errorHandler.getCachedData<ConversationTurn[]>(`history:${avatarId}`) || [];

    return {
      quickFacts,
      memoryFragments,
      conversationHistory,
      fallbackLevel: 'partial',
      source: 'partial_cache'
    };
  }

  /**
   * Provide minimal emergency context when all else fails
   */
  private getEmergencyContext(avatarId: string, errorReason: string): StructuredContext {
    // Provide basic avatar identity facts that should always be available
    const emergencyFacts: QuickFact[] = [
      {
        id: 'emergency_identity',
        avatarId,
        key: 'identity',
        value: 'I am your personal avatar assistant',
        confidence: 1.0,
        priority: 1,
        source: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'emergency_capability',
        avatarId,
        key: 'capability',
        value: 'I can help you with conversations and remember information you share',
        confidence: 1.0,
        priority: 2,
        source: 'manual',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    return {
      quickFacts: emergencyFacts,
      memoryFragments: [],
      conversationHistory: [],
      retrievalMetadata: {
        source: 'emergency_fallback',
        timestamp: new Date().toISOString(),
        totalFacts: emergencyFacts.length,
        totalMemories: 0,
        totalHistory: 0,
        cacheHit: false,
        fallbackReason: errorReason
      }
    };
  }

  /**
   * Validate fallback context quality
   */
  validateFallbackContext(context: StructuredContext): {
    isValid: boolean;
    quality: 'high' | 'medium' | 'low' | 'minimal';
    warnings: string[];
  } {
    const warnings: string[] = [];
    let quality: 'high' | 'medium' | 'low' | 'minimal' = 'high';

    // Check if we have any meaningful context
    const totalContext = context.quickFacts.length + 
                         context.memoryFragments.length + 
                         context.conversationHistory.length;

    if (totalContext === 0) {
      warnings.push('No context data available');
      quality = 'minimal';
    } else if (totalContext < 3) {
      warnings.push('Very limited context data');
      quality = 'low';
    } else if (totalContext < 8) {
      warnings.push('Limited context data');
      quality = 'medium';
    }

    // Check for essential identity facts
    const hasIdentityFacts = context.quickFacts.some(fact => 
      ['name', 'identity', 'personality'].includes(fact.key.toLowerCase())
    );

    if (!hasIdentityFacts) {
      warnings.push('Missing essential identity information');
      // Only downgrade if we have some context but missing identity
      if (quality === 'high' && totalContext > 0) {
        quality = 'medium';
      } else if (quality === 'medium' && totalContext < 3) {
        quality = 'low';
      }
    }

    // Check for recent conversation history
    if (context.conversationHistory.length === 0) {
      warnings.push('No conversation history available');
      // Only downgrade slightly for missing history
      if (quality === 'high' && totalContext < 8) {
        quality = 'medium';
      }
    }

    // Check if this is from cache fallback
    if (context.retrievalMetadata.source.includes('fallback')) {
      warnings.push('Using fallback context - may be stale');
    }

    return {
      isValid: totalContext > 0,
      quality,
      warnings
    };
  }

  /**
   * Enhance fallback context with computed facts
   */
  enhanceFallbackContext(context: StructuredContext): StructuredContext {
    const enhancedFacts = [...context.quickFacts];

    // Add computed facts based on available data
    if (context.memoryFragments.length > 0) {
      const memoryCount: QuickFact = {
        id: 'computed_memory_count',
        avatarId: context.quickFacts[0]?.avatarId || 'unknown',
        key: 'memory_count',
        value: `${context.memoryFragments.length} memories available`,
        confidence: 1.0,
        priority: 10,
        source: 'heuristic',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      enhancedFacts.push(memoryCount);
    }

    if (context.conversationHistory.length > 0) {
      const lastInteraction = context.conversationHistory[context.conversationHistory.length - 1];
      const lastInteractionFact: QuickFact = {
        id: 'computed_last_interaction',
        avatarId: context.quickFacts[0]?.avatarId || 'unknown',
        key: 'last_interaction',
        value: `Last spoke ${this.getRelativeTime(new Date(lastInteraction.timestamp))}`,
        confidence: 1.0,
        priority: 5,
        source: 'heuristic',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      enhancedFacts.push(lastInteractionFact);
    }

    return {
      ...context,
      quickFacts: enhancedFacts,
      retrievalMetadata: {
        ...context.retrievalMetadata,
        source: `${context.retrievalMetadata.source}_enhanced`,
        totalFacts: enhancedFacts.length
      }
    };
  }

  private getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'just now';
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  }
}