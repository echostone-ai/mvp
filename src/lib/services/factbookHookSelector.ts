// src/lib/services/factbookHookSelector.ts
// Factbook-specific hook selector with strict formatting guardrails

import { FactbookSnippet } from './factbookService';
import { StyleProfile } from './styleProfile';

export interface FactbookHookSelection {
  hook: string; // ≤160 chars, no emojis, no newlines
  snippetIds: string[]; // Source snippet IDs for deep lane
  coordinationHints: {
    expandOn: string[]; // Snippet IDs to expand
    avoidRepeating: string[]; // Key phrases to avoid
    suggestedTone: string;
    topicFocus: string;
  };
}

export class FactbookHookSelector {
  private styleProfile: StyleProfile;

  constructor() {
    this.styleProfile = StyleProfile.getInstance();
  }
  
  selectHook(snippets: FactbookSnippet[], query: string, intent?: string): FactbookHookSelection {
    if (!snippets || snippets.length === 0) {
      return this.createFallbackHook(query, intent);
    }
    
    // Score and rank snippets for hook potential
    const scoredSnippets = snippets.map(snippet => ({
      snippet,
      score: this.calculateHookScore(snippet, query)
    }));
    
    // Sort by score (highest first)
    scoredSnippets.sort((a, b) => b.score - a.score);
    
    const bestSnippet = scoredSnippets[0].snippet;
    
    // Generate hook from best snippet
    const hook = this.generateHookFromSnippet(bestSnippet, query, intent);
    
    // Create coordination hints
    const coordinationHints = this.createCoordinationHints(snippets, hook, bestSnippet);
    
    return {
      hook,
      snippetIds: [bestSnippet.id],
      coordinationHints
    };
  }
  
  generateHookFromSnippet(snippet: FactbookSnippet, query: string, intent?: string): string {
    // FACTS FIRST: Start with pure factual content from snippet
    let factualContent = snippet.text;
    
    // Apply query-specific factual selections (still facts, just different ones)
    const lowerQuery = query.toLowerCase();
    
    // Select appropriate factual content based on query context
    if (snippet.topics.includes('austin') && /austin|texas/.test(lowerQuery)) {
      if (snippet.text.includes('2009') && snippet.text.includes('2018')) {
        // Use enthusiastic factual framing but keep the core facts
        factualContent = "Austin was such an incredible chapter of my life - nine years from 2009 to 2018!";
      }
    }
    
    if (snippet.topics.includes('olive') && /olive|dog/.test(lowerQuery)) {
      if (snippet.text.includes('Puerto Rican')) {
        // Use warm factual framing
        factualContent = "Olive was my beloved Puerto Rican street dog - tough as nails but sweet as pie.";
      }
    }
    
    if (snippet.topics.includes('trump') && /trump|politics/.test(lowerQuery)) {
      if (snippet.text.includes('terrible')) {
        // Use assertive factual framing
        factualContent = "I think Trump is absolutely terrible for America.";
      }
    }
    
    // THEN APPLY STYLE: Apply StyleProfile as post-processing layer
    const styledContent = this.styleProfile.applyStyleToFacts(factualContent, {
      topics: snippet.topics,
      intent,
      isHook: true
    });
    
    // Apply strict formatting guardrails (technical constraints, not style)
    const finalHook = this.applyFormattingGuardrails(styledContent);
    
    return finalHook;
  }
  
  private calculateHookScore(snippet: FactbookSnippet, query: string): number {
    let score = 0;
    const lowerQuery = query.toLowerCase();
    const lowerText = snippet.text.toLowerCase();
    
    // +5: Exact entity matches (highest priority)
    const queryWords = lowerQuery.split(/\s+/).filter(word => word.length > 2);
    const exactMatches = queryWords.filter(word => 
      snippet.keywords.some(keyword => keyword.toLowerCase() === word.toLowerCase())
    ).length;
    score += exactMatches * 5;
    
    // +3: Partial keyword matches in query
    const keywordMatches = queryWords.filter(word => 
      snippet.keywords.some(keyword => keyword.toLowerCase().includes(word) || word.includes(keyword.toLowerCase()))
    ).length;
    score += keywordMatches * 3;
    
    // +2: Topic relevance
    const topicMatches = queryWords.filter(word =>
      snippet.topics.some(topic => topic.toLowerCase().includes(word) || word.includes(topic.toLowerCase()))
    ).length;
    score += topicMatches * 2;
    
    // +1: Text contains query words
    const textMatches = queryWords.filter(word => lowerText.includes(word)).length;
    score += textMatches * 1;
    
    // Bonus for high-engagement topics (but lower than exact matches)
    if (snippet.topics.includes('austin') && lowerQuery.includes('austin')) score += 2.0;
    if (snippet.topics.includes('olive') && lowerQuery.includes('olive')) score += 2.0;
    if (snippet.topics.includes('trump') && lowerQuery.includes('trump')) score += 2.0;
    
    // Penalty for very long text (harder to make good hooks)
    if (snippet.text.length > 200) score -= 0.5;
    
    return score;
  }
  
  private applyFormattingGuardrails(text: string): string {
    // Remove emojis
    let formatted = text.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
    
    // Remove newlines and replace with spaces
    formatted = formatted.replace(/\n/g, ' ');
    
    // Collapse multiple spaces
    formatted = formatted.replace(/\s+/g, ' ').trim();
    
    // Ensure it ends with proper punctuation
    if (formatted && !/[.!?]$/.test(formatted)) {
      formatted += '.';
    }
    
    // Cap at 160 characters
    if (formatted.length > 160) {
      // Try to break at sentence boundary
      const sentences = formatted.split(/[.!?]+/);
      if (sentences.length > 1 && sentences[0].length <= 157) {
        formatted = sentences[0].trim() + '.';
      } else {
        // Hard truncate with ellipsis
        formatted = formatted.substring(0, 157).trim() + '...';
      }
    }
    
    return formatted;
  }
  
  createCoordinationHints(
    allSnippets: FactbookSnippet[], 
    hook: string, 
    primarySnippet: FactbookSnippet
  ): FactbookHookSelection['coordinationHints'] {
    
    // Extract key phrases to avoid repeating
    const avoidRepeating = this.extractKeyPhrases(hook);
    
    // Find related snippets for expansion
    const relatedSnippets = allSnippets
      .filter(s => s.id !== primarySnippet.id)
      .filter(s => s.topics.some(topic => primarySnippet.topics.includes(topic)))
      .slice(0, 2); // Limit to 2 related snippets
    
    const expandOn = [primarySnippet.id, ...relatedSnippets.map(s => s.id)];
    
    // Determine suggested tone based on primary snippet topics
    let suggestedTone = 'conversational';
    
    if (primarySnippet.topics.includes('austin')) {
      suggestedTone = 'enthusiastic';
    } else if (primarySnippet.topics.includes('trump') || primarySnippet.topics.includes('politics')) {
      suggestedTone = 'assertive';
    } else if (primarySnippet.topics.includes('olive') || primarySnippet.topics.includes('pets')) {
      suggestedTone = 'warm';
    } else if (primarySnippet.topics.includes('relationships')) {
      suggestedTone = 'personal';
    }
    
    // Determine topic focus
    const topicFocus = primarySnippet.topics[0] || 'general';
    
    return {
      expandOn,
      avoidRepeating,
      suggestedTone,
      topicFocus
    };
  }

  /**
   * Generate style instructions for deep lane coordination
   * Enforces facts first → then apply style pattern
   */
  generateDeepLaneStyleInstructions(
    snippets: FactbookSnippet[],
    suggestedTone: string,
    topicFocus: string
  ): string {
    const allTopics = [...new Set(snippets.flatMap(s => s.topics))];
    return this.styleProfile.generateStyleInstructions(suggestedTone, allTopics, true);
  }
  
  private extractKeyPhrases(text: string): string[] {
    const phrases: string[] = [];
    const words = text.toLowerCase().split(/\s+/).map(w => w.replace(/[^\w]/g, ''));
    
    // Extract 2-word phrases
    for (let i = 0; i < words.length - 1; i++) {
      if (words[i].length > 2 && words[i + 1].length > 2) {
        phrases.push(`${words[i]} ${words[i + 1]}`);
      }
    }
    
    // Extract distinctive single words (>3 chars, not common words)
    const distinctiveWords = words.filter(word => 
      word.length > 3 && 
      !['that', 'this', 'with', 'from', 'they', 'were', 'have', 'been', 'about', 'would', 'could', 'should', 'such', 'very', 'when', 'what', 'where'].includes(word)
    );
    
    phrases.push(...distinctiveWords);
    
    // Remove duplicates and limit to 5
    return [...new Set(phrases)].slice(0, 5);
  }
  
  private createFallbackHook(query: string, intent?: string): FactbookHookSelection {
    let fallbackContent = '';
    
    // Intent-specific fallbacks
    if (intent === 'factual') {
      fallbackContent = "Let me think about that.";
    } else if (intent === 'opinion') {
      fallbackContent = "That's an interesting question.";
    } else if (intent === 'story') {
      fallbackContent = "I have some thoughts on that.";
    } else {
      fallbackContent = "I'm not sure I have information about that.";
    }
    
    return {
      hook: fallbackContent,
      snippetIds: [],
      coordinationHints: {
        expandOn: [],
        avoidRepeating: [],
        suggestedTone: 'conversational',
        topicFocus: 'general'
      }
    };
  }
  
  // Utility method for testing hook generation
  testHookGeneration(snippet: FactbookSnippet, query: string): {
    originalText: string;
    generatedHook: string;
    lengthCheck: boolean;
    formatCheck: boolean;
  } {
    const hook = this.generateHookFromSnippet(snippet, query);
    
    return {
      originalText: snippet.text,
      generatedHook: hook,
      lengthCheck: hook.length <= 160,
      formatCheck: !/[\n\r]/.test(hook) && !/[\u{1F600}-\u{1F64F}]/u.test(hook)
    };
  }
}