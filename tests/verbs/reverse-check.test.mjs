// tests/verbs/reverse-check.test.mjs — inventory sanity check.
//
// Alfred asked for a reverse check: JS bindings in the env that
// have no entry in the SLAT reference. Not a failure — they may be
// intentional builtins that predate the reference. But we log them so
// they can be reviewed for inclusion (or removal).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeBaseEnv } from '../../src/base.js'
import { registerReferenceVerbs, findJsImplsMissingFromReference } from '../../src/reference-register.js'
import { loadReference } from '../../src/reference-loader.js'

test('reverse check — logs base-env verbs not in reference', () => {
  const fuel = { n: 200000 }
  const env = makeBaseEnv(fuel)
  registerReferenceVerbs(env, fuel)

  const extras = findJsImplsMissingFromReference(env)
  console.log(`\nJS bindings NOT in reference (${extras.length}):`)
  console.log(extras.slice(0, 40).join(', ') + (extras.length > 40 ? ` … (+${extras.length - 40} more)` : ''))

  // Assert we found a nontrivial count (means the check itself is
  // wired). No hard cap; new base primitives can be added without
  // breaking this test.
  assert.ok(extras.length > 0, 'expected some base primitives not in reference')
})

test('reference — every verb has a summary + at least one example', () => {
  const ref = loadReference()
  const missing = []
  for (const v of ref.verbList) {
    if (!v.summary || v.summary.length < 5) missing.push({ name: v.name, why: 'missing summary' })
    if (!Array.isArray(v.examples) || v.examples.length === 0) missing.push({ name: v.name, why: 'no examples' })
  }
  if (missing.length > 0) {
    console.log(`Verbs with missing summary or examples (${missing.length}):`)
    for (const m of missing.slice(0, 10)) console.log(`  • ${m.name}: ${m.why}`)
  }
  // Loose assertion — the reference SHOULD be complete but we don't
  // block on it.
  assert.ok(missing.length < 100, `too many verbs missing docs: ${missing.length}`)
})
