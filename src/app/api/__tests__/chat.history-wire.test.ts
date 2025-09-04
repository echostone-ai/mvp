import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../chat/route';
import { NextRequest } from 'next/server';

// Mock dependencies
vi.mock('@/lib/services/enhancedPromptBuilder');
vi.mock('@/lib/services/memoryInjectionService');
vi.mock('openai');
vi.mock('@supabase/supabase-js');

describe('Chat API - History Wiring', () => {
  let mockSupabase: any;
  let mockEnhancedPromptBuilder: any;
  let mockOpenAI: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Supabase
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      contains: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({
        data: { id: 'avatar-123' },
        error: null
      })
    };

    // Mock conversation history data
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'memory_fragments') {
        return {
          ...mockSupabase,
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          contains: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [
              {
                fragment_text: 'Hi there!',
                conversation_context: { type: 'user' },
                created_at: '2024-01-01T00:00:00Z'
              },
              {
                fragment_text: 'Hey! What\'s up?!',
                conversation_context: { type: 'assistant' },
                created_at: '2024-01-01T00:01:00Z'
              }
            ],
            error: null
          }),
          insert: vi.fn().mockResolvedValue({ data: null, error: null })
        };
      }
      return mockSupabase;
    });

    // Mock createClient
    const { createClient } = require('@supabase/supabase-js');
    createClient.mockReturnValue(mockSupabase);

    // Mock EnhancedPromptBuilder
    const { EnhancedPromptBuilder } = require('@/lib/services/enhancedPromptBuilder');
    mockEnhancedPromptBuilder = {
      buildEnhancedSystemPromptWithStyle: vi.fn().mockResolvedValue({
        prompt: 'Enhanced system prompt with history',
        metadata: {
          facts_count: 5,
          memories_count: 3,
          conversation_turns: 2,
          expressions_available: ['what\'s up?!'],
          catchphrases_available: ['man time flies'],
          processing_time_ms: 50
        }
      })
    };
    EnhancedPromptBuilder.mockImplementation(() => mockEnhancedPromptBuilder);

    // Mock OpenAI
    mockOpenAI = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: 'Test response' } }]
          })
        }
      }
    };
    const OpenAI = require('openai').default;
    OpenAI.mockImplementation(() => mockOpenAI);

    // Mock environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    process.env.OPENAI_API_KEY = 'test-openai-key';
  });

  it('should fetch and pass conversation history to EnhancedPromptBuilder', async () => {
    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'How is Romeo?',
        avatarSlug: 'jonathan-demo',
        debug: true
      }),
      headers: {
        'content-type': 'application/json',
        'cookie': 'jd_vid=test-visitor-123'
      }
    });

    const response = await POST(request);
    const data = await response.json();

    // Verify conversation history was fetched
    expect(mockSupabase.from).toHaveBeenCalledWith('memory_fragments');
    expect(mockSupabase.contains).toHaveBeenCalledWith(
      'conversation_context',
      { conversation_id: 'jonathan-demo', visitor_id: 'test-visitor-123' }
    );

    // Verify EnhancedPromptBuilder was called with history
    expect(mockEnhancedPromptBuilder.buildEnhancedSystemPromptWithStyle).toHaveBeenCalledWith(
      'jonathan-demo',
      'How is Romeo?',
      expect.arrayContaining([
        expect.objectContaining({
          role: 'user',
          content: 'Hi there!',
          timestamp: '2024-01-01T00:00:00Z'
        }),
        expect.objectContaining({
          role: 'assistant',
          content: 'Hey! What\'s up?!',
          timestamp: '2024-01-01T00:01:00Z'
        })
      ]),
      { priorityFilter: 6, memoryLimit: 8, trackExpressions: true }
    );

    expect(response.status).toBe(200);
  });

  it('should store user message in memory_fragments', async () => {
    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'How is Romeo?',
        avatarSlug: 'jonathan-demo'
      }),
      headers: {
        'content-type': 'application/json',
        'cookie': 'jd_vid=test-visitor-123'
      }
    });

    await POST(request);

    // Verify user message was stored
    expect(mockSupabase.insert).toHaveBeenCalledWith({
      avatar_id: 'avatar-123',
      fragment_text: 'How is Romeo?',
      conversation_context: {
        source: 'chat',
        type: 'user',
        conversation_id: 'jonathan-demo',
        visitor_id: 'test-visitor-123',
        tags: ['query']
      }
    });
  });

  it('should handle missing conversation history gracefully', async () => {
    // Mock empty history
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'memory_fragments') {
        return {
          ...mockSupabase,
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          contains: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: [],
            error: null
          }),
          insert: vi.fn().mockResolvedValue({ data: null, error: null })
        };
      }
      return mockSupabase;
    });

    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Hello!',
        avatarSlug: 'jonathan-demo',
        debug: true
      }),
      headers: {
        'content-type': 'application/json'
      }
    });

    const response = await POST(request);

    // Should still call EnhancedPromptBuilder with empty history
    expect(mockEnhancedPromptBuilder.buildEnhancedSystemPromptWithStyle).toHaveBeenCalledWith(
      'jonathan-demo',
      'Hello!',
      [], // empty history
      { priorityFilter: 6, memoryLimit: 8, trackExpressions: true }
    );

    expect(response.status).toBe(200);
  });

  it('should limit conversation history to last 8 turns', async () => {
    // Mock more than 8 turns of history
    const longHistory = Array.from({ length: 12 }, (_, i) => ({
      fragment_text: `Message ${i + 1}`,
      conversation_context: { type: i % 2 === 0 ? 'user' : 'assistant' },
      created_at: `2024-01-01T00:${String(i).padStart(2, '0')}:00Z`
    }));

    mockSupabase.from.mockImplementation((table: string) => {
      if (table === 'memory_fragments') {
        return {
          ...mockSupabase,
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          contains: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({
            data: longHistory,
            error: null
          }),
          insert: vi.fn().mockResolvedValue({ data: null, error: null })
        };
      }
      return mockSupabase;
    });

    const request = new NextRequest('http://localhost:3000/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Test message',
        avatarSlug: 'jonathan-demo',
        debug: true
      }),
      headers: {
        'content-type': 'application/json',
        'cookie': 'jd_vid=test-visitor-123'
      }
    });

    await POST(request);

    // Verify history was limited to 8 turns
    const historyArg = mockEnhancedPromptBuilder.buildEnhancedSystemPromptWithStyle.mock.calls[0][2];
    expect(historyArg).toHaveLength(8);
    expect(historyArg[0].content).toBe('Message 5'); // Should start from message 5 (last 8 of 12)
    expect(historyArg[7].content).toBe('Message 12'); // Should end with message 12
  });
});