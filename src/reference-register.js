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

import { loadReference } from './reference-loader.js'
import { installReferenceImpls } from './reference-impls.js'

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
      env.define(name, stubFn, { perm: 'read' })
      missingImpls.push(name)
      stubbed++
    } else {
      missingImpls.push(name)
    }
  }

  return {
    total: ref.verbList.length,
    implemented,
    stubbed,
    preBound: preBound.size,
    missingImpls,
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
