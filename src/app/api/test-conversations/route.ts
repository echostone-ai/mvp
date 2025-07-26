import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    console.log('Testing database connection...');
    
    // Test basic connection
    const { data: testData, error: testError } = await supabaseAdmin
      .from('conversations')
      .select('count(*)')
      .limit(1);
    
    if (testError) {
      console.error('Database connection error:', testError);
      return NextResponse.json({ 
        error: 'Database connection failed', 
        details: testError 
      }, { status: 500 });
    }
    
    // Test table structure
    const { data: tableInfo, error: tableError } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .limit(1);
    
    if (tableError) {
      console.error('Table query error:', tableError);
      return NextResponse.json({ 
        error: 'Table query failed', 
        details: tableError 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Database connection working',
      tableStructure: tableInfo?.[0] ? Object.keys(tableInfo[0]) : 'No data',
      totalRows: testData
    });
    
  } catch (error) {
    console.error('Test error:', error);
    return NextResponse.json({ 
      error: 'Test failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}