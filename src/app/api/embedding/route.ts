// src/app/api/embedding/route.ts
import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    
    if (!text) {
      return NextResponse.json({ error: 'Missing text field' }, { status: 400 });
    }
    
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      encoding_format: 'float',
    });
    
    if (!response.data?.[0]?.embedding) {
      return NextResponse.json({ error: 'No embedding data returned from OpenAI' }, { status: 500 });
    }
    
    return NextResponse.json({ embedding: response.data[0].embedding });
  } catch (error: any) {
    console.error('Embedding generation error:', error);
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
}