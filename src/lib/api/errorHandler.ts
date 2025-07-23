import { NextResponse } from 'next/server';

export function handleApiError(error: unknown, context: string) {
  console.error(`Error in ${context}:`, error);
  
  if (error instanceof Error) {
    return NextResponse.json({ 
      error: error.message || 'An error occurred' 
    }, { status: 500 });
  }
  
  return NextResponse.json({ 
    error: 'An unknown error occurred' 
  }, { status: 500 });
}