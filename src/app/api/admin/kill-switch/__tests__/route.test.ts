/**
 * Integration tests for kill switch API endpoint
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GET, POST } from '../route';
import { featureFlagManager } from '@/lib/config/featureFlags';

// Mock environment variable
process.env.ADMIN_API_KEY = 'test-admin-key';

describe('Kill Switch API', () => {
  beforeEach(() => {
    featureFlagManager.clearKillSwitch();
  });

  describe('Authentication', () => {
    it('should reject requests without authorization header', async () => {
      const request = new Request('http://localhost:3000/api/admin/kill-switch', {
        method: 'GET',
      });

      const response = await GET(request);
      expect(response.status).toBe(401);
      
      const body = await response.json();
      expect(body.error).toBe('Unauthorized');
    });

    it('should reject requests with invalid authorization', async () => {
      const request = new Request('http://localhost:3000/api/admin/kill-switch', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer invalid-key'
        }
      });

      const response = await GET(request);
      expect(response.status).toBe(401);
    });

    it('should accept requests with valid authorization', async () => {
      const request = new Request('http://localhost:3000/api/admin/kill-switch', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-admin-key'
        }
      });

      const response = await GET(request);
      expect(response.status).toBe(200);
    });
  });

  describe('GET endpoint', () => {
    it('should return current feature flag status', async () => {
      const request = new Request('http://localhost:3000/api/admin/kill-switch', {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer test-admin-key'
        }
      });

      const response = await GET(request);
      expect(response.status).toBe(200);
      
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.current_flags).toBeDefined();
      expect(body.should_use_factbook).toBeDefined();
      expect(body.should_use_legacy).toBeDefined();
      expect(body.kill_switch_status).toBeNull();
    });
  });

  describe('POST endpoint', () => {
    it('should disable factbook when requested', async () => {
      const request = new Request('http://localhost:3000/api/admin/kill-switch', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-admin-key',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'disable_factbook',
          reason: 'Test disable'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.action_executed).toBe('disable_factbook');
      expect(body.should_use_factbook).toBe(false);
      expect(body.should_use_legacy).toBe(true);
      expect(body.kill_switch_status?.factbookDisabled).toBe(true);
    });

    it('should force fallback when requested', async () => {
      const request = new Request('http://localhost:3000/api/admin/kill-switch', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-admin-key',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'force_fallback',
          reason: 'Test fallback'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.action_executed).toBe('force_fallback');
      expect(body.should_use_factbook).toBe(false);
      expect(body.should_use_legacy).toBe(true);
      expect(body.kill_switch_status?.forceFallback).toBe(true);
    });

    it('should handle emergency disable', async () => {
      const request = new Request('http://localhost:3000/api/admin/kill-switch', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-admin-key',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'emergency_disable',
          reason: 'Emergency test'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.action_executed).toBe('emergency_disable');
      expect(body.should_use_factbook).toBe(false);
      expect(body.should_use_legacy).toBe(true);
      expect(body.kill_switch_status?.factbookDisabled).toBe(true);
      expect(body.kill_switch_status?.forceFallback).toBe(true);
    });

    it('should clear kill switch when requested', async () => {
      // First activate a kill switch
      featureFlagManager.setKillSwitch({
        disableFactbook: true,
        reason: 'Test setup'
      });

      const request = new Request('http://localhost:3000/api/admin/kill-switch', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-admin-key',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'clear'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
      
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.action_executed).toBe('clear');
      expect(body.kill_switch_status).toBeNull();
    });

    it('should reject invalid actions', async () => {
      const request = new Request('http://localhost:3000/api/admin/kill-switch', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer test-admin-key',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'invalid_action'
        })
      });

      const response = await POST(request);
      expect(response.status).toBe(400);
      
      const body = await response.json();
      expect(body.error).toContain('Invalid action');
    });
  });
});