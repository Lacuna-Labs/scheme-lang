// tests/r7rs-small/strings.test.mjs — R7RS-small §6.7 (strings).
//
// Per decision-020, strings are immutable — string-set!, string-copy!,
// string-fill! are not registered and raise unbound-symbol. Test that
// documented behavior.

import { test } from 'node:test'
import assert from 'node:assert'
import { makeRunner } from './_helpers.mjs'

// ── §6.7 Predicates + basic constructors ────────────────────────────────

test('§6.7 — string? on string is #t', () => {
  const { run } = makeRunner()
  assert.equal(run('(string? "hello")'), true)
})

test('§6.7 — string? on non-string is #f', () => {
  const { run } = makeRunner()
  assert.equal(run("(string? 'foo)"), false)
  assert.equal(run('(string? 42)'), false)
})

test('§6.7 — make-string with length', () => {
  const { run } = makeRunner()
  assert.equal(run('(string-length (make-string 5))'), 5)
})

// ── §6.7 string-length, string-ref ──────────────────────────────────────

test('§6.7 — string-length', () => {
  const { run } = makeRunner()
  assert.equal(run('(string-length "hello")'), 5)
  assert.equal(run('(string-length "")'), 0)
})

test('§6.7 — string-ref returns a character (per decision-024)', () => {
  const { run } = makeRunner()
  assert.equal(run('(char? (string-ref "hello" 0))'), true)
  assert.equal(run('(char=? (string-ref "hello" 0) #\\h)'), true)
})

// ── §6.7 comparisons ────────────────────────────────────────────────────

test('§6.7 — string=?', () => {
  const { run } = makeRunner()
  assert.equal(run('(string=? "abc" "abc")'), true)
  assert.equal(run('(string=? "abc" "abd")'), false)
})

test('§6.7 — string<? / string>? / string<=? / string>=?', () => {
  const { run } = makeRunner()
  assert.equal(run('(string<? "abc" "abd")'), true)
  assert.equal(run('(string>? "abd" "abc")'), true)
  assert.equal(run('(string<=? "abc" "abc")'), true)
  assert.equal(run('(string>=? "abc" "abc")'), true)
})

test('§6.7 — string-ci=? case-insensitive', () => {
  const { run } = makeRunner()
  assert.equal(run('(string-ci=? "HELLO" "hello")'), true)
})

test('§6.7 — string-ci<? case-insensitive', () => {
  const { run } = makeRunner()
  assert.equal(run('(string-ci<? "ABC" "abd")'), true)
})

// ── §6.7 case conversion ────────────────────────────────────────────────

test('§6.7 — string-upcase', () => {
  const { run } = makeRunner()
  assert.equal(run('(string-upcase "hello")'), 'HELLO')
})

test('§6.7 — string-downcase', () => {
  const { run } = makeRunner()
  assert.equal(run('(string-downcase "HELLO")'), 'hello')
})

test('§6.7 — string-foldcase', () => {
  const { run } = makeRunner()
  assert.equal(run('(string-foldcase "HELLO")'), 'hello')
})

// ── §6.7 substring, string-append ───────────────────────────────────────

test('§6.7 — substring', () => {
  const { run } = makeRunner()
  assert.equal(run('(substring "hello" 1 4)'), 'ell')
})

test('§6.7 — string-append', () => {
  const { run } = makeRunner()
  assert.equal(run('(string-append "a" "b" "c")'), 'abc')
  assert.equal(run('(string-append)'), '')
})

// ── §6.7 string <-> list ────────────────────────────────────────────────

test('§6.7 — string->list returns Ch list (per decision-024)', () => {
  const { run } = makeRunner()
  const src = '(map char->integer (string->list "abc"))'
  assert.deepEqual(run(src), [97, 98, 99])
})

test('§6.7 — list->string accepts chars', () => {
  const { run } = makeRunner()
  assert.equal(run('(list->string (list #\\a #\\b #\\c))'), 'abc')
})

test('§6.7 — string->list / list->string round-trip', () => {
  const { run } = makeRunner()
  assert.equal(run('(list->string (string->list "hello"))'), 'hello')
})

// ── §6.7 string-copy (fresh copy) ───────────────────────────────────────

test('§6.7 — string-copy makes a copy', () => {
  const { run } = makeRunner()
  assert.equal(run('(string-copy "hello")'), 'hello')
})

test('§6.7 — string-copy with start/end', () => {
  const { run } = makeRunner()
  assert.equal(run('(string-copy "hello" 1 4)'), 'ell')
})

// ── §6.7 string-map / string-for-each ───────────────────────────────────

test('§6.7 — string-map applies char->char', () => {
  const { run } = makeRunner()
  assert.equal(run('(string-map char-upcase "hello")'), 'HELLO')
})

test('§6.7 — string-for-each iterates', () => {
  const { run } = makeRunner()
  const src = `(define count 0)
               (string-for-each (lambda (c) (set! count (+ count 1))) "hello")
               count`
  assert.equal(run(src), 5)
})

// ── §6.7 string <-> vector ──────────────────────────────────────────────

test('§6.7 — string->vector', () => {
  const { run } = makeRunner()
  const src = '(map char->integer (vector->list (string->vector "abc")))'
  assert.deepEqual(run(src), [97, 98, 99])
})

test('§6.7 — vector->string', () => {
  const { run } = makeRunner()
  assert.equal(run('(vector->string (vector #\\a #\\b #\\c))'), 'abc')
})

// ── §6.7 String mutators — DEFERRED per decision-020 ────────────────────

test('§6.7 — string-set! not registered (decision-020)', () => {
  const { run } = makeRunner()
  assert.throws(() => run('(string-set! "hi" 0 #\\x)'), /unbound symbol: string-set!/)
})

test('§6.7 — string-fill! not registered (decision-020)', () => {
  const { run } = makeRunner()
  assert.throws(() => run('(string-fill! "hi" #\\x)'), /unbound symbol: string-fill!/)
})

test('§6.7 — string-copy! not registered (decision-020)', () => {
  const { run } = makeRunner()
  assert.throws(() => run('(string-copy! "hi" 0 "a")'), /unbound symbol: string-copy!/)
})

// ── §6.7 Constructor: string port + get-output-string is the mutation-free path
// documented in decision-020's convention.

test('§6.7 — string built via port + get-output-string (decision-020 convention)', () => {
  const { run } = makeRunner()
  const src = `(let ((p (open-output-string)))
                 (write-char #\\h p)
                 (write-string "ello" p)
                 (get-output-string p))`
  assert.equal(run(src), 'hello')
})
