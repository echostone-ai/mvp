import { supabase } from '@/lib/supabase';
import { PromptBuilder, QuickFact, StyleProfile, Memory, ConversationTurn, PromptContext } from './promptBuilder';
import { resolveAvatarId as resolveAvatarIdLegacy, AvatarIdentifier } from './identity';
import { QUICK_FACT_KEYS } from '../onboarding/starterPack';
import { IntelligentQueryAnalyzer, QueryAnalysis } from './intelligentQueryAnalyzer';
import { SemanticMemoryRetriever, EnhancedMemory } from './semanticMemoryRetriever';
import { IntelligentFactExtractor } from './intelligentFactExtractor';
import { IntelligentMemoryRetriever } from './intelligentMemoryRetriever';
import { detectIntent, getPinnedCount, Boosts } from '@/config/personalization';
import { resolveAvatarId } from './resolveAvatar';
import { scopeMemories, filterDemoMemories } from '@/lib/demoScope';

export interface EnhancedStyleProfile extends StyleProfile {
    address_male_friend?: string;
    expressions?: { [key: string]: string };
    catchphrases?: { [key: string]: string };
}

export interface ExpressionUsageTracker {
    [expressionKey: string]: {
        lastUsed: number; // turn number
        usageCount: number;
    };
}

export interface ResolvedEntity {
    name: string;
    type: 'pet' | 'family' | 'friend' | 'person' | 'unknown';
    facts: QuickFact[];
    aliases: string[];
    context: string;
}

/**
 * Enhanced PromptBuilder - The ONLY prompt builder for all avatars
 * Provides fast, natural, personalized conversation logic with:
 * - Fast mode for sub-200ms responses
 * - Expression and catchphrase management
 * - Smart fact organization and connection
 * - Geo-aware retrieval for place queries
 * - Visitor personalization and memory
 * - Universal avatar_profiles.id resolution
 */
export class EnhancedPromptBuilder extends PromptBuilder {
    private static readonly EXPRESSION_COOLDOWN_TURNS = 3;
    private db: any = supabase;

    constructor(dbClient?: any) {
        super();
        if (dbClient) this.db = dbClient;
    }
    private static readonly MAX_EXPRESSION_FREQUENCY = 4; // max once every 4 turns
    private static factCache = new Map<string, { facts: QuickFact[], timestamp: number }>();
    private static readonly CACHE_TTL = 30000; // 30 seconds for fast mode

    /**
     * Scrub legacy location references from prompts
     */
    private scrubLegacyLocation(s: string): string {
        // remove legacy "current_location" claims and hardcoded Vancouver mentions from seed
        return s
            .replace(/current_location\s*:\s*.*\n?/gi, '')
            .replace(/\bVancouver Island\b/gi, '')
            .replace(/\bVancouver,?\s*BC\b/gi, '')
            .replace(/\bKrissy\b/gi, '') // Remove hardcoded partner name
            .replace(/previously lived in Vancouver Island/gi, '')
            .replace(/lived in Vancouver Island/gi, '')
            .replace(/from Vancouver Island/gi, 'from Maine');
    }

    /**
     * Get pinned memories for fast path injection
     */
    async getPinnedMemoriesForFastPath(
        avatarId: string,
        query: string,
        intent: string | null,
        demoMode?: any
    ): Promise<Memory[]> {
        const pinnedCount = getPinnedCount(intent);
        if (pinnedCount === 0) return [];

        try {
            // Use existing get_enhanced_memories function
            const { data, error } = await this.db.rpc('get_enhanced_memories', {
                target_user_id: null,
                target_avatar_id: avatarId,
                search_query: query,
                match_count: pinnedCount * 2, // Get more to filter from
                similarity_threshold: intent === 'opinion' ? 0.25 : 0.4,
                include_bio_facts: true
            });

            if (error || !data) {
                console.warn('Failed to get pinned memories for fast path:', error);
                return [];
            }

            let memories = data || [];
            
            // Loosen demo filtering - ensure bio/travel/people memories are never excluded
            if (demoMode?.isDemo) {
                memories = memories.filter((memory: any) => {
                    const text = memory.fragment_text.toLowerCase();
                    const ctx = memory.conversation_context || {};
                    
                    // Never exclude Austin years, Tyler, bio, travel, or people memories
                    if (text.includes('austin') || text.includes('tyler') || 
                        text.includes('2009') || text.includes('2018') ||
                        ctx.type === 'bio' || ctx.type === 'travel' || ctx.type === 'people' ||
                        ctx.type === 'relationship' || ctx.type === 'timeline') {
                        return true;
                    }
                    
                    // Keep all other memories for now - be very permissive
                    return true;
                });
            }
            
            // Apply demo scoping if needed - temporarily bypass for pinned memories
            const scopedMemories = memories; // TODO: Fix demo filtering for pinned memories

            // Apply intent-specific boosting and ranking
            const boostedMemories = scopedMemories.map((memory: any) => {
                let boost = 0;
                const ctx = memory.conversation_context || {};
                const text = memory.fragment_text.toLowerCase();

                // Apply boosts based on intent and content
                if (intent === 'opinion' && (ctx.type === 'opinion' || text.includes('trump'))) {
                    boost += Boosts.contextTypeOpinion;
                }
                if (text.includes('politics') || ctx.context?.includes('politics')) {
                    boost += Boosts.hasPolitics;
                }
                
                // Boost for relationship/people queries
                if (intent === 'people') {
                    // Boost for friend/family context
                    if (ctx.type === 'relationship' || ctx.context?.includes('friend') || ctx.context?.includes('family')) {
                        boost += Boosts.relationshipMatch;
                    }
                    
                    // Boost for specific friend names mentioned in query
                    const friendNames = ['tyler', 'kate', 'katie', 'anna', 'taylor', 'eric', 'carter', 'matheus', 'geoff', 'krissy', 'tia'];
                    const queryLower = query.toLowerCase();
                    for (const name of friendNames) {
                        if (queryLower.includes(name) && text.includes(name)) {
                            boost += Boosts.friendMention;
                            break;
                        }
                    }
                }

                return {
                    ...memory,
                    similarity_score: Math.min(1.0, (memory.similarity_score || 0.8) + boost)
                };
            });

            // Sort by boosted similarity and return top pinned count
            const pinnedMemories = boostedMemories
                .sort((a: any, b: any) => b.similarity_score - a.similarity_score)
                .slice(0, pinnedCount);

            console.log(`[EnhancedPromptBuilder] Pinned ${pinnedMemories.length} memories for fast path (intent: ${intent})`);

            return pinnedMemories.map((m: any) => ({
                id: m.id,
                fragment_text: m.fragment_text,
                similarity: m.similarity_score,
                created_at: m.created_at,
                gist: m.fragment_text.substring(0, 200),
                conversation_context: m.conversation_context
            }));

        } catch (error) {
            console.warn('Error getting pinned memories for fast path:', error);
            return [];
        }
    }

    /**
     * Fetch enhanced style profile with expressions and catchphrases
     */
    async fetchEnhancedStyleProfile(avatarId: string): Promise<EnhancedStyleProfile> {
        const startTime = Date.now();

        try {
            // Skip database queries for mock avatars
            if (avatarId.startsWith('mock-')) {
                return {
                    speaking_style: 'warm, conversational, engaging'
                };
            }

            // Fetch all style-related quick facts
            const { data: facts, error } = await this.db
                .from('quick_facts')
                .select('key, value, priority, confidence')
                .eq('avatar_id', avatarId)
                .or('key.eq.speaking_style,key.eq.address_male_friend,key.like.expression_%,key.like.catchphrase_%')
                .order('priority')
                .order('confidence', { ascending: false });

            if (error) {
                console.error('Error fetching enhanced style profile:', error);
                throw new Error(`Failed to fetch enhanced style profile: ${error.message}`);
            }

            const profile: EnhancedStyleProfile = {};
            const expressions: { [key: string]: string } = {};
            const catchphrases: { [key: string]: string } = {};

            for (const fact of facts || []) {
                if (fact.key === 'speaking_style') {
                    profile.speaking_style = fact.value;
                } else if (fact.key === 'address_male_friend') {
                    profile.address_male_friend = fact.value;
                } else if (fact.key.startsWith('expression_')) {
                    const expressionKey = fact.key.replace('expression_', '');
                    expressions[expressionKey] = fact.value;
                } else if (fact.key.startsWith('catchphrase_')) {
                    const catchphraseKey = fact.key.replace('catchphrase_', '');
                    catchphrases[catchphraseKey] = fact.value;
                }
            }

            if (Object.keys(expressions).length > 0) {
                profile.expressions = expressions;
            }
            if (Object.keys(catchphrases).length > 0) {
                profile.catchphrases = catchphrases;
            }

            const processingTime = Date.now() - startTime;
            if (processingTime > 100) {
                console.warn(`Enhanced style profile retrieval took ${processingTime}ms`);
            }

            return profile;
        } catch (error) {
            console.error('Error in fetchEnhancedStyleProfile:', error);
            return {};
        }
    }

    /**
     * Universal name/entity resolver
     * Extracts proper nouns and pet/family aliases, checks facts and fragments for matches
     */
    async resolveEntityFromName(
        query: string,
        facts: QuickFact[],
        fragments: Memory[] = [],
        history: ConversationTurn[] = []
    ): Promise<ResolvedEntity | null> {
        const queryLower = query.toLowerCase();

        // Pet aliases mapping
        const petAliases = {
            dog: ['dog', 'pup', 'puppy', 'mutt', 'canine', 'pooch', 'doggy', 'hound'],
            cat: ['cat', 'kitty', 'kitten', 'feline', 'kittycat'],
            bird: ['bird', 'birdie', 'parrot', 'parakeet', 'cockatiel'],
            fish: ['fish', 'goldfish', 'betta'],
            rabbit: ['rabbit', 'bunny', 'bun'],
            hamster: ['hamster', 'hammy'],
            guinea_pig: ['guinea pig', 'piggy']
        };

        // Enhanced name patterns including pronouns and possessives
        const namePatterns = [
            /who\s+is\s+(\w+)/i,
            /who\'?s\s+(\w+)/i,
            /tell\s+me\s+about\s+(\w+)/i,
            /what\s+about\s+(\w+)/i,
            /how\'?s\s+(\w+)/i,
            /how\s+is\s+(\w+)/i,
            /(\w+)\'s\s+/i,
            /about\s+(\w+)/i,
            /my\s+(\w+)/i,
            /your\s+(\w+)/i
        ];

        // Check for direct name mentions
        let targetName: string | null = null;
        for (const pattern of namePatterns) {
            const match = query.match(pattern);
            if (match) {
                targetName = match[1].toLowerCase();
                break;
            }
        }

        // Check for pronouns that might refer to recently mentioned entities
        const pronouns = ['he', 'she', 'him', 'her', 'they', 'them', 'it'];
        let recentEntity: string | null = null;

        if (!targetName && history.length > 0) {
            const hasPronoun = pronouns.some(pronoun => queryLower.includes(pronoun));

            if (hasPronoun) {
                // Find the most recent entity mentioned in conversation
                for (let i = history.length - 1; i >= 0; i--) {
                    const turn = history[i];
                    const turnLower = turn.content.toLowerCase();

                    // Check for pet names first
                    const petNameFact = facts.find(f => f.key === 'pet_name');
                    if (petNameFact && turnLower.includes(petNameFact.value.toLowerCase())) {
                        recentEntity = petNameFact.value.toLowerCase();
                        targetName = recentEntity;
                        break;
                    }

                    // Check for other known entities
                    const knownEntities = ['romeo', 'tyler', 'kate', 'katie', 'anna', 'taylor'];
                    for (const entity of knownEntities) {
                        if (turnLower.includes(entity)) {
                            recentEntity = entity;
                            targetName = entity;
                            break;
                        }
                    }
                    if (recentEntity) break;
                }
            }
        }

        // Check for pet type aliases (e.g., "how's the dog?", "how's your pup?")
        if (!targetName) {
            for (const [petType, aliases] of Object.entries(petAliases)) {
                for (const alias of aliases) {
                    if (queryLower.includes(alias)) {
                        // Find pet of this type in facts
                        const petTypeFact = facts.find(f =>
                            f.key === 'pet_type' && f.value.toLowerCase().includes(petType)
                        );
                        if (petTypeFact) {
                            const petNameFact = facts.find(f => f.key === 'pet_name');
                            if (petNameFact) {
                                targetName = petNameFact.value.toLowerCase();
                                break;
                            }
                        }
                    }
                }
                if (targetName) break;
            }
        }

        // Enhanced pet detection - check for any pet-related words and map to known pets
        if (!targetName) {
            const petWords = ['pup', 'puppy', 'dog', 'doggy', 'pooch', 'pet'];
            const hasPetWord = petWords.some(word => queryLower.includes(word));
            
            if (hasPetWord) {
                // Look for any pet name in facts
                const petNameFact = facts.find(f => f.key === 'pet_name');
                if (petNameFact) {
                    targetName = petNameFact.value.toLowerCase();
                }
            }
        }

        if (!targetName) return null;

        // Find all facts related to this entity
        const relatedFacts = facts.filter(fact =>
            fact.key.toLowerCase().includes(targetName!) ||
            fact.value.toLowerCase().includes(targetName!) ||
            (fact.key.startsWith('pet_') && targetName === facts.find(f => f.key === 'pet_name')?.value.toLowerCase())
        );

        if (relatedFacts.length === 0) return null;

        // Determine entity type
        let entityType: ResolvedEntity['type'] = 'unknown';
        const aliases: string[] = [targetName];

        if (relatedFacts.some(f => f.key.startsWith('pet_'))) {
            entityType = 'pet';
            // Add pet aliases
            const petTypeFact = relatedFacts.find(f => f.key === 'pet_type');
            if (petTypeFact) {
                const petTypeValue = petTypeFact.value.toLowerCase();
                for (const [type, typeAliases] of Object.entries(petAliases)) {
                    if (petTypeValue.includes(type)) {
                        aliases.push(...typeAliases);
                        break;
                    }
                }
            }
        } else if (relatedFacts.some(f => f.key.startsWith('family_') || f.key.includes('father') || f.key.includes('mother'))) {
            entityType = 'family';
        } else if (relatedFacts.some(f => f.key.startsWith('friend_'))) {
            entityType = 'friend';
        } else {
            entityType = 'person';
        }

        // Build context description
        let context = '';
        if (recentEntity) {
            context = `The user is asking about "${targetName}" (recently mentioned in conversation).`;
        } else {
            context = `The user is asking about "${targetName}".`;
        }

        return {
            name: targetName,
            type: entityType,
            facts: relatedFacts,
            aliases,
            context
        };
    }

    /**
     * Check if query is geo-related
     */
    private isGeoQuery(query: string): boolean {
        const geoPatterns = [
            /(?:lived|live|living|been|visited|from|in)\s+(?:spain|valencia|france|maine|austin|vancouver|texas|canada|croatia|bulgaria|sofia|europe)/i,
            /(?:have you|did you|where).*(?:lived|been|visited)/i,
            /where.*(?:from|born|grew up)/i,
            /(anywhere\s+in\s+europe)/i
        ];
        return geoPatterns.some(pattern => pattern.test(query));
    }

    /**
     * Ensure geo content is included for place queries
     */
    private async ensureGeoContent(avatarId: string, facts: QuickFact[], memories: Memory[]): Promise<void> {
        // Check if we already have Spain/Valencia content
        const hasSpainContent = facts.some(f =>
            f.value.toLowerCase().includes('spain') ||
            f.value.toLowerCase().includes('valencia')
        ) || memories.some(m =>
            m.fragment_text.toLowerCase().includes('spain') ||
            m.fragment_text.toLowerCase().includes('valencia')
        );

        if (!hasSpainContent) {
            // Force fetch Spain-related memories
            const { data: spainMemories } = await this.db
                .from('memory_fragments')
                .select('id, fragment_text, created_at, conversation_context')
                .eq('avatar_id', avatarId)
                .or('fragment_text.ilike.%spain%,fragment_text.ilike.%valencia%')
                .order('created_at', { ascending: false })
                .limit(2);

            if (spainMemories && spainMemories.length > 0) {
                memories.push(...spainMemories.map((m: any) => ({
                    id: m.id,
                    fragment_text: m.fragment_text,
                    similarity: 0.9, // High relevance for geo queries
                    created_at: m.created_at,
                    gist: m.fragment_text.substring(0, 200)
                })));
            }
        }
    }

    /**
     * Temporal facts fetching that separates current vs historical facts
     */
    private async fetchTemporalFacts(avatarId: string, priorityFilter: number = 6, fastMode: boolean = false): Promise<QuickFact[]> {
        try {
            // Always fetch critical facts (marriage, children, career, etc.)
            const criticalKeys = [
                'given_name', 'full_name', 'birth_date', 'birth_year', 'profession', 'birthplace',
                'marriage_tia', 'partner_name', 'children', 'education'
            ];
            
            // Fetch all facts, prioritizing critical ones
            const allFacts = fastMode ? 
                await this.fetchQuickFactsFast(avatarId, priorityFilter) :
                await this.fetchQuickFacts(avatarId, priorityFilter);
            
            // Separate facts by temporal context
            const currentFacts: QuickFact[] = [];
            const historicalFacts: QuickFact[] = [];
            const criticalFacts: QuickFact[] = [];
            
            allFacts.forEach(fact => {
                if (criticalKeys.includes(fact.key)) {
                    criticalFacts.push(fact);
                } else if (this.isHistoricalFact(fact)) {
                    historicalFacts.push(fact);
                } else {
                    currentFacts.push(fact);
                }
            });
            
            // Always include critical facts, then current, then historical
            const temporalFacts = [
                ...criticalFacts,
                ...currentFacts.slice(0, fastMode ? 8 : 15),
                ...historicalFacts.slice(0, fastMode ? 4 : 8)
            ];
            
            // Ensure marriage facts are always included if they exist
            const marriageFacts = allFacts.filter(f => 
                f.key.includes('marriage') || 
                f.key.includes('married') ||
                f.key === 'marriage_tia'
            );
            
            marriageFacts.forEach(fact => {
                if (!temporalFacts.find(f => f.key === fact.key)) {
                    temporalFacts.push(fact);
                }
            });
            
            return temporalFacts.slice(0, fastMode ? 15 : 25);
            
        } catch (error) {
            console.error('Error in fetchTemporalFacts:', error);
            // Fallback to regular facts
            return fastMode ? 
                await this.fetchQuickFactsFast(avatarId, priorityFilter) :
                await this.fetchQuickFacts(avatarId, priorityFilter);
        }
    }
    
    /**
     * Determine if a fact represents historical information
     */
    private isHistoricalFact(fact: QuickFact): boolean {
        const historicalKeys = [
            'marriage_tia', 'marriage_history', 'previous_job', 'education',
            'places_lived', 'moved_to', 'childhood', 'school', 'historical_marriage_tia',
            'relationship_timeline'
        ];
        
        const historicalPatterns = [
            'previously', 'former', 'ex-', 'was', 'used to', 'lived in',
            'married to', 'divorced', 'graduated', 'studied', 'was married',
            'from 1999', 'until 2009', '1999-2009', 'for 10 years'
        ];
        
        return historicalKeys.includes(fact.key) || 
               fact.key.startsWith('historical_') ||
               historicalPatterns.some(pattern => 
                   fact.value.toLowerCase().includes(pattern)
               );
    }

    /**
     * Fast mode quick facts fetching with caching
     */
    private async fetchQuickFactsFast(avatarId: string, priorityFilter: number = 6): Promise<QuickFact[]> {
        // Skip database queries for mock avatars
        if (avatarId.startsWith('mock-')) {
            return [];
        }

        const cacheKey = `facts_${avatarId}_${priorityFilter}`;
        const cached = EnhancedPromptBuilder.factCache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < EnhancedPromptBuilder.CACHE_TTL) {
            return cached.facts;
        }

        // Optimized single query
        const { data, error } = await this.db
            .from('quick_facts')
            .select('id,key,value,confidence,priority,source,source_reference,created_at,updated_at')
            .eq('avatar_id', avatarId)
            .lte('priority', priorityFilter)
            .gte('confidence', 0.3)
            .order('priority')
            .order('confidence', { ascending: false })
            .limit(20);

        if (error) {
            console.warn('Fast facts query failed:', error);
            return [];
        }

        const facts = (data || []).map((f: any) => ({
            ...f,
            category: this.enhancedCategorizeFactKey(f.key)
        })) as QuickFact[];

        // Cache for speed
        EnhancedPromptBuilder.factCache.set(cacheKey, {
            facts,
            timestamp: Date.now()
        });

        return facts;
    }

    /**
     * Fast mode memory retrieval
     */
    private async fetchRelevantMemoriesFast(
        avatarId: string,
        query: string,
        limit: number = 6,
        isGeoQuery: boolean = false,
        demoMode?: {
            isDemo: boolean;
            conversationId?: string;
            visitorId?: string;
        }
    ): Promise<Memory[]> {
        // Skip database queries for mock avatars
        if (avatarId.startsWith('mock-')) {
            return [];
        }

        // Skip memory search for very simple queries
        if (query.length < 15 && !query.includes('?') && !isGeoQuery) {
            return [];
        }

        try {

            const searchTerms = query.toLowerCase().split(' ').slice(0, 3); // First 3 words
            const orConditions = searchTerms.map(term => `fragment_text.ilike.%${term}%`);
            
            // Add specific name/person queries (case-insensitive)
            const namePattern = /\b(who|what|tell me about|about)\s+(is|was|were)\s+(\w+)/i;
            const marriagePattern = /\b(married|marry)\s+(?:to\s+)?(\w+)/i;
            const nameMatch = query.match(namePattern);
            const marriageMatch = query.match(marriagePattern);
            
            if (nameMatch && nameMatch[3]) {
                const name = nameMatch[3].toLowerCase();
                orConditions.push(`fragment_text.ilike.%${name}%`);
                console.log(`[EnhancedPromptBuilder] Added name search for: ${name}`);
            }
            
            if (marriageMatch && marriageMatch[2]) {
                const name = marriageMatch[2].toLowerCase();
                orConditions.push(`fragment_text.ilike.%${name}%`);
                console.log(`[EnhancedPromptBuilder] Added marriage name search for: ${name}`);
            }

            // Enhanced marriage/relationship query detection
            const marriageQueryPattern = /\b(have you|did you|were you|are you).*\b(married|marry|marriage|wife|husband|partner|relationship|dating|together)\b/i;
            const relationshipTerms = ['married', 'marriage', 'wife', 'husband', 'partner', 'relationship', 'dating', 'together', 'girlfriend', 'boyfriend'];
            
            if (marriageQueryPattern.test(query)) {
                // Add marriage-specific search terms for relationship queries
                relationshipTerms.forEach(term => {
                    orConditions.push(`fragment_text.ilike.%${term}%`);
                });
                console.log(`[EnhancedPromptBuilder] Added relationship search terms for marriage query`);
            }

            // Add geo-specific terms for place queries
            if (isGeoQuery) {
                orConditions.push(
                    'fragment_text.ilike.%spain%',
                    'fragment_text.ilike.%valencia%',
                    'fragment_text.ilike.%lived%',
                    'fragment_text.ilike.%moved%'
                );
            }

            let dbQuery = supabase
                .from('memory_fragments')
                .select('id, fragment_text, created_at, conversation_context')
                .eq('avatar_id', avatarId)
                .or(orConditions.join(','));

            // Apply demo mode filtering at query level
            if (demoMode?.isDemo) {
                // For demo mode, we need to fetch more and filter in memory since we need complex OR logic
                dbQuery = dbQuery.limit(limit * 5); // Increase limit to find older memories
            } else if (demoMode?.isDemo === false) {
                // Normal mode: exclude demo memories
                dbQuery = dbQuery.not('conversation_context->>conversation_id', 'eq', 'jonathan-demo');
            }

            const { data, error } = await dbQuery
                .order('created_at', { ascending: false })
                .limit(demoMode?.isDemo ? limit * 10 : limit); // Increase limit further to find older memories

            if (error) return [];

            let filteredData = data || [];

            // Apply demo mode filtering in memory for complex logic
            if (demoMode?.isDemo) {
                filteredData = filteredData.filter((memory: any, index: number) => {
                    const ctx = memory.conversation_context || {};
                    let shouldInclude = false;
                    let reason = '';
                    
                    // Include global seed memories (identity, bio, language_style, story) with no visitor_id
                    if (['identity', 'bio', 'language_style', 'story'].includes(ctx.ctx_type) && 
                        !ctx.visitor_id && !ctx.conversation_id) {
                        shouldInclude = true;
                        reason = 'global seed memory';
                    }
                    
                    // Include bio memories with simple context structure (like Tia memory)
                    else if (ctx.type === 'bio' && !ctx.visitor_id && !ctx.conversation_id) {
                        shouldInclude = true;
                        reason = 'bio memory with simple context';
                    }
                    
                    // Include avatar's own memories (personal stories, relationships, experiences)
                    else if (ctx.source === 'avatar_personal_memory' || 
                        ctx.tags?.includes('avatar_memory') ||
                        ctx.tags?.includes('personal_story') ||
                        ctx.is_avatar_memory === true) {
                        shouldInclude = true;
                        reason = 'avatar personal memory';
                    }
                    
                    // Include visitor-scoped demo memories that haven't expired
                    else if (ctx.conversation_id === 'jonathan-demo' && 
                        ctx.visitor_id === demoMode.visitorId &&
                        ctx.expires_at && new Date(ctx.expires_at) > new Date()) {
                        shouldInclude = true;
                        reason = 'valid visitor-scoped demo memory';
                    }
                    
                    // Include memories without expiration (permanent avatar memories)
                    else if (ctx.conversation_id === 'jonathan-demo' && !ctx.expires_at) {
                        shouldInclude = true;
                        reason = 'permanent demo memory';
                    }
                    

                    
                    return shouldInclude;
                });
                
                // Prioritize memories by relevance to the query
                filteredData.sort((a, b) => {
                    const aCtx = a.conversation_context || {};
                    const bCtx = b.conversation_context || {};
                    const aText = a.fragment_text.toLowerCase();
                    const bText = b.fragment_text.toLowerCase();
                    
                    // Marriage/relationship content gets highest priority for marriage queries
                    const isMarriageQuery = query.toLowerCase().includes('married') || query.toLowerCase().includes('marriage');
                    if (isMarriageQuery) {
                        const aIsMarriageContent = aText.includes('married') || aText.includes('marriage') || aText.includes('tia') || aCtx.context === 'first_marriage';
                        const bIsMarriageContent = bText.includes('married') || bText.includes('marriage') || bText.includes('tia') || bCtx.context === 'first_marriage';
                        
                        if (aIsMarriageContent && !bIsMarriageContent) return -1;
                        if (bIsMarriageContent && !aIsMarriageContent) return 1;
                    }
                    
                    // Bio memories get high priority
                    if (aCtx.type === 'bio' && bCtx.type !== 'bio') return -1;
                    if (bCtx.type === 'bio' && aCtx.type !== 'bio') return 1;
                    
                    // Relationship memories get second priority
                    if (aCtx.type === 'relationship' && bCtx.type !== 'relationship') return -1;
                    if (bCtx.type === 'relationship' && aCtx.type !== 'relationship') return 1;
                    
                    // User questions get lower priority
                    if (aCtx.type === 'user' && bCtx.type !== 'user') return 1;
                    if (bCtx.type === 'user' && aCtx.type !== 'user') return -1;
                    
                    // Otherwise maintain chronological order
                    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                });
                
                filteredData = filteredData.slice(0, limit);
            }

            return filteredData.map(m => ({
                id: m.id,
                fragment_text: m.fragment_text,
                similarity: 0.8,
                created_at: m.created_at,
                gist: m.fragment_text.substring(0, 200)
            }));
        } catch (error) {
            console.error(`[EnhancedPromptBuilder] fetchRelevantMemoriesFast error:`, error);
            return [];
        }
    }

    /**
     * Build fast path system prompt with pinned memories
     */
    async buildFastPathPromptWithPinnedMemories(
        avatarSlug: string,
        query: string,
        conversationHistory: ConversationTurn[] = [],
        options: {
            demoMode?: any;
            currentLocation?: string;
        } = {}
    ): Promise<{
        prompt: string;
        pinnedMemories: Memory[];
        intent: string | null;
    }> {
        const { demoMode, currentLocation } = options;
        
        // Resolve avatar ID
        let avatarId: string;
        
        // If avatarSlug is already an ID (UUID format), use it directly
        if (avatarSlug && avatarSlug.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
            avatarId = avatarSlug;
        } else {
            // Try to resolve slug to ID
            try {
                avatarId = await resolveAvatarId(avatarSlug);
                if (!avatarId) {
                    throw new Error(`Avatar not found: ${avatarSlug}`);
                }
            } catch (error) {
                // Fallback for demo mode
                if (avatarSlug === 'jonathan-demo') {
                    avatarId = '0585f43b-4b49-4e16-b2a7-91c8e1e3850c';
                } else {
                    throw new Error(`Avatar not found: ${avatarSlug}`);
                }
            }
        }

        // Detect intent
        const intent = detectIntent(query);
        
        // Get pinned memories for fast path
        const pinnedMemories = await this.getPinnedMemoriesForFastPath(
            avatarId,
            query,
            intent,
            demoMode
        );

        // Build basic persona seed
        let personaSeed = `You are ${avatarSlug}. Be warm, natural, and conversational. Speak in first person as yourself.`;
        
        if (currentLocation) {
            personaSeed += `\n\nIMPORTANT: You currently live in ${currentLocation}. This is where you are now.`;
        }

        // Add pinned memories context
        let memoriesContext = '';
        if (pinnedMemories.length > 0) {
            memoriesContext = '\n\nKEY MEMORIES (use these for specific, personal responses):\n';
            memoriesContext += pinnedMemories.map(m => 
                `- ${m.fragment_text.substring(0, 200)}${m.fragment_text.length > 200 ? '...' : ''}`
            ).join('\n');
        }

        // Add conversation history
        let conversationContext = '';
        if (conversationHistory.length > 0) {
            conversationContext = '\n\nRecent conversation:\n';
            conversationContext += conversationHistory.slice(-3).map(turn => 
                `${turn.role === 'user' ? 'User' : 'You'}: ${turn.content}`
            ).join('\n');
        }

        const prompt = `${personaSeed}${memoriesContext}${conversationContext}

User: ${query}

Respond naturally as ${avatarSlug} would, using your memories and personality. Keep it conversational and authentic:`;

        return {
            prompt,
            pinnedMemories,
            intent
        };
    }

    /**
     * Enhanced quick facts fetching with better place fact handling
     */
    async fetchQuickFacts(
        avatarId: string,
        priorityFilter: number = 6
    ): Promise<QuickFact[]> {
        const startTime = Date.now();
        try {
            const nowIso = new Date().toISOString();
            let query = this.db
                .from('quick_facts')
                .select('id,key,value,confidence,priority,source,source_reference,date_context,created_at,updated_at')
                .eq('avatar_id', avatarId)
                .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
                .order('priority', { ascending: true })
                .order('confidence', { ascending: false })
                .order('updated_at', { ascending: false })
                .order('key', { ascending: true })
                .limit(30); // Increased limit to capture more place facts

            if (typeof priorityFilter === 'number' && priorityFilter > 0) {
                query = query.lte('priority', Math.max(1, Math.min(priorityFilter, 10)));
            }

            const { data, error } = await query;
            if (error) {
                console.error('Error fetching enhanced quick facts:', error);
                throw new Error(`Failed to fetch quick facts: ${error.message}`);
            }

            const rows: any[] = Array.isArray(data) ? data : [];
            // Relax confidence filter for place facts
            const filtered = rows.filter(r => {
                const isPlaceFact = r.key && (
                    r.key.includes('place') ||
                    r.key.includes('location') ||
                    r.key.includes('birth') ||
                    r.key.startsWith('places_lived_') ||
                    r.key === 'moved_to' ||
                    r.key === 'current_city' ||
                    r.key === 'hometown'
                );

                // Lower confidence threshold for place facts
                const minConfidence = isPlaceFact ? 0.25 : 0.35;
                return !(typeof r.confidence === 'number' && r.confidence < minConfidence);
            });

            // Normalize key synonyms
            const placeIndices = filtered
                .map(r => String(r.key || ''))
                .filter(k => /^places_lived_\d+$/.test(k))
                .map(k => parseInt(k.split('_').pop() || '0', 10));
            let nextPlaceIdx = placeIndices.length > 0 ? Math.max(...placeIndices) + 1 : 0;

            const movedToBuffer: any[] = [];
            const normalizedRows: any[] = [];

            for (const r of filtered) {
                let key: string = r.key;
                // Normalize place-related keys
                if (key === 'birthplace') key = 'birth_place';
                if (key === 'moved_to' || key.startsWith('moved_to_')) {
                    movedToBuffer.push({ ...r, key });
                    continue;
                }
                normalizedRows.push({ ...r, key });
            }

            // Convert moved_to → places_lived_* 
            if (movedToBuffer.length > 0) {
                movedToBuffer.sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime());
                movedToBuffer.forEach((r, i) => {
                    const key = `places_lived_${nextPlaceIdx++}`;
                    normalizedRows.push({ ...r, key });
                });

                // Add current_location from last moved_to if missing
                const last = movedToBuffer[movedToBuffer.length - 1];
                const hasCurrent = normalizedRows.some(r => r.key === 'current_location');
                if (!hasCurrent) {
                    normalizedRows.push({ ...last, key: 'current_location' });
                }
            }

            const result = normalizedRows.map((fact: any) => ({
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
                category: this.enhancedCategorizeFactKey(fact.key)
            })) as QuickFact[];

            const processingTime = Date.now() - startTime;
            if (processingTime > 100) {
                console.warn(`Enhanced quick facts retrieval took ${processingTime}ms`);
            }

            return result;
        } catch (error) {
            console.error('Error in enhanced fetchQuickFacts:', error);
            throw error;
        }
    }

    private enhancedCategorizeFactKey(key: string): string | undefined {
        const k = (key || '').toLowerCase();
        if (['full_name', 'nickname', 'birth_date', 'birth_year', 'birthplace', 'birth_place'].includes(k)) return 'identity';
        if (k.startsWith('places_lived') || k.startsWith('moved_to') || ['hometown', 'settled_location', 'current_city', 'current_location'].includes(k)) return 'places_lived';
        if (k.includes('father') || k.includes('mother') || k.includes('parent') || k.includes('partner')) return 'relationships';
        if (k.startsWith('pet') || ['dog', 'cat', 'pets_current', 'pet_name', 'pet_type'].includes(k)) return 'pets';
        if (k.startsWith('service') || k.includes('unit') || k.includes('branch') || k.includes('role')) return 'service';
        if (k.startsWith('hobby') || k === 'hobbies') return 'hobbies';
        if (k.startsWith('favorite') || k.includes('favorite')) return 'favorites';
        return undefined;
    }

    /**
     * Intelligent memory retrieval using semantic understanding
     */
    async fetchRelevantMemoriesIntelligent(
        avatarId: string,
        query: string,
        limit: number = 8,
        demoMode?: {
            isDemo: boolean;
            conversationId?: string;
            visitorId?: string;
        }
    ): Promise<Memory[]> {
        try {

            // Analyze query for intelligent retrieval
            const analysis = IntelligentQueryAnalyzer.analyzeQuery(query);
            
            // Use semantic retriever for enhanced results
            const semanticRetriever = new SemanticMemoryRetriever(this.db);
            const enhancedMemories = await semanticRetriever.retrieveMemories({
                originalQuery: query,
                analysis,
                avatarId,
                limit,
                demoMode
            });
            
            // Convert enhanced memories to standard Memory format
            return enhancedMemories.map(memory => ({
                id: memory.id,
                fragment_text: memory.fragment_text,
                similarity: memory.similarity,
                created_at: memory.created_at,
                gist: memory.gist || memory.fragment_text.substring(0, 200),
                conversation_context: memory.conversation_context
            }));
        } catch (error) {
            console.warn('Intelligent memory retrieval failed, falling back to standard method:', error);
            return this.fetchRelevantMemories(avatarId, query, limit, demoMode);
        }
    }

    /**
     * Enhanced fetchRelevantMemories with geo-aware boosting (fallback method)
     */
    async fetchRelevantMemories(
        avatarId: string,
        query: string,
        limit: number = 8,
        demoMode?: {
            isDemo: boolean;
            conversationId?: string;
            visitorId?: string;
        }
    ): Promise<Memory[]> {
        try {
            const queryLower = (query || '').toLowerCase();

            // Check if this is a geo/place query
            const isGeoQuery = /(?:lived|been|visited|from|in)\s+(?:spain|valencia|france|maine|austin|vancouver|texas|canada)/i.test(query) ||
                /(?:have you|did you|where).*(?:lived|been|visited)/i.test(query);

            // Extract place names from query
            const placePatterns = [
                /\b(spain|valencia|france|croatia|bulgaria|sofia|maine|austin|vancouver|texas|canada|verteillac|europe)\b/gi
            ];
            const mentionedPlaces: string[] = [];
            for (const pattern of placePatterns) {
                const matches = query.match(pattern);
                if (matches) {
                    mentionedPlaces.push(...matches.map(m => m.toLowerCase()));
                }
            }

            // Try RPC search first
            const slug = await this.getEnhancedAvatarSlugById(avatarId);
            if (slug) {
                const { data: rpcData, error: rpcError } = await (this.db as any)
                    .rpc('search_memories', { p_slug: slug, p_query: query || '', p_limit: limit * 2 });

                if (!rpcError && Array.isArray(rpcData)) {
                    let memories = rpcData.map((row: any) => {
                        const ctx = row.conversation_context || {};
                        return {
                            id: row.id,
                            fragment_text: row.fragment_text,
                            similarity: typeof row.score === 'number' ? row.score : undefined,
                            created_at: ctx.created_at || row.created_at || new Date().toISOString(),
                            title: ctx.title || undefined,
                            people: Array.isArray(ctx.people) ? ctx.people : undefined,
                            tags: Array.isArray(ctx.tags) ? ctx.tags : undefined,
                            gist: (ctx.gist || row.fragment_text || '').slice(0, 200),
                            start_date: ctx.start_date || undefined,
                            end_date: ctx.end_date || undefined,
                            year: ctx.year || (ctx.date && ctx.date.year) || undefined,
                            conversation_context: ctx
                        } as Memory;
                    });

                    // Apply demo mode filtering with enhanced logic
                    if (demoMode?.isDemo) {
                        memories = memories.filter((memory: any) => {
                            const ctx = memory.conversation_context || {};
                            
                            // Include global seed memories (identity, bio, language_style, story) with no visitor_id
                            if (['identity', 'bio', 'language_style', 'story'].includes(ctx.ctx_type) && 
                                !ctx.visitor_id && !ctx.conversation_id) {
                                return true;
                            }
                            
                            // Include bio memories with simple context structure (like Tia memory)
                            if (ctx.type === 'bio' && !ctx.visitor_id && !ctx.conversation_id) {
                                return true;
                            }
                            
                            // Include avatar's own memories (personal stories, relationships, experiences)
                            if (ctx.source === 'avatar_personal_memory' || 
                                ctx.tags?.includes('avatar_memory') ||
                                ctx.tags?.includes('personal_story') ||
                                ctx.is_avatar_memory === true) {
                                return true;
                            }
                            
                            // Include visitor-scoped demo memories that haven't expired
                            if (ctx.conversation_id === 'jonathan-demo' && 
                                ctx.visitor_id === demoMode.visitorId &&
                                ctx.expires_at && new Date(ctx.expires_at) > new Date()) {
                                return true;
                            }
                            
                            // Include memories without expiration (permanent avatar memories)
                            if (ctx.conversation_id === 'jonathan-demo' && !ctx.expires_at) {
                                return true;
                            }
                            
                            return false;
                        });
                        
                        console.log(`[EnhancedPromptBuilder] Demo mode: filtered to ${memories.length} memories for query: "${query.substring(0, 50)}"`);
                    } else if (demoMode?.isDemo === false) {
                        // Normal mode: exclude demo memories
                        memories = memories.filter((memory: any) => {
                            const ctx = memory.conversation_context || {};
                            return ctx.conversation_id !== 'jonathan-demo';
                        });
                    }

                    // Geo-aware boosting
                    if (isGeoQuery || mentionedPlaces.length > 0) {
                        // Boost memories that mention places
                        memories = memories.map(memory => {
                            const text = memory.fragment_text.toLowerCase();
                            let boost = 0;

                            // Boost for mentioned places
                            for (const place of mentionedPlaces) {
                                if (text.includes(place)) {
                                    boost += 0.3;
                                }
                            }

                            // Boost for general place indicators
                            if (text.includes('lived') || text.includes('moved') || text.includes('spain') || text.includes('valencia')) {
                                boost += 0.2;
                            }

                            return {
                                ...memory,
                                similarity: (memory.similarity || 0.5) + boost
                            };
                        });

                        // Re-sort by boosted similarity
                        memories.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
                    }

                    return memories.slice(0, limit);
                }
            }

            // Fallback to direct query with enhanced search terms
            const nowIso = new Date().toISOString();
            const term = `%${query}%`;
            const orTerms: string[] = [
                `fragment_text.ilike.${term}`,
                `conversation_context->>title.ilike.${term}`
            ];
            
            // Add specific name/person queries (case-insensitive)
            const namePattern = /\b(who|what|tell me about|about)\s+(is|was|were)\s+(\w+)/i;
            const marriagePattern = /\b(married|marry)\s+(?:to\s+)?(\w+)/i;
            const nameMatch = query.match(namePattern);
            const marriageMatch = query.match(marriagePattern);
            
            if (nameMatch && nameMatch[3]) {
                const name = nameMatch[3].toLowerCase();
                orTerms.push(`fragment_text.ilike.%${name}%`);
                console.log(`[EnhancedPromptBuilder] Added name search for: ${name}`);
            }
            
            if (marriageMatch && marriageMatch[2]) {
                const name = marriageMatch[2].toLowerCase();
                orTerms.push(`fragment_text.ilike.%${name}%`);
                console.log(`[EnhancedPromptBuilder] Added marriage name search for: ${name}`);
            }
            
            // Add individual word searches for better matching
            const words = query.toLowerCase().split(' ').filter(w => w.length > 2);
            for (const word of words.slice(0, 3)) { // Limit to first 3 meaningful words
                orTerms.push(`fragment_text.ilike.%${word}%`);
            }

            // Add geo-specific terms if it's a place query
            if (isGeoQuery || mentionedPlaces.length > 0) {
                const geoTerms = ['spain', 'valencia', 'france', 'croatia', 'bulgaria', 'sofia', 'europe', 'maine', 'austin', 'vancouver', 'lived', 'moved'];
                for (const geoTerm of geoTerms) {
                    orTerms.push(`fragment_text.ilike.%${geoTerm}%`);
                }
            }

            const { data, error } = await this.db
                .from('memory_fragments')
                .select('id, fragment_text, created_at, conversation_context')
                .eq('avatar_id', avatarId)
                .or(orTerms.join(','))
                .order('created_at', { ascending: false })
                .limit(limit * 2);

            if (error) {
                console.error('Error fetching relevant memories (fallback):', error);
                return [];
            }

            let memories = (data || []).map((memory: any) => {
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

            // Apply geo boosting to fallback results too
            if (isGeoQuery || mentionedPlaces.length > 0) {
                memories = memories.map((memory: any) => {
                    const text = memory.fragment_text.toLowerCase();
                    let boost = 0;

                    for (const place of mentionedPlaces) {
                        if (text.includes(place)) {
                            boost += 0.3;
                        }
                    }

                    if (text.includes('lived') || text.includes('moved') || text.includes('spain') || text.includes('valencia')) {
                        boost += 0.2;
                    }

                    return {
                        ...memory,
                        similarity: (memory.similarity || 0.5) + boost
                    };
                });

                memories.sort((a: any, b: any) => (b.similarity || 0) - (a.similarity || 0));
            }

            return memories.slice(0, limit);
        } catch (error) {
            console.error('Error in enhanced fetchRelevantMemories:', error);
            return [];
        }
    }

    /**
     * Get avatar slug from id to support RPCs that key by slug
     */
    private async getEnhancedAvatarSlugById(avatarId: string): Promise<string | null> {
        try {
            // Prefer avatar_profiles.name as slug
            const { data: prof, error: profErr } = await this.db
                .from('avatar_profiles')
                .select('name')
                .eq('id', avatarId)
                .single();
            if (!profErr && prof?.name) return prof.name as string;

            // Fallback to avatars.slug
            const { data, error } = await this.db
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
     * Assemble compact Basics block from quick_facts (≤300 tokens)
     */
    private async assembleBasicsBlock(avatarId: string): Promise<{ basicsBlock: string; factsCount: number; tokensBasics: number }> {
        try {
            // Skip database queries for mock avatars
            if (avatarId.startsWith('mock-')) {
                return { basicsBlock: '', factsCount: 0, tokensBasics: 0 };
            }

            // Fetch quick facts for the 17 core keys
            const { data: facts, error } = await this.db
                .from('quick_facts')
                .select('key, value')
                .eq('avatar_id', avatarId)
                .in('key', QUICK_FACT_KEYS)
                .order('key');

            if (error) {
                console.warn('Error fetching basics facts:', error);
                return { basicsBlock: '', factsCount: 0, tokensBasics: 0 };
            }

            if (!facts || facts.length === 0) {
                return { basicsBlock: '', factsCount: 0, tokensBasics: 0 };
            }

            // Build compact basics block
            const basicsFacts = facts.map((f: any) => `${f.key.replace(/_/g, ' ')}: ${f.value}`);
            const basicsBlock = `BASICS:\n${basicsFacts.join('\n')}`;
            
            // Estimate token count (rough approximation: 1 token ≈ 4 characters)
            const tokensBasics = Math.ceil(basicsBlock.length / 4);
            
            // Truncate if over 300 tokens
            if (tokensBasics > 300) {
                const maxChars = 300 * 4; // 1200 characters
                const truncatedBlock = basicsBlock.substring(0, maxChars) + '...';
                return { 
                    basicsBlock: truncatedBlock, 
                    factsCount: facts.length, 
                    tokensBasics: 300 
                };
            }

            return { 
                basicsBlock, 
                factsCount: facts.length, 
                tokensBasics 
            };
        } catch (error) {
            console.error('Error assembling basics block:', error);
            return { basicsBlock: '', factsCount: 0, tokensBasics: 0 };
        }
    }

    /**
     * Build enhanced system prompt - THE ONLY prompt building method
     * Now supports fastMode for sub-200ms responses with unified pipeline
     */
    async buildEnhancedSystemPromptWithStyle(
        avatarSlug: string,
        query: string,
        conversationHistory: ConversationTurn[] = [],
        options: {
            priorityFilter?: number;
            memoryLimit?: number;
            trackExpressions?: boolean;
            fastMode?: boolean;
            debug?: boolean;
            demoMode?: {
                isDemo: boolean;
                conversationId?: string;
                visitorId?: string;
            };
        } = {}
    ): Promise<{
        prompt: string;
        metadata: {
            facts_count: number;
            memories_count: number;
            conversation_turns: number;
            expressions_available: string[];
            catchphrases_available: string[];
            processing_time_ms: number;
            resolved_entity?: ResolvedEntity | null;
            model_recommendation?: string;
        };
        debug?: {
            factsPreview: string[];
            memoriesPreview: string[];
            historyCount: number;
            resolvedEntity: ResolvedEntity | null;
            promptPreview: string;
        };
    }> {
        const startTime = Date.now();
        const {
            priorityFilter = 10,
            memoryLimit = 8,
            trackExpressions = true,
            fastMode = false,
            debug = false,
            demoMode
        } = options;

        // Fast mode optimizations
        const effectivePriorityFilter = fastMode ? 4 : priorityFilter;
        const effectiveMemoryLimit = fastMode ? 4 : memoryLimit;
        const effectiveHistoryLimit = fastMode ? 6 : 8;

        try {
            // Use the new resolveAvatarId for consistent ID resolution
            let avatarId: string;
            
            // If avatarSlug is already an ID (UUID format), use it directly
            if (avatarSlug && avatarSlug.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
                avatarId = avatarSlug;
            } else {
                // Try to resolve slug to ID
                try {
                    avatarId = await resolveAvatarId(avatarSlug);
                    if (!avatarId) {
                        throw new Error(`Avatar not found: ${avatarSlug}`);
                    }
                } catch (error) {
                    // Fallback for demo mode
                    if (avatarSlug === 'jonathan-demo') {
                        avatarId = '0585f43b-4b49-4e16-b2a7-91c8e1e3850c';
                    } else {
                        throw new Error(`Avatar not found: ${avatarSlug}`);
                    }
                }
            }
            } catch (identityError) {
                console.warn(`Identity resolution failed for ${avatarSlug}, using fallback:`, identityError.message);
                
                // Fallback for known avatars
                if (avatarSlug === 'jonathan-demo' || avatarSlug === 'jonathan_braden' || avatarSlug === 'jonathan') {
                    avatarId = '0585f43b-4b49-4e16-b2a7-91c8e1e3850c';
                    console.log(`Using fallback UUID for ${avatarSlug}: ${avatarId}`);
                } else {
                    throw identityError;
                }
            }

            // Limit conversation history for fast mode
            const limitedHistory = conversationHistory.slice(-effectiveHistoryLimit);

            // Detect query complexity for model recommendation
            const isComplexQuery = query.length > 100 ||
                query.includes('story') ||
                query.includes('explain') ||
                query.includes('tell me about');
            const modelRecommendation = fastMode && !isComplexQuery ? 'gpt-4o-mini' : 'gpt-4o-mini';

            // Check if this is a geo-related query for enhanced retrieval
            const isGeoQuery = this.isGeoQuery(query);

            // Analyze query for intelligent processing
            const queryAnalysis = IntelligentQueryAnalyzer.analyzeQuery(query, limitedHistory);
            
            // Use intelligent model recommendation
            const intelligentModelRecommendation = queryAnalysis.complexity.recommendedModel;
            
            // Parallel data fetching with intelligent optimizations

            // Use intelligent memory retriever for all memory queries
            const intelligentRetriever = new IntelligentMemoryRetriever(this.db);
            
            const [facts, memories, styleProfile, basicsData] = await Promise.all([
                this.fetchTemporalFacts(avatarId, effectivePriorityFilter, fastMode),
                intelligentRetriever.retrieveMemories(avatarId, query, {
                    limit: effectiveMemoryLimit,
                    isGeoQuery,
                    demoMode,
                    minRelevanceScore: fastMode ? 0.3 : 0.2
                }),
                trackExpressions ? this.fetchEnhancedStyleProfile(avatarId) : Promise.resolve({}),
                this.assembleBasicsBlock(avatarId)
            ]);

            // Ensure geo content for place queries
            if (isGeoQuery && !fastMode) {
                await this.ensureGeoContent(avatarId, facts, memories);
            }

            // Entity resolution for better context
            const resolvedEntity = await this.resolveEntityFromName(query, facts, memories, limitedHistory);

            // Build the enhanced system prompt with intelligent context
            // TODO: Complete buildIntelligentSystemPrompt implementation
            const prompt = this.buildUnifiedSystemPrompt(
                facts,
                memories,
                limitedHistory,
                styleProfile,
                resolvedEntity,
                fastMode,
                basicsData.basicsBlock
            );

            const processingTime = Date.now() - startTime;

            // Log telemetry as required
            console.log(`JD_PROMPT {avatar_id: ${avatarId}, facts_count: ${basicsData.factsCount}, tokens_basics: ${basicsData.tokensBasics}}`);

            // Fast mode should complete under 150ms
            if (fastMode && processingTime > 150) {
                console.warn(`Fast mode took ${processingTime}ms - consider further optimization`);
            }

            // Scrub legacy location references
            const scrubbedPrompt = this.scrubLegacyLocation(prompt);

            return {
                prompt: scrubbedPrompt,
                metadata: {
                    facts_count: facts.length,
                    memories_count: memories.length,
                    conversation_turns: limitedHistory.length,
                    expressions_available: Object.keys((styleProfile as EnhancedStyleProfile).expressions || {}),
                    catchphrases_available: Object.keys((styleProfile as EnhancedStyleProfile).catchphrases || {}),
                    processing_time_ms: processingTime,
                    resolved_entity: resolvedEntity,
                    model_recommendation: intelligentModelRecommendation || modelRecommendation,
                    query_analysis: {
                        intent: queryAnalysis.intent,
                        complexity: queryAnalysis.complexity.level,
                        entities_found: queryAnalysis.entities.length,
                        emotional_tone: queryAnalysis.emotionalTone.primary
                    }
                },
                debug: debug ? {
                    factsPreview: facts.slice(0, 5).map(f => `${f.key}: ${f.value}`),
                    memoriesPreview: memories.slice(0, 3).map(m => m.fragment_text.substring(0, 100)),
                    historyCount: limitedHistory.length,
                    resolvedEntity,
                    promptPreview: scrubbedPrompt.substring(0, 500)
                } : undefined
            };
        } catch (error) {
            console.error('Error in buildEnhancedSystemPromptWithStyle:', error);
            throw error;
        }
    }
