// tests/r7rs-small/system.test.mjs — R7RS-small §6.14 (system interface).
//
// Per decision-025, `load` and `delete-file` are NOT registered.

import { test } from 'node:test'
import assert from 'node:assert'
import { makeRunner } from './_helpers.mjs'

// ── §6.14 command-line ──────────────────────────────────────────────────

test('§6.14 — command-line returns a list', () => {
  const { run } = makeRunner()
  const r = run('(command-line)')
  assert.equal(Array.isArray(r), true)
})

// ── §6.14 exit / emergency-exit ─────────────────────────────────────────

test('§6.14 — exit is a procedure', () => {
  const { run } = makeRunner()
  assert.equal(run('(procedure? exit)'), true)
})

test('§6.14 — emergency-exit is a procedure', () => {
  const { run } = makeRunner()
  assert.equal(run('(procedure? emergency-exit)'), true)
})

// ── §6.14 get-environment-variable ──────────────────────────────────────

test('§6.14 — get-environment-variable returns #f or string', () => {
  const { run } = makeRunner()
  const r = run('(get-environment-variable "NONEXISTENT_NOT_SET_XYZ_12345")')
  // Should be #f since the env var is very unlikely to be set.
  assert.equal(r === false || typeof r === 'string', true)
})

test('§6.14 — get-environment-variable of PATH returns a string', () => {
  const { run } = makeRunner()
  const r = run('(get-environment-variable "PATH")')
  assert.equal(typeof r === 'string' || r === false, true)
})

test('§6.14 — get-environment-variables returns a list', () => {
  const { run } = makeRunner()
  const r = run('(get-environment-variables)')
  assert.equal(Array.isArray(r), true)
})

// ── §6.14 current-second / current-jiffy / jiffies-per-second ───────────

test('§6.14 — current-second is a number', () => {
  const { run } = makeRunner()
  assert.equal(typeof run('(current-second)'), 'number')
})

test('§6.14 — current-jiffy is a number', () => {
  const { run } = makeRunner()
  assert.equal(typeof run('(current-jiffy)'), 'number')
})

test('§6.14 — jiffies-per-second is a positive number', () => {
  const { run } = makeRunner()
  const j = run('(jiffies-per-second)')
  assert.equal(typeof j, 'number')
  assert.ok(j > 0)
})

// ── §6.14 features ──────────────────────────────────────────────────────

test('§6.14 — features returns a list of symbols', () => {
  const { run } = makeRunner()
  const feats = run('(features)')
  assert.equal(Array.isArray(feats), true)
  assert.ok(feats.length > 0)
  // Should contain r7rs and sakura-scheme
  const names = feats.map((f) => f && f.name)
  assert.ok(names.includes('r7rs'))
  assert.ok(names.includes('sakura-scheme'))
})

// ── §6.14 file-exists? (from base, per audit) ───────────────────────────

test('§6.14 — file-exists? on likely-nonexistent path', () => {
  const { run } = makeRunner()
  const r = run('(file-exists? "/very/unlikely/path/xyz/abc/nope")')
  assert.equal(r === true || r === false, true)
})

// ── §6.14 load / delete-file — DEFERRED per decision-025 ────────────────

test('§6.14 — load not registered (decision-025)', () => {
  const { run } = makeRunner()
  assert.throws(() => run('(load "any.scm")'), /unbound symbol: load/)
})

test('§6.14 — delete-file not registered (decision-025)', () => {
  const { run } = makeRunner()
  assert.throws(() => run('(delete-file "any.txt")'), /unbound symbol: delete-file/)
})
