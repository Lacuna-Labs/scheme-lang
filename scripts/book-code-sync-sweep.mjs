#!/usr/bin/env node
// book-code-sync-sweep.mjs — execute every :examples :code in the
// reference SLAT against the current runtime, catalog PASS/FAIL,
// classify each failure. In-process for speed.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parse } from '../src/reader.js'
import { evaluate } from '../src/interp.js'
import { expandProgram } from '../src/macro.js'
import { makeSakuraEnv } from '../src/sakuraEnv.js'
import { allVerbEntries } from '../src/reference-loader.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CHECKPOINT = join(__dirname, '.book-code-sync.json')
const DEFAULT_FUEL = 200000

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

function classifyError(verbName, code, error) {
  if (!error) return 'unknown'
  if (/unbound symbol[:\s]+/.test(error)) {
    const m = /unbound symbol[:\s]+(\S+)/.exec(error)
    if (m && m[1] === verbName) return 'verb-not-wired'
    return 'unbound-helper'
  }
  if (/expects .* args?/i.test(error) || /wrong number of args/i.test(error) || /arity/i.test(error)) {
    return 'arity-mismatch'
  }
  if (/expected .* got/i.test(error) || /must be a/i.test(error)) {
    return 'type-mismatch'
  }
  if (/complex numbers not supported/.test(error)) return 'complex-numbers-decision-021'
  if (/string-set!|string-fill!|string-copy!/.test(error)) return 'immutable-strings-decision-020'
  if (/set-car!|set-cdr!/.test(error)) return 'immutable-pairs-decision-006'
  if (/reader/i.test(error) || /parse/i.test(error)) return 'reader-error'
  if (/fuel/i.test(error) || /out of fuel/i.test(error)) return 'fuel-exhausted'
  if (/division by zero/i.test(error)) return 'runtime-numeric'
  return 'runtime-error'
}

async function main() {
  const args = process.argv.slice(2)
  const resume = args.includes('--resume')
  const limitArg = args.find((a) => a.startsWith('--limit='))
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : Infinity

  console.error('[sweep] loading reference...')
  const all = allVerbEntries()
  console.error('[sweep] ' + all.length + ' verbs loaded')

  let results = []
  let doneVerbs = new Set()
  if (resume && existsSync(CHECKPOINT)) {
    const saved = JSON.parse(readFileSync(CHECKPOINT, 'utf-8'))
    results = saved.results || []
    doneVerbs = new Set(saved.doneVerbs || [])
    console.error('[sweep] resuming: ' + doneVerbs.size + ' verbs done')
  }

  let processed = 0
  let totalExamples = 0
  let pass = 0
  let fail = 0
  const startAt = Date.now()

  for (const v of all) {
    if (processed >= limit) break
    if (doneVerbs.has(v.name)) continue
    if (!v.examples || v.examples.length === 0) {
      doneVerbs.add(v.name)
      continue
    }
    processed++
    for (const ex of v.examples) {
      if (!ex || !ex.code) continue
      totalExamples++
      const res = runOne(ex.code)
      if (res.ok) {
        pass++
      } else {
        fail++
        const category = classifyError(v.name, ex.code, res.error)
        results.push({
          verb: v.name,
          library: v.library || '',
          tier: ex.tier || '',
          code: ex.code,
          error: res.error,
          category,
        })
      }
    }
    doneVerbs.add(v.name)

    if (processed % 100 === 0) {
      writeFileSync(CHECKPOINT, JSON.stringify({ results, doneVerbs: Array.from(doneVerbs) }))
      const elapsed = ((Date.now() - startAt) / 1000).toFixed(1)
      const eta = ((all.length - processed) * (parseFloat(elapsed) / processed)).toFixed(0)
      console.error('[sweep] ' + processed + '/' + all.length + ' verbs; ' + pass + ' pass / ' + fail + ' fail; ' + elapsed + 's (ETA ' + eta + 's)')
    }
  }

  writeFileSync(CHECKPOINT, JSON.stringify({
    results,
    doneVerbs: Array.from(doneVerbs),
    summary: { totalExamples, pass, fail },
  }))

  const elapsed = ((Date.now() - startAt) / 1000).toFixed(1)
  console.error('[sweep] DONE. ' + totalExamples + ' examples in ' + elapsed + 's')
  console.error('[sweep]   pass: ' + pass)
  console.error('[sweep]   fail: ' + fail)
}

main().catch((e) => {
  console.error(e && e.stack ? e.stack : e)
  process.exit(1)
})
