// src/app/api/extract-memories/route.ts
import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { supabase } from '@/components/supabaseClient';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const EXTRACTION_PROMPT = `
You are an AI assistant that extracts meaningful personal information from user messages to create memory fragments for future conversations.

Your task is to identify and extract:
- Personal relationships (family, friends, colleagues, pets)
- Significant experiences and life events
- Personal preferences (hobbies, interests, dislikes)
- Important personal details (goals, fears, values)
- Emotional connections and memories
- Daily activities and routines that reveal personality
- Opinions and beliefs that show their worldview
- Places they've been or want to visit
- Professional information and career details
- Health information they might want you to remember

IMPORTANT RULES:
1. Be THOROUGH - extract ALL meaningful personal information, even small details
2. Extract complete, standalone fragments that make sense without additional context
3. Be SPECIFIC - include names, places, and concrete details whenever possible
4. Focus on information that reveals character, relationships, or preferences
5. Include information they might expect you to remember later
6. Format each memory as a complete sentence starting with "The user..."
7. If no meaningful personal information is found, return an empty array

Return your response as a JSON array of strings, where each string is a meaningful memory fragment.
`;

export async function POST(req: Request) {
  try {
    const { text, userId, avatarId, context } = await req.json();
    
    if (!text || !userId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Extract memory fragments
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: EXTRACTION_PROMPT,
        },
        {
          role: 'user',
          content: text + (context ? `\n\nCONVERSATION CONTEXT:\n${JSON.stringify(context)}` : ''),
        },
      ],
      temperature: 0.3,
      max_tokens: 800,
    });
    
    const response = completion.choices[0].message.content;
    if (!response) {
      return NextResponse.json({ error: 'No response from OpenAI' }, { status: 500 });
    }
    
    // Parse the JSON response
    let fragments: string[];
    try {
      fragments = JSON.parse(response);
    } catch (error) {
      return NextResponse.json({ error: 'Failed to parse memory extraction response' }, { status: 500 });
    }
    
    // Validate that we got an array of strings
    if (!Array.isArray(fragments) || !fragments.every(f => typeof f === 'string')) {
      return NextResponse.json({ error: 'Invalid memory extraction response format' }, { status: 500 });
    }
    
    if (fragments.length === 0) {
      return NextResponse.json({ message: 'No memory fragments extracted' });
    }
    
    // Generate embeddings for all fragments
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: fragments,
      encoding_format: 'float',
    });
    
    const embeddings = embeddingResponse.data.map(item => item.embedding);
    
    // Store fragments with embeddings
    const insertData = fragments.map((fragmentText, index) => ({
      user_id: userId,
      avatar_id: avatarId, // This ensures avatar isolation
      fragment_text: fragmentText.trim(),
      embedding: embeddings[index],
      conversation_context: context || {}
    }));
    
    const { data, error } = await supabase
      .from('memory_fragments')
      .insert(insertData)
      .select('id');
    
    if (error) {
      console.error('Memory storage error:', error);
      return NextResponse.json({ error: 'Failed to store memory fragments' }, { status: 500 });
    }
    
    return NextResponse.json({ 
      message: `Stored ${fragments.length} memory fragments`,
      fragmentIds: data.map(item => item.id)
    });
  } catch (error: any) {
    console.error('Memory extraction error:', error);
    return NextResponse.json({ error: error.message || 'Unknown error' }, { status: 500 });
  }
}