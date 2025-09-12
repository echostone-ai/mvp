// src/lib/services/deepLaneStyleCoordinator.ts
// Demonstrates facts first → then apply StyleProfile pattern for deep lane

import { FactbookSnippet } from './factbookService';
import { StyleProfile } from './styleProfile';

export interface DeepLanePromptOptions {
  query: string;
  snippets: FactbookSnippet[];
  coordinationHints: {
    expandOn: string[];
    avoidRepeating: string[];
    suggestedTone: string;
    topicFocus: string;
  };
  fastHookContent?: string;
}

export class DeepLaneStyleCoordinator {
  private styleProfile: StyleProfile;

  constructor() {
    this.styleProfile = StyleProfile.getInstance();
  }

  /**
   * Build deep lane prompt using facts first → then apply style pattern
   * This ensures personality never pollutes factbook content or influences fact selection
   */
  buildDeepLanePrompt(options: DeepLanePromptOptions): string {
    const { query, snippets, coordinationHints, fastHookContent } = options;

    // STEP 1: FACTS FIRST - Extract pure factual content from snippets
    const factualContext = this.extractFactualContext(snippets);

    // STEP 2: FACT SELECTION - Select relevant facts without style influence
    const relevantFacts = this.selectRelevantFacts(factualContext, coordinationHints.expandOn);

    // STEP 3: STYLE APPLICATION - Apply StyleProfile as post-processing layer
    const styleInstructions = this.styleProfile.generateStyleInstructions(
      coordinationHints.suggestedTone,
      snippets.flatMap(s => s.topics),
      true // isDeepLane
    );

    // STEP 4: COORDINATION RULES - Build coordination without mixing facts and style
    const coordinationRules = this.buildCoordinationRules(coordinationHints, fastHookContent);

    // STEP 5: ASSEMBLE PROMPT - Facts first, then style instructions
    return this.assemblePrompt({
      query,
      factualContext: relevantFacts,
      styleInstructions,
      coordinationRules,
      snippetIds: snippets.map(s => s.id)
    });
  }

  /**
   * Extract pure factual content from snippets without any style influence
   */
  private extractFactualContext(snippets: FactbookSnippet[]): string {
    // Pure fact extraction - no personality influence
    const factualContent = snippets
      .map(snippet => {
        // Include snippet ID for traceability
        return `[${snippet.id}] ${snippet.text}`;
      })
      .join('\n\n');

    return factualContent;
  }

  /**
   * Select relevant facts based on coordination hints
   * This selection is based purely on factual relevance, not style preferences
   */
  private selectRelevantFacts(factualContext: string, expandOnIds: string[]): string {
    if (expandOnIds.length === 0) {
      return factualContext;
    }

    // Filter to focus on specific snippets for expansion
    const lines = factualContext.split('\n\n');
    const relevantLines = lines.filter(line => {
      return expandOnIds.some(id => line.includes(`[${id}]`));
    });

    // If no specific matches, return all facts
    return relevantLines.length > 0 ? relevantLines.join('\n\n') : factualContext;
  }

  /**
   * Build coordination rules that maintain fact/style separation
   */
  private buildCoordinationRules(
    coordinationHints: DeepLanePromptOptions['coordinationHints'],
    fastHookContent?: string
  ): string {
    let rules = `COORDINATION RULES (maintain fact/style separation):
1. FACTUAL BASIS: Use ONLY the factual content provided above. Never invent or embellish facts.
2. STYLE LAYER: Apply personality and tone AFTER selecting facts, never during fact selection.
3. AVOID REPETITION: Do not repeat these phrases: ${coordinationHints.avoidRepeating.join(', ')}
4. EXPAND FOCUS: Focus on expanding the facts from snippets: ${coordinationHints.expandOn.join(', ')}
5. TOPIC CONSISTENCY: Stay within the ${coordinationHints.topicFocus} topic area.`;

    if (fastHookContent) {
      rules += `\n6. BUILD ON HOOK: This follows the fast response: "${fastHookContent}". Add depth without repetition.`;
    }

    rules += `\n7. FACT VALIDATION: Every claim must trace back to a specific snippet ID in brackets.`;

    return rules;
  }

  /**
   * Assemble the final prompt with clear fact/style separation
   */
  private assemblePrompt(options: {
    query: string;
    factualContext: string;
    styleInstructions: string;
    coordinationRules: string;
    snippetIds: string[];
  }): string {
    const { query, factualContext, styleInstructions, coordinationRules, snippetIds } = options;

    return `You are Jonathan Braden. Here are your FACTUAL MEMORIES (facts first):

${factualContext}

${coordinationRules}

${styleInstructions}

User query: ${query}

RESPONSE INSTRUCTIONS:
1. SELECT FACTS: Choose relevant facts from the snippets above based purely on factual relevance
2. APPLY STYLE: Then apply the style guidelines to present those facts authentically
3. MAINTAIN SEPARATION: Never let personality create facts or influence fact selection
4. TRACE SOURCES: Reference snippet IDs when expanding on specific facts

Available snippet IDs for reference: ${snippetIds.join(', ')}

Response:`;
  }

  /**
   * Validate that a response maintains fact/style separation
   */
  validateResponse(response: string, allowedSnippetIds: string[]): {
    isValid: boolean;
    violations: string[];
    factSources: string[];
  } {
    const validation = this.styleProfile.validateFactStyleSeparation(response, allowedSnippetIds);
    
    // Extract referenced snippet IDs
    const factSources = this.extractReferencedSnippets(response);
    
    // Check if all facts trace to allowed snippets
    const unauthorizedSources = factSources.filter(id => !allowedSnippetIds.includes(id));
    
    if (unauthorizedSources.length > 0) {
      validation.violations.push(`Unauthorized fact sources: ${unauthorizedSources.join(', ')}`);
    }

    return {
      isValid: validation.isValid && unauthorizedSources.length === 0,
      violations: validation.violations,
      factSources
    };
  }

  /**
   * Extract snippet IDs referenced in response
   */
  private extractReferencedSnippets(response: string): string[] {
    const snippetIdPattern = /\[([^\]]+)\]/g;
    const matches = response.match(snippetIdPattern) || [];
    return matches.map(match => match.slice(1, -1)); // Remove brackets
  }

  /**
   * Get style profile instance for testing
   */
  getStyleProfile(): StyleProfile {
    return this.styleProfile;
  }
}