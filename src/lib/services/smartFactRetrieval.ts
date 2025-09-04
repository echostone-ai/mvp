import { SupabaseClient } from '@supabase/supabase-js';

export interface SmartFact {
  key: string;
  value: string;
  priority: number;
  confidence: number;
  aliases?: string[];
  related_concepts?: string[];
}

/**
 * Smart fact retrieval that handles related concepts and aliases
 * Fixes the issue where "how's romeo" doesn't find "pets" facts
 */
export class SmartFactRetrieval {
  private db: SupabaseClient;
  
  // Concept mapping for better fact retrieval
  private static readonly CONCEPT_MAP = {
    // Pet-related queries
    'romeo': ['pets', 'pet_name', 'dog'],
    'dog': ['pets', 'pet_name', 'pet_type'],
    'pup': ['pets', 'pet_name', 'pet_type'],
    'puppy': ['pets', 'pet_name', 'pet_type'],
    'pet': ['pets', 'pet_name', 'pet_type'],
    
    // Location queries
    'home': ['home_city', 'home_country', 'current_location', 'places_lived'],
    'live': ['home_city', 'home_country', 'current_location'],
    'where': ['home_city', 'home_country', 'places_lived'],
    'location': ['home_city', 'home_country', 'current_location'],
    
    // Identity queries
    'name': ['full_name', 'given_name', 'nickname'],
    'who': ['full_name', 'given_name', 'profession', 'personality'],
    'yourself': ['full_name', 'profession', 'personality', 'home_city'],
    
    // Relationship queries
    'krissy': ['partner_name', 'spouse'],
    'partner': ['partner_name', 'spouse'],
    'girlfriend': ['partner_name', 'spouse'],
    'wife': ['partner_name', 'spouse'],
    
    // Work queries
    'work': ['profession', 'job', 'career'],
    'job': ['profession', 'work'],
    'writer': ['profession', 'writing'],
    'writing': ['profession', 'work']
  };

  constructor(dbClient: SupabaseClient) {
    this.db = dbClient;
  }

  /**
   * Get facts with smart concept matching
   * @param avatarId - Avatar ID
   * @param userQuery - User's question/message
   * @returns Relevant facts with expanded context
   */
  async getRelevantFacts(avatarId: string, userQuery: string): Promise<SmartFact[]> {
    const queryLower = userQuery.toLowerCase();
    console.log(`[SmartFactRetrieval] Query: "${userQuery}" for avatar: ${avatarId}`);
    
    // Extract relevant concept keys from the query
    const relevantKeys = new Set<string>();
    
    // Add direct concept matches
    Object.entries(SmartFactRetrieval.CONCEPT_MAP).forEach(([concept, keys]) => {
      if (queryLower.includes(concept)) {
        console.log(`[SmartFactRetrieval] Found concept "${concept}" -> keys: ${keys.join(', ')}`);
        keys.forEach(key => relevantKeys.add(key));
      }
    });
    
    // If no specific concepts found, get core identity facts
    if (relevantKeys.size === 0) {
      console.log(`[SmartFactRetrieval] No specific concepts found, using core facts`);
      ['full_name', 'given_name', 'profession', 'personality', 'home_city'].forEach(key => 
        relevantKeys.add(key)
      );
    }
    
    // Always include some core facts for context
    ['full_name', 'given_name', 'pets'].forEach(key => relevantKeys.add(key));
    
    console.log(`[SmartFactRetrieval] Looking for keys: ${Array.from(relevantKeys).join(', ')}`);
    
    try {
      // Get facts from database
      const { data: facts, error } = await this.db
        .from('quick_facts')
        .select('key, value, priority, confidence')
        .eq('avatar_id', avatarId)
        .in('key', Array.from(relevantKeys));

      if (error) {
        console.error('[SmartFactRetrieval] Database error:', error);
        return [];
      }

      console.log(`[SmartFactRetrieval] Found ${facts?.length || 0} facts in database`);
      if (facts && facts.length > 0) {
        console.log(`[SmartFactRetrieval] Facts: ${facts.map(f => `${f.key}=${f.value}`).join(', ')}`);
      }

      // Convert to SmartFact format and add aliases
      const smartFacts: SmartFact[] = (facts || []).map(fact => ({
        key: fact.key,
        value: fact.value,
        priority: fact.priority || 3,
        confidence: fact.confidence || 0.8,
        aliases: this.getAliasesForKey(fact.key),
        related_concepts: this.getRelatedConcepts(fact.key)
      }));

      // Sort by priority and relevance
      return smartFacts.sort((a, b) => {
        // Prioritize facts that directly match query concepts
        const aRelevant = this.isDirectlyRelevant(a.key, queryLower);
        const bRelevant = this.isDirectlyRelevant(b.key, queryLower);
        
        if (aRelevant && !bRelevant) return -1;
        if (!aRelevant && bRelevant) return 1;
        
        // Then sort by priority
        return a.priority - b.priority;
      });

    } catch (error) {
      console.error('[SmartFactRetrieval] Unexpected error:', error);
      return [];
    }
  }

  /**
   * Get all core facts for building comprehensive prompts
   */
  async getAllCoreFacts(avatarId: string): Promise<SmartFact[]> {
    try {
      const { data: facts, error } = await this.db
        .from('quick_facts')
        .select('key, value, priority, confidence')
        .eq('avatar_id', avatarId)
        .lte('priority', 3) // Only high and medium priority facts
        .order('priority', { ascending: true });

      if (error) {
        console.error('[SmartFactRetrieval] Database error:', error);
        return [];
      }

      return (facts || []).map(fact => ({
        key: fact.key,
        value: fact.value,
        priority: fact.priority || 3,
        confidence: fact.confidence || 0.8,
        aliases: this.getAliasesForKey(fact.key),
        related_concepts: this.getRelatedConcepts(fact.key)
      }));

    } catch (error) {
      console.error('[SmartFactRetrieval] Unexpected error:', error);
      return [];
    }
  }

  private isDirectlyRelevant(factKey: string, queryLower: string): boolean {
    // Check if the fact key or its aliases appear in the query
    const aliases = this.getAliasesForKey(factKey);
    return aliases.some(alias => queryLower.includes(alias.toLowerCase()));
  }

  private getAliasesForKey(key: string): string[] {
    const aliasMap: Record<string, string[]> = {
      'pets': ['romeo', 'dog', 'pup', 'puppy', 'pet'],
      'pet_name': ['romeo', 'dog', 'pup'],
      'full_name': ['name', 'jonathan', 'jon'],
      'given_name': ['name', 'jonathan', 'jon'],
      'partner_name': ['krissy', 'partner', 'girlfriend'],
      'home_city': ['home', 'live', 'location'],
      'profession': ['work', 'job', 'writer', 'writing']
    };
    
    return aliasMap[key] || [key];
  }

  private getRelatedConcepts(key: string): string[] {
    const conceptMap: Record<string, string[]> = {
      'pets': ['pet_name', 'pet_type'],
      'pet_name': ['pets', 'pet_type'],
      'full_name': ['given_name', 'nickname'],
      'home_city': ['home_country', 'places_lived'],
      'partner_name': ['relationship_status']
    };
    
    return conceptMap[key] || [];
  }
}

export const smartFactRetrieval = new SmartFactRetrieval(null as any); // Will be initialized with actual client