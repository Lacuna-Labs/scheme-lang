// tests/r7rs-small/program-structure.test.mjs — R7RS-small §5.
//
// Covers: define, define-syntax (syntax-rules), define-record-type,
// define-values, cond-expand.
//
// Per decision-023 (define-library deferred), define-library, import,
// export are NOT registered and their form triggers an unbound symbol
// or unknown-syntax error. Test that behavior explicitly.

import { test } from 'node:test'
import assert from 'node:assert'
import { makeRunner } from './_helpers.mjs'

// ── §5.3 Variable definitions ───────────────────────────────────────────

test('§5.3 — define binds a value', () => {
  const { run } = makeRunner()
  assert.equal(run('(define x 42) x'), 42)
})

test('§5.3 — define with lambda shorthand', () => {
  const { run } = makeRunner()
  assert.equal(run('(define (square x) (* x x)) (square 5)'), 25)
})

test('§5.3 — define with dotted-tail params', () => {
  const { run } = makeRunner()
  assert.deepEqual(run('(define (f a . rest) (cons a rest)) (f 1 2 3)'), [1, 2, 3])
})

// ── §5.3.3 Multiple-value definitions — define-values ───────────────────

test('§5.3.3 — define-values splits multiple return values', () => {
  const { run } = makeRunner()
  assert.equal(run('(define-values (a b c) (values 1 2 3)) (+ a b c)'), 6)
})

test('§5.3.3 — define-values with single value works', () => {
  const { run } = makeRunner()
  assert.equal(run('(define-values (x) 42) x'), 42)
})

// ── §5.4 Syntax definitions — define-syntax ─────────────────────────────

test('§5.4 — define-syntax + syntax-rules basic', () => {
  const { run } = makeRunner()
  const src = `(define-syntax swap
                 (syntax-rules ()
                   ((_ a b) (list b a))))
               (swap 1 2)`
  assert.deepEqual(run(src), [2, 1])
})

test('§5.4 — syntax-rules with literal', () => {
  const { run } = makeRunner()
  const src = `(define-syntax my-if
                 (syntax-rules (then else)
                   ((_ t then a else b) (if t a b))))
               (my-if #t then 1 else 2)`
  assert.equal(run(src), 1)
})

test('§5.4 — syntax-rules with ellipsis', () => {
  const { run } = makeRunner()
  const src = `(define-syntax my-list
                 (syntax-rules ()
                   ((_ x ...) (list x ...))))
               (my-list 1 2 3 4)`
  assert.deepEqual(run(src), [1, 2, 3, 4])
})

test('§5.4 — let-syntax provides scoped macros', () => {
  const { run } = makeRunner()
  assert.equal(
    run('(let-syntax ((sq (syntax-rules () ((_ x) (* x x))))) (sq 5))'),
    25
  )
})

test('§5.4 — letrec-syntax also provides scoped macros', () => {
  const { run } = makeRunner()
  assert.equal(
    run('(letrec-syntax ((sq (syntax-rules () ((_ x) (* x x))))) (sq 6))'),
    36
  )
})

// ── §5.5 Record-type definitions — define-record-type ───────────────────

test('§5.5 — define-record-type creates constructor + predicate + accessor', () => {
  const { run } = makeRunner()
  const src = `(define-record-type point
                 (make-point x y)
                 point?
                 (x pt-x)
                 (y pt-y))
               (define p (make-point 3 4))
               (list (point? p) (pt-x p) (pt-y p))`
  assert.deepEqual(run(src), [true, 3, 4])
})

test('§5.5 — record predicate is #f on non-records', () => {
  const { run } = makeRunner()
  const src = `(define-record-type box
                 (make-box v)
                 box?
                 (v box-v))
               (list (box? (make-box 1)) (box? 42) (box? (list 1 2)))`
  assert.deepEqual(run(src), [true, false, false])
})

test('§5.5 — different record types are distinct', () => {
  const { run } = makeRunner()
  const src = `(define-record-type a (make-a) a?)
               (define-record-type b (make-b) b?)
               (list (a? (make-a)) (a? (make-b)) (b? (make-b)) (b? (make-a)))`
  assert.deepEqual(run(src), [true, false, true, false])
})

// ── §7.1 cond-expand ────────────────────────────────────────────────────

test('§7.1 — cond-expand matches r7rs feature', () => {
  const { run } = makeRunner()
  assert.equal(run('(cond-expand (r7rs 1) (else 2))'), 1)
})

test('§7.1 — cond-expand falls through to else', () => {
  const { run } = makeRunner()
  assert.equal(run('(cond-expand (nonexistent 1) (else 2))'), 2)
})

test('§7.1 — cond-expand matches sakura-scheme feature', () => {
  const { run } = makeRunner()
  assert.equal(run('(cond-expand (sakura-scheme 1) (else 2))'), 1)
})

test('§7.1 — cond-expand with (and ...) feature clause', () => {
  const { run } = makeRunner()
  assert.equal(run('(cond-expand ((and r7rs sakura-scheme) 1) (else 2))'), 1)
})

test('§7.1 — cond-expand with (or ...) feature clause', () => {
  const { run } = makeRunner()
  assert.equal(run('(cond-expand ((or nope r7rs) 1) (else 2))'), 1)
})

test('§7.1 — cond-expand with (not ...) feature clause', () => {
  const { run } = makeRunner()
  assert.equal(run('(cond-expand ((not nope) 1) (else 2))'), 1)
})

// ── §7 define-library — DEFERRED per decision-023 ───────────────────────

test('§7 — define-library not registered (decision-023)', () => {
  const { run } = makeRunner()
  // define-library isn't a special form, isn't a macro, and isn't a
  // procedure — it triggers unbound symbol on the head of the list.
  assert.throws(() => run('(define-library (foo) (export bar))'),
    /unbound symbol: define-library|define-library/i)
})

test('§7 — import not registered (decision-023)', () => {
  const { run } = makeRunner()
  assert.throws(() => run('(import (scheme base))'),
    /unbound symbol: import|import/i)
})

test('§7 — export not registered (decision-023)', () => {
  const { run } = makeRunner()
  assert.throws(() => run('(export foo bar)'),
    /unbound symbol: export|export/i)
})
