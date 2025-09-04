/**
 * Schema Compatibility Layer Usage Examples
 * 
 * This file demonstrates how to use the SchemaCompatibilityLayer
 * in the GPT-5 Avatar Memory Upgrade system.
 */

import { getSchemaCompatibilityLayer } from '../schemaCompatibilityLayer';

/**
 * Example 1: Basic table name resolution
 */
export async function exampleTableNameResolution() {
  const schemaLayer = getSchemaCompatibilityLayer();
  
  // Resolve legacy table names
  const currentTableName = schemaLayer.resolveTableName('avatars');
  console.log(`Legacy 'avatars' table maps to: ${currentTableName}`); // avatar_profiles
  
  // Get all mappings for documentation
  const mappings = schemaLayer.getTableMappings();
  console.log('All table mappings:', mappings);
}

/**
 * Example 2: Query transformation for memory retrieval
 */
export async function exampleQueryTransformation() {
  const schemaLayer = getSchemaCompatibilityLayer();
  
  // Legacy query that needs transformation
  const legacyQuery = `
    SELECT mf.fragment_text, a.name, created_at
    FROM memory_fragments mf 
    JOIN avatars a ON mf.avatar_id = a.id
    WHERE a.slug = $1
    ORDER BY created_at DESC
  `;
  
  // Transform and validate the query
  const result = await schemaLayer.validateAndTransformQuery(legacyQuery);
  
  console.log('Original query:', legacyQuery);
  console.log('Transformed query:', result.transformedQuery);
  console.log('Validation result:', result.validation);
  
  // Use the transformed query in your database operations
  // const { data } = await supabase.rpc('execute_query', { query: result.transformedQuery });
}

/**
 * Example 3: Column validation before query execution
 */
export async function exampleColumnValidation() {
  const schemaLayer = getSchemaCompatibilityLayer();
  
  // Check if columns exist before building queries
  const hasNameColumn = await schemaLayer.validateColumnExists('avatar_profiles', 'name');
  const hasSlugColumn = await schemaLayer.validateColumnExists('avatar_profiles', 'slug');
  
  console.log(`avatar_profiles.name exists: ${hasNameColumn}`);
  console.log(`avatar_profiles.slug exists: ${hasSlugColumn}`);
  
  // Get all columns for a table
  const columns = await schemaLayer.getTableColumns('avatar_profiles');
  console.log('Available columns:', columns.map(col => col.columnName));
}

/**
 * Example 4: Constraint validation for data insertion
 */
export async function exampleConstraintValidation() {
  const schemaLayer = getSchemaCompatibilityLayer();
  
  // Validate data before insertion
  const factData = {
    avatar_id: 'test-uuid',
    key: 'name',
    value: 'John Doe',
    source: 'manual', // Valid source
    confidence: 0.95
  };
  
  const validation = schemaLayer.validateConstraints('quick_facts', factData);
  
  if (validation.isValid) {
    console.log('Data is valid for insertion');
    // Proceed with database insertion
  } else {
    console.error('Validation errors:', validation.errors);
    // Handle validation errors
  }
  
  // Example with invalid data
  const invalidData = {
    avatar_id: 'test-uuid',
    change_source: 'invalid_source' // This will fail validation
  };
  
  const invalidValidation = schemaLayer.validateConstraints('fact_history', invalidData);
  console.log('Invalid data validation:', invalidValidation);
}

/**
 * Example 5: Complete schema verification for deployment
 */
export async function exampleSchemaVerification() {
  const schemaLayer = getSchemaCompatibilityLayer();
  
  // Perform comprehensive schema verification
  const verification = await schemaLayer.verifySchemaCompatibility();
  
  console.log('Schema verification result:');
  console.log(`Valid: ${verification.isValid}`);
  console.log(`Errors: ${verification.errors.length}`);
  console.log(`Warnings: ${verification.warnings.length}`);
  
  if (!verification.isValid) {
    console.error('Critical schema issues found:');
    verification.errors.forEach(error => console.error(`- ${error}`));
    
    // In a real deployment, you might want to block deployment here
    throw new Error('Schema verification failed - deployment blocked');
  }
  
  if (verification.warnings.length > 0) {
    console.warn('Schema warnings (review recommended):');
    verification.warnings.forEach(warning => console.warn(`- ${warning}`));
  }
  
  console.log('✅ Schema verification passed - safe to deploy');
}

/**
 * Example 6: Using in a service class
 */
export class AvatarMemoryService {
  private schemaLayer = getSchemaCompatibilityLayer();
  
  async getAvatarMemories(avatarSlug: string, limit: number = 10) {
    // Build query with potential legacy references
    const query = `
      SELECT mf.fragment_text, a.name, created_at
      FROM memory_fragments mf 
      JOIN avatars a ON mf.avatar_id = a.id
      WHERE a.slug = $1
      ORDER BY created_at DESC
      LIMIT $2
    `;
    
    // Transform query to use current schema
    const { transformedQuery, validation } = await this.schemaLayer.validateAndTransformQuery(query);
    
    if (!validation.isValid) {
      throw new Error(`Query validation failed: ${validation.errors.join(', ')}`);
    }
    
    // Log warnings for monitoring
    if (validation.warnings.length > 0) {
      console.warn('Query transformation warnings:', validation.warnings);
    }
    
    // Execute the transformed query
    // return await this.executeQuery(transformedQuery, [avatarSlug, limit]);
    return { query: transformedQuery, params: [avatarSlug, limit] };
  }
  
  async insertQuickFact(avatarId: string, key: string, value: string, source: string) {
    // Validate data before insertion
    const data = { avatar_id: avatarId, key, value, source };
    const validation = this.schemaLayer.validateConstraints('quick_facts', data);
    
    if (!validation.isValid) {
      throw new Error(`Data validation failed: ${validation.errors.join(', ')}`);
    }
    
    // Proceed with insertion
    // return await this.insertData('quick_facts', data);
    return { table: 'quick_facts', data };
  }
}

/**
 * Example 7: Deployment health check
 */
export async function deploymentHealthCheck(): Promise<boolean> {
  try {
    const schemaLayer = getSchemaCompatibilityLayer();
    
    // Quick health check of critical components
    const checks = [
      schemaLayer.validateColumnExists('avatar_profiles', 'id'),
      schemaLayer.validateColumnExists('memory_fragments', 'avatar_id'),
      schemaLayer.validateColumnExists('quick_facts', 'key'),
      schemaLayer.verifySchemaCompatibility()
    ];
    
    const [hasAvatarId, hasMemoryAvatarId, hasFactKey, schemaVerification] = await Promise.all(checks);
    
    const isHealthy = hasAvatarId && hasMemoryAvatarId && hasFactKey && schemaVerification.isValid;
    
    if (!isHealthy) {
      console.error('❌ Schema health check failed');
      if (!schemaVerification.isValid) {
        console.error('Schema errors:', schemaVerification.errors);
      }
    } else {
      console.log('✅ Schema health check passed');
    }
    
    return isHealthy;
  } catch (error) {
    console.error('❌ Health check error:', error);
    return false;
  }
}

// Export all examples for easy testing
export const examples = {
  exampleTableNameResolution,
  exampleQueryTransformation,
  exampleColumnValidation,
  exampleConstraintValidation,
  exampleSchemaVerification,
  deploymentHealthCheck
};