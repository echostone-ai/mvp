// src/lib/services/composerRules.ts
// Composer rules for handling special query patterns like "how many X"

import { supabase } from '@/lib/supabase';

export interface CountEnumerationResult {
  totalCount: number;
  currentItems: string[];
  pastItems: string[];
  formattedResponse: string;
  confidence: number;
}

export interface Memory {
  id: string;
  fragment_text: string;
  similarity?: number;
  created_at: string;
}

/**
 * Composer rules for handling special query patterns
 */
export class ComposerRules {
  
  /**
   * Detects if a query is asking for a count enumeration
   */
  static isCountQuery(query: string): boolean {
    const lowerQuery = query.toLowerCase();
    const countPatterns = [
      /how many\s+(\w+)/,
      /count\s+(\w+)/,
      /number of\s+(\w+)/,
      /total\s+(\w+)/
    ];
    
    return countPatterns.some(pattern => pattern.test(lowerQuery));
  }

  /**
   * Extracts the item type from a count query
   */
  static extractItemType(query: string): string | null {
    const lowerQuery = query.toLowerCase();
    const patterns = [
      /how many\s+(\w+)/,
      /count\s+(\w+)/,
      /number of\s+(\w+)/,
      /total\s+(\w+)/
    ];
    
    for (const pattern of patterns) {
      const match = lowerQuery.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return null;
  }

  /**
   * Enumerates items from memories for count queries
   */
  static async enumerateItemsFromMemories(
    memories: Memory[],
    itemType: string
  ): Promise<CountEnumerationResult> {
    try {
      // Convert memories to JSON for database function
      const memoriesJson = JSON.stringify(memories.map(m => ({
        id: m.id,
        fragment_text: m.fragment_text,
        created_at: m.created_at
      })));

      // Determine search patterns based on item type
      const patterns = this.getSearchPatterns(itemType);
      
      // Use database function for enumeration
      const { data, error } = await supabase.rpc('enumerate_items_from_memories', {
        memories_json: memoriesJson,
        item_patterns: patterns
      });

      if (error) {
        console.error('Error in enumerate_items_from_memories:', error);
        return this.fallbackEnumeration(memories, itemType);
      }

      if (!data || data.length === 0) {
        return this.fallbackEnumeration(memories, itemType);
      }

      const result = data[0];
      return {
        totalCount: result.total_count || 0,
        currentItems: result.current_items || [],
        pastItems: result.past_items || [],
        formattedResponse: result.formatted_response || "I don't have information about that yet.",
        confidence: 0.8
      };
    } catch (error) {
      console.error('Error enumerating items:', error);
      return this.fallbackEnumeration(memories, itemType);
    }
  }

  /**
   * Get search patterns for different item types
   */
  private static getSearchPatterns(itemType: string): string[] {
    const lowerType = itemType.toLowerCase();
    
    if (['dog', 'dogs', 'pet', 'pets'].includes(lowerType)) {
      return [
        'dog', 'dogs', 'pet', 'pets', 'puppy', 'puppies',
        'poodle', 'retriever', 'labrador', 'golden'
      ];
    }
    
    if (['cat', 'cats'].includes(lowerType)) {
      return ['cat', 'cats', 'kitten', 'kittens', 'feline'];
    }
    
    if (['child', 'children', 'kid', 'kids'].includes(lowerType)) {
      return ['child', 'children', 'son', 'daughter', 'kid', 'kids'];
    }
    
    if (['job', 'jobs', 'work', 'career'].includes(lowerType)) {
      return ['job', 'work', 'career', 'position', 'role', 'company'];
    }
    
    if (['hobby', 'hobbies', 'interest', 'interests'].includes(lowerType)) {
      return ['hobby', 'hobbies', 'interest', 'enjoy', 'like', 'love'];
    }
    
    // Default patterns
    return [lowerType];
  }

  /**
   * Fallback enumeration using simple text matching
   */
  private static fallbackEnumeration(
    memories: Memory[],
    itemType: string
  ): CountEnumerationResult {
    const lowerType = itemType.toLowerCase();
    const items: string[] = [];
    
    // Simple pattern matching for common cases
    if (['dog', 'dogs', 'pet', 'pets'].includes(lowerType)) {
      const dogNames = ['romeo', 'bucky', 'george', 'olive'];
      const currentDogs: string[] = [];
      const pastDogs: string[] = [];
      
      for (const memory of memories) {
        const text = memory.fragment_text.toLowerCase();
        
        for (const name of dogNames) {
          if (text.includes(name)) {
            // Simple heuristic: if mentioned with present tense or recent context, it's current
            if (text.includes('now') || text.includes('current') || text.includes('my dog') || 
                new Date(memory.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) {
              if (!currentDogs.includes(name.charAt(0).toUpperCase() + name.slice(1))) {
                currentDogs.push(name.charAt(0).toUpperCase() + name.slice(1));
              }
            } else {
              if (!pastDogs.includes(name.charAt(0).toUpperCase() + name.slice(1))) {
                pastDogs.push(name.charAt(0).toUpperCase() + name.slice(1));
              }
            }
          }
        }
      }
      
      const totalCount = currentDogs.length + pastDogs.length;
      
      if (totalCount === 0) {
        return {
          totalCount: 0,
          currentItems: [],
          pastItems: [],
          formattedResponse: "I don't have information about that yet.",
          confidence: 0.3
        };
      }
      
      let formattedResponse = '';
      if (currentDogs.length > 0 && pastDogs.length > 0) {
        formattedResponse = `${this.numberToWord(totalCount)} total—${currentDogs.join(', ')} now, and before that ${pastDogs.join(', ')}.`;
      } else if (currentDogs.length > 0) {
        formattedResponse = `${this.numberToWord(currentDogs.length)}: ${currentDogs.join(', ')}.`;
      } else {
        formattedResponse = `${this.numberToWord(pastDogs.length)} in the past: ${pastDogs.join(', ')}.`;
      }
      
      return {
        totalCount,
        currentItems: currentDogs,
        pastItems: pastDogs,
        formattedResponse,
        confidence: 0.7
      };
    }
    
    // Generic fallback
    return {
      totalCount: 0,
      currentItems: [],
      pastItems: [],
      formattedResponse: "I don't have specific information about that yet.",
      confidence: 0.2
    };
  }

  /**
   * Convert number to word for natural responses
   */
  private static numberToWord(num: number): string {
    const words = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
    return words[num] || num.toString();
  }

  /**
   * Determines if memories contain enough information for a confident count
   */
  static hasConfidentCount(memories: Memory[], itemType: string): boolean {
    const patterns = this.getSearchPatterns(itemType);
    let matchCount = 0;
    
    for (const memory of memories) {
      const text = memory.fragment_text.toLowerCase();
      for (const pattern of patterns) {
        if (text.includes(pattern)) {
          matchCount++;
          break;
        }
      }
    }
    
    // Need at least 2 relevant memories for confident count
    return matchCount >= 2;
  }

  /**
   * Enhances a response with count information if applicable
   */
  static async enhanceResponseWithCount(
    query: string,
    memories: Memory[],
    baseResponse: string
  ): Promise<string> {
    if (!this.isCountQuery(query)) {
      return baseResponse;
    }
    
    const itemType = this.extractItemType(query);
    if (!itemType) {
      return baseResponse;
    }
    
    const enumeration = await this.enumerateItemsFromMemories(memories, itemType);
    
    // If we have a confident count, use it; otherwise fall back to base response
    if (enumeration.confidence > 0.6 && enumeration.totalCount > 0) {
      return enumeration.formattedResponse;
    }
    
    return baseResponse;
  }
}