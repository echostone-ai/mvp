/**
 * Feature flag utilities for EchoStone
 * Provides centralized feature flag management across the application
 */

export interface FeatureFlags {
  VOICE_OVERLAYS: boolean;
  EXPRESSION_OVERLAYS_ENABLED: boolean;
  STORIES_ENABLED: boolean;
}

/**
 * Get all feature flags from environment variables
 */
export function getFeatureFlags(): FeatureFlags {
  return {
    VOICE_OVERLAYS: process.env.FEATURE_VOICE_OVERLAYS === 'true',
    EXPRESSION_OVERLAYS_ENABLED: 
      process.env.EXPRESSION_OVERLAYS_ENABLED === 'true' || 
      process.env.NEXT_PUBLIC_EXPRESSION_OVERLAYS_ENABLED === 'true',
    STORIES_ENABLED: process.env.STORIES_ENABLED === 'true',
  };
}

/**
 * Check if a specific feature flag is enabled
 */
export function isFeatureEnabled(flag: keyof FeatureFlags): boolean {
  const flags = getFeatureFlags();
  return flags[flag];
}

/**
 * Middleware helper for API routes to check feature flags
 */
export function requireFeatureFlag(flag: keyof FeatureFlags) {
  return (handler: Function) => {
    return async (request: Request, ...args: any[]) => {
      if (!isFeatureEnabled(flag)) {
        return new Response('Feature not available', { status: 404 });
      }
      return handler(request, ...args);
    };
  };
}

/**
 * React hook for checking feature flags in components
 */
export function useFeatureFlag(flag: keyof FeatureFlags): boolean {
  // For server-side rendering, we need to check the flag on the client
  // This will be used in components to conditionally render features
  if (typeof window === 'undefined') {
    // Server-side: return false to avoid hydration mismatches
    return false;
  }
  
  // Client-side: check the flag (this would typically come from a context or API)
  // For now, we'll use a simple approach that matches the server-side logic
  return isFeatureEnabled(flag);
}

/**
 * Server-side feature flag check for components
 */
export function getServerFeatureFlag(flag: keyof FeatureFlags): boolean {
  return isFeatureEnabled(flag);
}