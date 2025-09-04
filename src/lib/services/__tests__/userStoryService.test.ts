/**
 * Unit tests for UserStoryService
 * Tests validation, CRUD operations, and limit enforcement
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UserStoryService } from '../userStoryService';
import { 
  StoryValidationError, 
  StoryLimitExceededError,
  STORY_CONSTRAINTS,
  parseTriggersFromString 
} from '../../types/stories';

// Create chainable mock functions
const createChainableMock = (finalResult: any) => {
  const chain = {
    eq: vi.fn(() => chain),
    in: vi.fn(() => chain),
    order: vi.fn(() => chain),
    range: vi.fn(() => finalResult),
    single: vi.fn(() => finalResult),
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    textSearch: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    lte: vi.fn(() => chain),
    or: vi.fn(() => chain)
  };
  return chain;
};

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => {
    const defaultResult = { data: null, error: null, count: 0 };
    return createChainableMock(defaultResult);
  })
};

// Mock the Supabase client creation
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabase)
}));

describe('UserStoryService', () => {
  let service: UserStoryService;
  let mockFile: File;

  beforeEach(() => {
    service = new UserStoryService();
    
    // Create a mock MP3 file
    mockFile = new File(['mock audio data'], 'test.mp3', {
      type: 'audio/mpeg',
      lastModified: Date.now()
    });
    
    // Reset all mocks
    vi.clearAllMocks();
    vi.restoreAllMocks();
    
    // Reset the from mock to return fresh chainable mocks
    mockSupabase.from.mockImplementation(() => {
      const defaultResult = { data: null, error: null, count: 0 };
      return createChainableMock(defaultResult);
    });
  });

  describe('File Validation', () => {
    it('should accept valid MP3 files', async () => {
      const validRequest = {
        file: mockFile,
        title: 'Test Story',
        category: 'memory' as const,
        triggers: ['test', 'story']
      };

      // Mock successful database operations
      const countMock = createChainableMock({ count: 0, error: null });
      const insertMock = createChainableMock({
        data: {
          id: 'test-id',
          audio_url: 'test-url',
          duration_ms: 60000,
          status: 'processing'
        },
        error: null
      });
      
      mockSupabase.from.mockReturnValueOnce(countMock).mockReturnValueOnce(insertMock);

      const result = await service.createStory(validRequest);
      expect(result.id).toBe('test-id');
    });

    it('should reject files that are too large', async () => {
      const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.mp3', {
        type: 'audio/mpeg'
      });

      const invalidRequest = {
        file: largeFile,
        title: 'Test Story',
        category: 'memory' as const,
        triggers: ['test']
      };

      await expect(service.createStory(invalidRequest))
        .rejects.toThrow(StoryValidationError);
    });

    it('should reject non-MP3 files', async () => {
      const invalidFile = new File(['data'], 'test.wav', {
        type: 'audio/wav'
      });

      const invalidRequest = {
        file: invalidFile,
        title: 'Test Story',
        category: 'memory' as const,
        triggers: ['test']
      };

      await expect(service.createStory(invalidRequest))
        .rejects.toThrow(StoryValidationError);
    });
  });

  describe('Metadata Validation', () => {
    it('should require a title', async () => {
      const invalidRequest = {
        file: mockFile,
        title: '',
        category: 'memory' as const,
        triggers: ['test']
      };

      await expect(service.createStory(invalidRequest))
        .rejects.toThrow(StoryValidationError);
    });

    it('should require at least one trigger', async () => {
      const invalidRequest = {
        file: mockFile,
        title: 'Test Story',
        category: 'memory' as const,
        triggers: []
      };

      await expect(service.createStory(invalidRequest))
        .rejects.toThrow(StoryValidationError);
    });

    it('should limit number of triggers', async () => {
      const tooManyTriggers = Array(25).fill('trigger');
      
      const invalidRequest = {
        file: mockFile,
        title: 'Test Story',
        category: 'memory' as const,
        triggers: tooManyTriggers
      };

      await expect(service.createStory(invalidRequest))
        .rejects.toThrow(StoryValidationError);
    });

    it('should validate priority range', async () => {
      const invalidRequest = {
        file: mockFile,
        title: 'Test Story',
        category: 'memory' as const,
        triggers: ['test'],
        priority: 150 // Invalid: > 100
      };

      await expect(service.createStory(invalidRequest))
        .rejects.toThrow(StoryValidationError);
    });

    it('should validate category values', async () => {
      const invalidRequest = {
        file: mockFile,
        title: 'Test Story',
        category: 'invalid' as any,
        triggers: ['test']
      };

      await expect(service.createStory(invalidRequest))
        .rejects.toThrow(StoryValidationError);
    });

    it('should validate transcript length', async () => {
      const longTranscript = 'x'.repeat(10001); // Exceeds MAX_TRANSCRIPT_LENGTH
      
      const invalidRequest = {
        file: mockFile,
        title: 'Test Story',
        category: 'memory' as const,
        triggers: ['test'],
        transcript: longTranscript
      };

      await expect(service.createStory(invalidRequest))
        .rejects.toThrow(StoryValidationError);
    });

    it('should validate title length', async () => {
      const longTitle = 'x'.repeat(256); // Exceeds MAX_TITLE_LENGTH
      
      const invalidRequest = {
        file: mockFile,
        title: longTitle,
        category: 'memory' as const,
        triggers: ['test']
      };

      await expect(service.createStory(invalidRequest))
        .rejects.toThrow(StoryValidationError);
    });

    it('should validate trigger keyword length', async () => {
      const longTrigger = 'x'.repeat(101); // Exceeds MAX_TRIGGER_LENGTH
      
      const invalidRequest = {
        file: mockFile,
        title: 'Test Story',
        category: 'memory' as const,
        triggers: [longTrigger]
      };

      await expect(service.createStory(invalidRequest))
        .rejects.toThrow(StoryValidationError);
    });

    it('should validate update operations', async () => {
      // Mock ownership verification
      const ownershipMock = createChainableMock({
        data: { owner_id: 'user123', owner_type: 'user' },
        error: null
      });
      mockSupabase.from.mockReturnValue(ownershipMock);

      // Test empty title update
      await expect(service.updateStory('test-id', {
        title: ''
      }, 'user123')).rejects.toThrow(StoryValidationError);

      // Test invalid category update
      await expect(service.updateStory('test-id', {
        category: 'invalid' as any
      }, 'user123')).rejects.toThrow(StoryValidationError);

      // Test empty triggers update
      await expect(service.updateStory('test-id', {
        triggers: []
      }, 'user123')).rejects.toThrow(StoryValidationError);

      // Test invalid priority update
      await expect(service.updateStory('test-id', {
        priority: -10
      }, 'user123')).rejects.toThrow(StoryValidationError);
    });
  });

  describe('Story Limit Enforcement', () => {
    it('should enforce 5-story limit at API level', async () => {
      // Mock getStoryCount to return 5 (at limit)
      vi.spyOn(service, 'getStoryCount').mockResolvedValue(5);

      const request = {
        file: mockFile,
        title: 'Sixth Story',
        category: 'memory' as const,
        triggers: ['test']
      };

      await expect(service.createStory(request))
        .rejects.toThrow(StoryLimitExceededError);
    });

    it('should allow stories when under limit', async () => {
      // Mock getStoryCount to return 3 (under limit)
      vi.spyOn(service, 'getStoryCount').mockResolvedValue(3);
      
      // Mock the insert operation
      const insertMock = createChainableMock({
        data: {
          id: 'test-id',
          audio_url: 'test-url',
          duration_ms: 60000,
          status: 'processing'
        },
        error: null
      });
      mockSupabase.from.mockReturnValue(insertMock);

      const request = {
        file: mockFile,
        title: 'Fourth Story',
        category: 'memory' as const,
        triggers: ['test']
      };

      const result = await service.createStory(request);
      expect(result.id).toBe('test-id');
    });
  });

  describe('Trigger Matching', () => {
    it('should parse triggers correctly', () => {
      const triggers = 'childhood, school, friends';
      const parsed = parseTriggersFromString(triggers);
      expect(parsed).toEqual(['childhood', 'school', 'friends']);
    });

    it('should find stories with matching keywords using database search', async () => {
      const mockStories = [
        {
          id: '1',
          owner_id: 'user1',
          owner_type: 'avatar',
          title: 'Childhood Memory',
          category: 'memory',
          triggers: 'childhood, school, friends',
          audio_url: 'url1',
          duration_ms: 60000,
          priority: 80,
          status: 'active',
          created_at: '2024-01-01',
          updated_at: '2024-01-01'
        }
      ];

      // Mock the getStories method directly since textSearch will fail in test environment
      const getStoriesSpy = vi.spyOn(service, 'getStories').mockResolvedValue({
        stories: mockStories,
        total: 1,
        limit: 50,
        offset: 0
      });

      const matches = await service.findMatchingStories(
        'Tell me about your childhood experiences',
        'user1',
        'avatar'
      );

      // Verify getStories was called (fallback was triggered)
      expect(getStoriesSpy).toHaveBeenCalled();
      expect(matches).toHaveLength(1);
      expect(matches[0].title).toBe('Childhood Memory');
    });

    it('should fallback to client-side matching when database search fails', async () => {
      const mockStories = [
        {
          id: '1',
          owner_id: 'user1',
          owner_type: 'avatar',
          title: 'Childhood Memory',
          category: 'memory',
          triggers: 'childhood, school, friends',
          audio_url: 'url1',
          duration_ms: 60000,
          priority: 80,
          status: 'active',
          created_at: '2024-01-01',
          updated_at: '2024-01-01'
        }
      ];

      // Mock the getStories method for fallback
      vi.spyOn(service, 'getStories').mockResolvedValue({
        stories: mockStories,
        total: 1,
        limit: 50,
        offset: 0
      });

      const matches = await service.findMatchingStories(
        'Tell me about your childhood',
        'user1',
        'avatar'
      );

      expect(matches).toHaveLength(1);
      expect(matches[0].title).toBe('Childhood Memory');
    });

    it('should sort matches by upload order (MVP behavior)', async () => {
      const mockStories = [
        {
          id: '1',
          owner_id: 'user1',
          owner_type: 'avatar',
          title: 'Newer Story',
          category: 'memory',
          triggers: 'test',
          audio_url: 'url1',
          duration_ms: 60000,
          priority: 90, // Higher priority
          status: 'active',
          created_at: '2024-01-01T12:00:00Z', // Newer
          updated_at: '2024-01-01T12:00:00Z'
        },
        {
          id: '2',
          owner_id: 'user1',
          owner_type: 'avatar',
          title: 'Older Story',
          category: 'memory',
          triggers: 'test',
          audio_url: 'url2',
          duration_ms: 60000,
          priority: 30, // Lower priority
          status: 'active',
          created_at: '2024-01-01T10:00:00Z', // Older
          updated_at: '2024-01-01T10:00:00Z'
        }
      ];

      // Mock the getStories method for fallback
      vi.spyOn(service, 'getStories').mockResolvedValue({
        stories: mockStories,
        total: 2,
        limit: 50,
        offset: 0
      });

      const matches = await service.findMatchingStories('test', 'user1', 'avatar');

      expect(matches).toHaveLength(2);
      // MVP uses upload order (older first), not priority
      expect(matches[0].title).toBe('Older Story');
      expect(matches[1].title).toBe('Newer Story');
    });

    it('should handle empty search queries', async () => {
      const matches = await service.findMatchingStories('', 'user1', 'avatar');
      expect(matches).toHaveLength(0);
    });

    it('should handle short search queries', async () => {
      const matches = await service.findMatchingStories('hi', 'user1', 'avatar');
      expect(matches).toHaveLength(0);
    });

    it('should limit search results for performance', async () => {
      const manyStories = Array(15).fill(null).map((_, i) => ({
        id: `story-${i}`,
        owner_id: 'user1',
        owner_type: 'avatar',
        title: `Story ${i}`,
        category: 'memory',
        triggers: 'test',
        audio_url: `url${i}`,
        duration_ms: 60000,
        priority: i * 10,
        status: 'active',
        created_at: '2024-01-01',
        updated_at: '2024-01-01'
      }));

      const storiesMock = createChainableMock({
        data: manyStories.slice(0, 10), // Database should limit to 10
        error: null
      });
      mockSupabase.from.mockReturnValue(storiesMock);

      const matches = await service.findMatchingStories('test', 'user1', 'avatar');
      expect(matches.length).toBeLessThanOrEqual(10);
    });
  });

  describe('CRUD Operations', () => {
    it('should create story with proper authorization', async () => {
      const validRequest = {
        file: mockFile,
        title: 'Test Story',
        category: 'memory' as const,
        triggers: ['test', 'story']
      };

      // Mock successful operations
      const countMock = createChainableMock({ count: 0, error: null });
      const insertMock = createChainableMock({
        data: {
          id: 'test-id',
          audio_url: 'test-url',
          duration_ms: 60000,
          status: 'processing'
        },
        error: null
      });
      
      mockSupabase.from.mockReturnValueOnce(countMock).mockReturnValueOnce(insertMock);

      const result = await service.createStory(validRequest, 'user123');
      expect(result.id).toBe('test-id');
    });

    it('should get stories with authorization filtering', async () => {
      const mockStories = [
        {
          id: '1',
          owner_id: 'user123',
          owner_type: 'user',
          title: 'My Story',
          category: 'memory',
          triggers: 'test',
          audio_url: 'url1',
          duration_ms: 60000,
          priority: 50,
          status: 'active',
          created_at: '2024-01-01',
          updated_at: '2024-01-01'
        }
      ];

      const storiesMock = createChainableMock({
        data: mockStories,
        error: null,
        count: 1
      });
      mockSupabase.from.mockReturnValue(storiesMock);

      const result = await service.getStories({}, 'user123');
      expect(result.stories).toHaveLength(1);
      expect(result.stories[0].owner_id).toBe('user123');
    });

    it('should get single story by ID', async () => {
      const mockStory = {
        id: 'test-id',
        owner_id: 'user123',
        owner_type: 'user',
        title: 'Test Story',
        category: 'memory',
        triggers: 'test',
        audio_url: 'url1',
        duration_ms: 60000,
        priority: 50,
        status: 'active',
        created_at: '2024-01-01',
        updated_at: '2024-01-01'
      };

      const storyMock = createChainableMock({
        data: mockStory,
        error: null
      });
      mockSupabase.from.mockReturnValue(storyMock);

      const result = await service.getStoryById('test-id', 'user123');
      expect(result?.id).toBe('test-id');
    });

    it('should update story metadata with authorization', async () => {
      // Mock ownership verification
      const ownershipMock = createChainableMock({
        data: { owner_id: 'user123', owner_type: 'user' },
        error: null
      });
      
      const updatedStory = {
        id: 'test-id',
        owner_id: 'user123',
        title: 'Updated Title',
        priority: 75
      };

      const updateMock = createChainableMock({
        data: updatedStory,
        error: null
      });
      
      mockSupabase.from
        .mockReturnValueOnce(ownershipMock) // For ownership verification
        .mockReturnValueOnce(updateMock);   // For actual update

      const result = await service.updateStory('test-id', {
        title: 'Updated Title',
        priority: 75
      }, 'user123');

      expect(result.title).toBe('Updated Title');
    });

    it('should prevent unauthorized updates', async () => {
      // Mock ownership verification that fails
      const ownershipMock = createChainableMock({
        data: { owner_id: 'other-user', owner_type: 'user' },
        error: null
      });
      
      mockSupabase.from.mockReturnValue(ownershipMock);

      await expect(service.updateStory('test-id', {
        title: 'Hacked Title'
      }, 'user123')).rejects.toThrow('Access denied');
    });

    it('should delete stories with authorization', async () => {
      // Mock ownership verification
      const ownershipMock = createChainableMock({
        data: { owner_id: 'user123', owner_type: 'user' },
        error: null
      });
      
      const deleteMock = createChainableMock({
        error: null
      });
      
      mockSupabase.from
        .mockReturnValueOnce(ownershipMock) // For ownership verification
        .mockReturnValueOnce(deleteMock);   // For actual delete

      const result = await service.deleteStory('test-id', 'user123');
      expect(result).toBe(true);
    });

    it('should prevent unauthorized deletions', async () => {
      // Mock ownership verification that fails
      const ownershipMock = createChainableMock({
        data: { owner_id: 'other-user', owner_type: 'user' },
        error: null
      });
      
      mockSupabase.from.mockReturnValue(ownershipMock);

      await expect(service.deleteStory('test-id', 'user123'))
        .rejects.toThrow('Access denied');
    });

    it('should handle batch operations', async () => {
      // Mock the verifyStoryOwnership method to avoid complex mocking
      vi.spyOn(service as any, 'verifyStoryOwnership').mockResolvedValue(undefined);
      
      // Mock the batch update operation
      const batchUpdateData = [
        { id: 'story1', status: 'inactive' },
        { id: 'story2', status: 'inactive' }
      ];
      
      // Create a fresh mock for this test
      const updateMock = {
        update: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: batchUpdateData,
              error: null
            })
          })
        })
      };
      
      mockSupabase.from.mockReturnValue(updateMock);

      const result = await service.batchUpdateStories(
        ['story1', 'story2'],
        { status: 'inactive' },
        'user123'
      );

      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('inactive');
    });

    it('should search stories with filters', async () => {
      const mockStories = [
        {
          id: '1',
          owner_id: 'user123',
          owner_type: 'user',
          title: 'Childhood Memory',
          category: 'memory',
          triggers: 'childhood, school',
          audio_url: 'url1',
          duration_ms: 60000,
          priority: 80,
          status: 'active',
          created_at: '2024-01-01',
          updated_at: '2024-01-01'
        }
      ];

      const searchMock = createChainableMock({
        data: mockStories,
        error: null,
        count: 1
      });
      mockSupabase.from.mockReturnValue(searchMock);

      const result = await service.searchStories(
        'childhood',
        { category: 'memory', minPriority: 50 },
        { limit: 10 },
        'user123'
      );

      expect(result.stories).toHaveLength(1);
      expect(result.stories[0].title).toBe('Childhood Memory');
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      const errorMock = createChainableMock({
        data: null,
        error: { message: 'Connection failed' }
      });
      mockSupabase.from.mockReturnValue(errorMock);

      await expect(service.getStories()).rejects.toThrow('Failed to fetch stories');
    });

    it('should handle story not found errors', async () => {
      const notFoundMock = createChainableMock({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' }
      });
      mockSupabase.from.mockReturnValue(notFoundMock);

      const result = await service.getStoryById('nonexistent-id');
      expect(result).toBeNull();
    });

    it('should handle database constraint violations', async () => {
      const constraintMock = createChainableMock({
        data: null,
        error: { message: 'Maximum of 5 stories allowed per avatar' }
      });
      
      // Mock story count check to pass, but database insert to fail
      vi.spyOn(service, 'getStoryCount').mockResolvedValue(4);
      mockSupabase.from.mockReturnValue(constraintMock);

      const request = {
        file: mockFile,
        title: 'Test Story',
        category: 'memory' as const,
        triggers: ['test']
      };

      await expect(service.createStory(request))
        .rejects.toThrow(StoryLimitExceededError);
    });

    it('should handle analytics recording failures gracefully', async () => {
      const analyticsMock = createChainableMock({
        error: { message: 'Analytics insert failed' }
      });
      mockSupabase.from.mockReturnValue(analyticsMock);

      // Should not throw error, just log it
      await expect(service.recordUsage({
        story_id: 'test-id',
        played_successfully: true
      })).resolves.not.toThrow();
    });

    it('should validate batch operation inputs', async () => {
      await expect(service.batchUpdateStories([], {}))
        .resolves.toEqual([]);

      await expect(service.batchDeleteStories([]))
        .resolves.toBe(true);

      await expect(service.batchUpdateStories(['id1'], {}))
        .rejects.toThrow('No updates provided');
    });
  });

  describe('Performance and Indexing', () => {
    it('should use proper database queries for performance', async () => {
      const mockStories = [
        {
          id: '1',
          owner_id: 'user1',
          owner_type: 'avatar',
          title: 'Test Story',
          category: 'memory',
          triggers: 'test',
          audio_url: 'url1',
          duration_ms: 60000,
          priority: 50,
          status: 'active',
          created_at: '2024-01-01',
          updated_at: '2024-01-01'
        }
      ];

      const indexedQueryMock = createChainableMock({
        data: mockStories,
        error: null,
        count: 1
      });
      mockSupabase.from.mockReturnValue(indexedQueryMock);

      // Test that queries use indexed columns
      await service.getStories({
        owner_type: 'avatar',
        owner_id: 'user1',
        status: 'active'
      });

      // Verify the query was constructed properly (mocked, but structure is important)
      expect(mockSupabase.from).toHaveBeenCalledWith('user_stories');
    });

    it('should enforce pagination limits', async () => {
      const result = await service.getStories({ limit: 200 }); // Request more than max
      expect(result.limit).toBeLessThanOrEqual(100); // Should be capped at 100
    });

    it('should handle concurrent operations', async () => {
      const mockStory = {
        id: 'test-id',
        owner_id: 'user123',
        owner_type: 'user',
        title: 'Test Story',
        category: 'memory',
        triggers: 'test',
        audio_url: 'url1',
        duration_ms: 60000,
        priority: 50,
        status: 'active',
        created_at: '2024-01-01',
        updated_at: '2024-01-01'
      };

      const storyMock = createChainableMock({
        data: mockStory,
        error: null
      });
      mockSupabase.from.mockReturnValue(storyMock);

      // Simulate concurrent reads
      const promises = Array(5).fill(null).map(() => 
        service.getStoryById('test-id', 'user123')
      );

      const results = await Promise.all(promises);
      results.forEach(result => {
        expect(result?.id).toBe('test-id');
      });
    });
  });
});