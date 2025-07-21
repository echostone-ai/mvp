import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // Get the current user from Supabase auth
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            cookieStore.set({ name, value: '', ...options });
          },
        },
      }
    );

    // Test connection by getting the current user
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      return NextResponse.json({ 
        success: false, 
        error: error.message 
      });
    }
    
    // Test database connection
    const { data: testData, error: testError } = await supabase
      .from('avatar_profiles')
      .select('count')
      .limit(1);
    
    if (testError) {
      return NextResponse.json({ 
        success: false, 
        error: `Database connection error: ${testError.message}` 
      });
    }
    
    return NextResponse.json({
      success: true,
      user: user ? {
        id: user.id,
        email: user.email,
        authenticated: !!user
      } : null,
      databaseConnected: true
    });
    
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'An unexpected error occurred' 
    });
  }
}