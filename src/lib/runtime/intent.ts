// src/lib/runtime/intent.ts
export type IntentLabel = 'short' | 'explain' | 'list' | 'story' | 'sensitive';
export type IntentAdjust = { budgetMsDelta: number; fastTokensDelta: number };

const RULES: Array<{ re: RegExp; label: IntentLabel; adj: IntentAdjust }> = [
  { re: /\b(explain|why|how|walk me through)\b/i, label: 'explain', adj: { budgetMsDelta: +300, fastTokensDelta: +16 } },
  { re: /\b(list|bullet|options|ideas|recommend|top \d+)\b/i, label: 'list', adj: { budgetMsDelta: +200, fastTokensDelta: +8 } },
  { re: /\b(tell.*story|write.*story|in character|roleplay)\b/i, label: 'story', adj: { budgetMsDelta: +400, fastTokensDelta: +24 } },
  { re: /\b(health|legal|death|memorial|privacy|consent)\b/i, label: 'sensitive', adj: { budgetMsDelta: +200, fastTokensDelta: +8 } },
];

export function classifyIntent(lastUserMessage: string): { label: IntentLabel; adj: IntentAdjust } {
  for (const r of RULES) if (r.re.test(lastUserMessage)) return { label: r.label, adj: r.adj };
  return { label: 'short', adj: { budgetMsDelta: 0, fastTokensDelta: 0 } };
}