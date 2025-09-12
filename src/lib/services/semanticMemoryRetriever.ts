/**
 * Semantic Memory Retriever
 * Advanced memory retrieval using semantic understanding and context awareness
 */

import { QueryAnalysis, ExtractedEntity } from './intelligentQueryAnalyzer';

export interface SemanticMemoryQuery {
    originalQuery: string;
    analysis: QueryAnalysis;
    avatarId: string;
    limit: number;
    demoMode?: {
        isDemo: boolean;
        conversationId?: string;
        visitorId?: string;
    };
}

export interface EnhancedMemory {
    id: string;
    fragment_text: string;
    similarity: number;
    relevance_score: number;
    context_match: string[];
    entity_matches: string[];
    temporal_match: boolean;
    created_at: string;
    conversation_context?: any;
    gist?: string;
    boost_factors: string[];
}

export interface MemoryRetrievalStrategy {
    name: string;
    weight: number;
    searchTerms: string[];
    filters: any[];
}

export class SemanticMemoryRetriever {
    private db: any;

    constructor(dbClient: any) {
        this.db = dbClient;
    }

    /**
     * Retrieve memories using semantic understanding
     */
    async retrieveMemories(query: SemanticMemoryQuery): Promise<EnhancedMemory[]> {
        const { originalQuery, analysis, avatarId, limit, demoMode } = query;
        
        // Generate multiple retrieval strategies
        const strategies = this.generateRetrievalStrategies(analysis);
        
        // Execute strategies in parallel
        const strategyResults = await Promise.all(
            strategies.map(strategy => this.executeStrategy(strategy, avatarId, limit * 2, demoMode))
        );
        
        // Merge and deduplicate results
        const allMemories = this.mergeStrategyResults(strategyResults, strategies);
        
        // Apply semantic scoring
        const scoredMemories = this.applySemanticScoring(allMemories, analysis);
        
        // Apply contextual boosting
        const boostedMemories = this.applyContextualBoosting(scoredMemories, analysis);
        
        // Filter and rank final results
        const finalMemories = this.rankAndFilter(boostedMemories, analysis, limit);
        
        console.log(`[SemanticMemoryRetriever] Retrieved ${finalMemories.length} memories using ${strategies.length} strategies`);
        
        return finalMemories;
    }

    /**
     * Generate multiple retrieval strategies based on query analysis
     */
    private generateRetrievalStrategies(analysis: QueryAnalysis): MemoryRetrievalStrategy[] {
        const strategies: MemoryRetrievalStrategy[] = [];
        
        // Strategy 1: Entity-focused search
        if (analysis.entities.length > 0) {
            const entityTerms = analysis.entities.flatMap(e => e.aliases);
            strategies.push({
                name: 'entity_focused',
                weight: 0.9,
                searchTerms: entityTerms,
                filters: []
            });
        }
        
        // Strategy 2: Primary search terms
        strategies.push({
            name: 'primary_terms',
            weight: 0.8,
            searchTerms: analysis.searchTerms.primary,
            filters: []
        });
        
        // Strategy 3: Semantic expansion
        if (analysis.searchTerms.semantic.length > 0) {
            strategies.push({
                name: 'semantic_expansion',
                weight: 0.7,
                searchTerms: analysis.searchTerms.semantic,
                filters: []
            });
        }
        
        // Strategy 4: Relationship-focused (for relationship queries)
        if (analysis.intent.primary === 'relationship_inquiry') {
            const relationshipTerms = [
                'married', 'marriage', 'wife', 'husband', 'partner', 'girlfriend', 'boyfriend',
                'relationship', 'together', 'dating', 'love', 'family', 'friend'
            ];
            strategies.push({
                name: 'relationship_focused',
                weight: 0.85,
                searchTerms: relationshipTerms,
                filters: []
            });
        }
        
        // Strategy 5: Temporal-focused (for time-based queries)
        if (analysis.temporalContext) {
            const temporalTerms = analysis.temporalContext.indicators;
            strategies.push({
                name: 'temporal_focused',
                weight: 0.75,
                searchTerms: temporalTerms,
                filters: []
            });
        }
        
        // Strategy 6: Bio/identity search (for personal queries)
        if (analysis.intent.secondary === 'personal' || analysis.intent.primary === 'memory_probe') {
            strategies.push({
                name: 'bio_identity',
                weight: 0.8,
                searchTerms: ['bio', 'identity', 'personal', 'life', 'story'],
                filters: [{ context_type: 'bio' }]
            });
        }
        
        return strategies;
    }

    /**
     * Execute a single retrieval strategy
     */
    private async executeStrategy(
        strategy: MemoryRetrievalStrategy,
        avatarId: string,
        limit: number,
        demoMode?: any
    ): Promise<{ memories: any[], strategy: string }> {
        try {
            // Build OR conditions for search terms
            const orConditions = strategy.searchTerms.map(term => 
                `fragment_text.ilike.%${term}%`
            );
            
            if (orConditions.length === 0) {
                return { memories: [], strategy: strategy.name };
            }
            
            let query = this.db
                .from('memory_fragments')
                .select('id, fragment_text, created_at, conversation_context')
                .eq('avatar_id', avatarId)
                .or(orConditions.join(','));
            
            // Apply demo mode filtering
            if (demoMode?.isDemo) {
                query = query.limit(limit * 2); // Fetch more for filtering
            } else if (demoMode?.isDemo === false) {
                query = query.not('conversation_context->>conversation_id', 'eq', 'jonathan-demo');
            }
            
            const { data, error } = await query
                .order('created_at', { ascending: false })
                .limit(limit);
            
            if (error) {
                console.warn(`Strategy ${strategy.name} failed:`, error);
                return { memories: [], strategy: strategy.name };
            }
            
            let memories = data || [];
            
            // Apply demo mode filtering in memory
            if (demoMode?.isDemo) {
                memories = memories.filter((memory: any) => {
                    const ctx = memory.conversation_context || {};
                    
                    // Include global seed memories
                    if (['identity', 'bio', 'language_style', 'story'].includes(ctx.ctx_type) && 
                        !ctx.visitor_id && !ctx.conversation_id) {
                        return true;
                    }
                    
                    // Include bio memories with simple context structure
                    if (ctx.type === 'bio' && !ctx.visitor_id && !ctx.conversation_id) {
                        return true;
                    }
                    
                    // Include avatar's own memories
                    if (ctx.source === 'avatar_personal_memory' || 
                        ctx.tags?.includes('avatar_memory') ||
                        ctx.tags?.includes('personal_story') ||
                        ctx.is_avatar_memory === true) {
                        return true;
                    }
                    
                    // Include visitor-scoped demo memories
                    if (ctx.conversation_id === 'jonathan-demo' && 
                        ctx.visitor_id === demoMode.visitorId &&
                        ctx.expires_at && new Date(ctx.expires_at) > new Date()) {
                        return true;
                    }
                    
                    // Include permanent demo memories
                    if (ctx.conversation_id === 'jonathan-demo' && !ctx.expires_at) {
                        return true;
                    }
                    
                    return false;
                });
            }
            
            return { memories, strategy: strategy.name };
        } catch (error) {
            console.warn(`Strategy ${strategy.name} error:`, error);
            return { memories: [], strategy: strategy.name };
        }
    }

    /**
     * Merge results from multiple strategies
     */
    private mergeStrategyResults(
        results: { memories: any[], strategy: string }[],
        strategies: MemoryRetrievalStrategy[]
    ): EnhancedMemory[] {
        const memoryMap = new Map<string, EnhancedMemory>();
        
        results.forEach(({ memories, strategy }) => {
            const strategyConfig = strategies.find(s => s.name === strategy);
            const weight = strategyConfig?.weight || 0.5;
            
            memories.forEach(memory => {
                const existing = memoryMap.get(memory.id);
                
                if (existing) {
                    // Boost existing memory
                    existing.relevance_score += weight * 0.3;
                    existing.boost_factors.push(`${strategy}_boost`);
                } else {
                    // Add new memory
                    memoryMap.set(memory.id, {
                        id: memory.id,
                        fragment_text: memory.fragment_text,
                        similarity: 0.5, // Base similarity
                        relevance_score: weight,
                        context_match: [strategy],
                        entity_matches: [],
                        temporal_match: false,
                        created_at: memory.created_at,
                        conversation_context: memory.conversation_context,
                        gist: memory.fragment_text.substring(0, 200),
                        boost_factors: [strategy]
                    });
                }
            });
        });
        
        return Array.from(memoryMap.values());
    }

    /**
     * Apply semantic scoring based on query analysis
     */
    private applySemanticScoring(memories: EnhancedMemory[], analysis: QueryAnalysis): EnhancedMemory[] {
        return memories.map(memory => {
            const text = memory.fragment_text.toLowerCase();
            let semanticScore = memory.relevance_score;
            
            // Entity matching bonus
            analysis.entities.forEach(entity => {
                entity.aliases.forEach(alias => {
                    if (text.includes(alias.toLowerCase())) {
                        semanticScore += 0.3;
                        memory.entity_matches.push(alias);
                        memory.boost_factors.push(`entity_match_${entity.type}`);
                    }
                });
            });
            
            // Temporal context matching
            if (analysis.temporalContext) {
                const hasTemporalMatch = analysis.temporalContext.indicators.some(indicator => 
                    text.includes(indicator.toLowerCase())
                );
                if (hasTemporalMatch) {
                    semanticScore += 0.2;
                    memory.temporal_match = true;
                    memory.boost_factors.push('temporal_match');
                }
            }
            
            // Intent-specific scoring
            switch (analysis.intent.primary) {
                case 'relationship_inquiry':
                    if (/\b(married|wife|husband|partner|girlfriend|boyfriend|relationship|together|dating|love)\b/i.test(text)) {
                        semanticScore += 0.4;
                        memory.boost_factors.push('relationship_content');
                    }
                    break;
                    
                case 'memory_probe':
                    if (/\b(remember|recall|memory|experience|story|happened|time)\b/i.test(text)) {
                        semanticScore += 0.3;
                        memory.boost_factors.push('memory_content');
                    }
                    break;
                    
                case 'story_request':
                    if (text.length > 100) { // Longer memories likely contain stories
                        semanticScore += 0.2;
                        memory.boost_factors.push('story_length');
                    }
                    break;
            }
            
            // Emotional tone matching
            if (analysis.emotionalTone.primary !== 'neutral') {
                const emotionalWords = analysis.emotionalTone.indicators;
                const hasEmotionalMatch = emotionalWords.some(word => text.includes(word));
                if (hasEmotionalMatch) {
                    semanticScore += 0.15;
                    memory.boost_factors.push('emotional_match');
                }
            }
            
            memory.similarity = Math.min(1.0, semanticScore);
            return memory;
        });
    }

    /**
     * Apply contextual boosting based on memory context
     */
    private applyContextualBoosting(memories: EnhancedMemory[], analysis: QueryAnalysis): EnhancedMemory[] {
        return memories.map(memory => {
            const ctx = memory.conversation_context || {};
            let boost = 0;
            
            // Bio/identity memories get priority for personal queries
            if ((ctx.ctx_type === 'bio' || ctx.type === 'bio') && 
                (analysis.intent.secondary === 'personal' || analysis.intent.primary === 'memory_probe')) {
                boost += 0.3;
                memory.boost_factors.push('bio_priority');
            }
            
            // Recent memories get slight boost for ongoing conversations
            const memoryAge = Date.now() - new Date(memory.created_at).getTime();
            const daysSinceCreated = memoryAge / (1000 * 60 * 60 * 24);
            if (daysSinceCreated < 7) {
                boost += 0.1;
                memory.boost_factors.push('recent_memory');
            }
            
            // High-confidence memories get boost
            if (ctx.confidence && ctx.confidence > 0.8) {
                boost += 0.2;
                memory.boost_factors.push('high_confidence');
            }
            
            // Personal story memories get boost for story requests
            if (ctx.tags?.includes('personal_story') && analysis.intent.primary === 'story_request') {
                boost += 0.25;
                memory.boost_factors.push('personal_story');
            }
            
            memory.similarity = Math.min(1.0, memory.similarity + boost);
            return memory;
        });
    }

    /**
     * Rank and filter final results
     */
    private rankAndFilter(memories: EnhancedMemory[], analysis: QueryAnalysis, limit: number): EnhancedMemory[] {
        // Sort by similarity score (descending)
        const sorted = memories.sort((a, b) => b.similarity - a.similarity);
        
        // Apply minimum relevance threshold
        const minThreshold = analysis.complexity.level === 'simple' ? 0.3 : 0.4;
        const filtered = sorted.filter(memory => memory.similarity >= minThreshold);
        
        // Ensure diversity in results (avoid too many similar memories)
        const diverse = this.ensureDiversity(filtered, limit);
        
        // Log top results for debugging
        if (diverse.length > 0) {
            console.log(`[SemanticMemoryRetriever] Top memory: "${diverse[0].fragment_text.substring(0, 100)}..." (score: ${diverse[0].similarity.toFixed(3)})`);
        }
        
        return diverse.slice(0, limit);
    }

    /**
     * Ensure diversity in memory results
     */
    private ensureDiversity(memories: EnhancedMemory[], limit: number): EnhancedMemory[] {
        if (memories.length <= limit) return memories;
        
        const diverse: EnhancedMemory[] = [];
        const used = new Set<string>();
        
        for (const memory of memories) {
            if (diverse.length >= limit) break;
            
            // Check for similarity with already selected memories
            const isDuplicate = diverse.some(existing => {
                const similarity = this.calculateTextSimilarity(
                    memory.fragment_text.toLowerCase(),
                    existing.fragment_text.toLowerCase()
                );
                return similarity > 0.8; // 80% similarity threshold
            });
            
            if (!isDuplicate) {
                diverse.push(memory);
            }
        }
        
        // Fill remaining slots if needed
        while (diverse.length < limit && diverse.length < memories.length) {
            const remaining = memories.filter(m => !diverse.includes(m));
            if (remaining.length > 0) {
                diverse.push(remaining[0]);
            } else {
                break;
            }
        }
        
        return diverse;
    }

    /**
     * Calculate text similarity between two strings
     */
    private calculateTextSimilarity(text1: string, text2: string): number {
        const words1 = new Set(text1.split(/\s+/));
        const words2 = new Set(text2.split(/\s+/));
        
        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);
        
        return intersection.size / union.size;
    }
}