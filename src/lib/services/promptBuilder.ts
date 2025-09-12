import { supabase } from '@/lib/supabase';
import { PatternExtractor } from './patternExtractor';

export interface QuickFact {
  id: string;
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
  created_at: string;
  updated_at: string;
  category?: string;
}

export interface StyleProfile {
  speaking_style?: string;
  humor_style?: string;
  emotional_expression?: string;
  signature_phrases?: string;
}

export interface Memory {
  id: string;
  fragment_text: string;
  similarity?: number;
  created_at: string;
  // Optional structured fields when available via conversation_context
  title?: string;
  people?: string[];
  tags?: string[];
  gist?: string;
  start_date?: string; // ISO
  end_date?: string;   // ISO
  year?: number;       // convenience if only year available
}

export interface PromptContext {
  quick_facts: QuickFact[];
  style_profile: StyleProfile;
  relevant_memories: Memory[];
  conversation_history: ConversationTurn[];
  token_budget_remaining: number;
}

export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

/**
 * Enhanced prompt builder with fact injection for consistent avatar responses
 */
export class PromptBuilder {
  private static readonly DEFAULT_MEMORY_LIMIT = 8;
  private static readonly PERFORMANCE_TARGET_MS = 100;

  /**
   * Fetch quick facts with priority filtering and expiration handling
   * Optimized for sub-100ms retrieval performance
   */
  async fetchQuickFacts(
    avatarId: string,
    priorityFilter: number = 6
  ): Promise<QuickFact[]> {
    const startTime = Date.now();
    try {
      const nowIso = new Date().toISOString();
      let query = supabase
        .from('quick_facts')
        .select('id,key,value,confidence,priority,source,source_reference,date_context,created_at,updated_at')
        .eq('avatar_id', avatarId)
        .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
        .order('priority', { ascending: true })
        .order('confidence', { ascending: false })
        .order('updated_at', { ascending: false })
        .order('key', { ascending: true })
        .limit(24);
      if (typeof priorityFilter === 'number' && priorityFilter > 0) {
        query = query.lte('priority', Math.max(1, Math.min(priorityFilter, 10)));
      }
      const { data, error } = await query;
      if (error) {
        console.error('Error fetching quick facts:', error);
        throw new Error(`Failed to fetch quick facts: ${error.message}`);
      }

      const rows: any[] = Array.isArray(data) ? data : [];
      const filtered = rows.filter(r => !(typeof r.confidence === 'number' && r.confidence < 0.35));
      const result = filtered.map((fact: any) => ({
        id: fact.id,
        key: fact.key,
        value: fact.value,
        confidence: fact.confidence,
        priority: fact.priority,
        source: fact.source,
        source_reference: fact.source_reference,
        date_context: fact.date_context,
        created_at: fact.created_at,
        updated_at: fact.updated_at,
        category: this.categorizeFactKey(fact.key)
      })) as QuickFact[];

      const processingTime = Date.now() - startTime;
      if (processingTime > PromptBuilder.PERFORMANCE_TARGET_MS) {
        console.warn(`Quick facts retrieval took ${processingTime}ms, exceeding target of ${PromptBuilder.PERFORMANCE_TARGET_MS}ms`);
      }

      return result;
    } catch (error) {
      console.error('Error in fetchQuickFacts:', error);
      throw error;
    }
  }

  private categorizeFactKey(key: string): string | undefined {
    const k = (key || '').toLowerCase();
    if (['full_name','nickname','birth_date','birth_year','birthplace','birth_place'].includes(k)) return 'identity';
    if (k.startsWith('places_lived') || k.startsWith('moved_to') || ['hometown','settled_location','current_city','current_location'].includes(k)) return 'places_lived';
    if (k.includes('father') || k.includes('mother') || k.includes('parent') || k.includes('partner')) return 'relationships';
    if (k.startsWith('pet') || ['dog','cat','pets_current','pet_name','pet_type'].includes(k)) return 'pets';
    if (k.startsWith('service') || k.includes('unit') || k.includes('branch') || k.includes('role')) return 'service';
    if (k.startsWith('hobby') || k === 'hobbies') return 'hobbies';
    if (k.startsWith('favorite') || k.includes('favorite')) return 'favorites';
    return undefined;
  }

  /**
   * Fetch speaking style and personality traits for prompt building
   */
  async fetchStyleProfile(avatarId: string): Promise<StyleProfile> {
    const startTime = Date.now();
    
    try {
      const { data, error } = await supabase
        .rpc('fetch_style_profile', {
          in_avatar_id: avatarId
        });

      if (error) {
        console.error('Error fetching style profile:', error);
        throw new Error(`Failed to fetch style profile: ${error.message}`);
      }

      const processingTime = Date.now() - startTime;
      if (processingTime > PromptBuilder.PERFORMANCE_TARGET_MS) {
        console.warn(`Style profile retrieval took ${processingTime}ms, exceeding target of ${PromptBuilder.PERFORMANCE_TARGET_MS}ms`);
      }

      const profile = data?.[0] || {};
      return {
        speaking_style: profile.speaking_style,
        humor_style: profile.humor_style,
        emotional_expression: profile.emotional_expression,
        signature_phrases: profile.signature_phrases
      };
    } catch (error) {
      console.error('Error in fetchStyleProfile:', error);
      // Return empty profile on error to allow graceful degradation
      return {};
    }
  }

  /**
   * Fetch relevant memories with enhanced hybrid search and avatar scope
   */
  async fetchRelevantMemories(
    avatarId: string, 
    query: string, 
    limit: number = 64 // Increased from 8 to 64 for better coverage
  ): Promise<Memory[]> {
    try {
      console.log('[PromptBuilder] Fetching memories for avatar:', avatarId, 'query:', query.substring(0, 30));
      
      // Use enhanced database function for hybrid search
      const { data, error } = await supabase.rpc('get_enhanced_memories', {
        target_user_id: null, // Don't filter by user for avatar-scoped queries
        target_avatar_id: avatarId,
        search_query: query,
        match_count: limit,
        similarity_threshold: 0.6,
        include_bio_facts: true // Always include bio facts for profile questions
      });

      if (error) {
        console.error('Error fetching enhanced memories:', error);
        return this.fallbackMemorySearch(avatarId, query, limit);
      }

      if (!data || !Array.isArray(data)) {
        console.log('[PromptBuilder] No data returned from enhanced memory search');
        return [];
      }

      console.log('[PromptBuilder] Enhanced search returned', data.length, 'memories');
      
      return data.map((memory: any) => {
        const ctx = memory.conversation_context || {};
        return {
          id: memory.id,
          fragment_text: memory.fragment_text,
          similarity: memory.similarity_score || 0.8,
          created_at: memory.created_at,
          title: ctx.title || undefined,
          people: Array.isArray(ctx.people) ? ctx.people : undefined,
          tags: Array.isArray(ctx.tags) ? ctx.tags : undefined,
          gist: (ctx.gist || memory.fragment_text || '').slice(0, 200),
          start_date: ctx.start_date || undefined,
          end_date: ctx.end_date || undefined,
          year: ctx.year || (ctx.date && ctx.date.year) || undefined
        } as Memory;
      });
    } catch (error) {
      console.error('Error in fetchRelevantMemories:', error);
      return this.fallbackMemorySearch(avatarId, query, limit);
    }
  }

  /**
   * Fallback memory search using simple ILIKE queries
   */
  private async fallbackMemorySearch(
    avatarId: string,
    query: string,
    limit: number
  ): Promise<Memory[]> {
    try {
      console.log('[PromptBuilder] Using fallback memory search for:', query.substring(0, 30));
      
      const queryLower = (query || '').toLowerCase();
      
      // Detect specific query types for better search
      const isDogQuery = /\b(dog|dogs|pet|pets|bucky|george|olive|romeo)\b/i.test(queryLower);
      const isMusicQuery = /\b(music|favorite|band|artist|nirvana)\b/i.test(queryLower);
      const isCountQuery = /\b(how many|count|number of)\b/i.test(queryLower);
      
      let searchTerms: string[] = [];
      
      if (isDogQuery || isCountQuery) {
        // For dog/count queries, search for all dog-related terms
        searchTerms = ['dog', 'dogs', 'pet', 'pets', 'bucky', 'george', 'olive', 'romeo', 'poodle'];
      } else if (isMusicQuery) {
        // For music queries, search for music-related terms
        searchTerms = ['music', 'favorite', 'band', 'artist', 'nirvana', 'song', 'listen'];
      } else {
        // General query - extract key words
        const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        searchTerms = words.slice(0, 3); // Use first 3 meaningful words
      }
      
      // Build OR conditions for each search term
      const orConditions = searchTerms.map(term => `fragment_text.ilike.%${term}%`);
      
      const { data, error } = await supabase
        .from('memory_fragments')
        .select('id, fragment_text, created_at, conversation_context, user_id')
        .eq('avatar_id', avatarId)
        .or(orConditions.join(','))
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error in fallback memory search:', error);
        return [];
      }

      return (data || []).map((memory: any) => {
        const ctx = memory.conversation_context || {};
        const gistBase = ctx.gist || memory.fragment_text || '';
        return {
          id: memory.id,
          fragment_text: memory.fragment_text,
          similarity: 0.8,
          created_at: memory.created_at,
          title: ctx.title || undefined,
          people: Array.isArray(ctx.people) ? ctx.people : undefined,
          tags: Array.isArray(ctx.tags) ? ctx.tags : undefined,
          gist: gistBase.slice(0, 200),
          start_date: ctx.start_date || undefined,
          end_date: ctx.end_date || undefined,
          year: ctx.year || (ctx.date && ctx.date.year) || undefined
        } as Memory;
      });
    } catch (error) {
      console.error('Error in fallback memory search:', error);
      return [];
    }
  }

  /**
   * Get avatar ID from slug for internal operations
   */
  private async getAvatarIdFromSlug(slug: string): Promise<string | null> {
    try {
      // Prefer avatar_profiles.name as canonical identifier
      const { data: prof, error: profErr } = await supabase
        .from('avatar_profiles')
        .select('id')
        .eq('name', slug)
        .single();
      if (!profErr && prof?.id) return prof.id as string;

      // Fallback to avatars.slug if present in some deployments
      const { data, error } = await supabase
        .from('avatars')
        .select('id')
        .eq('slug', slug)
        .single();
      if (!error && data?.id) return data.id as string;

      console.error('Error fetching avatar by slug:', profErr || error);
      return null;
    } catch (error) {
      console.error('Error in getAvatarIdFromSlug:', error);
      return null;
    }
  }

  /**
   * Get avatar slug from id to support RPCs that key by slug
   */
  private async getAvatarSlugById(avatarId: string): Promise<string | null> {
    try {
      // Prefer avatar_profiles.name as slug
      const { data: prof, error: profErr } = await supabase
        .from('avatar_profiles')
        .select('name')
        .eq('id', avatarId)
        .single();
      if (!profErr && prof?.name) return prof.name as string;

      // Fallback to avatars.slug
      const { data, error } = await supabase
        .from('avatars')
        .select('slug')
        .eq('id', avatarId)
        .single();
      if (!error && data?.slug) return data.slug as string;
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Build succinct prompt with four sections per spec.
   */
  async buildPrompt(args: {
    avatarId: string;
    conversationSnippet: string;
    userQuery: string;
    maxFacts?: number;
    memoryLimit?: number;
  }): Promise<string> {
    const { avatarId, conversationSnippet, userQuery } = args;
    const maxFacts = Math.max(1, args.maxFacts ?? 10);
    const memoryLimit = Math.max(1, args.memoryLimit ?? 6);

    const [facts, style, memories] = await Promise.all([
      // Priority filter up to include everything; we will cap and sort client-side
      this.fetchQuickFacts(avatarId, 10),
      this.fetchStyleProfile(avatarId),
      this.fetchRelevantMemories(avatarId, userQuery, memoryLimit)
    ]);

    // Derive ephemeral facts from top memories if key categories missing
    const factKeys = new Set(facts.map(f => f.key));
    const needsFamilyOrPetsOrService = !(
      ['family_parents','partner_name','family_children','family_siblings','pet','service_unit_text','service_role'].some(k => factKeys.has(k))
    );
    let derivedFacts: QuickFact[] = [];
    let derivedFragmentIds: string[] = [];
    if (needsFamilyOrPetsOrService && memories && memories.length > 0) {
      const extractor = new PatternExtractor();
      const top = memories.slice(0, Math.min(6, memories.length));
      for (const mem of top) {
        const res = extractor.extractFacts(mem.fragment_text || '');
        const toAdd = res.facts.filter(f => ['pet','service_unit_text','service_role','service_branch','hometown','settled_location','family_father_role','family_mother_role','family_parents','partner_name','family_children','family_siblings'].includes(f.key));
        if (toAdd.length > 0) {
          derivedFragmentIds.push(mem.id);
        }
        derivedFacts.push(...toAdd.map(f => ({
          id: `${mem.id}:${f.key}`,
          key: f.key,
          value: `${f.value} [derived]`,
          confidence: Math.min(0.79, f.confidence),
          priority: 2,
          source: 'derived',
          source_reference: '[derived]',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })));
      }
      // Per UX spec: keep [derived] facts prompt-only; do not persist or enqueue for promotion
    }

    // Sort facts deterministically: priority ASC, confidence DESC, updated_at DESC, key ASC
    const sortedFacts = [...facts, ...derivedFacts].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      if ((a.confidence ?? 0) !== (b.confidence ?? 0)) return (b.confidence ?? 0) - (a.confidence ?? 0);
      const aUpd = new Date(a.updated_at).getTime();
      const bUpd = new Date(b.updated_at).getTime();
      if (aUpd !== bUpd) return bUpd - aUpd;
      return (a.key || '').localeCompare(b.key || '');
    }).slice(0, maxFacts);

    const coreIdentity = sortedFacts
      .map(f => `- ${this.formatFactKey(f.key)}: ${f.value}${f.source_reference ? ` (${f.source_reference})` : ''}`)
      .join('\n') || 'No specific facts available yet.';

    const styleLines: string[] = [];
    if (style.speaking_style) styleLines.push(`- Tone: ${style.speaking_style}`);
    if (style.humor_style) styleLines.push(`- Humor: ${style.humor_style}`);
    if (style.emotional_expression) styleLines.push(`- Emotional Expression: ${style.emotional_expression}`);
    if (style.signature_phrases) styleLines.push(`- Signature Phrases: ${style.signature_phrases}`);
    // Boundaries rules
    styleLines.push(`- Missing info: If a specific fact (date/place/name) isn’t present, say "I don't have that yet" or ask a gentle clarifier.`);
    styleLines.push(`- Consistency: If the user’s claim conflicts with quick_facts, ask a clarifying question before updating.`);
    styleLines.push(`- Small talk: For greetings or check-ins, respond naturally and warmly.`);
    // Small-talk and missing info rules per spec
    if (!styleLines.find(l => l.toLowerCase().includes('small talk'))) {
      styleLines.push(`- Small talk: For greetings or check-ins (‘how’s it going?’), respond naturally and warmly—do not say ‘I don’t have that yet.’`);
    }
    if (!styleLines.find(l => l.toLowerCase().includes('missing info'))) {
      styleLines.push(`- Missing info: If specific facts (date/place/name) are missing, ask a gentle clarifying question or say ‘I don’t have that yet’—but only when the user requested specifics.`);
    }
    const styleSection = styleLines.join('\n');

    const memoriesSectionRaw = (memories || []).slice(0, memoryLimit).map(m => {
      const parts: string[] = [];
      const title = m.title || (m.fragment_text || '').split(/\s+/).slice(0, 8).join(' ');
      const dateSpan = this.formatMemoryDate(m);
      const peopleList = Array.isArray(m.people) ? m.people.filter(Boolean) : [];
      const tagsList = Array.isArray(m.tags) ? m.tags.filter(Boolean) : [];
      const people = peopleList.length ? `People: ${peopleList.join(', ')}` : '';
      const tags = tagsList.length ? `Tags: ${tagsList.join(', ')}` : '';
      const gist = (m.gist || m.fragment_text || '').slice(0, 200);
      parts.push(`- ${title}${dateSpan ? ` [${dateSpan}]` : ''}`);
      if (people) parts.push(`  ${people}`);
      if (tags) parts.push(`  ${tags}`);
      parts.push(`  Gist: ${gist}`);
      return parts.join('\n');
    }).join('\n');
    const memoriesSection = this.capSection(memoriesSectionRaw, 2500);

    const conversationBlock = conversationSnippet?.trim() ? conversationSnippet.trim() : '(no prior context)';

    return [
      'Core Identity:',
      this.capSection(coreIdentity, 1500),
      '',
      'Style & Boundaries:',
      styleSection,
      '',
      memories.length ? 'Relevant Memories:' : 'Relevant Memories: (none found)',
      memoriesSection,
      '',
      'Conversation So Far:',
      conversationBlock
    ].join('\n');
  }

  private formatMemoryDate(m: Memory): string | null {
    if (m.start_date || m.end_date) {
      const start = m.start_date ? new Date(m.start_date) : null;
      const end = m.end_date ? new Date(m.end_date) : null;
      if (start && end) {
        const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
        return sameYear
          ? `${start.getUTCFullYear()}`
          : `${start.getUTCFullYear()}–${end.getUTCFullYear()}`;
      }
      if (start) return `${start.getUTCFullYear()}`;
      if (end) return `${end.getUTCFullYear()}`;
    }
    if (m.year) return String(m.year);
    return null;
  }

  /**
   * Build complete context for prompt generation
   */
  async buildPromptContext(
    avatarSlug: string,
    query: string,
    conversationHistory: ConversationTurn[] = [],
    priorityFilter: number = 10,
    memoryLimit: number = PromptBuilder.DEFAULT_MEMORY_LIMIT
  ): Promise<PromptContext> {
    const avatarId = await this.getAvatarIdFromSlug(avatarSlug);
    if (!avatarId) {
      throw new Error(`Avatar not found: ${avatarSlug}`);
    }

    // Fetch all context in parallel for performance
    const [quickFacts, styleProfile, relevantMemories] = await Promise.all([
      this.fetchQuickFacts(avatarId, priorityFilter),
      this.fetchStyleProfile(avatarId),
      this.fetchRelevantMemories(avatarId, query, memoryLimit)
    ]);

    // Calculate remaining token budget (simplified estimation)
    const estimatedTokens = this.estimateTokenUsage(quickFacts, styleProfile, relevantMemories, conversationHistory);
    const tokenBudgetRemaining = Math.max(0, 4000 - estimatedTokens); // Assuming 4K context limit

    return {
      quick_facts: quickFacts,
      style_profile: styleProfile,
      relevant_memories: relevantMemories,
      conversation_history: conversationHistory,
      token_budget_remaining: tokenBudgetRemaining
    };
  }

  /**
   * Build complete system prompt with structured fact injection and basic guardrails
   */
  async buildSystemPrompt(
    avatarSlug: string,
    query: string,
    conversationHistory: ConversationTurn[] = [],
    priorityFilter: number = 10,
    memoryLimit: number = PromptBuilder.DEFAULT_MEMORY_LIMIT
  ): Promise<string> {
    const context = await this.buildPromptContext(
      avatarSlug,
      query,
      conversationHistory,
      priorityFilter,
      memoryLimit
    );

    // Add basic fact gap logging
    this.logFactGaps(query, context.quick_facts, context.relevant_memories);

    return this.formatStructuredPrompt(context, query);
  }

  /**
   * Build system prompt with enhanced validation and monitoring
   * This is the main entry point for structured prompt building
   */
  async buildEnhancedSystemPrompt(
    avatarSlug: string,
    query: string,
    conversationHistory: ConversationTurn[] = [],
    options: {
      priorityFilter?: number;
      memoryLimit?: number;
      includeValidation?: boolean;
      includeSourceReferences?: boolean;
      enforceTokenBudget?: boolean;
    } = {}
  ): Promise<{
    prompt: string;
    metadata: {
      facts_count: number;
      memories_count: number;
      conversation_turns: number;
      estimated_tokens: number;
      processing_time_ms: number;
      warnings: string[];
    };
  }> {
    const startTime = Date.now();
    const {
      priorityFilter = 10,
      memoryLimit = PromptBuilder.DEFAULT_MEMORY_LIMIT,
      enforceTokenBudget = true
    } = options;

    try {
      // Build context with all components
      const context = await this.buildPromptContext(
        avatarSlug,
        query,
        conversationHistory,
        priorityFilter,
        memoryLimit
      );

      // Apply token budget enforcement if requested
      let finalContext = context;
      if (enforceTokenBudget && context.token_budget_remaining < 500) {
        // Reduce memory limit if token budget is low
        const reducedMemoryLimit = Math.max(3, Math.floor(memoryLimit / 2));
        finalContext = {
          ...context,
          relevant_memories: context.relevant_memories.slice(0, reducedMemoryLimit)
        };
      }

      // Generate structured prompt
      const prompt = this.formatStructuredPrompt(finalContext, query);

      // Collect warnings
      const warnings: string[] = [];
      if (finalContext.quick_facts.length === 0) {
        warnings.push('No quick facts available - responses may lack grounding');
      }
      if (finalContext.relevant_memories.length === 0) {
        warnings.push('No relevant memories found - responses may lack context');
      }
      if (context.token_budget_remaining < 500) {
        warnings.push('Low token budget - some content may be truncated');
      }

      // Log fact gaps for monitoring
      this.logFactGaps(query, finalContext.quick_facts, finalContext.relevant_memories);

      const processingTime = Date.now() - startTime;

      return {
        prompt,
        metadata: {
          facts_count: finalContext.quick_facts.length,
          memories_count: finalContext.relevant_memories.length,
          conversation_turns: finalContext.conversation_history.length,
          estimated_tokens: this.estimateTokenUsage(
            finalContext.quick_facts,
            finalContext.style_profile,
            finalContext.relevant_memories,
            finalContext.conversation_history
          ),
          processing_time_ms: processingTime,
          warnings
        }
      };
    } catch (error) {
      console.error('Error building enhanced system prompt:', error);
      
      // Fallback to basic prompt
      const fallbackPrompt = `You are an avatar assistant. I don't have detailed information about you yet.

QUERY: ${query}

Please respond helpfully while acknowledging that you have limited information about yourself. 
Encourage the user to share more details about you so you can provide better responses in the future.`;

      return {
        prompt: fallbackPrompt,
        metadata: {
          facts_count: 0,
          memories_count: 0,
          conversation_turns: conversationHistory.length,
          estimated_tokens: Math.ceil(fallbackPrompt.length / 4),
          processing_time_ms: Date.now() - startTime,
          warnings: ['Failed to build structured prompt - using fallback']
        }
      };
    }
  }

  /**
   * Get pinned memories for political/opinion queries with filtering and boosting
   */
  private getPinnedMemoriesForPolitical(memories: Memory[]): Memory[] {
    // Filter candidates by context type or Trump content
    const candidates = memories.filter(memory => {
      const ctx = memory.conversation_context || {};
      const text = memory.fragment_text.toLowerCase();
      
      // Include if context type is opinion or language_style
      if (ctx.type === 'opinion' || ctx.type === 'language_style') {
        return true;
      }
      
      // Include if fragment contains Trump content
      if (text.includes('trump')) {
        return true;
      }
      
      // Include if context contains politics
      if (ctx.context && ctx.context.includes('politics')) {
        return true;
      }
      
      return false;
    });
    
    // Boost scores for political content
    const boostedCandidates = candidates.map(memory => {
      const ctx = memory.conversation_context || {};
      let boost = 0;
      
      // +0.4 boost for opinion context or politics context
      if (ctx.type === 'opinion' || (ctx.context && ctx.context.includes('politics'))) {
        boost = 0.4;
      }
      
      return {
        ...memory,
        similarity: Math.min(1.0, (memory.similarity || 0.8) + boost)
      };
    });
    
    // Sort by boosted similarity and return top 3
    return boostedCandidates
      .sort((a, b) => (b.similarity || 0) - (a.similarity || 0))
      .slice(0, 3);
  }

  /**
   * Format structured prompt with priority-based organization
   */
  private formatStructuredPrompt(context: PromptContext, query: string): string {
    const { quick_facts, style_profile, relevant_memories, conversation_history } = context;

    // Organize facts by priority
    // Curate core identity facts beyond priority-only
    const coreIdentityFacts = this.buildCoreIdentityFacts(quick_facts);
    const lifeContextFacts = quick_facts.filter(f => f.priority >= 3 && f.priority <= 5);
    const triviaFacts = quick_facts.filter(f => f.priority > 5);

    let prompt = `You are the avatar below. Follow the facts exactly; don't contradict them.

CORE IDENTITY & STYLE (Priority 1-2 Facts):
${this.formatFactsSection(coreIdentityFacts)}

SPEAKING STYLE:
${this.formatStyleSection(style_profile)}

IDENTITY RULES:
- If a fact is not present, say "I don't have that yet" rather than guessing
- Maintain absolute consistency with established facts
- Reference source when appropriate: "As I mentioned in my journal..."
- Never contradict information from CORE IDENTITY or LIFE CONTEXT sections

LIFE CONTEXT (Priority 3-5 Facts):
${this.formatFactsSection(lifeContextFacts)}`;

    // Add memories if available and within token budget
    if (relevant_memories.length > 0) {
      // Check if this is a political/opinion query for pinned memories
      const isPoliticalQuery = /\b(trump|biden|election|politic|america|immigration|emigration|policy|vote)\b/i.test(query);
      const isOpinionQuery = /\b(think|opinion|feel|believe|view)\b/i.test(query);
      
      if (isPoliticalQuery || isOpinionQuery) {
        // Filter and boost pinned memories for political/opinion queries
        const pinnedMemories = this.getPinnedMemoriesForPolitical(relevant_memories);
        console.log('pinned_memories_count', pinnedMemories.length);
        console.log('pinned_ids', pinnedMemories.map(m => m.id.substring(0, 8)));
        
        if (pinnedMemories.length > 0) {
          prompt += `

PINNED MEMORIES (high-confidence):
${this.formatMemoriesSection(pinnedMemories)}

RELEVANT MEMORIES (top-${relevant_memories.length} by relevance):
${this.formatMemoriesSection(relevant_memories)}`;
        } else {
          prompt += `

RELEVANT MEMORIES (top-${relevant_memories.length} by relevance):
${this.formatMemoriesSection(relevant_memories)}`;
        }
      } else {
        prompt += `

RELEVANT MEMORIES (top-${relevant_memories.length} by relevance):
${this.formatMemoriesSection(relevant_memories)}`;
      }
    }

    // Add conversation history if available
    if (conversation_history.length > 0) {
      prompt += `

RECENT CONVERSATION:
${this.formatConversationSection(conversation_history)}`;
    }

    // Add trivia facts if there's room in token budget
    if (triviaFacts.length > 0 && context.token_budget_remaining > 500) {
      prompt += `

ADDITIONAL CONTEXT (Lower Priority):
${this.formatFactsSection(triviaFacts)}`;
    }

    return prompt;
  }

  private buildCoreIdentityFacts(facts: QuickFact[]): QuickFact[] {
    const byKey = new Map<string, QuickFact>();
    for (const f of facts) if (!byKey.has(f.key)) byKey.set(f.key, f);

    const pick = (keys: string[] | ((k: string) => boolean), limit?: number): QuickFact[] => {
      const arr: QuickFact[] = [];
      const keysList = typeof keys === 'function' ? facts.map(f => f.key).filter(keys) : keys;
      for (const k of keysList) {
        const f = byKey.get(k);
        if (f) arr.push(f);
        if (typeof limit === 'number' && arr.length >= limit) break;
      }
      return arr;
    };

    const selected: QuickFact[] = [];
    selected.push(...pick(['full_name','nickname']));
    selected.push(...pick(['birth_date','birth_year','birthplace','birth_place']));
    // Places lived - first two highlights
    const placeKeys = facts.map(f => f.key).filter(k => k.startsWith('places_lived_')).sort((a,b) => a.localeCompare(b));
    selected.push(...pick(placeKeys, 2));
    // Family / Partner
    selected.push(...pick(['partner_name','father_name','mother_name','family_parents'], 3));
    // Pets
    const petKeys = facts.map(f => f.key).filter(k => k === 'pet_name' || k === 'pets_current' || k === 'pet_type' || k === 'dog' || k === 'cat');
    selected.push(...pick(petKeys, 2));
    // One hobby/favorite
    const hobbyKey = facts.find(f => f.key === 'hobbies' || f.key.startsWith('hobby_'))?.key;
    if (hobbyKey) selected.push(byKey.get(hobbyKey)!);
    const favoriteKey = facts.find(f => f.key.startsWith('favorite_'))?.key;
    if (favoriteKey) selected.push(byKey.get(favoriteKey)!);

    // Also include any P1 facts not already included
    const p1 = facts.filter(f => f.priority <= 2 && !selected.find(s => s.key === f.key));
    selected.push(...p1);

    // Dedup by key, preserve order
    const seen = new Set<string>();
    const dedup = selected.filter(f => (seen.has(f.key) ? false : (seen.add(f.key), true)));
    return dedup;
  }

  /**
   * Format facts section with source references
   */
  private formatFactsSection(facts: QuickFact[]): string {
    if (facts.length === 0) {
      return "No specific facts available yet.";
    }

    return facts
      .sort((a, b) => {
        // Deterministic ordering:
        // 1) priority ASC, 2) confidence DESC, 3) updated_at DESC, 4) key ASC
        if (a.priority !== b.priority) return a.priority - b.priority;
        if (a.confidence !== b.confidence) return (b.confidence ?? 0) - (a.confidence ?? 0);
        const aUpd = new Date(a.updated_at).getTime();
        const bUpd = new Date(b.updated_at).getTime();
        if (aUpd !== bUpd) return bUpd - aUpd;
        return (a.key || '').localeCompare(b.key || '');
      })
      .map(fact => {
        let line = `- ${this.formatFactKey(fact.key)}: ${fact.value}`;
        
        // Add source reference if available
        if (fact.source_reference) {
          line += ` (${fact.source_reference})`;
        }
        
        // Add date context if available
        if (fact.date_context) {
          const dateStr = this.formatDateContext(fact.date_context);
          if (dateStr) line += ` [${dateStr}]`;
        }
        
        return line;
      })
      .join('\n');
  }

  /**
   * Format style profile section
   */
  private formatStyleSection(style: StyleProfile): string {
    const sections = [];
    
    if (style.speaking_style) {
      sections.push(`- Tone: ${style.speaking_style}`);
    }
    
    if (style.humor_style) {
      sections.push(`- Humor: ${style.humor_style}`);
    }
    
    if (style.emotional_expression) {
      sections.push(`- Emotional Expression: ${style.emotional_expression}`);
    }
    
    if (style.signature_phrases) {
      sections.push(`- Signature Phrases: ${style.signature_phrases}`);
    }
    
    // Add boundaries and small-talk guidance if not already added upstream
    sections.push(`- Small talk: For greetings or check-ins (‘how’s it going?’), respond naturally and warmly—do not say ‘I don’t have that yet.’`);
    sections.push(`- Missing info: If specific facts (date/place/name) are missing, ask a gentle clarifying question or say ‘I don’t have that yet’—but only when the user requested specifics.`);
    
    return sections.length > 0 ? sections.join('\n') : "No specific style profile available yet.";
  }

  /**
   * Format memories section with relevance scores
   */
  private formatMemoriesSection(memories: Memory[]): string {
    return memories
      .slice(0, PromptBuilder.DEFAULT_MEMORY_LIMIT) // Enforce memory limit
      .map((memory, index) => {
        let line = `${index + 1}. ${memory.fragment_text}`;
        
        if (memory.similarity) {
          line += ` (relevance: ${Math.round(memory.similarity * 100)}%)`;
        }
        
        return line;
      })
      .join('\n');
  }

  /**
   * Format conversation history section
   */
  private formatConversationSection(history: ConversationTurn[]): string {
    // Limit conversation history to the last 8 turns per spec (6–10 range)
    const recentHistory = history.slice(-8);
    
    return recentHistory
      .map(turn => `${turn.role.toUpperCase()}: ${turn.content}`)
      .join('\n');
  }

  /**
   * Caps a section by characters, trimming at last whitespace and appending ellipsis when truncated
   */
  private capSection(input: string, maxChars: number = 2500): string {
    if (!input) return input;
    if (input.length <= maxChars) return input;
    const slice = input.slice(0, maxChars);
    const lastWs = slice.lastIndexOf(' ');
    const trimmed = lastWs > 200 ? slice.slice(0, lastWs) : slice; // avoid trimming to nothing if no ws
    return `${trimmed}\u2026`;
  }

  /**
   * Format fact key for human readability
   */
  private formatFactKey(key: string): string {
    // Convert snake_case to human readable format
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .replace(/^(\w)/, l => l.toUpperCase());
  }

  /**
   * Format date context for display
   */
  private formatDateContext(dateContext: { year?: number; month?: number; day?: number }): string {
    const parts = [];
    
    if (dateContext.year) {
      parts.push(dateContext.year.toString());
    }
    
    if (dateContext.month) {
      const monthNames = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      parts.unshift(monthNames[dateContext.month - 1]);
    }
    
    if (dateContext.day) {
      parts.splice(1, 0, dateContext.day.toString());
    }
    
    return parts.join(' ');
  }

  /**
   * Validate fact consistency and detect potential contradictions
   */
  async validateFactConsistency(
    avatarId: string,
    newFacts: QuickFact[]
  ): Promise<{ isValid: boolean; contradictions: string[]; warnings: string[] }> {
    const existingFacts = await this.fetchQuickFacts(avatarId, 10);
    const contradictions: string[] = [];
    const warnings: string[] = [];

    // Check for direct contradictions
    for (const newFact of newFacts) {
      const existingFact = existingFacts.find(f => f.key === newFact.key);
      
      if (existingFact && existingFact.value !== newFact.value) {
        // Check if this is a legitimate update vs contradiction
        if (this.isLegitimateUpdate(existingFact, newFact)) {
          warnings.push(`Updating ${newFact.key} from "${existingFact.value}" to "${newFact.value}"`);
        } else {
          contradictions.push(`Contradiction detected for ${newFact.key}: existing "${existingFact.value}" vs new "${newFact.value}"`);
        }
      }
    }

    // Check for logical inconsistencies
    const allFacts = [...existingFacts, ...newFacts];
    const logicalIssues = this.detectLogicalInconsistencies(allFacts);
    contradictions.push(...logicalIssues);

    // Log validation results
    if (contradictions.length > 0 || warnings.length > 0) {
      console.log(`[PromptBuilder] Fact validation for avatar ${avatarId}`);
      console.log(`[PromptBuilder] Contradictions: ${contradictions.length}, Warnings: ${warnings.length}`);
      console.log(`[PromptBuilder] New facts being validated: ${newFacts.map(f => f.key).join(', ')}`);
    }

    return {
      isValid: contradictions.length === 0,
      contradictions,
      warnings
    };
  }

  /**
   * Check if a fact update is legitimate (e.g., current_city can change)
   */
  private isLegitimateUpdate(existingFact: QuickFact, newFact: QuickFact): boolean {
    // Facts that can legitimately change over time
    const updatableFacts = [
      'current_city',
      'current_job',
      'pets_current',
      'partner_name',
      'hobbies',
      'signature_phrases'
    ];

    // Also consider confidence levels - higher confidence facts can override lower confidence ones
    const confidenceImprovement = newFact.confidence > existingFact.confidence;
    
    return updatableFacts.includes(existingFact.key) || confidenceImprovement;
  }

  /**
   * Detect logical inconsistencies between facts
   */
  private detectLogicalInconsistencies(facts: QuickFact[]): string[] {
    const issues: string[] = [];
    const factMap = new Map<string, string>();
    
    facts.forEach(fact => factMap.set(fact.key, fact.value));

    // Check birth year consistency
    const birthYear = factMap.get('birth_year');
    if (birthYear) {
      const year = parseInt(birthYear);
      if (year < 1900 || year > new Date().getFullYear()) {
        issues.push(`Invalid birth year: ${birthYear}`);
      }
    }

    // Check move dates vs birth year
    const moveEntries = Array.from(factMap.entries()).filter(([key]) => key.startsWith('moved_to_'));
    if (birthYear) {
      const birthYearNum = parseInt(birthYear);
      moveEntries.forEach(([key, value]) => {
        const yearMatch = key.match(/year_(\d{4})/);
        if (yearMatch) {
          const moveYear = parseInt(yearMatch[1]);
          if (moveYear < birthYearNum) {
            issues.push(`Move year ${moveYear} is before birth year ${birthYearNum}`);
          }
        }
      });
    }

    return issues;
  }

  /**
   * Generate "I don't have that yet" response for missing information with enhanced specificity
   */
  generateMissingInfoResponse(query: string, availableFacts: QuickFact[]): string {
    const factKeys = new Set(availableFacts.map(f => f.key));
    const queryLower = query.toLowerCase();
    
    // Log the missing information request
    console.log(`[PromptBuilder] Generating missing info response for query: "${query.substring(0, 50)}..."`);
    console.log(`[PromptBuilder] Available fact keys: ${Array.from(factKeys).join(', ') || 'none'}`);
    
    // Specific responses for different information categories
    const responses = {
      birth_info: () => {
        const missing = [];
        if (!factKeys.has('birth_year')) missing.push('when I was born');
        if (!factKeys.has('birthplace')) missing.push('where I was born');
        
        if (missing.length > 0) {
          return `I don't have information about ${missing.join(' or ')} yet. Feel free to share those details with me!`;
        }
        return null;
      },
      
      family_info: () => {
        const familyFacts = ['family_parents', 'partner_name', 'children'];
        const hasFamilyInfo = familyFacts.some(fact => factKeys.has(fact));
        
        if (!hasFamilyInfo) {
          return "I don't have information about my family yet. You can tell me about my parents, siblings, or other family members if you'd like!";
        }
        return null;
      },
      
      work_info: () => {
        const workFacts = ['current_job', 'education'];
        const hasWorkInfo = workFacts.some(fact => factKeys.has(fact));
        
        if (!hasWorkInfo) {
          return "I don't have information about my current job or career yet. What would you like me to know about my work or education?";
        }
        return null;
      },
      
      location_info: () => {
        const locationFacts = ['current_city', 'birthplace', 'grew_up'];
        const hasLocationInfo = locationFacts.some(fact => factKeys.has(fact));
        
        if (!hasLocationInfo) {
          return "I don't have information about where I live or where I'm from yet. You can tell me about my location!";
        }
        return null;
      },
      
      interests_info: () => {
        const interestFacts = ['hobbies', 'languages', 'signature_style'];
        const hasInterestInfo = interestFacts.some(fact => factKeys.has(fact));
        
        if (!hasInterestInfo) {
          return "I don't have information about my hobbies or interests yet. What would you like me to know about what I enjoy doing?";
        }
        return null;
      },
      
      personal_details: () => {
        const personalFacts = ['full_name', 'birth_year', 'birthplace'];
        const hasPersonalInfo = personalFacts.some(fact => factKeys.has(fact));
        
        if (!hasPersonalInfo) {
          return "I don't have basic information about myself yet. Feel free to share details about who I am!";
        }
        return null;
      }
    };
    
    // Check for specific information types based on query content
    const queryChecks = [
      { keywords: ['born', 'birth', 'age', 'old'], handler: responses.birth_info },
      { keywords: ['family', 'parent', 'mom', 'dad', 'mother', 'father', 'wife', 'husband', 'partner', 'child'], handler: responses.family_info },
      { keywords: ['job', 'work', 'career', 'profession', 'company', 'office'], handler: responses.work_info },
      { keywords: ['live', 'city', 'where', 'place', 'location', 'from'], handler: responses.location_info },
      { keywords: ['hobby', 'like', 'enjoy', 'interest', 'language', 'speak', 'do for fun'], handler: responses.interests_info },
      { keywords: ['name', 'who are you', 'tell me about yourself'], handler: responses.personal_details }
    ];
    
    // Find the most specific response
    for (const { keywords, handler } of queryChecks) {
      if (keywords.some(keyword => queryLower.includes(keyword))) {
        const response = handler();
        if (response) {
          console.log(`[PromptBuilder] Using specific missing info response for category`);
          return response;
        }
      }
    }
    
    // Enhanced generic response with encouragement
    const genericResponses = [
      "I don't have that information yet. Feel free to share more details about me, and I'll remember them for next time!",
      "I don't have details about that yet. You can help me learn by sharing more about myself!",
      "That's not something I know about myself yet. I'd love to learn more if you'd like to share!",
      "I don't have that information available right now. Feel free to tell me more about that aspect of myself!"
    ];
    
    // Use a consistent but varied response
    const responseIndex = query.length % genericResponses.length;
    const selectedResponse = genericResponses[responseIndex];
    
    console.log(`[PromptBuilder] Using generic missing info response`);
    return selectedResponse;
  }

  /**
   * Log fact gaps and potential hallucination attempts with enhanced detail
   */
  logFactGaps(query: string, availableFacts: QuickFact[], memoryResults: Memory[]): void {
    const factKeys = new Set(availableFacts.map(f => f.key));
    const queryLower = query.toLowerCase();
    
    // Enhanced fact categories with priority levels
    const factCategories = {
      core_identity: {
        facts: ['full_name', 'birth_year', 'birthplace'],
        priority: 'critical',
        keywords: ['name', 'born', 'birth', 'age', 'who are you']
      },
      location: {
        facts: ['current_city', 'birthplace', 'grew_up'],
        priority: 'high',
        keywords: ['live', 'where', 'city', 'place', 'location', 'from']
      },
      family: {
        facts: ['family_parents', 'partner_name', 'children'],
        priority: 'high',
        keywords: ['family', 'parent', 'mom', 'dad', 'mother', 'father', 'wife', 'husband', 'partner', 'child']
      },
      work: {
        facts: ['current_job', 'education'],
        priority: 'medium',
        keywords: ['job', 'work', 'career', 'profession', 'company', 'office', 'study', 'school']
      },
      interests: {
        facts: ['hobbies', 'languages', 'signature_style'],
        priority: 'medium',
        keywords: ['hobby', 'like', 'enjoy', 'interest', 'language', 'speak', 'do for fun']
      },
      relationships: {
        facts: ['partner_name', 'family_parents', 'children'],
        priority: 'high',
        keywords: ['relationship', 'married', 'single', 'dating', 'love']
      }
    };
    
    // Analyze query relevance and missing information
    const analysisResults = {
      queriedCategories: [] as string[],
      missingCategories: [] as string[],
      criticalGaps: [] as string[],
      availableFactsByCategory: {} as Record<string, string[]>,
      riskLevel: 'low' as 'low' | 'medium' | 'high' | 'critical'
    };
    
    // Identify queried categories and gaps
    Object.entries(factCategories).forEach(([category, config]) => {
      const isQueryRelevant = config.keywords.some(keyword => queryLower.includes(keyword));
      const availableFacts = config.facts.filter(fact => factKeys.has(fact));
      const hasAnyFacts = availableFacts.length > 0;
      
      if (isQueryRelevant) {
        analysisResults.queriedCategories.push(category);
        analysisResults.availableFactsByCategory[category] = availableFacts;
        
        if (!hasAnyFacts) {
          analysisResults.missingCategories.push(category);
          
          if (config.priority === 'critical') {
            analysisResults.criticalGaps.push(category);
          }
        }
      }
    });
    
    // Determine risk level
    if (analysisResults.criticalGaps.length > 0 && memoryResults.length === 0) {
      analysisResults.riskLevel = 'critical';
    } else if (analysisResults.missingCategories.length >= 2 && memoryResults.length === 0) {
      analysisResults.riskLevel = 'high';
    } else if (analysisResults.missingCategories.length > 0 && memoryResults.length < 2) {
      analysisResults.riskLevel = 'medium';
    }
    
    // Log detailed analysis
    if (analysisResults.queriedCategories.length > 0) {
      console.log(`[PromptBuilder] === FACT GAP ANALYSIS ===`);
      console.log(`[PromptBuilder] Query: "${query.substring(0, 80)}..."`);
      console.log(`[PromptBuilder] Queried categories: ${analysisResults.queriedCategories.join(', ')}`);
      console.log(`[PromptBuilder] Missing categories: ${analysisResults.missingCategories.join(', ') || 'none'}`);
      console.log(`[PromptBuilder] Critical gaps: ${analysisResults.criticalGaps.join(', ') || 'none'}`);
      console.log(`[PromptBuilder] Risk level: ${analysisResults.riskLevel.toUpperCase()}`);
      console.log(`[PromptBuilder] Total facts available: ${availableFacts.length}`);
      console.log(`[PromptBuilder] Memory fragments: ${memoryResults.length}`);
      
      // Log available facts by category
      Object.entries(analysisResults.availableFactsByCategory).forEach(([category, facts]) => {
        if (facts.length > 0) {
          console.log(`[PromptBuilder] ${category} facts: ${facts.join(', ')}`);
        }
      });
      
      // Log fact priorities and confidence levels
      if (availableFacts.length > 0) {
        const factsByPriority = availableFacts.reduce((acc, fact) => {
          const priority = fact.priority;
          if (!acc[priority]) acc[priority] = [];
          acc[priority].push(`${fact.key}(${fact.confidence})`);
          return acc;
        }, {} as Record<number, string[]>);
        
        console.log(`[PromptBuilder] Facts by priority:`, factsByPriority);
      }
    }
    
    // Enhanced hallucination risk logging
    if (analysisResults.riskLevel === 'critical') {
      console.error(`[PromptBuilder] 🚨 CRITICAL HALLUCINATION RISK 🚨`);
      console.error(`[PromptBuilder] Query about core identity with no facts or memories available`);
      console.error(`[PromptBuilder] Missing critical categories: ${analysisResults.criticalGaps.join(', ')}`);
      console.error(`[PromptBuilder] Recommendation: Use "I don't have that yet" response`);
    } else if (analysisResults.riskLevel === 'high') {
      console.warn(`[PromptBuilder] ⚠️  HIGH HALLUCINATION RISK ⚠️`);
      console.warn(`[PromptBuilder] Multiple missing categories with minimal memory support`);
      console.warn(`[PromptBuilder] Missing: ${analysisResults.missingCategories.join(', ')}`);
      console.warn(`[PromptBuilder] Consider missing info response or enhanced guardrails`);
    } else if (analysisResults.riskLevel === 'medium') {
      console.log(`[PromptBuilder] ⚡ Moderate hallucination risk detected`);
      console.log(`[PromptBuilder] Some information gaps present, proceed with caution`);
    }
    
    // Log memory relevance analysis
    if (memoryResults.length > 0) {
      const highRelevanceMemories = memoryResults.filter(m => (m.similarity || 0) > 0.8).length;
      const mediumRelevanceMemories = memoryResults.filter(m => (m.similarity || 0) > 0.6 && (m.similarity || 0) <= 0.8).length;
      
      console.log(`[PromptBuilder] Memory relevance: ${highRelevanceMemories} high, ${mediumRelevanceMemories} medium relevance`);
      
      if (highRelevanceMemories === 0 && analysisResults.missingCategories.length > 0) {
        console.warn(`[PromptBuilder] No high-relevance memories for missing categories - increased hallucination risk`);
      }
    }
    
    console.log(`[PromptBuilder] === END ANALYSIS ===`);
  }

  /**
   * Check if query is relevant to a fact category
   */
  private isQueryRelevantToCategory(queryLower: string, category: string): boolean {
    const categoryKeywords = {
      personal: ['born', 'birth', 'name', 'age', 'old'],
      location: ['live', 'city', 'where', 'place', 'location', 'from'],
      family: ['family', 'parent', 'mom', 'dad', 'mother', 'father', 'wife', 'husband', 'partner', 'child'],
      work: ['job', 'work', 'career', 'profession', 'company', 'office'],
      interests: ['hobby', 'like', 'enjoy', 'interest', 'language', 'speak']
    };
    
    const keywords = categoryKeywords[category as keyof typeof categoryKeywords] || [];
    return keywords.some(keyword => queryLower.includes(keyword));
  }

  /**
   * Enhanced buildSystemPrompt with consistency checking and guardrails
   */
  async buildSystemPromptWithValidation(
    avatarSlug: string,
    query: string,
    conversationHistory: ConversationTurn[] = [],
    priorityFilter: number = 10,
    memoryLimit: number = PromptBuilder.DEFAULT_MEMORY_LIMIT
  ): Promise<{ prompt: string; validation: { isValid: boolean; warnings: string[]; contradictions: string[] } }> {
    const context = await this.buildPromptContext(
      avatarSlug,
      query,
      conversationHistory,
      priorityFilter,
      memoryLimit
    );

    // Log fact gaps and potential hallucination attempts
    this.logFactGaps(query, context.quick_facts, context.relevant_memories);

    // Validate consistency between facts and memories
    const consistencyCheck = await this.validateFactMemoryConsistency(
      context.quick_facts,
      context.relevant_memories,
      query
    );

    // Check for missing information and determine response strategy
    const missingInfoAnalysis = this.analyzeMissingInformation(query, context.quick_facts, context.relevant_memories);
    
    let prompt: string;
    const warnings: string[] = [...consistencyCheck.warnings];
    const contradictions: string[] = [...consistencyCheck.contradictions];
    
    if (missingInfoAnalysis.shouldUseMissingInfoResponse) {
      // Generate "I don't have that yet" response with guardrails
      const missingInfoResponse = this.generateMissingInfoResponse(query, context.quick_facts);
      prompt = this.buildMissingInfoPrompt(missingInfoResponse, context, missingInfoAnalysis);
      
      warnings.push('Insufficient information available for comprehensive response');
      this.logPotentialHallucination(query, context.quick_facts, context.relevant_memories, 'missing_info_response');
    } else {
      // Build structured prompt with enhanced guardrails
      prompt = this.buildGuardedStructuredPrompt(context, query, consistencyCheck);
    }

    // Add consistency warnings to prompt if needed
    if (contradictions.length > 0) {
      warnings.push(`Fact contradictions detected: ${contradictions.length} issues`);
    }

    return {
      prompt,
      validation: {
        isValid: missingInfoAnalysis.hasSufficientInfo && contradictions.length === 0,
        warnings,
        contradictions
      }
    };
  }

  /**
   * Analyze missing information to determine response strategy
   */
  private analyzeMissingInformation(
    query: string,
    facts: QuickFact[],
    memories: Memory[]
  ): {
    hasSufficientInfo: boolean;
    shouldUseMissingInfoResponse: boolean;
    missingCategories: string[];
    confidenceLevel: 'high' | 'medium' | 'low';
  } {
    const queryLower = query.toLowerCase();
    const factKeys = new Set(facts.map(f => f.key));
    
    // Define information categories and their required facts
    const categoryRequirements = {
      personal_identity: ['full_name', 'birth_year', 'birthplace'],
      location: ['current_city', 'birthplace', 'grew_up'],
      family: ['family_parents', 'partner_name', 'children'],
      work: ['current_job', 'education'],
      interests: ['hobbies', 'languages', 'signature_style']
    };

    // Determine which categories are being queried
    const queriedCategories = this.identifyQueriedCategories(queryLower);
    const missingCategories: string[] = [];
    
    // Check if we have sufficient facts for queried categories
    for (const category of queriedCategories) {
      const requiredFacts = categoryRequirements[category as keyof typeof categoryRequirements] || [];
      const hasAnyRequiredFacts = requiredFacts.some(fact => factKeys.has(fact));
      
      if (!hasAnyRequiredFacts) {
        missingCategories.push(category);
      }
    }

    // Determine confidence level based on available information
    const totalFacts = facts.length;
    const relevantMemories = memories.length;
    
    let confidenceLevel: 'high' | 'medium' | 'low';
    if (totalFacts >= 5 && relevantMemories >= 2) {
      confidenceLevel = 'high';
    } else if (totalFacts >= 2 || relevantMemories >= 1) {
      confidenceLevel = 'medium';
    } else {
      confidenceLevel = 'low';
    }

    // Decide response strategy
    const hasSufficientInfo = missingCategories.length === 0 || confidenceLevel === 'high';
    const shouldUseMissingInfoResponse = missingCategories.length > 0 && confidenceLevel === 'low';

    return {
      hasSufficientInfo,
      shouldUseMissingInfoResponse,
      missingCategories,
      confidenceLevel
    };
  }

  /**
   * Identify which information categories are being queried
   */
  private identifyQueriedCategories(queryLower: string): string[] {
    const categoryKeywords = {
      personal_identity: ['name', 'born', 'birth', 'age', 'old', 'who are you'],
      location: ['live', 'city', 'where', 'place', 'location', 'from', 'grew up'],
      family: ['family', 'parent', 'mom', 'dad', 'mother', 'father', 'wife', 'husband', 'partner', 'child', 'kids'],
      work: ['job', 'work', 'career', 'profession', 'company', 'office', 'study', 'school'],
      interests: ['hobby', 'like', 'enjoy', 'interest', 'language', 'speak', 'do for fun']
    };

    const queriedCategories: string[] = [];
    
    for (const [category, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(keyword => queryLower.includes(keyword))) {
        queriedCategories.push(category);
      }
    }

    return queriedCategories.length > 0 ? queriedCategories : ['general'];
  }

  /**
   * Build prompt for missing information scenarios with guardrails
   */
  private buildMissingInfoPrompt(
    missingInfoResponse: string,
    context: PromptContext,
    analysis: { missingCategories: string[]; confidenceLevel: string }
  ): string {
    return `You are an avatar with limited information about yourself. Your primary response should be: "${missingInfoResponse}"

CRITICAL GUARDRAILS:
- NEVER guess or make up information that isn't explicitly provided below
- NEVER contradict the facts listed below
- If asked about missing information, acknowledge the gap and invite the user to share more
- Stay consistent with your established identity

AVAILABLE INFORMATION:
${context.quick_facts.length > 0 ? this.formatFactsSection(context.quick_facts) : 'No specific facts available yet.'}

SPEAKING STYLE:
${this.formatStyleSection(context.style_profile)}

RELEVANT MEMORIES (if any):
${context.relevant_memories.length > 0 ? this.formatMemoriesSection(context.relevant_memories) : 'No relevant memories found.'}

MISSING CATEGORIES: ${analysis.missingCategories.join(', ')}
CONFIDENCE LEVEL: ${analysis.confidenceLevel}

Remember: Your response should primarily be the missing info message, but you can reference any available information above if directly relevant.`;
  }

  /**
   * Build structured prompt with enhanced guardrails against contradictions
   */
  private buildGuardedStructuredPrompt(
    context: PromptContext,
    query: string,
    consistencyCheck: { warnings: string[]; contradictions: string[] }
  ): string {
    const basePrompt = this.formatStructuredPrompt(context, query);
    
    // Add enhanced guardrails section
    const guardrailsSection = `

ENHANCED GUARDRAILS:
- NEVER contradict information in CORE IDENTITY or LIFE CONTEXT sections
- If information conflicts between facts and memories, prioritize CORE IDENTITY facts
- For missing information, say "I don't have that information yet" rather than guessing
- If asked about something not covered above, acknowledge the gap: "I don't have details about that yet"
- Maintain absolute consistency across all responses`;

    // Add consistency warnings if present
    let consistencySection = '';
    if (consistencyCheck.contradictions.length > 0) {
      consistencySection = `

CONSISTENCY ALERTS:
${consistencyCheck.contradictions.map(c => `- ${c}`).join('\n')}
RESOLVE BY: Prioritizing CORE IDENTITY facts over conflicting information`;
    }

    return basePrompt + guardrailsSection + consistencySection;
  }

  /**
   * Validate consistency between quick facts and memory search results
   */
  private async validateFactMemoryConsistency(
    facts: QuickFact[],
    memories: Memory[],
    query: string
  ): Promise<{ warnings: string[]; contradictions: string[] }> {
    const warnings: string[] = [];
    const contradictions: string[] = [];

    // Create fact lookup map
    const factMap = new Map<string, string>();
    facts.forEach(fact => factMap.set(fact.key, fact.value));

    // Check for contradictions between facts and memory content
    for (const memory of memories) {
      const memoryText = memory.fragment_text.toLowerCase();
      
      // Check birth year consistency
      if (factMap.has('birth_year')) {
        const factBirthYear = factMap.get('birth_year');
        const memoryBirthYears = this.extractYearsFromText(memoryText);
        
        for (const memoryYear of memoryBirthYears) {
          if (memoryYear !== factBirthYear && this.isLikelyBirthYear(memoryYear, memoryText)) {
            contradictions.push(`Birth year mismatch: fact says ${factBirthYear}, memory suggests ${memoryYear}`);
          }
        }
      }

      // Check location consistency
      if (factMap.has('birthplace')) {
        const factBirthplace = factMap.get('birthplace')?.toLowerCase();
        if (memoryText.includes('born in') || memoryText.includes('born at')) {
          const memoryLocations = this.extractLocationsFromText(memoryText);
          for (const location of memoryLocations) {
            if (location !== factBirthplace && !factBirthplace?.includes(location)) {
              warnings.push(`Potential birthplace inconsistency: fact says ${factBirthplace}, memory mentions ${location}`);
            }
          }
        }
      }

      // Check name consistency
      if (factMap.has('full_name')) {
        const factName = factMap.get('full_name')?.toLowerCase();
        const namePatterns = ['my name is', 'i am', 'i\'m'];
        for (const pattern of namePatterns) {
          if (memoryText.includes(pattern)) {
            const extractedNames = this.extractNamesFromText(memoryText, pattern);
            for (const name of extractedNames) {
              if (name !== factName && !factName?.includes(name)) {
                warnings.push(`Potential name inconsistency: fact says ${factName}, memory suggests ${name}`);
              }
            }
          }
        }
      }
    }

    // Log consistency check results
    if (contradictions.length > 0 || warnings.length > 0) {
      console.log(`[PromptBuilder] Consistency check for query "${query.substring(0, 50)}..."`);
      console.log(`[PromptBuilder] Contradictions: ${contradictions.length}, Warnings: ${warnings.length}`);
    }

    return { warnings, contradictions };
  }

  /**
   * Extract years from text that might be birth years
   */
  private extractYearsFromText(text: string): string[] {
    const yearPattern = /\b(19|20)\d{2}\b/g;
    const matches = text.match(yearPattern) || [];
    return matches.filter(year => {
      const yearNum = parseInt(year);
      return yearNum >= 1900 && yearNum <= new Date().getFullYear();
    });
  }

  /**
   * Check if a year is likely a birth year based on context
   */
  private isLikelyBirthYear(year: string, text: string): boolean {
    const birthContexts = ['born', 'birth', 'was born', 'born in'];
    return birthContexts.some(context => text.includes(context));
  }

  /**
   * Extract location names from text
   */
  private extractLocationsFromText(text: string): string[] {
    // Simple location extraction - in production would use NLP
    const locationPatterns = [
      /born in ([^,.\n]+)/gi,
      /born at ([^,.\n]+)/gi,
      /from ([^,.\n]+)/gi
    ];
    
    const locations: string[] = [];
    for (const pattern of locationPatterns) {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const location = match.replace(/^(born in|born at|from)\s+/i, '').trim().toLowerCase();
          if (location.length > 2) {
            locations.push(location);
          }
        });
      }
    }
    
    return [...new Set(locations)]; // Remove duplicates
  }

  /**
   * Extract names from text based on patterns
   */
  private extractNamesFromText(text: string, pattern: string): string[] {
    const names: string[] = [];
    const regex = new RegExp(`${pattern}\\s+([^,.\n]+)`, 'gi');
    const matches = text.match(regex);
    
    if (matches) {
      matches.forEach(match => {
        const name = match.replace(new RegExp(`^${pattern}\\s+`, 'i'), '').trim().toLowerCase();
        if (name.length > 1 && !['a', 'an', 'the'].includes(name)) {
          names.push(name);
        }
      });
    }
    
    return [...new Set(names)]; // Remove duplicates
  }

  /**
   * Log potential hallucination attempts with detailed context
   */
  private logPotentialHallucination(
    query: string,
    facts: QuickFact[],
    memories: Memory[],
    responseType: 'missing_info_response' | 'structured_response'
  ): void {
    const factKeys = facts.map(f => f.key);
    const queryLower = query.toLowerCase();
    
    // Identify high-risk hallucination scenarios
    const riskFactors: string[] = [];
    
    // No facts available
    if (facts.length === 0) {
      riskFactors.push('no_facts_available');
    }
    
    // No relevant memories
    if (memories.length === 0) {
      riskFactors.push('no_relevant_memories');
    }
    
    // Query about specific facts that don't exist
    const specificQueries = {
      birth_info: ['born', 'birth', 'age'],
      location_info: ['live', 'where', 'city'],
      family_info: ['family', 'parent', 'mom', 'dad'],
      work_info: ['job', 'work', 'career']
    };
    
    for (const [category, keywords] of Object.entries(specificQueries)) {
      if (keywords.some(keyword => queryLower.includes(keyword))) {
        const relevantFacts = factKeys.filter(key => 
          key.includes(category.replace('_info', '')) || 
          key.includes(keywords[0])
        );
        
        if (relevantFacts.length === 0) {
          riskFactors.push(`missing_${category}`);
        }
      }
    }
    
    // Log high-risk scenarios
    if (riskFactors.length >= 2) {
      console.warn(`[PromptBuilder] HIGH HALLUCINATION RISK detected`);
      console.warn(`[PromptBuilder] Query: "${query.substring(0, 100)}..."`);
      console.warn(`[PromptBuilder] Risk factors: ${riskFactors.join(', ')}`);
      console.warn(`[PromptBuilder] Response type: ${responseType}`);
      console.warn(`[PromptBuilder] Available facts: ${factKeys.join(', ') || 'none'}`);
      console.warn(`[PromptBuilder] Memory count: ${memories.length}`);
    } else if (riskFactors.length > 0) {
      console.log(`[PromptBuilder] Moderate hallucination risk: ${riskFactors.join(', ')}`);
    }
  }

  /**
   * Estimate token usage for budget management
   */
  private estimateTokenUsage(
    facts: QuickFact[],
    style: StyleProfile,
    memories: Memory[],
    history: ConversationTurn[]
  ): number {
    // Rough estimation: 1 token ≈ 4 characters
    let totalChars = 0;

    // Facts
    facts.forEach(fact => {
      totalChars += fact.key.length + fact.value.length + 20; // overhead
    });

    // Style profile
    Object.values(style).forEach(value => {
      if (value) totalChars += value.length + 10;
    });

    // Memories
    memories.forEach(memory => {
      totalChars += memory.fragment_text.length + 10;
    });

    // Conversation history
    history.forEach(turn => {
      totalChars += turn.content.length + 10;
    });

    return Math.ceil(totalChars / 4);
  }
}