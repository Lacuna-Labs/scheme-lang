// reference-register.js — glue between the reference SLAT and the env.
//
// At REPL boot:
//   1. Load base env (already has core scheme primitives)
//   2. Install curated JS implementations for reference verbs
//      (installReferenceImpls in reference-impls.js)
//   3. Walk every verb in the reference; if not yet bound, define a
//      "clean error" stub that reports the reference contract when
//      invoked. This ensures EVERY documented verb is at least a name
//      the reader can resolve — no more "unbound symbol: geom/foo"
//      from a beginner running an unimplemented example.
//
// The stub error message uses the verb's :contract / :signature so a
// caller who hits an unimplemented verb learns EXACTLY what the verb
// was supposed to do.

import { loadReference, loadSchema, validateEntry } from './reference-loader.js'
import { installReferenceImpls } from './reference-impls.js'
import { setVerbStatus } from './registry.js'

/**
 * registerReferenceVerbs(env, fuel, options?)
 *
 * options:
 *   - impls: boolean (default true) — install curated JS implementations
 *   - stubs: boolean (default true) — install clean-error stubs for
 *            unimplemented verbs
 *   - onWarn: (msg) => void — optional warning sink
 *
 * Returns { total, implemented, stubbed, missingImpls: [...names] }
 */
export function registerReferenceVerbs(env, fuel, options = {}) {
  const { impls = true, stubs = true } = options
  const ref = loadReference()

  // ── snapshot what's already bound BEFORE we install anything ──
  const preBound = new Set(env.vars.keys())

  if (impls) {
    installReferenceImpls(env, fuel)
  }

  const afterImpls = new Set(env.vars.keys())

  let implemented = 0
  let stubbed = 0
  const missingImpls = []

  for (const verb of ref.verbList) {
    const name = verb.name
    if (!name) continue

    if (afterImpls.has(name)) {
      implemented++
      continue
    }

    if (stubs) {
      // Bind a clean-error stub. Body captures the verb entry for a
      // helpful error message. NOT a warning at bind time — only when
      // actually called.
      const sig = verb.signature || `(${name} …)`
      const summary = verb.summary || 'no summary in reference'
      const kind = verb.kind || 'unknown'
      const stubFn = function referenceVerbStub(...args) {
        throw new Error(
          `Verb \`${name}\` is defined in the Sakura Scheme reference but ` +
          `not yet implemented in this build.\n` +
          `  contract: ${sig}\n` +
          `  kind: ${kind}\n` +
          `  summary: ${summary}\n` +
          `  This is a stub — either wire the implementation, or file ` +
          `a ticket at scheme-lang so we know it's needed.`,
        )
      }
      // Preserve the reference contract on the fn for `,help` etc.
      stubFn._sakuraReference = verb
      stubFn._sakuraStub = true
      env.define(name, stubFn, { perm: 'read', status: 'stubbed' })
      // Registry mirror — the color-coding IDE reads `status` here.
      setVerbStatus(name, 'stubbed', {
        stubMessage: `not yet implemented — contract: ${sig}`,
      })
      missingImpls.push(name)
      stubbed++
    } else {
      missingImpls.push(name)
    }
  }

  // ── Schema validation pass (Phase A, wire-596). Never crashes boot —
  // Alfred's ask was "make it impossible to miss", not "block startup".
  // We collect entries that fail the schema's required-fields check
  // and expose them via `validationMisses` on the return value. A
  // one-line summary warning fires only when the caller opts in with
  // options.warnOnMissingSchema — during the 596-verb wire-up the
  // warning would fire on every REPL boot for months otherwise.
  let schema = null
  const validationMisses = []
  try {
    schema = loadSchema()
  } catch (e) {
    if (typeof options.onWarn === 'function') {
      options.onWarn(`schema-load failed: ${e.message}`)
    }
  }
  if (schema) {
    for (const v of ref.verbList) {
      const res = validateEntry(v, schema)
      if (!res.ok) validationMisses.push({ name: v.name, missing: res.missingRequired })
    }
    if (options.warnOnMissingSchema && validationMisses.length > 0) {
      const RED = process.stderr && process.stderr.isTTY ? '\x1b[31m' : ''
      const RESET = process.stderr && process.stderr.isTTY ? '\x1b[0m' : ''
      try {
        const total = ref.verbList.length
        const pct = ((validationMisses.length / total) * 100).toFixed(1)
        console.warn(
          `${RED}[reference] ${validationMisses.length}/${total} verb entries (${pct}%) ` +
          `missing required schema fields.${RESET} ` +
          `See docs/SAKURA-SCHEME-REFERENCE-SCHEMA.slat for the required list. ` +
          `Sample: ${validationMisses.slice(0, 3).map((m) => `${m.name}[${m.missing.join(',')}]`).join('; ')}`,
        )
      } catch { /* never break on a log call */ }
    }
  }

  return {
    total: ref.verbList.length,
    implemented,
    stubbed,
    preBound: preBound.size,
    missingImpls,
    validationMisses,
  }
}

/**
 * findJsImplsMissingFromReference(env)
 *
 * Reverse check — list JS bindings in `env` that are NOT in the
 * reference. These are candidates for either (a) adding to the
 * reference, (b) documenting as "extra" builtins, or (c) removing.
 */
export function findJsImplsMissingFromReference(env) {
  const ref = loadReference()
  const refNames = new Set(ref.verbs.keys())
  const coreNames = new Set(ref.coreForms.keys())
  // Special-form names always allowed (they're the language itself)
  const specialForms = new Set([
    'quote', 'if', 'define', 'set!', 'lambda', 'begin',
    'let', 'let*', 'letrec', 'quasiquote', 'when', 'and',
    'or', 'unless', 'cond', 'case',
  ])
  const extras = []
  for (const [name, val] of env.vars.entries()) {
    if (typeof val !== 'function') continue
    if (refNames.has(name) || coreNames.has(name) || specialForms.has(name)) continue
    extras.push(name)
  }
  return extras.sort()
}
