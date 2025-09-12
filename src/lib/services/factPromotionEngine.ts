/**
 * Fact Promotion Engine - Real-time fact detection and promotion system
 * 
 * Processes new conversation fragments to detect promotable facts and update
 * the quick_facts table with conflict resolution and change history tracking.
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4
 */

import { FactExtractionEngine, FactExtractionResult } from './factExtractionEngine';
import { ExtractedFact } from './patternExtractor';
import { createClient } from '@supabase/supabase-js';
import { recordMetric } from './extractionPerformanceMonitor';

export interface PromotionResult {
  facts_promoted: number;
  facts_updated: number;
  processing_time_ms: number;
  errors: string[];
}

export interface FactUpdateResult {
  action: 'inserted' | 'updated' | 'skipped';
  old_value?: string;
  new_value: string;
  confidence_changed: boolean;
  priority_changed: boolean;
}

export interface QuickFact {
  id: string;
  avatar_id: string;
  key: string;
  value: string;
  confidence: number;
  priority: number;
  source: string;
  source_reference?: string;
  date_context?: {
    year?: number;
    month?: number;
    day?: number;
  };
  expires_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export class FactPromotionEngine {
  private extractionEngine: FactExtractionEngine;
  private supabase: ReturnType<typeof createClient>;

  constructor() {
    this.extractionEngine = new FactExtractionEngine({
      enableLLMRefinement: true,
      llmFallbackOnPatternFailure: false, // For real-time, prefer speed over completeness
      maxProcessingTimeMs: 5000, // 5 seconds max for real-time processing
      minConfidenceThreshold: 0.6 // Higher threshold for promotion
    });

    // Initialize Supabase client with service role for database operations
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );
  }

  /**
   * Process a new conversation fragment for fact promotion
   * Requirements: 9.1 - Process new fragments within 200ms
   */
  async processNewFragment(
    fragmentId: string, 
    avatarId: string, 
    text: string
  ): Promise<PromotionResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let factsPromoted = 0;
    let factsUpdated = 0;

    try {
      // Validate inputs
      if (!fragmentId || !avatarId || !text?.trim()) {
        return {
          facts_promoted: 0,
          facts_updated: 0,
          processing_time_ms: Date.now() - startTime,
          errors: ['Invalid input parameters']
        };
      }

      // Extract facts from the fragment text
      let promotableFacts: ExtractedFact[] = [];
      try {
        const t0 = Date.now();
        promotableFacts = await this.detectPromotableFacts(text);
        recordMetric(avatarId, 'promotion', true, Date.now() - t0, { stage: 'detect' });
      } catch (error) {
        errors.push(`Fact detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        recordMetric(avatarId, 'promotion', false, Date.now() - startTime, { stage: 'detect', error: error instanceof Error ? error.message : 'Unknown error' });
        promotableFacts = [];
      }

      // Process each detected fact
      for (const fact of promotableFacts) {
        try {
          const p0 = Date.now();
          const updateResult = await this.updateOrInsertFactWithRetry(avatarId, fact, fragmentId);
          recordMetric(avatarId, 'persist', true, Date.now() - p0, { key: fact.key, action: updateResult.action });
          
          if (updateResult.action === 'inserted') {
            factsPromoted++;
          } else if (updateResult.action === 'updated') {
            factsUpdated++;
          }
        } catch (factError) {
          errors.push(`Failed to process fact ${fact.key}: ${factError instanceof Error ? factError.message : 'Unknown error'}`);
          recordMetric(avatarId, 'persist', false, 0, { key: fact.key, error: factError instanceof Error ? factError.message : 'Unknown error' });
        }
      }

      const processingTime = Date.now() - startTime;

      // Log performance warning if processing took too long
      if (processingTime > 200) {
        console.warn(`Fact promotion took ${processingTime}ms, exceeding 200ms target`, {
          fragmentId,
          avatarId,
          factsCount: promotableFacts.length
        });
      }

      return {
        facts_promoted: factsPromoted,
        facts_updated: factsUpdated,
        processing_time_ms: processingTime,
        errors
      };

    } catch (error) {
      errors.push(`Fragment processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        facts_promoted: 0,
        facts_updated: 0,
        processing_time_ms: Date.now() - startTime,
        errors
      };
    }
  }

  /**
   * Detect promotable facts from text using the extraction engine
   * Requirements: 9.2 - Recognize and normalize canonical facts
   */
  async detectPromotableFacts(text: string): Promise<ExtractedFact[]> {
    const extractionResult: FactExtractionResult = await this.extractionEngine.extractFactsWithTimeout(text, 3000);
    
    // Filter for promotable fact types based on requirements
    const promotableKeys = new Set([
      'pets_current',
      'partner_name', 
      'current_city',
      'family_parents',
      'current_job',
      'hobbies',
      'birth_year',
      'birthplace',
      'full_name',
      'languages',
      'grew_up',
      'signature_style'
    ]);

    return extractionResult.facts.filter(fact => 
      promotableKeys.has(fact.key) && 
      fact.confidence >= 0.6 // Higher threshold for promotion
    );
  }

  /**
   * Persist with retry/backoff: 3 attempts at 200ms, 600ms, 1400ms
   */
  private async updateOrInsertFactWithRetry(
    avatarId: string,
    fact: ExtractedFact,
    sourceReference?: string
  ): Promise<FactUpdateResult> {
    const delays = [0, 200, 600];
    let lastError: any = null;
    for (let i = 0; i < delays.length; i++) {
      if (delays[i] > 0) {
        await new Promise(res => setTimeout(res, delays[i]));
      }
      try {
        return await this.updateOrInsertFact(avatarId, fact, sourceReference);
      } catch (err) {
        lastError = err;
        if (i === delays.length - 1) break;
      }
    }
    // Final failure: persist failed status into a dedicated table if available, otherwise log
    try {
      await this.supabase.from('fact_promotion_queue').update({ status: 'failed', error_message: String(lastError?.message || lastError) }).eq('fragment_id', sourceReference).eq('avatar_id', avatarId);
    } catch (_) {
      // ignore
    }
    throw new Error(lastError?.message || 'Persist failed after retries');
  }

  /**
   * Update or insert a fact with conflict resolution logic
   * Requirements: 9.3, 9.4 - Handle conflicts and update quick_facts
   */
  async updateOrInsertFact(
    avatarId: string, 
    fact: ExtractedFact, 
    sourceReference?: string
  ): Promise<FactUpdateResult> {
    try {
      // Check if fact already exists
      const { data: existingFact, error: fetchError } = await this.supabase
        .from('quick_facts')
        .select('*')
        .eq('avatar_id', avatarId)
        .eq('key', fact.key)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw new Error(`Failed to fetch existing fact: ${fetchError.message}`);
      }

      const priority = this.calculatePriority(fact.key);
      const sourceRef = sourceReference ? `From conversation fragment ${sourceReference}` : 'Real-time conversation';

      if (!existingFact) {
        // Insert new fact
        const insertResponse = await this.supabase
          .from('quick_facts')
          .insert({
            avatar_id: avatarId,
            key: fact.key,
            value: fact.value,
            confidence: fact.confidence,
            priority: priority,
            source: fact.extraction_method,
            source_reference: sourceRef,
            date_context: this.extractDateContext(fact),
            expires_at: this.calculateExpiration(fact.key)
          });
        const insertError = (insertResponse as any)?.error;
        if (!insertResponse || insertError) {
          throw new Error(`Failed to insert fact: ${insertError?.message || 'Unknown insert failure'}`);
        }

        return {
          action: 'inserted',
          new_value: fact.value,
          confidence_changed: false,
          priority_changed: false
        };

      } else {
        // Determine if update is needed
        const shouldUpdate = this.shouldUpdateFact(existingFact, fact);
        
        if (!shouldUpdate) {
          return {
            action: 'skipped',
            new_value: fact.value,
            confidence_changed: false,
            priority_changed: false
          };
        }

        // Archive old fact before updating (handled by database trigger)
        const updateResponse = await this.supabase
          .from('quick_facts')
          .update({
            value: fact.value,
            confidence: Math.max(fact.confidence, existingFact.confidence), // Keep higher confidence
            priority: Math.min(priority, existingFact.priority), // Keep higher priority (lower number)
            source: fact.extraction_method,
            source_reference: sourceRef,
            date_context: this.extractDateContext(fact) || existingFact.date_context,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingFact.id);
        const updateError = (updateResponse as any)?.error;
        if (!updateResponse || updateError) {
          throw new Error(`Failed to update fact: ${updateError?.message || 'Unknown update failure'}`);
        }

        return {
          action: 'updated',
          old_value: existingFact.value,
          new_value: fact.value,
          confidence_changed: fact.confidence !== existingFact.confidence,
          priority_changed: priority !== existingFact.priority
        };
      }

    } catch (error) {
      throw new Error(`Fact update failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Archive old fact value in fact_history table
   * Requirements: 9.4 - Store old values in fact_history for traceability
   * Note: This is handled automatically by database triggers, but kept for explicit calls
   */
  async archiveOldFact(
    avatarId: string, 
    key: string, 
    oldValue: string, 
    newValue: string
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('fact_history')
        .insert({
          avatar_id: avatarId,
          key: key,
          old_value: oldValue,
          new_value: newValue,
          old_confidence: 1.0, // Default for manual archiving
          new_confidence: 1.0,
          old_priority: 5,
          new_priority: 5,
          change_type: 'update',
          change_source: 'conversation',
          source_reference: 'Manual fact archiving',
          changed_by: 'fact_promotion_engine'
        });

      if (error) {
        throw new Error(`Failed to archive fact: ${error.message}`);
      }
    } catch (error) {
      console.error('Failed to archive old fact:', error);
      // Don't throw - archiving failure shouldn't block fact updates
    }
  }

  /**
   * Determine if an existing fact should be updated with new information
   */
  private shouldUpdateFact(existingFact: any, newFact: ExtractedFact): boolean {
    // Always update if the value is different
    if (existingFact.value !== newFact.value) {
      return true;
    }

    // Update if new fact has significantly higher confidence
    if (newFact.confidence > existingFact.confidence + 0.1) {
      return true;
    }

    // Don't update if values are the same and confidence isn't significantly better
    return false;
  }

  /**
   * Calculate priority based on fact key
   */
  private calculatePriority(key: string): number {
    const priorityMap: Record<string, number> = {
      // Core identity (highest priority)
      'full_name': 1,
      'birth_year': 1,
      'birthplace': 1,
      
      // Important relationships and current status
      'partner_name': 2,
      'family_parents': 2,
      'current_city': 2,
      'current_job': 2,
      
      // Personal attributes
      'languages': 3,
      'grew_up': 3,
      'signature_style': 3,
      
      // Lifestyle and interests
      'hobbies': 4,
      'pets_current': 4,
      
      // Default for unknown keys
      'default': 5
    };

    return priorityMap[key] || priorityMap['default'];
  }

  /**
   * Extract date context from fact if applicable
   */
  private extractDateContext(fact: ExtractedFact): { year?: number; month?: number; day?: number } | null {
    // For birth year facts, extract the year
    if (fact.key === 'birth_year') {
      const year = parseInt(fact.value);
      if (!isNaN(year)) {
        return { year };
      }
    }

    // For move facts with year information
    if (fact.key.startsWith('moved_to_') && fact.key.includes('_year')) {
      const yearMatch = fact.source_text.match(/\b(19|20)\d{2}\b/);
      if (yearMatch) {
        const year = parseInt(yearMatch[0]);
        return { year };
      }
    }

    return null;
  }

  /**
   * Calculate expiration date for facts that may become outdated
   */
  private calculateExpiration(key: string): Date | null {
    const expiringFactTypes = new Set([
      'pets_current', // Pets may pass away or be given away
      'current_job', // Jobs change
      'current_city', // People move
      'hobbies' // Interests may change
    ]);

    if (expiringFactTypes.has(key)) {
      // Set expiration to 2 years from now for current status facts
      const expiration = new Date();
      expiration.setFullYear(expiration.getFullYear() + 2);
      return expiration;
    }

    return null; // No expiration for permanent facts
  }

  /**
   * Get promotion statistics for monitoring
   */
  async getPromotionStats(avatarId: string): Promise<{
    total_facts: number;
    facts_by_priority: Record<number, number>;
    recent_promotions: number;
    last_promotion: Date | null;
  }> {
    try {
      // Get total facts count
      const { count: totalFacts } = await this.supabase
        .from('quick_facts')
        .select('*', { count: 'exact', head: true })
        .eq('avatar_id', avatarId);

      // Get facts by priority
      const { data: factsByPriority } = await this.supabase
        .from('quick_facts')
        .select('priority')
        .eq('avatar_id', avatarId);

      const priorityCount: Record<number, number> = {};
      factsByPriority?.forEach(fact => {
        priorityCount[fact.priority] = (priorityCount[fact.priority] || 0) + 1;
      });

      // Get recent promotions (last 24 hours)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const { count: recentPromotions } = await this.supabase
        .from('fact_history')
        .select('*', { count: 'exact', head: true })
        .eq('avatar_id', avatarId)
        .eq('change_type', 'insert')
        .gte('changed_at', yesterday.toISOString());

      // Get last promotion date
      const { data: lastPromotion } = await this.supabase
        .from('fact_history')
        .select('changed_at')
        .eq('avatar_id', avatarId)
        .eq('change_type', 'insert')
        .order('changed_at', { ascending: false })
        .limit(1)
        .single();

      return {
        total_facts: totalFacts || 0,
        facts_by_priority: priorityCount,
        recent_promotions: recentPromotions || 0,
        last_promotion: lastPromotion ? new Date(lastPromotion.changed_at) : null
      };

    } catch (error) {
      console.error('Failed to get promotion stats:', error);
      return {
        total_facts: 0,
        facts_by_priority: {},
        recent_promotions: 0,
        last_promotion: null
      };
    }
  }
}