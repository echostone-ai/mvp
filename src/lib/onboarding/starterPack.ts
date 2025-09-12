export const QUICK_FACT_KEYS = [
  'full_name',
  'given_name', 
  'pronouns',
  'home_city',
  'home_country',
  'timezone',
  'birth_year',
  'profession',
  'passions',
  'partner_name',
  'children',
  'parents',
  'pets',
  'tagline',
  'tone_style',
  'identity_pillars',
  'signature_memories'
] as const;

export type QuickFactKey = typeof QUICK_FACT_KEYS[number];

export type QuickFacts = {
  [K in QuickFactKey]?: string | string[];
};

/**
 * Normalizes quick facts input by trimming strings, limiting arrays, and filtering out empty values
 * @param input - Raw input object with potential quick facts
 * @returns QuickFacts - Normalized facts containing only allowed keys
 */
export function normalizeQuickFacts(input: Partial<Record<string, any>>): QuickFacts {
  const normalized: QuickFacts = {};

  for (const key of QUICK_FACT_KEYS) {
    const value = input[key];
    
    if (value === null || value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      // Limit arrays to max 3 items, filter out empty/null values
      const filtered = value
        .filter(item => item !== null && item !== undefined && item !== '')
        .map(item => String(item).trim())
        .filter(item => item.length > 0 && item.toLowerCase() !== 'unknown')
        .slice(0, 3);
      
      if (filtered.length > 0) {
        normalized[key] = filtered;
      }
    } else if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0 && trimmed.toLowerCase() !== 'unknown') {
        normalized[key] = trimmed;
      }
    } else {
      // Convert other types to string
      const stringValue = String(value).trim();
      if (stringValue.length > 0 && stringValue.toLowerCase() !== 'unknown') {
        normalized[key] = stringValue;
      }
    }
  }

  return normalized;
}