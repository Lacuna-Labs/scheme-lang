#!/usr/bin/env node
// descriptor-scan.mjs — detect descriptor-shape lies in the wired env.
//
// A verb registered as wired that returns a tagged-list of the form
// [name, ...args] or [Sym(name), ...args] where head === verb name AND
// the verb doesn't actually do the thing is a lie.
//
// Usage: node scripts/descriptor-scan.mjs [--names-only] [--verbose]
//
// This scanner mirrors docs/reports/descriptor-shape-sweep-2026-07-14.slat
// but is re-runnable — so we can measure descriptor-lie count after each
// fix.

import { makeSakuraEnv } from '../src/sakuraEnv.js'
import { Sym } from '../src/reader.js'

process.stderr.write('[scan] boot\n')

const args = process.argv.slice(2)
const namesOnly = args.includes('--names-only')
const verbose = args.includes('--verbose')

const fuel = { n: 5_000_000 }
const env = makeSakuraEnv(fuel, { loadAuth: false })
process.stderr.write(`[scan] env size=${env.vars.size}\n`)

// Silence stdout during the scan — print/display/newline verbs would
// otherwise flood it. stderr is where our report goes.
const origStdoutWrite = process.stdout.write.bind(process.stdout)
process.stdout.write = () => true

const sentinels = [
  [],
  [1],
  [1, 2],
  [1, 2, 3],
  [1, 2, 3, 4],
  [1, 2, 3, 4, 5],
]

const descriptorLies = []
const verbList = [...env.vars.keys()].sort()

// Verbs that side-effect the scanner itself. Skip so the scan can run.
const skipList = new Set([
  'exit',                  // calls process.exit
  'eval',                  // may re-enter interpreter with unknown fuel
  'apply',                 // higher-order dispatch
  'raise', 'error',        // throw — scanner already handles throws
])

// Reference-sanctioned control-value verbs whose CONTRACT is to return
// [sym(verb-name), ...args] as a first-class control signal. Not lies
// by shape — the reference's own :signature declares this form.
//   done      -> [symbol]                    (state terminal signal)
//   escalate  -> control-value               (state fatal signal)
//   wait      -> descriptor                  (event-suspend signal)
// (First two wired real in wired-verbs-ada-a-h.js as symbolic tags.)
const controlValueWhitelist = new Set([
  'done', 'escalate', 'wait',
])

// Neutralize process.exit — some verbs may call it. We want to catch
// that not let it kill the scan.
const origExit = process.exit
let exitBlocked = 0
process.exit = (code) => {
  exitBlocked++
  process.stderr.write(`[scan] process.exit(${code}) intercepted\n`)
  throw new Error(`process.exit intercepted (code=${code})`)
}

for (let idx = 0; idx < verbList.length; idx++) {
  const name = verbList[idx]
  const v = env.vars.get(name)
  if (typeof v !== 'function') continue
  // Skip stubs — those already throw honestly.
  if (v._sakuraStub) continue
  if (skipList.has(name)) continue
  if (controlValueWhitelist.has(name)) continue

  let firstResult = null
  let sawDescriptor = false
  let sawNonDescriptor = false

  for (const sargs of sentinels) {
    let r
    try {
      r = v(...sargs)
    } catch (e) {
      // If EVERY call throws, that's not a descriptor lie — it may be
      // a stub-that-throws or a real function that needs valid input.
      continue
    }
    if (isDescriptorShape(r, name)) {
      sawDescriptor = true
      if (firstResult === null) firstResult = r
    } else if (isHonestErrorRecord(r)) {
      // honest error record; not a lie
      sawNonDescriptor = true
      break
    } else {
      // A real value — this verb does something.
      sawNonDescriptor = true
      break
    }
  }

  if (sawDescriptor && !sawNonDescriptor) {
    descriptorLies.push({ name, sample: firstResult })
  }
}

process.exit = origExit
process.stderr.write(`[scan] loop done, ${descriptorLies.length} lies, ${exitBlocked} exit-blocks\n`)

// Optionally dump the full list of lying names for downstream fix scripts.
if (args.includes('--dump-names')) {
  const fs = await import('node:fs')
  fs.writeFileSync('/tmp/descriptor-lies.txt', descriptorLies.map(x => x.name).sort().join('\n') + '\n')
  process.stderr.write(`[scan] dumped ${descriptorLies.length} names to /tmp/descriptor-lies.txt\n`)
}

function isDescriptorShape(r, name) {
  if (!Array.isArray(r) || r.length === 0) return false
  const head = r[0]
  const headName = head instanceof Sym ? head.name : head
  return headName === name
}

function isHonestErrorRecord(r) {
  return r != null && typeof r === 'object' && !Array.isArray(r) &&
         (r.__sakuraError === true || r._isErrorObject === true)
}

// Restore stdout for our own report.
process.stdout.write = origStdoutWrite

// Use stderr — many wired verbs print to stdout on invocation, which
// would corrupt a stdout-only report.
const log = (msg) => process.stderr.write(msg + '\n')

if (namesOnly) {
  for (const { name } of descriptorLies) log(name)
} else {
  log(`descriptor-lie scan: ${descriptorLies.length} verbs still lie`)
  if (verbose) {
    for (const { name, sample } of descriptorLies.slice(0, 40)) {
      let preview
      try { preview = JSON.stringify(sample).slice(0, 60) }
      catch { preview = '[circular]' }
      log(`  ${name.padEnd(40)}  → ${preview}`)
    }
    if (descriptorLies.length > 40) {
      log(`  … (+${descriptorLies.length - 40} more)`)
    }
  }
}

process.exit(0)
