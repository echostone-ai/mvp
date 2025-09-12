import { supabase } from '@/lib/supabase';
import { QuickFact, ConversationTurn } from './promptBuilder';

/**
 * Fast PromptBuilder optimized for sub-200ms response times
 * Uses aggressive caching and minimal database queries
 */
export class FastPromptBuilder {
  private static factCache = new Map<string, { facts: QuickFact[], timestamp: number }>();
  private static readonly CACHE_TTL = 30000; // 30 seconds

  /**
   * Build prompt optimized for speed - single query, minimal processing
   */
  async buildFastPrompt(
    avatarSlug: string,
    query: string,
    conversationHistory: ConversationTurn[] = []
  ): Promise<string> {
    const startTime = Date.now();

    try {
      // Get avatar ID (cached or quick lookup)
      const avatarId = await this.getAvatarIdFast(avatarSlug);
      if (!avatarId) {
        throw new Error(`Avatar not found: ${avatarSlug}`);
      }

      // Single optimized query for all essential data
      const [facts, memories] = await Promise.all([
        this.getHotFactsFast(avatarId),
        this.getRelevantMemoriesFast(avatarId, query)
      ]);

      // Build minimal but effective prompt
      const prompt = this.buildMinimalPrompt(facts, memories, conversationHistory, query);

      const totalTime = Date.now() - startTime;
      console.log(`FastPromptBuilder completed in ${totalTime}ms`);

      return prompt;
    } catch (error) {
      console.error('FastPromptBuilder error:', error);
      throw error;
    }
  }

  /**
   * Get avatar ID with minimal overhead
   */
  private async getAvatarIdFast(slug: string): Promise<string | null> {
    try {
      // Try avatar_profiles first (most common)
      const { data, error } = await supabase
        .from('avatar_profiles')
        .select('id')
        .eq('name', slug)
        .single();
      
      return data?.id || null;
    } catch {
      return null;
    }
  }

  /**
   * Get hot facts with caching for speed
   */
  private async getHotFactsFast(avatarId: string): Promise<QuickFact[]> {
    const cacheKey = `facts_${avatarId}`;
    const cached = FastPromptBuilder.factCache.get(cacheKey);
    
    // Return cached if fresh
    if (cached && Date.now() - cached.timestamp < FastPromptBuilder.CACHE_TTL) {
      return cached.facts;
    }

    // Single optimized query - only essential facts
    const { data, error } = await supabase
      .from('quick_facts')
      .select('key,value,priority')
      .eq('avatar_id', avatarId)
      .lte('priority', 4) // Only high-priority facts
      .gte('confidence', 0.5) // Only confident facts
      .order('priority')
      .limit(15); // Hard limit for speed

    if (error) {
      console.warn('Fast facts query failed:', error);
      return [];
    }

    const facts = (data || []).map(f => ({
      id: f.key, // Use key as ID for speed
      key: f.key,
      value: f.value,
      priority: f.priority,
      confidence: 1.0,
      source: 'fast',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })) as QuickFact[];

    // Cache for next request
    FastPromptBuilder.factCache.set(cacheKey, {
      facts,
      timestamp: Date.now()
    });

    return facts;
  }

  /**
   * Get relevant memories with minimal processing
   */
  private async getRelevantMemoriesFast(avatarId: string, query: string): Promise<any[]> {
    // Skip memory search for simple queries to save time
    const isSimpleQuery = query.length < 20 && !query.includes('?');
    if (isSimpleQuery) {
      return [];
    }

    try {
      // Single fast query - no complex similarity matching
      const { data, error } = await supabase
        .from('memory_fragments')
        .select('fragment_text')
        .eq('avatar_id', avatarId)
        .ilike('fragment_text', `%${query.split(' ')[0]}%`) // Just first word for speed
        .order('created_at', { ascending: false })
        .limit(3); // Very limited for speed

      return (data || []).map(m => ({
        fragment_text: m.fragment_text,
        similarity: 0.8
      }));
    } catch {
      return []; // Fail gracefully for speed
    }
  }

  /**
   * Build minimal but effective prompt
   */
  private buildMinimalPrompt(
    facts: QuickFact[],
    memories: any[],
    history: ConversationTurn[],
    query: string
  ): string {
    // Organize facts by priority for quick scanning
    const coreFacts = facts.filter(f => f.priority <= 2);
    const contextFacts = facts.filter(f => f.priority > 2);

    let prompt = `You are Jonathan. Be warm, natural, and conversational.

CORE IDENTITY:
${coreFacts.map(f => `- ${f.key.replace(/_/g, ' ')}: ${f.value}`).join('\n')}

CONTEXT:
${contextFacts.map(f => `- ${f.key.replace(/_/g, ' ')}: ${f.value}`).join('\n')}`;

    // Add conversation history if present (critical for context)
    if (history.length > 0) {
      const recentHistory = history.slice(-4); // Last 4 turns only
      prompt += `\n\nRECENT CONVERSATION:
${recentHistory.map(h => `${h.role === 'user' ? 'User' : 'You'}: ${h.content}`).join('\n')}

IMPORTANT: Use the above conversation for context. If they ask about "him/her/it", refer to what was just discussed.`;
    }

    // Add memories only if relevant and not too many
    if (memories.length > 0) {
      prompt += `\n\nRELEVANT MEMORIES:
${memories.slice(0, 2).map(m => `- ${m.fragment_text.substring(0, 150)}...`).join('\n')}`;
    }

    prompt += `\n\nRULES:
- Be natural and conversational with your personality
- Use conversation history for context and pronouns
- If you don't know something specific, say so naturally
- Never make up stories not in your memories`;

    return prompt;
  }

  /**
   * Clear cache (for development)
   */
  static clearCache(): void {
    FastPromptBuilder.factCache.clear();
  }
}