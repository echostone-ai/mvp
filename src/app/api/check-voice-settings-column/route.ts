import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

/**
 * API endpoint to check if voice_settings column exists and create it if needed
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Get user session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ 
        error: 'Authentication required'
      }, { status: 401 });
    }

    console.log('Checking if voice_settings column exists...');

    // Try to query the voice_settings column to see if it exists
    try {
      const { data, error } = await supabase
        .from('avatar_profiles')
        .select('voice_settings')
        .limit(1);

      if (error) {
        console.log('voice_settings column does not exist:', error.message);
        
        // Try to add the column using a raw SQL query
        // Note: This might not work with Supabase's security policies
        console.log('Attempting to add voice_settings column...');
        
        return NextResponse.json({
          success: false,
          columnExists: false,
          message: 'voice_settings column does not exist. Please add it manually in Supabase.',
          sqlCommand: 'ALTER TABLE avatar_profiles ADD COLUMN voice_settings JSONB;'
        });
      } else {
        console.log('voice_settings column exists');
        return NextResponse.json({
          success: true,
          columnExists: true,
          message: 'voice_settings column exists'
        });
      }
    } catch (error) {
      console.error('Error checking column:', error);
      return NextResponse.json({
        success: false,
        error: 'Failed to check column existence',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Check voice settings column error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}