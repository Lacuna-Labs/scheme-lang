#!/usr/bin/env node
// scripts/architect-watch.mjs — one iteration of the Architect watch loop.
//
// Purpose:
//   - git fetch + pull the wire-596 branch.
//   - find new commits matching `<lane>: wire <verb-name>`.
//   - for each verb, load its entry from docs/staging/verbs-<lane>.slat,
//     run the 5 example tiers via `bin/sakura-scheme eval`, and append a
//     stamp record to docs/reports/wire-596-stamps-2026-07-14.slat.
//   - commit + push stamp updates.
//   - emit a JSON status summary on stdout so the driver can trigger a
//     PushNotification at 100-verb boundaries.
//
// IDEMPOTENT: reads which verbs are already stamped from the stamps file
// and skips them. Safe to re-run.
//
// Invocation:
//   node scripts/architect-watch.mjs
//
// Alfred's rule: "We can't lie to people. They trust us." — every stamp
// corresponds to a REAL REPL run.
//
// All external command invocation goes through spawnSync (no shell), so
// there is no command-injection surface even if a lane name or verb name
// contained metacharacters.

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, readdirSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const REPO = dirname(dirname(__filename));
const STAMPS = join(REPO, 'docs/reports/wire-596-stamps-2026-07-14.slat');
const STAGING_DIR = join(REPO, 'docs/staging');
const BIN = join(REPO, 'bin/sakura-scheme');

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { cwd: REPO, encoding: 'utf8', ...opts });
}

// stamps file parsing

function readStamps() {
  if (!existsSync(STAMPS)) return { raw: '', stamped: new Set(), failed: new Set() };
  const raw = readFileSync(STAMPS, 'utf8');
  const stamped = new Set();
  const failed = new Set();
  for (const line of raw.split('\n')) {
    const s = line.match(/^\s*\(stamp\s+:verb\s+"([^"]+)"/);
    if (s) stamped.add(s[1]);
    const f = line.match(/^\s*\(fail\s+:verb\s+"([^"]+)"/);
    if (f) failed.add(f[1]);
  }
  return { raw, stamped, failed };
}

// staging file parsing: balanced-paren records starting with (verb

function extractRecords(raw) {
  const out = [];
  let i = 0;
  while (i < raw.length) {
    const start = raw.indexOf('(verb', i);
    if (start === -1) break;
    const nc = raw[start + 5];
    if (nc && !/\s/.test(nc)) { i = start + 5; continue; }
    let depth = 0;
    let j = start;
    let inStr = false;
    while (j < raw.length) {
      const ch = raw[j];
      if (inStr) {
        if (ch === '\\') { j += 2; continue; }
        if (ch === '"') inStr = false;
      } else {
        if (ch === '"') inStr = true;
        else if (ch === '(') depth++;
        else if (ch === ')') { depth--; if (depth === 0) { j++; break; } }
        else if (ch === ';') {
          const nl = raw.indexOf('\n', j);
          j = (nl === -1) ? raw.length : nl;
          continue;
        }
      }
      j++;
    }
    out.push({ text: raw.slice(start, j) });
    i = j;
  }
  return out;
}

function parseStagingFile(path) {
  if (!existsSync(path)) return [];
  return extractRecords(readFileSync(path, 'utf8'));
}

function fieldValue(record, key) {
  const text = record.text;
  const re = new RegExp(':' + key.replace(/[/?]/g, '\\$&') + '(?=[\\s\\)])');
  const m = re.exec(text);
  if (!m) return null;
  let i = m.index + m[0].length;
  while (i < text.length && /\s/.test(text[i])) i++;
  if (i >= text.length) return null;
  const start = i;
  const ch = text[i];
  if (ch === '"') {
    i++;
    while (i < text.length) {
      if (text[i] === '\\') { i += 2; continue; }
      if (text[i] === '"') { i++; break; }
      i++;
    }
    return text.slice(start, i);
  }
  if (ch === '(') {
    let depth = 0, inStr = false;
    while (i < text.length) {
      const c = text[i];
      if (inStr) {
        if (c === '\\') { i += 2; continue; }
        if (c === '"') inStr = false;
      } else {
        if (c === '"') inStr = true;
        else if (c === '(') depth++;
        else if (c === ')') { depth--; if (depth === 0) { i++; break; } }
      }
      i++;
    }
    return text.slice(start, i);
  }
  while (i < text.length && !/[\s\)]/.test(text[i])) i++;
  return text.slice(start, i);
}

function extractExampleCodes(examplesRaw) {
  if (!examplesRaw) return [];
  const codes = [];
  const re = /:code\s+"((?:[^"\\]|\\.)*)"/g;
  let m;
  while ((m = re.exec(examplesRaw)) !== null) {
    codes.push(m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\'));
  }
  return codes;
}

const REQUIRED_FIELDS = [
  'name', 'library', 'kind', 'signature', 'summary', 'explanation',
  'examples', 'caveats', 'drawbacks', 'usecases', 'related', 'learn',
];

function verifyVerb(record) {
  const missing = [];
  for (const f of REQUIRED_FIELDS) {
    if (fieldValue(record, f) === null) missing.push(f);
  }
  const provenance = fieldValue(record, 'entry-provenance');
  if (provenance && /author-blocked/.test(provenance)) {
    return { ok: false, blocked: true, reason: 'author-blocked', missing, examplesPassed: 0 };
  }
  if (missing.length) {
    return { ok: false, reason: 'missing fields: ' + missing.join(','), missing, examplesPassed: 0 };
  }
  const codes = extractExampleCodes(fieldValue(record, 'examples'));
  if (codes.length < 5) {
    return { ok: false, reason: 'only ' + codes.length + '/5 example tiers', examplesPassed: 0 };
  }
  let passed = 0;
  for (const code of codes.slice(0, 5)) {
    const r = spawnSync(BIN, ['eval', code], { encoding: 'utf8', timeout: 10000, cwd: REPO });
    const stderr = r.stderr || '';
    const looksOk = r.status === 0 && !/^Error/im.test(stderr);
    if (looksOk) { passed++; continue; }
    return { ok: false, reason: 'tier ' + (passed + 1) + ' failed: ' + (stderr || r.stdout || '').split('\n')[0].slice(0, 120), examplesPassed: passed };
  }
  return { ok: true, examplesPassed: passed };
}

function utcNow() { return new Date().toISOString(); }

function appendStamp(line) { appendFileSync(STAMPS, line + '\n'); }

function updateHeaderCurrent(newCurrent) {
  const raw = readFileSync(STAMPS, 'utf8');
  const updated = raw.replace(/(\(stamps\s+:target\s+\d+\s+:notified-at\s+\([^)]*\)\s+:current\s+)\d+/, '$1' + newCurrent);
  writeFileSync(STAMPS, updated);
}

function laneBreakdown() {
  const { raw } = readStamps();
  const counts = {};
  const re = /\(stamp\s+:verb\s+"[^"]+"\s+:lane\s+"([^"]+)"/g;
  let m;
  while ((m = re.exec(raw)) !== null) counts[m[1]] = (counts[m[1]] || 0) + 1;
  return counts;
}

function iteration() {
  run('git', ['fetch', 'origin']);
  run('git', ['pull', '--rebase', 'origin', 'verbs/wire-596-2026-07-14']);

  const startState = readStamps();
  const alreadyStamped = new Set(startState.stamped);
  const alreadyFailed = new Set(startState.failed);

  const laneFiles = existsSync(STAGING_DIR)
    ? readdirSync(STAGING_DIR).filter(f => /^verbs-.*\.slat$/.test(f))
    : [];

  const verbToLane = new Map();
  for (const f of laneFiles) {
    const lane = f.replace(/^verbs-/, '').replace(/\.slat$/, '');
    for (const r of parseStagingFile(join(STAGING_DIR, f))) {
      const rawName = fieldValue(r, 'name');
      if (!rawName) continue;
      const name = rawName.replace(/^"|"$/g, '');
      verbToLane.set(name, { lane, record: r });
    }
  }

  let stampedCount = 0;
  let failedCount = 0;
  let blockedCount = 0;
  const stampedThisBatch = [];

  for (const [verb, { lane, record }] of verbToLane) {
    if (alreadyStamped.has(verb) || alreadyFailed.has(verb)) continue;
    const result = verifyVerb(record);
    if (result.ok) {
      appendStamp('(stamp :verb "' + verb + '" :lane "' + lane + '" :verified-at "' + utcNow() + '" :examples-passed 5 :required-fields-present #t)');
      alreadyStamped.add(verb);
      stampedThisBatch.push(verb);
      stampedCount++;
    } else if (result.blocked) {
      appendStamp('(fail :verb "' + verb + '" :lane "' + lane + '" :verified-at "' + utcNow() + '" :examples-passed 0 :reason "author-blocked")');
      alreadyFailed.add(verb);
      blockedCount++;
    } else {
      const safe = String(result.reason || 'unknown').replace(/[\\"]/g, ' ').slice(0, 200);
      appendStamp('(fail :verb "' + verb + '" :lane "' + lane + '" :verified-at "' + utcNow() + '" :examples-passed ' + (result.examplesPassed || 0) + ' :reason "' + safe + '")');
      alreadyFailed.add(verb);
      failedCount++;
    }
  }

  const newCurrent = alreadyStamped.size;
  updateHeaderCurrent(newCurrent);

  if (stampedCount + failedCount + blockedCount > 0) {
    run('git', ['add', STAMPS]);
    const lastVerb = stampedThisBatch[stampedThisBatch.length - 1] || '(none)';
    const msg =
      'architect: stamp ' + stampedCount + ' verbs (verified up to ' + lastVerb + ')\n\n' +
      '+' + stampedCount + ' verified, +' + failedCount + ' spec-bug fails, +' + blockedCount + ' author-blocked.\n' +
      'Total stamped now = ' + newCurrent + '.\n\n' +
      'Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>';
    const c = run('git', ['-c', 'commit.gpgsign=false', 'commit', '-m', msg]);
    if (c.status === 0) run('git', ['push', 'origin', 'verbs/wire-596-2026-07-14']);
  }

  return {
    stamped: stampedCount,
    failed: failedCount,
    blocked: blockedCount,
    stampedThisBatch,
    totalStamped: newCurrent,
    breakdown: laneBreakdown(),
    laneFilesFound: laneFiles.length,
    stagingVerbCount: verbToLane.size,
  };
}

const status = iteration();
console.log(JSON.stringify(status, null, 2));
