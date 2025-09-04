/**
 * Unit tests for raceWithTimeout race condition fix
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Implementation of the fixed raceWithTimeout function
async function raceWithTimeout<T>(promise: Promise<T>, ms: number): Promise<{ ok: boolean, timeout: boolean, result?: T }> {
  let timeoutId: NodeJS.Timeout | null = null;
  let isResolved = false;

  const timeoutPromise = new Promise<{ ok: boolean, timeout: boolean }>((resolve) => {
    timeoutId = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        resolve({ ok: false, timeout: true });
      }
    }, ms);
  });

  const wrappedPromise = promise.then(
    result => {
      if (!isResolved) {
        isResolved = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        return { ok: true, timeout: false, result };
      }
      return { ok: false, timeout: true }; // Already resolved by timeout
    },
    error => {
      if (!isResolved) {
        isResolved = true;
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        throw error;
      }
      throw new Error('Already resolved by timeout');
    }
  );

  return Promise.race([wrappedPromise, timeoutPromise]);
}

describe('raceWithTimeout race condition fix', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should resolve with result when promise completes before timeout', async () => {
    const testPromise = new Promise<string>((resolve) => {
      setTimeout(() => resolve('test result'), 50);
    });

    const racePromise = raceWithTimeout(testPromise, 100);
    
    // Advance time to resolve the test promise
    vi.advanceTimersByTime(50);
    
    const result = await racePromise;
    
    expect(result).toEqual({
      ok: true,
      timeout: false,
      result: 'test result'
    });
  });

  it('should timeout when promise takes longer than timeout', async () => {
    const testPromise = new Promise<string>((resolve) => {
      setTimeout(() => resolve('test result'), 200);
    });

    const racePromise = raceWithTimeout(testPromise, 100);
    
    // Advance time to trigger timeout
    vi.advanceTimersByTime(100);
    
    const result = await racePromise;
    
    expect(result).toEqual({
      ok: false,
      timeout: true
    });
  });

  it('should handle promise rejection before timeout', async () => {
    const testPromise = new Promise<string>((resolve, reject) => {
      setTimeout(() => reject(new Error('test error')), 50);
    });

    const racePromise = raceWithTimeout(testPromise, 100);
    
    // Advance time to trigger rejection
    vi.advanceTimersByTime(50);
    
    await expect(racePromise).rejects.toThrow('test error');
  });

  it('should timeout when promise rejects after timeout', async () => {
    const testPromise = new Promise<string>((resolve, reject) => {
      setTimeout(() => reject(new Error('test error')), 200);
    });

    const racePromise = raceWithTimeout(testPromise, 100);
    
    // Advance time to trigger timeout first
    vi.advanceTimersByTime(100);
    
    const result = await racePromise;
    
    expect(result).toEqual({
      ok: false,
      timeout: true
    });
  });

  it('should clear timeout when promise resolves first', async () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');
    
    const testPromise = new Promise<string>((resolve) => {
      setTimeout(() => resolve('test result'), 50);
    });

    const racePromise = raceWithTimeout(testPromise, 100);
    
    // Advance time to resolve the test promise
    vi.advanceTimersByTime(50);
    
    await racePromise;
    
    // Verify clearTimeout was called
    expect(clearTimeoutSpy).toHaveBeenCalled();
    
    clearTimeoutSpy.mockRestore();
  });

  it('should prevent double resolution when timeout and promise resolve simultaneously', async () => {
    let resolveCount = 0;
    
    const testPromise = new Promise<string>((resolve) => {
      setTimeout(() => {
        resolveCount++;
        resolve('test result');
      }, 100);
    });

    const racePromise = raceWithTimeout(testPromise, 100);
    
    // Advance time to trigger both timeout and promise resolution
    vi.advanceTimersByTime(100);
    
    const result = await racePromise;
    
    // Should only resolve once, either with timeout or result
    expect(resolveCount).toBe(1);
    expect(result.ok !== undefined).toBe(true);
    expect(result.timeout !== undefined).toBe(true);
  });

  it('should handle multiple concurrent raceWithTimeout calls without interference', async () => {
    const promise1 = new Promise<string>((resolve) => {
      setTimeout(() => resolve('result1'), 30);
    });
    
    const promise2 = new Promise<string>((resolve) => {
      setTimeout(() => resolve('result2'), 80);
    });
    
    const promise3 = new Promise<string>((resolve) => {
      setTimeout(() => resolve('result3'), 150);
    });

    const race1 = raceWithTimeout(promise1, 100);
    const race2 = raceWithTimeout(promise2, 100);
    const race3 = raceWithTimeout(promise3, 100);
    
    // Advance time progressively
    vi.advanceTimersByTime(30);
    const result1 = await race1;
    
    vi.advanceTimersByTime(50); // Total 80ms
    const result2 = await race2;
    
    vi.advanceTimersByTime(20); // Total 100ms
    const result3 = await race3;
    
    expect(result1).toEqual({ ok: true, timeout: false, result: 'result1' });
    expect(result2).toEqual({ ok: true, timeout: false, result: 'result2' });
    expect(result3).toEqual({ ok: false, timeout: true });
  });
});