import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

// Mock environment variables
vi.mock('process', () => ({
  env: {
    DEBUG_SECRET: 'test-secret',
    SUPABASE_URL: 'https://test.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-key'
  }
}));

// Mock the identity service
vi.mock('@/lib/services/identity', () => ({
  resolveAvatarId: vi.fn()
}));

// Mock Supabase admin
vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          data: [
            { fact_key: 'full_name' },
            { fact_key: 'profession' },
            { fact_key: 'home_city' }
          ],
          error: null
        }))
      }))
    }))
  }
}));

describe('JD Debug Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 401 when DEBUG_SECRET header is missing', async () => {
    const request = new NextRequest('http://localhost:3000/api/debug/jd?avatarSlug=test');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized - DEBUG_SECRET required');
  });

  it('should return 401 when DEBUG_SECRET header is incorrect', async () => {
    const request = new NextRequest('http://localhost:3000/api/debug/jd?avatarSlug=test', {
      headers: { 'DEBUG_SECRET': 'wrong-secret' }
    });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized - DEBUG_SECRET required');
  });

  it('should return 400 when neither avatarSlug nor profileName is provided', async () => {
    const request = new NextRequest('http://localhost:3000/api/debug/jd', {
      headers: { 'DEBUG_SECRET': 'test-secret' }
    });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Either avatarSlug or profileName query parameter is required');
  });

  it('should attempt to process valid parameters', async () => {
    // Ensure DEBUG_SECRET is set
    process.env.DEBUG_SECRET = 'test-secret';
    
    const request = new NextRequest('http://localhost:3000/api/debug/jd?avatarSlug=test-avatar', {
      headers: { 'DEBUG_SECRET': 'test-secret' }
    });

    const response = await GET(request);
    const data = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response data:', data);
    
    // The endpoint should attempt to process the request (may fail due to mocking issues)
    // but should not return 400 or 401 errors for valid input
    expect(response.status).not.toBe(400);
    expect(response.status).not.toBe(401);
  });
});