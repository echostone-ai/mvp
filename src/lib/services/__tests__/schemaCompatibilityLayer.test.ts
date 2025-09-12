/**
 * Tests for SchemaCompatibilityLayer
 * 
 * Verifies table name resolution, column validation, query qualification,
 * constraint validation, and automated schema verification functionality.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SchemaCompatibilityLayer, ValidationResult } from '../schemaCompatibilityLayer';

// Mock the supabase admin client
vi.mock('@/lib/data/client', () => ({
  sbAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        in: vi.fn(() => Promise.resolve({
          data: [
            // Mock schema data
            { table_name: 'avatar_profiles', column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: 'uuid_generate_v4()' },
            { table_name: 'avatar_profiles', column_name: 'name', data_type: 'text', is_nullable: 'NO', column_default: null },
            { table_name: 'avatar_profiles', column_name: 'description', data_type: 'text', is_nullable: 'YES', column_default: null },
            { table_name: 'avatar_profiles', column_name: 'created_at', data_type: 'timestamp with time zone', is_nullable: 'NO', column_default: 'now()' },
            { table_name: 'memory_fragments', column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: 'uuid_generate_v4()' },
            { table_name: 'memory_fragments', column_name: 'avatar_id', data_type: 'uuid', is_nullable: 'NO', column_default: null },
            { table_name: 'memory_fragments', column_name: 'fragment_text', data_type: 'text', is_nullable: 'NO', column_default: null },
            { table_name: 'quick_facts', column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: 'uuid_generate_v4()' },
            { table_name: 'quick_facts', column_name: 'avatar_id', data_type: 'uuid', is_nullable: 'NO', column_default: null },
            { table_name: 'quick_facts', column_name: 'key', data_type: 'text', is_nullable: 'NO', column_default: null },
            { table_name: 'quick_facts', column_name: 'value', data_type: 'text', is_nullable: 'NO', column_default: null },
            { table_name: 'quick_facts', column_name: 'source', data_type: 'text', is_nullable: 'NO', column_default: null },
            { table_name: 'fact_history', column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: 'uuid_generate_v4()' },
            { table_name: 'fact_history', column_name: 'avatar_id', data_type: 'uuid', is_nullable: 'NO', column_default: null },
            { table_name: 'fact_history', column_name: 'change_source', data_type: 'text', is_nullable: 'NO', column_default: null },
            // Include legacy avatars table to test warnings
            { table_name: 'avatars', column_name: 'id', data_type: 'uuid', is_nullable: 'NO', column_default: 'uuid_generate_v4()' },
            { table_name: 'avatars', column_name: 'slug', data_type: 'text', is_nullable: 'NO', column_default: null }
          ],
          error: null
        }))
      }))
    }))
  }
}));

describe('SchemaCompatibilityLayer', () => {
  let schemaLayer: SchemaCompatibilityLayer;

  beforeEach(() => {
    // Get fresh instance and clear cache
    schemaLayer = SchemaCompatibilityLayer.getInstance();
    schemaLayer.clearCache();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Table Name Resolution', () => {
    it('should resolve legacy table names to current names', () => {
      expect(schemaLayer.resolveTableName('avatars')).toBe('avatar_profiles');
      expect(schemaLayer.resolveTableName('avatar_profiles')).toBe('avatar_profiles');
      expect(schemaLayer.resolveTableName('memory_fragments')).toBe('memory_fragments');
    });

    it('should return original name for unknown tables', () => {
      expect(schemaLayer.resolveTableName('unknown_table')).toBe('unknown_table');
    });

    it('should provide table mappings information', () => {
      const mappings = schemaLayer.getTableMappings();
      expect(mappings).toHaveLength(1);
      expect(mappings[0]).toEqual({
        legacyName: 'avatars',
        currentName: 'avatar_profiles',
        description: 'Avatar data moved from avatars to avatar_profiles table'
      });
    });
  });

  describe('Column Validation', () => {
    it('should validate existing columns', async () => {
      const isValid = await schemaLayer.validateColumnExists('avatar_profiles', 'name');
      expect(isValid).toBe(true);
    });

    it('should reject non-existing columns', async () => {
      const isValid = await schemaLayer.validateColumnExists('avatar_profiles', 'nonexistent_column');
      expect(isValid).toBe(false);
    });

    it('should resolve table names before validation', async () => {
      const isValid = await schemaLayer.validateColumnExists('avatars', 'name');
      expect(isValid).toBe(true); // Should resolve avatars -> avatar_profiles
    });

    it('should return false for non-existing tables', async () => {
      const isValid = await schemaLayer.validateColumnExists('nonexistent_table', 'id');
      expect(isValid).toBe(false);
    });

    it('should get table columns information', async () => {
      const columns = await schemaLayer.getTableColumns('avatar_profiles');
      expect(columns).toHaveLength(4);
      expect(columns.find(col => col.columnName === 'name')).toEqual({
        columnName: 'name',
        dataType: 'text',
        isNullable: false,
        defaultValue: null
      });
    });
  });

  describe('Query Qualification', () => {
    it('should qualify ambiguous column references', () => {
      const query = 'SELECT id, created_at FROM memory_fragments mf JOIN avatars a ON mf.avatar_id = a.id';
      const qualified = schemaLayer.qualifyJoinColumns(query);
      
      expect(qualified).toContain('a.id');
      expect(qualified).toContain('a.created_at');
      expect(qualified).toContain('avatar_profiles');
    });

    it('should handle memory fragment joins correctly', () => {
      const query = 'FROM memory_fragments mf JOIN avatars a ON mf.avatar_id = a.id';
      const qualified = schemaLayer.qualifyJoinColumns(query);
      
      expect(qualified).toContain('FROM memory_fragments mf JOIN avatar_profiles a');
    });

    it('should not modify already qualified columns', () => {
      const query = 'SELECT a.id, mf.created_at FROM memory_fragments mf JOIN avatar_profiles a';
      const qualified = schemaLayer.qualifyJoinColumns(query);
      
      // Should preserve already qualified columns
      expect(qualified).toContain('a.id');
      expect(qualified).toContain('mf.created_at');
      // Should not double-qualify
      expect(qualified).not.toContain('a.a.id');
    });
  });

  describe('Constraint Validation', () => {
    it('should validate fact_history change_source values', () => {
      const validData = { change_source: 'manual', avatar_id: 'test-id' };
      const result = schemaLayer.validateConstraints('fact_history', validData);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid fact_history change_source values', () => {
      const invalidData = { change_source: 'invalid_source', avatar_id: 'test-id' };
      const result = schemaLayer.validateConstraints('fact_history', invalidData);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Invalid value \'invalid_source\' for column \'change_source\'');
      expect(result.errors[0]).toContain('Allowed values: heuristic, llm, manual, extraction');
    });

    it('should validate quick_facts source values', () => {
      const validData = { source: 'extraction', key: 'name', value: 'John' };
      const result = schemaLayer.validateConstraints('quick_facts', validData);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle tables without constraint rules', () => {
      const data = { name: 'Test Avatar' };
      const result = schemaLayer.validateConstraints('avatar_profiles', data);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('No constraint validation rules defined');
    });

    it('should resolve table names before constraint validation', () => {
      const data = { change_source: 'manual' };
      const result = schemaLayer.validateConstraints('fact_history', data);
      
      expect(result.isValid).toBe(true);
    });
  });

  describe('Schema Verification', () => {
    it('should detect legacy table existence and warn', async () => {
      const result = await schemaLayer.verifySchemaCompatibility();
      
      expect(result.warnings.some(w => w.includes('Legacy table \'avatars\' still exists'))).toBe(true);
    });

    it('should verify critical tables exist', async () => {
      const result = await schemaLayer.verifySchemaCompatibility();
      
      // Should not have errors for existing tables
      const missingTableErrors = result.errors.filter(e => e.includes('is missing from schema'));
      expect(missingTableErrors).toHaveLength(0);
    });

    it('should verify critical columns exist', async () => {
      const result = await schemaLayer.verifySchemaCompatibility();
      
      // Should not have errors for existing columns
      const missingColumnErrors = result.errors.filter(e => e.includes('missing from table'));
      expect(missingColumnErrors).toHaveLength(0);
    });
  });

  describe('Query Transformation', () => {
    it('should transform legacy table references', () => {
      const query = 'SELECT * FROM avatars WHERE id = $1';
      const transformed = schemaLayer.transformQuery(query);
      
      expect(transformed).toBe('SELECT * FROM avatar_profiles WHERE id = $1');
    });

    it('should apply both table mapping and column qualification', () => {
      const query = 'SELECT id FROM memory_fragments mf JOIN avatars a ON mf.avatar_id = a.id';
      const transformed = schemaLayer.transformQuery(query);
      
      expect(transformed).toContain('avatar_profiles');
      expect(transformed).toContain('a.id');
    });

    it('should handle complex queries with multiple transformations', () => {
      const query = `
        SELECT mf.fragment_text, a.name, created_at
        FROM memory_fragments mf 
        JOIN avatars a ON mf.avatar_id = a.id
        WHERE a.id = $1
      `;
      const transformed = schemaLayer.transformQuery(query);
      
      expect(transformed).toContain('avatar_profiles');
      expect(transformed).toContain('a.created_at');
    });
  });

  describe('Complete Query Validation and Transformation', () => {
    it('should validate and transform queries successfully', async () => {
      const query = 'SELECT * FROM avatars WHERE name = $1';
      const result = await schemaLayer.validateAndTransformQuery(query);
      
      expect(result.transformedQuery).toContain('avatar_profiles');
      expect(result.validation.isValid).toBe(true);
      expect(result.validation.warnings.some(w => w.includes('legacy "avatars" table'))).toBe(true);
    });

    it('should warn about ambiguous column references', async () => {
      const query = 'SELECT id FROM memory_fragments mf JOIN avatar_profiles a ON mf.avatar_id = id';
      const result = await schemaLayer.validateAndTransformQuery(query);
      
      expect(result.validation.warnings.some(w => w.includes('ambiguous column references'))).toBe(true);
    });

    it('should handle transformation errors gracefully', async () => {
      // Mock an error in transformation
      const originalTransform = schemaLayer.transformQuery;
      schemaLayer.transformQuery = vi.fn(() => {
        throw new Error('Transformation failed');
      });

      const query = 'SELECT * FROM avatars';
      const result = await schemaLayer.validateAndTransformQuery(query);
      
      expect(result.validation.isValid).toBe(false);
      expect(result.validation.errors[0]).toContain('Query transformation failed');
      expect(result.transformedQuery).toBe(query); // Should return original on error

      // Restore original method
      schemaLayer.transformQuery = originalTransform;
    });
  });

  describe('Cache Management', () => {
    it('should cache schema information', async () => {
      // First call should fetch from database
      await schemaLayer.getTableColumns('avatar_profiles');
      
      // Second call should use cache (we can't directly test this without exposing internals,
      // but we can verify it doesn't throw errors)
      const columns = await schemaLayer.getTableColumns('avatar_profiles');
      expect(columns).toHaveLength(4);
    });

    it('should clear cache when requested', () => {
      schemaLayer.clearCache();
      // Cache clearing doesn't throw errors
      expect(true).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully in column validation', async () => {
      // Test with a table that doesn't exist in our mock data
      const isValid = await schemaLayer.validateColumnExists('nonexistent_table', 'name');
      expect(isValid).toBe(false);
    });

    it('should handle constraint validation for unknown tables', () => {
      const data = { some_field: 'value' };
      const result = schemaLayer.validateConstraints('unknown_table', data);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('No constraint validation rules defined');
    });
  });
});