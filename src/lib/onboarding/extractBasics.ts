import OpenAI from 'openai';
import { QuickFacts, QUICK_FACT_KEYS, normalizeQuickFacts } from './starterPack';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Extracts basic facts from free text using deterministic LLM + regex fallbacks
 * @param freeText - User's free text input
 * @returns Promise<Partial<QuickFacts>> - Extracted facts containing only allowed keys
 */
export async function extractBasics(freeText: string): Promise<Partial<QuickFacts>> {
  if (!freeText || freeText.trim().length === 0) {
    return {};
  }

  const text = freeText.trim();
  let extractedFacts: Partial<Record<string, any>> = {};

  // Try LLM extraction first
  try {
    extractedFacts = await extractWithLLM(text);
  } catch (error) {
    console.warn('LLM extraction failed, falling back to regex:', error);
  }

  // Apply regex fallbacks for common patterns
  const regexFacts = extractWithRegex(text);
  
  // Merge LLM and regex results (regex takes precedence for conflicts)
  const mergedFacts = { ...extractedFacts, ...regexFacts };

  // Normalize and filter to only allowed keys
  return normalizeQuickFacts(mergedFacts);
}

/**
 * Deterministic LLM extraction with low temperature and token limit
 */
async function extractWithLLM(text: string): Promise<Partial<Record<string, any>>> {
  const prompt = `Extract basic facts from this text. Return only a JSON object with these exact keys if found: ${QUICK_FACT_KEYS.join(', ')}.

Text: "${text}"

Return JSON only:`;

  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1, // Low temperature for deterministic results
    max_tokens: 300,
    response_format: { type: 'json_object' }
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    return {};
  }

  try {
    const parsed = JSON.parse(content);
    // Filter to only allowed keys
    const filtered: Partial<Record<string, any>> = {};
    for (const key of QUICK_FACT_KEYS) {
      if (parsed[key] !== undefined) {
        filtered[key] = parsed[key];
      }
    }
    return filtered;
  } catch (error) {
    console.warn('Failed to parse LLM JSON response:', error);
    return {};
  }
}

/**
 * Regex fallbacks for common patterns
 */
function extractWithRegex(text: string): Partial<Record<string, any>> {
  const facts: Partial<Record<string, any>> = {};

  // Name patterns
  const nameMatch = text.match(/(?:my name is|i'm|i am|call me)\s+([a-zA-Z\s]+)/i);
  if (nameMatch) {
    const name = nameMatch[1].trim();
    facts.full_name = name;
    facts.given_name = name.split(' ')[0];
  }

  // Location patterns
  const cityMatch = text.match(/(?:live in|from|based in)\s+([a-zA-Z\s]+?)(?:,|\.|$)/i);
  if (cityMatch) {
    facts.home_city = cityMatch[1].trim();
  }

  const countryMatch = text.match(/(?:in|from)\s+(?:[a-zA-Z\s]+,\s*)?([A-Z][a-zA-Z\s]+)(?:\.|$)/i);
  if (countryMatch && countryMatch[1].length > 2) {
    facts.home_country = countryMatch[1].trim();
  }

  // Age/birth year patterns
  const ageMatch = text.match(/(?:i'm|i am|age)\s+(\d{1,2})\s*(?:years?\s*old)?/i);
  if (ageMatch) {
    const age = parseInt(ageMatch[1]);
    if (age > 0 && age < 120) {
      facts.birth_year = String(new Date().getFullYear() - age);
    }
  }

  const birthYearMatch = text.match(/(?:born in|birth year)\s+(\d{4})/i);
  if (birthYearMatch) {
    facts.birth_year = birthYearMatch[1];
  }

  // Profession patterns
  const professionMatch = text.match(/(?:work as|job is|i'm a|i am a|profession)\s+([a-zA-Z\s]+?)(?:,|\.|$)/i);
  if (professionMatch) {
    facts.profession = professionMatch[1].trim();
  }

  // Pet patterns
  const petMatch = text.match(/(?:have a|own a|my)\s+(dog|cat|pet|bird|fish)\s*(?:named\s+([a-zA-Z]+))?/i);
  if (petMatch) {
    const petType = petMatch[1];
    const petName = petMatch[2];
    facts.pets = petName ? `${petType} named ${petName}` : petType;
  }

  // Pronouns patterns
  const pronounMatch = text.match(/(?:pronouns are|use)\s+(he\/him|she\/her|they\/them|he\/they|she\/they)/i);
  if (pronounMatch) {
    facts.pronouns = pronounMatch[1].toLowerCase();
  }

  return facts;
}