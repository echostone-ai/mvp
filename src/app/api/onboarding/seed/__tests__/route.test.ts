/**
 * Tests for onboarding seed API endpoint
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '../route';

// Mock dependencies
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      upsert: vi.fn(() => ({ error: null })),
      insert: vi.fn(() => ({ 
        error: null, 
        data: { id: 'test-summary-id' },
        select: vi.fn(() => ({
          single: vi.fn(() => ({ 
            error: null, 
            data: { id: 'test-summary-id' } 
          }))
        }))
      })),
      select: vi.fn(() => ({
        single: vi.fn(() => ({ 
          error: null, 
          data: { id: 'test-summary-id' } 
        }))
      }))
    }))
  }))
}));

vi.mock('@/lib/services/identity', () => ({
  resolveAvatarId: vi.fn(() => Promise.resolve('test-avatar-id'))
}));

vi.mock('@/lib/onboarding/extractBasics', () => ({
  extractBasics: vi.fn(() => Promise.resolve({
    full_name: 'John Doe',
    profession: 'Developer'
  }))
}));

vi.mock('@/lib/onboarding/starterPack', () => ({
  normalizeQuickFacts: vi.fn((input) => input),
  QUICK_FACT_KEYS: ['full_name', 'given_name', 'profession']
}));

describe('POST /api/onboarding/seed', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console.log to capture telemetry
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should successfully seed onboarding data', async () => {
    const requestBody = {
      avatarSlug: 'test-avatar',
      formBasics: {
        full_name: 'John Doe',
        profession: 'Developer'
      },
      freeText: 'I am a software developer who loves coding.'
    };

    const request = new NextRequest('http://localhost:3000/api/onboarding/seed', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      avatar_id: 'test-avatar-id',
      facts_upserted: expect.any(Number),
      summary_id: 'test-summary-id'
    });

    // Verify telemetry logging
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('JD_SEED')
    );
  });

  it('should return error when neither avatarSlug nor profileName provided', async () => {
    const requestBody = {
      formBasics: {
        full_name: 'John Doe'
      }
    };

    const request = new NextRequest('http://localhost:3000/api/onboarding/seed', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Either avatarSlug or profileName must be provided');
  });

  it('should return error when formBasics is missing', async () => {
    const requestBody = {
      avatarSlug: 'test-avatar'
    };

    const request = new NextRequest('http://localhost:3000/api/onboarding/seed', {
      method: 'POST',
      body: JSON.stringify(requestBody),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('formBasics is required and must be an object');
  });
});