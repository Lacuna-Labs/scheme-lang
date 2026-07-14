// tests/r7rs-small/library-system.test.mjs — R7RS-small §7.
//
// Per decision-023, the R7RS §7 library system (define-library, import,
// export, include, include-library-declarations) is NOT shipped —
// Sakura Scheme uses a single flat namespace. cond-expand IS shipped
// (compile-time only) since it's needed for feature detection.
//
// Tests assert both the working feature (cond-expand) and the
// documented deferrals.

import { test } from 'node:test'
import assert from 'node:assert'
import { makeRunner } from './_helpers.mjs'

// ── §7 cond-expand — WORKS ──────────────────────────────────────────────

test('§7 — cond-expand matches r7rs feature', () => {
  const { run } = makeRunner()
  assert.equal(run('(cond-expand (r7rs 1) (else 2))'), 1)
})

test('§7 — cond-expand else fallthrough', () => {
  const { run } = makeRunner()
  assert.equal(run('(cond-expand (never-defined 1) (else 2))'), 2)
})

test('§7 — cond-expand and-clause', () => {
  const { run } = makeRunner()
  assert.equal(run('(cond-expand ((and r7rs sakura-scheme) 1) (else 2))'), 1)
})

test('§7 — cond-expand or-clause', () => {
  const { run } = makeRunner()
  assert.equal(run('(cond-expand ((or nope r7rs) 1) (else 2))'), 1)
})

test('§7 — cond-expand not-clause', () => {
  const { run } = makeRunner()
  assert.equal(run('(cond-expand ((not never-a-feature) 1) (else 2))'), 1)
})

test('§7 — cond-expand library clause always fails (no library system)', () => {
  const { run } = makeRunner()
  assert.equal(run('(cond-expand ((library (scheme base)) 1) (else 2))'), 2)
})

test('§7 — no matching clause and no else yields empty begin', () => {
  const { run } = makeRunner()
  // Empty begin returns undefined — check no throw
  const r = run('(cond-expand (never-1) (never-2))')
  assert.ok(r === undefined || r === false || r === null)
})

// ── §7 features symbol coverage ─────────────────────────────────────────

test('§7 — features declares sakura-scheme', () => {
  const { run } = makeRunner()
  const feats = run('(features)')
  const names = feats.map((f) => f && f.name)
  assert.ok(names.includes('sakura-scheme'))
})

test('§7 — features declares r7rs', () => {
  const { run } = makeRunner()
  const feats = run('(features)')
  const names = feats.map((f) => f && f.name)
  assert.ok(names.includes('r7rs'))
})

// ── §7 define-library and friends — DEFERRED per decision-023 ───────────

test('§7 — define-library not registered (decision-023)', () => {
  const { run } = makeRunner()
  assert.throws(() => run('(define-library (my lib) (export foo) (begin (define foo 42)))'),
    /unbound symbol: define-library|define-library/i)
})

test('§7 — import not registered (decision-023)', () => {
  const { run } = makeRunner()
  assert.throws(() => run('(import (scheme base))'), /unbound symbol: import/)
})

test('§7 — export not registered (decision-023)', () => {
  const { run } = makeRunner()
  assert.throws(() => run('(export foo)'), /unbound symbol: export/)
})

test('§7 — include not registered (decision-023)', () => {
  const { run } = makeRunner()
  assert.throws(() => run('(include "other.scm")'), /unbound symbol: include/)
})

test('§7 — include-library-declarations not registered (decision-023)', () => {
  const { run } = makeRunner()
  assert.throws(() => run('(include-library-declarations "x")'),
    /unbound symbol: include-library-declarations/)
})
