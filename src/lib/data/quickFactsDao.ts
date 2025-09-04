import { SupabaseClient } from '@supabase/supabase-js';

export interface QuickFactsDao {
  bulkUpsertQuickFacts(
    avatarId: string, 
    facts: Record<string, string>, 
    supabaseSvc: SupabaseClient
  ): Promise<{ success: boolean; count: number; error?: string }>;
}

/**
 * Compatibility layer for quick_facts table operations
 * Handles schema differences between expected (fact_key/fact_value) and actual (key/value)
 */
export class QuickFactsDaoImpl implements QuickFactsDao {
  
  /**
   * Bulk upsert quick facts using the actual database schema
   * @param avatarId - The avatar ID to associate facts with
   * @param facts - Record of key-value pairs to upsert
   * @param supabaseSvc - Supabase client instance
   * @returns Promise with success status and count
   */
  async bulkUpsertQuickFacts(
    avatarId: string, 
    facts: Record<string, string>, 
    supabaseSvc: SupabaseClient
  ): Promise<{ success: boolean; count: number; error?: string }> {
    
    if (!avatarId || !facts || Object.keys(facts).length === 0) {
      return { success: false, count: 0, error: 'Invalid input: avatarId and facts are required' };
    }

    try {
      // Convert facts to the actual database schema format
      const factsToUpsert = Object.entries(facts).map(([key, value]) => ({
        avatar_id: avatarId,
        key: key,                    // Using 'key' column (not 'fact_key')
        value: String(value),        // Using 'value' column (not 'fact_value')
        confidence: 0.9,             // Default confidence
        priority: this.getPriorityForKey(key),
        source: 'manual',            // Source identifier (using allowed value)
        source_reference: 'onboarding_seed',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));

      // Perform bulk upsert with correct conflict resolution
      const { data, error } = await supabaseSvc
        .from('quick_facts')
        .upsert(factsToUpsert, {
          onConflict: 'avatar_id,key',  // Using actual column names
          ignoreDuplicates: false
        })
        .select('id');

      if (error) {
        console.error('[QuickFactsDao] Upsert error:', error);
        return { 
          success: false, 
          count: 0, 
          error: `Database error: ${error.message}` 
        };
      }

      const count = Array.isArray(data) ? data.length : factsToUpsert.length;
      
      console.log(`[QuickFactsDao] Successfully upserted ${count} facts for avatar ${avatarId}`);
      
      return { success: true, count };

    } catch (error: any) {
      console.error('[QuickFactsDao] Unexpected error:', error);
      return { 
        success: false, 
        count: 0, 
        error: `Unexpected error: ${error?.message || 'Unknown error'}` 
      };
    }
  }

  /**
   * Assign priority based on fact key importance
   * @param key - The fact key
   * @returns Priority number (1 = highest, 5 = lowest)
   */
  private getPriorityForKey(key: string): number {
    const highPriority = ['full_name', 'given_name', 'home_city', 'home_country', 'profession'];
    const mediumPriority = ['birth_year', 'personality', 'partner_name', 'pets'];
    const lowPriority = ['timezone', 'passions', 'hobbies'];

    if (highPriority.includes(key)) return 1;
    if (mediumPriority.includes(key)) return 2;
    if (lowPriority.includes(key)) return 3;
    return 4; // Default priority
  }
}

// Export singleton instance
export const quickFactsDao = new QuickFactsDaoImpl();