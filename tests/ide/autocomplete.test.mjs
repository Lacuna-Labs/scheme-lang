// tests/ide/autocomplete.test.mjs — verb-completion index.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { verbCompletions } from '../../src/ide/autocomplete.js'
import { makeSakuraEnv } from '../../src/sakuraEnv.js'

test('autocomplete — matches by prefix', () => {
  const env = makeSakuraEnv({ n: 200000 })
  const c = verbCompletions(env)
  const matches = c.match('tick/')
  assert.ok(matches.length >= 8)
  assert.ok(matches.some(m => m.name === 'tick/sine'))
  assert.ok(matches.some(m => m.name === 'tick/ease'))
})

test('autocomplete — surfaces the reference signature', () => {
  const env = makeSakuraEnv({ n: 200000 })
  const c = verbCompletions(env)
  const matches = c.match('ops/eoq')
  assert.equal(matches[0].name, 'ops/eoq')
  assert.ok(matches[0].sig)
  assert.ok(matches[0].summary)
})

test('autocomplete — empty prefix returns empty', () => {
  const env = makeSakuraEnv({ n: 200000 })
  const c = verbCompletions(env)
  assert.deepEqual(c.match(''), [])
})

test('autocomplete — index size matches env + reference', () => {
  const env = makeSakuraEnv({ n: 200000 })
  const c = verbCompletions(env)
  assert.ok(c.size > 1100, `expected >1100 verbs, got ${c.size}`)
})
