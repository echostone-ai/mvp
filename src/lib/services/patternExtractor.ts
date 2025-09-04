/**
 * Pattern Heuristics Extractor for Hot Facts Pipeline
 * 
 * Implements Stage A pattern-based fact extraction using regex patterns
 * and heuristics to identify key identity information from text.
 */

export interface ExtractedFact {
  key: string;
  value: string;
  confidence: number;
  source_text: string;
  extraction_method: 'pattern';
  // Optional metadata for richer downstream use (non-breaking addition)
  reason?: string;
  date_context?: { fuzzy?: string };
}

export interface PatternExtractionResult {
  facts: ExtractedFact[];
  processing_time_ms: number;
  errors: string[];
}

export class PatternExtractor {
  private readonly BIRTH_YEAR_MIN = 1900;
  private readonly BIRTH_YEAR_MAX = 2035;
  private readonly MONTHS: Record<string, string> = {
    january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
    july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
  };
  private readonly KINSHIP_MAP: Record<string, 'father'|'mother'|'parent'|'sibling'|'partner'|'child'> = {
    father: 'father', dad: 'father', daddy: 'father', papa: 'father', granddad: 'father', grandpa: 'father',
    mother: 'mother', mom: 'mother', momma: 'mother', mama: 'mother', grandma: 'mother',
    parent: 'parent',
    brother: 'sibling', sister: 'sibling', sibling: 'sibling',
    husband: 'partner', wife: 'partner', partner: 'partner', spouse: 'partner',
    son: 'child', daughter: 'child', child: 'child', children: 'child'
  };
  
  /**
   * Extract birth year from text using pattern matching
   */
  extractBirthYear(text: string): ExtractedFact | null {
    const patterns = [
      /\b(?:born|birth year|birth|year)\s+(?:in\s+)?(\d{4})\b/i,
      /\b(\d{4})\s+(?:birth|born)\b/i,
      /\bI\s+was\s+born\s+in\s+(\d{4})\b/i,
      /\bborn\s+(\d{4})\b/i,
      /\bmy\s+birth\s+year\s+(?:is|was)\s+(\d{4})\b/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const year = parseInt(match[1]);
        if (year >= this.BIRTH_YEAR_MIN && year <= this.BIRTH_YEAR_MAX) {
          return {
            key: 'birth_year',
            value: year.toString(),
            confidence: 0.9,
            source_text: match[0],
            extraction_method: 'pattern'
          };
        }
      }
    }
    
    return null;
  }

  /**
   * Extract birthplace from text using pattern matching
   */
  extractBirthplace(text: string): ExtractedFact | null {
    const patterns = [
      /\bborn\s+(?:in|at)\s+([^,.!?]+?)(?:\s+in\s+\d{4}|[,.!?]|$)/i,
      /\bbirthplace\s+(?:is|was)\s+([^,.!?]+)/i,
      /\bI\s+was\s+born\s+in\s+([^,.!?]+?)(?:\s+in\s+\d{4}|[,.!?]|$)/i,
      /\bfrom\s+([^,.!?]+?)(?:\s+originally|[,.!?]|$)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const place = this.normalizeLocation(match[1].trim());
        if (place && place.length > 1) {
          return {
            key: 'birthplace',
            value: place,
            confidence: 0.85,
            source_text: match[0],
            extraction_method: 'pattern'
          };
        }
      }
    }
    
    return null;
  }

  /**
   * Extract full birthdate (YYYY-MM-DD) like "Born July 4th, 1939"
   */
  extractBirthDate(text: string): ExtractedFact | null {
    const pattern = /(born|birth(?:date)?)(?:\s+(?:on|at|is|was))?\s+([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,)?\s+(\d{4})/i;
    const match = text.match(pattern);
    if (!match) return null;
    const monthStr = match[2].toLowerCase();
    const dayNum = parseInt(match[3], 10);
    const yearNum = parseInt(match[4], 10);
    const mm = this.MONTHS[monthStr];
    if (!mm || yearNum < this.BIRTH_YEAR_MIN || yearNum > this.BIRTH_YEAR_MAX || dayNum < 1 || dayNum > 31) return null;
    const dd = String(dayNum).padStart(2, '0');
    const iso = `${yearNum}-${mm}-${dd}`;
    return {
      key: 'birthdate',
      value: iso,
      confidence: 0.92,
      source_text: match[0],
      extraction_method: 'pattern',
      reason: 'Explicit month-day-year birth statement'
    };
  }

  /**
   * Extract move information from text
   */
  extractMoves(text: string): ExtractedFact[] {
    const facts: ExtractedFact[] = [];
    
    const patterns = [
      /\bmoved\s+to\s+([^,.!?]+?)\s+in\s+(\d{4})\b/gi,
      /\bmoved\s+to\s+([^,.!?]+?)\s+at\s+age\s+(\d+)\b/gi,
      /\brelocated\s+to\s+([^,.!?]+?)\s+in\s+(\d{4})\b/gi,
      /\bwent\s+to\s+([^,.!?]+?)\s+in\s+(\d{4})\b/gi
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const city = this.normalizeLocation(match[1].trim());
        const yearOrAge = match[2];
        
        if (city && city.length > 1) {
          // Handle both year and age formats
          const isYear = parseInt(yearOrAge) >= this.BIRTH_YEAR_MIN;
          const key = isYear ? `moved_to__${city.toLowerCase().replace(/\s+/g, '_')}__year` : `moved_to__${city.toLowerCase().replace(/\s+/g, '_')}__age`;
          
          facts.push({
            key,
            value: isYear ? yearOrAge : `age_${yearOrAge}`,
            confidence: 0.8,
            source_text: match[0],
            extraction_method: 'pattern'
          });
        }
      }
    }
    
    return facts;
  }

  /**
   * Extract relationship information from text
   */
  extractRelationships(text: string): ExtractedFact[] {
    const facts: ExtractedFact[] = [];
    
    const patterns = [
      /\bmy\s+(mom|mother|dad|father|parent|daddy|momma|mama|granddad|grandpa|grandma)\s+(?:is\s+|was\s+|named\s+|called\s+)?([A-Za-z\s]+?)(?:\s+and|[,.!?]|$)/gi,
      /\bmy\s+(wife|husband|partner|spouse)\s+(?:is\s+|was\s+|named\s+|called\s+)?([A-Za-z\s]+?)(?:\s+and|[,.!?]|$)/gi,
      /\bmy\s+(brother|sister|sibling)\s+(?:is\s+|was\s+|named\s+|called\s+)?([A-Za-z\s]+?)(?:\s+and|[,.!?]|$)/gi,
      /\bmy\s+(son|daughter|child|children)\s+(?:is\s+|was\s+|named\s+|called\s+)?([A-Za-z\s]+?)(?:\s+and|[,.!?]|$)/gi
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const relationRaw = match[1].toLowerCase();
        const relation = this.KINSHIP_MAP[relationRaw] || (relationRaw as any);
        const name = this.normalizeName(match[2].trim());
        
        if (name && name.length > 1) {
          let key: string;
          
          // Map relationship types to standardized keys
          if (['father','mother','parent'].includes(relation)) {
            key = 'family_parents';
          } else if (['wife', 'husband', 'partner', 'spouse'].includes(relation)) {
            key = 'partner_name';
          } else if (['brother', 'sister', 'sibling'].includes(relation)) {
            key = 'family_siblings';
          } else if (['son', 'daughter', 'child'].includes(relation)) {
            key = 'family_children';
          } else {
            key = `family_${relation}`;
          }
          
          facts.push({
            key,
            value: name,
            confidence: 0.85,
            source_text: match[0],
            extraction_method: 'pattern'
          });
        }
      }
    }
    
    return facts;
  }

  /**
   * Extract explicit pet info: species + name
   */
  extractPets(text: string): ExtractedFact[] {
    const results: ExtractedFact[] = [];
    // Allow optional pronoun and optional 'pet' word: e.g., "pet turtle named Frank" or "our turtle named Frank"
    const petRegex = /\b(?:(?:my|our)\s+)?(?:pet\s+)?(dog|cat|turtle|bird|fish|hamster|rabbit|lizard)\s+(?:named|called)?\s+([A-Z][a-zA-Z\-']+)\b/gi;
    let m: RegExpExecArray | null;
    while ((m = petRegex.exec(text)) !== null) {
      const species = m[1].toLowerCase();
      const name = m[2];
      results.push({
        key: 'pet',
        value: `${name} (${species})`,
        confidence: 0.9,
        source_text: m[0],
        extraction_method: 'pattern',
        reason: 'Explicit pet species and name'
      });
    }
    return results;
  }

  /**
   * Extract military/service unit tokens and role/branch
   */
  extractServiceDetails(text: string): ExtractedFact[] {
    const facts: ExtractedFact[] = [];
    const unitRegex = /\b(\d{2,4})(st|nd|rd|th)\b/gi; // e.g., 501st
    const branchTokens = ['air force', 'army', 'navy', 'marines', 'marine corps'];
    const roleTokens = ['airman', 'sailor', 'soldier', 'marine', 'pilot'];

    let match: RegExpExecArray | null;
    while ((match = unitRegex.exec(text)) !== null) {
      const unit = `${match[1]}${match[2].toLowerCase()}`;
      const windowStart = Math.max(0, match.index - 60);
      const windowEnd = Math.min(text.length, match.index + match[0].length + 60);
      const context = text.slice(windowStart, windowEnd).toLowerCase();

      const branch = branchTokens.find(b => context.includes(b)) || null;
      const role = roleTokens.find(r => context.includes(r)) || null;

      facts.push({
        key: 'service_unit_text',
        value: unit,
        confidence: 0.85,
        source_text: match[0],
        extraction_method: 'pattern',
        reason: 'Unit token detected'
      });
      if (role) {
        facts.push({
          key: 'service_role',
          value: role,
          confidence: 0.8,
          source_text: context,
          extraction_method: 'pattern'
        });
      }
      if (branch) {
        facts.push({
          key: 'service_branch',
          value: branch,
          confidence: 0.75,
          source_text: context,
          extraction_method: 'pattern'
        });
      }
    }

    // Also detect kinship + service role like "my daddy was an airman"
    const kinRoleRegex = /\bmy\s+(dad|daddy|father|mom|mother)\s+(?:is|was)\s+an?\s+(airman|soldier|sailor|marine|pilot)\b/i;
    const km = text.match(kinRoleRegex);
    if (km) {
      const rel = this.KINSHIP_MAP[km[1].toLowerCase()] || km[1].toLowerCase();
      facts.push({
        key: `family_${rel}_role`,
        value: km[2].toLowerCase(),
        confidence: 0.88,
        source_text: km[0],
        extraction_method: 'pattern',
        reason: 'Explicit kinship service role'
      });
    }

    return facts;
  }

  /**
   * Fuzzy time phrases
   */
  extractFuzzyTime(text: string): ExtractedFact[] {
    const facts: ExtractedFact[] = [];
    const pairs: Array<[RegExp, string]> = [
      [/\bafter the war\b/i, 'after_the_war'],
      [/\bas a kid\b/i, 'as_a_kid'],
      [/\bas a child\b/i, 'as_a_child'],
      [/\bin the 50s\b/i, 'in_the_50s']
    ];
    for (const [rx, tag] of pairs) {
      const m = text.match(rx);
      if (m) {
        facts.push({
          key: 'time_context',
          value: tag,
          confidence: 0.7,
          source_text: m[0],
          extraction_method: 'pattern',
          reason: 'Fuzzy time phrase',
          date_context: { fuzzy: tag }
        });
      }
    }
    return facts;
  }

  /**
   * Place semantics: hometown/settled/regions
   */
  extractPlaceSemantics(text: string): ExtractedFact[] {
    const facts: ExtractedFact[] = [];
    // Hometown (grew up)
    const grewRx = /\b(grew up|raised|spent my childhood)\s+in\s+([^.!?]+)/i;
    const m1 = text.match(grewRx);
    if (m1) {
      const loc = this.normalizeLocation(m1[2].trim());
      if (loc) facts.push({ key: 'hometown', value: loc, confidence: 0.9, source_text: m1[0], extraction_method: 'pattern', reason: 'Grew up indicator' });
    }
    // Settled location
    const settledRx = /\bsettled\s+in\s+([A-Za-z][A-Za-z\s'.-]+(?:,\s*[A-Za-z\s'.-]+)?)/i;
    const m2 = text.match(settledRx);
    if (m2) {
      const loc = this.normalizeLocation(m2[1].trim());
      if (loc) facts.push({ key: 'settled_location', value: loc, confidence: 0.85, source_text: m2[0], extraction_method: 'pattern', reason: 'Settled in indicator' });
    }
    // Region lived (e.g., airbases)
    const regionRx = /\blived\s+in\s+([^,.!?]+?\s+airbases)\b/i;
    const m3 = text.match(regionRx);
    if (m3) {
      const reg = this.normalizeLocation(m3[1].trim());
      facts.push({ key: 'lived_region', value: reg, confidence: 0.7, source_text: m3[0], extraction_method: 'pattern' });
    }
    return facts;
  }

  /**
   * Extract languages from text
   */
  extractLanguages(text: string): ExtractedFact | null {
    const patterns = [
      /\b(?:speak|speaks|fluent\s+in|know)\s+([^,.!?]+?)(?:\s+(?:language|fluently)|[,.!?]|$)/gi,
      /\b(?:my\s+)?(?:native\s+)?language(?:s)?\s+(?:is|are)\s+([^,.!?]+)/gi,
      /\bbilingual\s+in\s+([^,.!?]+)/gi
    ];

    const languages: string[] = [];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const langText = match[1].trim();
        const normalizedLangs = this.normalizeLanguages(langText);
        languages.push(...normalizedLangs);
      }
    }
    
    if (languages.length > 0) {
      const uniqueLanguages = [...new Set(languages)];
      return {
        key: 'languages',
        value: uniqueLanguages.join(', '),
        confidence: 0.8,
        source_text: uniqueLanguages.join(', '),
        extraction_method: 'pattern'
      };
    }
    
    return null;
  }

  /**
   * Extract current pets from text
   */
  extractCurrentPets(text: string): ExtractedFact | null {
    const patterns = [
      /\b(?:have|has|own|owns)\s+(?:a\s+)?([^,.!?]*?)(?:dog|cat|pet|puppy|kitten)([^,.!?]*)/gi,
      /\bmy\s+(?:dog|cat|pet)\s+(?:is\s+|named\s+|called\s+)?([^,.!?]+)/gi,
      /\b(?:dog|cat|pet)\s+named\s+([^,.!?]+)/gi
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const petInfo = match[0].trim();
        return {
          key: 'pets_current',
          value: petInfo,
          confidence: 0.75,
          source_text: match[0],
          extraction_method: 'pattern'
        };
      }
    }
    
    return null;
  }

  /**
   * Extract current job from text
   */
  extractCurrentJob(text: string): ExtractedFact | null {
    const patterns = [
      /\bwork\s+as\s+(?:a\s+)?([^,.!?]+)/gi,
      /\bworking\s+as\s+(?:a\s+)?([^,.!?]+)/gi,
      /\bmy\s+job\s+is\s+([^,.!?]+)/gi,
      /\bemployed\s+as\s+(?:a\s+)?([^,.!?]+)/gi,
      /\bI\s+am\s+(?:a\s+)?([^,.!?]+?)(?:\s+at\s+|\s+for\s+|$)/gi
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const jobInfo = match[1].trim();
        if (jobInfo && jobInfo.length > 2) {
          return {
            key: 'current_job',
            value: jobInfo,
            confidence: 0.8,
            source_text: match[0],
            extraction_method: 'pattern'
          };
        }
      }
    }
    
    return null;
  }

  /**
   * Extract hobbies from text
   */
  extractHobbies(text: string): ExtractedFact | null {
    const patterns = [
      /\b(?:enjoy|love|like)\s+([^,.!?]+?)(?:\s+(?:in my free time|as a hobby)|[,.!?]|$)/gi,
      /\bmy\s+hobbies?\s+(?:are|include)\s+([^,.!?]+)/gi,
      /\b(?:hobby|hobbies)\s+(?:is|are)\s+([^,.!?]+)/gi,
      /\bcollect(?:ing|ed)?\s+([^,.!?]+?)(?:\s+cards|\s+stamps|\s+coins)?[,.!?]?/gi,
      /\bcollected\s+([^,.!?]+?)\s+cards[,.!?]?/gi
    ];

    const hobbies: string[] = [];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        let hobbyText = match[1].trim();
        // If this is a collecting pattern and the trailing token exists in the full match, include it
        if (/^\bcollect(?:ing|ed)?\b/i.test(match[0]) || /\bcollected\b/i.test(match[0])) {
          if (/\bcards\b/i.test(match[0]) && !/\bcards\b/i.test(hobbyText)) hobbyText = `${hobbyText} cards`;
          if (/\bstamps\b/i.test(match[0]) && !/\bstamps\b/i.test(hobbyText)) hobbyText = `${hobbyText} stamps`;
          if (/\bcoins\b/i.test(match[0]) && !/\bcoins\b/i.test(hobbyText)) hobbyText = `${hobbyText} coins`;
          if (!/^collect/i.test(hobbyText)) hobbyText = `collecting ${hobbyText}`;
        }
        if (hobbyText && hobbyText.length > 2) {
          hobbies.push(hobbyText);
        }
      }
    }
    
    if (hobbies.length > 0) {
      const uniqueHobbies = [...new Set(hobbies)];
      return {
        key: 'hobbies',
        value: uniqueHobbies.join(', '),
        confidence: 0.7,
        source_text: uniqueHobbies.join(', '),
        extraction_method: 'pattern'
      };
    }
    
    return null;
  }

  /**
   * Extract full name from text
   */
  extractFullName(text: string): ExtractedFact | null {
    const patterns = [
      /\bmy\s+name\s+is\s+([A-Za-z\s]+?)(?:\s+and|[,.!?]|$)/i,
      /\bI\s+am\s+([A-Za-z\s]+?)(?:\s+and|[,.!?]|$)/i,
      /\bcalled\s+([A-Za-z\s]+?)(?:\s+and|[,.!?]|$)/i,
      /\bI'm\s+([A-Za-z\s]+?)(?:\s+and|[,.!?]|$)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const name = this.normalizeName(match[1].trim());
        if (name && name.length > 2 && name.split(' ').length >= 2 && name.split(' ').every(part => part.length > 1)) {
          return {
            key: 'full_name',
            value: name,
            confidence: 0.85,
            source_text: match[0],
            extraction_method: 'pattern'
          };
        }
      }
    }
    
    return null;
  }

  /**
   * Extract current city from text
   */
  extractCurrentCity(text: string): ExtractedFact | null {
    const patterns = [
      /\bcurrently\s+(?:live|living)\s+in\s+([^,.!?]+)/i,
      /\bnow\s+(?:live|living)\s+in\s+([^,.!?]+)/i,
      /\bI\s+live\s+in\s+([^,.!?]+)/i,
      /\bresiding\s+in\s+([^,.!?]+)/i,
      /\bbased\s+in\s+([^,.!?]+)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const city = this.normalizeLocation(match[1].trim());
        if (city && city.length > 1) {
          return {
            key: 'current_city',
            value: city,
            confidence: 0.8,
            source_text: match[0],
            extraction_method: 'pattern'
          };
        }
      }
    }
    
    return null;
  }

  /**
   * Extract where they grew up from text
   */
  extractGrewUp(text: string): ExtractedFact | null {
    const patterns = [
      /\bgrew\s+up\s+in\s+([^,.!?]+)/i,
      /\braised\s+in\s+([^,.!?]+)/i,
      /\bchildhood\s+in\s+([^,.!?]+)/i,
      /\bspent\s+my\s+childhood\s+in\s+([^,.!?]+)/i,
      /\bgrowing\s+up\s+in\s+([^,.!?]+)/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const place = this.normalizeLocation(match[1].trim());
        if (place && place.length > 1) {
          return {
            key: 'grew_up',
            value: place,
            confidence: 0.85,
            source_text: match[0],
            extraction_method: 'pattern'
          };
        }
      }
    }
    
    return null;
  }

  /**
   * Extract signature style or phrases from text
   */
  extractSignatureStyle(text: string): ExtractedFact | null {
    const patterns = [
      /\balways\s+say\s+"([^"]+)"/i,  // Quoted phrases
      /\bmy\s+catchphrase\s+is\s+"([^"]+)"/i,
      /\bmy\s+catchphrase\s+is\s+([^,.!?]{8,})/i,  // Longer unquoted phrases
      /\balways\s+say\s+([^,.!?]{8,})/i,
      /\bknown\s+for\s+saying\s+"([^"]+)"/i,
      /\bknown\s+for\s+saying\s+([^,.!?]{8,})/i,
      /\bsignature\s+(?:phrase|saying)\s+is\s+"([^"]+)"/i,
      /\bsignature\s+(?:phrase|saying)\s+is\s+([^,.!?]{8,})/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const style = match[1].trim();
        if (style && style.length > 5) {
          return {
            key: 'signature_style',
            value: style,
            confidence: 0.7,
            source_text: match[0],
            extraction_method: 'pattern'
          };
        }
      }
    }
    
    return null;
  }

  /**
   * Extract all facts from text using pattern matching
   */
  extractFacts(text: string): PatternExtractionResult {
    const startTime = Date.now();
    const facts: ExtractedFact[] = [];
    const errors: string[] = [];

    try {
      // Extract full name
      const fullName = this.extractFullName(text);
      if (fullName) facts.push(fullName);

      // Extract birthdate and/or birth year
      const birthDate = this.extractBirthDate(text);
      if (birthDate) facts.push(birthDate);
      const birthYear = this.extractBirthYear(text);
      if (birthYear) facts.push(birthYear);

      // Extract birthplace
      const birthplace = this.extractBirthplace(text);
      if (birthplace) facts.push(birthplace);

      // Extract current city
      const currentCity = this.extractCurrentCity(text);
      if (currentCity) facts.push(currentCity);

      // Extract where they grew up
      const grewUp = this.extractGrewUp(text);
      if (grewUp) facts.push(grewUp);

      // Extract moves
      const moves = this.extractMoves(text);
      facts.push(...moves);

      // Extract relationships
      const relationships = this.extractRelationships(text);
      facts.push(...relationships);

      // Extract pets
      const pets = this.extractPets(text);
      facts.push(...pets);

      // Extract service details
      const service = this.extractServiceDetails(text);
      facts.push(...service);

      // Extract fuzzy time
      const fuzzy = this.extractFuzzyTime(text);
      facts.push(...fuzzy);

      // Extract place semantics
      const placeSem = this.extractPlaceSemantics(text);
      facts.push(...placeSem);

      // Extract languages
      const languages = this.extractLanguages(text);
      if (languages) facts.push(languages);

      // Retain legacy current pets (generic)
      const petsLegacy = this.extractCurrentPets(text);
      if (petsLegacy) facts.push(petsLegacy);

      // Extract current job
      const job = this.extractCurrentJob(text);
      if (job) facts.push(job);

      // Extract hobbies
      const hobbies = this.extractHobbies(text);
      if (hobbies) facts.push(hobbies);

      // Extract signature style
      const signatureStyle = this.extractSignatureStyle(text);
      if (signatureStyle) facts.push(signatureStyle);

    } catch (error) {
      errors.push(`Pattern extraction error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const processing_time_ms = Date.now() - startTime;

    return {
      facts,
      processing_time_ms,
      errors
    };
  }

  // Normalization helper methods

  private normalizeLocation(location: string): string {
    return location
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/^(the\s+)/i, '') // Only remove "the" as it's commonly used as an article for places
      .split(' ')
      .map(word => {
        // Preserve special characters in international place names
        if (word.length === 0) return word;
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  }

  private normalizeName(name: string): string {
    return name
      .trim()
      .replace(/\s+/g, ' ')
      .split(' ')
      .map(word => {
        // Handle names with apostrophes, hyphens, and international characters
        if (word.length === 0) return word;
        if (word.includes("'") || word.includes('-')) {
          return word.split(/(['-])/).map(part => 
            part.length > 0 && /[a-zA-ZÀ-ÿ]/.test(part) ? 
            part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : part
          ).join('');
        }
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  }

  private normalizeLanguages(langText: string): string[] {
    const commonLanguages = [
      'english', 'spanish', 'french', 'german', 'italian', 'portuguese',
      'chinese', 'japanese', 'korean', 'arabic', 'russian', 'hindi',
      'dutch', 'swedish', 'norwegian', 'danish', 'finnish', 'polish',
      'turkish', 'greek', 'hebrew', 'thai', 'vietnamese', 'indonesian',
      'malay', 'tagalog', 'swahili', 'urdu', 'bengali', 'tamil'
    ];

    // Remove common connecting words in multiple languages
    const cleanedText = langText.replace(/\b(and|&|,|y|et|und|e|och|og|ja|i|و|और|そして|和|과|và|dan)\b/gi, ',');

    return cleanedText
      .toLowerCase()
      .split(/[,]+/)
      .map(lang => lang.trim())
      .filter(lang => lang.length > 1 && !['and', '&', 'y', 'et', 'und', 'e', 'och', 'og', 'ja', 'i'].includes(lang))
      .map(lang => {
        // Normalize common language names
        const normalized = commonLanguages.find(common => 
          lang.includes(common) || common.includes(lang)
        );
        return normalized ? normalized.charAt(0).toUpperCase() + normalized.slice(1) : 
               lang.charAt(0).toUpperCase() + lang.slice(1);
      })
      .filter(lang => lang.length > 1);
  }
}