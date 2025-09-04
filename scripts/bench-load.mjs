// scripts/bench-load.mjs
import { setTimeout as wait } from 'node:timers/promises';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const PATH = '/api/chat';
const CONCURRENCY = Number(process.env.C || 20);
const DURATION_MS = Number(process.env.D || 60000);
const MODE = process.env.MODE || 'demo'; // demo|normal
const ABORT_AFTER_MS = Number(process.env.ABORT || 0); // 0 = off

let running = true;
setTimeout(() => running = false, DURATION_MS);
let opens = 0, closes = 0, errs = 0, totals = [];

async function runOne(i) {
  while (running) {
    const t0 = Date.now();
    try {
      const r = await fetch(BASE + PATH, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ 
          avatarSlug: MODE==='demo'?'jonathan-demo':'test-avatar', 
          message: `quick ping ${i}-${Date.now()}`,
          mode: MODE 
        }),
      });
      const reader = r.body.getReader();
      opens++;
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, {stream:true});
        if (ABORT_AFTER_MS && Date.now()-t0 > ABORT_AFTER_MS) break;
      }
      closes++;
      totals.push(Date.now()-t0);
    } catch (e) { 
      errs++; 
    }
    await wait(10);
  }
}

await Promise.all(Array.from({length: CONCURRENCY}, (_,i)=>runOne(i)));
totals.sort((a,b)=>a-b);
const p = q=> totals[Math.min(totals.length-1, Math.floor(q*(totals.length-1)))];
console.log(JSON.stringify({ 
  opens, 
  closes, 
  errs, 
  count: totals.length, 
  p50: p(0.50), 
  p95: p(0.95), 
  mode: MODE 
}, null, 2));