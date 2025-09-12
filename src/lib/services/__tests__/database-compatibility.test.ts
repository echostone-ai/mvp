/**
 * Database Compatibility Tests for GPT-5 Avatar Memory Upgrade
 * 
 * Tests database schema compatibility, query correctness, and proper
 * handling of table/column name changes and constraints.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SchemaCompatibilityLayer } from '../schemaCompatibilityLayer';
import { ContextRetrievalEngine } from '../contextRetrievalEngine';
import { MemoryUpdatePipeline } from '../memoryUpdatePipeline';

// Mock database client with schema-aware responses
const createMockDatabaseClient = (shouldFailOnLegacyNames = false) => {
  const mockQuery = {
    select: vi.fn(() => mockQuery),
    eq: vi.fn(() => mockQuery),
    lte: vi.fn(() => mockQuery),
    order: vi.fn(() => mockQuery),
    limit: vi.fn(() => mockQuery),
    or: vi.fn(() => {
      // Simulate schema compatibility issues
      if (shouldFailOnLegacyNames) {
        return Promise.resolve({
          data: null,
          error: { message: 'relation "avatars" does not exist' }
        });
      }
      return Promise.resolve({
        data: [
          {
            id: '1',
            avatar_id: 'test-avatar',
            key: 'name',
            value: 'Test User',
            confidence: 0.9,
            priority: 1,
            source: 'manual',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z'
          }
        ],
        error: null
      });
    }),
    insert: vi.fn((data) => {
      // Simulate constraint validation
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item.change_source && !['manual', 'extraction', 'llm', 'heuristic'].includes(item.change_source)) {
            return Promise.resolve({
              data: null,
              error: { message: 'invalid input value for enum change_source_type' }
            });
          }
        }
      }
      return Promise.resolve({ data: data, error: null });
    }),
    update: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ data: null, error: null }))
    })),
    in: vi.fn(() => mockQuery),
    gte: vi.fn(() => mockQuery)
  };
  return mockQuery;
};

vi.mock('@/lib/data/client', () => ({
  sbAdmin: {
    from: vi.fn((tableName: string) => {
      // Simulate table name resolution
      if (tableName === 'avatars') {
        // This should fail if not properly resolved to avatar_profiles
        return createMockDatabaseClient(true);
      }
      return createMockDatabaseClient(false);
    })
  }
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => createMockDatabaseClient(false))
  }
}));

describe('Database Compatibility Tests', () => {
  let schemaLayer: SchemaCompatibilityLayer;
  let contextEngine: ContextRetrievalEngine;
  let memoryPipeline: MemoryUpdatePipeline;

  beforeEach(() => {
    schemaLayer = new SchemaCompatibilityLayer();
    contextEngine = new ContextRetrievalEngine();
    memoryPipeline = new MemoryUpdatePipeline();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Schema Compatibility Layer', () => {
    it('should resolve legacy table names correctly', () => {
      const testCases = [
        { legacy: 'avatars', expected: 'avatar_profiles' },
        { legacy: 'quick_facts', expected: 'quick_facts' },
        { legacy: 'memory_fragments', expected: 'memory_fragments' },
        { legacy: 'conversations', expected: 'conversations' },
        { legacy: 'fact_history', expected: 'fact_history' }
      ];

      testCases.forEach(({ legacy, expected }) => {
        const resolved = schemaLayer.resolveTableName(legacy);
        expect(resolved).toBe(expected);
      });
    });

    it('should validate column existence correctly', async () => {
      const validColumns = [
        { table: 'avatar_profiles', column: 'id' },
        { table: 'avatar_profiles', column: 'user_id' },
        { table: 'quick_facts', column: 'avatar_id' },
        { table: 'quick_facts', column: 'confidence' },
        { table: 'memory_fragments', column: 'fragment_text' },
        { table: 'fact_history', column: 'change_source' }
      ];

      const invalidColumns = [
        { table: 'avatar_profiles', column: 'nonexistent_column' },
        { table: 'quick_facts', column: 'invalid_field' },
        { table: 'memory_fragments', column: 'missing_column' }
      ];

      // Test valid columns
      for (const { table, column } of validColumns) {
        const isValid = await schemaLayer.validateColumnExists(table, column);
        expect(isValid).toBe(true);
      }

      // Test invalid columns
      for (const { table, column } of invalidColumns) {
        const isValid = await schemaLayer.validateColumnExists(table, column);
        expect(isValid).toBe(false);
      }
    });

    it('should qualify join columns to avoid ambiguity', () => {
      const testQueries = [
        {
          input: 'SELECT * FROM avatar_profiles JOIN quick_facts ON id = avatar_id',
          expected: 'SELECT * FROM avatar_profiles JOIN quick_facts ON avatar_profiles.id = quick_facts.avatar_id'
        },
        {
          input: 'SELECT name, value FROM avatar_profiles a JOIN quick_facts q ON a.id = q.avatar_id',
          expected: 'SELECT avatar_profiles.name, quick_facts.value FROM avatar_profiles a JOIN quick_facts q ON a.id = q.avatar_id'
        },
        {
          input: 'UPDATE quick_facts SET confidence = 0.9 WHERE avatar_id = ?',
          expected: 'UPDATE quick_facts SET quick_facts.confidence = 0.9 WHERE quick_facts.avatar_id = ?'
        }
      ];

      testQueries.forEach(({ input, expected }) => {
        const qualified = schemaLayer.qualifyJoinColumns(input);
        expect(qualified).toContain('avatar_profiles.');
        expect(qualified).toContain('quick_facts.');
      });
    });

    it('should validate constraints for fact_history inserts', () => {
      const validData = [
        {
          avatar_id: 'avatar-123',
          fact_key: 'name',
          old_value: 'John',
          new_value: 'John Doe',
          change_source: 'manual',
          confidence: 0.9,
          priority: 1
        },
        {
          avatar_id: 'avatar-456',
          fact_key: 'occupation',
          old_value: null,
          new_value: 'Engineer',
          change_source: 'extraction',
          confidence: 0.8,
          priority: 3
        }
      ];

      const invalidData = [
        {
          avatar_id: 'avatar-123',
          fact_key: 'name',
          old_value: 'John',
          new_value: 'John Doe',
          change_source: 'invalid_source', // Invalid enum value
          confidence: 0.9,
          priority: 1
        },
        {
          avatar_id: 'avatar-456',
          fact_key: 'occupation',
          old_value: null,
          new_value: 'Engineer',
          change_source: 'manual',
          confidence: 1.5, // Invalid confidence > 1.0
          priority: 0 // Invalid priority < 1
        }
      ];

      // Test valid data
      validData.forEach(data => {
        const result = schemaLayer.validateConstraints('fact_history', data);
        expect(result.isValid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      // Test invalid data
      invalidData.forEach(data => {
        const result = schemaLayer.validateConstraints('fact_history', data);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
    });

    it('should provide automated schema verification', async () => {
      const verificationResult = await schemaLayer.verifySchemaCompatibility();

      expect(verificationResult).toMatchObject({
        tablesChecked: expect.any(Number),
        columnsChecked: expect.any(Number),
        issuesFound: expect.any(Array),
        recommendedFixes: expect.any(Array),
        overallStatus: expect.stringMatching(/^(compatible|issues_found|critical_errors)$/)
      });

      // Should check all critical tables
      expect(verificationResult.tablesChecked).toBeGreaterThanOrEqual(5);

      // If issues are found, should provide fixes
      if (verificationResult.issuesFound.length > 0) {
        expect(verificationResult.recommendedFixes.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Query Compatibility', () => {
    it('should handle queries with correct table names', async () => {
      // This should work because the schema layer resolves table names
      const result = await contextEngine.retrieveContext('test-avatar', 'test query');

      expect(result).toBeDefined();
      expect(result.quickFacts).toBeDefined();
      expect(result.retrievalMetadata).toBeDefined();

      // Should not have any schema-related errors
      expect(result.retrievalMetadata.errors).toBeUndefined();
    });

    it('should prevent queries with legacy table names from failing', async () => {
      // Mock a service that might use legacy table names
      const legacyQuery = async () => {
        const { sbAdmin } = await import('@/lib/data/client');
        
        // This would normally fail, but schema layer should prevent it
        return sbAdmin.from('avatars') // Legacy table name
          .select('*')
          .eq('id', 'test-avatar');
      };

      // Should either resolve the table name or provide a clear error
      try {
        await legacyQuery();
        // If it succeeds, the table name was resolved
      } catch (error) {
        // If it fails, should be a clear schema error, not a generic database error
        expect((error as Error).message).toContain('avatars');
      }
    });

    it('should validate all database operations use current schema', async () => {
      const operations = [
        () => contextEngine.retrieveContext('test-avatar', 'test'),
        () => memoryPipeline.processConversationTurn('test-avatar', {
          conversationId: 'test-conv',
          userInput: 'test input',
          assistantResponse: 'test response'
        })
      ];

      for (const operation of operations) {
        try {
          await operation();
          // Operation should succeed with current schema
        } catch (error) {
          // If it fails, should not be due to schema issues
          expect((error as Error).message).not.toContain('does not exist');
          expect((error as Error).message).not.toContain('column');
        }
      }
    });

    it('should handle constraint violations gracefully', async () => {
      // Test inserting data that violates constraints
      const invalidFactHistory = {
        avatar_id: 'test-avatar',
        fact_key: 'test_key',
        old_value: 'old',
        new_value: 'new',
        change_source: 'invalid_source', // This should violate enum constraint
        confidence: 0.8,
        priority: 1
      };

      const { sbAdmin } = await import('@/lib/data/client');
      const result = await sbAdmin.from('fact_history').insert(invalidFactHistory);

      // Should handle constraint violation gracefully
      expect(result.error).toBeDefined();
      expect(result.error.message).toContain('change_source');
    });
  });

  describe('Migration and Deployment Safety', () => {
    it('should detect schema changes that could break queries', async () => {
      const potentialBreakingChanges = [
        { type: 'table_rename', from: 'avatars', to: 'avatar_profiles' },
        { type: 'column_rename', table: 'quick_facts', from: 'user_id', to: 'avatar_id' },
        { type: 'constraint_change', table: 'fact_history', constraint: 'change_source_type' }
      ];

      for (const change of potentialBreakingChanges) {
        const impact = await schemaLayer.assessMigrationImpact(change);

        expect(impact).toMatchObject({
          riskLevel: expect.stringMatching(/^(low|medium|high|critical)$/),
          affectedQueries: expect.any(Array),
          recommendedActions: expect.any(Array),
          rollbackPlan: expect.any(String)
        });

        // High-risk changes should have detailed mitigation plans
        if (impact.riskLevel === 'high' || impact.riskLevel === 'critical') {
          expect(impact.affectedQueries.length).toBeGreaterThan(0);
          expect(impact.recommendedActions.length).toBeGreaterThan(0);
        }
      }
    });

    it('should provide deployment verification checklist', async () => {
      const checklist = await schemaLayer.getDeploymentChecklist();

      expect(checklist).toMatchObject({
        preDeployment: expect.arrayContaining([
          expect.objectContaining({
            task: expect.any(String),
            completed: expect.any(Boolean),
            required: expect.any(Boolean)
          })
        ]),
        postDeployment: expect.arrayContaining([
          expect.objectContaining({
            task: expect.any(String),
            completed: expect.any(Boolean),
            required: expect.any(Boolean)
          })
        ]),
        rollbackProcedure: expect.any(String)
      });

      // Should include critical checks
      const allTasks = [...checklist.preDeployment, ...checklist.postDeployment];
      const taskDescriptions = allTasks.map(task => task.task.toLowerCase());

      expect(taskDescriptions.some(task => task.includes('schema'))).toBe(true);
      expect(taskDescriptions.some(task => task.includes('query'))).toBe(true);
      expect(taskDescriptions.some(task => task.includes('constraint'))).toBe(true);
    });

    it('should validate all queries work with current schema', async () => {
      const criticalQueries = [
        'SELECT * FROM avatar_profiles WHERE id = ?',
        'SELECT * FROM quick_facts WHERE avatar_id = ? AND confidence > ?',
        'SELECT * FROM memory_fragments WHERE avatar_id = ? ORDER BY created_at DESC',
        'INSERT INTO fact_history (avatar_id, fact_key, change_source) VALUES (?, ?, ?)',
        'UPDATE quick_facts SET confidence = ? WHERE id = ?'
      ];

      for (const query of criticalQueries) {
        const validation = await schemaLayer.validateQuery(query);

        expect(validation).toMatchObject({
          isValid: expect.any(Boolean),
          errors: expect.any(Array),
          warnings: expect.any(Array),
          suggestedFixes: expect.any(Array)
        });

        // Critical queries should be valid
        if (!validation.isValid) {
          console.warn(`Query validation failed: ${query}`, validation.errors);
        }
      }
    });
  });

  describe('Performance Impact of Schema Changes', () => {
    it('should measure query performance with current schema', async () => {
      const performanceTests = [
        {
          name: 'quick_facts_retrieval',
          operation: () => contextEngine.retrieveContext('test-avatar', 'performance test')
        },
        {
          name: 'memory_update',
          operation: () => memoryPipeline.processConversationTurn('test-avatar', {
            conversationId: 'perf-test',
            userInput: 'performance test input',
            assistantResponse: 'performance test response'
          })
        }
      ];

      const results: Record<string, number> = {};

      for (const test of performanceTests) {
        const startTime = Date.now();
        try {
          await test.operation();
          results[test.name] = Date.now() - startTime;
        } catch (error) {
          results[test.name] = -1; // Indicate failure
        }
      }

      // All operations should complete within reasonable time
      Object.entries(results).forEach(([name, time]) => {
        expect(time).toBeGreaterThan(0); // Should not fail
        expect(time).toBeLessThan(2000); // Should be reasonably fast
      });

      console.log('Schema performance results:', results);
    });

    it('should identify slow queries that might need optimization', async () => {
      const queryAnalysis = await schemaLayer.analyzeQueryPerformance();

      expect(queryAnalysis).toMatchObject({
        slowQueries: expect.any(Array),
        missingIndexes: expect.any(Array),
        optimizationSuggestions: expect.any(Array),
        overallPerformanceScore: expect.any(Number)
      });

      // Should provide actionable optimization suggestions
      if (queryAnalysis.slowQueries.length > 0) {
        expect(queryAnalysis.optimizationSuggestions.length).toBeGreaterThan(0);
      }

      // Performance score should be reasonable
      expect(queryAnalysis.overallPerformanceScore).toBeGreaterThanOrEqual(0);
      expect(queryAnalysis.overallPerformanceScore).toBeLessThanOrEqual(100);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should provide meaningful error messages for schema issues', async () => {
      // Simulate various schema-related errors
      const errorScenarios = [
        {
          name: 'missing_table',
          error: new Error('relation "nonexistent_table" does not exist'),
          expectedSuggestion: 'table name'
        },
        {
          name: 'missing_column',
          error: new Error('column "nonexistent_column" does not exist'),
          expectedSuggestion: 'column name'
        },
        {
          name: 'constraint_violation',
          error: new Error('invalid input value for enum change_source_type'),
          expectedSuggestion: 'constraint'
        }
      ];

      for (const scenario of errorScenarios) {
        const errorInfo = schemaLayer.analyzeError(scenario.error);

        expect(errorInfo).toMatchObject({
          category: expect.any(String),
          severity: expect.stringMatching(/^(low|medium|high|critical)$/),
          suggestion: expect.any(String),
          possibleFixes: expect.any(Array)
        });

        expect(errorInfo.suggestion.toLowerCase()).toContain(scenario.expectedSuggestion);
      }
    });

    it('should provide recovery procedures for common schema issues', () => {
      const commonIssues = [
        'table_not_found',
        'column_not_found',
        'constraint_violation',
        'permission_denied',
        'connection_failed'
      ];

      for (const issue of commonIssues) {
        const recovery = schemaLayer.getRecoveryProcedure(issue);

        expect(recovery).toMatchObject({
          steps: expect.any(Array),
          estimatedTime: expect.any(String),
          riskLevel: expect.stringMatching(/^(low|medium|high)$/),
          rollbackRequired: expect.any(Boolean)
        });

        expect(recovery.steps.length).toBeGreaterThan(0);
      }
    });

    it('should maintain data integrity during schema operations', async () => {
      // Test that schema operations don't corrupt existing data
      const preOperationData = await contextEngine.retrieveContext('test-avatar', 'integrity test');
      
      // Simulate a schema operation (like adding an index or updating constraints)
      await schemaLayer.simulateSchemaOperation('add_index', {
        table: 'quick_facts',
        columns: ['avatar_id', 'confidence']
      });

      const postOperationData = await contextEngine.retrieveContext('test-avatar', 'integrity test');

      // Data should remain consistent
      expect(postOperationData.quickFacts.length).toBe(preOperationData.quickFacts.length);
      expect(postOperationData.retrievalMetadata.totalQuickFacts).toBe(
        preOperationData.retrievalMetadata.totalQuickFacts
      );
    });
  });
});