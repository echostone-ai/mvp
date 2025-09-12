/**
 * Relationship Personalization Service
 * 
 * Detects known people from the factbook and provides personalized greetings,
 * nicknames, and specific details for more intimate conversations.
 */

import { factbookService } from './factbookService';

export interface KnownPerson {
    name: string;
    nickname?: string;
    relationship: 'family' | 'friend' | 'partner' | 'ex';
    personalDetails: string[];
    greetingStyle: 'intimate' | 'friendly' | 'warm';
    specificQuestions: string[];
}

export interface PersonalizationContext {
    detectedPerson?: KnownPerson;
    personalizedGreeting?: string;
    conversationStarters?: string[];
    intimacyLevel: 'stranger' | 'acquaintance' | 'friend' | 'family' | 'partner';
}

export class RelationshipPersonalizationService {
    private static instance: RelationshipPersonalizationService;
    private knownPeople: Map<string, KnownPerson> = new Map();

    static getInstance(): RelationshipPersonalizationService {
        if (!RelationshipPersonalizationService.instance) {
            RelationshipPersonalizationService.instance = new RelationshipPersonalizationService();
        }
        return RelationshipPersonalizationService.instance;
    }

    constructor() {
        this.initializeKnownPeople();
    }

    private initializeKnownPeople() {
        // Family members
        this.knownPeople.set('geoff', {
            name: 'Geoff Braden',
            nickname: 'Boris',
            relationship: 'family',
            personalDetails: [
                'older brother, 3 years older',
                'pilot living outside Denver, Colorado',
                'partner Georgette',
                'two sons Jason and Justin (Jonathan\'s nephews)',
                'French bulldog named Harley',
                'grew up together on the farm in Saanichton'
            ],
            greetingStyle: 'intimate',
            specificQuestions: [
                'How are Jason and Justin doing?',
                'How\'s Georgette?',
                'How\'s the flying going?',
                'How\'s Harley?',
                'Remember our farm days in Saanichton?'
            ]
        });

        this.knownPeople.set('eric braden', {
            name: 'Eric Braden',
            nickname: 'Pop',
            relationship: 'family',
            personalDetails: [
                'father, born July 12, 1947 in Edmonton, Alberta',
                'very smart, kind, integrity, boat builder and captain',
                'taught value of hard work',
                'retired to Les Siguinies outside Verteillac, France in 2017',
                'loves to garden with endless projects',
                'has two black poodles Gus and Una',
                'talks with Jonathan about politics, science, and history'
            ],
            greetingStyle: 'intimate',
            specificQuestions: [
                'How\'s retirement in Verteillac?',
                'How\'s Mom doing?',
                'How are Gus and Una?',
                'How\'s the orchard coming along?',
                'Any new projects going on?'
            ]
        });

        this.knownPeople.set('mary braden', {
            name: 'Mary Braden',
            nickname: 'Mama',
            relationship: 'family',
            personalDetails: [
                'mother, born July 4, 1949 in Anchorage, Alaska',
                'amazing, deep appreciation for nature and love of animals',
                'tranquility and social tact',
                'raised Jonathan on a small farm in Saanichton',
                'retired to Les Siguinies outside Verteillac, France in 2017',
                'loves gardening with endless projects'
            ],
            greetingStyle: 'intimate',
            specificQuestions: [
                'How\'s retirement in France?',
                'How\'s Pop doing?',
                'How are your gardens in Verteillac?',
                'Are you enjoying the French village life?',
                'How are Gus and Una?'
            ]
        });

        // Partner
        this.knownPeople.set('krissy', {
            name: 'Krissy',
            nickname: 'Sweet Pup', // Primary nickname, but has many others
            relationship: 'partner',
            personalDetails: [
                'partner since April 22, 2023 in Sofia',
                'born April 1999',
                'studying law, graduating next year',
                'speaks Bulgarian, French, and English',
                'loves yoga, pilates, and healthy eating',
                'loves Romeo too',
                'looks like Mona Lisa, in beautiful shape',
                'sounds a bit like Mickey Mouse',
                'acts formal and elegant like Betty Draper',
                'other nicknames: Mousey, Kitty Cat, Puppy, Sweetie, Baby Mouse'
            ],
            greetingStyle: 'intimate',
            specificQuestions: [
                'How are your law studies going?',
                'Ready for some yoga later?',
                'How was your pilates class?',
                'Want to take Romeo for a walk?',
                'How\'s your day been, sweetie?'
            ]
        });

        // Close friends
        this.knownPeople.set('tyler', {
            name: 'Tyler McCoy',
            nickname: 'T',
            relationship: 'friend',
            personalDetails: [
                'one of closest friends from Austin',
                '46 years old, tall, cool, hip, balanced, and smart',
                'yoga instructor and tech enthusiast',
                'loves food and travel',
                'has a partner Cansu from Istanbul'
            ],
            greetingStyle: 'friendly',
            specificQuestions: [
                'How\'s Cansu doing?',
                'Still teaching yoga?',
                'Any new tech projects?',
                'Planning any travel adventures?',
                'How\'s Austin treating you?'
            ]
        });

        this.knownPeople.set('eric', {
            name: 'Eric',
            nickname: 'E',
            relationship: 'friend',
            personalDetails: [
                'one of best friends from New York City',
                'brilliant, creative, cultured',
                'knowledgeable about art and history',
                'experienced actor and aspiring clown',
                'has positive and negative charge tattoos on his arms'
            ],
            greetingStyle: 'friendly',
            specificQuestions: [
                'How\'s the acting going?',
                'Any new clown performances?',
                'Discovered any new art lately?',
                'How\'s NYC treating you?'
            ]
        });

        // Ex-partner
        this.knownPeople.set('tia', {
            name: 'Tia',
            relationship: 'ex',
            personalDetails: [
                'first girl Jonathan kissed and fell in love with',
                'got married and bought a house together in Maine',
                'together from 1994 to 2008'
            ],
            greetingStyle: 'warm',
            specificQuestions: [
                'How have you been?',
                'How\'s Maine treating you?',
                'It\'s been a while!'
            ]
        });
    }

    /**
     * Detect if the user is a known person based on their message
     */
    detectKnownPerson(userMessage: string, visitorId?: string): KnownPerson | null {
        const messageLower = userMessage.toLowerCase();

        // Direct name mentions
        for (const [key, person] of Array.from(this.knownPeople.entries())) {
            // Check for direct name mentions
            if (messageLower.includes(key)) {
                return person;
            }

            // Check for relationship indicators
            if (person.relationship === 'family') {
                if (messageLower.includes('brother') && person.name.includes('Geoff')) {
                    return person;
                }
                if ((messageLower.includes('dad') || messageLower.includes('father')) && person.name.includes('Eric')) {
                    return person;
                }
                if ((messageLower.includes('mom') || messageLower.includes('mother')) && person.name.includes('Mary')) {
                    return person;
                }
            }

            // Check for partner indicators
            if (person.relationship === 'partner') {
                if (messageLower.includes('girlfriend') || messageLower.includes('partner') ||
                    messageLower.includes('babe') || messageLower.includes('honey')) {
                    return person;
                }
            }
        }

        // Check for self-identification patterns
        if (messageLower.includes("it's your brother") || messageLower.includes("i'm your brother")) {
            return this.knownPeople.get('geoff') || null;
        }

        if (messageLower.includes("it's me, tyler") || messageLower.includes("tyler here")) {
            return this.knownPeople.get('tyler') || null;
        }

        if (messageLower.includes("it's krissy") || messageLower.includes("your girlfriend")) {
            return this.knownPeople.get('krissy') || null;
        }

        return null;
    }

    /**
     * Generate personalized context for known people
     */
    generatePersonalizationContext(
        userMessage: string,
        detectedPerson?: KnownPerson,
        conversationHistory?: string[]
    ): PersonalizationContext {
        if (!detectedPerson) {
            return {
                intimacyLevel: 'stranger'
            };
        }

        const intimacyLevel = this.getIntimacyLevel(detectedPerson.relationship);
        const personalizedGreeting = this.generatePersonalizedGreeting(detectedPerson, userMessage);
        const conversationStarters = this.selectConversationStarters(detectedPerson, conversationHistory);

        return {
            detectedPerson,
            personalizedGreeting,
            conversationStarters,
            intimacyLevel
        };
    }

    private getIntimacyLevel(relationship: string): PersonalizationContext['intimacyLevel'] {
        switch (relationship) {
            case 'partner': return 'partner';
            case 'family': return 'family';
            case 'friend': return 'friend';
            case 'ex': return 'acquaintance';
            default: return 'stranger';
        }
    }

    private generatePersonalizedGreeting(person: KnownPerson, userMessage: string): string {
        const messageLower = userMessage.toLowerCase();

        // Handle specific greeting patterns
        if (messageLower.includes("hey") || messageLower.includes("hi")) {
            if (person.nickname) {
                return `Hey ${person.nickname}!`;
            }
            return `Hey ${person.name.split(' ')[0]}!`;
        }

        if (messageLower.includes("it's your brother") || messageLower.includes("i'm your brother")) {
            return `Hey Boris! ${person.specificQuestions[0]}`;
        }

        if (messageLower.includes("it's me") || messageLower.includes("it's")) {
            const nickname = person.nickname || person.name.split(' ')[0];
            const question = person.specificQuestions[Math.floor(Math.random() * person.specificQuestions.length)];
            return `${nickname}! ${question}`;
        }

        // Default personalized greeting
        const nickname = person.nickname || person.name.split(' ')[0];
        return `${nickname}!`;
    }

    private selectConversationStarters(person: KnownPerson, conversationHistory?: string[]): string[] {
        // Filter out questions that might have been recently asked
        let availableQuestions = [...person.specificQuestions];

        if (conversationHistory) {
            const recentTopics = conversationHistory.join(' ').toLowerCase();
            availableQuestions = availableQuestions.filter(q =>
                !recentTopics.includes(q.toLowerCase().substring(0, 10))
            );
        }

        // Return 2-3 conversation starters
        return availableQuestions.slice(0, 3);
    }

    /**
     * Get relationship-specific memory boost keywords
     */
    getRelationshipBoostKeywords(person: KnownPerson): string[] {
        const keywords = [person.name.toLowerCase()];

        if (person.nickname) {
            keywords.push(person.nickname.toLowerCase());
        }

        // Add relationship-specific keywords
        switch (person.relationship) {
            case 'family':
                keywords.push('family', 'brother', 'parents', 'childhood', 'farm', 'saanichton');
                break;
            case 'friend':
                keywords.push('friend', 'austin', 'texas');
                if (person.name.includes('Tyler')) {
                    keywords.push('yoga', 'cansu', 'istanbul');
                }
                if (person.name.includes('Eric')) {
                    keywords.push('new york', 'actor', 'clown', 'art');
                }
                break;
            case 'partner':
                keywords.push('partner', 'girlfriend', 'krissy', 'law', 'yoga', 'pilates', 'romeo');
                break;
            case 'ex':
                keywords.push('maine', 'tia', 'married', 'house');
                break;
        }

        return keywords;
    }

    /**
     * Generate system prompt additions for known people
     */
    generateSystemPromptAddition(context: PersonalizationContext): string {
        if (!context.detectedPerson) {
            return '';
        }

        const person = context.detectedPerson;
        const intimacyInstructions = this.getIntimacyInstructions(context.intimacyLevel);

        return `
IMPORTANT: You are speaking with ${person.name} (${person.relationship}). ${intimacyInstructions}

Personal details about ${person.name}:
${person.personalDetails.map(detail => `- ${detail}`).join('\n')}

${person.nickname ? `Use their nickname "${person.nickname}" naturally in conversation.` : ''}

Conversation style: ${person.greetingStyle} - be ${person.greetingStyle === 'intimate' ? 'very personal and loving' : person.greetingStyle === 'friendly' ? 'warm and casual' : 'kind but respectful'}.

${context.conversationStarters && context.conversationStarters.length > 0 ?
                `Consider asking about: ${context.conversationStarters.join(', ')}` : ''}
`;
    }

    private getIntimacyInstructions(intimacyLevel: PersonalizationContext['intimacyLevel']): string {
        switch (intimacyLevel) {
            case 'partner':
                return 'This is your romantic partner. Be loving, intimate, and playful. Use pet names and show deep affection.';
            case 'family':
                return 'This is family. Be warm, loving, and reference shared memories and family connections.';
            case 'friend':
                return 'This is a close friend. Be casual, warm, and reference shared experiences and mutual friends.';
            case 'acquaintance':
                return 'This is someone from your past. Be friendly but respectful of the history between you.';
            default:
                return 'Treat as a new person you\'re meeting.';
        }
    }

    /**
     * Check if a message indicates someone is identifying themselves
     */
    isIdentificationMessage(message: string): boolean {
        const messageLower = message.toLowerCase();
        const identificationPatterns = [
            /it's (me|your|my)/,
            /i'm your/,
            /this is/,
            /hey.*it's/,
            /remember me/,
            /do you remember/
        ];

        return identificationPatterns.some(pattern => pattern.test(messageLower));
    }

    /**
     * Get all known people for admin/debugging
     */
    getAllKnownPeople(): KnownPerson[] {
        return Array.from(this.knownPeople.values());
    }
}

export const relationshipPersonalizationService = RelationshipPersonalizationService.getInstance();