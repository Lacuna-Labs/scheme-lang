#!/usr/bin/env node
// scheme-docs-lane-helper.mjs — utilities for the scheme-docs lane.
//
// Provides:
//   node scripts/scheme-docs-lane-helper.mjs run '<code>'
//     Run a scheme snippet in-process (same runner as book-code-sync-sweep).
//     Prints OK or FAIL: <err>.
//
//   node scripts/scheme-docs-lane-helper.mjs verify-file <patchfile.json>
//     Load a patch spec `[{ verb, tier, old, new }, ...]` and verify each
//     `new` runs OK.
//
//   node scripts/scheme-docs-lane-helper.mjs apply-file <patchfile.json>
//     Apply each patch to docs/SAKURA-SCHEME-REFERENCE.slat:
//       - Encode `old` and `new` as SLAT escaped strings.
//       - Search for exactly `:code "<encoded old>"` in the file.
//       - Replace with `:code "<encoded new>"`.
//       - Refuse to apply if the search string is not present exactly once
//         (safety — collisions or misses report and skip).
//
//   node scripts/scheme-docs-lane-helper.mjs list-failures [--category=X]
//     Load .book-code-sync.json and print each failure as
//       VERB\tTIER\tCATEGORY\tERROR-SHORT
//
//   node scripts/scheme-docs-lane-helper.mjs sweep
//     Re-run the full sweep in-process (delegates to book-code-sync-sweep).

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parse } from '../src/reader.js'
import { evaluate } from '../src/interp.js'
import { expandProgram } from '../src/macro.js'
import { makeSakuraEnv } from '../src/sakuraEnv.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REF_PATH = join(__dirname, '..', 'docs', 'SAKURA-SCHEME-REFERENCE.slat')
const CHECKPOINT = join(__dirname, '.book-code-sync.json')
const DEFAULT_FUEL = 400000

function runOne(code) {
  const fuel = { n: DEFAULT_FUEL }
  const env = makeSakuraEnv(fuel)
  try {
    const forms = parse(code)
    const { forms: expanded } = expandProgram(forms)
    let last
    for (const f of expanded) last = evaluate(f, env, fuel)
    return { ok: true }
  } catch (err) {
    const msg = err && err.message ? err.message : String(err)
    return { ok: false, error: msg }
  }
}

// Encode a raw string (with real \n chars, real " chars) into the exact
// escaped form used in SLAT `:code "..."` values.
// The SLAT reader does the standard C-style unescape: \n → newline,
// \" → quote, \\ → backslash. Nothing else. So we escape in reverse.
function slatEncode(raw) {
  return raw
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
}

function cmdRun(code) {
  const r = runOne(code)
  if (r.ok) {
    console.log('OK')
    process.exit(0)
  } else {
    console.log('FAIL: ' + r.error)
    process.exit(1)
  }
}

function loadPatchFile(path) {
  const raw = readFileSync(path, 'utf-8')
  return JSON.parse(raw)
}

function cmdVerifyFile(path) {
  const patches = loadPatchFile(path)
  let ok = 0, fail = 0
  for (const p of patches) {
    const r = runOne(p.new)
    if (r.ok) { ok++ } else {
      fail++
      console.log('VERIFY-FAIL', p.verb, '/', p.tier, ':', r.error)
      console.log('  code:', p.new.slice(0, 200))
    }
  }
  console.log('verify:', ok, 'ok /', fail, 'fail')
  if (fail > 0) process.exit(1)
}

function cmdApplyFile(path) {
  const patches = loadPatchFile(path)
  let text = readFileSync(REF_PATH, 'utf-8')
  let applied = 0
  let missed = 0
  let ambiguous = 0
  const misses = []
  for (const p of patches) {
    const oldEnc = ':code "' + slatEncode(p.old) + '"'
    const newEnc = ':code "' + slatEncode(p.new) + '"'
    const occurrences = text.split(oldEnc).length - 1
    if (occurrences === 0) {
      missed++
      misses.push({ verb: p.verb, tier: p.tier, reason: 'not-found' })
    } else if (occurrences > 1) {
      ambiguous++
      misses.push({ verb: p.verb, tier: p.tier, reason: 'ambiguous', count: occurrences })
    } else {
      text = text.replace(oldEnc, newEnc)
      applied++
    }
  }
  writeFileSync(REF_PATH, text)
  console.log('applied:', applied, '/ missed:', missed, '/ ambiguous:', ambiguous)
  if (misses.length > 0) {
    console.log('MISSES:')
    for (const m of misses.slice(0, 20)) console.log(' ', m.verb, m.tier, m.reason, m.count || '')
    if (misses.length > 20) console.log('  ...and', misses.length - 20, 'more')
  }
}

function cmdListFailures(catFilter) {
  if (!existsSync(CHECKPOINT)) {
    console.error('no checkpoint file; run scripts/book-code-sync-sweep.mjs first')
    process.exit(1)
  }
  const d = JSON.parse(readFileSync(CHECKPOINT, 'utf-8'))
  for (const r of d.results) {
    if (catFilter && r.category !== catFilter) continue
    const short = (r.error || '').slice(0, 90)
    console.log([r.verb, r.tier, r.category, short].join('\t'))
  }
}

async function main() {
  const args = process.argv.slice(2)
  const cmd = args[0]
  if (cmd === 'run') {
    cmdRun(args.slice(1).join(' '))
  } else if (cmd === 'verify-file') {
    cmdVerifyFile(args[1])
  } else if (cmd === 'apply-file') {
    cmdApplyFile(args[1])
  } else if (cmd === 'list-failures') {
    const catArg = args.find((a) => a.startsWith('--category='))
    cmdListFailures(catArg ? catArg.split('=')[1] : null)
  } else {
    console.error('usage: scheme-docs-lane-helper.mjs <run|verify-file|apply-file|list-failures> [args]')
    process.exit(1)
  }
}

main().catch((e) => {
  console.error(e && e.stack ? e.stack : e)
  process.exit(1)
})
