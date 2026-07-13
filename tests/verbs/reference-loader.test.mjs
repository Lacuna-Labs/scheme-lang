// tests/verbs/reference-loader.test.mjs — smoke test for the SLAT loader.
//
// Verifies:
//   - loader parses SAKURA-SCHEME-REFERENCE.slat cleanly
//   - the reference reports 1,157 verbs + 70 core forms
//   - a spot-check verb entry has the expected shape
//   - clearing the cache re-parses

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadReference, getVerbEntry, referenceMeta, clearReferenceCache } from '../../src/reference-loader.js'

test('loader — parses and counts', () => {
  const ref = loadReference()
  assert.equal(ref.verbs.size, 1157, 'expected 1,157 verbs')
  assert.equal(ref.coreForms.size, 70, 'expected 70 core forms')
})

test('loader — verb entry shape', () => {
  const v = getVerbEntry('geom/circle-area')
  assert.ok(v, 'expected geom/circle-area in reference')
  assert.equal(v.library, 'geom')
  assert.equal(v.kind, 'meta')
  assert.match(v.signature, /geom\/circle-area/)
  assert.ok(v.summary.length > 5)
  assert.ok(Array.isArray(v.examples))
  assert.ok(v.examples.length >= 1)
  assert.ok(v.examples[0].code.includes('geom/circle-area'))
})

test('loader — reference meta', () => {
  const m = referenceMeta()
  assert.equal(m.name, 'sakura-scheme')
  assert.equal(m.version, '1.0')
  assert.equal(m.verbCount, 1157)
})

test('loader — clear + reload works', () => {
  clearReferenceCache()
  const ref = loadReference()
  assert.equal(ref.verbs.size, 1157)
})
