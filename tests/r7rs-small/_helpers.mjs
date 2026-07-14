// tests/r7rs-small/_helpers.mjs — shared harness for R7RS-small tests.
//
// Every test file imports this and calls `makeRunner()` to get a fresh
// env + a Scheme evaluator function. Shared code stays here so we don't
// repeat the boilerplate in 15 test files.

import { makeBaseEnv } from '../../src/base.js'
import { parse } from '../../src/reader.js'
import { evaluate } from '../../src/interp.js'
import { expandProgram } from '../../src/macro.js'

// Silence the (harmless) missing-perm warnings that fire when Scheme
// user code defines new bindings during a test.
const _origWarn = console.warn
console.warn = (...args) => {
  const msg = args[0]
  if (typeof msg === 'string' && msg.includes('[verbRegistry]')) return
  _origWarn.apply(console, args)
}

/**
 * makeRunner() — fresh env + Scheme runner tuple.
 *
 * Returns { run, env, fuel } where `run(src)` parses, macro-expands,
 * and interprets every top-level Scheme form in `src`, returning the
 * value of the LAST expression.
 */
export function makeRunner() {
  const fuel = { n: 500000 }
  const env = makeBaseEnv(fuel)
  const run = (src) => {
    const forms = parse(src)
    const { forms: expanded } = expandProgram(forms)
    let r
    for (const f of expanded) r = evaluate(f, env, fuel)
    return r
  }
  return { run, env, fuel }
}

// Re-export types for tests that need to reference them directly.
export { Sym, Ch, ch, sym } from '../../src/reader.js'
export {
  Values, SchemePromise, Parameter, EOF, RecordType, RecordInstance,
  Port, ErrorObject,
} from '../../src/r7rs-types.js'

/**
 * schemeEqual(a, b) — structural equality that respects our tagged types
 * (Sym, Ch). Two Sym instances with the same name are equal even though
 * they're separate object instances. Same for Ch, and for Uint8Array
 * (bytevectors). Arrays and objects recurse.
 */
export function schemeEqual(a, b) {
  if (a === b) return true
  if (a == null || b == null) return false
  // Sym / Ch — compare by their tag property.
  if (a.constructor && b.constructor && a.constructor === b.constructor) {
    if (a instanceof Uint8Array) {
      if (a.length !== b.length) return false
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
      return true
    }
    if ('name' in a && 'name' in b && a.constructor.name === 'Sym')
      return a.name === b.name
    if ('value' in a && 'value' in b && a.constructor.name === 'Ch')
      return a.value === b.value
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (!schemeEqual(a[i], b[i])) return false
    return true
  }
  return false
}
