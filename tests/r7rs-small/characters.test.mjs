// tests/r7rs-small/characters.test.mjs — R7RS-small §6.6 (characters).
//
// Per decision-024, characters are a distinct tagged type (Ch class).
// #\a reads as Ch, char? is #t only on Ch instances, string? is #f on Ch.

import { test } from 'node:test'
import assert from 'node:assert'
import { makeRunner } from './_helpers.mjs'

// ── §6.6 char? and distinctness from strings ────────────────────────────

test('§6.6 — char? on #\\a is #t (per decision-024)', () => {
  const { run } = makeRunner()
  assert.equal(run('(char? #\\a)'), true)
})

test('§6.6 — string? on #\\a is #f (per decision-024)', () => {
  const { run } = makeRunner()
  assert.equal(run('(string? #\\a)'), false)
})

test('§6.6 — char? on a 1-char string is #f (per decision-024)', () => {
  const { run } = makeRunner()
  assert.equal(run('(char? "a")'), false)
})

test('§6.6 — char? on number is #f', () => {
  const { run } = makeRunner()
  assert.equal(run('(char? 65)'), false)
})

// ── §6.6 Named character literals ───────────────────────────────────────

test('§6.6 — #\\space reads', () => {
  const { run } = makeRunner()
  assert.equal(run('(char->integer #\\space)'), 32)
})

test('§6.6 — #\\newline reads', () => {
  const { run } = makeRunner()
  assert.equal(run('(char->integer #\\newline)'), 10)
})

test('§6.6 — #\\tab reads', () => {
  const { run } = makeRunner()
  assert.equal(run('(char->integer #\\tab)'), 9)
})

test('§6.6 — #\\null reads', () => {
  const { run } = makeRunner()
  assert.equal(run('(char->integer #\\null)'), 0)
})

test('§6.6 — #\\return reads', () => {
  const { run } = makeRunner()
  assert.equal(run('(char->integer #\\return)'), 13)
})

// ── §6.6 char comparisons ───────────────────────────────────────────────

test('§6.6 — char=?', () => {
  const { run } = makeRunner()
  assert.equal(run('(char=? #\\a #\\a)'), true)
  assert.equal(run('(char=? #\\a #\\b)'), false)
})

test('§6.6 — char<? char>?', () => {
  const { run } = makeRunner()
  assert.equal(run('(char<? #\\a #\\b)'), true)
  assert.equal(run('(char>? #\\b #\\a)'), true)
})

test('§6.6 — char<=? char>=?', () => {
  const { run } = makeRunner()
  assert.equal(run('(char<=? #\\a #\\a)'), true)
  assert.equal(run('(char>=? #\\a #\\a)'), true)
})

test('§6.6 — char-ci=? case-insensitive', () => {
  const { run } = makeRunner()
  assert.equal(run('(char-ci=? #\\A #\\a)'), true)
})

test('§6.6 — char-ci<? case-insensitive', () => {
  const { run } = makeRunner()
  assert.equal(run('(char-ci<? #\\A #\\b)'), true)
})

// ── §6.6 char classification ────────────────────────────────────────────

test('§6.6 — char-alphabetic?', () => {
  const { run } = makeRunner()
  assert.equal(run('(char-alphabetic? #\\a)'), true)
  assert.equal(run('(char-alphabetic? #\\5)'), false)
})

test('§6.6 — char-numeric?', () => {
  const { run } = makeRunner()
  assert.equal(run('(char-numeric? #\\5)'), true)
  assert.equal(run('(char-numeric? #\\a)'), false)
})

test('§6.6 — char-whitespace?', () => {
  const { run } = makeRunner()
  assert.equal(run('(char-whitespace? #\\space)'), true)
  assert.equal(run('(char-whitespace? #\\a)'), false)
})

test('§6.6 — char-upper-case? char-lower-case?', () => {
  const { run } = makeRunner()
  assert.equal(run('(char-upper-case? #\\A)'), true)
  assert.equal(run('(char-lower-case? #\\a)'), true)
  assert.equal(run('(char-upper-case? #\\a)'), false)
})

// ── §6.6 char case conversion ───────────────────────────────────────────

test('§6.6 — char-upcase', () => {
  const { run } = makeRunner()
  assert.equal(run('(char->integer (char-upcase #\\a))'), 65)
})

test('§6.6 — char-downcase', () => {
  const { run } = makeRunner()
  assert.equal(run('(char->integer (char-downcase #\\A))'), 97)
})

test('§6.6 — char-foldcase', () => {
  const { run } = makeRunner()
  assert.equal(run('(char->integer (char-foldcase #\\A))'), 97)
})

// ── §6.6 char <-> integer ───────────────────────────────────────────────

test('§6.6 — char->integer', () => {
  const { run } = makeRunner()
  assert.equal(run('(char->integer #\\A)'), 65)
  assert.equal(run('(char->integer #\\0)'), 48)
})

test('§6.6 — integer->char', () => {
  const { run } = makeRunner()
  assert.equal(run('(char->integer (integer->char 97))'), 97)
})

test('§6.6 — char <-> integer round-trip', () => {
  const { run } = makeRunner()
  assert.equal(run('(char=? #\\x (integer->char (char->integer #\\x)))'), true)
})

// ── §6.6 digit-value ────────────────────────────────────────────────────

test('§6.6 — digit-value on digit', () => {
  const { run } = makeRunner()
  assert.equal(run('(digit-value #\\7)'), 7)
})

test('§6.6 — digit-value on non-digit is #f', () => {
  const { run } = makeRunner()
  assert.equal(run('(digit-value #\\a)'), false)
})

// ── §6.6 char eqv? ──────────────────────────────────────────────────────

test('§6.6 — eqv? on same char is #t', () => {
  const { run } = makeRunner()
  assert.equal(run('(eqv? #\\a #\\a)'), true)
})
