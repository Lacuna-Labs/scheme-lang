// tests/ide/snippets.test.mjs — snippet catalog + expansion.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SNIPPETS, findSnippet, matchSnippets, expandSnippet } from '../../src/ide/snippets.js'

test('snippets — catalog is non-empty and shapes match', () => {
  assert.ok(SNIPPETS.length >= 6)
  for (const s of SNIPPETS) {
    assert.equal(typeof s.trigger, 'string')
    assert.equal(typeof s.label, 'string')
    assert.equal(typeof s.body, 'string')
    assert.ok(s.trigger.length > 0)
    assert.ok(s.body.length > 0)
  }
})

test('snippets — triggers are unique', () => {
  const seen = new Set()
  for (const s of SNIPPETS) {
    assert.equal(seen.has(s.trigger), false, `duplicate trigger: ${s.trigger}`)
    seen.add(s.trigger)
  }
})

test('snippets — findSnippet by exact trigger', () => {
  const s = findSnippet('cart-scaffold')
  assert.ok(s)
  assert.equal(s.trigger, 'cart-scaffold')
  assert.equal(findSnippet('does-not-exist'), null)
})

test('snippets — matchSnippets ranks prefix highest', () => {
  const m = matchSnippets('cart')
  assert.ok(m.length >= 1)
  assert.equal(m[0].trigger, 'cart-scaffold')
})

test('snippets — expandSnippet removes $CURSOR marker', () => {
  const s = findSnippet('hello-world')
  const { text, cursorOffset } = expandSnippet(s)
  assert.equal(text.includes('$CURSOR'), false)
  assert.ok(cursorOffset >= 0)
  assert.ok(cursorOffset <= text.length)
})

test('snippets — expandSnippet with no marker returns full text', () => {
  const s = { body: 'no marker here' }
  const { text, cursorOffset } = expandSnippet(s)
  assert.equal(text, 'no marker here')
  assert.equal(cursorOffset, text.length)
})
