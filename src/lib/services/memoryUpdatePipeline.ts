/**
 * Memory Update Pipeline - Automatic fact extraction and memory management
 * 
 * Handles automatic extraction of facts from conversations, conflict resolution,
 * and session memory merging with confidence scoring and priority assignment.
 */

import { supabase } from '@/lib/supabase';
import { FactExtractionEngine, FactExtractionResult } from './factExtractionEngine';
import { ExtractedFact } from './patternExtractor';
import { quickFactsCache } from '@/lib/cache';

export interface QuickFact {
  id?: string;
  avatarId: string;
  key: string;
  value: string;
  confidence: number; // 0.0 to 1.0
  priority: number; // 1 (highest) to 10 (lowest)
  source: 'heuristic' | 'llm' | 'manual' | 'extraction';
  sourceReference?: string;
  dateContext?: {
    year?: number;
    month?: number;
    day?: number;
  };
  expiresAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface MemoryFragment {
  id?: string;
  userId?: string;
  avatarId: string;
  fragmentText: string;
  embedding?: number[];
  conversationContext: {
    source: string;
    type: 'user' | 'assistant';
    conversationId: string;
    visitorId?: string;
    gist?: string;
    tags?: string[];
    title?: string;
    people?: string[];
    startDate?: string;
    endDate?: string;
    year?: number;
  };
  similarity?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ConversationContext {
  conversationId: string;
  visitorId?: string;
  sessionId?: string;
  userInput: string;
  assistantResponse: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface MemoryUpdateResult {
  factsExtracted: number;
  factsUpdated: number;
  memoriesCreated: number;
  conflicts: ConflictResolution[];
  errors: string[];
  processingTimeMs: number;
}

export interface ConflictResolution {
  key: string;
  existingFact: QuickFact;
  newFact: ExtractedFact;
  resolution: 'keep_existing' | 'update_with_new' | 'merge_values';
  reason: string;
}

export interface MemoryUpdateConfig {
  enableFactExtraction: boolean;
  enableMemoryFragments: boolean;
  confidenceThreshold: number;
  priorityThreshold: number;
  maxFactsPerUpdate: number;
  ignoreSessionMemory: boolean;
}

export class MemoryUpdatePipeline {
  private factExtractionEngine: FactExtractionEngine;
  private config: MemoryUpdateConfig;

  constructor(config?: Partial<MemoryUpdateConfig>) {
    this.factExtractionEngine = new FactExtractionEngine();
    this.config = {
      enableFactExtraction: true,
      enableMemoryFragments: true,
      confidenceThreshold: 0.35, // Minimum confidence to store facts
      priorityThreshold: 8, // Maximum priority (lower numbers = higher priority)
      maxFactsPerUpdate: 20,
      ignoreSessionMemory: false,
      ...config
    };
  }

  /**
   * Process a conversation turn and update memory with extracted facts
   */
  async processConversationTurn(
    avatarId: string,
    context: ConversationContext
  ): Promise<MemoryUpdateResult> {
    const startTime = Date.now();
    const result: MemoryUpdateResult = {
      factsExtracted: 0,
      factsUpdated: 0,
      memoriesCreated: 0,
      conflicts: [],
      errors: [],
      processingTimeMs: 0
    };

    try {
      // Skip processing if session memory is marked to ignore
      if (this.config.ignoreSessionMemory) {
        result.processingTimeMs = Date.now() - startTime;
        return result;
      }

      // Extract facts from user input and assistant response
      let extractedFacts: ExtractedFact[] = [];
      try {
        extractedFacts = await this.extractNewFacts(
          context.userInput,
          context.assistantResponse,
          avatarId
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Fact extraction failed: ${errorMessage}`);
        extractedFacts = [];
      }

      result.factsExtracted = extractedFacts.length;

      if (extractedFacts.length > 0) {
        // Update quick facts with conflict resolution
        const updateResult = await this.updateQuickFacts(avatarId, extractedFacts);
        result.factsUpdated = updateResult.updated;
        result.conflicts = updateResult.conflicts;
      }

      // Create memory fragments if enabled
      if (this.config.enableMemoryFragments) {
        const memoryResult = await this.updateMemoryFragments(
          avatarId,
          context.userInput,
          context
        );
        result.memoriesCreated = memoryResult.created;
        if (memoryResult.errors.length > 0) {
          result.errors.push(...memoryResult.errors);
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Memory update failed: ${errorMessage}`);
    }

    result.processingTimeMs = Date.now() - startTime;
    return result;
  }

  /**
   * Extract new facts from conversation content
   */
  async extractNewFacts(
    userInput: string,
    assistantResponse: string,
    avatarId: string
  ): Promise<ExtractedFact[]> {
    if (!this.config.enableFactExtraction) {
      return [];
    }

    // Combine user input and assistant response for fact extraction
    const combinedText = `User: ${userInput}\nAssistant: ${assistantResponse}`;
    
    const extractionResult: FactExtractionResult = await this.factExtractionEngine.extractFacts(
      combinedText,
      avatarId
    );

    // Filter facts by confidence and priority thresholds
    const filteredFacts = extractionResult.facts.filter(fact => 
      fact.confidence >= this.config.confidenceThreshold
    );

    // Limit the number of facts per update
    return filteredFacts.slice(0, this.config.maxFactsPerUpdate);
  }

  /**
   * Update quick facts with conflict resolution
   */
  async updateQuickFacts(
    avatarId: string,
    facts: ExtractedFact[]
  ): Promise<{ updated: number; conflicts: ConflictResolution[] }> {
    const conflicts: ConflictResolution[] = [];
    let updated = 0;

    for (const fact of facts) {
      try {
        // Check if fact already exists
        const { data: existingFacts, error: fetchError } = await supabase
          .from('quick_facts')
          .select('*')
          .eq('avatar_id', avatarId)
          .eq('key', fact.key)
          .limit(1);

        if (fetchError) {
          console.error('Error fetching existing fact:', fetchError);
          continue;
        }

        const existingFact = existingFacts?.[0];

        if (existingFact) {
          // Resolve conflict between existing and new fact
          const resolution = this.resolveConflicts(existingFact, fact);
          conflicts.push(resolution);

          if (resolution.resolution === 'update_with_new' || resolution.resolution === 'merge_values') {
            // Update existing fact
            const updatedFact = this.createUpdatedFact(existingFact, fact, resolution);
            
            const { error: updateError } = await supabase
              .from('quick_facts')
              .update({
                value: updatedFact.value,
                confidence: updatedFact.confidence,
                priority: updatedFact.priority,
                source: updatedFact.source,
                source_reference: updatedFact.sourceReference,
                date_context: updatedFact.dateContext,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingFact.id);

            if (!updateError) {
              updated++;
              try { this.invalidateQuickFactsCache(existingFact.avatar_id) } catch {}
            }
          }
        } else {
          // Create new fact
          const newQuickFact = this.convertToQuickFact(avatarId, fact);
          
          const { error: insertError } = await supabase
            .from('quick_facts')
            .insert({
              avatar_id: newQuickFact.avatarId,
              key: newQuickFact.key,
              value: newQuickFact.value,
              confidence: newQuickFact.confidence,
              priority: newQuickFact.priority,
              source: newQuickFact.source,
              source_reference: newQuickFact.sourceReference,
              date_context: newQuickFact.dateContext,
              expires_at: newQuickFact.expiresAt
            });

          if (!insertError) {
            updated++;
            try { this.invalidateQuickFactsCache(newQuickFact.avatarId) } catch {}
          }
        }
      } catch (error) {
        console.error('Error updating quick fact:', error);
      }
    }

    return { updated, conflicts };
  }

  /**
   * Update memory fragments with conversation content
   */
  async updateMemoryFragments(
    avatarId: string,
    content: string,
    context: ConversationContext
  ): Promise<{ created: number; errors: string[] }> {
    const errors: string[] = [];
    let created = 0;

    try {
      // Skip if memory fragments are disabled
      if (!this.config.enableMemoryFragments) {
        return { created, errors };
      }

      // Only create memory fragments for substantial user input
      if (content.trim().length < 10) {
        return { created, errors };
      }

      const memoryFragment: Partial<MemoryFragment> = {
        avatarId,
        fragmentText: content,
        conversationContext: {
          source: 'conversation',
          type: 'user',
          conversationId: context.conversationId,
          visitorId: context.visitorId,
          gist: this.generateGist(content),
          tags: this.extractTags(content),
          startDate: context.timestamp,
          year: new Date(context.timestamp).getFullYear()
        }
      };

      // Note: In a full implementation, we would generate embeddings here
      // For now, we'll insert without embeddings and handle them separately
      const { error: insertError } = await supabase
        .from('memory_fragments')
        .insert({
          avatar_id: avatarId,
          fragment_text: memoryFragment.fragmentText,
          conversation_context: memoryFragment.conversationContext,
          // embedding: null, // Would be generated by a separate service
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (insertError) {
        errors.push(`Failed to create memory fragment: ${insertError.message}`);
      } else {
        created++;
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Memory fragment creation failed: ${errorMessage}`);
    }

    return { created, errors };
  }

  /**
   * Resolve conflicts between existing and new facts
   */
  resolveConflicts(existingFact: any, newFact: ExtractedFact): ConflictResolution {
    const existing: QuickFact = {
      id: existingFact.id,
      avatarId: existingFact.avatar_id,
      key: existingFact.key,
      value: existingFact.value,
      confidence: existingFact.confidence,
      priority: existingFact.priority,
      source: existingFact.source,
      sourceReference: existingFact.source_reference,
      dateContext: existingFact.date_context,
      createdAt: existingFact.created_at,
      updatedAt: existingFact.updated_at
    };

    // Rule 1: Manual source beats extraction (highest priority)
    if (existing.source === 'manual' && this.mapExtractionMethodToSource(newFact.extraction_method) !== 'manual') {
      return {
        key: existingFact.key,
        existingFact: existing,
        newFact,
        resolution: 'keep_existing',
        reason: 'Existing fact is manually entered, keeping over extracted fact'
      };
    }

    // Rule 2: Higher confidence wins
    if (newFact.confidence > existing.confidence + 0.1) { // 0.1 buffer to avoid minor fluctuations
      return {
        key: existingFact.key,
        existingFact: existing,
        newFact,
        resolution: 'update_with_new',
        reason: `New fact has higher confidence (${newFact.confidence} vs ${existing.confidence})`
      };
    }

    // Rule 3: Higher priority wins (lower number = higher priority)
    const newPriority = this.calculatePriority(newFact);
    if (newPriority < existing.priority) {
      return {
        key: existingFact.key,
        existingFact: existing,
        newFact,
        resolution: 'update_with_new',
        reason: `New fact has higher priority (${newPriority} vs ${existing.priority})`
      };
    }

    // Rule 4: If confidence and priority are similar, prefer newer information
    if (Math.abs(newFact.confidence - existing.confidence) <= 0.1 && newPriority >= existing.priority) {
      return {
        key: existingFact.key,
        existingFact: existing,
        newFact,
        resolution: 'update_with_new',
        reason: 'Similar confidence, preferring newer information'
      };
    }

    // Default: Keep existing
    return {
      key: existingFact.key,
      existingFact: existing,
      newFact,
      resolution: 'keep_existing',
      reason: 'Existing fact has higher confidence or priority'
    };
  }

  /**
   * Create updated fact based on conflict resolution
   */
  private createUpdatedFact(
    existingFact: any,
    newFact: ExtractedFact,
    resolution: ConflictResolution
  ): QuickFact {
    if (resolution.resolution === 'update_with_new') {
      return {
        id: existingFact.id,
        avatarId: existingFact.avatar_id,
        key: existingFact.key,
        value: newFact.value,
        confidence: newFact.confidence,
        priority: this.calculatePriority(newFact),
        source: this.mapExtractionMethodToSource(newFact.extraction_method),
        sourceReference: `Updated from conversation: ${newFact.source_text?.substring(0, 100)}...`,
        dateContext: newFact.date_context,
        updatedAt: new Date().toISOString()
      };
    }

    // For merge_values, we could implement more sophisticated merging logic
    // For now, treat it the same as update_with_new
    return this.createUpdatedFact(existingFact, newFact, { ...resolution, resolution: 'update_with_new' });
  }

  /**
   * Convert ExtractedFact to QuickFact
   */
  private convertToQuickFact(avatarId: string, fact: ExtractedFact): QuickFact {
    return {
      avatarId,
      key: fact.key,
      value: fact.value,
      confidence: fact.confidence,
      priority: this.calculatePriority(fact),
      source: this.mapExtractionMethodToSource(fact.extraction_method),
      sourceReference: `Extracted from conversation: ${fact.source_text?.substring(0, 100)}...`,
      dateContext: fact.date_context
    };
  }

  /**
   * Calculate priority based on fact characteristics
   */
  private calculatePriority(fact: ExtractedFact): number {
    // Core identity facts get highest priority (1-2)
    const coreIdentityKeys = ['name', 'age', 'birth_date', 'occupation', 'location'];
    if (coreIdentityKeys.some(key => fact.key.toLowerCase().includes(key))) {
      return fact.confidence > 0.8 ? 1 : 2;
    }

    // Important personal facts get medium-high priority (3-5)
    const importantKeys = ['family', 'relationship', 'education', 'hobby', 'pet'];
    if (importantKeys.some(key => fact.key.toLowerCase().includes(key))) {
      return fact.confidence > 0.7 ? 3 : fact.confidence > 0.5 ? 4 : 5;
    }

    // Other facts get medium to low priority (6-8)
    if (fact.confidence > 0.7) return 6;
    if (fact.confidence > 0.5) return 7;
    return 8;
  }

  /**
   * Map extraction method to source type
   */
  private mapExtractionMethodToSource(method: string): 'heuristic' | 'llm' | 'manual' | 'extraction' {
    switch (method) {
      case 'pattern':
        return 'heuristic';
      case 'llm':
        return 'llm';
      case 'manual':
        return 'manual';
      default:
        return 'extraction';
    }
  }

  private invalidateQuickFactsCache(avatarId: string) {
    // Remove cached quick_facts entries for this avatarId
    for (const key of quickFactsCache.keys()) {
      if (key.startsWith(`quick_facts:${avatarId}:`)) {
        quickFactsCache.delete(key)
      }
    }
  }

  /**
   * Generate a brief gist of the content
   */
  private generateGist(content: string): string {
    // Simple gist generation - take first sentence or first 100 characters
    const firstSentence = content.split(/[.!?]/)[0];
    if (firstSentence.length > 0 && firstSentence.length <= 100) {
      return firstSentence.trim();
    }
    return content.substring(0, 100).trim() + (content.length > 100 ? '...' : '');
  }

  /**
   * Extract simple tags from content
   */
  private extractTags(content: string): string[] {
    const tags: string[] = [];
    const lowerContent = content.toLowerCase();

    // Simple keyword-based tagging
    const tagKeywords = {
      'family': ['family', 'mother', 'father', 'sister', 'brother', 'parent', 'child'],
      'work': ['work', 'job', 'career', 'office', 'colleague', 'boss', 'company'],
      'hobby': ['hobby', 'interest', 'enjoy', 'love doing', 'passion'],
      'travel': ['travel', 'trip', 'vacation', 'visit', 'country', 'city'],
      'food': ['food', 'eat', 'restaurant', 'cook', 'meal', 'dinner'],
      'health': ['health', 'doctor', 'medicine', 'exercise', 'gym', 'sick']
    };

    for (const [tag, keywords] of Object.entries(tagKeywords)) {
      if (keywords.some(keyword => lowerContent.includes(keyword))) {
        tags.push(tag);
      }
    }

    return tags;
  }

  /**
   * Get pipeline configuration
   */
  getConfig(): MemoryUpdateConfig {
    return { ...this.config };
  }

  /**
   * Update pipeline configuration
   */
  updateConfig(newConfig: Partial<MemoryUpdateConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}