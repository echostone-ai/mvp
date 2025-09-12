/**
 * Tests for enhanced avatar creation API
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Supabase client
const mockSelect = vi.fn().mockReturnThis();
const mockInsert = vi.fn();
const mockEq = vi.fn().mockReturnThis();
const mockSingle = vi.fn();

// Create a chainable mock that handles both patterns
const createChainableMock = () => {
  const chainable = {
    select: mockSelect,
    insert: mockInsert,
    eq: mockEq,
    single: mockSingle
  };
  
  // Make insert return the chainable object for chaining
  mockInsert.mockReturnValue(chainable);
  
  return chainable;
};

const mockSupabase = {
  from: vi.fn(() => createChainableMock())
};

// Mock FactExtractionEngine
const mockFactExtractionEngine = {
  extractFactsWithTimeout: vi.fn()
};

// Mock MemoryService
const mockMemoryService = {
  storeSimpleMemory: vi.fn()
};

// Mock getAvatars function
const mockGetAvatars = vi.fn();

// Mock createClient
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase)
}));

// Mock FactExtractionEngine
vi.mock('@/lib/services/factExtractionEngine', () => ({
  FactExtractionEngine: vi.fn(() => mockFactExtractionEngine)
}));

// Mock MemoryService
vi.mock('@/lib/memoryService', () => ({
  MemoryService: mockMemoryService
}));

// Mock avatarService
vi.mock('@/lib/services/avatarService', () => ({
  getAvatars: mockGetAvatars
}));

describe('POST /api/avatars', () => {
  let POST: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset mock implementations
    mockSelect.mockReturnThis();
    mockInsert.mockReturnThis();
    mockEq.mockReturnThis();
    mockSingle.mockReset();
    
    // Import POST after mocks are set up
    const module = await import('../route');
    POST = module.POST;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create avatar without seed text', async () => {
    // Mock successful avatar creation
    mockSingle
      .mockResolvedValueOnce({
        data: null, // No existing avatar
        error: null
      })
      .mockResolvedValueOnce({
        data: {
          id: 'avatar-123',
          name: 'test-avatar',
          description: 'Test Avatar',
          profile_data: { display_name: 'Test Avatar' },
          created_at: '2025-01-08T10:00:00Z'
        },
        error: null
      });

    const request = new NextRequest('http://localhost:3000/api/avatars', {
      method: 'POST',
      body: JSON.stringify({
        slug: 'test-avatar',
        display_name: 'Test Avatar',
        user_id: 'test-user'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.avatar.slug).toBe('test-avatar');
    expect(data.extraction_results.quick_facts_count).toBe(0);
    expect(data.extraction_results.fragments_count).toBe(0);
  });

  it('should create avatar with seed text and extract facts', async () => {
    // Mock no existing avatar
    mockSingle
      .mockResolvedValueOnce({
        data: null,
        error: null
      })
      .mockResolvedValueOnce({
        data: {
          id: 'avatar-123',
          name: 'test-avatar',
          description: 'Test Avatar',
          profile_data: { display_name: 'Test Avatar' },
          created_at: '2025-01-08T10:00:00Z'
        },
        error: null
      });

    // Mock successful fact insertion - need to handle both chained and non-chained calls
    // First call: avatar creation with insert().select().single()
    // Second call: fact insertion with just insert()
    mockInsert
      .mockReturnValueOnce(createChainableMock()) // For avatar creation chaining
      .mockResolvedValueOnce({ // For fact insertion (direct promise)
        data: [{ id: 'fact-1' }, { id: 'fact-2' }],
        error: null
      });

    // Mock fact extraction result
    mockFactExtractionEngine.extractFactsWithTimeout.mockResolvedValue({
      facts: [
        {
          key: 'birth_year',
          value: '1990',
          confidence: 0.9,
          extraction_method: 'pattern',
          source_text: 'I was born in 1990'
        },
        {
          key: 'current_city',
          value: 'San Francisco',
          confidence: 0.8,
          extraction_method: 'pattern',
          source_text: 'I live in San Francisco'
        }
      ],
      processing_time_ms: 1500,
      errors: [],
      stage_results: {
        pattern: { facts: [{ key: 'birth_year', value: '1990' }] },
        llm: { facts: [{ key: 'current_city', value: 'San Francisco' }] }
      },
      performance_metrics: {
        pattern_facts_count: 1,
        llm_facts_count: 1,
        total_facts_count: 2,
        deduplication_removed: 0,
        confidence_filtered: 0
      }
    });

    // Mock memory fragment storage
    mockMemoryService.storeSimpleMemory
      .mockResolvedValueOnce('memory-1')
      .mockResolvedValueOnce('memory-2');

    const request = new NextRequest('http://localhost:3000/api/avatars', {
      method: 'POST',
      body: JSON.stringify({
        slug: 'test-avatar',
        display_name: 'Test Avatar',
        seed_text: 'I was born in 1990 in Chicago. I moved to San Francisco in 2015 and work as a software engineer.',
        user_id: 'test-user'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.avatar.slug).toBe('test-avatar');
    expect(data.extraction_results.quick_facts_count).toBe(2);
    expect(data.extraction_results.fragments_count).toBe(1);
    expect(data.extraction_results.fact_extraction.facts_extracted).toBe(2);
    expect(data.extraction_results.fact_extraction.processing_time_ms).toBe(1500);
  });

  it('should handle avatar creation with extraction errors gracefully', async () => {
    // Mock no existing avatar
    mockSingle
      .mockResolvedValueOnce({
        data: null,
        error: null
      })
      .mockResolvedValueOnce({
        data: {
          id: 'avatar-123',
          name: 'test-avatar',
          description: 'Test Avatar',
          profile_data: { display_name: 'Test Avatar' },
          created_at: '2025-01-08T10:00:00Z'
        },
        error: null
      });

    // Mock fact extraction failure
    mockFactExtractionEngine.extractFactsWithTimeout.mockRejectedValue(
      new Error('Fact extraction failed')
    );

    const request = new NextRequest('http://localhost:3000/api/avatars', {
      method: 'POST',
      body: JSON.stringify({
        slug: 'test-avatar',
        display_name: 'Test Avatar',
        seed_text: 'Some seed text that fails to extract',
        user_id: 'test-user'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201); // Avatar still created
    expect(data.avatar.slug).toBe('test-avatar');
    expect(data.extraction_results.quick_facts_count).toBe(0);
    expect(data.extraction_results.errors.length).toBeGreaterThan(0);
    expect(data.extraction_results.errors[0]).toContain('Fact extraction failed');
  });

  it('should reject duplicate avatar slugs', async () => {
    // Mock existing avatar
    mockSingle.mockResolvedValueOnce({
      data: { id: 'existing-avatar' },
      error: null
    });

    const request = new NextRequest('http://localhost:3000/api/avatars', {
      method: 'POST',
      body: JSON.stringify({
        slug: 'existing-avatar',
        display_name: 'Existing Avatar',
        user_id: 'test-user'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe('Avatar with this slug already exists');
  });

  it('should validate request body', async () => {
    const request = new NextRequest('http://localhost:3000/api/avatars', {
      method: 'POST',
      body: JSON.stringify({
        // Missing required slug
        display_name: 'Test Avatar'
      })
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid request data');
    expect(data.details).toBeDefined();
  });
});