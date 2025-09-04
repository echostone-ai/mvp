/**
 * Example usage of FactScoringService
 * 
 * This file demonstrates how to use the FactScoringService to:
 * - Score extracted facts with confidence and priority
 * - Filter facts based on confidence thresholds
 * - Resolve conflicts between existing and new facts
 * - Sort facts by importance
 */

import { FactScoringService, ExtractedFact, QuickFact } from '../factScoringService';

// Create a service instance with default configuration
const factScoringService = new FactScoringService();

// Or create with custom configuration
const customScoringService = new FactScoringService({
  confidenceThresholds: {
    general: 0.4, // Higher threshold for general facts
    place: 0.3,   // Higher threshold for place facts
  },
  sourceReliability: {
    manual: 1.0,
    extraction: 0.9, // Higher reliability for extraction
    llm: 0.8,
    heuristic: 0.6,
  },
  maxRecencyBonus: 0.2, // Higher recency bonus
});

/**
 * Example 1: Scoring extracted facts
 */
export function scoreExtractedFacts() {
  const extractedFacts: ExtractedFact[] = [
    {
      key: 'full_name',
      value: 'John Smith',
      confidence: 0.8,
      priority: 0, // Will be overridden by scoring
      source: 'manual',
      sourceReference: 'User provided during onboarding',
      extractedAt: new Date(),
    },
    {
      key: 'hobby',
      value: 'I think I might like reading',
      confidence: 0.6,
      priority: 0,
      source: 'llm',
      sourceReference: 'Extracted from conversation',
      extractedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
    },
    {
      key: 'birthplace',
      value: 'Chicago',
      confidence: 0.3, // Low confidence but place fact
      priority: 0,
      source: 'heuristic',
      sourceReference: 'Guessed from context',
      extractedAt: new Date(),
    },
  ];

  // Score all facts
  const scoredFacts = extractedFacts.map(fact => factScoringService.scoreFact(fact));

  console.log('Scored facts:');
  scoredFacts.forEach(fact => {
    console.log(`${fact.key}: ${fact.value} (confidence: ${fact.confidence.toFixed(3)}, priority: ${fact.priority})`);
  });

  return scoredFacts;
}

/**
 * Example 2: Filtering facts by confidence thresholds
 */
export function filterFactsByConfidence() {
  const facts: ExtractedFact[] = [
    { key: 'hobby', value: 'reading', confidence: 0.4, priority: 5, source: 'extraction', sourceReference: '' },
    { key: 'name', value: 'John', confidence: 0.3, priority: 1, source: 'extraction', sourceReference: '' },
    { key: 'birthplace', value: 'Chicago', confidence: 0.3, priority: 2, source: 'extraction', sourceReference: '' },
    { key: 'pet', value: 'dog', confidence: 0.2, priority: 7, source: 'extraction', sourceReference: '' },
  ];

  const validFacts = factScoringService.filterByConfidence(facts);

  console.log('Facts that meet confidence thresholds:');
  validFacts.forEach(fact => {
    const threshold = fact.key.includes('place') ? 0.25 : 0.35;
    console.log(`${fact.key}: ${fact.value} (confidence: ${fact.confidence} >= ${threshold})`);
  });

  return validFacts;
}

/**
 * Example 3: Resolving conflicts between facts
 */
export function resolveFactConflicts() {
  const existingFact: QuickFact = {
    id: '1',
    avatarId: 'avatar1',
    key: 'current_city',
    value: 'Boston',
    confidence: 0.6,
    priority: 3,
    source: 'heuristic',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  const newFact: ExtractedFact = {
    key: 'current_city',
    value: 'New York',
    confidence: 0.8,
    priority: 2,
    source: 'manual',
    sourceReference: 'User confirmed location',
    extractedAt: new Date(),
  };

  const resolution = factScoringService.resolveConflict(existingFact, newFact);

  console.log('Conflict resolution result:');
  console.log(`Winner: ${resolution.winningFact.value} (${resolution.winningFact.source})`);
  console.log(`Reason: ${resolution.reason}`);
  console.log(`Confidence adjustment: ${resolution.confidenceAdjustment.toFixed(3)}`);

  return resolution;
}

/**
 * Example 4: Sorting facts by importance
 */
export function sortFactsByImportance() {
  const facts: ExtractedFact[] = [
    { key: 'trivia', value: 'likes blue', confidence: 0.9, priority: 10, source: 'manual', sourceReference: '' },
    { key: 'full_name', value: 'John', confidence: 0.7, priority: 1, source: 'extraction', sourceReference: '' },
    { key: 'hobby1', value: 'reading', confidence: 0.6, priority: 5, source: 'extraction', sourceReference: '' },
    { key: 'hobby2', value: 'writing', confidence: 0.8, priority: 5, source: 'extraction', sourceReference: '' },
  ];

  const sortedFacts = factScoringService.sortByImportance(facts);

  console.log('Facts sorted by importance:');
  sortedFacts.forEach((fact, index) => {
    console.log(`${index + 1}. ${fact.key}: ${fact.value} (priority: ${fact.priority}, confidence: ${fact.confidence})`);
  });

  return sortedFacts;
}

/**
 * Example 5: Complete workflow for processing new facts
 */
export function processNewFacts(extractedFacts: ExtractedFact[], existingFacts: QuickFact[]) {
  console.log('Processing new facts workflow:');

  // Step 1: Score all extracted facts
  const scoredFacts = extractedFacts.map(fact => factScoringService.scoreFact(fact));
  console.log(`1. Scored ${scoredFacts.length} extracted facts`);

  // Step 2: Filter by confidence thresholds
  const validFacts = factScoringService.filterByConfidence(scoredFacts);
  console.log(`2. ${validFacts.length} facts meet confidence thresholds`);

  // Step 3: Resolve conflicts with existing facts
  const resolvedFacts: QuickFact[] = [];
  const conflictResolutions: string[] = [];

  for (const newFact of validFacts) {
    const existingFact = existingFacts.find(ef => ef.key === newFact.key);
    
    if (existingFact) {
      const resolution = factScoringService.resolveConflict(existingFact, newFact);
      resolvedFacts.push(resolution.winningFact);
      conflictResolutions.push(`${newFact.key}: ${resolution.reason}`);
    } else {
      // No conflict, create new fact
      resolvedFacts.push({
        id: `new_${Date.now()}`,
        avatarId: 'avatar1',
        key: newFact.key,
        value: newFact.value,
        confidence: newFact.confidence,
        priority: newFact.priority,
        source: newFact.source as QuickFact['source'],
        sourceReference: newFact.sourceReference,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  }

  console.log(`3. Resolved ${conflictResolutions.length} conflicts`);
  conflictResolutions.forEach(resolution => console.log(`   - ${resolution}`));

  // Step 4: Sort final facts by importance
  const finalFacts = factScoringService.sortByImportance(resolvedFacts);
  console.log(`4. Final facts sorted by importance:`);
  finalFacts.slice(0, 5).forEach((fact, index) => {
    console.log(`   ${index + 1}. ${fact.key}: ${fact.value} (p:${fact.priority}, c:${fact.confidence.toFixed(3)})`);
  });

  return {
    scoredFacts,
    validFacts,
    resolvedFacts: finalFacts,
    conflictResolutions,
  };
}

/**
 * Example 6: Custom configuration for specific use cases
 */
export function customConfigurationExample() {
  // Configuration for a more strict system
  const strictService = new FactScoringService({
    confidenceThresholds: {
      general: 0.5,  // Higher threshold
      place: 0.4,    // Higher threshold for places too
    },
    sourceReliability: {
      manual: 1.0,
      extraction: 0.8,  // Lower trust in extraction
      llm: 0.6,         // Lower trust in LLM
      heuristic: 0.3,   // Much lower trust in heuristics
    },
    maxRecencyBonus: 0.1, // Lower recency bonus
  });

  // Configuration for a more permissive system
  const permissiveService = new FactScoringService({
    confidenceThresholds: {
      general: 0.2,  // Lower threshold
      place: 0.15,   // Lower threshold for places
    },
    sourceReliability: {
      manual: 1.0,
      extraction: 0.9,  // Higher trust in extraction
      llm: 0.85,        // Higher trust in LLM
      heuristic: 0.7,   // Higher trust in heuristics
    },
    maxRecencyBonus: 0.25, // Higher recency bonus
  });

  const testFact: ExtractedFact = {
    key: 'hobby',
    value: 'reading',
    confidence: 0.4,
    priority: 5,
    source: 'heuristic',
    sourceReference: 'Guessed from context',
    extractedAt: new Date(),
  };

  const strictResult = strictService.meetsConfidenceThreshold(strictService.scoreFact(testFact));
  const permissiveResult = permissiveService.meetsConfidenceThreshold(permissiveService.scoreFact(testFact));

  console.log('Custom configuration comparison:');
  console.log(`Strict service accepts fact: ${strictResult}`);
  console.log(`Permissive service accepts fact: ${permissiveResult}`);

  return { strictResult, permissiveResult };
}

// Example usage
if (require.main === module) {
  console.log('=== FactScoringService Examples ===\n');
  
  scoreExtractedFacts();
  console.log('\n---\n');
  
  filterFactsByConfidence();
  console.log('\n---\n');
  
  resolveFactConflicts();
  console.log('\n---\n');
  
  sortFactsByImportance();
  console.log('\n---\n');
  
  customConfigurationExample();
}