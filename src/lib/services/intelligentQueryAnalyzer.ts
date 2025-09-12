/**
 * Intelligent Query Analyzer
 * Provides advanced query understanding and context extraction for avatar conversations
 */

export interface QueryAnalysis {
    intent: QueryIntent;
    entities: ExtractedEntity[];
    temporalContext: TemporalContext | null;
    emotionalTone: EmotionalTone;
    complexity: QueryComplexity;
    searchTerms: SearchTerms;
    responseHints: ResponseHint[];
}

export interface QueryIntent {
    primary: 'question' | 'statement' | 'request' | 'greeting' | 'story_request' | 'relationship_inquiry' | 'memory_probe';
    secondary?: 'factual' | 'personal' | 'emotional' | 'historical' | 'hypothetical';
    confidence: number;
}

export interface ExtractedEntity {
    text: string;
    type: 'person' | 'place' | 'time' | 'event' | 'relationship' | 'emotion' | 'object';
    aliases: string[];
    context: string;
    confidence: number;
}

export interface TemporalContext {
    timeframe: 'past' | 'present' | 'future' | 'ongoing' | 'unspecified';
    specificity: 'exact' | 'approximate' | 'relative' | 'vague';
    indicators: string[];
}

export interface EmotionalTone {
    primary: 'neutral' | 'positive' | 'negative' | 'curious' | 'concerned' | 'playful';
    intensity: 'low' | 'medium' | 'high';
    indicators: string[];
}

export interface QueryComplexity {
    level: 'simple' | 'moderate' | 'complex' | 'multi_part';
    factors: string[];
    recommendedModel: 'gpt-4o-mini' | 'gpt-4o';
}

export interface SearchTerms {
    primary: string[];
    secondary: string[];
    semantic: string[];
    exclusions: string[];
}

export interface ResponseHint {
    type: 'memory_focus' | 'fact_focus' | 'story_mode' | 'detail_level' | 'tone_adjustment';
    value: string;
    priority: number;
}

export class IntelligentQueryAnalyzer {
    
    /**
     * Analyze a user query for comprehensive understanding
     */
    static analyzeQuery(query: string, conversationHistory: any[] = []): QueryAnalysis {
        const queryLower = query.toLowerCase().trim();
        
        return {
            intent: this.analyzeIntent(query, conversationHistory),
            entities: this.extractEntities(query),
            temporalContext: this.analyzeTemporalContext(query),
            emotionalTone: this.analyzeEmotionalTone(query),
            complexity: this.analyzeComplexity(query),
            searchTerms: this.generateSearchTerms(query),
            responseHints: this.generateResponseHints(query, conversationHistory)
        };
    }

    /**
     * Analyze user intent with context awareness
     */
    private static analyzeIntent(query: string, history: any[]): QueryIntent {
        const queryLower = query.toLowerCase();
        
        // Relationship inquiry patterns
        const relationshipPatterns = [
            /\b(married|wife|husband|partner|girlfriend|boyfriend|dating|relationship|together)\b/i,
            /\b(family|mother|father|parent|sibling|brother|sister|child|kids)\b/i,
            /\b(friend|buddy|pal|colleague|coworker)\b/i
        ];
        
        // Memory probe patterns
        const memoryPatterns = [
            /\b(remember|recall|think back|what about|tell me about|do you know)\b/i,
            /\b(have you|did you|were you|was there|what happened)\b/i,
            /\b(experience|story|time when|moment|memory)\b/i
        ];
        
        // Story request patterns
        const storyPatterns = [
            /\b(tell me|story|explain|describe|what was it like)\b/i,
            /\b(how did|what happened|walk me through)\b/i
        ];
        
        // Question patterns
        const questionPatterns = [
            /^(who|what|when|where|why|how|which|whose|whom)\b/i,
            /\?$/,
            /\b(is|are|was|were|do|does|did|can|could|would|will)\b.*\?/i
        ];

        let primary: QueryIntent['primary'] = 'statement';
        let secondary: QueryIntent['secondary'] | undefined;
        let confidence = 0.5;

        // Determine primary intent
        if (relationshipPatterns.some(p => p.test(queryLower))) {
            primary = 'relationship_inquiry';
            confidence = 0.8;
        } else if (memoryPatterns.some(p => p.test(queryLower))) {
            primary = 'memory_probe';
            confidence = 0.8;
        } else if (storyPatterns.some(p => p.test(queryLower))) {
            primary = 'story_request';
            confidence = 0.8;
        } else if (questionPatterns.some(p => p.test(queryLower))) {
            primary = 'question';
            confidence = 0.7;
        }

        // Determine secondary intent
        if (/\b(feel|felt|emotion|happy|sad|excited|worried|love|hate)\b/i.test(queryLower)) {
            secondary = 'emotional';
        } else if (/\b(when|where|what year|how long|age|time)\b/i.test(queryLower)) {
            secondary = 'factual';
        } else if (/\b(personal|private|intimate|close|special)\b/i.test(queryLower)) {
            secondary = 'personal';
        } else if (/\b(used to|back then|before|previously|in the past)\b/i.test(queryLower)) {
            secondary = 'historical';
        }

        return { primary, secondary, confidence };
    }

    /**
     * Extract entities with enhanced recognition
     */
    private static extractEntities(query: string): ExtractedEntity[] {
        const entities: ExtractedEntity[] = [];
        const queryLower = query.toLowerCase();

        // Person name patterns (enhanced)
        const personPatterns = [
            /\b(married|dating|with|to|about|from)\s+([A-Z][a-z]+)\b/g,
            /\b([A-Z][a-z]+)(?:\s+[A-Z][a-z]+)?\s+(?:is|was|were|and)\b/g,
            /\bwho\s+(?:is|was|were)\s+([A-Z][a-z]+)\b/gi,
            /\btell\s+me\s+about\s+([A-Z][a-z]+)\b/gi
        ];

        personPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(query)) !== null) {
                const name = match[1] || match[2];
                if (name && name.length > 1) {
                    entities.push({
                        text: name,
                        type: 'person',
                        aliases: [name.toLowerCase(), name],
                        context: `Person mentioned in query: "${match[0]}"`,
                        confidence: 0.8
                    });
                }
            }
        });

        // Place patterns
        const placePatterns = [
            /\b(lived|live|living|been|visited|from|in|at|to)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g,
            /\b(Spain|Valencia|France|Maine|Austin|Vancouver|Texas|Canada|Croatia|Bulgaria|Sofia|Europe)\b/gi
        ];

        placePatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(query)) !== null) {
                const place = match[1] || match[0];
                entities.push({
                    text: place,
                    type: 'place',
                    aliases: [place.toLowerCase(), place],
                    context: `Place mentioned in query`,
                    confidence: 0.7
                });
            }
        });

        // Relationship patterns
        const relationshipPatterns = [
            /\b(wife|husband|partner|girlfriend|boyfriend|spouse|married|marriage)\b/gi,
            /\b(mother|father|parent|mom|dad|family|sibling|brother|sister)\b/gi,
            /\b(friend|buddy|colleague|coworker|neighbor)\b/gi
        ];

        relationshipPatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(query)) !== null) {
                entities.push({
                    text: match[0],
                    type: 'relationship',
                    aliases: [match[0].toLowerCase()],
                    context: `Relationship type mentioned`,
                    confidence: 0.9
                });
            }
        });

        // Time/temporal patterns
        const timePatterns = [
            /\b(yesterday|today|tomorrow|now|then|before|after|during|while)\b/gi,
            /\b(\d+)\s+(years?|months?|weeks?|days?)\s+(ago|old|back)\b/gi,
            /\b(when|what\s+year|how\s+long|age)\b/gi
        ];

        timePatterns.forEach(pattern => {
            let match;
            while ((match = pattern.exec(query)) !== null) {
                entities.push({
                    text: match[0],
                    type: 'time',
                    aliases: [match[0].toLowerCase()],
                    context: `Temporal reference`,
                    confidence: 0.8
                });
            }
        });

        return entities;
    }

    /**
     * Analyze temporal context
     */
    private static analyzeTemporalContext(query: string): TemporalContext | null {
        const queryLower = query.toLowerCase();
        
        const pastIndicators = ['was', 'were', 'had', 'did', 'used to', 'back then', 'before', 'previously', 'ago', 'married'];
        const presentIndicators = ['is', 'are', 'have', 'do', 'currently', 'now', 'today'];
        const futureIndicators = ['will', 'going to', 'plan to', 'hope to', 'tomorrow', 'next'];
        
        const pastCount = pastIndicators.filter(ind => queryLower.includes(ind)).length;
        const presentCount = presentIndicators.filter(ind => queryLower.includes(ind)).length;
        const futureCount = futureIndicators.filter(ind => queryLower.includes(ind)).length;
        
        let timeframe: TemporalContext['timeframe'] = 'unspecified';
        let indicators: string[] = [];
        
        if (pastCount > presentCount && pastCount > futureCount) {
            timeframe = 'past';
            indicators = pastIndicators.filter(ind => queryLower.includes(ind));
        } else if (presentCount > pastCount && presentCount > futureCount) {
            timeframe = 'present';
            indicators = presentIndicators.filter(ind => queryLower.includes(ind));
        } else if (futureCount > 0) {
            timeframe = 'future';
            indicators = futureIndicators.filter(ind => queryLower.includes(ind));
        }
        
        // Determine specificity
        let specificity: TemporalContext['specificity'] = 'vague';
        if (/\d+\s+(years?|months?|days?)/i.test(query)) {
            specificity = 'exact';
        } else if (/\b(recently|lately|soon|earlier|later)\b/i.test(query)) {
            specificity = 'relative';
        } else if (indicators.length > 0) {
            specificity = 'approximate';
        }
        
        return timeframe !== 'unspecified' ? { timeframe, specificity, indicators } : null;
    }

    /**
     * Analyze emotional tone
     */
    private static analyzeEmotionalTone(query: string): EmotionalTone {
        const queryLower = query.toLowerCase();
        
        const positiveWords = ['love', 'happy', 'great', 'wonderful', 'amazing', 'good', 'nice', 'beautiful', 'fun', 'enjoy'];
        const negativeWords = ['sad', 'bad', 'terrible', 'awful', 'hate', 'angry', 'upset', 'worried', 'difficult', 'hard'];
        const curiousWords = ['wonder', 'curious', 'interested', 'tell me', 'what about', 'how about'];
        const playfulWords = ['haha', 'lol', 'funny', 'joke', 'kidding', '😊', '😄', '😂'];
        
        const positiveCount = positiveWords.filter(w => queryLower.includes(w)).length;
        const negativeCount = negativeWords.filter(w => queryLower.includes(w)).length;
        const curiousCount = curiousWords.filter(w => queryLower.includes(w)).length;
        const playfulCount = playfulWords.filter(w => queryLower.includes(w)).length;
        
        let primary: EmotionalTone['primary'] = 'neutral';
        let intensity: EmotionalTone['intensity'] = 'low';
        let indicators: string[] = [];
        
        if (positiveCount > 0) {
            primary = 'positive';
            indicators = positiveWords.filter(w => queryLower.includes(w));
            intensity = positiveCount > 2 ? 'high' : positiveCount > 1 ? 'medium' : 'low';
        } else if (negativeCount > 0) {
            primary = 'negative';
            indicators = negativeWords.filter(w => queryLower.includes(w));
            intensity = negativeCount > 2 ? 'high' : negativeCount > 1 ? 'medium' : 'low';
        } else if (curiousCount > 0) {
            primary = 'curious';
            indicators = curiousWords.filter(w => queryLower.includes(w));
            intensity = 'medium';
        } else if (playfulCount > 0) {
            primary = 'playful';
            indicators = playfulWords.filter(w => queryLower.includes(w));
            intensity = 'medium';
        }
        
        return { primary, intensity, indicators };
    }

    /**
     * Analyze query complexity
     */
    private static analyzeComplexity(query: string): QueryComplexity {
        const factors: string[] = [];
        let level: QueryComplexity['level'] = 'simple';
        
        // Length factor
        if (query.length > 100) {
            factors.push('long_query');
            level = 'moderate';
        }
        
        // Multiple questions
        if ((query.match(/\?/g) || []).length > 1) {
            factors.push('multiple_questions');
            level = 'complex';
        }
        
        // Complex sentence structure
        if (/\b(and|but|however|although|because|since|while|whereas)\b/i.test(query)) {
            factors.push('complex_structure');
            level = level === 'simple' ? 'moderate' : 'complex';
        }
        
        // Story request indicators
        if (/\b(tell me about|explain|describe|story|experience|what was it like)\b/i.test(query)) {
            factors.push('story_request');
            level = 'complex';
        }
        
        // Multiple entities
        const entityCount = (query.match(/\b[A-Z][a-z]+\b/g) || []).length;
        if (entityCount > 2) {
            factors.push('multiple_entities');
            level = level === 'simple' ? 'moderate' : 'complex';
        }
        
        // Emotional complexity
        if (/\b(feel|felt|emotion|relationship|personal|intimate)\b/i.test(query)) {
            factors.push('emotional_content');
            level = level === 'simple' ? 'moderate' : 'complex';
        }
        
        const recommendedModel = level === 'complex' ? 'gpt-4o' : 'gpt-4o-mini';
        
        return { level, factors, recommendedModel };
    }

    /**
     * Generate intelligent search terms
     */
    private static generateSearchTerms(query: string): SearchTerms {
        const queryLower = query.toLowerCase();
        const words = queryLower.split(/\s+/).filter(w => w.length > 2);
        
        // Primary terms (most important)
        const primary: string[] = [];
        const secondary: string[] = [];
        const semantic: string[] = [];
        const exclusions: string[] = [];
        
        // Extract names and important nouns
        const nameMatches = query.match(/\b[A-Z][a-z]+\b/g) || [];
        primary.push(...nameMatches.map(n => n.toLowerCase()));
        
        // Important relationship words
        const relationshipWords = ['married', 'wife', 'husband', 'girlfriend', 'boyfriend', 'partner', 'family', 'friend'];
        relationshipWords.forEach(word => {
            if (queryLower.includes(word)) {
                primary.push(word);
            }
        });
        
        // Important action words
        const actionWords = ['lived', 'moved', 'worked', 'studied', 'traveled', 'met', 'married'];
        actionWords.forEach(word => {
            if (queryLower.includes(word)) {
                primary.push(word);
            }
        });
        
        // Secondary terms (context words)
        const contextWords = words.filter(w => 
            !primary.includes(w) && 
            !['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'].includes(w)
        );
        secondary.push(...contextWords.slice(0, 5));
        
        // Semantic expansions
        if (primary.includes('married') || primary.includes('wife') || primary.includes('husband')) {
            semantic.push('marriage', 'wedding', 'spouse', 'relationship', 'together');
        }
        
        if (primary.includes('lived') || primary.includes('moved')) {
            semantic.push('home', 'house', 'city', 'place', 'location');
        }
        
        // Common exclusions for noise reduction
        exclusions.push('you', 'your', 'were', 'was', 'are', 'is', 'have', 'has', 'did', 'do');
        
        return {
            primary: [...new Set(primary)],
            secondary: [...new Set(secondary)],
            semantic: [...new Set(semantic)],
            exclusions
        };
    }

    /**
     * Generate response hints for better avatar responses
     */
    private static generateResponseHints(query: string, history: any[]): ResponseHint[] {
        const hints: ResponseHint[] = [];
        const queryLower = query.toLowerCase();
        
        // Memory focus hints
        if (/\b(remember|recall|what about|tell me about)\b/i.test(query)) {
            hints.push({
                type: 'memory_focus',
                value: 'prioritize_personal_memories',
                priority: 9
            });
        }
        
        // Story mode hints
        if (/\b(tell me|story|explain|describe|what was it like|experience)\b/i.test(query)) {
            hints.push({
                type: 'story_mode',
                value: 'narrative_response',
                priority: 8
            });
        }
        
        // Detail level hints
        if (query.length > 50 || /\b(details|specifically|exactly|thoroughly)\b/i.test(query)) {
            hints.push({
                type: 'detail_level',
                value: 'comprehensive',
                priority: 7
            });
        } else if (query.length < 20) {
            hints.push({
                type: 'detail_level',
                value: 'concise',
                priority: 6
            });
        }
        
        // Tone adjustment hints
        if (/\b(personal|intimate|private|close)\b/i.test(query)) {
            hints.push({
                type: 'tone_adjustment',
                value: 'warm_personal',
                priority: 8
            });
        }
        
        if (/\?$/.test(query.trim())) {
            hints.push({
                type: 'tone_adjustment',
                value: 'direct_answer',
                priority: 7
            });
        }
        
        return hints.sort((a, b) => b.priority - a.priority);
    }
}