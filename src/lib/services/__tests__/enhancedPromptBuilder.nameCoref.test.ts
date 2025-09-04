import { describe, it, expect, beforeEach } from 'vitest';
import { EnhancedPromptBuilder, ResolvedEntity } from '../enhancedPromptBuilder';
import { QuickFact, ConversationTurn, Memory } from '../promptBuilder';

describe('EnhancedPromptBuilder - Name/Coref Resolution', () => {
  let builder: EnhancedPromptBuilder;
  let mockFacts: QuickFact[];
  let mockHistory: ConversationTurn[];

  beforeEach(() => {
    builder = new EnhancedPromptBuilder();
    
    mockFacts = [
      {
        id: '1',
        key: 'pet_name',
        value: 'Romeo',
        confidence: 0.95,
        priority: 2,
        source: 'manual',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      },
      {
        id: '2',
        key: 'pet_type',
        value: 'dog',
        confidence: 0.95,
        priority: 3,
        source: 'manual',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      },
      {
        id: '3',
        key: 'pet_breed',
        value: 'toy poodle',
        confidence: 0.9,
        priority: 3,
        source: 'manual',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
    ];

    mockHistory = [];
  });

  it('should resolve "who\'s Romeo?" to pet entity', async () => {
    const result = await builder.resolveEntityFromName(
      "who's Romeo?",
      mockFacts,
      [],
      mockHistory
    );

    expect(result).toBeTruthy();
    expect(result!.name).toBe('romeo');
    expect(result!.type).toBe('pet');
    expect(result!.facts).toHaveLength(3);
    expect(result!.context).toContain('asking about "romeo"');
  });

  it('should resolve "how\'s Romeo?" to pet entity', async () => {
    const result = await builder.resolveEntityFromName(
      "how's Romeo?",
      mockFacts,
      [],
      mockHistory
    );

    expect(result).toBeTruthy();
    expect(result!.name).toBe('romeo');
    expect(result!.type).toBe('pet');
    expect(result!.facts).toHaveLength(3);
  });

  it('should resolve pronouns after Romeo mention', async () => {
    const historyWithRomeo: ConversationTurn[] = [
      {
        role: 'user',
        content: 'How is Romeo doing?',
        timestamp: '2024-01-01T00:00:00Z'
      },
      {
        role: 'assistant', 
        content: 'Romeo is doing great! He loves playing in the yard.',
        timestamp: '2024-01-01T00:01:00Z'
      }
    ];

    const result = await builder.resolveEntityFromName(
      "what's your favorite thing about him?",
      mockFacts,
      [],
      historyWithRomeo
    );

    expect(result).toBeTruthy();
    expect(result!.name).toBe('romeo');
    expect(result!.type).toBe('pet');
    expect(result!.context).toContain('recently mentioned in conversation');
  });

  it('should resolve pet type aliases', async () => {
    const result = await builder.resolveEntityFromName(
      "how's your dog?",
      mockFacts,
      [],
      mockHistory
    );

    expect(result).toBeTruthy();
    expect(result!.name).toBe('romeo');
    expect(result!.type).toBe('pet');
    expect(result!.aliases).toContain('dog');
  });

  it('should resolve "pup" alias', async () => {
    const result = await builder.resolveEntityFromName(
      "how's your pup?",
      mockFacts,
      [],
      mockHistory
    );

    expect(result).toBeTruthy();
    expect(result!.name).toBe('romeo');
    expect(result!.type).toBe('pet');
  });

  it('should resolve "mutt" alias', async () => {
    const result = await builder.resolveEntityFromName(
      "tell me about your mutt",
      mockFacts,
      [],
      mockHistory
    );

    expect(result).toBeTruthy();
    expect(result!.name).toBe('romeo');
    expect(result!.type).toBe('pet');
  });

  it('should return null for unresolvable queries', async () => {
    const result = await builder.resolveEntityFromName(
      "what's the weather like?",
      mockFacts,
      [],
      mockHistory
    );

    expect(result).toBeNull();
  });

  it('should handle cat aliases', async () => {
    const catFacts: QuickFact[] = [
      {
        id: '1',
        key: 'pet_name',
        value: 'Whiskers',
        confidence: 0.95,
        priority: 2,
        source: 'manual',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      },
      {
        id: '2',
        key: 'pet_type',
        value: 'cat',
        confidence: 0.95,
        priority: 3,
        source: 'manual',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z'
      }
    ];

    const result = await builder.resolveEntityFromName(
      "how's your kitty?",
      catFacts,
      [],
      mockHistory
    );

    expect(result).toBeTruthy();
    expect(result!.name).toBe('whiskers');
    expect(result!.type).toBe('pet');
    expect(result!.aliases).toContain('cat');
  });
});