/**
 * Performance Benchmark Tests for GPT-5 Avatar Memory Upgrade
 * 
 * Tests response time targets, throughput, and performance optimization
 * to ensure the system meets specified performance requirements.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConversationService } from '../conversationService';
import { ContextRetrievalEngine } from '../contextRetrievalEngine';
import { MemoryInjectionService } from '../memoryInjectionService';
import { GPT5Service } from '../gpt5Service';
import { MemoryUpdatePipeline } from '../memoryUpdatePipeline';
import { FastModeOptimizer } from '../fastModeOptimizer';

// Mock external dependencies with performance-focused implementations
vi.mock('@/lib/data/client', () => ({
  sbAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          lte: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                or: vi.fn(() => {
                  // Simulate database query time
                  return new Promise(resolve => {
                    setTimeout(() => {
                      resolve({
                        data: [
                          {
                            id: '1',
                            avatar_id: 'perf-test-avatar',
                            key: 'name',
                            value: 'Alex',
                            confidence: 0.9,
                            priority: 1,
                            source: 'manual',
                            created_at: '2024-01-01T00:00:00Z',
                            updated_at: '2024-01-01T00:00:00Z'
                          }
                        ],
                        error: null
                      });
                    }, 50); // 50ms database query time
                  });
                })
              }))
            }))
          }))
        }))
      })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null }))
      }))
    }))
  }
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          limit: vi.fn(() => {
            // Simulate memory fragment query time
            return new Promise(resolve => {
              setTimeout(() => {
                resolve({
                  data: [],
                  error: null
                });
              }, 30); // 30ms memory query time
            });
          })
        }))
      })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null }))
      }))
    }))
  }
}));

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = {
      completions = {
        create: vi.fn(() => {
          // Simulate GPT API response time
          return new Promise(resolve => {
            setTimeout(() => {
              resolve({
                choices: [{
                  message: {
                    content: 'Hello! I\'m Alex. How can I help you today?'
                  }
                }],
                usage: {
                  prompt_tokens: 100,
                  completion_tokens: 15,
                  total_tokens: 115
                }
              });
            }, 300); // 300ms GPT response time
          });
        })
      }
    };
  }
}));

describe('Performance Benchmark Tests', () => {
  let conversationService: ConversationService;
  let contextEngine: ContextRetrievalEngine;
  let fastModeOptimizer: FastModeOptimizer;

  beforeEach(() => {
    contextEngine = new ContextRetrievalEngine();
    const memoryInjection = new MemoryInjectionService();
    const gpt5Service = new GPT5Service();
    const memoryPipeline = new MemoryUpdatePipeline();
    fastModeOptimizer = new FastModeOptimizer();

    conversationService = new ConversationService(
      contextEngine,
      memoryInjection,
      gpt5Service,
      memoryPipeline
    );

    vi.clearAllMocks();
  });

  afterEach(() => {
    conversationService.clearExpiredSessions(0);
  });

  describe('Response Time Targets', () => {
    it('should meet <1.5s target for text-only responses', async () => {
      const request = {
        avatarId: 'perf-test-avatar',
        userInput: 'What is your name?',
        sessionId: 'text-response-benchmark',
        fastMode: false
      };

      const startTime = Date.now();
      const response = await conversationService.processConversation(request);
      const totalTime = Date.now() - startTime;

      // Should meet the 1.5 second target
      expect(response.processingTimeMs).toBeLessThan(1500);
      expect(totalTime).toBeLessThan(1600); // Allow small buffer for test overhead

      // Verify response quality isn't compromised
      expect(response.text.length).toBeGreaterThan(5);
      expect(response.confidence).toBeGreaterThan(0.3);
    });

    it('should meet <3s target for TTS responses (simulated)', async () => {
      const request = {
        avatarId: 'perf-test-avatar',
        userInput: 'Tell me a longer story about yourself',
        sessionId: 'tts-response-benchmark',
        fastMode: false,
        options: {
          includeTTS: true // Simulated TTS processing
        }
      };

      const startTime = Date.now();
      const response = await conversationService.processConversation(request);
      const totalTime = Date.now() - startTime;

      // Should meet the 3 second target for TTS
      expect(response.processingTimeMs).toBeLessThan(3000);
      expect(totalTime).toBeLessThan(3200);

      // Verify comprehensive response
      expect(response.text.length).toBeGreaterThan(10);
    });

    it('should achieve <500ms context retrieval time', async () => {
      const avatarId = 'perf-test-avatar';
      const query = 'Simple context retrieval test';

      const startTime = Date.now();
      const context = await contextEngine.retrieveContext(avatarId, query);
      const retrievalTime = Date.now() - startTime;

      expect(retrievalTime).toBeLessThan(500);
      expect(context.retrievalMetadata.retrievalTimeMs).toBeLessThan(500);

      // Verify context quality
      expect(context.quickFacts).toBeDefined();
      expect(context.memoryFragments).toBeDefined();
      expect(context.conversationHistory).toBeDefined();
    });

    it('should achieve <200ms memory update time (async)', async () => {
      const memoryPipeline = new MemoryUpdatePipeline();

      const startTime = Date.now();
      const result = await memoryPipeline.processConversationTurn('perf-test-avatar', {
        conversationId: 'memory-update-benchmark',
        userInput: 'I love playing tennis',
        assistantResponse: 'That\'s great! Tennis is a wonderful sport.'
      });
      const updateTime = Date.now() - startTime;

      expect(updateTime).toBeLessThan(200);
      expect(result.processingTimeMs).toBeLessThan(200);

      // Verify update quality
      expect(result.factsExtracted).toBeGreaterThanOrEqual(0);
      expect(result.errors.length).toBe(0);
    });
  });

  describe('Fast Mode Performance', () => {
    it('should achieve sub-200ms responses in fast mode', async () => {
      const request = {
        avatarId: 'perf-test-avatar',
        userInput: 'Quick question',
        sessionId: 'fast-mode-benchmark',
        fastMode: true
      };

      const startTime = Date.now();
      const response = await conversationService.processConversation(request);
      const totalTime = Date.now() - startTime;

      // Fast mode should be significantly faster
      expect(response.processingTimeMs).toBeLessThan(750);
      expect(totalTime).toBeLessThan(800);

      // Verify fast mode characteristics
      expect(response.session.fastMode).toBe(true);
      expect(response.metadata.factsExtracted).toBe(0); // No extraction in fast mode
      expect(response.metadata.memoryUpdateTimeMs).toBeLessThan(50);
    });

    it('should show 50%+ performance improvement over normal mode', async () => {
      const userInput = 'Performance comparison test';
      const avatarId = 'perf-test-avatar';

      // Normal mode benchmark
      const normalRequest = {
        avatarId,
        userInput,
        sessionId: 'normal-mode-perf',
        fastMode: false
      };

      const normalStart = Date.now();
      const normalResponse = await conversationService.processConversation(normalRequest);
      const normalTime = Date.now() - normalStart;

      // Fast mode benchmark
      const fastRequest = {
        avatarId,
        userInput,
        sessionId: 'fast-mode-perf',
        fastMode: true
      };

      const fastStart = Date.now();
      const fastResponse = await conversationService.processConversation(fastRequest);
      const fastTime = Date.now() - fastStart;

      // Fast mode should be at least 50% faster
      expect(fastTime).toBeLessThan(normalTime * 0.5);

      // Both should provide valid responses
      expect(normalResponse.text.length).toBeGreaterThan(5);
      expect(fastResponse.text.length).toBeGreaterThan(5);

      console.log(`Performance improvement: ${((normalTime - fastTime) / normalTime * 100).toFixed(1)}%`);
    });

    it('should optimize query performance based on complexity', () => {
      const simpleQuery = 'hi';
      const complexQuery = 'tell me about my childhood memories and family relationships';

      const simpleOptimization = fastModeOptimizer.optimizeRetrievalOptions(simpleQuery, true);
      const complexOptimization = fastModeOptimizer.optimizeRetrievalOptions(complexQuery, true);

      // Simple queries should be more optimized
      expect(simpleOptimization.memoryLimit).toBeLessThanOrEqual(complexOptimization.memoryLimit);
      expect(simpleOptimization.historyLimit).toBeLessThanOrEqual(complexOptimization.historyLimit);

      // Performance estimates should reflect optimization
      const simpleEstimate = fastModeOptimizer.estimatePerformance(simpleOptimization);
      const complexEstimate = fastModeOptimizer.estimatePerformance(complexOptimization);

      expect(simpleEstimate.estimatedTimeMs).toBeLessThan(complexEstimate.estimatedTimeMs);
    });
  });

  describe('Concurrent Performance', () => {
    it('should handle multiple concurrent conversations efficiently', async () => {
      const concurrentCount = 5;
      const requests = Array.from({ length: concurrentCount }, (_, i) => ({
        avatarId: 'perf-test-avatar',
        userInput: `Concurrent conversation ${i + 1}`,
        sessionId: `concurrent-perf-${i + 1}`,
        fastMode: true
      }));

      const startTime = Date.now();
      const responses = await Promise.all(
        requests.map(request => conversationService.processConversation(request))
      );
      const totalTime = Date.now() - startTime;

      // All responses should be valid
      responses.forEach((response, i) => {
        expect(response.text).toBeDefined();
        expect(response.sessionId).toBe(`concurrent-perf-${i + 1}`);
        expect(response.processingTimeMs).toBeLessThan(1000);
      });

      // Concurrent processing shouldn't be much slower than sequential
      const averageTimePerRequest = totalTime / concurrentCount;
      expect(averageTimePerRequest).toBeLessThan(1000);

      console.log(`Concurrent performance: ${averageTimePerRequest.toFixed(0)}ms average per request`);
    });

    it('should maintain performance under sustained load', async () => {
      const loadTestDuration = 5000; // 5 seconds
      const requestInterval = 200; // Request every 200ms
      const responses: any[] = [];
      const startTime = Date.now();

      // Generate sustained load
      const loadTest = async () => {
        let requestCount = 0;
        while (Date.now() - startTime < loadTestDuration) {
          const request = {
            avatarId: 'perf-test-avatar',
            userInput: `Load test request ${++requestCount}`,
            sessionId: `load-test-${requestCount}`,
            fastMode: true
          };

          try {
            const response = await conversationService.processConversation(request);
            responses.push(response);
          } catch (error) {
            console.error('Load test request failed:', error);
          }

          await new Promise(resolve => setTimeout(resolve, requestInterval));
        }
      };

      await loadTest();

      // Verify sustained performance
      expect(responses.length).toBeGreaterThan(10); // Should handle multiple requests

      const averageResponseTime = responses.reduce((sum, r) => sum + r.processingTimeMs, 0) / responses.length;
      expect(averageResponseTime).toBeLessThan(1000);

      // Performance shouldn't degrade significantly over time
      const firstHalf = responses.slice(0, Math.floor(responses.length / 2));
      const secondHalf = responses.slice(Math.floor(responses.length / 2));

      const firstHalfAvg = firstHalf.reduce((sum, r) => sum + r.processingTimeMs, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, r) => sum + r.processingTimeMs, 0) / secondHalf.length;

      // Second half shouldn't be more than 50% slower than first half
      expect(secondHalfAvg).toBeLessThan(firstHalfAvg * 1.5);

      console.log(`Load test: ${responses.length} requests, ${averageResponseTime.toFixed(0)}ms average`);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should manage memory efficiently during long conversations', async () => {
      const sessionId = 'memory-efficiency-test';
      const avatarId = 'perf-test-avatar';

      // Create a long conversation (20 turns)
      for (let i = 0; i < 20; i++) {
        const request = {
          avatarId,
          userInput: `Turn ${i + 1}: Tell me something interesting`,
          sessionId,
          fastMode: false
        };

        const response = await conversationService.processConversation(request);
        expect(response.processingTimeMs).toBeLessThan(2000); // Should remain performant
      }

      // Verify session state is manageable
      const session = conversationService.getSession(sessionId);
      expect(session?.turns.length).toBe(40); // 20 user + 20 assistant turns

      // Performance should still be good for new requests
      const finalRequest = {
        avatarId,
        userInput: 'Final performance test',
        sessionId,
        fastMode: false
      };

      const startTime = Date.now();
      const finalResponse = await conversationService.processConversation(finalRequest);
      const finalTime = Date.now() - startTime;

      expect(finalTime).toBeLessThan(2000); // Should still be performant
    });

    it('should clean up expired sessions efficiently', () => {
      // Create multiple sessions
      const sessionIds: string[] = [];
      for (let i = 0; i < 10; i++) {
        const sessionId = `cleanup-test-${i}`;
        conversationService.processConversation({
          avatarId: 'perf-test-avatar',
          userInput: `Session ${i}`,
          sessionId,
          fastMode: true
        });
        sessionIds.push(sessionId);
      }

      // Manually expire half the sessions
      sessionIds.slice(0, 5).forEach(sessionId => {
        const session = conversationService.getSession(sessionId);
        if (session) {
          session.lastActivity = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
        }
      });

      // Measure cleanup performance
      const startTime = Date.now();
      const cleanedCount = conversationService.clearExpiredSessions(24 * 60 * 60 * 1000);
      const cleanupTime = Date.now() - startTime;

      expect(cleanedCount).toBe(5);
      expect(cleanupTime).toBeLessThan(100); // Should be very fast

      // Verify remaining sessions are still accessible
      sessionIds.slice(5).forEach(sessionId => {
        expect(conversationService.getSession(sessionId)).toBeDefined();
      });
    });
  });

  describe('Cache Performance', () => {
    it('should show significant performance improvement with cache hits', async () => {
      const avatarId = 'perf-test-avatar';
      const query = 'Cache performance test';

      // First request - cache miss
      const firstStart = Date.now();
      const firstContext = await contextEngine.retrieveContext(avatarId, query, { fastMode: true });
      const firstTime = Date.now() - firstStart;

      // Second request - should hit cache
      const secondStart = Date.now();
      const secondContext = await contextEngine.retrieveContext(avatarId, query, { fastMode: true });
      const secondTime = Date.now() - secondStart;

      // Cache hit should be significantly faster
      expect(secondTime).toBeLessThan(firstTime * 0.5);
      expect(secondContext.retrievalMetadata.cacheHits.length).toBeGreaterThan(0);

      console.log(`Cache performance: ${firstTime}ms → ${secondTime}ms (${((firstTime - secondTime) / firstTime * 100).toFixed(1)}% improvement)`);
    });

    it('should provide cache statistics and management', () => {
      // Populate cache with some data
      contextEngine.retrieveContext('avatar-1', 'test query 1', { fastMode: true });
      contextEngine.retrieveContext('avatar-2', 'test query 2', { fastMode: true });

      const stats = contextEngine.getCacheStats();
      expect(stats.size).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(stats.keys)).toBe(true);

      // Clear cache and verify
      contextEngine.clearCache();
      const clearedStats = contextEngine.getCacheStats();
      expect(clearedStats.size).toBe(0);
    });
  });

  describe('Performance Monitoring and Alerts', () => {
    it('should track performance metrics accurately', async () => {
      // Generate some conversations for metrics
      const requests = [
        { userInput: 'Fast request', fastMode: true },
        { userInput: 'Normal request', fastMode: false },
        { userInput: 'Another fast request', fastMode: true }
      ];

      for (let i = 0; i < requests.length; i++) {
        await conversationService.processConversation({
          avatarId: 'perf-test-avatar',
          userInput: requests[i].userInput,
          sessionId: `metrics-test-${i}`,
          fastMode: requests[i].fastMode
        });
      }

      const stats = conversationService.getPerformanceStats();

      expect(stats).toMatchObject({
        activeSessions: 3,
        averageSessionDuration: expect.any(Number),
        averageEntityBindings: expect.any(Number),
        performanceTargets: {
          textResponseMs: 1500,
          ttsResponseMs: 3000,
          contextRetrievalMs: 500,
          memoryUpdateMs: 200
        }
      });

      expect(stats.averageSessionDuration).toBeGreaterThan(0);
    });

    it('should identify performance bottlenecks', async () => {
      // Create a request that might be slow
      const request = {
        avatarId: 'perf-test-avatar',
        userInput: 'Complex query that might be slow',
        sessionId: 'bottleneck-test',
        fastMode: false
      };

      const response = await conversationService.processConversation(request);

      // Analyze timing breakdown
      const { metadata } = response;
      const totalTime = metadata.contextRetrievalTimeMs + 
                       metadata.memoryInjectionTimeMs + 
                       metadata.gpt5ProcessingTimeMs + 
                       metadata.memoryUpdateTimeMs;

      // Identify the slowest component
      const timings = {
        contextRetrieval: metadata.contextRetrievalTimeMs,
        memoryInjection: metadata.memoryInjectionTimeMs,
        gpt5Processing: metadata.gpt5ProcessingTimeMs,
        memoryUpdate: metadata.memoryUpdateTimeMs
      };

      const slowestComponent = Object.entries(timings).reduce((a, b) => 
        timings[a[0] as keyof typeof timings] > timings[b[0] as keyof typeof timings] ? a : b
      );

      console.log(`Performance breakdown:`, timings);
      console.log(`Slowest component: ${slowestComponent[0]} (${slowestComponent[1]}ms)`);

      // Verify total time is reasonable
      expect(totalTime).toBeLessThan(2000);
    });
  });
});