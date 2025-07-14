import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { createClient } from '@supabase/supabase-js';

console.log('[Echostone DEBUG] SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL);
console.log('[Echostone DEBUG] SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '[present]' : '[missing]');
console.log('[Echostone DEBUG] SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY ? '[present]' : '[missing]');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) throw new Error('Missing OPENAI_API_KEY in environment');
if (!SUPABASE_URL) throw new Error('Missing SUPABASE_URL in environment');
if (!SUPABASE_SERVICE_ROLE_KEY && !SUPABASE_ANON_KEY) {
  throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY in environment');
}
const supabaseKey = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY;

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const supabase = createClient(SUPABASE_URL, supabaseKey);

export const runtime = 'nodejs';

export async function POST(req: Request) {
  console.log('[POST] /api/onboarding/chat called');
  let question, userId;
  try {
    const body = await req.json();
    question = body.question;
    userId = body.userId;
    console.log('[DEBUG] Received question:', question, 'userId:', userId);
  } catch (err) {
    console.error('[ERROR] Invalid JSON:', err);
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // TEMP DEBUG: log all rows to verify which DB is being queried
  const allRows = await supabase.from('profiles').select('id, user_id, profile_data');
  console.log('[DEBUG] All rows:', JSON.stringify(allRows.data, null, 2));

  if (!question || typeof question !== 'string') {
    console.log('Returning: No question provided');
    return NextResponse.json({ error: 'No question provided.' }, { status: 400 });
  }
  if (!userId) {
    console.log('Returning: No userId provided');
    return NextResponse.json({ error: 'No userId provided.' }, { status: 401 });
  }
  const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidV4Pattern.test(userId)) {
    console.log('Returning: Invalid userId (not UUID)');
    return NextResponse.json({ error: 'Invalid userId (must be a UUID).' }, { status: 400 });
  }

  try {
    // Fetch the existing profile row by user_id
    const { data: row, error: fetchError } = await supabase
      .from('profiles')
      .select('id, profile_data')
      .eq('user_id', userId)
      .maybeSingle();

    if (fetchError) {
      console.error('[ERROR] Supabase fetch:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch profile.', details: fetchError }, { status: 500 });
    }
    if (!row) {
      console.log('Returning: Profile not found for user_id:', userId);
      return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
    }

    const existing = row.profile_data || {};

    // Extract any new personal info from the user question
    const extractPrompt = `
Extract as many distinct personal facts or memories as possible from the user's message, as a flat or nested JSON object. For each fact, choose the most appropriate key (invent new keys if needed, but prefer standard ones such as name, birthday, favorite_food, dislikes, family, friends, locations, favorite_drink, favorite_activities, memories, pets, life_lessons, work, etc). Use arrays for multiple values. If a fact relates to another person, use a nested object for that person.

Example 1:
User: "My best friend Nancy lives in South Dakota. We shot darts and she loves PBR beer."
Extract: {
  "friend": {
    "name": "Nancy",
    "location": "South Dakota",
    "shared_activities": ["shoot darts"],
    "favorite_drink": "PBR beer"
  }
}

Example 2:
User: "I have three cats, love jazz, and my dad Eric taught me to fish in Maine."
Extract: {
  "pets": ["cat", "cat", "cat"],
  "hobbies": ["jazz"],
  "family": {
    "father": "Eric"
  },
  "memories": ["Dad Eric taught me to fish in Maine"]
}

If no personal facts or memories are present, return {}.
User message:
${question}
Extract:
`.trim();

    let extracted = {};
    try {
      const extractRes = await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [{ role: 'system', content: extractPrompt }],
        temperature: 0,
        max_tokens: 120,
      });
      extracted = JSON.parse(extractRes.choices[0].message.content || '{}');
      console.log('[DEBUG] Extracted from question:', extracted);
    } catch (extractErr) {
      console.error('[ERROR] OpenAI extract from question:', extractErr);
    }

    // Compose system prompt for response
    const systemPrompt = `
You are a friendly onboarding assistant. Current profile data:
${JSON.stringify(existing, null, 2)}

Do not ask for fields that already exist. Respond to the user question:
`.trim();

    let answer = 'I’m sorry, I couldn’t process that.';
    try {
      const chatRes = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question },
        ],
        temperature: 0.7,
        max_tokens: 500,
      });
      answer = chatRes.choices[0].message.content ?? answer;
      console.log('[DEBUG] OpenAI answer:', answer);
    } catch (chatErr) {
      console.error('[ERROR] OpenAI chat:', chatErr);
    }

    // Extract any additional info from the assistant reply
    let extracted2 = {};
    try {
      const extractRes2 = await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [{ role: 'system', content: extractPrompt.replace('User message:', `User message:\n${answer}`) }],
        temperature: 0,
        max_tokens: 120,
      });
      extracted2 = JSON.parse(extractRes2.choices[0].message.content || '{}');
      console.log('[DEBUG] Extracted from answer:', extracted2);
    } catch (extractErr2) {
      console.error('[ERROR] OpenAI extract from answer:', extractErr2);
    }

    // Merge all info and append to history
    let merged = { ...existing };
    if (!merged.facts) merged.facts = {};

    if (Object.keys(extracted).length > 0) {
      merged.facts = { ...merged.facts, ...extracted };
    }
    if (Object.keys(extracted2).length > 0) {
      merged.facts = { ...merged.facts, ...extracted2 };
    }
    if (!Array.isArray(merged.history)) merged.history = [];
    merged.history.push({ question, answer });

    // Update the profile_data by row id
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ profile_data: merged })
      .eq('id', row.id);

    if (updateError) {
      console.error('[ERROR] Supabase update:', updateError);
      return NextResponse.json({ error: 'Failed to update profile.', details: updateError }, { status: 500 });
    }

    console.log('Returning: Success with answer and merged profile');
    return NextResponse.json({ answer, profile: merged });
  } catch (err) {
    console.error('[ERROR] Unexpected:', err);
    return NextResponse.json({ error: 'Server error', message: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}