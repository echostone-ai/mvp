/**
 * Example usage of the Error Handling and Graceful Degradation System
 * 
 * This example demonstrates how to integrate the error handling services
 * into a complete conversation flow with proper fallback mechanisms.
 */

import { ErrorHandlingService } from '../errorHandlingService';
import { ContextFallbackService } from '../contextFallbackService';
import { GPT5ApiService } from '../gpt5ApiService';
import { MemoryUpdateQueueService } from '../memoryUpdateQueueService';
import { StructuredContext } from '../types';

// Initialize the error handling system
const errorHandler = new ErrorHandlingService(
  {
    maxRetries: 3,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2
  },
  {
    contextTTL: 300000, // 5 minutes
    quickFactsTTL: 30000, // 30 seconds
    memoryFragmentsTTL: 60000, // 1 minute
    maxCacheSize: 1000
  }
);

const fallbackService = new ContextFallbackService(errorHandler);
const gpt5Service = new GPT5ApiService(
  {
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-5-turbo',
    fallbackModel: 'gpt-4-turbo-preview',
    maxTokens: 2000,
    temperature: 0.7,
    timeout: 30000
  },
  errorHandler
);
const memoryQueue = new MemoryUpdateQueueService(errorHandler);

/**
 * Example: Complete conversation flow with error handling
 */
export async function handleConversationWithErrorHandling(
  avatarId: string,
  userInput: string,
  visitorId?: string
): Promise<{
  response: string;
  confidence: number;
  fallbacksUsed: string[];
  systemHealth: any;
}> {
  const fallbacksUsed: string[] = [];
  let context: StructuredContext;

  try {
    // Step 1: Retrieve context with fallback
    context = await retrieveContextWithFallback(avatarId, userInput, fallbacksUsed);

    // Step 2: Generate response with fallback
    const gptResponse = await gpt5Service.generateResponse(context, userInput);
    
    if (gptResponse.modelUsed.includes('fallback') || gptResponse.modelUsed === 'emergency_fallback') {
      fallbacksUsed.push(`gpt_${gptResponse.modelUsed}`);
    }

    // Step 3: Update memory asynchronously (with queue fallback)
    await updateMemoryWithFallback(avatarId, userInput, gptResponse.text, gptResponse.extractedFacts);

    // Step 4: Cache successful context for future fallback
    errorHandler.cacheContextComponents(avatarId, context);

    return {
      response: gptResponse.text,
      confidence: gptResponse.confidence,
      fallbacksUsed,
      systemHealth: getSystemHealth()
    };

  } catch (error) {
    console.error('Complete conversation failure:', error);
    
    // Ultimate fallback - return a basic response
    fallbacksUsed.push('complete_system_fallback');
    
    return {
      response: "I'm experiencing some technical difficulties right now. Please try again in a moment.",
      confidence: 0.1,
      fallbacksUsed,
      systemHealth: getSystemHealth()
    };
  }
}

/**
 * Retrieve context with multiple fallback levels
 */
async function retrieveContextWithFallback(
  avatarId: string,
  query: string,
  fallbacksUsed: string[]
): Promise<StructuredContext> {
  try {
    // Try primary context retrieval (this would integrate with ContextRetrievalEngine)
    return await errorHandler.executeWithRetry(
      () => simulatePrimaryContextRetrieval(avatarId, query),
      'context_retrieval'
    );
  } catch (error) {
    console.warn('Primary context retrieval failed, using fallback:', error);
    fallbacksUsed.push('context_fallback');
    
    // Use fallback service
    const fallbackContext = await fallbackService.getFallbackContext(
      avatarId,
      query,
      error as Error
    );

    // Enhance fallback context
    return fallbackService.enhanceFallbackContext(fallbackContext);
  }
}

/**
 * Update memory with queue fallback
 */
async function updateMemoryWithFallback(
  avatarId: string,
  userInput: string,
  assistantResponse: string,
  extractedFacts: any[]
): Promise<void> {
  try {
    // Queue fact updates (will execute immediately if possible, queue if not)
    if (extractedFacts.length > 0) {
      await memoryQueue.queueQuickFactUpdate(avatarId, extractedFacts, 5);
    }

    // Queue memory fragment update
    await memoryQueue.queueMemoryFragmentUpdate(
      avatarId,
      `User: ${userInput}\nAssistant: ${assistantResponse}`,
      {
        conversationId: `conv_${Date.now()}`,
        type: 'conversation_turn',
        timestamp: new Date().toISOString()
      },
      7
    );

    // Queue fact extraction for future processing
    await memoryQueue.queueFactExtraction(
      avatarId,
      userInput,
      assistantResponse,
      8
    );

  } catch (error) {
    console.warn('Memory update failed, operations queued for retry:', error);
    // Operations are automatically queued by the MemoryUpdateQueueService
  }
}

/**
 * Get comprehensive system health status
 */
function getSystemHealth(): any {
  const queueStatus = errorHandler.getQueueStatus();
  const cacheStats = errorHandler.getCacheStats();
  const memoryQueueStats = memoryQueue.getQueueStats();

  return {
    errorQueue: {
      totalOperations: queueStatus.totalOperations,
      operationsByType: queueStatus.operationsByType,
      oldestOperation: queueStatus.oldestOperation
    },
    cache: {
      totalEntries: cacheStats.totalEntries,
      totalSize: cacheStats.totalSize,
      oldestEntry: cacheStats.oldestEntry
    },
    memoryQueue: {
      successRate: memoryQueueStats.successRate,
      totalOperations: memoryQueueStats.totalOperations,
      averageRetries: memoryQueueStats.averageRetries
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * Example: Batch conversation processing with error handling
 */
export async function processBatchConversations(
  conversations: Array<{ avatarId: string; userInput: string; visitorId?: string }>
): Promise<Array<{ success: boolean; response?: string; error?: string }>> {
  const results = [];

  for (const conv of conversations) {
    try {
      const result = await handleConversationWithErrorHandling(
        conv.avatarId,
        conv.userInput,
        conv.visitorId
      );

      results.push({
        success: true,
        response: result.response,
        confidence: result.confidence,
        fallbacksUsed: result.fallbacksUsed
      });

    } catch (error) {
      results.push({
        success: false,
        error: (error as Error).message
      });
    }
  }

  return results;
}

/**
 * Example: System maintenance and cleanup
 */
export async function performSystemMaintenance(): Promise<{
  cacheCleared: number;
  queueProcessed: number;
  systemHealth: any;
}> {
  // Clear expired cache entries
  const cacheCleared = errorHandler.clearExpiredCache();

  // Get queue status before cleanup
  const queueStatus = errorHandler.getQueueStatus();
  const queueProcessed = queueStatus.totalOperations;

  // Clear completed operations
  memoryQueue.clearCompleted();

  console.log(`Maintenance completed: ${cacheCleared} cache entries cleared, ${queueProcessed} queue operations processed`);

  return {
    cacheCleared,
    queueProcessed,
    systemHealth: getSystemHealth()
  };
}

/**
 * Example: Graceful system shutdown
 */
export async function gracefulShutdown(): Promise<void> {
  console.log('Starting graceful shutdown...');

  // Stop accepting new operations
  memoryQueue.pauseProcessing();

  // Process any remaining high-priority operations
  const finalStats = memoryQueue.getQueueStats();
  console.log(`Shutting down with ${finalStats.totalOperations} operations remaining`);

  // Shutdown services
  await memoryQueue.shutdown();
  await errorHandler.shutdown();

  console.log('Graceful shutdown completed');
}

/**
 * Simulate primary context retrieval (would be replaced with actual implementation)
 */
async function simulatePrimaryContextRetrieval(
  avatarId: string,
  query: string
): Promise<StructuredContext> {
  // Simulate occasional failures
  if (Math.random() < 0.2) {
    throw new Error('Database connection timeout');
  }

  // Simulate successful retrieval
  return {
    quickFacts: [
      {
        id: '1',
        avatarId,
        key: 'name',
        value: 'John Doe',
        confidence: 0.9,
        priority: 1,
        source: 'manual',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }
    ],
    memoryFragments: [
      {
        id: '1',
        avatarId,
        fragmentText: 'User enjoys morning coffee',
        conversationContext: {
          source: 'conversation',
          type: 'user',
          conversationId: 'conv1'
        },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }
    ],
    conversationHistory: [
      {
        role: 'user',
        content: query,
        timestamp: new Date().toISOString()
      }
    ],
    retrievalMetadata: {
      source: 'database',
      timestamp: new Date().toISOString(),
      totalFacts: 1,
      totalMemories: 1,
      totalHistory: 1
    }
  };
}

// Example usage:
/*
async function main() {
  try {
    const result = await handleConversationWithErrorHandling(
      'avatar_123',
      'Hello, how are you today?',
      'visitor_456'
    );

    console.log('Response:', result.response);
    console.log('Confidence:', result.confidence);
    console.log('Fallbacks used:', result.fallbacksUsed);
    console.log('System health:', result.systemHealth);

  } catch (error) {
    console.error('Conversation failed:', error);
  }
}

// Cleanup on process exit
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);
*/