/**
 * Intelligent Fact Extractor
 * Advanced fact extraction and relationship mapping for avatar conversations
 */

import { QueryAnalysis, ExtractedEntity } from './intelligentQueryAnalyzer';

export interface ExtractedFact {
    key: string;
    value: string;
    confidence: number;
    source: string;
    category: FactCategory;
    relationships: FactRelationship[];
    temporal_context?: string;
    verification_status: 'verified' | 'inferred' | 'uncertain';
}

export interface FactRelationship {
    type: 'supports' | 'contradicts' | 'extends' | 'references';
    target_fact_key: string;
    confidence: number;
}

export type FactCategory = 
    | 'identity' 
    | 'relationships' 
    | 'places_lived' 
    | 'career' 
    | 'education' 
    | 'family' 
    | 'pets' 
    | 'hobbies' 
    | 'preferences' 
    | 'experiences' 
    | 'personality'
    | 'physical'
    | 'temporal';

export interface FactExtractionContext {
    query: string;
    analysis: QueryAnalysis;
    existingFacts: any[];
    conversationHistory: any[];
    avatarId: string;
}

export class IntelligentFactExtractor {
    
    /**
     * Extract facts from conversation with intelligent analysis
     */
    static extractFacts(context: FactExtractionContext): ExtractedFact[] {
        const { query, analysis, existingFacts } = context;
        const facts: ExtractedFact[] = [];
        
        // Extract different types of facts based on query analysis
        facts.push(...this.extractIdentityFacts(query, analysis));
        facts.push(...this.extractRelationshipFacts(query, analysis));
        facts.push(...this.extractLocationFacts(query, analysis));
        facts.push(...this.extractTemporalFacts(query, analysis));
        facts.push(...this.extractPreferenceFacts(query, analysis));
        facts.push(...this.extractExperienceFacts(query, analysis));
        
        // Validate and enhance facts
        const validatedFacts = this.validateFacts(facts, existingFacts);
        const enhancedFacts = this.enhanceWithRelationships(validatedFacts, existingFacts);
        
        return enhancedFacts;
    }

    /**
     * Extract identity-related facts
     */
    private static extractIdentityFacts(query: string, analysis: QueryAnalysis): ExtractedFact[] {
        const facts: ExtractedFact[] = [];
        const queryLower = query.toLowerCase();
        
        // Name extraction
        const namePatterns = [
            /my name is ([A-Z][a-z]+(?: [A-Z][a-z]+)*)/i,
            /i'm ([A-Z][a-z]+(?: [A-Z][a-z]+)*)/i,
            /call me ([A-Z][a-z]+)/i
        ];
        
        namePatterns.forEach(pattern => {
            const match = query.match(pattern);
            if (match) {
                facts.push({
                    key: 'full_name',
                    value: match[1],
                    confidence: 0.9,
                    source: 'user_statement',
                    category: 'identity',
                    relationships: [],
                    verification_status: 'verified'
                });
            }
        });
        
        // Age extraction
        const agePatterns = [
            /i am (\d+) years old/i,
            /i'm (\d+)/i,
            /(\d+) years old/i
        ];
        
        agePatterns.forEach(pattern => {
            const match = query.match(pattern);
            if (match) {
                const age = parseInt(match[1]);
                if (age > 0 && age < 120) {
                    facts.push({
                        key: 'age',
                        value: age.toString(),
                        confidence: 0.8,
                        source: 'user_statement',
                        category: 'identity',
                        relationships: [],
                        verification_status: 'verified'
                    });
                }
            }
        });
        
        // Profession extraction
        const professionPatterns = [
            /i work as (?:a |an )?([a-z ]+)/i,
            /i'm (?:a |an )?([a-z ]+) by profession/i,
            /my job is ([a-z ]+)/i,
            /i am (?:a |an )?([a-z ]+)/i
        ];
        
        professionPatterns.forEach(pattern => {
            const match = query.match(pattern);
            if (match) {
                const profession = match[1].trim();
                if (profession.length > 2 && profession.length < 50) {
                    facts.push({
                        key: 'profession',
                        value: profession,
                        confidence: 0.7,
                        source: 'user_statement',
                        category: 'career',
                        relationships: [],
                        verification_status: 'verified'
                    });
                }
            }
        });
        
        return facts;
    }

    /**
     * Extract relationship facts
     */
    private static extractRelationshipFacts(query: string, analysis: QueryAnalysis): ExtractedFact[] {
        const facts: ExtractedFact[] = [];
        const queryLower = query.toLowerCase();
        
        // Marriage/partnership facts
        const marriagePatterns = [
            /i (?:am |was )?married to ([A-Z][a-z]+)/i,
            /my (?:wife|husband) is ([A-Z][a-z]+)/i,
            /my (?:wife|husband)'s name is ([A-Z][a-z]+)/i,
            /i have a (?:wife|husband) named ([A-Z][a-z]+)/i
        ];
        
        marriagePatterns.forEach(pattern => {
            const match = query.match(pattern);
            if (match) {
                const partnerName = match[1];
                const isCurrentTense = /\b(?:am|is|have)\b/i.test(query);
                
                facts.push({
                    key: isCurrentTense ? 'current_partner' : 'former_partner',
                    value: partnerName,
                    confidence: 0.9,
                    source: 'user_statement',
                    category: 'relationships',
                    relationships: [],
                    temporal_context: isCurrentTense ? 'present' : 'past',
                    verification_status: 'verified'
                });
                
                if (/\bmarried\b/i.test(query)) {
                    facts.push({
                        key: 'marital_status',
                        value: isCurrentTense ? 'married' : 'divorced',
                        confidence: 0.8,
                        source: 'inferred',
                        category: 'relationships',
                        relationships: [],
                        temporal_context: isCurrentTense ? 'present' : 'past',
                        verification_status: 'inferred'
                    });
                }
            }
        });
        
        // Family facts
        const familyPatterns = [
            /my (?:mother|mom)'s name is ([A-Z][a-z]+)/i,
            /my (?:father|dad)'s name is ([A-Z][a-z]+)/i,
            /i have a (?:brother|sister) named ([A-Z][a-z]+)/i,
            /my (?:son|daughter)'s name is ([A-Z][a-z]+)/i
        ];
        
        familyPatterns.forEach(pattern => {
            const match = query.match(pattern);
            if (match) {
                const name = match[1];
                let relationshipType = 'family_member';
                
                if (/mother|mom/i.test(query)) relationshipType = 'mother';
                else if (/father|dad/i.test(query)) relationshipType = 'father';
                else if (/brother/i.test(query)) relationshipType = 'brother';
                else if (/sister/i.test(query)) relationshipType = 'sister';
                else if (/son/i.test(query)) relationshipType = 'son';
                else if (/daughter/i.test(query)) relationshipType = 'daughter';
                
                facts.push({
                    key: relationshipType,
                    value: name,
                    confidence: 0.9,
                    source: 'user_statement',
                    category: 'family',
                    relationships: [],
                    verification_status: 'verified'
                });
            }
        });
        
        return facts;
    }

    /**
     * Extract location/place facts
     */
    private static extractLocationFacts(query: string, analysis: QueryAnalysis): ExtractedFact[] {
        const facts: ExtractedFact[] = [];
        
        // Current location
        const currentLocationPatterns = [
            /i live in ([A-Z][a-z]+(?: [A-Z][a-z]+)*)/i,
            /i'm from ([A-Z][a-z]+(?: [A-Z][a-z]+)*)/i,
            /i currently live in ([A-Z][a-z]+(?: [A-Z][a-z]+)*)/i
        ];
        
        currentLocationPatterns.forEach(pattern => {
            const match = query.match(pattern);
            if (match) {
                const location = match[1];
                const isCurrent = /\b(?:live|currently)\b/i.test(query);
                
                facts.push({
                    key: isCurrent ? 'current_location' : 'birth_place',
                    value: location,
                    confidence: 0.8,
                    source: 'user_statement',
                    category: 'places_lived',
                    relationships: [],
                    temporal_context: isCurrent ? 'present' : 'past',
                    verification_status: 'verified'
                });
            }
        });
        
        // Previous locations
        const previousLocationPatterns = [
            /i used to live in ([A-Z][a-z]+(?: [A-Z][a-z]+)*)/i,
            /i moved from ([A-Z][a-z]+(?: [A-Z][a-z]+)*)/i,
            /i lived in ([A-Z][a-z]+(?: [A-Z][a-z]+)*) (?:before|previously)/i
        ];
        
        previousLocationPatterns.forEach(pattern => {
            const match = query.match(pattern);
            if (match) {
                const location = match[1];
                facts.push({
                    key: 'previous_location',
                    value: location,
                    confidence: 0.8,
                    source: 'user_statement',
                    category: 'places_lived',
                    relationships: [],
                    temporal_context: 'past',
                    verification_status: 'verified'
                });
            }
        });
        
        return facts;
    }

    /**
     * Extract temporal facts
     */
    private static extractTemporalFacts(query: string, analysis: QueryAnalysis): ExtractedFact[] {
        const facts: ExtractedFact[] = [];
        
        // Duration facts
        const durationPatterns = [
            /for (\d+) years?/i,
            /(\d+) years? ago/i,
            /since (\d{4})/i,
            /in (\d{4})/i
        ];
        
        durationPatterns.forEach(pattern => {
            const match = query.match(pattern);
            if (match) {
                const value = match[1];
                let key = 'temporal_reference';
                
                if (/years? ago/i.test(query)) {
                    key = 'years_ago';
                } else if (/for.*years?/i.test(query)) {
                    key = 'duration_years';
                } else if (/since|in \d{4}/i.test(query)) {
                    key = 'year_reference';
                }
                
                facts.push({
                    key,
                    value,
                    confidence: 0.7,
                    source: 'user_statement',
                    category: 'temporal',
                    relationships: [],
                    verification_status: 'verified'
                });
            }
        });
        
        return facts;
    }

    /**
     * Extract preference facts
     */
    private static extractPreferenceFacts(query: string, analysis: QueryAnalysis): ExtractedFact[] {
        const facts: ExtractedFact[] = [];
        const queryLower = query.toLowerCase();
        
        // Likes/dislikes
        const preferencePatterns = [
            /i (?:love|like|enjoy) ([a-z ]+)/i,
            /i (?:hate|dislike|don't like) ([a-z ]+)/i,
            /my favorite ([a-z]+) is ([a-z ]+)/i
        ];
        
        preferencePatterns.forEach(pattern => {
            const match = query.match(pattern);
            if (match) {
                const isPositive = /love|like|enjoy|favorite/i.test(query);
                const preference = match[1] || match[2];
                
                if (preference && preference.length > 2 && preference.length < 100) {
                    facts.push({
                        key: isPositive ? 'likes' : 'dislikes',
                        value: preference.trim(),
                        confidence: 0.7,
                        source: 'user_statement',
                        category: 'preferences',
                        relationships: [],
                        verification_status: 'verified'
                    });
                }
            }
        });
        
        return facts;
    }

    /**
     * Extract experience facts
     */
    private static extractExperienceFacts(query: string, analysis: QueryAnalysis): ExtractedFact[] {
        const facts: ExtractedFact[] = [];
        
        // Experience patterns
        const experiencePatterns = [
            /i (?:have|had) (?:been to|visited|traveled to) ([A-Z][a-z]+(?: [A-Z][a-z]+)*)/i,
            /i (?:went|traveled) to ([A-Z][a-z]+(?: [A-Z][a-z]+)*)/i,
            /i (?:studied|graduated from) ([A-Z][a-z]+(?: [A-Z][a-z]+)*)/i,
            /i (?:worked at|was employed by) ([A-Z][a-z]+(?: [A-Z][a-z]+)*)/i
        ];
        
        experiencePatterns.forEach(pattern => {
            const match = query.match(pattern);
            if (match) {
                const experience = match[1];
                let category: FactCategory = 'experiences';
                let key = 'experience';
                
                if (/studied|graduated/i.test(query)) {
                    category = 'education';
                    key = 'education_institution';
                } else if (/worked|employed/i.test(query)) {
                    category = 'career';
                    key = 'employer';
                } else if (/been to|visited|traveled/i.test(query)) {
                    category = 'experiences';
                    key = 'travel_experience';
                }
                
                facts.push({
                    key,
                    value: experience,
                    confidence: 0.7,
                    source: 'user_statement',
                    category,
                    relationships: [],
                    verification_status: 'verified'
                });
            }
        });
        
        return facts;
    }

    /**
     * Validate extracted facts against existing knowledge
     */
    private static validateFacts(extractedFacts: ExtractedFact[], existingFacts: any[]): ExtractedFact[] {
        return extractedFacts.map(fact => {
            // Check for conflicts with existing facts
            const conflicting = existingFacts.find(existing => 
                existing.key === fact.key && 
                existing.value !== fact.value &&
                existing.confidence > 0.7
            );
            
            if (conflicting) {
                // Lower confidence for potentially conflicting facts
                fact.confidence *= 0.7;
                fact.verification_status = 'uncertain';
                fact.relationships.push({
                    type: 'contradicts',
                    target_fact_key: conflicting.key,
                    confidence: 0.8
                });
            }
            
            // Check for supporting facts
            const supporting = existingFacts.find(existing =>
                existing.category === fact.category &&
                existing.value.toLowerCase().includes(fact.value.toLowerCase())
            );
            
            if (supporting) {
                fact.confidence = Math.min(1.0, fact.confidence + 0.1);
                fact.relationships.push({
                    type: 'supports',
                    target_fact_key: supporting.key,
                    confidence: 0.6
                });
            }
            
            return fact;
        });
    }

    /**
     * Enhance facts with relationship mapping
     */
    private static enhanceWithRelationships(facts: ExtractedFact[], existingFacts: any[]): ExtractedFact[] {
        return facts.map(fact => {
            // Find related facts by category
            const relatedFacts = existingFacts.filter(existing => 
                existing.category === fact.category ||
                this.areFactsRelated(fact, existing)
            );
            
            relatedFacts.forEach(related => {
                if (!fact.relationships.some(rel => rel.target_fact_key === related.key)) {
                    fact.relationships.push({
                        type: 'references',
                        target_fact_key: related.key,
                        confidence: 0.5
                    });
                }
            });
            
            return fact;
        });
    }

    /**
     * Determine if two facts are related
     */
    private static areFactsRelated(fact1: ExtractedFact, fact2: any): boolean {
        // Same person mentioned
        if (fact1.category === 'relationships' && fact2.category === 'relationships') {
            return fact1.value.toLowerCase() === fact2.value.toLowerCase();
        }
        
        // Same location mentioned
        if (fact1.category === 'places_lived' && fact2.category === 'places_lived') {
            return fact1.value.toLowerCase().includes(fact2.value.toLowerCase()) ||
                   fact2.value.toLowerCase().includes(fact1.value.toLowerCase());
        }
        
        // Temporal relationships
        if (fact1.temporal_context && fact2.temporal_context) {
            return fact1.temporal_context === fact2.temporal_context;
        }
        
        return false;
    }

    /**
     * Generate fact confidence score based on multiple factors
     */
    static calculateFactConfidence(
        fact: ExtractedFact,
        sourceReliability: number,
        contextSupport: number,
        existingEvidence: number
    ): number {
        const baseConfidence = fact.confidence;
        const sourceWeight = 0.4;
        const contextWeight = 0.3;
        const evidenceWeight = 0.3;
        
        const finalConfidence = 
            (baseConfidence * sourceWeight) +
            (sourceReliability * contextWeight) +
            (existingEvidence * evidenceWeight);
        
        return Math.min(1.0, Math.max(0.0, finalConfidence));
    }
}