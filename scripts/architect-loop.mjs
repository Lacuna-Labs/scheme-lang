#!/usr/bin/env node
// scripts/architect-loop.mjs — background watch driver.
//
// Runs one iteration of architect-watch.mjs, sleeps ~45s, repeats until
// either (a) all 1160 verbs are stamped/failed, (b) --once passed, or
// (c) --max-iters N reached (default 40 iterations ≈ 30 min budget).
//
// Emits BOUNDARY events on stdout as JSON lines whenever the total
// stamped count crosses a notification boundary. The invoking Architect
// reads these lines to trigger PushNotifications.

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO = dirname(dirname(__filename));
const WATCH = join(REPO, 'scripts/architect-watch.mjs');

const BOUNDARIES = [100, 200, 300, 400, 500, 596, 600, 700, 800, 900, 1000, 1100, 1160];
const args = process.argv.slice(2);
const once = args.includes('--once');
const maxItersArg = args.find(a => a.startsWith('--max-iters='));
const maxIters = maxItersArg ? Number(maxItersArg.split('=')[1]) : 40;
const sleepMsArg = args.find(a => a.startsWith('--sleep-ms='));
const sleepMs = sleepMsArg ? Number(sleepMsArg.split('=')[1]) : 45000;
const target = 1160;

let lastTotal = 0;
let crossedNext = 0;

function nextBoundary(n) {
  for (const b of BOUNDARIES) if (b > n) return b;
  return null;
}

async function main() {
  crossedNext = nextBoundary(0);
  for (let iter = 0; iter < maxIters; iter++) {
    const r = spawnSync('node', [WATCH], { encoding: 'utf8', cwd: REPO });
    let status = null;
    try { status = JSON.parse((r.stdout || '').trim().split('\n').pop()); } catch {}
    const total = status?.totalStamped ?? lastTotal;

    console.log(JSON.stringify({ tag: 'iter', i: iter, total, delta: total - lastTotal, laneFiles: status?.laneFilesFound ?? 0, stagingVerbs: status?.stagingVerbCount ?? 0, breakdown: status?.breakdown ?? {} }));

    // Emit boundary events for any boundaries just crossed.
    while (crossedNext !== null && total >= crossedNext) {
      const batch = (status?.stampedThisBatch || []).slice(-10);
      const first5 = batch.slice(0, 5);
      const last5 = batch.slice(-5);
      console.log(JSON.stringify({ tag: 'boundary', boundary: crossedNext, total, first5, last5, breakdown: status?.breakdown ?? {} }));
      crossedNext = nextBoundary(crossedNext);
    }

    lastTotal = total;

    if (once) return;
    if (total >= target) return;
    await new Promise(r => setTimeout(r, sleepMs));
  }
  console.log(JSON.stringify({ tag: 'budget-exhausted', maxIters, lastTotal }));
}

main().catch(e => { console.error('LOOP ERROR', e); process.exit(1); });
