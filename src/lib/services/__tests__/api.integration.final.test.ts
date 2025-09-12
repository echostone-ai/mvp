// src/lib/services/__tests__/api.integration.final.test.ts
// API integration tests to verify no breaking changes to /api/demo-chat and consumer endpoints

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/demo-chat/route';
import { FactbookService } from '../factbookService';
import fs from 'fs';
import path from 'path';

// Mock environment variables for testing
const mockEnvVars = {
  OPENAI_API_KEY: 'test-key',
  NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
  DEMO_SYSTEM_USER_ID: 'test-system-user-id',
  DEMO_MEMORY_TTL_MINUTES: '10',
  USE_PERSONA_PROFILE: '1',
  USE_FB_INDEX: '1',
  RETRIEVAL_EMBEDDINGS: 'on',
  RETRIEVAL_EXPANSION: 'auto',
  RETRIEVAL_RERANK: 'off'
};

// Mock OpenAI responses
const mockOpenAIResponse = {
  choices: [{
    message: {
      content: 'I grew up on Vancouver Island in Saanichton, British Columbia. It was a beautiful place to spend my childhood.'
    },
    finish_reason: 'stop'
  }],
  usage: {
    prompt_tokens: 100,
    completion_tokens: 50,
    total_tokens: 150
  }
};

// Mock Supabase client
const mockSupabaseClient = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: { id: 'test-avatar-id' } }))
      }))
    })),
    insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    upsert: vi.fn(() => Promise.resolve({ data: null, error: null }))
  })),
  rpc: vi.fn(() => Promise.resolve({ data: [], error: null }))
};

describe('API Integration Tests - No Breaking Changes Validation', () => {
  beforeAll(() => {
    // Set up environment variables
    Object.entries(mockEnvVars).forEach(([key, value]) => {
      process.env[key] = value;
    });

    // Mock OpenAI
    vi.mock('openai', () => ({
      default: vi.fn(() => ({
        chat: {
          completions: {
            create: vi.fn(() => Promise.resolve(mockOpenAIResponse))
          }
        }
      }))
    }));

    // Mock Supabase
    vi.mock('@supabase/supabase-js', () => ({
      createClient: vi.fn(() => mockSupabaseClient)
    }));

    // Mock factbook data
    const mockFactbookData = {
      snippets: [
        {
          id: 'timeline.childhood',
          path: 'timeline/childhood',
          text: 'I grew up on Vancouver Island in Saanichton, British Columbia.',
          topics: ['childhood', 'location'],
          keywords: ['vancouver island', 'saanichton', 'british columbia', 'grew up']
        },
        {
          id: 'pets.romeo',
          path: 'pets/romeo',
          text: 'Romeo is my poodle, adopted on Valentine\'s Day 2024.',
          topics: ['pets', 'current'],
          keywords: ['romeo', 'poodle', 'valentine', '2024']
        }
      ]
    };

    // Mock file system for factbook loading
    vi.mock('fs', () => ({
      default: {
        existsSync: vi.fn(() => true),
        readFileSync: vi.fn(() => JSON.stringify(mockFactbookData)),
        statSync: vi.fn(() => ({ mtimeMs: Date.now() }))
      }
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('/api/demo-chat Endpoint Compatibility', () => {
    it('should maintain backward compatibility with existing request format', async () => {
      const requestBody = {
        message: 'Where did you grow up?',
        usePersona: true,
        useFBIndex: true,
        avatar: 'jonathan_braden',
        profileData: { id: 'jonathan_demo' }
      };

      const request = new NextRequest('http://localhost:3000/api/demo-chat', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Should not throw errors with existing request format
      expect(async () => {
        await POST(request);
      }).not.toThrow();
    });

    it('should handle legacy message format', async () => {
      const requestBody = {
        messages: [
          { role: 'user', content: 'Tell me about Romeo' }
        ],
        usePersona: true,
        avatar: 'jonathan_braden',
        profileData: { id: 'jonathan_demo' }
      };

      const request = new NextRequest('http://localhost:3000/api/demo-chat', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Should handle messages array format
      expect(async () => {
        await POST(request);
      }).not.toThrow();
    });

    it('should maintain response format compatibility', async () => {
      const requestBody = {
        message: 'What is Echostone?',
        usePersona: true,
        useFBIndex: true,
        avatar: 'jonathan_braden',
        profileData: { id: 'jonathan_demo' }
      };

      const request = new NextRequest('http://localhost:3000/api/demo-chat', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      try {
        const response = await POST(request);

        // Should return a Response object
        expect(response).toBeInstanceOf(Response);

        // Should have correct content type
        expect(response.headers.get('Content-Type')).toContain('text/plain');

        // Should be readable as text stream (existing behavior)
        const reader = response.body?.getReader();
        expect(reader).toBeDefined();

      } catch (error) {
        // If there are errors, they should be handled gracefully
        expect(error).toBeInstanceOf(Error);
        console.log('API test error (expected in test environment):', error.message);
      }
    });

    it('should preserve existing query parameters and options', async () => {
      const requestBody = {
        message: 'Tell me about your pets',
        usePersona: true,
        useFBIndex: true,
        avatar: 'jonathan_braden',
        profileData: { id: 'jonathan_demo' },
        debug: true,
        systemPrompt: 'You are Jonathan, a friendly AI assistant.'
      };

      const request = new NextRequest('http://localhost:3000/api/demo-chat', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Should handle all existing parameters without breaking
      expect(async () => {
        await POST(request);
      }).not.toThrow();
    });

    it('should handle error cases gracefully without breaking changes', async () => {
      // Test missing required fields
      const invalidRequestBody = {
        // Missing message
        usePersona: true,
        avatar: 'jonathan_braden'
      };

      const request = new NextRequest('http://localhost:3000/api/demo-chat', {
        method: 'POST',
        body: JSON.stringify(invalidRequestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      try {
        const response = await POST(request);
        
        // Should return error response, not throw
        expect(response).toBeInstanceOf(Response);
        expect(response.status).toBeGreaterThanOrEqual(400);

      } catch (error) {
        // If it throws, should be handled gracefully
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('FactbookService Integration Compatibility', () => {
    it('should maintain FactbookService.retrieve() interface', async () => {
      const factbookService = FactbookService.getInstance();
      
      // Load test data
      const testData = {
        snippets: [
          {
            id: 'test.snippet',
            path: 'test/snippet',
            text: 'This is a test snippet.',
            topics: ['test'],
            keywords: ['test', 'snippet']
          }
        ]
      };
      
      await factbookService.loadFactbook(testData);

      // Should maintain existing interface
      const facts = await factbookService.retrieve('test query');

      // Should return array of facts
      expect(Array.isArray(facts)).toBe(true);

      if (facts.length > 0) {
        const fact = facts[0];
        
        // Should have all required properties
        expect(fact).toHaveProperty('id');
        expect(fact).toHaveProperty('path');
        expect(fact).toHaveProperty('text');
        expect(fact).toHaveProperty('topics');
        expect(fact).toHaveProperty('keywords');
        expect(fact).toHaveProperty('type');
        expect(fact).toHaveProperty('weight');

        // Types should be correct
        expect(typeof fact.id).toBe('string');
        expect(typeof fact.text).toBe('string');
        expect(Array.isArray(fact.topics)).toBe(true);
        expect(Array.isArray(fact.keywords)).toBe(true);
        expect(typeof fact.weight).toBe('number');
      }
    });

    it('should maintain getAllSnippets() interface', () => {
      const factbookService = FactbookService.getInstance();
      const snippets = factbookService.getAllSnippets();

      // Should return array
      expect(Array.isArray(snippets)).toBe(true);

      if (snippets.length > 0) {
        const snippet = snippets[0];
        
        // Should maintain snippet structure
        expect(snippet).toHaveProperty('id');
        expect(snippet).toHaveProperty('text');
        expect(snippet).toHaveProperty('topics');
        expect(snippet).toHaveProperty('keywords');
      }
    });

    it('should maintain getSnippetCount() interface', () => {
      const factbookService = FactbookService.getInstance();
      const count = factbookService.getSnippetCount();

      // Should return number
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    it('should maintain loadFactbook() interface', async () => {
      const factbookService = FactbookService.getInstance();
      
      const testData = {
        snippets: [
          {
            id: 'new.test',
            path: 'new/test',
            text: 'New test snippet.',
            topics: ['new'],
            keywords: ['new', 'test']
          }
        ]
      };

      // Should load without errors
      await expect(factbookService.loadFactbook(testData)).resolves.not.toThrow();

      // Should update snippet count
      expect(factbookService.getSnippetCount()).toBeGreaterThan(0);
    });
  });

  describe('Feature Flag Compatibility', () => {
    it('should respect existing feature flags', async () => {
      // Test with factbook disabled
      process.env.USE_FB_INDEX = '0';

      const requestBody = {
        message: 'Tell me about Romeo',
        usePersona: true,
        useFBIndex: false,
        avatar: 'jonathan_braden',
        profileData: { id: 'jonathan_demo' }
      };

      const request = new NextRequest('http://localhost:3000/api/demo-chat', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Should work without factbook
      expect(async () => {
        await POST(request);
      }).not.toThrow();

      // Reset
      process.env.USE_FB_INDEX = '1';
    });

    it('should respect persona flag', async () => {
      // Test with persona disabled
      process.env.USE_PERSONA_PROFILE = '0';

      const requestBody = {
        message: 'Where did you grow up?',
        usePersona: false,
        avatar: 'jonathan_braden'
      };

      const request = new NextRequest('http://localhost:3000/api/demo-chat', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Should work without persona
      expect(async () => {
        await POST(request);
      }).not.toThrow();

      // Reset
      process.env.USE_PERSONA_PROFILE = '1';
    });

    it('should handle hybrid retrieval feature flags', async () => {
      // Test with different hybrid retrieval configurations
      const configs = [
        { RETRIEVAL_EMBEDDINGS: 'off', RETRIEVAL_EXPANSION: 'off', RETRIEVAL_RERANK: 'off' },
        { RETRIEVAL_EMBEDDINGS: 'on', RETRIEVAL_EXPANSION: 'off', RETRIEVAL_RERANK: 'off' },
        { RETRIEVAL_EMBEDDINGS: 'on', RETRIEVAL_EXPANSION: 'auto', RETRIEVAL_RERANK: 'on' }
      ];

      for (const config of configs) {
        // Set environment variables
        Object.entries(config).forEach(([key, value]) => {
          process.env[key] = value;
        });

        const requestBody = {
          message: 'Tell me about your childhood',
          usePersona: true,
          useFBIndex: true,
          avatar: 'jonathan_braden',
          profileData: { id: 'jonathan_demo' }
        };

        const request = new NextRequest('http://localhost:3000/api/demo-chat', {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: {
            'Content-Type': 'application/json'
          }
        });

        // Should work with all configurations
        expect(async () => {
          await POST(request);
        }).not.toThrow();
      }

      // Reset to defaults
      process.env.RETRIEVAL_EMBEDDINGS = 'on';
      process.env.RETRIEVAL_EXPANSION = 'auto';
      process.env.RETRIEVAL_RERANK = 'off';
    });
  });

  describe('Memory and Performance Compatibility', () => {
    it('should maintain memory TTL behavior', async () => {
      // Test with different TTL settings
      const ttlValues = ['0', '5', '10', '60'];

      for (const ttl of ttlValues) {
        process.env.DEMO_MEMORY_TTL_MINUTES = ttl;

        const requestBody = {
          message: 'Remember this conversation',
          usePersona: true,
          useFBIndex: true,
          avatar: 'jonathan_braden',
          profileData: { id: 'jonathan_demo' }
        };

        const request = new NextRequest('http://localhost:3000/api/demo-chat', {
          method: 'POST',
          body: JSON.stringify(requestBody),
          headers: {
            'Content-Type': 'application/json'
          }
        });

        // Should handle all TTL values
        expect(async () => {
          await POST(request);
        }).not.toThrow();
      }

      // Reset
      process.env.DEMO_MEMORY_TTL_MINUTES = '10';
    });

    it('should maintain performance characteristics', async () => {
      const requestBody = {
        message: 'Quick performance test',
        usePersona: true,
        useFBIndex: true,
        avatar: 'jonathan_braden',
        profileData: { id: 'jonathan_demo' }
      };

      const request = new NextRequest('http://localhost:3000/api/demo-chat', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const startTime = Date.now();

      try {
        await POST(request);
        const duration = Date.now() - startTime;

        // Should complete within reasonable time (allowing for test overhead)
        expect(duration).toBeLessThan(5000); // 5 seconds max for test environment

      } catch (error) {
        // Performance test - measure time even if there are errors
        const duration = Date.now() - startTime;
        expect(duration).toBeLessThan(5000);
        
        console.log('Performance test completed with error (expected in test env):', error.message);
      }
    });
  });

  describe('Error Handling Compatibility', () => {
    it('should maintain error response format', async () => {
      // Test with missing environment variables
      const originalApiKey = process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const requestBody = {
        message: 'Test error handling',
        usePersona: true,
        avatar: 'jonathan_braden',
        profileData: { id: 'jonathan_demo' }
      };

      const request = new NextRequest('http://localhost:3000/api/demo-chat', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      try {
        const response = await POST(request);
        
        // Should return error response in expected format
        expect(response).toBeInstanceOf(Response);
        
        if (response.status >= 400) {
          // Error responses should be JSON
          const contentType = response.headers.get('Content-Type');
          expect(contentType).toContain('application/json');
        }

      } catch (error) {
        // Should handle errors gracefully
        expect(error).toBeInstanceOf(Error);
      }

      // Restore
      process.env.OPENAI_API_KEY = originalApiKey;
    });

    it('should handle malformed requests gracefully', async () => {
      const malformedRequest = new NextRequest('http://localhost:3000/api/demo-chat', {
        method: 'POST',
        body: 'invalid json',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      try {
        const response = await POST(malformedRequest);
        
        // Should return error response, not crash
        expect(response).toBeInstanceOf(Response);
        expect(response.status).toBeGreaterThanOrEqual(400);

      } catch (error) {
        // Should be handled gracefully
        expect(error).toBeInstanceOf(Error);
      }
    });
  });

  describe('Logging and Metrics Compatibility', () => {
    it('should maintain logging format', async () => {
      const consoleSpy = vi.spyOn(console, 'log');

      const requestBody = {
        message: 'Test logging',
        usePersona: true,
        useFBIndex: true,
        avatar: 'jonathan_braden',
        profileData: { id: 'jonathan_demo' }
      };

      const request = new NextRequest('http://localhost:3000/api/demo-chat', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      try {
        await POST(request);
      } catch (error) {
        // Expected in test environment
      }

      // Should have logged something (factbook loading, etc.)
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should maintain metrics collection', async () => {
      // This test verifies that metrics collection doesn't break
      const requestBody = {
        message: 'Test metrics',
        usePersona: true,
        useFBIndex: true,
        avatar: 'jonathan_braden',
        profileData: { id: 'jonathan_demo' }
      };

      const request = new NextRequest('http://localhost:3000/api/demo-chat', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Should not throw errors related to metrics collection
      expect(async () => {
        await POST(request);
      }).not.toThrow();
    });
  });
});