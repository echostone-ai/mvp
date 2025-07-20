/**
 * Simple in-memory rate limiter
 * In production, you would use a Redis-based solution
 */

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimits: Record<string, RateLimitRecord> = {};

interface RateLimiterOptions {
  interval: number; // Time window in milliseconds
  maxRequests: number; // Maximum number of requests allowed in the window
}

interface RateLimiterResult {
  success: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Creates a rate limiter with the specified options
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const { interval, maxRequests } = options;
  
  return {
    /**
     * Checks if a request is rate limited
     * @param key The key to rate limit on (e.g. IP address, user ID)
     * @returns Result with success status and remaining requests
     */
    check(key: string): RateLimiterResult {
      const now = Date.now();
      
      // Clean up expired records
      Object.keys(rateLimits).forEach(k => {
        if (rateLimits[k].resetAt < now) {
          delete rateLimits[k];
        }
      });
      
      // Check if key exists
      if (!rateLimits[key]) {
        rateLimits[key] = {
          count: 1,
          resetAt: now + interval
        };
        return {
          success: true,
          remaining: maxRequests - 1,
          resetAt: rateLimits[key].resetAt
        };
      }
      
      // Check if limit is reached
      if (rateLimits[key].count >= maxRequests) {
        return {
          success: false,
          remaining: 0,
          resetAt: rateLimits[key].resetAt
        };
      }
      
      // Increment count
      rateLimits[key].count++;
      return {
        success: true,
        remaining: maxRequests - rateLimits[key].count,
        resetAt: rateLimits[key].resetAt
      };
    },
    
    /**
     * Gets the remaining requests for a key
     * @param key The key to check
     * @returns The remaining requests and reset time
     */
    getInfo(key: string): { remaining: number; resetAt: number; limit: number } | null {
      if (!rateLimits[key]) {
        return null;
      }
      
      return {
        remaining: Math.max(0, maxRequests - rateLimits[key].count),
        resetAt: rateLimits[key].resetAt,
        limit: maxRequests
      };
    }
  };
}

/**
 * Legacy function for backward compatibility
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const limiter = createRateLimiter({
    interval: windowMs,
    maxRequests: limit
  });
  
  return limiter.check(key).success;
}

/**
 * Legacy function for backward compatibility
 */
export function getRateLimitInfo(key: string): { remaining: number; resetAt: number; limit: number } | null {
  if (!rateLimits[key]) {
    return null;
  }
  
  return {
    remaining: Math.max(0, 100 - rateLimits[key].count), // Assuming default limit of 100
    resetAt: rateLimits[key].resetAt,
    limit: 100 // Assuming default limit of 100
  };
}