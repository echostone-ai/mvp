/**
 * Task 14 Integration Tests
 * Tests for analytics integration in jonathan-demo page
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import JonathanDemoPage from '../page';

// Custom matcher for DOM presence
expect.extend({
  toBeInTheDocument(received) {
    const pass = received != null;
    return {
      message: () => `expected element ${pass ? 'not ' : ''}to be in the document`,
      pass,
    };
  },
});

// Mock the analytics services
vi.mock('@/lib/services/conversationAnalytics', () => ({
  ConversationAnalyticsService: {
    getInstance: () => ({
      recordConversationTurn: vi.fn(),
      analyzeConversationFlow: vi.fn(() => ({
        conversationId: 'test-conversation',
        totalTurns: 2,
        qualityMetrics: {
          averageResponseTime: 1200,
          averageAudioLatency: 800,
          expressionUsageRate: 0.6,
          memoryRetrievalSuccessRate: 0.8,
          userEngagementScore: 0.75,
          conversationLength: 2,
          topicDiversity: 0.7,
          naturalFlowScore: 0.8
        },
        optimizationSuggestions: [
          {
            type: 'voice_settings',
            priority: 'medium',
            description: 'Consider optimizing voice latency',
            suggestedAction: 'Reduce voice quality slightly for faster response',
            expectedImprovement: 'Reduce latency by 100-200ms',
            confidence: 0.75
          }
        ],
        engagementTrends: [],
        topicProgression: []
      }))
    })
  }
}));

vi.mock('@/lib/services/userEngagementTracker', () => ({
  UserEngagementTracker: {
    getInstance: () => ({
      startTracking: vi.fn(),
      stopTracking: vi.fn(() => ({
        userId: 'test-user',
        sessionId: 'test-session',
        conversationId: 'test-conversation',
        sessionDuration: 120000,
        averageResponseTime: 1200,
        totalPauseTime: 0,
        messagesExchanged: 4,
        userInitiatedMessages: 2,
        averageMessageLength: 25,
        audioPlaybackTime: 8000,
        audioInterruptions: 0,
        audioCompletionRate: 1.0,
        expressionsHeard: 3,
        expressionEngagementRate: 0.9,
        technicalIssues: 0,
        conversationCompletionRate: 1.0,
        multitaskingDetected: false,
        attentionScore: 0.85,
        engagementTrend: 'stable',
        calculatedAt: new Date()
      })),
      recordEvent: vi.fn(),
      getEngagementMetrics: vi.fn(() => ({
        userId: 'test-user',
        sessionId: 'test-session',
        conversationId: 'test-conversation',
        attentionScore: 0.85,
        messagesExchanged: 4,
        audioCompletionRate: 1.0,
        expressionsHeard: 3,
        calculatedAt: new Date()
      })),
      getQualityMetrics: vi.fn(() => ({
        conversationId: 'test-conversation',
        naturalFlowScore: 0.8,
        userSatisfactionScore: 0.85,
        engagementScore: 0.75,
        averageAudioLatency: 800,
        calculatedAt: new Date()
      }))
    })
  }
}));

vi.mock('@/lib/services/conversationOptimizationService', () => ({
  ConversationOptimizationService: {
    getInstance: () => ({
      generateOptimizationReport: vi.fn(() => ({
        conversationId: 'test-conversation',
        generatedAt: new Date(),
        flowAnalysis: {
          conversationId: 'test-conversation',
          totalTurns: 2,
          qualityMetrics: {
            averageResponseTime: 1200,
            averageAudioLatency: 800,
            expressionUsageRate: 0.6,
            naturalFlowScore: 0.8
          },
          optimizationSuggestions: []
        },
        engagementMetrics: {
          userId: 'test-user',
          sessionId: 'test-session',
          conversationId: 'test-conversation',
          attentionScore: 0.85,
          messagesExchanged: 4,
          calculatedAt: new Date()
        },
        qualityMetrics: {
          conversationId: 'test-conversation',
          naturalFlowScore: 0.8,
          userSatisfactionScore: 0.85,
          calculatedAt: new Date()
        },
        prioritizedSuggestions: [],
        performanceScore: 0.82,
        improvementPotential: 0.15,
        recommendedTests: [],
        activeTestResults: [],
        immediateActions: [],
        longTermRecommendations: []
      })),
      getOptimizationDashboard: vi.fn(() => ({
        overview: {
          totalConversations: 5,
          averageQualityScore: 0.82,
          averageEngagementScore: 0.75,
          activeTests: 2,
          completedOptimizations: 3,
          performanceImprovement: 12.5
        },
        activeOptimizations: [],
        performanceTrends: [
          {
            metric: 'Average Audio Latency',
            timeframe: 'day',
            dataPoints: [],
            trend: 'improving',
            changePercentage: -8.5
          }
        ],
        alerts: [],
        recommendations: []
      }))
    })
  }
}));

// Mock other dependencies
vi.mock('@/lib/globalAudioManager', () => ({
  globalAudioManager: {
    initialize: vi.fn(),
    cleanup: vi.fn()
  }
}));

vi.mock('@/lib/streamingUtils', () => ({
  stopAllAudio: vi.fn(),
  createStreamingAudioManager: vi.fn(() => ({
    addSentence: vi.fn(),
    isPlaying: vi.fn(() => false),
    cleanup: vi.fn()
  })),
  splitIntoSentences: vi.fn((text) => [text])
}));

vi.mock('@/lib/enhancedVoiceConfig', () => ({
  getEnhancedVoiceConfig: vi.fn(() => ({
    model_id: 'eleven_multilingual_v2',
    voice_settings: {
      stability: 0.70,
      similarity_boost: 0.85
    }
  }))
}));

vi.mock('@/lib/services/expressionPackService', () => ({
  ExpressionPackService: {
    loadExpressionPack: vi.fn(() => Promise.resolve({
      id: 'test-pack',
      expressions: []
    }))
  }
}));

vi.mock('@/lib/jonathanDemoMemoryService', () => ({
  JonathanDemoMemoryService: {
    retrieveRelevantMemories: vi.fn(() => Promise.resolve('Test memory context')),
    storeConversationTurnAsync: vi.fn()
  }
}));

vi.mock('@/lib/services/jonathanDemoConversationState', () => ({
  jonathanConversationState: {
    getOrCreateConversation: vi.fn(() => Promise.resolve({
      id: 'test-conversation',
      userId: 'test-user',
      avatarId: 'jonathan-demo'
    })),
    addConversationTurn: vi.fn()
  }
}));

vi.mock('@/lib/mobileAudioContextManager', () => ({
  mobileAudioContextManager: {
    initialize: vi.fn(),
    ensureAudioContext: vi.fn()
  },
  isMobileSafari: vi.fn(() => false)
}));

// Mock fetch for API calls
global.fetch = vi.fn();

describe('Task 14: Analytics Integration in Jonathan Demo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful API responses
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/voice/resolve')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ voiceId: 'test-voice-id' })
        });
      }
      
      if (url.includes('/api/analytics/conversation')) {
        if (url.includes('type=dashboard')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              dashboard: {
                overview: {
                  totalConversations: 5,
                  averageQualityScore: 0.82,
                  averageEngagementScore: 0.75,
                  activeTests: 2,
                  completedOptimizations: 3,
                  performanceImprovement: 12.5
                },
                performanceTrends: [],
                alerts: [],
                recommendations: []
              }
            })
          });
        }
        
        if (url.includes('type=optimization')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              optimizationReport: {
                conversationId: 'test-conversation',
                performanceScore: 0.82,
                improvementPotential: 0.15
              }
            })
          });
        }
      }
      
      if (url.includes('/api/analytics/ab-testing')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            tests: [
              {
                id: 'test-1',
                name: 'Voice Quality Test',
                status: 'active',
                currentSampleSize: 25,
                targetSampleSize: 100
              }
            ]
          })
        });
      }
      
      return Promise.resolve({
        ok: false,
        status: 404
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render analytics dashboard toggle button', async () => {
    render(<JonathanDemoPage />);
    
    await waitFor(() => {
      const analyticsToggle = screen.getByText('Conversation Analytics');
      expect(analyticsToggle).toBeInTheDocument();
    });
    
    const toggleSubtitle = screen.getByText(/View conversation insights, A\/B tests, and optimization suggestions/);
    expect(toggleSubtitle).toBeInTheDocument();
  });

  it('should show and hide analytics dashboard when toggle is clicked', async () => {
    render(<JonathanDemoPage />);
    
    await waitFor(() => {
      const analyticsToggle = screen.getByText('Conversation Analytics');
      expect(analyticsToggle).toBeInTheDocument();
    });
    
    // Initially, dashboard should not be visible
    expect(screen.queryByText('Overview')).not.toBeInTheDocument();
    
    // Click to show dashboard
    const toggleButton = screen.getByRole('button', { name: /Conversation Analytics/ });
    fireEvent.click(toggleButton);
    
    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });
    
    // Click to hide dashboard
    fireEvent.click(toggleButton);
    
    await waitFor(() => {
      expect(screen.queryByText('Overview')).not.toBeInTheDocument();
    });
  });

  it('should display analytics dashboard with proper tabs', async () => {
    render(<JonathanDemoPage />);
    
    await waitFor(() => {
      const analyticsToggle = screen.getByText('Conversation Analytics');
      expect(analyticsToggle).toBeInTheDocument();
    });
    
    // Show dashboard
    const toggleButton = screen.getByRole('button', { name: /Conversation Analytics/ });
    fireEvent.click(toggleButton);
    
    await waitFor(() => {
      // Check for tab navigation
      expect(screen.getByText('Overview')).toBeInTheDocument();
      expect(screen.getByText('Conversation')).toBeInTheDocument();
      expect(screen.getByText('A/B Tests')).toBeInTheDocument();
      expect(screen.getByText('Export')).toBeInTheDocument();
    });
  });

  it('should load and display dashboard overview data', async () => {
    render(<JonathanDemoPage />);
    
    await waitFor(() => {
      const analyticsToggle = screen.getByText('Conversation Analytics');
      expect(analyticsToggle).toBeInTheDocument();
    });
    
    // Show dashboard
    const toggleButton = screen.getByRole('button', { name: /Conversation Analytics/ });
    fireEvent.click(toggleButton);
    
    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });
    
    // Wait for API call to complete and data to load
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/analytics/conversation?type=dashboard')
      );
    });
  });

  it('should switch between analytics tabs', async () => {
    render(<JonathanDemoPage />);
    
    await waitFor(() => {
      const analyticsToggle = screen.getByText('Conversation Analytics');
      expect(analyticsToggle).toBeInTheDocument();
    });
    
    // Show dashboard
    const toggleButton = screen.getByRole('button', { name: /Conversation Analytics/ });
    fireEvent.click(toggleButton);
    
    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });
    
    // Click on A/B Tests tab
    const abTestsTab = screen.getByRole('button', { name: 'A/B Tests' });
    fireEvent.click(abTestsTab);
    
    await waitFor(() => {
      expect(screen.getByText('Create Voice Test')).toBeInTheDocument();
      expect(screen.getByText('Create Expression Test')).toBeInTheDocument();
    });
    
    // Click on Export tab
    const exportTab = screen.getByRole('button', { name: 'Export' });
    fireEvent.click(exportTab);
    
    await waitFor(() => {
      expect(screen.getByText('Export Conversation')).toBeInTheDocument();
      expect(screen.getByText('Share Conversation')).toBeInTheDocument();
    });
  });

  it('should handle analytics API errors gracefully', async () => {
    // Mock API error
    (global.fetch as any).mockImplementation(() => 
      Promise.resolve({
        ok: false,
        status: 500
      })
    );
    
    render(<JonathanDemoPage />);
    
    await waitFor(() => {
      const analyticsToggle = screen.getByText('Conversation Analytics');
      expect(analyticsToggle).toBeInTheDocument();
    });
    
    // Show dashboard
    const toggleButton = screen.getByRole('button', { name: /Conversation Analytics/ });
    fireEvent.click(toggleButton);
    
    await waitFor(() => {
      // Should show error state or loading state
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });
    
    // Should not crash the application
    expect(screen.getByText('Chat with Jonathan')).toBeInTheDocument();
  });

  it('should integrate with conversation flow for analytics tracking', async () => {
    render(<JonathanDemoPage />);
    
    await waitFor(() => {
      const input = screen.getByPlaceholderText('Ask me anything…');
      expect(input).toBeInTheDocument();
    });
    
    // Mock successful chat response
    (global.fetch as any).mockImplementation((url: string) => {
      if (url.includes('/api/demo-chat')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            answer: 'This is a test response for analytics tracking.'
          })
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });
    
    // Send a message
    const input = screen.getByPlaceholderText('Ask me anything…');
    const submitButton = screen.getByRole('button', { name: '→' });
    
    fireEvent.change(input, { target: { value: 'Test message for analytics' } });
    fireEvent.click(submitButton);
    
    // Should trigger analytics tracking
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/demo-chat'),
        expect.any(Object)
      );
    });
  });

  it('should provide export functionality in analytics dashboard', async () => {
    render(<JonathanDemoPage />);
    
    await waitFor(() => {
      const analyticsToggle = screen.getByText('Conversation Analytics');
      expect(analyticsToggle).toBeInTheDocument();
    });
    
    // Show dashboard and go to export tab
    const toggleButton = screen.getByRole('button', { name: /Conversation Analytics/ });
    fireEvent.click(toggleButton);
    
    await waitFor(() => {
      const exportTab = screen.getByRole('button', { name: 'Export' });
      fireEvent.click(exportTab);
    });
    
    await waitFor(() => {
      expect(screen.getByText('Export as JSON')).toBeInTheDocument();
      expect(screen.getByText('Export as CSV')).toBeInTheDocument();
      expect(screen.getByText('Export as HTML')).toBeInTheDocument();
      expect(screen.getByText('Create Shareable Link')).toBeInTheDocument();
    });
  });

  it('should handle A/B test creation from analytics dashboard', async () => {
    render(<JonathanDemoPage />);
    
    await waitFor(() => {
      const analyticsToggle = screen.getByText('Conversation Analytics');
      expect(analyticsToggle).toBeInTheDocument();
    });
    
    // Show dashboard and go to A/B tests tab
    const toggleButton = screen.getByRole('button', { name: /Conversation Analytics/ });
    fireEvent.click(toggleButton);
    
    await waitFor(() => {
      const abTestsTab = screen.getByRole('button', { name: 'A/B Tests' });
      fireEvent.click(abTestsTab);
    });
    
    // Mock A/B test creation API
    (global.fetch as any).mockImplementation((url: string, options: any) => {
      if (url.includes('/api/analytics/ab-testing') && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            testId: 'new-test-id',
            started: true
          })
        });
      }
      return Promise.resolve({ ok: false, status: 404 });
    });
    
    await waitFor(() => {
      const createVoiceTestButton = screen.getByText('Create Voice Test');
      expect(createVoiceTestButton).toBeInTheDocument();
      
      fireEvent.click(createVoiceTestButton);
    });
    
    // Should call A/B testing API
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/analytics/ab-testing'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('create_voice_test')
        })
      );
    });
  });

  it('should maintain analytics state across component re-renders', async () => {
    const { rerender } = render(<JonathanDemoPage />);
    
    await waitFor(() => {
      const analyticsToggle = screen.getByText('Conversation Analytics');
      expect(analyticsToggle).toBeInTheDocument();
    });
    
    // Show dashboard
    const toggleButton = screen.getByRole('button', { name: /Conversation Analytics/ });
    fireEvent.click(toggleButton);
    
    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });
    
    // Re-render component
    rerender(<JonathanDemoPage />);
    
    // Dashboard should still be visible
    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });
  });
});