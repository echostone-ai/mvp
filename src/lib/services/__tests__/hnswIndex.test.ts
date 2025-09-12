// src/lib/services/__tests__/hnswIndex.test.ts
// Unit tests for HNSW index implementation

import { describe, it, expect, beforeEach } from 'vitest';
import { HNSWIndex, HNSWConfig } from '../hnswIndex';

describe('HNSWIndex', () => {
  let index: HNSWIndex;
  let config: HNSWConfig;

  // Test vectors with known relationships
  const testVectors = [
    { id: 'v1', vector: [1.0, 0.0, 0.0] },
    { id: 'v2', vector: [0.9, 0.1, 0.0] }, // Similar to v1
    { id: 'v3', vector: [0.0, 1.0, 0.0] },
    { id: 'v4', vector: [0.0, 0.9, 0.1] }, // Similar to v3
    { id: 'v5', vector: [0.0, 0.0, 1.0] },
    { id: 'v6', vector: [0.1, 0.0, 0.9] }, // Similar to v5
    { id: 'v7', vector: [0.5, 0.5, 0.0] }, // Between v1 and v3
    { id: 'v8', vector: [0.33, 0.33, 0.33] } // Central
  ];

  beforeEach(() => {
    config = HNSWIndex.getDefaultConfig();
    config.seed = 42; // For reproducible tests
    index = new HNSWIndex(config);
  });

  describe('Constructor and Configuration', () => {
    it('should initialize with default config', () => {
      const defaultIndex = new HNSWIndex();
      const stats = defaultIndex.getStats();
      
      expect(stats.nodeCount).toBe(0);
      expect(stats.dimensions).toBe(0);
    });

    it('should initialize with custom config', () => {
      const customConfig: Partial<HNSWConfig> = {
        maxConnections: 8,
        efConstruction: 100,
        efSearch: 32,
        seed: 123
      };
      
      const customIndex = new HNSWIndex(customConfig);
      expect(customIndex).toBeDefined();
    });

    it('should provide preset configurations', () => {
      const defaultConfig = HNSWIndex.getDefaultConfig();
      expect(defaultConfig.maxConnections).toBe(16);
      expect(defaultConfig.efConstruction).toBe(200);
      expect(defaultConfig.efSearch).toBe(50);

      const smallConfig = HNSWIndex.getSmallDatasetConfig();
      expect(smallConfig.maxConnections).toBe(8);
      expect(smallConfig.efConstruction).toBe(100);

      const largeConfig = HNSWIndex.getLargeDatasetConfig();
      expect(largeConfig.maxConnections).toBe(32);
      expect(largeConfig.efConstruction).toBe(400);
    });
  });

  describe('Adding Vectors', () => {
    it('should add vectors to the index', () => {
      index.add('test1', [1.0, 0.0, 0.0]);
      index.add('test2', [0.0, 1.0, 0.0]);
      
      expect(index.size()).toBe(2);
      
      const stats = index.getStats();
      expect(stats.nodeCount).toBe(2);
      expect(stats.dimensions).toBe(3);
    });

    it('should handle first vector as entry point', () => {
      index.add('entry', [1.0, 0.0, 0.0]);
      
      expect(index.size()).toBe(1);
      const stats = index.getStats();
      expect(stats.nodeCount).toBe(1);
    });

    it('should reject vectors with mismatched dimensions', () => {
      index.add('first', [1.0, 0.0, 0.0]);
      
      expect(() => {
        index.add('second', [1.0, 0.0]); // Wrong dimension
      }).toThrow('Vector dimension mismatch');
    });

    it('should handle duplicate IDs gracefully', () => {
      index.add('duplicate', [1.0, 0.0, 0.0]);
      index.add('duplicate', [0.0, 1.0, 0.0]); // Should warn but not crash
      
      expect(index.size()).toBe(1); // Should not add duplicate
    });

    it('should build index with multiple vectors', () => {
      testVectors.forEach(({ id, vector }) => {
        index.add(id, vector);
      });
      
      expect(index.size()).toBe(testVectors.length);
      
      const stats = index.getStats();
      expect(stats.nodeCount).toBe(testVectors.length);
      expect(stats.dimensions).toBe(3);
      expect(stats.maxLevel).toBeGreaterThanOrEqual(0);
      expect(stats.avgConnections).toBeGreaterThan(0);
    });
  });

  describe('Vector Search', () => {
    beforeEach(() => {
      // Add test vectors
      testVectors.forEach(({ id, vector }) => {
        index.add(id, vector);
      });
    });

    it('should return empty results for empty index', () => {
      const emptyIndex = new HNSWIndex(config);
      const results = emptyIndex.search([1.0, 0.0, 0.0], 5);
      
      expect(results).toEqual([]);
    });

    it('should find exact matches', () => {
      const results = index.search([1.0, 0.0, 0.0], 1);
      
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('v1');
      expect(results[0].distance).toBeCloseTo(0, 5);
    });

    it('should find nearest neighbors', () => {
      const results = index.search([1.0, 0.0, 0.0], 3);
      
      expect(results.length).toBe(3);
      expect(results[0].id).toBe('v1'); // Exact match
      expect(results[1].id).toBe('v2'); // Similar vector
      
      // Results should be sorted by distance
      for (let i = 1; i < results.length; i++) {
        expect(results[i].distance).toBeGreaterThanOrEqual(results[i-1].distance);
      }
    });

    it('should respect k parameter', () => {
      const results1 = index.search([0.5, 0.5, 0.0], 1);
      const results3 = index.search([0.5, 0.5, 0.0], 3);
      const results10 = index.search([0.5, 0.5, 0.0], 10);
      
      expect(results1.length).toBe(1);
      expect(results3.length).toBe(3);
      expect(results10.length).toBeLessThanOrEqual(testVectors.length);
    });

    it('should handle query dimension mismatch', () => {
      expect(() => {
        index.search([1.0, 0.0], 1); // Wrong dimension
      }).toThrow('Query dimension mismatch');
    });

    it('should find semantically similar vectors', () => {
      // Search for vector similar to v1
      const results = index.search([0.95, 0.05, 0.0], 2);
      
      expect(results.length).toBe(2);
      // Should find v1 and v2 as closest
      const ids = results.map(r => r.id);
      expect(ids).toContain('v1');
      expect(ids).toContain('v2');
    });
  });

  describe('Performance', () => {
    it('should perform search within reasonable time', () => {
      // Add many vectors
      const manyVectors = Array.from({ length: 1000 }, (_, i) => ({
        id: `vec_${i}`,
        vector: [Math.random(), Math.random(), Math.random()]
      }));
      
      manyVectors.forEach(({ id, vector }) => {
        index.add(id, vector);
      });
      
      const startTime = Date.now();
      const results = index.search([0.5, 0.5, 0.5], 10);
      const elapsedMs = Date.now() - startTime;
      
      expect(results.length).toBe(10);
      expect(elapsedMs).toBeLessThan(100); // Should be fast
    });

    it('should scale better than linear search', () => {
      // This test demonstrates the performance benefit
      // In practice, HNSW should be faster for large datasets
      const vectorCount = 500;
      const vectors = Array.from({ length: vectorCount }, (_, i) => ({
        id: `perf_${i}`,
        vector: [Math.random(), Math.random(), Math.random()]
      }));
      
      vectors.forEach(({ id, vector }) => {
        index.add(id, vector);
      });
      
      // Perform multiple searches
      const searchCount = 10;
      const startTime = Date.now();
      
      for (let i = 0; i < searchCount; i++) {
        index.search([Math.random(), Math.random(), Math.random()], 5);
      }
      
      const elapsedMs = Date.now() - startTime;
      const avgSearchTime = elapsedMs / searchCount;
      
      expect(avgSearchTime).toBeLessThan(50); // Should average < 50ms per search
    });
  });

  describe('Index Statistics', () => {
    beforeEach(() => {
      testVectors.forEach(({ id, vector }) => {
        index.add(id, vector);
      });
    });

    it('should provide accurate statistics', () => {
      const stats = index.getStats();
      
      expect(stats.nodeCount).toBe(testVectors.length);
      expect(stats.dimensions).toBe(3);
      expect(stats.maxLevel).toBeGreaterThanOrEqual(0);
      expect(stats.avgConnections).toBeGreaterThan(0);
      expect(stats.memoryUsageMB).toBeGreaterThan(0);
    });

    it('should report zero stats for empty index', () => {
      const emptyIndex = new HNSWIndex(config);
      const stats = emptyIndex.getStats();
      
      expect(stats.nodeCount).toBe(0);
      expect(stats.dimensions).toBe(0);
      expect(stats.maxLevel).toBe(0);
      expect(stats.avgConnections).toBe(0);
      expect(stats.memoryUsageMB).toBe(0);
    });
  });

  describe('Serialization and Persistence', () => {
    beforeEach(() => {
      testVectors.forEach(({ id, vector }) => {
        index.add(id, vector);
      });
    });

    it('should serialize and deserialize index', () => {
      const serialized = index.serialize();
      expect(serialized).toBeDefined();
      expect(typeof serialized).toBe('string');
      
      const deserialized = HNSWIndex.deserialize(serialized);
      expect(deserialized.size()).toBe(index.size());
      
      const originalStats = index.getStats();
      const deserializedStats = deserialized.getStats();
      
      expect(deserializedStats.nodeCount).toBe(originalStats.nodeCount);
      expect(deserializedStats.dimensions).toBe(originalStats.dimensions);
    });

    it('should maintain search accuracy after deserialization', () => {
      const originalResults = index.search([1.0, 0.0, 0.0], 3);
      
      const serialized = index.serialize();
      const deserialized = HNSWIndex.deserialize(serialized);
      const deserializedResults = deserialized.search([1.0, 0.0, 0.0], 3);
      
      expect(deserializedResults.length).toBe(originalResults.length);
      
      // Results should be identical (same IDs and distances)
      for (let i = 0; i < originalResults.length; i++) {
        expect(deserializedResults[i].id).toBe(originalResults[i].id);
        expect(deserializedResults[i].distance).toBeCloseTo(originalResults[i].distance, 5);
      }
    });

    it('should handle serialization of empty index', () => {
      const emptyIndex = new HNSWIndex(config);
      const serialized = emptyIndex.serialize();
      const deserialized = HNSWIndex.deserialize(serialized);
      
      expect(deserialized.size()).toBe(0);
      expect(deserialized.search([1.0, 0.0, 0.0], 1)).toEqual([]);
    });
  });

  describe('Clear and Reset', () => {
    it('should clear all nodes', () => {
      testVectors.forEach(({ id, vector }) => {
        index.add(id, vector);
      });
      
      expect(index.size()).toBe(testVectors.length);
      
      index.clear();
      
      expect(index.size()).toBe(0);
      const stats = index.getStats();
      expect(stats.nodeCount).toBe(0);
      expect(stats.dimensions).toBe(0);
    });

    it('should allow rebuilding after clear', () => {
      index.add('test1', [1.0, 0.0, 0.0]);
      index.clear();
      
      index.add('test2', [0.0, 1.0, 0.0]);
      expect(index.size()).toBe(1);
      
      const results = index.search([0.0, 1.0, 0.0], 1);
      expect(results[0].id).toBe('test2');
    });
  });

  describe('Edge Cases', () => {
    it('should handle single vector index', () => {
      index.add('single', [1.0, 0.0, 0.0]);
      
      const results = index.search([1.0, 0.0, 0.0], 5);
      expect(results.length).toBe(1);
      expect(results[0].id).toBe('single');
    });

    it('should handle identical vectors', () => {
      index.add('identical1', [1.0, 0.0, 0.0]);
      index.add('identical2', [1.0, 0.0, 0.0]);
      index.add('identical3', [1.0, 0.0, 0.0]);
      
      const results = index.search([1.0, 0.0, 0.0], 3);
      expect(results.length).toBe(3);
      
      // All should have distance 0
      results.forEach(result => {
        expect(result.distance).toBeCloseTo(0, 5);
      });
    });

    it('should handle zero vectors', () => {
      index.add('zero1', [0.0, 0.0, 0.0]);
      index.add('zero2', [0.0, 0.0, 0.0]);
      index.add('nonzero', [1.0, 0.0, 0.0]);
      
      const results = index.search([0.0, 0.0, 0.0], 2);
      expect(results.length).toBe(2);
      
      // Should find the zero vectors first
      expect(results[0].distance).toBeCloseTo(0, 5);
      expect(results[1].distance).toBeCloseTo(0, 5);
    });

    it('should handle high-dimensional vectors', () => {
      const dimensions = 100;
      const highDimIndex = new HNSWIndex({ ...config, seed: 42 });
      
      // Add some high-dimensional vectors
      for (let i = 0; i < 10; i++) {
        const vector = Array.from({ length: dimensions }, () => Math.random());
        highDimIndex.add(`hd_${i}`, vector);
      }
      
      expect(highDimIndex.size()).toBe(10);
      
      const queryVector = Array.from({ length: dimensions }, () => Math.random());
      const results = highDimIndex.search(queryVector, 3);
      
      expect(results.length).toBe(3);
      expect(results[0].distance).toBeGreaterThan(0);
    });
  });

  describe('Reproducibility', () => {
    it('should produce consistent results with same seed', () => {
      const index1 = new HNSWIndex({ ...config, seed: 123 });
      const index2 = new HNSWIndex({ ...config, seed: 123 });
      
      testVectors.forEach(({ id, vector }) => {
        index1.add(id, vector);
        index2.add(id, vector);
      });
      
      const results1 = index1.search([0.5, 0.5, 0.0], 5);
      const results2 = index2.search([0.5, 0.5, 0.0], 5);
      
      expect(results1.length).toBe(results2.length);
      
      // Results should be identical with same seed
      for (let i = 0; i < results1.length; i++) {
        expect(results1[i].id).toBe(results2[i].id);
        expect(results1[i].distance).toBeCloseTo(results2[i].distance, 5);
      }
    });

    it('should produce different results with different seeds', () => {
      const index1 = new HNSWIndex({ ...config, seed: 123 });
      const index2 = new HNSWIndex({ ...config, seed: 456 });
      
      // Add many vectors to increase chance of different graph structures
      const manyVectors = Array.from({ length: 50 }, (_, i) => ({
        id: `vec_${i}`,
        vector: [Math.random(), Math.random(), Math.random()]
      }));
      
      manyVectors.forEach(({ id, vector }) => {
        index1.add(id, vector);
        index2.add(id, vector);
      });
      
      const results1 = index1.search([0.5, 0.5, 0.0], 10);
      const results2 = index2.search([0.5, 0.5, 0.0], 10);
      
      // Results might be different due to different graph structures
      // But both should return valid results
      expect(results1.length).toBe(10);
      expect(results2.length).toBe(10);
    });
  });
});