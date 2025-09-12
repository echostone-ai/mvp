// Generic, data-driven factbook index (no topic-specific logic)
import { FactbookSnippet } from '@/lib/services/factbookService';

export type Fact = FactbookSnippet & { type?: string; weight?: number };

export type FBIndex = {
  factsById: Map<string, Fact>;
  tokenToFactIds: Map<string, Set<string>>;
  biGramToFactIds: Map<string, Set<string>>;
  entityLexicon: Map<string, Set<string>>;
  aliasGraph: Map<string, Set<string>>;
};

const normalize = (s: string) => s.toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^\w\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const splitTokens = (s: string): string[] => normalize(s).split(' ').filter(Boolean);

function isProperNounToken(word: string, original: string): boolean {
  // Proper noun heuristic: appears capitalized (not at sentence start) in original text
  // Fallback: any keyword/topic with first letter uppercase in original
  const re = /(^|[\.?!]\s+)([A-Z][a-z]+)/g;
  let m: RegExpExecArray | null;
  const proper = new Set<string>();
  while ((m = re.exec(original)) !== null) {
    // Skip sentence starts; collect within sentence capitalized words
    // Note: We add anyway; normalization will handle comparisons
    proper.add(normalize(m[2]));
  }
  return proper.has(word);
}

function collectBigrams(tokens: string[]): string[] {
  const bigrams: string[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    const a = tokens[i];
    const b = tokens[i + 1];
    if (a && b) bigrams.push(`${a} ${b}`);
  }
  return bigrams;
}

export function buildIndex(facts: Fact[]): FBIndex {
  const factsById = new Map<string, Fact>();
  const tokenToFactIds = new Map<string, Set<string>>();
  const biGramToFactIds = new Map<string, Set<string>>();
  const entityLexicon = new Map<string, Set<string>>();
  const aliasGraph = new Map<string, Set<string>>();

  // First pass: register facts and tokens
  for (const f of facts) {
    factsById.set(f.id, f);

    const original = f.text || '';
    const textTokens = splitTokens(original);
    const keywordTokens = (f.keywords || []).map(t => normalize(t));
    const topicTokens = (f.topics || []).map(t => normalize(t));
    const allTokens = Array.from(new Set([...textTokens, ...keywordTokens, ...topicTokens]));

    // Entities: collect capitalized candidates from original text and any Title-case keywords/topics
    for (const k of (f.keywords || [])) {
      if (/^[A-Z][a-zA-Z]+/.test(k)) {
        const key = normalize(k);
        if (!entityLexicon.has(key)) entityLexicon.set(key, new Set());
        entityLexicon.get(key)!.add(f.id);
      }
    }
    for (const t of (f.topics || [])) {
      if (/^[A-Z][a-zA-Z]+/.test(t)) {
        const key = normalize(t);
        if (!entityLexicon.has(key)) entityLexicon.set(key, new Set());
        entityLexicon.get(key)!.add(f.id);
      }
    }

    // Token map
    for (const tok of allTokens) {
      if (!tokenToFactIds.has(tok)) tokenToFactIds.set(tok, new Set());
      tokenToFactIds.get(tok)!.add(f.id);
    }

    // Bigrams
    const bigrams = collectBigrams(textTokens);
    for (const bg of bigrams) {
      if (!biGramToFactIds.has(bg)) biGramToFactIds.set(bg, new Set());
      biGramToFactIds.get(bg)!.add(f.id);
    }
  }

  // Second pass: alias discovery via co-occurrence within facts
  const tokenFreq = new Map<string, number>();
  for (const [tok, ids] of tokenToFactIds.entries()) tokenFreq.set(tok, ids.size);

  for (const f of facts) {
    const original = f.text || '';
    const textTokens = splitTokens(original);
    const keywordTokens = (f.keywords || []).map(t => normalize(t));
    const tokens = Array.from(new Set([...textTokens, ...keywordTokens]));

    // Consider only tokens that look like entities (appear capitalized somewhere in facts corpus)
    const candidateEntities = tokens.filter(t => (entityLexicon.has(t)) || /[a-z]/.test(t) === true);
    for (let i = 0; i < candidateEntities.length; i++) {
      for (let j = i + 1; j < candidateEntities.length; j++) {
        const a = candidateEntities[i];
        const b = candidateEntities[j];
        if (a === b) continue;
        if (!aliasGraph.has(a)) aliasGraph.set(a, new Set());
        if (!aliasGraph.has(b)) aliasGraph.set(b, new Set());
        aliasGraph.get(a)!.add(b);
        aliasGraph.get(b)!.add(a);
      }
    }
  }

  // Prune bigrams to those with frequency >= 2
  for (const [bg, ids] of Array.from(biGramToFactIds.entries())) {
    if (ids.size < 2) biGramToFactIds.delete(bg);
  }

  return { factsById, tokenToFactIds, biGramToFactIds, entityLexicon, aliasGraph };
}

export function tokenizeQuery(q: string): { tokens: string[]; bigrams: string[] } {
  const tokens = splitTokens(q);
  return { tokens, bigrams: collectBigrams(tokens) };
}

