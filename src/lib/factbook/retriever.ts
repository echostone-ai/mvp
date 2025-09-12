import { FBIndex, tokenizeQuery } from './buildIndex';

export type Retrieval = { facts: { id: string }[]; scores: Array<{ id: string; score: number }>; tokens: string[]; expanded: string[] };

export function retrieveFacts(q: string, idx: FBIndex, k: number = 6): Retrieval {
  const { tokens, bigrams } = tokenizeQuery(q);

  // Expand tokens with alias graph neighbors
  const expandedSet = new Set<string>(tokens);
  for (const t of tokens) {
    const key = t;
    const neighbors = idx.aliasGraph.get(key);
    if (neighbors) {
      for (const n of neighbors) expandedSet.add(n);
    }
  }
  const expandedTokens = Array.from(expandedSet);

  // Precompute facts to examine by union of token hits
  const candidateFacts = new Set<string>();
  for (const t of expandedTokens) {
    const ids = idx.tokenToFactIds.get(t);
    if (ids) for (const id of ids) candidateFacts.add(id);
  }

  const scores: Array<{ id: string; score: number }>= [];
  for (const id of candidateFacts) {
    const f = idx.factsById.get(id);
    if (!f) continue;
    const factTokens = new Set<string>([...(f.keywords || []).map(x => x.toLowerCase()), ...(f.topics || []).map(x => x.toLowerCase())]);

    // overlap
    let overlap = 0;
    for (const t of tokens) if (factTokens.has(t)) overlap++;

    // aliasBoost: count matches with expanded set
    let aliasBoost = 0;
    for (const t of expandedTokens) if (factTokens.has(t)) aliasBoost++;

    // bigramBoost: each query bigram that exists and includes this fact
    let bigramBoost = 0;
    for (const bg of bigrams) {
      const hit = idx.biGramToFactIds.get(bg);
      if (hit && hit.has(id)) bigramBoost += 0.5;
    }

    // typeBoost: infer from topics
    const topics = new Set<string>((f.topics || []).map(t => t.toLowerCase()));
    let typeBoost = 0;
    if (topics.has('timeline')) typeBoost = 0.6; else if (topics.has('places') || topics.has('place')) typeBoost = 0.2;

    const weight = (f as any).weight ?? 0.5;
    const score = overlap + aliasBoost + bigramBoost + typeBoost + 0.5 * weight;
    if (score > 0) scores.push({ id, score });
  }

  scores.sort((a, b) => b.score - a.score);
  const top = scores.slice(0, k);
  return { facts: top.map(s => ({ id: s.id })), scores: top, tokens, expanded: expandedTokens };
}

