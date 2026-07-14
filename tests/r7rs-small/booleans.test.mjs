// tests/r7rs-small/booleans.test.mjs — R7RS-small §6.3 (booleans).
//
// Covers: not, boolean?, boolean=?. Also the crucial truthiness rule
// (only #f is false — 0, empty list, empty string are truthy).

import { test } from 'node:test'
import assert from 'node:assert'
import { makeRunner } from './_helpers.mjs'

// ── §6.3 not ────────────────────────────────────────────────────────────

test('§6.3 — (not #f) is #t', () => {
  const { run } = makeRunner()
  assert.equal(run('(not #f)'), true)
})

test('§6.3 — (not #t) is #f', () => {
  const { run } = makeRunner()
  assert.equal(run('(not #t)'), false)
})

test('§6.3 — (not 0) is #f (0 is truthy)', () => {
  const { run } = makeRunner()
  assert.equal(run('(not 0)'), false)
})

test('§6.3 — (not \'()) is #f (empty list is truthy)', () => {
  const { run } = makeRunner()
  assert.equal(run("(not '())"), false)
})

test('§6.3 — (not "") is #f (empty string is truthy)', () => {
  const { run } = makeRunner()
  assert.equal(run('(not "")'), false)
})

// ── §6.3 boolean? ───────────────────────────────────────────────────────

test('§6.3 — boolean? on #t is #t', () => {
  const { run } = makeRunner()
  assert.equal(run('(boolean? #t)'), true)
})

test('§6.3 — boolean? on #f is #t', () => {
  const { run } = makeRunner()
  assert.equal(run('(boolean? #f)'), true)
})

test('§6.3 — boolean? on non-boolean is #f', () => {
  const { run } = makeRunner()
  assert.equal(run('(boolean? 0)'), false)
  assert.equal(run("(boolean? 'sym)"), false)
  assert.equal(run("(boolean? '())"), false)
})

// ── §6.3 boolean=? ──────────────────────────────────────────────────────

test('§6.3 — boolean=? on equal booleans is #t', () => {
  const { run } = makeRunner()
  assert.equal(run('(boolean=? #t #t)'), true)
  assert.equal(run('(boolean=? #f #f)'), true)
})

test('§6.3 — boolean=? on different booleans is #f', () => {
  const { run } = makeRunner()
  assert.equal(run('(boolean=? #t #f)'), false)
})
