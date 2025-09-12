export interface ExtractionForClarifier {
  facts: Array<{ key: string; value: string; confidence?: number }>;
}

/**
 * Generate up to two gentle micro-questions based on gaps in P1/P2 facts.
 * Rules:
 * - If birthplace/birthdate missing → ask for birth date/place
 * - If family facts sparse → ask father's/mother's first name
 * - If service/pets detected but incomplete → clarify unit/branch or pet's name
 * - Never more than 2; prioritize by P1 > P2 gaps
 */
export function generateClarifiers(extraction: ExtractionForClarifier): { question: string; reason: string }[] {
  const clarifiers: { question: string; reason: string }[] = [];
  const factMap = new Map<string, { value: string; confidence: number }>();
  for (const f of extraction.facts || []) {
    factMap.set(f.key, { value: f.value, confidence: typeof f.confidence === 'number' ? f.confidence : 0.7 });
  }

  const ensure = (q: string, r: string) => { if (clarifiers.length < 2) clarifiers.push({ question: q, reason: r }); };

  // P1 gaps: birth date/place
  const hasBirthDate = factMap.has('birth_date') || factMap.has('birth_year');
  const hasBirthplace = factMap.has('birthplace');
  if (!hasBirthDate) ensure("What’s your birth date?", 'Missing birth date');
  if (!hasBirthplace) ensure("What’s your birth place?", 'Missing birthplace');

  // P1/P2: family
  const hasFatherName = factMap.has('father_first_name') || factMap.has('father_name');
  const hasMotherName = factMap.has('mother_first_name') || factMap.has('mother_name');
  const hasParents = factMap.has('family_parents');
  if (!(hasFatherName || hasParents)) ensure("What’s your father’s first name?", 'Missing father name');
  if (!(hasMotherName || hasParents)) ensure("What’s your mother’s first name?", 'Missing mother name');

  // Service detected but incomplete
  const serviceRole = factMap.get('service_role');
  const serviceUnit = factMap.get('service_unit_text');
  const serviceBranch = factMap.get('service_branch');
  if (serviceRole || serviceUnit || serviceBranch) {
    if (!serviceUnit) ensure('Which unit did you serve in?', 'Service detected but unit unknown');
    if (!serviceBranch) ensure('Which branch was that in?', 'Service detected but branch unknown');
  }

  // Pets detected but incomplete
  const hasPet = factMap.has('pet') || factMap.has('pets_current') || factMap.has('pet_type');
  const hasPetName = factMap.has('pet_name');
  if (hasPet && !hasPetName) ensure("What was your pet’s name?", 'Pet detected without a name');

  return clarifiers.slice(0, 2);
}


