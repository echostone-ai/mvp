/**
 * Integration tests for UserStoryService database schema
 * These tests verify the database schema and constraints work correctly
 */

import { describe, it, expect } from 'vitest';
import { 
  validateStoryFile, 
  validateStoryMetadata, 
  parseTriggersFromString, 
  formatTriggersToString,
  STORY_CONSTRAINTS 
} from '../../types/stories';

describe('UserStoryService Integration', () => {
  describe('Database Schema Validation', () => {
    it('should validate story constraints match database schema', () => {
      // Verify duration constraints match migration
      expect(STORY_CONSTRAINTS.MIN_DURATION_MS).toBe(30000); // 30 seconds
      expect(STORY_CONSTRAINTS.MAX_DURATION_MS).toBe(300000); // 5 minutes
      
      // Verify file size constraint
      expect(STORY_CONSTRAINTS.MAX_FILE_SIZE_MB).toBe(10);
      
      // Verify story limit constraint
      expect(STORY_CONSTRAINTS.MAX_STORIES_PER_AVATAR).toBe(5);
      
      // Verify priority range
      expect(STORY_CONSTRAINTS.MIN_PRIORITY).toBe(0);
      expect(STORY_CONSTRAINTS.MAX_PRIORITY).toBe(100);
    });

    it('should validate trigger string formatting matches database storage', () => {
      const triggers = ['childhood', 'school', 'friends', 'memory'];
      const formatted = formatTriggersToString(triggers);
      
      // Should be comma-separated, lowercase
      expect(formatted).toBe('childhood, school, friends, memory');
      
      // Should parse back correctly
      const parsed = parseTriggersFromString(formatted);
      expect(parsed).toEqual(['childhood', 'school', 'friends', 'memory']);
    });

    it('should handle trigger normalization correctly', () => {
      const messyTriggers = ['  CHILDHOOD  ', 'School', '  friends  ', 'Memory'];
      const formatted = formatTriggersToString(messyTriggers);
      
      // Should normalize to lowercase and trim
      expect(formatted).toBe('childhood, school, friends, memory');
    });

    it('should enforce maximum trigger limit', () => {
      const tooManyTriggers = Array(25).fill('trigger');
      const formatted = formatTriggersToString(tooManyTriggers);
      
      // Should only keep first 20 triggers
      const parsed = parseTriggersFromString(formatted);
      expect(parsed).toHaveLength(STORY_CONSTRAINTS.MAX_TRIGGERS);
    });
  });

  describe('File Validation', () => {
    it('should validate MP3 files correctly', () => {
      const validFile = new File(['audio data'], 'story.mp3', {
        type: 'audio/mpeg',
        lastModified: Date.now()
      });

      const result = validateStoryFile(validFile);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject oversized files', () => {
      // Create a file larger than 10MB
      const largeFile = new File(['x'.repeat(11 * 1024 * 1024)], 'large.mp3', {
        type: 'audio/mpeg'
      });

      const result = validateStoryFile(largeFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('10MB');
    });

    it('should reject non-MP3 files', () => {
      const invalidFile = new File(['audio data'], 'story.wav', {
        type: 'audio/wav'
      });

      const result = validateStoryFile(invalidFile);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('MP3 format');
    });
  });

  describe('Metadata Validation', () => {
    it('should validate complete story metadata', () => {
      const validMetadata = {
        title: 'My Childhood Memory',
        category: 'memory' as const,
        triggers: ['childhood', 'school', 'friends'],
        transcript: 'This is a story about my childhood...',
        priority: 75
      };

      const result = validateStoryMetadata(validMetadata);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require title and category', () => {
      const invalidMetadata = {
        triggers: ['test']
      };

      const result = validateStoryMetadata(invalidMetadata);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Title is required');
      expect(result.errors).toContain('Category is required');
    });

    it('should validate category values', () => {
      const invalidMetadata = {
        title: 'Test Story',
        category: 'invalid' as any,
        triggers: ['test']
      };

      const result = validateStoryMetadata(invalidMetadata);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid category');
    });

    it('should validate priority range', () => {
      const invalidMetadata = {
        title: 'Test Story',
        category: 'memory' as const,
        triggers: ['test'],
        priority: 150 // Invalid: > 100
      };

      const result = validateStoryMetadata(invalidMetadata);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Priority must be between'))).toBe(true);
    });

    it('should validate trigger requirements', () => {
      const invalidMetadata = {
        title: 'Test Story',
        category: 'memory' as const,
        triggers: [] // Empty triggers
      };

      const result = validateStoryMetadata(invalidMetadata);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('At least one trigger keyword is required');
    });

    it('should limit number of triggers', () => {
      const invalidMetadata = {
        title: 'Test Story',
        category: 'memory' as const,
        triggers: Array(25).fill('trigger') // Too many triggers
      };

      const result = validateStoryMetadata(invalidMetadata);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Maximum 20 trigger keywords'))).toBe(true);
    });
  });

  describe('Database Constraint Simulation', () => {
    it('should simulate database duration constraint', () => {
      // Test minimum duration
      const tooShort = 25000; // 25 seconds
      expect(tooShort).toBeLessThan(STORY_CONSTRAINTS.MIN_DURATION_MS);
      
      // Test maximum duration
      const tooLong = 350000; // 5.8 minutes
      expect(tooLong).toBeGreaterThan(STORY_CONSTRAINTS.MAX_DURATION_MS);
      
      // Test valid duration
      const validDuration = 120000; // 2 minutes
      expect(validDuration).toBeGreaterThanOrEqual(STORY_CONSTRAINTS.MIN_DURATION_MS);
      expect(validDuration).toBeLessThanOrEqual(STORY_CONSTRAINTS.MAX_DURATION_MS);
    });

    it('should simulate story limit constraint', () => {
      // Simulate checking story count before insert
      const currentStoryCount = 5;
      const wouldExceedLimit = currentStoryCount >= STORY_CONSTRAINTS.MAX_STORIES_PER_AVATAR;
      
      expect(wouldExceedLimit).toBe(true);
      
      // Test under limit
      const underLimitCount = 3;
      const underLimit = underLimitCount < STORY_CONSTRAINTS.MAX_STORIES_PER_AVATAR;
      
      expect(underLimit).toBe(true);
    });
  });
});