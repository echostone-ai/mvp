/**
 * Tests for enhanced memory addition API
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Supabase client
const mockSelect = vi.fn().mockReturnThis();
const mockInsert = vi.fn();
const mockEq = vi.fn().mockReturnThis();
const mockSingle = vi.fn();

const createChainableMock = () => ({
  select: mockSelect,
  insert: mockInsert,
  eq: mockEq,
  single: mockSingle
});

const mockSupabase = {
  from: vi.fn(() => createChainableMock())
};

// Mock MemoryService
const mockMemoryService = {
  processAndStoreMemories: vi.fn(),
  Retrieval: {
    getUserMemories: vi.fn(),
    getMemoryStats: vi.fn()
  }
};

// Mock ensureServicesInitialized
const mockEnsureServicesInitialized = vi.fn();

// Mock createClient
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase)
}));

// Mock MemoryService
vi.mock('@/lib/memoryService', () => ({
  MemoryService: mockMemoryService
}));

// Mock startup
vi.mock('@/lib/startup', () => ({
  ensureServicesInitialized: mockEnsureServicesInitialized
}));

describe('POST /api/avatars/[slug]/memories', () => {
  let POST: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockSelect.mockReturnThis();
    mockInsert.mockReturnThis();
    mockEq.mockReturnThis();
    mockSingle.mockReset();
    mockEnsureServicesInitialized.mockResolvedValue(undefined);
    
    // Import POST after mocks are set up
    const module = await import('../route');
    POST = module.POST;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should add memories to existing avatar', async () => {
    // Mock avatar lookup
    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'avatar-123',
        name: 'test-avatar'
      },
      error: null
    });

    // Mock memory processing
    mockMemoryService.processAndStoreMemories
      .mockResolvedValueOnce(['memory-1', 'memory-2'])
      .mockResolvedValueOnce(['memory-3']);

    const request = new NextRequest('http://localhost:3000/api/avatars/test-avatar/memories', {
      method: 'POST',
      body: JSON.stringify({
        fragments: [
          'I love playing guitar in my spare time.',
          'My favorite food is pizza and I eat it every Friday.'
        ],
        user_id: 'test-user'
      })
    });

    const response = await POST(request, { params: { slug: 'test-avatar' } });
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.avatar.slug).toBe('test-avatar');
    expect(data.processing_results.fragments_added).toBe(3);
    expect(data.processing_results.processing_statistics.successful_fragments).toBe(2);
    expect(data.processing_results.processing_statistics.failed_fragments).toBe(0);
    expect(data.processing_results.errors).toHaveLength(0);
  });

  it('should handle avatar not found', async () => {
    // Mock avatar not found
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Avatar not found' }
    });

    const request = new NextRequest('http://localhost:3000/api/avatars/nonexistent/memories', {
      method: 'POST',
      body: JSON.stringify({
        fragments: ['Some memory fragment'],
        user_id: 'test-user'
      })
    });

    const response = await POST(request, { params: { slug: 'nonexistent' } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Avatar not found');
  });

  it('should handle partial failures gracefully', async () => {
    // Mock avatar lookup
    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'avatar-123',
        name: 'test-avatar'
      },
      error: null
    });

    // Mock memory processing with one success and one failure
    mockMemoryService.processAndStoreMemories
      .mockResolvedValueOnce(['memory-1'])
      .mockRejectedValueOnce(new Error('Processing failed'));

    const request = new NextRequest('http://localhost:3000/api/avatars/test-avatar/memories', {
      method: 'POST',
      body: JSON.stringify({
        fragments: [
          'This fragment will succeed.',
          'This fragment will fail.'
        ],
        user_id: 'test-user'
      })
    });

    const response = await POST(request, { params: { slug: 'test-avatar' } });
    const data = await response.json();

    expect(response.status).toBe(207); // Partial success
    expect(data.processing_results.fragments_added).toBe(1);
    expect(data.processing_results.processing_statistics.successful_fragments).toBe(1);
    expect(data.processing_results.processing_statistics.failed_fragments).toBe(1);
    expect(data.processing_results.errors).toHaveLength(1);
    expect(data.processing_results.errors[0]).toContain('Processing failed');
  });

  it('should validate request body', async () => {
    const request = new NextRequest('http://localhost:3000/api/avatars/test-avatar/memories', {
      method: 'POST',
      body: JSON.stringify({
        // Missing required fragments
        user_id: 'test-user'
      })
    });

    const response = await POST(request, { params: { slug: 'test-avatar' } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid request data');
    expect(data.details).toBeDefined();
  });

  it('should handle empty fragments array', async () => {
    const request = new NextRequest('http://localhost:3000/api/avatars/test-avatar/memories', {
      method: 'POST',
      body: JSON.stringify({
        fragments: [],
        user_id: 'test-user'
      })
    });

    const response = await POST(request, { params: { slug: 'test-avatar' } });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid request data');
    expect(data.details).toBeDefined();
  });
});

describe('GET /api/avatars/[slug]/memories', () => {
  let GET: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockSelect.mockReturnThis();
    mockEq.mockReturnThis();
    mockSingle.mockReset();
    
    // Import GET after mocks are set up
    const module = await import('../route');
    GET = module.GET;
  });

  it('should retrieve memories for existing avatar', async () => {
    // Mock avatar lookup
    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'avatar-123',
        name: 'test-avatar'
      },
      error: null
    });

    // Mock memory retrieval
    mockMemoryService.Retrieval.getUserMemories.mockResolvedValue([
      {
        id: 'memory-1',
        fragmentText: 'I love playing guitar.',
        conversationContext: { source: 'API' },
        createdAt: '2025-01-08T10:00:00Z',
        updatedAt: '2025-01-08T10:00:00Z'
      }
    ]);

    mockMemoryService.Retrieval.getMemoryStats.mockResolvedValue({
      totalFragments: 1
    });

    const request = new NextRequest('http://localhost:3000/api/avatars/test-avatar/memories?userId=test-user&limit=10');

    const response = await GET(request, { params: { slug: 'test-avatar' } });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.avatar.slug).toBe('test-avatar');
    expect(data.memories).toHaveLength(1);
    expect(data.memories[0].fragment_text).toBe('I love playing guitar.');
    expect(data.pagination.total).toBe(1);
  });

  it('should handle avatar not found for GET', async () => {
    // Mock avatar not found
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Avatar not found' }
    });

    const request = new NextRequest('http://localhost:3000/api/avatars/nonexistent/memories');

    const response = await GET(request, { params: { slug: 'nonexistent' } });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Avatar not found');
  });
});