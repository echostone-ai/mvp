/**
 * LLM Refinement Engine for Hot Facts Pipeline
 * 
 * Implements Stage B LLM-based fact extraction and refinement using OpenAI
 * to extract additional facts that pattern matching might miss.
 */

import { ExtractedFact } from './patternExtractor';

export interface LLMExtractionResult {
  facts: ExtractedFact[];
  processing_time_ms: number;
  errors: string[];
  llm_confidence: number;
}

export interface LLMExtractorConfig {
  model: string;
  temperature: number;
  max_tokens: number;
  timeout_ms: number;
}

export class LLMExtractor {
  private config: LLMExtractorConfig;
  private readonly SUPPORTED_FACT_KEYS = [
    'full_name', 'birth_year', 'birthplace', 'current_city', 'grew_up',
    'languages', 'pets_current', 'partner_name', 'family_parents',
    'family_siblings', 'family_children', 'current_job', 'hobbies',
    'signature_style', 'core_values', 'personality_traits'
  ];

  constructor(config?: Partial<LLMExtractorConfig>) {
    this.config = {
      model: 'gpt-4o-mini',
      temperature: 0.1, // Low temperature for factual extraction
      max_tokens: 1000,
      timeout_ms: 10000,
      ...config
    };
  }

  /**
   * Refine extraction using LLM to find additional facts
   */
  async refineExtraction(
    text: string, 
    heuristicFacts: ExtractedFact[] = []
  ): Promise<LLMExtractionResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      const existingFacts = this.formatExistingFacts(heuristicFacts);
      const prompt = this.buildExtractionPrompt(text, existingFacts);
      
      const response = await this.callOpenAI(prompt);
      const extractedFacts = this.parseResponse(response, text);
      
      // Validate and filter facts
      const validatedFacts = extractedFacts
        .filter(fact => this.validateFact(fact.key, fact.value))
        .map(fact => ({
          ...fact,
          confidence: this.calculateConfidence(fact, text),
          extraction_method: 'llm' as const
        }));

      const processing_time_ms = Date.now() - startTime;
      const llm_confidence = this.calculateOverallConfidence(validatedFacts);

      return {
        facts: validatedFacts,
        processing_time_ms,
        errors,
        llm_confidence
      };

    } catch (error) {
      errors.push(`LLM extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        facts: [],
        processing_time_ms: Date.now() - startTime,
        errors,
        llm_confidence: 0
      };
    }
  }

  /**
   * Validate extracted fact
   */
  validateFact(key: string, value: string): boolean {
    // Check if key is supported
    if (!this.SUPPORTED_FACT_KEYS.includes(key) && !key.startsWith('moved_to__')) {
      return false;
    }

    // Check value length and content
    if (!value || value.trim().length < 1 || value.trim().length > 200) {
      return false;
    }

    // Specific validations by fact type
    switch (key) {
      case 'birth_year':
        const year = parseInt(value);
        return year >= 1900 && year <= 2035;
      
      case 'full_name':
        return /^[A-Za-z\s\-'\.]+$/.test(value) && value.trim().split(/\s+/).length >= 2;
      
      case 'languages':
        return value.split(',').every(lang => lang.trim().length > 1);
      
      default:
        return true;
    }
  }

  /**
   * Calculate confidence score for a fact
   */
  calculateConfidence(fact: ExtractedFact, sourceText: string): number {
    let confidence = 0.7; // Base confidence for LLM extraction

    // Boost confidence if fact appears explicitly in source text
    if (sourceText.toLowerCase().includes(fact.value.toLowerCase())) {
      confidence += 0.2;
    }

    // Adjust based on fact type
    switch (fact.key) {
      case 'birth_year':
      case 'birthplace':
        confidence += 0.1; // These are usually explicit
        break;
      case 'personality_traits':
      case 'core_values':
        confidence -= 0.1; // These are more interpretive
        break;
    }

    // Adjust based on value characteristics
    if (fact.value.length > 50) {
      confidence -= 0.1; // Longer values might be less precise
    }

    return Math.min(Math.max(confidence, 0.1), 0.95);
  }

  /**
   * Build extraction prompt for OpenAI
   */
  private buildExtractionPrompt(text: string, existingFacts: string): string {
    return `Extract key identity facts from the following text. Return ONLY a valid JSON object with the facts you can confidently identify.

SUPPORTED FACT KEYS:
- full_name: Complete name (first and last)
- birth_year: Year of birth (YYYY format)
- birthplace: City/location of birth
- current_city: Current residence
- grew_up: Where they spent childhood
- moved_to__<city>__year: Relocation events (e.g., "moved_to__boston__year": "2010")
- languages: Languages spoken (comma-separated)
- pets_current: Current pets
- partner_name: Spouse/partner name
- family_parents: Parent names/descriptions
- family_siblings: Sibling information
- family_children: Children information
- current_job: Current occupation
- hobbies: Regular activities/interests
- signature_style: Distinctive speaking patterns
- core_values: Fundamental beliefs
- personality_traits: Key character attributes

RULES:
1. Only extract facts that are explicitly stated or clearly implied
2. Use exact text from the source when possible
3. For birth_year, only years between 1900-2035
4. For names, use proper capitalization
5. For locations, use standard city names
6. If uncertain, omit the fact rather than guess
7. Return empty object {} if no clear facts found

EXISTING FACTS (don't duplicate):
${existingFacts}

TEXT TO ANALYZE:
${text}

JSON Response:`;
  }

  /**
   * Structured extraction for kinship/pets/fuzzy time schema (non-breaking addition)
   */
  async refineStructuredExtraction(
    text: string,
    opts: { fewShot?: boolean } = {}
  ): Promise<{ raw: any; facts: ExtractedFact[]; errors: string[] }> {
    const errors: string[] = [];
    const prompt = this.buildStructuredPrompt(text, opts.fewShot !== false);
    try {
      const response = await this.callOpenAI(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');
      const parsed = JSON.parse(jsonMatch[0]);
      const facts = this.flattenStructuredSchema(parsed, text);
      return { raw: parsed, facts, errors };
    } catch (e: any) {
      errors.push(`Structured extraction failed: ${e?.message || String(e)}`);
      return { raw: null, facts: [], errors };
    }
  }

  private buildStructuredPrompt(text: string, includeFewShot: boolean): string {
    const schema = `
{
  "person": {"name": "string|null", "birthdate": "YYYY-MM-DD|null"},
  "places": {"hometown":"string|null","settled":"string|null","region":"string|null"},
  "people":[{"relation":"father|mother|...","name":"string|null","details":"string|null","unit_text":"string|null","branch":"string|null"}],
  "pets":[{"name":"string","species":"string"}],
  "friends":[{"name":"string"}],
  "hobbies":["string"],
  "followups":[{"question":"string","reason":"string","priority":1}]
}`;
    const shots = includeFewShot ? `
Examples (map colloquialisms to canonical):
- Input: "my daddy was an airman in the 101st"
  Output.people[0]: {"relation":"father","name":null,"details":"airman","unit_text":"101st","branch":null}
- Input: "our pet turtle named Frank"
  Output.pets[0]: {"name":"Frank","species":"turtle"}
- Input: "hung out with Willie Nelson" → Do not infer fame; if friend named only: {"friends":[{"name":"Willie"}]}
- Input: "after the war" → do not guess years; store no absolute dates; you may include a followup.
Rules:
- Keep branch null if not explicit.
- Temperature 0 style: do not guess or invent.
- Return ONLY the JSON matching schema exactly.
` : '';
    return `You extract identity facts. Temperature=0.
Return ONLY JSON in this schema. Do not include comments or extra text.
Schema:
${schema}
${shots}
TEXT:
${text}`;
  }

  private flattenStructuredSchema(parsed: any, sourceText: string): ExtractedFact[] {
    const results: ExtractedFact[] = [];
    if (!parsed || typeof parsed !== 'object') return results;
    // person
    if (parsed.person?.name) {
      results.push({ key: 'full_name', value: String(parsed.person.name), confidence: 0.8, source_text: String(parsed.person.name), extraction_method: 'llm' as any });
    }
    if (parsed.person?.birthdate) {
      results.push({ key: 'birthdate', value: String(parsed.person.birthdate), confidence: 0.85, source_text: String(parsed.person.birthdate), extraction_method: 'llm' as any });
    }
    // places
    if (parsed.places?.hometown) results.push({ key: 'hometown', value: String(parsed.places.hometown), confidence: 0.8, source_text: String(parsed.places.hometown), extraction_method: 'llm' as any });
    if (parsed.places?.settled) results.push({ key: 'settled_location', value: String(parsed.places.settled), confidence: 0.75, source_text: String(parsed.places.settled), extraction_method: 'llm' as any });
    if (parsed.places?.region) results.push({ key: 'lived_region', value: String(parsed.places.region), confidence: 0.7, source_text: String(parsed.places.region), extraction_method: 'llm' as any });
    // people
    if (Array.isArray(parsed.people)) {
      for (const p of parsed.people) {
        const rel = String(p.relation || '').toLowerCase();
        if (p.details && ['father','mother','parent'].includes(rel)) {
          results.push({ key: `family_${rel}_role`, value: String(p.details), confidence: 0.8, source_text: sourceText, extraction_method: 'llm' as any });
        }
        if (p.unit_text) results.push({ key: 'service_unit_text', value: String(p.unit_text), confidence: 0.8, source_text: sourceText, extraction_method: 'llm' as any });
        if (p.branch) results.push({ key: 'service_branch', value: String(p.branch), confidence: 0.7, source_text: sourceText, extraction_method: 'llm' as any });
      }
    }
    // pets
    if (Array.isArray(parsed.pets)) {
      for (const pet of parsed.pets) {
        if (pet?.name && pet?.species) {
          results.push({ key: 'pet', value: `${pet.name} (${pet.species})`, confidence: 0.85, source_text: `${pet.name}`, extraction_method: 'llm' as any });
        }
      }
    }
    // hobbies
    if (Array.isArray(parsed.hobbies)) {
      const list = parsed.hobbies.map((s: any) => String(s)).filter(Boolean);
      if (list.length) results.push({ key: 'hobbies', value: list.join(', '), confidence: 0.7, source_text: list.join(', '), extraction_method: 'llm' as any });
    }
    return results;
  }

  /**
   * Format existing facts for prompt context
   */
  private formatExistingFacts(facts: ExtractedFact[]): string {
    if (facts.length === 0) {
      return 'None';
    }

    return facts
      .map(fact => `${fact.key}: "${fact.value}"`)
      .join(', ');
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(prompt: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout_ms);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: this.config.temperature,
          max_tokens: this.config.max_tokens,
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid OpenAI API response format');
      }

      return data.choices[0].message.content.trim();

    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Parse OpenAI response into facts
   */
  private parseResponse(response: string, sourceText: string): ExtractedFact[] {
    try {
      // Extract JSON from response (handle cases where LLM adds extra text)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      const facts: ExtractedFact[] = [];

      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'string' && value.trim()) {
          facts.push({
            key,
            value: value.trim(),
            confidence: 0.8, // Will be recalculated
            source_text: this.findSourceText(value.trim(), sourceText),
            extraction_method: 'llm'
          });
        }
      }

      return facts;

    } catch (error) {
      throw new Error(`Failed to parse LLM response: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Find the source text that contains the extracted value
   */
  private findSourceText(value: string, sourceText: string): string {
    const sentences = sourceText.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
    
    for (const sentence of sentences) {
      if (sentence.toLowerCase().includes(value.toLowerCase())) {
        return sentence;
      }
    }
    
    return value; // Fallback to the value itself
  }

  /**
   * Calculate overall confidence for the extraction
   */
  private calculateOverallConfidence(facts: ExtractedFact[]): number {
    if (facts.length === 0) {
      return 0;
    }

    const avgConfidence = facts.reduce((sum, fact) => sum + fact.confidence, 0) / facts.length;
    
    // Adjust based on number of facts extracted
    let adjustment = 0;
    if (facts.length >= 5) {
      adjustment = 0.1; // More facts generally means better extraction
    } else if (facts.length <= 2) {
      adjustment = -0.1; // Fewer facts might indicate poor extraction
    }

    return Math.min(Math.max(avgConfidence + adjustment, 0.1), 0.95);
  }

  /**
   * Extract facts from text using LLM only (no heuristics)
   */
  async extractFacts(text: string): Promise<LLMExtractionResult> {
    return this.refineExtraction(text, []);
  }
}