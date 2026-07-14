// tests/r7rs-small/bytevectors.test.mjs — R7RS-small §6.9 (bytevectors).
//
// Bytevectors are JS Uint8Array. All ops trivial.

import { test } from 'node:test'
import assert from 'node:assert'
import { makeRunner } from './_helpers.mjs'

// ── §6.9 Predicate ──────────────────────────────────────────────────────

test('§6.9 — bytevector? on Uint8Array is #t', () => {
  const { run } = makeRunner()
  assert.equal(run('(bytevector? (make-bytevector 3))'), true)
})

test('§6.9 — bytevector? on non-bytevector is #f', () => {
  const { run } = makeRunner()
  assert.equal(run("(bytevector? '(1 2 3))"), false)
  assert.equal(run('(bytevector? "hi")'), false)
})

// ── §6.9 Constructors ───────────────────────────────────────────────────

test('§6.9 — make-bytevector with length', () => {
  const { run } = makeRunner()
  assert.equal(run('(bytevector-length (make-bytevector 5))'), 5)
})

test('§6.9 — make-bytevector with fill', () => {
  const { run } = makeRunner()
  const b = run('(make-bytevector 3 42)')
  assert.equal(b[0], 42)
  assert.equal(b[1], 42)
  assert.equal(b[2], 42)
})

test('§6.9 — bytevector builds from bytes', () => {
  const { run } = makeRunner()
  const b = run('(bytevector 1 2 3 255)')
  assert.equal(b.length, 4)
  assert.equal(b[0], 1)
  assert.equal(b[3], 255)
})

// ── §6.9 length + ref + set! ────────────────────────────────────────────

test('§6.9 — bytevector-length', () => {
  const { run } = makeRunner()
  assert.equal(run('(bytevector-length (bytevector 1 2 3))'), 3)
})

test('§6.9 — bytevector-u8-ref', () => {
  const { run } = makeRunner()
  assert.equal(run('(bytevector-u8-ref (bytevector 10 20 30) 1)'), 20)
})

test('§6.9 — bytevector-u8-set! mutates', () => {
  const { run } = makeRunner()
  const src = `(define b (bytevector 0 0 0))
               (bytevector-u8-set! b 1 99)
               (bytevector-u8-ref b 1)`
  assert.equal(run(src), 99)
})

test('§6.9 — bytevector-u8-set! masks to byte range', () => {
  const { run } = makeRunner()
  const src = `(define b (bytevector 0))
               (bytevector-u8-set! b 0 300)
               (bytevector-u8-ref b 0)`
  assert.equal(run(src), 300 & 0xff)
})

// ── §6.9 bytevector-copy / bytevector-copy! ─────────────────────────────

test('§6.9 — bytevector-copy fresh copy', () => {
  const { run } = makeRunner()
  const src = `(define a (bytevector 1 2 3 4 5))
               (define b (bytevector-copy a))
               (bytevector-u8-set! a 0 99)
               (list (bytevector-u8-ref a 0) (bytevector-u8-ref b 0))`
  assert.deepEqual(run(src), [99, 1])
})

test('§6.9 — bytevector-copy with start/end', () => {
  const { run } = makeRunner()
  const src = '(bytevector-copy (bytevector 1 2 3 4 5) 1 4)'
  const b = run(src)
  assert.equal(b.length, 3)
  assert.equal(b[0], 2)
  assert.equal(b[2], 4)
})

test('§6.9 — bytevector-copy! in-place', () => {
  const { run } = makeRunner()
  const src = `(define dst (bytevector 0 0 0 0 0))
               (define src (bytevector 1 2 3 4 5))
               (bytevector-copy! dst 1 src 0 3)
               (list (bytevector-u8-ref dst 0)
                     (bytevector-u8-ref dst 1)
                     (bytevector-u8-ref dst 2)
                     (bytevector-u8-ref dst 3))`
  assert.deepEqual(run(src), [0, 1, 2, 3])
})

// ── §6.9 bytevector-append ──────────────────────────────────────────────

test('§6.9 — bytevector-append', () => {
  const { run } = makeRunner()
  const b = run('(bytevector-append (bytevector 1 2) (bytevector 3 4) (bytevector 5))')
  assert.equal(b.length, 5)
  assert.equal(b[0], 1)
  assert.equal(b[4], 5)
})

// ── §6.9 utf8 <-> string ────────────────────────────────────────────────

test('§6.9 — string->utf8 encodes ASCII', () => {
  const { run } = makeRunner()
  const b = run('(string->utf8 "hello")')
  assert.equal(b.length, 5)
  assert.equal(b[0], 104)  // 'h'
})

test('§6.9 — utf8->string decodes ASCII', () => {
  const { run } = makeRunner()
  assert.equal(run('(utf8->string (bytevector 104 105))'), 'hi')
})

test('§6.9 — utf8 round-trip', () => {
  const { run } = makeRunner()
  assert.equal(run('(utf8->string (string->utf8 "hello world"))'), 'hello world')
})
