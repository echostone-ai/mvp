import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryInjectionService } from '../memoryInjectionService';

// Mock OpenAI
vi.mock('openai');

describe('Pet Aliases Normalization', () => {
  let mockOpenAI: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock OpenAI
    mockOpenAI = {
      chat: {
        completions: {
          create: vi.fn()
        }
      }
    };
    const OpenAI = require('openai').default;
    OpenAI.mockImplementation(() => mockOpenAI);

    // Mock environment
    process.env.OPENAI_API_KEY = 'test-key';
  });

  it('should normalize "pup" to canonical dog facts', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify([
            { key: 'pet_name', value: 'Buddy', confidence: 0.95, priority: 2 },
            { key: 'pet_type', value: 'dog', confidence: 0.95, priority: 3 }
          ])
        }
      }]
    });

    const candidates = await MemoryInjectionService['extractFactCandidates']('My pup Buddy is great');

    expect(candidates).toEqual([
      { key: 'pet_name', value: 'Buddy', confidence: 0.95, priority: 2 },
      { key: 'pet_type', value: 'dog', confidence: 0.95, priority: 3 }
    ]);
  });

  it('should normalize "mutt" to canonical dog facts', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify([
            { key: 'pet_name', value: 'Rex', confidence: 0.95, priority: 2 },
            { key: 'pet_type', value: 'dog', confidence: 0.95, priority: 3 }
          ])
        }
      }]
    });

    const candidates = await MemoryInjectionService['extractFactCandidates']('My mutt Rex loves walks');

    expect(candidates).toEqual([
      { key: 'pet_name', value: 'Rex', confidence: 0.95, priority: 2 },
      { key: 'pet_type', value: 'dog', confidence: 0.95, priority: 3 }
    ]);
  });

  it('should normalize "toy poodle" to canonical facts with breed and size', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify([
            { key: 'pet_name', value: 'Romeo', confidence: 0.95, priority: 2 },
            { key: 'pet_type', value: 'dog', confidence: 0.95, priority: 3 },
            { key: 'pet_breed', value: 'poodle', confidence: 0.9, priority: 3 },
            { key: 'pet_size', value: 'toy', confidence: 0.9, priority: 4 }
          ])
        }
      }]
    });

    const candidates = await MemoryInjectionService['extractFactCandidates']('I have a toy poodle named Romeo');

    expect(candidates).toEqual([
      { key: 'pet_name', value: 'Romeo', confidence: 0.95, priority: 2 },
      { key: 'pet_type', value: 'dog', confidence: 0.95, priority: 3 },
      { key: 'pet_breed', value: 'poodle', confidence: 0.9, priority: 3 },
      { key: 'pet_size', value: 'toy', confidence: 0.9, priority: 4 }
    ]);
  });

  it('should normalize cat aliases', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify([
            { key: 'pet_name', value: 'Whiskers', confidence: 0.95, priority: 2 },
            { key: 'pet_type', value: 'cat', confidence: 0.95, priority: 3 }
          ])
        }
      }]
    });

    const candidates = await MemoryInjectionService['extractFactCandidates']('My kitty Whiskers is adorable');

    expect(candidates).toEqual([
      { key: 'pet_name', value: 'Whiskers', confidence: 0.95, priority: 2 },
      { key: 'pet_type', value: 'cat', confidence: 0.95, priority: 3 }
    ]);
  });

  it('should handle tabby cat with breed', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify([
            { key: 'pet_name', value: 'Mittens', confidence: 0.95, priority: 2 },
            { key: 'pet_type', value: 'cat', confidence: 0.95, priority: 3 },
            { key: 'pet_breed', value: 'tabby', confidence: 0.9, priority: 3 }
          ])
        }
      }]
    });

    const candidates = await MemoryInjectionService['extractFactCandidates']('Mittens is a tabby cat');

    expect(candidates).toEqual([
      { key: 'pet_name', value: 'Mittens', confidence: 0.95, priority: 2 },
      { key: 'pet_type', value: 'cat', confidence: 0.95, priority: 3 },
      { key: 'pet_breed', value: 'tabby', confidence: 0.9, priority: 3 }
    ]);
  });

  it('should handle birthdate normalization', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify([
            { key: 'pet_name', value: 'Romeo', confidence: 0.95, priority: 2 },
            { key: 'pet_type', value: 'dog', confidence: 0.95, priority: 3 },
            { key: 'pet_birthdate', value: '2024-02-14', confidence: 0.85, priority: 4 }
          ])
        }
      }]
    });

    const candidates = await MemoryInjectionService['extractFactCandidates']('Romeo was born on Valentine\'s Day 2024');

    expect(candidates).toEqual([
      { key: 'pet_name', value: 'Romeo', confidence: 0.95, priority: 2 },
      { key: 'pet_type', value: 'dog', confidence: 0.95, priority: 3 },
      { key: 'pet_birthdate', value: '2024-02-14', confidence: 0.85, priority: 4 }
    ]);
  });

  it('should handle extraction errors gracefully', async () => {
    mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

    const candidates = await MemoryInjectionService['extractFactCandidates']('My dog is great');

    expect(candidates).toEqual([]);
  });

  it('should handle invalid JSON responses', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [{
        message: {
          content: 'Invalid JSON response'
        }
      }]
    });

    const candidates = await MemoryInjectionService['extractFactCandidates']('My cat is fluffy');

    expect(candidates).toEqual([]);
  });

  it('should handle empty responses', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify([])
        }
      }]
    });

    const candidates = await MemoryInjectionService['extractFactCandidates']('The weather is nice');

    expect(candidates).toEqual([]);
  });
});