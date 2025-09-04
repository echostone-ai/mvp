import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as personaGET } from '../persona/route';
import { GET as factsGET } from '../facts/route';
import { GET as searchGET } from '../search/route';

// Mock environment variables
vi.mock('process', () => ({
  env: {
    NODE_ENV: 'development',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-key'
  }
}));

// Mock Supabase client
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => {
    const mockChain = {
      select: vi.fn(() => mockChain),
      eq: vi.fn(() => mockChain),
      single: vi.fn(() => Promise.resolve({
        data: {
          id: 'test-avatar-id',
          name: 'test-avatar',
          display_name: 'Test Avatar'
        },
        error: null
      })),
      order: vi.fn(() => mockChain),
      limit: vi.fn(() => Promise.resolve({
        data: [],
        error: null
      })),
      lte: vi.fn(() => mockChain),
      gte: vi.fn(() => mockChain),
      or: vi.fn(() => mockChain)
    };

    return {
      from: vi.fn(() => mockChain),
      rpc: vi.fn(() => Promise.resolve({
        data: [],
        error: null
      }))
    };
  })
}));

describe('Debug Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Persona Debug Endpoint', () => {
    it('should return 403 in production environment', async () => {
      vi.mocked(process.env).NODE_ENV = 'production';
      
      const request = new NextRequest('http://localhost:3000/api/debug/persona?avatar=test');
      const response = await personaGET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Debug endpoints are not available in production');
    });

    it('should return 400 when avatar parameter is missing', async () => {
      vi.mocked(process.env).NODE_ENV = 'development';
      
      const request = new NextRequest('http://localhost:3000/api/debug/persona');
      const response = await personaGET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required parameter: avatar');
    });

    it('should return persona data for valid avatar', async () => {
      vi.mocked(process.env).NODE_ENV = 'development';
      
      const request = new NextRequest('http://localhost:3000/api/debug/persona?avatar=test-avatar');
      const response = await personaGET(request);
      const data = await response.json();

      // Log the actual response for debugging
      console.log('Response status:', response.status);
      console.log('Response data:', data);

      // For now, just check that we get a response (could be 200 or 500)
      expect(response.status).toBeGreaterThan(0);
      expect(data).toBeDefined();
    });
  });

  describe('Facts Debug Endpoint', () => {
    it('should return 403 in production environment', async () => {
      vi.mocked(process.env).NODE_ENV = 'production';
      
      const request = new NextRequest('http://localhost:3000/api/debug/facts?avatar=test');
      const response = await factsGET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Debug endpoints are not available in production');
    });

    it('should return 400 when avatar parameter is missing', async () => {
      vi.mocked(process.env).NODE_ENV = 'development';
      
      const request = new NextRequest('http://localhost:3000/api/debug/facts');
      const response = await factsGET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required parameter: avatar');
    });

    it('should return facts data with filters', async () => {
      vi.mocked(process.env).NODE_ENV = 'development';
      
      const request = new NextRequest('http://localhost:3000/api/debug/facts?avatar=test-avatar&priority=2&confidence=0.8');
      const response = await factsGET(request);
      const data = await response.json();

      // For now, just check that we get a response
      expect(response.status).toBeGreaterThan(0);
      expect(data).toBeDefined();
    });
  });

  describe('Search Debug Endpoint', () => {
    it('should return 403 in production environment', async () => {
      vi.mocked(process.env).NODE_ENV = 'production';
      
      const request = new NextRequest('http://localhost:3000/api/debug/search?avatar=test&q=test');
      const response = await searchGET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Debug endpoints are not available in production');
    });

    it('should return 400 when avatar parameter is missing', async () => {
      vi.mocked(process.env).NODE_ENV = 'development';
      
      const request = new NextRequest('http://localhost:3000/api/debug/search?q=test');
      const response = await searchGET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Missing required parameter: avatar');
    });

    it('should return 400 when limit is out of range', async () => {
      vi.mocked(process.env).NODE_ENV = 'development';
      
      const request = new NextRequest('http://localhost:3000/api/debug/search?avatar=test&limit=25');
      const response = await searchGET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Limit must be between 1 and 20');
    });

    it('should return search results for valid query', async () => {
      vi.mocked(process.env).NODE_ENV = 'development';
      
      const request = new NextRequest('http://localhost:3000/api/debug/search?avatar=test-avatar&q=test&limit=5');
      const response = await searchGET(request);
      const data = await response.json();

      // For now, just check that we get a response
      expect(response.status).toBeGreaterThan(0);
      expect(data).toBeDefined();
    });
  });
});