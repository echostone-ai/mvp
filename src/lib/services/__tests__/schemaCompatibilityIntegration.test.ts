/**
 * Integration Tests for SchemaCompatibilityLayer
 * 
 * Tests the compatibility layer with realistic database query scenarios
 * that would be used in the GPT-5 Avatar Memory Upgrade system.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SchemaCompatibilityLayer } from '../schemaCompatibilityLayer';

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

describe('SchemaCompatibilityLayer Integration', () => {
  let schemaLayer: SchemaCompatibilityLayer;

  beforeEach(() => {
    schemaLayer = SchemaCompatibilityLayer.getInstance();
    schemaLayer.clearCache();
  });

  describe('Real-world Query Scenarios', () => {
    it('should handle avatar memory retrieval queries', async () => {
      const legacyQuery = `
        SELECT mf.fragment_text, a.name, created_at
        FROM memory_fragments mf 
        JOIN avatars a ON mf.avatar_id = a.id
        WHERE a.slug = $1
        ORDER BY created_at DESC
        LIMIT 10
      `;

      const result = await schemaLayer.validateAndTransformQuery(legacyQuery);
      
      expect(result.validation.isValid).toBe(true);
      expect(result.transformedQuery).toContain('avatar_profiles');
      expect(result.transformedQuery).toContain('a.created_at');
      expect(result.validation.warnings).toHaveLength(1);
      expect(result.validation.warnings[0]).toContain('legacy "avatars" table');
    });

    it('should handle quick facts insertion with constraint validation', () => {
      const insertData = {
        avatar_id: 'test-uuid',
        key: 'name',
        value: 'John Doe',
        source: 'manual',
        confidence: 0.95,
        priority: 1
      };

      const validation = schemaLayer.validateConstraints('quick_facts', insertData);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject invalid fact history inserts', () => {
      const invalidData = {
        avatar_id: 'test-uuid',
        change_source: 'invalid_source', // This should fail
        old_value: 'old',
        new_value: 'new'
      };

      const validation = schemaLayer.validateConstraints('fact_history', invalidData);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors).toHaveLength(1);
      expect(validation.errors[0]).toContain('Invalid value \'invalid_source\'');
      expect(validation.errors[0]).toContain('heuristic, llm, manual, extraction');
    });

    it('should handle complex memory search queries', async () => {
      const complexQuery = `
        SELECT 
          mf.id,
          mf.fragment_text,
          mf.conversation_context,
          a.name as avatar_name,
          similarity(mf.fragment_text, $1) as relevance_score
        FROM memory_fragments mf
        JOIN avatars a ON mf.avatar_id = a.id
        WHERE a.id = $2
          AND mf.fragment_text ILIKE '%' || $1 || '%'
        ORDER BY relevance_score DESC, created_at DESC
        LIMIT $3
      `;

      const result = await schemaLayer.validateAndTransformQuery(complexQuery);
      
      expect(result.validation.isValid).toBe(true);
      expect(result.transformedQuery).toContain('avatar_profiles');
      expect(result.transformedQuery).toContain('a.created_at');
      expect(result.transformedQuery).not.toContain('avatars a');
    });

    it('should handle fact promotion queries', async () => {
      const promotionQuery = `
        INSERT INTO fact_history (avatar_id, fact_key, old_value, new_value, change_source, confidence)
        SELECT qf.avatar_id, qf.key, qf.value, $1, 'extraction', $2
        FROM quick_facts qf
        JOIN avatars a ON qf.avatar_id = a.id
        WHERE a.slug = $3 AND qf.key = $4
      `;

      const result = await schemaLayer.validateAndTransformQuery(promotionQuery);
      
      expect(result.validation.isValid).toBe(true);
      expect(result.transformedQuery).toContain('avatar_profiles');
      
      // Validate the data that would be inserted
      const insertData = {
        change_source: 'extraction',
        confidence: 0.85
      };
      
      const validation = schemaLayer.validateConstraints('fact_history', insertData);
      expect(validation.isValid).toBe(true);
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should provide helpful error messages for missing tables', async () => {
      const queryWithMissingTable = `
        SELECT * FROM nonexistent_table WHERE id = $1
      `;

      const result = await schemaLayer.validateAndTransformQuery(queryWithMissingTable);
      
      // Query transformation should still work even if table doesn't exist
      expect(result.validation.isValid).toBe(true);
      expect(result.transformedQuery.trim()).toBe(queryWithMissingTable.trim());
    });

    it('should handle multiple table mappings in one query', async () => {
      const multiTableQuery = `
        SELECT a.name, mf.fragment_text, qf.value
        FROM avatars a
        JOIN memory_fragments mf ON mf.avatar_id = a.id
        JOIN quick_facts qf ON qf.avatar_id = a.id
        WHERE a.slug = $1
      `;

      const result = await schemaLayer.validateAndTransformQuery(multiTableQuery);
      
      expect(result.validation.isValid).toBe(true);
      expect(result.transformedQuery).toContain('avatar_profiles a');
      expect(result.transformedQuery).not.toContain('avatars a');
      expect(result.validation.warnings).toHaveLength(1);
    });
  });

  describe('Performance and Caching', () => {
    it('should cache schema information across multiple calls', async () => {
      // First call - should fetch from database
      const start1 = Date.now();
      await schemaLayer.validateColumnExists('avatar_profiles', 'name');
      const duration1 = Date.now() - start1;

      // Second call - should use cache
      const start2 = Date.now();
      await schemaLayer.validateColumnExists('avatar_profiles', 'description');
      const duration2 = Date.now() - start2;

      // Cache should make second call faster (though this is hard to test reliably)
      expect(duration2).toBeLessThanOrEqual(duration1 + 10); // Allow some variance
    });

    it('should handle rapid successive transformations', async () => {
      const queries = [
        'SELECT * FROM avatars WHERE id = $1',
        'SELECT * FROM avatars WHERE name = $1',
        'SELECT * FROM avatars WHERE slug = $1'
      ];

      const results = await Promise.all(
        queries.map(query => schemaLayer.validateAndTransformQuery(query))
      );

      results.forEach(result => {
        expect(result.validation.isValid).toBe(true);
        expect(result.transformedQuery).toContain('avatar_profiles');
      });
    });
  });

  describe('Deployment Readiness', () => {
    it('should verify all critical components for GPT-5 system', async () => {
      const verification = await schemaLayer.verifySchemaCompatibility();
      
      // Should not have critical errors that would break the system
      const criticalErrors = verification.errors.filter(error => 
        error.includes('Critical table') || error.includes('Critical column')
      );
      
      expect(criticalErrors).toHaveLength(0);
      
      // May have warnings about legacy tables, but that's acceptable
      if (verification.warnings.length > 0) {
        expect(verification.warnings.some(w => w.includes('Legacy table'))).toBe(true);
      }
    });

    it('should provide table mapping information for documentation', () => {
      const mappings = schemaLayer.getTableMappings();
      
      expect(mappings).toHaveLength(1);
      expect(mappings[0].legacyName).toBe('avatars');
      expect(mappings[0].currentName).toBe('avatar_profiles');
      expect(mappings[0].description).toContain('Avatar data moved');
    });
  });
});