// src/lib/services/deepLaneCoordinator.ts
// DeepLaneCoordinator with factbook-only responses and StyleProfile integration

import { FactbookSnippet } from './factbookService';
import { StyleProfile } from './styleProfile';

export interface DeepLaneCoordinationHints {
  expandOn: string[]; // Snippet IDs to expand on
  avoidRepeating: string[]; // Key phrases to avoid repeating
  suggestedTone: string;
  topicFocus: string;
  snippetIds: string[]; // Source snippet IDs for traceability
}

export interface DeepLaneOptions {
  query: string;
  snippets: FactbookSnippet[];
  coordinationHints: DeepLaneCoordinationHints;
  fastHookContent?: string;
}

export interface DeepLaneResponse {
  systemPrompt: string;
  userPrompt: string;
  factualContext: string;
  styleInstructions: string;
  coordinationRules: string;
}

export class DeepLaneCoordinator {
  private styleProfile: StyleProfile;

  constructor() {
    this.styleProfile = StyleProfile.getInstance();
  }

  /**
   * Build deep lane prompt using factbook-only content with StyleProfile applied after fact selection
   * Implements requirement 4.3, 4.4, 7.2, 7.3, 7.5
   */
  buildDeepLanePrompt(options: DeepLaneOptions): DeepLaneResponse {
    const { query, snippets, coordinationHints, fastHookContent } = options;

    // STEP 1: FACTS FIRST - Extract pure factual content from factbook snippets
    const factualContext = this.extractFactualContext(snippets, coordinationHints.expandOn);

    // STEP 2: COORDINATION RULES - Build coordination without mixing facts and style
    const coordinationRules = this.buildCoordinationRules(coordinationHints, fastHookContent);

    // STEP 3: STYLE APPLICATION - Apply StyleProfile as post-processing layer
    const styleInstructions = this.styleProfile.generateStyleInstructions(
      coordinationHints.suggestedTone,
      snippets.flatMap(s => s.topics),
      true // isDeepLane
    );

    // STEP 4: SYSTEM PROMPT - Enforce factbook-only responses
    const systemPrompt = this.buildSystemPrompt(styleInstructions, coordinationRules);

    // STEP 5: USER PROMPT - Present facts and query
    const userPrompt = this.buildUserPrompt(query, factualContext, coordinationHints.snippetIds);

    return {
      systemPrompt,
      userPrompt,
      factualContext,
      styleInstructions,
      coordinationRules
    };
  }

  /**
   * Extract pure factual content from factbook snippets without any style influence
   * Only uses verified factbook content, never invents or embellishes
   */
  private extractFactualContext(snippets: FactbookSnippet[], expandOnIds: string[]): string {
    if (snippets.length === 0) {
      return "No factbook information available for this query.";
    }

    // Prioritize snippets marked for expansion
    const prioritizedSnippets = [...snippets].sort((a, b) => {
      const aExpand = expandOnIds.includes(a.id) ? 1 : 0;
      const bExpand = expandOnIds.includes(b.id) ? 1 : 0;
      return bExpand - aExpand;
    });

    // Extract factual content with snippet ID traceability
    const factualContent = prioritizedSnippets
      .map(snippet => {
        // Include snippet ID for traceability and fact validation
        return `[${snippet.id}] ${snippet.text}`;
      })
      .join('\n\n');

    return factualContent;
  }

  /**
   * Build coordination rules that maintain fact/style separation
   * Ensures deep lane builds on fast lane without repetition
   */
  private buildCoordinationRules(
    coordinationHints: DeepLaneCoordinationHints,
    fastHookContent?: string
  ): string {
    let rules = `COORDINATION RULES (maintain factbook-only responses):
1. FACTBOOK ONLY: Use ONLY the factual content provided above from Jonathan's factbook. Never invent, guess, or embellish facts.
2. FACT VALIDATION: Every claim must trace back to a specific snippet ID in brackets [snippet_id].
3. NO HALLUCINATION: If information isn't in the factbook snippets, acknowledge the limitation rather than create content.
4. AVOID REPETITION: Do not repeat these phrases: ${coordinationHints.avoidRepeating.join(', ')}
5. EXPAND FOCUS: Focus on expanding facts from these snippets: ${coordinationHints.expandOn.join(', ')}
6. TOPIC CONSISTENCY: Stay within the ${coordinationHints.topicFocus} topic area using only factbook content.`;

    if (fastHookContent) {
      rules += `\n7. BUILD ON HOOK: This follows the fast response: "${fastHookContent}". Add depth without repetition using only factbook facts.`;
    }

    rules += `\n8. STYLE AFTER FACTS: Apply personality and tone AFTER selecting facts, never during fact selection.
9. SOURCE TRACEABILITY: Reference snippet IDs when expanding on specific factbook entries.`;

    return rules;
  }

  /**
   * Build system prompt that enforces factbook-only responses
   * Implements the required system prompt from task requirements
   */
  private buildSystemPrompt(styleInstructions: string, coordinationRules: string): string {
    return `You are Jonathan Braden. Answer ONLY with facts from the Factbook unless asked for opinions or style.

CRITICAL CONSTRAINTS:
- Use ONLY the factbook content provided in the user message
- Never invent, guess, or create facts not explicitly stated in the factbook
- Every factual claim must trace to a specific factbook snippet ID [snippet_id]
- If factbook doesn't contain relevant information, acknowledge the limitation
- Apply personality and style ONLY to presentation, never to fact creation or selection

${coordinationRules}

${styleInstructions}

FACTBOOK-ONLY RESPONSE PATTERN:
1. SELECT FACTS: Choose relevant facts from factbook snippets based purely on factual relevance
2. VALIDATE SOURCES: Ensure every claim traces to a snippet ID
3. APPLY STYLE: Present facts using Jonathan's authentic voice and personality
4. MAINTAIN SEPARATION: Never let personality create facts or influence fact selection
5. BUILD COORDINATION: Expand on fast lane response using only factbook content`;
  }

  /**
   * Build user prompt with factual context and query
   */
  private buildUserPrompt(query: string, factualContext: string, snippetIds: string[]): string {
    return `FACTBOOK CONTENT (use ONLY this information):

${factualContext}

User query: ${query}

Available snippet IDs for reference: ${snippetIds.join(', ')}

INSTRUCTIONS:
- Answer using ONLY the factbook content above
- Reference snippet IDs when expanding on specific facts
- If the factbook doesn't contain relevant information, say so honestly
- Apply Jonathan's personality to presentation, not fact creation

Response:`;
  }

  /**
   * Validate that a response maintains factbook-only constraints
   * Ensures no hallucination or fact creation outside factbook
   */
  validateFactbookResponse(response: string, allowedSnippetIds: string[]): {
    isValid: boolean;
    violations: string[];
    factSources: string[];
    hallucinations: string[];
  } {
    const violations: string[] = [];
    const hallucinations: string[] = [];

    // Extract referenced snippet IDs
    const factSources = this.extractReferencedSnippets(response);

    // Check if all facts trace to allowed snippets
    const unauthorizedSources = factSources.filter(id => !allowedSnippetIds.includes(id));
    if (unauthorizedSources.length > 0) {
      violations.push(`Unauthorized fact sources: ${unauthorizedSources.join(', ')}`);
    }

    // Check for hallucination indicators
    const hallucinationPatterns = [
      /I think I remember/i,
      /If I recall correctly/i,
      /I believe I/i,
      /I'm pretty sure/i,
      /I might have/i,
      /I probably/i,
      /As far as I know/i,
      /I seem to remember/i
    ];

    for (const pattern of hallucinationPatterns) {
      if (pattern.test(response)) {
        hallucinations.push(`Uncertainty indicator: ${pattern.source}`);
      }
    }

    // Use StyleProfile validation for fact/style separation
    const styleValidation = this.styleProfile.validateFactStyleSeparation(response, allowedSnippetIds);
    violations.push(...styleValidation.violations);

    return {
      isValid: violations.length === 0 && hallucinations.length === 0,
      violations,
      factSources,
      hallucinations
    };
  }

  /**
   * Extract snippet IDs referenced in response for traceability
   */
  private extractReferencedSnippets(response: string): string[] {
    const snippetIdPattern = /\[([^\]]+)\]/g;
    const matches = response.match(snippetIdPattern) || [];
    return matches.map(match => match.slice(1, -1)); // Remove brackets
  }

  /**
   * Create coordination hints for factbook snippets
   * Converts factbook snippets to coordination format
   */
  static createCoordinationHints(
    snippets: FactbookSnippet[],
    suggestedTone: string,
    topicFocus: string,
    avoidRepeating: string[] = []
  ): DeepLaneCoordinationHints {
    return {
      expandOn: snippets.map(s => s.id), // All snippet IDs available for expansion
      avoidRepeating,
      suggestedTone,
      topicFocus,
      snippetIds: snippets.map(s => s.id)
    };
  }

  /**
   * Get style profile instance for testing
   */
  getStyleProfile(): StyleProfile {
    return this.styleProfile;
  }
}