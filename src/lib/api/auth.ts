/**
 * Authentication utilities for API routes
 */

import { NextRequest } from 'next/server';
import { supabase } from '@/lib/supabase';

export interface AuthenticatedUser {
  id: string;
  email?: string;
  [key: string]: any;
}

/**
 * Get authenticated user from request
 * Supports both Authorization header and cookie-based auth
 */
export async function getAuthenticatedUser(request: NextRequest): Promise<AuthenticatedUser | null> {
  try {
    // Try Authorization header first (Bearer token)
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (!error && user) {
        return {
          id: user.id,
          email: user.email,
          ...user.user_metadata
        };
      }
    }

    // Try cookie-based session (for browser requests)
    const cookies = request.headers.get('cookie');
    if (cookies) {
      // Create a new supabase client with the request cookies
      const { createServerComponentClient } = await import('@supabase/auth-helpers-nextjs');
      const { cookies: cookieStore } = await import('next/headers');
      
      try {
        const supabaseWithCookies = createServerComponentClient({ cookies: () => cookieStore() });
        const { data: { session }, error } = await supabaseWithCookies.auth.getSession();
        
        if (!error && session?.user) {
          return {
            id: session.user.id,
            email: session.user.email,
            ...session.user.user_metadata
          };
        }
      } catch (cookieError) {
        // Cookie-based auth not available, continue with fallback
        console.log('[Auth] Cookie-based auth not available:', cookieError);
      }
    }

    return null;
  } catch (error) {
    console.error('[Auth] Authentication error:', error);
    return null;
  }
}

/**
 * Check if user has access to a specific avatar
 */
export async function checkAvatarAccess(userId: string, avatarId: string): Promise<boolean> {
  try {
    // Check for demo mode first
    const DEMO_SYSTEM_USER_ID = process.env.DEMO_SYSTEM_USER_ID;
    const isDemoMode = userId === DEMO_SYSTEM_USER_ID && avatarId === 'jonathan-demo';
    
    if (isDemoMode) {
      console.log('[Auth] Demo mode access granted for jonathan-demo');
      return true;
    }
    
    // For MVP, we'll do a simple check for non-demo users
    // In production, this would check avatar ownership in the database
    
    // TODO: Implement proper avatar ownership check
    // const { data: avatar } = await supabase
    //   .from('avatar_profiles')
    //   .select('user_id')
    //   .eq('id', avatarId)
    //   .single();
    // 
    // return avatar?.user_id === userId;
    
    // For now, allow access if both userId and avatarId are provided
    return !!(userId && avatarId);
  } catch (error) {
    console.error('[Auth] Error checking avatar access:', error);
    return false;
  }
}

/**
 * Middleware helper for API routes that require authentication
 */
export function requireAuth(handler: Function) {
  return async (request: NextRequest, ...args: any[]) => {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required' }),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // Add user to request context
    (request as any).user = user;
    return handler(request, ...args);
  };
}