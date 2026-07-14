// tests/reference/schema.test.mjs — exercises loadSchema + validateEntry.
//
// Phase A of the wire-596 push landed a self-describing schema file at
// docs/SAKURA-SCHEME-REFERENCE-SCHEMA.slat. These tests verify:
//   1. The schema parses.
//   2. The required-field list is exactly the six documented fields.
//   3. validateEntry catches missing required fields.
//   4. validateEntry passes for a fully-populated (hand-authored) entry.
//   5. registerPrimitive refuses a verb with no reference entry.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  loadSchema,
  validateEntry,
  clearReferenceCache,
} from '../../src/reference-loader.js'
import { Env } from '../../src/interp.js'
import { registerPrimitive } from '../../src/registry.js'

test('loadSchema — parses the schema SLAT and exposes required fields', () => {
  clearReferenceCache()
  const s = loadSchema()
  assert.equal(s.version, '1.0')
  assert.deepEqual(
    s.required,
    ['name', 'library', 'signature', 'summary', 'examples', 'impl-status'],
  )
  assert.deepEqual(
    s.exampleTiers,
    ['novice', 'apprentice', 'intermediate', 'expert', 'master'],
  )
  assert.ok(s.disciplines.math, 'math discipline present')
  assert.ok(s.disciplines.cs, 'cs discipline present')
  assert.ok(s.disciplines.eng, 'eng discipline present')
  // Field-docs must cover every required field.
  for (const f of s.required) {
    assert.ok(
      typeof s.fieldDocs[f] === 'string' && s.fieldDocs[f].length > 0,
      `fieldDocs.${f} must be a non-empty description`,
    )
  }
})

test('validateEntry — flags missing required fields', () => {
  const r1 = validateEntry({})
  assert.equal(r1.ok, false)
  assert.deepEqual(
    r1.missingRequired.sort(),
    ['examples', 'impl-status', 'library', 'name', 'signature', 'summary'].sort(),
  )

  const partial = { name: 'foo', library: 'bar' }
  const r2 = validateEntry(partial)
  assert.equal(r2.ok, false)
  assert.deepEqual(
    r2.missingRequired.sort(),
    ['examples', 'impl-status', 'signature', 'summary'].sort(),
  )
})

test('validateEntry — passes for a full hand-authored entry', () => {
  const full = {
    name: 'abs',
    library: 'core',
    signature: '(abs x) -> number',
    summary: 'Absolute value of a number.',
    examples: [
      { tier: 'novice', code: '(abs -5)', note: 'Negatives become positive.' },
    ],
    'impl-status': 'wired',
  }
  const res = validateEntry(full)
  assert.equal(res.ok, true)
  assert.equal(res.missingRequired.length, 0)
})

test('validateEntry — empty string / empty list / empty object all count as missing', () => {
  const r = validateEntry({
    name: '',
    library: 'core',
    signature: '(x)',
    summary: 'hi',
    examples: [],
    'impl-status': 'wired',
  })
  assert.equal(r.ok, false)
  assert.ok(r.missingRequired.includes('name'))
  assert.ok(r.missingRequired.includes('examples'))
})

test('registerPrimitive — refuses a verb with no reference entry', () => {
  const env = new Env()
  assert.throws(
    () => registerPrimitive(env, 'totally-not-a-verb-2026', () => 42),
    /refusing to bind/,
    'must throw with a "refusing to bind" message',
  )
  // And the binding was NOT installed.
  assert.equal(env.vars.has('totally-not-a-verb-2026'), false)
})

test('registerPrimitive — accepts a verb with a reference entry', () => {
  // `geom/circle-area` is in the reference — see docs/SAKURA-SCHEME-REFERENCE.slat.
  const env = new Env()
  registerPrimitive(
    env,
    'geom/circle-area',
    (r) => Math.PI * r * r,
    { perm: 'read' },
  )
  assert.equal(env.vars.has('geom/circle-area'), true)
  const fn = env.vars.get('geom/circle-area')
  assert.equal(typeof fn, 'function')
  assert.ok(Math.abs(fn(1) - Math.PI) < 1e-9)
})

test('registerPrimitive — validates arg shape', () => {
  assert.throws(() => registerPrimitive(null, 'x', () => 1), /env must be an Env/)
  assert.throws(() => registerPrimitive(new Env(), '', () => 1), /non-empty string/)
  assert.throws(
    () => registerPrimitive(new Env(), 'geom/circle-area', null),
    /must be a function/,
  )
})
