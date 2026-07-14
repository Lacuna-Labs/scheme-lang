// tests/r7rs-small/control.test.mjs — R7RS-small §6.10 (control features).
//
// Covers: procedure?, apply, map, for-each, string-map, string-for-each,
// vector-map, vector-for-each, call/cc (escape-only per decision-019),
// values, call-with-values, dynamic-wind, tail-call optimization.

import { test } from 'node:test'
import assert from 'node:assert'
import { makeRunner } from './_helpers.mjs'

// ── §6.10 procedure? ────────────────────────────────────────────────────

test('§6.10 — procedure? on primitive is #t', () => {
  const { run } = makeRunner()
  assert.equal(run('(procedure? +)'), true)
})

test('§6.10 — procedure? on lambda is #t', () => {
  const { run } = makeRunner()
  assert.equal(run('(procedure? (lambda (x) x))'), true)
})

test('§6.10 — procedure? on non-procedure is #f', () => {
  const { run } = makeRunner()
  assert.equal(run('(procedure? 5)'), false)
  assert.equal(run("(procedure? '(1 2))"), false)
})

// ── §6.10 apply ─────────────────────────────────────────────────────────

test('§6.10 — apply with list of args', () => {
  const { run } = makeRunner()
  assert.equal(run("(apply + '(1 2 3))"), 6)
})

// ── §6.10 map / for-each ────────────────────────────────────────────────

test('§6.10 — map single-list', () => {
  const { run } = makeRunner()
  assert.deepEqual(run("(map (lambda (x) (* x x)) '(1 2 3 4))"), [1, 4, 9, 16])
})

test('§6.10 — for-each side effect count', () => {
  const { run } = makeRunner()
  const src = `(define c 0)
               (for-each (lambda (x) (set! c (+ c 1))) '(a b c d))
               c`
  assert.equal(run(src), 4)
})

// ── §6.10 vector-map / vector-for-each (also tested in vectors.test) ────

test('§6.10 — vector-map on multi-vector', () => {
  const { run } = makeRunner()
  assert.deepEqual(run('(vector-map + #(1 2 3) #(10 20 30))'), [11, 22, 33])
})

// ── §6.10 string-map / string-for-each ──────────────────────────────────

test('§6.10 — string-map', () => {
  const { run } = makeRunner()
  assert.equal(run('(string-map char-upcase "hello")'), 'HELLO')
})

test('§6.10 — string-for-each', () => {
  const { run } = makeRunner()
  const src = `(define c 0)
               (string-for-each (lambda (ch) (set! c (+ c 1))) "abcde")
               c`
  assert.equal(run(src), 5)
})

// ── §6.10 values + call-with-values ─────────────────────────────────────

test('§6.10 — call-with-values passes multiple values', () => {
  const { run } = makeRunner()
  assert.equal(run('(call-with-values (lambda () (values 1 2 3)) +)'), 6)
})

test('§6.10 — call-with-values with single value passes it directly', () => {
  const { run } = makeRunner()
  assert.equal(run('(call-with-values (lambda () 42) (lambda (x) (* x 2)))'), 84)
})

// ── §6.10 dynamic-wind ──────────────────────────────────────────────────

test('§6.10 — dynamic-wind runs before/thunk/after in order', () => {
  const { run } = makeRunner()
  const src = `(define log (list))
               (dynamic-wind
                 (lambda () (set! log (cons 'before log)))
                 (lambda () (set! log (cons 'thunk log)) 42)
                 (lambda () (set! log (cons 'after log))))
               (reverse log)`
  assert.deepEqual(run(src),
    [{ name: 'before' }, { name: 'thunk' }, { name: 'after' }])
})

test('§6.10 — dynamic-wind returns thunk value', () => {
  const { run } = makeRunner()
  const src = `(dynamic-wind
                 (lambda () #f)
                 (lambda () 'done)
                 (lambda () #f))`
  assert.equal(run(src).name, 'done')
})

test('§6.10 — dynamic-wind after runs even if thunk throws', () => {
  const { run } = makeRunner()
  const src = `(define ran-after #f)
               (guard (e (#t #f))
                 (dynamic-wind
                   (lambda () #f)
                   (lambda () (error "boom"))
                   (lambda () (set! ran-after #t))))
               ran-after`
  assert.equal(run(src), true)
})

// ── §6.10 call/cc — ESCAPE ONLY per decision-019 ────────────────────────

test('§6.10 — call/cc invocation returns via continuation (per decision-019)', () => {
  const { run } = makeRunner()
  assert.equal(run('(+ 1 (call/cc (lambda (k) (k 10))))'), 11)
})

test('§6.10 — call/cc without invocation returns body value', () => {
  const { run } = makeRunner()
  assert.equal(run('(call/cc (lambda (k) 42))'), 42)
})

test('§6.10 — call-with-current-continuation is an alias', () => {
  const { run } = makeRunner()
  assert.equal(run('(+ 1 (call-with-current-continuation (lambda (k) (k 5))))'), 6)
})

test('§6.10 — call/cc as non-local exit', () => {
  const { run } = makeRunner()
  const src = `(call/cc
                 (lambda (return)
                   (do ((i 0 (+ i 1))) ((= i 100) 'not-reached)
                     (if (= i 5) (return 'found) #f))))`
  assert.equal(run(src).name, 'found')
})

// ── §6.10 Tail-call optimization ────────────────────────────────────────

test('§6.10 — deep tail recursion completes (10000 iters)', () => {
  const { run } = makeRunner()
  const src = `(define (loop n)
                 (if (= n 0)
                     'done
                     (loop (- n 1))))
               (loop 10000)`
  assert.equal(run(src).name, 'done')
})

test('§6.10 — mutually tail-recursive procedures', () => {
  const { run } = makeRunner()
  const src = `(define (even? n) (if (= n 0) #t (odd?  (- n 1))))
               (define (odd?  n) (if (= n 0) #f (even? (- n 1))))
               (even? 1000)`
  assert.equal(run(src), true)
})
