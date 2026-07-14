// tests/ide/typo-suggest.test.mjs — did-you-mean suggestions.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { editDistance, suggestVerbs, decorateError } from '../../src/ide/typo-suggest.js'

test('typo-suggest — edit distance basics', () => {
  assert.equal(editDistance('', ''), 0)
  assert.equal(editDistance('a', ''), 1)
  assert.equal(editDistance('', 'a'), 1)
  assert.equal(editDistance('cat', 'cat'), 0)
  assert.equal(editDistance('cat', 'bat'), 1)
  assert.equal(editDistance('cat', 'cats'), 1)
  assert.equal(editDistance('cricle', 'circle'), 1) // adjacent transposition is 1 in Damerau-Levenshtein
})

test('typo-suggest — suggests close verb names', () => {
  const verbs = ['circle', 'geom/circle', 'square', 'rectangle', 'line', 'curve/arc']
  const sugs = suggestVerbs('cricle', verbs, 3)
  assert.ok(sugs.length >= 1)
  assert.ok(sugs.includes('circle'))
})

test('typo-suggest — respects namespace when the bad name has one', () => {
  const verbs = ['geom/circle', 'entity/circle', 'circle', 'geom/square', 'circle-fit']
  const sugs = suggestVerbs('geom/cricle', verbs, 3)
  assert.ok(sugs.includes('geom/circle'))
})

test('typo-suggest — returns empty when nothing is close', () => {
  const verbs = ['circle', 'square', 'triangle']
  const sugs = suggestVerbs('xyzq', verbs, 3)
  assert.deepEqual(sugs, [])
})

test('typo-suggest — decorateError adds a did-you-mean suffix', () => {
  const verbs = ['circle', 'geom/circle']
  const out = decorateError("undefined identifier 'cricle'", verbs)
  assert.match(out, /did you mean/)
  assert.match(out, /circle/)
})

test('typo-suggest — decorateError passes through non-identifier errors', () => {
  const out = decorateError('parse error at line 3', ['circle'])
  assert.equal(out, 'parse error at line 3')
})
