import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export type ApiHandler<T> = (
  data: T,
  request: NextRequest
) => Promise<NextResponse | Response>;

export function createApiHandler<T>(
  schema: z.ZodType<T>,
  handler: ApiHandler<T>
) {
  return async (request: NextRequest) => {
    try {
      const body = await request.json().catch(() => ({}));
      console.log('API Handler - Request body:', body);
      console.log('API Handler - Schema:', schema);
      
      const result = schema.safeParse(body);
      
      if (!result.success) {
        console.log('Validation failed:', result.error.format());
        return NextResponse.json({ 
          error: 'Validation error', 
          details: result.error.format(),
          receivedData: body
        }, { status: 400 });
      }
      
      console.log('Validation passed, calling handler with:', result.data);
      return handler(result.data, request);
    } catch (error) {
      console.error('API error:', error);
      return NextResponse.json({ 
        error: 'Internal server error' 
      }, { status: 500 });
    }
  };
}

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