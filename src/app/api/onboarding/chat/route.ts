import { NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { createClient } from '@supabase/supabase-js';
import { cleanProfile } from '../../clean-profile/profileCleanup';

const storyStarters = [
  "Can you tell me about a moment that changed you?",
  "Who was your childhood hero, and why?",
  "Describe a time you felt truly alive.",
  "Is there a place that holds special meaning for you?",
  "Tell me about an adventure, big or small.",
  "Who influenced your beliefs the most?",
  "Was there a lesson you learned the hard way?",
  "What’s a favorite family tradition or story?",
  "Share a memory that makes you smile.",
  "Is there something about you most people don’t know?",
  "What do you want future generations to remember about you?",
];

function pickStoryStarter() {
  return storyStarters[Math.floor(Math.random() * storyStarters.length)];
}

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

IMPORTANT:
- When extracting facts or summarizing stories, ALWAYS preserve specific names, people, places, organizations, bands, events, and unique details.
- Do NOT generalize away or omit famous names, brands, or key locations.
- For example, if the user says "I snuck into a Paul McCartney concert," store "Snuck into a Paul McCartney concert" as a memory (not just "snuck into a concert").
- When in doubt, err on the side of keeping the original, specific wording—never reduce to generic events.
- Always include famous or culturally significant details in your facts and memories.
- If a user shares a story or memory, use their exact wording as a direct quote when possible.
- For each extracted memory, if possible, add a field "why_it_matters" with the user's feeling or the significance if it's present.

Example 3:
User: "I snuck into a Paul McCartney concert in Austin, Texas, in 2010. It was amazing."
Extract: {
  "memories": ["Snuck into a Paul McCartney concert in Austin, Texas, in 2010."],
  "feelings": ["amazing", "one of the best concert experiences in my life"],
  "locations": ["Austin, Texas"],
  "people": ["Paul McCartney"],
  "notable_events": ["Paul McCartney concert"],
  "why_it_matters": ["It was a lifelong dream"]
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
You are Claire, the legendary onboarding agent for EchoStone—a digital memorial project whose mission is to capture the *full, living story* of a person for future generations.

Your job is not just to collect facts, but to inspire the user to share long stories, colorful details, and memories that reveal their personality, beliefs, quirks, key relationships, and life lessons.

You must gently but persistently encourage the user to go deeper—ask follow-up questions, help them remember stories, and celebrate their unique voice. Try to cover every aspect of their life: family, friends, love, work, passions, struggles, dreams, regrets, adventures, beliefs, and the places that shaped them.

**Important:**
- Never settle for surface-level facts—always invite the user to elaborate, explain, or share a story.
- When a user gives a one-word answer or short response, thank them, but then invite them to reflect and expand: “Can you tell me about a time when...?”
- If you learn about an important person, place, or event, follow up with: “How did that shape you?” or “Is there a memory that stands out?”
- Always ask open-ended, curiosity-driven questions—never yes/no.
- When the conversation slows, try asking the user this “story starter” to keep the memories flowing: "${pickStoryStarter()}"

Here’s what we’ve already learned so far:
${JSON.stringify(existing, null, 2)}

Do not ask for fields that already exist. Respond to the user’s most recent message and gently encourage them to share more, or move on to another area of their life if a topic seems complete.
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

    // Clean the merged profile before saving
    const cleanedProfile = cleanProfile(merged);

    // Update the profile_data by row id
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ profile_data: cleanedProfile })
      .eq('id', row.id);

    if (updateError) {
      console.error('[ERROR] Supabase update:', updateError);
      return NextResponse.json({ error: 'Failed to update profile.', details: updateError }, { status: 500 });
    }

    console.log('Returning: Success with answer and merged profile');
    return NextResponse.json({ answer, profile: cleanedProfile });
  } catch (err) {
    console.error('[ERROR] Unexpected:', err);
    return NextResponse.json({ error: 'Server error', message: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}