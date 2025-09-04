// scripts/metrics-tail.mjs
import readline from 'node:readline';

const rl = readline.createInterface({ input: process.stdin });
let total=0, demo=0, normal=0, fastStop = { stop_tokens:0, stop_sentences:0, stop_time:0 };
let intents = { short:0, explain:0, list:0, story:0, sensitive:0 };
let deepReasons = { late_start:0, budget_deadline:0, deep_micro_budget:0, deep_sentence_limit:0 };

rl.on('line', (line) => {
  if (!line.includes('metrics')) return;
  total++;
  try {
    // Extract JSON after 'metrics'
    const metricsIndex = line.indexOf('metrics');
    const jsonStart = line.indexOf('{', metricsIndex);
    if (jsonStart === -1) return;
    const jsonStr = line.substring(jsonStart);
    const m = JSON.parse(jsonStr);
    
    if (m.path==='demo') demo++; else if (m.path==='normal') normal++;
    if (m.fast_truncated && fastStop[m.fast_truncated]!==undefined) fastStop[m.fast_truncated]++;
    if (m.intent_label && intents[m.intent_label]!==undefined) intents[m.intent_label]++;
    if (m.deep_cancel_reason && deepReasons[m.deep_cancel_reason]!==undefined) deepReasons[m.deep_cancel_reason]++;
  } catch (e) {
    // Skip invalid lines
  }
});

rl.on('close', ()=> {
  console.log(JSON.stringify({ 
    total, 
    demo, 
    normal, 
    fastStop, 
    intents, 
    deepReasons 
  }, null, 2));
});