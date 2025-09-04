/**
 * Voice Expression Integration Tests
 * 
 * Tests to verify that expression overlays integrate correctly with the voice pipeline
 * without affecting TTS performance or reliability.
 * 
 * Requirements: 9.1, 9.2, 5.2
 */

import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { createStreamingAudioManager, StreamingAudioManager } from '../streamingUtils';
import { 
  integrateExpressionsWithVoice, 
  setupUserExpressions, 
  setupAvatarExpressions,
  disableExpressions,
  enableExpressions,
  checkExpressionsAvailable
} from '../voiceExpressionIntegration';
import { ExpressionStorageService, StoredExpression } from '../services/expressionStorageService';
import * as featureFlags from '../featureFlags';

// Mock dependencies
vi.mock('../services/expressionStorageService');
vi.mock('../featureFlags');
vi.mock('../globalAudioManager');

// Mock AudioContext
const mockAudioContext = {
  state: 'running',
  resume: vi.fn().mockResolvedValue(undefined),
  createGain: vi.fn().mockReturnValue({
    gain: { 
      value: 1, 
      setValueAtTime: vi.fn(), 
      linearRampToValueAtTime: vi.fn(),
      cancelScheduledValues: vi.fn()
    },
    connect: vi.fn(),
    disconnect: vi.fn()
  }),
  createBufferSource: vi.fn().mockReturnValue({
    buffer: null,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null
  }),
  decodeAudioData: vi.fn().mockResolvedValue(new ArrayBuffer(1024)),
  destination: {},
  currentTime: 0
};

// Mock global AudioContext
Object.defineProperty(window, 'AudioContext', {
  writable: true,
  value: vi.fn().mockImplementation(() => mockAudioContext)
});

// Mock fetch for audio loading
global.fetch = vi.fn();

describe('Voice Expression Integration', () => {
  let audioManager: StreamingAudioManager;
  let mockExpressions: StoredExpression[];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create audio manager
    audioManager = createStreamingAudioManager('test-voice-id');
    
    // Mock expressions data
    mockExpressions = [
      {
        id: 'expr-1',
        ownerId: 'user-123',
        ownerType: 'user',
        filename: 'laugh.mp3',
        type: 'laugh',
        tone: 'cheerful',
        placementHints: ['funny', 'joke'],
        durationMs: 250,
        priority: 1,
        status: 'active',
        cdnUrl: 'https://cdn.example.com/laugh.mp3',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      },
      {
        id: 'expr-2',
        ownerId: 'user-123',
        ownerType: 'user',
        filename: 'sigh.mp3',
        type: 'sigh',
        tone: 'disappointed',
        placementHints: ['unfortunately', 'sadly'],
        durationMs: 180,
        priority: 0,
        status: 'active',
        cdnUrl: 'https://cdn.example.com/sigh.mp3',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      }
    ];

    // Mock feature flag as enabled
    (featureFlags.isFeatureEnabled as Mock).mockReturnValue(true);
    
    // Mock storage service
    (ExpressionStorageService.listExpressions as Mock).mockResolvedValue(mockExpressions);
    (ExpressionStorageService.countExpressions as Mock).mockResolvedValue(mockExpressions.length);
    
    // Mock successful fetch responses
    (global.fetch as Mock).mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
    });
  });

  afterEach(() => {
    audioManager.stop();
  });

  describe('integrateExpressionsWithVoice', () => {
    it('should successfully integrate expressions when feature is enabled', async () => {
      const result = await integrateExpressionsWithVoice(audioManager, {
        ownerId: 'user-123',
        ownerType: 'user'
      });

      expect(result.success).toBe(true);
      expect(result.expressionCount).toBe(2);
      expect(result.error).toBeUndefined();
      
      // Verify storage service was called correctly
      expect(ExpressionStorageService.listExpressions).toHaveBeenCalledWith({
        ownerType: 'user',
        ownerKey: 'user-123',
        status: 'active',
        limit: 50
      });
    });

    it('should return failure when feature is disabled', async () => {
      (featureFlags.isFeatureEnabled as Mock).mockReturnValue(false);

      const result = await integrateExpressionsWithVoice(audioManager, {
        ownerId: 'user-123',
        ownerType: 'user'
      });

      expect(result.success).toBe(false);
      expect(result.expressionCount).toBe(0);
      expect(result.error).toBe('Voice overlays feature is disabled');
    });

    it('should handle no expressions gracefully', async () => {
      (ExpressionStorageService.listExpressions as Mock).mockResolvedValue([]);

      const result = await integrateExpressionsWithVoice(audioManager, {
        ownerId: 'user-123',
        ownerType: 'user'
      });

      expect(result.success).toBe(true);
      expect(result.expressionCount).toBe(0);
      expect(result.error).toBeUndefined();
    });

    it('should handle storage service errors gracefully', async () => {
      const error = new Error('Storage service failed');
      (ExpressionStorageService.listExpressions as Mock).mockRejectedValue(error);

      const result = await integrateExpressionsWithVoice(audioManager, {
        ownerId: 'user-123',
        ownerType: 'user'
      });

      expect(result.success).toBe(false);
      expect(result.expressionCount).toBe(0);
      expect(result.error).toBe('Storage service failed');
    });

    it('should handle audio loading failures gracefully', async () => {
      (global.fetch as Mock).mockRejectedValue(new Error('Network error'));

      const result = await integrateExpressionsWithVoice(audioManager, {
        ownerId: 'user-123',
        ownerType: 'user'
      });

      // Should still succeed even if audio loading fails (graceful degradation)
      expect(result.success).toBe(true);
      expect(result.expressionCount).toBe(2);
    });
  });

  describe('setupUserExpressions', () => {
    it('should set up user expressions correctly', async () => {
      const result = await setupUserExpressions(audioManager, 'user-123');

      expect(result.success).toBe(true);
      expect(result.expressionCount).toBe(2);
      
      expect(ExpressionStorageService.listExpressions).toHaveBeenCalledWith({
        ownerType: 'user',
        ownerKey: 'user-123',
        status: 'active',
        limit: 50
      });
    });
  });

  describe('setupAvatarExpressions', () => {
    it('should set up avatar expressions correctly', async () => {
      const result = await setupAvatarExpressions(audioManager, 'avatar-456');

      expect(result.success).toBe(true);
      expect(result.expressionCount).toBe(2);
      
      expect(ExpressionStorageService.listExpressions).toHaveBeenCalledWith({
        ownerType: 'avatar',
        ownerKey: 'avatar-456',
        status: 'active',
        limit: 50
      });
    });
  });

  describe('enableExpressions and disableExpressions', () => {
    it('should enable expressions when feature flag is on', () => {
      const enableSpy = vi.spyOn(audioManager, 'enableExpressions');
      
      enableExpressions(audioManager);
      
      expect(enableSpy).toHaveBeenCalledWith(true);
    });

    it('should not enable expressions when feature flag is off', () => {
      (featureFlags.isFeatureEnabled as Mock).mockReturnValue(false);
      const enableSpy = vi.spyOn(audioManager, 'enableExpressions');
      
      enableExpressions(audioManager);
      
      expect(enableSpy).not.toHaveBeenCalled();
    });

    it('should disable expressions', () => {
      const enableSpy = vi.spyOn(audioManager, 'enableExpressions');
      
      disableExpressions(audioManager);
      
      expect(enableSpy).toHaveBeenCalledWith(false);
    });
  });

  describe('checkExpressionsAvailable', () => {
    it('should return true when expressions are available', async () => {
      const available = await checkExpressionsAvailable('user-123', 'user');
      
      expect(available).toBe(true);
      expect(ExpressionStorageService.countExpressions).toHaveBeenCalledWith({
        ownerType: 'user',
        ownerKey: 'user-123',
        status: 'active'
      });
    });

    it('should return false when no expressions are available', async () => {
      (ExpressionStorageService.countExpressions as Mock).mockResolvedValue(0);
      
      const available = await checkExpressionsAvailable('user-123', 'user');
      
      expect(available).toBe(false);
    });

    it('should return false when feature is disabled', async () => {
      (featureFlags.isFeatureEnabled as Mock).mockReturnValue(false);
      
      const available = await checkExpressionsAvailable('user-123', 'user');
      
      expect(available).toBe(false);
      expect(ExpressionStorageService.countExpressions).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      (ExpressionStorageService.countExpressions as Mock).mockRejectedValue(new Error('DB error'));
      
      const available = await checkExpressionsAvailable('user-123', 'user');
      
      expect(available).toBe(false);
    });
  });
});

describe('TTS Performance Integration', () => {
  let audioManager: StreamingAudioManager;

  beforeEach(() => {
    vi.clearAllMocks();
    audioManager = createStreamingAudioManager('test-voice-id');
    
    // Mock feature flag as enabled
    (featureFlags.isFeatureEnabled as Mock).mockReturnValue(true);
    
    // Mock empty expressions to focus on TTS performance
    (ExpressionStorageService.listExpressions as Mock).mockResolvedValue([]);
  });

  afterEach(() => {
    audioManager.stop();
  });

  it('should not delay TTS start time when expressions are enabled', async () => {
    // Set up expressions
    await integrateExpressionsWithVoice(audioManager, {
      ownerId: 'user-123',
      ownerType: 'user'
    });

    // Mock the TTS synthesis to measure timing
    const startTime = performance.now();
    
    // Add sentence should not be delayed by expression setup
    await audioManager.addSentence('This is a test sentence for TTS timing.');
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // Should complete quickly (under 10ms as per requirement 9.1)
    expect(duration).toBeLessThan(10);
  });

  it('should maintain normal TTS operation when expressions fail', async () => {
    // Mock expression loading failure
    (ExpressionStorageService.listExpressions as Mock).mockRejectedValue(new Error('Storage error'));
    
    // Set up expressions (should fail gracefully)
    const result = await integrateExpressionsWithVoice(audioManager, {
      ownerId: 'user-123',
      ownerType: 'user'
    });
    
    expect(result.success).toBe(false);
    
    // TTS should still work normally
    const startTime = performance.now();
    await audioManager.addSentence('This should still work without expressions.');
    const endTime = performance.now();
    
    expect(endTime - startTime).toBeLessThan(10);
  });
});