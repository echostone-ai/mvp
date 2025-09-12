// src/lib/services/__tests__/embeddingService.test.ts
// Tests for embedding service functionality

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EmbeddingService, EmbeddingConfig } from '../embeddingService';

// Mock OpenAI
const mockOpenAI = {
  embeddings: {
    create: vi.fn()
  }
};

vi.mock('openai', () => {
  return {
    default: vi.fn(() => mockOpenAI)
  };
});

describe('EmbeddingService', () => {
  let embeddingService: EmbeddingService;
  let config: EmbeddingConfig;

  beforeEach(() => {
    config = EmbeddingService.getDefaultConfig();
    embeddingService = new EmbeddingService(config, 'test-api-key');
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const service = new EmbeddingService(config, 'test-key');
      expect(service.getConfig()).toEqual(config);
    });

    it('should throw error without API key', () => {
      delete process.env.OPENAI_API_KEY;
      expect(() => new EmbeddingService(config)).toThrow('OpenAI API key required');
    });

    it('should use environment API key if available', () => {
      process.env.OPENAI_API_KEY = 'env-key';
      expect(() => new EmbeddingService(config)).not.toThrow();
    });
  });

  describe('generateEmbedding', () => {
    it('should generate embedding for valid text', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
        usage: { total_tokens: 10 }
      });

      const result = await embeddingService.generateEmbedding('test text');

      expect(result).toEqual({
        text: 'test text',
        embedding: mockEmbedding,
        model: 'text-embedding-3-small',
        dimensions: 1536,
        tokenCount: 10
      });

      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: 'test text',
        dimensions: 1536
      });
    });

    it('should throw error for empty text', async () => {
      await expect(embeddingService.generateEmbedding('')).rejects.toThrow(
        'Cannot generate embedding for empty text'
      );
    });

    it('should throw error for whitespace-only text', async () => {
      await expect(embeddingService.generateEmbedding('   ')).rejects.toThrow(
        'Cannot generate embedding for empty text'
      );
    });

    it('should handle API errors', async () => {
      mockOpenAI.embeddings.create.mockRejectedValue(new Error('API Error'));

      await expect(embeddingService.generateEmbedding('test')).rejects.toThrow(
        'Embedding generation failed: API Error'
      );
    });

    it('should validate embedding dimensions', async () => {
      const wrongDimensionEmbedding = new Array(512).fill(0.1); // Wrong dimensions
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: wrongDimensionEmbedding }],
        usage: { total_tokens: 10 }
      });

      await expect(embeddingService.generateEmbedding('test')).rejects.toThrow(
        'Expected 1536 dimensions, got 512'
      );
    });

    it('should handle empty response data', async () => {
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [],
        usage: { total_tokens: 0 }
      });

      await expect(embeddingService.generateEmbedding('test')).rejects.toThrow(
        'No embedding data returned from OpenAI'
      );
    });
  });

  describe('generateBatchEmbeddings', () => {
    it('should generate embeddings for multiple texts', async () => {
      const mockEmbedding1 = new Array(1536).fill(0.1);
      const mockEmbedding2 = new Array(1536).fill(0.2);
      
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [
          { embedding: mockEmbedding1 },
          { embedding: mockEmbedding2 }
        ],
        usage: { total_tokens: 20 }
      });

      const texts = ['text 1', 'text 2'];
      const result = await embeddingService.generateBatchEmbeddings(texts);

      expect(result.results).toHaveLength(2);
      expect(result.results[0]).toEqual({
        text: 'text 1',
        embedding: mockEmbedding1,
        model: 'text-embedding-3-small',
        dimensions: 1536,
        tokenCount: undefined
      });
      expect(result.results[1]).toEqual({
        text: 'text 2',
        embedding: mockEmbedding2,
        model: 'text-embedding-3-small',
        dimensions: 1536,
        tokenCount: undefined
      });
      expect(result.totalTokens).toBe(20);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle empty input array', async () => {
      const result = await embeddingService.generateBatchEmbeddings([]);

      expect(result.results).toHaveLength(0);
      expect(result.totalTokens).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(mockOpenAI.embeddings.create).not.toHaveBeenCalled();
    });

    it('should filter out empty texts', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: mockEmbedding }, { embedding: mockEmbedding }],
        usage: { total_tokens: 10 }
      });

      const texts = ['valid text', '', '   ', 'another valid text'];
      const result = await embeddingService.generateBatchEmbeddings(texts);

      expect(mockOpenAI.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: ['valid text', 'another valid text'],
        dimensions: 1536
      });
    });

    it('should process large batches in chunks', async () => {
      const config = { ...EmbeddingService.getDefaultConfig(), batchSize: 2 };
      const service = new EmbeddingService(config, 'test-key');
      
      const mockEmbedding = new Array(1536).fill(0.1);
      mockOpenAI.embeddings.create
        .mockResolvedValueOnce({
          data: [{ embedding: mockEmbedding }, { embedding: mockEmbedding }],
          usage: { total_tokens: 4 }
        })
        .mockResolvedValueOnce({
          data: [{ embedding: mockEmbedding }, { embedding: mockEmbedding }],
          usage: { total_tokens: 4 }
        })
        .mockResolvedValueOnce({
          data: [{ embedding: mockEmbedding }],
          usage: { total_tokens: 2 }
        });

      const texts = ['text1', 'text2', 'text3', 'text4', 'text5'];
      const result = await service.generateBatchEmbeddings(texts);

      expect(mockOpenAI.embeddings.create).toHaveBeenCalledTimes(3); // 3 batches: 2+2+1
      expect(result.results).toHaveLength(5); // All 5 texts processed
    });

    it('should handle batch processing errors gracefully', async () => {
      mockOpenAI.embeddings.create
        .mockResolvedValueOnce({
          data: [{ embedding: new Array(1536).fill(0.1) }],
          usage: { total_tokens: 5 }
        })
        .mockRejectedValueOnce(new Error('Batch 2 failed'))
        .mockResolvedValueOnce({
          data: [{ embedding: new Array(1536).fill(0.3) }],
          usage: { total_tokens: 5 }
        });

      const config = { ...EmbeddingService.getDefaultConfig(), batchSize: 1, maxRetries: 0 };
      const service = new EmbeddingService(config, 'test-key');
      
      const texts = ['text1', 'text2', 'text3'];
      const result = await service.generateBatchEmbeddings(texts);

      expect(result.results).toHaveLength(2); // Only successful batches
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Batch 2 failed');
    });

    it('should retry failed batches', async () => {
      const config = { ...EmbeddingService.getDefaultConfig(), maxRetries: 2 };
      const service = new EmbeddingService(config, 'test-key');
      
      mockOpenAI.embeddings.create
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockRejectedValueOnce(new Error('Another failure'))
        .mockResolvedValueOnce({
          data: [{ embedding: new Array(1536).fill(0.1) }],
          usage: { total_tokens: 10 }
        });

      const result = await service.generateBatchEmbeddings(['test text']);

      expect(mockOpenAI.embeddings.create).toHaveBeenCalledTimes(3); // 2 retries + 1 success
      expect(result.results).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('validateEmbedding', () => {
    it('should validate correct embedding', () => {
      const validEmbedding = new Array(1536).fill(0.1);
      expect(embeddingService.validateEmbedding(validEmbedding)).toBe(true);
    });

    it('should reject non-array input', () => {
      expect(embeddingService.validateEmbedding('not an array' as any)).toBe(false);
    });

    it('should reject wrong dimensions', () => {
      const wrongDimensions = new Array(512).fill(0.1);
      expect(embeddingService.validateEmbedding(wrongDimensions)).toBe(false);
    });

    it('should reject embeddings with invalid numbers', () => {
      const invalidEmbedding = new Array(1536).fill(0.1);
      invalidEmbedding[0] = NaN;
      expect(embeddingService.validateEmbedding(invalidEmbedding)).toBe(false);

      invalidEmbedding[0] = Infinity;
      expect(embeddingService.validateEmbedding(invalidEmbedding)).toBe(false);
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy status for working service', async () => {
      const mockEmbedding = new Array(1536).fill(0.1);
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: mockEmbedding }],
        usage: { total_tokens: 1 }
      });

      const health = await embeddingService.getHealthStatus();

      expect(health.status).toBe('healthy');
      expect(health.details).toContain('Service operational');
      expect(health.details).toContain('Model: text-embedding-3-small');
      expect(health.details).toContain('Dimensions: 1536');
    });

    it('should return unhealthy status for invalid embeddings', async () => {
      const invalidEmbedding = new Array(512).fill(0.1); // Wrong dimensions
      mockOpenAI.embeddings.create.mockResolvedValue({
        data: [{ embedding: invalidEmbedding }],
        usage: { total_tokens: 1 }
      });

      const health = await embeddingService.getHealthStatus();

      expect(health.status).toBe('unhealthy');
      expect(health.details[0]).toContain('Service error: Embedding generation failed');
    });

    it('should return unhealthy status for API errors', async () => {
      mockOpenAI.embeddings.create.mockRejectedValue(new Error('API Error'));

      const health = await embeddingService.getHealthStatus();

      expect(health.status).toBe('unhealthy');
      expect(health.details[0]).toContain('Service error: Embedding generation failed: API Error');
    });
  });

  describe('configuration', () => {
    it('should get default config', () => {
      const defaultConfig = EmbeddingService.getDefaultConfig();
      
      expect(defaultConfig).toEqual({
        model: 'text-embedding-3-small',
        dimensions: 1536,
        batchSize: 100,
        maxRetries: 3,
        timeoutMs: 30000
      });
    });

    it('should get large model config', () => {
      const largeConfig = EmbeddingService.getLargeModelConfig();
      
      expect(largeConfig).toEqual({
        model: 'text-embedding-3-large',
        dimensions: 3072,
        batchSize: 50,
        maxRetries: 3,
        timeoutMs: 45000
      });
    });

    it('should update config at runtime', () => {
      const newConfig = { batchSize: 50, maxRetries: 5 };
      embeddingService.updateConfig(newConfig);
      
      const updatedConfig = embeddingService.getConfig();
      expect(updatedConfig.batchSize).toBe(50);
      expect(updatedConfig.maxRetries).toBe(5);
      expect(updatedConfig.model).toBe('text-embedding-3-small'); // Unchanged
    });
  });
});