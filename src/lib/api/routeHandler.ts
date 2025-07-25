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
  return async (body: any, request: NextRequest) => {
    try {
      // body is already parsed!
      console.log('API Handler - Request body:', body);
      const result = schema.safeParse(body);
      if (!result.success) {
        console.log('Validation failed:', result.error.format());
        return NextResponse.json({ 
          error: 'Validation error', 
          details: result.error.format(),
          receivedData: body
        }, { status: 400 });
      }
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