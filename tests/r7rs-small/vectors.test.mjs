// tests/r7rs-small/vectors.test.mjs — R7RS-small §6.8 (vectors).
//
// Vectors are mutable per decision-009. All the mutating operations
// (vector-set!, vector-fill!, vector-copy!) work.

import { test } from 'node:test'
import assert from 'node:assert'
import { makeRunner } from './_helpers.mjs'

// ── §6.8 Predicate + basic constructors ─────────────────────────────────

test('§6.8 — vector? on vector is #t', () => {
  const { run } = makeRunner()
  assert.equal(run('(vector? (vector 1 2 3))'), true)
})

test('§6.8 — vector? on non-vector is #f (per JS repr, arrays are both)', () => {
  const { run } = makeRunner()
  // Sakura represents vectors AND lists as JS arrays. This is a
  // documented trade-off: (vector? '(1 2 3)) is #t here. R7RS says #f
  // — but at least the shape is consistent throughout the language.
  assert.equal(run('(vector? 42)'), false)
})

test('§6.8 — #(...) literal reads as vector', () => {
  const { run } = makeRunner()
  assert.deepEqual(run('#(1 2 3)'), [1, 2, 3])
})

test('§6.8 — make-vector with fill', () => {
  const { run } = makeRunner()
  assert.deepEqual(run('(make-vector 3 0)'), [0, 0, 0])
})

test('§6.8 — vector builds from args', () => {
  const { run } = makeRunner()
  assert.deepEqual(run('(vector 1 2 3)'), [1, 2, 3])
})

// ── §6.8 vector-length, vector-ref ──────────────────────────────────────

test('§6.8 — vector-length', () => {
  const { run } = makeRunner()
  assert.equal(run('(vector-length (vector 1 2 3 4))'), 4)
  assert.equal(run('(vector-length (vector))'), 0)
})

test('§6.8 — vector-ref', () => {
  const { run } = makeRunner()
  assert.equal(run('(vector-ref (vector 10 20 30) 1)'), 20)
})

// ── §6.8 vector-set! ────────────────────────────────────────────────────

test('§6.8 — vector-set! mutates', () => {
  const { run } = makeRunner()
  const src = `(define v (vector 1 2 3))
               (vector-set! v 1 99)
               v`
  assert.deepEqual(run(src), [1, 99, 3])
})

// ── §6.8 vector-fill! ───────────────────────────────────────────────────

test('§6.8 — vector-fill! fills whole vector', () => {
  const { run } = makeRunner()
  const src = `(define v (vector 0 0 0))
               (vector-fill! v 7)
               v`
  assert.deepEqual(run(src), [7, 7, 7])
})

test('§6.8 — vector-fill! with range', () => {
  const { run } = makeRunner()
  const src = `(define v (vector 0 0 0 0 0))
               (vector-fill! v 9 1 4)
               v`
  assert.deepEqual(run(src), [0, 9, 9, 9, 0])
})

// ── §6.8 vector-copy / vector-copy! ─────────────────────────────────────

test('§6.8 — vector-copy makes a fresh copy', () => {
  const { run } = makeRunner()
  const src = `(define a (vector 1 2 3))
               (define b (vector-copy a))
               (vector-set! a 0 99)
               (list (vector-ref a 0) (vector-ref b 0))`
  assert.deepEqual(run(src), [99, 1])
})

test('§6.8 — vector-copy with start/end', () => {
  const { run } = makeRunner()
  assert.deepEqual(run('(vector-copy #(1 2 3 4 5) 1 4)'), [2, 3, 4])
})

test('§6.8 — vector-copy! in-place copy', () => {
  const { run } = makeRunner()
  const src = `(define dst (vector 0 0 0 0 0))
               (define src (vector 1 2 3 4 5))
               (vector-copy! dst 1 src 0 3)
               dst`
  assert.deepEqual(run(src), [0, 1, 2, 3, 0])
})

// ── §6.8 vector-append ──────────────────────────────────────────────────

test('§6.8 — vector-append', () => {
  const { run } = makeRunner()
  assert.deepEqual(run('(vector-append #(1 2) #(3 4) #(5))'), [1, 2, 3, 4, 5])
})

// ── §6.8 vector <-> list ────────────────────────────────────────────────

test('§6.8 — vector->list', () => {
  const { run } = makeRunner()
  assert.deepEqual(run('(vector->list (vector 1 2 3))'), [1, 2, 3])
})

test('§6.8 — list->vector', () => {
  const { run } = makeRunner()
  assert.deepEqual(run("(list->vector '(1 2 3))"), [1, 2, 3])
})

// ── §6.8 vector-map / vector-for-each ───────────────────────────────────

test('§6.8 — vector-map single-vector', () => {
  const { run } = makeRunner()
  assert.deepEqual(run('(vector-map (lambda (x) (* x x)) #(1 2 3 4))'), [1, 4, 9, 16])
})

test('§6.8 — vector-map multi-vector zips', () => {
  const { run } = makeRunner()
  assert.deepEqual(run('(vector-map + #(1 2 3) #(10 20 30))'), [11, 22, 33])
})

test('§6.8 — vector-for-each iterates', () => {
  const { run } = makeRunner()
  const src = `(define sum 0)
               (vector-for-each (lambda (x) (set! sum (+ sum x))) #(1 2 3 4))
               sum`
  assert.equal(run(src), 10)
})

test('§6.8 — vector-for-each multi-vector', () => {
  const { run } = makeRunner()
  const src = `(define sum 0)
               (vector-for-each
                 (lambda (a b) (set! sum (+ sum (* a b))))
                 #(1 2 3) #(10 20 30))
               sum`
  assert.equal(run(src), 140)  // 10 + 40 + 90
})

// ── §6.8 vector <-> string ──────────────────────────────────────────────

test('§6.8 — vector->string (chars vector to string)', () => {
  const { run } = makeRunner()
  assert.equal(run('(vector->string (vector #\\a #\\b #\\c))'), 'abc')
})

test('§6.8 — string->vector', () => {
  const { run } = makeRunner()
  assert.equal(run('(vector-length (string->vector "hello"))'), 5)
})
