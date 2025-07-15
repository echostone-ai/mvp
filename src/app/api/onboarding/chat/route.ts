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

// Intelligent mapping function to convert extracted data into profile question answers
async function mapExtractedDataToQuestions(extractedData: any, existingProfile: any): Promise<Record<string, Record<string, string>>> {
  if (!extractedData || Object.keys(extractedData).length === 0) {
    return {};
  }

  const mappingPrompt = `
You are an expert at mapping extracted personal information to specific profile questions. Given the extracted data, intelligently fill in answers for relevant profile questions.

EXTRACTED DATA:
${JSON.stringify(extractedData, null, 2)}

EXISTING PROFILE DATA (don't overwrite existing answers):
${JSON.stringify(existingProfile, null, 2)}

MAP TO THESE PROFILE QUESTION CATEGORIES AND KEYS:

PERSONAL_SNAPSHOT:
- sibling_order_nicknames_story: "Sibling order, nicknames and a favorite shared story"
- parent_names_vivid_memory: "Parent names and one vivid memory with each"
- obscure_fact: "An obscure fact most people don't know about you"
- three_adjectives_others_use: "Three adjectives others use to describe you"

FAMILY_ORIGINS_CHILDHOOD:
- parent_names_vivid_memory: "Parent names and one vivid memory with each"
- sibling_order_nicknames_story: "Sibling order, nicknames and a favorite shared story"
- childhood_fear_overcome: "A childhood fear and how you overcame it"
- earliest_memory: "Your earliest memory—and what it taught you"
- admired_family_member: "A family member you admired and what you learned from them"

FRIENDSHIPS_SOCIAL_CIRCLE:
- closest_childhood_friend: "Closest childhood friend and your signature adventure"
- inside_joke: "Inside joke that still makes you laugh"
- friendship_milestone: "A friendship milestone you'll never forget"

DEFINING_LIFE_MOMENTS_CHALLENGES:
- biggest_risk: "Biggest risk you've ever taken"
- failure_turning_point: "A failure that became a turning point"
- surprising_yourself: "A time you surprised even yourself"

MEMORY_NOSTALGIA:
- vivid_childhood_memory: "Most vivid memory from early childhood"
- meaningful_keepsake: "A keepsake that holds deep meaning"
- sensory_nostalgia: "A song or scent that triggers nostalgia"

PREFERENCES_QUIRKS_JUST_BECAUSE:
- unusual_fears_dislikes: "Unusual phobias or strong dislikes"
- sure_smile: "What makes you smile without fail"

TOP_IMPORTANT_PEOPLE:
- most_influential_person: "The most influential person in your life and why"
- family_inspiration: "A family member who inspires you"
- friend_support_story: "A friend who supported you during a tough time"

INSTRUCTIONS:
1. Only fill in questions where you have specific, relevant information from the extracted data
2. Write complete, natural sentences as if the person is answering the question
3. Include specific names, details, and context from the extracted data
4. Don't make up information - only use what's provided
5. If a question already has an answer in the existing profile, skip it
6. Focus on the most relevant mappings based on the extracted data

Return a JSON object with this structure:
{
  "section_name": {
    "question_key": "Complete answer based on extracted data"
  }
}

Example:
If extracted data contains: {"family": {"siblings": [{"name": "Geoff", "relationship": "brother", "shared_memories": ["chased me with a snake"]}]}}

Return:
{
  "family_origins_childhood": {
    "sibling_order_nicknames_story": "I have a brother named Geoff. One memorable story is when he chased me with a snake when I was little."
  }
}
`;

  try {
    const mappingRes = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [{ role: 'system', content: mappingPrompt }],
      temperature: 0.3,
      max_tokens: 800,
    });

    const mappedAnswers = JSON.parse(mappingRes.choices[0].message.content || '{}');
    console.log('[DEBUG] AI mapped answers:', mappedAnswers);
    return mappedAnswers;
  } catch (mappingErr) {
    console.error('[ERROR] Failed to map extracted data to questions:', mappingErr);
    return {};
  }
}

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

    // Extract any new personal info from the user question with enhanced family/relationship detection
    const extractPrompt = `
You are an expert at extracting personal information and organizing it into a comprehensive personality profile. Extract ALL personal facts, relationships, memories, and details from the user's message. Pay special attention to family members, friends, and relationships.

CRITICAL INSTRUCTIONS:
1. ALWAYS extract family member names and relationships (brother, sister, mother, father, cousin, etc.)
2. ALWAYS preserve specific names, places, organizations, events, and unique details
3. Create detailed nested objects for people mentioned
4. Extract emotional context and personality traits
5. Identify fears, preferences, reactions, and behavioral patterns
6. CAPTURE ALL EXPRESSIONS, SLANG, AND COLLOQUIAL LANGUAGE - these are crucial for personality
7. Extract casual phrases, descriptive words, and unique ways of speaking

FAMILY/RELATIONSHIP EXTRACTION EXAMPLES:
User: "My brother Geoff chased me with a snake when I was little"
Extract: {
  "family": {
    "siblings": [
      {
        "name": "Geoff",
        "relationship": "brother",
        "shared_memories": ["chased me with a snake when I was little"]
      }
    ]
  },
  "memories": [
    {
      "event": "Brother Geoff chased me with a snake",
      "age_context": "when I was little",
      "emotional_impact": "likely scary/memorable",
      "people_involved": ["Geoff (brother)"]
    }
  ],
  "fears_or_reactions": ["snakes (possibly)"],
  "personality_traits": ["has memorable childhood experiences with siblings"]
}

User: "My mom Sarah and I used to bake cookies every Sunday"
Extract: {
  "family": {
    "parents": [
      {
        "name": "Sarah",
        "relationship": "mother",
        "shared_activities": ["baking cookies"],
        "traditions": ["Sunday cookie baking"]
      }
    ]
  },
  "traditions": ["Sunday cookie baking with mom"],
  "memories": [
    {
      "event": "Baking cookies with mom Sarah every Sunday",
      "frequency": "weekly tradition",
      "emotional_tone": "positive/bonding"
    }
  ]
}

User: "I worked for a map company for seven years it was wild"
Extract: {
  "professional_experience": [
    {
      "company_type": "map company",
      "duration": "seven years",
      "description": "worked for a map company"
    }
  ],
  "speech_patterns": {
    "expressions": ["it was wild"],
    "descriptive_words": ["wild"],
    "speaking_style": ["casual", "expressive"]
  },
  "personality_traits": ["describes experiences with colorful language", "expressive communicator"],
  "memories": [
    {
      "event": "Working at map company for seven years",
      "emotional_tone": "exciting/intense",
      "user_description": "wild"
    }
  ]
}

COMPREHENSIVE EXTRACTION CATEGORIES:
- family: {siblings: [], parents: [], extended_family: []}
- friends: [{name, relationship_type, shared_experiences}]
- memories: [{event, people_involved, location, age_context, emotional_impact}]
- personality_traits: []
- fears_and_phobias: []
- preferences: {likes: [], dislikes: []}
- locations: {lived_in: [], visited: [], meaningful_places: []}
- hobbies_and_interests: []
- values_and_beliefs: []
- life_lessons: []
- formative_experiences: []
- relationships: {romantic: [], friendships: [], professional: []}
- speech_patterns: {catchphrases: [], expressions: [], unique_words: [], speaking_style: []}
- humor_and_personality: {jokes: [], sarcasm: [], wit: [], humor_style: []}

ALWAYS:
- Extract names of people mentioned (family, friends, acquaintances)
- Identify relationship types (brother, sister, friend, coworker, etc.)
- Preserve exact quotes and specific details
- Note emotional context and reactions
- Identify personality traits revealed by the story
- Extract location and time context when available

User message: "${question}"
Extract (return valid JSON only):
`.trim();

    let extracted = {};
    try {
      const extractRes = await openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [{ role: 'system', content: extractPrompt }],
        temperature: 0,
        max_tokens: 500, // Increased for better extraction
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
${existing?.history?.slice(-2)?.map((h: any) => `User said: "${h.question}"`).join('\n') || 'This is the start of our conversation.'}

**CRITICAL: Do not make up details, combine stories, or assume information the user hasn't explicitly shared. Only ask follow-up questions based on what they actually told you.**

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

    // NEW: Map extracted data to profile questions
    const mappedAnswers = await mapExtractedDataToQuestions(extracted, existing);
    if (Object.keys(mappedAnswers).length > 0) {
      // Merge the mapped answers into the profile data
      Object.entries(mappedAnswers).forEach(([section, answers]) => {
        if (!merged[section]) merged[section] = {};
        merged[section] = { ...merged[section], ...answers };
      });
      console.log('[DEBUG] Mapped answers to profile questions:', mappedAnswers);
    }

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