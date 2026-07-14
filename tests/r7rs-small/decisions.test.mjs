// tests/r7rs-small/decisions.test.mjs — meta assertions for each
// documented decision-entry (docs/ENGINEERING-DECISIONS.slat).
//
// Every decision that shapes the language surface gets ONE test here
// that asserts the contract holds. If a future refactor accidentally
// re-enables `string-set!` (decision-020) or ships `load` (decision-025),
// these tests catch the regression fast.
//
// This is the reverse-direction test: instead of "R7RS says X, do we
// do X?", it's "we said we do Y instead of X, do we still?".

import { test } from 'node:test'
import assert from 'node:assert'
import { makeRunner } from './_helpers.mjs'

// ── decision-006 — no mutable pair cells ────────────────────────────────

test('decision-006 — set-car! is not registered (no mutable pairs)', () => {
  const { run } = makeRunner()
  assert.throws(() => run("(set-car! (list 1 2) 99)"), /unbound symbol: set-car!/)
})

test('decision-006 — set-cdr! is not registered (no mutable pairs)', () => {
  const { run } = makeRunner()
  assert.throws(() => run("(set-cdr! (list 1 2) 99)"), /unbound symbol: set-cdr!/)
})

// ── decision-009 — vectors are mutable ──────────────────────────────────

test('decision-009 — vector-set! mutates in place', () => {
  const { run } = makeRunner()
  const src = `(define v (vector 1 2 3))
               (vector-set! v 0 99)
               (vector-ref v 0)`
  assert.equal(run(src), 99)
})

// ── decision-011 — no numeric tower (rationals collapse) ────────────────

test('decision-011 — numerator returns x (no rationals)', () => {
  const { run } = makeRunner()
  assert.equal(run('(numerator 5)'), 5)
})

test('decision-011 — denominator returns 1 (no rationals)', () => {
  const { run } = makeRunner()
  assert.equal(run('(denominator 5)'), 1)
})

// ── decision-019 — call/cc is escape-only ───────────────────────────────

test('decision-019 — call/cc escape works (single invocation)', () => {
  const { run } = makeRunner()
  assert.equal(run('(+ 1 (call/cc (lambda (k) (k 10))))'), 11)
})

test('decision-019 — call/cc without invocation returns body', () => {
  const { run } = makeRunner()
  assert.equal(run('(call/cc (lambda (k) 42))'), 42)
})

// ── decision-020 — strings are immutable ────────────────────────────────

test('decision-020 — string-set! is not registered', () => {
  const { run } = makeRunner()
  assert.throws(() => run('(string-set! "hi" 0 #\\x)'),
    /unbound symbol: string-set!/)
})

test('decision-020 — string-fill! is not registered', () => {
  const { run } = makeRunner()
  assert.throws(() => run('(string-fill! "hi" #\\x)'),
    /unbound symbol: string-fill!/)
})

test('decision-020 — string-copy! is not registered', () => {
  const { run } = makeRunner()
  assert.throws(() => run('(string-copy! "dst" 0 "src")'),
    /unbound symbol: string-copy!/)
})

test('decision-020 — canonical replacement path (port + get-output-string) works', () => {
  const { run } = makeRunner()
  const src = `(let ((p (open-output-string)))
                 (write-char #\\h p)
                 (write-string "ello" p)
                 (get-output-string p))`
  assert.equal(run(src), 'hello')
})

// ── decision-021 — complex numbers unsupported ──────────────────────────

test('decision-021 — make-rectangular signals error', () => {
  const { run } = makeRunner()
  assert.throws(() => run('(make-rectangular 3 4)'), /complex/i)
})

test('decision-021 — make-polar signals error', () => {
  const { run } = makeRunner()
  assert.throws(() => run('(make-polar 5 0)'), /complex/i)
})

test('decision-021 — complex? on real is #t (real is a subset of complex)', () => {
  const { run } = makeRunner()
  assert.equal(run('(complex? 5)'), true)
})

test('decision-021 — real-part on real x is x', () => {
  const { run } = makeRunner()
  assert.equal(run('(real-part 42)'), 42)
})

test('decision-021 — imag-part on real is 0', () => {
  const { run } = makeRunner()
  assert.equal(run('(imag-part 42)'), 0)
})

test('decision-021 — magnitude on real is abs', () => {
  const { run } = makeRunner()
  assert.equal(run('(magnitude -7)'), 7)
})

// ── decision-022 — file ports gated as verbs, not R7RS constructors ─────

test('decision-022 — open-input-file is not registered', () => {
  const { run } = makeRunner()
  assert.throws(() => run('(open-input-file "any.txt")'),
    /unbound symbol: open-input-file/)
})

test('decision-022 — open-output-file is not registered', () => {
  const { run } = makeRunner()
  assert.throws(() => run('(open-output-file "any.txt")'),
    /unbound symbol: open-output-file/)
})

test('decision-022 — call-with-output-file is not registered', () => {
  const { run } = makeRunner()
  assert.throws(() => run('(call-with-output-file "x" (lambda (p) 1))'),
    /unbound symbol: call-with-output-file/)
})

test('decision-022 — string ports still work (the audited replacement)', () => {
  const { run } = makeRunner()
  const src = `(let ((p (open-output-string)))
                 (write-string "audit-me" p)
                 (get-output-string p))`
  assert.equal(run(src), 'audit-me')
})

test('decision-022 — bytevector ports still work', () => {
  const { run } = makeRunner()
  const src = `(let ((p (open-output-bytevector)))
                 (write-u8 42 p)
                 (bytevector-u8-ref (get-output-bytevector p) 0))`
  assert.equal(run(src), 42)
})

// ── decision-023 — no define-library (flat namespace) ───────────────────

test('decision-023 — define-library is not registered', () => {
  const { run } = makeRunner()
  assert.throws(() => run('(define-library (m) (export a))'),
    /unbound symbol: define-library|define-library/i)
})

test('decision-023 — cond-expand still works (compile-time only)', () => {
  const { run } = makeRunner()
  assert.equal(run('(cond-expand (r7rs 1) (else 2))'), 1)
})

// ── decision-024 — characters are a distinct Ch type ────────────────────

test('decision-024 — char? on #\\a is #t', () => {
  const { run } = makeRunner()
  assert.equal(run('(char? #\\a)'), true)
})

test('decision-024 — string? on #\\a is #f (distinct from strings)', () => {
  const { run } = makeRunner()
  assert.equal(run('(string? #\\a)'), false)
})

test('decision-024 — char? on 1-char string is #f', () => {
  const { run } = makeRunner()
  assert.equal(run('(char? "a")'), false)
})

test('decision-024 — string-ref returns a character (Ch), not a string', () => {
  const { run } = makeRunner()
  assert.equal(run('(char? (string-ref "hi" 0))'), true)
})

// ── decision-025 — no runtime eval / read / load ────────────────────────

test('decision-025 — eval is not registered', () => {
  const { run } = makeRunner()
  assert.throws(() => run("(eval '(+ 1 2))"), /unbound symbol: eval/)
})

test('decision-025 — read is not registered', () => {
  const { run } = makeRunner()
  assert.throws(() => run('(read (open-input-string "()"))'),
    /unbound symbol: read/)
})

test('decision-025 — load is not registered', () => {
  const { run } = makeRunner()
  assert.throws(() => run('(load "any.scm")'), /unbound symbol: load/)
})

test('decision-025 — delete-file is not registered', () => {
  const { run } = makeRunner()
  assert.throws(() => run('(delete-file "any")'),
    /unbound symbol: delete-file/)
})

test('decision-025 — read-char / read-line / read-string DO work (raw text OK)', () => {
  const { run } = makeRunner()
  const src = `(let ((p (open-input-string "hi")))
                 (list (char->integer (read-char p))
                       (char->integer (read-char p))
                       (eof-object? (read-char p))))`
  assert.deepEqual(run(src), [104, 105, true])
})
