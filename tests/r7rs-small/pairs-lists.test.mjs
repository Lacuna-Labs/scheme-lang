// tests/r7rs-small/pairs-lists.test.mjs — R7RS-small §6.4 (pairs & lists).
//
// Covers: pair?, cons, car, cdr, c[ad]{2,4}r accessors, null?, list?,
// make-list, list, length, append, reverse, list-tail, list-ref,
// list-set!, list-copy, memq/memv/member, assq/assv/assoc.
//
// Per decision-006 (no mutable pair cells), set-car! / set-cdr! are
// NOT registered. Test that they throw.

import { test } from 'node:test'
import assert from 'node:assert'
import { makeRunner } from './_helpers.mjs'

// ── §6.4 pair?, cons, car, cdr ──────────────────────────────────────────

test('§6.4 — pair? on non-empty list', () => {
  const { run } = makeRunner()
  assert.equal(run("(pair? '(1 2 3))"), true)
})

test('§6.4 — pair? on empty list is #f', () => {
  const { run } = makeRunner()
  assert.equal(run("(pair? '())"), false)
})

test('§6.4 — cons builds a pair', () => {
  const { run } = makeRunner()
  assert.deepEqual(run("(cons 1 '(2 3))"), [1, 2, 3])
})

test('§6.4 — car returns head', () => {
  const { run } = makeRunner()
  assert.equal(run("(car '(1 2 3))"), 1)
})

test('§6.4 — cdr returns tail', () => {
  const { run } = makeRunner()
  assert.deepEqual(run("(cdr '(1 2 3))"), [2, 3])
})

// ── §6.4 c[ad]xxxr composite accessors ──────────────────────────────────

test('§6.4 — cadr, caddr, cdddr, cadddr, cddddr', () => {
  const { run } = makeRunner()
  assert.equal(run("(cadr '(1 2 3 4 5))"), 2)
  assert.equal(run("(caddr '(1 2 3 4 5))"), 3)
  assert.deepEqual(run("(cdddr '(1 2 3 4 5))"), [4, 5])
  assert.equal(run("(cadddr '(1 2 3 4 5))"), 4)
  assert.deepEqual(run("(cddddr '(1 2 3 4 5))"), [5])
})

test('§6.4 — caar / cdar / caaar / caadr etc.', () => {
  const { run } = makeRunner()
  assert.equal(run("(caar '((1 2) (3 4)))"), 1)
  assert.deepEqual(run("(cdar '((1 2 3) (4 5)))"), [2, 3])
  assert.equal(run("(caaar '(((5 6)) (7 8)))"), 5)
})

// ── §6.4 null? / list? ──────────────────────────────────────────────────

test('§6.4 — null? on empty list is #t', () => {
  const { run } = makeRunner()
  assert.equal(run("(null? '())"), true)
})

test('§6.4 — null? on non-empty is #f', () => {
  const { run } = makeRunner()
  assert.equal(run("(null? '(1))"), false)
})

test('§6.4 — list? on proper list is #t', () => {
  const { run } = makeRunner()
  assert.equal(run("(list? '(1 2 3))"), true)
  assert.equal(run("(list? '())"), true)
})

// ── §6.4 make-list, list, length ────────────────────────────────────────

test('§6.4 — make-list with fill', () => {
  const { run } = makeRunner()
  assert.deepEqual(run("(make-list 3 'x)"), [{ name: 'x' }, { name: 'x' }, { name: 'x' }])
})

test('§6.4 — list builds from args', () => {
  const { run } = makeRunner()
  assert.deepEqual(run('(list 1 2 3)'), [1, 2, 3])
  assert.deepEqual(run('(list)'), [])
})

test('§6.4 — length', () => {
  const { run } = makeRunner()
  assert.equal(run("(length '())"), 0)
  assert.equal(run("(length '(a b c d))"), 4)
})

// ── §6.4 append / reverse ───────────────────────────────────────────────

test('§6.4 — append concatenates', () => {
  const { run } = makeRunner()
  assert.deepEqual(run("(append '(1 2) '(3 4))"), [1, 2, 3, 4])
})

test('§6.4 — (append) is ()', () => {
  const { run } = makeRunner()
  assert.deepEqual(run('(append)'), [])
})

test('§6.4 — reverse', () => {
  const { run } = makeRunner()
  assert.deepEqual(run("(reverse '(1 2 3))"), [3, 2, 1])
})

// ── §6.4 list-tail, list-ref, list-copy ─────────────────────────────────

test('§6.4 — list-tail drops n elements', () => {
  const { run } = makeRunner()
  assert.deepEqual(run("(list-tail '(1 2 3 4 5) 2)"), [3, 4, 5])
})

test('§6.4 — list-ref returns nth', () => {
  const { run } = makeRunner()
  assert.equal(run("(list-ref '(1 2 3 4) 2)"), 3)
})

test('§6.4 — list-copy makes a fresh copy', () => {
  const { run } = makeRunner()
  // Different identity but structurally equal.
  const src = `(define orig '(1 2 3))
               (define copy (list-copy orig))
               (list (equal? orig copy) (eq? orig copy))`
  assert.deepEqual(run(src), [true, false])
})

// ── §6.4 list-set! ──────────────────────────────────────────────────────

test('§6.4 — list-set! mutates via array index', () => {
  const { run } = makeRunner()
  const src = `(define lst (list 1 2 3))
               (list-set! lst 1 99)
               lst`
  assert.deepEqual(run(src), [1, 99, 3])
})

// ── §6.4 memq / memv / member ───────────────────────────────────────────

test('§6.4 — memq finds symbol', () => {
  const { run } = makeRunner()
  assert.deepEqual(run("(memq 'b '(a b c))"), [{ name: 'b' }, { name: 'c' }])
})

test('§6.4 — memq returns #f when absent', () => {
  const { run } = makeRunner()
  assert.equal(run("(memq 'z '(a b c))"), false)
})

test('§6.4 — memv finds by eqv?', () => {
  const { run } = makeRunner()
  assert.deepEqual(run("(memv 3 '(1 2 3 4))"), [3, 4])
})

test('§6.4 — member uses equal?', () => {
  const { run } = makeRunner()
  assert.deepEqual(run('(member 3 (list 1 2 3 4))'), [3, 4])
})

// ── §6.4 assq / assv / assoc ────────────────────────────────────────────

test('§6.4 — assq finds pair by eq? on car', () => {
  const { run } = makeRunner()
  assert.deepEqual(run("(assq 'b '((a 1) (b 2) (c 3)))"), [{ name: 'b' }, 2])
})

test('§6.4 — assq returns #f when absent', () => {
  const { run } = makeRunner()
  assert.equal(run("(assq 'z '((a 1) (b 2)))"), false)
})

test('§6.4 — assv finds pair by eqv?', () => {
  const { run } = makeRunner()
  assert.deepEqual(run("(assv 2 '((1 a) (2 b) (3 c)))"), [2, { name: 'b' }])
})

test('§6.4 — assoc finds pair by equal?', () => {
  const { run } = makeRunner()
  assert.deepEqual(run('(assoc 2 (list (list 1 (quote a)) (list 2 (quote b))))'), [2, { name: 'b' }])
})

// ── §6.4 set-car! / set-cdr! — DEFERRED per decision-006 ────────────────

test('§6.4 — set-car! not registered (decision-006)', () => {
  const { run } = makeRunner()
  assert.throws(() => run("(set-car! '(1 2) 99)"), /unbound symbol: set-car!/)
})

test('§6.4 — set-cdr! not registered (decision-006)', () => {
  const { run } = makeRunner()
  assert.throws(() => run("(set-cdr! '(1 2) 99)"), /unbound symbol: set-cdr!/)
})
