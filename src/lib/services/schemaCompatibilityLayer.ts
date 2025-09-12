/**
 * Schema Compatibility Layer
 * 
 * Resolves database schema inconsistencies between legacy table references
 * and current schema structure. Handles table name mappings, column validation,
 * and constraint compliance for the GPT-5 Avatar Memory Upgrade system.
 */

import { sbAdmin } from '@/lib/data/client';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface TableMapping {
  legacyName: string;
  currentName: string;
  description: string;
}

export interface ColumnInfo {
  columnName: string;
  dataType: string;
  isNullable: boolean;
  defaultValue?: string;
}

export interface SchemaInfo {
  tables: Record<string, ColumnInfo[]>;
  constraints: Record<string, string[]>;
  indexes: Record<string, string[]>;
}

/**
 * Database Schema Compatibility Layer
 * 
 * Provides methods to resolve table name mappings, validate column references,
 * qualify join queries, and ensure constraint compliance.
 */
export class SchemaCompatibilityLayer {
  private static instance: SchemaCompatibilityLayer;
  private schemaCache: SchemaInfo | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // Table name mappings from legacy to current schema
  private readonly tableMappings: TableMapping[] = [
    {
      legacyName: 'avatars',
      currentName: 'avatar_profiles',
      description: 'Avatar data moved from avatars to avatar_profiles table'
    }
  ];

  // Known constraint values for validation
  private readonly constraintValues = {
    fact_history: {
      change_source: ['heuristic', 'llm', 'manual', 'extraction']
    },
    quick_facts: {
      source: ['heuristic', 'llm', 'manual', 'extraction']
    }
  };

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): SchemaCompatibilityLayer {
    if (!SchemaCompatibilityLayer.instance) {
      SchemaCompatibilityLayer.instance = new SchemaCompatibilityLayer();
    }
    return SchemaCompatibilityLayer.instance;
  }

  /**
   * Resolve legacy table name to current table name
   */
  public resolveTableName(legacyName: string): string {
    const mapping = this.tableMappings.find(m => m.legacyName === legacyName);
    return mapping ? mapping.currentName : legacyName;
  }

  /**
   * Get all table mappings
   */
  public getTableMappings(): TableMapping[] {
    return [...this.tableMappings];
  }

  /**
   * Validate that a column exists in the specified table
   */
  public async validateColumnExists(table: string, column: string): Promise<boolean> {
    try {
      const schema = await this.getSchemaInfo();
      const resolvedTable = this.resolveTableName(table);
      const tableColumns = schema.tables[resolvedTable];
      
      if (!tableColumns) {
        console.warn(`Table ${resolvedTable} not found in schema`);
        return false;
      }

      return tableColumns.some(col => col.columnName === column);
    } catch (error) {
      console.error(`Error validating column ${column} in table ${table}:`, error);
      return false;
    }
  }

  /**
   * Get column information for a table
   */
  public async getTableColumns(table: string): Promise<ColumnInfo[]> {
    const schema = await this.getSchemaInfo();
    const resolvedTable = this.resolveTableName(table);
    return schema.tables[resolvedTable] || [];
  }

  /**
   * Qualify join columns to avoid ambiguous column errors
   * Adds table prefixes to column references in SQL queries
   */
  public qualifyJoinColumns(query: string): string {
    let qualifiedQuery = query;

    // First, handle table name replacements
    qualifiedQuery = qualifiedQuery.replace(
      /FROM\s+memory_fragments\s+mf\s+JOIN\s+avatars\s+a/gi, 
      'FROM memory_fragments mf JOIN avatar_profiles a'
    );

    // Only qualify columns that aren't already qualified (don't have a table prefix)
    // Look for column names that are not preceded by a table alias and dot
    const columnPatterns = [
      { pattern: /(?<!\w\.)\bid\b(?!\s*=)/g, replacement: 'a.id' },
      { pattern: /(?<!\w\.)\bcreated_at\b(?!\s*=)/g, replacement: 'a.created_at' },
      { pattern: /(?<!\w\.)\bupdated_at\b(?!\s*=)/g, replacement: 'a.updated_at' },
      { pattern: /(?<!\w\.)\bavatar_id\b(?!\s*=)/g, replacement: 'mf.avatar_id' }
    ];

    columnPatterns.forEach(({ pattern, replacement }) => {
      qualifiedQuery = qualifiedQuery.replace(pattern, replacement);
    });

    return qualifiedQuery;
  }

  /**
   * Validate data against table constraints
   */
  public validateConstraints(table: string, data: Record<string, any>): ValidationResult {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    const resolvedTable = this.resolveTableName(table);
    const constraints = this.constraintValues[resolvedTable as keyof typeof this.constraintValues];

    if (!constraints) {
      result.warnings.push(`No constraint validation rules defined for table ${resolvedTable}`);
      return result;
    }

    // Validate constraint values
    Object.entries(constraints).forEach(([column, allowedValues]) => {
      if (data[column] !== undefined) {
        if (!allowedValues.includes(data[column])) {
          result.isValid = false;
          result.errors.push(
            `Invalid value '${data[column]}' for column '${column}' in table '${resolvedTable}'. ` +
            `Allowed values: ${allowedValues.join(', ')}`
          );
        }
      }
    });

    return result;
  }

  /**
   * Perform automated schema verification
   * Checks for legacy table references and unknown columns
   */
  public async verifySchemaCompatibility(): Promise<ValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      const schema = await this.getSchemaInfo();
      
      // Check if legacy tables still exist
      for (const mapping of this.tableMappings) {
        if (schema.tables[mapping.legacyName]) {
          result.warnings.push(
            `Legacy table '${mapping.legacyName}' still exists. ` +
            `Consider migrating to '${mapping.currentName}': ${mapping.description}`
          );
        }
        
        if (!schema.tables[mapping.currentName]) {
          result.isValid = false;
          result.errors.push(
            `Current table '${mapping.currentName}' does not exist. ` +
            `This will break queries expecting the mapped table.`
          );
        }
      }

      // Verify critical tables exist
      const criticalTables = ['avatar_profiles', 'memory_fragments', 'quick_facts', 'fact_history'];
      for (const table of criticalTables) {
        if (!schema.tables[table]) {
          result.isValid = false;
          result.errors.push(`Critical table '${table}' is missing from schema`);
        }
      }

      // Verify critical columns exist
      const criticalColumns = {
        avatar_profiles: ['id', 'name'],
        memory_fragments: ['id', 'avatar_id', 'fragment_text'],
        quick_facts: ['id', 'avatar_id', 'key', 'value'],
        fact_history: ['id', 'avatar_id', 'change_source']
      };

      for (const [table, columns] of Object.entries(criticalColumns)) {
        if (schema.tables[table]) {
          const tableColumns = schema.tables[table].map(col => col.columnName);
          for (const column of columns) {
            if (!tableColumns.includes(column)) {
              result.isValid = false;
              result.errors.push(`Critical column '${column}' missing from table '${table}'`);
            }
          }
        }
      }

    } catch (error) {
      result.isValid = false;
      result.errors.push(`Schema verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return result;
  }

  /**
   * Get comprehensive schema information with caching
   */
  private async getSchemaInfo(): Promise<SchemaInfo> {
    const now = Date.now();
    
    if (this.schemaCache && now < this.cacheExpiry) {
      return this.schemaCache;
    }

    try {
      // Get table and column information
      const { data: columns, error: columnsError } = await sbAdmin
        .from('information_schema.columns')
        .select('table_name, column_name, data_type, is_nullable, column_default')
        .in('table_name', [
          'avatars', 'avatar_profiles', 'memory_fragments', 
          'quick_facts', 'fact_history', 'conversations'
        ]);

      if (columnsError) {
        throw new Error(`Failed to fetch column information: ${columnsError.message}`);
      }

      // Organize columns by table
      const tables: Record<string, ColumnInfo[]> = {};
      columns?.forEach(col => {
        if (!tables[col.table_name]) {
          tables[col.table_name] = [];
        }
        tables[col.table_name].push({
          columnName: col.column_name,
          dataType: col.data_type,
          isNullable: col.is_nullable === 'YES',
          defaultValue: col.column_default
        });
      });

      // Get constraint information (simplified for now)
      const constraints: Record<string, string[]> = {};
      const indexes: Record<string, string[]> = {};

      this.schemaCache = { tables, constraints, indexes };
      this.cacheExpiry = now + this.CACHE_TTL;

      return this.schemaCache;
    } catch (error) {
      console.error('Error fetching schema information:', error);
      throw error;
    }
  }

  /**
   * Clear schema cache (useful for testing or after schema changes)
   */
  public clearCache(): void {
    this.schemaCache = null;
    this.cacheExpiry = 0;
  }

  /**
   * Transform a query to use correct table names and qualified columns
   */
  public transformQuery(query: string): string {
    let transformedQuery = query;

    // Apply table name mappings
    this.tableMappings.forEach(mapping => {
      const pattern = new RegExp(`\\b${mapping.legacyName}\\b`, 'gi');
      transformedQuery = transformedQuery.replace(pattern, mapping.currentName);
    });

    // Apply column qualification
    transformedQuery = this.qualifyJoinColumns(transformedQuery);

    return transformedQuery;
  }

  /**
   * Validate and transform a complete SQL query
   */
  public async validateAndTransformQuery(query: string): Promise<{
    transformedQuery: string;
    validation: ValidationResult;
  }> {
    const validation: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    };

    try {
      // Transform the query
      const transformedQuery = this.transformQuery(query);

      // Basic validation - check for common issues
      if (query.includes('avatars') && !query.includes('avatar_profiles')) {
        validation.warnings.push('Query references legacy "avatars" table, transformed to "avatar_profiles"');
      }

      // Check for unqualified column references in joins
      if (query.includes('JOIN') && /(?<!\w\.)id(?!\s*=)/.test(query)) {
        validation.warnings.push('Query contains potentially ambiguous column references');
      }

      return { transformedQuery, validation };
    } catch (error) {
      validation.isValid = false;
      validation.errors.push(`Query transformation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { transformedQuery: query, validation };
    }
  }
}

/**
 * Convenience function to get the singleton instance
 */
export function getSchemaCompatibilityLayer(): SchemaCompatibilityLayer {
  return SchemaCompatibilityLayer.getInstance();
}