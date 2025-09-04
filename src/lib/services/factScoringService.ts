/**
 * FactScoringService - Assigns confidence and priority values to extracted facts
 * 
 * This service implements the scoring algorithms for facts based on:
 * - Source reliability (manual > extraction > llm > heuristic)
 * - Recency bonus for newer information
 * - Confidence threshold enforcement
 * - Priority assignment based on fact type and importance
 */

export interface ExtractedFact {
  key: string;
  value: string;
  confidence: number;
  priority: number;
  source: string;
  sourceReference: string;
  extractedAt?: Date;
}

export interface QuickFact {
  id: string;
  avatarId: string;
  key: string;
  value: string;
  confidence: number;
  priority: number;
  source: 'heuristic' | 'llm' | 'manual' | 'extraction';
  sourceReference?: string;
  dateContext?: {
    year?: number;
    month?: number;
    day?: number;
  };
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  category?: string;
}

export interface ScoringConfig {
  sourceReliability: Record<string, number>;
  confidenceThresholds: {
    general: number;
    place: number;
  };
  recencyBonusDecayDays: number;
  maxRecencyBonus: number;
  priorityRules: Record<string, number>;
}

export interface ConflictResolutionResult {
  winningFact: QuickFact;
  reason: string;
  confidenceAdjustment: number;
}

export class FactScoringService {
  private config: ScoringConfig;

  constructor(config?: Partial<ScoringConfig>) {
    this.config = {
      sourceReliability: {
        manual: 1.0,
        extraction: 0.85,
        llm: 0.7,
        heuristic: 0.5,
      },
      confidenceThresholds: {
        general: 0.35,
        place: 0.25,
      },
      recencyBonusDecayDays: 30,
      maxRecencyBonus: 0.15,
      priorityRules: {
        // Core identity facts (priority 1-2)
        full_name: 1,
        birth_year: 1,
        birthplace: 2,
        current_city: 2,
        partner_name: 1,
        family_parents: 2,
        speaking_style: 1,
        
        // Life context facts (priority 3-5)
        grew_up: 3,
        education: 4,
        languages: 4,
        core_values: 3,
        personality_traits: 4,
        
        // Personal attributes (priority 5-7)
        hobbies: 5,
        interests: 6,
        preferences: 6,
        
        // Temporal/contextual facts (priority 7-10)
        pets_current: 7,
        recent_activity: 8,
        temporary_status: 9,
        trivia: 10,
      },
      ...config,
    };
  }

  /**
   * Assigns confidence and priority scores to an extracted fact
   */
  public scoreFact(fact: ExtractedFact): ExtractedFact {
    const baseConfidence = this.calculateBaseConfidence(fact);
    const sourceReliability = this.getSourceReliability(fact.source);
    const recencyBonus = this.calculateRecencyBonus(fact.extractedAt);
    
    const finalConfidence = Math.min(1.0, baseConfidence * sourceReliability + recencyBonus);
    const priority = this.assignPriority(fact.key, fact.value);

    return {
      ...fact,
      confidence: Math.round(finalConfidence * 1000) / 1000, // Round to 3 decimal places
      priority,
    };
  }

  /**
   * Validates if a fact meets confidence thresholds
   */
  public meetsConfidenceThreshold(fact: ExtractedFact): boolean {
    const isPlaceFact = this.isPlaceFact(fact.key);
    const threshold = isPlaceFact 
      ? this.config.confidenceThresholds.place 
      : this.config.confidenceThresholds.general;
    
    return fact.confidence >= threshold;
  }

  /**
   * Resolves conflicts between existing and new facts
   */
  public resolveConflict(existingFact: QuickFact, newFact: ExtractedFact): ConflictResolutionResult {
    const scoredNewFact = this.scoreFact(newFact);
    
    // Calculate weighted scores
    const existingScore = this.calculateWeightedScore(existingFact);
    const newScore = this.calculateWeightedScore(scoredNewFact);
    
    let winningFact: QuickFact;
    let reason: string;
    let confidenceAdjustment = 0;

    // Check if scores are very close first (within 0.08 threshold for similar scores)
    if (Math.abs(newScore - existingScore) < 0.08) {
      // Scores are very close, merge with confidence boost
      const mergedConfidence = Math.min(1.0, Math.max(existingFact.confidence, scoredNewFact.confidence) + 0.05);
      winningFact = {
        ...existingFact,
        confidence: mergedConfidence,
        updatedAt: new Date().toISOString(),
      };
      reason = `Facts have similar scores, boosted confidence from ${existingFact.confidence.toFixed(3)} to ${mergedConfidence.toFixed(3)}`;
      confidenceAdjustment = mergedConfidence - existingFact.confidence;
    } else if (newScore > existingScore) {
      // New fact wins
      winningFact = {
        ...existingFact,
        value: scoredNewFact.value,
        confidence: scoredNewFact.confidence,
        priority: scoredNewFact.priority,
        source: scoredNewFact.source as QuickFact['source'],
        sourceReference: scoredNewFact.sourceReference,
        updatedAt: new Date().toISOString(),
      };
      reason = `New fact has higher weighted score (${newScore.toFixed(3)} vs ${existingScore.toFixed(3)})`;
      confidenceAdjustment = scoredNewFact.confidence - existingFact.confidence;
    } else {
      // Existing fact wins
      winningFact = existingFact;
      reason = `Existing fact has higher weighted score (${existingScore.toFixed(3)} vs ${newScore.toFixed(3)})`;
    }

    return {
      winningFact,
      reason,
      confidenceAdjustment,
    };
  }

  /**
   * Filters facts based on confidence thresholds
   */
  public filterByConfidence(facts: ExtractedFact[]): ExtractedFact[] {
    return facts.filter(fact => this.meetsConfidenceThreshold(fact));
  }

  /**
   * Sorts facts by priority and confidence
   */
  public sortByImportance(facts: (ExtractedFact | QuickFact)[]): (ExtractedFact | QuickFact)[] {
    return facts.sort((a, b) => {
      // First sort by priority (lower number = higher priority)
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      // Then by confidence (higher = better)
      return b.confidence - a.confidence;
    });
  }

  /**
   * Calculate base confidence from the fact content and structure
   */
  private calculateBaseConfidence(fact: ExtractedFact): number {
    let confidence = fact.confidence || 0.5;

    // Boost confidence for well-structured facts
    if (fact.value && fact.value.length > 2 && fact.value.length < 100) {
      confidence += 0.1;
    }

    // Boost confidence for facts with clear source references
    if (fact.sourceReference && fact.sourceReference.length > 10) {
      confidence += 0.05;
    }

    // Reduce confidence for vague or uncertain language
    const uncertainWords = ['maybe', 'perhaps', 'might', 'possibly', 'probably', 'i think'];
    const hasUncertainty = uncertainWords.some(word => 
      fact.value.toLowerCase().includes(word)
    );
    if (hasUncertainty) {
      confidence -= 0.15;
    }

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  /**
   * Get source reliability multiplier
   */
  private getSourceReliability(source: string): number {
    return this.config.sourceReliability[source] || 0.5;
  }

  /**
   * Calculate recency bonus for newer facts
   */
  private calculateRecencyBonus(extractedAt?: Date): number {
    if (!extractedAt) return 0;

    const daysSinceExtraction = (Date.now() - extractedAt.getTime()) / (1000 * 60 * 60 * 24);
    
    if (daysSinceExtraction > this.config.recencyBonusDecayDays) {
      return 0;
    }

    const decayFactor = 1 - (daysSinceExtraction / this.config.recencyBonusDecayDays);
    return this.config.maxRecencyBonus * decayFactor;
  }

  /**
   * Assign priority based on fact key and content
   */
  private assignPriority(key: string, value: string): number {
    // Check for exact key matches
    if (this.config.priorityRules[key]) {
      return this.config.priorityRules[key];
    }

    // Check for pattern matches
    if (key.startsWith('family_')) return 2;
    if (key.startsWith('education_')) return 4;
    if (key.startsWith('moved_to_')) return 5;
    if (key.startsWith('pets_')) return 7;
    if (key.startsWith('recent_')) return 8;
    if (key.includes('temporary')) return 9;

    // Special handling for hobby key
    if (key === 'hobby') return 5;

    // Default priority based on value characteristics
    if (value.length < 10) return 8; // Short facts are often less important
    if (value.includes('very important') || value.includes('core')) return 2;
    
    return 6; // Default middle priority
  }

  /**
   * Check if a fact is related to places/locations
   */
  private isPlaceFact(key: string): boolean {
    const placeKeys = [
      'birthplace', 'current_city', 'grew_up', 'lives_in', 
      'moved_to', 'hometown', 'location', 'address'
    ];
    
    return placeKeys.some(placeKey => key.includes(placeKey));
  }

  /**
   * Calculate weighted score for conflict resolution
   */
  private calculateWeightedScore(fact: ExtractedFact | QuickFact): number {
    const priorityWeight = 0.4;
    const confidenceWeight = 0.6;
    
    // Invert priority for scoring (lower priority number = higher score)
    const priorityScore = (11 - fact.priority) / 10;
    
    return (priorityScore * priorityWeight) + (fact.confidence * confidenceWeight);
  }
}

// Default instance for easy importing
export const factScoringService = new FactScoringService();